import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabase";
import type { Baton, Team } from "@/lib/types";
import { TrackClient } from "./track-client";

export const dynamic = "force-dynamic";

async function getTeam(slug: string): Promise<Team | null> {
  const { data } = await supabaseAdmin()
    .from("teams")
    .select("*")
    .eq("slug", slug)
    .single();
  return (data as Team) ?? null;
}

async function getBatons(teamId: string): Promise<Baton[]> {
  const { data } = await supabaseAdmin()
    .from("batons")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  return (data as Baton[]) ?? [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const team = await getTeam(slug);
  if (!team) return { title: "Dropped baton — Relay" };
  return {
    title: `${team.name} — Relay`,
    description: `The relay track for ${team.name}. Pass the baton or catch up.`,
  };
}

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pass?: string }>;
}) {
  const { slug } = await params;
  const { pass } = await searchParams;

  const team = await getTeam(slug);
  if (!team) notFound();

  const batons = await getBatons(team.id);

  return (
    <TrackClient
      team={{ slug: team.slug, name: team.name }}
      batons={batons}
      initialPassOpen={pass === "1"}
    />
  );
}
