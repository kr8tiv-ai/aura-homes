"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* ---------------------------------------------------------------------
   LENIS — glide on the document pages, hands off the flagship.

   WHY IT IS SCOPED, and this is a deliberate call rather than an omission:

   The story route ("/") already owns scroll feel. Scene.tsx damps a scroll
   value into `rig.current.smooth` every frame and drives the camera from
   it; the curve there was tuned against RAW scroll input. Layering Lenis
   underneath would smooth an already-smoothed signal, and double-damping
   does not read as smoother — it reads as latency between the wheel and
   the world. So "/" keeps native scroll and the rig keeps its tuning.

   Every other route is ordinary long-form document scroll, where Lenis is
   a pure win and costs nothing to reason about.

   Lenis is left in its DEFAULT mode, which drives the real scroller rather
   than transforming a wrapper. That matters: window.scrollY stays truthful,
   so anchor links, :target, sticky positioning, IntersectionObserver, and
   the reveal primitives all keep working with no shims.

   One rAF loop, cancelled on unmount, and it refuses to arm under
   prefers-reduced-motion — animating the scroll position is exactly the
   vestibular trigger that setting exists to suppress.
--------------------------------------------------------------------- */

export default function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;
    let cancelled = false;

    // Dynamic import keeps Lenis out of the first-paint bundle entirely and
    // off the story route, which never executes this branch.
    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({
        // ~0.9s to settle: enough glide to feel intentional, short enough
        // that a flick still lands where the reader aimed it.
        duration: 0.9,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
        wheelMultiplier: 1,
        touchMultiplier: 1.6,
        // Trackpads and touch already have OS-level inertia; smoothing them
        // again is the classic "scrolljacking" complaint.
        syncTouch: false,
      });
      const loop = (time: number) => {
        lenis?.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      lenis?.destroy();
    };
  }, [pathname]);

  return null;
}
