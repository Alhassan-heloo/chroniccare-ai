export interface Environment {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  corsOrigins: string[];
  databaseUrl: string;
  databaseSsl: "disable" | "verify-full";
  databaseSslCaFile?: string;
}

export function readEnvironment(env: NodeJS.ProcessEnv = process.env): Environment {
  const nodeEnv = env.NODE_ENV ?? "development";
  if (nodeEnv !== "development" && nodeEnv !== "test" && nodeEnv !== "production") {
    throw new Error("NODE_ENV must be development, test, or production.");
  }
  const portValue = env.PORT ?? "3001";
  const port = Number(portValue);
  if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535.");
  }
  const host = env.HOST?.trim() ?? "127.0.0.1";
  if (!host) throw new Error("HOST must not be empty.");
  const corsOrigins = (env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",").map((origin) => origin.trim());
  if (corsOrigins.some((origin) => {
    try {
      const parsed = new URL(origin);
      return !["http:", "https:"].includes(parsed.protocol) || parsed.origin !== origin;
    } catch { return true; }
  })) {
    throw new Error("CORS_ORIGINS must contain explicit HTTP(S) origins, without paths or wildcards.");
  }
  const databaseUrl = env.DATABASE_URL;
  try {
    if (!databaseUrl) throw new Error();
    const parsed = new URL(databaseUrl);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol) ||
        !parsed.hostname || !parsed.username || parsed.pathname.length <= 1 ||
        parsed.hash || [...parsed.searchParams.keys()].some((key) => key.toLowerCase().startsWith("ssl"))) {
      throw new Error();
    }
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL URL with a host, user, and database; configure TLS using DATABASE_SSL, not URL SSL parameters.");
  }
  const databaseSsl = env.DATABASE_SSL ?? "disable";
  if (databaseSsl !== "disable" && databaseSsl !== "verify-full") {
    throw new Error("DATABASE_SSL must be disable or verify-full.");
  }
  const databaseSslCaFile = env.DATABASE_SSL_CA_FILE?.trim() || undefined;
  if (databaseSslCaFile && databaseSsl !== "verify-full") {
    throw new Error("DATABASE_SSL_CA_FILE requires DATABASE_SSL=verify-full.");
  }
  if (nodeEnv === "production" && databaseSsl !== "verify-full") {
    throw new Error("Production requires DATABASE_SSL=verify-full.");
  }
  return { nodeEnv, host, port, corsOrigins, databaseUrl, databaseSsl, databaseSslCaFile };
}
