import type { Baton, BatonCard, BatonItem, BatonItemKind } from "@/lib/types";

/**
 * Relay's AI pipeline: Groq Whisper (transcribe) + Llama (structure), called
 * over Groq's OpenAI-compatible REST API so we add zero dependencies. Every
 * external call gets one retry that honors `Retry-After`, then a fallback.
 *
 * Server-only: this module reads GROQ_API_KEY and must never reach the client.
 */

const GROQ_BASE = "https://api.groq.com/openai/v1";

const TRANSCRIBE_MODEL = "whisper-large-v3-turbo";
const STRUCTURE_MODEL = "llama-3.3-70b-versatile";
const STRUCTURE_FALLBACK_MODEL = "llama-3.1-8b-instant";

const VALID_KINDS: readonly BatonItemKind[] = [
  "done",
  "doing",
  "blocked",
  "next",
  "note",
];

function groqKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured");
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Error carrying the HTTP status so callers can decide to retry/fallback. */
class GroqError extends Error {
  status: number;
  retryAfter?: number;
  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function isRetryable(err: unknown): err is GroqError {
  return (
    err instanceof GroqError && (err.status === 429 || err.status >= 500)
  );
}

/**
 * Run `fn` once; on a retryable error wait (honoring Retry-After) and try once
 * more. Anything still failing is thrown for the caller to handle/fallback.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isRetryable(err)) throw err;
    const waitMs = (err.retryAfter ?? 1) * 1000;
    await sleep(Math.min(waitMs, 6000));
    return await fn();
  }
}

function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  if (!raw) return undefined;
  const secs = Number(raw);
  return Number.isFinite(secs) ? secs : undefined;
}

// --------------------------------------------------------------------------
// Transcribe
// --------------------------------------------------------------------------

/**
 * Transcribe an audio blob (webm/opus from MediaRecorder is accepted directly)
 * to plain text via Groq Whisper. Retries once on 429/5xx.
 */
export async function transcribe(audio: Blob): Promise<string> {
  return withRetry(async () => {
    const form = new FormData();
    // Groq needs a filename; MediaRecorder blobs may lack one.
    const filename =
      audio instanceof File && audio.name ? audio.name : "handoff.webm";
    form.append("file", audio, filename);
    form.append("model", TRANSCRIBE_MODEL);
    form.append("response_format", "json");
    form.append("temperature", "0");

    const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey()}` },
      body: form,
    });

    if (!res.ok) {
      throw new GroqError(
        res.status,
        `Transcription failed (${res.status})`,
        parseRetryAfter(res)
      );
    }

    const data = (await res.json()) as { text?: string };
    return (data.text ?? "").trim();
  });
}

// --------------------------------------------------------------------------
// Structure
// --------------------------------------------------------------------------

const STRUCTURE_SYSTEM = `You convert a spoken work-handoff transcript into a structured "Baton Card".

Return ONLY JSON of exactly this shape:
{
  "summary": "one sentence describing the overall state of the work",
  "items": [{ "kind": "done | doing | blocked | next | note", "text": "short sentence" }],
  "links": [{ "label": "short label", "url": "https://..." }]
}

Rules:
- kind must be one of: done, doing, blocked, next, note.
- Only include items actually supported by the transcript. Never invent work.
- Empty arrays are allowed if the transcript has nothing for them.
- Keep each item text to one short clause. Fix obvious speech-to-text noise.
- Pull any URLs mentioned into links with a concise human label; omit if none.
- summary is a single natural sentence a teammate could read at a glance.`;

async function callStructure(
  transcript: string,
  model: string
): Promise<unknown> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: STRUCTURE_SYSTEM },
        {
          role: "user",
          content: `Transcript:\n"""\n${transcript}\n"""`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new GroqError(
      res.status,
      `Structuring failed (${res.status})`,
      parseRetryAfter(res)
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content);
}

/**
 * Turn a transcript into a validated BatonCard. Tries the 70B model with one
 * retry, then falls back to the fast 8B model before giving up.
 */
export async function structure(transcript: string): Promise<BatonCard> {
  const clean = transcript.trim();
  if (!clean) {
    return { summary: "No handoff was recorded.", items: [], links: [] };
  }

  let raw: unknown;
  try {
    raw = await withRetry(() => callStructure(clean, STRUCTURE_MODEL));
  } catch (err) {
    if (!isRetryable(err)) throw err;
    raw = await callStructure(clean, STRUCTURE_FALLBACK_MODEL);
  }
  return validateBatonCard(raw);
}

// --------------------------------------------------------------------------
// Validation
// --------------------------------------------------------------------------

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Coerce arbitrary LLM output into a safe BatonCard. Drops malformed items and
 * links rather than throwing, so a slightly-off model response still renders.
 */
export function validateBatonCard(raw: unknown): BatonCard {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const items: BatonItem[] = Array.isArray(obj.items)
    ? (obj.items as unknown[])
        .map((it) => {
          const rec = (it ?? {}) as Record<string, unknown>;
          const kind = asString(rec.kind).toLowerCase() as BatonItemKind;
          const text = asString(rec.text);
          if (!VALID_KINDS.includes(kind) || !text) return null;
          return { kind, text };
        })
        .filter((x): x is BatonItem => x !== null)
    : [];

  const links = Array.isArray(obj.links)
    ? (obj.links as unknown[])
        .map((l) => {
          const rec = (l ?? {}) as Record<string, unknown>;
          const url = asString(rec.url);
          const label = asString(rec.label) || url;
          if (!/^https?:\/\//i.test(url)) return null;
          return { label, url };
        })
        .filter((x): x is { label: string; url: string } => x !== null)
    : [];

  const summary =
    asString(obj.summary) ||
    (items.length ? "Handoff recorded." : "No clear handoff was captured.");

  return { summary, items, links };
}

// --------------------------------------------------------------------------
// Recap (text) — spoken-style catch-up across handoffs
// --------------------------------------------------------------------------

const RECAP_SYSTEM = `You write a short spoken catch-up for a teammate returning to work.

You are given recent handoffs in order (oldest first), each with an author, a
summary, and status items. Write what you'd SAY to someone who just sat down:
- 80 words or fewer, warm and natural, 2-4 sentences.
- Lead with the single most important thing (blockers and decisions first).
- Mention who did what when it helps ("Ana shipped..., but the deploy's blocked").
- No preamble ("here's your recap"), no markdown, no lists. Just spoken prose.`;

type RecapBaton = Pick<Baton, "author_name" | "card" | "created_at">;

function serializeBatons(batons: RecapBaton[]): string {
  return batons
    .map((b, i) => {
      const card = b.card;
      if (!card) return "";
      const items = card.items
        .map((it) => `  - ${it.kind}: ${it.text}`)
        .join("\n");
      return `Handoff ${i + 1} — ${b.author_name}:\n  summary: ${
        card.summary
      }${items ? `\n${items}` : ""}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Write a <=80-word spoken recap of the given handoffs. Retries + fallback. */
export async function recap(batons: RecapBaton[]): Promise<string> {
  if (batons.length === 0) {
    return "You're all caught up — nothing new since your last visit.";
  }

  const messages = [
    { role: "system", content: RECAP_SYSTEM },
    { role: "user", content: serializeBatons(batons) },
  ];

  const call = async (model: string): Promise<string> => {
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, temperature: 0.4, messages }),
    });
    if (!res.ok) {
      throw new GroqError(
        res.status,
        `Recap failed (${res.status})`,
        parseRetryAfter(res)
      );
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return (data.choices?.[0]?.message?.content ?? "").trim();
  };

  try {
    return await withRetry(() => call(STRUCTURE_MODEL));
  } catch (err) {
    if (!isRetryable(err)) throw err;
    return await call(STRUCTURE_FALLBACK_MODEL);
  }
}

// --------------------------------------------------------------------------
// Text-to-speech (Gemini) — optional; returns null to trigger the client's
// speechSynthesis fallback when no key is set or the call fails.
// --------------------------------------------------------------------------

const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const GEMINI_VOICE = "Kore";

/** Little-endian WAV wrapper around raw PCM (Gemini returns 16-bit mono PCM). */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function parseSampleRate(mime: string | undefined): number {
  const m = mime?.match(/rate=(\d+)/);
  return m ? Number(m[1]) : 24000;
}

export interface TtsResult {
  data: Buffer;
  contentType: string;
  ext: string;
}

/** Synthesize speech via Gemini; returns null (never throws) so callers can
 *  gracefully fall back to the browser's speechSynthesis. */
export async function tts(text: string): Promise<TtsResult | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !text.trim()) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Say warmly and naturally: ${text}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: GEMINI_VOICE },
              },
            },
          },
        }),
      }
    );
    if (!res.ok) return null;

    const json = (await res.json()) as {
      candidates?: {
        content?: {
          parts?: { inlineData?: { data?: string; mimeType?: string } }[];
        };
      }[];
    };
    const inline = json.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data
    )?.inlineData;
    if (!inline?.data) return null;

    const pcm = Buffer.from(inline.data, "base64");
    const wav = pcmToWav(pcm, parseSampleRate(inline.mimeType));
    return { data: wav, contentType: "audio/wav", ext: "wav" };
  } catch {
    return null;
  }
}
