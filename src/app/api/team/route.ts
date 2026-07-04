import { supabaseAdmin } from "@/lib/supabase";
import { shortId, slugify } from "@/lib/utils";
import type { Team } from "@/lib/types";

/** POST { name } -> creates a team with a unique slug -> { slug }. No auth. */
export async function POST(request: Request) {
  let name = "";
  try {
    const body = (await request.json()) as { name?: string };
    name = (body.name ?? "").trim();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!name || name.length < 2) {
    return Response.json(
      { error: "Give your team a name (at least 2 characters)." },
      { status: 400 }
    );
  }

  const base = slugify(name) || "team";
  const supabase = supabaseAdmin();

  // Try a few times to land a unique slug; collisions are astronomically rare.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = `${base}-${shortId()}`;
    const { data, error } = await supabase
      .from("teams")
      .insert({ slug, name })
      .select()
      .single();

    if (!error && data) {
      return Response.json({ slug: (data as Team).slug }, { status: 201 });
    }
    // 23505 = unique_violation: retry with a fresh suffix.
    if (error && error.code !== "23505") {
      console.error("team insert failed", error);
      return Response.json(
        { error: "Could not create the team. Try again." },
        { status: 500 }
      );
    }
  }

  return Response.json(
    { error: "Could not create the team. Try again." },
    { status: 500 }
  );
}
