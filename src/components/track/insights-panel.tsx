"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Flame,
  Users,
} from "lucide-react";

import type { OpenItem, TrackInsights } from "@/lib/track-insights";
import { ITEM_STYLES } from "@/components/baton/item-styles";
import { cn, timeAgo } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

function kindColor(kind: OpenItem["kind"]): string {
  return ITEM_STYLES[kind].color;
}

/**
 * Track health strip: completion ring, per-kind counts, team activity, and a
 * reminders drawer for actionable items nobody has picked up.
 */
export function InsightsPanel({
  insights,
  batonCount,
}: {
  insights: TrackInsights;
  batonCount: number;
}) {
  const [remindersOpen, setRemindersOpen] = useState(false);

  if (batonCount === 0) return null;

  const pct = Math.round(insights.completion * 100);
  const { counts } = insights;
  const actionable = counts.done + counts.doing + counts.blocked + counts.next;

  return (
    <section aria-label="Track health" className="mt-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* completion */}
        <StatCard
          label="Completed"
          icon={<CheckCircle2 className="size-3.5 text-done" />}
        >
          <div className="flex items-end gap-2">
            <span className="font-display text-3xl leading-none">{pct}%</span>
            <span className="mb-0.5 font-mono text-[10px] text-muted-foreground">
              {counts.done}/{actionable} tasks
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.9, ease: EASE }}
              className="h-full rounded-full bg-gradient-to-r from-done/70 to-done"
            />
          </div>
        </StatCard>

        {/* in flight */}
        <StatCard
          label="In flight"
          icon={<Flame className="size-3.5 text-doing" />}
        >
          <div className="flex items-end gap-2">
            <span className="font-display text-3xl leading-none">
              {counts.doing + counts.next}
            </span>
            <span className="mb-0.5 font-mono text-[10px] text-muted-foreground">
              {counts.doing} doing · {counts.next} next
            </span>
          </div>
          <KindDots counts={[counts.done, counts.doing, counts.blocked, counts.next]} />
        </StatCard>

        {/* blockers */}
        <StatCard
          label="Blockers"
          icon={<AlertTriangle className="size-3.5 text-blocked" />}
          alert={counts.blocked > 0}
        >
          <div className="flex items-end gap-2">
            <span
              className={cn(
                "font-display text-3xl leading-none",
                counts.blocked > 0 && "text-blocked"
              )}
            >
              {counts.blocked}
            </span>
            <span className="mb-0.5 font-mono text-[10px] text-muted-foreground">
              {counts.blocked > 0 ? "need attention" : "all clear"}
            </span>
          </div>
        </StatCard>

        {/* team */}
        <StatCard label="Runners" icon={<Users className="size-3.5 text-next" />}>
          <div className="flex items-end gap-2">
            <span className="font-display text-3xl leading-none">
              {insights.contributors.length}
            </span>
            <span className="mb-0.5 truncate font-mono text-[10px] text-muted-foreground">
              {insights.avgHandoffGapHours != null
                ? `~${formatGap(insights.avgHandoffGapHours)}/pass`
                : `${batonCount} baton${batonCount === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="mt-2 flex -space-x-1.5">
            {insights.contributors.slice(0, 6).map((c) => (
              <span
                key={c.name}
                title={`${c.name} — ${c.batons} baton${c.batons === 1 ? "" : "s"}`}
                className="flex size-5 items-center justify-center rounded-full border border-background bg-gradient-to-br from-ember-soft to-ember-deep text-[9px] font-medium text-primary-foreground"
              >
                {c.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
            ))}
          </div>
        </StatCard>
      </div>

      {/* reminders drawer */}
      {insights.openItems.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card/70 backdrop-blur">
          <button
            type="button"
            onClick={() => setRemindersOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary/40"
            aria-expanded={remindersOpen}
          >
            <span className="flex items-center gap-2.5 text-sm">
              <span className="relative flex size-6 items-center justify-center rounded-full bg-ember/15">
                <BellRing className="size-3.5 text-ember" />
                {insights.reminders.length > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-blocked" />
                ) : null}
              </span>
              <span>
                <strong className="font-medium">{insights.openItems.length}</strong>{" "}
                open task{insights.openItems.length === 1 ? "" : "s"} on the track
                {insights.reminders.length > 0 ? (
                  <span className="text-muted-foreground">
                    {" — "}
                    {insights.reminders.length} may have been dropped
                  </span>
                ) : null}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                remindersOpen && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence initial={false}>
            {remindersOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <ul className="max-h-64 space-y-2 overflow-y-auto border-t border-border px-4 py-3">
                  {insights.openItems.map((item, i) => {
                    const dropped =
                      item.handoffsAgo >= 2 || item.kind === "blocked";
                    return (
                      <li
                        key={`${item.batonId}-${i}`}
                        className="flex items-start gap-2.5 text-sm"
                      >
                        <span
                          className="mt-1.5 size-1.5 shrink-0 rounded-full"
                          style={{
                            background: kindColor(item.kind),
                            boxShadow: `0 0 8px -1px ${kindColor(item.kind)}`,
                          }}
                        />
                        <div className="min-w-0">
                          <p className="leading-snug text-foreground/90">
                            {item.text}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {ITEM_STYLES[item.kind].label} · {item.author} ·{" "}
                            {timeAgo(item.batonCreatedAt)}
                            {dropped ? (
                              <span className="text-ember">
                                {" "}
                                · {item.handoffsAgo} handoff
                                {item.handoffsAgo === 1 ? "" : "s"} ago — still open
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </section>
  );
}

function StatCard({
  label,
  icon,
  alert = false,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  alert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/70 p-3.5 backdrop-blur",
        alert && "border-blocked/40"
      )}
    >
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {icon}
        {label}
      </p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

/** Tiny proportional bar of done/doing/blocked/next across the whole track. */
function KindDots({ counts }: { counts: number[] }) {
  const colors = ["var(--done)", "var(--doing)", "var(--blocked)", "var(--next)"];
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return (
    <div className="mt-2 flex h-1 gap-px overflow-hidden rounded-full">
      {counts.map((n, i) =>
        n > 0 ? (
          <span
            key={i}
            className="h-full"
            style={{ width: `${(n / total) * 100}%`, background: colors[i] }}
          />
        ) : null
      )}
    </div>
  );
}

function formatGap(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
