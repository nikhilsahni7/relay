"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Play, Mic, Ear } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo, BatonMark } from "@/components/brand/logo";
import { BatonCardDemo } from "./baton-card-demo";
import { RelayTrack } from "./relay-track";
import { Embers } from "./embers";
import { CountUp } from "./count-up";

const EASE = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  {
    number: "01",
    kicker: "60 seconds in",
    title: "The Pass",
    body: "When you stop working, talk for 60 seconds. Rambling is fine — say it like you'd say it at the coffee machine.",
  },
  {
    number: "02",
    kicker: "while you watch",
    title: "The Baton",
    body: "Relay structures your voice into a clean card: done, in progress, blocked, next. Glance, fix, pass.",
  },
  {
    number: "03",
    kicker: "20 seconds out",
    title: "The Catch",
    body: "Whoever sits down next presses play and hears a recap of everything since they left — not just the last note.",
  },
];

// The core insight from the pitch: every tool makes one side cheap by making
// the other expensive. Relay makes both sides cheap. This table is the argument.
const COMPARISON = [
  { tool: "Loom", record: "Effortless", consume: "10 min to watch" },
  { tool: "Handoff docs", record: "Tedious to write", consume: "Fast to skim" },
  { tool: "Standups", record: "Same room, same time", consume: "Same room, same time" },
  { tool: "Relay", record: "60s of talking", consume: "20s of listening", us: true },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

/** Sticky top bar that frosts and underlines itself once the page scrolls. */
function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        scrolled ? "glass" : ""
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <a
              href="https://github.com/nikhil-sahni"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/demo">
              <Play className="size-3.5" /> Catch the demo
            </Link>
          </Button>
        </div>
      </div>
      <div
        className={`rule-fade transition-opacity duration-300 ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
      />
    </header>
  );
}

export function Landing() {
  const reduce = useReducedMotion();

  return (
    <>
      <Embers />
      <Nav />

      <main className="relative mx-auto w-full max-w-6xl px-6">
        {/* ------------------------------------------------ hero */}
        <section className="grid items-center gap-14 pb-24 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
          <div>
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1"
            >
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-ember opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-ember" />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Voice-first handoffs
              </span>
            </motion.div>

            <motion.h1
              {...fadeUp}
              transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
              className="font-display mt-6 text-5xl leading-[1.02] sm:text-6xl lg:text-[5rem]"
            >
              Talk when you <em className="text-ember-gradient">leave</em>.
              <br />
              Listen when you <em className="text-ember-gradient">arrive</em>.
            </motion.h1>

            <motion.p
              {...fadeUp}
              transition={{ duration: 0.6, delay: 0.18, ease: EASE }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
            >
              Every handoff loses context — end of day, timezones, standups.
              Relay turns a 60-second voice note into a structured baton your
              team can <span className="text-foreground">hear</span>. No docs.
              No meetings. No lost context.
            </motion.p>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.6, delay: 0.28, ease: EASE }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Button size="lg" className="group" asChild>
                <Link href="/new">
                  Start your relay
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/demo">
                  <Play className="size-4" /> Hear a catch-up
                </Link>
              </Button>
            </motion.div>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.6, delay: 0.38, ease: EASE }}
              className="mt-7 flex items-center gap-5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70"
            >
              <span>No signup</span>
              <span className="size-1 rounded-full bg-border" />
              <span>Runs in the browser</span>
              <span className="size-1 rounded-full bg-border" />
              <span>Free</span>
            </motion.div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className={reduce ? "" : "animate-float"}>
              <BatonCardDemo />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ track */}
        <section className="border-t border-border py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.3em] text-ember">
              The relay
            </p>
            <h2 className="font-display mx-auto mt-3 max-w-2xl text-center text-3xl sm:text-4xl">
              One feature. Three timezones.{" "}
              <em className="text-ember-gradient">Zero meetings.</em>
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
              The baton never stops moving. Context passes hand to hand while
              half the team is asleep.
            </p>
            <div className="mt-16">
              <RelayTrack />
            </div>
          </motion.div>
        </section>

        {/* ------------------------------------------------ both sides cheap */}
        <section className="border-t border-border py-20">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ember">
                Why it's different
              </p>
              <h2 className="font-display mt-3 text-3xl leading-tight sm:text-4xl">
                Every tool makes one side cheap by making the{" "}
                <em className="text-ember-gradient">other expensive</em>.
              </h2>
              <p className="mt-4 max-w-md text-muted-foreground">
                Relay is the only one that's cheap on both ends. Talking is the
                fastest way to get context out of your head; listening is the
                fastest way to get it into someone else's.
              </p>

              <div className="mt-8 flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/12 text-ember">
                    <Mic className="size-4" />
                  </span>
                  <div>
                    <p className="font-display text-2xl leading-none">
                      <CountUp to={60} suffix="s" />
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      to record
                    </p>
                  </div>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-done/12 text-done">
                    <Ear className="size-4" />
                  </span>
                  <div>
                    <p className="font-display text-2xl leading-none">
                      <CountUp to={20} suffix="s" />
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      to catch up
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
              className="overflow-hidden rounded-2xl border border-border bg-card/40"
            >
              <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 border-b border-border px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>Tool</span>
                <span>Recording</span>
                <span>Catching up</span>
              </div>
              {COMPARISON.map((row) => (
                <div
                  key={row.tool}
                  className={`grid grid-cols-[1.2fr_1fr_1fr] items-center gap-2 px-5 py-3.5 text-sm transition-colors ${
                    row.us
                      ? "bg-primary/[0.06] text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={
                      row.us ? "font-medium text-ember" : "text-foreground/90"
                    }
                  >
                    {row.tool}
                  </span>
                  <span>{row.record}</span>
                  <span>{row.consume}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ------------------------------------------------ steps */}
        <section className="border-t border-border py-20">
          <div className="mb-12 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ember">
              How it works
            </p>
            <h2 className="font-display mt-3 text-3xl sm:text-4xl">
              Three moves. That's the whole app.
            </h2>
          </div>
          <div className="relative grid gap-5 md:grid-cols-3">
            {/* connecting lane behind the cards */}
            <div
              className="lane absolute left-0 right-0 top-8 hidden md:block"
              aria-hidden
            />
            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.12, ease: EASE }}
                className="group relative rounded-2xl border border-border bg-card/60 p-7 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-ember/40 hover:shadow-[0_16px_50px_-24px_var(--ember)]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-full border border-border bg-background font-mono text-xs text-ember">
                    {step.number}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {step.kicker}
                  </span>
                </div>
                <h3 className="font-display mt-5 text-2xl">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------ CTA */}
        <section className="border-t border-border py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE }}
            className="relative overflow-hidden rounded-3xl border border-border bg-card/50 px-8 py-16 text-center"
          >
            <div
              aria-hidden
              className="absolute -top-24 left-1/2 -z-10 size-72 -translate-x-1/2 rounded-full opacity-50 blur-3xl"
              style={{
                background:
                  "radial-gradient(closest-side, color-mix(in srgb, var(--ember) 40%, transparent), transparent 70%)",
              }}
            />
            <h2 className="font-display mx-auto max-w-2xl text-4xl leading-tight sm:text-5xl">
              Pass the baton before you{" "}
              <em className="text-ember-gradient">close the laptop</em>.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Start a relay in one click. Share the link. The next person hears
              exactly where things stand.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" asChild>
                <Link href="/new">
                  Start your relay <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/demo">
                  <Play className="size-4" /> Hear a catch-up
                </Link>
              </Button>
            </div>
          </motion.div>
        </section>

        {/* ------------------------------------------------ footer */}
        <footer className="flex flex-col items-center gap-3 border-t border-border py-14 text-center">
          <BatonMark className="size-6 opacity-90" />
          <p className="font-display text-xl italic text-foreground/80">
            Talk when you leave. Listen when you arrive.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Built solo at RAISE Summit Hackathon 2026 · designed &amp; shipped
            entirely with Cursor
          </p>
        </footer>
      </main>
    </>
  );
}
