"use client";

import { motion, useReducedMotion } from "motion/react";
import { Mic, Type, ExternalLink } from "lucide-react";

import type { BatonCard as BatonCardData } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { ITEM_STYLES } from "./item-styles";

const EASE = [0.22, 1, 0.36, 1] as const;

function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function formatDuration(secs?: number | null): string | null {
  if (!secs || secs <= 0) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface BatonCardProps {
  card: BatonCardData;
  author: string;
  createdAt: string;
  audioUrl?: string | null;
  durationSeconds?: number | null;
  batonNumber?: number;
  /** Play the blur-to-sharp assemble animation (the "pass" moment). */
  animate?: boolean;
  className?: string;
}

/**
 * Canonical Baton Card renderer for real data: header (author + time),
 * summary, then item rows that assemble one-by-one when `animate` is set.
 */
export function BatonCard({
  card,
  author,
  createdAt,
  audioUrl,
  durationSeconds,
  batonNumber,
  animate = false,
  className,
}: BatonCardProps) {
  const reduce = useReducedMotion();
  const play = animate && !reduce;
  const duration = formatDuration(durationSeconds);

  const reveal = (i: number) =>
    play
      ? {
          initial: { opacity: 0, x: -14, filter: "blur(4px)" },
          animate: { opacity: 1, x: 0, filter: "blur(0px)" },
          transition: { delay: 0.5 + i * 0.4, duration: 0.5, ease: EASE },
        }
      : { initial: false as const };

  return (
    <motion.div
      initial={play ? { opacity: 0, y: 16 } : false}
      animate={play ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, ease: EASE }}
      className={cn(
        "w-full max-w-md rounded-2xl border border-border bg-card/90 p-6 backdrop-blur",
        className
      )}
    >
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-ember-soft to-ember-deep text-sm font-medium text-primary-foreground">
            {initials(author)}
          </span>
          <div>
            <p className="text-sm font-medium">{author}</p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {timeAgo(createdAt)}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          {audioUrl ? (
            <Mic className="size-3.5" />
          ) : (
            <Type className="size-3.5" />
          )}
          {duration ?? (audioUrl ? "voice" : "typed")}
        </span>
      </div>

      {/* audio playback (if present) */}
      {audioUrl ? (
        <audio
          controls
          preload="none"
          src={audioUrl}
          className="mt-4 h-9 w-full"
        />
      ) : null}

      {/* summary */}
      {card.summary ? (
        <motion.p
          {...reveal(0)}
          className="mt-4 border-l-2 border-ember/40 pl-3 text-sm italic leading-snug text-foreground/70"
        >
          {card.summary}
        </motion.p>
      ) : null}

      {/* items */}
      {card.items.length > 0 ? (
        <ul className="mt-4 space-y-3.5">
          {card.items.map((item, i) => {
            const style = ITEM_STYLES[item.kind];
            return (
              <motion.li
                key={`${item.kind}-${i}`}
                {...reveal(i + 1)}
                className="flex items-start gap-3"
              >
                <span
                  className="mt-1 size-2 shrink-0 rounded-full"
                  style={{
                    background: style.color,
                    boxShadow: `0 0 10px -1px ${style.color}`,
                  }}
                />
                <div>
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: style.color }}
                  >
                    {style.label}
                  </span>
                  <p className="text-sm leading-snug text-foreground/90">
                    {item.text}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      ) : null}

      {/* links */}
      {card.links.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
          {card.links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs text-foreground/80 transition-colors hover:border-ember/40 hover:text-ember-soft"
            >
              <ExternalLink className="size-3" />
              {link.label}
            </a>
          ))}
        </div>
      ) : null}

      {/* footer */}
      {batonNumber != null ? (
        <div className="mt-5 border-t border-border pt-4">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Baton №{batonNumber}
          </span>
        </div>
      ) : null}
    </motion.div>
  );
}
