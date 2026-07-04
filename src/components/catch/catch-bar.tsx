"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pause, Play, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";

type Phase = "loading" | "ready" | "error";

interface RecapData {
  text: string;
  audioUrl: string | null;
  coversUntil: string | null;
  count: number;
}

const lastVisitKey = (slug: string) => `relay:lastVisit:${slug}`;

export function CatchBar({
  teamSlug,
  open,
  onClose,
}: {
  teamSlug: string;
  open: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [data, setData] = useState<RecapData | null>(null);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [spoken, setSpoken] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const words = data ? data.text.split(/\s+/).filter(Boolean) : [];

  // Cumulative char offset at the start of each word, for speechSynthesis
  // boundary events (which report a character index into the utterance).
  const wordStarts = useRef<number[]>([]);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
  }, []);

  const markCaughtUp = useCallback(
    (coversUntil: string | null) => {
      try {
        localStorage.setItem(
          lastVisitKey(teamSlug),
          coversUntil ?? new Date().toISOString()
        );
      } catch {
        /* ignore storage failures */
      }
    },
    [teamSlug]
  );

  const play = useCallback(
    (recap: RecapData) => {
      const ws = recap.text.split(/\s+/).filter(Boolean);
      // Precompute char offsets for the boundary->word mapping.
      const starts: number[] = [];
      let cursor = 0;
      for (const w of ws) {
        starts.push(cursor);
        cursor += w.length + 1;
      }
      wordStarts.current = starts;
      setSpoken(0);

      const finish = () => {
        setPlaying(false);
        setSpoken(ws.length);
        markCaughtUp(recap.coversUntil);
      };

      if (recap.audioUrl) {
        const audio = new Audio(recap.audioUrl);
        audioRef.current = audio;
        audio.ontimeupdate = () => {
          if (!audio.duration) return;
          const ratio = audio.currentTime / audio.duration;
          setSpoken(Math.min(ws.length, Math.floor(ratio * ws.length)));
        };
        audio.onended = finish;
        audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        return;
      }

      // Fallback: browser speech synthesis.
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(recap.text);
        u.rate = 1.02;
        u.pitch = 1;
        u.onboundary = (e) => {
          const idx = wordStarts.current.findIndex((s) => s > e.charIndex);
          setSpoken(idx === -1 ? ws.length : idx);
        };
        u.onend = finish;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        setPlaying(true);
      } else {
        // No audio + no speech support: just reveal the text.
        finish();
      }
    },
    [markCaughtUp]
  );

  // Fetch + auto-play when opened.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase("loading");
    setData(null);
    setError("");
    setSpoken(0);

    let since: string | null = null;
    try {
      since = localStorage.getItem(lastVisitKey(teamSlug));
    } catch {
      since = null;
    }

    (async () => {
      try {
        const res = await fetch("/api/recap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ team_slug: teamSlug, since }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Couldn't put the catch-up together.");
          setPhase("error");
          return;
        }
        const recap: RecapData = {
          text: json.text,
          audioUrl: json.audio_url ?? null,
          coversUntil: json.covers_until ?? null,
          count: json.count ?? 0,
        };
        setData(recap);
        setPhase("ready");
        if (recap.count > 0) play(recap);
        else markCaughtUp(recap.coversUntil);
      } catch {
        if (!cancelled) {
          setError("Network hiccup. Try again.");
          setPhase("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, teamSlug, play, markCaughtUp]);

  // Stop audio whenever the bar closes/unmounts.
  useEffect(() => {
    if (!open) stopPlayback();
    return () => stopPlayback();
  }, [open, stopPlayback]);

  const togglePlay = () => {
    if (!data) return;
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
      }
      return;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (playing) {
        window.speechSynthesis.pause();
        setPlaying(false);
      } else if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setPlaying(true);
      } else {
        play(data);
      }
    }
  };

  const handleClose = () => {
    stopPlayback();
    onClose();
  };

  const caughtUp = phase === "ready" && data?.count === 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4"
        >
          <div className="glass mx-auto w-full max-w-2xl rounded-2xl border border-border/60 p-4 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.6)]">
            <div className="flex items-start gap-4">
              {/* play / status control */}
              <div className="flex shrink-0 flex-col items-center gap-2">
                {phase === "loading" ? (
                  <div className="flex size-11 items-center justify-center rounded-full border border-border/60">
                    <Sparkles className="size-4 animate-pulse text-ember" />
                  </div>
                ) : caughtUp ? (
                  <div className="flex size-11 items-center justify-center rounded-full border border-done/40 text-done">
                    <Sparkles className="size-4" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={togglePlay}
                    disabled={phase === "error"}
                    aria-label={playing ? "Pause" : "Play"}
                    className="flex size-11 items-center justify-center rounded-full bg-foreground text-background transition-transform active:scale-95 disabled:opacity-40"
                  >
                    {playing ? (
                      <Pause className="size-4" />
                    ) : (
                      <Play className="size-4 translate-x-px" />
                    )}
                  </button>
                )}
                <Waveform active={playing} />
              </div>

              {/* content */}
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ember">
                  {phase === "loading"
                    ? "Catching you up…"
                    : caughtUp
                      ? "All caught up"
                      : phase === "error"
                        ? "Catch-up stumbled"
                        : `Catch-up · ${data?.count} ${
                            data?.count === 1 ? "baton" : "batons"
                          }`}
                </p>

                {phase === "loading" && (
                  <div className="mt-2 space-y-2">
                    <div className="skeleton h-3 w-3/4 rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                  </div>
                )}

                {phase === "error" && (
                  <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                )}

                {phase === "ready" && data && (
                  <p className="karaoke mt-1 text-[15px] leading-relaxed">
                    {words.map((w, i) => (
                      <span
                        key={i}
                        className={cn(i < spoken && "is-spoken")}
                      >
                        {w}{" "}
                      </span>
                    ))}
                  </p>
                )}

                {phase === "ready" && data && !data.audioUrl && data.count > 0 && (
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                    Read aloud by your browser · add a Gemini key for a warmer voice
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleClose}
                aria-label="Close catch-up"
                className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Green bars that dance while audio plays; flat when paused. */
function Waveform({ active }: { active: boolean }) {
  const bars = [0.5, 0.9, 0.6, 1, 0.7];
  return (
    <div className="flex h-4 items-end gap-[3px]">
      {bars.map((peak, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full"
          style={{ background: "var(--done)" }}
          animate={
            active
              ? { height: [`${peak * 40}%`, "100%", `${peak * 55}%`] }
              : { height: "22%" }
          }
          transition={
            active
              ? {
                  duration: 0.6 + i * 0.08,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                }
              : { duration: 0.2 }
          }
        />
      ))}
    </div>
  );
}
