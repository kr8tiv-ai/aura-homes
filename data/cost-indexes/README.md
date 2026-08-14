# Cost indexes

Baked, free-tier, public-source construction price indexes. One file per
source table. Nothing here is hand-typed: every figure arrives from
`app/scripts/bake-cost-indexes.mjs` carrying its table id, vector id,
coordinate, source URL and retrieval date.

## `statcan-1810028901.json`

| | |
| --- | --- |
| Publisher | Statistics Canada |
| Table | **18-10-0289-01** — Building construction price indexes, by type of building and division |
| Access | Web Data Service, public, keyless, unmetered |
| Licence | [Statistics Canada Open Licence](https://www.statcan.gc.ca/en/reference/licence) |
| Selection | Single-detached house × 14 divisions × 25 geographies |
| Anchor region | `edmonton` — the region `data/alberta/cost-model.json` was researched in |

### Why not 18-10-0276-01

The system graph names table 18-10-0276-01 as the primary source. That table
is **archived**: its last reference period is 2024-04-01. Its replacement says
so in its own footnote, verbatim:

> This table replaces table 18-10-0276 which was archived with the release of
> second quarter 2024 data.

Baking the named table would have shipped a two-year-stale index under a
current-sounding retrieval date. The bake uses the live successor and records
the archived id in `source.supersedes` so the lineage stays legible. The bake
refuses to run at all if its table ever stops being `CURRENT`.

### What this data can and cannot say

The BCPI is a **time** series per region: a common index base, then divergent
drift. It is not a survey of absolute price levels between cities. A ratio
between two regions' index values therefore measures relative construction-cost
**drift since the base period**, and equals a cost-**level** ratio only if the
two regions started at parity in the base period.

Aura has no free public source for that parity. So `app/lib/builder/regionalCost.ts`
treats the ratio as an estimate, widens the band in proportion to the drift,
and labels the result *an estimate, not a quote*. A region with no baked index
gets an honest refusal, never a silent 1.0.

### Re-baking

```
node app/scripts/bake-cost-indexes.mjs            # fetch + write
node app/scripts/bake-cost-indexes.mjs --dry-run  # fetch + report only
```

Re-runnable and idempotent apart from `retrievedAtISO`. Statistics Canada
releases the BCPI quarterly; re-bake after a release and commit the diff.
`app/tests/regional-cost.spec.ts` is the tripwire: if a re-bake ever moved the
anchor region's multiplier off 1.0, the anchor-invariance test fails before the
published cost triplet can drift.
