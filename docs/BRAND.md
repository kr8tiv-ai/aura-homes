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

- **Faces:** the app uses the system humanist sans stack; rendered brand assets use **Segoe UI** (Light/Semilight for display, Semibold for labels) — chosen because it is genuinely available at render time on our pipeline, ages well, and has the quiet geometry of the register we want. If the app later adopts a licensed face, it must be a humanist sans of equal restraint (Inter, Söhne class), swapped everywhere at once.
- **Display:** large sizes go *lighter*, never bolder. Weight at scale is the AI-slop tell.
- **Labels:** UPPERCASE, letter-spaced (tracking ≈ 0.15–0.25em), small, in an accent or dim tone. This is the house signature — the "tracked caps label" — used for section eyebrows, stage names, and data labels.
- **Body:** sentence case, generous line height, off-white, never justified.
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

## 8. Motion

Motion is part of the brand, and it has the same rule as everything else: **restraint is the premium signal.** The reference bar is the scroll-story craft of MengTo's kage page (credited in [CREDITS.md](CREDITS.md)) — we take the *vocabulary* of that work (scroll-linked camera on damped springs, one subject held in frame while the story moves around it, copy that pins and dissolves instead of sliding), never its writing or its brand feel.

- **One subject, one camera.** Story pages orbit and approach a single hero object (the home). No parallax confetti, no elements flying in from screen edges.
- **Damped, never bouncy.** Spring easing with high damping; nothing overshoots more than it settles. If an easing draws attention to itself, it's wrong.
- **Scroll owns the timeline.** The user's thumb is the scrubber; nothing auto-plays except ambient drift (mist, smoke wisps) at amplitudes under ~4px equivalent.
- **Copy behaves like signage:** fades in place, holds, fades. It never moves along a path.
- **Light tells the story arc** — cool dawn (LAND) warming toward hearth-warm dusk (BUILD) is the permitted dramatic device; hue shifts stay inside the palette.
- **Respect is non-negotiable:** `prefers-reduced-motion` gets a still composition of equal beauty; WebGL-absent gets a static hero, never a blank.
- Duration discipline: micro-interactions 150–250 ms; scene transitions 600–900 ms of scroll distance, not time.

## 9. Co-branding — the KR8TIV AI lockup

Aura Homes is **A KR8TIV AI PRODUCT** and says so in exactly one way:

- The line "A KR8TIV AI PRODUCT" in tracked caps, off-white, with the circular KR8TIV badge (the silver-wave avatar, circle-cropped, 2px emerald ring) at text height beside it — as built in `assets/social-card.png` and the hero footer.
- The badge never exceeds the height of two lines of the text it accompanies; KR8TIV's blue-wave palette stays inside the badge circle and never bleeds into Aura surfaces.
- Order of precedence on any asset: Aura mark leads, KR8TIV badge closes. Never side-by-side at equal size — this is a product-of relationship, not a partnership lockup.

## 10. Preview & social assets

- **Repo social card** (`assets/social-card.png`, 1280×640): mark left, wordmark + tagline right, chip row (event · track · license), divider, KR8TIV lockup + repo URL. This is the template for every future card — swap the chip row per context.
- Chips are outlined (2px, 19px radius), never filled; one emerald, one violet, one neutral — maximum three.
- The Pages site serves the same card as `og:image`; any new deployable page inherits it unless it earns its own.
- Favicon/avatar: the mark on `#050807`, centered, ~8% padding (`assets/aura-homes-avatar.png`).

## 11. Sources

Color psychology of green shades (emerald = wealth/sophistication + nature; forest = tranquility; sage = wellness): [Becky Lord, Colour Psychology: Green](https://beckylord.co.uk/colour-psychology-chapter-3-green/) · [Icons8, Ultimate green color guide](https://icons8.com/blog/articles/green-color-guide/) · [Iron Dragon Design, Green Colour Psychology in Branding](https://www.irondragondesign.com/green-colour-psychology-in-branding/) · [The Karma Works, Green Branding Colors](https://thekarmaworks.com/green-branding-colors/) · [Berger, Color psychology of green](https://www.berger.team/en/branding/farbpsychologie-gruen-natur-wachstum-und-wohlstand-als-beruhigende-kraft/)

Premium restraint and quiet luxury (Aesop non-accommodation; BCG retention data; minimalism-as-confidence): [Beyond the Label, Aesop: The Brand That Withholds Meaning](https://www.beyond-thelabel.com/introduction-to-beyondthelabel/aesop-the-brand-that-withholds-meaning) · [Brand Vision, Aesop's Marketing Strategy](https://www.brandvm.com/post/aesop-marketing-strategy) · [Rajiv Gopinath, Quiet Luxury Branding](https://www.rajivgopinath.com/real-time/thought-pieces/quiet-luxury-branding-why-minimalist-branding-is-gaining-popularity) · [iBoost, How Minimalist Design Reinforces Premium Brand Perception](https://theiboost.com/sa/blogs/how-minimalist-design-reinforces-premium-brand-perception/) · [Apart Style, Patagonia vs Arc'teryx](https://www.apartstyle.com/post/patagonia-vs-arcteryx)

Crypto brands that don't look like crypto (Phantom consumer-app restraint; Coinbase/Uniswap minimalism): [925 Studios, Phantom Wallet Design Breakdown](https://www.925studios.co/blog/phantom-wallet-design-breakdown) · [Azuro Digital, Best Crypto Website Designs](https://azurodigital.com/crypto-website-examples/)

README craft (detailed READMEs get ~50% more contributions; hero + badges + visuals + honest structure): [matiassingers/awesome-readme](https://github.com/matiassingers/awesome-readme) · [Eddie Jaoude, What makes a great repo README](https://eddiejaoude.substack.com/p/what-makes-a-great-github-repo-readme) · [dev.to, README templates used by top repos](https://dev.to/belal_zahran/the-github-readme-template-that-gets-stars-used-by-top-repos-4hi7)

*Third-party figures above (BCG retention, luxury-consumer surveys, wallet drop-off rates) are as reported by the cited secondary sources, not independently verified — cite them as such.*
