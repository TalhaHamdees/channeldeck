# Mori — the honest record

> LinkedIn is the superficial record of what you pretend to be. This is the other one.

**Mori** is a small, local-first web app for one daily practice: every morning, write your own obituary of the previous day — not the polished version, but the honest one, based on how you actually lived the last twenty-four hours.

It is the opposite of a performed profile. There is no feed, no audience, no follower, no like. No one is reading. That is the only condition under which people tell the truth — and the truth, kept daily, becomes a relentless feedback loop that no productivity app or motivational quote can match.

The idea is simple and old (*memento mori* — "remember that you will die"). The discomfort of repeatedly meeting yourself on the page is the entire mechanism.

---

## What it does

- **Today** — a rotating morning provocation and the reckoning editor: a one-line epitaph (*"Here lies someone who…"*), the honest account of the day, what you flinched from, a single intention for the day ahead, and a daily verdict on how close to true you lived.
- **The Record** — a searchable timeline of every entry, each editable in place. Export the whole thing to Markdown or JSON, and re-import it, at any time.
- **Patterns** — the feedback loop made visible: a relentlessness streak, an alignment average and 7-day trend, a "days you flinched" rate, a contribution-style heatmap shaded by how true each day was, recurring-theme word frequency, and a *life in weeks* grid that marks the weeks you actually reckoned with.
- **Manifesto** — the case for the honest record, and the practice, in full.

## Principles

- **No audience.** No feed, profile, follower, or like.
- **No account, no server.** Everything you write is stored only in this browser, on this device. There is no backend to trust because there is no backend.
- **It's yours.** Export to plain text or JSON whenever you like. Leaving is as easy as staying.

## Tech

- [Next.js 16](https://nextjs.org/) (App Router) + React 19, TypeScript
- Tailwind CSS v4
- Persistence via `localStorage`, with tolerant load/save and schema guards
- No-flash theming via a synchronous pre-paint inline script and lazy state initialisers
- Fully static — every route prerenders; the app is a static export with client-side state

No database, no environment variables, no API keys. It runs anywhere static files can be served.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # eslint
npm run build    # production build (all routes static)
npm run start    # serve the production build
```

## Deploy

Push to any platform that serves a Next.js app (e.g. Vercel). Because there is no backend, there is nothing else to configure.

---

*One day someone will write your obituary. The only question is whether you ever read a draft in time to change it.*
