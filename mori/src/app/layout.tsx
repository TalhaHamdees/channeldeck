import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RecordProvider } from "@/lib/store";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: {
    default: "Mori — the honest record",
    template: "%s · Mori",
  },
  description:
    "Write your own obituary every morning. The honest record of how you actually lived — the opposite of the résumé you perform for everyone else.",
  applicationName: "Mori",
  authors: [{ name: "Mori" }],
  keywords: [
    "memento mori",
    "journaling",
    "daily reflection",
    "honest record",
    "anti-linkedin",
  ],
  openGraph: {
    title: "Mori — the honest record",
    description:
      "Write your own obituary every morning. The honest record of how you actually lived.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#100f0d" },
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
  ],
};

// Runs synchronously during HTML parsing, before first paint, so the chosen
// theme is applied with no flash. Defaults to dark — this is meant to be read
// at night, when the day is over and the truth is easier to admit.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("mori.theme");var dark=t?t==="dark":true;document.documentElement.classList.toggle("dark",dark);}catch(e){document.documentElement.classList.add("dark");}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <RecordProvider>
          <div className="flex min-h-dvh flex-col">
            <SiteNav />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </RecordProvider>
      </body>
    </html>
  );
}
