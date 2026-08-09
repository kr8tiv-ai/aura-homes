# Aura Homes — SEO & AI-Search Strategy

*Research and implementation spec, written August 2026. Part 1 is the research: who actually searches for what we build, and what ranks — in Google and in answer engines — in 2026. Part 2 is the spec: exact tags, schema, and files the app can apply verbatim. Domain: **https://aurahomes.fun** (custom domain configured; serving at kr8tiv-ai.github.io/aura-homes until DNS lands). Everything here follows [BRAND.md](BRAND.md) voice rules — no keyword stuffing, no schema padding, ranges with a basis, honest limitations published next to the feature.*

*Scope note: this document is a spec. The app agent applies section 5 to `app/`; nothing in this file edits the app directly.*

---

## 1. Who searches for this — the demographic research

Five buyer groups converge on small off-grid eco homes in Alberta in 2026, from different directions. The query language differs sharply by group, which is why the keyword map in section 2 is intent-labeled.

| # | Group | Who they are | Why they search | How they phrase it |
|---|---|---|---|---|
| 1 | **Affordability escapees** | Younger buyers priced out of Calgary/Edmonton (detached in Calgary averages near $700,000; rural parcels run hundreds of thousands less). Affordability is the researched No. 1 reason people disconnect from municipal grids. 63% of millennials expressed interest in tiny-home living in the IPX1031 survey. | A house they can actually afford, on land they own | "tiny home builders alberta", "cheapest way to build a house alberta", "off grid cabin cost" |
| 2 | **Remote workers** | Hybrid/remote professionals trading proximity for acreage; rural Alberta property taxes run 15–25% below the big cities, and rural broadband expansion made the move stick | Space, quiet, and a mortgage-sized saving without leaving their job | "acreage for sale near edmonton", "rural alberta internet", "off grid homes alberta" |
| 3 | **Downsizing retirees** | 40% of the 55+ cohort is considering downsizing (AARP), but many Alberta retirees report that condos and villas no longer save money — a small new build on cheap land is the arithmetic that still works | Lower cost, lower maintenance, single-level living | "small home builders alberta", "downsizing to a small house canada", "retirement cabin alberta" |
| 4 | **Homesteaders and self-sufficiency buyers** | Eco-motivated, prepper-adjacent, or simply weary of consumerism; 1–20 acre ambitions, water access is their first question | Independence — energy, water, food — done legally | "homesteading alberta", "off grid living alberta laws", "well vs cistern alberta", "septic requirements alberta" |
| 5 | **Crypto-wealthy buyers** | Digital wealth converting into physical assets is a documented 2026 trend (stablecoin-funded property purchases, crypto-fluent brokerages, Fannie Mae's crypto-qualification guidance in the US). A Canadian holder of six-figure USDC has **no clean path to a rural Alberta closing** — that gap is our wedge | Turn on-chain wealth into a real asset without a forced fiat detour | "buy land with crypto canada", "buy house with usdc", "crypto real estate canada", "bitcoin real estate alberta" |

Groups 1–4 search like home-builders and never use crypto vocabulary; group 5 searches like crypto-natives and never uses builder vocabulary. The site must rank for both languages without mixing them on one surface — which is exactly how the brand already works (the chain is plumbing; plumbing is not on the wall).

## 2. The keyword map

Intent labels: **[T]** transactional/commercial (wants to act), **[I]** informational (wants to learn), **[N]** navigational (wants us or a competitor), **[C]** crypto-native phrasing.

### Head terms

| Query | Intent | Notes |
|---|---|---|
| off grid homes alberta | T/I | The core head term — buyers and dreamers both |
| tiny home builders alberta | T | Highest commercial intent in the cluster; we appear as the owner-builder alternative to builders |
| off grid cabins alberta | T/I | Kijiji-heavy SERP — long-tail content wins here, not the head |
| eco homes alberta / eco home builders canada | T | Smaller volume, perfect fit |
| SIP homes canada / SIP panels canada | I/T | Build-system researchers; supplier-comparison mindset |
| owner builder alberta | I/T | Regulatory query — our playbook content is the honest best answer |
| screw pile foundation alberta | I/T | Strong local supplier SERP; we rank via the no-concrete research |
| off grid solar alberta | I/T | Vendor-dominated; our honest winter math is the differentiator |
| buy land with crypto | C/T | Thin, low-quality SERP today — winnable |

### Long-tail and question queries (People-Also-Ask shaped)

| Query | Intent | Page that answers it |
|---|---|---|
| how much does it cost to build off grid in alberta | I | /budget |
| how much does an off grid cabin cost in canada | I | /budget |
| can I build my own house in alberta | I | /overview (FAQ) |
| do you need an architect to build a house in alberta | I | /design |
| what is the minimum house size in alberta | I | /land |
| owner builder authorization alberta cost | I | /overview (FAQ) |
| screw piles vs concrete foundation cost alberta | I | /budget |
| does off grid solar work in alberta winter | I | /overview (FAQ) |
| how much solar do I need for an off grid cabin in alberta | I | /budget |
| well vs cistern alberta acreage | I | /land |
| septic system requirements alberta acreage | I | /land |
| sip panel cost per square foot canada | I | /design |
| how long do sip panels take to order | I | /design |
| do atmospheric water generators work in winter canada | I | /overview (FAQ) — we are one of very few honest sources |
| can you buy land in canada with cryptocurrency | C/I | /land |
| how to buy a house with usdc | C/I | /escrow |
| crypto escrow real estate canada | C/T | /escrow |
| construction holdback alberta 10% | I | /escrow — nobody else explains this next to an escrow product |
| borrow against crypto to buy property canada | C/I | /escrow (teaches Aave V3, Ledn — never advises) |
| x layer usdc native address | C/I | /escrow — pinned addresses are a citable fact |

### Query language rules learned from the research

- Buyers say **"tiny home"** even when they mean 600–1,000 sqft; the industry says "small home." Use both, honestly: we build *small architectural homes*, and the phrase "tiny home" may appear in comparative/FAQ contexts, never as our self-description (VISION.md: "not tiny homes necessarily").
- Nobody searches "substrate" anything. Regulatory phrases people actually type: "owner builder", "building permit", "minimum square footage", "septic requirements."
- Crypto-natives search token-first ("usdc", "stablecoin", "escrow"), not brand-first. The /escrow page carries that vocabulary; the home page stays normie-first.

## 3. What ranks in 2026 — the baseline we build against

The 2026 ranking picture, cross-checked across current industry analyses:

1. **Ranking factors cluster in four tiers**: foundational (crawlability, HTTPS, Core Web Vitals), topical (content depth, information gain, entity coverage), authority (E-E-A-T, citations, brand entity), and competitive (engagement, freshness). A static, fast, honest site with genuinely novel researched data hits all four.
2. **Topical authority beats single pages.** A site with ~20 interconnected pieces on one subject consistently outranks one monolithic guide. Our cluster already exists — the docs corpus (FEASIBILITY, ALBERTA-PLAYBOOK, foundations research, token research) — it lives on github.com today and feeds the site cluster over time.
3. **Core Web Vitals thresholds (unchanged, still a tiebreaker, measured at p75 over 28 days):** LCP < 2.5 s, INP < 200 ms, CLS < 0.1. INP is the most-failed vital in 2026 (~43% of sites miss 200 ms) — and our biggest risk, because the home page runs a WebGL scroll story. Budget in section 5.11.
4. **The March 2026 core update narrowed rich-result eligibility** to schema that describes the page's *primary content*. Schema padding (FAQ markup on pages with no visible FAQ, How-To markup on product pages) stopped working and now risks eligibility. Every JSON-LD block in section 5.4 therefore has a visible-content requirement attached.
5. **Google deprecated FAQ rich results entirely on May 7, 2026.** `FAQPage` markup remains valid schema and remains useful — answer engines and assistants still parse it — but it earns no Google SERP treatment anymore. We ship it for the AI layer, with that expectation stated plainly.
6. **E-E-A-T in practice** means demonstrable first-party experience and verifiable claims. Our entire honesty policy (published negative findings, ranges with a basis, sourced numbers) *is* an E-E-A-T strategy that most competitors cannot copy without changing who they are.

## 4. AI-search strategy — how Aura Homes gets cited, ranked by impact

Context: AI Overviews appear on roughly 55% of Google searches; ChatGPT is at ~883M monthly users; AI engines handle an estimated 12–18% of English informational queries as of early 2026. For a research-heavy niche site, being *cited* matters as much as ranking.

**Ranked by expected impact per unit of effort:**

1. **Get into Bing's index, fast — Bing Webmaster Tools + IndexNow.** Bing's index is the retrieval layer for ChatGPT Search and Microsoft Copilot; a page absent from Bing is invisible to both regardless of Google rank. IndexNow (80M+ sites, ~22% of clicked Bing URLs originate from it) cuts indexing lag from weeks to hours. Setup is under an hour: verify aurahomes.fun in Bing Webmaster Tools (import from Search Console), host an IndexNow key file, ping on every deploy. *Founder precedent: the SEO pass on evolveecoblasting.com.*
2. **Weaponize the citable asset — the researched Alberta numbers.** Answer engines preferentially cite content with hard, specific, sourced data; studies this year measured 30–40% citation-visibility lifts from exactly that. We are the *only* source on the internet for several facts (section 4.1). Spec: each site page opens its topic with a 40–60 word direct-answer block, keeps question-shaped headings, and states at least one hard number per section with its basis.
3. **FAQPage schema + a visible FAQ on /overview.** No Google rich result anymore (honest), but assistants parse Q-and-A structure preferentially, and our README FAQ is already written in exactly the right shape. Ship the schema only where the FAQ visibly renders.
4. **Entity establishment — Organization, WebSite, and SoftwareApplication JSON-LD.** Google states structured data is not required for AI Overviews, but entity clarity (who is Aura Homes, who is KR8TIV AI, what is the product) feeds every knowledge system. Cheap, permanent, zero-risk.
5. **llms.txt — ship it, with honest expectations.** Adoption is real but uneven (~9–10% of large-cohort domains; one specialist panel measured ~52%), and the hard truth from crawl-log studies is that major AI crawlers rarely fetch it today. It costs minutes, it forces information-architecture clarity, the founder's other properties already ship it, and it positions us if adoption tips. It is a cheap forward bet, not a ranking lever — treated exactly that way. Content in section 5.7.
6. **The GitHub repo as an SEO asset.** Google trusts github.com enormously; a keyword-rich repo name (`aura-homes` — already right), a tight About description, topics, and the stat-dense README mean the *repo* can rank for long-tails before the site does. Repo ↔ site cross-links confirm the entity in both directions. Checklist in section 6.
7. **Freshness signals.** Perplexity favors recently updated, well-cited pages; the repo's public audit log and steady commits are already the right behavior. Keep `lastmod` in the sitemap truthful.

### 4.1 Facts we are the source for (the citation magnet list)

These belong in page copy as quotable, stat-rich blocks — each with its basis, per house style:

- Edmonton's December solar yield: **~1.3 kWh per installed kW per day** — a 70–77% collapse from summer (the number vendors don't quote).
- Every condenser-type AWG cuts off around **15°C and 30% relative humidity**; Edmonton sits below 15°C outdoors 7–8 months a year; outdoor winter output is **zero litres**.
- The district-minimum trap: Lac Ste. Anne County's Agricultural district minimum dwelling size is **592 sqft**; the same county's Country Residential district requires **1,076 sqft** — same county, minutes apart, and one parcel makes an 800 sqft home unpermittable.
- The 800 sqft off-grid SIP reference build, computed line-by-line: **$199,100 / $301,280 / $443,900** (LOW/MID/HIGH, CAD, ex-land) versus $450,000–$650,000 builder-delivered.
- Screw-pile foundations in Alberta: **$6,000–$15,000** versus $25,000–$45,000 poured concrete — the cheaper option is also the no-concrete one.
- SIP panel lead time: **12–20 weeks** from approved drawings to delivery. No platform shortens a panel plant's queue.
- Alberta Owner Builder Authorization: **$95 with warranty, $750 with the opt-out** — and the opt-out freezes resale for 10 years via title caveat (since December 2025).
- Native Circle USDC launched on X Layer **August 6, 2026** (mainnet `0xB6CEceAB302E2E4948951eE7843FC24E92933061`); USDC is the only CSA-approved stablecoin for registered Canadian platforms.

---

## 5. Implementation spec — apply verbatim

### 5.1 Canonical domain and the transition

**Canonical host: `https://aurahomes.fun` — apex, https, no www, trailing slash on routes** (matches `trailingSlash: true` in the static export).

Transition steps, in order:

1. **DNS** (already configured): apex `A`/`ALIAS` records per GitHub Pages requirements, plus `www` CNAME → `kr8tiv-ai.github.io`. GitHub redirects `www.aurahomes.fun` → `aurahomes.fun` once the apex is the configured Pages domain.
2. **Commit `app/public/CNAME`** containing exactly `aurahomes.fun` (one line) so deploys never wipe the Pages custom-domain setting. Enable "Enforce HTTPS" in Pages settings once the certificate issues.
3. **Drop the basePath.** With a custom domain, Pages serves the project site at the domain *root*. The current `GH_PAGES=1` build hardcodes `basePath: "/aura-homes"`, which would break every asset and link at aurahomes.fun. Change `next.config.mjs` so the Pages build uses `basePath: ""` and `assetPrefix` unset (keep `output: "export"`, `trailingSlash: true`, `images: { unoptimized: true }`). `lib/basePath.ts` then resolves to `""` with no call-site changes.
4. **GitHub's own redirect covers the old URLs**: once the custom domain is set, `kr8tiv-ai.github.io/aura-homes/<path>` 301-redirects to `https://aurahomes.fun/<path>` automatically — link equity transfers; no meta-refresh hacks needed.
5. **`metadataBase: new URL("https://aurahomes.fun")`** in `app/layout.tsx`, and every page emits a self-referencing canonical (Next.js `alternates: { canonical: "/<route>/" }`).
6. **Search Console**: add `aurahomes.fun` as a Domain property (DNS TXT verification), submit `https://aurahomes.fun/sitemap.xml`. Keep the old `kr8tiv-ai.github.io` URLs out of new sitemaps entirely.
7. **Bing Webmaster Tools**: import the verified property from Search Console, then set up IndexNow (5.8).

`<html lang="en-CA">` — the site is Canadian English and says CAD amounts throughout; label it truthfully.

### 5.2 The `<head>` — site-wide (home page values)

Title (54 chars), description (149 chars), verified under the 60/155 limits:

```html
<title>Aura Homes — AI-designed off-grid eco homes in Alberta</title>
<meta name="description" content="An open-source AI agent that takes you from USDC on X Layer to the keys of an off-grid eco home in Alberta — land, design, budget, escrow, and build.">
<link rel="canonical" href="https://aurahomes.fun/">
<meta name="theme-color" content="#050807">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="Aura Homes">
<meta property="og:url" content="https://aurahomes.fun/">
<meta property="og:title" content="Aura Homes — from USDC on X Layer to the keys of an off-grid eco home">
<meta property="og:description" content="An open-source AI agent that orchestrates the whole journey — land, design, budget, escrow, build — in Alberta first. No middlemen, nothing hidden.">
<meta property="og:image" content="https://aurahomes.fun/site-card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Aura Homes — aurahomes.fun — from USDC on X Layer to the keys of an off-grid eco home">
<meta property="og:locale" content="en_CA">

<!-- Twitter / X -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Aura Homes — from USDC on X Layer to the keys of an off-grid eco home">
<meta name="twitter:description" content="An open-source AI agent that orchestrates the whole journey — land, design, budget, escrow, build — in Alberta first. No middlemen, nothing hidden.">
<meta name="twitter:image" content="https://aurahomes.fun/site-card.png">
```

Notes for the app agent:

- In Next.js metadata terms: keep one `metadataBase`, express the above via the `metadata` export; og:title/og:description intentionally differ from the SERP title/description (social carries the tagline; search carries the category terms).
- **Do not add `twitter:site`** until the dedicated X account exists (hackathon requirement, Matt-only action). Adding a dead handle is worse than none.
- `site-card.png` ships from `assets/site-card.png` → copy to `app/public/site-card.png` (root-served). The repo's `social-card.png` remains the GitHub-repo card; the site card carries the domain.
- Favicon/icons: `assets/aura-homes-avatar.png` as `icon` and `apple-touch-icon` (Next.js `app/icon.png` + `app/apple-icon.png` convention is fine).

### 5.3 Per-page titles and descriptions

All titles ≤ 60 chars, all descriptions ≤ 155 chars (counts verified):

| Route | `<title>` | Meta description |
|---|---|---|
| `/` | Aura Homes — AI-designed off-grid eco homes in Alberta | An open-source AI agent that takes you from USDC on X Layer to the keys of an off-grid eco home in Alberta — land, design, budget, escrow, and build. |
| `/overview/` | How Aura Homes works — the five-stage pipeline | Land, design, budget, escrow, build — how one AI agent orchestrates an off-grid eco home in Alberta, with honest numbers and no middlemen. |
| `/land/` | Find land for an off-grid home in Alberta — Aura Homes | Parcel filters that catch what kills small builds: district minimum dwelling size, aquifer reliability, and septic soils. USDC in, title out. |
| `/design/` | AI home design — review-ready SIP packages — Aura Homes | A questionnaire becomes a review-ready design package for a SIP-built small home, checked against Alberta's real code constraints. No architect needed. |
| `/budget/` | What an off-grid build costs in Alberta — Aura Homes | The 800 sqft reference build, computed line by line: $199,100 to $443,900 ex-land, with an Alberta supplier on every line. Ranges with sources, always. |
| `/escrow/` | USDC milestone escrow on X Layer — Aura Homes | Milestone escrow in native USDC: 2-of-3 release and Alberta's statutory 10% holdback enforced in contract state. Fund by Visa or bring USDC. |
| `/dashboard/` | Your build journey dashboard — Aura Homes | One view of a build in flight: stage, blockers, escrow position, and what happens next — the Aura Brain keeps a year-scale project on rails. |

Each page also sets `alternates.canonical` to its own route and inherits the OG/Twitter defaults with its own title/description swapped in. Every route stays indexable — the dashboard is a demo surface, and hiding it would contradict the open-by-design brand.

### 5.4 JSON-LD — ready to paste

Placement rule (March 2026 core update): a block ships only on pages whose *visible primary content* it describes. One `<script type="application/ld+json">` per block, in `<head>` or end of `<body>`.

**Block 1 — Organization + WebSite (home page, `/`):**

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://aurahomes.fun/#org",
      "name": "Aura Homes",
      "url": "https://aurahomes.fun/",
      "logo": "https://aurahomes.fun/aura-mark.png",
      "description": "An open-source AI agent that orchestrates building an off-grid eco home in Alberta, Canada — land, design, budget, USDC escrow on X Layer, and build.",
      "foundingDate": "2026",
      "areaServed": {
        "@type": "AdministrativeArea",
        "name": "Alberta, Canada"
      },
      "parentOrganization": {
        "@type": "Organization",
        "name": "KR8TIV AI",
        "url": "https://github.com/kr8tiv-ai"
      },
      "sameAs": [
        "https://github.com/kr8tiv-ai/aura-homes"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://aurahomes.fun/#website",
      "url": "https://aurahomes.fun/",
      "name": "Aura Homes",
      "publisher": { "@id": "https://aurahomes.fun/#org" },
      "inLanguage": "en-CA"
    }
  ]
}
```

*(When the dedicated X account exists, append its URL to `sameAs`. No physical address or phone is published because none exists — do not invent a LocalBusiness.)*

**Block 2 — SoftwareApplication (home page, `/`):**

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://aurahomes.fun/#app",
  "name": "Aura Homes",
  "url": "https://aurahomes.fun/",
  "applicationCategory": "HomeApplication",
  "operatingSystem": "Web",
  "description": "AI agent for commissioning an off-grid, SIP-built eco home in Alberta: parcel suitability filters, an AI design process producing review-ready design packages, a line-item Alberta budget, and USDC milestone escrow on X Layer with the statutory 10% holdback in contract state.",
  "isAccessibleForFree": true,
  "license": "https://github.com/kr8tiv-ai/aura-homes/blob/main/LICENSE",
  "creator": { "@id": "https://aurahomes.fun/#org" },
  "softwareHelp": "https://github.com/kr8tiv-ai/aura-homes#readme",
  "sameAs": "https://github.com/kr8tiv-ai/aura-homes"
}
```

*(`isAccessibleForFree: true` is true today — the demo is free and the repo is MIT. When the x402 usage fee ships, replace it with an `offers` block carrying the real price. Never add `aggregateRating` or reviews — none exist.)*

**Block 3 — FAQPage (`/overview/` only, and only once the page visibly renders this FAQ):**

The page must render these eight questions and answers as visible content — they are drawn from the README FAQ, condensed. Known trade-off, stated honestly: Google dropped FAQ rich results in May 2026; this block exists for answer engines and assistants, which still parse Q-and-A structure.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do I need to own crypto to use Aura Homes?",
      "acceptedAnswer": { "@type": "Answer", "text": "No. Pay by Visa or Mastercard and an on-ramp partner converts to USDC in-flow; prices display in CAD throughout. If you already hold USDC, bring it — that path is faster and cheaper." }
    },
    {
      "@type": "Question",
      "name": "Do I need an architect to build a house in Alberta?",
      "acceptedAnswer": { "@type": "Answer", "text": "No. Alberta's Architects Act exempts 1–4 unit dwellings of any size. The design is governed by Part 9 of the building code; a residential designer ($1,200–$2,700) finishes the AI's review-ready package into the permit set." }
    },
    {
      "@type": "Question",
      "name": "Can I build my own house in Alberta?",
      "acceptedAnswer": { "@type": "Answer", "text": "Much of it, legally. With an Owner Builder Authorization you may pull your own electrical, plumbing, gas, and private-sewage-application permits on a home you own and will occupy. The hard legal lines: solar and battery wiring needs a licensed electrical contractor, septic needs a certified installer, and well drilling is licensed work." }
    },
    {
      "@type": "Question",
      "name": "How much does it cost to build an off-grid home in Alberta?",
      "acceptedAnswer": { "@type": "Answer", "text": "For an 800 sqft off-grid SIP reference build: $199,100 to $443,900 CAD ex-land ($301,280 mid), computed from a line-item model with Alberta suppliers. Land adds $75,000–$350,000 for 1–5 acres in the Edmonton ring. A conventional builder delivers the same home at $450,000–$650,000 ex-land." }
    },
    {
      "@type": "Question",
      "name": "Does off-grid solar work through an Alberta winter?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes, as a system. Solar collapses roughly 70–77% in December (~1.3 kWh per kW per day in Edmonton), so an honest design pairs 8–12 kW of panels with 20–40 kWh of battery, an auto-start generator, and a WETT-inspected wood stove. Anyone quoting off-grid without a generator is quoting July." }
    },
    {
      "@type": "Question",
      "name": "Do atmospheric water generators work in winter in Canada?",
      "acceptedAnswer": { "@type": "Answer", "text": "No. Condenser-type AWGs cut off around 15°C and 30% relative humidity, and Edmonton is below 15°C outdoors 7–8 months of the year — outdoor winter output is zero litres. That is why every Aura home plumbs its AWG as the summer producer (10–20 L/day, June through September) while a cistern or well carries winter." }
    },
    {
      "@type": "Question",
      "name": "Can I get a mortgage for an off-grid home?",
      "acceptedAnswer": { "@type": "Answer", "text": "Banks generally will not mortgage an off-grid, owner-built, sub-1,000 sqft home. The honest financing story is cash or progress-funding, plus crypto-collateral borrowing (Aave V3 on X Layer, Ledn) for crypto-native buyers. The app teaches those paths; it never gives financial advice." }
    },
    {
      "@type": "Question",
      "name": "What happens to my money if the builder disappears?",
      "acceptedAnswer": { "@type": "Answer", "text": "It sits in an escrow contract on X Layer that no single party — including the builder — can move alone. Releases need two of three parties (homeowner, builder, arbiter), and unapproved milestones stay funded and recoverable." }
    }
  ]
}
```

**Deliberately not shipped:** `Product` (nothing is purchasable today — a Product block with no offer is schema theater), `LocalBusiness` (no premises), `BreadcrumbList` (the site is one level deep; breadcrumbs would be padding), `HowTo` (deprecated for rich results and not our page shape), reviews or ratings of any kind (none exist).

### 5.5 robots.txt — exact content (`app/public/robots.txt`)

```
# aurahomes.fun — open by design.
# The whole product is open source; AI crawlers are welcome to all of it.
# Repo: https://github.com/kr8tiv-ai/aura-homes

User-agent: *
Allow: /

Sitemap: https://aurahomes.fun/sitemap.xml
```

No crawler is blocked, including GPTBot, ClaudeBot, PerplexityBot, and Google-Extended — being read by AI systems is a distribution channel for this product, not a leak. That is a deliberate decision consistent with the MIT license, recorded here so nobody "fixes" it.

### 5.6 sitemap.xml — exact route list (`app/public/sitemap.xml`)

Seven URLs, canonical host, trailing slashes. Set `<lastmod>` to the real deploy date (ISO 8601) at build time — a truthful lastmod is a freshness signal; a fake one is noise.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://aurahomes.fun/</loc><lastmod>2026-08-09</lastmod></url>
  <url><loc>https://aurahomes.fun/overview/</loc><lastmod>2026-08-09</lastmod></url>
  <url><loc>https://aurahomes.fun/land/</loc><lastmod>2026-08-09</lastmod></url>
  <url><loc>https://aurahomes.fun/design/</loc><lastmod>2026-08-09</lastmod></url>
  <url><loc>https://aurahomes.fun/budget/</loc><lastmod>2026-08-09</lastmod></url>
  <url><loc>https://aurahomes.fun/escrow/</loc><lastmod>2026-08-09</lastmod></url>
  <url><loc>https://aurahomes.fun/dashboard/</loc><lastmod>2026-08-09</lastmod></url>
</urlset>
```

No `priority` or `changefreq` — Google ignores both, and shipping ignored fields is the small version of dishonesty this repo avoids.

### 5.7 llms.txt — exact content (`app/public/llms.txt`)

Follows the llms.txt convention: H1, blockquote summary, then curated links with one-line descriptions. Honest status note: major AI crawlers rarely fetch this file today; it ships because it costs minutes, the founder's other properties carry one, and it doubles as our canonical machine-readable summary.

```
# Aura Homes

> An open-source AI agent that orchestrates building an off-grid eco home in
> Alberta, Canada — find and filter land, design a SIP-built small home with AI,
> budget it line-by-line from real Alberta suppliers, fund it in native USDC
> milestone escrow on X Layer, and manage the build to keys. A KR8TIV AI
> product. MIT licensed. Alberta pilot, Canada first.

Key facts, all researched and sourced in the repository:

- Reference build: 800 sqft off-grid SIP home, $199,100 / $301,280 / $443,900
  CAD (LOW/MID/HIGH, ex-land), computed from a line-item model. A conventional
  builder delivers the same home at $450,000–$650,000 ex-land.
- Alberta needs no architect for 1–4 unit dwellings (Architects Act exemption);
  a residential designer ($1,200–$2,700) finishes the permit set.
- District minimum dwelling sizes gate small builds: Lac Ste. Anne County
  Agricultural district 592 sqft vs Country Residential 1,076 sqft.
- Edmonton December solar yield is ~1.3 kWh per installed kW per day — off-grid
  Alberta requires battery, auto-start generator, and wood heat, not solar alone.
- Condenser AWGs cut off near 15°C / 30% RH; winter output in Alberta is zero.
  Aura homes plumb the AWG as the summer producer; a cistern or well carries winter.
- Foundations are protected steel screw piles ($6,000–$15,000), not poured
  concrete ($25,000–$45,000) — no cement leachate near the water table.
- Escrow is native USDC on X Layer (launched August 6, 2026): 2-of-3 milestone
  release with Alberta's statutory 10% construction holdback in contract state.
  USDC is the only CSA-approved stablecoin for registered Canadian platforms.
- No user needs a crypto exchange: pay by Visa/Mastercard and an on-ramp
  converts to USDC in-flow; prices display in CAD.

## Pages

- [Overview](https://aurahomes.fun/overview/): the five-stage pipeline — LAND,
  DESIGN, BUDGET, ESCROW, BUILD — with the FAQ.
- [Land](https://aurahomes.fun/land/): parcel suitability filters (district
  minimums, aquifer, grid proximity, septic soils) and the USDC acquisition path.
- [Design](https://aurahomes.fun/design/): questionnaire to review-ready SIP
  design package, checked against Alberta code constraints.
- [Budget](https://aurahomes.fun/budget/): the line-item Alberta cost model with
  LOW/MID/HIGH ranges and suppliers.
- [Escrow](https://aurahomes.fun/escrow/): USDC milestone escrow with the 10%
  holdback, explained for a normal person.
- [Dashboard](https://aurahomes.fun/dashboard/): the build-journey view.

## Documentation

- [README](https://github.com/kr8tiv-ai/aura-homes#readme): the whole product,
  said plainly, with the honesty policy.
- [Feasibility study](https://github.com/kr8tiv-ai/aura-homes/blob/main/docs/FEASIBILITY.md):
  tech, law, money, and the honest red flags, ~300 sources.
- [Alberta playbook](https://github.com/kr8tiv-ai/aura-homes/blob/main/docs/ALBERTA-PLAYBOOK.md):
  the regulatory and supplier playbook for the pilot province.
- [Vision](https://github.com/kr8tiv-ai/aura-homes/blob/main/docs/VISION.md):
  the canonical brief.

## Optional

- [Brand](https://github.com/kr8tiv-ai/aura-homes/blob/main/docs/BRAND.md):
  palette, type, and voice rationale.
- [Architecture](https://github.com/kr8tiv-ai/aura-homes/blob/main/docs/ARCHITECTURE.md):
  app, agent, contracts, chain config.
```

### 5.8 IndexNow + webmaster checklist (post-DNS, one-time)

1. Google Search Console: Domain property for `aurahomes.fun` (DNS TXT), submit the sitemap.
2. Bing Webmaster Tools: import from Search Console (one click, inherits verification).
3. IndexNow: generate a 32-hex key, ship `app/public/<key>.txt` containing the key, and on each deploy POST the changed URLs to `https://api.indexnow.org/indexnow` with `host=aurahomes.fun`. This is the cheapest route into the ChatGPT/Copilot retrieval layer.
4. Verify the GitHub Pages 301 (`curl -I https://kr8tiv-ai.github.io/aura-homes/` → `301` → `https://aurahomes.fun/`) before announcing the domain anywhere.

### 5.9 Keyword-to-page mapping (content targets for the app agent)

| Page | Primary target | Secondary targets | The quotable block it must carry |
|---|---|---|---|
| `/` | off grid homes alberta | eco homes alberta, AI home design, buy a house with USDC | The one-sentence product + the $199K–$444K computed range |
| `/overview/` | how does building an off-grid home work | can I build my own house in alberta, aura homes | The five stages + the full FAQ (visible, schema-backed) |
| `/land/` | off grid land alberta | buy land with crypto canada, minimum house size alberta, well vs cistern alberta | The 592 vs 1,076 sqft district trap, named and explained |
| `/design/` | SIP homes canada | do you need an architect in alberta, sip panel cost canada | No-architect exemption + 12–20 week SIP lead time |
| `/budget/` | how much does it cost to build off grid in alberta | cost to build a house alberta, screw piles vs concrete cost, off grid solar cost alberta | The full line-item table with LOW/MID/HIGH and the builder comparison |
| `/escrow/` | crypto escrow real estate | buy house with usdc, construction holdback alberta, usdc x layer | The 10% statutory holdback in contract state + the two-doors funding diagram |
| `/dashboard/` | (brand/demo surface — no head-term target) | owner builder checklist alberta | The slip-catching examples (permit unsubmitted 7+ days, SIP lead burning) |

Rules: one primary target per page, phrased the way searchers phrase it; the page answers it in its first 60 words in plain voice; no page chases another page's primary (cannibalization); crypto vocabulary concentrates on `/escrow/` and stays translated everywhere else, per BRAND.md.

### 5.10 Content notes in our voice

- Every stat block carries its basis ("computed", "verified August 2026", "per STANDATA 23-BCB-002") — that is both house style and the single strongest AI-citation lever we have.
- Question-shaped `<h2>`/`<h3>` headings on informational sections ("What does it cost, honestly?" is already perfect) — answer engines lift Q-and-A pairs.
- A 40–60 word direct answer opens each page section before any elaboration.
- Never write a page *for* a keyword. Map the keyword to the honest thing we already have to say; if there is no honest thing, we do not target the keyword.

### 5.11 Core Web Vitals budget (for the app rebuild)

| Metric | Budget | The risk in this app | The rule |
|---|---|---|---|
| LCP | < 2.5 s (target < 2.0 s) | WebGL hero delaying first paint | The LCP element must be HTML/CSS text or a preloaded poster image — never the canvas. Three.js loads after first paint; `prefers-reduced-motion` and WebGL-absent get the still composition (BRAND.md §9 already requires this). |
| INP | < 200 ms | Hydration + scroll-linked animation long tasks | Keep scroll handlers on rAF with damped springs (already the motion doctrine); break hydration work under 50 ms tasks; no third-party scripts — the site ships zero trackers. |
| CLS | < 0.1 (target ~0) | Late-loading fonts and canvas insertion | Self-hosted fonts with `font-display: swap` and metric-compatible fallbacks (Segoe UI stack is declared in BRAND.md); reserve the hero's box before the canvas mounts. |

Static export on GitHub Pages (Fastly CDN) makes TTFB a non-issue. The 3D models (`.glb` files, some large) must be lazy-loaded on interaction/scroll — never in the critical path.

---

## 6. The GitHub repo as an SEO asset

Google trusts github.com; for long-tail technical queries the repo can outrank blogs. Checklist (repo settings — Matt or any maintainer, five minutes):

- **About description**: "AI agent for off-grid eco homes in Alberta — land, AI design, Alberta cost model, USDC milestone escrow on X Layer. From USDC to keys. MIT." (fits the 350-char limit with room to breathe; leads with the keywords people type).
- **Website field**: `https://aurahomes.fun` — the repo→site link that confirms the entity pair.
- **Topics**: `off-grid`, `eco-homes`, `alberta`, `sip-panels`, `usdc`, `x-layer`, `escrow`, `smart-contracts`, `ai-agent`, `real-world-assets`, `construction`, `canada`.
- The README already does everything GitHub SEO research asks for (keyworded H1/H2s, stat density, freshness from commits) — leave it alone.
- The site links back to the repo prominently (it already will — open source is the brand), completing the bidirectional entity confirmation.

## 7. What we deliberately do not do

- **No keyword stuffing, no doorway pages, no programmatic thin content.** The niche is small and the SERPs are winnable with ~7 honest pages plus the repo corpus.
- **No schema for things that do not exist**: no Product, no reviews, no aggregate ratings, no LocalBusiness, no fake `priority` fields. The March 2026 update punishes exactly this, and so does the brand.
- **No blocking of AI crawlers.** Open by design; recorded in 5.5 so it survives future "best-practice" passes.
- **No paid links, no PBNs, no "SEO content" ghostwritten off-voice.** Authority comes from being the only source for the Alberta numbers — which we already are.

## 8. Sources

Demographics and demand: [Open Sky Rentals — Living Off Grid in Canada 2025](https://openskyrentals.ca/living-off-grid-in-canada-2025-complete-guide-costs/) · [Vice — off-grid affordability motives](https://www.vice.com/en/article/living-off-the-grid-is-not-cheap/) · [Green Building Canada — tiny home builders Alberta](https://greenbuildingcanada.ca/tiny-homes-alberta/) · [ViewHomes — tiny home statistics Canada 2026](https://www.viewhomes.ca/blog/tiny-home-statistics-in-canada/) · [Market Data Forecast — tiny homes market](https://www.marketdataforecast.com/market-reports/tiny-homes-market) · [Ontario Housing Market — rural Alberta affordability](https://ontariohousingmarket.com/2025/10/26/is-rural-alberta-the-next-frontier-for-affordable-living/) · [Hansen Land — homesteading in Alberta](https://hansenland.ca/how-to-build-a-self-sustaining-homestead-in-alberta/) · [Alberta.ca — Owner Builder Authorization](https://www.alberta.ca/owner-builder-authorization) · [Astons — crypto real estate country guide 2026](https://www.astons.com/blog/buying-real-estate-with-cryptocurrency-how-and-where-to-do/) · [RealOpen — buying real estate with stablecoins](https://realopen.com/buy/buy-real-estate-with-stablecoins) · [BTCHome.ca](https://btchome.ca/) · [Aurpay — brokers accepting crypto 2026](https://aurpay.net/aurspace/real-estate-brokers-accept-crypto-payments-2026/)

SEO 2026: [Digital Strategy Force — critical ranking factors 2026](https://digitalstrategyforce.com/journal/what-are-the-most-critical-seo-ranking-factors-in-2026/) · [Digital Applied — content clusters 2026](https://www.digitalapplied.com/blog/seo-content-clusters-2026-topic-authority-guide) · [ClickRank — topical authority guide](https://www.clickrank.ai/topical-authority/) · [corewebvitals.io — CWV explained 2026](https://www.corewebvitals.io/core-web-vitals) · [Digital Applied — CWV 2026 optimization](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide) · [Passionfruit — FAQ rich results deprecated May 2026](https://www.getpassionfruit.com/blog/what-changed-with-google-drops-faq-rich-results-and-what-to-do-now) · [Quattr — FAQ schema in 2026](https://www.quattr.com/blog/faq-schema-in-2026) · [Digital Applied — schema after March 2026](https://www.digitalapplied.com/blog/schema-markup-after-march-2026-structured-data-strategies)

AI search / AEO: [AirOps — AEO complete guide 2026](https://www.airops.com/blog/aeo-answer-engine-optimization) · [Frase — getting cited by AI](https://www.frase.io/blog/what-is-answer-engine-optimization-the-complete-guide-to-getting-cited-by-ai) · [Leapd — how ChatGPT, AI Overviews, and Perplexity source information](https://www.leapd.ai/blog/ai-visibility/how-chatgpt-google-ai-overviews-and-perplexity-source-information-in-2026) · [Martech Zone — IndexNow and ChatGPT discoverability](https://martech.zone/chatgpt-visibility-and-bing-indexnow/) · [Oltre — IndexNow for GEO](https://www.oltre.ai/blog/indexnow-for-geo-bing-chatgpt-visibility/) · [Digital Applied — llms.txt adoption data](https://www.digitalapplied.com/blog/llms-txt-in-practice-adoption-evidence-2026) · [Codersera — llms.txt honest guide](https://codersera.com/blog/llms-txt-complete-guide-2026/) · [aeo.press — state of llms.txt 2026](https://ai.aeo.press/the-state-of-llms-txt-in-2026)

GitHub and domain transition: [Infrasity — GitHub SEO guide 2026](https://www.infrasity.com/blog/github-seo) · [markepear — GitHub search engine optimization](https://www.markepear.dev/blog/github-search-engine-optimization) · [GitHub Docs — managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) · [Finisky Garden — GitHub Pages 301 migration](https://finisky.github.io/en/migrate-github-pages-by-301-redirects/)

*Third-party figures (user counts, adoption percentages, survey results) are as reported by the cited sources, not independently verified — cite them as such. The Alberta build numbers are ours and trace to [data/alberta/](../data/alberta/) and [FEASIBILITY.md](FEASIBILITY.md).*
