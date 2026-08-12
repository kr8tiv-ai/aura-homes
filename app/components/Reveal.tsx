"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as m from "motion/react-m";
import {
  DOCUMENT_REVEAL_SECONDS,
  DOCUMENT_STAGGER_SECONDS,
} from "@/lib/ui/motionPolicy";

/* ---------------------------------------------------------------------
   THE MOTION VOCABULARY for the document pages.

   Four primitives, one curve. Everything here rides --ease-fluid-decel
   (cubic-bezier(.16,1,.3,1)) so a card arriving, a bar filling, and a
   number counting all share a family resemblance instead of each inventing
   its own timing.

   Rules that keep this from becoming noise:
   · Once. Every reveal uses viewport={{ once: true }} — content that
     re-animates when you scroll back up is a toy, not a document.
   · Transform and opacity only. No width/height/top animations, so every
     one of these is a compositor job.
   · Reduced motion is handled ONE level up by <MotionConfig
     reducedMotion="user"> in SiteShell, which strips transforms and keeps
     opacity. Counter checks the query itself because a number ticking is
     motion the config cannot see.
--------------------------------------------------------------------- */

const EASE = [0.16, 1, 0.3, 1] as const;

/** Fade + rise as it enters. `delay` staggers siblings that are not in a
 *  <Stagger>; `y` overrides the travel for larger blocks. */
export function Reveal({
  children,
  delay = 0,
  y = 14,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: DOCUMENT_REVEAL_SECONDS, ease: EASE, delay }}
    >
      {children}
    </m.div>
  );
}

/** Container that hands each child its own arrival, 60ms apart. Children
 *  must be <StaggerItem> (or any m.* element with the "item" variant). */
export function Stagger({
  children,
  className,
  gap = DOCUMENT_STAGGER_SECONDS,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
}) {
  return (
    <m.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 12,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  return (
    <m.div
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: DOCUMENT_REVEAL_SECONDS, ease: EASE },
        },
      }}
    >
      {children}
    </m.div>
  );
}

/** A progress bar that draws itself from zero when it scrolls into view.
 *  scaleX rather than width: width animates layout, scaleX animates the
 *  compositor, and at 6px tall nobody can tell the difference. */
export function GrowBar({
  pct,
  className,
  delay = 0,
}: {
  pct: number;
  className?: string;
  delay?: number;
}) {
  return (
    <m.div
      className={className}
      style={{ transformOrigin: "left center", width: `${Math.max(0, Math.min(100, pct))}%` }}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 1.1, ease: EASE, delay }}
    />
  );
}

/** A figure that counts up to its value once, on entry.
 *
 *  Deliberately NOT a spring on a motion value: these are dollars, and a
 *  spring overshoots — watching a budget total sail past $301,280 and settle
 *  back reads as a glitch in a money product. A clamped cubic ease-out
 *  arrives at the exact number and stops.
 *
 *  The DOM node is written directly from rAF; React renders once. */
export const FIGURE_SPACE = " "; // exactly one digit wide; HTML will not collapse it

export function Counter({
  value,
  format,
  prefix = "",
  suffix = "",
  duration = 1.25,
  decimals = 0,
  padTo,
  minDigits,
  className,
}: {
  value: number;
  /** CLIENT CALLERS ONLY — see the boundary note below. */
  format?: (n: number) => string;
  prefix?: string;
  suffix?: string;
  duration?: number;
  /** fixed decimal places, e.g. 2 for a USDC amount */
  decimals?: number;
  /** pad the interim frames with figure spaces to this width, so a sentence
   *  never reflows while the number climbs — a paragraph rewrapping itself
   *  for a second reads as a bug, which a money page cannot afford */
  padTo?: number;
  /** zero-pad to this many digits, e.g. 2 for step numbers "01".."05" */
  minDigits?: number;
  className?: string;
}) {
  /* THE SERVER/CLIENT BOUNDARY, and why these props exist.
     `format` is a function, and a function cannot cross from a server
     component into a client one — React has to serialize props into the RSC
     payload, and it throws while stringifying. That is exactly what broke the
     static export: /faq passed an inline format closure, prerender threw
     inside the flight serializer, the worker hung past the 60s static-
     generation timeout, and the export failed with a misleading "Cannot find
     module for page /faq/page" once the worker had been SIGTERMed.
     So the common cases are expressed as DATA — decimals / padTo / minDigits —
     which serialize fine. `format` stays available for callers that are
     already "use client". */
  const fmt =
    format ??
    ((n: number) => {
      const base =
        minDigits != null
          ? String(Math.round(n)).padStart(minDigits, "0")
          : n.toLocaleString("en-CA", {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            });
      return padTo != null ? base.padEnd(padTo, FIGURE_SPACE) : base;
    });
  const ref = useRef<HTMLSpanElement>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setArmed(true);
          io.disconnect();
        }
      },
      { rootMargin: "-40px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !armed) return;
    // A number ticking is motion; MotionConfig cannot strip it, so ask here.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = `${prefix}${fmt(value)}${suffix}`;
      return;
    }
    let raf = 0;
    let start = 0;
    const ms = duration * 1000;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = `${prefix}${fmt(value * eased)}${suffix}`;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [armed, value, duration, prefix, suffix, fmt]);

  // Server render carries the FINAL value: no-JS and crawlers see the real
  // number, and there is no layout shift when the count starts.
  return (
    <span ref={ref} className={className}>
      {`${prefix}${fmt(value)}${suffix}`}
    </span>
  );
}
