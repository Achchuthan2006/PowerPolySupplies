# OAuth Setup

This project already includes backend routes for Google and Facebook sign-in. The social buttons stay disabled until the backend detects valid OAuth credentials.

## 1. Frontend and backend URLs

Set these in `backend/.env`:

```env
SITE_URL=https://your-frontend-domain.com
FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGINS=https://your-frontend-domain.com
```

Your backend should be reachable over HTTPS, for example:

```text
https://api.your-domain.com
```

If you do not set custom redirect URIs, the backend automatically expects:

- Google: `https://api.your-domain.com/api/auth/oauth/google/callback`
- Facebook: `https://api.your-domain.com/api/auth/oauth/facebook/callback`

## 2. Google OAuth

In Google Cloud Console:

1. Create or open a project.
2. Go to `APIs & Services` -> `Credentials`.
3. Create an `OAuth client ID`.
4. Choose `Web application`.
5. Add an authorized redirect URI:

```text
https://api.your-domain.com/api/auth/oauth/google/callback
```

Then copy the client ID and secret into `backend/.env`:

```env
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id
OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Optional, only if you want to override the default callback:

```env
OAUTH_GOOGLE_REDIRECT_URI=https://api.your-domain.com/api/auth/oauth/google/callback
```

## 3. Facebook Login

In Meta for Developers:

1. Create an app.
2. Add the `Facebook Login` product.
3. Use the Web platform.
4. Add this valid OAuth redirect URI:

```text
https://api.your-domain.com/api/auth/oauth/facebook/callback
```

5. Make sure the app has access to `email`.

Then copy the app ID and secret into `backend/.env`:

```env
OAUTH_FACEBOOK_APP_ID=your-facebook-app-id
OAUTH_FACEBOOK_APP_SECRET=your-facebook-app-secret
```

Optional, only if you want to override the default callback:

```env
OAUTH_FACEBOOK_REDIRECT_URI=https://api.your-domain.com/api/auth/oauth/facebook/callback
```

## 4. Restart the backend

After updating `backend/.env`, restart the server or PM2 process so the new variables load.

Examples:

```bash
cd backend
pm2 restart ecosystem.config.cjs
```

or

```bash
cd backend
npm start
```

## 5. Verify configuration

Open this endpoint in the browser:

```text
https://api.your-domain.com/api/auth/oauth/status
```

A working setup returns:

```json
{
  "ok": true,
  "providers": {
    "google": { "configured": true },
    "facebook": { "configured": true }
  }
}
```

Once that endpoint reports `configured: true`, the Google and Facebook buttons become clickable in the login modal.

## 6. Common reasons the buttons stay disabled

- `backend/.env` is missing one of the OAuth variables.
- The backend was not restarted after editing `.env`.
- `SITE_URL` or `FRONTEND_URL` points to the wrong domain.
- The redirect URI in Google or Meta does not exactly match the backend callback URL.
- You are testing on `http://` while the provider is configured for `https://`.
