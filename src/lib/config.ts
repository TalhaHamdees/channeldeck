const REQUIRED_ENV = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "ALLOWED_EMAIL",
  "TOKEN_ENCRYPTION_KEY",
  "CRON_SECRET",
] as const;

export function missingEnvVars(): string[] {
  return REQUIRED_ENV.filter((k) => !process.env[k]);
}

export function isConfigured(): boolean {
  return missingEnvVars().length === 0;
}

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

/** Display currency for revenue figures (YouTube reports in the payout currency). */
export const REVENUE_CURRENCY = process.env.REVENUE_CURRENCY ?? "USD";
