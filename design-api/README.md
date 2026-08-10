# Aura Homes — Design service

**The backend for the site's `02 · DESIGN` step.** Questionnaire in → accurate
architectural renders and a dimensioned, printable blueprint out.

```bash
cd design-api
python -m pip install -r requirements.txt
cp .env.example .env          # every key is optional
uvicorn app.main:app --reload --port 8000
```

`GET /health` reports exactly what is wired up. **The service runs with no keys
at all** — it falls back to a deterministic room program and returns a full
blueprint without renders, and says so in `offline: true`.

---

## The one idea

> **Python owns the geometry. The LLM owns the reasoning.**

Nothing that lands on a dimensioned drawing is produced by a language model.
The LLM returns a *program* — how many rooms, roughly how big, which want
windows, which are wet — and a deterministic packer re-solves the actual
coordinates so walls meet at right angles and the areas sum.

[`docs/AI-TOOLS-RESEARCH.md`](../docs/AI-TOOLS-RESEARCH.md) reached the same
conclusion independently after surveying the field, and it is why this service
exists in the shape it does:

- The most-cited generator, **HouseDiffusion**, is **blocked twice** — GPL-3.0
  code *and* trained on **RPLAN**, which is licensed for research only.
- The field is "a research field wearing a product costume."
- **ResPlan** (17,000 vector plans, **data CC BY 4.0 / code MIT**) is the only
  large, commercially usable corpus — the priors base if we ever train.
- Generating plans procedurally sidesteps dataset licensing entirely, which is
  the trick `AI4SC/bim-diffusion-models` uses.

## Pipeline

| Stage | Module | What happens |
|---|---|---|
| **A1 · reason** | `services/llm.py` + `prompts.py` | Structured-JSON call (Anthropic tool-use, or OpenAI json_object). Returns a room program **and** rendering prompts. Unparseable → deterministic fallback, never a retry-and-hope. |
| **geometry** | `services/layout.py` | Squarified treemap slicing with a reserved circulation spine. Wet rooms cluster for a shared plumbing wall. Always deterministic. |
| **A2 · render** | `services/images.py` | Replicate / Fal adapters. Any failure returns `None`, never raises. |
| **B · draw** | `services/blueprint.py` | SVG at 1/4"=1'-0" → PDF (cairosvg) → DXF on real CAD layers (ezdxf). |

## What makes the output *accurate*

- **Wall thickness is the material's real thickness** — SIP 165 mm, CLT 128 mm,
  timber frame 190 mm, **rammed earth 450 mm**. It changes the plan, the net
  area, and the price per square foot, so it is modelled rather than drawn as a
  generic line.
- **FDWR is enforced, not decorated.** Glazing is measured against the **22%
  NBC 9.36 prescriptive ceiling**; if the plan exceeds it, windows are trimmed
  and a warning is emitted naming the performance path as the way to buy the
  glass back. Same rule the TypeScript design pipeline already applies.
- **A 6-foot minimum room dimension**, with an explicit warning when the program
  will not fit the envelope — the engine tells you the plan is too tight rather
  than drawing a 3-foot bedroom.
- **Real drafting conventions**: poché structural walls, thinner partitions,
  door leaves with swing arcs, window cuts with sill lines, extension lines and
  45° dimension ticks, a title block, and a scale bar.
- **Every drawing is stamped** `REVIEW-READY DESIGN PACKAGE — NOT FOR
  CONSTRUCTION`. "AI permit-ready drawings" do not exist; the repo's honesty
  policy forbids the claim.

Verified output, deterministic path, no keys:

| Brief | Envelope | Wall | Windows | FDWR | Warnings |
|---|---|---|---|---|---|
| 800 sqft · 2 bed · SIP | 34'-0" × 23'-6" (799 sf) | 165 mm | 10 | 12.8% | 0 |
| 1,400 sqft · 3 bed · rammed earth | 45'-0" × 31'-0" (1,395 sf) | 450 mm | 12 | 11.9% | 1 (honest: mechanical 5.9') |
| 450 sqft · studio · CLT | 25'-6" × 17'-6" (446 sf) | 128 mm | 7 | 10.1% | 0 |

## Licence tripwire — read before changing `IMAGE_MODEL`

ControlNet code is Apache-2.0, but **SD 3.5 / Flux checkpoints ship under the
Stability AI Community License — free commercially only under US$1M annual
revenue.** `IMAGE_BACKENDS` in `services/images.py` records a licence note per
model so the choice is visible in code:

- `black-forest-labs/flux-schnell` — **Apache-2.0 weights. The default.**
- `black-forest-labs/flux-dev` — **non-commercial. Do not ship.**
- `stability-ai/sdxl` — CreativeML Open RAIL++-M, commercial use with restrictions.

## Wiring into `02 · DESIGN`

`app/lib/designApi.ts` in the Next app is the typed client. Point it at the
service with `NEXT_PUBLIC_DESIGN_API` (default `http://localhost:8000`). The
design page posts the questionnaire and renders `artifacts.svg_url` inline with
`pdf_url` / `dxf_url` as downloads.

## Not yet done

- The page-level wiring in `app/app/design/page.tsx` — that file is being
  edited by the concurrent build session; the client module is ready for it.
- ResPlan-derived proportion priors (currently arithmetic shares).
- `@thatopen/components` for the plan ↔ 3D toggle and in-browser DXF, which
  the research recommends adopting (MIT, Three.js-native).
