import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Manifesto",
  description:
    "Why Mori exists: the honest record, the morning obituary, and the case against the performed self.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <article className="space-y-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Manifesto
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight">
            The honest record
          </h1>
          <p className="text-lg text-muted-foreground">
            LinkedIn is the superficial record of what you pretend to be. This
            is the other one.
          </p>
        </header>

        <div className="rule h-px" />

        <section className="space-y-4 leading-relaxed text-foreground/90">
          <p>
            We keep two records of a life. The first is public: titles, posts,
            the highlight reel curated for an audience that is also performing.
            It is optimised for how you want to be seen. It is, almost by
            design, a lie of omission.
          </p>
          <p>
            The second record is the one nobody keeps. How the hours were
            actually spent. What you avoided because it was hard, not because it
            was wrong. The promises to yourself you broke before noon. This
            second record is the only one that ever told the truth about a
            person — and it is the one we never write down.
          </p>
          <p className="font-serif text-xl leading-snug">
            Mori is a place to write the second record.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-2xl tracking-tight">The habit</h2>
          <blockquote className="border-l-2 border-accent pl-4 text-foreground/90 italic leading-relaxed">
            “Write your own obituary every single morning — not the polished
            version, but the honest one based on how you actually lived the
            previous twenty-four hours. Most people only confront mortality
            abstractly, or during a crisis. Forcing yourself to draft a few
            brutally truthful sentences each day creates a relentless feedback
            loop that no productivity app or motivational quote could match. The
            discomfort of repeatedly meeting yourself on the page is the
            mechanism.”
          </blockquote>
          <p className="leading-relaxed text-foreground/90">
            That is the whole practice. Every morning you write one line —{" "}
            <span className="font-serif">“Here lies someone who…”</span> — about
            the day before. Then a few honest sentences underneath. Then you get
            on with living a day worth a better epitaph.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-2xl tracking-tight">
            Why it works
          </h2>
          <ul className="space-y-3 leading-relaxed text-foreground/90">
            <li className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                <strong className="font-medium">Mortality is the only honest deadline.</strong>{" "}
                An obituary collapses the distance between today and the end. It
                is hard to call two hours of scrolling “research” when you are
                writing the headstone.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                <strong className="font-medium">The discomfort is the feature.</strong>{" "}
                Affirmations soothe. This does the opposite. Meeting yourself
                truthfully, daily, is the feedback loop nothing else replicates.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                <strong className="font-medium">A record compounds.</strong> One
                honest day is a confession. A hundred is a mirror you can no
                longer argue with.
              </span>
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-2xl tracking-tight">The rules</h2>
          <ul className="space-y-2 leading-relaxed text-foreground/90">
            <li>
              <strong className="font-medium">No audience.</strong> There is no
              feed, no profile, no follower, no like. No one is reading. That is
              the only condition under which people tell the truth.
            </li>
            <li>
              <strong className="font-medium">No account.</strong> Everything
              you write is stored on this device, in this browser, and nowhere
              else. There is no server to trust because there is no server.
            </li>
            <li>
              <strong className="font-medium">It&rsquo;s yours.</strong> Export
              the whole record to plain text or JSON whenever you like. Leaving
              should be as easy as staying.
            </li>
          </ul>
        </section>

        <div className="rule h-px" />

        <section className="space-y-5">
          <p className="font-serif text-xl leading-snug">
            One day someone will write your obituary. The only question is
            whether you ever read a draft in time to change it.
          </p>
          <Link href="/" className={buttonVariants({ variant: "accent" })}>
            Write today&rsquo;s
          </Link>
        </section>
      </article>
    </div>
  );
}
