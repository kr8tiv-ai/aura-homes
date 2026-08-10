"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/land", label: "Land" },
  { href: "/design", label: "Design" },
  { href: "/budget", label: "Budget" },
  { href: "/escrow", label: "Escrow" },
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

  if (isStory) {
    return (
      <>
        <StoryHeader />
        {children}
      </>
    );
  }

  return (
    <>
      <header className="border-b aura-hairline">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="font-display text-sm font-semibold tracking-label uppercase">
            Aura <span className="text-aura-emerald">Homes</span>
          </Link>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 sm:gap-8">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="aura-label transition-colors hover:text-aura-emerald">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6">{children}</main>
      <footer className="mt-24 border-t aura-hairline">
        <div className="mx-auto max-w-5xl px-6 py-8 text-xs uppercase tracking-label text-aura-text/70">
          A KR8TIV AI product &middot; Open source (MIT)
        </div>
      </footer>
    </>
  );
}
