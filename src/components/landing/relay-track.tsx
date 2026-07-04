"use client";

import { motion, useReducedMotion } from "motion/react";

const RUNNERS = [
  { name: "Ana", place: "Lisbon", time: "18:00 WET", left: "8%" },
  { name: "Dev", place: "Bangalore", time: "09:00 IST", left: "46%" },
  { name: "Sam", place: "New York", time: "08:00 EST", left: "84%" },
];

// Keyframe positions the traveling baton visits, and the timing map. Kept in
// one place so the baton, its streak, and the arrival pulses stay in sync.
const STOPS = ["8%", "46%", "46%", "84%", "84%", "8%"];
const TIMES = [0, 0.32, 0.45, 0.77, 0.9, 1];
const DURATION = 9;

/**
 * The signature visual: a relay track where one baton travels across three
 * timezones, leaving an ember streak behind it. The metaphor IS the product —
 * context passed hand to hand while half the team is asleep.
 */
export function RelayTrack() {
  const reduce = useReducedMotion();

  return (
    <div className="relative h-40 w-full select-none">
      {/* lanes */}
      <div className="lane absolute top-[42%] w-full" aria-hidden />
      <div className="lane absolute top-[64%] w-full opacity-40" aria-hidden />

      {!reduce && (
        <>
          {/* comet streak trailing the baton */}
          <motion.div
            aria-hidden
            className="ember-streak absolute top-[42%] z-10 h-2 -translate-y-1/2 rounded-full"
            initial={{ left: STOPS[0], width: 0 }}
            animate={{
              left: STOPS,
              width: [0, 64, 0, 64, 0, 0],
              opacity: [0, 0.9, 0, 0.9, 0, 0],
            }}
            transition={{
              duration: DURATION,
              times: TIMES,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* the traveling baton */}
          <motion.div
            aria-hidden
            className="absolute top-[42%] z-20 -translate-y-1/2"
            initial={{ left: STOPS[0] }}
            animate={{ left: STOPS }}
            transition={{
              duration: DURATION,
              times: TIMES,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div className="h-3 w-10 -rotate-12 rounded-full bg-gradient-to-r from-ember-soft to-ember-deep shadow-[0_0_24px_-2px_var(--ember)]" />
          </motion.div>
        </>
      )}

      {/* runners */}
      {RUNNERS.map((runner, i) => (
        <div
          key={runner.name}
          className="absolute top-[42%] -translate-x-1/2 -translate-y-1/2"
          style={{ left: runner.left }}
        >
          <div className="flex flex-col items-center gap-2.5">
            <span className="relative flex size-11 items-center justify-center rounded-full border border-border bg-secondary text-sm font-medium">
              {/* arrival pulse: rings out when the baton reaches this runner */}
              {!reduce && (
                <motion.span
                  className="absolute inset-0 rounded-full border border-ember"
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: [0, 0.7, 0], scale: [1, 1.6, 1.8] }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    repeatDelay: DURATION - 1.1,
                    delay: (TIMES[i === 0 ? 5 : i * 2] ?? 0) * DURATION,
                    ease: "easeOut",
                  }}
                />
              )}
              {runner.name[0]}
            </span>
            <div className="text-center">
              <p className="text-xs font-medium text-foreground/90">
                {runner.name} · {runner.place}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {runner.time}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
