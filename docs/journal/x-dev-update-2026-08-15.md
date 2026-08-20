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

Gates now: 664 deterministic specs and 132 browser specs against a fresh static
build, plus the typecheck.

---

**8/**

Land works now. You can state your own lot on /land — frontage, depth, setbacks,
which way the front faces — press one button, and the builder checks your actual
design against your actual rectangle. A 44 × 130 lot with 25/10/25 setbacks
gives a 24 × 80 buildable envelope, and the fit check says whether the home you
drew goes in it.

Before this, the picking machinery was real and had nothing real to pick.

---

**9/**

There is a live lookup too. Type an Edmonton address and the City's own property
register answers with the real lot area and the real zone code — on a button
press, never on load, and the page says where your typed address goes.

What we will not do is pretend we have listings. Free, legal, redistributable
listing data does not exist in Canada. A property register records who owns what
and never what is for sale.

---

**10/**

The library is 87 plans. The newest 15 are flat-roofed and glass-led.

Getting them in was the interesting part. They passed every geometric gate —
zero overlapping openings, the real engine returning zero warnings where the
existing plans return forty — and then failed an honesty review on eleven
counts. One put 41% of its glass on north walls and never used the word "north"
anywhere in its record.

No automated gate could see it, because every plan discloses its glazing ratio
correctly and a ratio is orientation-blind. There is a gate for it now: if a
material share of your glass faces away from the sun, the plan has to say so.

---

**11/**

Two things we found in our own code this week, worth passing on.

Glazing was priced per window. Every non-door opening counted as one unit, so a
306 sq ft glass wall priced the same as a 4×4 casement — roughly a nineteen-fold
understatement, in the direction that hurts somebody planning a build. It is
priced by area now, from the same sourced band, with the arithmetic printed in
the bill of materials.

And a nineteen-commit wave passed its entire test suite while `tsc --noEmit` was
red the whole time. Playwright transpiles each spec and never typechecks the
project. One of those errors was a hipped roof cast into a type that has no hip
— a real approximation somebody owed the reader, silenced by a cast. The
compiler runs inside the gate now, and the drawing set says when a hip is drawn
as a gable.

---

**12/**

Open source, MIT: github.com/kr8tiv-ai/aura-homes
Live: aurahomes.fun
$HOMES is live on X Layer.

Built for OKX BuildX AI Season.
