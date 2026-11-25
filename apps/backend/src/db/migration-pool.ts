import { createRequire } from "node:module";
import { isIP, type Socket } from "node:net";
import { checkServerIdentity, TLSSocket } from "node:tls";
import pg from "pg";
import { MigrationDiagnosticError, migrationConnectionFailure, type MigrationConnectionStage } from "./migration-diagnostics.js";
import { createDatabasePool, type DatabaseLogin, type DatabasePoolEnvironment } from "./pool.js";

const mechanism = "SCRAM-SHA-256-PLUS";
const require = createRequire(import.meta.url);

interface SaslOffer { mechanisms: string[] }
interface SaslFinal { data: string }

// pg 8.23.1 exposes a preference but no option that requires channel binding.
// Keep the protocol and SCRAM verification in pg and fail closed at its auth hooks.
const ReviewedClient = pg.Client as unknown as new (config?: pg.ClientConfig) => pg.Client & {
  connection: { stream: Socket };
  host: string;
  saslSession?: { mechanism: string; message: string } | null;
  _connectionError: boolean;
  _handleAuthSASL(message: SaslOffer): void;
  _handleAuthSASLFinal(message: SaslFinal): void;
  _handleErrorWhileConnecting(error: unknown): void;
  _handleReadyForQuery(message: unknown): void;
};

class ChannelBoundClient extends ReviewedClient {
  #rejected = false;
  #verifiedSocket?: TLSSocket;
  #stage: MigrationConnectionStage;

  constructor(config?: pg.ClientConfig) {
    // pg-pool makes a separately supplied password non-enumerable.
    super({ ...config, password: config?.password, enableChannelBinding: true });
    this.#stage = isIP(this.host) ? "tcp-connection" : "dns-resolution";
    this.connection.stream.on("lookup", error => {
      if (!error) this.#stage = "tcp-connection";
    });
    this.connection.stream.once("connect", () => { this.#stage = "tls-handshake"; });
    this.connection.once("sslconnect", () => {
      this.connection.stream.once("secureConnect", () => { this.#stage = "authentication"; });
    });
  }

  #rejectAuthentication(stage: MigrationConnectionStage, reason: string): void {
    this.#rejected = true;
    this.#verifiedSocket = undefined;
    this.connection.stream.destroy(new MigrationDiagnosticError(stage, reason));
  }

  override _handleErrorWhileConnecting(error: unknown): void {
    super._handleErrorWhileConnecting(migrationConnectionFailure(error, this.#stage));
  }

  _handleAuthCleartextPassword(): void { this.#rejectAuthentication("authentication", "cleartext-fallback-rejected"); }

  _handleAuthMD5Password(): void { this.#rejectAuthentication("authentication", "md5-fallback-rejected"); }

  override _handleAuthSASL(message: SaslOffer): void {
    const socket = this.connection.stream;
    if (!(socket instanceof TLSSocket)) {
      this.#rejectAuthentication("tls-handshake", "tls-not-established");
      return;
    }
    if (!socket.authorized || checkServerIdentity(this.host, socket.getPeerCertificate())) {
      this.#rejectAuthentication("certificate-hostname-verification", "peer-verification-failed");
      return;
    }
    this.#stage = "scram-sha-256-plus-verification";
    if (this.#rejected || this.#verifiedSocket || this.saslSession) {
      this.#rejectAuthentication(this.#stage, "unexpected-scram-sequence");
      return;
    }
    if (!message.mechanisms.includes(mechanism)) {
      this.#rejectAuthentication(this.#stage, "scram-plus-not-offered");
      return;
    }
    // Even if the server offers plain SCRAM alongside PLUS, pg can only select PLUS.
    super._handleAuthSASL({ ...message, mechanisms: [mechanism] });
  }

  override _handleAuthSASLFinal(message: SaslFinal): void {
    const socket = this.connection.stream;
    if (this.#rejected || !(socket instanceof TLSSocket) || this.saslSession?.mechanism !== mechanism ||
        this.saslSession.message !== "SASLResponse") {
      this.#rejectAuthentication("scram-sha-256-plus-verification", "unexpected-scram-final");
      return;
    }
    super._handleAuthSASLFinal(message);
    // pg clears the session only after validating the server signature.
    if (this.saslSession === null && !this._connectionError) {
      this.#verifiedSocket = socket;
      this.#stage = "postgres-session-startup";
    }
  }

  override _handleReadyForQuery(message: unknown): void {
    if (!this.#verifiedSocket || this.#verifiedSocket !== this.connection.stream) {
      this.#rejectAuthentication("authentication", "ready-without-verified-channel-binding");
      return;
    }
    super._handleReadyForQuery(message);
  }
}

export function createMigrationPool(config: DatabasePoolEnvironment, transport: { login?: DatabaseLogin; readOnly?: boolean } = {}): pg.Pool {
  if (config.databaseSsl !== "verify-full") {
    if (config.nodeEnv === "production" || transport.readOnly || transport.login) {
      throw new MigrationDiagnosticError("tls-handshake", "verified-tls-required");
    }
    return createDatabasePool(config);
  }
  if (require("pg/package.json").version !== "8.23.1") {
    throw new MigrationDiagnosticError("local-evidence-verification", "unreviewed-postgresql-driver-version");
  }
  return createDatabasePool(config, {
    Client: ChannelBoundClient,
    login: transport.login,
    options: transport.readOnly ? "-c default_transaction_read_only=on" : undefined,
  });
}
