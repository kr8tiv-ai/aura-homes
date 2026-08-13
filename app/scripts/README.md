# Inspection harness

`inspect.mjs` is the instrument the critics use. It drives real Chromium against a
running build, captures every console message and page error, drives the scroll
story to exact fractions, waits for the damped camera to settle **in rendered
frames**, and writes screenshots plus machine-readable JSON.

It reads the served pages only. It touches no app source.

## Prerequisites

The build must already be served. This harness does not start a server.

```powershell
# from app/
npx playwright install chromium   # one time
```

## The commands

Run all of these from `app/`.

**The 3D scroll story — the one that matters:**

```powershell
node scripts/inspect.mjs --url http://localhost:4321 --route / --viewport 1440x900 --out scripts/__inspect
```

**Story at desktop + mobile together:**

```powershell
node scripts/inspect.mjs --url http://localhost:4321 --route / --viewport 1440x900,390x844 --out scripts/__inspect
```

**The six app routes (short pages — three positions is enough):**

```powershell
node scripts/inspect.mjs --url http://localhost:4321 --route /overview,/land,/design,/budget,/escrow,/dashboard --viewport 1440x900 --scroll 0,0.5,1 --fullpage --out scripts/__inspect
```

**Everything, desktop + mobile, in one sweep:**

```powershell
node scripts/inspect.mjs --url http://localhost:4321 --route /,/overview,/land,/design,/budget,/escrow,/dashboard --viewport 1440x900,390x844 --out scripts/__sweep
```

**The story at night, and with reduced motion (both are separate designs):**

```powershell
node scripts/inspect.mjs --url http://localhost:4321 --route / --night --out scripts/__night
node scripts/inspect.mjs --url http://localhost:4321 --route / --reduced --out scripts/__reduced
```

`node scripts/inspect.mjs --help` lists every flag.

## What you get

```
<out>/report.json                        every measurement, all routes, plus verdict
<out>/<route>/<viewport>/console.json    console + page errors + failed requests
<out>/<route>/<viewport>/s00_p0.000.png  one shot per scroll fraction
<out>/<route>/<viewport>/fullpage.png    with --fullpage
```

Default scroll fractions: `0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1`.

Exit code `0` clean, `1` something failed (the failures are printed and listed in
`report.json`), `2` bad usage. `--no-fail` forces `0` for capture-only runs.

## Two things worth knowing before you trust a screenshot

**It waits on frames, not on a clock.** `Scene.tsx` damps the camera with
`MathUtils.damp(..., 5, min(dt, 1/20))`. Under a software rasteriser a frame can
take seconds while damping advances 50 ms of simulated time, so any `sleep` shoots
a camera still in flight. The harness renders frames until a 64x40 thumbnail of
the canvas stops changing: **epsilon** (delta below `--epsilon` for `--stable`
checks in a row), **plateau** (ambient drift — aurora, water, grass — never
reaches zero, so a flat tail above the noise floor counts), or **budget**
(neither happened; recorded as `settled: false` and failed, never swallowed).
Every delta series is in `report.json`.

**It asks for the real GPU.** Headless Chromium defaults to SwiftShader, measured
at 0.54 fps on this scene — slow enough that Playwright's click actionability
check (two consecutive stable frames) cannot finish inside a 5 s timeout, so the
story's enter-gate never opens and every shot is the gate. Measured at 1440x900:

| flags | fps | renderer |
|---|---|---|
| `--use-gl=swiftshader` | 0.54 | SwiftShader Device (Subzero) |
| none (Chromium default) | 0.53 | falls back to SwiftShader |
| `--use-angle=d3d11` | 30.95 | AMD Radeon 740M, D3D11 |
| `--use-angle=gl` **(default)** | 60.02 | AMD Radeon 740M, OpenGL 4.5 |

The renderer string and the live fps are recorded per page in `report.json`.
Override with `--gl d3d11` or `--gl swiftshader`; on a software renderer the
harness says so and widens its wall-clock budgets.

## The failure checks are real

Each one was made to fire before it was trusted:

| check | proof it can fail |
|---|---|
| undersized / blank shot | `--route /this-route-does-not-exist` → 14 KB shots vs 39 KB–1.9 MB real, exit 1 |
| story gate still up, scroll locked | `--gate none` → both shots flagged, exit 1 (the shots were 220 KB, so file size alone would have passed them) |
| never settled | first run of this harness under SwiftShader: 16 frames in 45 s, `lastDiff 0.57`, every shot flagged |
| flat/dead canvas | same run, `canvasVar 0` at fraction 0 |
| HTTP / same-origin request failure | the 404 route reported 2 http errors |

Blankness is judged three independent ways, all recorded per shot: PNG byte size,
canvas thumbnail variance, and DOM stats (visible elements, rendered text length,
broken images).

## Notes

- The static export uses `trailingSlash: true`; a route that 404s without the
  slash is retried with it.
- The story's enter-gate is dismissed automatically (`--gate silent` by default,
  which avoids fetching the 6.5 MB ambience). `--gate sound` clicks the loud one,
  `--gate none` leaves it up.
- An init script forces `preserveDrawingBuffer: true` on every WebGL context so
  canvas pixels can be sampled. It changes buffer retention only, never what is
  drawn.
- Output directories are throwaway; nothing under `scripts/__*` is source.

## Chunk-safe GitHub Pages releases

The production failure archived on August 13, 2026 was an old-HTML/new-assets
split. The preceding `/build/` HTML referenced, among others,
`webpack-3f4369b117f6848f.js` and `app/build/page-be65fc7fce0724db.js`. The next
mirrored deployment deleted those files while GitHub Pages still served the old
HTML with a ten-minute cache lifetime. React never hydrated, so plan buttons
looked present but did nothing.

`static-release.mjs` turns the mirror into a two-phase, append-only release. Run
it from `app/` against a separate checkout of `gh-pages`; it never invokes Git,
commits, pushes, or deploys by itself.

```powershell
$releaseId = (git -C .. rev-parse --verify HEAD).Trim()
$env:GH_PAGES = "1"
$env:AURA_RELEASE_ID = $releaseId
npm run build

# Phase 1: add assets and manifests, but leave every published HTML file alone.
npm run release:stage-assets -- --export ./out --site C:/path/to/gh-pages --release-id $releaseId

# Review, commit, and push the asset-only change. Wait until its new asset URLs
# return 200 from production before continuing.

# Phase 2: re-check current, retained, and next HTML references, then overlay HTML.
npm run release:publish-html -- --export ./out --site C:/path/to/gh-pages --release-id $releaseId

# Review, commit, and push the HTML change.
```

Each manifest records the asset paths used by that release's emitted HTML.
Staging fails if current HTML, next HTML, or any retained release points at a
missing local asset. Existing `CNAME` always wins and `.nojekyll` is always
present. `next.config.mjs` uses the checked-out commit as both the Next build ID
and `NEXT_PUBLIC_DEPLOYMENT_ID`; `AURA_RELEASE_ID` is the explicit CI override.

Cleanup is intentionally separate and dry-run by default:

```powershell
npm run release:prune-assets -- --site C:/path/to/gh-pages
npm run release:prune-assets -- --site C:/path/to/gh-pages --apply
```

The apply form removes only unreferenced `_next/static/` assets whose releases
are both outside the newest five and older than 30 days. It refuses to prune if
current or retained HTML has already lost an asset.

The inline head guard is defense in depth, not the primary fix. On a chunk-load
failure it reloads once per deployment ID. If the same release fails again, the
server-rendered page is covered by an accessible static recovery panel instead
of leaving inert controls on screen.

Run the focused regression suite before either phase:

```powershell
npm run test:release
```
