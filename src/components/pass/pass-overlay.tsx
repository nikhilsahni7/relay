"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Mic, Square, Type, X, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BatonCard } from "@/components/baton/baton-card";
import { useRecorder } from "@/hooks/use-recorder";
import type { Baton } from "@/lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;
const MAX_SECONDS = 120;
const AUTHOR_KEY = "relay:author";
const ROLE_KEY = "relay:role";

type Phase = "idle" | "recording" | "processing" | "confirm";

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface PassOverlayProps {
  teamSlug: string;
  open: boolean;
  onClose: () => void;
  onPassed: (baton: Baton) => void;
}

export function PassOverlay({
  teamSlug,
  open,
  onClose,
  onPassed,
}: PassOverlayProps) {
  const reduce = useReducedMotion();
  const recorder = useRecorder(MAX_SECONDS);
  const { status, seconds, levels, blob, error, start, stop, reset, cancel } =
    recorder;

  const [phase, setPhase] = useState<Phase>("idle");
  const [author, setAuthor] = useState("");
  const [role, setRole] = useState("");
  const [textMode, setTextMode] = useState(false);
  const [text, setText] = useState("");
  const [baton, setBaton] = useState<Baton | null>(null);
  const submittingRef = useRef(false);
  // Set when the user bails out (✕ / Esc) so a MediaRecorder.onstop that fires
  // *after* close doesn't sneak a baton into the DB.
  const abortRef = useRef(false);

  // Load the remembered author name + role.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setAuthor(window.localStorage.getItem(AUTHOR_KEY) ?? "");
    setRole(window.localStorage.getItem(ROLE_KEY) ?? "");
  }, []);

  const rememberAuthor = useCallback((name: string) => {
    setAuthor(name);
    try {
      window.localStorage.setItem(AUTHOR_KEY, name.trim());
    } catch {
      /* ignore */
    }
  }, []);

  const rememberRole = useCallback((value: string) => {
    setRole(value);
    try {
      window.localStorage.setItem(ROLE_KEY, value.trim());
    } catch {
      /* ignore */
    }
  }, []);

  const closeAll = useCallback(() => {
    if (phase === "processing") return; // don't abandon mid-pipeline
    abortRef.current = true; // backstop: ignore any late recorder result
    cancel(); // discard the in-progress recording (detaches onstop, no blob)
    setPhase("idle");
    setText("");
    setTextMode(false);
    setBaton(null);
    submittingRef.current = false;
    onClose();
  }, [phase, cancel, onClose]);

  // Reset internal state each time the overlay opens.
  useEffect(() => {
    if (open) {
      setPhase("idle");
      setBaton(null);
      setText("");
      setTextMode(false);
      submittingRef.current = false;
      abortRef.current = false;
    }
  }, [open]);

  // Escape to close (except while processing).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, closeAll]);

  // Surface recorder errors.
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // Keep phase in sync with recorder status.
  useEffect(() => {
    if (status === "recording") setPhase("recording");
  }, [status]);

  const submit = useCallback(
    async (payload: { audio?: Blob; text?: string; duration: number }) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setPhase("processing");

      try {
        const form = new FormData();
        form.append("team_slug", teamSlug);
        form.append("author_name", author.trim());
        form.append("author_role", role.trim());
        form.append("duration_seconds", String(payload.duration));
        if (payload.audio) form.append("audio", payload.audio, "handoff.webm");
        if (payload.text) form.append("text", payload.text);

        const res = await fetch("/api/baton", { method: "POST", body: form });
        const data = (await res.json()) as { baton?: Baton; error?: string };
        if (!res.ok || !data.baton) {
          throw new Error(data.error ?? "Something went wrong.");
        }
        setBaton(data.baton);
        setPhase("confirm");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
        setPhase("idle");
        reset();
      } finally {
        submittingRef.current = false;
      }
    },
    [teamSlug, author, role, reset]
  );

  // When a recording finishes, send it through the pipeline — unless the user
  // bailed out (abortRef), in which case a late onstop must be ignored.
  useEffect(() => {
    if (status === "stopped" && blob && !submittingRef.current && !abortRef.current) {
      submit({ audio: blob, duration: seconds });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, blob]);

  const requireName = (): boolean => {
    if (author.trim().length < 2) {
      toast.error("Add your name first — teammates need to know who passed.");
      return false;
    }
    return true;
  };

  const handleStart = () => {
    if (!requireName()) return;
    abortRef.current = false;
    start();
  };

  const submitText = () => {
    if (!requireName()) return;
    const clean = text.trim();
    if (clean.length < 4) {
      toast.error("Type a sentence or two about where things stand.");
      return;
    }
    submit({ text: clean, duration: 0 });
  };

  const handlePass = () => {
    if (baton) onPassed(baton);
    reset();
    setPhase("idle");
    setBaton(null);
    setText("");
    setTextMode(false);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="pass-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-background/92 px-6 backdrop-blur-md"
      >
        {/* close */}
        {phase !== "processing" ? (
          <button
            onClick={closeAll}
            aria-label="Close"
            className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-ember/40 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}

        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {/* ---------------------------------------------------- IDLE */}
            {phase === "idle" ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="flex flex-col items-center text-center"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ember">
                  Pass the baton
                </p>
                <h2 className="font-display mt-3 text-3xl">
                  {textMode ? "Type your handoff" : "Where do things stand?"}
                </h2>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  {textMode
                    ? "A sentence or two is plenty — Relay structures the rest."
                    : "Talk for up to two minutes. Rambling is welcome."}
                </p>

                <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
                  <Input
                    value={author}
                    onChange={(e) => rememberAuthor(e.target.value)}
                    placeholder="Your name (required)"
                    aria-required
                    className="text-center"
                    maxLength={40}
                  />
                  <Input
                    value={role}
                    onChange={(e) => rememberRole(e.target.value)}
                    placeholder="Your role — e.g. Frontend, On-call (optional)"
                    className="text-center"
                    maxLength={40}
                  />
                </div>

                {textMode ? (
                  <div className="mt-4 w-full">
                    <Textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Shipped the auth flow, deploy is blocked on the Groq key, next up is billing…"
                      className="min-h-32"
                      autoFocus
                    />
                    <Button
                      className="mt-4 w-full"
                      onClick={submitText}
                      disabled={author.trim().length < 2}
                    >
                      Structure my handoff <ArrowRight className="size-4" />
                    </Button>
                    <button
                      onClick={() => setTextMode(false)}
                      className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Use my voice instead
                    </button>
                  </div>
                ) : (
                  <div className="mt-8 flex flex-col items-center">
                    <RecordButton
                      onClick={handleStart}
                      disabled={author.trim().length < 2}
                    />
                    <button
                      onClick={() => setTextMode(true)}
                      className="mt-8 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Type className="size-3.5" /> No mic? Type it
                    </button>
                  </div>
                )}
              </motion.div>
            ) : null}

            {/* ------------------------------------------------ RECORDING */}
            {phase === "recording" ? (
              <motion.div
                key="recording"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center text-center"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ember">
                  Listening
                </p>
                <div className="mt-8">
                  <Waveform levels={levels} />
                </div>
                <p className="mt-8 font-mono text-2xl tabular-nums text-foreground">
                  {fmt(seconds)}
                  <span className="text-muted-foreground/50">
                    {" "}
                    / {fmt(MAX_SECONDS)}
                  </span>
                </p>
                <button
                  onClick={stop}
                  aria-label="Stop recording"
                  className="mt-8 flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_36px_-6px_var(--ember)] transition-transform hover:scale-105 active:scale-95"
                >
                  <Square className="size-5 fill-current" />
                </button>
                <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Tap to finish
                </p>
              </motion.div>
            ) : null}

            {/* ----------------------------------------------- PROCESSING */}
            {phase === "processing" ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center text-center"
              >
                <Loader2
                  className={
                    reduce
                      ? "size-8 text-ember"
                      : "size-8 animate-spin text-ember"
                  }
                />
                <h2 className="font-display mt-6 text-2xl">
                  Assembling your baton
                </h2>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                  Transcribing · structuring
                </p>
              </motion.div>
            ) : null}

            {/* -------------------------------------------------- CONFIRM */}
            {phase === "confirm" && baton ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="flex flex-col items-center"
              >
                <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.3em] text-ember">
                  Your baton
                </p>
                <BatonCard
                  card={baton.card!}
                  author={baton.author_name}
                  role={baton.author_role}
                  createdAt={baton.created_at}
                  audioUrl={baton.audio_url}
                  durationSeconds={baton.duration_seconds}
                  animate
                  className="glow-ember"
                />
                <Button className="mt-6 w-full max-w-md" onClick={handlePass}>
                  Pass the baton <ArrowRight className="size-4" />
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/** The signature element: one big glowing ember record button. */
function RecordButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Start recording"
      title={disabled ? "Add your name first" : undefined}
      className="group relative flex size-28 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-ember-soft to-ember-deep opacity-90 shadow-[0_0_60px_-6px_var(--ember)] transition-transform duration-300 group-hover:scale-105 group-active:scale-95 group-disabled:scale-100 group-disabled:shadow-none" />
      {!disabled && (
        <span className="absolute inset-0 animate-ping rounded-full bg-ember/30 [animation-duration:2.4s]" />
      )}
      <Mic className="relative size-10 text-primary-foreground" />
    </button>
  );
}

/** Center-mirrored live waveform driven by the recorder's level buffer. */
function Waveform({ levels }: { levels: number[] }) {
  return (
    <div
      className="flex h-24 items-center justify-center gap-[3px]"
      aria-hidden
    >
      {levels.map((amp, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-ember"
          style={{
            height: `${Math.max(3, amp * 96)}px`,
            opacity: 0.35 + amp * 0.65,
          }}
        />
      ))}
    </div>
  );
}
