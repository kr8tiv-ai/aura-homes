# Land constraint data — what is here, and what it is not

This folder holds **zoning constraint and reference data**, baked from open
government sources. It is not inventory, not a feed, and not a market surface.
Nothing in it is on offer, priced, or owned by Aura.

That distinction is the whole point of the folder, so it is enforced rather
than asserted: `app/scripts/bake-land-data.mjs` refuses to write the artifact if
market vocabulary — *for sale*, *listing*, *listed*, *available*, *asking
price*, *realtor*, *MLS* — appears anywhere in it. See `assertNoMarketVocabulary`.

## Why this exists

The land-fit pilot could compare a design against parcel evidence from the day
it shipped. It had no real evidence to compare against. Of the three sources in
`LAND_LISTING_PROVIDERS` (`app/lib/marketplace/discovery.ts`), REALTOR.ca DDF®
lawfully requires an eligible REALTOR®/broker relationship and approved DDF
permissions that Aura does not have, Alberta Site Selector grants no reusable
feed rights, and the only connected source was four fictionalized records whose
own note says they are not active listings.

Open government data needs no such relationship. The City of Edmonton publishes
the **rules that govern land**, and its Open Data Terms of Use grant
redistribution outright. That answers a better question than a feed does: not
what is on the market, but what a district would let you build.

## `edmonton-zoning-districts.json`

| | |
| --- | --- |
| Jurisdiction | City of Edmonton, Alberta |
| Licence | [City of Edmonton Open Data Terms of Use, version 2.1 (January 2016)](https://data.edmonton.ca/stories/s/msh8-if28) |
| Licence text retrieved | 2026-08-14, from the [terms PDF](https://www.edmonton.ca/public-files/assets/document?path=Web-version2.1-OpenDataAgreement.pdf) the portal links |
| Data retrieved | recorded per source in `sources[].retrievedAtISO` inside the file |
| Size | ~78 KB |

The grant clause travels **inside** the artifact so nobody has to take a README's
word for it. Verbatim:

> The City of Edmonton (the City) grants you a worldwide, royalty‐free,
> non‐exclusive licence to use, modify, and distribute the datasets in all
> current and future media and formats for any lawful purpose, including for
> commercial purposes.

Redistribution carries one condition, also copied into the artifact: anyone
receiving the datasets, in original or modified form, must get a copy of, or the
URL for, the Terms of Use. That is why every consuming surface carries
`landConstraintAttribution()`, which returns the attribution sentence **and** the
terms URL together — the URL is the condition, not decoration.

### Sources baked

| Dataset | Id | Update frequency | What it gives |
| --- | --- | --- | --- |
| Zoning Bylaw Geographical Data | `fixa-tstc` | Weekly | Every zoning district code in force, its official name, and the City's URL for its section of Zoning Bylaw 20001 |
| Zoning Overlays | `6w3s-58pv` | Weekly | Overlays and special areas that add to or override an underlying district |

### The one regulation that is evidenced, and why only one

Zoning Bylaw 20001 writes each modified zone's ceiling into the zone code
itself. The MU Zone's Table 4.1 states the convention in the City's own words:
maximum Height is *"The number (in metres) following the Modifier 'h' as
indicated on the Zoning Map"*, and maximum Floor Area Ratio is the number
following the modifier `f`. So `RM h16` publishes a 16.0 m ceiling on the map,
and 62 of the 156 districts carry such a modifier.

Those 62 get a `verified` maximum height. Everything else in the fit engine's
evidence set — minimum Site area, Setbacks, minimum dwelling size, water,
private sewage, access, grid — is recorded `unknown` and carries the City's
link. Seven unknowns to one verified fact is the honest state of this data.
A fixture would have scored better and meant nothing.

The `cf` modifier is stored raw and left **uninterpreted**. Aura has not
evidenced its meaning, so it does not get one.

### What is deliberately not baked

- **Polygon geometry.** 11,518 multipolygons is roughly 8 MB of GeoJSON
  (measured 2026-08-14) and the static export will not carry it. Aura therefore
  makes no claim to offline point-in-parcel lookup and links to the City's own
  zoning map for the parcel-specific answer.
- **Zoning Bylaw 20001 regulation tables.** Minimum Site area, Setbacks and
  minimum Site width live in bylaw text, not in an open dataset, and the City's
  Open Data Terms cover datasets in the Open Data Catalogue rather than the
  bylaw text. Where the terms do not clearly permit redistribution, Aura links
  out and says why. That is the same rule that keeps MLS content out of this
  repository.

### Source refused: Vacant Land Inventory (`svsw-2ub7`)

The City publishes a Vacant Land Inventory, and on its face it is exactly what a
land tool wants. It is refused, and the refusal is recorded in the artifact
under `refusedSources` with the numbers behind it.

It is a **May 2014 snapshot**, last touched in 2021, and its zone codes are
mostly from the **repealed Zoning Bylaw 12800** — `RF1`, `RF3`, `RA7`, `CB2`,
`CNC`, `AGU`. Only 11 of its 36 codes still exist on the current zoning map.
Joining it to Bylaw 20001 districts would have shipped decade-old zoning under
today's retrieval date, which is the same failure the StatCan bake caught when
its named table turned out to be archived.

The refusal has its own tripwire. `assertRefusedSourceStillStale` re-checks the
join rate on every bake and **stops the bake** if it rises above 50%, because a
refusal nobody rechecks decays into a different kind of lie.

### The other guards

Every one of these stops the bake rather than degrading the artifact:

| Guard | Catches |
| --- | --- |
| `assertLicenceUnchanged` | The City moving either dataset off the Open Data Terms of Use |
| `assertZoneCodeGrammar` | A new zone-code modifier this bake does not understand |
| `assertBylawHost` | The bylaw moving host, or the share of on-host links collapsing below 90% |
| `assertExtractIsFresh` | The City's weekly zoning pipeline dying (120-day limit) |
| `assertBylawInForce` | Bylaw 20001 being replaced |
| `assertNotTruncated` | A `$group` query silently hitting the row cap and returning wrong counts |
| `assertNoMarketVocabulary` | Constraint data drifting into market language |

`assertBylawHost` was **renegotiated on 2026-08-14 rather than deleted**. Its
first version demanded a bylaw URL on every row and failed on live data: the
City files 12 grouped rows under its own `"legacy"` sentinel and leaves `BMR`
with no URL column at all. That is the City saying "this area has no current
bylaw page" — information, not breakage. The guard now accepts the sentinel and
instead refuses any unrecognised host plus any collapse in the on-host share, so
it still catches the thing it was written for. Districts record *why* they have
no link via `bylawUrlState`: `single`, `site-specific` (Direct Control codes
carry one page per site), or `not-published`.

### Re-baking

```
node app/scripts/bake-land-data.mjs            # fetch + write
node app/scripts/bake-land-data.mjs --dry-run  # fetch + report only
```

Re-runnable and idempotent apart from the retrieval dates. The City refreshes
both zoning datasets weekly; re-bake and commit the diff.
`app/tests/land-data.spec.ts` is the tripwire on the consuming module.

## Next honest step

`Property Information (Current Calendar Year)` (`dkk9-cj3x`, same licence,
current) carries per-property `zoning`, `lot_size`, `legal_description` and a
coordinate for ~440,000 Edmonton properties, and its zone codes join to this
register on `baseCode` (75 of its 80 codes, ~282,000 rows, checked 2026-08-14).
That would let a real address be checked against a real design rather than
against a district average. It is not baked here because 440,000 rows is a size
and a scope decision, not a licensing one — and unlike everything above, it
names individual properties, which deserves its own deliberate call.

## `edmonton-lot-areas.json`

That call was made on 2026-08-15, and this file is the answer to the section
above. **The aggregate ships. The rows do not.**

| | |
| --- | --- |
| Jurisdiction | City of Edmonton, Alberta |
| Source | Property Information (Current Calendar Year), `dkk9-cj3x`, weekly |
| Licence | The same City of Edmonton Open Data Terms of Use, version 2.1. `licenseId` on the portal is `SEE_TERMS_OF_USE`, byte-identical to the two zoning datasets, so no new licence decision was needed |
| Data retrieved | recorded in `retrievedAtISO` inside the file |
| Size | 18,374 bytes, capped at 25,000 |
| Holds | One row per zoning base code: how many titled properties the City files under it, and the 10th, 25th, 50th, 75th and 90th percentile lot **area** in square metres |
| Holds no | address, coordinate, owner, account key, legal description, price, or status of any kind |

### Why the aggregate and not the rows

The register publishes 439,631 properties, 282,666 of which carry a zone code
and a lot area (measured 2026-08-15; the other 156,965 are condominium units,
see the filter below). Baking those rows was costed at about 6.1 MB in their
cheapest sharded form (measured 2026-08-14) — roughly a third again on top of
the whole static export, a multi-megabyte re-commit every week the City
refreshes, and the republication of a quarter of a million real Edmonton home
addresses in a public repository.

They buy **no additional evidenced constraint**. The register's `zoning` column
carries base codes only — `RS`, `RM`, `MU` — and drops the `h` and `f` modifiers
that are the one thing `edmonton-zoning-districts.json` can evidence. So an
address yields a district, and the district still records the ceiling unknown.
Base-code matching offers `MU` alone 56 candidate districts, 55 of which publish
a ceiling and those span 12 m to 88 m; picking one would be inventing a ceiling.

The per-code summary costs 18 KB and says one true thing the district register
cannot: what a lot in this district tends to be. `assertNoParcelIdentity` is the
mechanical form of that decision — it caps the artifact at 25 KB and refuses any
civic address, legal plan or lot reference, account key, or coordinate. A quarter
of a million addresses cannot be smuggled in under 25 KB.

### The two caveats that travel with this file

**It is an area, never a width and a depth.** No free source anywhere in
Edmonton Open Data publishes frontage — `9tyx-zfd4`, `dm3i-bp8w` and `ut27-nrpn`
were each checked and carry none. A frontage is structurally something a person
has to state, forever, and any depth computed from area ÷ frontage is arithmetic
on their number rather than a measurement. It is also meaningless on corner, pie
and ravine-backing lots.

**A property register records who owns what. It never records what is being
sold.** Every one of those 439,631 rows is somebody's home right now. There is
no status column, no price and no agent, and none of that can be inferred from
anything present.

### The filter, and why it is not a convenience

`zoning IS NOT NULL AND lot_size > 0`. The 156,965 rows with no zone code are
condominium units, and their recorded area is a **unit share** of the parcel
rather than a lot — one sampled row carries 3.955 m². Including them would hand
somebody a 4 m² lot. The filter is stated in the artifact's own `method` block
for the same reason.

### Four dates that disagree, disclosed rather than reconciled

The portal's title says *Current Calendar Year*, its `Period of Coverage` says
`2025-01-01 to 2025-12-31`, its `Date Updated` custom field says 2026-03-30, and
`rowsUpdatedAt` says 2026-08-10. `assertExtractIsFresh` from the zoning bake
**cannot be reused**: this dataset has no `date_ext` column, and a freshness
limit measured against the coverage window would fail on the day it was written.
So the guard runs on `rowsUpdatedAt`, and the coverage window is carried into the
artifact verbatim and printed on screen wherever a register figure appears. It
describes an assessment roll year, so a recent subdivision, rezoning or new build
may not be in it.

### The guards

| Guard | Catches |
| --- | --- |
| `assertLicenceUnchanged` | The City moving this dataset off the Open Data Terms of Use |
| `assertRowsAreFresh` | The City's weekly refresh dying (120 days, measured on `rowsUpdatedAt`) |
| `assertNoRepealedZoneCodes` | The feed regressing to repealed Bylaw 12800 codes — the same tripwire that refused `svsw-2ub7`, pointed at this source |
| `assertJoinRate` | The two registers drifting apart (95% floor; 282,663 of 282,666 rows join today) |
| `assertNotTruncated` | A query silently hitting the row cap and returning wrong counts |
| `assertNoMarketVocabulary` | A register summary drifting into market language |
| `assertNoParcelIdentity` | The scope decision being reversed by accident: an address, a legal reference, an account key, a coordinate, or 25 KB |

Each one was watched failing before it was trusted, and
`app/tests/land-lot-areas.spec.ts` re-runs the vocabulary and parcel-identity
scans over what was actually committed — the one thing a bake guard cannot catch,
because a hand-edited artifact means the bake did not run.

### Where the aggregate is read

`lotAreaSummaryForBaseCode` is called by `RegisterSurface`, in
`app/components/land/ZoningLookup.tsx`, and its five quantiles are printed inside
the district panel on /land as the district typical — each figure carrying this
dataset's catalogue page as its source, and the coverage window beside it.

That sentence is worth stating plainly because it was false for a while and
nothing said so: the aggregate was baked, committed, guarded and specced, and no
application file imported it, so no figure it holds had ever reached a reader.
The whole scope argument above — ship the per-code summary rather than 282,034
parcel rows, because somebody should be able to see what a lot in their district
turns out to be — only pays for itself on a surface. Until there was one, the
argument was a plan.

### The one live call

`app/lib/land/propertyLookup.ts` asks the same dataset for **one address at a
time**, at runtime. It requests six columns — `house_number`, `street_name`,
`zoning`, `lot_size`, `legal_description`, `neighbourhood` — and never a
coordinate, an account key, or anything from the assessment dataset below.

**Who calls it.** `RegisterSurface` in `app/components/land/ZoningLookup.tsx`,
and nothing else in the application. Its `askTheCity` handler is bound to the
`onClick` of a single button, `data-slot="land-register-button"`: there is no
effect on mount, no handler on the address input that reaches the network, and no
request when a district is chosen. Typing sets state and stops. The sentence
naming what leaves the browser, `PROPERTY_LOOKUP_SENDS_NOTE`, is printed beside
the button before it can be pressed, so the cost is on screen while somebody is
deciding rather than after.

**What comes back, and what is not done with it.** A returned row is printed as a
sentence stating the lot **area** in both units, together with the base zone code
— which still carries no ceiling, because the register drops the `h` and `f`
modifiers. Aura does not write that number into the lot form. The
"Lot area (sq ft)" field under *Your own lot* stays the reader's to fill, because
overwriting a number somebody typed is not a thing a lookup gets to do. The
portal does not expose `X-SODA2-Truth-Last-Modified` across origins, so in a
browser the row usually arrives with no change stamp at all, and the surface says
that rather than showing a date it could not read.

This is the only thing in this folder that does not work offline, and that is
bounded on purpose: with the network off, the district lookup, the district
typical above, the lot form, the derivation and the fit check all still work. The
only thing missing is the lot area, which a person can type. Every failure —
transport, non-2xx, timeout, malformed JSON, throttle — returns a sentence a
reader can act on rather than an exception; `lookupProperty` has no throwing
path.

**Held by two specs, at two levels.** `app/tests/land-lot-areas.spec.ts` proves
the module offline — the URL it builds, the six columns it asks for, and all
three outcomes through an injected `fetch`. `app/tests/land-register-surface.spec.ts`
proves the surface in a browser — that the block is mounted on /land, that
nothing reaches the City before the button is pressed, and that every failure
prints what failed and leaves the area typable. A spec only means something if it
runs in a gate, which is not a property of the spec; `app/tests/gate-coverage.spec.ts`
is the control that refuses a spec file belonging to neither gate.

### Refused, permanently and on the record

`q7d6-ambg` Property Assessment Data carries `assessed_value`, joins on the same
key, and is linked from this dataset's own description, which makes it the
obvious next step. A dollar figure on a surface with nothing on offer reads as a
price no matter what the label says, and a municipal assessment for taxation is
not a market value in any case. The refusal is recorded inside the artifact under
`refusedSources`, with its reason. Reversing it is a founder decision, not a
builder decision.

### Re-baking

```
node app/scripts/bake-lot-areas.mjs            # fetch + write
node app/scripts/bake-lot-areas.mjs --dry-run  # fetch + report only
```

Re-runnable and idempotent apart from the retrieval dates: a fresh fetch on
2026-08-15 reproduced all 76 rows byte-identically, and only the three timestamps
moved. Re-bake after a City refresh and commit the diff.
