# Most "design your dream home" tools hand you a brochure. We hand you the file.

*Aura Homes — what we're building, where the token fits, and what shipped this week*

---

Aura Homes is a free, open-source tool for people who want to build a house and
have no idea where to start. You describe what you need — how many bedrooms, what
climate, roughly what budget — and you get back an actual editable 3D model of a
home, a plan you can change room by room, a cost range where every number tells
you where it came from, and a package you can hand to a real architect, engineer,
or builder. It runs in your browser. No account, no signup, no wallet required.

The people we're building for are the ones the industry currently ignores. Not
developers putting up forty units. The couple with five acres outside Edmonton
who've been quoted three wildly different numbers by three builders and can't
tell which one is fair. The person who wants a small, well-insulated, low-energy
house and keeps getting shown 3,000 square feet of vinyl. Anyone who's been told
"we'll figure out the budget later," which is where most of these projects
quietly die.

Here's the gap we're aiming at. There's plenty of software for professionals —
serious CAD and BIM tools that assume you already know what a wall assembly is.
And there's a lot of consumer software that's really just a mood board: you drag
a sofa around, it looks nice, and none of it survives contact with a builder.
Almost nothing sits in between and takes an ordinary person seriously.

So that's what we're making. Something that's genuinely easy on the first day and
still honest on the ninetieth — the day someone actually prices it.

The whole thing is built around one idea: **one document, all the way through.**
The model you rotate, the floor plan you edit, the cost estimate, the drawings,
the export files — they're all generated from the same design data. Change a wall
and everything downstream changes with it. That sounds obvious. It is not how
most of this software works, and it's why people end up with a beautiful render
that no one can build.

We're also strict about one thing that costs us marketing copy: we label what's
real. An estimate says it's an estimate. Something planned says planned. If a
check hasn't been run, the tool says "not modelled" instead of showing you a
plausible-looking number. You can't make good decisions about the largest
purchase of your life on top of numbers that quietly made themselves up.

---

## Where the token comes in

**$HOMES is live** on X Layer — a low-fee network built by OKX — at
`0x642855d557ada1eba8a66014aaff902e6394c0de`. It launched through XLaunch on
August 13. The liquidity is held in XLaunch's locker, and the contract, pool, and
explorer links are all published on the site so you can check any of it yourself.

The longer-term idea is one we describe in plain words: an Airbnb its guests and
hosts own. Homes that get built through the platform, held in a structure where
the people who stay in them and the people who run them have a real stake, with
every inflow and outflow visible on a public ledger instead of in someone's
spreadsheet.

That structure is **planned.** So is staking. So is the property side. The escrow
contracts — deposits, refund windows, milestone releases — exist and run on the
X Layer testnet lab, which is **experimental** and clearly marked as such
everywhere it appears. The fee wallet address is published, and fees get reported
as claimed only when there are actual receipts to point at.

We're deliberate about that split because it's the part everyone gets wrong. The
token is real and live today. The structure around it is being built in the open,
one verified piece at a time, and we'd rather say so than imply otherwise.

And you never need any of it. The design tools work with no wallet, no account,
and no connection. The crypto side is one layer deep, entirely optional, and
never in your way.

---

## What shipped this week

The last few days have been dense. Some of it in plain language:

**The home stays on screen while you design it.** The 3D model used to disappear
behind panels on half the steps, which is a strange thing to do to someone
designing a house. It's now pinned beside your controls the entire way through.

**Costs move as you edit.** Low, mid, and high figures update live while you
change the design, drawn from the same calculation the full budget page uses — so
the two can never drift apart and disagree. Every line traces back to a source.

**Your plot of land is in the model now.** Give it a real parcel and the site plan
draws your actual lot lines, checks whether the home fits inside the buildable
area after setbacks, and slopes the ground under the house. The foundation piles
get individually measured for the grade.

**Cost data beyond one county.** Regional figures baked from free public sources,
each one carrying its citation. While building it we discovered the government
data table we'd planned to use had been archived and replaced two years ago — so
we used the live successor and wrote a check that refuses to run if it ever goes
stale again.

**One package for your builder.** A single artifact holding the drawings, the
cost snapshot, the honest limitations, and a fingerprint proving it describes the
design it claims to. Hand it to a drafter and they have what they need.

**A guided mode that explains itself.** Every suggestion comes with one sentence
saying why, and where the rule came from — Alberta's building code, the climate
zone, the local minimum lot rules.

**The landing scene got its wind back.** Our 3D meadow had quietly frozen during
an upgrade. It moves again, the grass no longer grows through the front steps,
and there's now an automated check that compares two frames of the real page and
fails the build if the field is standing still.

**And the models are half the size** — 604 KB down to 296 KB — with every material
and triangle verified unchanged.

---

## What we're building next

We work from a public engineering graph — a live map of every piece of the system,
what it depends on, and what has to be proven before it counts as done. It's in
the repository. Anyone can read it. Right now the queue looks like this:

**Precision editing with a keyboard.** Today you move walls with a mouse. That's
a real accessibility gap and a speed problem for anyone doing serious work — so
arrow keys, exact numeric fields, and a proper object inspector are next.

**Better tools for looking at your house.** Section cuts so you can slice through
the model, isolating one floor at a time, and quick material swaps.

**A proper phone experience.** A clean read-only viewer and a fully dimensioned
floor plan you can pull up standing on the site. The plan already exists — it's
just buried where most people never find it.

**Direct manipulation.** Grab a corner of the building in 3D and pull it, with the
numeric fields staying in sync as the precise way to do the same thing.

**A design assistant that never acts alone.** It can read your project, suggest
changes, and explain trade-offs — but nothing it proposes touches your design
without you confirming it. Every suggestion carries its evidence.

**Professional file parity.** Making sure the IFC and DXF exports carry the full
detail of the newer geometry, verified by reading our own files back in
independent open-source BIM tools rather than trusting our own exporter.

---

We're building toward the **OKX BuildX AI Season** deadline on August 21.

Everything is open source under MIT, including the plan, the audit log, and the
decision records. If you want to see how it's made, it's all there.

**[aurahomes.fun](https://aurahomes.fun)** · **[github.com/kr8tiv-ai/aura-homes](https://github.com/kr8tiv-ai/aura-homes)**
