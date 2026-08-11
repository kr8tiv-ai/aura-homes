# Where we are vs where you said you want to be

*Written Aug 10, 2026. The vision column is the founder's own words, not a
paraphrase and not the assistant's suggestions back to him. The "where we are"
column is grounded in the repo — every claim names the file that proves it, so
this document can be checked rather than believed.*

---

## The vision, in your words

1. **"I would want to make the platform open source and have some sort of like
   ownership model to reward token holders."**
2. **"It has to be something that's a no-brainer for people. I don't want to be
   taking $10,000 out of their bill."**
3. **"Finding ways to be able to take small percentage of transfers that are
   going through the platform somehow that makes sense as a model."**
4. **"It also has to reward people — they have to have benefits from the
   platform."**
5. **"Maybe that's a SaaS model on top of the token and the token is kind of
   quiet."**
6. **"It's just build a platform, I make the token. I hope that I win the OKX
   grant from the hackathon and I just do my best and we see what happens."**

Point 6 is the operative one and it reorders everything else: **the grant is
the decidable prize, the token is not.** Token mechanics are now out of the
product and off the website.

---

## Where we actually are

| Vision element | Status | Evidence |
|---|---|---|
| Open source | **DONE** | MIT from the first commit, whole repo public |
| A platform worth owning | **PARTLY** | Land filter, budget model, design engine, escrow + registry contracts all real |
| Small % of transfers through the platform | **NOT BUILT — nothing at all** | `AuraBuildEscrow.sol` has **no fee mechanism**. Its only bps constant is `DEFAULT_HOLDBACK_BPS`, the statutory 10% holdback, and that money returns to the homeowner. Aura takes zero. |
| Don't gouge the homeowner | **TRUE BY DEFAULT** | Because nothing is charged to anyone, anywhere |
| Reward the people who use it | **NOT BUILT** | No accounts, no benefits, no fee waivers, nothing to hold |
| SaaS on top | **NOT BUILT** | No subscription, no contractor tooling in this repo |
| Charge the supply side | **NOT BUILT** | `data/suppliers.json` exists as sourcing data; there is no directory, no placement, no order routing |
| Stays network | **NOT BUILT** | Zero occurrences of stay / booking / host anywhere in the codebase |

### The single most important line in this document

**The platform has no revenue surface. Not one.** There is no price on
anything, no checkout for anything except the home itself, and no fee field in
any contract. Every income idea discussed — supply-side placement, escrow
release fees, plan sets, feasibility reports, contractor SaaS, stays
commission — is at zero, and most are at zero lines of code.

That is not a criticism of the build. The build went into the hard part: the
land constraint engine, the Alberta cost model, the design engine that emits
real dimensioned drawings, and escrow that models statutory holdback on-chain.
Those are the parts that are hard to fake and hard to copy. But it does mean
the thing you described — *a platform that pays for itself by taking a little
from the supply side and giving benefits back to the people who use it* —
currently exists only as intent.

---

## The gap, item by item

**1. Revenue capture: 0 of 5 streams exist.**

| Stream | Vision | Today | Distance |
|---|---|---|---|
| Design packages | Sell the design output directly | The engine **already generates** dimensioned SVG/PDF/DXF at 1/4"=1'-0" | Closest. Needs hosting + a price + a checkout |
| Parcel feasibility reports | $250–600 per parcel | The land filter **already produces** the bylaw/aquifer/septic verdict | Second closest. Same three things |
| Supply-side placement | 2–3% when a contractor wins work | `suppliers.json` is sourcing data, not a directory | Needs the Locality Hub |
| Contractor SaaS | Monthly per contractor | Not in this repo | Furthest |
| Escrow release fee | Small flat, waivable | No fee mechanism in the contract at all | One contract change, but changes the audited surface |

The two nearest are near because **the work is already done and unsold.** The
design engine and the land filter each already produce the exact artifact that
was described as sellable. What is missing in both cases is identical: somewhere
to host it, a price, and a way to pay.

**2. The ownership model has no non-token form yet.**
The vision's reward mechanism was holder benefits. With the token off the
table, "reward the people who use it" needs a different expression — earned
credit, contributor standing, founding-user status, revenue share to
contributors. None of that is designed. This is the open question the token was
answering, and removing the token leaves it open rather than solved.

**3. Sequencing: the capital-heavy arc is the entry point.**
The site's arc one is buying a whole home — the highest-capital, longest-cycle,
hardest-to-close product in the entire vision. Everything identified as
cash-generating (design packages, feasibility reports, and the stay network,
which needs no building at all) sits behind it or is absent. The order is
inverted relative to the vision.

**4. What the site now says.**
Token copy is removed everywhere (roadmap arc, story rollout line, FAQ entry,
page descriptions). The FAQ answers "How does Aura make money?" with the
supply-side model — which is honest as a statement of intent, and is currently
ahead of the code. That is a promise the build has 11 days to stop being
embarrassed by, or it should be softened.

---

## What this means with 11 days left

The grant is judged on a working product and on-chain data — not on a business
model. So the ranking is not "build the revenue model"; it is:

1. **Make one purchase run end to end on X Layer, on real testnet, no fixtures.**
   This is what a judge checks in the explorer, and it is the difference between
   a mockup and a product.
2. **Host the design engine.** It is built, it works offline-deterministically,
   and right now the live site says "service unreachable". This is the single
   biggest gap between how good the site looks and what it does.
3. **Solve testnet USDC for judges.** They cannot currently obtain any, which
   means they cannot try the flow no matter how well it works.

Revenue surfaces are a post-August-21 job — with the exception that hosting the
design engine (2) is *also* the first revenue surface, because a hosted design
engine with a price on the PDF is the plan-set business. That is the one item
that serves both the grant and the model, so it is the highest-leverage thing
on the list.
