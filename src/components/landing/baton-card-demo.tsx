"use client";

import { motion, useReducedMotion } from "motion/react";
import { Mic, ArrowRight } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

const ITEMS = [
  {
    kind: "done",
    label: "Done",
    color: "var(--done)",
    text: "Shipped the auth flow to staging",
  },
  {
    kind: "doing",
    label: "In progress",
    color: "var(--doing)",
    text: "Billing page — components built, wiring left",
  },
  {
    kind: "blocked",
    label: "Blocked",
    color: "var(--blocked)",
    text: "Deploy is waiting on the Groq API key",
  },
  {
    kind: "next",
    label: "Next",
    color: "var(--next)",
    text: "Wire billing, then seed the demo team",
  },
] as const;

/** Looping waveform of animated bars — the "listening" texture. */
function Waveform({ animate }: { animate: boolean }) {
  const bars = [
    5, 9, 14, 8, 18, 12, 22, 10, 16, 24, 11, 19, 7, 15, 21, 9, 17, 12, 23, 8,
    14, 20, 10, 6,
  ];
  return (
    <div className="flex h-8 items-center gap-[3px]" aria-hidden>
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-ember/70"
          initial={{ height: animate ? 4 : h }}
          animate={animate ? { height: [4, h, 4] } : { height: h }}
          transition={
            animate
              ? {
                  duration: 1.6,
                  repeat: Infinity,
                  delay: i * 0.07,
                  ease: "easeInOut",
                }
              : { duration: 0 }
          }
        />
      ))}
    </div>
  );
}

/**
 * The hero's mock Baton Card: assembles itself on load, exactly like the
 * real pass flow will. This is the product promise rendered as animation.
 */
export function BatonCardDemo() {
  const reduce = useReducedMotion();

  // With reduced motion, present the finished card immediately.
  const reveal = (delay: number) =>
    reduce
      ? { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0 } }
      : {
          initial: { opacity: 0, x: -14, filter: "blur(4px)" },
          animate: { opacity: 1, x: 0, filter: "blur(0px)" },
          transition: { delay, duration: 0.5, ease: EASE },
        };

  return (
    <div className="relative">
      {/* ember halo behind the card — the one glow allowed in the hero */}
      <div
        aria-hidden
        className="absolute -inset-12 -z-10 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--ember) 45%, transparent), transparent 70%)",
        }}
      />

      <motion.div
        initial={
          reduce
            ? { opacity: 1, rotate: -1.2 }
            : { opacity: 0, y: 24, rotate: -1.2 }
        }
        animate={{ opacity: 1, y: 0, rotate: -1.2 }}
        transition={{ duration: reduce ? 0 : 0.7, ease: EASE }}
        className="w-full max-w-md rounded-2xl border border-border bg-card/90 p-6 backdrop-blur glow-ember"
      >
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-ember-soft to-ember-deep text-primary-foreground">
              <Mic className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Nikhil</p>
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Sat · 11:42 pm
              </p>
            </div>
          </div>
          <span className="font-mono text-xs text-muted-foreground">0:47</span>
        </div>

        <div className="my-5">
          <Waveform animate={!reduce} />
        </div>

        {/* the LLM-written summary line, revealed before the structured items */}
        <motion.p
          {...reveal(0.7)}
          className="mb-4 border-l-2 border-ember/40 pl-3 text-sm italic leading-snug text-foreground/70"
        >
          Auth is live; billing is close but the deploy is blocked on a key.
        </motion.p>

        {/* items assemble one by one */}
        <ul className="space-y-3.5">
          {ITEMS.map((item, i) => (
            <motion.li
              key={item.kind}
              {...reveal(1.1 + i * 0.4)}
              className="flex items-start gap-3"
            >
              <span
                className="mt-1 size-2 shrink-0 rounded-full"
                style={{
                  background: item.color,
                  boxShadow: `0 0 10px -1px ${item.color}`,
                }}
              />
              <div>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: item.color }}
                >
                  {item.label}
                </span>
                <p className="text-sm leading-snug text-foreground/90">
                  {item.text}
                </p>
              </div>
            </motion.li>
          ))}
        </ul>

        {/* pass affordance */}
        <motion.div
          initial={reduce ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 3.0, duration: 0.6 }}
          className="mt-6 flex items-center justify-between border-t border-border pt-4"
        >
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Baton №14
          </span>
          <span className="group inline-flex items-center gap-1.5 text-sm font-medium text-ember">
            Pass the baton
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
