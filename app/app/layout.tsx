import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Aura Homes",
  description: "AI-designed off-grid eco homes on X Layer, paid in USDC.",
};

const nav = [
  { href: "/land", label: "Land" },
  { href: "/design", label: "Design" },
  { href: "/budget", label: "Budget" },
  { href: "/escrow", label: "Escrow" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased font-sans">
        <Providers>
          <header className="border-b aura-hairline">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
              <Link href="/" className="text-sm font-semibold tracking-label uppercase">
                Aura <span className="text-aura-emerald">Homes</span>
              </Link>
              <nav className="flex gap-8">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="aura-label transition-colors hover:text-aura-lime"
                  >
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
        </Providers>
      </body>
    </html>
  );
}
