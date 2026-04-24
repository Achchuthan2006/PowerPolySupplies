## Secure Node.js Deployment

### 1. HTTPS and SSL
- Terminate TLS at NGINX with a real certificate.
- Example cert paths are in [deploy/nginx/powerpolysupplies.conf](/c:/Users/Achch/Downloads/PowerPolySupplies-main/PowerPolySupplies-main/deploy/nginx/powerpolysupplies.conf).
- Recommended certificate flow:
  - Install `certbot`
  - Run `sudo certbot --nginx -d powerpolysupplies.com -d www.powerpolysupplies.com`

### 2. Reverse Proxy
- Run Node only on localhost, for example `127.0.0.1:5000`.
- Put NGINX in front of it.
- The NGINX config:
  - Redirects HTTP to HTTPS
  - Disables directory listing with `autoindex off`
  - Forwards `/api/*` to Node
  - Serves static frontend files directly

### 3. Secure Headers
- App-level headers are enforced in [backend/server.js](/c:/Users/Achch/Downloads/PowerPolySupplies-main/PowerPolySupplies-main/backend/server.js).
- Proxy-level headers are also enforced in [deploy/nginx/powerpolysupplies.conf](/c:/Users/Achch/Downloads/PowerPolySupplies-main/PowerPolySupplies-main/deploy/nginx/powerpolysupplies.conf).
- HSTS is enabled in production.
- CSP is enabled and allows only the domains needed for Google reCAPTCHA and Square.

### 4. PM2
- Start the backend with:
  - `cd backend`
  - `npm install -g pm2`
  - `npm run pm2:start`
- Persist across reboots:
  - `pm2 save`
  - `pm2 startup`

### 5. Dependencies
- Check for vulnerable packages regularly:
  - `cd backend`
  - `npm run audit:prod`
  - `npm run deps:outdated`
- Patch on a schedule:
  - `npm update`
  - Re-run tests and redeploy

### 6. Deployment Checklist
- Set `NODE_ENV=production`
- Keep `.env` out of git
- Bind Node to localhost or a private interface behind NGINX
- Allow only ports `80` and `443` publicly
- Use firewall rules for SSH/admin access
- Monitor PM2 logs and restart behavior
