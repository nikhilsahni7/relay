/**
 * Seeds the `relay-demo` team with a realistic cross-timezone story so judges
 * land on a living track: Ana (Lisbon) → Dev (Bangalore) → Sam (NYC) passing
 * one feature around the clock.
 *
 * Run with: bun scripts/seed-demo.ts   (re-runnable: wipes + reseeds the team)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (load .env.local)");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const SLUG = "relay-demo";
const NAME = "Checkout Revamp — Demo";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const batons = [
  {
    author_name: "Ana",
    author_role: "Frontend · Lisbon",
    created_at: hoursAgo(52),
    duration_seconds: 48,
    transcript:
      "Okay, wrapping up my day. I finished the new checkout form UI, all the fields validate now. I started wiring the payment intent call but Stripe test keys are acting weird, so that's half done. Next person should pick up the payment confirmation screen. Oh and heads up, the design file moved, link is in Figma under checkout v2.",
    card: {
      summary: "Checkout form UI is done; payment intent wiring is mid-flight with flaky Stripe test keys.",
      items: [
        { kind: "done", text: "New checkout form UI with full field validation" },
        { kind: "doing", text: "Wiring the payment intent call to Stripe" },
        { kind: "blocked", text: "Stripe test keys behaving inconsistently" },
        { kind: "next", text: "Build the payment confirmation screen" },
        { kind: "note", text: "Design file moved to Figma 'checkout v2'" },
      ],
      links: [],
    },
  },
  {
    author_name: "Dev",
    author_role: "Backend · Bangalore",
    created_at: hoursAgo(38),
    duration_seconds: 55,
    transcript:
      "Morning handoff from my side. Picked up Ana's Stripe issue — the test keys were fine, the webhook secret was stale, rotated it and payment intents work now. Unblocked. I also added the orders table migration. In progress: the refund endpoint, about seventy percent there. Next up someone needs to handle the email receipt after payment succeeds. Don't touch the old checkout routes yet, mobile still uses them.",
    card: {
      summary: "Stripe unblocked (stale webhook secret), orders migration landed; refund endpoint is ~70% done.",
      items: [
        { kind: "done", text: "Fixed Stripe by rotating the stale webhook secret" },
        { kind: "done", text: "Added the orders table migration" },
        { kind: "doing", text: "Refund endpoint (~70% complete)" },
        { kind: "next", text: "Send email receipt after successful payment" },
        { kind: "note", text: "Old checkout routes still used by mobile — don't remove" },
      ],
      links: [],
    },
  },
  {
    author_name: "Sam",
    author_role: "Full-stack · NYC",
    created_at: hoursAgo(26),
    duration_seconds: 41,
    transcript:
      "End of my shift. Shipped the payment confirmation screen Ana asked for, hooked it to Dev's new intent flow, works end to end in staging. Started the email receipts using Resend but I'm blocked, we need the DNS records verified before emails send, I pinged ops. Next: refund endpoint still needs finishing and someone should QA the whole flow on mobile Safari.",
    card: {
      summary: "Confirmation screen shipped and working end-to-end in staging; email receipts blocked on DNS verification.",
      items: [
        { kind: "done", text: "Payment confirmation screen wired to the new intent flow" },
        { kind: "blocked", text: "Email receipts blocked on DNS verification (ops pinged)" },
        { kind: "next", text: "Finish the refund endpoint" },
        { kind: "next", text: "QA the full checkout flow on mobile Safari" },
      ],
      links: [],
    },
  },
  {
    author_name: "Ana",
    author_role: "Frontend · Lisbon",
    created_at: hoursAgo(14),
    duration_seconds: 38,
    transcript:
      "Back on. Caught up in twenty seconds, love it. QA'd mobile Safari like Sam asked — found one bug, the pay button double-fires on slow taps, fixed with a debounce, shipped. Refund endpoint is still open, I didn't touch backend. DNS for the receipts is still with ops as far as I can tell. Next person: chase ops on DNS and finish refunds, then we're basically done.",
    card: {
      summary: "Mobile Safari QA'd and a double-charge tap bug fixed; refunds and DNS verification remain open.",
      items: [
        { kind: "done", text: "QA'd checkout on mobile Safari" },
        { kind: "done", text: "Fixed pay button double-firing with a debounce" },
        { kind: "next", text: "Chase ops on DNS verification for receipts" },
        { kind: "next", text: "Finish the refund endpoint" },
      ],
      links: [],
    },
  },
  {
    author_name: "Dev",
    author_role: "Backend · Bangalore",
    created_at: hoursAgo(3),
    duration_seconds: 44,
    transcript:
      "Quick one before lunch. Refund endpoint is done, tests pass, deployed to staging. DNS got verified an hour ago so email receipts are live too, tested with a real payment. That clears both blockers. The only thing left is a final end-to-end run in production and flipping the feature flag. Whoever's on next, that's all yours — we're one pass from the finish line.",
    card: {
      summary: "Refunds shipped and receipts live after DNS cleared — only the prod run and feature flag remain.",
      items: [
        { kind: "done", text: "Refund endpoint finished, tested, deployed to staging" },
        { kind: "done", text: "Email receipts live after DNS verification" },
        { kind: "next", text: "Final end-to-end run in production" },
        { kind: "next", text: "Flip the checkout-v2 feature flag" },
      ],
      links: [],
    },
  },
];

async function main() {
  // Re-runnable: drop the old demo team (cascades to batons + recaps).
  await db.from("teams").delete().eq("slug", SLUG);

  const { data: team, error: teamErr } = await db
    .from("teams")
    .insert({ slug: SLUG, name: NAME })
    .select()
    .single();
  if (teamErr || !team) {
    console.error("Failed to create demo team:", teamErr?.message);
    process.exit(1);
  }

  const rows = batons.map((b) => ({ ...b, team_id: team.id }));
  const { error: batonErr } = await db.from("batons").insert(rows);
  if (batonErr) {
    console.error("Failed to insert batons:", batonErr.message);
    process.exit(1);
  }

  console.log(`Seeded ${rows.length} batons for /t/${SLUG} ✅`);
  console.log("Tip: open /demo once and press 'Catch me up' to pre-cache the recap audio.");
}

main();
