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
