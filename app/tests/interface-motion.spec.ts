import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";
import {
  APP_ROUTE_TRANSITION_SECONDS,
  APP_SCROLL_BEHAVIOR,
  DOCUMENT_REVEAL_SECONDS,
  DOCUMENT_STAGGER_SECONDS,
} from "@/lib/ui/motionPolicy";

const appRoot = path.resolve(__dirname, "..");
const css = readFileSync(path.join(appRoot, "app/globals.css"), "utf8");

/* The file has three motion regions and only ONE of them is the motion
   system's business:

   · the app surface (everything above the story banner) — micro-interaction
     territory, BRAND.md §8's 150–250 ms band, swept onto tokens by MI01;
   · the story route — scroll choreography, timings measured in scroll
     distance and pinned by the landing specs;
   · the card-fx warm response and the scene loader — a founder-approved
     560/380 ms exception (MOTION-STACK-SPEC §5.2) and the loader's own
     read-out timing.

   Slicing here is what lets the sweep gate below be strict without lying
   about the two regions it does not govern. Both are pinned as deliberate
   further down, so a later "tidy-up" that flattens them fails loudly. */
const STORY_MARKER = "/* =============================================================== story";
const FX_MARKER = "/* =============================================================== card fx";

/* Comments are stripped before anything is measured. This file explains its
   own timings in prose, and prose that quotes a duration is documentation,
   not a declaration — the first run of the sweep gate below flagged its own
   explanatory comment. Slice on the raw text (the region markers ARE
   comments), then read only the code. */
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "");
const code = stripComments(css);
const appSurface = stripComments(css.slice(0, css.indexOf(STORY_MARKER)));
const storyRegion = stripComments(css.slice(css.indexOf(STORY_MARKER), css.indexOf(FX_MARKER)));

/** First declaration of a custom property, i.e. its :root value. */
const token = (name: string): string => {
  const match = new RegExp(`^\\s*${name}:\\s*([^;]+);`, "m").exec(appSurface);
  if (!match) throw new Error(`motion token ${name} is not declared in globals.css`);
  return match[1].trim();
};

const ms = (value: string): number => {
  const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(value);
  if (!match) throw new Error(`${value} is not a plain duration`);
  return match[2] === "s" ? Number(match[1]) * 1000 : Number(match[1]);
};

/** Every `transition` / `transition-duration` declaration on the app surface. */
const APP_SURFACE_TRANSITIONS = appSurface.match(/transition(?:-duration)?\s*:[^;}]+;/g) ?? [];

/* The only hand-written durations the app surface is still allowed to carry.
   RevealWords is an editorial headline mask — the story's reveal vocabulary
   borrowed for app-page display type, so it is a scene transition, not a
   micro-interaction, and 0.9 s is its pinned value. The 0.6 s opacity is its
   reduced-motion substitute, which moves nothing. Anything else is an
   un-tokenised duration and this spec is where it gets caught. */
const ALLOWED_HAND_TUNED = [
  "transition: transform 0.9s var(--ease-fluid-decel);",
  "transition: opacity 0.6s ease;",
];

const hasLiteralDuration = (declaration: string) => /\d\s*m?s\b/.test(declaration);

test("ordinary app routes use native scrolling and short motion", () => {
  expect(APP_SCROLL_BEHAVIOR).toBe("native");
  expect(APP_ROUTE_TRANSITION_SECONDS).toBeGreaterThanOrEqual(0.18);
  expect(APP_ROUTE_TRANSITION_SECONDS).toBeLessThanOrEqual(0.22);
  expect(DOCUMENT_REVEAL_SECONDS).toBeLessThanOrEqual(0.25);
  expect(DOCUMENT_STAGGER_SECONDS).toBeLessThanOrEqual(0.05);
});

test("the motion system is three durations named for their job, inside the brand band", () => {
  /* Pinned values. Changing one is allowed — changing it here, with the
     reason written beside it, is the price. */
  expect(token("--motion-echo")).toBe("150ms"); // colour answers in place
  expect(token("--motion-state")).toBe("200ms"); // a control changes what it is
  expect(token("--motion-travel")).toBe("250ms"); // something actually moves

  for (const name of ["--motion-echo", "--motion-state", "--motion-travel"]) {
    expect(ms(token(name))).toBeGreaterThanOrEqual(150);
    expect(ms(token(name))).toBeLessThanOrEqual(250);
  }
  expect(ms(token("--motion-echo"))).toBeLessThan(ms(token("--motion-state")));
  expect(ms(token("--motion-state"))).toBeLessThan(ms(token("--motion-travel")));

  /* One damped curve, and it is the house curve rather than a second
     opinion about what the brand feels like. */
  expect(token("--motion-ease")).toBe("var(--ease-fluid-decel)");
  expect(token("--ease-fluid-decel")).toBe("var(--st-ease-out)");
  expect(token("--st-ease-out")).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
  expect(appSurface.match(/cubic-bezier\(/g)).toHaveLength(1);

  /* The restraint settings: a 2px rise is the whole hover vocabulary, and
     the focus ring is an outline the tokens describe end to end. */
  expect(token("--motion-lift")).toBe("-2px");
  expect(token("--focus-ring-width")).toBe("2px");
  expect(token("--focus-ring-offset")).toBe("3px");
  expect(token("--focus-ring-offset-tight")).toBe("2px");
  expect(token("--focus-ring-color")).toBe("var(--st-emerald-deep)");
});

test("the CSS tokens and the JS motion policy are the same numbers", () => {
  /* Route transitions are driven from motionPolicy.ts and everything else
     from CSS. If the two drift, one half of the product feels quicker than
     the other for no reason a reader could name. */
  expect(ms(token("--motion-state"))).toBe(APP_ROUTE_TRANSITION_SECONDS * 1000);
  expect(DOCUMENT_REVEAL_SECONDS * 1000).toBeLessThanOrEqual(ms(token("--motion-travel")));
});

test("app-surface transitions run on the tokens, not on hand-tuned numbers", () => {
  expect(css).toContain(STORY_MARKER);
  /* A detector that matches nothing would pass this test while proving
     nothing, so first prove it still finds transitions at all, and that it
     can still fail. */
  expect(APP_SURFACE_TRANSITIONS.length).toBeGreaterThan(12);
  expect(hasLiteralDuration("transition: color 160ms var(--motion-ease);")).toBe(true);
  expect(hasLiteralDuration("transition: color var(--motion-echo) var(--motion-ease);")).toBe(false);

  const offenders = APP_SURFACE_TRANSITIONS.filter(
    (declaration) =>
      hasLiteralDuration(declaration) &&
      !ALLOWED_HAND_TUNED.some((allowed) => declaration.includes(allowed)),
  );
  expect(
    offenders,
    `these app-surface transitions still carry hand-tuned durations; use --motion-echo / --motion-state / --motion-travel:\n${offenders.join("\n")}`,
  ).toEqual([]);

  /* The share row lives inside the story half of the file but is shared
     chrome, so it is on the tokens too. */
  expect(code).toContain(
    ".aura-share a:focus-visible { outline: var(--focus-ring-width) solid var(--focus-ring-color); outline-offset: var(--focus-ring-offset-tight); }",
  );
  /* The ring is a setting, not nine copies of the same three values. */
  expect((code.match(/var\(--focus-ring-color\)/g) ?? []).length).toBeGreaterThanOrEqual(8);
});

test("the deliberate exceptions stay deliberate", () => {
  /* Named so a future sweep cannot quietly flatten them into the band and
     call it consistency. Each of these has a written reason in the CSS. */
  expect(token("--motion-theme-crossfade")).toBe("500ms"); // full-viewport repaint
  expect(code).toContain("transition: --fx-warm 560ms cubic-bezier(0.32, 0.08, 0.24, 1) 80ms;");
  expect(code).toContain("transition: --fx-warm 380ms cubic-bezier(0.4, 0, 0.6, 1) 0ms;");
  expect(storyRegion).toContain("transition: opacity 0.75s var(--st-ease-out), transform 0.9s var(--st-ease-out);");
  expect(storyRegion).toContain("transition: filter 1.2s var(--st-ease-out)");
});

test("reduced motion stills the token system at its source", async ({ page }) => {
  await page.setContent(
    `<button class="plan-card">plan</button>
     <div class="site-nav-sheet"></div>
     <button class="aura-theme-btn">theme</button>`,
  );
  await page.addStyleTag({ content: css });

  const read = () =>
    page.evaluate(() => {
      const duration = (selector: string) =>
        getComputedStyle(document.querySelector(selector) as Element).transitionDuration;
      return {
        planCard: duration(".plan-card"),
        sheet: duration(".site-nav-sheet"),
        themeButton: duration(".aura-theme-btn"),
        body: getComputedStyle(document.body).transitionDuration,
        lift: getComputedStyle(document.documentElement).getPropertyValue("--motion-lift").trim(),
      };
    });

  /* The control: without the preference the system really is moving, so a
     pass below cannot come from CSS that failed to load. */
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const moving = await read();
  expect(moving.planCard).toBe("0.15s, 0.15s, 0.15s");
  expect(moving.sheet).toBe("0.2s, 0.25s");
  expect(moving.themeButton).toBe("0.2s, 0.2s, 0.2s");
  expect(moving.body).toBe("0.5s, 0.5s");
  expect(moving.lift).toBe("-2px");

  /* The guarantee: one preference, every token, no per-rule opt-in — and
     the hover rise flattens with them, because a rise is travel. */
  await page.emulateMedia({ reducedMotion: "reduce" });
  const still = await read();
  expect(still.planCard).toBe("0s, 0s, 0s");
  expect(still.themeButton).toBe("0s, 0s, 0s");
  expect(still.body).toBe("0s, 0s");
  expect(still.lift).toBe("0px");
  /* The sheet's own hand-written `transition: none` predates the tokens and
     still wins outright — belt and braces on an accessibility guarantee. */
  expect(still.sheet).toBe("0s");
});

test("focus is one visible ring from the tokens, and it never glows", async ({ page }) => {
  await page.setContent(`<button id="first">first</button><a id="second" href="#">second</a>`);
  await page.addStyleTag({ content: css });
  await page.keyboard.press("Tab");

  const ring = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const style = getComputedStyle(element);
    return {
      id: element.id,
      focusVisible: element.matches(":focus-visible"),
      width: style.outlineWidth,
      style: style.outlineStyle,
      offset: style.outlineOffset,
      shadow: style.boxShadow,
    };
  });

  expect(ring.id).toBe("first");
  expect(ring.focusVisible).toBe(true);
  expect(ring.width).toBe("2px");
  expect(ring.style).toBe("solid");
  expect(ring.offset).toBe("3px");
  /* No-glow is a standing brand rule: the ring is a solid outline, and the
     focus state adds no shadow of any blur to hide behind. */
  expect(ring.shadow).toBe("none");
});
