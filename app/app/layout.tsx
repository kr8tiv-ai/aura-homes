import type { Metadata } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/manrope";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "./providers";
import SiteShell from "../components/SiteShell";

const TITLE = "Aura Homes — AI-designed off-grid eco homes, funded in USDC on X Layer";
const DESCRIPTION =
  "From USDC on X Layer to the keys of an off-grid eco home. Land, design, budget, escrow, and build — orchestrated end-to-end by AI, in Alberta first.";

export const metadata: Metadata = {
  metadataBase: new URL("https://aurahomes.fun"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "/",
    siteName: "Aura Homes",
    images: [{ url: "/social-card.png", width: 1200, height: 630, alt: "Aura Homes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/social-card.png"],
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
