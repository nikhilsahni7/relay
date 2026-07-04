"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";

type Mote = {
  left: number;
  size: number;
  dur: number;
  delay: number;
  drift: number;
  opacity: number;
};

/**
 * A sparse field of ember motes rising slowly up the page — the atmosphere
 * that makes the "night race" world feel lit by a fire. Deliberately faint
 * and slow; it should register as warmth, not motion. Honors reduced-motion.
 */
export function Embers({ count = 16 }: { count?: number }) {
  const reduce = useReducedMotion();
  // Generate the field only after mount. Math.random() would otherwise differ
  // between the server and client renders and cause a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const motes = useMemo<Mote[]>(() => {
    // Deterministic-ish scatter generated once on mount.
    return Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      size: 1.5 + Math.random() * 2.5,
      dur: 12 + Math.random() * 10,
      // Negative delay so the field is already populated on first paint.
      delay: -Math.random() * 22,
      drift: (Math.random() - 0.5) * 90,
      opacity: 0.25 + Math.random() * 0.35,
    }));
  }, [count]);

  if (reduce || !mounted) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: -1 }}
    >
      {motes.map((m, i) => (
        <span
          key={i}
          className="ember-mote"
          style={
            {
              left: `${m.left}%`,
              width: `${m.size}px`,
              height: `${m.size}px`,
              "--dur": `${m.dur}s`,
              "--delay": `${m.delay}s`,
              "--drift": `${m.drift}px`,
              "--ember-opacity": m.opacity,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
