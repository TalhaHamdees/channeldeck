// Dev-only sample-data seeder so the dashboard can be verified without
// connecting real channels. Run:  node scripts/seed-dev.mjs
// Clear it with:                  node scripts/seed-dev.mjs clear
//
// All seed rows use channel IDs prefixed "UC_DEMO_" so `clear` can remove
// exactly the demo data and nothing real.
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const DEMO = [
  { id: "UC_DEMO_alpha", title: "Demo Channel — Alpha", subs: 184000, base: 42000 },
  { id: "UC_DEMO_bravo", title: "Demo Channel — Bravo", subs: 56000, base: 12000 },
];

const DAYS = 180;
const COUNTRIES = ["US", "GB", "IN", "CA", "AU", "DE", "PK", "BR"];
const SOURCES = ["YT_SEARCH", "RELATED_VIDEO", "SUBSCRIBER", "EXT_URL", "PLAYLIST", "SHORTS"];
const AGES = ["age18-24", "age25-34", "age35-44", "age45-54", "age55-64"];
const RANGES = [7, 28, 90, 365];

function dstr(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function clear() {
  await sql`DELETE FROM channels WHERE id LIKE 'UC_DEMO_%'`;
  console.log("Cleared demo data.");
}

async function seed() {
  await clear();

  for (const ch of DEMO) {
    await sql`
      INSERT INTO channels (id, title, thumbnail_url, refresh_token_enc, token_status,
        subscriber_count, video_count, total_view_count, backfill_complete, last_synced_at, sort_order)
      VALUES (${ch.id}, ${ch.title}, ${"https://placehold.co/88x88/png?text=" + ch.id.slice(-5)},
        'dev-seed-no-token', 'active', ${ch.subs}, ${120 + Math.floor(Math.random() * 200)},
        ${ch.base * DAYS * 3}, true, now(), 0)
    `;

    // Daily metrics
    const metrics = [];
    for (let i = 0; i < DAYS; i++) {
      const wave = 1 + 0.35 * Math.sin(i / 7) + (Math.random() - 0.5) * 0.2;
      const views = Math.max(0, Math.round(ch.base * wave));
      const avg = 180 + Math.round(Math.random() * 120);
      const mins = Math.round((views * avg) / 60);
      const rev = (views / 1000) * (1.5 + Math.random());
      metrics.push({
        channel_id: ch.id,
        date: dstr(i),
        views,
        estimated_minutes_watched: mins,
        average_view_duration_secs: avg,
        impressions: views * (6 + Math.round(Math.random() * 6)),
        impressions_ctr: (4 + Math.random() * 6).toFixed(4),
        subscribers_gained: Math.round(views * 0.012),
        subscribers_lost: Math.round(views * 0.003),
        likes: Math.round(views * 0.04),
        comments: Math.round(views * 0.004),
        shares: Math.round(views * 0.002),
        estimated_revenue: rev.toFixed(4),
        monetized_playbacks: Math.round(views * 0.8),
        playback_based_cpm: (3 + Math.random() * 4).toFixed(4),
      });
    }
    await sql`INSERT INTO channel_metrics_daily ${sql(metrics)}`;

    // Videos + per-range totals
    const videos = [];
    for (let v = 0; v < 25; v++) {
      videos.push({
        id: `${ch.id}_vid${v}`,
        channel_id: ch.id,
        title: `${ch.title}: Episode ${v + 1} — sample upload`,
        thumbnail_url: `https://placehold.co/320x180/png?text=Ep${v + 1}`,
        duration_secs: 300 + Math.floor(Math.random() * 900),
        published_at: new Date(Date.now() - v * 5 * 86400000).toISOString(),
      });
    }
    await sql`INSERT INTO videos ${sql(videos)}`;

    for (const rd of RANGES) {
      const totals = videos.map((vid, v) => {
        const views = Math.round(ch.base * (3 - v * 0.08) * (rd / 28));
        const avg = 180 + Math.round(Math.random() * 120);
        return {
          video_id: vid.id,
          channel_id: ch.id,
          range_days: rd,
          range_start: dstr(rd),
          range_end: dstr(0),
          views: Math.max(views, 50),
          estimated_minutes_watched: Math.round((views * avg) / 60),
          average_view_duration_secs: avg,
          impressions: views * 8,
          impressions_ctr: (4 + Math.random() * 6).toFixed(4),
          estimated_revenue: ((views / 1000) * (1.5 + Math.random())).toFixed(4),
        };
      });
      await sql`INSERT INTO video_metrics_totals ${sql(totals)}`;
    }

    // Traffic sources (daily)
    const traffic = [];
    for (let i = 0; i < DAYS; i++) {
      for (const s of SOURCES) {
        const share = { YT_SEARCH: 0.3, RELATED_VIDEO: 0.28, SUBSCRIBER: 0.15, EXT_URL: 0.07, PLAYLIST: 0.1, SHORTS: 0.1 }[s];
        const views = Math.round(ch.base * share * (0.8 + Math.random() * 0.4));
        traffic.push({
          channel_id: ch.id,
          date: dstr(i),
          source_type: s,
          views,
          estimated_minutes_watched: Math.round(views * 3),
        });
      }
    }
    await sql`INSERT INTO traffic_sources_daily ${sql(traffic)}`;

    // Geography per range
    for (const rd of RANGES) {
      const geo = COUNTRIES.map((c, idx) => {
        const views = Math.round(ch.base * (rd / 28) * (0.4 - idx * 0.04) * 5);
        return {
          channel_id: ch.id,
          period_start: dstr(rd),
          period_end: dstr(0),
          range_days: rd,
          country: c,
          views: Math.max(views, 100),
          estimated_minutes_watched: Math.max(views, 100) * 3,
          estimated_revenue: ((Math.max(views, 100) / 1000) * 2).toFixed(4),
        };
      });
      await sql`INSERT INTO geography_period ${sql(geo)}`;
    }

    // Demographics
    const demo = [];
    const dist = [22, 34, 24, 12, 8];
    AGES.forEach((a, idx) => {
      demo.push({ channel_id: ch.id, period_start: dstr(28), period_end: dstr(0), age_group: a, gender: "male", viewer_percentage: (dist[idx] * 0.62).toFixed(4) });
      demo.push({ channel_id: ch.id, period_start: dstr(28), period_end: dstr(0), age_group: a, gender: "female", viewer_percentage: (dist[idx] * 0.38).toFixed(4) });
    });
    await sql`INSERT INTO demographics_period ${sql(demo)}`;

    console.log(`Seeded ${ch.title}`);
  }
}

const mode = process.argv[2];
try {
  if (mode === "clear") await clear();
  else await seed();
} finally {
  await sql.end();
}
