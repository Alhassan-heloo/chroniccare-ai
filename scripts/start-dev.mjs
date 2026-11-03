// Windows local launcher: no dependencies, migrations, credential output, or process killing.
import { access, readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";

class StartupError extends Error {}

const root = fileURLToPath(new URL("../", import.meta.url));
const backend = join(root, "apps", "backend");
const frontend = join(root, "apps", "frontend");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function exists(path) { try { await access(path); return true; } catch { return false; } }
async function freePort(value) {
  for (const host of ["127.0.0.1", "::1"]) {
    const occupied = await new Promise(resolve => {
      const socket = net.connect({ port: value, host });
      socket.setTimeout(750);
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("error", () => { socket.destroy(); resolve(false); });
      socket.once("timeout", () => { socket.destroy(); resolve(false); });
    });
    if (occupied) throw new StartupError(`Port ${value} is already in use. No new servers were started. Stop the existing server yourself; this launcher never terminates other processes.`);
  }
  // Windows can allow independent IPv4/IPv6 listeners: check both explicitly.
  for (const host of ["0.0.0.0", "::"]) {
  const probe = net.createServer();
  try { await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen({ port: value, host, exclusive: true }, resolve); }); }
  catch (error) {
    if (host === "::" && ["EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code)) continue;
    throw new StartupError(`Port ${value} is occupied or unavailable. No new servers were started. Stop the existing server yourself; this launcher never terminates other processes.`);
  }
  finally { if (probe.listening) await new Promise(resolve => probe.close(resolve)); }
  }
}
function command(commandLine, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/c", commandLine], { env, windowsVerbatimArguments: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new StartupError("Windows could not open the requested window.")));
  });
}
function serverWindow(title, directory, args, env = process.env) {
  // /WAIT keeps the launching cmd alive as long as its visible server window.
  // This also preserves the process tree in Windows environments using job objects.
  const child = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/c",
    `start "${title}" /WAIT /D "${directory}" cmd.exe /d /k npm.cmd run dev${args}`],
  { env, windowsVerbatimArguments: true, stdio: "ignore" });
  child.on("error", () => console.error("Could not open a server window. Check Windows permissions."));
}
async function waitFor(url, ready) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(2500) }); if (await ready(response)) return; }
    catch { /* Startup is asynchronous; do not log raw network errors. */ }
    await sleep(500);
  }
  throw new StartupError("Services did not become ready within 60 seconds. Check the Backend/Frontend windows, PostgreSQL service, and local .env settings. Servers already launched remain visible; stop them with Ctrl+C before retrying.");
}
async function main() {
  if (process.platform !== "win32") throw new StartupError("Use this launcher on Windows only.");
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (!(major >= 24 || (major === 22 && minor >= 13))) throw new StartupError("Install a supported Node.js version: 22.13+ on 22.x, or 24+ (24 LTS recommended).");
  if (spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/c", "npm.cmd --version"], { stdio: "ignore" }).status !== 0) throw new StartupError("npm.cmd is unavailable. Repair Node.js/npm.");
  if (!await exists(join(backend, ".env"))) throw new StartupError("Missing apps/backend/.env. Copy .env.example locally and configure PostgreSQL privately. Never paste credentials in chat.");
  for (const [dir, dependency, label] of [[backend, "tsx", "backend"], [backend, "express", "backend"], [frontend, "vite", "frontend"]]) {
    if (!await exists(join(dir, "node_modules", dependency, "package.json"))) throw new StartupError(`Missing ${label} dependencies. Run npm.cmd ci once in apps/${label}, then double-click again.`);
  }
  const env = { ...parseEnv(await readFile(join(backend, ".env"), "utf8")), ...process.env };
  if (!env.DATABASE_URL || new URL(env.DATABASE_URL).pathname !== "/chroniccare") throw new StartupError("Backend DATABASE_URL must select the existing chroniccare application database (not the test database). Check it privately in apps/backend/.env.");
  if ((env.NODE_ENV || "development") !== "development") throw new StartupError("This is a development launcher. Set NODE_ENV=development locally or remove an inherited NODE_ENV override.");
  const apiPort = 3001, webPort = 5173;
  const webOrigin = "http://localhost:5173", apiOrigin = "http://localhost:3001";
  // Override only child development settings; production and local files are untouched.
  const backendEnv = { ...env, NODE_ENV: "development", HOST: "localhost", PORT: "3001",
    CORS_ORIGINS: webOrigin, APP_PUBLIC_ORIGIN: webOrigin };
  await freePort(apiPort); await freePort(webPort);
  // cmd expands % even inside quotes; refuse unusual paths rather than execute them incorrectly.
  if (/[\r\n%!"]/.test(root)) throw new StartupError("Move the checkout to a path without percent signs, exclamation marks, or quotes.");
  console.log("Prerequisites passed. Opening Backend and Frontend terminal windows...");
  serverWindow("ChronicCare AI - Backend", backend, "", backendEnv);
  // Only this child's public API address is overridden. No .env is rewritten and no
  // backend database credentials are passed from its .env into the frontend process.
  serverWindow("ChronicCare AI - Frontend", frontend, ` -- --host localhost --port ${webPort} --strictPort`,
    { ...process.env, VITE_API_URL: `${apiOrigin}/api` });
  await waitFor(`${apiOrigin}/api/health`, async r => r.status === 200 && (await r.json()).service === "chroniccare-api");
  await waitFor(`${apiOrigin}/api/health/ready`, async r => r.status === 200 && (await r.json()).database === "up");
  await waitFor(webOrigin, async r => r.status === 200 && (await r.text()).includes("/@vite/client"));
  const preflight = await fetch(`${apiOrigin}/api/auth/login`, { method: "OPTIONS", headers: {
    Origin: webOrigin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,x-csrf-token",
  }, signal: AbortSignal.timeout(5000) });
  const me = await fetch(`${apiOrigin}/api/auth/me`, { headers: { Origin: webOrigin }, signal: AbortSignal.timeout(5000) });
  if (preflight.status !== 204 || preflight.headers.get("access-control-allow-origin") !== webOrigin ||
      me.status !== 401 || (await me.json()).error?.code !== "UNAUTHENTICATED") throw new StartupError("Authentication/CORS checks failed. Check the Backend window and local origin configuration.");
  const csrf = await fetch(apiOrigin + "/api/auth/csrf", { headers: { Origin: webOrigin } });
  const csrfBody = await csrf.json();
  if (csrf.status !== 200 || !/^[a-f0-9]{64}$/.test(csrfBody.csrfToken || "") ||
      !csrf.headers.getSetCookie().some(value => value.startsWith("cc_csrf=") && value.includes("SameSite=Lax"))) {
    throw new StartupError("CSRF initialization failed. Use only http://localhost:5173 and check the Backend window.");
  }
  console.log("PASS: frontend, health (200), PostgreSQL readiness (200), auth protection (401), and CORS preflight (204).");
  console.log(`Opening ${webOrigin}. Stop BOTH titled server windows with Ctrl+C (confirm Y if asked), then close them.`);
  await command(`start "" "${webOrigin}"`);
  console.log("Keep this startup window open while developing. After stopping BOTH server windows, press Enter here to finish.");
  process.stdin.resume();
  await new Promise(resolve => process.stdin.once("data", resolve));
  process.stdin.pause();
}
main().catch(error => {
  // Only our own sanitized messages are safe to display; configuration parsing may
  // otherwise include a connection URL in a native exception.
  console.error(error instanceof StartupError ? error.message : "Startup failed. Check local configuration, installed dependencies, and the server windows. No credentials were printed.");
  process.exitCode = 1;
});
