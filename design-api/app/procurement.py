"""Procurement — every path rooted at ONE X Layer USDC balance.

THE ARCHITECTURAL CONSTRAINT, and the reason this module exists:

    The user holds USDC on X Layer. That is the single funding source. Buying
    the home, buying the land, and procuring the supplies must ALL be
    reachable from that one balance. Bridges and ramps convert it into
    whatever the recipient actually needs — fiat, a gift card, USDC on another
    chain — but from the user's side there is one balance and one currency.

So this is a ROUTER, not a checkout. Given a supplier and an amount, it
resolves the cheapest viable path from X Layer USDC to that supplier being
paid, and is explicit about the fee, the settlement time, and what the
recipient receives.

    X LAYER USDC  (root — native, 0xB6CE…3061 mainnet / 0xDec9…b9B3 testnet)
        │
        ├── DIRECT        supplier accepts USDC on X Layer          ~0 fee
        ├── CCTP          supplier accepts USDC on another chain    burn/mint, native both ends
        ├── GIFT_CARD     crypto → prepaid/gift card → purchase     for suppliers with no crypto desk
        └── FIAT_OFFRAMP  crypto → CAD → e-transfer / wire          licensed boundary; the land path

WHAT IS AND IS NOT REAL. Route *modelling* is real — the fee maths, the
ordering, the constraints. Route *execution* is stubbed behind adapters: no
integration is live, no credential is bundled, and `executable=False` on
every route until a specific integration lands. The repo's honesty policy
forbids implying otherwise, and `docs/PHASED-ROADMAP.md` puts real settlement
in Phase 1 with a named retailer.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

# Native USDC only. Bridged USDC.e strands funds — three variants circulate.
USDC_XLAYER_MAINNET = "0xB6CEceAB302E2E4948951eE7843FC24E92933061"
USDC_XLAYER_TESTNET = "0xcB8BF24c6cE16Ad21D707c9505421a17f2bec79D"
XLAYER_MAINNET_CHAIN_ID = 196
XLAYER_TESTNET_CHAIN_ID = 1952


class Rail(str, Enum):
    DIRECT = "direct_usdc_xlayer"
    CCTP = "cctp_bridge"
    GIFT_CARD = "gift_card_bridge"
    FIAT_OFFRAMP = "fiat_offramp"


class Accepts(str, Enum):
    USDC_XLAYER = "usdc_xlayer"
    USDC_OTHER_CHAIN = "usdc_other_chain"
    CRYPTO_GENERIC = "crypto_generic"
    GIFT_CARD = "gift_card"
    FIAT_ONLY = "fiat_only"


class Supplier(BaseModel):
    """A distributor for one or more BOM `supplier_tags`.

    `accepts` is the whole point: it decides which rail can reach them. The
    registry below is deliberately small and honest — it records what a
    supplier's payment stance actually is, and `verified` says whether that
    was confirmed or is an assumption to check.
    """

    key: str
    name: str
    region: str = "AB"
    tags: list[str] = Field(default_factory=list)
    accepts: Accepts = Accepts.FIAT_ONLY
    url: str | None = None
    note: str = ""
    verified: bool = False


#: Starter registry. Kept small on purpose: an unverified supplier list that
#: looks authoritative is worse than a short one that admits what it knows.
#: docs/research/RETAIL-PARTNERS-USDC.md is the live shortlist.
SUPPLIERS: list[Supplier] = [
    Supplier(
        key="boxabl", name="BOXABL", region="US", tags=["prefab", "home"],
        accepts=Accepts.CRYPTO_GENERIC,
        url="https://www.boxabl.com",
        note="Announced crypto acceptance for home sales (May 2025) and holds a BTC "
             "treasury. The strongest Phase-1 direct-crypto candidate found.",
        verified=True,
    ),
    Supplier(
        key="insulspan", name="Insulspan (SIP)", tags=["sip", "panels"],
        accepts=Accepts.FIAT_ONLY,
        note="CCMC-listed SIP supplier with an Alberta path. Fiat only — reachable "
             "via off-ramp or gift-card bridge. 12–20 week lead time.",
    ),
    Supplier(
        key="home_depot_ca", name="Home Depot Canada", tags=["lumber", "timber", "roofing", "interior", "doors"],
        accepts=Accepts.GIFT_CARD,
        note="No crypto desk, but widely available as a gift card — the canonical "
             "gift-card-bridge case for consumable building supplies.",
    ),
    Supplier(
        key="rona", name="RONA", tags=["lumber", "roofing", "interior"],
        accepts=Accepts.GIFT_CARD,
        note="Same shape as Home Depot for the bridge route.",
    ),
    Supplier(
        key="generic_solar_ab", name="Alberta solar distributor (TBD)", tags=["solar", "battery", "electrical"],
        accepts=Accepts.FIAT_ONLY,
        note="Placeholder until a named distributor is confirmed. Solar wiring is "
             "licensed work (CEC s.64) regardless of how it is paid for.",
    ),
]


class Route(BaseModel):
    rail: Rail
    supplier_key: str
    amount_cad: float
    #: Total fee as a fraction, and in CAD, for this rail at this size.
    fee_pct: float
    fee_cad: float
    settles_in: str
    recipient_gets: str
    steps: list[str]
    #: FALSE everywhere until a specific integration lands. Never implied true.
    executable: bool = False
    caveats: list[str] = Field(default_factory=list)


#: Indicative fee models. Ordered cheapest-first when a supplier supports more
#: than one rail. Gift cards frequently carry a *discount* rather than a fee,
#: but we model 0 and say so rather than promising a saving.
FEE_MODEL: dict[Rail, tuple[float, str]] = {
    Rail.DIRECT: (0.001, "gas only — OKB on X Layer, pennies"),
    Rail.CCTP: (0.002, "Circle CCTP burn/mint + gas on both ends"),
    Rail.GIFT_CARD: (0.02, "bridge spread, typically 1–3%"),
    Rail.FIAT_OFFRAMP: (0.015, "off-ramp spread + settlement"),
}


def _route(rail: Rail, s: Supplier, amount: float) -> Route:
    pct, basis = FEE_MODEL[rail]
    common = [
        f"Start: USDC on X Layer (chain {XLAYER_MAINNET_CHAIN_ID}, native {USDC_XLAYER_MAINNET[:6]}…)",
    ]
    if rail is Rail.DIRECT:
        steps = common + [f"Transfer USDC directly to {s.name}'s X Layer address",
                          "Escrow milestone releases on 2-of-3 approval"]
        gets, when = "native USDC on X Layer", "seconds"
        caveats = ["Requires the supplier to hold an X Layer address."]
    elif rail is Rail.CCTP:
        steps = common + ["Burn USDC on X Layer via Circle CCTP",
                          "Mint native USDC on the supplier's chain",
                          "Transfer to the supplier"]
        gets, when = "native USDC on their chain (not a wrapped IOU)", "minutes"
        caveats = ["Never send bridged USDC.e — three variants circulate and the wrong one strands funds."]
    elif rail is Rail.GIFT_CARD:
        steps = common + ["Swap USDC → gift card via a crypto gift-card provider",
                          f"Redeem the card against the {s.name} order",
                          "Upload the receipt so escrow can release the matching milestone"]
        gets, when = f"a {s.name} gift card / prepaid balance", "minutes"
        caveats = [
            "Card limits cap order size — large SIP or solar orders usually need the off-ramp instead.",
            "Refunds return to card, not to USDC. Confirm the return policy before large buys.",
        ]
    else:
        steps = common + ["Off-ramp USDC → CAD at a licensed provider",
                          "Settle to the supplier by e-transfer or wire",
                          "Ledger records the CRA barter disposition automatically"]
        gets, when = "CAD in their bank account", "1–3 business days"
        caveats = [
            "Every crypto-funded purchase is a CRA barter disposition and is a taxable event.",
            "For LAND specifically this is the only lawful path — Alberta lawyers cannot hold crypto in trust.",
        ]
    return Route(
        rail=rail, supplier_key=s.key, amount_cad=round(amount, 2),
        fee_pct=pct, fee_cad=round(amount * pct, 2),
        settles_in=when, recipient_gets=gets, steps=steps,
        executable=False,
        caveats=caveats + [f"Fee basis: {basis}.",
                           "Route modelling only — no integration is live yet."],
    )


def routes_for(supplier: Supplier, amount_cad: float) -> list[Route]:
    """Every viable path from X Layer USDC to this supplier, cheapest first."""
    rails: list[Rail] = []
    if supplier.accepts is Accepts.USDC_XLAYER:
        rails = [Rail.DIRECT]
    elif supplier.accepts in (Accepts.USDC_OTHER_CHAIN, Accepts.CRYPTO_GENERIC):
        rails = [Rail.CCTP, Rail.FIAT_OFFRAMP]
    elif supplier.accepts is Accepts.GIFT_CARD:
        rails = [Rail.GIFT_CARD, Rail.FIAT_OFFRAMP]
    else:
        rails = [Rail.FIAT_OFFRAMP, Rail.GIFT_CARD]
    out = [_route(r, supplier, amount_cad) for r in rails]
    return sorted(out, key=lambda r: r.fee_pct)


def suppliers_for(tags: list[str]) -> list[Supplier]:
    t = set(tags)
    return [s for s in SUPPLIERS if t & set(s.tags)]


class ProcurementLine(BaseModel):
    item_key: str
    label: str
    amount_cad: float
    candidates: list[Supplier]
    best_route: Route | None
    alternatives: list[Route] = Field(default_factory=list)
    unrouted_reason: str | None = None


class ProcurementPlan(BaseModel):
    total_cad: float
    total_fees_cad: float
    lines: list[ProcurementLine]
    root: str = Field(
        default=f"USDC on X Layer (chain {XLAYER_MAINNET_CHAIN_ID})",
        description="The single funding source for the entire pipeline.",
    )
    rails_used: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


def plan(items: list[tuple[str, str, float, list[str]]]) -> ProcurementPlan:
    """items = (key, label, amount_cad, supplier_tags)."""
    lines: list[ProcurementLine] = []
    fees = 0.0
    total = 0.0
    rails: set[str] = set()

    for key, label, amount, tags in items:
        cands = suppliers_for(tags)
        total += amount
        if not cands:
            # THE INVARIANT HOLDS EVEN HERE. "No named supplier yet" must never
            # mean "not payable from X Layer USDC" — the fiat off-ramp reaches
            # any vendor that takes CAD, which is all of them. So an unnamed
            # line still gets a real route, flagged as supplier-TBD.
            placeholder = Supplier(
                key=f"tbd_{key}", name=f"Supplier TBD ({', '.join(tags) or 'general'})",
                tags=tags, accepts=Accepts.FIAT_ONLY,
                note="Not yet named. Routes via the off-ramp like any CAD vendor.",
            )
            r = _route(Rail.FIAT_OFFRAMP, placeholder, amount)
            r.caveats.insert(0, "Supplier not yet named — rate is the generic off-ramp spread.")
            fees += r.fee_cad
            rails.add(r.rail.value)
            lines.append(ProcurementLine(
                item_key=key, label=label, amount_cad=round(amount, 2),
                candidates=[placeholder], best_route=r,
                alternatives=[_route(Rail.GIFT_CARD, placeholder, amount)],
                unrouted_reason=None,
            ))
            continue
        rs = routes_for(cands[0], amount)
        best = rs[0]
        fees += best.fee_cad
        rails.add(best.rail.value)
        lines.append(ProcurementLine(
            item_key=key, label=label, amount_cad=round(amount, 2),
            candidates=cands, best_route=best, alternatives=rs[1:],
        ))

    return ProcurementPlan(
        total_cad=round(total, 2),
        total_fees_cad=round(fees, 2),
        lines=lines,
        rails_used=sorted(rails),
        notes=[
            "Every line is payable from ONE USDC balance on X Layer. Bridges convert "
            "to what each recipient needs; the user never holds a second currency.",
            "Native USDC only — never bridged USDC.e.",
            "No integration is live: routes are modelled, not executable. Phase 1 in "
            "docs/PHASED-ROADMAP.md is the first real settlement, with a named retailer.",
            "Land is deliberately excluded from the direct rails: it is a deed in a "
            "government registry, so the deposit escrows on-chain and the closing "
            "executes through a lawyer in fiat.",
        ],
    )
