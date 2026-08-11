"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import * as m from "motion/react-m";
import CardFXLayer from "./CardFX";
import Cursor from "./Cursor";
import SmoothScroll from "./SmoothScroll";
import ThemeToggle from "./ThemeToggle";

/* Async feature load: the domAnimation bundle becomes its own chunk and
   never blocks first paint. `strict` makes any accidental use of the full
   34kB `motion` component throw in development. reducedMotion="user"
   disables transform animations (keeping opacity) under
   prefers-reduced-motion — BRAND.md §8's "a still of equal beauty". */
const loadDomAnimation = () => import("./motion-features").then((mod) => mod.default);

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/concierge", label: "Concierge" },
  { href: "/land", label: "Land" },
  { href: "/design", label: "Design" },
  { href: "/budget", label: "Budget" },
  { href: "/escrow", label: "Escrow" },
  { href: "/faq", label: "FAQ" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

/* ---------------------------------------------------------------------
   THE STORY HEADER

   Two things were broken here and both were structural, not cosmetic.

   1. No ground. The header painted its links straight onto the WebGL
      scene with nothing behind them, so at any scroll position where the
      world went pale the wordmark simply vanished. It now carries a paper
      scrim that always wins.

   2. Four of six routes silently disappeared below 640px — the CSS hid
      every nav link except the last two, with no menu, no drawer, and no
      affordance saying anything was missing. A phone visitor could reach
      two of the seven pages. Below 767px the inline list is replaced by a
      real MENU control opening a full-height paper sheet carrying every
      entry in NAV.
--------------------------------------------------------------------- */

function StoryHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="story-chrome">
        <Link href="/" className="story-chrome-mark">
          Aura <em>Homes</em>
        </Link>
        <nav className="story-chrome-nav" aria-label="Product">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="story-chrome-menu"
          aria-expanded={open}
          aria-controls="story-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </header>

      {/* Day/night is reachable from the menu sheet too — the story HUD's
          own NIGHT button sits at the bottom of the scroll, which is a long
          way to travel to undo an accidental flip. */}
      <div id="story-menu" className={`story-sheet${open ? " on" : ""}`} hidden={!open}>
        <nav aria-label="All pages">
          {NAV.map((item, i) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              <span className="story-sheet-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="story-sheet-l">{item.label}</span>
              <i aria-hidden>&rarr;</i>
            </Link>
          ))}
        </nav>
        <div className="story-sheet-tools">
          <ThemeToggle />
        </div>
        <p className="story-sheet-foot">A KR8TIV AI product · Open source (MIT)</p>
      </div>
    </>
  );
}

/** Site chrome. The story landing ("/") is a full-bleed page with its own
 *  floating header; every other page keeps the contained paper shell. */
export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStory = pathname === "/";

  return (
    <LazyMotion features={loadDomAnimation} strict>
      <MotionConfig reducedMotion="user">
        {/* Both are inert on touch and under prefers-reduced-motion, and
            SmoothScroll no-ops on "/" where the camera rig owns scroll.

            The pointer ring is OFF on the story route. On a document page a
            ring that grows over a link is a nice touch; laid over the meadow
            it is a 56px translucent disc parked on the composition — it reads
            as a rendering artifact rather than a cursor, which is exactly how
            it was reported. The scene now draws no circles of any kind: the
            in-world hotspot markers are gone too. */}
        {!isStory && <Cursor />}
        <SmoothScroll />
        {isStory ? (
          <>
            <StoryHeader />
            {children}
            <CardFXLayer />
          </>
        ) : (
          <>
            <CardFXLayer />
            <header className="border-b aura-hairline">
              <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <Link href="/" className="font-display text-sm font-semibold tracking-label uppercase">
                  Aura <span className="text-aura-emerald">Homes</span>
                </Link>
                <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:gap-8">
                  {NAV.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`aura-nav-link aura-label transition-colors hover:text-aura-emerald${
                        pathname === item.href ? " is-current" : ""
                      }`}
                      aria-current={pathname === item.href ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <ThemeToggle />
                </nav>
              </div>
            </header>
            <main id="main" className="mx-auto max-w-5xl px-6">
              {/* One tasteful entrance per route arrival: fade + 8px rise on
                  the fluid-deceleration curve. Damped, never bouncy; under
                  reduced motion MotionConfig strips the transform. */}
              <m.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              >
                {children}
              </m.div>
            </main>
            <footer className="mt-24 border-t aura-hairline">
              <div className="mx-auto max-w-5xl px-6 py-8">
                <p className="text-xs uppercase tracking-label text-aura-text/70">
                  A KR8TIV AI product &middot; Open source (MIT)
                </p>
                {/* THE BOUNDARY, stated once and in plain words. Aura is rails
                    and guidance; it is not the seller, the builder, or a party
                    to anyone's contract, and it takes no custody of funds. A
                    reader should never have to infer that from the absence of
                    a claim — and the site said "buy a home with USDC" until
                    Aug 10, 2026, which invited exactly the wrong inference. */}
                <p className="mt-3 max-w-2xl text-xs leading-relaxed text-aura-text/55">
                  Aura Homes facilitates. It does not sell homes, hold your funds, act as a party to
                  any purchase or build contract, or provide legal, financial, or engineering advice.
                  Designs are review-ready concepts, not permit sets — a licensed professional
                  completes those. You own your project and the decisions in it.
                </p>
              </div>
            </footer>
          </>
        )}
      </MotionConfig>
    </LazyMotion>
  );
}
