# Deployment

## Standalone Node deployment

```bash
cd frontend
npm ci
npm run build
npm run start
```

The server listens on port 3000 by default. The `postbuild` step prepares
`.next/standalone` with matching static/public assets. Deploy that complete
directory when copying output to another host.

## Reverse proxy and HTTPS

Terminate TLS at Caddy, Nginx, or a managed load balancer and proxy to Node.
Preserve original host/protocol headers and enable compression.

Recommended headers:

```text
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(self)
```

Create a Content Security Policy only after listing each map, routing, search,
image, and worker origin used by your configuration.

## Environment and secrets

Optional variables are documented in `.env.example`. Never commit `.env`,
database passwords, traffic keys, or provider credentials.

Run the server under systemd, Docker, or a supervisor with automatic restart,
resource limits, log rotation, HTTPS health checks, and rollback support.

Never mix server/HTML output from one build with `_next/static` from another;
that causes CSS 500 and JavaScript 404 failures.

## Public API capacity

Before significant traffic, self-host or contract supported search/routing
providers, add rate limits, cache suitable requests, set bounded timeouts, and
publish a privacy policy describing coordinate sharing.

## Optional Docker data stack

```bash
cp .env.example .env
docker compose --env-file .env -f docker-compose.backend.yml up -d --build
```

The stack includes PostGIS, Redis, Meilisearch, Photon, Valhalla, and FastAPI.
Build region data before starting region-dependent services.

## Release checklist

1. Run `npm ci`, `npm run typecheck`, and `npm run build`.
2. Test Trichy and Chennai in desktop and a real mobile browser.
3. Test search, nearby, all route modes, GPS granted/denied, and tracking.
4. Confirm attribution and imagery licenses.
5. Confirm no `.env`, generated data, or credentials are staged.
6. Deploy one complete standalone build atomically.
