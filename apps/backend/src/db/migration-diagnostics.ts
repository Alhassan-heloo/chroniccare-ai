export type MigrationConnectionStage =
  | "dns-resolution" | "tcp-connection" | "tls-handshake" | "certificate-hostname-verification"
  | "authentication" | "scram-sha-256-plus-verification" | "postgres-session-startup";

export type MigrationStage = MigrationConnectionStage
  | "connection-url-validation" | "credential-transfer" | "local-evidence-verification" | "read-only-transaction-initialization"
  | "database-identity-verification" | "migration-ledger-verification" | "schema-checks"
  | "role-permission-checks" | "lock-checks" | "integrity-checks" | "read-only-transaction-cleanup"
  | "post-migration-verification";

export class MigrationDiagnosticError extends Error {
  constructor(readonly stage: MigrationStage, readonly reason: string) {
    super(`${stage}: ${reason}`);
  }
}

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
}

export function migrationConnectionFailure(error: unknown, stage: MigrationConnectionStage): MigrationDiagnosticError {
  if (error instanceof MigrationDiagnosticError) return error;
  const message = error instanceof Error ? error.message : "";
  if (message === "Connection terminated due to connection timeout") {
    // pg-pool wraps its timeout around the error from the connecting client.
    return error instanceof Error && error.cause instanceof MigrationDiagnosticError
      ? new MigrationDiagnosticError(error.cause.stage, "connection-timeout")
      : new MigrationDiagnosticError(stage, "connection-timeout");
  }
  const code = errorCode(error);
  if (["ENOTFOUND", "EAI_AGAIN", "EAI_FAIL", "EAI_NODATA"].includes(code)) {
    return new MigrationDiagnosticError("dns-resolution", "lookup-failed");
  }
  if (code === "ECONNREFUSED") return new MigrationDiagnosticError("tcp-connection", "connection-refused");
  if (["EHOSTUNREACH", "ENETUNREACH"].includes(code)) return new MigrationDiagnosticError("tcp-connection", "route-unreachable");
  if (code === "ERR_TLS_CERT_ALTNAME_INVALID") {
    return new MigrationDiagnosticError("certificate-hostname-verification", "hostname-mismatch");
  }
  if (/^(?:CERT_|X509_)/.test(code) || ["DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_GET_ISSUER_CERT", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"].includes(code)) {
    return new MigrationDiagnosticError("certificate-hostname-verification", "certificate-verification-failed");
  }
  if (code === "28P01" || code === "28000") return new MigrationDiagnosticError("authentication", "credentials-or-role-rejected");
  if (message === "SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string" ||
      message === "SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string") {
    return new MigrationDiagnosticError("authentication", "password-unavailable-to-driver");
  }
  if (code === "3D000") return new MigrationDiagnosticError("database-identity-verification", "database-not-available");
  if (code === "ETIMEDOUT" || message === "timeout expired") return new MigrationDiagnosticError(stage, "connection-timeout");
  if (["ECONNRESET", "EPIPE", "ERR_STREAM_DESTROYED"].includes(code)) return new MigrationDiagnosticError(stage, "connection-closed");
  if (message === "The server does not support SSL connections") return new MigrationDiagnosticError("tls-handshake", "tls-not-offered");
  if (/^(?:ERR_TLS_|ERR_SSL_)/.test(code) || code === "EPROTO") return new MigrationDiagnosticError("tls-handshake", "tls-protocol-error");
  if (message === "SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match") {
    return new MigrationDiagnosticError("scram-sha-256-plus-verification", "server-signature-mismatch");
  }
  if (["22023", "42704"].includes(code)) return new MigrationDiagnosticError(stage, "startup-parameter-rejected");
  return new MigrationDiagnosticError(stage, "connection-failed-at-last-observed-stage");
}

export function migrationQueryFailure(error: unknown, stage: MigrationStage): MigrationDiagnosticError {
  if (error instanceof MigrationDiagnosticError) return error;
  const reasons = new Map([
    ["42501", "permission-denied"], ["42P01", "relation-missing"], ["42703", "column-missing"],
    ["42704", "object-or-setting-missing"], ["55P03", "lock-unavailable"], ["57014", "query-cancelled-or-server-timeout"],
    ["25006", "read-only-transaction-enforced"],
  ]);
  const code = errorCode(error);
  const reason = reasons.get(code) ?? (error instanceof Error && error.message === "Query read timeout"
    ? "client-query-timeout" : "query-failed");
  return new MigrationDiagnosticError(stage, reason);
}

function hasControl(value: string): boolean {
  return Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
}

export function requireDiagnosticCredential(source: string | undefined, inputLength: string | undefined): string {
  const length = Number(inputLength);
  if (!source || !Number.isSafeInteger(length) || length < 1 || inputLength !== String(length) || source.length !== length) {
    throw new MigrationDiagnosticError("credential-transfer", "credential-transfer-failed");
  }
  return source;
}

export function parseMigrationLogin(source: string | undefined, expected: {host: string; port: number; database: string; user: string}) {
  if (!source) throw new MigrationDiagnosticError("connection-url-validation", "missing-url-input");
  if (hasControl(source)) throw new MigrationDiagnosticError("connection-url-validation", "url-control-character");
  const firstLine = source.trimStart();
  if (!firstLine) throw new MigrationDiagnosticError("connection-url-validation", "missing-url-input");
  // Identify common paste wrappers without accepting or extracting their contents.
  if (/^(?:["'`]|(?:&\s+)?psql(?:\.exe)?(?:\s|$)|(?:export\s+|\$env:)?DATABASE_URL\s*=)/i.test(firstLine)) {
    throw new MigrationDiagnosticError("connection-url-validation", "unexpected-url-wrapper");
  }
  let url: URL;
  try { url = new URL(source); }
  catch { throw new MigrationDiagnosticError("connection-url-validation", "malformed-url"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== expected.host ||
      Number(url.port || 5432) !== expected.port || url.pathname !== `/${expected.database}` || url.search || url.hash) {
    throw new MigrationDiagnosticError("connection-url-validation", "target-or-url-options-rejected");
  }
  let user: string;
  let password: string;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch { throw new MigrationDiagnosticError("connection-url-validation", "invalid-credential-encoding"); }
  if (user !== expected.user || !password || hasControl(password)) {
    throw new MigrationDiagnosticError("connection-url-validation", "role-or-password-rejected");
  }
  return { ...expected, password };
}
