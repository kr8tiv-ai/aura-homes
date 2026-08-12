"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import * as m from "motion/react-m";
import { APP_ROUTE_TRANSITION_SECONDS } from "@/lib/ui/motionPolicy";
import CardFXLayer from "./CardFX";
import ThemeToggle from "./ThemeToggle";
import ProjectJourneySpine from "./project/ProjectJourneySpine";
import SocialShareLinks from "./SocialShareLinks";

/* Async feature load: the domAnimation bundle becomes its own chunk and
   never blocks first paint. `strict` makes any accidental use of the full
   34kB `motion` component throw in development. reducedMotion="user"
   disables transform animations (keeping opacity) under
   prefers-reduced-motion — BRAND.md §8's "a still of equal beauty". */
const loadDomAnimation = () => import("./motion-features").then((mod) => mod.default);

const JOURNEY_NAV = [
  { href: "/start", label: "Start a project" },
  { href: "/buy", label: "Explore homes" },
  { href: "/overview", label: "How Aura works" },
] as const;

const UTILITY_NAV = [
  { href: "/projects", label: "My projects" },
  { href: "/build", label: "Builder" },
  { href: "/land", label: "Find land" },
  { href: "/contractors", label: "Contractors" },
  { href: "/budget", label: "Budget and quotes" },
  { href: "/homes", label: "HOMES ledger" },
  { href: "/dashboard", label: "Project record" },
  { href: "/design", label: "Design questionnaire" },
  { href: "/faq", label: "FAQ" },
] as const;

const ALL_NAV = [...JOURNEY_NAV, ...UTILITY_NAV] as const;

function UtilityMenu({ pathname, story = false }: { pathname: string; story?: boolean }) {
  const hasCurrent = UTILITY_NAV.some((item) => item.href === pathname);
  return (
    <details key={pathname} className={`site-utility${story ? " site-utility-story" : ""}`}>
      <summary className={hasCurrent ? "is-current" : ""}>More</summary>
      <nav aria-label="More Aura tools">
        {UTILITY_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            <span>{item.label}</span>
            <i aria-hidden>&rarr;</i>
          </Link>
        ))}
      </nav>
    </details>
  );
}

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
        <div className="story-chrome-actions">
          <nav className="story-chrome-nav" aria-label="Primary">
            {JOURNEY_NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <UtilityMenu pathname={pathname} story />
          <button
            type="button"
            className="story-chrome-menu"
            aria-expanded={open}
            aria-controls="story-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </header>

      {/* Day/night is reachable from the menu sheet too — the story HUD's
          own NIGHT button sits at the bottom of the scroll, which is a long
          way to travel to undo an accidental flip. */}
      <div id="story-menu" className={`story-sheet${open ? " on" : ""}`} hidden={!open}>
        <nav aria-label="All pages">
          {ALL_NAV.map((item, i) => (
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

function StandardHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="site-wordmark">
            Aura <span>Homes</span>
          </Link>
          <div className="site-header-actions">
            <nav className="site-journey-nav" aria-label="Primary">
              {JOURNEY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`aura-nav-link aura-label${pathname === item.href ? " is-current" : ""}`}
                  aria-current={pathname === item.href ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <UtilityMenu pathname={pathname} />
            <div className="site-theme-control">
              <ThemeToggle />
            </div>
            <button
              type="button"
              className="site-menu-button"
              aria-expanded={open}
              aria-controls="site-mobile-menu"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>
      <div id="site-mobile-menu" className={`site-nav-sheet${open ? " is-open" : ""}`} hidden={!open}>
        <div>
          <p className="site-nav-sheet-label">Your route</p>
          <nav aria-label="Primary">
            {JOURNEY_NAV.map((item, index) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                <span className="story-sheet-n">{String(index + 1).padStart(2, "0")}</span>
                <span className="story-sheet-l">{item.label}</span>
                <i aria-hidden>&rarr;</i>
              </Link>
            ))}
          </nav>
          <p className="site-nav-sheet-label site-nav-sheet-label-secondary">Tools and records</p>
          <nav aria-label="Aura tools">
            {UTILITY_NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                <span className="story-sheet-l">{item.label}</span>
                <i aria-hidden>&rarr;</i>
              </Link>
            ))}
          </nav>
        </div>
        <div>
          <ThemeToggle />
          <p className="story-sheet-foot">A KR8TIV AI product · Open source (MIT)</p>
        </div>
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
        {/* Practical routes keep native scrolling and the system cursor. The
            landing story owns the only cinematic scroll treatment. */}
        {isStory ? (
          <>
            <StoryHeader />
            {children}
            <CardFXLayer />
          </>
        ) : (
          <>
            <StandardHeader />
            <div className={pathname === "/build" ? "mx-auto max-w-[90rem] px-4 pt-4 sm:px-6" : "mx-auto max-w-5xl px-6 pt-4"}>
              <ProjectJourneySpine />
            </div>
            <main
              id="main"
              className={pathname === "/build" ? "mx-auto max-w-[90rem] px-4 sm:px-6" : "mx-auto max-w-5xl px-6"}
            >
              {/* One tasteful entrance per route arrival: fade + 8px rise on
                  the fluid-deceleration curve. Damped, never bouncy; under
                  reduced motion MotionConfig strips the transform. */}
              <m.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: APP_ROUTE_TRANSITION_SECONDS,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {children}
              </m.div>
            </main>
            <footer className="mt-24 border-t aura-hairline">
              <div className="mx-auto max-w-5xl px-6 py-8">
                <p className="text-xs uppercase tracking-label text-aura-text/70">
                  A KR8TIV AI product &middot; Open source (MIT)
                </p>
                <SocialShareLinks compact />
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
