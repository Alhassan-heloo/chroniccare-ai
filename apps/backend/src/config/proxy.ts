import { isIP } from "node:net";

/** Render mode is a positional trust boundary, not an ingress IP allowlist. */
export function readTrustedProxy(env: NodeJS.ProcessEnv = process.env): string | 1 | undefined {
  const trustedProxy = env.TRUST_PROXY_IP || undefined;
  if (trustedProxy && !isIP(trustedProxy)) throw new Error("TRUST_PROXY_IP must identify one trusted reverse proxy.");
  const render = env.TRUST_RENDER_PROXY;
  if (render !== undefined && render !== "true" && render !== "false") {
    throw new Error("TRUST_RENDER_PROXY must be true or false.");
  }
  if (render !== "true") return trustedProxy;
  if (trustedProxy) throw new Error("Configure TRUST_RENDER_PROXY or TRUST_PROXY_IP, not both.");
  if (env.RENDER !== "true" || env.RENDER_SERVICE_TYPE !== "web") {
    throw new Error("TRUST_RENDER_PROXY requires a Render web service.");
  }
  // Only the socket peer is trusted. Never trust every X-Forwarded-For entry.
  // Requires ingress-only access and proxy-owned forwarding headers; see deployment docs.
  return 1;
}
