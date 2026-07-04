import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase";
import { structure, transcribe } from "@/lib/ai";
import type { Baton, Team } from "@/lib/types";

const MAX_SECONDS = 120;
const AUDIO_BUCKET = "batons";

/**
 * POST multipart: (`audio` File OR `text`) + `team_slug` + `author_name`
 * [+ `duration_seconds`]. Runs the pipeline (upload + transcribe + structure)
 * and inserts one baton. Returns { baton }.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const teamSlug = String(form.get("team_slug") ?? "").trim();
  const authorName = String(form.get("author_name") ?? "").trim();
  const authorRole = String(form.get("author_role") ?? "").trim().slice(0, 40);
  const text = String(form.get("text") ?? "").trim();
  const audio = form.get("audio");
  const durationRaw = Number(form.get("duration_seconds") ?? 0);
  const duration = Number.isFinite(durationRaw) ? Math.round(durationRaw) : 0;

  const hasAudio = audio instanceof Blob && audio.size > 0;

  if (!teamSlug) {
    return Response.json({ error: "Missing team." }, { status: 400 });
  }
  if (authorName.length < 2) {
    return Response.json(
      { error: "Add your name so teammates know who passed the baton." },
      { status: 400 }
    );
  }
  if (!hasAudio && !text) {
    return Response.json(
      { error: "Record a voice note or type your handoff first." },
      { status: 400 }
    );
  }
  if (duration > MAX_SECONDS) {
    return Response.json(
      { error: "Keep it under two minutes — that's the whole point." },
      { status: 413 }
    );
  }

  const supabase = supabaseAdmin();

  // Resolve the team.
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, slug")
    .eq("slug", teamSlug)
    .single();

  if (teamError || !team) {
    return Response.json({ error: "That team doesn't exist." }, { status: 404 });
  }
  const teamId = (team as Pick<Team, "id" | "slug">).id;

  try {
    // 1. Upload audio (if any) to the public bucket.
    let audioUrl: string | null = null;
    if (hasAudio) {
      const blob = audio as Blob;
      const path = `${teamId}/${randomUUID()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(path, blob, {
          contentType: blob.type || "audio/webm",
          upsert: false,
        });
      if (uploadError) {
        console.error("audio upload failed", uploadError);
      } else {
        audioUrl = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path)
          .data.publicUrl;
      }
    }

    // 2. Transcribe (voice) or use typed text.
    const transcript = hasAudio ? await transcribe(audio as Blob) : text;

    if (!transcript.trim()) {
      return Response.json(
        { error: "Couldn't hear anything in that recording. Try again?" },
        { status: 422 }
      );
    }

    // 3. Structure into a Baton Card.
    const card = await structure(transcript);

    // 4. Persist.
    const { data: baton, error: insertError } = await supabase
      .from("batons")
      .insert({
        team_id: teamId,
        author_name: authorName,
        author_role: authorRole || null,
        audio_url: audioUrl,
        transcript,
        card,
        duration_seconds: duration || null,
      })
      .select()
      .single();

    if (insertError || !baton) {
      console.error("baton insert failed", insertError);
      return Response.json(
        { error: "Saved the audio but couldn't file the baton. Try again." },
        { status: 500 }
      );
    }

    return Response.json({ baton: baton as Baton }, { status: 201 });
  } catch (err) {
    console.error("baton pipeline failed", err);
    return Response.json(
      { error: "The AI hand-off stumbled. Give it another go." },
      { status: 502 }
    );
  }
}
