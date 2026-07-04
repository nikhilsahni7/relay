import type { BatonItemKind } from "@/lib/types";

/** Canonical label + color token for each Baton Card item kind. */
export const ITEM_STYLES: Record<
  BatonItemKind,
  { label: string; color: string }
> = {
  done: { label: "Done", color: "var(--done)" },
  doing: { label: "In progress", color: "var(--doing)" },
  blocked: { label: "Blocked", color: "var(--blocked)" },
  next: { label: "Next", color: "var(--next)" },
  note: { label: "Note", color: "var(--note)" },
};

/** Deterministic order so items always read done -> doing -> blocked -> next -> note. */
export const KIND_ORDER: BatonItemKind[] = [
  "done",
  "doing",
  "blocked",
  "next",
  "note",
];
