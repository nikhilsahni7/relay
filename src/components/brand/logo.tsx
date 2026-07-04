import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The Relay baton mark — a small diagonal ember baton, the vector twin of the
 * favicon/OG baton. Rendered as SVG so it stays crisp at any size and matches
 * the ember token exactly. Use inline next to the wordmark, never the raster
 * app-icon (that one is for home screens).
 */
export function BatonMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("size-5", className)}
    >
      <defs>
        <linearGradient id="baton-grad" x1="4" y1="20" x2="20" y2="4">
          <stop offset="0" stopColor="var(--ember-deep)" />
          <stop offset="1" stopColor="var(--ember-soft)" />
        </linearGradient>
        <filter id="baton-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <line
        x1="6.5"
        y1="17.5"
        x2="17.5"
        y2="6.5"
        stroke="url(#baton-grad)"
        strokeWidth="4"
        strokeLinecap="round"
        filter="url(#baton-glow)"
      />
    </svg>
  );
}

/**
 * The full brand lockup: baton mark + "Relay." wordmark. Links home by
 * default. Reuse this in every page header so the brand stays consistent.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Relay — home"
      className={cn(
        "group inline-flex items-center gap-2 transition-opacity hover:opacity-80",
        className
      )}
    >
      <BatonMark className="size-5 transition-transform duration-300 group-hover:rotate-[8deg]" />
      <span className="font-display text-2xl italic tracking-tight">
        Relay<span className="text-ember">.</span>
      </span>
    </Link>
  );
}
