# The tests were green the whole time

*Notes from the Aura Homes workshop — August 19, 2026*

Last time I wrote about the grass on our landing page, which had stopped moving
without anyone deciding to stop it. The theme was the gap between what we
thought was true and what was actually true.

Five days later I have a better example.

We shipped nineteen commits of work on the geometry engine — the part that turns
your design into drawings, exports, a bill of materials. Good work, real work.
The whole test suite passed the entire time. Six hundred and sixty-four checks,
all green, every commit.

The code did not compile.

Not "had a warning." Did not compile. Eight type errors across four files, sitting
there through the whole wave, while the tests went green over the top of them.

The reason is dull and worth knowing: the test runner compiles each test file on
its own, in isolation, and never asks whether the *project* holds together. So
it can happily run a file that references something that doesn't exist, as long
as the part it actually executes happens to work. Which it did. For nineteen
commits.

One of the casualties was a test file whose commit message says, in so many
words, that the drawings are now checked against the new geometry. That file had
never compiled. It asked for a property on the wrong object. The check it
describes was never running.

So the compiler now runs inside the gate, before a single test does. We proved
it by putting one of the original errors back and watching the whole suite
refuse to start. That's the rule we came away with, and I'd offer it to anyone
building anything: **a green test suite is not a green build.** They are
measuring different things, and only one of them was watching.

---

## The roof that had nowhere to go

The most interesting of those eight errors wasn't a slip.

Our newer geometry system can build a hipped roof — the kind that slopes on all
four sides, no gable ends. Our older one can't; it knows gables, sheds, flat
roofs, A-frames, saltboxes, and that's the list. Every place the new system hands
a building back to the old one has to answer a question: what does a hip become?

Two of those places answered by telling the compiler to be quiet.

That's the part worth sitting with. The error wasn't noise. It was the code
asking a real question — *what happens to this roof?* — and someone answering
"nothing, ignore it." The approximation didn't go away. It just stopped being
visible.

A hip is a gable whose ends also slope, so a gable is the closest honest answer,
and that's what we do now. But it loses something in a direction that matters: a
gable end is full height where a hip is cut back. So if you're reading headroom
near an end wall off the drawing, the drawing gives you more room than the
building has.

The drawing set now says so, on the sheet, in those words — and only when
there's actually a hip in your design. A standing warning about a roof nobody
drew is noise, and noise is how a real warning stops being read.

---

## Nineteen times too cheap

Here's one we found by accident, doing something else.

Every window in your design was priced as a window: nine hundred to eighteen
hundred dollars, times how many you had. Reasonable. Except our system counts a
full-height glass wall as one window.

So a wall of glass — thirty-four feet across, three hundred square feet — cost
the same as a four-by-four casement over the kitchen sink. About nineteen times
too cheap, on the item that's often the most expensive thing in a glass-forward
house.

It's priced by the square foot now, using the same sourced range, with the
arithmetic printed where you can check it: here's the per-window figure, here's
the reference window size we divided by, here's what that gives per square foot,
and here's a note saying we derived that rather than looking it up. It is not a
quote and it doesn't pretend to be.

The error was in the direction that hurts. It made homes look cheaper than they
are, to people budgeting for the biggest purchase of their lives. Those are the
bugs to go looking for.

There's a general rule under it: **a price per unit of a thing that varies in
size by twenty times is not a price. It's a placeholder.** We're now checking
everywhere else we count things.

---

## Fifteen houses, and the review that nearly stopped them

The library went from seventy-two designs to eighty-seven. The fifteen new ones
are flat-roofed and glass-led, because that's what people kept asking for and
our library had barely any.

They very nearly didn't ship.

They passed every automatic check we have. No overlapping windows. Nothing the
builder would silently trim. The real geometry engine ran all fifteen and
returned zero warnings, where the existing designs return forty between them.
By the numbers, the cleanest set we've ever produced.

Then we read them.

One design put forty-one percent of its glass on north-facing walls — including
a hundred-and-eighteen-square-foot glass wall, its single largest opening — and
never used the word "north" anywhere in its description. It talked instead about
putting most of the glass on the "sheltered faces."

Sheltered from wind is not the same as facing the sun. In Edmonton, at fifty-
three and a half degrees north, a wall of glass facing away from the sun is a
heating bill, and calling it sheltered is a way of not saying that.

None of our checks could see it, and the reason is worth understanding: every
one of those designs states its glazing ratio correctly. A ratio doesn't know
which way it's pointing. The number was true and the building was still a bad
idea.

Ten more findings like it: a comment that denied an eight-foot step the same
file describes, a claim of "five windows" where there were eight, a note arguing
a light shelf pushes daylight twenty feet into a room that is thirteen feet deep.

So three designs got their glass moved rather than their descriptions softened —
one had its north wall of glass turned to face south, one had two panes removed
entirely because there was nowhere honest to put them, one had its north
clerestory cut back and its reasoning rewritten. Ten more had their sentences
corrected to match their geometry. And there's a new check now: if a meaningful
share of your glass faces away from the sun, the design has to say so out loud.

The other thing we did was take a real building's name out. One description
referred to a well-known Canadian house by name as a reference point. Our library
doesn't name real buildings, and it shouldn't start.

---

## You can pick your land now

For a while, our land page had a working "use this plot" button and nothing real
to press it on. The machinery was genuinely finished — pick a parcel and the
builder re-checks your exact design against it — and the only parcels in there
were four we'd made up as examples.

The real data we'd licensed was zoning districts: a hundred and fifty-six of
them, from the City of Edmonton, under open terms. Rules, not lots. A zoning
district knows the maximum height on your street. It has no idea how wide your
yard is.

So the honest thing was to let you say. You state your lot — frontage, depth,
setbacks, which way the front faces — and the builder checks your actual design
against your actual rectangle. Forty-four by a hundred and thirty, with
twenty-five-foot front and rear setbacks and ten on the sides, gives you
twenty-four by eighty to build in. Whether the house you drew fits is now a
question with an answer.

There's a lookup too. Type an Edmonton address, press the button, and the City's
own property register answers with the real lot area and the real zone code. It
fires on the press and never on page load, and the page tells you your address is
leaving your browser before it does.

What we won't do is pretend we have listings. There is no free, legal,
redistributable feed of land for sale in Canada — that requires a broker
relationship, and no amount of engineering changes it. A property register
records who owns what. It never records what's for sale, and dressing one up as
the other would be the easiest lie available to us.

The made-up example parcels are still there. They're behind a switch now, off by
default, so the first thing you see on a page about finding land isn't four
places that don't exist.

---

## The one in our own shop window

While checking everything else, we read our own submission document the way a
stranger would.

It said the plan library had reached seventy-two. It had reached eighty-seven,
five days earlier.

We have a check for exactly this. It looks for the real number near the words
"plan library," and it passed — because the right number *was* in the document,
two rows above, in a table. The stale sentence sat underneath it in the part a
person actually reads.

That's the third time we've been caught by the same shape of mistake: a check
satisfied by the right answer being *present* rather than the wrong answer being
*absent*. First a badge reading old numbers beside a correct table. Then a video
timestamp — "72–84s" — passing as a plan count. Now this.

So the rule changed. Any number written in the *shape* of a plan count now has
to *be* the plan count. Not "the correct figure appears somewhere," but "no
incorrect figure appears anywhere."

I keep writing versions of this paragraph, which suggests we haven't finished
learning it.

And then, because the universe has a sense of humour: while writing *this* — the
article about a compiler that wasn't in the gate — we added the new check, tested
it by running that one file directly, watched it pass, and committed it.

Running one file directly is the exact thing that doesn't typecheck.

The gate caught it about an hour later. A check written to catch a stale number
was itself shipped through the hole we'd just closed, in the same afternoon we
closed it. I'd love to tell you we're above that. Evidently not, which is rather
the point of having the gate rather than having good intentions.

---

## Where we've got to

Eighty-seven designs. Six hundred and sixty-four checks on the logic, a hundred
and thirty-two driving a real browser against a real build, and now the compiler
sitting in front of both of them. Every one of those numbers was re-run and
written down rather than carried forward, because carrying numbers forward is
how the last three mistakes happened.

The pattern across all of it is the same as the grass. Nothing here was broken
in a way that announced itself. The tests were green, the pages rendered, the
buttons clicked. Everything looked exactly like a thing that was working.

What we're building is a tool that tells you what your house costs and whether it
fits on your land — numbers people will make expensive, irreversible decisions
with. The whole argument for using it is that when it tells you something, that
thing is true.

Which means the interesting work isn't the features. It's the machinery that
notices when we're wrong before you do.

---

## On the hackathon, and what happens after it

We're submitting to the OKX BuildX AI Season this week, and I want to say
something plainly about that before the usual disclaimers.

OKX have been genuinely good to build on. The chain works, the docs are decent,
the tooling didn't fight us, and — this is the part people undersell — somebody
there decided to run a season that gives builders a reason and a deadline. That
is not nothing. Most of what exists in this project exists because a date on a
calendar turned "we should do that eventually" into "that's due Friday." We'd
like to win something. We'd particularly like the token we deployed on X Layer to
count for something.

But here's the honest version: we'd keep going if we placed last.

Hackathons are strange, wonderful machines. They mostly produce demos that
evaporate on Monday. Occasionally they produce something the person who made it
can't put down — where the deadline was the excuse and the thing itself turns
out to be the reason. That's what happened to us somewhere around week two, and
we're now well past the point where a judging result changes the plan.

So: hackathon or no hackathon, the show goes on. We keep building homes and we
keep making the tool better. It just gets better faster when someone's watching.

---

## What we'd like to build next, and how you'd pay for it

There's a category of thing we can't do without a model behind it, and it's the
category people actually want.

A photoreal render of the house you just designed — not a stock image of
somebody else's house, *yours*, the geometry locked so the picture is provably
the building. A tool that reads the quote your builder just emailed you and
checks it, line by line, against the numbers your own design already computed:
this quote says R-24 and your walls are R-40, this quote has no line for the
ventilation your comfort report assumes, this quote counts nine windows and you
have fourteen. Point your phone at a house you like and get an editable, costed
model of its massing.

That last one is the fun one. The one before it is the one that matters, because
the thing an owner-builder is actually afraid of isn't picking the wrong roof.
It's handing two hundred thousand dollars to a stranger for work they can't
evaluate.

Those all run through OpenRouter, and inference costs money, so it's a paid tier.
The shape we want: top up with crypto from OKX, spend it on renders and quote
checks, and we take a small margin over what the models actually cost. We'll show
you the estimate before the call rather than the bill after it. Nobody should be
surprised by a number they didn't agree to.

There's a version of this we could ship tomorrow, incidentally, and we found it
while writing the plan: if you bring your own key, none of it needs a server at
all. Your key stays in your browser next to your project, same as everything else
we do. The paid tier just becomes the convenient option rather than the only one.

The rest of it stays deterministic, and that's not negotiable. The moment a model
picks a wall thickness, every number in this article stops meaning anything.
Models at the edges. Arithmetic in the middle.

---

## Two funds, one experiment

Here's a thing we're doing that we haven't talked about much.

Alongside the token, we're going to raise a conventional fund. Ordinary money,
ordinary structure, ordinary investors, to build actual houses.

And we're going to run it next to the decentralized one.

Not as a hedge — as an experiment. Two pools of capital, the same mission, the
same kind of homes, keeping their books in public where anyone can compare. Which
one moves faster. Which one makes better calls. Which one is still standing in
three years. Which one people trust with their money, and why.

We genuinely don't know the answer. There's a version where the decentralized
side is a beautiful mess that can't close on a piece of land, and a version where
it runs circles around the traditional one because it doesn't have to ask four
people for permission. Both would teach us something worth knowing, and almost
nobody is in a position to run that comparison honestly, because almost everybody
has already picked a side and needs their side to win.

We'd rather find out.

---

## One last note

I should be straight about how this gets made. I'm not the one writing the code —
I'm directing it, arguing with it, and telling it when something feels wrong.
Most of my day is looking at what came back and saying *that's not right, the
land page doesn't let me pick land*, or *these houses all look the same*, or
*why is that number so small*. Then the machine goes and finds out that windows
were priced by the each.

It's a strange way to build software and I'm not going to pretend it's the
traditional one. But the checks are real, the numbers are real, and the mistakes
in this article are ours — found by the machinery we built specifically so we'd
find them before you did. That part I'll stand behind completely.

It's all open source. The designs, the checks, the mistakes above and the fixes
for them: github.com/kr8tiv-ai/aura-homes.

Come and look for what we missed. Something's in there.
