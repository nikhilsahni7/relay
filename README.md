# Relay

**Talk when you leave. Listen when you arrive.**

Voice-first work handoffs, built **solo** at **RAISE Summit Hackathon 2026**
(Cursor track, remote) — designed and shipped entirely with Cursor, entirely
during the event (July 4–5, 2026).

## Try it in 60 seconds

1. **Live app:** [relay-eight-jet.vercel.app](https://relay-eight-jet.vercel.app)
2. **Demo team (no mic needed):**
   [relay-eight-jet.vercel.app/t/relay-demo](https://relay-eight-jet.vercel.app/t/relay-demo)
   — a seeded track where Ana (Lisbon), Dev (Bangalore) and Sam (NYC) pass one
   feature around the clock. Press **Catch me up** and *hear* the product work,
   then hit **Ask** ("What's blocked right now?") to see grounded, cited answers.
3. **Pass your own baton:** press `R`, talk for 30 seconds (rambling welcome),
   and watch it become a structured Baton Card. No mic? There's a type-it path.

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
   done · in progress · blocked · next · notes, plus any links you mentioned.
3. **The Catch** — the next person presses one button and *hears* a 20-second
   spoken recap of everything since they left — across all handoffs, not just
   the last one.
4. **Ask the track** — follow-up questions answered strictly from the handoff
   history, with the source baton cited and expandable inline.

Both sides become cheap: 60 seconds of talking in, 20 seconds of listening out.

The track itself is a pannable, zoomable relay canvas — batons connected along
a lane, with track health (completion, blockers, runners) and a "dropped
items" detector that flags open tasks nobody has picked up across handoffs.

## How it works

```
speak (MediaRecorder) ──▶ Groq Whisper (STT) ──▶ Llama 3.3 70B (structuring, JSON)
                                                        │
                        Supabase (Postgres + storage) ◀─┘
                                                        │
catch ◀── Gemini Flash TTS ◀── Llama recap (≤80 words) ─┘
          └─ fallback: browser speechSynthesis
```

Every external call has retry-with-backoff honoring `Retry-After`, plus a
model fallback chain (70B → 8B instant) — the whole thing runs on free tiers.
Recap audio is cached in storage so replays cost zero API calls.

## Stack

Next.js 16 (App Router) · Tailwind v4 · Motion · Supabase (Postgres + storage) ·
Groq (Whisper STT + Llama structuring) · Gemini Flash TTS · Vercel · bun.
No auth — teams are unguessable shareable URLs.

## Built with Cursor, during the event

Everything in this repo was created during the hackathon — see the commit
timestamps. How Cursor was used:

- **Plan Mode first** for the two architecture-heavy sessions (the AI pass
  pipeline and the catch/recap system); plain Agent mode for the rest.
- **`SPEC.md` as the session script** — one fresh agent chat per feature,
  each pointed at its session brief ("Read SPEC.md, do Session N"). Kept
  context clean and every session shippable.
- **`.cursor/rules/`** — an always-on project rule (stack, conventions,
  "no new dependencies without asking") that kept every agent session
  on-brand and prevented expensive wrong turns.
- **Cursor's browser tool** — after each feature, the agent opened
  localhost, clicked through the flow, screenshotted it, and fixed what
  looked wrong before handing back.
- **Model split** — high-reasoning model for planning, fast model for
  scaffolding and polish. Small descriptive commits after every working step.

## Run locally

```bash
bun install
cp .env.example .env.local   # fill: Supabase, Groq, Gemini keys (all free)
# run supabase/schema.sql in your Supabase SQL editor, create public bucket "batons"
bun dev
# optional: seed the demo team
bun scripts/seed-demo.ts
```
