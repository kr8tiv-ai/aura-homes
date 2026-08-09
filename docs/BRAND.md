# Aura Homes — Brand

*The researched rationale for how this product looks, speaks, and refuses to look. The founder's bar is "Tesla/Apple level." This document explains what that actually means in practice, why each choice was made, and what an eager contributor must never "improve." Written Aug 2026 from a brand-research pass; sources at the bottom.*

---

## 1. The thesis: restraint is the premium signal

Every strong brand studied for this pass — Apple, Tesla, Aesop, Arc'teryx, Patagonia, and the handful of crypto products that normal people actually trust — arrives at the same conclusion from different directions: **a brand that does not shout is signaling that it does not need to.**

The research language for this is precise. Analysts describe Aesop's approach as *non-accommodation* — it leads not with claims but with sensory coherence, "cues operating below language," establishing credibility before rational evaluation begins. Boston Consulting Group data cited in the quiet-luxury literature: brands employing minimalist strategies see ~18% higher customer retention than logo-centric competitors, and 65% of luxury consumers rank "subtlety of design" above brand recognition. Minimalism reads as premium because it communicates confidence, control, and focus — in a market of aggressive gradients and dense screens, calm is the contrast that captures attention.

For Aura Homes this is not aesthetic preference; it is strategy. We are asking a normal person to trust an AI and a blockchain with the largest purchase of their life. Every pixel of noise spends trust we cannot afford. The honest, quiet surface *is* the trust argument, the same way Patagonia's published supply-chain flaws are its trust argument — honesty presented plainly outsells enthusiasm presented loudly.

### The crypto corollary: never look like crypto

The crypto products that win normies are the ones that erased the genre. Phantom "looks like a modern consumer app — calm spacing, clear hierarchy, restraint with color and density — and does not look like a block explorer," and that restraint is credited for its survival of the ~70% onboarding drop-off that kills most wallets. Coinbase runs generous white space, bold typography, and one calm blue. Uniswap ships "exceptional restraint... one strategic accent colour." The genre signifiers — neon purple-on-black cyber glow, hexagons, circuit lines, rocket emoji, laser eyes — mark a product as *for insiders*. Aura Homes is for someone who has never held a wallet and is buying a house. **No crypto-glow, ever.** The chain is plumbing. Plumbing is not on the wall.

## 2. The palette, and why

The palette is the aurora over a boreal treeline at night — Banff energy, which is literal, not decorative: this product builds homes under that exact sky.

| Token | Hex | Role | Why |
|---|---|---|---|
| Ground | `#050807` | Every background | Near-black with a green undertone (not pure `#000`). Dark grounds are the shared move of premium tech (Apple product pages, Tesla configurator) — they make small amounts of color read as light, the way an aurora reads against night. The green cast keeps it organic rather than void. |
| Emerald | `#10b981` | Primary accent, actions, the brand green | Color-psychology research is unusually consistent on green: it is the hue human eyes are most sensitive to, and it carries trust, growth, balance, and nature. The *shade* matters: **emerald** specifically signals "wealth, sophistication, and elegance" with a pine-forest association — the premium eco register. Forest green reads heritage/tranquility, sage reads wellness/spa, neon-lime reads tech-startup. Emerald is the only one that says *both* "sustainable" and "worth $300,000" at once. |
| Emerald-bright | `#34d399` | Highlights on dark, data-viz primary | The lit version of the brand green — the aurora at its brightest arc. Used where `#10b981` would sink into the ground color. |
| Teal | `#2dd4bf` | Secondary accent, water/system contexts | The aurora's cyan band; also the bridge to sibling brand Aura-H2O. Teal carries the clarity/precision register (it is the closest color to "engineering" that stays organic). |
| Violet | `#8b5cf6` | Tertiary accent — chain/escrow contexts only | The aurora's rare high-altitude band. Reserved deliberately for on-chain surfaces (escrow, registry), so the one "crypto-adjacent" color is rationed to the one place crypto genuinely lives. Rationing an accent is an Uniswap-style move: one strategic color, not a gradient soup. |
| Lime | `#a3e635` | Sparse — Alberta/land/growth notes | Grass-green edge; also the bridge to sibling Aura-Farms. Never a large surface. |
| Off-white | `#e7ece9` | Text | Warm-grey white, not `#fff` — pure white on near-black vibrates. This is body text under an aurora, not a terminal. |
| Dim | `#8a938f` / `#4a524e` | Secondary text, hairlines | Two steps of recession. Hierarchy through value, not through boxes. |

Rules of use: the ground is always dark; accents are always *light sources on* that ground, never fills of large areas; one accent dominates any given surface; violet never appears on a surface a normie sees first.

## 3. The mark

The mark is the **KR8TIV aura-family silhouette refilled with an aurora over a treeline** — concentric arcs (the aura) whose interior carries northern lights above silhouetted conifers, wordmark set beside it. Why it is right:

- **It is a family mark.** Sibling products carry the same silhouette with a different fill — the org is legible at a glance across products, the way Apple's mark survives any material. Recognition compounds.
- **The fill is the pitch.** Aurora-over-treeline is the exact sky over the exact land this product builds on. No metaphor gap.
- **It survives restraint.** It works in one color (Alloy-silver on dark), tiny (favicon), and huge (hero), with no gradient dependencies in its silhouette.

Do not redraw the silhouette, add glow, outline it, or set it on a light ground without a dark containing shape.

## 4. Typography

*Rewritten August 2026, founder-approved. The type system is now a three-face pairing, adopted from the presentation reference documented in section 8 — all three faces are released under the SIL Open Font License 1.1, so they are free for commercial use, self-hosting, and embedding in rendered assets, with no attribution requirement on our surfaces.*

| Role | Face | Weights | How it is used |
|---|---|---|---|
| **Display** | [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) (variable, 300–700) | 500–620 at scale | Headlines and stage names. Large sizes get **tight negative tracking** (≈ −0.02em at h2 scale up to −0.06em at hero scale) and tight leading (≈ 0.85–0.95). Confident medium weight, never black/heavy — weight-at-scale is still the AI-slop tell. Headlines are sentence case and may end in a period. |
| **Body / UI** | [Manrope](https://fonts.google.com/specimen/Manrope) (variable, 200–800) | 400 body, 600–650 buttons and small labels | All prose and interface text. Sentence case, generous line height, off-white on the dark ground, never justified. |
| **Labels / data** | [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (variable, 100–800) | 400–500 | The house signature — the **tracked caps label** — is now set in mono: UPPERCASE, letter-spaced ≈ 0.15–0.25em, small (10–12px equivalent), in an accent or dim tone. Section eyebrows, figure tags (`FIG. 1`), stage numbers (`01`), data labels, and code. Mono is also the face for numbers in dense tables. |

- **Fallback stack:** `"Space Grotesk", "Segoe UI", system-ui, sans-serif` for display; `Manrope, "Segoe UI", system-ui, sans-serif` for body; `"JetBrains Mono", Consolas, monospace` for labels. Segoe UI (the previous brand face) remains the render-time fallback on pipelines where the webfonts are not installed — assets rendered before this change do not need regeneration.
- **The section-kicker pattern:** a section opens with a mono kicker — number in accent, tracked-caps label in dim, hairline rule running to the margin (`01 RESULTS ————`) — then the display headline. This is the load-bearing typographic move; see section 8.
- **Numbers:** tabular figures where columns exist; a number always carries its unit and its basis.

## 5. Voice

The voice is a competent guide who has done the research and respects you: plain, specific, unhurried, and honest to the point of being disarming.

- Sentence-case body; tracked-caps only for labels.
- **No exclamation marks.** Enthusiasm is carried by the content or not at all.
- Oxford comma. CAD amounts with `$` and thousands separators. Ranges over point estimates, always (LOW/MID/HIGH is voice, not just data).
- Say **review-ready design package**, never "permit-ready AI drawings." Say **abrasive facts plainly** — the December solar collapse, the AWG winter zero, the 12–20 week SIP lead — because published limitations are the brand's proof of honesty (the Patagonia move).
- Never "revolutionary," "seamless," "game-changing," "unlock," "supercharge." If a sentence would survive on a crypto landing page, rewrite it.
- Crypto vocabulary is translated at every user-facing boundary: "funds held in escrow" not "locked in a smart contract"; "payment record" not "transaction hash" (the hash is one tap deeper, for those who want it).

## 6. Do / don't

| Do | Don't |
|---|---|
| Dark ground, accents as light | Light-mode marketing pages, accent-filled panels |
| One dominant accent per surface | Emerald + teal + violet fighting on one card |
| Tracked-caps labels, light display type | Bold display type, title-case labels |
| Ranges with a basis (`$199K–$444K, computed`) | Single-point prices, unsourced numbers |
| Publish the limitation next to the feature | Bury the caveat in a footnote |
| Photograph real land, real panels, real tubs | AI-generated house renders passed off as product |
| Whitespace as structure | Boxes, borders, and dividers as structure |
| The chain as plumbing (violet, one tap deep) | Hexagons, glow, tickers, wallet-speak up front |
| No exclamation marks | Any exclamation mark |

## 7. The sibling brands

KR8TIV AI products share one silhouette, one dark ground, one voice — and are told apart by fill and accent:

| Product | Fill inside the aura | Accent family | Domain |
|---|---|---|---|
| **Aura Homes** (this) | Aurora over conifer treeline | Emerald `#10b981` leading | Eco homes, Alberta |
| **Aura-H2O** | Water | Teal leading | Water |
| **Aura-Farms** | Grass/field green | Grass-green leading | Growing |
| **AuraBNB** | (its own fill) | (its own accent) | Stays |

The system rule: **silhouette constant, world inside it changes.** Aura Homes may borrow teal (water systems) and lime (land) as minor notes precisely because they are the siblings' leads — the family palette is one continuous aurora, sampled at different bands. What no sibling may do is change the silhouette, the dark ground, or the voice.

## 8. Design inspiration — the WorldClaw rhythm

*Added August 2026, after the founder reviewed Tencent's [Hunyuan3D-WorldClaw project page](https://tencent-hunyuan.github.io/Hunyuan3D-WorldClaw/) and approved adopting its presentation system. Credit where due: that page is the layout, rhythm, and typography reference for how Aura Homes presents itself — repo README, docs, and (gently) the site. It is **inspiration for structure and craft only**: our palette, mark, and voice do not move (see the boundary list below). The page's demo media is Tencent's and is never reused here; its fonts are OFL-licensed, so adopting the pairing is legally clean (see section 4 and the [WorldClaw research note](research/WORLDCLAW.md)).*

What we adopt — the vocabulary, translated to our dark aurora ground:

- **Numbered-section kickers.** Every major section opens `01 LABEL` — mono number in accent, tracked-caps mono label in dim, hairline rule to the margin — then the display headline. Content becomes navigable the way a paper is.
- **Asymmetric headline pairing.** Big display statement left, short supporting prose right (or below at readme widths), top-aligned. The headline asserts; the paragraph substantiates. Never two competing columns of equal weight.
- **Whitespace as the section boundary.** Bands of generous vertical space separated by full-width hairlines — not boxes, not background-color blocks. (This was already rule one of section 6; WorldClaw shows how far to push the vertical scale.)
- **Media as framed evidence.** Images and video sit in consistently framed cards: rounded corners (~18–26px), a 1px hairline border at ~11–22% ink opacity, soft long-throw shadow, never bare or edge-to-edge. Every figure carries a mono tag and caption (`FIG. 1` + one dim sentence). Grouped media gets a small accent tick + mono group label. Tiles in a set carry small numbered chips (`01`, `02`).
- **The spec-ledger.** Technical content presented as tiny mono `IN` / `OUT` rows and small capability grids (three cells, hairline top rules, mono tag + bold term + dim description) — WorldClaw's presentation of a pipeline is the cleanest we have seen, and ours is also a pipeline.
- **Two pill buttons, one solid, one outlined.** Primary action solid ink with a circular icon; secondary outlined hairline. Maximum two.

The boundary — what does **not** move, in the same breath:

| Theirs (stays theirs) | Ours (stays ours) |
|---|---|
| Warm paper ground `#f1efe8`, warm ink | Dark aurora ground `#050807`, off-white text |
| Vermilion `#c8512f` accent | Emerald `#10b981` / `#34d399` leading, violet rationed to chain surfaces |
| Their green `#45a870` group labels | Teal `#2dd4bf` for secondary/system labels |
| WorldClaw wordmark energy | The KR8TIV aura mark, untouched (section 3) |
| Research-lab neutrality | Our voice: ranges, published limitations, no exclamation marks (section 5) |

Rule of thumb for any new surface: **their skeleton, our skin.** If a change would survive with the palette swapped back to paper-and-vermilion, it is structure and welcome; if it only works by importing their colors or replacing our mark, it is off-brand.

## 9. Motion

Motion is part of the brand, and it has the same rule as everything else: **restraint is the premium signal.** The reference bar is the scroll-story craft of MengTo's kage page (credited in [CREDITS.md](CREDITS.md)) — we take the *vocabulary* of that work (scroll-linked camera on damped springs, one subject held in frame while the story moves around it, copy that pins and dissolves instead of sliding), never its writing or its brand feel.

- **One subject, one camera.** Story pages orbit and approach a single hero object (the home). No parallax confetti, no elements flying in from screen edges.
- **Damped, never bouncy.** Spring easing with high damping; nothing overshoots more than it settles. If an easing draws attention to itself, it's wrong.
- **Scroll owns the timeline.** The user's thumb is the scrubber; nothing auto-plays except ambient drift (mist, smoke wisps) at amplitudes under ~4px equivalent.
- **Copy behaves like signage:** fades in place, holds, fades. It never moves along a path.
- **Light tells the story arc** — cool dawn (LAND) warming toward hearth-warm dusk (BUILD) is the permitted dramatic device; hue shifts stay inside the palette.
- **Respect is non-negotiable:** `prefers-reduced-motion` gets a still composition of equal beauty; WebGL-absent gets a static hero, never a blank.
- Duration discipline: micro-interactions 150–250 ms; scene transitions 600–900 ms of scroll distance, not time.

## 10. Co-branding — the KR8TIV AI lockup

Aura Homes is **A KR8TIV AI PRODUCT** and says so in exactly one way:

- The line "A KR8TIV AI PRODUCT" in tracked caps, off-white, with the circular KR8TIV badge (the silver-wave avatar, circle-cropped, 2px emerald ring) at text height beside it — as built in `assets/social-card.png` and the hero footer.
- The badge never exceeds the height of two lines of the text it accompanies; KR8TIV's blue-wave palette stays inside the badge circle and never bleeds into Aura surfaces.
- Order of precedence on any asset: Aura mark leads, KR8TIV badge closes. Never side-by-side at equal size — this is a product-of relationship, not a partnership lockup.

## 11. Preview & social assets

- **Repo social card** (`assets/social-card.png`, 1280×640): mark left, wordmark + tagline right, chip row (event · track · license), divider, KR8TIV lockup + repo URL. This is the template for every future card — swap the chip row per context.
- Chips are outlined (2px, 19px radius), never filled; one emerald, one violet, one neutral — maximum three.
- The Pages site serves the same card as `og:image`; any new deployable page inherits it unless it earns its own.
- Favicon/avatar: the mark on `#050807`, centered, ~8% padding (`assets/aura-homes-avatar.png`).

## 12. Sources

Color psychology of green shades (emerald = wealth/sophistication + nature; forest = tranquility; sage = wellness): [Becky Lord, Colour Psychology: Green](https://beckylord.co.uk/colour-psychology-chapter-3-green/) · [Icons8, Ultimate green color guide](https://icons8.com/blog/articles/green-color-guide/) · [Iron Dragon Design, Green Colour Psychology in Branding](https://www.irondragondesign.com/green-colour-psychology-in-branding/) · [The Karma Works, Green Branding Colors](https://thekarmaworks.com/green-branding-colors/) · [Berger, Color psychology of green](https://www.berger.team/en/branding/farbpsychologie-gruen-natur-wachstum-und-wohlstand-als-beruhigende-kraft/)

Premium restraint and quiet luxury (Aesop non-accommodation; BCG retention data; minimalism-as-confidence): [Beyond the Label, Aesop: The Brand That Withholds Meaning](https://www.beyond-thelabel.com/introduction-to-beyondthelabel/aesop-the-brand-that-withholds-meaning) · [Brand Vision, Aesop's Marketing Strategy](https://www.brandvm.com/post/aesop-marketing-strategy) · [Rajiv Gopinath, Quiet Luxury Branding](https://www.rajivgopinath.com/real-time/thought-pieces/quiet-luxury-branding-why-minimalist-branding-is-gaining-popularity) · [iBoost, How Minimalist Design Reinforces Premium Brand Perception](https://theiboost.com/sa/blogs/how-minimalist-design-reinforces-premium-brand-perception/) · [Apart Style, Patagonia vs Arc'teryx](https://www.apartstyle.com/post/patagonia-vs-arcteryx)

Crypto brands that don't look like crypto (Phantom consumer-app restraint; Coinbase/Uniswap minimalism): [925 Studios, Phantom Wallet Design Breakdown](https://www.925studios.co/blog/phantom-wallet-design-breakdown) · [Azuro Digital, Best Crypto Website Designs](https://azurodigital.com/crypto-website-examples/)

README craft (detailed READMEs get ~50% more contributions; hero + badges + visuals + honest structure): [matiassingers/awesome-readme](https://github.com/matiassingers/awesome-readme) · [Eddie Jaoude, What makes a great repo README](https://eddiejaoude.substack.com/p/what-makes-a-great-github-repo-readme) · [dev.to, README templates used by top repos](https://dev.to/belal_zahran/the-github-readme-template-that-gets-stars-used-by-top-repos-4hi7)

Presentation rhythm and type pairing (section 8): [Tencent Hunyuan3D-WorldClaw project page](https://tencent-hunyuan.github.io/Hunyuan3D-WorldClaw/) — studied live August 2026 (typography, section kickers, media framing, spec-ledger patterns); fonts verified as Space Grotesk / Manrope / JetBrains Mono via computed styles, all SIL OFL 1.1. License findings on WorldClaw itself: [research/WORLDCLAW.md](research/WORLDCLAW.md).

*Third-party figures above (BCG retention, luxury-consumer surveys, wallet drop-off rates) are as reported by the cited secondary sources, not independently verified — cite them as such.*
