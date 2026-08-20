# I just wanted to build a house

*Notes from the Aura Homes workshop — August 19, 2026*

The honest origin story is not very impressive.

I wanted to build my own house. Not buy one. Build one — pick the land, pick the
shape, know what it costs before someone in a truck tells me what it costs. And
every time I went looking for software that would let me do that, I found either
a toy that produced a pretty picture with no numbers behind it, or a professional
package that assumed I already knew what a rim joist was and cost more per month
than my phone.

So I built the thing I wanted. That's it. That's the whole beginning.

The part I didn't expect is that I've been circling this for five years, and it
was never really about the software.

---

## What I actually want to do with my life

I love making places people remember.

I've spent years planning trips for friends in Costa Rica — I know the country
well enough that people just ask me now, and I get a genuine kick out of it. Not
the logistics. The moment where someone tells you afterwards that a particular
morning was the best morning they'd had in years, and you know exactly which
morning, because you picked it for them.

That's the thing. That's what I want to do. Unique stays. Places that are worth
travelling to, in the places worth travelling to, run by people who care whether
you liked it.

I live in Canada, which makes the Costa Rica obsession a running joke with
everyone who knows me. But it's the same instinct in both directions: I think
most people are spending too much of their life indoors, in cities, in rooms that
were designed to be efficient rather than good. And I think a surprising number
of them would leave if the leaving were less frightening — if you could see the
house, and see the land, and see the number, before you had to commit to any of
it.

So the grandiose version of the plan, since you asked: I'd like to change how
people think about where they live. Get outside more. Get out of the city if
that's what you want, and know what it costs before you decide.

The un-grandiose version: I needed software that didn't exist, so I made it.

---

## The other reason

There's a second motive and I'd rather say it than have someone work it out.

I wanted to know how far you can push modern AI at something genuinely hard.

Not "write me a landing page." Architecture. Geometry that has to close. Costs
that have to reconcile. Building code that doesn't care about your vibes. A roof
that has to actually meet the walls, and a window that can't hang off the end of
the wall it's cut into, and a budget that has to survive someone who builds
houses for a living reading it.

That felt like a real test. Most of what AI gets pointed at is text about things.
This is a thing.

I should be straight about my role in it: **I'm not a programmer.** I don't write
the code. I direct it, argue with it, and say *that's wrong* a lot. Most of my
day is looking at what came back and going *the land page doesn't let me pick
land*, or *these houses all look the same*, or *why is that number so small*.

Then the machine goes off and discovers that windows were being priced by the
each.

I'm not going to dress that up as engineering. It's a strange way to build
software and I'm learning it as I go, the same as everyone else who's found
themselves able to make things they couldn't make two years ago. What I can
stand behind is that the checks are real, the numbers are real, and everything
below actually happened.

---

## The business under it

Aura is the tool. It's free, it's open source, and it's going to stay that way.

The business is the fund.

The plan I've had in my head for five years is to actually build these places —
buy the land, put up the homes, run them as stays, and let the people who care
about them have a stake. Aura exists because you cannot do that at any scale
without a way to design, cost, and hand off a home in a few hours instead of a
few months. The software is the machine that makes the business possible, not the
business.

And it turns out that if you build that machine properly, other people can use
it for their own homes, which is why it's open. I made it for me. I'm reasonably
sure I'm not the only one.

---

## The notes: what actually shipped

Here's the working part of this update, for anyone who cares about the mechanics.
It's mostly a list of things we got wrong, because that's the interesting half.

**The tests were green over code that didn't compile.** We shipped nineteen
commits on the geometry engine with the whole suite passing — six hundred and
sixty-four checks — while the project had eight type errors sitting in it. The
test runner compiles each file on its own and never asks whether the project
holds together. One casualty was a test file whose commit message says the
drawings are checked against the new geometry; that file had never compiled, so
the check it describes was never running. The compiler now runs before a single
test does. **A green test suite is not a green build.**

**A roof with nowhere to go.** Our newer geometry can build a hipped roof — the
kind that slopes on all four sides. Our older one can't. Two places where the new
system hands a building back to the old one answered that question by telling the
compiler to be quiet. That's the part worth sitting with: the error was the code
asking *what happens to this roof?* and someone answering *nothing, ignore it.*
The approximation didn't go away, it just stopped being visible. A hip is drawn
as a gable now, and the drawing says so — because a gable end is full height
where a hip is cut back, so the drawing gives you more headroom than the building
has.

**Windows were priced by the each.** Nine hundred to eighteen hundred dollars
per window, times how many you had. Which means a wall of glass thirty-four feet
across cost the same as the little casement over the kitchen sink. About nineteen
times too cheap, on the most expensive item in a glass-forward house. It's priced
by the square foot now, with the arithmetic printed where you can check it. The
error was in the direction that hurts — it made houses look cheaper than they
are, to people budgeting for the biggest purchase of their lives. **A price per
unit of a thing that varies in size by twenty times isn't a price. It's a
placeholder.**

**Fifteen new houses that nearly didn't ship.** The library went from seventy-two
designs to eighty-seven, and the new ones are flat-roofed and glass-led. They
passed every automatic check we have — cleanest set we've ever produced by the
numbers. Then we read them. One put forty-one percent of its glass on north-
facing walls and never used the word "north," talking instead about the
"sheltered faces." Sheltered from wind is not the same as facing the sun; at
fifty-three and a half degrees north that's a heating bill. No check could catch
it, because every one of those designs states its glazing ratio correctly and a
ratio doesn't know which way it's pointing. Three had their glass moved. Ten had
their sentences corrected. There's a new check now.

**You can pick your land.** For a while the land page had a working button and
nothing real to press it on. Now you state your lot — frontage, depth, setbacks,
which way the front faces — and the builder checks your actual design against
your actual rectangle. Type an Edmonton address and the City's own property
register answers with the real lot area and the real zone code. What we won't do
is pretend we have listings: there's no free, legal feed of land for sale in
Canada, and a property register records who owns what, never what's for sale.

**And one in our own shop window.** Our submission document said the library had
reached seventy-two. It had reached eighty-seven, five days earlier. We have a
check for exactly that, and it passed — because the right number *was* in the
document, in a table two rows above. The stale sentence sat underneath it in the
part people actually read. Third time we've been caught by the same shape of
mistake: a check satisfied by the right answer being *present* rather than the
wrong answer being *absent*.

Then, because the universe has a sense of humour: while writing this, we added
the fix for that, tested it by running that one file directly, and committed it.
Running one file directly is the exact thing that doesn't typecheck. The gate
caught it an hour later. A check written to catch a stale number, shipped through
the hole we'd closed that same afternoon.

I'd love to tell you we're above that. Evidently not, which is rather the point
of having the machinery rather than having good intentions.

---

## On OKX, and why this exists now

I want to say something plainly here, because it's true and it'd be strange not
to.

OKX have been genuinely good to build on. The chain works, the docs are fine,
the tooling didn't fight me. But the real thing is that somebody there decided to
run a season that gives builders a reason and a date. Almost everything in this
project exists because a deadline turned *I should do that eventually* into *that's
due Friday.* I've had this idea for five years. I've had it in a working form for
about six weeks, and the difference was a hackathon.

So yes — we'd like to win something. We'd particularly like the token we deployed
on X Layer to count for something.

But we'd keep going if we placed last, and I want that on the record before the
results rather than after. Hackathons mostly produce demos that evaporate on
Monday. Occasionally they produce something the person who made it can't put
down, where the deadline was the excuse and the thing itself turns out to be the
reason. That happened somewhere around week two. Hackathon or no hackathon, the
show goes on. It just goes faster when someone's watching.

---

## What's next, and how you'd pay for it

There's a category of thing we can't do without a model behind it, and it's the
category people actually want.

A photoreal render of the house you just designed — not a stock photo of
somebody else's house, yours, with the geometry locked so the picture is provably
the building. A tool that reads the quote your builder just emailed you and
checks it line by line against the numbers your design already computed: *this
quote says R-24 and your walls are R-40, this quote has no line for the
ventilation your comfort report assumes, this quote counts nine windows and you
have fourteen.* Point your phone at a house you like and get an editable, costed
model of its shape.

The middle one is the one that matters. What an owner-builder is actually afraid
of isn't picking the wrong roof. It's handing two hundred thousand dollars to a
stranger for work they can't evaluate.

Those run through OpenRouter and inference costs money, so it's a paid tier: top
up with crypto from OKX, spend it on renders and quote checks, and we take a
small margin over what the models actually cost. You'll see the estimate before
the call, not the bill after it. There's also a version where you bring your own
key and it costs you nothing but the tokens — we found that while writing the
plan, and it means the paid tier is the convenient option rather than the only
one.

The rest stays deterministic, and that isn't negotiable. The moment a model picks
a wall thickness, every number in this article stops meaning anything. Models at
the edges. Arithmetic in the middle.

---

## Two funds, one experiment

One more thing we haven't talked about much.

Alongside the token, we're raising a conventional fund. Ordinary money, ordinary
structure, ordinary investors, to build actual houses.

And we're going to run it right next to the decentralized one.

Not as a hedge — as an experiment. Two pools of capital, same mission, same kind
of homes, keeping their books where anyone can compare them. Which one moves
faster. Which one makes better calls. Which one is still standing in three years.
Which one people trust with their money, and why.

I genuinely don't know the answer. There's a version where the decentralized side
is a beautiful mess that can't close on a piece of land, and a version where it
runs circles around the traditional one because it doesn't have to ask four
people for permission. Both would teach me something worth knowing. Almost nobody
is positioned to run that comparison honestly, because almost everybody has
already picked a side and needs their side to win.

I'd rather find out.

---

## Where we've got to

Eighty-seven designs. Six hundred and sixty-four checks on the logic, a hundred
and thirty-two driving a real browser against a real build, and the compiler
sitting in front of both. Every one of those numbers was re-run and written down
rather than carried forward, because carrying numbers forward is how the last
three mistakes happened.

None of what broke this month announced itself. The tests were green, the pages
rendered, the buttons clicked. Everything looked exactly like a thing that was
working.

Which is the whole argument, really. This tool tells you what your house costs
and whether it fits on your land — numbers people will make expensive,
irreversible decisions with. The only reason to use it is that when it tells you
something, that thing is true. So the interesting work isn't the features. It's
the machinery that notices when we're wrong before you do.

We submit to the OKX BuildX AI Season on Friday. After that we keep going,
because I still haven't built my house.

It's all open source — the designs, the checks, the mistakes above and the fixes
for them: **github.com/kr8tiv-ai/aura-homes**

Come and look for what we missed. Something's in there.
