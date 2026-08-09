"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/land", label: "Land" },
  { href: "/design", label: "Design" },
  { href: "/budget", label: "Budget" },
  { href: "/escrow", label: "Escrow" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

/** Site chrome. The story landing ("/") is a light full-bleed page with its
 *  own floating header; every other page keeps the dark contained shell. */
export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStory = pathname === "/";

  if (isStory) {
    return (
      <>
        <header className="story-chrome">
          <Link href="/" className="story-chrome-mark">
            Aura <em>Homes</em>
          </Link>
          <nav>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </>
    );
  }

  return (
    <>
      <header className="border-b aura-hairline">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-sm font-semibold tracking-label uppercase">
            Aura <span className="text-aura-emerald">Homes</span>
          </Link>
          <nav className="flex gap-8">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="aura-label transition-colors hover:text-aura-lime">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6">{children}</main>
      <footer className="mt-24 border-t aura-hairline">
        <div className="mx-auto max-w-5xl px-6 py-8 text-xs uppercase tracking-label text-aura-text/50">
          A KR8TIV AI product &middot; Open source (MIT)
        </div>
      </footer>
    </>
  );
}
