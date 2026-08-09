import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import SiteShell from "../components/SiteShell";

const TITLE = "Aura Homes — AI-designed off-grid eco homes, funded in USDC on X Layer";
const DESCRIPTION =
  "From USDC on X Layer to the keys of an off-grid eco home. Land, design, budget, escrow, and build — orchestrated end-to-end by AI, in Alberta first.";

export const metadata: Metadata = {
  metadataBase: new URL("https://kr8tiv-ai.github.io"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "/aura-homes/",
    siteName: "Aura Homes",
    images: [{ url: "/aura-homes/social-card.png", width: 1200, height: 630, alt: "Aura Homes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/aura-homes/social-card.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased font-sans">
        <Providers>
          <SiteShell>{children}</SiteShell>
        </Providers>
      </body>
    </html>
  );
}
