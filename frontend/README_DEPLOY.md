## Production setup (Square Checkout + stable API base)

1) **Deploy the backend**
   - Host `backend/server.js` on a Node-friendly host (Render, Railway, Fly.io, Heroku, AWS, etc.).
   - Configure env vars (never commit secrets):
     - `SQUARE_ACCESS_TOKEN`
     - `SQUARE_LOCATION_ID`
     - Optional (recommended if you switch envs often):
       - `SQUARE_ACCESS_TOKEN_SANDBOX`, `SQUARE_LOCATION_ID_SANDBOX`
       - `SQUARE_ACCESS_TOKEN_PROD`, `SQUARE_LOCATION_ID_PROD`
     - `SQUARE_ENV` (`sandbox` | `production`)
     - `SITE_URL` (your public frontend URL, used for Square redirect to `thank-you.html`)
     - Recommended security:
       - `CORS_ORIGINS` (comma-separated, do not use `*`)
       - `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_WEBHOOK_URL` (Square webhooks + signature verification)
     - Email (optional, for verification codes + receipts + contact/help/feedback):
     - `EMAIL_USER`, `EMAIL_PASS`
     - `ORDER_TO` (admin inbox for contact/help/feedback + new orders)
     - Optional SMTP overrides: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_SERVICE`, `EMAIL_FROM`
       - Recommended deliverability settings:
         - `EMAIL_FROM=no-reply@yourdomain.com`
         - `EMAIL_REPLY_TO=orders@yourdomain.com`
         - `EMAIL_ENVELOPE_FROM=bounces@yourdomain.com`
     - Ensure the service restarts on crash and has a health check hitting `/api/health`.

2) **Serve frontend over HTTPS**
   - Host `frontend/` (static) on your domain (S3+CloudFront, Netlify, Vercel, etc.).
   - Avoid mixed-content: backend must also be HTTPS.

3) **Point frontend at your API (no localhost hardcoding)**
   - Set the API base once in `frontend/config.js`:
     ```js
     window.API_BASE_URL = "https://your-backend.example.com";
     ```
   - If `window.API_BASE_URL` is empty, the frontend falls back to same-origin (works when frontend + backend are on the same domain).
   - You can also override in the console (persists via localStorage):
     ```js
     localStorage.setItem("pps_api_base", "https://your-backend.example.com");
     location.reload();
     ```

4) **Test steps**
   - `SQUARE_ENV=sandbox`: click “Pay online with Square”, complete checkout, and confirm redirect to `thank-you.html`.
   - Switch to `SQUARE_ENV=production` + production token/location and repeat.
   - Email diagnostics (backend):
     - `GET /api/health` shows `email.configured`
     - `GET /api/email/health` verifies SMTP login

5) **Inbox placement matters: do this in DNS**
   - Use a domain mailbox on your own domain, not a free Gmail `From` address, for example `orders@powerpolysupplies.com`.
   - Add SPF for your sending provider.
   - Enable DKIM signing in your provider and publish the DKIM records in DNS.
   - Publish a DMARC record for your domain. A safe starting point is:
     ```
     v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com; adkim=s; aspf=s
     ```
   - After everything passes, move DMARC toward `quarantine` or `reject`.
   - If possible, send through a transactional provider with a verified domain such as SendGrid instead of plain Gmail SMTP.
