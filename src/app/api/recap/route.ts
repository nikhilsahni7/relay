import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase";
import { recap, tts } from "@/lib/ai";
import type { Baton, Team } from "@/lib/types";

const AUDIO_BUCKET = "batons";

/**
 * POST { team_slug, since? } -> a spoken catch-up for everything since `since`.
 * Full recaps (no `since`) are cached in `recaps` so replays cost zero API
 * calls. Returns { text, audio_url|null, covers_until, count }. A null
 * audio_url tells the client to speak the text with speechSynthesis.
 */
export async function POST(request: Request) {
  let teamSlug = "";
  let since: string | null = null;
  try {
    const body = (await request.json()) as { team_slug?: string; since?: string };
    teamSlug = (body.team_slug ?? "").trim();
    since = body.since?.trim() || null;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!teamSlug) {
    return Response.json({ error: "Missing team." }, { status: 400 });
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

  // Gather batons in the window (chronological, so the recap reads in order).
  let query = supabase
    .from("batons")
    .select("author_name, author_role, card, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });
  if (since) query = query.gt("created_at", since);

  const { data: batonsData } = await query;
  const batons = (batonsData as Pick<
    Baton,
    "author_name" | "author_role" | "card" | "created_at"
  >[]) ?? [];

  if (batons.length === 0) {
    return Response.json({
      text: "You're all caught up — nothing new since your last visit.",
      audio_url: null,
      covers_until: since,
      count: 0,
    });
  }

  const coversUntil = batons[batons.length - 1].created_at;
  const isFullRecap = !since;

  // Cache hit (full recaps only): serve the pre-generated catch-up instantly.
  if (isFullRecap) {
    const { data: cached } = await supabase
      .from("recaps")
      .select("text, audio_url")
      .eq("team_id", teamId)
      .eq("covers_until", coversUntil)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached) {
      return Response.json({
        text: (cached as { text: string }).text,
        audio_url: (cached as { audio_url: string | null }).audio_url,
        covers_until: coversUntil,
        count: batons.length,
      });
    }
  }

  try {
    const text = await recap(batons);

    // Best-effort TTS; null -> client falls back to speechSynthesis.
    let audioUrl: string | null = null;
    const speech = await tts(text);
    if (speech) {
      const path = `recaps/${randomUUID()}.${speech.ext}`;
      const { error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(path, speech.data, { contentType: speech.contentType });
      if (!uploadError) {
        audioUrl = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path)
          .data.publicUrl;
      }
    }

    if (isFullRecap) {
      await supabase.from("recaps").insert({
        team_id: teamId,
        covers_until: coversUntil,
        text,
        audio_url: audioUrl,
      });
    }

    return Response.json({
      text,
      audio_url: audioUrl,
      covers_until: coversUntil,
      count: batons.length,
    });
  } catch (err) {
    console.error("recap failed", err);
    return Response.json(
      { error: "Couldn't put the catch-up together. Try again." },
      { status: 502 }
    );
  }
}
