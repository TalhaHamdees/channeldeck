# ChannelDeck — Setup Guide

One-time setup, ~20 minutes total. After this, every channel is one click + one Google sign-in.

There are three accounts to set up (all free): **Google Cloud** (API access), **Neon** (database), **Vercel** (hosting). Do them in this order.

---

## 1. Google Cloud (~10 min)

### 1a. Create the project and enable APIs

1. Go to https://console.cloud.google.com and sign in with your main Google account.
2. Top bar → project dropdown → **New Project** → name it `channeldeck` → Create → make sure it's selected.
3. Search bar → **"YouTube Data API v3"** → Enable.
4. Search bar → **"YouTube Analytics API"** → Enable.

### 1b. Configure the OAuth consent screen

1. Menu → **APIs & Services → OAuth consent screen** (Google may call it "Google Auth Platform → Branding").
2. User type: **External** → Create.
3. App name `ChannelDeck`, support email = your email, developer email = your email → Save through the steps (no scopes need to be added here; skip optional sections).
4. **CRITICAL:** Go to **Audience** (or the consent screen overview) and click **PUBLISH APP** so the status says **In production** — NOT "Testing".
   - If left in Testing, Google silently kills your channel connections every 7 days.
   - Publishing read-only YouTube scopes does **not** require Google's verification review. You'll see an "unverified app" warning when connecting your own channels — click "Advanced → continue". That's expected and fine for a personal app.

### 1c. Create the OAuth client

1. **APIs & Services → Credentials → + Create credentials → OAuth client ID**.
2. Application type: **Web application**, name `channeldeck-web`.
3. Under **Authorized redirect URIs**, add all four:
   - `http://localhost:3000/api/auth/callback/google`
   - `http://localhost:3000/api/channels/callback`
   - `https://YOUR-APP.vercel.app/api/auth/callback/google` *(add after step 3 when you know the URL)*
   - `https://YOUR-APP.vercel.app/api/channels/callback`
4. Create → copy the **Client ID** and **Client secret**.

## 2. Neon database (~3 min)

1. Go to https://console.neon.tech → sign up (GitHub/Google login).
2. Create a project (any name, region close to you).
3. On the project dashboard, copy the **connection string** (the pooled one, starts with `postgresql://`).

## 3. Local configuration (~3 min)

1. In the project folder, copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` = Neon connection string
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` = from step 1c
   - `ALLOWED_EMAIL` = your Google email (the only account that can log in)
   - `AUTH_SECRET` = any long random string (or run `openssl rand -base64 32`)
   - `TOKEN_ENCRYPTION_KEY` = 64 hex chars (run `openssl rand -hex 32`)
   - `CRON_SECRET` = any random string (run `openssl rand -hex 16`)
   - `NEXT_PUBLIC_APP_URL` = `http://localhost:3000`
2. Create the database tables:
   ```
   npx drizzle-kit migrate
   ```
3. Run it:
   ```
   npm run dev
   ```
4. Open http://localhost:3000 → sign in with Google → **Settings → Add channel** → in Google's account chooser, **pick the channel's identity** (each brand-account channel appears as its own entry) → grant all permissions. Repeat for every channel.
5. Up to a year of history backfills automatically (a few minutes per channel). Refresh the overview page and watch it fill in.

## 4. Deploy to Vercel (~5 min)

1. Push the repo to GitHub (private repo recommended).
2. Go to https://vercel.com → sign up → **Add New → Project** → import the repo.
3. In the import screen, expand **Environment Variables** and paste everything from your `.env`, except set `NEXT_PUBLIC_APP_URL` to your production URL (you can fix it after the first deploy reveals the URL, e.g. `https://channeldeck.vercel.app`).
4. Deploy.
5. Add the two production redirect URIs to the Google OAuth client (step 1c, items 3–4) using your real Vercel URL.
6. Visit the production URL on your phone → sign in → done. The nightly sync runs automatically at 09:00 UTC (after YouTube's analytics day closes in Pacific Time).

> Note: channels you connected locally are stored in the shared Neon database, so they appear in production immediately — no need to reconnect.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Reconnect" badge on a channel | Token was revoked (password change, security checkup, or app left in Testing mode). Settings → Reconnect, pick that channel again. |
| All channels died after ~7 days | OAuth consent screen is still in **Testing**. Publish to Production (step 1b.4), then reconnect each channel. |
| Revenue shows $0 everywhere | Make sure you checked **all** permission boxes on the Google consent screen when connecting (the monetary scope). Reconnect the channel if not. Note revenue data also lags ~2–3 days. |
| Impressions / CTR shows "—" | Google has not (yet) exposed thumbnail-impression metrics in the targeted Analytics API for your channel — everything else works without it. |
| "Access blocked" when connecting a channel | The "unverified app" warning — click **Advanced → Go to ChannelDeck (unsafe)**. It's your own app. |
| Numbers slightly differ from Studio for the last 2–3 days | Normal — YouTube finalizes data late; the nightly sync re-pulls the trailing 5 days and self-corrects. |
