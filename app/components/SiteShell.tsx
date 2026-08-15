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
import ProjectSpine, { showsProjectSpine } from "./project/ProjectSpine";
import SocialShareLinks from "./SocialShareLinks";

/* Async feature load: the domAnimation bundle becomes its own chunk and
   never blocks first paint. `strict` makes any accidental use of the full
   34kB `motion` component throw in development. reducedMotion="user"
   disables transform animations (keeping opacity) under
   prefers-reduced-motion — BRAND.md §8's "a still of equal beauty". */
const loadDomAnimation = () => import("./motion-features").then((mod) => mod.default);

/* The approved global navigation: Explore homes · Design a home ·
   How it works · My projects · More. What the old menu carried and where
   it went — nothing here vanished silently:
   · "Start a project" (/start) — reached from Design a home, My projects,
     and the project workspace; no longer a top-level entry.
   · "Builder" (/build) — is now the primary "Design a home" entry.
   · "Budget and quotes" (/budget) — workspace-only: the journey spine's
     Quotes and Funding steps route there.
   · "HOMES ledger" (/homes) and "Project record" (/dashboard) — left the
     ordinary utility menu on purpose; the story's blockchain journey links
     them, and the workspace spine still reaches /dashboard.
   · "Design questionnaire" (/design) — the route now redirects to the
     guided editor (/build?mode=guided).
   · "How Aura works" (/overview) — replaced by /how-it-works. */
/** One navigation entry. `what` is a plain sentence saying what the thing IS;
 *  it is optional on purpose — see the note above UTILITY_NAV. */
type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly what?: string;
};

const JOURNEY_NAV: readonly NavItem[] = [
  { href: "/buy", label: "Explore homes" },
  { href: "/build", label: "Design a home" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/projects", label: "My projects" },
];

/* ---------------------------------------------------------------------
   WHY TWO ENTRIES CARRY A SENTENCE AND THREE DO NOT (NAV01, Aug 14 2026)

   The founder — who commissioned both features — asked where the contractor
   directory was and why he could not search for land. Both were live, both
   were in this menu, under these labels. Read as data rather than as a
   misread by the reader, that says the labels do not tell anyone what the
   things ARE: "Check a contractor" is an action with no object, and "Land
   fit pilot" reads as a programme rather than as somewhere to look at land.

   Three obvious fixes were already decided against, by someone else:
   · THE LABEL. BRAND-VOICE-GUIDE.md §4 locks "the land-fit pilot" as the ONE
     name for the land tool, and these exact strings are asserted by
     navigation.spec.ts, by visual-system-ui.spec.ts (twice, with exact:true)
     and by project-ui.spec.ts. Renaming is a vocabulary change and belongs
     in a founder decision, not in this file.
   · A SECOND ENTRY POINT. visual-system-ui.spec.ts:168 asserts /build shows
     zero links named "Check a contractor" before More is opened, and :172
     together with project-ui.spec.ts:13-14 use single-match toBeVisible(),
     so a duplicate anywhere on the page is a strict-mode failure. Each tool
     appears exactly once, in More, by test.
   · A LONGER HEADER. Pinned, and rightly.

   What remains is the sentence. It renders visibly under the label and is
   wired as the link's aria-DESCRIPTION: aria-label pins the accessible NAME
   to the locked string (aria-label beats name-from-content), so every
   exact-match assertion above keeps holding, while a screen reader still
   hears what the thing is. Roadmap, FAQ and About already say what they are,
   and a gloss that carries no information is decoration this brand bans.
--------------------------------------------------------------------- */
const UTILITY_NAV: readonly NavItem[] = [
  { href: "/land", label: "Land fit pilot", what: "Does a parcel allow the home you drew?" },
  /* NOT "a directory of trades and suppliers", which is what this said first
     and is half untrue. The supplier half IS a directory — real Alberta
     records. The contractor half is not: it scores a contractor YOU bring, or
     shows demonstration profiles labelled as such, which is why the page calls
     itself "Check a contractor". Promising a directory of trades and handing
     someone a scoring tool is the small overstatement this project spends its
     whole gate budget refusing elsewhere. */
  {
    href: "/contractors",
    label: "Check a contractor",
    what: "Alberta suppliers, and evidence checks on a trade you are considering",
  },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
];

/** Ids for the description elements. `surface` keeps the landing sheet and
 *  the More menu from colliding when both are mounted on the same page. */
function whatId(surface: string, href: string): string {
  return `nav-what-${surface}-${href.replace(/[^a-z0-9]+/gi, "")}`;
}

/* The journey spine is workspace chrome. It mounts only on the routes where
   an active project is actually worked — never on education, marketplace,
   or labs pages — and the spine itself renders nothing without a project.
   The status spine below it mounts on the same set minus /dashboard (see
   SPINE_ROUTES) and obeys the same no-project rule. */
const WORKSPACE_ROUTES = new Set([
  "/projects",
  "/start",
  "/build",
  "/land",
  "/contractors",
  "/budget",
  "/dashboard",
]);

/** GH Pages exports with trailingSlash, so "/build/" must equal "/build". */
function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function UtilityMenu({ pathname, story = false }: { pathname: string; story?: boolean }) {
  const hasCurrent = UTILITY_NAV.some((item) => item.href === pathname);
  return (
    <details key={pathname} className={`site-utility${story ? " site-utility-story" : ""}`}>
      <summary className={hasCurrent ? "is-current" : ""}>More</summary>
      <nav aria-label="More Aura tools">
        {UTILITY_NAV.map((item) => {
          const describedBy = item.what ? whatId("more", item.href) : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              aria-label={item.what ? item.label : undefined}
              aria-describedby={describedBy}
            >
              {/* The label and its sentence stack; the arrow keeps its place
                  because the pair is one flex child, not two. */}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span>{item.label}</span>
                {item.what ? (
                  <span
                    id={describedBy}
                    className="text-[0.68rem] font-normal leading-snug text-aura-text/60"
                  >
                    {item.what}
                  </span>
                ) : null}
              </span>
              <i aria-hidden>&rarr;</i>
            </Link>
          );
        })}
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
        {/* TWO BANDS, NOT ONE RUN OF NINE (NAV01, Aug 14 2026).
            This sheet is the front door's only menu, and it used to flatten
            JOURNEY_NAV and UTILITY_NAV into a single ALL_NAV numbered 01–09 —
            which is precisely where the two tools went invisible: item 05 of
            nine, with nothing saying it was a tool. The bands are the ones the
            standard sheet already uses, and NOTHING was dropped in the split:
            ALL_NAV's whole purpose was completeness (four routes had once
            silently disappeared below 640px), the numbering is unchanged with
            tools still at 05–09, and navigation.spec.ts now asserts the count
            of both bands so a future edit cannot quietly lose an entry. */}
        {/* min-h-0 + overflow-y-auto, on this wrapper rather than on
            .story-sheet: the sheet is fixed at inset:0 and has no overflow
            rule of its own, so at 390×844 the nine rows plus the two band
            labels run past the bottom and the last entry lands under the
            story HUD. Containing the scroll in the element this file owns
            keeps globals.css untouched — another node holds it this wave. The
            proper home for it is `overflow-y: auto` on .story-sheet itself,
            handed to whoever owns globals.css next. SEPARATE and NOT fixed
            here: the story HUD is fixed above this sheet's z-index, so the
            sheet's own footer line still sits under it. That predates this
            change and needs a stacking or bottom-inset decision, not an
            overflow rule. */}
        <div className="min-h-0 overflow-y-auto">
          <p className="site-nav-sheet-label">Your route</p>
          <nav aria-label="Your route">
            {JOURNEY_NAV.map((item, i) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                <span className="story-sheet-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="story-sheet-l">{item.label}</span>
                <i aria-hidden>&rarr;</i>
              </Link>
            ))}
          </nav>
          <p className="site-nav-sheet-label site-nav-sheet-label-secondary">Tools and records</p>
          <nav aria-label="Aura tools">
            {UTILITY_NAV.map((item, i) => {
              const describedBy = item.what ? whatId("storysheet", item.href) : undefined;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-label={item.what ? item.label : undefined}
                  aria-describedby={describedBy}
                >
                  <span className="story-sheet-n">
                    {String(JOURNEY_NAV.length + i + 1).padStart(2, "0")}
                  </span>
                  <span className="story-sheet-l">
                    {item.label}
                    {item.what ? (
                      <span
                        id={describedBy}
                        className="mt-1 block font-sans text-[0.8rem] font-normal leading-snug tracking-normal text-aura-text/60"
                      >
                        {item.what}
                      </span>
                    ) : null}
                  </span>
                  <i aria-hidden>&rarr;</i>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="story-sheet-tools">
          <ThemeToggle />
        </div>
        <p className="story-sheet-foot">A KR8TIV AI product · MIT software · Plan studies keep their listed licences</p>
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
            {UTILITY_NAV.map((item) => {
              const describedBy = item.what ? whatId("sheet", item.href) : undefined;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-label={item.what ? item.label : undefined}
                  aria-describedby={describedBy}
                >
                  <span className="story-sheet-l">
                    {item.label}
                    {item.what ? (
                      <span
                        id={describedBy}
                        className="mt-1 block font-sans text-[0.8rem] font-normal leading-snug tracking-normal text-aura-text/60"
                      >
                        {item.what}
                      </span>
                    ) : null}
                  </span>
                  <i aria-hidden>&rarr;</i>
                </Link>
              );
            })}
          </nav>
        </div>
        <div>
          <ThemeToggle />
              <p className="story-sheet-foot">A KR8TIV AI product · MIT software · Plan studies keep their listed licences</p>
        </div>
      </div>
    </>
  );
}

/** Site chrome. The story landing ("/") is a full-bleed page with its own
 *  floating header; every other page keeps the contained paper shell. */
export default function SiteShell({ children }: { children: React.ReactNode }) {
  const rawPathname = usePathname();
  const pathname = normalizePath(rawPathname);
  const isStory = pathname === "/";
  const isWorkspace = WORKSPACE_ROUTES.has(pathname);

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
            {isWorkspace && (
              <div className={pathname === "/build" ? "mx-auto max-w-[90rem] px-4 pt-4 sm:px-6" : "mx-auto max-w-5xl px-6 pt-4"}>
                <ProjectJourneySpine />
                {/* The readings the journey chips never showed: stage status,
                    the design fingerprint in plain words, open blockers, and
                    the one recommended next action with its reason. Renders
                    nothing without an active project. */}
                {showsProjectSpine(pathname) && <ProjectSpine />}
              </div>
            )}
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
                  A KR8TIV AI product &middot; MIT software &middot; Plan studies keep their listed licences
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
