# Aura Homes — Brand

*v3, August 2026. The founder pivoted the ground from dark aurora to paper white after living with the WorldClaw reference (§7): its light cleanliness is now the ground itself, not just the rhythm. The aurora survives — inside the mark and inside media, never as the page. The bar is still "Tesla/Apple level," which in practice means restraint. Sources at the bottom.*

*Ready-to-use files: the distilled kit lives in [BRAND-KIT.md](BRAND-KIT.md) → [assets/brand-kit/](../assets/brand-kit/) — logo suite, palette, tokens, type specimen, and card template.*

## 1. The thesis: restraint is the premium signal

Every brand studied for this system — Apple, Aesop, Patagonia, and the crypto products normal people actually trust — converges on one rule: **a brand that does not shout is signaling that it does not need to.** We ask a normal person to trust an AI and a blockchain with the largest purchase of their life; every pixel of noise spends trust we cannot afford. Honesty presented plainly outsells enthusiasm presented loudly — the Patagonia move.

**The crypto corollary: never look like crypto.** Phantom, Coinbase, and Uniswap won normies by erasing the genre — calm spacing, one strategic accent. Neon glow, hexagons, circuit lines, rockets mark a product as *for insiders*. **No crypto-glow, ever.** The chain is plumbing. Plumbing is not on the wall.

## 2. The palette — light-first

| Token | Hex | Role | Why |
|---|---|---|---|
| Paper | `#fafaf9` | Every ground | Warm paper white, never pure `#fff`. Air and precision are the premium signal now; calm is the contrast. |
| Ink | `#171a18` | Display type, body text | Near-black keeping v2's green undertone — organic, not void. |
| Dim | `#5f6663` | Secondary text, captions | Hierarchy through value, not boxes. |
| Faint | `#9aa19d` | Tertiary text, axis labels | Second step of recession. |
| Hairline | ink at 12–18% opacity | Rules, borders, dividers | Structure is hairlines and whitespace, never filled panels. |
| Emerald | `#10b981` | **THE accent** — fills, bars, rules, buttons | Unchanged. Emerald is the one green that says both "sustainable" and "worth $300,000." Full strength as a *mark on* paper. |
| Emerald-deep | `#047857` body · `#059669`/`#0e9f6e` display/labels | Emerald as *text* on light | `#10b981` fails contrast as type on white. Body-scale emerald text uses `#047857` (AA); large display and tracked labels may lighten to `#059669`, never past `#0e9f6e`. |
| Violet | `#7c3aed` (text) / `#8b5cf6` (fills) | On-chain surfaces only — escrow, registry | Rationed to the one place crypto genuinely lives; never on a surface a normie sees first. |
| Teal | `#0d9488` | Secondary system notes; bridge to Aura-H2O | Sparse. |
| Lime | `#4d7c0f` | Land/growth notes; bridge to Aura-Farms | Sparse, never a large surface. |
| Aurora band | `#34d399` · `#2dd4bf` · `#8b5cf6` + the mark's blues | **Inside media and the mark only** | The v2 night sky lives on as content — the mark's fill, photos, app screens in framed cards. Never as ground, never as text. |

Rules of use: one accent dominates any surface; accents are marks *on* paper, never large fills; dark may exist only *inside* framed media, with paper around it; no glow anywhere.

## 3. The mark

The **KR8TIV aura-family silhouette refilled with an aurora over a treeline** — unchanged through the pivot.

- **It is a family mark.** Siblings carry the same silhouette with a different fill; recognition compounds.
- **The fill is the pitch.** Aurora-over-treeline is the exact sky over the exact land this product builds on.
- **It survives restraint — verified on white, Aug 2026.** The fill holds on paper with no containing shape (the dark conifers anchor it); it works one-color, tiny, and huge.

Two fills, one silhouette:

- **Light-native (leads everywhere on paper):** `assets/aura-homes-logo-light.png` — the same silhouette value-remapped to daylight: pale sky pastels (soft mint, pale teal, whisper violet) over an emerald-deep treeline. The treeline carries the value contrast, so the mark stays legible small on white (verified at 460px and 64px, Aug 2026).
- **Night fill (dark contexts only):** `assets/aura-homes-logo.png` — the original aurora-at-night fill, for use inside framed dark media and the avatar chip.

Do not redraw the silhouette, add glow, or outline it. Favicon/avatar keeps the dark chip (`#050807` behind the night mark, `assets/aura-homes-avatar.png`) — an avatar is a contained shape, and the chip stays recognizable at 16px.

## 4. Typography

Three faces, all SIL OFL 1.1 — free for commercial use and embedding. Unchanged from v2.

| Role | Face | How |
|---|---|---|
| **Display** | [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) 500–620 | Headlines and stage names. Tight negative tracking at scale (−0.02em at h2 up to −0.06em at hero), leading ≈ 0.85–0.95, never black/heavy — weight-at-scale is the AI-slop tell. Sentence case; may end in a period. |
| **Body / UI** | [Manrope](https://fonts.google.com/specimen/Manrope) 400 body, 600–650 buttons | All prose, ink on paper, generous leading, never justified. |
| **Labels / data** | [JetBrains Mono](https://www.jetbrains.com/lp/mono/) 400–500 | The house signature — the tracked caps label: UPPERCASE, ≈ 0.15–0.25em tracking, 10–12px, accent or dim. Eyebrows, `FIG. 1` tags, stage numbers, tables, code. |

- Fallbacks: `"Space Grotesk", "Segoe UI", system-ui` / `Manrope, "Segoe UI", system-ui` / `"JetBrains Mono", Consolas`. Segoe UI remains the sanctioned render-time fallback where webfonts are not installed; the shipped brand assets are rendered with the real faces (variable TTFs, OFL).
- **Applied craft:** modular scale ≈ 1.33 between display steps; tracking by band — display −0.02em tightening to −0.06em as size grows, body 0, mono labels +0.15–0.25em; leading — display 0.9–0.95, body 1.5–1.6, labels 1.0; display weight 500–620, never heavy.
- **The section-kicker pattern** (load-bearing): mono number in accent, tracked-caps label in dim, hairline to the margin (`01 RESULTS ————`), then the display headline.
- Tabular figures in columns; a number always carries its unit and its basis.

## 5. Voice

A competent guide who has done the research and respects you: plain, specific, unhurried, honest to the point of being disarming.

- Sentence-case body; tracked-caps only for labels. **No exclamation marks.** Oxford comma. CAD with `$` and separators. Ranges over point estimates, always.
- Say **review-ready design package**, never "permit-ready AI drawings." Publish the abrasive facts plainly — the December solar collapse, the AWG winter zero, the 12–20 week SIP lead — published limitations are the proof of honesty.
- Never "revolutionary," "seamless," "game-changing," "unlock." If a sentence would survive on a crypto landing page, rewrite it.
- Translate crypto at every user-facing boundary: "funds held in escrow," not "locked in a smart contract"; the hash is one tap deeper.

## 6. Do / don't

| Do | Don't |
|---|---|
| Paper ground, ink type, accents as marks | Dark marketing surfaces (dark lives only inside framed media) |
| One dominant accent per surface | Emerald + teal + violet fighting on one card |
| Tracked-caps mono labels, medium display weight | Heavy display type, title-case labels |
| Ranges with a basis (`$199K–$444K, computed`) | Single-point prices, unsourced numbers |
| Publish the limitation next to the feature | Bury the caveat in a footnote |
| Photograph real land, real panels, real tubs | AI renders passed off as product |
| Whitespace and hairlines as structure | Boxes, borders, filled panels as structure |
| The chain as plumbing (violet, one tap deep) | Hexagons, glow, tickers, wallet-speak up front |
| No exclamation marks | Any exclamation mark |

## 7. The ground — the WorldClaw study

Tencent's [Hunyuan3D-WorldClaw page](https://tencent-hunyuan.github.io/Hunyuan3D-WorldClaw/) is the presentation reference (studied live Aug 2026; fonts verified OFL — see [research/WORLDCLAW.md](research/WORLDCLAW.md)). v2 borrowed its rhythm onto our dark ground; **v3 adopts its ground too** — the founder's call: clean paper, precise type, generous whitespace. What we run:

- **Numbered-section kickers** (§4) — content navigable the way a paper is.
- **Asymmetric headline pairing** — big display statement, short substantiating prose beside or below; never two equal columns.
- **Whitespace as the section boundary** — generous vertical bands separated by full-width hairlines, not background blocks.
- **Media as framed evidence** — rounded corners (~18–26px), 1px hairline border, soft shadow; every figure carries a mono tag + one dim caption; tiles get numbered chips.
- **The spec-ledger** — tiny mono `IN` / `OUT` rows and small hairline-ruled capability grids.
- **Two pill buttons maximum** — one solid ink, one outlined.

The boundary: their vermilion, wordmark, and demo media stay theirs; our emerald, our mark, and our voice (ranges, published limitations, no exclamation marks) stay ours. Their skeleton and their light; our skin.

### Benchmarked against the best (Aug 2026)

The founder's test: does the light system hold up against the best consumer design in the world? Checked against Apple product pages, Stripe, Linear (light), and Airbnb — the five patterns they share, and where we stand:

1. **Near-white ground, near-black ink — never pure.** Apple `#f5f5f7`/`#fff` with ink `#1d1d1f`; Stripe `#f6f9fc` with `#0a2540`; Linear `#f7f8f8`; Airbnb white with `#222`. Ours: `#fafaf9` / `#171a18` — matches.
2. **One accent, rationed to function.** Apple's one blue, Stripe's one blurple `#635bff`, Airbnb's one rausch `#ff385c` "used sparingly but unmistakably," Linear's indigo "for function, not decoration." Ours: emerald is THE accent — matches; the context-locked violet for on-chain surfaces is a deliberate divergence (the chain is a genuinely separate surface, and rationing it to that surface *is* the discipline).
3. **Tracking tightens as type grows; display weight stays modest.** Apple body runs −0.022em; Stripe "tightens aggressively as size grows"; Linear scales to ≈ −0.022em/px at 72px; Airbnb holds display at 500–600, Stripe at 300–400. Ours: −0.02 → −0.06em display band, weight 500–620 — matches. Our positive-tracked mono eyebrow label is a deliberate divergence (the WorldClaw signature these four don't use).
4. **Structure without boxes.** Apple alternates background bands; Stripe shifts tints instead of shadows; Linear uses 1px hairlines and inset shadows. Ours: whitespace + hairlines, no filled panels — matches.
5. **Media carries the color; the page stays quiet.** Apple's photography on quiet grounds; Airbnb's "photography and white space, not bold type," greyscale UI around one coral; framed media with generous radii (Apple 28px, Airbnb 14px). Ours: the aurora lives inside the mark and framed media (18–26px radii); the page is paper — matches.

Sources: [Refero/Apple](https://styles.refero.design/style/c9cabb96-32fa-4896-837a-f2497ce1c856) · [Mobbin/Apple](https://mobbin.com/colors/brand/apple) · [DESIGN.md/Stripe](https://www.designmd.run/blog/stripe-design-system-breakdown) · [webdesignhot/Linear](https://www.webdesignhot.com/design.md/linear/) · [DesignSystems.one/Airbnb](https://www.designsystems.one/design-systems/airbnb-design) · [Superdesign/Airbnb](https://superdesign.dev/blog/airbnb-design-system) — checked August 2026.

## 8. Motion

Restraint, again. Vocabulary from MengTo's kage scroll-craft (credited in [CREDITS.md](CREDITS.md)); never its writing or brand feel.

- One subject, one camera — story pages orbit a single hero object; no parallax confetti.
- Damped, never bouncy; if an easing draws attention to itself, it's wrong.
- Scroll owns the timeline; nothing auto-plays except ambient drift under ~4px.
- Copy behaves like signage: fades in place, holds, fades.
- Light tells the story arc (cool dawn → hearth-warm dusk), hues inside the palette.
- `prefers-reduced-motion` gets a still of equal beauty; WebGL-absent gets a static hero, never a blank.
- Micro-interactions 150–250 ms; scene transitions 600–900 ms of scroll distance, not time.

## 9. Co-branding — the KR8TIV lockup

"A KR8TIV AI PRODUCT" in tracked caps (ink, on light) with the circular KR8TIV badge at text height beside it. The badge never exceeds two lines of its text; its blue-wave palette stays inside the circle. **Aura mark leads, KR8TIV badge closes** — a product-of relationship, never an equal-size partnership lockup.

## 10. Preview & social assets

- `assets/social-card.png` (1280×640) and `assets/site-card.png` (1200×630): paper ground, light-native mark left, ink wordmark with emerald `HOMES`, emerald-deep domain, hairline divider, KR8TIV lockup closing. The template for every card — swap the chip row per context.
- Chips are outlined hairline pills, never filled; one emerald, one violet, one neutral — maximum three.
- The Pages site serves `site-card.png` as `og:image`; light OG cards are fine and distinctive in a dark-mode feed. *(Spec, not yet live: as of Aug 9 the deployed site still serves the pre-flip dark `social-card.png` — copy `assets/site-card.png` to `app/public/` and point `layout.tsx` at it. Flagged in Audit #4.)*
- Favicon/avatar: the dark chip (§3).

## 11. Sources

Green color psychology (emerald = wealth + nature): [Becky Lord](https://beckylord.co.uk/colour-psychology-chapter-3-green/) · [Icons8](https://icons8.com/blog/articles/green-color-guide/) · [Iron Dragon](https://www.irondragondesign.com/green-colour-psychology-in-branding/). Premium restraint / quiet luxury (Aesop non-accommodation, BCG retention): [Beyond the Label](https://www.beyond-thelabel.com/introduction-to-beyondthelabel/aesop-the-brand-that-withholds-meaning) · [Rajiv Gopinath](https://www.rajivgopinath.com/real-time/thought-pieces/quiet-luxury-branding-why-minimalist-branding-is-gaining-popularity). Crypto-that-doesn't-look-crypto: [925 Studios on Phantom](https://www.925studios.co/blog/phantom-wallet-design-breakdown) · [Azuro Digital](https://azurodigital.com/crypto-website-examples/). README craft: [awesome-readme](https://github.com/matiassingers/awesome-readme). Presentation ground and type pairing: [Hunyuan3D-WorldClaw](https://tencent-hunyuan.github.io/Hunyuan3D-WorldClaw/) + [research/WORLDCLAW.md](research/WORLDCLAW.md).

*Third-party figures (BCG retention, wallet drop-off) are as reported by the cited secondary sources, not independently verified.*
