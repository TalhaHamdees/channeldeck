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
      const allowed = process.env.ALLOWED_EMAIL?.toLowerCase();
      if (!allowed) return false;
      return profile?.email?.toLowerCase() === allowed;
    },
  },
});
