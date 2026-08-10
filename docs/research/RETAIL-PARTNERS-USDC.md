# Retail Partners for a USDC Home Purchase — Candidate List

**Question:** who can actually *sell* a home to an Aura buyer paid in USDC — today, or with a rail we can hand them?

**Prepared:** August 9, 2026 · KR8TIV AI · Companion to [MARKET-AND-USDC-FEASIBILITY.md](MARKET-AND-USDC-FEASIBILITY.md) (market structure + the goods-vs-deeds legal split) and [../PHASED-ROADMAP.md](../PHASED-ROADMAP.md).

**Governing constraint:** every payment on this page must be reachable **from a single X Layer USDC balance**. A seller who takes crypto is reached in **one CCTP hop** to the chain their processor settles on; a seller who doesn't is reached in **three** (CCTP → off-ramp → fiat invoice) — and for a Canadian buyer that off-ramp is **not OKX**, which takes no new Canadian registrations. Routing table and hop counts: [SUPPLY-CHAIN-CRYPTO-RAILS.md §1](SUPPLY-CHAIN-CRYPTO-RAILS.md). **The prize in every partner conversation is moving a counterparty to X Layer itself, which deletes the hop.**

---

## 0. The three findings that matter

**1. A real prefab manufacturer already accepts crypto for homes.** BOXABL — Las Vegas, the Casita, ~$49,500 base — states it plainly in its own press release: *"Cryptocurrencies have become more standardized as a form of payment for products, and BOXABL accepts cryptocurrencies as payment for the sale of its innovative housing products"* (May 22, 2025). They also run a **Bitcoin treasury reserve** and disclosed acquiring **10 BTC** in August 2025. This is not a rumour or a "we're exploring it" — it's a public company statement plus a treasury position. **Boxabl is the single strongest Phase 1 partner target.**

**2. The reservation-deposit mechanic Aura wants already exists in this industry — it's just paid by Stripe.** Nestron takes a **$1,000 USD booking fee through its online store** to secure an order, then a consultant makes contact within 2 working days; payment is Stripe (3.5% surcharge passed to the customer) or wire to an OCBC Singapore USD account, with full payment before production starts. **Aura's Phase 1 buy button is not a new behaviour — it is that exact booking fee, settled in USDC instead of on a card, with escrow and a refund window that Stripe doesn't give either side.**

**3. The objection that kills partner conversations has a standard answer: the seller never has to hold crypto.** Dubai is the proof at scale — DAMAC (since 2017), Emaar and others accept BTC/ETH and stablecoins on selected projects, and the payment runs through a VARA-approved gateway (Binance Pay, Utrust class) that **auto-converts to AED and deposits into the seller's escrow account**. The developer books fiat. Same pattern is available anywhere via Coinbase Commerce or BitPay. *In the UAE, using a non-approved provider for stablecoins is illegal — a useful reminder that "which gateway" is a compliance question, not a convenience one.*

---

## 1. Tier A — already transacting in crypto (partner today)

| Company | What they sell | Price range | Region | Crypto stance |
|---|---|---|---|---|
| **[BOXABL](https://www.boxabl.com/order)** | Casita, 375 sqft folding factory unit; Order page live | **$49,500** base (real delivered cost higher) | US (state-by-state delivery) | **Accepts crypto for home sales** (PR, May 22 2025). BTC treasury; **10 BTC** acquired Aug 2025. **Top target.** |
| **[Crypto Emporium](https://cryptoemporium.com/property/houses/)** | Luxury-goods marketplace with a real-estate vertical; network of property sellers | Wide | Global | Native. BTC, ETH, SOL, DOGE, **USDT** and more. Built-in **escrow, smart contracts, multi-sig, legal partners**. |
| **[CryptoRealEstate.cc](https://cryptorealestate.cc/)** | Worldwide crypto-only property listings marketplace, direct buyer↔seller | Wide | **2,200+ properties, 50+ countries** | Native. Every listing is a seller who has already said yes to crypto. |
| **[RealOpen](https://realopen.com/)** | Buy real estate with BTC/ETH/**USDC**; converts at closing via a prime OTC desk so you present as a cash buyer | Market | US | Native, but *convert-then-close* — the pragmatic pattern. |
| **[Propy](https://propy.com/home/)** | US-**licensed title company**; on-chain title + escrow; deed NFT on whole-property purchases | Market | US (CA escrow live Jan 2026) | Native. BTC/ETH/**USDC**; Coinbase Prime escrow; Morpho USDC vault. **$5B** volume; **$100M** raised May 2026. The land-side partner, not the home-side. |
| **[TEKCE](https://www.tekce.com/)** | International property brokerage | Market | Turkey, Spain, UAE and more | Multi-thousand crypto transactions reported; cross-border stablecoin buyers are their core flow. |
| **DAMAC / Emaar (Dubai)** | New-build apartments and villas | AED 1M+ | UAE | Accept BTC/ETH and **USDT/USDC on selected projects** via VARA-approved gateways that auto-convert to AED into escrow. DAMAC since 2017. |
| **[Energize Builders](https://markets.financialcontent.com/concordmonitor/article/abnewswire-2025-6-26-energize-builders-celebrates-historic-federal-ruling-allowing-bitcoin-holdings-for-us-mortgages)** | Design/build + remodel (not prefab) | Project-based | Los Angeles | **Accepting crypto since 2015; 200+ projects funded partly or wholly in crypto.** Proof a *construction* firm — not just a broker — can run on this rail for a decade. |

**Read:** the crypto-accepting supply today is concentrated in **(a) one prefab manufacturer, (b) marketplaces, (c) brokers, (d) Gulf developers.** Nobody has joined "eco home you'd actually want" to "settled stablecoin purchase." That's still Aura's opening.

## 2. Tier B — sell homes, no crypto yet, realistically convertible

Ranked by how short the conversation would be.

| Company | What they sell | Price | Region | Payment today | Why they'd say yes |
|---|---|---|---|---|---|
| **[Nestron](https://nestron.house/models/)** | Cube C1/C2/C2X smart tiny homes; real **online configurator** | **from ~$49,800** (Dwell reports entry ~$40K) | Singapore-based, ships internationally, dealer network incl. Canada | **$1,000 online booking fee**, Stripe (3.5% surcharge) or wire to OCBC Singapore USD | Already sells online, already takes a deposit, already charges the customer 3.5% for card. USDC is cheaper for them *and* the buyer, and settles cross-border in seconds instead of days. **Shortest conversation on this list.** |
| **[Dwellito](https://www.dwellito.com/)** | **Marketplace/aggregator**: discover, configure, purchase prefab & modular; AI configurator, site planner, AI floorplan designer; lender partnerships | **$40K–$360K** across the catalog | US (CA-heavy) | Connector model, free to buyer; hands off to manufacturer | One integration = many manufacturers. The aggregator route to breadth if a single-manufacturer deal stalls. |
| **[Honomobo](https://www.honomobo.com/)** | HO2–HO5, HS8 steel-frame modular; G5 H-series | Quote | **Edmonton, Alberta** — Western Canada + NW US | Conventional quote → contract | **The local one.** Founded 2016, **90+ homes installed**. Same province as the Aura pilot, same buyer, same permitting reality. Strategic fit beats price fit here. |
| **[BOSZ Houses](https://www.bosz-houses.nl/en)** | Sense / Signature / Luxury Retreat / Mini Sense Nomad | **€51.5K–€78.5K ex VAT** | Netherlands / EU | Consultation funnel only — phone, WhatsApp, booked call | The founder's reference and the best-looking product on the list, but they have **no online transaction at all**, so Aura would be building their entire commerce rail. High effort, high brand payoff. |
| **[ecokit](https://ecokit.us/)** | Modular sustainable kits; **fixed-price contracts** | Quote | US | Conventional | Fixed-price contracts map cleanly onto milestone escrow. |
| **[Samara](https://www.samara.com/backyard/models)** | Backyard ADUs, turnkey installed | **$289K** studio / **$329K** 1-bed | US (CA-heavy) | Quote-gated | Premium brand, well-capitalised ($34M Sep 2025); slow to move but a marquee logo. |
| **[Dvele](https://www.dvele.com/)**, [Method](https://www.methodhomes.net/), Plant Prefab, Abodu | High-performance net-zero prefab | Dvele **$468–647/sqft** | US West | Quote → construction loan | Premium band; long sales cycles; least likely to move fast. |
| **Insulspan / EnerSmart / Premier SIPS** | SIP panel kits (not finished homes) | Kit-priced | Alberta | Conventional B2B | Not "retailers," but these are who fulfils an **Aura-designed** home. Relevant from Phase 2 on. |

## 3. Tier C — the rail you hand a partner

No manufacturer needs to become a crypto company. Any of these makes them crypto-capable in about a week:

| Rail | What it gives the seller | Notes |
|---|---|---|
| **[Coinbase Commerce](https://commerce.coinbase.com/)** | Hosted checkout, payment buttons, payment links; **settle in USDC** or convert; Onchain Payment Protocol | Cleanest "add a button" option. |
| **[BitPay](https://www.bitpay.com/)** | Merchant processing incl. **USDC**; Coinbase-account holders pay instantly with **no network, miner or withdrawal fee** | Longest-running merchant rail; large existing directory. |
| **Crossmint** | Stablecoin checkout with card fallback | Good where the buyer has no crypto. |
| **Binance Pay / Utrust class** | The **Dubai model**: auto-convert crypto → fiat, deposit into the seller's escrow | The pattern that removes the treasury objection entirely. In the UAE only VARA-approved providers may process stablecoins. |
| **Circle native USDC + CCTP on X Layer** | Direct settlement, no processor, ~2s blocks, sub-cent fees | Aura's own rail. Native USDC live on X Layer **Aug 6–7, 2026** — mainnet `0xB6CEceAB302E2E4948951eE7843FC24E92933061`, testnet `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3`. **Never bridged `USDC.e`.** |
| **OKX Wallet gasless USDC on X Layer (x402)** | Buyer never has to acquire OKB for gas | Live today. Removes the last "I need a second token" friction. |

**Benchmark to quote in a partner pitch:** USDC settlement clears in minutes at roughly a **0.8% gateway fee — ~$480 on a $60,000 order — against $900+ in wire and FX costs**, and Nestron currently passes a **3.5%** Stripe surcharge to its own customers. On a $50K Casita that's $1,750 of card fees versus a few dollars of gas.

## 4. What Aura brings a retailer (the actual pitch)

1. **Buyers they cannot currently serve.** Their funnel starts with a lender saying yes. Aura's buyer is cash or crypto-collateral, often cross-border, often building off-grid — precisely the customer a construction-to-permanent lender rejects.
2. **They never hold crypto unless they want to.** Gateway converts, or Aura converts and remits fiat. Boxabl chooses to hold; nobody has to.
3. **Escrow that protects both sides.** Their deposit today is a card charge with chargeback risk on one side and no guarantee on the other. Aura's is milestone escrow, 2-of-3 release, refund window, statutory holdback — *better than what they have*, not merely different.
4. **A 3D storefront** several tiers above the category norm, at zero build cost to them.
5. **Fees at a fraction of card.** See §3.

## 5. Recommended Phase 1 shortlist

| Priority | Target | Why | Ask |
|---|---|---|---|
| **1** | **Boxabl** | Already accepts crypto for homes; already has an Order page; lowest price point on the list, so the demo purchase is credible | Referral/reseller arrangement; USDC settlement to their existing crypto process |
| **2** | **Nestron** | Online booking fee + configurator already exist; international; paying 3.5% to Stripe today | Add USDC as a third payment rail on the $1,000 booking fee |
| **3** | **Honomobo** (Edmonton) | Alberta pilot alignment, same jurisdiction, real factory, 90+ homes | Pilot partner for the first *real* Aura order in Phase 2 |
| **4** | **Dwellito** | Aggregator — one integration, many manufacturers, $40K–$360K catalog | Distribution/listing partnership |
| **5** | **Crypto Emporium / CryptoRealEstate.cc** | Property-side supply that has already said yes to crypto | Listing feed for the Phase 2 land module |
| — | **Propy** | Licensed title/escrow — the land-side closing partner, not a home seller | Phase 2 conversation, not Phase 1 |

## 6. Honesty constraint for the hackathon

**You will not have a signed partner by August 21, and the demo must not imply one.** Ship Phase 1 "partner-ready":

- Catalog homes are labelled **reference designs priced from published sources** (each with its source link), or Aura's own SIP designs priced from the open Alberta cost model.
- The buy flow is **genuinely real** — native USDC, X Layer, live tx, OKLink link on screen. What's real is real.
- A visible "Partners" state: *signed — none yet; in conversation — [list]*. Naming Boxabl as a **target** is fine and interesting; naming it as a partner is not true.
- This list becomes the Phase 2 outreach pipeline. Say that out loud in the video — a hackathon entry with a named, researched go-to-market pipeline scores on *growth potential*, which is an actual judging criterion.

---

## Sources

- BOXABL crypto acceptance + BTC treasury — https://www.prnewswire.com/news-releases/home-manufacturer-boxabl-adopts-treasury-reserve-strategy-302463783.html · 10 BTC acquisition — https://www.prnewswire.com/news-releases/boxabl-bolsters-treasury-with-acquisition-of-10-bitcoin-302537676.html · holdings tracker — https://bitcointreasuries.net/private-companies/boxabl-inc · order page — https://www.boxabl.com/order · Casita pricing — https://www.boxabl-homes.com/boxabl-casita-tiny-house/
- Nestron booking fee, Stripe/wire terms, order process — https://nestron.house/faqs · models — https://nestron.house/models/ · configurator — https://store.nestron.house/configurator/ · entry pricing — https://www.dwell.com/article/nestron-prefab-plug-and-play-futuristic-tiny-home-b7e0fd81
- Dwellito marketplace ($40K–$360K, AI configurator, connector model, lender partnerships) — https://www.dwellito.com/ · https://datadrivenaec.com/tools/dwellito · financing — https://www.dwellito.com/adu-financing
- Honomobo (Edmonton, 90+ homes, HO2–HO5/HS8) — https://www.honomobo.com/ · https://www.theprefablist.com/manufacturers/honomobo · https://housinginnovation.co/factory/honomobo/
- BOSZ Houses — https://www.bosz-houses.nl/en
- Samara — https://www.samara.com/backyard/models · Dvele pricing — https://www.prefabreview.com/blog/dvele-cost-and-pricing · Method — https://www.methodhomes.net/ · ecokit — https://ecokit.us/
- Crypto Emporium property vertical — https://cryptoemporium.com/property/houses/ · platform review — https://www.bitget.com/amp/academy/is-crypto-emporium-a-reliable-platform-for-trading-cryptocurrencies-in-america-2026-comprehensive-review
- CryptoRealEstate.cc (2,200+ listings, 50+ countries) — https://cryptorealestate.cc/ · sector overview — https://www.thecoinrepublic.com/2026/05/17/crypto-real-estate-2026-platforms-reshaping-property-transactions/
- RealOpen — https://realopen.com/ · Propy — https://propy.com/home/
- Broker/marketplace crypto acceptance, gateway fee benchmarks, TEKCE volumes — https://aurpay.net/aurspace/real-estate-brokers-accept-crypto-payments-2026/
- Dubai developer acceptance (DAMAC since 2017, Emaar select projects, VARA-approved gateways, auto-convert to AED escrow) — https://mayak.ae/blog/buy-property-in-dubai-with-cryptocurrency · https://anika-property.com/how-to-buy-dubai-property-with-cryptocurrency-complete-guide/ · https://www.investing.com/news/cryptocurrency-news/dubais-damac-properties-accepts-bitcoin-and-ethereum-2813167
- Energize Builders (crypto since 2015, 200+ projects) — https://markets.financialcontent.com/concordmonitor/article/abnewswire-2025-6-26-energize-builders-celebrates-historic-federal-ruling-allowing-bitcoin-holdings-for-us-mortgages
- Coinbase Commerce / BitPay / Crossmint comparison — https://eco.com/support/en/articles/14895621-coinbase-commerce-vs-bitpay-vs-crossmint-stablecoin-checkout-compared · BitPay + Coinbase instant pay — https://www.bitpay.com/blog/coinbase-users-can-now-make-instant-crypto-payments-directly-to-bitpay-merchants
- Crypto escrow mechanics — https://zen.land/blog/what-is-crypto-escrow/ · https://www.guaranty-escrow.com/real-estate-crypto-escrows/
- Native USDC + CCTP on X Layer — https://coinlaw.io/circle-usdc-cctp-x-layer/ · gasless USDC via x402 in OKX Wallet — https://onekey.so/blog/ecosystem/okx-wallet-now-supports-0-gas-usdt-and-usdc-transfers-on-x-layer/

*Every crypto-stance claim above is sourced to the company's own statement or to reporting, not inferred from a website's vibe. Where a company's stance is "no crypto today," it says so.*
