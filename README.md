# aurahomes.fun — deployed site

This branch is the **built static site** served at [aurahomes.fun](https://aurahomes.fun).
It is published by an append-only, two-phase release process (immutable assets
first, HTML second, older releases retained) so cached pages never point at
deleted chunks — the tooling and its tests live in
[`app/scripts/static-release.mjs` on `main`](https://github.com/kr8tiv-ai/aura-homes/blob/main/app/scripts/static-release.mjs).

**Do not edit this branch by hand.** Source, documentation, the engineering
graph, and the contribution story live on
[`main`](https://github.com/kr8tiv-ai/aura-homes) — start with its README.

Release provenance: each deploy's manifest sits in
[`.aura-release-manifests/`](.aura-release-manifests/), keyed by the source
commit that produced it; the same id is embedded in the served HTML as the
deployment id.
