# Render ingress and readiness

This opt-in transport fix is based on commit `355fa1a`. It changes no database,
authentication, cookie flags, CORS allowlist, CSRF policy or rate-limit thresholds.

## Why Live did not mean ready

Render's default TCP check verifies that the listening socket accepts a connection.
It does not exercise Express middleware or PostgreSQL. Render terminates public
HTTPS at its load balancer and forwards HTTP to the application. With proxy trust
disabled, Express correctly sees that hop as HTTP and production browser security
returns `HTTPS_REQUIRED` even for a public HTTPS request.

Sources: [Render web service networking](https://render.com/docs/web-services#connect-to-your-web-service),
[Render health checks](https://render.com/docs/health-checks).

## Exact Render settings

On the **backend Web Service**, add this environment variable:

```text
TRUST_RENDER_PROXY=true
```

Render automatically supplies `RENDER=true` and `RENDER_SERVICE_TYPE=web`.
The application requires both markers before accepting this opt-in; they are
deployment configuration checks, not proof of an individual peer's identity.
Do not manually add these markers to enable this mode on a different platform.
See [Render's default environment variables](https://render.com/docs/environment-variables).

Set **Settings → Health Checks → Health Check Path** to:

```text
/api/health/ready
```

Keep `NODE_ENV=production`, the existing HTTPS application/CORS origins, verified
PostgreSQL TLS, `HOST=0.0.0.0` and Render's assigned `PORT`. No change to database
credentials or migrations is required. These changes remain local until the
operator commits/pushes and deploys them; no Render setting has been changed here.

## Trust boundary and limits

The option configures Express **`trust proxy = 1`**, never `true`. Only the socket
peer is treated as a trusted proxy. Forwarded addresses beyond that one hop are
not trusted proxies: Express stops at the nearest untrusted `X-Forwarded-For`
address instead of accepting an arbitrary client-supplied leftmost address.
The production guard also refuses comma-separated `X-Forwarded-Proto` values in
this mode; an ingress must supply one protocol rather than append a client value.

This is **positional trust**, not a Render IP allowlist. It assumes:

- All public application traffic reaches the process through the Render ingress.
  Render documents that the bound service port is not directly internet-reachable.
- The immediate ingress owns/overwrites the scheme and host forwarding headers
  and establishes the rightmost client-address boundary. Do not infer HTTPS from
  a raw header in application code or increase the hop count to chase a leftmost IP.
- Any service able to connect directly to this process over Render's private
  network is also trusted. A direct private caller occupies the same socket-hop
  position and can assert forwarding headers. One-hop trust cannot distinguish it
  from the ingress. Do not enable this option where untrusted private services,
  extra listeners, tunnels or a shorter bypass path can reach the application.

Render documents private connectivity between eligible services in the same
workspace/region; paid workspaces can isolate environments. See
[Render private networking](https://render.com/docs/private-network) and
[Express's hop-count warning](https://expressjs.com/en/guide/behind-proxies/).
Those documents establish the topology constraints, but do not provide an
application-specific ingress peer allowlist or prove the deployed forwarding-header
rewrite policy. That policy must be checked on the actual deployment. There was
no deployment URL or ingress trace available in this local task, so the tests
simulate the trusted ingress; they do not claim a live Render deployment check.

If these assumptions do not hold, leave the option disabled and use the existing
`TRUST_PROXY_IP=<one literal IPv4/IPv6 address>` with a verified, non-bypassable
proxy. Existing IP deployments are unchanged. Configuring both options fails
startup rather than silently widening trust. Unset/`false` Render opt-in never
enables trust, even when Render's automatic markers are present. Invalid option
values also fail startup.

The existing rate limiters still use Express's `request.ip`. One hop can
conservatively group clients behind an upstream CDN/proxy rather than expose
their original IP; it does not permit rotating an untrusted leftmost prefix to
reset the quota. No limiter, CSRF check or cookie security attribute is disabled.

## Readiness exception

Only exact **`GET /api/health/ready`** may use internal HTTP, whether or not proxy
trust is configured. Its existing handler still awaits the database check
(`SELECT 1` in the server wiring): `200 {status:"ok",database:"up"}` on success,
or sanitized `503 {status:"unavailable",database:"down"}` on failure. It issues
no authentication/CSRF cookies, remains `Cache-Control: no-store`, and retains
Helmet and CORS handling.

`/api/health`, application routes, other readiness suffixes/trailing slashes and
non-GET readiness requests retain the production HTTPS requirement. Existing
CORS preflight behavior is unchanged. The probe exception is not a cookie or
authentication bypass for any application route.

## Verification

From `apps/backend`:

```powershell
npm.cmd run typecheck
npm.cmd run build
node --import tsx --test tests/render-ingress.test.ts tests/app.test.ts tests/env.test.ts
```

The tests use real local HTTP sockets, simulated ingress forwarding and isolated
in-memory auth/database callbacks; they make no account or medical-data writes.
They cover default and mismatched-IP forwarding rejection, legacy exact-IP
forwarding, one-hop HTTPS forwarding, ambiguous protocol rejection, secure cookie
flags, CORS, CSRF, spoofed-prefix rate limiting, and readiness 200/503 outcomes.

Actual local results: typecheck, build and lint passed; the focused selection
passed **18/18** tests. The complete backend suite also passed **81/81**, with
zero skips, on a newly created isolated PostgreSQL test database using the
existing `apps/frontend/scripts/final-postgres.mjs` wrapper. Application and
production databases were not used for these writes.

After the operator deploys, verify public HTTPS readiness and a normal application
route such as `/api/auth/csrf`. The latter must return a `Secure; HttpOnly;
SameSite=Lax; Path=/` `__Host-cc_csrf` cookie. Verify that a public HTTPS request
with a client-supplied `X-Forwarded-Proto: http` is normalized by the ingress;
the app must not see a client-owned protocol/list. Check internal HTTP readiness
and confirm that internal HTTP application requests without HTTPS forwarding
remain rejected. Do not log cookie/token values. No production database outage
needs to be induced: the local failure test exercises the existing 503 contract.
