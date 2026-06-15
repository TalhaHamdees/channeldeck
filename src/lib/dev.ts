// Dev-only authentication bypass so the local preview can reach authenticated
// pages without completing Google OAuth.
//
// SAFETY: this is HARD-disabled in production. Vercel sets NODE_ENV=production,
// so the first condition is false there no matter what — and it additionally
// requires the explicit DEV_AUTH_BYPASS=1 flag (never set that in production).
export const DEV_AUTH_BYPASS =
  process.env.NODE_ENV !== "production" &&
  process.env.DEV_AUTH_BYPASS === "1";

export const DEV_USER = {
  name: "Dev (local bypass)",
  email: process.env.ALLOWED_EMAIL?.split(",")[0]?.trim() ?? "dev@local",
};
