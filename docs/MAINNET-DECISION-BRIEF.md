# Mainnet decision: hold until the registry is redesigned

**Decision recorded August 12, 2026:** do not deploy the current
`AuraBuildRegistry`, a fee router, or any HOMES contract to X Layer mainnet
196 for the hackathon. The deployed X Layer testnet contracts remain an
isolated proof lab.

This decision protects the product's strongest claim: Aura labels prototypes
as prototypes. A mainnet address would not make the current registry safe,
useful, or production-ready.

## Current chain state

- X Layer testnet 1952 contains the lifecycle proof contracts listed in
  [`DEPLOYMENTS.md`](DEPLOYMENTS.md)
- X Layer mainnet 196 contains no Aura contract
- The testnet lab holds tokens with no monetary value and is not an Aura
  escrow service
- No HOMES token, property vehicle, property, staking position, distribution,
  fee router, or launchpad contract exists

## Why the current registry cannot ship to mainnet

The existing contract is useful for a constrained testnet demonstration. It
has five blockers for production use:

1. **Authorization can be spoofed.** `mint()` accepts a caller-supplied
   escrow address. `_requireAuthorized()` trusts that address's
   `homeowner()` response. An attacker can deploy a contract that returns the
   attacker's address and mint arbitrary Aura records.
2. **Lifecycle state can move backward or skip steps.** `updateStatus()`
   accepts any enum value without enforcing a transition policy.
3. **Metadata remains mutable.** An authorized account can replace a token's
   URI after minting. The contract does not bind URI revisions to immutable
   content hashes.
4. **Record ownership and update authority can diverge.** Transferring the
   ERC-721 token does not transfer the linked escrow's homeowner authority.
   The token owner may be unable to update the record while another account
   retains that power.
5. **Administrative controls need production design.** A single owner can add
   registrars. There is no multisignature requirement, delay, scoped role, or
   emergency governance process.

Deploying unchanged code would create a mainnet claim that Aura cannot defend.
The absence of custody does not remove authorization, integrity, operational,
or reputational risk.

## Requirements for a replacement attestation contract

A new contract should be designed for attestations rather than repurposing
the testnet escrow registry. Before deployment it must include:

- trusted project creation through an allowlisted factory, signed payload, or
  another authorization scheme that does not trust an arbitrary callback
- explicit, monotonic lifecycle transitions with correction and revocation
  events instead of silent state rewrites
- immutable design and budget hashes, plus versioned metadata updates that
  preserve history
- a clear relationship among the project sponsor, record holder, reviewer,
  and Aura operator
- scoped roles behind a multisignature wallet and an operational incident plan
- replay protection, domain separation, chain-aware signatures, and tests for
  adversarial contracts
- unit, fuzz, and invariant tests followed by an independent security review

The replacement should attest only to facts Aura can prove. A document hash
detects a changed file. It does not prove that a document is truthful, that a
home exists, or that work passed inspection.

## HOMES is a separate decision

The registry decision does not authorize a HOMES token or property funding
structure. Before any live token, fee distribution, staking, rental-profit
payment, or property participation, the project needs:

- a defined legal vehicle and jurisdiction for each property
- counsel on the rights and economics, regardless of the language used in
  marketing copy
- participant eligibility, disclosures, custody, accounting, tax, and
  wind-down rules
- named multisignature signers and a funded incident-response plan
- finalized liquidity, market, fee, and treasury policies
- independently reviewed contracts and a staged deployment plan

The pairing idea involving a SPACEX-named token remains unverified. Aura must
not imply affiliation, liquidity, venue support, or even the correct contract
until each fact has a dated primary source.

## Hackathon position

Use the deployed testnet lab to demonstrate X Layer integration. Show a live
read and an OKLink receipt, then state its limit: it proves that the mechanism
runs on testnet, not that Aura offers escrow or that physical work occurred.

Do not deploy a registry solely to claim mainnet coverage. If the submission
form appears to require mainnet, verify the exact rule with the organizers and
describe the testnet scope accurately.

## Revisit criteria

Reopen the mainnet decision only after:

1. the hackathon release is stable and the core project journey works
2. the replacement attestation contract has a written threat model
3. roles, state transitions, metadata policy, and governance are approved
4. automated security tests pass
5. an independent reviewer signs off on the deployable bytecode
6. the founder approves the purpose, cost, rollback plan, and operational
   owner

Until then, the decision is **hold**.

---

## Addendum — August 13, 2026: the founder launched HOMES on a third-party venue

**What happened.** The founder launched the HOMES token on XLaunch
(xlaunch.fun), a permissionless launchpad on X Layer mainnet 196. Token:
Aura Homes ($HOMES), contract
`0x642855d557ada1eba8a66014aaff902e6394c0de`, paired against wrapped SpaceX
(wSPCXx), pool `0xf59d07dfe38807b398f0b4697f187d2f943b06a4`, liquidity locked
in XLaunch's locker contract with no withdraw path. Founder-confirmed via the
token page URL; independently corroborated by the page's links back to
x.com/AuraHomes_fun and aurahomes.fun.

**What this changes.** The token exists and trades, so the site's
"no token contract" zero-states are flipped to live-state receipts with the
address, venue, pool, and honest risk labels (micro-cap, unaudited
permissionless factory, wrapper-stock quote asset that its issuer can pause).
XLaunch's venue mechanics also make two previously proposed numbers real:
the 2% launch-window wallet cap is venue-enforced (~6 minutes), and the
venue's 1% swap fee routes 60% of the quote side to the creator wallet —
a real, claimable fee source whose claim wallet and receipts must be
published before any amount is recognized in the ledger.

**What this does NOT change.**

- The registry/escrow hold above stands in full. Nothing in this addendum
  deploys Aura-authored contracts to mainnet; the five blockers are untouched.
- The token was minted by XLaunch's factory on venue infrastructure — it is
  not the audited, vesting-governed, treasury-multisig token architecture
  this brief requires before HOMES carries designed rights. No staking,
  distribution, property vehicle, trust, or payout exists.
- The supply/vesting design (30/10/10/20/30) describes the DESIGN, not the
  live mint. The live token's actual distribution must be verified on-chain
  and labelled accordingly until reconciled.
- The earlier "SPACEX pair blocked until verified" policy was superseded by
  the founder's launch decision; the live pair is disclosed with the wrapper's
  risks rather than implied to be an endorsement or affiliation.
- H20-style external gates (legal opinion, securities route, audits, capital)
  still stand between this experiment-tier token and any value-bearing HOMES
  system. The launch sits at the site's own "Experiment" budget tier —
  "suitable for testing mechanics, not meaningful price discovery" — and the
  site says so next to the buy path.
