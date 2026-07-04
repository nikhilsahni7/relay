import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6">
      <div className="py-6">
        <Logo />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center pb-24 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ember">
          404 · dropped baton
        </p>

        {/* a baton lying still on the lane — the metaphor for a lost handoff */}
        <div className="relative my-10 h-24 w-full max-w-md">
          <div className="lane absolute top-1/2 w-full" aria-hidden />
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-3 w-14 -translate-x-1/2 translate-y-2 rotate-[8deg] rounded-full bg-gradient-to-r from-ember-soft to-ember-deep opacity-90 shadow-[0_0_28px_-4px_var(--ember)]"
          />
        </div>

        <h1 className="font-display text-5xl leading-tight sm:text-6xl">
          This baton was <em className="text-ember-gradient">dropped</em>.
        </h1>
        <p className="mt-5 max-w-md text-muted-foreground">
          The page you&apos;re looking for isn&apos;t on the track. It may have
          been passed somewhere else — or never existed.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" /> Back to the start
            </Link>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <Link href="/demo">Catch the demo</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
