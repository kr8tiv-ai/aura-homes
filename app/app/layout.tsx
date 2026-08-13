import type { Metadata } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/manrope";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "./providers";
import SiteShell from "../components/SiteShell";
import { NO_FLASH_SCRIPT } from "../lib/theme";
import { createChunkRecoveryScript } from "../lib/chunkRecovery.mjs";

const TITLE = "Aura Homes — Design your eco home. Find the land. Manage the build.";
const DESCRIPTION =
  "Plan or choose an eco home, match it with the right property and keep your team, costs and next steps together.";
const CHUNK_RECOVERY_SCRIPT = createChunkRecoveryScript(
  process.env.NEXT_PUBLIC_DEPLOYMENT_ID ?? "development",
);

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
    site: "@AuraHomes_fun",
    creator: "@AuraHomes_fun",
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
        {/* This listener must be inline: an external recovery chunk cannot
            recover itself when cached HTML points at a retired release. */}
        <script id="aura-chunk-recovery" dangerouslySetInnerHTML={{ __html: CHUNK_RECOVERY_SCRIPT }} />
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
