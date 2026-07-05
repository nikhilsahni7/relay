"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flag, Maximize2, Minus, Plus, X } from "lucide-react";

import type { Baton, BatonItemKind } from "@/lib/types";
import type { OpenItem } from "@/lib/track-insights";
import { BatonCard } from "@/components/baton/baton-card";
import { ITEM_STYLES } from "@/components/baton/item-styles";
import { cn, timeAgo } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/* Layout constants */
const NODE_W = 210;
const NODE_H = 116;
const GAP_X = 300; // horizontal serpentine spacing (desktop)
const GAP_Y = 190; // vertical spacing (mobile)
const WAVE = 90; // vertical amplitude of the desktop wave
const PAD = 140;
const MIN_SCALE = 0.45;
const MAX_SCALE = 1.6;

interface NodePos {
  x: number; // node center
  y: number;
}

/**
 * The Track as a canvas: batons are compact nodes connected along the
 * timeline (oldest -> newest), pannable and zoomable with mouse or touch.
 * Tapping a node expands the full Baton Card.
 */
export function TrackCanvas({
  batons,
  openItems,
}: {
  batons: Baton[]; // newest first, as loaded by the page
  openItems: OpenItem[];
}) {
  const chrono = useMemo(() => [...batons].reverse(), [batons]);
  const openByBaton = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of openItems) m.set(o.batonId, (m.get(o.batonId) ?? 0) + 1);
    return m;
  }, [openItems]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportW, setViewportW] = useState(0);
  const [expanded, setExpanded] = useState<Baton | null>(null);
  // Id of a baton that just landed (passed while this canvas was mounted) —
  // drives the short ember-streak + glow arrival animation.
  const [arrivedId, setArrivedId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setViewportW(entry.contentRect.width)
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vertical = viewportW > 0 && viewportW < 640;

  /* --- layout ------------------------------------------------------------ */
  const { positions, worldW, worldH } = useMemo(() => {
    const n = chrono.length;
    if (vertical) {
      // Narrow screens: vertical serpentine, nodes weave left/right so the
      // connectors stay visible without horizontal panning.
      const cx = Math.max(viewportW, NODE_W + 48) / 2;
      const sway = Math.min(64, Math.max(24, (viewportW - NODE_W) / 2 - 12));
      const positions: NodePos[] = chrono.map((_, i) => ({
        x: cx + (i % 2 === 0 ? -sway : sway),
        y: PAD / 2 + NODE_H / 2 + i * GAP_Y,
      }));
      return {
        positions,
        worldW: Math.max(viewportW, NODE_W + 48),
        worldH: PAD + NODE_H + Math.max(0, n - 1) * GAP_Y,
      };
    }
    // Wide screens: horizontal relay lane with a gentle wave.
    const midY = PAD / 2 + WAVE + NODE_H / 2;
    const positions: NodePos[] = chrono.map((_, i) => ({
      x: PAD / 2 + NODE_W / 2 + i * GAP_X,
      y: midY + (i % 2 === 0 ? -WAVE : WAVE) * (n > 1 ? 1 : 0),
    }));
    return {
      positions,
      worldW: PAD + NODE_W + Math.max(0, n - 1) * GAP_X,
      worldH: PAD + NODE_H + WAVE * 2,
    };
  }, [chrono, vertical, viewportW]);

  /* --- pan & zoom ---------------------------------------------------------
     The view (pan offset + scale) is driven IMPERATIVELY: gestures mutate a
     ref and write `transform` straight onto the world node, so dragging and
     zooming never trigger a React re-render (that was the source of the lag).
     React state only tracks the zoom % shown on the control chip. */
  const worldRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  const [scalePct, setScalePct] = useState(100);

  const clampView = useCallback(
    (v: { x: number; y: number; scale: number }) => {
      const el = viewportRef.current;
      if (!el) return v;
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      const cw = worldW * v.scale;
      const ch = worldH * v.scale;
      const slack = 120;
      const minX = Math.min(slack, vw - cw - slack);
      const maxX = Math.max(vw - cw - slack, slack);
      const minY = Math.min(slack, vh - ch - slack);
      const maxY = Math.max(vh - ch - slack, slack);
      return {
        scale: v.scale,
        x: Math.min(maxX, Math.max(minX, v.x)),
        y: Math.min(maxY, Math.max(minY, v.y)),
      };
    },
    [worldW, worldH]
  );

  /** Write the current view to the DOM and sync the zoom label. */
  const applyView = useCallback(() => {
    const w = worldRef.current;
    const v = viewRef.current;
    if (w) {
      w.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.scale})`;
    }
    setScalePct((prev) => {
      const next = Math.round(v.scale * 100);
      return prev === next ? prev : next;
    });
  }, []);

  const setView = useCallback(
    (next: { x: number; y: number; scale: number }) => {
      viewRef.current = clampView(next);
      applyView();
    },
    [clampView, applyView]
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const v = viewRef.current;
      setView({ scale: v.scale, x: v.x + dx, y: v.y + dy });
    },
    [setView]
  );

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const v = viewRef.current;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const k = scale / v.scale;
      setView({ scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
    },
    [setView]
  );

  const focusLatest = useCallback(
    (scale = 1) => {
      const el = viewportRef.current;
      if (!el || positions.length === 0) return;
      const last = positions[positions.length - 1];
      setView({
        scale,
        x: el.clientWidth / 2 - last.x * scale,
        y: el.clientHeight / 2 - last.y * scale,
      });
    },
    [positions, setView]
  );

  const fitAll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const scale = Math.min(
      MAX_SCALE,
      Math.max(
        MIN_SCALE,
        Math.min(el.clientWidth / worldW, el.clientHeight / worldH) * 0.94
      )
    );
    setView({
      scale,
      x: (el.clientWidth - worldW * scale) / 2,
      y: (el.clientHeight - worldH * scale) / 2,
    });
  }, [worldW, worldH, setView]);

  const zoomCentered = useCallback(
    (factor: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
    },
    [zoomAt]
  );

  // Start focused on the newest baton (that's what a returning teammate wants).
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || viewportW === 0 || positions.length === 0) return;
    didInit.current = true;
    focusLatest(vertical ? 0.9 : 1);
  }, [viewportW, positions, vertical, focusLatest]);

  // A baton just landed (passed while this canvas is mounted): glide the
  // camera to it and play a short arrival animation — ember streak along the
  // last connector, then the node pops in. ~1.2s total, then cleans up.
  const prevLatest = useRef<string | null>(null);
  useEffect(() => {
    const latest = chrono.length ? chrono[chrono.length - 1].id : null;
    const isNew =
      prevLatest.current !== null && latest !== null && latest !== prevLatest.current;
    prevLatest.current = latest;
    if (!isNew) return;

    setArrivedId(latest);
    const w = worldRef.current;
    if (w) {
      w.style.transition = "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)";
    }
    focusLatest(1);
    const clearTransition = setTimeout(() => {
      if (worldRef.current) worldRef.current.style.transition = "";
    }, 650);
    const clearArrival = setTimeout(() => setArrivedId(null), 1500);
    return () => {
      clearTimeout(clearTransition);
      clearTimeout(clearArrival);
    };
  }, [chrono, focusLatest]);

  // Re-fit when the layout flips between orientations.
  const prevVertical = useRef(vertical);
  useEffect(() => {
    if (prevVertical.current !== vertical && didInit.current) {
      prevVertical.current = vertical;
      focusLatest(vertical ? 0.9 : 1);
    }
  }, [vertical, focusLatest]);

  // Native wheel listener (passive:false) so we can preventDefault the page
  // scroll and turn the wheel/trackpad into zoom — pinch/ctrl always zooms,
  // a plain vertical wheel zooms toward the cursor, horizontal scroll pans.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!e.ctrlKey && !e.metaKey && horizontal) {
        panBy(-e.deltaX, -e.deltaY);
      } else {
        // Exponential factor → smooth, framerate-independent zoom.
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016));
      }
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, [panBy, zoomAt]);

  // Pointer gestures: one pointer pans, two pinch-zoom. Works for touch too.
  // NOTE: we must NOT capture the pointer on pointerdown — capturing retargets
  // events to the viewport and swallows clicks on the baton nodes. Capture
  // lazily, only once the gesture is clearly a drag.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef(0);
  const dragMoved = useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragMoved.current = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist.current > 0) {
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / pinchDist.current);
      }
      pinchDist.current = dist;
      dragMoved.current += 10;
      return;
    }

    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    dragMoved.current += Math.abs(dx) + Math.abs(dy);
    if (
      dragMoved.current > 6 &&
      !(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)
    ) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    panBy(dx, dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinchDist.current = 0;
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  /** Nodes are buttons; suppress the click if the gesture was really a pan. */
  const openBaton = useCallback((baton: Baton) => {
    if (dragMoved.current <= 6) setExpanded(baton);
  }, []);

  /* --- connectors --------------------------------------------------------- */
  const paths = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < positions.length - 1; i++) {
      const a = positions[i];
      const b = positions[i + 1];
      if (vertical) {
        const my = (a.y + b.y) / 2;
        out.push(`M ${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`);
      } else {
        const mx = (a.x + b.x) / 2;
        out.push(`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`);
      }
    }
    return out;
  }, [positions, vertical]);

  if (chrono.length === 0) return null;

  return (
    <div className="relative mt-6">
      {/* viewport */}
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative h-[520px] w-full cursor-grab touch-none select-none overflow-hidden rounded-2xl border border-border bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] bg-size-[26px_26px] active:cursor-grabbing sm:h-[560px]"
        role="application"
        aria-label="Baton timeline canvas — drag to pan, scroll or pinch to zoom"
      >
        {/* world — transform is applied imperatively (see applyView) so pan/zoom
            never re-render React; will-change keeps it on the compositor. */}
        <div
          ref={worldRef}
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{ width: worldW, height: worldH }}
        >
          {/* connectors */}
          <svg
            className="absolute inset-0"
            width={worldW}
            height={worldH}
            aria-hidden
          >
            <defs>
              <linearGradient id="lane-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--border)" />
                <stop offset="100%" stopColor="var(--ember)" stopOpacity="0.6" />
              </linearGradient>
            </defs>
            {paths.map((d, i) => {
              const isLast = i === paths.length - 1;
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={isLast ? "url(#lane-grad)" : "var(--border)"}
                  strokeWidth={isLast ? 2 : 1.5}
                  strokeDasharray="7 9"
                  strokeLinecap="round"
                />
              );
            })}

            {/* arrival streak: an ember draws the last connector, then fades */}
            {arrivedId && paths.length > 0 ? (
              <g pointerEvents="none">
                <motion.path
                  d={paths[paths.length - 1]}
                  fill="none"
                  stroke="var(--ember)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0.9 }}
                  animate={{ pathLength: 1, opacity: [0.9, 0.9, 0] }}
                  transition={{
                    pathLength: { duration: 0.8, ease: EASE },
                    opacity: { duration: 1.3, times: [0, 0.65, 1] },
                  }}
                />
                <circle
                  r={4.5}
                  fill="var(--ember)"
                  style={{ filter: "drop-shadow(0 0 10px var(--ember))" }}
                >
                  <animateMotion
                    dur="0.8s"
                    fill="freeze"
                    calcMode="spline"
                    keyPoints="0;1"
                    keyTimes="0;1"
                    keySplines="0.22 1 0.36 1"
                    path={paths[paths.length - 1]}
                  />
                  <animate
                    attributeName="opacity"
                    values="1;1;0"
                    keyTimes="0;0.7;1"
                    dur="1.2s"
                    fill="freeze"
                  />
                </circle>
              </g>
            ) : null}
          </svg>

          {/* start flag */}
          <div
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
            style={{
              left: positions[0].x + (vertical ? 0 : -NODE_W / 2 - 46),
              top: positions[0].y + (vertical ? -NODE_H / 2 - 28 : 0),
            }}
          >
            <Flag className="size-3 text-ember" /> start
          </div>

          {/* nodes — memoized so pan/zoom re-renders skip them entirely */}
          {chrono.map((baton, i) => (
            <CanvasNode
              key={baton.id}
              baton={baton}
              index={i}
              pos={positions[i]}
              isLatest={i === chrono.length - 1}
              justArrived={baton.id === arrivedId}
              openCount={openByBaton.get(baton.id) ?? 0}
              onOpen={openBaton}
            />
          ))}
        </div>

        {/* controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border border-border bg-card/80 p-1 backdrop-blur">
          <CanvasButton label="Zoom out" onClick={() => zoomCentered(0.8)}>
            <Minus className="size-3.5" />
          </CanvasButton>
          <span className="min-w-10 text-center font-mono text-[10px] tabular-nums text-muted-foreground">
            {scalePct}%
          </span>
          <CanvasButton label="Zoom in" onClick={() => zoomCentered(1.25)}>
            <Plus className="size-3.5" />
          </CanvasButton>
          <CanvasButton label="Fit all batons" onClick={fitAll}>
            <Maximize2 className="size-3.5" />
          </CanvasButton>
        </div>

        <p className="pointer-events-none absolute bottom-3 left-3 hidden font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 sm:block">
          drag to pan · scroll to zoom · tap a baton to expand
        </p>
      </div>

      {/* expanded card */}
      <AnimatePresence>
        {expanded ? (
          <ExpandedBaton
            baton={expanded}
            batonNumber={chrono.findIndex((b) => b.id === expanded.id) + 1}
            onClose={() => setExpanded(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Compact node
-------------------------------------------------------------------------- */

const CHIP_KINDS: BatonItemKind[] = ["done", "doing", "blocked", "next"];

const CanvasNode = memo(function CanvasNode({
  baton,
  index,
  pos,
  isLatest,
  justArrived = false,
  openCount,
  onOpen,
}: {
  baton: Baton;
  index: number;
  pos: NodePos;
  isLatest: boolean;
  justArrived?: boolean;
  openCount: number;
  onOpen: (baton: Baton) => void;
}) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const item of baton.card?.items ?? []) {
      c[item.kind] = (c[item.kind] ?? 0) + 1;
    }
    return c;
  }, [baton]);

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(baton)}
      initial={
        justArrived ? { opacity: 0, scale: 0.55 } : { opacity: 0, scale: 0.9 }
      }
      animate={{ opacity: 1, scale: 1 }}
      transition={
        justArrived
          ? // Land after the ember streak reaches the node; a soft spring so
            // the settle reads as a catch, not a snap.
            { type: "spring", stiffness: 240, damping: 20, delay: 0.55 }
          : { duration: 0.4, ease: EASE, delay: Math.min(index * 0.06, 0.5) }
      }
      className={cn(
        "group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-card/95 p-3 text-left backdrop-blur transition-colors",
        "cursor-pointer hover:border-ember/50",
        isLatest
          ? "border-ember/60 shadow-[0_0_40px_-10px_var(--ember)]"
          : "border-border"
      )}
      style={{ left: pos.x, top: pos.y, width: NODE_W, minHeight: NODE_H }}
      aria-label={`Baton ${index + 1} from ${baton.author_name} — tap to expand`}
    >
      {/* header */}
      <span className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-ember-soft to-ember-deep text-[10px] font-medium text-primary-foreground">
          {baton.author_name.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium">
            {baton.author_name}
          </span>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            №{index + 1} · {timeAgo(baton.created_at)}
          </span>
        </span>
        {isLatest ? (
          <span className="ml-auto shrink-0 rounded-full bg-ember/15 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-ember">
            latest
          </span>
        ) : null}
      </span>

      {/* summary */}
      <span className="mt-2 line-clamp-2 text-xs leading-snug text-foreground/75">
        {baton.card?.summary || baton.transcript || "No summary."}
      </span>

      {/* kind chips */}
      <span className="mt-auto flex items-center gap-2 pt-2">
        {CHIP_KINDS.map((kind) =>
          counts[kind] ? (
            <span
              key={kind}
              className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground"
              title={ITEM_STYLES[kind].label}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: ITEM_STYLES[kind].color }}
              />
              {counts[kind]}
            </span>
          ) : null
        )}
        <span className="ml-auto font-mono text-[9px] text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100">
          expand
        </span>
      </span>

      {/* unresolved-work pulse */}
      {openCount > 0 ? (
        <span
          title={`${openCount} item${openCount === 1 ? "" : "s"} from this baton still open`}
          className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-ember text-[9px] font-semibold text-primary-foreground shadow-[0_0_12px_-2px_var(--ember)]"
        >
          {openCount}
        </span>
      ) : null}
    </motion.button>
  );
});

/* --------------------------------------------------------------------------
   Expanded modal
-------------------------------------------------------------------------- */

function ExpandedBaton({
  baton,
  batonNumber,
  onClose,
}: {
  baton: Baton;
  batonNumber: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Baton ${batonNumber} from ${baton.author_name}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="relative max-h-[85vh] w-full max-w-md overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
        <BatonCard
          card={baton.card ?? { summary: "", items: [], links: [] }}
          author={baton.author_name}
          role={baton.author_role}
          createdAt={baton.created_at}
          audioUrl={baton.audio_url}
          durationSeconds={baton.duration_seconds}
          batonNumber={batonNumber}
          className="glow-ember"
        />
      </motion.div>
    </motion.div>
  );
}

function CanvasButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}
