# From One X Layer USDC Balance to Everything — Routing, Distributors and Bridge Rails

**The governing constraint (founder's rule):** *everything must be achievable from a single X Layer USDC balance.* The user funds **one** number — native USDC on X Layer — and every downstream payment (home retailer, land, materials, trades, permit fees) is a **route out of that balance**. No second exchange account they have to open, no second chain they have to understand, no OKB. **§1 is the routing spine; everything after it is what sits at the end of each route.**

**Question:** beyond the home itself, can an Aura buyer pay for **materials and trades** — SIP panels, glass, solar, water, septic, timber — in USDC? Directly where suppliers accept it, and through a bridge (gift card / card) where they don't?

**Prepared:** August 9, 2026 · KR8TIV AI · Third companion to [MARKET-AND-USDC-FEASIBILITY.md](MARKET-AND-USDC-FEASIBILITY.md) (market + legal split) and [RETAIL-PARTNERS-USDC.md](RETAIL-PARTNERS-USDC.md) (home sellers). Bill-of-materials lines and prices come from [`data/alberta/cost-model.json`](../../data/alberta/cost-model.json) via [FEASIBILITY.md §6](../FEASIBILITY.md).

---

## 0. Executive verdict

**Partly — and the honest number is the interesting part.**

1. **One supplier on Aura's actual bill of materials already takes crypto, and it's in Alberta.** [Kuby Renewable Energy](https://kuby.ca/) — Edmonton, Calgary, Lethbridge and Kamloops — sells residential and commercial solar, storage, EV charging and engineering, and states: *"Kuby Renewable Energy is now accepting Bitcoins as payment for solar power systems and contracting services."* They even describe hedging: *"rates shall be determined based upon present value of the cryptocurrency hedged against immediate volatility during the installation time frame."* **Solar + storage is the single largest non-land line in an Aura build (~$48K MID). It is also the one line with a local crypto-accepting vendor.** That is a genuine, checkable, Alberta-specific asset.
2. **Every route starts from one balance, and CCTP is the spine.** Circle's CCTP went live on X Layer on **August 7, 2026** — burn-and-mint native USDC across 13+ chains, ~8–20s on the fast lane. Nothing else — no gift-card service, no card, no off-ramp — settles on X Layer, so exactly **one CCTP hop** stands between the user's balance and every off-chain payment. Full routing spine in **§1**.
3. **The rest of the bill of materials has no direct rail.** After aggressive searching: **no SIP manufacturer, no CLT/mass-timber supplier, no triple-pane window maker, no septic/Ecoflo distributor, and no greywater equipment supplier was found accepting crypto.** Stated plainly because it's true.
4. **The bridge rails work, but they are small-ticket tools with real counterparty risk.** Gift cards and virtual cards genuinely let someone buy supplies with USDC at Home Depot or Home Hardware Canada. They do not sensibly move a $45K SIP kit, and two of the best-known bridges had serious incidents in 2026 (§3). For big tickets the boring answer — convert to CAD and pay the invoice — is cheaper, more auditable, and the only one with recourse.
5. **The cleanest exit off X Layer is closed to the pilot's own users.** OKX exchange is the tidiest way from X Layer USDC to fiat — and it does not accept **new Canadian registrations** in 2026. The Alberta route is CCTP → Base/Polygon → Kraken/Coinbase/Wealthsimple → CAD. Design for that, and say it out loud.
6. **So Aura's job here is routing, not fantasy.** One balance in; per budget line choose **STAY (E5) → CCTP (E1) → BRIDGE → CONVERT**, showing fee, time and recourse at every hop. Roughly **$50–60K of a $301K MID build has a real crypto rail today**; the rest converts. That's a product, and it's honest.

---

## 1. THE CONSTRAINT — one X Layer USDC balance must reach every payment

### 1.1 The five exits from X Layer

| # | Exit | Mechanism | Where it lands | Verdict |
|---|---|---|---|---|
| **E1** | **Circle CCTP** ⭐ | Burn-and-mint: burns USDC on X Layer, mints **native** USDC on the destination — *"instead of locking tokens and issuing a wrapped IOU."* **Live on X Layer since Aug 7, 2026** | Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, Solana, Celo, Linea, Unichain, Sonic, World Chain — **13+ chains** on CCTP V2 (now canonical; V1 deprecating from Jul 31 2026). **Fast Transfer settles ~8–20s across 11 chains** | **The spine. Build on this.** |
| **E2** | Canonical X Layer bridge | Official L1↔L2 bridge contracts | Ethereum only | ⚠️ **Do not put user money here.** The X Layer bridge docs describe *"optimistic assumptions… with a 7-day challenge period for fraud proofs"* — which sits oddly against X Layer's zkEVM positioning. **Verify the real exit time before relying on it.** Infra ops only |
| **E3** | OKX exchange withdrawal | Deposit X Layer USDC/OKB to OKX, withdraw to bank or another chain; gasless on the exchange side | Fiat or any OKX-supported chain | Cleanest **where available** — but **OKX blocks Canada: existing accounts only, no new registrations in 2026.** Unusable for a new Alberta buyer |
| **E4** | Bridge aggregators | LI.FI · Jumper · Squid · deBridge · Rango · Bungee. **OKX Wallet turned on auto-routing across 30+ bridges on Jul 25 2026**; Stargate/LayerZero delivers native assets to X Layer | Wherever the destination service lives | Useful fallback and best-execution. **Confirm each one actually lists X Layer before shipping — this sweep did not** |
| **E5** | **Stay on X Layer** ⭐ | Pay an X Layer address directly | X Layer | **The goal state.** Zero hops, sub-cent, ~2s, and gasless USDC via x402 in OKX Wallet so the user never needs OKB |

### 1.2 Routing table — one balance to each end payment

| End payment | Route | Hops | Friction |
|---|---|---|---|
| **Aura reservation deposit / milestone escrow** | **E5 — never leaves X Layer** | **0** | None. This is why the escrow lives here |
| **Home retailer that takes crypto** (Boxabl) | E1 → the chain their processor settles on (BitPay / Coinbase Commerce) | 1 | Minutes |
| **Home retailer that doesn't** (Nestron, BOSZ, Honomobo) | E1 → Base/Polygon/Ethereum → off-ramp → CAD/USD wire → invoice | 3 | Hours–1 day · ~0.4% + wire |
| **Land / property closing** | E1 → off-ramp → **lawyer's trust account, in CAD** | 3 | Days. Alberta lawyers cannot hold crypto in trust — permanent until the rules change |
| **Materials — direct crypto supplier** (Kuby, Skycorp) | E1 → their processor's chain — **or E5 if we onboard them to X Layer** | 0–1 | Low |
| **Materials — gift card** (Home Depot CA, Home Hardware) | E1 → **Polygon / Ethereum / Solana** (Bitrefill's USDC networks) → buy code | 1–2 | Minutes · **no recourse** |
| **Materials — card rail** | E1 → Base/Ethereum → Coinbase account → **Coinbase Card (USDC redeems 1:1, no spread, zero fees)** | 2 | Low ongoing |
| **County permits, P.Eng stamps, title fees** | E1 → off-ramp → CAD | 3 | **Fiat-only endpoint. Always will be** |

**Canadian off-ramp note:** with OKX closed to new Canadian accounts, the Alberta buyer's exit is **CCTP → Base/Polygon/Ethereum → Kraken, Coinbase or Wealthsimple → CAD**. Kraken supports USDC on Ethereum, Solana, Polygon, Arbitrum and Optimism (not X Layer), which is exactly why the CCTP hop is structural.

### 1.3 The three facts that decide the design

1. **CCTP is the spine, and it landed on X Layer three days ago.** Native burn-and-mint, no wrapped IOU, 13+ chains, ~8–20s on the fast lane. **Every route above except E5 begins with a CCTP hop — so the app should call CCTP directly rather than depend on a third-party bridge.**
2. **No gift-card, card, or off-ramp service settles on X Layer.** Bitrefill takes USDC on Ethereum, Solana and Polygon. Kraken takes it on five chains, none of them X Layer. **The hop is structural, not optional — so show it in the UI as a step with its fee and time, rather than pretending the balance teleports.** (Bitrefill has integrated **LI.FI** for swap-in from other chains, which could collapse this to one hop *if* X Layer is in LI.FI's list — worth confirming, it's the single highest-leverage unknown on this page.)
3. **The cleanest exit is closed to the pilot's own users.** OKX exchange is the tidiest way off X Layer and it does not accept new Canadian registrations. Say so plainly in the submission — an OKX judge will respect an honest diagram more than one that routes Albertans through a product they cannot open.

### 1.4 What Aura builds: the Route Planner

The Supply Router's other half. Same agent, one job added: **every payment shows its route.**

- **One number in the UI: "Your X Layer USDC."** Never ask the user to think about a second balance.
- Each payment renders as steps — *X Layer → CCTP → Polygon → gift code* — with fee, time and **recourse** on each hop.
- **Preference order: E5, then E1. Never E2 silently.**
- **The compounding move is onboarding counterparties onto X Layer**, because it deletes hops permanently. Track one headline metric: **"% of this build payable without leaving X Layer."** Today that's ~100% of the Aura escrow and ~0% of the materials — and every supplier converted moves the number.
- **Phase 1:** read-only planner with honest hop counts. **Phase 2:** execute CCTP in-app.

### 1.5 Verify before shipping

- [ ] **X Layer canonical bridge exit semantics** — docs say 7-day challenge period; confirm against a live withdrawal before E2 touches user funds.
- [ ] **X Layer in LI.FI / Jumper / Relay / Rango chain lists** — unconfirmed here; determines whether E4 and the Bitrefill swap-in path exist at all.
- [ ] **Bitrefill's LI.FI swap-in from X Layer** — would collapse the gift-card route to one hop.
- [ ] **Coinbase Card and Gnosis Pay availability in Canada** — unverified.
- [ ] **Always native USDC** (`0xB6CE…3061` mainnet / `0xDec9…b9B3` testnet). Three variants circulate on X Layer; the wrong one strands funds.

---

## 2. Direct — suppliers and trades that already accept crypto

| Supplier | What they sell | Region | Crypto stance | Relevance to Aura's BOM |
|---|---|---|---|---|
| **[Kuby Renewable Energy](https://kuby.ca/solar/solar-information/articles/you-can-now-buy-solar-panels-with-bitcoin)** | Solar PV, battery storage, EV charging, engineering, **contracting services** | **Edmonton · Calgary · Lethbridge (AB) · Kamloops (BC)** | **Accepts Bitcoin** for systems and contracting; rate hedged against volatility over the install window. Processor and altcoin support not published — confirm directly | **Direct hit on the $35–70K solar/battery line, in the pilot province.** Highest-value contact on this page |
| **[Skycorp Solar](https://www.investing.com/news/cryptocurrency-news/skycorp-solar-to-accept-cryptocurrency-payments-starting-august-1-432SI-4145756)** | Solar cable, connectors, balance-of-system components | International | **BTC, ETH, and stablecoins USDC + USDT**, for international transactions, from Aug 1 2025 | **USDC-native.** Components, not panels — useful and small-ticket |
| **[GoGreenSolar](https://www.gogreensolar.com/pages/bitcoin-for-solar-energy)** | Complete grid-tied and off-grid solar kits | US | Bitcoin at checkout, processed via Coinbase | Kit-level solar; US shipping constraints for an AB build |
| **[Invaleon](https://www.solarpowerworldonline.com/2021/02/massachusetts-solar-installer-invaleon-now-accepts-bitcoin-as-payment/)** | Solar installation | Massachusetts | Bitcoin | Precedent that installers (labour, not just goods) take crypto |
| **[Energize Builders](https://markets.financialcontent.com/concordmonitor/article/abnewswire-2025-6-26-energize-builders-celebrates-historic-federal-ruling-allowing-bitcoin-holdings-for-us-mortgages)** | Design/build and remodel contractor | Los Angeles | **Crypto since 2015; 200+ projects funded partly or wholly in crypto** | Proof a construction firm can run a decade on this rail |
| **[Home Depot](https://www.leaprate.com/cryptocurrency/bitcoin/flexa-or-how-bitcoin-just-entered-nordstrom-home-depot-and-whole-foods/)** (in-store) | Everything | US | Via the **Flexa / Spedn** app: the app shows a QR at the register, **the retailer is paid in USD** while crypto leaves the app wallet (Gemini-custodied; GUSD, BTC, ETH, BCH) | ⚠️ **Verify before relying.** This integration dates to the Flexa/Gemini launch and is app-mediated and US-only. Treat "Home Depot accepts Bitcoin" list-articles as unverified until tested at a till |

**Negative findings, stated plainly:** searching specifically for crypto acceptance at SIP manufacturers (Insulspan, EnerSmart, Premier SIPS), mass-timber/CLT suppliers, triple-pane window makers (Lux, All Weather, Duxton), Ecoflo/Premier Tech septic distributors, and greywater equipment vendors returned **nothing**. Likewise no confirmation for Signature Solar, Renogy, EcoFlow, Bluetti or altE. These lines need a bridge or a conversion — or a supplier onboarding conversation (§5), which is the only move that removes a hop permanently.

---

## 3. Bridge rails — buying from suppliers who don't take crypto

*Every rail below sits at the end of an **E1 (CCTP) hop** out of X Layer — see §1.2 for the exact route and hop count.*

Four mechanisms, ranked by how much of a build they can actually carry.

### 2a. Crypto → gift card

| Service | Coins | Relevant cards | Notes |
|---|---|---|---|
| **[Bitrefill](https://www.bitrefill.com/ca/en/gift-cards/retail/)** | BTC, Lightning, ETH, **USDC**, USDT, SOL, LTC, DOGE, DASH, Binance Pay | **US:** [Home Depot](https://www.bitrefill.com/us/en/gift-cards/the-home-depot-usa/), [Lowe's](https://www.bitrefill.com/us/en/gift-cards/lowe_s-usa/) · **Canada:** [Home Depot Canada](https://www.bitrefill.com/ca/en/gift-cards/home-depot-ca/), [Home Hardware](https://www.bitrefill.com/buy/home-hardware-canada/) | Codes delivered within moments; 186+ countries. **The Canadian coverage is what matters for the Alberta pilot.** |
| **[Coinsbee](https://www.coinsbee.com/en/The+Home+Depot-bitcoin)** | 250+ coins | Home Depot and a broad retail catalog | Widest coin support |
| **[CryptoRefills](https://www.cryptorefills.com/en/canada/gift_cards)** | BTC, ETH, stablecoins | Home Depot US + Canada | Third option; useful redundancy |

> ⚠️ **Counterparty risk is not theoretical.** On **March 1, 2026, attackers reached Bitrefill's infrastructure through a compromised employee laptop, accessed parts of the database, and drained hot wallets.** Use these services **buy-and-burn** — never hold a balance, never store payment details, treat every purchase as final.

### 2b. Crypto → virtual card

**[Pay with Moon](https://paywithmoon.com/payment-method/usdc)** converts BTC/Lightning/ETH/**USDC**/USDT into virtual Visa prepaid cards spendable at 130M+ Visa merchants. Moon X (reloadable, global): first card free, 1% per purchase, $1 minimum. Moon 1X (disposable, US): $1.49 issuance, 0% transaction fee.

> ⚠️ **As of early 2026 there is a high volume of user reports that the platform is offline or refusing refunds.** **Do not route user funds through Moon.** Listed for completeness and because the *mechanism* is right even if this operator currently isn't.

### 2c. Crypto → debit card (the durable version of 2b)

| Card | Why it matters |
|---|---|
| **Coinbase Card** | **Zero spending and annual fees; USDC redeems 1:1 for dollars with no spread.** The cleanest USDC-to-anywhere rail on this list |
| **Gnosis Pay** | Visa attached to a **Safe smart account**; funds with EURe/GBPe/bridged USDC; merchant authorizations settle **on-chain** via Monerium rails. Interesting because Aura's roadmap already targets Safe for account abstraction |
| **Crypto.com Visa** | Mid-market FX, tiered perks |
| **Kast** | Widest footprint — 140+ countries |

> **Open question:** Canadian availability differs per card and none of the sources confirmed it. Verify before putting any of these in front of an Alberta user.

### 2d. Convert and pay — the boring correct answer for big tickets

Kraken USDC/CAD (~0.4% taker) → EFT/wire → supplier invoice. Unglamorous, but for a $45K SIP kit it is cheaper than any bridge, fully auditable, gives real recourse, and is what the supplier's accounting expects.

### Comparison

| Mechanism | Practical ceiling | Cost | Recourse if it goes wrong | Best for |
|---|---|---|---|---|
| Direct (supplier takes crypto) | Unlimited | Network fee only | Normal commercial terms | Solar (Kuby), components (Skycorp) |
| Gift card | Low — per-card caps, awkward above ~$2–5K | Often at or near face value | **None. Codes are final; issuer breach is your problem** | Fit-out, hardware, consumables |
| Virtual / debit card | Medium — daily and per-tx limits | 0–1% + FX | Visa dispute rights (real, but slow) | Mid-size orders, travel, incidentals |
| Convert and pay | Unlimited | ~0.4% + wire | Full — invoice, contract, lien rights | SIP kit, windows, septic, trades |

---

## 4. Fit against Aura's actual bill of materials

Reference build: 800 sqft off-grid SIP, MID column.

| BOM line | MID | Best rail today |
|---|---|---|
| Land | $150K | **None.** Lawyer, convert-then-close (AB lawyers can't hold crypto in trust) |
| Site + screw piles | $18K | Convert & pay |
| SIP shell kit + erection | $45K | Convert & pay — **or an Insulspan/EnerSmart gateway conversation (§5)** |
| Roof, windows, doors, siding | $32K | Convert; small items via gift card |
| Interior fit-out | $35K | **Gift-card sweet spot** — Home Depot CA / Home Hardware |
| Mechanical (HRV, plumbing, electrical, stove) | $30K | Mixed: goods via gift card, licensed trades convert |
| **Off-grid solar + battery + generator** | **$48K** | **DIRECT — Kuby (Alberta) takes Bitcoin, including the contracting**; Skycorp for USDC components |
| Water (cistern or well) | $12K | Convert |
| AWG summer module | $5K | Convert |
| Septic / Ecoflo | $18K | Convert (certified installer legally required; no crypto found) |
| Hot tub + deck | $14K | Gift card / direct-ish |
| Permits, design, engineering, insurance | $12K | **Fiat only** — county fees, professional stamps |

**The honest headline: about $50–60K of a $301K MID build has a real crypto rail today** — the solar package directly, plus fit-out and hardware through the gift-card bridge. Everything else converts. Say the number; it's more persuasive than a vague claim, and it makes the routing product obvious.

---

## 5. What Aura builds: the Supply Router

An agent that, for each line of the generated budget, picks and shows the rail:

```
BUDGET LINE ──▶  DIRECT?   supplier accepts USDC/BTC        → pay on-chain, log tx
             ├─▶ BRIDGE?   gift card / card, ≤ ~$5K         → show fee, cap, NO-RECOURSE warning
             └─▶ CONVERT   Kraken USDC/CAD → EFT/wire       → show ~0.4% + wire, full recourse
                                   │
                                   ▼
                    every path logs a CRA barter disposition
                    (crypto spent = a taxable disposition — the ledger export
                     already on the roadmap turns this from nuisance to feature)
```

- **Phase 1 (hackathon):** ship it **read-only** — a panel on the budget page showing the chosen rail, fee and recourse per line, with Kuby named as a real direct-crypto Alberta supplier. Cheap, demoable, zero custody, and it makes the AI visibly useful again.
- **Phase 2:** make it transactional, and run **supplier onboarding** — hand Insulspan / EnerSmart / a window supplier a Coinbase Commerce or BitPay link so they can accept USDC without ever holding it (the same argument that works on home retailers: the gateway converts, they book fiat). Every supplier converted moves a line from CONVERT to DIRECT, and that migration is a measurable growth metric for the ecosystem story.
- **Phase 3:** the router negotiates and schedules — quotes, lead times, frost windows — per [PHASED-ROADMAP.md](../PHASED-ROADMAP.md) §3b.

---

## 6. Risks

| Risk | Note |
|---|---|
| **Counterparty failure** | Bitrefill breached March 1 2026; Moon reportedly offline/refusing refunds in early 2026. **Never custody with a bridge; buy-and-burn only; keep a second and third provider configured.** |
| **No recourse on gift codes** | A gift card is cash. Wrong order, damaged goods, vendor dispute — the code is gone. Never route a large or complex order through one. |
| **AML optics** | Buying gift cards with crypto is a textbook laundering typology. A platform that *routes* users into it should expect scrutiny: keep receipts, tie every purchase to a build record, and raise it with counsel before Phase 2 goes transactional. |
| **Tax** | Every crypto spend is a disposition at fair market value. Automatic CAD-FMV bookkeeping is mandatory, not optional. |
| **Volatility** | Kuby's hedging language is the right pattern to copy: fix the rate at present value and hedge over the install window. USDC removes this on Aura's own rails, but not when a supplier prices in BTC. |
| **Warranty and lien rights** | Paying a trade in crypto must not disturb the Prompt Payment and Construction Lien Act position. Legal review before any trade is paid this way in production. |

---

## 7. X Layer / USDC fit

- **None of the gift-card or card bridges settle on X Layer today.** They take USDC on Ethereum, Solana, Base, Polygon or Tron. The route is **X Layer USDC → Circle CCTP → Base/Ethereum/Polygon → bridge service** — see §1.2 for hop counts. State that plainly in any UI; don't imply a native path that doesn't exist.
- **Direct and convert paths can be X Layer-native** the moment a supplier onboards — native USDC on X Layer (live Aug 6–7 2026), ~2s blocks, sub-cent fees, and gasless USDC transfers via x402 in OKX Wallet so a supplier never needs OKB.
- **The router is a natural OKX Agent Payments Protocol citizen** — APP v1.0 specifies quotes, negotiation, escrow, metering, partial refunds, splits and dispute resolution. A per-line supply router that quotes rails and meters its own fee is close to a canonical APP use case, which is worth saying out loud in the submission.

---

## Sources

**Routing spine (§1)**
- Circle CCTP overview and V2 canonical status / V1 deprecation from Jul 31 2026 — https://www.circle.com/cross-chain-transfer-protocol · https://www.circle.com/blog/cctp-version-updates · https://www.circle.com/blog/cctp-v2-the-future-of-cross-chain
- CCTP V2 chain list, 13+ chains, ~8–20s Fast Transfer across 11 — https://eco.com/support/en/articles/11813797-circle-cctp-v2-native-usdc-across-13-chains · https://eco.com/support/en/articles/14998923-cctp-cross-chain-usdc-complete-guide-2026
- **Native USDC + CCTP live on X Layer, Aug 7 2026**, burn-and-mint replacing USDC.e — https://coinlaw.io/circle-usdc-cctp-x-layer/ · https://www.hokanews.com/2026/08/circle-launches-native-usdc-on-okxs-x.html
- X Layer bridge docs (four-phase bridging; **"optimistic assumptions… 7-day challenge period for fraud proofs"** — verify) — https://web3.okx.com/xlayer/docs/developer/bridge/overview · bridge UI — https://web3.okx.com/xlayer/bridge · OKX help — https://www.okx.com/en-us/help/okx-web3-x-layer · https://www.okx.com/en-us/help/x-layer-faq
- OKX Wallet auto bridge routing across **30+ bridges** (Jul 25 2026); Stargate/LayerZero native delivery to X Layer; "for OKB and native USDC the OKX exchange withdrawal is cleanest" — https://usethebitcoin.com/news/okx-wallet-bridge-routing-update/ · https://www.datawallet.com/crypto/bridge-to-x-layer
- Bridge aggregators (LI.FI, Jumper, Squid, deBridge, Rango, Bungee; Jumper 60+ chains) — https://eco.com/support/en/articles/15291263-best-crypto-bridge-aggregator-2026 · https://eco.com/support/en/articles/11803057-what-is-li-fi-the-cross-chain-bridge-and-dex-aggregator-explained
- **OKX closed to new Canadian registrations** (existing accounts only, 2026) — https://www.bitget.com/academy/are-platforms-like-kucoin-binance-or-okx-legal-to-use-in-canada-2026-complete-regulatory-guide · https://www.datawallet.com/crypto/okx-restricted-countries · original exit — https://coingeek.com/okx-point-to-new-regulations-as-reason-for-canada-exit/
- Kraken USDC networks (Ethereum, Solana, Polygon, Arbitrum, Optimism — no X Layer) — https://support.kraken.com/articles/multiple-networks-and-methods-on-kraken · https://support.kraken.com/articles/native-usd-coin
- Off-ramp comparison and fees (Coinbase instant cashout 1.5%; Kraken lowest fee outside US; MoonPay ~1% + $3.99; Transak 0.5–5.5%) — https://eco.com/support/en/articles/15210579-best-stablecoin-offramps-2026-cash-out-routes-compared · https://eco.com/support/en/articles/15039728-convert-usdc-to-bank-account-fastest-routes-in-2026
- **Bitrefill USDC networks: Ethereum, Solana, Polygon** + LI.FI swap-in; Binance Pay removed Jul 2026 — https://help.bitrefill.com/hc/en-us/articles/4613768372882-What-tokens-are-accepted-by-Bitrefill · https://coinbureau.com/review/bitrefill-review · https://www.bitrefill.com/blog/you-can-now-use-usdc-over-polygon-on-bitrefill/

**Distributors and bridges (§2–§7)**
- Kuby Renewable Energy (AB/BC, accepts Bitcoin for solar systems and contracting, hedged rate) — https://kuby.ca/solar/solar-information/articles/you-can-now-buy-solar-panels-with-bitcoin · https://kuby.ca/
- Skycorp Solar (BTC/ETH/USDC/USDT from Aug 1 2025) — https://www.investing.com/news/cryptocurrency-news/skycorp-solar-to-accept-cryptocurrency-payments-starting-august-1-432SI-4145756
- GoGreenSolar Bitcoin checkout — https://www.gogreensolar.com/pages/bitcoin-for-solar-energy
- Invaleon solar installer accepts Bitcoin — https://www.solarpowerworldonline.com/2021/02/massachusetts-solar-installer-invaleon-now-accepts-bitcoin-as-payment/
- Energize Builders (crypto since 2015, 200+ projects) — https://markets.financialcontent.com/concordmonitor/article/abnewswire-2025-6-26-energize-builders-celebrates-historic-federal-ruling-allowing-bitcoin-holdings-for-us-mortgages
- Home Depot via Flexa/Spedn (retailer paid in USD; Gemini custody) — https://www.leaprate.com/cryptocurrency/bitcoin/flexa-or-how-bitcoin-just-entered-nordstrom-home-depot-and-whole-foods/ · https://www.gemini.com/blog/flexa-and-gemini-partner-to-make-it-easy-to-use-cryptocurrency · merchant lists (treat as unverified) — https://99bitcoins.com/cryptocurrency/bitcoin/who-accepts/
- Bitrefill Canada retail gift cards — https://www.bitrefill.com/ca/en/gift-cards/retail/ · Home Depot Canada — https://www.bitrefill.com/ca/en/gift-cards/home-depot-ca/ · Home Hardware — https://www.bitrefill.com/buy/home-hardware-canada/ · Home Depot US — https://www.bitrefill.com/us/en/gift-cards/the-home-depot-usa/ · Lowe's US — https://www.bitrefill.com/us/en/gift-cards/lowe_s-usa/
- Bitrefill March 1 2026 breach + coin support + alternatives — https://localcoinswap.com/blog/top-bitrefill-alternatives-2026 · https://www.bitget.com/academy/best-sites-for-crypto-refills-and-gift-card-services-in-america-2026-comprehensive-guide
- Coinsbee Home Depot (250+ coins) — https://www.coinsbee.com/en/The+Home+Depot-bitcoin
- CryptoRefills Canada — https://www.cryptorefills.com/en/canada/gift_cards · Home Depot — https://www.cryptorefills.com/en/canada/gift_cards/home_depot
- Pay with Moon (USDC → virtual Visa; fees; 130M+ merchants; 2026 reliability reports) — https://paywithmoon.com/payment-method/usdc · https://paywithmoon.com/virtual-credit-cards-vccs · https://opencryptocards.com/cards/moon-prepaid-card · https://paywithmoon.com/merchants/home-depot
- Crypto debit cards compared (Coinbase Card zero-fee USDC 1:1; Gnosis Pay on Safe + Monerium; Kast 140+ countries) — https://eco.com/support/en/articles/15039724-best-crypto-debit-cards-in-2026-ranked-by-fees-and-rewards · https://www.dextools.io/tutorials/top-5-crypto-debit-cards-2026 · https://coinbureau.com/analysis/best-crypto-debit-cards
- Merchant crypto acceptance rate (39% of US merchants, 2026) — https://rango.exchange/learn/market-trends/accept-bitcoin-payment
- Native USDC + CCTP on X Layer — https://coinlaw.io/circle-usdc-cctp-x-layer/ · gasless USDC via x402 — https://onekey.so/blog/ecosystem/okx-wallet-now-supports-0-gas-usdt-and-usdc-transfers-on-x-layer/ · OKX APP v1.0 whitepaper — https://web3.okx.com/whitepaper/okx-app-whitepaper.pdf

*Negative findings are stated as plainly as positive ones. Where a bridge service has had a security or reliability incident, it is flagged at the point of recommendation, not buried in a footnote.*
