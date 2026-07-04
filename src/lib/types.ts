/** Structured handoff produced by the LLM from a voice transcript. */
export type BatonItemKind = "done" | "doing" | "blocked" | "next" | "note";

export interface BatonItem {
  kind: BatonItemKind;
  text: string;
}

export interface BatonCard {
  /** One-sentence summary of the whole handoff, used in recaps. */
  summary: string;
  items: BatonItem[];
  links: { label: string; url: string }[];
}

export interface Baton {
  id: string;
  team_id: string;
  author_name: string;
  audio_url: string | null;
  transcript: string | null;
  card: BatonCard | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface Team {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}
