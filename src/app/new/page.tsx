"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/brand/logo";
import { Embers } from "@/components/landing/embers";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function NewTeamPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    const clean = name.trim();
    if (clean.length < 2) {
      toast.error("Give your team a name first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean }),
      });
      const data = (await res.json()) as { slug?: string; error?: string };
      if (!res.ok || !data.slug) {
        throw new Error(data.error ?? "Could not create the team.");
      }
      router.push(`/t/${data.slug}?pass=1`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <>
      <Embers />
      <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6">
        <div className="py-6">
          <Logo />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center pb-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="w-full max-w-md text-center"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ember">
              Start a relay
            </p>
            <h1 className="font-display mt-3 text-4xl leading-tight sm:text-5xl">
              Name your <em className="text-ember-gradient">team</em>.
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-muted-foreground">
              You&apos;ll get a private link to share. Anyone with it can pass or
              catch the baton — no accounts, ever.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                create();
              }}
              className="mt-8 flex flex-col gap-3"
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Payments squad"
                className="h-12 text-center text-base"
                maxLength={60}
                autoFocus
                disabled={loading}
              />
              <Button
                type="submit"
                size="lg"
                className="group"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Creating…
                  </>
                ) : (
                  <>
                    Create relay
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70">
              No signup · works in the browser · free
            </p>
          </motion.div>
        </div>
      </main>
    </>
  );
}
