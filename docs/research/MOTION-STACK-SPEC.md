# Motion stack — implementation spec

*Research and specification, August 10, 2026. Written for the agent who implements it, not for the reader who admires it. Every claim about this repo carries a `file:line`; every claim about the platform carries a source at the bottom. Where I am inferring rather than verifying, the sentence says so.*

**Scope.** Five founder asks, one spec:

| # | Ask (founder's words) | Section |
|---|---|---|
| a | "text-box mouseovers that currently DO NOT WORK" — fix them | §4 diagnosis, §5 fix |
| b | "little stars of WebGL-accelerated lighting slowly moving down the frame of the text boxes" | §6 |
| c | "a nice slow activated responsiveness of a soft slow warming glow" | §5 |
| d | Framer Motion added | §7 |
| e | Lenis smooth scrolling added | §3 |

**Non-negotiable constraints carried through every section:** BRAND.md §1 (restraint is the premium signal), §2 (paper ground, emerald as *the* accent, "no glow anywhere" as amended by the founder on Aug 10 to "no glow louder than the approved whisper"), §5 (no exclamation marks), §8 (damped never bouncy, scroll owns the timeline, `prefers-reduced-motion` gets a still of equal beauty, micro-interactions 150–250 ms). The R3F scroll story must not regress. Deadline is Aug 21, 2026, so §9 orders the work so that a partial landing is still a shippable landing.

---

## 1. Packages — exact choices and versions

Add exactly two runtime dependencies to `app/package.json`:

```jsonc
"dependencies": {
  "lenis": "^1.3.26",     // latest as of Aug 10 2026; zero runtime deps; exports "./react"
  "motion": "^13.1.0"     // Motion for React, the package formerly called framer-motion
}
```

```bash
cd C:\Users\lucid\Desktop\aura-homes\app
npm i lenis@^1.3.26 motion@^13.1.0
```

**Notes the implementer will otherwise trip on.**

- `motion@13.1.0` declares `framer-motion@^13.1.0` as a *dependency*, so both package names appear in the lockfile. That is expected and is not a duplicate bundle — only what you import gets bundled. Import from `motion/react` and `motion/react-m`; never add `framer-motion` to `package.json` yourself.
- `motion` peer-deps are `react: ^18.0.0 || ^19.0.0`, and this app is on React 18.3.1 — compatible, no override needed.
- `lenis` has no runtime dependencies and exposes `./react` from its exports map (`"./react": { "types": "./dist/lenis-react.d.ts", "default": "./dist/lenis-react.mjs" }`), so `import { ReactLenis, useLenis } from 'lenis/react'` resolves without a separate install. The old `@studio-freight/lenis` and `@studio-freight/react-lenis` names are dead; do not use them.
- Next.js 14 static export (`output: "export"` under `GH_PAGES=1`, `next.config.mjs:12-19`) needs **no config change** for either package. Both are client-only: every import must sit in a file that already carries `"use client"`. `SiteShell.tsx` and `Story.tsx` both do.
- Do **not** add `transpilePackages`. Neither package needs it on Next 14.

### 1.1 Bundle budget

| Item | Cost | Source |
|---|---|---|
| `motion` component (full) | 34 kB | motion.dev/docs/react-reduce-bundle-size |
| `m` + `LazyMotion` (initial render) | **4.6 kB** | same |
| `+ domAnimation` (animations, variants, exit, tap/hover/focus gestures) | **+15 kB** | same |
| `+ domMax` (adds pan/drag and layout animations) | +25 kB | same |
| `lenis` core | ~10 kB min+gzip (order of magnitude — **measure, do not trust this number**) | see §8.3 |

**Decision: `LazyMotion` + `m` + `domAnimation`, loaded asynchronously.** We need variants, `whileInView`, `AnimatePresence` exits, and hover/tap gestures. We need neither drag nor layout animations, and §7.3 explains why layout animations are actively harmful here. Budget: **≈ 30 kB gzip added, of which 15 kB is an async chunk that never blocks first paint.**

Enforce it. Add to `app/.eslintrc.json` (create if absent):

```jsonc
{
  "rules": {
    "no-restricted-imports": ["error", {
      "paths": [
        { "name": "motion/react", "importNames": ["motion"],
          "message": "Use `m` from 'motion/react-m' inside <LazyMotion features={loadDomAnimation}>. The full `motion` component is 34kB; `m` is 4.6kB. See docs/research/MOTION-STACK-SPEC.md §1.1." },
        { "name": "framer-motion",
          "message": "Import from 'motion/react' instead — 'motion' is the current package name." }
      ]
    }]
  }
}
```

---

## 2. The one thing that makes this safe: Lenis runs on native scroll

This is the load-bearing fact for the whole integration, and it is the reason Lenis is a safe addition to a scroll-driven R3F scene when Locomotive Scroll v4 would not have been.

> Lenis "runs on native scroll — wraps the browser's own scroll, so `position: sticky`, anchor links, and accessibility keep working." — darkroomengineering/lenis README

Lenis does **not** translate a content wrapper. It intercepts wheel and key input, integrates a virtual scroll target, and each frame calls the browser's own scroll API. Consequences for this codebase, all of them good:

- `window.scrollY` stays truthful → `Story.tsx:260` `progressFor(window.scrollY)` keeps working **unchanged**.
- `getBoundingClientRect()` stays truthful → `CardFX.tsx:303` keeps working unchanged.
- `position: fixed` keeps working → `.story-stage` (`globals.css:340-345`), `.story-sky`, `.story-grain`, the R3F canvas (`StoryCanvas.tsx:52`), `.story-chrome`, and the HUD all keep working.
- `IntersectionObserver` keeps working → `CardFX.tsx:231` and `Story.tsx:287` unchanged.
- `100svh` / `100vh` sizing keeps working.

So the migration is genuinely additive. The known caveat from the Lenis issue tracker is that `position: fixed` "seems to lag on macOS Safari pre-M1" (lenis issue #103) — pre-2020 Intel Macs only, and the symptom is a shimmer on fixed layers, not a break. Accept it; note it in `docs/AUDIT-LOG.md`.

---

## 3. Lenis × the R3F scroll story — the integration, precisely

### 3.1 Frame ownership — the decision, and why

There are three things that want a `requestAnimationFrame`: Lenis, Motion, and R3F. The correct arrangement is **two loops, one source of truth**, not one loop.

```
                    ┌──────────────────────────────────────────────┐
  wheel / keys ───► │ Motion's `frame` scheduler  (ONE rAF)         │
                    │   frame.update  → lenis.raf(timestamp)        │
                    │                    └─► window scroll position │
                    │                    └─► lenis.on('scroll') ────┼──► progressRef.current  (a plain number)
                    │   frame.read    → CardFX measures card rects  │
                    │   frame.render  → Story paint() writes styles │
                    └──────────────────────────────────────────────┘
                                                                     │
                    ┌──────────────────────────────────────────────┐ │
                    │ R3F's own rAF (Canvas frameloop)              │◄┘  reads
                    │   useFrame → damp(smooth, progressRef, λ, dt) │
                    │   → camera, light rig, beat props             │
                    └──────────────────────────────────────────────┘
```

**Do not drive Lenis from `useFrame`.** It is the pattern people reach for and in this specific codebase it produces an unscrollable page. Five independent reasons, each verifiable in the source:

1. `StoryCanvas` is not mounted for the first 1600 ms — `Story.tsx:163-168` gates `canvasBoot` behind a `setTimeout` so the gate film gets the wire first. Lenis would not tick until then.
2. If WebGL is unavailable, `StoryCanvas.tsx:33` renders `<StillScene/>` and **there is no `<Canvas>` at all**. Scroll would be permanently dead for those visitors.
3. `StoryCanvas.tsx:39` sets `frameloop={reduced ? "demand" : "always"}`. Under `prefers-reduced-motion` R3F renders on demand only, so `useFrame` effectively stops. Scroll would be dead for exactly the users least able to work around it.
4. `Scene` is inside `<Suspense fallback={null}>` (`StoryCanvas.tsx:55`). While suspended, no `useFrame`.
5. Only `/` mounts the canvas. `/budget`, `/escrow`, `/dashboard` and the rest have none, and the founder wants smooth scroll site-wide.

Motion's `frame` scheduler is both the officially documented Lenis driver *and* independent of all five failure modes, which is the second reason Motion earns its place in this stack (§7.1).

**Do not try to force ordering between Motion's rAF and R3F's rAF.** Both are `requestAnimationFrame` callbacks in the same browser frame; whichever registered first runs first. Worst case the camera reads a `progressRef` that is one frame (≈16.7 ms) stale. With the damping constant specified in §3.4 (τ = 83 ms) that is a ≤ 20% phase error for a single frame — below perception. Chasing it costs complexity and buys nothing.

### 3.2 The provider — new file `app/components/LenisProvider.tsx`

```tsx
"use client";

/* ---------------------------------------------------------------------
   SMOOTH SCROLL — Lenis, driven from Motion's frame scheduler.

   Lenis wraps NATIVE scroll (it does not transform a content wrapper), so
   window.scrollY, getBoundingClientRect, position:fixed, and
   IntersectionObserver all keep telling the truth. That is why the R3F
   story could adopt it without rewriting its scroll maths.

   The rAF belongs to Motion (`frame.update`), NOT to R3F's useFrame: the
   story canvas is absent for the first 1.6 s, absent entirely without
   WebGL, and on `frameloop="demand"` under reduced motion. Any of those
   would leave the page unscrollable if Lenis rode useFrame.
   See docs/research/MOTION-STACK-SPEC.md §3.1.
--------------------------------------------------------------------- */

import { ReactLenis, type LenisRef } from "lenis/react";
import { cancelFrame, frame } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** One tuned constant, and the reason for it, in one place.
 *  lerp 0.1 → time constant ≈ 158 ms at 60 fps. Paired with the scene's
 *  camera damp at λ = 12 (τ ≈ 83 ms) that is ≈ 241 ms of total lag from
 *  wheel to camera — inside the 260 ms budget in §8.2. Raising lerp makes
 *  the wheel snappier and the story feel cheaper; lowering it makes the
 *  camera feel detached from the hand. Do not change one without §3.4. */
export const LENIS_LERP = 0.1;

export default function LenisProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<LenisRef | null>(null);
  const pathname = usePathname();

  // One rAF for Lenis and Motion both. `true` = keep-alive (re-schedules
  // itself every frame) rather than a one-shot.
  useEffect(() => {
    const update = (data: { timestamp: number }) => {
      lenisRef.current?.lenis?.raf(data.timestamp);
    };
    frame.update(update, true);
    return () => cancelFrame(update);
  }, []);

  /* Next's app router restores scroll on navigation; Lenis holds its own
     animated value, so without this the new route starts mid-animation and
     eases backwards to the top. `immediate` is a hard set, no tween. */
  useEffect(() => {
    lenisRef.current?.lenis?.scrollTo(0, { immediate: true });
  }, [pathname]);

  return (
    <ReactLenis
      root
      ref={lenisRef}
      options={{
        autoRaf: false,      // we own the loop, see above
        lerp: LENIS_LERP,    // frame-based smoothing; ignore `duration`/`easing`
        smoothWheel: true,
        syncTouch: false,    // §3.7 — never true
        anchors: false,      // we route through lenis.scrollTo explicitly
        overscroll: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}
```

Mount it in `app/components/SiteShell.tsx` **above** the `isStory` branch (`SiteShell.tsx:97`), so both the story route and the app routes get it:

```tsx
export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStory = pathname === "/";

  return (
    <LenisProvider>
      <LazyMotion features={loadDomAnimation} strict>   {/* §7.2 */}
        <MotionConfig reducedMotion="user">
          {isStory ? (
            <><StoryHeader />{children}<CardFXLayer /></>
          ) : (
            <><CardFXLayer />{/* …existing header / main / footer… */}</>
          )}
        </MotionConfig>
      </LazyMotion>
    </LenisProvider>
  );
}
```

`ReactLenis root` applies to the `<html>` scroller and publishes the instance to `useLenis()` anywhere below it — no prop drilling.

### 3.3 Reading the scroll — replace the window listener

`Story.tsx:221-283` currently listens to `window.scroll` and self-throttles with an inner `requestAnimationFrame`. Under Lenis that is one frame late and one rAF redundant: Lenis writes the scroll position and *then* the browser fires `scroll`. Subscribe to Lenis instead.

Replace the body of that effect's listener wiring (keep `measure`, `progressFor`, and `paint` exactly as they are):

```tsx
import { useLenis } from "lenis/react";
import { frame, cancelFrame } from "motion/react";

// …inside Story():

const applyRef = useRef<(y: number) => void>(() => {});

// The scroll → progress → plate-opacity pipeline, unchanged in maths.
useEffect(() => {
  let anchors: number[] = [];
  const measure = () => { /* …unchanged, Story.tsx:224-234… */ };
  const progressFor = (y: number) => { /* …unchanged, Story.tsx:235-241… */ };

  /* Signage law, unchanged (Story.tsx:245-255) — but the style WRITES now
     go through frame.render so they land after every frame.read in the
     same tick. That is what removes the read-after-write layout thrash
     against CardFX's rect measurements. See §4 finding H10. */
  const paint = (p: number) => { /* …unchanged body… */ };

  applyRef.current = (y: number) => {
    const p = progressFor(y);
    progressRef.current = p;                 // R3F reads this, no React render
    frame.render(() => paint(p));
    const a = Math.round(p);
    if (a !== activeRef.current) { activeRef.current = a; setActive(a); }
  };

  const onResize = () => { measure(); applyRef.current(window.scrollY); };
  measure();
  applyRef.current(window.scrollY);
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);

/* Lenis drives it. `lenis.scroll` is the SMOOTHED value (what the eye is
   about to see); `lenis.actualScroll` is window.scrollY (what it saw last
   frame). Use the smoothed one — the camera then leads by a frame instead
   of trailing by one. Fires inside the same rAF tick as lenis.raf(). */
useLenis((lenis) => applyRef.current(lenis.scroll));
```

`useLenis(callback, deps, priority)` — the third argument orders callbacks when several subscribe; leave it unset here.

**Fallback when Lenis is absent.** If `prefers-reduced-motion: reduce`, Lenis disables smoothing but still ticks, so `useLenis` still fires. If a future change removes Lenis entirely, keep a guard: subscribe to `window.scroll` (passive) only when `useLenis()` returns `undefined`. Six lines, and it means the story can never ship unscrollable.

### 3.4 Double-smoothing — the maths, and the exact constant to change

This is the trap. The scene already damps, so adding Lenis puts two first-order lags in series and the camera starts arriving late in a way that reads as "mushy," not "smooth."

**Lenis.** `lerp` is applied per frame and Lenis normalises it against 60 fps internally, so the feel is the same on a 120 Hz display. Time constant:

```
τ_L = −Δt / ln(1 − lerp)          Δt = 1/60 s
lerp 0.08 → τ_L = 0.200 s
lerp 0.10 → τ_L = 0.158 s   ← default
lerp 0.12 → τ_L = 0.130 s
```

**The scene.** `THREE.MathUtils.damp(a, b, λ, dt)` is `lerp(a, b, 1 − e^(−λ·dt))`, which is framerate-independent by construction. Time constant τ_S = 1/λ.

```
Scene.tsx:1739   r.smooth   = damp(r.smooth, progressRef.current, 5, d)   → τ_S = 0.200 s
Scene.tsx:1880   rig.smooth = damp(rig.smooth, target,            5, …)   → τ_S = 0.200 s
```

**Cascaded, apparent lag ≈ τ_L + τ_S:**

| Configuration | τ_L | τ_S | Total | Verdict |
|---|---|---|---|---|
| Today (no Lenis) | 0 | 0.200 | **0.200 s** | the current, approved feel |
| Lenis added, λ untouched | 0.158 | 0.200 | **0.358 s** | +79% lag — this is the regression |
| Lenis added, **λ = 12** | 0.158 | 0.083 | **0.241 s** | **specified** |
| Lenis added, λ = 16 | 0.158 | 0.063 | 0.221 s | acceptable; starts to show scroll jitter |
| Lenis lerp 0.14, λ = 5 | 0.111 | 0.200 | 0.311 s | wrong lever — makes the wheel harsh and stays mushy |

**Change: λ 5 → 12 at both call sites.** Not one. `Scene.tsx:1739` drives the camera; `Scene.tsx:1880` drives the light/dusk rig. Leave them mismatched and the world's light will lag the camera's arrival by ~120 ms at every beat — the sun visibly catching up after the shot settles.

Make it one named constant so it cannot drift again:

```ts
/* Scroll-damping rate. λ = 12 → τ ≈ 83 ms. This is deliberately STIFFER
   than the pre-Lenis value of 5: Lenis now supplies the smoothing (τ ≈
   158 ms at lerp 0.1) and this damp's remaining job is only to keep
   programmatic jumps — lenis.scrollTo, rail clicks, deep links — from
   hard-cutting the camera. Two lags in series; see MOTION-STACK-SPEC §3.4.
   If Lenis is ever removed, put this back to 5. */
const SCROLL_DAMP = 12;
```

Leave alone: the pointer-parallax damps at `Scene.tsx:1740-1741` (λ = 3) — they track the mouse, not the scroll, and are unaffected. Leave alone the night-mode fade at `Scene.tsx:1962` (λ = 2.2) — it is a mode crossfade, not a scroll response. Leave alone the `Math.min(dt, 1/20)` clamps; at λ = 12 and dt = 0.05 the per-frame step is `1 − e^(−0.6)` = 0.45, which is stable.

### 3.5 Programmatic scrolling — three places must change

1. **The beat rail.** `Story.tsx:303-306` uses `el.scrollIntoView({ behavior: "smooth" })`. Native smooth scroll and Lenis fight: the browser animates the scroll position while Lenis animates its own target toward the *old* position, and the result stutters or snaps back. Replace:

   ```tsx
   const lenis = useLenis();
   const scrollToBeat = (i: number) => {
     const el = sectionsRef.current[i + 1];
     if (!el) return;
     if (!lenis) { el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }); return; }
     // `block: center` equivalent — Lenis offsets from the element's top.
     const offset = -(window.innerHeight - el.offsetHeight) / 2;
     lenis.scrollTo(el, {
       offset,
       duration: reduced ? 0 : 1.1,
       immediate: !!reduced,
       lock: true,   // ignore wheel input mid-flight so the rail click completes
     });
   };
   ```

2. **The enter gate lock.** `Story.tsx:182-187` toggles `html.story-gated`, which is `overflow: hidden` on html and body (`globals.css:604-605`). Overflow-hidden does not stop Lenis integrating wheel input — it keeps accumulating a virtual target that snaps the moment the lock lifts. Add `lenis.stop()` / `lenis.start()` and keep the CSS as belt and braces:

   ```tsx
   useEffect(() => {
     if (entered) { lenis?.start(); return; }
     document.documentElement.classList.add("story-gated");
     lenis?.stop();
     return () => { document.documentElement.classList.remove("story-gated"); lenis?.start(); };
   }, [entered, lenis]);
   ```

3. **Route exit.** `Story.tsx:191-202` dips the veil then `router.push`. No change needed — the `usePathname` effect in `LenisProvider` resets scroll on arrival.

Also: **remove any `scroll-behavior: smooth`** from CSS before shipping. There is none in `globals.css` today (verified by grep), but Tailwind's `scroll-smooth` utility would introduce it. Note it in the PR description so nobody adds it.

### 3.6 Reduced motion

Lenis handles this itself: with `prefers-reduced-motion: reduce`, smoothing disables and programmatic scrolls jump instantly. So there is nothing to branch on for Lenis, and the `reduced` state in `Story.tsx:204-211` keeps doing its existing job (still camera, still copy).

The full reduced-motion contract after this work — BRAND.md §8 demands "a still of equal beauty," so all four of these must hold together:

| Layer | Reduced-motion behaviour | Where |
|---|---|---|
| Lenis | smoothing off, jumps instant | built in |
| R3F scene | `frameloop="demand"`, camera pinned to `REDUCED_SHOT` | `StoryCanvas.tsx:39`, `Scene.tsx:1725-1733` |
| Card FX (stars) | canvas never created | `CardFX.tsx:162-164` — keep |
| Hover glow | `transition: none` | `globals.css:1212-1218` — keep, extend to the new properties |
| Motion | `<MotionConfig reducedMotion="user">` — transform and layout animations off, opacity kept | §7.2 |

The four `matchMedia("(prefers-reduced-motion: reduce)")` listeners currently duplicated at `Story.tsx:206`, `StoryChrome.tsx:64`, and `CardFX.tsx:162` should collapse into one shared hook plus `MotionConfig`. That is a §9 clean-up, not a blocker.

### 3.7 Touch — leave it native

Do **not** set `syncTouch: true`. It replaces the OS touch scroller with a JS one; the failure mode is momentum that feels wrong on iOS and a page that "sticks" during a fling. Default `false` means phones get native scrolling — which is also consistent with `CardFX.tsx:163-164` already disabling the FX layer on coarse pointers, and with `.story-plate` becoming a bottom sheet under 768px (`globals.css:1117-1138`). Mobile gets the story, not the smoothing.

### 3.8 Anti-patterns — do not do these

1. Driving `lenis.raf` from `useFrame` — §3.1, five failure modes.
2. Leaving `autoRaf` at its default while also calling `raf` yourself — Lenis would integrate twice per frame and scroll at double speed.
3. Wrapping the page in a `<div>` scroll container and pointing Lenis at it — that breaks `position: fixed` for `.story-stage`, `.story-sky`, and the R3F canvas. Use `root`.
4. Adding Motion's `useScroll` / `useTransform` to derive story progress — a second scroll subscription with a second spring. `progressRef` written from `lenis.on('scroll')` is the single source of truth.
5. "Fixing" the double-smoothing by lowering Lenis's `lerp` — that makes the wheel harsh and leaves the camera lag untouched. The lever is λ (§3.4).
6. Calling `lenis.resize()` on every scroll. Lenis observes with a `ResizeObserver` already. `Story.tsx`'s own `measure()` on resize is the part that matters.

---

## 4. The broken mouseovers — diagnosis

I read the hover path end to end. **The hovers are not one bug; they are four stacked, and two of them mean the effect is invisible even when the CSS fires correctly.** Findings first, with a falsifiable test each; the general checklist follows in §4.2 for anything I have not reproduced.

### 4.1 Confirmed in this repo

**H1 — Specificity: the reveal rule eats the fx `transition` list.** *(highest confidence, biggest single cause)*

```
globals.css:246   .story-js .story-scope [data-rv] { … transition: opacity .75s …, transform .9s …; }    specificity (0,3,0)
globals.css:1175  .aura-panel, .fx-card, [data-fx]  { transition: text-shadow .55s, box-shadow .55s, … }  specificity (0,1,0)
```

`transition-property` is a single list, not a composed set. On any element carrying **both** attributes the reveal rule wins and `text-shadow`, `box-shadow`, `border-color`, and `background-color` are not in the transition list at all — they snap in 0 s.

The hero IN/OUT ledger is exactly that element: `Story.tsx:91-94` renders `class="story-ledger fx-card"` **and** `data-rv` **and** `data-fx` on the same `<dl>`.

> **Test.** Hover the hero ledger, then in DevTools read `getComputedStyle($0).transitionProperty`. It returns `opacity, transform`. It must contain `text-shadow`.

**H2 — The same collision one level down, on every plate's contents.** `text-shadow` is inherited, so when `.story-plate.fx-card:hover` changes it the children's computed value changes too — but whether a child *eases* into it depends on that child's own `transition-property`. Every `[data-rv]` child inside a plate (`.story-body`, `.story-ledger`, `.story-band`, `.story-mline`, `.story-cta`, `.story-kicker` — `Story.tsx:68, 91, 108, 129, 359, 370`) lists only `opacity, transform`. So the plate eases over 550 ms while its contents pop instantly. That reads as broken even to someone who cannot name why.

**H3 — `overflow: hidden` on the word mask clips the heading glow entirely.**

```
globals.css:230-237   .story-wmask { display: inline-block; overflow: hidden; … }
```

`Reveal` (`Story.tsx:39-62`) wraps **every word of every display heading** in `.story-wmask`. `text-shadow` paints outside the glyph's box; an `overflow: hidden` ancestor clips it. So the largest type on every plate — the first thing an eye tests when someone says "hover the card" — shows no glow whatsoever.

> **Test.** In DevTools set `.story-wmask { overflow: visible }` and hover a plate. The heading glow appears.

**H4 — Even where it fires, it is below the perceptual floor, and it is the wrong sign.**

`globals.css:1185` — `text-shadow: 0 0 16px rgba(4, 120, 87, 0.28)`.

A 16 px Gaussian spread applied to a ~2 px glyph stem redistributes the stem's alpha over roughly eight times its width; peak halo alpha lands near **0.03**. Composited over `#fafaf9` paper, `#047857` at α 0.03 moves luminance by about **2–3 units out of 255** — under the just-noticeable difference for a soft, low-frequency edge.

And the sign is wrong. `text-shadow` paints *behind* the glyph. On a **light** ground, adding a darker halo does not read as "warming"; it reads as "the text went slightly out of focus." **You cannot make light on paper by adding shadow.** That is the craft finding, and §5 is built on it.

**H5 — Hover is gated to the middle 73% of each beat.** `Story.tsx:252` — `el.style.pointerEvents = o > 0.6 ? "auto" : "none"`. With the fade window `o = 1 − smoothstep(0.3, 0.5, |p − k|)`, `o > 0.6` resolves to roughly `|p − k| < 0.366`. Outside that band the plate is still *visible* (down to `o = 0.008`) but inert. Park at a beat edge, hover a plate you can plainly read, and nothing happens. This is not a bug — it is a deliberate guard against hovering a ghost — but it is a large part of "sometimes it works." Consider raising the threshold to `o > 0.35` so the interactive window matches the legible window.

**H6 — Cards inside a `position: fixed` layer: wired correctly, do not "fix" it.** `.story-stage` is `position: fixed; inset: 0; z-index: 3; pointer-events: none` (`globals.css:340-345`), and each plate's `pointer-events` is written per frame by `paint()`. This is the textbook failure shape, and here it is already right. Anyone who "cleans up" the layer by giving it `pointer-events: auto` will break the R3F pointer parallax; anyone who removes the inline write will break hover completely. Comment it in place.

**H7 — The R3F canvas is not stealing hover, but it does own the pointer where paper does not cover it.** Verified in the installed package, not assumed:

- `node_modules/@react-three/fiber/dist/react-three-fiber.cjs.dev.js:113` — `state.events.connect(… divRef.current)`. R3F v8 attaches its listeners to the Canvas's inner wrapper `<div>`, **not** to `document`. It cannot intercept hover on DOM siblings.
- `node_modules/@react-three/fiber/dist/events-…cjs.dev.js:2291-2299` — the registered set is `click`, `dblclick`, `wheel` (passive), `pointerdown`, `pointermove`, and friends. `wheel` being **passive** matters for §3: R3F never calls `preventDefault` on it, so wheel events reach Lenis on `window` unimpeded.

The container sits at `z-index: 0` (`StoryCanvas.tsx:52`) with default `pointer-events: auto`, so it does receive the pointer anywhere paper does not cover it. Visible consequence: `state.pointer` (`Scene.tsx:1740-1741`) freezes while the cursor is over a plate, so the hand-held parallax stops during a hover. That is arguably correct — the world holds still while you read — but it is worth knowing before someone files it as a bug.

**H8 — The app routes have the same invisibility problem.** `globals.css:1188-1195`: `.aura-panel:hover` adds `0 0 34px -6px rgba(16,185,129,0.14)`. The `−6px` spread pulls the shadow back inside the border before the 34 px blur begins, so most of it never escapes the box. Net visible change is on the order of one luminance unit. 28 `.aura-panel` instances across seven pages are all affected.

**H9 — The media query can be silently false on the founder's own machine.** Both the CSS block (`globals.css:1171`) and the whole FX canvas (`CardFX.tsx:163-164`) are gated on `(hover: hover) and (pointer: fine)` / `(hover: none), (pointer: coarse)`. On a Windows touchscreen laptop — which this project is being built on — Chrome can report the *primary* pointer as coarse, which switches **both** effects off entirely with no visual trace.

> **Test, run this first, before anything else.** In the console: `matchMedia('(hover: hover) and (pointer: fine)').matches`. If it is `false`, nothing in §5 or §6 will ever appear on that machine, and the fix is `@media (any-hover: hover)` (see §5.4), not more CSS.

**H10 — Two rAF loops thrash layout every scrolled frame.** `Story.tsx:250-253` *writes* `el.style.opacity / visibility / pointerEvents` in one rAF; `CardFX.tsx:303` *reads* `getBoundingClientRect()` on up to 14 elements in another. Read-after-write in the same frame forces a synchronous layout. Not a hover bug, but it is why hover response feels sticky during scroll, and it is fixed for free by routing writes through `frame.render` and reads through `frame.read` (§3.3, §6.5).

### 4.2 General diagnostic checklist

Work top to bottom; each step is one console line or one DevTools toggle. Ordered by how often it is the answer.

1. **Does the pointer media query even match?** `matchMedia('(hover:hover) and (pointer:fine)').matches` → if false, that is the whole answer (H9).
2. **Is the element receiving the pointer at all?** `document.elementFromPoint(x, y)` with the cursor parked over the card. If it returns an overlay, a canvas, or a `<html>` — something is on top.
3. **What is on top?** In DevTools, force `:hover` on the element (Styles pane → `:hov`). If the styles apply when forced but not on a real hover, it is an overlay or a `pointer-events` problem, not a CSS problem.
4. **`pointer-events` on the element and every ancestor.** Look for `none` set inline (this codebase writes it per frame — H5) or on a fixed wrapper (H6). Remember `pointer-events: none` on a parent is inherited-by-default for hit-testing; a child needs `auto` explicitly.
5. **`transition-property` on the element you are hovering.** If another rule with higher specificity set a `transition` shorthand, your properties are simply not in the list (H1, H2). Check `getComputedStyle(el).transitionProperty`, not the source file.
6. **Is the property inherited rather than set?** `text-shadow` and `color` inherit; children need their own transitions or they snap (H2). Prefer animating a registered custom property that children *read* — §5.2.
7. **Is an ancestor clipping the paint?** `overflow: hidden`, `clip-path`, or `contain: paint` on a wrapper will cut a shadow or glow off at the box edge (H3). Search ancestors for `overflow`.
8. **Is the change actually visible?** Screenshot at rest and at +700 ms of hover, diff them, and compute mean ΔE00 over the text bounding box. Under ~1.2 nobody sees it (H4, H8). This is the step people skip, and it is why "the CSS is correct but the hover doesn't work" is a real and common sentence.
9. **Opacity-0 hit targets.** An element at `opacity: 0` still receives pointer events. Hovering it "works" and shows nothing. `visibility: hidden` and `display: none` do not.
10. **A fixed/absolute sibling with a higher stacking position and no `pointer-events: none`.** Check every `position: fixed` in the stylesheet; this codebase has eight (`.story-sky`, `.story-grain`, `.story-stage`, `.story-veil`, `.story-rail`, `.story-gate`, `.story-hud`, `.story-chrome`, `.fx-tracer-canvas`) and all of them are currently correct.
11. **A WebGL/Canvas element covering the viewport.** Check `pointer-events` and `z-index` on the canvas container; R3F sets neither for you. (Here: `StoryCanvas.tsx:52` — `z-index: 0`, `pointer-events` default.)
12. **React re-render blowing away hover state.** If hover is driven by React state rather than CSS, a parent re-render mid-hover can drop it. Not applicable here — the effects are CSS and a rAF canvas — and that is a reason to keep them that way.
13. **The element you think you are hovering is not the element with the rule.** `$0.matches('.fx-card')` in the console after selecting it with the picker.

---

## 5. The warming glow — spec

### 5.1 The physics, stated once

The ground is `#fafaf9` (L\* ≈ 98). There is almost no headroom above it: additive light can raise luminance by at most ~2%, and a shadow can only darken. So on paper, **"glow" cannot be a luminance effect. It has to be a chroma effect.** What reads as *warming* on a white page is the ink and the paper shifting temperature toward the accent, plus a tight halo where the emerald bleeds a fraction of a pixel past the glyph — the way real ink blooms on real stock.

This is also why the current effect fails (H4) and why the existing WebGL blend mode is already right: `CardFX.tsx:212` uses `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)` — premultiplied source-over, not additive. Additive over paper would clamp to white and lose the hue. Whoever wrote that got it right; keep it (§6.4).

Four coordinated moves, all on one curve:

| # | Move | Rest | Hovered |
|---|---|---|---|
| 1 | **Ink temperature** | `#171a18` | `color-mix(in oklab, #171a18 88%, #047857)` ≈ `#161f1b` |
| 2 | **Glyph bloom** — tight first, wide second | none | `0 0 0.5px` emerald 34%, `0 0 4px` emerald 20%, `0 0 14px` emerald 10% |
| 3 | **Paper temperature** | `#fafaf9` | `#fbfdfb` (+1 G, warm-green) |
| 4 | **Card light** — an inset ring, not an outer bloom | hairline `rgba(23,26,24,0.14)` | `inset 0 0 0 1px` emerald 12%, hairline → emerald 22% |

Move 2 is where the money is. The `0.5px` layer thickens the stem by a fraction of a pixel *in emerald*; the `4px` and `14px` layers only give it air. Reverse the weighting — wide and strong, tight and absent — and you get the neon that BRAND.md §1 forbids.

### 5.2 The mechanism that dodges H1 and H2 entirely: one registered custom property

Do not try to win the specificity fight. `transition-property` is one list per element, so as long as the reveal system and the fx system both want it on the same element, one of them loses. Instead, animate **one number** on the card and let every descendant *read* it.

```css
/* Registered so it interpolates. Without @property a custom property is a
   token, not a value, and it JUMPS — which is exactly today's behaviour, so
   the degradation on an unsupporting browser is "no worse than now."
   @property: Chrome 85, Safari 16.4, Firefox 128 (Jul 2024) — Baseline
   "newly available"; re-check caniuse before shipping. */
@property --fx-warm {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}
```

Because `--fx-warm` inherits, one transition on the card animates a value that **every descendant sees updating per frame**, with no transition of their own. H1 and H2 stop being reachable.

```css
@media (any-hover: hover) {           /* see §5.4 on any-hover vs hover */
  .fx-card,
  .aura-panel,
  [data-fx] {
    /* Asymmetric on purpose: light warms slowly and cools a little faster.
       Symmetric timing reads as lag; this reads as a filament. */
    transition: --fx-warm 560ms cubic-bezier(.32, .08, .24, 1) 80ms;
  }
  .fx-card:hover,
  .fx-card:focus-within,
  .aura-panel:hover,
  .aura-panel:focus-within,
  [data-fx]:hover,
  [data-fx]:focus-within {
    --fx-warm: 1;
    transition: --fx-warm 380ms cubic-bezier(.4, 0, .6, 1) 0ms;
  }

  /* --- the four moves, all reading the one number --- */
  .fx-card, .aura-panel, [data-fx] {
    color: color-mix(in oklab,
            var(--st-ink) calc(100% - 12% * var(--fx-warm)),
            var(--st-emerald-deep));
    text-shadow:
      0 0 0.5px rgb(16 185 129 / calc(0.34 * var(--fx-warm))),
      0 0 4px   rgb(16 185 129 / calc(0.20 * var(--fx-warm))),
      0 0 14px  rgb(16 185 129 / calc(0.10 * var(--fx-warm)));
    background-color: color-mix(in oklab,
            var(--st-paper) calc(100% - 100% * var(--fx-warm)),
            #fbfdfb);
    border-color: color-mix(in srgb,
            var(--st-hair) calc(100% - 60% * var(--fx-warm)),
            rgb(16 185 129 / 0.34));
  }

  /* The card's own light. Inset, so it never becomes an outer bloom.
     Story plates keep their directional paper shadow — that is depth, and
     BRAND.md §2 keeps depth while refusing glow. */
  .story-plate.fx-card {
    box-shadow:
      inset 0 0 0 1px rgb(16 185 129 / calc(0.12 * var(--fx-warm))),
      var(--st-plate-shadow, 30px 0 90px -66px rgba(23, 26, 24, 0.6));
  }
  .story-plate-left  { --st-plate-shadow:  30px 0 90px -66px rgba(23,26,24,0.6); }
  .story-plate-right { --st-plate-shadow: -30px 0 90px -66px rgba(23,26,24,0.6); }
}

@media (prefers-reduced-motion: reduce) {
  .fx-card, .aura-panel, [data-fx] { transition: none; }
}
```

**Timing, and why not `--st-ease-out`.** The house curve is `cubic-bezier(0.16, 1, 0.3, 1)` (`globals.css:34`) — it completes about 80% of its travel in the first quarter of its duration. That is a *snap*, correct for a plate arriving and wrong for a filament warming. The enter curve here, `cubic-bezier(.32, .08, .24, 1)`, ramps in gently and settles without overshoot; 560 ms plus an 80 ms delay means a cursor crossing a card on its way somewhere else never triggers a visible strobe. Exit at 380 ms with no delay, so the release is honest.

This sits above BRAND.md §8's "micro-interactions 150–250 ms" band. That is deliberate and worth flagging to the founder in the PR: he asked for *slow*, and 560 ms is the slowest a hover can be before it reads as unresponsive rather than considered. If he wants it inside the brand band, 240 ms enter / 180 ms exit with the same curves is the fallback, and the values above become the ceiling rather than the setting.

### 5.3 Fixing the clipped headings (H3)

The word mask must keep clipping during the reveal — the word starts at `translateY(112%)` — but must stop clipping the glow afterwards. `overflow-clip-margin` does exactly this:

```css
.story-wmask {
  display: inline-block;
  overflow: clip;                 /* was: hidden */
  overflow-clip-margin: 0.45em;   /* let the tight bloom layers escape */
  vertical-align: bottom;
  padding-bottom: 0.16em;
  margin-bottom: -0.16em;
}
.story-js .story-w {
  transform: translateY(150%);    /* was 112% — clear the 0.45em margin */
  transition: transform 0.9s var(--st-ease-out);
}
```

`0.45em` at the plate display size (~2 rem) is ~14 px, which covers the `0.5px` and `4px` layers in full and most of the `14px` layer. `translateY(150%)` keeps the un-revealed word fully outside the clip margin so nothing peeks. Browsers without `overflow-clip-margin` treat `overflow: clip` as a hard clip — identical to today, so the fallback is the current behaviour.

> **Verify:** hover a plate and screenshot the heading. The glow must be present *and* must not leak into the line above.

### 5.4 `any-hover` instead of `hover` (H9)

Change the gate on both the CSS and `CardFX.tsx:163`:

```css
@media (any-hover: hover) { … }
```
```ts
const noHover = window.matchMedia("(any-hover: none)");
if (reduced.matches || noHover.matches) return;
```

`hover`/`pointer` describe the *primary* pointer; `any-hover`/`any-pointer` describe whether **any** available pointer can hover. A touchscreen laptop with a trackpad answers `any-hover: hover` correctly and `hover: hover` unreliably. Phones and tablets still answer `any-hover: none` and stay excluded, which is what we want.

### 5.5 Structural change required in `Story.tsx`

The custom-property mechanism needs the `.fx-card` container to not itself be a `[data-rv]` reveal target, or the reveal rule's `transition` list clobbers the `--fx-warm` transition on that one element (H1 again, one level up). One change, in `Ledger` (`Story.tsx:80-104`):

```tsx
// before: <dl className="story-ledger fx-card" data-rv data-fx>
// after:  the fx card wraps the reveal target
<div className={fx ? "fx-card" : undefined} data-fx={fx ? "" : undefined}>
  <dl className="story-ledger" data-rv style={{ transitionDelay: `${delay}ms` }}>
    {/* …rows… */}
  </dl>
</div>
```

The plates themselves (`Story.tsx:354`) already carry `fx-card` without `data-rv`, so they need no change. Once §7.4 moves the reveal system to Motion variants, `[data-rv]` stops carrying a CSS `transition` at all and even this wrapper becomes optional — but do the wrapper now, because it is two lines and it makes the fix independent of whether Motion lands.

---

## 6. The stars — CardFX v2

### 6.1 What the founder asked for, read literally

> "little stars of WebGL-accelerated lighting slowly moving down the frame of the text boxes"

Not one point orbiting the whole perimeter (which is what `CardFX.tsx:308` does today — one head plus a 30-sprite tail, 11 s per full lap). **Several small lights, drifting downward along the vertical edges.** Keep the shared-canvas architecture — the reasoning in the `CardFX.tsx:19-32` header is correct and still applies (browsers cap live WebGL contexts, the story route already spends one, and a rotating conic-gradient border repaints on the main thread every frame).

### 6.2 Parameters

| Parameter | Value | Reason |
|---|---|---|
| Stars per card | **4** — 2 on the left edge, 2 on the right | Fewer reads as a bug; more reads as decoration |
| Path | top corner → down the vertical edge → bottom corner, wrap | "down the frame," literally |
| Speed | **42 px/s**, constant | A fixed *speed*, not a fixed duration, so a 300 px card and an 800 px card look the same. ~14 s on a 600 px plate |
| Phase stagger | `(cardIndex * 0.382 + starIndex * 0.25) % 1` | Keep the existing golden-ratio stride (`CardFX.tsx:258`); it is why neighbours never sync |
| Alpha envelope | `sin(π·u)^0.7` along the edge | Fades in at the top corner, holds, fades out at the bottom. No pops |
| Head core | **3.0 px**, `#10b981` | BRAND.md §8: "ambient drift under ~4px" |
| Tail | **26 px**, `#10b981` → `#0f766e`, alpha `(1−k)^2.2` | Emerald head to teal tail, inside the brand band |
| Halo | 16 px, α ≤ 0.07 | Below the point-size ceiling in §6.3 |
| Peak head alpha | **0.42** at rest (today: 0.50) | Four lights instead of one — hold total luminance flat |
| Twinkle | `0.85 + 0.15·sin(1.7·t + 7·phase)`, **alpha only** | Size flicker reads cheap; alpha flicker reads like light |
| Hover response | brightness ×1.6, speed ×1.25, damped over 600 ms | This is the founder's "activated responsiveness," and it ties the stars to §5 |
| `MAX_TRACED` | 14, unchanged | 14 × 4 = 56 stars worst case |

### 6.3 Switch from `gl.POINTS` to quads — three concrete reasons

The current implementation draws point sprites (`CardFX.tsx:348`, `drawArrays(gl.POINTS, …)`). That has to change:

1. **`gl_PointSize` is capped, and low on Apple silicon.** `gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)` reports a maximum of **64 on M1/M2 GPUs**, while most desktop GPUs allow 512–2048 and the WebGL spec only *requires* 1. The current halo is `22 * dpr` (`CardFX.tsx:337`) = **44 px at dpr 2** — already inside the danger zone, and any larger star halo simply will not render on a MacBook.
2. **A point primitive is discarded whole when its centre leaves the clip volume.** Points cannot be partially clipped: if `gl_Position` falls outside, the entire sprite vanishes. `.story-plate-left` is flush to the viewport at `left: 0` (`globals.css:361`), so a halo there is one pixel of scroll away from popping out of existence rather than sliding off.
3. **A tail wants to be one stretched quad, not thirty stacked circles.** Today's tail costs 30 sprites (`SAMPLES = 30`, `CardFX.tsx:56`) and still bands. One rotated, elongated quad with a gradient in the fragment shader is smoother and costs 4 vertices.

**Cost after the change:** 14 cards × 4 stars × 2 quads (head + tail) = 112 quads = **448 vertices, 672 indices, ~14 KB of `bufferData` per frame**. The current code already uploads ~3,000 floats per frame, so this is the same order. Nothing here is a performance question.

### 6.4 Shaders and buffer layout

Bake the corner positions on the CPU (simplest, fewest attributes, and the CPU work is a few hundred multiply-adds per frame). Keep premultiplied source-over blending exactly as it is — `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)` at `CardFX.tsx:212`. **Do not switch to additive.** Over `#fafaf9` paper, additive clamps to white and throws the emerald away; §5.1.

```glsl
// vertex — 8 floats/vertex: aPos(2), aUV(2), aCol(4, premultiplied)
attribute vec2 aPos;   // device pixels, y down
attribute vec2 aUV;    // 0..1 within the sprite
attribute vec4 aCol;   // premultiplied rgba
uniform   vec2 uRes;
varying   vec2 vUV;
varying   vec4 vCol;
void main() {
  vec2 clip = (aPos / uRes) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUV  = aUV;
  vCol = aCol;
}
```

```glsl
// fragment — uShape 0 = head (radial), 1 = tail (comet)
precision mediump float;
varying vec2 vUV;
varying vec4 vCol;
uniform float uShape;
void main() {
  float a;
  if (uShape < 0.5) {
    float d = length(vUV * 2.0 - 1.0);
    a = smoothstep(1.0, 0.0, d);
    a *= a;                                   // soften the core edge
  } else {
    float across = smoothstep(1.0, 0.0, abs(vUV.y * 2.0 - 1.0));
    float along  = pow(1.0 - vUV.x, 2.2);     // bright at the head end
    a = across * along;
  }
  gl_FragColor = vCol * a;                    // vCol already premultiplied
}
```

Two draw calls per frame (heads batch, tails batch), or one with `aShape` as a fifth attribute. Two calls is clearer and the difference is unmeasurable.

### 6.5 Hover coupling, without per-frame DOM reads

Do not read a CSS custom property per card per frame. Delegate two listeners and damp a number:

```ts
// per-card state, added to the Card type
type Card = { el: HTMLElement; radius: number; phase: number; visible: boolean;
              warm: number; warmTarget: number };

document.addEventListener("pointerover", (e) => {
  const el = (e.target as Element)?.closest?.(SEL) as HTMLElement | null;
  if (el && cards.has(el)) cards.get(el)!.warmTarget = 1;
}, { passive: true });

document.addEventListener("pointerout", (e) => {
  const el = (e.target as Element)?.closest?.(SEL) as HTMLElement | null;
  if (el && cards.has(el)) cards.get(el)!.warmTarget = 0;
}, { passive: true });

// in the frame loop, matching §5.2's 560 ms enter / 380 ms exit:
const k = c.warmTarget > c.warm ? 1 - Math.exp(-dt / 0.24)   // ≈ 560 ms to settle
                                : 1 - Math.exp(-dt / 0.16);  // ≈ 380 ms
c.warm += (c.warmTarget - c.warm) * k;
```

Then `alpha *= 1 + 0.6 * c.warm` and `speed *= 1 + 0.25 * c.warm`.

### 6.6 Other changes to `CardFX.tsx`

- **Move the rect reads into `frame.read`** (Motion's scheduler) so they batch after `Story.tsx`'s `frame.render` writes. This is the H10 fix. The FX loop then becomes: `frame.read(measureAll)` → `frame.update(computeSprites)` → `frame.render(uploadAndDraw)`.
- **Cap the FX canvas DPR at 1.5**, not 2 (`CardFX.tsx:217`). These are blurred sprites; nobody counts their pixels, and it is a 44% fill saving on a Retina display.
- **Keep the idle behaviour** at `CardFX.tsx:350-352` — no rAF when nothing is visible. Extend the idle condition to `no visible cards AND every card.warm < 0.01`, so a hover that ends off-screen still settles before the loop parks.
- **Keep `webglcontextlost` handling** (`CardFX.tsx:369-370`), and add a `webglcontextrestored` handler that rebuilds the program. Two live contexts on this page (scene + FX) is well inside every browser's cap, but a driver reset should not leave a dead canvas behind.
- **Keep the `MutationObserver`** (`CardFX.tsx:275-276`) with its 180 ms debounce. It fires on `childList` only, so Motion's style writes will not trigger it; `AnimatePresence` mounts and unmounts will, which is correct.
- **Add `threshold: 0`** explicitly to the `IntersectionObserver` options (`CardFX.tsx:239`) so the intent is on the page rather than implied.
- **Update the file header comment.** It currently describes one orbiting tracer and cites the founder's Aug 10 restraint parameters as "the values ARE the approval." Rewrite it for four descending stars and re-state the new ceiling, or the next agent will read a spec that no longer matches the code.

---

## 7. Framer Motion — where it earns its place, and where it must not go

### 7.1 The four jobs it is actually for

1. **The frame scheduler.** `frame` splits each animation frame into `read` (measure the DOM), `update` (compute), and `render` (write). Routing `Story.tsx`'s style writes and `CardFX.tsx`'s rect reads through it kills the read-after-write thrash (H10) with no new abstraction, and it is the documented driver for Lenis (§3.2). This alone justifies the dependency.
2. **`AnimatePresence` for the three hand-rolled exits.** The enter-gate leave (`StoryChrome.tsx:75-82`, a `setTimeout(460)` racing a CSS class), the route dip (`Story.tsx:191-202`, `setTimeout(520)`), and the mobile sheet (`SiteShell.tsx:75`). All three are timeouts that must stay in sync with CSS durations by hand; all three are a one-line `AnimatePresence` with `exit` variants.
3. **`whileInView` + variants replacing the `[data-rv]` system.** This is the permanent fix for H1 and H2: once the reveal is a Motion variant, `[data-rv]` no longer carries a CSS `transition` and the specificity collision cannot recur. It also deletes the bespoke `IntersectionObserver` at `Story.tsx:285-301`.
4. **`MotionConfig reducedMotion="user"`.** `"user"` disables transform and layout animations while preserving opacity and background-colour changes — which is exactly BRAND.md §8's "a still of equal beauty." One switch replaces the duplicated `matchMedia` listeners at `Story.tsx:206`, `StoryChrome.tsx:64`, and `CardFX.tsx:162`.

### 7.2 Setup

```tsx
// app/components/motion-features.ts
import { domAnimation } from "motion/react";
export default domAnimation;
```

```tsx
// in SiteShell.tsx (already "use client")
import { LazyMotion, MotionConfig } from "motion/react";

// Async: the 15 kB feature bundle becomes its own chunk and never blocks
// first paint. The 4.6 kB `m` shell renders immediately; features attach
// on arrival. Static export handles the dynamic import fine.
const loadDomAnimation = () => import("./motion-features").then((m) => m.default);

<LazyMotion features={loadDomAnimation} strict>
  <MotionConfig reducedMotion="user">
    {/* … */}
  </MotionConfig>
</LazyMotion>
```

`strict` makes any use of the full `motion` component throw at development time. Combined with the ESLint rule in §1.1, the 34 kB component cannot get in by accident.

Components then use `m`:

```tsx
import * as m from "motion/react-m";

const plate = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] } },
};

<m.p variants={plate} initial="hidden" whileInView="visible"
     viewport={{ once: true, margin: "0px 0px -12% 0px", amount: 0.15 }} />
```

The `viewport` values reproduce the existing observer exactly (`Story.tsx:294-297`: `rootMargin: "0px 0px -12% 0px"`, `threshold: 0.15`, unobserve after first hit).

### 7.3 Where Motion must not go

- **No `layout` or `layoutId`, anywhere.** Layout animations measure with `getBoundingClientRect()` every frame — precisely the read that CardFX is already doing, and precisely the thrash §3.3 exists to remove. `domAnimation` excludes them, which is a feature; do not reach for `domMax` to get them back.
- **No `useScroll` / `useTransform` / `useSpring` for story progress.** A second scroll subscription with a second spring, layered on Lenis and on the scene's damp, is a third lag in the cascade of §3.4. `progressRef` written from `lenis.on('scroll')` is the source of truth.
- **No `motion` component.** `m` only (§1.1).
- **No Motion animations on the plates' `opacity`.** `Story.tsx`'s `paint()` writes plate opacity per frame from the scroll position; a Motion animation on the same property would fight it. Motion owns the *reveal* of contents; the scroll owns the *cross-fade* of plates. Keep that line clean.
- **No `AnimatePresence` around the R3F `<Canvas>`.** Unmount/remount of a WebGL context on a route change is a several-hundred-millisecond stall and risks context eviction.

### 7.4 The `[data-rv]` migration is optional for Aug 21

Job 3 is the largest of the four and touches every copy block. If the deadline bites, ship jobs 1, 2, and 4 plus the `Ledger` wrapper from §5.5, and leave `[data-rv]` as CSS. The `--fx-warm` mechanism in §5.2 does not depend on the migration — it only *benefits* from it.

---

## 8. Performance guardrails

### 8.1 Budgets

| Budget | Limit | How to check |
|---|---|---|
| JS added, gzipped | **≤ 32 kB** total, of which ≤ 17 kB is in the initial chunk | §8.3 |
| Live WebGL contexts on `/` | **2** (scene + FX), never more | `performance.getEntriesByType` will not tell you; count `canvas` elements with a context |
| Forced synchronous layouts per scrolled frame | **0** | DevTools Performance → no "Forced reflow" warnings across a full scroll pass |
| FX canvas CPU per frame at 1440p | ≤ 0.4 ms | Performance panel, the `frame.render` block |
| Wheel → camera settle (within 5% of target) | **≤ 260 ms** | §8.4 |
| Stars on screen | ≤ 56 (14 cards × 4) | `MAX_TRACED` |
| FX canvas DPR | ≤ 1.5 | `CardFX.tsx` resize handler |
| Hover ΔE00 over the text bbox at +700 ms | **≥ 1.2 and ≤ 3.5** | §8.4 — this is the test the current build fails |

### 8.2 Rules

- The FX canvas must **park its rAF** when nothing is visible and nothing is warm. This property already exists (`CardFX.tsx:350-352`); do not lose it in the rewrite.
- Every listener added by this work is `{ passive: true }` except Lenis's own wheel handler, which must not be.
- `will-change` stays where it is (`globals.css:358`, `opacity` on five plates). Do not add `will-change: transform` to cards; five composited layers is a design, forty is a memory problem.
- Nothing in this spec may add a React re-render per frame. `progressRef` is a ref, `setActive` fires only on integer beat change (`Story.tsx:263-267`), and the FX canvas is outside React entirely. Keep all three properties.

### 8.3 Measuring the bundle

```bash
cd C:\Users\lucid\Desktop\aura-homes\app
# baseline first, on a clean tree
GH_PAGES=1 npx next build && du -sk out/_next/static/chunks | tail -1
# then again after the change; the delta is the honest number
```
Do not trust the numbers in §1.1 for `lenis` — they are an order-of-magnitude estimate. Measure, and write the measured figure into `docs/AUDIT-LOG.md`.

### 8.4 Verification protocol — falsifiable, in order

`app/scripts/inspect.mjs` already drives Playwright (in `devDependencies`) and already asserts against the gate and scroll lock (`inspect.mjs:365-371, 576-584`). Extend it.

1. **Precondition.** `matchMedia('(any-hover: hover)').matches === true` on the test machine. If false, everything below is vacuous — fix the machine or the query first (H9). *A check that cannot fail is not a check.*
2. **The transition list is real.** `getComputedStyle(plate).transitionProperty` contains `--fx-warm`. Fails on today's build (H1).
3. **The glow is visible and is not neon.** Screenshot the plate at rest; dispatch a real pointer hover; screenshot at +700 ms. Mean ΔE00 over the heading's bounding box must be **≥ 1.2** (else nobody sees it — H4) and **≤ 3.5** (else it is neon and BRAND.md §1 is broken). Assert both bounds; a one-sided assertion would pass on a blank page.
4. **The heading is not clipped.** The ΔE00 in step 3 measured over the *display heading* specifically, not the body copy. Fails on today's build (H3).
5. **Scroll latency.** Record `performance.now()` at a synthetic wheel event; poll the scene's `smooth` value until it is within 5% of `progressRef.current`. Must be ≤ 260 ms. Guard the guard: run it once with λ forced to 5 and confirm the assertion *fails* at ~358 ms, so you know the metric can distinguish the two builds.
6. **No forced reflow.** Capture a Performance trace across a full scroll pass; assert zero "Forced reflow" entries.
7. **Reduced motion.** With `prefers-reduced-motion: reduce` emulated: `document.querySelector('.fx-tracer-canvas') === null`, the camera is at `REDUCED_SHOT`, and Lenis reports no smoothing. One still frame, of equal beauty.
8. **Route sanity.** Navigate `/` → `/budget` → `/` and assert `window.scrollY === 0` on each arrival and that exactly two canvases exist on `/` and zero on `/budget`.

---

## 9. Implementation order

Ordered so that stopping at any horizontal rule still leaves a shippable site.

**Landing 1 — hover, no new dependencies.** Half a day. Fixes the founder's ask (a) and (c) on their own.
1. `@property --fx-warm` block, the four moves, and the asymmetric curves (§5.2).
2. `overflow: clip` + `overflow-clip-margin` on `.story-wmask`, `translateY(150%)` on `.story-w` (§5.3).
3. `any-hover` in the CSS and in `CardFX.tsx` (§5.4).
4. `Ledger` wrapper in `Story.tsx` (§5.5).
5. Raise the `pointerEvents` gate from `o > 0.6` to `o > 0.35` (H5).
6. Run verification steps 1–4.

---

**Landing 2 — Lenis.** Half a day. Ask (e).
7. `LenisProvider.tsx`, mounted in `SiteShell` above the route branch (§3.2). Motion is needed for `frame` here, so install both packages now.
8. `useLenis` replacing the window scroll listener in `Story.tsx` (§3.3).
9. `SCROLL_DAMP = 12` at **both** `Scene.tsx:1739` and `Scene.tsx:1880` (§3.4).
10. `lenis.scrollTo` in `scrollToBeat`; `lenis.stop()`/`start()` on the gate (§3.5).
11. Run verification steps 5, 7, 8.

---

**Landing 3 — the stars.** One day. Ask (b).
12. Quad batch replacing `gl.POINTS`; four descending stars per card with the §6.2 parameters.
13. Hover coupling via delegated `pointerover`/`pointerout` and a damped `warm` (§6.5).
14. `frame.read` / `frame.update` / `frame.render` split, DPR cap 1.5, `webglcontextrestored` (§6.6).
15. Rewrite the `CardFX.tsx` header comment to describe what the file now does.
16. Run verification step 6 and re-run 3.

---

**Landing 4 — Motion, fully.** One day. Ask (d), completed.
17. `LazyMotion` + `MotionConfig` + the ESLint rule (§1.1, §7.2).
18. `AnimatePresence` on the gate, the veil, and the mobile sheet (§7.1 job 2).
19. `[data-rv]` → `m` variants with `whileInView`; delete the bespoke observer (§7.1 job 3, §7.4).
20. Collapse the three duplicated `matchMedia` listeners into one hook.
21. Full verification pass, all eight steps. Update `docs/AUDIT-LOG.md` with measured bundle deltas and the ΔE00 figures.

---

## 10. Open questions for the founder

1. **560 ms exceeds BRAND.md §8's 150–250 ms micro-interaction band.** He asked for "slow"; the brand doc asks for quick. §5.2 specifies 560/380 and names 240/180 as the in-band fallback. He picks.
2. **Four stars per card versus one.** Four is my reading of "little stars" (plural) "moving down the frame." If he meant one light per edge, halve it and raise peak alpha to 0.5.
3. **Stars ambient or hover-only.** This spec has them ambient at a whisper and brightening 1.6× on hover, which is what makes the hover feel "activated." Hover-only would be quieter and cheaper.
4. **`hover` → `any-hover` widens the effect to touchscreen laptops in a trackpad session.** Correct in my view, but it means a class of device that previously saw nothing will now see the stars.

---

## 11. Sources

Platform and library documentation, all checked August 10, 2026:

- [darkroomengineering/lenis — README](https://github.com/darkroomengineering/lenis) — native-scroll guarantee, options table with defaults, default easing, `data-lenis-prevent`, reduced-motion behaviour, `position: fixed` caveat on pre-M1 Safari
- [lenis/packages/react — README](https://github.com/darkroomengineering/lenis/blob/main/packages/react/README.md) — `ReactLenis` props, `ref.current.lenis`, `useLenis(callback, deps, priority)`, the `autoRaf: false` + external-loop patterns including the Motion `frame`/`cancelFrame` example verbatim
- [lenis on npm](https://www.npmjs.com/package/lenis) — v1.3.26, no runtime dependencies
- [lenis registry metadata](https://registry.npmjs.org/lenis/latest) — exports map including `./react`
- [Motion — Reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size) — 34 kB / 4.6 kB / +15 kB / +25 kB, `domAnimation` vs `domMax` feature split, sync and async `LazyMotion` examples
- [Motion — `frame`](https://motion.dev/docs/frame) — the read / update / render split and `cancelFrame`
- [Motion — Accessibility](https://motion.dev/docs/react-accessibility) — `useReducedMotion`, `MotionConfig reducedMotion` values
- [motion registry metadata](https://registry.npmjs.org/motion/latest) — v13.1.0, React 18/19 peer range, `sideEffects: false`
- [Motion & Framer Motion upgrade guide](https://motion.dev/docs/react-upgrade-guide) — the `framer-motion` → `motion` rename
- [WebGL and GLSL limits](https://math.hws.edu/graphicsbook/demos/c6/webgl-limits.html) and [Working around gl_PointSize limitations](https://webglfundamentals.org/webgl/lessons/webgl-qna-working-around-gl_pointsize-limitations-webgl.html) — `ALIASED_POINT_SIZE_RANGE`, the spec-required minimum of 1
- [Apple Developer Forums — M1/M2 `ALIASED_POINT_SIZE_RANGE`](https://developer.apple.com/forums/thread/714831) — the 64 px cap on Apple silicon versus 512–2048 elsewhere
- [KhronosGroup/WebGL issue #2917](https://github.com/KhronosGroup/WebGL/issues/2917) and [OpenGL Wiki — Vertex Post-Processing](https://wikis.khronos.org/opengl/Vertex_Post-Processing) — points are discarded whole when their centre leaves the clip volume; reproduced across Mac Intel, Mac NVIDIA, Windows Intel, Windows NVIDIA, and iPhone X
- [MDN — `color-mix()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix) and [caniuse — css-color-mix](https://caniuse.com/css-color-mix) — Baseline widely available since 2023, ~93% global
- [Resolving Framer Motion compatibility in Next.js 14](https://medium.com/@dolce-emmy/resolving-framer-motion-compatibility-in-next-js-14-the-use-client-workaround-1ec82e5a0c75) and [motion issue #2066](https://github.com/framer/motion/issues/2066) — the `"use client"` requirement in the app router

Verified directly in this repository (not from the web):

- `app/node_modules/@react-three/fiber/dist/react-three-fiber.cjs.dev.js:113` — R3F v8 connects DOM events to the Canvas wrapper `<div>`, not to `document`
- `app/node_modules/@react-three/fiber/dist/events-d0566a2e.cjs.dev.js:2291-2299` — the `DOM_EVENTS` map, `wheel` registered passive

Project documents this spec is bound by: [`docs/BRAND.md`](../BRAND.md) §1, §2, §5, §8 · [`docs/ROADMAP.md`](../ROADMAP.md) Arc 1, the Aug 9 sequencing rule ("the live-site fix comes first").
