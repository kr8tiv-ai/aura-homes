# Award-Winning Design, 2026 — and what it means for aurahomes.fun

*Research spec, August 10, 2026. Written for the agent that implements it. Every recommendation is scoped to our actual codebase — `app/app/globals.css`, `app/components/story/*`, `app/components/SiteShell.tsx`, `app/app/*/page.tsx` — and every claim carries a source. Governed by [BRAND.md](../BRAND.md); where a recommendation collides with a founder decision already in the code, the collision is named out loud rather than quietly overwritten.*

**Deadline context:** OKX BuildX submission is Aug 21, 2026 ([ROADMAP.md](../ROADMAP.md) Arc 1). Section 8 splits this spec into what ships before the deadline and what does not.

---

## 1. The arithmetic nobody tells you

Awwwards scores four criteria at fixed weights: **Design 40%, Usability 30%, Creativity 20%, Content 10%** ([Awwwards evaluation system](https://www.awwwards.com/about-evaluation/)). Design and Usability are 70% of the score. Creativity — the part everyone optimizes for — is a fifth.

Mechanics that change how you should build:

- A submission goes to a **minimum of 18 jurors**, and the **3 scores furthest from the average are dropped** ([Hon Tran, an Awwwards juror](https://www.hontran.dev/blog/awwwards-judging-criteria)). Polarizing work gets its outliers deleted. The median juror decides, so the winning strategy is *nothing anyone can object to, plus one thing nobody has seen* — not one spectacular gamble.
- **6.5+** = Honorable Mention. **Site of the Day** typically lands mid-to-high 8s. The **Developer Award** goes to SOTD sites scoring above 7 on a separate technical panel ([Awwwards](https://www.awwwards.com/about-evaluation/), [Hon Tran](https://www.hontran.dev/blog/awwwards-judging-criteria)).
- The Developer Award is scored on six named sub-criteria, and they are published per site: **Animations/Transitions, Responsive Design, WPO, Markup/Meta-data, Semantics/SEO, Accessibility.**
- There is a separate **Mobile Excellence** track gated at **70/100 on Google's mobile criteria** before the design jury even looks ([Hon Tran](https://www.hontran.dev/blog/awwwards-judging-criteria)).
- Juror-stated failure modes: animation below 60fps, neglected mobile, effects with no conceptual grounding, missing accessibility. Desktop-first thinking "caps scores around 30%."

### The scoreboard, from real winners

Pulled from the public Awwwards pages. This is the actual bar, not a vibe.

| Site | Award | Overall | Design | Usab. | Creat. | Content | Dev | **Access.** |
|---|---|---|---|---|---|---|---|---|
| [Lando Norris](https://www.awwwards.com/sites/lando-norris) (OFF+BRAND) | SOTY 2025 | 8.18 | 8.12 | 7.90 | 8.71 | 8.18 | 7.58 | **7.00** |
| [Messenger](https://www.awwwards.com/sites/messenger) (abeto) | SOTY 2025 | 7.92 | 8.04 | 7.46 | 8.23 | 8.15 | 8.21 | **7.60** |
| [Opal Tadpole](https://www.awwwards.com/sites/opal-tadpole) (Guglieri) | SOTD | 7.52 | 7.73 | 7.34 | 7.27 | 7.64 | 7.84 | **7.60** |
| [Noomo Showcase](https://www.awwwards.com/sites/noomo-showcase) | SOTD Aug 2 2026 | 7.34 | 7.29 | 7.06 | 7.79 | 7.51 | 7.60 | **6.80** |

**Read the last column.** Accessibility is the lowest sub-score on every one of these — including both 2025 Sites of the Year. Animations/Transitions runs 8.6–9.0 across the board; Accessibility runs 6.8–7.6. That gap is the single cheapest place a small team can beat a studio, and it is the one place our site currently has an outright defect (§6.1).

Second read: **Usability is the lowest of the four design criteria on all four winners.** The thing that separates 7.3 from 8.2 is not more effect. It is Creativity + Content pulling up while Design and Usability hold. Our story format is already a Content play; the work is protecting Usability while adding one Creativity spike.

---

## 2. Nine sites worth studying, by name

### 2.1 [Opal Tadpole](https://www.awwwards.com/sites/opal-tadpole) — Claudio Guglieri et al. — *our closest analogue*

A light-ground product page with real 3D, two colors (`#FFDB01`, `#ffffff`), single page, tagged *Microinteractions*. It scored SOTD at 7.52 with the **lowest Creativity of the four** (7.27) and still won, because Design, Content, and the dev sub-scores held. Hero is a hand-flip sequence, then statistics-driven demonstrations of a small object.

**Steal:** a light ground plus one saturated accent plus one hero object is a proven SOTD formula — it is literally our palette structure. Also: they explain a technical product by *showing the object at scale* with numbers next to it, which is exactly our budget band and spec-ledger. **Do not steal:** their creativity ceiling. 7.27 is where "beautiful but conventional" lands.

### 2.2 [Messenger](https://www.awwwards.com/sites/messenger) — abeto — Site of the Year 2025

A tiny WebGL planet with a delivery character; Three.js + WebSockets; pastel palette (`#81BFBC`, `#C9D5C3`). Animations 9.00, WPO 8.80, Responsive 8.40. The copy line is nine words: *"It's a small planet, but someone's gotta make the deliveries."*

**Steal:** one world, one subject, one sentence. The entire concept is legible in a screenshot, and every technical decision serves it. This is BRAND.md §8's "one subject, one camera" already validated at SOTY level. Also note the WPO 8.80 — a 3D site can be fast, and the jury notices.

### 2.3 [Igloo Inc](https://www.awwwards.com/sites/igloo-inc) — abeto — Site of the Year 2024

Built **entirely in WebGL** — procedurally grown ice crystals, shader-driven UI text, a particle footer fed by custom VDB-to-browser volume data. Three.js, three-mesh-bvh, Svelte, GSAP, Vite; assets from Houdini and Blender ([three.js forum showcase](https://discourse.threejs.org/t/landing-site-igloo-inc/67249), [Awwwards case study](https://www.awwwards.com/igloo-inc-case-study.html)).

**Steal:** *custom tooling is the moat.* They wrote a volume-data exporter because the site needed one. **Do not steal:** the approach. Shader-driven UI text costs Accessibility and Semantics sub-scores, and our brand is ink on paper, not a rendered surface.

### 2.4 [By-Kin](https://by-kin.com/) — SOTD + Developer Award + FWA + CSSDA

An interiors and graphic-design studio. Next.js, GSAP, Strapi. Credited for *"confident editorial typography, weighted smooth scroll, and transitions that never call attention to themselves"* ([Hon Tran's 2026 roundup](https://www.hontran.dev/blog/best-award-winning-websites-2026)). Observed live: full-bleed carousel, featured work numbered **01 / 02 / 03**, a **carousel progress readout rendered as a raw percentage**, two named layout modes labeled **"1"** and **"2"**, minimal text hierarchy, high-contrast black and white.

**Steal — this is the most directly transferable site in the list.** Numbered work items are our numbered kickers. A percentage rendered as bare data instead of a styled progress bar is exactly our mono-label register. Two toggleable layout modes is a Creativity point that costs almost nothing and reads as authored. Our progress rail is currently five anonymous ticks; By-Kin would render the ordinal.

### 2.5 [Iventions](https://iventions.com/) — CSSDA Website of the Month, Awwwards SOTD + Developer Award

Three.js treating each project as a **spotlit installation**, GSAP pacing the reveals so the page "reads like a guided walk-through rather than a grid." The credited phrase is **"WebGL used for atmosphere instead of spectacle."**

**Steal:** the whole thesis. Our 3D is currently a *backdrop*; theirs is *lighting*. The Alberta light arc BRAND.md §8 already specifies (cool dawn → hearth-warm dusk) is the atmosphere play — but right now the dusk is a CSS gradient overlay (`--st-dusk` on `.story-sky::after`), not the scene's actual light. Moving the arc into the scene lighting is the single highest-craft-per-line change available to us.

### 2.6 [Uncommon Studio](https://uncommonstudio.com.au/) — SOTD + Developer Award + FWA

Credited for *"a confident grid that breaks at exactly the right moments, GSAP transitions between sections that feel like camera moves."*

**Steal:** the grid discipline. A break only reads as a break if the grid was visible first. Our story pages are two states — a left paper column or a right paper column — which is a rhythm, not a grid. And "transitions that feel like camera moves" is our scene's job, not the DOM's.

### 2.7 [Mat Voyce](https://matvoyce.tv) — SOTD, GSAP Site of the Year 2025 nominee

Kinetic typography: *"letters that stretch, snap, and recombine on scroll, all timeline-driven,"* with the explicit note that **"animation never blocks reading."**

**Steal:** the constraint, not the effect. Our word-mask reveal already respects it (plain text stays the accessible label via `aria-label`, and `.story-js` gates the hidden initial state so no-JS shows everything — good work, keep it). **Do not steal:** kinetic type. It is off-brand for a company asking people to trust it with $300K.

### 2.8 [Noomo Showcase](https://www.awwwards.com/sites/noomo-showcase) — SOTD, Aug 2, 2026

Current-week reference point. WebGL/Three.js/GSAP, two colors (`#0004EB`, `#020411`), custom preloader, scroll-driven animation, tagged Storytelling + Data Visualization. **7.34 overall, 6.80 accessibility.**

**Steal:** the two-color discipline — a 2026 SOTD is winning on *two* hexes. **Learn from:** 7.34 is what a competent immersive agency showcase scores now. Spectacle alone is a 7.3. The gap to 8.2 is Content and Usability.

### 2.9 [Hunyuan3D-WorldClaw](https://tencent-hunyuan.github.io/Hunyuan3D-WorldClaw/) — our existing ground reference

Already documented in [WORLDCLAW.md](WORLDCLAW.md) and adopted in BRAND.md §7. Listed here because it is the only light-ground reference in the set and the source of our numbered kickers, spec-ledger, framed-media rule, and two-button maximum. Nothing in this spec supersedes it.

### What the nine share

1. **A palette you can count on one hand.** Two colors on Lando Norris, Opal, and Noomo. Ours is Paper + Ink + Emerald, with Violet context-locked and Teal/Lime rationed. Already compliant — the risk is drift, not deficit.
2. **One subject.** A planet, an ice field, a webcam, a driver. Ours is the cabin on the land. Everything that is not that is chrome.
3. **Transitions that read as camera, not as CSS.** Three of the nine are credited in exactly those words.
4. **Content that is real.** Content scores 7.5–8.2 on the winners; placeholder-heavy sites lose the tiebreak ([Hon Tran](https://www.hontran.dev/blog/awwwards-judging-criteria)). Our published Alberta numbers and published limitations are a genuine advantage.
5. **Accessibility as the soft underbelly.** 6.8–7.6 across every winner.

---

## 3. Typography in 2026

**Variable fonts are the floor, not the ceiling.** They moved from niche in 2021 to baseline expectation for serious web typography in 2026 ([Design Monks](https://www.designmonks.co/blog/typography-trends-2026), [Made Good Designs](https://madegooddesigns.com/web-typography-guide/)). Our stack is already there: `@fontsource-variable/space-grotesk`, `manrope`, `jetbrains-mono` are imported in `app/app/layout.tsx`, which is what makes the non-standard weights in `globals.css` (`430`, `480`, `500`, `520`, `620`) real rather than silently snapping to the nearest static cut. That is a genuinely sophisticated detail already in the codebase — **do not let anyone "clean it up" to round hundreds.**

**Optical sizing — the honest note.** The 2026 trend writing pushes `font-optical-sizing` and the `opsz` axis. None of our three faces expose an `opsz` axis (Space Grotesk is `wght` 300–700, Manrope `wght` 200–800, JetBrains Mono `wght` 100–800 + italic). Adding `font-optical-sizing: auto` would be a no-op. **Do not add it as cargo cult.** The correct substitute is manual optical compensation — tracking and weight banded by size — which BRAND.md §4 already specifies and `globals.css` already implements (`-0.028em` at `.story-display`, `-0.042em` at `.story-display-xl`, `+0.22em` on `.story-kicker`). This is the right answer; it just needs to be finished (§6.5).

**Humanist over geometric.** The trend note that matters for us: geometric perfection is giving way to warmer, slightly irregular letterforms *precisely because* AI-generated content is everywhere ([Design Flea](https://designflea.com/typography-trends-2026/), [AND Academy](https://www.andacademy.com/resources/blog/graphic-design/typography-trends/)). Space Grotesk is a quirked grotesque, not a neutral one — it already reads as a choice. Manrope is the softer of the available neutrals. This pairing is defensible; keep it and stop shopping.

**The tell to avoid:** Inter with a system fallback and no other typographic decision is named as the number-one AI-slop typography signature ([925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide), [vibecodekit](https://vibecodekit.dev/ai-slop-design)). We are clear of it.

---

## 4. Scroll storytelling, 2026 state of the art

Scrollytelling in 2026 is "less a competitive advantage and more a baseline expectation" ([Skya Designs](https://www.skyadesigns.co.uk/web-design-insights/web-design-trend-2026-scroll-storytelling/)). The distinction jurors make, and the one worth internalizing:

> Many sites labelled "scrollytelling" are really sites with scroll-triggered animations. The gap is enormous. An animation triggers, a narrative builds. Without a real story arc, your site becomes a sequence of pretty effects. — [Metabole Studio](https://metabole.studio/en/blog/scrollytelling)

We are on the right side of this line already: five named beats with an argument (land → design → budget → escrow → build) and copy that fades in place per BRAND.md §8. **Protect that.** The elevation is in the mechanism, not the format.

**Native scroll-driven animation is now shippable.** `animation-timeline: scroll()` and `view()` are supported in Chrome/Edge 115+, Firefox 132+, Safari 18+, at roughly 84% global support mid-2026, and are an Interop 2026 priority ([CSSAWWWARDS guide](https://cssawwwards.com/blog/css-scroll-driven-animations-guide-2026), [Mintec](https://mintec.co/blog/css-scroll-driven-animacion/), [Josh Comeau](https://www.joshwcomeau.com/animation/scroll-driven-animations/)). Firefox stable still gates it behind `layout.css.scroll-driven-animations.enabled` as of Firefox 152 (June 2026), so it must be layered, never depended on.

The authoring rule, verbatim from the guidance: **author the finished state as your default, then layer the animation on top only where it is supported.** A browser that does not understand `animation-timeline` ignores the line entirely. This is precisely the pattern `globals.css` already uses with the `.story-js` class — the CSS version is strictly better because it needs no JS at all.

**View Transitions.** Same-document view transitions are **Baseline Newly Available** across Chrome 111+, Edge 111+, Firefox 133+, Safari 18+ ([web.dev](https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available)). Cross-document works in Chromium 126+ and Safari 18.2+ but **not Firefox** yet ([Trade Assistance guide](https://trade-assistance.com/blog/cross-document-view-transitions-mpa-2026/)). For us: same-document is safe to ship; cross-document is a progressive enhancement only.

---

## 5. The AI-slop tell sheet

The reason this section matters more than usual: roughly **three quarters of new commercial pages launched in Q1 2026 carry at least one strong AI-slop signature in their visual layer** ([Sailop's 100-page report](https://www.sailop.com/blog/ai-slop-2026-state-of-the-ai-generated-web)). Jurors are pattern-matching against that baseline. A single tell reframes everything else on the page as "generated."

### The named tells

| Tell | Detail | Source |
|---|---|---|
| Purple→blue gradient | Tailwind `blue-600` → `purple-500`/`pink-500`, in hero or primary CTA. Called "the single most reliable visual fingerprint." | [925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide), [prg.sh](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website) |
| Colored 3–4px left-border strip on cards | "The single most reliable AI tell" | [Hallmark / dev.to](https://dev.to/rams901/hallmark-stop-ai-generated-ui-slop-in-one-command-in-2026-3p9n) |
| Untouched `rounded-2xl shadow-lg p-6` shadcn card | Default component shipped as-is | [Hallmark](https://dev.to/rams901/hallmark-stop-ai-generated-ui-slop-in-one-command-in-2026-3p9n) |
| Uniform 16px radius and 24px padding everywhere | One radius for every element regardless of scale | [925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide) |
| A flat 1px gray border on every card | Structure by box instead of by hierarchy | [Hallmark](https://dev.to/rams901/hallmark-stop-ai-generated-ui-slop-in-one-command-in-2026-3p9n) |
| Inter + system fallback, no other type decision | — | [925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide) |
| Three feature cards in a row | The default information architecture | [Hallmark](https://dev.to/rams901/hallmark-stop-ai-generated-ui-slop-in-one-command-in-2026-3p9n) |
| Dark mode nobody asked for | — | [Hallmark](https://dev.to/rams901/hallmark-stop-ai-generated-ui-slop-in-one-command-in-2026-3p9n) |
| Identical fade-in on every element; buttons that snap instead of easing | One motion rule applied globally | [925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide) |
| Stock hero: diverse group at a laptop in an impossibly well-lit office; or abstract 3D blobs | — | [925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide) |
| Vague headlines: "Build the future of work," "Your all-in-one platform," "Scale without limits" | Says nothing about the product | [925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide) |
| Hedging + superlatives: "may help you," "best-in-class," "cutting-edge" | — | [925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide) |

The diagnosis is not mystical: the model picks the statistically safe average instead of committing to a direction ([prg.sh](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website)). **Every anti-slop move is therefore the same move: commit to something specific enough that it could not have been the average.**

### Our audit against the sheet — honest results

Clean: no purple→blue gradient; no left-border strips; no shadcn defaults; not Inter; no unrequested dark mode; no stock photography; no three-cards-in-a-row; radii are varied and deliberate (`2px` buttons per the founder's Aug 9 call, `999px` legacy pills, `18–26px` framed media). Copy is specific and numeric (`$199K–$444K, 800 sq ft SIP build, Alberta suppliers, 2026 pricing`) and carries published limitations. **This is a genuinely well-defended page.**

Two live findings:

**(a) The hover glow.** `globals.css` lines 1171–1210 apply `text-shadow: 0 0 16px rgba(4,120,87,0.28)` to every card on hover, plus `box-shadow: 0 0 34px -6px rgba(16,185,129,0.14)` and an emerald `0 0 0 1px` ring on `.aura-panel`. The file's own header comment documents the conflict: BRAND.md §2 ends "no glow anywhere," and the founder explicitly reinstated a whisper-level glow on Aug 10. **The comment is accurate and this is a founder call, so it is not the implementing agent's to silently revert.** But the honest read for a jury: a colored bloom behind text on hover is the closest thing on this page to a generated-UI signature, it is the one effect here that does not survive the "would a studio do this" test, and it makes ink-on-paper text momentarily less legible. §6.4 proposes a replacement that keeps the founder's intent (cards should *answer* the cursor) without the bloom. Take it to the founder as a side-by-side; do not merge it unilaterally.

**(b) Identical fade-in on every element.** `[data-rv]` applies one `opacity + translateY(16px)` to every revealed block, differentiated only by `transitionDelay`. That is the named "identical fade-in" tell. §6.6 gives the fix.

---

## 6. The elevation list, ranked

Ranked by **visual impact per unit of effort**. Effort is in agent-hours at the level this repo is written to. Everything cites the file it touches.

---

### Tier 0 — corrections that are actively costing points

#### 6.1 Ship a real focus-visible system — **impact 5/5, effort 1/5** ⭐ *do this first*

Grep across `app/` returns **zero** `:focus-visible` rules. Worse, `app/app/land/page.tsx:38,46` and `app/app/design/page.tsx:263,281` set `outline-none` on form inputs and replace it only with `focus:border-aura-emerald` — a 1px hairline color change on a hairline border. Keyboard users effectively cannot see where they are.

This is a WCAG 2.4.7 / 2.4.11 failure, it lands directly on **Usability (30%)** and the published **Accessibility** dev sub-score — the column where every winner in §1 is weakest. It is roughly ten lines.

```css
/* globals.css — one global rule, brand-correct, no glow */
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--st-emerald-deep);
  outline-offset: 3px;
  border-radius: 2px; /* matches the founder's square-button call */
}
/* dark scene chrome: the rail and HUD sit over the world, so they need
   a paper backstop behind the ring to stay visible at any scroll depth */
.story-rail button:focus-visible,
.story-hud-btn:focus-visible {
  outline-color: var(--st-ink);
  box-shadow: 0 0 0 4px var(--st-paper);
}
```

Then delete `outline-none` from the four input classNames and let the rule apply.

Also add a skip link as the first child of `<body>` in `app/app/layout.tsx` — visually hidden until focused, landing on `#main`. Add `id="main"` to the `<main>` in `SiteShell.tsx` and to `.story-flow` in `Story.tsx`.

#### 6.2 Fix the Open Graph card — **impact 4/5, effort 1/5**

`app/app/layout.tsx:23,29` points `og:image` and `twitter:image` at `/social-card.png`. `app/public/` contains only `social-card.png` (129.7 KB) — the **pre-flip dark card**. `assets/site-card.png` (the correct paper-ground 1200×630) was never copied into `public/`. BRAND.md §10 flagged this on Aug 9 and it is still open.

Every share, every judge's first glimpse, and the Content score (10%) run through this image. Copy `assets/site-card.png` → `app/public/site-card.png` and repoint both references. Two lines.

#### 6.3 Cut the media payload — **impact 4/5, effort 2/5**

Measured in `app/public/`:

| Asset | Size | Problem |
|---|---|---|
| `audio/forest-ambience.mp3` | **6.66 MB** | Fetched in full the instant someone clicks "Enter with sound" |
| `video/enter.mp4` | **3.52 MB** | `preload="auto"` on the gate — it *is* the LCP element and it competes with the scene boot |
| `models/cabin.glb` | 273 KB | Fine |

Core Web Vitals 2026 pass marks: **LCP < 2.5s, INP < 200ms, CLS < 0.1** at the 75th percentile, with the recommended alert budget at 80% of each — **LCP 2.0s, INP 160ms, CLS 0.08** ([Senorit](https://senorit.de/en/blog/core-web-vitals-2026), [Digital Applied](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide)). WPO is a published dev sub-score; Messenger scores 8.80 on it *with* a full WebGL world.

Actions:
1. Re-encode the ambience to **mono, 64–96 kbps, 45-second seamless loop** → target ≤ 600 KB (an ~11× cut, inaudible difference on a 0.45-volume background bed).
2. Change the gate video to `preload="metadata"` and add a `poster` (a single frame exported as a ~40 KB AVIF/WebP). The poster becomes a fast, well-defined LCP element instead of a 3.5 MB video decode.
3. Add `fetchpriority="high"` to the poster and keep the 1600 ms canvas hold-back in `Story.tsx:166` — that hold-back is good engineering, keep it.

---

### Tier 1 — high impact, low effort

#### 6.4 Replace the hover glow with a studio-grade card response — **impact 5/5, effort 1/5** *(founder decision required)*

Keeps the founder's intent — cards answer the cursor — and removes the one generated-UI signature on the page. No bloom, no text-shadow, structure by hairline per BRAND.md §6.

```css
@media (hover: hover) and (pointer: fine) {
  .aura-panel, .fx-card, [data-fx] {
    transition: border-color .35s var(--st-ease-out),
                background-color .35s var(--st-ease-out);
  }
  /* the hairline firms up; the paper warms a half-step; nothing glows */
  .aura-panel:hover, .fx-card:hover, [data-fx]:hover {
    border-color: rgba(23, 26, 24, 0.26);
    background-color: #fdfdfc;
  }
  /* the signature: an emerald rule grows along one edge, like a margin mark */
  .fx-card { position: relative; }
  .fx-card::after {
    content: ""; position: absolute; left: 0; bottom: 0;
    height: 1px; width: 0; background: var(--st-emerald);
    transition: width .45s var(--st-ease-out);
  }
  .fx-card:hover::after { width: 100%; }
}
```

The growing rule is *the same hairline vocabulary the kicker already uses* (`.story-kicker i`), which is what makes it read as authored rather than applied. Present it beside the current build; the call is the founder's.

#### 6.5 Finish the typographic system — **impact 4/5, effort 1/5**

Five additions to `globals.css`, all one-liners, all things a type-literate juror reads instantly:

```css
/* 1. body copy gets pretty, not balance — balance is for headlines only */
.story-sub, .story-body, .story-gate-sub { text-wrap: pretty; }

/* 2. every mono/data surface: tabular figures and a slashed zero.
      Currently only .story-band-nums has tabular-nums; the ledger,
      the kicker ordinals, the rail, and the milestone labels do not. */
.story-kicker, .story-ledger dt, .story-rail button span,
.story-mline-node em, .story-band-scale, .story-hud-btn {
  font-variant-numeric: tabular-nums slashed-zero;
}

/* 3. hanging punctuation on the paper pages — a real typesetting detail,
      Safari-only today, harmless everywhere else */
.story-plate, .story-hero-inner { hanging-punctuation: first last; }

/* 4. one more tracking step at the top of the display band. BRAND.md §4
      specifies −0.02 → −0.06em; the largest size in the file stops at
      −0.042em, so the band's top end is unused. */
.story-gate-title { letter-spacing: -0.052em; }

/* 5. optical alignment for the section ordinal — the mono figure sits
      visually low against the tracked-caps label at 0.64rem */
.story-kicker-n { position: relative; top: -0.02em; }
```

Do **not** add `font-optical-sizing` — see §3, none of our three faces carry an `opsz` axis.

#### 6.6 Differentiate the reveal — **impact 3/5, effort 2/5**

Right now every `[data-rv]` block does the identical 16px rise, which is a named slop tell (§5). Give the three content classes three different physics, per BRAND.md §8's "damped, never bouncy":

- **Kickers and mono labels:** no translate at all. Opacity plus a 12px *horizontal* draw on the hairline (`.story-kicker i` scales from `scaleX(0)` with `transform-origin: left`). A rule should draw, not fall.
- **Display headings:** keep the word mask. It is the best motion on the site.
- **Body, ledgers, figures:** reduce the rise from 16px to **8px** and slow to 1.0s. Large text blocks travelling 16px is what reads as generic.

Then migrate the reveal layer off `IntersectionObserver` to native scroll-driven animation, finished-state-as-default (§4). This deletes JS from the main thread — an **INP** win — and it is the 2026 tell of a current build:

```css
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .story-js .story-scope [data-rv] {
      animation: rv-in linear both;
      animation-timeline: view();
      animation-range: entry 15% cover 35%;
    }
  }
}
@keyframes rv-in { from { opacity: 0; transform: translate3d(0,8px,0); } }
```

Keep the rAF loop for the camera progress only — that one genuinely needs JS.

#### 6.7 Give the progress rail its ordinals — **impact 3/5, effort 1/5**

The By-Kin lesson (§2.4). `.story-rail` currently renders five anonymous 16px ticks; the `01 · LAND` label only appears on hover, so at rest the rail carries no information. Render the mono ordinal **always visible** at `--st-faint`, the label on hover:

```css
.story-rail button span { opacity: 1; color: var(--st-faint); }
.story-rail button span em { opacity: 0; transition: opacity .3s; } /* the word */
.story-rail button.on span, .story-rail button:hover span { color: var(--st-ink); }
.story-rail button.on span em, .story-rail button:hover span em { opacity: 1; }
```

Split the existing `{b.n} · {b.label}` in `Story.tsx:340` into `{b.n}` plus `<em>· {b.label}</em>`. A visible `01 02 03 04 05` column reads as an editorial apparatus; five dashes read as a generic scroll indicator.

#### 6.8 Fix the fake table in the dashboard — **impact 3/5, effort 1/5**

`app/app/dashboard/page.tsx:63` builds the stage tracker as `grid gap-px ... bg-[rgba(26,29,27,0.12)]` — filled cells with a gap standing in for rules. That is "structure by box," which BRAND.md §6 forbids, and it produces a hairline that is off-palette (`rgba(26,29,27,0.12)` is not `--aura-border`'s `rgba(23,26,24,0.12)` — a near-miss of a palette value, which the globals.css header explicitly says must not exist).

Replace with real hairlines: transparent cells, `border-right: 1px solid var(--aura-border)` on each but the last, no background. While there, add `slashed-zero` to the dashboard's `tabular-nums` figures.

---

### Tier 2 — high impact, medium effort

#### 6.9 Make the enter gate load-bound and honest — **impact 4/5, effort 3/5**

Current gate is a splash: two buttons over a looping film, dismissed by click whenever the visitor decides. It is well-built (the audio-gesture rationale in `StoryChrome.tsx` is correct and should be preserved), but it tells the visitor nothing and it hides a scene that may not be ready.

2026 preloader practice: **on-brand, context-aware, and tied to real load events** — "oversized rolling counters that climb through randomized steps can optionally sync to actual page load events, waiting until fonts, images, and assets have genuinely finished loading before dismissing," with **total duration at or below 1.5 seconds** ([SVGator survey](https://www.svgator.com/blog/best-preloader-examples/), [Oma-Kase](https://www.oma-kase.com/blog/best-framer-preloader-components)).

Concretely, in our register:

- Add a **mono percentage in the corner of the gate**, bottom-left, `0.62rem`, `+0.22em` tracking, `--st-faint`, driven by drei's `useProgress()` for the GLB/texture load, blended with the video's `canplaythrough`. Tabular figures so it does not jitter. This is exactly By-Kin's bare-percentage move and Noomo's custom preloader, in our type.
- Below it, one line of loading manifest in the spec-ledger register — `CABIN · PINES · CAMPFIRE · LANTERN` ticking to a small emerald mark as each `.glb` resolves. Real information, zero decoration.
- Keep both buttons and both labels exactly as they are. Disable the primary until progress ≥ 100 rather than gating on a timer, and keep the existing `onVideoFallback` boot path (`Story.tsx:163–168`) untouched — it is the correct degradation.

The point is not the counter. It is that the gate stops being a splash screen and starts being *evidence that something real is being loaded*.

#### 6.10 Same-document View Transitions for story → stage pages — **impact 4/5, effort 2/5**

`Story.tsx:191–202` fades a white veil for 520ms via `setTimeout`, then routes. That is a cross-fade bolted onto a router push; the wordmark, the header, and the paper ground all blink even though they are identical on both sides.

Same-document view transitions are Baseline (§4). Wrap the push, and name the elements that persist:

```tsx
const enterApp = (href: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  if (reduced || !document.startViewTransition) { router.push(href); return; }
  document.startViewTransition(() => { router.push(href); });
};
```

```css
.story-chrome-mark, header a[href="/"] { view-transition-name: aura-wordmark; }
::view-transition-old(root), ::view-transition-new(root) {
  animation-duration: .42s;
  animation-timing-function: var(--st-ease-out);
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*) { animation: none; }
}
```

The wordmark now *stays put* while the world dissolves into the tool. That is the "transitions that feel like camera moves" credit (§2.6) earned in eight lines, and it is on the Animations/Transitions sub-score where winners run 8.6–9.0. Keep the veil as the `!document.startViewTransition` fallback.

#### 6.11 Put the 3D inside the page, not only behind it — **impact 5/5, effort 4/5**

This is the biggest craft gap between our site and the nine.

Right now `StoryCanvas` is one fixed full-bleed canvas at `z-index: -1`-ish with paper plates floating above it. Every stage page (`/land`, `/design`, `/budget`, `/escrow`, `/dashboard`) is flat DOM — the 3D simply stops existing once you leave `/`. So the site reads as *a 3D landing page plus a normal app*, which is two sites.

The pattern the award stack uses: drei's `<View>` plus `tunnel-rat` to portal DOM-positioned viewports into a single persistent renderer ([pmndrs/react-three-next starter](https://github.com/pmndrs/react-three-next), [drei](https://threejsresources.com/tool/drei)). One canvas, many framed windows into it, each laid out by normal CSS.

Applied to us, in priority order:

1. `/design` — the SIP wall assembly as a small orbitable exploded view **inside a framed figure**, `18–26px` radius, 1px hairline, `FIG. 1` mono tag, one dim caption. That is BRAND.md §7's "media as framed evidence," executed in 3D instead of as a screenshot.
2. `/land` — the parcel as a LiDAR-derived terrain chip beside each result row, 120×90, same frame treatment.
3. `/dashboard` — the cabin at the current build stage, in a single card, shell-only through finished, driven by `currentStage`.

Everything stays inside frames on paper, so nothing violates §2's "dark may exist only inside framed media."

This is a day of work. It is also the difference between a landing page with 3D and *a product whose 3D is the same object throughout* — which is what "art direction: every choice serves a single idea" means in [Hon Tran's](https://www.hontran.dev/blog/best-award-winning-websites-2026) framing.

#### 6.12 Move the light arc into the scene — **impact 4/5, effort 3/5**

The Iventions lesson (§2.5): *WebGL for atmosphere instead of spectacle.* BRAND.md §8 already commits to "light tells the story arc (cool dawn → hearth-warm dusk)." Today that arc is a CSS gradient painted over the top (`.story-sky::after`, `--st-dusk`) — the scene's own lighting does not change, so the world does not actually get late; a filter gets applied to it.

Drive the directional light's **elevation, azimuth, color temperature, and shadow length** from the same `progressRef` that already drives the camera. Cool ~6500K at beat 01 (land), warm ~2700K by beat 05 (build), shadows lengthening across the whole scroll. Keep the CSS gradient as the sky, but let it follow the light rather than lead it.

Then, and only then, is the `night` HUD toggle honest — right now it is a `filter: brightness(0.44) saturate(0.82) hue-rotate(196deg)` on the sky div (`globals.css:766`), which is a photo filter, not nightfall.

---

### Tier 3 — the Creativity spike

#### 6.13 One interaction that could not belong to any other site — **impact 5/5, effort 4/5**

Creativity is 20%, and the juror guidance is explicit: generic effects (cursor followers, stock scroll libraries) no longer differentiate; jurors reward **concepts that could not transfer to another brand** ([Hon Tran](https://www.hontran.dev/blog/awwwards-judging-criteria)). Every item above raises Design and Usability. This is the one that raises Creativity, and without it the ceiling is roughly Noomo's 7.34.

**The sun-path scrubber.** A thin arc, drawn in hairline, over the scene at the design or budget beat. Drag it and four things move together:

1. The scene's actual sun — the same light rig from §6.12.
2. A mono readout of the date and solar elevation for the parcel's latitude (Lac Ste. Anne, ~53.8°N).
3. The estimated daily PV yield in kWh, tabular figures, with its basis stated.
4. **The published limitation, right there:** drag into December and the yield collapses and the caveat appears in dim ink beside it — the exact "December solar collapse" BRAND.md §5 says to publish plainly.

Why it wins on all four criteria at once: it is *Design* (hairline arc, mono readout, no chrome), *Usability* (a drag with a keyboard equivalent — arrow keys step by month, `aria-valuetext` reads the date and yield), *Creativity* (nobody else's site can have it, because it only makes sense for a company that builds off-grid houses in Alberta), and *Content* (real numbers, real basis, and the honest failure case shown rather than buried). It is the single artifact that proves the product's whole thesis — *published limitations are the proof of honesty* — as an interaction instead of a sentence.

If only one Tier 2/3 item ships before Aug 21, it should be this one.

---

## 7. The do-not-do list

Hard no, on brand grounds and on jury grounds.

**Slop tells (§5) — none of these, ever:**
1. Purple→blue or any multi-hue gradient. Our accent is a mark on paper.
2. A colored 3–4px left-border strip on any card.
3. Untouched shadcn/Tailwind defaults — `rounded-2xl shadow-lg p-6`, `shadow-md`, `shadow-xl`.
4. One radius for everything. Radii carry meaning here: `2px` buttons, `18–26px` framed media.
5. A flat 1px gray border on every card as the structural system. Hairlines and whitespace, per BRAND.md §6.
6. Inter, or any system-font-stack-only decision.
7. Three feature cards in a row.
8. A dark mode nobody asked for. The `night` toggle is a *world* state, not a UI theme, and the pages stay paper — `globals.css:770` is right, keep it.
9. The identical fade-in on every element (§6.6).
10. Stock photography of any kind, and AI renders passed off as product (BRAND.md §6).
11. Vague headlines and hedged superlatives. Our copy is `$199K–$444K, 800 sq ft SIP build, Alberta suppliers, 2026 pricing` — keep it that specific.
12. Emoji anywhere in the UI, and no exclamation marks anywhere at all.

**Craft nos:**

13. **No glow.** Not on text, not on borders, not on the mark (BRAND.md §2, §3). See §6.4 for the founder-decision caveat.
14. **No bouncy easing.** No `cubic-bezier` with overshoot, no spring physics with `bounce > 0`. `--st-ease-out` = `cubic-bezier(0.16, 1, 0.3, 1)` is the house curve. If an easing draws attention to itself, it is wrong (BRAND.md §8).
15. **No cursor follower, no magnetic buttons, no custom cursor.** Named by jurors as no longer differentiating, and hostile to the audience buying a house.
16. **No smooth-scroll library** (Lenis, Locomotive). They fight the browser's scroll anchoring, break `prefers-reduced-motion` and Find-in-page, and cost INP. Native scroll plus scroll-driven animation is both faster and more current.
17. **No horizontal scroll section.** Ubiquitous, and a mobile-usability liability on the track that gates at 70/100.
18. **No text rendered in WebGL.** Igloo Inc can afford the Accessibility and Semantics hit; we cannot, and our type is the brand.
19. **No auto-playing scene motion above the BRAND.md §8 ceiling** — ambient drift stays under ~4px.
20. **No centered-everything.** Our asymmetric paper columns are a real position; do not let a "cleanup" pass center the hero.
21. **Never near-miss a palette value.** `rgba(26,29,27,0.12)` in `dashboard/page.tsx:63` is exactly the failure `globals.css`'s own header forbids (§6.8).
22. **No `font-optical-sizing`** — cargo cult on faces with no `opsz` axis (§3).
23. **No fourth accent.** Emerald leads; violet is locked to on-chain; teal and lime are sparse. Three on one card is the failure BRAND.md §6 names.

---

## 8. Sequenced against Aug 21

**Before submission (≈ 6–8 agent-hours, all low risk):**
`6.1` focus-visible + skip link · `6.2` OG card · `6.3` payload cut · `6.5` typography finish · `6.7` rail ordinals · `6.8` dashboard hairlines · `6.10` view transitions · `6.4` **to the founder as a side-by-side, not merged**.

That set alone moves Usability, the Accessibility sub-score, WPO, and Animations/Transitions — four of the six published dev sub-scores — without touching the scene.

**Before submission if there is a day (≈ 8–10 hours):**
`6.13` the sun-path scrubber, then `6.12` the light arc it depends on. This is the Creativity spike and it is also the best demo moment in a 90-second video.

**After the hackathon:**
`6.9` load-bound gate · `6.11` `<View>` composition across the stage pages · `6.6` native scroll-driven reveals.

**Verification before anything is called done** (per the standing rule that tool success is not verification): re-run `app/scripts` screenshots at 1440×900, 1280×720, and 390×844; tab through the story and every stage page with the browser's focus ring visible; run Lighthouse on the deployed build and record LCP/INP/CLS against the 2.0s / 160ms / 0.08 alert budget; and confirm the page still renders completely with JS disabled and with `prefers-reduced-motion: reduce`.

---

## 9. Sources

**Awards and judging** — [Awwwards Evaluation System](https://www.awwwards.com/about-evaluation/) · [Hon Tran (Awwwards juror), "Awwwards Judging Criteria: How Scoring Works (2026)"](https://www.hontran.dev/blog/awwwards-judging-criteria) · [Hon Tran, "10 Award-Winning Websites of 2026, Judged"](https://www.hontran.dev/blog/best-award-winning-websites-2026) · [Awwwards Sites of the Year](https://www.awwwards.com/websites/sites_of_the_year/) · [Utsubo, "Award-Winning Web Design: Judging Criteria Decoded"](https://www.utsubo.com/blog/award-winning-website-design-guide)

**Winner scorecards** — [Lando Norris](https://www.awwwards.com/sites/lando-norris) · [Messenger](https://www.awwwards.com/sites/messenger) · [Igloo Inc](https://www.awwwards.com/sites/igloo-inc) + [case study](https://www.awwwards.com/igloo-inc-case-study.html) + [three.js forum showcase](https://discourse.threejs.org/t/landing-site-igloo-inc/67249) · [Opal Tadpole](https://www.awwwards.com/sites/opal-tadpole) · [Noomo Showcase](https://www.awwwards.com/sites/noomo-showcase)

**Sites studied live** — [by-kin.com](https://by-kin.com/) · [iventions.com](https://iventions.com/) · [uncommonstudio.com.au](https://uncommonstudio.com.au/) · [matvoyce.tv](https://matvoyce.tv) · [Hunyuan3D-WorldClaw](https://tencent-hunyuan.github.io/Hunyuan3D-WorldClaw/)

**Scroll and transitions** — [CSSAWWWARDS, "CSS Scroll-Driven Animations: Scroll Timelines Guide (2026)"](https://cssawwwards.com/blog/css-scroll-driven-animations-guide-2026) · [Mintec, "Native CSS Scroll-Driven Animations in 2026"](https://mintec.co/blog/css-scroll-driven-animacion/) · [Josh W. Comeau, "Scroll-Driven Animations"](https://www.joshwcomeau.com/animation/scroll-driven-animations/) · [web.dev, "Same-document view transitions are now Baseline"](https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available) · [Cross-document View Transitions in 2026](https://trade-assistance.com/blog/cross-document-view-transitions-mpa-2026/) · [Metabole Studio on scrollytelling](https://metabole.studio/en/blog/scrollytelling) · [Skya Designs, "Web Design Trends 2026: Scroll Storytelling"](https://www.skyadesigns.co.uk/web-design-insights/web-design-trend-2026-scroll-storytelling/)

**Typography** — [Design Monks, "Typography Trends 2026"](https://www.designmonks.co/blog/typography-trends-2026) · [Made Good Designs, "Web Typography: A Complete Guide for 2026"](https://madegooddesigns.com/web-typography-guide/) · [Design Flea, "Typography Trends 2026"](https://designflea.com/typography-trends-2026/) · [AND Academy, "11 Typography Trends to Follow in 2026"](https://www.andacademy.com/resources/blog/graphic-design/typography-trends/)

**AI slop** — [925 Studios, "AI Slop Web Design: Complete Guide"](https://www.925studios.co/blog/ai-slop-web-design-guide) · [Hallmark, "Stop AI-Generated UI Slop in One Command"](https://dev.to/rams901/hallmark-stop-ai-generated-ui-slop-in-one-command-in-2026-3p9n) · [prg.sh, "Why Your AI Keeps Building the Same Purple Gradient Website"](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website) · [Sailop, "AI Slop in 2026: The State of the AI-Generated Web"](https://www.sailop.com/blog/ai-slop-2026-state-of-the-ai-generated-web) · [vibecodekit, "AI Slop Design"](https://vibecodekit.dev/ai-slop-design)

**Performance and loading** — [Senorit, "Core Web Vitals 2026"](https://senorit.de/en/blog/core-web-vitals-2026) · [Digital Applied, "Core Web Vitals 2026: INP, LCP & CLS"](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide) · [SVGator, "75 preloader examples"](https://www.svgator.com/blog/best-preloader-examples/) · [Oma-Kase, "Best Framer Preloader Components 2026"](https://www.oma-kase.com/blog/best-framer-preloader-components)

**3D composition** — [pmndrs/react-three-next starter](https://github.com/pmndrs/react-three-next) · [drei](https://threejsresources.com/tool/drei) · [React Three Fiber docs](https://r3f.docs.pmnd.rs/getting-started/introduction)

*Third-party figures (award scores, browser-support percentages, AI-slop prevalence) are as published by the cited sources on the dates linked; scores were read from the live Awwwards pages on Aug 10, 2026.*
