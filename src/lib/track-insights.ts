import type { Baton, BatonItem, BatonItemKind } from "@/lib/types";

/**
 * Pure, client-safe analytics over a track's batons.
 * Everything here is derived — no network, no state.
 */

export interface KindCounts {
  done: number;
  doing: number;
  blocked: number;
  next: number;
  note: number;
}

/** An actionable item from an older baton that no later baton marked done. */
export interface OpenItem {
  kind: Exclude<BatonItemKind, "done" | "note">;
  text: string;
  author: string;
  batonId: string;
  batonCreatedAt: string;
  /** How many handoffs have happened since this was raised. */
  handoffsAgo: number;
}

export interface TrackInsights {
  counts: KindCounts;
  /** done / (done + doing + blocked + next), 0..1. NaN-safe. */
  completion: number;
  contributors: { name: string; batons: number }[];
  /** Actionable items still open, oldest first (most overdue first). */
  openItems: OpenItem[];
  /** Open items old enough (≥2 handoffs ago) to deserve a nudge. */
  reminders: OpenItem[];
  lastPassedAt: string | null;
  /** Average hours between consecutive batons, null with <2 batons. */
  avgHandoffGapHours: number | null;
}

const STOPWORDS = new Set([
  "the", "a", "an", "to", "of", "in", "on", "for", "and", "or", "is", "are",
  "was", "were", "be", "been", "with", "at", "by", "it", "its", "this", "that",
  "we", "i", "my", "our", "up", "out", "into", "still", "now", "next", "need",
  "needs", "should", "will", "going", "get", "got", "do", "did", "done",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s#-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

/**
 * Fuzzy "is this the same piece of work?" check between an open item and a
 * later done item. Token overlap relative to the smaller set — tolerant of
 * rephrasing ("fix auth bug" vs "fixed the auth login bug").
 */
function sameWork(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size) >= 0.5;
}

const ACTIONABLE: BatonItemKind[] = ["doing", "blocked", "next"];

/**
 * Compute all track metrics. Expects batons newest-first (as the page loads
 * them); handles missing cards gracefully.
 */
export function computeTrackInsights(batons: Baton[]): TrackInsights {
  const chrono = [...batons].reverse(); // oldest first
  const counts: KindCounts = { done: 0, doing: 0, blocked: 0, next: 0, note: 0 };
  const byAuthor = new Map<string, number>();

  for (const b of chrono) {
    byAuthor.set(b.author_name, (byAuthor.get(b.author_name) ?? 0) + 1);
    for (const item of b.card?.items ?? []) {
      counts[item.kind] += 1;
    }
  }

  // Everything marked done anywhere on the track, used to resolve older items.
  const doneTexts: { text: string; index: number }[] = [];
  chrono.forEach((b, i) => {
    for (const item of b.card?.items ?? []) {
      if (item.kind === "done") doneTexts.push({ text: item.text, index: i });
    }
  });

  const openItems: OpenItem[] = [];
  chrono.forEach((b, i) => {
    for (const item of b.card?.items ?? []) {
      if (!ACTIONABLE.includes(item.kind)) continue;
      const resolvedLater = doneTexts.some(
        (d) => d.index > i && sameWork(item.text, d.text)
      );
      // An actionable item restated in a later baton isn't "forgotten" —
      // only surface the most recent mention.
      const restatedLater = chrono
        .slice(i + 1)
        .some((later) =>
          (later.card?.items ?? []).some(
            (li: BatonItem) =>
              ACTIONABLE.includes(li.kind) && sameWork(item.text, li.text)
          )
        );
      if (!resolvedLater && !restatedLater) {
        openItems.push({
          kind: item.kind as OpenItem["kind"],
          text: item.text,
          author: b.author_name,
          batonId: b.id,
          batonCreatedAt: b.created_at,
          handoffsAgo: chrono.length - 1 - i,
        });
      }
    }
  });

  // Most overdue first; blockers outrank everything at the same age.
  openItems.sort((a, b) => {
    if (b.handoffsAgo !== a.handoffsAgo) return b.handoffsAgo - a.handoffsAgo;
    if (a.kind === "blocked" && b.kind !== "blocked") return -1;
    if (b.kind === "blocked" && a.kind !== "blocked") return 1;
    return 0;
  });

  const reminders = openItems.filter(
    (o) => o.handoffsAgo >= 2 || o.kind === "blocked"
  );

  const actionableTotal =
    counts.done + counts.doing + counts.blocked + counts.next;
  const completion = actionableTotal > 0 ? counts.done / actionableTotal : 0;

  let avgHandoffGapHours: number | null = null;
  if (chrono.length >= 2) {
    const first = new Date(chrono[0].created_at).getTime();
    const last = new Date(chrono[chrono.length - 1].created_at).getTime();
    avgHandoffGapHours = (last - first) / (chrono.length - 1) / 3_600_000;
  }

  return {
    counts,
    completion,
    contributors: [...byAuthor.entries()]
      .map(([name, n]) => ({ name, batons: n }))
      .sort((a, b) => b.batons - a.batons),
    openItems,
    reminders,
    lastPassedAt: chrono.length ? chrono[chrono.length - 1].created_at : null,
    avgHandoffGapHours,
  };
}
