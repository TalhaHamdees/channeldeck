# ChannelDeck

All your YouTube channels, one dashboard. Combined and per-channel analytics — views, watch time, subscribers, traffic sources, demographics, and estimated revenue — pulled nightly from the YouTube Analytics API into your own database.

**First time here? Follow [SETUP.md](./SETUP.md).**

## How it works

- **Connect channels once** — Settings → Add channel → Google sign-in per channel (brand accounts supported via Google's account chooser). Refresh tokens are stored AES-256-GCM encrypted.
- **Nightly sync** (Vercel Cron, 09:00 UTC) pulls daily metrics per channel into Postgres, re-pulling the trailing 5 days so YouTube's late revenue adjustments self-correct. New channels backfill 365 days of history automatically.
- **Dashboard reads from Postgres** — fast page loads, zero API quota spent on browsing.
- **Login is locked** to the single Google account in `ALLOWED_EMAIL`.

## Stack

Next.js 16 (App Router) · Neon Postgres + Drizzle ORM · Auth.js v5 · shadcn/ui + Recharts · Vercel (hosting + cron)

## Commands

```bash
npm run dev            # local dev server
npm run build          # production build
npx drizzle-kit migrate    # apply DB migrations
npx drizzle-kit generate   # regenerate migrations after schema changes
```

## Project map

```
src/
  db/schema.ts                 # all tables (channels, daily metrics, snapshots, sync queue)
  lib/google/oauth.ts          # channel OAuth: auth URL, code exchange, token refresh
  lib/google/youtube.ts        # typed Data API + Analytics API client
  lib/sync/engine.ts           # job queue, backfill chunks, nightly sync
  lib/queries.ts               # dashboard aggregation queries
  app/(dashboard)/page.tsx     # portfolio overview (all channels combined)
  app/(dashboard)/channels/[channelId]/  # per-channel drill-down
  app/(dashboard)/settings/    # connect/remove channels, sync history
  app/api/cron/sync/           # cron target (Bearer CRON_SECRET)
  proxy.ts                     # route protection
```
