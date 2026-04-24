## Power Poly Supplies — Security Notes

### Quick checklist (production)
- Use HTTPS for both frontend + backend.
- Terminate SSL/TLS at a reverse proxy such as NGINX.
- Enable HSTS and CSP in production.
- Run Node behind NGINX, not directly on the public internet.
- Use PM2 or an equivalent supervisor for auto-restart.
- Set `CORS_ORIGINS` to your real site origins (do not leave wildcard).
- Configure Square webhooks and enable signature verification:
  - `SQUARE_WEBHOOK_SIGNATURE_KEY`
  - `SQUARE_WEBHOOK_URL` (must match the exact URL in Square dashboard)
- Treat orders as **not paid** until backend confirms `status=paid`.

### What was hardened in code
- **CORS**: backend now uses an allowlist from `CORS_ORIGINS` (and `SITE_URL`) instead of allowing all origins.
- **Rate limiting**: `/api/create-payment` is rate-limited to reduce abuse/DoS and “free order spam”.
- **Square checkout integrity**: backend recomputes product prices (tiered pricing), tax, and shipping and ignores client-supplied prices for payment creation.
- **Square webhook signature verification**: `/api/square/webhook` verifies `x-square-signature` using HMAC SHA-256.

### Dependency checks (JS libs)
Because vulnerability data changes constantly, use tooling regularly:
- Backend:
  - `cd backend`
  - `npm run audit:prod`
  - `npm run deps:outdated`
- Frontend (if you install deps for build tooling):
  - `npm audit`

You can also run a hosted scanner (Snyk / GitHub Dependabot) on the repo.

### OWASP ZAP baseline scan (one-time)
Recommended: run against **staging** first, then production.

If you have Docker installed:
- Baseline (passive) scan:
  - `docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://your-site.example.com -r zap-report.html`
- API scan (if you later add OpenAPI/Swagger):
  - `docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py -t https://your-site.example.com/openapi.json -f openapi -r zap-api-report.html`

Review findings, then fix and rescan.

### Deployment hardening
- PM2 ecosystem file:
  - [backend/ecosystem.config.cjs](/c:/Users/Achch/Downloads/PowerPolySupplies-main/PowerPolySupplies-main/backend/ecosystem.config.cjs)
- Example NGINX reverse-proxy + TLS config:
  - [deploy/nginx/powerpolysupplies.conf](/c:/Users/Achch/Downloads/PowerPolySupplies-main/PowerPolySupplies-main/deploy/nginx/powerpolysupplies.conf)
- End-to-end deployment notes:
  - [DEPLOYMENT_SECURITY.md](/c:/Users/Achch/Downloads/PowerPolySupplies-main/PowerPolySupplies-main/DEPLOYMENT_SECURITY.md)

### Social login
- Google and Facebook OAuth are already wired in the backend and login UI.
- The buttons remain disabled until the backend detects valid provider credentials.
- Setup guide:
  - [OAUTH_SETUP.md](/c:/Users/Achch/Downloads/PowerPolySupplies-main/PowerPolySupplies-main/OAUTH_SETUP.md)
