# The Alberta Playbook

*The regulatory and sourcing spine of the pilot. Every fact here was researched Aug 2026 against primary or cross-checked sources; verify time-sensitive items before relying on them in a permit application. This file is product data as much as documentation — the app reads its structured twin at [data/alberta/](../data/alberta/).*

## Permits & professionals — who you actually need

| Question | Answer |
|---|---|
| Architect needed? | **No.** Alberta Architects Act exempts 1–4 unit dwellings of any size. Part 9, NBC 2023 Alberta Edition governs. |
| Engineer needed? | Only at touchpoints: roof trusses (P.Eng authentication mandatory since Mar 1, 2026 — STANDATA 23-BCB-002 — ships with the truss order), SIP system (via CCMC listing like Insulspan 13016-R, or P.Eng stamp), screw-pile foundations, tall walls. |
| Who draws the permit set? | A residential designer ($1.2–2.7K) finishes the AI's review-ready package. |
| Owner-builder path? | Owner Builder Authorization: $95 with warranty, $750 without. Without warranty: **no sale for 10 years** (title caveat since Dec 2025). Decision in ~14 business days. |
| Can the owner pull their own trade permits? | **Yes** — electrical, plumbing, gas, private sewage application, on a home they own and will occupy (Leduc County confirms explicitly). Exception: solar PV/battery wiring requires a licensed electrical contractor (CEC s.64). Septic install requires a certified installer. Well drilling is licensed work. |
| Permit stack | Development permit (~$231 Leduc County) → building permit → electrical/plumbing/gas/private-sewage permits → inspections. 2–6 weeks typical rural approval. |
| Minimum home size | **District-level, not county-level.** Lac Ste. Anne Agricultural district: 592 sqft floor. Its country-residential district: 1,076 sqft. Verify the parcel's district table BEFORE buying. The app automates this check. |

## County quick-reference (Edmonton ring)

- **Leduc County** — issues all safety-codes permits in-house; homeowner trade permits explicitly allowed; safetycodes@leduc-county.com · 780-770-9322. The most self-contained one-stop county.
- **Lac Ste. Anne County** — cheapest land (verified $75K–$200K bare parcels, 75 active listings Aug 2026); Superior Safety Codes is its agency; watch the district minimums; groundwater unreliable — cistern country.
- **Parkland County** — new Land Use Bylaw 2025-12; PLANit online portal; confirm district minimums before shortlisting.
- **Sturgeon County** — 38 land listings, pricier; strict setbacks (30 m provincial highway, 15 m municipal road).

## The build system

- **SIPs:** Insulspan (Calgary, CCMC 13016-R — the painless permit path), EnerSmart (Cochrane/Claresholm), Premier SIPS (Calgary). Small-format panels (4x8, ~100 lb) for the 2–3-person erection story. Lead time 12–20 weeks from approved drawings. Joints get continuous sealant + interior tape + vented over-roof (the Juneau lesson). Drywall inside regardless (fire barrier). Electrical chases frozen at fabrication; no plumbing in exterior SIP walls.
- **Energy:** 8–12 kW ground-mount at latitude tilt + 20–40 kWh LiFePO4 + auto-start generator ($35–70K) + wood stove (Drolet Escape 1200 class, WETT-inspected — insurers demand it). Edmonton December: ~1.3 kWh/kW/day; design for it or fail in January. Grid-optional via Micro-generation Regulation if a line passes; run the FortisAlberta Service Estimator before buying land.
- **Water:** buried cistern (~5 ft deep, $8–15K, hauled potable ~1.5–3¢/L) or drilled well ($10–18K, $45–115/ft). AWG = summer supplement only (condenser AWGs cut off ~15°C/30% RH; outdoor Alberta winter output is zero).
- **Wastewater:** Private Sewage Standard of Practice 2021. Options: conventional septic ($10–25K), **Ecoflo peat/coco biofilter + subsurface drip dispersal** (the eco flagship — NSF-certified, zero-energy, and drip dispersal of treated effluent is Alberta's one legal greywater-reuse path, SOP 8.5), mound, sand filter. Greywater is legally wastewater — it runs through this same permitted system, and that's a product spec, not a footnote. Certified installer mandatory. Composting toilets don't remove the septic requirement in plumbed homes. Constructed wetlands: variance-only. Setbacks: 30 m from wells, 15 m watercourse (mounds), 90 m property line for open discharge.
- **Lifestyle:** wood-fired hot tub (Backcountry Recreation ~$4K+ / AlumiTubs -44°C tested / Goodland design-tier — no pumps, nothing to winterize); deck under 24" height needs no building permit; glazing over 22% of wall area forces the paid energy-model path — the catalog respects FDWR.

## Money & crypto

- **On-ramp:** Wealthsimple (USDC at 0% fee) / Kraken (USDC-CAD) / Coinbase Canada → withdraw on Base → Circle CCTP → native USDC on X Layer (`0xB6CE…3061` mainnet — never USDC.e).
- **Off-ramp (the last mile is CAD):** Kraken USDC/CAD → lawyer's trust account. Lawyers can't hold crypto in trust; convert-then-close is the proven pattern ($800K-BTC Calgary precedent, Greater Property Group; McLeod Law Calgary takes crypto for fees).
- **Lending truth:** Wealthsimple has **no** crypto-backed loans. Real paths: Aave V3 on X Layer, Ledn (Toronto, BTC-collateral, disburses USDC/CAD).
- **Tax:** every crypto payment is a CRA barter disposition at CAD fair market value — the app's ledger exports the bookkeeping. Stablecoin dispositions ≈ nil gain, which is why USDC-first is the tax-clean route.
- **GST trap:** bare land from a developer/corporation/subdivider = 5% GST on top; personal-use land from an individual = generally exempt. $10K swing on a $200K parcel — confirm seller status before offering.
- **Escrow law:** Alberta Prompt Payment and Construction Lien Act — statutory 10% holdback, modeled natively in `AuraBuildEscrow`.

## Supplier directory

The no-middlemen directory lives at [data/alberta/suppliers.json](../data/alberta/suppliers.json) — SIP plants, solar installers and distributors, cistern/hauling firms, septic designers, window manufacturers, stove lines, hot-tub makers, permit agencies, crypto-fluent professionals. Alberta-local flagged first; out-of-province only where the province has no supply. Corrections and additions are welcome as PRs — each entry needs a verifiable basis.
