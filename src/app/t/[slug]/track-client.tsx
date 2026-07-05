"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Mic, Ear, Link2, Rows3, Sparkles, Waypoints } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { GitHubMark } from "@/components/brand/github-mark";
import { BatonCard } from "@/components/baton/baton-card";
import { PassOverlay } from "@/components/pass/pass-overlay";
import { CatchBar } from "@/components/catch/catch-bar";
import { AskPanel } from "@/components/ask/ask-panel";
import { TrackCanvas } from "@/components/track/track-canvas";
import { InsightsPanel } from "@/components/track/insights-panel";
import { computeTrackInsights } from "@/lib/track-insights";
import { cn } from "@/lib/utils";
import type { Baton, Team } from "@/lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;

type TrackView = "canvas" | "list";

export function TrackClient({
  team,
  batons,
  initialPassOpen,
}: {
  team: Pick<Team, "slug" | "name">;
  batons: Baton[];
  initialPassOpen: boolean;
}) {
  const router = useRouter();
  const [passOpen, setPassOpen] = useState(initialPassOpen);
  const [catchOpen, setCatchOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [view, setView] = useState<TrackView>("canvas");

  const insights = useMemo(() => computeTrackInsights(batons), [batons]);

  // Keyboard shortcuts: R = pass the baton, C = catch me up. Skipped while
  // typing or when any overlay is already open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      if (passOpen || catchOpen || askOpen) return;
      const key = e.key.toLowerCase();
      if (key === "r") {
        e.preventDefault();
        setPassOpen(true);
      } else if (key === "c" && batons.length > 0) {
        e.preventDefault();
        setCatchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [passOpen, catchOpen, askOpen, batons.length]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + `/t/${team.slug}`);
      toast.success("Track link copied — anyone with it can pass or catch.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const onPassed = () => {
    router.refresh();
  };

  const closePass = () => {
    setPassOpen(false);
    // Drop ?pass=1 so a manual refresh doesn't reopen the recorder.
    if (window.location.search) {
      router.replace(`/t/${team.slug}`);
    }
  };

  return (
    <main className="relative mx-auto w-full max-w-3xl px-6">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <a
              href="https://github.com/nikhilsahni7/relay"
              target="_blank"
              rel="noreferrer"
              aria-label="Relay on GitHub"
            >
              <GitHubMark className="size-3.5" /> GitHub
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={copyLink}>
            <Link2 className="size-3.5" /> Copy link
          </Button>
        </div>
      </header>

      <section className="pt-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ember">
          The track
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">
            {team.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setAskOpen(true)}
              disabled={batons.length === 0}
            >
              <Sparkles className="size-4" /> Ask
            </Button>
            <Button
              variant="secondary"
              onClick={() => setCatchOpen(true)}
              disabled={batons.length === 0}
              title="Shortcut: C"
            >
              <Ear className="size-4" /> Catch me up
            </Button>
            <Button onClick={() => setPassOpen(true)} title="Shortcut: R">
              <Mic className="size-4" /> Pass the baton
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Greeting teamSlug={team.slug} batons={batons} />
          <p className="mt-3 hidden items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 sm:flex">
            <Kbd>R</Kbd> pass
            <span aria-hidden>·</span>
            <Kbd>C</Kbd> catch
          </p>
        </div>
        <div className="mt-6 lane w-full" aria-hidden />

        {batons.length > 0 ? (
          <InsightsPanel insights={insights} batonCount={batons.length} />
        ) : null}
      </section>

      {/* timeline */}
      <section className="pb-16 pt-6">
        {batons.length === 0 ? (
          <EmptyState onPass={() => setPassOpen(true)} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                {batons.length} baton{batons.length === 1 ? "" : "s"} passed
              </p>
              <div
                role="tablist"
                aria-label="Timeline view"
                className="flex items-center gap-0.5 rounded-full border border-border bg-card/70 p-0.5"
              >
                <ViewTab
                  active={view === "canvas"}
                  onClick={() => setView("canvas")}
                  label="Canvas view"
                >
                  <Waypoints className="size-3.5" /> Canvas
                </ViewTab>
                <ViewTab
                  active={view === "list"}
                  onClick={() => setView("list")}
                  label="List view"
                >
                  <Rows3 className="size-3.5" /> List
                </ViewTab>
              </div>
            </div>

            {view === "canvas" ? (
              <TrackCanvas batons={batons} openItems={insights.openItems} />
            ) : (
              <div className="mt-6 flex flex-col items-center gap-6">
                {batons.map((baton, i) => (
                  <motion.div
                    key={baton.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="w-full max-w-md"
                  >
                    <BatonCard
                      card={
                        baton.card ?? { summary: "", items: [], links: [] }
                      }
                      author={baton.author_name}
                      role={baton.author_role}
                      createdAt={baton.created_at}
                      audioUrl={baton.audio_url}
                      durationSeconds={baton.duration_seconds}
                      batonNumber={batons.length - i}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <PassOverlay
        teamSlug={team.slug}
        open={passOpen}
        onClose={closePass}
        onPassed={onPassed}
      />

      <CatchBar
        teamSlug={team.slug}
        open={catchOpen}
        onClose={() => setCatchOpen(false)}
      />

      <AskPanel
        teamSlug={team.slug}
        batons={batons}
        open={askOpen}
        onClose={() => setAskOpen(false)}
      />
    </main>
  );
}

/**
 * Time-aware greeting: "Good morning — 3 batons passed while you were away."
 * Rendered only on the client (after mount) so the hour and localStorage read
 * never mismatch the server render.
 */
function Greeting({
  teamSlug,
  batons,
}: {
  teamSlug: string;
  batons: Baton[];
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    const salute =
      hour < 5
        ? "Burning the midnight oil"
        : hour < 12
          ? "Good morning"
          : hour < 18
            ? "Good afternoon"
            : "Good evening";

    let since: string | null = null;
    try {
      since = localStorage.getItem(`relay:lastVisit:${teamSlug}`);
    } catch {
      since = null;
    }

    const fresh = since
      ? batons.filter((b) => b.created_at > since).length
      : batons.length;

    if (batons.length === 0) {
      setText(`${salute} — the track is ready for its first baton.`);
    } else if (fresh === 0) {
      setText(`${salute} — you're all caught up.`);
    } else {
      setText(
        `${salute} — ${fresh} baton${fresh === 1 ? "" : "s"} passed while you were away.`
      );
    }
  }, [teamSlug, batons]);

  if (!text) return <div className="mt-3 h-5" aria-hidden />;

  return (
    <motion.p
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="mt-3 text-sm text-muted-foreground"
    >
      {text}
    </motion.p>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  );
}

function ViewTab({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ onPass }: { onPass: () => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="relative h-16 w-full max-w-xs">
        <div className="lane absolute top-1/2 w-full" aria-hidden />
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-3 w-12 -translate-x-1/2 -translate-y-1/2 rotate-[8deg] rounded-full bg-linear-to-r from-ember-soft to-ember-deep opacity-90 shadow-[0_0_24px_-4px_var(--ember)]"
        />
      </div>
      <h2 className="font-display mt-8 text-2xl">The track is waiting.</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        No batons yet. Record where things stand and pass the first one.
      </p>
      <Button className="mt-6" onClick={onPass}>
        <Mic className="size-4" /> Pass the first baton
      </Button>
    </div>
  );
}
