"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Mic, Ear, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { BatonCard } from "@/components/baton/baton-card";
import { PassOverlay } from "@/components/pass/pass-overlay";
import { CatchBar } from "@/components/catch/catch-bar";
import type { Baton, Team } from "@/lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;

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
        <Button variant="ghost" size="sm" onClick={copyLink}>
          <Link2 className="size-3.5" /> Copy link
        </Button>
      </header>

      <section className="pt-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ember">
          The track
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">
            {team.name}
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setCatchOpen(true)}
              disabled={batons.length === 0}
            >
              <Ear className="size-4" /> Catch me up
            </Button>
            <Button onClick={() => setPassOpen(true)}>
              <Mic className="size-4" /> Pass the baton
            </Button>
          </div>
        </div>
        <div className="mt-6 lane w-full" aria-hidden />
      </section>

      {/* timeline */}
      <section className="py-12">
        {batons.length === 0 ? (
          <EmptyState onPass={() => setPassOpen(true)} />
        ) : (
          <div className="flex flex-col items-center gap-6">
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
                  createdAt={baton.created_at}
                  audioUrl={baton.audio_url}
                  durationSeconds={baton.duration_seconds}
                  batonNumber={batons.length - i}
                />
              </motion.div>
            ))}
          </div>
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
    </main>
  );
}

function EmptyState({ onPass }: { onPass: () => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="relative h-16 w-full max-w-xs">
        <div className="lane absolute top-1/2 w-full" aria-hidden />
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-3 w-12 -translate-x-1/2 -translate-y-1/2 rotate-[8deg] rounded-full bg-gradient-to-r from-ember-soft to-ember-deep opacity-90 shadow-[0_0_24px_-4px_var(--ember)]"
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
