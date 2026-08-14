# Plan Library Sources — Provenance Record

**Evidence date: 2026-08-12.** This is the record a future contributor checks before touching any plan.
Four licence-first sourcing lanes were run — `public-domain`, `open-building`, `style-targets`, and
`the-architect` (a founder-supplied repo audit that widened into a code-reference sweep). The discipline:
**no source enters the library on reputation** — every keeper's licence was verified at the fetched source,
with verbatim rights language captured on the evidence date. The machine manifest with every keeper record
verbatim (both tiers) is [`data/plans/candidates.json`](../../data/plans/candidates.json).

**Known gap in this record.** The `the-architect` lane handoff was truncated mid-record: a sixth keeper
(**web-ifc**) plus that lane's rejected list and summary did not survive. web-ifc appears nowhere in this
document or the manifest because its licence evidence is unrecoverable — **re-verify it at source before
any use**. Everything else below is complete.

---

## 1. The verdict

**63 recorded verdicts survive in this document: 39 keepers (33 editable-tier records across 29 distinct
sources, 6 inspiration-tier) and 24 rejections.** Four keepers were verified independently by two lanes
(WikiHouse Skylark, OSE Seed Eco-Home, Open Building Institute, USDA plan 6003) — those duplicates are
preserved in the manifest as independent verification records and merged in the tables below.

Per named style, honestly:

| Style | Verdict |
|---|---|
| **A-frame** | **Solved.** Three genuine 1960s USDA A-frame construction plan sets (5964, 5965, 6003) are PD US federal works with live PDFs, plus a CC-BY-SA parametric glass-gable A-frame (broomva/alpine-cabin) that already works the params→CAD/BOM/3D way Aura does. The paid pretenders (Ayfraym $1,950, Den $299+) are rejected with evidence. |
| **Cabin / cottage** | **Solved.** 14+ PD USDA cabin and cottage plans (log cabins, tourist cabins, a dormitory-loft cabin, a 1983 passive-solar cottage) in one licence regime. |
| **Tiny** | **One keeper.** Open Source Tiny Home V2 — the only house plan found under an MIT-style licence (modified: public link-back clause). The only true-CC0 GitHub house plan (tjfree/TinyHome) fails the quality bar. |
| **Modular / prefab** | **Solved, with copyleft.** WikiHouse Skylark, OSE Seed Eco-Home, and Open Building Institute — all CC-BY-SA, commercial+modify+redistribute OK. ShareAlike binds derived plan **assets**, never the MIT code (see §6). |
| **Farmhouse / full-size** | **Solved.** FreeFarmhouse (CC-BY-SA), a 1965 USDA "energy-saving" farmhouse (PD), the big-four pre-1930 kit-home catalogs, and Radford's 208 bungalows (all PD). |
| **SIP** | **No cleared source anywhere.** SIPA publishes only brochures; every SIP plan set found is commercial. First-principles authoring: SIP conversions of the PD USDA geometry — dimensions and techniques are not copyrightable. |
| **Steel + polycarbonate** | **No cleared dwelling plans anywhere.** Author our own, seeded by OBI's CC-BY-SA greenhouse/structural modules (editable) and UMN Deep Winter Greenhouse + Walipini (inspiration-only). |
| **Courtyard** | **No modern cleared plans anywhere.** Mine the two PD plan books (Wilson c. 1910, Home Builders Catalog 1928) for period courtyard layouts and author modern eco versions on top. |
| **Unusual eco stays** | **Solved.** Hexayurt is explicitly public domain ("All intellectual property associated with this project is public domain."). |

---

## 2. EDITABLE tier

Rights verified for **commercial use, modification, and redistribution**. Full verbatim licence language,
specs, and rationale for every row live in `candidates.json` — this table is the provenance summary.
C/M/R = commercial / modify / redistribute.

| # | Source | Lane(s) | Style | Licence | C/M/R | Attribution | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | [USDA A-Frame Cabin, Plan 6003](https://archive.org/details/aframecabin1093unit) — also [NDSU PDF](https://www.ag.ndsu.edu/aben-plans/6003.pdf) | public-domain + style-targets | a-frame | PD — US Gov work (17 USC 105); archive.org item "not in copyright" | ✅✅✅ | none | 2026-08-12 |
| 2 | [USDA A-Frame Cabin, Plan 5964 (22×24, loft)](https://www.ag.ndsu.edu/aben-plans/5964.pdf) | style-targets | a-frame | PD — US Gov work; parent pub. [USDA MP 981 "not in copyright"](https://archive.org/details/aframecabins981unit) | ✅✅✅ | none | 2026-08-12 |
| 3 | [USDA A-Frame Cabin, Plan 5965 (22×36, loft, stairs)](https://www.ag.ndsu.edu/aben-plans/5965.pdf) | style-targets | a-frame | PD — US Gov work; same MP 981 verification | ✅✅✅ | none | 2026-08-12 |
| 4 | [USDA Cabin with Dormitory Loft, Plan 6013](https://archive.org/details/cabinwithdormito1074unit) | public-domain | cabin | PD — US Gov work; item "not in copyright" | ✅✅✅ | none | 2026-08-12 |
| 5 | [USDA Passive Solar Cottage, Plan 7148 (18×26)](https://www.ag.ndsu.edu/aben-plans/7148.pdf) | style-targets | cabin | PD — via 4-digit USDA Plan Exchange series provenance | ✅✅✅ | none | 2026-08-12 |
| 6 | [USDA/NDSU cabin & cottage library (14 plans)](https://www.ndsu.edu/agriculture/ag-hub/ag-topics/ag-buildings/building-plans/housing-building-plans) | style-targets | cabin | PD — 4-digit USDA series provenance; **exclude ND 764-2-1** (NDSU-authored, not federal) | ✅✅✅ | none | 2026-08-12 |
| 7 | [USDA 2-Bedroom Farm Dwelling, Plan 7176](https://archive.org/details/2bedroomfarmdwel1042unit) | public-domain | dwelling | PD — US Gov work; item "not in copyright" | ✅✅✅ | none | 2026-08-12 |
| 8 | [USDA 3-Bedroom "Energy-Saving" Farmhouse, Plan 7161 (1965)](https://archive.org/details/3bedroomfarmhous993unit) | public-domain | dwelling | PD — US Gov work (ARS); item "not in copyright" | ✅✅✅ | none | 2026-08-12 |
| 9 | [USDA Plan Exchange — full NAL collection (334 items)](https://archive.org/advancedsearch.php?q=%22cooperative+farm+building+plan+exchange%22&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&rows=100&output=json) | public-domain | many | PD — US Gov works; **verify per item** (4 spot-checks consistent) | ✅✅✅ | none | 2026-08-12 |
| 10 | [Sears Honor Bilt Modern Homes catalog (1921)](https://archive.org/details/honorbiltmodernh00sear) | public-domain | kit-home | PD — pre-1930 US publication; item "out of copyright" | ✅✅✅ | none | 2026-08-12 |
| 11 | [Gordon-Van Tine Homes catalog (1921)](https://archive.org/details/GordonVanTineHomes19200001) | public-domain | kit-home | Public Domain Mark 1.0 (stated on item page) | ✅✅✅ | none | 2026-08-12 |
| 12 | [Wardway Homes catalog (1924)](https://archive.org/details/WardwayHomes) | public-domain | kit-home | PD — pre-1930, "No copyright renewal found"; uploader's CC-BY tag on the scan is legally moot | ✅✅✅ | none (courteous: credit BTHL) | 2026-08-12 |
| 13 | [Aladdin Company catalogs 1908–1929 (Clarke Library, CMU)](https://www.cmich.edu/research/clarke-historical-library/explore-collection/explore-online/michigan-material/aladdin-company-bay-city/aladdin-catalogs) | public-domain | kit-home | PD — pre-1930 publication (basis is date, not a CMU grant; page carries no rights text) | ✅✅✅ | none | 2026-08-12 |
| 14 | [Radford's Artistic Bungalows — 208 designs (1908)](https://archive.org/details/radfordsartistic00radf) | public-domain | bungalow | PD — 1908 publication; item "out of copyright" | ✅✅✅ | none | 2026-08-12 |
| 15 | [The Bungalow Book, Henry L. Wilson (c. 1910)](https://archive.org/details/TheBungalowBookAShortSketchOfTheEvolutionOfTheBungalowFromIts) | style-targets | bungalow/courtyard | Public Domain Mark 1.0 | ✅✅✅ | none | 2026-08-12 |
| 16 | [Home Builders Catalog (1928)](https://archive.org/details/HomeBuildersCatalogPlansOfAllTypesOfSmallHomes) | style-targets | small homes/courtyard | Public Domain Mark 1.0 | ✅✅✅ | none | 2026-08-12 |
| 17 | [UT Extension Plan File](https://bess.tennessee.edu/ut-extension-plan-file/) | public-domain | many | PD (binding) + **non-binding courtesy request** "not alter or sell" — prefer NAL/archive.org copies of identical USDA plans | ✅✅✅ | none required; UT credit "appreciated" | 2026-08-12 |
| 18 | [HABS/HAER/HALS measured drawings (NPS/LOC)](https://home.nps.gov/subjects/heritagedocumentation/faqs.htm) | public-domain | vernacular | US Gov works — NPS FAQ: "available to the public without restriction"; **verify per item** (donated materials can carry separate rights) | ✅✅✅ | none | 2026-08-12 |
| 19 | [Hexayurt Project](https://www.appropedia.org/Hexayurt_project) | style-targets | panel shelter | Public domain — "All intellectual property associated with this project is public domain." | ✅✅✅ | none | 2026-08-12 |
| 20 | [WikiHouse Skylark (Open Systems Lab)](https://www.wikihouse.cc/terms) | open-building + style-targets | modular | CC-BY-SA-4.0 — grant lives in wikihouse.cc/terms + repo README; **repo has NO LICENSE file** (see note below); WikiHouse trademark excluded | ✅✅✅ | **Required**: credit "WikiHouse / Open Systems Lab", licence link, retain notices, no trademark use, no implied endorsement | 2026-08-12 |
| 21 | [Open Building Institute module library](https://www.openbuildinginstitute.org/license/) | open-building + style-targets | modular / greenhouse | CC-BY-SA-4.0 (verbatim on /license/); OBI name/logo reserved | ✅✅✅ | **Required**: credit "Open Building Institute" + licence link | 2026-08-12 |
| 22 | [OSE Seed Eco-Home](https://wiki.opensourceecology.org/wiki/Seed_Eco-Home) | open-building + style-targets | modular | CC-BY-SA-4.0 / GPLv3 / DIN SPEC 3105 (infobox verbatim; FAQ confirms CC-BY-SA) | ✅✅✅ | **Required**: credit "Open Source Ecology" + licence link | 2026-08-12 |
| 23 | [Alpine Cabin digital twin (broomva/alpine-cabin)](https://github.com/broomva/alpine-cabin) | open-building | a-frame | CC-BY-SA-4.0 (LICENSE verified via GitHub API) | ✅✅✅ | **Required**: credit "Carlos D. Escobar-Valbuena / broomva" + licence link + indicate changes | 2026-08-12 |
| 24 | [Open Source Tiny Home V2 (EddieOne)](https://github.com/EddieOne/open-source-tiny-home) | style-targets | tiny | MIT (modified — added public link-back clause; SPDX NOASSERTION) | ✅✅✅ | **Required**: retain MIT notice AND a public clickable link to the repo | 2026-08-12 |
| 25 | [FreeFarmhouse (Jay Osborne)](https://www.freefarmhouse.com/downloads) | style-targets | farmhouse | CC-BY-SA — page cites both 4.0 (text) and 3.0 (link); treat as BY-SA, keep both notices | ✅✅✅ | **Required**: credit "FreeFarmhouse / Jay Osborne" + BY-SA notice | 2026-08-12 |
| 26 | [react-planner (cvdlab)](https://github.com/cvdlab/react-planner/blob/master/LICENSE) | the-architect | code ref | MIT ((c) 2016 CVDLAB) — LICENSE fetched via GitHub API | ✅✅✅ | MIT notice only if code copied; pattern study needs nothing | 2026-08-12 |
| 27 | [blueprint3d (furnishup)](https://github.com/furnishup/blueprint3d/blob/master/LICENSE.txt) | the-architect | code ref | MIT ((c) 2015 FurnishUp Inc.) — LICENSE fetched via GitHub API | ✅✅✅ | MIT notice only if code copied | 2026-08-12 |
| 28 | [blueprint-js (aalavandhaann)](https://github.com/aalavandhaann/blueprint-js/blob/master/LICENSE) | the-architect | code ref | MIT ((c) 2018 Srinivasan Ramachandran) — LICENSE fetched via GitHub API | ✅✅✅ | MIT notice only if code copied | 2026-08-12 |
| 29 | [maker.js (microsoft)](https://github.com/microsoft/maker.js/blob/master/LICENSE) | the-architect | code ref | Apache-2.0 ((c) Microsoft) — LICENSE fetched via GitHub API; MIT-compatible one-way with notices kept | ✅✅✅ | Apache-2.0 notices if code used: full licence text, NOTICE content, mark modified files | 2026-08-12 |

### Cross-lane reconciliation notes (read before importing)

- **WikiHouse Skylark LICENSE gotcha, resolved.** The style-targets lane flagged "verify the repo's
  per-file LICENSE before importing" (its repo fetch timed out). The open-building lane completed that
  check: the GitHub repo has **no LICENSE file at all** (`license: null` on the API) — the CC-BY-SA-4.0
  grant lives in the repo **README** and in **wikihouse.cc/terms**, both fetched. Record this gotcha in
  CREDITS when importing. The terms' caveat stands: some materials "explicitly carry another licence...
  clearly marked" — still check per file for marked exceptions.
- **USDA plan 6003 date discrepancy.** The archive.org item records the Plan Exchange printing as
  Oct 1968; the NDSU index lists the plan as 1966. Same plan number, two doors. The archive.org copy is
  the item-level rights-verified one; the NDSU PDF is verified live (HTTP 200, 292 KB). Not resolved —
  recorded so nobody burns time on it.
- **NDSU index: door, not source.** Both lanes agree 4-digit plan numbers = USDA Plan Exchange = PD, and
  the NDSU direct PDFs for 5964/5965/6003/7148 are verified live. But the index as a whole is a rights
  minefield (5-digit = copyrighted MWPS, hyphenated = NDSU-authored, plus Canada Plan Service Crown
  copyright). Never bulk-import from the index; prefer archive.org NAL copies for item-level verification.
- **Collections require per-item verification.** Rows 9 (NAL collection) and 18 (HABS) are wells, not
  single items — re-verify the rights statement on each item pulled.

---

## 3. INSPIRATION tier

Link-only. **Nothing here may be imported, redistributed, or adapted** — study, cite, and link out.

| Source | Lane | Why link-only | What we may do | Evidence |
|---|---|---|---|---|
| [Elemental — ABC of Incremental Housing](https://www.elementalchile.cl/downloads) | open-building | **No licence exists.** Downloads carry only an informational disclaimer; the 2016 "open source" framing was rhetorical. Default copyright applies. The GitHub mirror is poisoned (uploader holds no rights). | Link + discuss on an education page. **Never import the DWGs.** | 2026-08-12 |
| [CMHC Housing Design Catalogue](https://assets.cmhc-schl.gc.ca/sites/housing%20catalog/resources/housing-design-catalogue-user-terms-and-conditions.pdf) | open-building | Proprietary CMHC licence: modify + commercial OK **only inside a real Canadian building project**; redistribution "expressly restricted and prohibited". | Link out. A Canadian Aura user can legally take a CMHC design (free CAD/BIM) to their builder. | 2026-08-12 |
| [NSW Housing Pattern Book](https://www.planning.nsw.gov.au/government-architect-nsw/housing-design/nsw-housing-pattern-book/terms-and-conditions-for-the-use-of-patterns) | open-building | Pay-per-site licence; one Site, one Building; volume/portfolio use needs written GANSW consent; all IP vests in GANSW. | Benchmark reference and link-out for Australian audience. | 2026-08-12 |
| [UMN Deep Winter Greenhouse v2.2 CDs](https://conservancy.umn.edu/server/api/core/items/c5354c72-fb7c-4870-a18a-45f4694c3644) | style-targets | Repository record carries **no rights field** (verified via DSpace API); default UMN copyright. Free-to-download ≠ free-to-modify/redistribute. | Study; cite with the suggested Handeen citation; let the passive-solar **technique** (uncopyrightable) inform authored designs. | 2026-08-12 |
| [Walipini Underground Greenhouse (Benson Institute, BYU)](https://archive.org/details/WalipiniConstructionTheUndergroundGreenhouse) | style-targets | No licence statement anywhere despite wide circulation; BYU copyright by default. | Link; use the earth-sheltered **technique** in authored designs, never the document. | 2026-08-12 |
| [The Architect (InnovateFusion)](https://api.github.com/repos/InnovateFusion/the-architect) | the-architect | No licence — all rights reserved. See §5. | A plain hyperlink, at most. | 2026-08-12 |

---

## 4. REJECTED

Recorded so nobody re-checks. 24 verdicts. (The `the-architect` lane's rejected list was lost to the
handoff truncation and is not recoverable — its five keeper verdicts above are complete.)

### public-domain lane

| Rejected | Reason |
|---|---|
| MidWest Plan Service (MWPS) | Copyright Iowa State University ("© 1995-2021"), plans sold $3–$65 via ISU Extension Store; no modify/redistribute rights. Do not import; do not use the 5-digit MWPS plans mirrored on the NDSU index. |
| NRAES / PALS (Cornell) | "All rights reserved"; reprint requires written permission. Link-only at best. |
| Gordon-Van Tine "Plan-cut Homes" 1931 catalog | Published 1931 — **not PD until Jan 1, 2027**. Re-check then. A dated example of why pre-1930 is the line. |
| NDSU Building Plans index | Mixed rights with no licence statement: 4-digit = USDA PD (safe), 5-digit = copyrighted MWPS, hyphenated = NDSU with unstated rights, plus Canada Plan Service Crown copyright. Finding aid only; use the archive.org NAL collection as the door. |
| Canada Plan Service plans | Crown copyright presumed, not verified at source. Excluded pending verification — flagged for a future Canada-focused pass (Aura's Alberta context). |

### open-building lane

| Rejected | Reason |
|---|---|
| Paperhouses (paperhouses.co) | **Defunct** — 301-redirects to a realmo.com blog post (which 403s); the free plans and their terms are no longer published anywhere verifiable; historic terms kept IP with the architects. |
| Open Architecture Network | **Dead archive** — domain now serves a lorem-ipsum WordPress shell. Successor (openarchcollab.org) has no plan library. |
| BC Standardized Housing Designs | **Unverified** — 10 free designs sit behind a click-through terms form that was not accepted (accepting terms requires user permission); licence could not be quoted. Likely CMHC-style. Revisit with Matt if BC matters. |
| tjfree/TinyHome | Licence perfect (true CC0-1.0, API-verified), **quality below bar**: one SVG sketch + an ODS list. Bookmarked as the only true-CC0 house plan found on GitHub. |
| wikihouseproject/Wren | Superseded by Skylark; `license: null`, no README grant fetched. Use Skylark only. |
| WikiHouse community forks (Pionierswoning, wikilab-ufabc, Alex-Wikished) | All `license: null` = all rights reserved regardless of upstream CC-BY-SA. Do not import. |
| GitHub floor-plan-generator repos (buildingGenerator, ArchiAI, etc.) | Toys: 0–4 stars, no real plan content, several unlicensed. "parametric house openscad" searches returned zero relevant licensed repos. |
| uncreatednet/Elemental_Incremental_Housing | Mirror of unlicensed Elemental DWGs — uploader holds no rights to grant; poisoned regardless of repo licence. |

### style-targets lane

| Rejected | Reason |
|---|---|
| Ayfraym (Everywhere Inc.) | **Paid**, not free: $1,950 "box of plans" (a $295 tier also reported); site refused connection during sweep. Founder's hunch confirmed. |
| Den Outdoors | **Paid**: all designs "from $299.00"; only free item is a 19-page build guide. |
| SIP-panel homes (style) | **Negative finding**: nothing rights-cleared exists — SIPA has brochures only; all SIP plan sets found are commercial. Path: author our own SIP conversions of PD USDA plans. |
| Steel+polycarbonate homes (style) | **Negative finding**: no rights-cleared dwelling plans. Closest cleared material: OBI modules (editable) + UMN docs (inspiration). Author our own. |
| Courtyard homes (style) | **Negative finding**: no modern cleared plans. Path: mine Wilson 1910 + Home Builders Catalog 1928 (both PD) and author modern eco courtyard plans. |
| Earthship Biotecture | Sells drawing packages; designs page 404'd; no licence evidence obtainable → default all-rights-reserved. Link-only at most. |
| UMN Deep Winter Greenhouse as editable | **Demoted to inspiration**: no rights/licence field on the repository record; free-to-download is not free-to-modify. |
| The Tiny Project plans | Commercial — sells plans incl. a separate paid "Commercial License" product. |
| houseplansfree.net copy of USDA 5964 | Same PD content, but an ad site with no provenance statement. Rejected as **citation source** only — use NDSU .edu PDFs and archive.org. |
| Skylark repo per-file licence flag | Recorded as unverified in this lane (fetch failed) — **resolved by the open-building lane**: no LICENSE file exists; grant is in README + terms. See §2 reconciliation notes. |
| 1960s–70s magazine A-frame plan books | Copyright renewal status unverifiable; post-1930 non-federal ≠ presumptively PD. The USDA plans make the hunt unnecessary. |

---

## 5. the-architect verdict

**What it is:** [InnovateFusion/the-architect](https://github.com/InnovateFusion/the-architect) — the
founder-supplied repo — is a 2023 A2SV Generative-AI-Hackathon prototype: an AI image-generation
assistant (sketch-to-render, prompt-driven interiors, concept images, cost-estimate chat). Flutter mobile
+ Next.js web + Python backend wrapping fine-tuned Stable Diffusion. 8 stars, dead since Nov 2023.

**Licence:** **NONE.** GitHub API `"license": null`; no LICENSE/COPYING/NOTICE file anywhere in the repo;
no licence in the page sidebar. **All rights reserved** by default (verified 2026-08-12).

**What may be taken: nothing.** No code, no assets, no copy. Two independent reasons: (1) unlicensed —
all rights reserved; (2) even if licensed, it contains zero deterministic geometry — no floor-plan engine,
no parametric model, no SVG/DXF/IFC — nothing adjacent to Aura's TypeScript/three.js analytic pipeline.
Its SD fine-tunes are additionally licence-suspect (OpenRAIL-M lineage, unknown training data) — never
touch the model weights. Its only legitimate value is as a **feature-scope checklist** for AI-assisted
architecture UX (their 7-feature list), which is an idea, not expression.

**Credit line if ever referenced:** a plain hyperlink to the repo. That is all that is possible and all
that is needed.

**The useful outcome of this lane** was the code-reference sweep it triggered: four licence-clean
geometry/editor references (react-planner, blueprint3d, blueprint-js — MIT; maker.js — Apache-2.0), each
with its LICENSE fetched via the GitHub API and its exact CREDITS/THIRD_PARTY_NOTICES line pre-written in
`candidates.json`. Attribution for these is owed **only if code is copied**; studying patterns costs
nothing. A fifth reference (**web-ifc**) was verified by the lane but its record was truncated in the
handoff — re-verify before use.

---

## 6. Authoring guidance — styles with no cleared source

For SIP, steel+polycarbonate, courtyard, and any other style the lanes came back empty on:

- **Dimensions and techniques are not copyrightable. Drawings are.** Copyright protects the expression
  (the drawing, the rendering, the specific drafted sheet), never the facts: room dimensions, spans,
  pitches, module sizes, assembly techniques, energy-performance approaches. A plan Aura authors from
  first principles — citing published dimensions, techniques, and period layouts as *facts* — is an
  original work and carries Aura's own licence.
- **Cite facts, never trace drawings.** Mining the 1928 Home Builders Catalog for a courtyard layout means
  reading its dimensions and organization and drawing a new plan — not tracing, redrawing sheet-for-sheet,
  or reproducing the scan.
- **PD sources make this cleaner, not different.** The USDA plans may legally be traced, copied, and sold
  outright — but a re-authored modern version is still the product. Record provenance either way.
- **CC-BY-SA sources: the fact/expression line decides the licence.** Plans re-authored using only
  dimensions, module sizes, and building techniques from Skylark/OBI/OSE are **not adaptations** and can
  carry Aura's licence. Anything derived from their actual drawings/files **is** an adaptation: it stays
  CC-BY-SA, lives in a clearly-labeled asset directory with per-asset licence and attribution notices,
  and is never relicensed. SA binds the plan assets — not the MIT code that parses and renders them
  (the OFL-fonts-in-MIT-projects pattern).
- **Non-binding courtesy requests** (UT's "please don't alter or sell") are not licence terms, but avoid
  the awkwardness where an identical copy exists elsewhere (NAL/archive.org).
- **Trademark ≠ copyright.** WikiHouse and OBI names/logos are excluded from the content grants. Credit
  in text; never brand with their marks or imply endorsement.

---

## 7. Integration notes — mapping candidates onto `PlanTemplate`

For the next task: building catalog entries mechanically from `candidates.json` into
[`app/lib/builder/planCatalog.ts`](../../app/lib/builder/planCatalog.ts) (`PlanTemplate` / `PlanSource` /
`HomeSpec`). Two entries already model the pattern: `open-timber-studio` (system-informed-study) and
`open-farmhouse-study` (dimensional-adaptation).

**Eligibility gate:** only `tier === "editable"` candidates with `commercial && modify && redistribute`
all true may become templates. `inspiration` candidates never do — they are link-out/education content
with no `PlanTemplate`.

**Field mapping (candidate → PlanTemplate):**

| Candidate field | PlanTemplate destination |
|---|---|
| `name` | `source.name` (shorten to the credited party, e.g. "WikiHouse / Open Systems Lab", "USDA Cooperative Farm Building Plan Exchange") |
| `sourceUrl` | `source.url` |
| `licence` | `source.license` — condense to SPDX-ish ("CC-BY-SA-4.0", "Public domain (US Government work)", "MIT (modified — link-back clause)"). Canonical licence text URL → `source.licenseUrl` (creativecommons.org/… for CC; the archive.org item or 17 USC 105 reference for PD). |
| `attribution` | `source.attribution` — use the exact credit lines recorded per keeper, as final-form prose: the `adapted()` helper injects attribution + changes + licence into `spec.notes`, which is how notices survive save/share/export/edit. |
| *(authored per template)* | `source.changes` — state exactly what was taken ("Aura retained only the published 22 × 24 ft envelope and roof pitch…"), mirroring the existing entries. Required for CC-BY-SA ("indicate changes") and honest everywhere. |
| `style` | `tags` entry + `volume()` roof form: a-frame → `roof: "a-frame"` (pitch ~50–55, cf. `ridge-a-frame`), cabin → `gable`, modular → `shed`/`gable` |
| `specs` | Drives the shell: parse the plan's published width × depth ft → `volume({ width, depth })`; loft/storeys → `storeys`; area → `kicker` ("N sq ft · …") |
| `why` | Seeds `summary` / `bestFor` copy |
| `relationship` | `"dimensional-adaptation"` when only published dimensions/envelope are used; `"system-informed-study"` when a building system informs the concept without reproducing geometry |

**Schema gaps to resolve before mechanical builds (do not force-fit):**

1. **No public-domain variant in `PlanSource`.** The union is `aura-authored` (asserts "No third-party
   plan geometry was copied" — false for a USDA dimensional adaptation) or `licensed-adaptation`
   (hardcodes `shareAlike: true` — false for PD, which imposes nothing). PD-derived plans — the largest
   editable pool — need a third variant, e.g. `kind: "public-domain-adaptation"` with `shareAlike: false`
   and a provenance statement, or the `shareAlike` literal relaxed to `boolean`.
2. **Same pinch for MIT-with-link-back** (Open Source Tiny Home): `licensed-adaptation` fits except
   `shareAlike: true` is wrong — MIT is not copyleft. The link-back clause belongs in `attribution`
   and must surface as a clickable link wherever the template is shown.
3. **FreeFarmhouse version ambiguity is already precedent:** the existing `open-farmhouse-study` entry
   records `license: "CC-BY-SA (source version not stated)"` — new FreeFarmhouse-derived entries follow it
   (candidate note: page cites both 3.0 and 4.0; keep both notices).
4. **CC-BY-SA hygiene:** template *data* (dimensions in a `HomeSpec`) with notices in `spec.notes` is the
   current, working pattern. If actual plan asset files (scans, CAD, cut files) are ever imported into the
   repo, they go in a labeled directory with per-asset LICENSE/attribution files — SA assets beside MIT
   code, never mixed.
5. **No estimator impact:** `estimatePlanTemplate()` reads only `spec` and `storeys`; provenance fields
   don't touch pricing. No integration work there.

**Suggested first mechanical batch** (clean rights, real dimensions in hand): USDA 5964 (22×24 A-frame),
USDA 5965 (22×36 A-frame), USDA 7148 (18×26 passive-solar cottage), USDA 6013 (loft cabin), Hexayurt
(12-ft model), Open Source Tiny Home V2 (308 sq ft) — blocked only on schema gap 1 (PD variant) for the
first four.

## 8. Authored into the catalog — Aug 12, 2026

Schema gap 1 is resolved: `PlanSource` now carries `kind: "public-domain-adaptation"`
(`shareAlike: false`, provenance stated as a fact rather than a grant), and
`app/lib/builder/planCatalog.ts` grew from 12 to 20 templates. What landed, and
from which candidate:

| Template id | Source | Relationship |
|---|---|---|
| `postcard-a-frame` | USDA 6003 (24×24 + deck; archive.org scan, NAL "not in copyright") | dimensional-adaptation |
| `timberline-a-frame` | USDA 5965 (22×36 loft A-frame; NDSU sheets, series verified via Misc. Pub. 981 scan) | dimensional-adaptation |
| `solstice-cottage` | USDA 7148 (18×26 passive-solar cottage, 1983; NDSU sheets) | dimensional-adaptation |
| `bunkhouse-loft` | USDA 6013 (cabin with dormitory loft; archive.org scan) — programme only, envelope authored fresh | system-informed-study |
| `prairie-dwelling` | USDA 7176 (2-bedroom farm dwelling, 1967; archive.org scan) — programme only | system-informed-study |
| `beltsville-farmhouse` | USDA 7161 (3-bedroom farmhouse + Beltsville energy-saving kitchen-workroom, 1965; archive.org scan) — programme only | system-informed-study |
| `boreal-longhouse` | Aura original (SIP style target — no cleared source existed, authored per § 6) | original |
| `lightframe-pavilion` | Aura original (steel + polycarbonate style target, per § 6; notes state the cost engine prices its timber/SIP basis) | original |

Deliberately NOT taken this round: USDA 5964 (near-duplicate of 6003's footprint —
padding, not choice), Hexayurt (panel shelter reads as emergency architecture beside
homes), Open Source Tiny Home V2 (MIT link-back pinch, schema gap 2, still open).
Candidates remain in `data/plans/candidates.json` for the next authoring round.

## 9. The Nordic glass set — thirty Aura originals, Aug 14, 2026

The founder asked for "thirty more modern Nordic looking models with lots of glass and cool modern
features". § 6 already recorded the honest position: **no rights-cleared Nordic-modern dwelling plans
exist** — the style-targets lane came back empty on SIP, steel+polycarbonate and courtyard, and nothing
in the sweep covers contemporary Scandinavian houses. So all thirty are `kind: "aura-authored"`
(`license: "MIT"`, `shareAlike: false`, `relationship: "original"`), authored from first principles.
**No third-party plan geometry was copied, traced, or dimensionally adapted for any of them.** The
library is now **55 templates: 44 aura-authored, 8 public-domain-adaptation, 3 licensed-adaptation.**

### 9.1 The set

| # | Template id | Idea it exists for | Storeys | Area |
|---|---|---|---|---|
| 1 | `glasrum-studio` | one glazed elevation, three blind walls | 1 | 308 |
| 2 | `hjorne-perch` | corner glazing on a steep site | 1 | 320 |
| 3 | `nordlys-atelier` | north clerestory studio light, minimal glass | 1 | 360 |
| 4 | `vindfang-cabin` | airlock entry volume as the enabler of a glass room | 1 | 308 |
| 5 | `takterrass-micro` | the outdoor room on the roof, not the yard | 1 | 256 |
| 6 | `ljus-ribbon` | horizontal ribbon glazing instead of a wall | 1 | 476 |
| 7 | `saltbox-nord` | the roof form IS the summer-shading answer | 1 | 528 |
| 8 | `stegvis-slope` | two eave heights stepping down a grade | 1 | 572 |
| 9 | `vinterhage-house` | glazed winter garden buffering the south face | 1 | 716 |
| 10 | `vann-edge` | shallow water-edge bar, three glazed bays | 1 | 480 |
| 11 | `nordvend-house` | view north, sun south — split light strategy | 1 | 480 |
| 12 | `jordmur-house` | rammed-earth interior mass behind direct-gain glass | 1 | 560 |
| 13 | `badstue-retreat` | the bathhouse as the main building | 1 | 648 |
| 14 | `kompakt-passiv` | lowest-surface form; the argument against the rest | 1 | 676 |
| 15 | `hytte-lodge` | glazed gallery + four bunk alcoves for group stays | 1 | 680 |
| 16 | `galleri-bungalow` | six-bay glass colonnade, light into every room | 1 | 720 |
| 17 | `drivhus-home` | attached growing room on the warm side | 1 | 728 |
| 18 | `vindly-court` | L turned so its back takes the prevailing wind | 1 | 756 |
| 19 | `gardstun-court` | three volumes, one court, glazed inward | 1 | 796 |
| 20 | `verksted-house` | home + workshop with a 10 ft overhead door | 1 | 844 |
| 21 | `bro-breezeway` | glazed link between living and sleeping volumes | 1 | 844 |
| 22 | `atelje-house` | home + north-lit atelier with an 8 ft work door | 1 | 924 |
| 23 | `slekt-house` | two front doors: multigenerational or rental | 1 | 944 |
| 24 | `massiv-clt` | exposed mass timber, stacked south glazing | 2 | 960 |
| 25 | `smalhus-infill` | 16 ft wide, lit only from its two ends | 2 | 1,024 |
| 26 | `tarn-house` | single-storey bar + two-storey tower (mixed height) | 2 | 1,044 |
| 27 | `trappetarn-house` | the stair pulled out into a glazed tower | 2 | 1,120 |
| 28 | `hjornetomt-house` | corner lot: solid at street level, glass upstairs | 2 | 1,152 |
| 29 | `gavl-lantern` | full-height glazed gable over a double-height room | 2 | 1,320 |
| 30 | `skodde-cabin` | big south glass with insulated shutters | 1 | 396 |

### 9.2 The glazing disclosure rule (and why it is a test, not a convention)

`FDWR_MAX = 0.22` (`app/lib/design/materials.ts`) is the **NBC 9.36 prescriptive** fenestration-and-door-
to-wall ceiling. It is not a legal maximum: the Python design-api trims windows above it, but the static
app does not use that service, and the TypeScript builder deliberately **reports**
`modelledGlazingRatio` without clamping it — `Readout.tsx` calls the number "a comparison, not a code
check". So a glass-forward plan is a legitimate thing to draw here.

What is not legitimate is drawing thirty and saying nothing. **Eight of the thirty model above 22%** and
each names, in the `spec.notes` that survive save/share/export/edit: the ceiling, its own ratio, the
compliance path it would take, and what the glass costs in a zone 7A winter.

| Template | Modelled ratio | Compliance path named in `notes` |
|---|---|---|
| `hjorne-perch` | 33% | performance path |
| `vann-edge` | 28% | performance path |
| `vinterhage-house` | 28% | performance model, sunspace as a tempered buffer |
| `drivhus-home` | 26% | performance model, growing room as unconditioned/tempered |
| `badstue-retreat` | 24% | trade-off or performance path |
| `gavl-lantern` | 24% | performance path |
| `saltbox-nord` | 24% | trade-off path or full performance model |
| `hytte-lodge` | 23% | trade-off path |

`app/tests/plan-catalog.spec.ts` enforces this for the whole library, and the strongest part of the gate
is that each disclosure must **state its own percentage within one point of the computed geometry** —
edit the openings and forget the sentence, and the suite goes red. A second assertion catches the mirror
failure: a plan **under** the ceiling that wears the disclosure anyway.

**Two pre-existing records are exempt and named in the test file:** `fjell-cube` (29%) and `lys-lantern`
(23%), both from the earlier Nordic square set, are over the ceiling with no disclosure. The PL01
manifest forbade editing the existing 25 records, so they are grandfathered in a documented, closed list
rather than silently fixed. **They still need one sentence each** — see the PL01 handoff.

### 9.3 What was deliberately not done

- **No a-frame was added.** The library already carries four (`ridge-a-frame`, `postcard-a-frame`,
  `timberline-a-frame`, `lakeview-a-frame`). A fifth would be padding, not choice.
- **No plan traces a real Nordic house.** Copying a built Scandinavian design would create exactly the
  third-party redistribution question the `aura-authored` arm exists to avoid.
- **Lofts, mezzanines, stairs and internal level changes are not modelled** by the legacy volume shell;
  where a plan implies one, its `notes` say so.
- **Two plans carry a `proxy` cost basis** (`vinterhage-house`, `drivhus-home`) because the Alberta BOM
  prices a sunspace and a greenhouse as conditioned SIP shells, which they are not.

## 10. Interaction-pattern inspirations (no code taken)

- **salsita.ai** (Salsita Software's conversational 3D-configurator work) — named by the
  founder Aug 12, 2026 as inspiration for the build engine. Their public pattern:
  natural-language guided selling driving a live parametric 3D model. No source code is
  published on that site, so nothing is copied and no licence question arises; the
  pattern lands in Aura as a deterministic phrase-to-edit layer over the builder's
  immutable document (each understood phrase becomes one labelled, undoable edit).
  Recorded here so the influence is credited even where the law requires nothing.
