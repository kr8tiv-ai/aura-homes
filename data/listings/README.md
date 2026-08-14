# Listing data — the rights policy

This folder is where real listing evidence would live: a photograph we are
allowed to show, a price we can point at, a parcel record a reader can open
for themselves.

**What is in it today: this file, and nothing else.** No photo, no price, and
no permission has been collected yet. The schema that would hold them exists
(`app/lib/marketplace/homeModels.ts`); the data does not. Anything that
appears here later has to pass the rules below before the catalog will render
it, and the validation in that module refuses the rest.

## The standing decision

Free tier only. No paid data feeds, no partner outreach, and no scraping of
restricted listing platforms. That decision shapes everything below, and it
is the reason the catalog carries drawings rather than photographs today.

## What may be stored here

1. **Maker-permissioned photographs.** A photo the manufacturer, builder, or
   photographer gave us in writing, under a licence we can name. The written
   permission is a one-page document; see *Recording a permission* below.
2. **Open government land data.** Municipal, provincial, and federal records
   published for reuse — parcel geometry, zoning, assessment, and the like —
   used within whatever open licence the publisher attached, with attribution.
3. **Link-out records with full provenance.** A pointer to a listing that
   lives somewhere else: title, source name, URL, and the date we looked. The
   reader clicks through to the source; we do not republish its content.

## What may never be stored here

- **MLS or REALTOR.ca photographs, remarks, or listing content — ever, under
  any framing, without an executed feed licence.** The lawful path is a
  CREA DDF® feed through an eligible REALTOR® or brokerage relationship. Until
  such a licence exists and its attribution terms are met, none of that
  content comes into this repository, not even temporarily, not even for a
  screenshot, not even "just to test the layout."
- Anything obtained by scraping a platform whose terms forbid it.
- Photographs hotlinked from a maker's own server. A hotlink is not a licence,
  it breaks the static export, and it moves the decision to someone else's
  infrastructure.
- Photographs of unclear origin. If nobody can name who took the picture and
  under what terms, the answer is no. Unclear provenance is refusal, not a
  judgement call.
- Any personal information about a seller, an owner, or an occupant.

## Recording a permission

A photograph is admissible only with a written permission on file. The
one-pager states, in plain language:

- who granted it, and their authority to do so (the maker, or the
  photographer who holds the copyright);
- exactly which images it covers;
- what Aura may do with them — display on the site, in exports, and in the
  open-source repository;
- the credit line to print, verbatim;
- the date granted, and the date it lapses;
- how either side ends it early.

The signed one-pager goes in `data/listings/permissions/`, and the record
points at it. Those fields map onto the schema one to one:

| One-pager           | `LicensedPhotoVisual` field |
| ------------------- | --------------------------- |
| Credit line         | `credit`                    |
| Licence name        | `license`                   |
| Path to the signed page | `permissionRef`         |
| Date granted        | `collectedAtISO`            |
| Date it lapses      | `expiresAtISO`              |
| Where the file lives (ours, not theirs) | `url`   |

A record missing the credit, the licence name, or the permission reference is
refused by `validateHomeVisual`. It cannot be published by forgetting to
check — the refusal is in the code path, not in a reviewer's memory.

## When a permission expires

`expiresAtISO` is the moment the grant ends, and the code treats it as a hard
edge. Past that instant `resolveHomeVisual` stops returning the photograph and
returns the labelled Aura drawing instead, automatically, with no page change
and nobody deciding. A photograph cannot outlive the permission that allowed
it.

Expiry is the safety net, not the process. When a permission lapses or is
withdrawn, delete the image file and the record, and say so in the commit. Ask
for a renewal before the lapse if the maker is willing.

## Prices

A number needs a date and an origin. `price.numeric` carries `amount`,
`currency` as an ISO 4217 code, `asOfISO`, and a `basis` that names where it
came from: the maker's published figure, a written quote, or a public record.
A price with no date is refused. Where a home has no price we can point at,
the catalog says so in one sentence rather than estimating.

## Geography

`geography` holds a country code, optionally a province or state, and
optionally a coordinate. A coordinate is stored only when both halves are
known; half a coordinate is a guess, and validation refuses it.

## Adding something here

Open a pull request that includes the evidence, not just the record: the
permission page for a photograph, the publisher's licence terms for open
data, or the source URL and collection date for a link-out. A record whose
provenance cannot be checked by a stranger reading the repository does not
belong in it.
