import type { Metadata } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/manrope";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "./providers";
import SiteShell from "../components/SiteShell";
import { NO_FLASH_SCRIPT } from "../lib/theme";

const TITLE = "Aura Homes — Design the home. Find the land. Build it for real.";
const DESCRIPTION =
  "Design or choose a tiny eco home, match land, source a team, compare real costs and prepare one private project for professional handoff.";

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
    images: [
      {
        url: "/social/aura-homes-social-v2.jpg",
        width: 1200,
        height: 630,
        alt: "Aura Homes — a Nordic eco home among evergreen trees",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/social/aura-homes-social-v2.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* suppressHydrationWarning is required and narrow: the inline script
       below writes data-theme during head parse, so the DOM React hydrates
       against legitimately differs from the server HTML on this one
       attribute. Without the script there is a white flash on every
       dark-mode load; without the suppression, React warns about the fix. */
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before first paint. Resolution order is explicit choice →
            OS preference; source lives in lib/theme.ts so nothing can drift. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased font-sans">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Providers>
          <SiteShell>{children}</SiteShell>
        </Providers>
      </body>
    </html>
  );
}
