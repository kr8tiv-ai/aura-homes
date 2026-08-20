# Dev update — X post draft, August 15 2026

Plain language, no embellishment. Numbers are the ones the runners actually
printed. Written as a thread; each block is one post.

---

**1/**

Dev update — Aura Homes.

Aura is an open-source tool for designing an eco home. Draw it, see it in 3D,
get real Alberta cost bands and a drawing set you can hand to a builder. It runs
in your browser and the project never leaves it. No account, no fee.

This week the editor got the thing people kept asking for.

---

**2/**

Windows and doors are now editable three ways: drag a grip on the wall in 3D,
drag a handle on the floor plan, or type the number. All three write the same
edit and cost one undo step.

If a change would break the wall — a header running out of wall, two openings
cut into the same piece of it — it stops and prints which rule it hit. It does
not silently move the change to something that fits.

---

**3/**

Variations. Take the home you have and look at other versions of it, sitting
beside the plan library rather than in a mode of its own.

Every variant is a real document. It opens, it costs, it exports, it hashes.
Nothing here is generated.

---

**4/**

A walkthrough. Stand inside the home instead of orbiting it.

The viewpoints are not hand-placed. They are computed from the building's own
bounds and ridge height, so the camera frames the whole house whatever you
designed — the stand-off distance comes out of a real camera frustum, not a
number somebody picked.

---

**5/**

Impact compare. Two versions of the design side by side, with what actually
changed between them.

It also names what Aura does **not** model — daylight autonomy, energy use
intensity, heating load — in rows of the same table rather than in a footnote at
the bottom. A test rejects any result-shaped number appearing in those rows, so
"not modelled" cannot quietly grow a figure.

---

**6/**

A co-pilot. Deterministic: no model call, no API key, nothing leaves your
browser.

It reads your design against things this codebase genuinely computes — glazing
against the NBC 9.36 prescriptive reference, footprint against your lot, cost
against your stated cap — and proposes edits with the figures it read printed on
the card. It never applies anything without you confirming.

Honest note: on the default design it has nothing to say, because that design
breaches nothing it can measure. It says so rather than inventing advice.

---

**7/**

The new tests found five real bugs this week. Posting them because the bugs are
more informative than the features:

- the walkthrough dropped your first move if you pressed it before the 3D view
  finished loading
- its own test file had eight assertions that had never executed once — listed,
  counted, green, running nothing
- the openings panel asked the browser window for its width when its width came
  from a column, so at 1440px the numbers ran into the labels
- a test checking "does the site publish the right plan count" was satisfied by
  a video timestamp reading 72-84s
- a locator had been passing for months by accident

Gates now: 559 unit specs and 120 UI specs against a fresh static build.

---

**8/**

Next up: land. You cannot pick a plot yet and the reason is worth saying
plainly.

The picking machinery is real and works end to end — choose a parcel and the
builder re-checks your exact design against it. It just has nothing real to
pick. The only parcels in there are four demonstration records, and the 156
Edmonton zoning districts we baked in are rules, not lots. A zoning district
does not know the size of your yard.

---

**9/**

The honest fix is two things: let you state your own lot, and bake the City's
open property register so a real address resolves to a real zone and a real lot
area.

What we will not do is pretend we have listings. Free, legal, redistributable
listing data does not exist in Canada — active MLS needs a broker relationship.
A property register says who owns what; it never says what is for sale, and we
are not going to dress one up as the other.

---

**10/**

Also in build: more flat-roof, glass-led models.

The library is 72 plans, but measured by roof form it still skews gable — 39
gable, 36 shed, 21 flat — and only nine read as glass-led. The engine already
supports flat roofs and full-height glazing, so this was never a limitation.
Nobody had drawn them.

The constraint being designed against: this is Edmonton, 53.5° north. A glass
wall facing north is a heat-loss problem, so the glass goes south and into
sheltered courts, with overhangs sized to shade in summer.

---

**11/**

Open source, MIT: github.com/kr8tiv-ai/aura-homes
Live: aurahomes.fun
$HOMES is live on X Layer.

Built for OKX BuildX AI Season. Submission is the 21st.
