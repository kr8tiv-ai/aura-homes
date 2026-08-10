# Elevation brief — the interaction & motion pass

*Aug 10, 2026. Synthesis of four research specs into one build order. Deadline: OKX BuildX, Aug 21.*

This is a **build order, not an essay.** It merges [MOTION-STACK-SPEC.md](MOTION-STACK-SPEC.md) (the founder's five asks), [AWARD-WINNING-DESIGN-2026.md](AWARD-WINNING-DESIGN-2026.md) (the jury-facing elevations) and the one item from [GRASS-STATE-OF-THE-ART.md](GRASS-STATE-OF-THE-ART.md) that belongs in an interaction pass, into a single ranked sequence. Each source spec keeps the exact code; **this document decides what happens, in what order, and when to stop.** Where I disagree with a source spec, or found something it missed, it is marked **[NEW]** or **[CORRECTION]**.

*Out of scope here: the rest of the grass work (P1–P7b, §10), and FOUNDATIONS-NO-CONCRETE.md — both are scene/product landings, not interaction.*

Bound by [BRAND.md](../BRAND.md) §1, §2, §6, §8 and the founder's Aug 9 sequencing rule in [ROADMAP.md](../ROADMAP.md):26 — *the live site comes first.*

---

## 0. Read this before you write a line

1. **Do the diagnostics in §1 first.** Two of them can make the entire rest of this document invisible on the machine you are testing on. Thirty minutes, and a check that cannot fail is not a check.
2. **Land in order.** Each Landing is written so that stopping at its horizontal rule leaves a shippable site. If Aug 21 arrives mid-list, ship what is landed.
3. **Two items require the founder before merge**, not after: the hover-glow vocabulary (§8.1) and Lenis at all (§8.2). Both have a documented conflict with a project doc. Build them on a branch, screenshot both states, ask.
4. **Verify against the rendered page, not the tool result.** Every Landing has acceptance criteria written as an assertion that a broken build would fail. `app/scripts/inspect.mjs` (30.5 KB, Playwright already in `devDependencies`) is where they go.

### The ranking

| # | Work | Ask | Impact | Effort | Where |
|---|---|---|---|---|---|
| 0 | Diagnostics — three console lines | a | blocking | 30 min | §1 |
| 1 | `any-hover` gate + Ledger wrapper + pointer-events window | a | 5/5 | 45 min | §2 |
| 2 | The warm response (`--fx-warm`) + unclip the headings | a, c | 5/5 | 2 h | §3 |
| 3 | Tier-0 design corrections — focus, OG, payload | — | 5/5 | 2 h | §4 |
| 4 | Tier-1 typography, rail ordinals, dashboard hairlines | — | 4/5 | 1 h | §4 |
| 5 | CardFX v2 — the stars, and the two bugs that kill them today | b | 4/5 | 1 day | §5 |
| 6 | Motion (`LazyMotion` + `m` + `domAnimation`) | d | 3/5 | 4 h | §6 |
| 7 | Lenis on native scroll | e | 3/5 | 4 h | §7 |
| 8 | View Transitions + differentiated reveals | — | 4/5 | 2 h | §9 |
| — | Grass P0 (one line, zero triangles) | — | 5/5 | 15 min | §10 |

Items 1–4 are ~6 hours and move four of the six published Awwwards dev sub-scores without touching the scene. **If you only get one day, do 0 through 4 and §10.**

---

## 1. Landing 0 — diagnose before you touch anything

The founder's report is "the text-box mouseovers do not work." That is **four stacked causes**, and two of them mean the CSS fires correctly and you still see nothing. Run these in the browser console on `https://aurahomes.fun` (or `next dev`), in this order, and write the answers into the PR description.

```js
// D1 — does the pointer media query even match on THIS machine?
matchMedia('(hover: hover) and (pointer: fine)').matches   // gates globals.css:1171
matchMedia('(any-hover: hover)').matches                   // what it should be gated on
```
> **If D1 is `false`, that is the entire answer and nothing below matters.** Both the CSS block (`globals.css:1171`) and the whole FX canvas (`CardFX.tsx:163-164`) are switched off with no visual trace. This project is built on a **Windows 11 touchscreen laptop**, where Chrome can report the primary pointer as coarse. Fix is §2.1, not more CSS.

```js
// D2 — is the transition list real? Select a plate with the picker first.
getComputedStyle($0).transitionProperty
// today on the hero ledger: "opacity, transform"  ← text-shadow is not in the list
```
> `globals.css:246` `.story-js .story-scope [data-rv]` is specificity **(0,3,0)**; `globals.css:1175` `.aura-panel, .fx-card, [data-fx]` is **(0,1,0)**. `transition-property` is one list, not a composed set — the reveal rule wins and every fx property snaps in 0 s. `Story.tsx:91-94` puts `fx-card`, `data-rv` **and** `data-fx` on the same `<dl>`.

```js
// D3 — is the star tracer's rAF alive? Run it, scroll to a beat boundary, run it again.
performance.now(); // then watch: does the canvas repaint?
document.querySelector('.fx-tracer-canvas')  // exists?
```
> See **[NEW] §5.1** — it parks permanently and never restarts.

**Also confirm, in DevTools, once each:** force `:hover` on a plate in the Styles pane (if forced styles apply but real hover does not, it is `pointer-events`, not CSS); and `document.elementFromPoint(x, y)` with the cursor parked on a card.

**Acceptance:** three answers recorded. No code written yet.

---

## 2. Landing 1 — the cheap half of the hover fix (45 min, no dependencies)

### 2.1 `any-hover`, everywhere — the H9 fix
`hover`/`pointer` describe the *primary* pointer. `any-hover`/`any-pointer` describe whether **any** pointer can hover. Phones still answer `any-hover: none` and stay correctly excluded.

- `globals.css:1171` → `@media (any-hover: hover)`
- `CardFX.tsx:163-164` → `const noHover = window.matchMedia("(any-hover: none)"); if (reduced.matches || noHover.matches) return;`

### 2.2 Take `fx-card` off the reveal target — the H1 fix at the source
Do not fight specificity. Move the fx class onto a wrapper so no element carries both systems (`Story.tsx:80-104`, `Ledger`):

```tsx
<div className={fx ? "fx-card" : undefined} data-fx={fx ? "" : undefined}>
  <dl className="story-ledger" data-rv style={{ transitionDelay: `${delay}ms` }}>…</dl>
</div>
```
The plates (`Story.tsx:354`) already carry `fx-card` without `data-rv` — leave them.

### 2.3 Widen the interactive window — the H5 fix
`Story.tsx:252` — `el.style.pointerEvents = o > 0.6 ? "auto" : "none"`. With `o = 1 − smoothstep(0.3, 0.5, |p−k|)`, that is `|p−k| < 0.366`, while the plate stays legible down to `o = 0.008`. Park at a beat edge, hover copy you can plainly read, nothing happens. Raise to **`o > 0.35`** so the interactive window matches the legible one.

### 2.4 Do NOT "clean up" the fixed layer
`.story-stage` is `position: fixed; pointer-events: none` with per-frame `auto` written onto each plate (`globals.css:340-345`, `Story.tsx:252`). This is the textbook failure shape and **here it is already correct.** Giving the stage `pointer-events: auto` breaks the R3F pointer parallax; removing the inline write breaks hover completely. Leave a comment saying so.

**Acceptance**
- `getComputedStyle(plate).transitionProperty` contains the fx properties (fails on today's build).
- Hover works at `|p−k| = 0.45` where it previously did not.
- On a touchscreen laptop with a trackpad, hover now responds. On a phone (`any-hover: none`), `document.querySelector('.fx-tracer-canvas') === null` still holds.

**Guardrail:** zero bundle delta, zero new listeners.

---

## 3. Landing 2 — the warm response (2 h, no dependencies)

### 3.1 The physics, once
Paper is `#fafaf9`, L\* ≈ 98. **There is no luminance headroom.** Additive light can raise it ~2%; a shadow can only darken. So on paper, *glow cannot be a luminance effect — it has to be a chroma effect.*

That is also why today's rule fails. `globals.css:1185` is `text-shadow: 0 0 16px rgba(4,120,87,0.28)`: a 16 px Gaussian on a ~2 px stem spreads peak halo alpha to ≈ **0.03**, which over paper is **2–3 luminance units out of 255** — under the JND. And `text-shadow` paints *behind* the glyph, so on a light ground a dark halo does not read as warming, it reads as **out of focus.** Same failure on the app routes: `.aura-panel:hover`'s `0 0 34px -6px` (`globals.css:1188-1195`) has a `−6px` spread that pulls the shadow back inside the border before the blur starts — 28 `.aura-panel` instances across seven pages, all invisible.

### 3.2 Implement MOTION-STACK-SPEC §5.2 verbatim
One registered custom property, inherited, so **descendants read it without needing transitions of their own** — H1 and H2 stop being reachable:

```css
@property --fx-warm { syntax: "<number>"; inherits: true; initial-value: 0; }
```
Then the four coordinated moves, all reading that one number: ink temperature (`color-mix(in oklab, #171a18 88%, #047857)`), a **tight-first glyph bloom** (`0 0 0.5px` @34%, `0 0 4px` @20%, `0 0 14px` @10%), paper temperature (`#fafaf9` → `#fbfdfb`), and an **inset** ring rather than an outer bloom. Full block at MOTION-STACK-SPEC §5.2.

> **The 0.5px layer is the whole effect.** It thickens the stem by a fraction of a pixel *in emerald* — real ink blooming on real stock. The 4px and 14px layers only give it air. Reverse the weighting and you have the neon BRAND.md §1 forbids. **Do not raise the wide layers.**

Timing: **560 ms in / 380 ms out**, asymmetric, `cubic-bezier(.32,.08,.24,1)` with an 80 ms enter delay so a cursor crossing on its way elsewhere never strobes. Not `--st-ease-out` — the house curve completes 80% of travel in the first quarter, which is a snap, correct for a plate arriving and wrong for a filament warming. **See §8.1: 560 ms is outside BRAND.md's band and needs the founder's word.**

### 3.3 Unclip the headings — the H3 fix
`Reveal` (`Story.tsx:39-62`) wraps **every word of every display heading** in `.story-wmask`, which is `overflow: hidden` (`globals.css:230-237`). `text-shadow` paints outside the glyph box, so an `overflow: hidden` ancestor clips it dead. The largest type on every plate — the first thing anyone hovers — shows nothing.

```css
.story-wmask { overflow: clip; overflow-clip-margin: 0.45em; /* rest unchanged */ }
.story-js .story-w { transform: translateY(150%); }  /* was 112% — clear the margin */
```
Browsers without `overflow-clip-margin` treat `overflow: clip` as a hard clip, i.e. identical to today. The fallback is the current behaviour.

### 3.4 Keep the R3F pointer note in the code
`StoryCanvas.tsx:57` puts the canvas wrapper at `z-index: 0` with default `pointer-events`, so it owns the pointer wherever paper does not cover it, and `state.pointer` freezes while the cursor is over a plate (`Scene.tsx:1921-1922`). **The world holds still while you read.** That is correct — comment it so nobody files it as a bug.

**Acceptance** (this is the falsifiable one)
- Screenshot a plate at rest; dispatch a *real* pointer hover; screenshot at +700 ms. **Mean ΔE00 over the display heading's bounding box ≥ 1.2 and ≤ 3.5.** Both bounds asserted — a one-sided check passes on a blank page. Today's build fails the lower bound.
- The same measurement taken over the **heading**, not the body copy — that is what proves §3.3 landed.
- With `prefers-reduced-motion: reduce`, `transition: none` and ΔE00 at +700 ms is 0.

**Guardrail:** zero JS, zero bundle delta. `color-mix()` is Baseline since 2023 (~93%); `@property` is Baseline "newly available" (Chrome 85 / Safari 16.4 / Firefox 128) — on an unsupporting browser the custom property jumps instead of interpolating, which is *exactly today's behaviour*, so the degradation is "no worse than now." Re-check caniuse before shipping.

---

## 4. Landing 3 + 4 — the design corrections that are actively costing points (3 h)

None of this touches the scene. All of it lands on published sub-scores.

### 4.1 Focus-visible system — do this first of the four *(impact 5/5, effort 1/5)*
`grep :focus-visible app/` returns **zero**. Worse, `app/app/land/page.tsx:38,46` and `app/app/design/page.tsx:263,281` set `outline-none` and replace it with `focus:border-aura-emerald` — a hairline colour change on a hairline. Keyboard users cannot see where they are. WCAG **2.4.7 / 2.4.11** failure, landing on Usability (30% of the score) and the Accessibility sub-score — the column where *every* winner is weakest (6.80–7.60). Ten lines:

```css
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--st-emerald-deep); outline-offset: 3px; border-radius: 2px;
}
.story-rail button:focus-visible, .story-hud-btn:focus-visible {
  outline-color: var(--st-ink); box-shadow: 0 0 0 4px var(--st-paper);
}
```
Delete `outline-none` from the four inputs. Add a skip link as the first child of `<body>` in `layout.tsx:36`, plus `id="main"` on `SiteShell.tsx:124`'s `<main>` and on `.story-flow` (`Story.tsx:381`).

Also add `:focus-within` to the fx selectors in §3.2 — that is how the warm response becomes keyboard-reachable for free.

### 4.2 The Open Graph card *(2 lines)*
`layout.tsx:23,29` point at `/social-card.png`. `app/public/` holds only `social-card.png` (129.7 KB) — **the pre-flip dark card.** The correct paper-ground `assets/site-card.png` was never copied in. BRAND.md §10 flagged this Aug 9; still open. Copy it to `app/public/site-card.png`, repoint both. *(`metadataBase` is `https://aurahomes.fun` and `next.config.mjs` sets no basePath by default, so `/site-card.png` resolves — only revisit if someone builds with `BASE_PATH`.)*

### 4.3 Cut the media payload *(measured, not estimated)*
| Asset | Actual | Fix |
|---|---|---|
| `public/audio/forest-ambience.mp3` | **6.66 MB** | mono, 64–96 kbps, 45 s seamless loop → **≤ 600 KB** (~11×, inaudible at the 0.45 volume bed) |
| `public/video/enter.mp4` | **3.52 MB**, `preload="auto"`, and it *is* the LCP element | `preload="metadata"` + a ~40 KB AVIF poster with `fetchpriority="high"` |
| `public/models/cabin.glb` | 273 KB | fine |

Budget: **LCP 2.0 s / INP 160 ms / CLS 0.08** (80% of the 2026 pass marks — the recommended alert budget). Keep the 1600 ms canvas hold-back at `Story.tsx:165-168`; that is good engineering. Messenger scores **WPO 8.80 with a full WebGL world**, so this is winnable.

### 4.4 Tier-1 one-liners *(1 h, all of them)*
- `text-wrap: pretty` on `.story-sub, .story-body, .story-gate-sub` (`pretty`, not `balance` — balance is for headlines).
- `font-variant-numeric: tabular-nums slashed-zero` on `.story-kicker, .story-ledger dt, .story-rail button span, .story-mline-node em, .story-band-scale, .story-hud-btn`. Only `.story-band-nums` has it today.
- `hanging-punctuation: first last` on `.story-plate, .story-hero-inner` (Safari-only today, harmless elsewhere).
- `.story-gate-title { letter-spacing: -0.052em }` — BRAND.md §4 specifies down to −0.06em and the file stops at −0.042em, so the top of the band is unused.
- **Rail ordinals** (the By-Kin lesson). `globals.css:581-598`: `.story-rail button span` is `opacity: 0` at rest, so five anonymous 16 px ticks carry no information. Show the mono ordinal always at `--st-faint`, the word on hover — split `{b.n} · {b.label}` (`Story.tsx:340-341`) into `{b.n}` + `<em>· {b.label}</em>`. A visible `01 02 03 04 05` column reads as editorial apparatus; five dashes read as a generic scroll indicator.
- **Dashboard hairlines.** `dashboard/page.tsx:63` builds the stage tracker as `grid gap-px bg-[rgba(26,29,27,0.12)]` — structure by box (BRAND.md §6 forbids it) *and* a **near-miss of a palette value** (`rgba(26,29,27,0.12)` vs `--aura-border`'s `rgba(23,26,24,0.12)`), which the `globals.css` header explicitly says must not exist. Transparent cells, `border-right: 1px solid var(--aura-border)` on all but the last.
- **Do NOT add `font-optical-sizing`.** None of Space Grotesk, Manrope, or JetBrains Mono carries an `opsz` axis. Pure cargo cult.

**Acceptance**
- Tab through the story and all seven stage pages with the browser focus ring visible; every interactive element shows the emerald ring, and the rail/HUD rings are legible at every scroll depth.
- `curl -I` the deployed `og:image` → 200, and the card renders paper-ground in a share debugger.
- Lighthouse on the deployed build: LCP ≤ 2.0 s, INP ≤ 160 ms, CLS ≤ 0.08. Record the numbers in `docs/AUDIT-LOG.md`.

---

## 5. Landing 5 — the stars (1 day)

The founder's words: *"little stars of WebGL-accelerated lighting slowly moving down the frame of the text boxes."* Today `CardFX.tsx:308` runs **one** head plus a 30-sprite tail orbiting the whole perimeter every 11 s. That is not the ask, and — more urgently — **it is not running at all.**

### 5.1 [NEW] The tracer's rAF parks permanently. Fix this before anything cosmetic.
Not in any source spec. `CardFX.tsx:345-353`:

```js
if (n > 0) { …draw…; raf = requestAnimationFrame(frame); }
else { running = false; }        // ← no rAF scheduled
```
`maybeRun()` (`CardFX.tsx:355-365`) is only ever called from the `IntersectionObserver` callback, from `scan()`, and from `visibilitychange`. On `/`, the five plates live in a `position: fixed` stage — **they never change intersection, so IO never fires again after mount.** The moment every plate is `visibility: hidden` (which `paint()` does at every beat boundary — `p ≈ 0.5, 1.5, 2.5, …`, and the hero ledger has already scrolled away), `n` hits 0, `running` goes false, and **nothing ever restarts the loop for the rest of the session.**

Fix: keep the idle-park behaviour (it is correct and §8 requires it) but make the wake-up condition reachable — extend `maybeRun()` to also be called from the scroll/`frame.read` pass, and gate parking on *"no visible cards **and** every `card.warm < 0.01`"* per MOTION-STACK-SPEC §6.6. **Verify by scrolling to `p = 1.5`, stopping, then scrolling on: the stars must come back.**

### 5.2 [NEW] Release the WebGL context on route change
`CardFX.tsx:372-381` removes the canvas but never releases its context. The effect is keyed on `pathname` (`CardFX.tsx:384`), and the site has seven routes plus `/` — navigate around and you accumulate contexts against the browser's 8–16 cap, with **oldest evicted first**, which is precisely the R3F story scene. Add to cleanup:

```ts
glc.getExtension("WEBGL_lose_context")?.loseContext();
```
And add the `webglcontextrestored` handler MOTION-STACK-SPEC §6.6 asks for — `webglcontextlost` is handled (`CardFX.tsx:369-370`) but nothing rebuilds the program, so a driver reset leaves a dead canvas.

### 5.3 The redesign — MOTION-STACK-SPEC §6.2 parameters
Four stars per card (2 left edge, 2 right), travelling **down** the vertical edges at a constant **42 px/s** (a fixed *speed*, so a 300 px card and an 800 px card read the same), `sin(π·u)^0.7` alpha envelope so they fade in at the top corner and out at the bottom, 3.0 px emerald head (BRAND.md §8's "under ~4px"), 26 px emerald→teal tail, **peak alpha 0.42** (down from 0.50, because four lights instead of one must hold total luminance flat), alpha-only twinkle, and hover coupling at brightness ×1.6 / speed ×1.25 damped over 600 ms — *that* is the founder's "activated responsiveness," and it is what ties the stars to §3.

**Switch `gl.POINTS` → quads.** Three hard reasons: `ALIASED_POINT_SIZE_RANGE` maxes at **64 on M1/M2** while the current halo is `22 * dpr` = **44 px at dpr 2** (already in the danger zone); point primitives are **discarded whole** when their centre leaves the clip volume, and `.story-plate-left` is flush at `left: 0`, so a halo is one scroll pixel from popping out of existence; and a tail wants one stretched quad, not 30 stacked circles. Cost after: 14 × 4 × 2 = 112 quads = 448 vertices, ~14 KB/frame — the same order as today's ~3,000 floats.

**Keep `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`** (`CardFX.tsx:212`). Premultiplied source-over. **Do not switch to additive** — over `#fafaf9` paper, additive clamps to white and throws the emerald away. Whoever wrote that line got it right.

### 5.4 [NEW] The plates have no border to travel down
`.story-plate-left` has **only** `border-right` and **no `border-radius`** (`globals.css:346-371`); `.story-plate-right` has only `border-left`. A star sent "down the left edge" of a left-side plate travels down bare paper at the viewport margin, attached to nothing. Per card, trace only edges that carry a visible border: for a plate that is **one** edge (the inner one), so plates get **2 stars on the inner edge**, not 2+2. `.aura-panel` (`rounded-xl`, full border) gets the full 2+2. Also **re-read `borderTopLeftRadius` on resize** — `scan()` caches it at registration (`CardFX.tsx:250-252`) and several radii are `clamp()`/vw-derived.

### 5.5 The rest of §6.6
Move rect reads into `frame.read` (needs Landing 6), cap the FX canvas DPR at **1.5** not 2 (`CardFX.tsx:217` — 44% fill saving on Retina, and nobody counts pixels on a blurred sprite), keep the 180 ms-debounced `MutationObserver`, and **rewrite the file header comment** so it describes what the file now does.

**Acceptance**
- Scroll `/` end to end, stopping at every beat boundary. The stars are visible on every card at every stop. *(Today's build fails this — §5.1.)*
- Navigate `/` → `/land` → `/design` → `/budget` → `/escrow` → `/faq` → `/dashboard` → `/`. Exactly **2** live WebGL contexts on `/`, **1** on every stage page.
- Emulate a 64 px `ALIASED_POINT_SIZE_RANGE` cap (or test on Apple silicon): no sprite disappears.
- ≤ 56 stars on screen (14 cards × 4). FX canvas CPU ≤ **0.4 ms/frame at 1440p**, read from the Performance panel's `frame.render` block.

**Guardrail:** the rAF must still park when nothing is visible and nothing is warm. Do not lose that property in the rewrite.

---

## 6. Landing 6 — Motion, scoped (4 h)

**Install `motion@^13.1.0`** — the package formerly called `framer-motion`. Never add `framer-motion` to `package.json` yourself; `motion` declares it as a dependency and both names appearing in the lockfile is expected, not a duplicate bundle.

**Import shape is non-negotiable:** `LazyMotion` + `m` from `motion/react-m` + `domAnimation`, loaded **asynchronously**.

| | Cost |
|---|---|
| full `motion` component | 34 kB |
| `m` + `LazyMotion`, initial render | **4.6 kB** |
| `+ domAnimation` (variants, `whileInView`, `AnimatePresence` exits, hover/tap/focus gestures) | **+15 kB**, async chunk, never blocks first paint |
| `domMax` (drag + layout animations) | +25 kB — **we do not need it** |

Add `<MotionConfig reducedMotion="user">` and `<LazyMotion strict>`, plus the `no-restricted-imports` ESLint rule from MOTION-STACK-SPEC §1.1 so the 34 kB component cannot get in by accident.

**The four jobs Motion is for, in priority order:**
1. **The `frame` scheduler.** `frame.read` / `frame.update` / `frame.render` splits every animation frame. Routing `Story.tsx:250-253`'s style *writes* through `frame.render` and `CardFX.tsx:303`'s `getBoundingClientRect()` *reads* through `frame.read` kills a **read-after-write forced synchronous layout on every scrolled frame** (H10) with no new abstraction. **This alone justifies the dependency**, and it is also the documented Lenis driver (§7).
2. `AnimatePresence` on the enter gate, the leave veil, and the mobile sheet — real exit animations instead of `setTimeout` + a CSS class.
3. `[data-rv]` → `m` variants with `whileInView`, deleting the bespoke IntersectionObserver at `Story.tsx:286-301`.

**Where Motion must not go:**
- **No `useScroll` / `useTransform` / `useSpring` for story progress.** A second scroll subscription with a second spring, layered on Lenis and on the scene's `damp`, is a third lag. `progressRef` is the single source of truth.
- **No layout animations.** `domMax` is +25 kB and layout animation on a fixed stage is actively harmful.
- **Nothing may add a React re-render per frame.** `progressRef` is a ref, `setActive` fires only on integer beat change (`Story.tsx:263-267`), and the FX canvas is outside React entirely. Keep all three properties.

**Acceptance:** measured gzipped delta **≤ 32 kB total, ≤ 17 kB in the initial chunk**, taken as a real before/after:
```
cd C:\Users\lucid\Desktop\aura-homes\app
GH_PAGES=1 npx next build && du -sk out/_next/static/chunks | tail -1
```
Plus: a Performance trace across a full scroll pass shows **zero "Forced reflow" entries.** Write both numbers into `docs/AUDIT-LOG.md`.

---

## 7. Landing 7 — Lenis (4 h) — **read §8.2 first**

Safe *only* because **Lenis runs on native scroll.** It does not translate a content wrapper; it intercepts wheel/key input and each frame calls the browser's own scroll API. So `position: sticky`, anchor links, Find-in-page, scroll anchoring and `.story-stage`'s `position: fixed` all keep working. Locomotive v4 would not have been safe here.

**Frame ownership — two loops, one source of truth.** Drive `lenis.raf(timestamp)` from **Motion's `frame.update`** with `autoRaf: false`. **Do not drive Lenis from `useFrame`** — the single most common mistake, and in this codebase it produces an *unscrollable page*: `StoryCanvas` is not mounted for the first 1600 ms (`Story.tsx:165-168` gates `canvasBoot` behind a timer so the gate film gets the wire), so Lenis would not tick until then, and `frameloop="demand"` under reduced motion never ticks at all.

**Read scroll from Lenis, not from `window`.** Replace the `window.scroll` listener at `Story.tsx:221-283`; under Lenis it is one frame late and one rAF redundant. `useLenis((lenis) => apply(lenis.scroll))` — `lenis.scroll` is the *smoothed* value (what the eye is about to see), `lenis.actualScroll` is `window.scrollY` (what it saw last frame). Keep a `window.scroll` fallback guarded on `useLenis()` returning `undefined`, six lines, so the story can never ship unscrollable.

**Double-smoothing — the one number that must change.** Two first-order lags in series read as *mushy*, not smooth:

| Configuration | τ_Lenis | τ_scene | Total |
|---|---|---|---|
| Today | 0 | 0.200 s | **0.200 s** — the approved feel |
| Lenis added, λ untouched | 0.158 | 0.200 | 0.358 s — **+79%, the regression** |
| Lenis added, **λ = 12** | 0.158 | 0.083 | **0.241 s — specified** |

**[CORRECTION]** MOTION-STACK-SPEC §3.4 cites `Scene.tsx:1739` and `:1880` for the two `λ = 5` sites. Those line numbers are **stale**. In the current file they are **`Scene.tsx:1920`** (`r.smooth = THREE.MathUtils.damp(r.smooth, progressRef.current, 5, d)`) and **`Scene.tsx:2061`** (`rig.current.smooth = reduced ? 6 : THREE.MathUtils.damp(rig.current.smooth, target, 5, …)`). Both must become 12. Leave a comment: *if Lenis is ever removed, put this back to 5.*

**Three programmatic-scroll sites must change:** `scrollToBeat` (`Story.tsx:303-306`) — native `scrollIntoView({behavior:'smooth'})` and Lenis fight and the result snaps back; use `lenis.scrollTo(el, …)` with a `scrollIntoView` fallback. The gate lock (`Story.tsx:182-187`) — `overflow: hidden` does not stop Lenis integrating wheel input, it just accumulates a virtual target that snaps when the lock lifts; add `lenis.stop()` / `lenis.start()` and keep the CSS as belt and braces. Route exit needs no change.

**Anti-patterns, all five:** driving `raf` from `useFrame`; leaving `autoRaf` default *and* calling `raf` yourself (double-speed scroll); pointing Lenis at a `<div>` wrapper (breaks every `position: fixed` layer we have); Motion `useScroll` for progress; lowering `lerp` to "fix" mushiness (the lever is λ).

**Acceptance**
- Record `performance.now()` at a synthetic wheel event, poll the scene's `smooth` until within 5% of `progressRef.current`: **≤ 260 ms**. Then **guard the guard** — force λ back to 5 and confirm the assertion *fails* at ~358 ms. A metric that cannot distinguish the two builds is not a metric.
- Find-in-page, keyboard `Page Down`, anchor links, and browser back/forward scroll restoration all still work.
- `prefers-reduced-motion: reduce`: smoothing off, programmatic scrolls instant, camera at `REDUCED_SHOT` (`Scene.tsx:68`), `.fx-tracer-canvas` absent.
- `/` → `/budget` → `/` : `window.scrollY === 0` on each arrival.

**Known caveat, accept it:** `position: fixed` shimmers on pre-M1 Intel Safari (lenis#103). Note it in `docs/AUDIT-LOG.md`.

---

## 8. Conflicts with project docs — founder decisions required

### 8.1 Glow — BRAND.md §2 says "no glow anywhere"

| Source | Position |
|---|---|
| BRAND.md §2, §6 | "no glow anywhere" · "Whitespace and hairlines as structure" |
| AWARD §7.13 | "**No glow.** Not on text, not on borders, not on the mark." |
| AWARD §6.4 | Replace the glow entirely: hairline firms to `rgba(23,26,24,0.26)`, paper to `#fdfdfc`, and a **1px emerald rule grows along the bottom edge over 0.45 s** — the same vocabulary as `.story-kicker i`, which is what makes it read as *authored* rather than *applied* |
| MOTION §5 | Keep a glow, but re-engineer it as **chroma**, not luminance — a 0.5px emerald ink bloom, not a 16px bloom |
| **Founder, Aug 10** | **Explicitly reinstated** both the hover glow and the border tracer with restraint parameters. Recorded in `CardFX.tsx:34-40`: *"the rule is now 'no glow LOUDER than this file', not 'none'. Do not crank these numbers; the values ARE the approval."* |

**My recommendation, and it does not require choosing:** the two proposals are **compatible and additive.** MOTION §5.2's warm response is already 95% chroma — the wide bloom layers are at 10% alpha and exist only to give the 0.5px layer air. AWARD §6.4's growing bottom rule is structural, brand-native, and costs nothing. **Build both, on one branch, behind one class.** Present the founder three screenshots at +700 ms: today / warm-only / warm + growing rule. **Do not merge §6.4's rule unilaterally** — AWARD explicitly says the call is his.

### 8.2 Lenis — the two research specs directly contradict each other

- **AWARD §7.16 (hard no):** *"No smooth-scroll library (Lenis, Locomotive). They fight the browser's scroll anchoring, break `prefers-reduced-motion` and Find-in-page, and cost INP. Native scroll plus scroll-driven animation is both faster and more current."*
- **MOTION §2-3 (detailed yes):** Lenis wraps native scroll — the specific objection Locomotive earns does not apply — and it is **founder ask (e)**.

**Adjudication:** MOTION's evidence is stronger *on the mechanism* (Lenis genuinely does not translate a wrapper, and it disables smoothing under `prefers-reduced-motion` itself), so three of AWARD's four objections are answered. **The INP objection is not.** Lenis is main-thread wheel handling on a page that already runs an R3F scene and a second WebGL canvas, and INP is a published WPO input on a 160 ms budget.

**Therefore: Lenis lands LAST, after §6's INP measurement is banked.** Take an INP reading before and after. If Lenis costs more than **15 ms** of INP on the story route, it does not ship for Aug 21 — the founder gets the number, not an opinion. This is also why it sits at #7 in the ranking despite being a direct founder ask: everything above it is strictly safer.

### 8.3 Timing — 560 ms vs BRAND.md §8's "micro-interactions 150–250 ms"
The founder asked for *"a nice slow activated responsiveness of a soft slow warming glow."* 560 ms is the slowest a hover can be before it reads as unresponsive rather than considered. **In-band fallback: 240 ms enter / 180 ms exit, same curves.** Ship 560/380, flag it in the PR body, and treat the values as a ceiling he can lower.

### 8.4 Other open questions to put in the PR
- Four stars per card, or one per edge? (Four is the reading of *"little stars"*, plural.) If one, raise peak alpha back to 0.5.
- Stars ambient-at-a-whisper + 1.6× on hover (specified), or hover-only (quieter, cheaper)?
- `hover` → `any-hover` means touchscreen laptops that previously saw **nothing** now see the stars. Correct, but it is a visible change on a class of device.

---

## 9. Landing 8 — transitions and reveals (2 h)

### 9.1 Same-document View Transitions
`Story.tsx:191-202` fades a white veil for 520 ms via `setTimeout`, then routes — a cross-fade bolted onto a router push, in which the wordmark, header and paper ground all blink despite being identical on both sides. Same-document view transitions are **Baseline** (Chrome/Edge 111+, Firefox 133+, Safari 18+):

```tsx
if (reduced || !document.startViewTransition) { router.push(href); return; }
document.startViewTransition(() => { router.push(href); });
```
```css
.story-chrome-mark, header a[href="/"] { view-transition-name: aura-wordmark; }
::view-transition-old(root), ::view-transition-new(root) {
  animation-duration: .42s; animation-timing-function: var(--st-ease-out);
}
@media (prefers-reduced-motion: reduce) { ::view-transition-group(*) { animation: none; } }
```
The wordmark **stays put** while the world dissolves into the tool. That is the "transitions that feel like camera moves" credit, in eight lines, on the sub-score where winners run 8.6–9.0. **Keep the veil as the `!document.startViewTransition` fallback** — do not delete it.

### 9.2 Differentiate the reveal
Every `[data-rv]` block currently does the identical 16 px rise (`globals.css:246-254`) — a **named AI-slop tell**. Three physics instead of one:
- **Kickers / mono labels:** no translate. Opacity plus a horizontal `scaleX(0)→1` draw on `.story-kicker i` with `transform-origin: left`. *A rule should draw, not fall.*
- **Display headings:** keep the word mask. It is the best motion on the site.
- **Body, ledgers, figures:** 16 px → **8 px**, slowed to 1.0 s. Large text blocks travelling 16 px is what reads as generic.

Then migrate to native scroll-driven animation, **finished state as the default**, so no-JS and unsupporting browsers see the finished page:
```css
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .story-js .story-scope [data-rv] {
      animation: rv-in linear both; animation-timeline: view();
      animation-range: entry 15% cover 35%;
    }
  }
}
@keyframes rv-in { from { opacity: 0; transform: translate3d(0,8px,0); } }
```
This deletes JS from the main thread — an INP win — and is the 2026 tell of a current build. Keep the rAF loop for camera progress only; that one genuinely needs JS. **Note the ordering interaction:** if §6's `whileInView` migration lands, do that *instead*, not both.

**Acceptance:** with JS disabled, the page renders complete. With `prefers-reduced-motion: reduce`, one still frame of equal beauty. Screenshots at 1440×900, 1280×720 and 390×844 show no regression.

---

## 10. The one scene fix that belongs in this pass

Everything else in GRASS-STATE-OF-THE-ART.md is a separate landing, but **P0 is fifteen minutes, zero triangles, and it is the most likely single fix for the founder's near-house complaint** — so it rides along with this pass.

`meadowShade()` must use the **same tight clearance the filler layer plants with**:
```js
clamp01(d) * Math.pow(clearance(x, z, 0.22, 0.5, true), 0.6)
```
Today the ground is shaded by the *hero* layer's wide pads while the carpet layer plants with *tight* pads, leaving bright walked-lawn annuli under full-height grass — fire pit 1.65→4.0 m, tub 1.42→2.3 m, trail ±0.72→±1.05 m, and the entire under-deck slot. **Bright ground behind dark blades is the exact recipe for "the blades read as separate objects."**

**Acceptance:** render beats 2/3/4/6 before and after; the annuli are gone; triangle count is unchanged.

Everything else in that document (P1 the Outerra `1/p` width compensation, P2 distance aggregation, P3 the sward mottle via `onBeforeCompile`, P7b the 32 B→11 B attribute packing) is a **separate landing after Aug 21** unless the schedule opens up. P5 (density rebalance) must not be touched without running its own §7.2 luminance test first.

---

## 11. Guardrails — one table, assert all of them

| Budget | Limit | How |
|---|---|---|
| JS added, gzipped | **≤ 32 kB** total, ≤ 17 kB initial chunk | before/after `next build`, §6 |
| Live WebGL contexts on `/` | **exactly 2** (scene + FX), 1 elsewhere | count canvases with a context after a 8-route nav loop |
| Forced synchronous layouts per scrolled frame | **0** | Performance trace, zero "Forced reflow" |
| FX canvas CPU @1440p | ≤ **0.4 ms/frame** | Performance panel, `frame.render` block |
| FX canvas DPR | ≤ **1.5** | `CardFX.tsx` resize handler |
| Stars on screen | ≤ **56** | `MAX_TRACED` 14 × 4 |
| Wheel → camera settle (within 5%) | ≤ **260 ms** | §7, with the λ=5 negative control |
| Hover ΔE00 over the heading bbox at +700 ms | ≥ **1.2** and ≤ **3.5** | §3 — today's build fails the lower bound |
| LCP / INP / CLS | ≤ **2.0 s / 160 ms / 0.08** | Lighthouse on the deployed build |
| React re-renders per frame | **0** | `progressRef` is a ref; `setActive` on integer beat change only |
| New listeners | all `{ passive: true }` except Lenis's own wheel handler | — |
| `will-change` | stays on the five plates' `opacity` only (`globals.css:358`) | five composited layers is a design; forty is a memory problem |

---

## 12. Do not do

1. **No additive blending on the FX canvas.** Over paper it clamps to white and throws the emerald away.
2. **No `pointer-events: auto` on `.story-stage`**, and do not remove the per-frame inline write. Both break something that currently works (§2.4).
3. **No `font-optical-sizing`** — no `opsz` axis on any of our three faces.
4. **No cursor follower, no magnetic buttons, no custom cursor.** Named by jurors as no longer differentiating, and hostile to someone buying a house.
5. **No bouncy easing, no overshoot, no spring with `bounce > 0`.** If an easing draws attention to itself it is wrong.
6. **No horizontal-scroll section, no text rendered in WebGL, no dark mode.** The `night` toggle is a *world* state, not a UI theme; the pages stay paper (`globals.css:770`).
7. **Never near-miss a palette value.** `rgba(26,29,27,0.12)` in `dashboard/page.tsx:63` is exactly the failure `globals.css`'s own header forbids.
8. **No exclamation marks, no emoji, anywhere in the UI or in copy.**
9. **Do not crank the star or glow numbers.** The values in MOTION §5.2 and §6.2 *are* the founder's approval; raising them re-opens the BRAND.md §2 conflict without his consent.
10. **Do not raise `SEG` on the terrain** to fix the facet lattice (80k → 320k triangles for a worse result). `onBeforeCompile` on the existing `MeshStandardMaterial` — hand-rolling a `ShaderMaterial` loses PCSS shadow reception.

---

## 13. Corrections to the source specs

Carry these forward; the source documents are otherwise accurate.

- **[CORRECTION]** MOTION §3.4's `Scene.tsx:1739` / `:1880` are stale. The two `λ = 5` sites are **`Scene.tsx:1920`** and **`Scene.tsx:2061`**.
- **[NEW]** MOTION §4 lists ten hover causes but misses the reason the *stars* are invisible: the FX rAF parks permanently and IO never wakes it, because the traced elements are inside a `position: fixed` stage (§5.1).
- **[NEW]** No `WEBGL_lose_context` on unmount; the effect re-runs per route (§5.2).
- **[NEW]** MOTION §6.2 specifies 2 stars per vertical edge unconditionally; the story plates carry only **one** visible border and no radius, so half the stars would travel down bare paper (§5.4).
- **[NEW]** `CardFX.tsx:250-252` caches the corner radius at registration; several radii are `clamp()`/vw-derived and go stale on resize.
- **[NEW]** `.story-rail` and `.story-stage` are both `z-index: 3`, with the rail earlier in the DOM. There is no overlap today because the rail sits in the gutter opposite the on-screen plate — **re-check after §4.4's rail ordinals widen it**, at 1280 px and 1440 px.
- **[CONFLICT]** AWARD §7.16 forbids Lenis outright; MOTION §2 permits it. Adjudicated in §8.2 — Lenis ships last, gated on a measured INP delta of ≤ 15 ms.
