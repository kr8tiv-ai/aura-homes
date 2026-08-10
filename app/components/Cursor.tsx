"use client";

import { useEffect, useRef } from "react";

/* ---------------------------------------------------------------------
   THE POINTER

   A ring that trails the true cursor and reads what is under it. Three
   states, all driven from one pointermove listener:

     · default  — a 34px hairline ring
     · text     — collapses to a 6px dot over running copy, so the ring
                  never sits between the reader and a word
     · link     — expands to 56px, fills with 14% emerald, and picks up a
                  label when the element declares data-cursor="…"

   Engineering notes, because the naive version of this is a jank machine:

   1. The listener writes to a ref and NOTHING else; a single rAF loop
      commits the position as two custom properties. Setting style.transform
      inside pointermove would run layout-adjacent work at the input event
      rate (up to 1000Hz on a gaming mouse) instead of once per frame.
   2. Position is committed as --cx/--cy consumed by a translate3d in CSS,
      so the compositor owns it. No layout, no paint, no React re-render —
      this component renders exactly once.
   3. State changes go through classList, not React state, for the same
      reason: a setState per hover would reconcile the whole subtree.
   4. The ring lags the true cursor by design (CSS transition on transform),
      which is what reads as "weight". The native cursor is left visible —
      hiding it is a usability tax that pays for nothing.
   5. Coarse pointers and prefers-reduced-motion never mount it (CSS
      display:none) and the loop stops itself when it does not exist.
--------------------------------------------------------------------- */

const TEXT_TAGS = new Set(["P", "SPAN", "LI", "TD", "TH", "H1", "H2", "H3", "H4", "H5", "H6", "DT", "DD", "BLOCKQUOTE", "CODE", "PRE", "LABEL"]);
const LINK_SEL = 'a, button, [role="button"], input, select, textarea, summary, [data-cursor]';

export default function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const pos = useRef({ x: -100, y: -100, seen: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Never arm on touch or for readers who asked for stillness. Matches the
    // CSS media guard so the two can never disagree.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let lastX = -100;
    let lastY = -100;

    const commit = () => {
      const { x, y } = pos.current;
      if (x !== lastX || y !== lastY) {
        el.style.setProperty("--cx", `${x}px`);
        el.style.setProperty("--cy", `${y}px`);
        lastX = x;
        lastY = y;
      }
      raf = requestAnimationFrame(commit);
    };
    raf = requestAnimationFrame(commit);

    const onMove = (e: PointerEvent) => {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
      if (!pos.current.seen) {
        pos.current.seen = true;
        el.classList.add("on");
      }

      // Hit-test once per move. elementFromPoint is a read, but it is one
      // read against an already-clean tree, not a forced reflow.
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== "function") return;

      const interactive = t.closest<HTMLElement>(LINK_SEL);
      if (interactive) {
        el.classList.add("link");
        el.classList.remove("text");
        const label = interactive.dataset.cursor ?? "";
        if (labelRef.current && labelRef.current.textContent !== label) {
          labelRef.current.textContent = label;
        }
        el.classList.toggle("labelled", label.length > 0);
        return;
      }

      el.classList.remove("link", "labelled");
      el.classList.toggle("text", TEXT_TAGS.has(t.tagName));
    };

    const onLeave = () => el.classList.remove("on");
    const onEnter = () => pos.current.seen && el.classList.add("on");

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("pointerenter", onEnter);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerenter", onEnter);
    };
  }, []);

  return (
    <div ref={ref} className="aura-cursor" aria-hidden>
      <span ref={labelRef} className="aura-cursor-label" />
    </div>
  );
}
