import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Fallback keeps middleware from crashing before the app is configured;
  // while AUTH_SECRET is unset every page redirects to /setup and the
  // signIn callback below fails closed, so no session can be used.
  secret: process.env.AUTH_SECRET ?? "unconfigured-placeholder-secret",
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    signIn({ profile }) {
      // ALLOWED_EMAIL is a comma-separated allowlist so you can invite a few
      // trusted people now without full user management.
      const allowed = (process.env.ALLOWED_EMAIL ?? "")
        .toLowerCase()
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      const email = profile?.email?.toLowerCase();
      return !!email && allowed.includes(email);
    },
  },
});
