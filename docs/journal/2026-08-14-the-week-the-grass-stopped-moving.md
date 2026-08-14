# The week the grass stopped moving

*Notes from the Aura Homes workshop — August 14, 2026*

A few days ago the meadow on our landing page stopped moving.

Not dramatically. If you'd never seen it before you probably wouldn't have
noticed anything wrong. The grass was there, the light was right, the cabin sat
where it always sits. It just stood perfectly still, like a photograph of a
field rather than a field.

We'd upgraded the scene. The new grass looked better than the old grass — denser,
softer, better colour. And somewhere in the upgrade, the wind had been switched
off without anyone deciding to switch it off.

That's most of what this week has been about, honestly. Not the big new thing.
The gap between what we thought was true and what was actually true.

---

## Three reasons, stacked

The wind turned out to be dead for three separate reasons at once, which is why
it took a while to find. Fixing any one of them would have changed nothing.

The scene had been told to only draw a new frame when something happened —
sensible, until nothing is happening, at which point a meadow in a breeze
qualifies as "nothing." Then a check for low-powered devices was quietly
freezing the plants for anyone on Firefox or Safari, because it depended on a
browser feature those browsers don't report. And the grass you actually see —
3,600 baked cards, the bulk of the field — had no wind in its shader at all. It
had never been given any. The blades behind it swayed beautifully and nobody
could see them.

So: wind on the cards, the clock unfrozen, the device check corrected. The look
we'd upgraded to stayed exactly as it was. It just breathes now.

Then we did the part that matters more, which was to make this specific failure
impossible to repeat quietly. There's now a check that takes two frames of the
real page 1.2 seconds apart and compares the pixels in the meadow. If they're
identical, the build fails. You can't argue with it, you can't reason around it,
and it doesn't care how good the code looks.

We ran it against a deliberately broken version first, to be sure it could fail.
A test that can't fail isn't a test, it's decoration.

---

## Grass through the deck

While we were in there: the plants had been growing up through the front steps.

You could see them standing through the first tread, which is the kind of detail
that makes an otherwise careful scene feel like a video game. There was netting
coming through the deck boards too.

The cause was the same shape of problem as the wind. The map that tells the
grass where it isn't allowed to grow, and the meshes that draw the deck and the
steps, were two separate sets of numbers describing one place. They'd been
edited apart. The deck got wider at some point; the exclusion zone didn't.

They're one set of numbers now. And the test that guards it doesn't check
whether someone retyped a literal — it samples the actual ground under the
actual mesh outlines and fails if any of it is open meadow. A step that grows
past its clearance now breaks the build whether or not anybody copied a number.

We found four more disagreements of the same kind while we were in there, and
this is the part I want to be straight about: we didn't fix them all. Two of
them are harmless today and would move visible geometry to reconcile. So they're
written down, in the code, with both numbers and the reason nobody touched them.
The fire pit's mask and the fire pit's stones are 32 cm apart. It doesn't matter
yet. It's exactly how the deck looked before it mattered.

There are, it turns out, two entire staircases at our front door. Three treads
in one file, five in another, both rendering at the same time in the same place.
Neither of us put them there on purpose. Reconciling them changes what you see,
so that's a decision for a person, not a cleanup — and until someone makes it,
there's a test that states the disagreement in plain numbers so it can't be
forgotten a fourth time.

---

## $HOMES went live

The token is live on X Layer, a low-fee network built by OKX. It launched
through XLaunch on August 13.

The site now says so, with the contract address, the pool, and links out to the
explorer so you can check any of it without taking our word for anything. There's
a plain-language guide for buying and bridging, written after actually walking
through the flow rather than from memory of how these things usually work.

What we've been careful about is what the token *isn't*. It's live. The planned
HOMES structure — the thing where a house's guests and owners share in it — is
still planned. Staking is planned. The property side is planned. The escrow work
lives on the X Layer testnet lab and is experimental, and it says so on every
surface it appears.

The launch was small, on purpose, at the experiment tier. We say the market cap
out loud rather than rounding it into a shape that sounds better. And the venue's
swap fees accrue to a wallet whose address is published on the site; they'll be
reported as claimed when there are actual receipts to point at, and not before.

There's no return language anywhere near it, and there won't be.

---

## The unglamorous half

The rest of the week was the stuff that doesn't screenshot well.

**The builder holds your project properly now.** There's one strip across every
page that tells you what stage you're at, what's blocking you, and the one next
thing worth doing. If your browser runs out of storage, it says so in words and
gives you a way out instead of silently failing to save.

**The model stays on screen while you work.** It used to disappear behind panels
on half the steps, which is a strange thing to do to somebody designing a house.
While testing that, we found the layout dragged sideways on a phone — a stale
width on a hidden canvas — and fixed it.

**Costs and readiness update as you edit.** Low, mid, high, from the same
calculation the budget page uses. Not a second one that would eventually
disagree. And it separates "this is design intent" from "this is ready for a
professional to look at," naming the specific gaps rather than showing a score.

**Cost data beyond one county.** Baked from free public sources, every figure
carrying where it came from. The brief for that job named a Statistics Canada
table — and the table turned out to be archived, replaced two years ago. Baking
it would have shipped stale numbers under a fresh date. It got caught because
somebody checked the source instead of trusting the instruction, which is the
behaviour I'd most like to keep.

**The models are half the size.** 604 KB down to 296 KB across six files, with
every material name, mesh name and triangle count verified unchanged. The
aggressive setting saved 6 KB more and quietly recoloured the pine trees. We
took the 6 KB loss.

**One handoff package.** A drafter or engineer can be handed a single artifact
with the drawings, the cost snapshot, the honest limitations, and a hash that
proves it describes the design it says it does.

---

## Three audits, and one we failed

We've been running fresh-context audits — handing the work to someone with no
memory of writing it and asking them to grade it. Three this week. They found
seventeen things between them.

Most were small. One wasn't, and it's worth telling on ourselves about.

Seven of our fourteen execution records still said "ready" while the code they
described was live on the site. Nothing was lost. But an open record's
conditions never get re-read, and that's precisely how one node shipped against
a scope an earlier audit had already flagged as wrong. Bookkeeping stopped being
a control and became decoration, which is a slower and more embarrassing failure
than a bug.

Then an outside technical audit landed today and caught something sharper: our
own deployments document still read *"Aura remains testnet-only… no HOMES
token"* — a full day after the token went live and the rest of the site had been
updated. We'd corrected eleven surfaces and missed the twelfth.

It's fixed, and the fix explains the distinction rather than papering over it:
the token is live, we didn't write it, none of our own contracts is on mainnet,
and those are three different facts. A gate that compares deployment claims
against reality at release time is now on the list.

For a project whose entire pitch is that claims carry evidence, contradicting
yourself in your own documentation is the failure that actually stings.

---

## Where this is going

We're building toward the OKX BuildX AI Season deadline on August 21. One week.

The shape of the thing: describe the home you want, get a real editable model
rather than a brochure, check it against a real piece of land, see what it might
cost with every number traceable, and walk away with a package a professional
can actually use. Your project stays in your browser. You never need crypto to
use any of it.

That last part isn't a hedge. The design tools work with no wallet, no account,
and no connection, and we'd like to keep it that way even as the token side gets
more interesting.

Between now and the 21st: precise editing with a keyboard rather than only a
mouse — an accessibility gap an audit named this morning and we're not going to
pretend is fine. Section cuts and floor isolation in the viewer. A cleaner
read-only view on a phone with a dimensioned plan you can actually reach on a
site visit, which turns out to exist already and simply be unreachable in the
mode most people land in.

All of it is open source and all the working documents are in the repository —
the plan, the audit log, the decisions, and the record of what we got wrong. The
last one is the most useful and the least common.

Watch the grass move: **[aurahomes.fun](https://aurahomes.fun)**
Read the code: **[github.com/kr8tiv-ai/aura-homes](https://github.com/kr8tiv-ai/aura-homes)**
