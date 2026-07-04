# Relay

**Talk when you leave. Listen when you arrive.**

Voice-first work handoffs, built solo at **RAISE Summit Hackathon 2026**
(Cursor track, remote) — designed and shipped entirely with Cursor.

> Live demo: _coming Sunday_ · 1-minute video: _coming Sunday_

## The problem

Context dies at every handoff: end of day, timezone handoffs, standups, shift
changes. Good written handoffs fix this — and nobody writes them, because
writing them is tedious.

Every existing tool makes one side of the handoff cheap by making the other
expensive: Loom is effortless to record but expensive to watch; handoff docs
are effortless to read but expensive to write; standups are fair to both sides
but force everyone into the same room at the same time.

## What Relay does

1. **The Pass** — when you stop working, talk for 60 seconds. Rambling is fine.
2. **The Baton** — Relay structures your voice into a card while you watch:
   done · in progress · blocked · next.
3. **The Catch** — the next person presses one button and *hears* a 20-second
   recap of everything since they left.

Both sides become cheap: 60 seconds of talking in, 20 seconds of listening out.

## Stack

Next.js 16 · Tailwind v4 · Motion · Supabase (Postgres + storage) ·
Groq (Whisper STT + Llama structuring) · Gemini Flash TTS · Vercel.
Runs entirely on free tiers.

## Built with Cursor, during the event

- Every plan, rule, and commit in this repo was created during the hackathon
  (July 4–5, 2026). See the commit timestamps.
- `.cursor/rules/` — the project + design-system rules that kept every agent
  session on-brand.
- `SPEC.md` — the session-by-session build spec each fresh agent chat worked
  from. `project.md` — strategy and demo plan.

## Run locally

```bash
bun install
cp .env.example .env.local   # fill: Supabase, Groq, Gemini keys (all free)
# run supabase/schema.sql in your Supabase SQL editor, create public bucket "batons"
bun dev
```
