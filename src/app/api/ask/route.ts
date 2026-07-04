import { supabaseAdmin } from "@/lib/supabase";
import { ask } from "@/lib/ai";
import type { Baton, Team } from "@/lib/types";

const MAX_QUESTION = 300;

/**
 * POST { team_slug, question } -> { answer, baton_id }
 * Grounded Q&A over a team's handoffs. `baton_id` is the handoff the answer
 * leans on (or null), so the client can cite/jump to the source baton.
 */
export async function POST(request: Request) {
  let teamSlug = "";
  let question = "";
  try {
    const body = (await request.json()) as {
      team_slug?: string;
      question?: string;
    };
    teamSlug = (body.team_slug ?? "").trim();
    question = (body.question ?? "").trim().slice(0, MAX_QUESTION);
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!teamSlug) {
    return Response.json({ error: "Missing team." }, { status: 400 });
  }
  if (question.length < 2) {
    return Response.json(
      { error: "Ask a question about the team's work." },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("slug", teamSlug)
    .single();
  if (!team) {
    return Response.json({ error: "That team doesn't exist." }, { status: 404 });
  }
  const teamId = (team as Pick<Team, "id">).id;

  // Chronological so handoff numbers read oldest-first, matching the prompt.
  const { data: batonsData } = await supabase
    .from("batons")
    .select("id, author_name, author_role, card, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  const batons = (batonsData as Pick<
    Baton,
    "id" | "author_name" | "author_role" | "card" | "created_at"
  >[]) ?? [];

  try {
    const result = await ask(question, batons);
    const source =
      result.handoffIndex != null ? batons[result.handoffIndex - 1] : null;
    return Response.json({
      answer: result.answer,
      baton_id: source?.id ?? null,
    });
  } catch (err) {
    console.error("ask failed", err);
    return Response.json(
      { error: "Couldn't answer that right now. Try again." },
      { status: 502 }
    );
  }
}
