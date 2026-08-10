"use client";

/* Editorial word-mask reveal for the app pages' display headlines — the
   same vocabulary as the story's Reveal (overflow-masked words rising on
   the fluid-deceleration curve with a ~55ms stagger), CSS-driven with one
   IntersectionObserver and zero runtime library. No-JS renders the plain
   finished text (the mask classes arm only after mount);
   prefers-reduced-motion gets a gentle opacity-only fade, no translation. */

import { createElement, useEffect, useRef } from "react";

export default function RevealWords({
  text,
  as = "h1",
  className,
}: {
  text: string;
  as?: "h1" | "h2" | "p";
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add("rw-armed");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("rw-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return createElement(
    as,
    { ref, className, "aria-label": text },
    text.split(" ").map((w, i) => (
      <span key={i}>
        {i > 0 ? " " : null}
        <span className="rw-mask" aria-hidden>
          <span className="rw-w" style={{ transitionDelay: `${i * 55}ms` }}>
            {w}
          </span>
        </span>
      </span>
    ))
  );
}
