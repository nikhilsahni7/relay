import { BatonMark } from "@/components/brand/logo";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <BatonMark className="size-8 animate-pulse" />
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
        Passing the baton…
      </p>
    </div>
  );
}
