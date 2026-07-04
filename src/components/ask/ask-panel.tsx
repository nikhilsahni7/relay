"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronRight,
  CornerDownLeft,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

import type { Baton } from "@/lib/types";
import { BatonCard } from "@/components/baton/baton-card";
import { ITEM_STYLES } from "@/components/baton/item-styles";
import { cn, timeAgo } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

const SUGGESTIONS = [
  "What's blocked right now?",
  "What's left to do?",
  "What did the last person finish?",
  "Any decisions I should know about?",
];

interface QAEntry {
  id: string;
  question: string;
  answer: string;
  batonId: string | null;
  pending: boolean;
  error?: boolean;
}

/**
 * "Ask the track" — grounded Q&A over the team's handoffs. Answers cite the
 * source baton (rendered inline, expandable). Everything is client-side chatter
 * over /api/ask; the batons we already have on the page power the citations.
 */
export function AskPanel({
  teamSlug,
  batons,
  open,
  onClose,
}: {
  teamSlug: string;
  batons: Baton[];
  open: boolean;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<QAEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const batonById = useRef(new Map<string, Baton>());
  batonById.current = new Map(batons.map((b) => [b.id, b]));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      clearTimeout(t);
    };
  }, [open, onClose]);

  // Keep the newest exchange in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [thread]);

  const submit = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || busy) return;
      const id = crypto.randomUUID();
      setThread((t) => [
        ...t,
        { id, question: q, answer: "", batonId: null, pending: true },
      ]);
      setQuestion("");
      setBusy(true);

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ team_slug: teamSlug, question: q }),
        });
        const json = await res.json();
        setThread((t) =>
          t.map((e) =>
            e.id === id
              ? {
                  ...e,
                  pending: false,
                  error: !res.ok,
                  answer: res.ok
                    ? json.answer
                    : json.error ?? "Couldn't answer that. Try again.",
                  batonId: res.ok ? json.baton_id ?? null : null,
                }
              : e
          )
        );
      } catch {
        setThread((t) =>
          t.map((e) =>
            e.id === id
              ? {
                  ...e,
                  pending: false,
                  error: true,
                  answer: "Network hiccup. Try again.",
                }
              : e
          )
        );
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy, teamSlug]
  );

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Ask the track"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.3, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card/95 backdrop-blur sm:h-[70vh] sm:rounded-2xl"
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-full bg-ember/15">
                  <Sparkles className="size-4 text-ember" />
                </span>
                <div>
                  <p className="text-sm font-medium">Ask the track</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Answers grounded in {batons.length} baton
                    {batons.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* thread */}
            <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {thread.length === 0 ? (
                <EmptyPrompts
                  disabled={batons.length === 0}
                  onPick={(q) => submit(q)}
                />
              ) : (
                thread.map((entry) => (
                  <Exchange
                    key={entry.id}
                    entry={entry}
                    baton={
                      entry.batonId
                        ? batonById.current.get(entry.batonId) ?? null
                        : null
                    }
                  />
                ))
              )}
            </div>

            {/* composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(question);
              }}
              className="border-t border-border p-3"
            >
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 focus-within:border-ember/50">
                <input
                  ref={inputRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={batons.length === 0}
                  placeholder={
                    batons.length === 0
                      ? "No batons on the track yet"
                      : "Ask anything about the work…"
                  }
                  maxLength={300}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={busy || !question.trim() || batons.length === 0}
                  aria-label="Ask"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CornerDownLeft className="size-4" />
                  )}
                </button>
              </div>
              <p className="mt-2 px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                Relay only answers from what's on this track — it won't make
                things up.
              </p>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function EmptyPrompts({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (q: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-ember/10">
        <Sparkles className="size-5 text-ember" />
      </span>
      <h3 className="font-display mt-4 text-2xl">What do you want to know?</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Ask about blockers, what's left, or who did what — Relay reads the
        whole relay and answers in a sentence.
      </p>
      {!disabled ? (
        <div className="mt-6 flex w-full max-w-sm flex-col gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="group flex items-center justify-between rounded-lg border border-border bg-background/50 px-3.5 py-2.5 text-left text-sm transition-colors hover:border-ember/40 hover:bg-accent"
            >
              {s}
              <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-ember" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Exchange({
  entry,
  baton,
}: {
  entry: QAEntry;
  baton: Baton | null;
}) {
  return (
    <div className="space-y-2.5">
      {/* question bubble */}
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-secondary px-3.5 py-2 text-sm">
          {entry.question}
        </p>
      </div>

      {/* answer */}
      <div className="flex gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-ember/15">
          <Sparkles className="size-3.5 text-ember" />
        </span>
        <div className="min-w-0 flex-1">
          {entry.pending ? (
            <ThinkingDots />
          ) : (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className={cn(
                "text-sm leading-relaxed",
                entry.error ? "text-destructive" : "text-foreground/90"
              )}
            >
              {entry.answer}
            </motion.p>
          )}
          {baton ? <SourceBaton baton={baton} /> : null}
        </div>
      </div>
    </div>
  );
}

/** Collapsed citation that expands into the full source Baton Card. */
function SourceBaton({ baton }: { baton: Baton }) {
  const [expanded, setExpanded] = useState(false);
  const counts = baton.card?.items.reduce<Record<string, number>>((acc, it) => {
    acc[it.kind] = (acc[it.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="group flex w-full items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-left transition-colors hover:border-ember/40"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ember-soft to-ember-deep text-[10px] font-medium text-primary-foreground">
          {baton.author_name.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">
            From {baton.author_name}
          </span>
          <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {timeAgo(baton.created_at)} · source
          </span>
        </span>
        {counts ? (
          <span className="flex items-center gap-1.5">
            {(["done", "doing", "blocked", "next"] as const).map((k) =>
              counts[k] ? (
                <span
                  key={k}
                  className="size-1.5 rounded-full"
                  style={{ background: ITEM_STYLES[k].color }}
                />
              ) : null
            )}
          </span>
        ) : null}
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="pt-2.5">
              <BatonCard
                card={baton.card ?? { summary: "", items: [], links: [] }}
                author={baton.author_name}
                role={baton.author_role}
                createdAt={baton.created_at}
                audioUrl={baton.audio_url}
                durationSeconds={baton.duration_seconds}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-ember"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.15,
          }}
        />
      ))}
    </span>
  );
}
