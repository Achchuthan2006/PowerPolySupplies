## Production setup (no more 127.0.0.1 outages)

1) **Deploy the backend**  
   - Host `backend/server.js` on a Node-friendly host (Render, Railway, Fly.io, Heroku, AWS, etc.).  
   - Configure env vars:  
     - `STRIPE_SECRET_KEY` (live or test key)  
     - `SITE_URL` (your public frontend URL)  
     - `EMAIL_USER`, `EMAIL_PASS`, `ORDER_TO` (optional, for order/contact emails)  
   - Ensure the service restarts on crash and has a health check hitting `/api/health`.

2) **Serve frontend over HTTPS**  
   - Host `frontend/` (static) on your domain (S3+CloudFront, Netlify, Vercel, etc.).  
   - Avoid mixed-content: backend must also be HTTPS.

3) **Point frontend at your API once, persistently**  
   - Set a persistent API base in the browser (or include a small config.js that sets `window.PPS_API_BASE`).  
   - To override from the console (persists via localStorage):  
     ```js
     window.PPS_API_BASE = "https://api.yourdomain.com";
     localStorage.setItem("pps_api_base", window.PPS_API_BASE);
     location.reload();
     ```
   - For local dev, leave it as-is: defaults to `http://127.0.0.1:5000`.

4) **Monitoring**  
   - Add an uptime monitor (UptimeRobot/BetterUptime/etc.) on `/api/health` for alerts.

5) **Stripe URLs**  
   - In the backend `.env`, set `SITE_URL` to your public frontend (e.g., `https://yourdomain.com`). Stripe success/cancel URLs come from this.

With a deployed backend and the API base set to that URL, customers won’t see the “Backend unreachable” banner. For local testing, just run `npm run dev` in `backend/` and use the default 127.0.0.1 flow.
