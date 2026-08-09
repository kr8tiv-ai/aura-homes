# agent/ — aura-architect + the aura-brain MCP server

The AI layer of Aura Homes (see [docs/AI-BRAIN.md](../docs/AI-BRAIN.md) and
[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)). Two entry points share one
pure-function core:

- **CLI pipeline** (`npm run demo`): questionnaire -> constraint-checked design
  brief -> LOW/MID/HIGH Alberta budget -> escrow milestone schedule, written to
  `out/`. `npm run brain` runs the journey brain (guidance, slip detection,
  weekly digest) over a sample journey.
- **MCP server** (`npm run mcp`): the same brain as `aura-brain`, an MCP server
  over stdio — the "Interface: MCP-first" design in AI-BRAIN.md. The web app is
  one client; Claude or any MCP-capable agent is another; the OKX agent
  ecosystem (x402-metered) is the third.

All money values are CAD unless a field name says otherwise. Budget totals
reconcile to the dollar with `data/alberta/cost-model.json`'s `totalsRule` —
that reconciliation is a frozen anchor (docs/GRAPH-ENGINEERING.md).

## The aura-brain MCP server

Built on `@modelcontextprotocol/sdk` (stdio transport, zod-validated inputs).
Every tool is a thin typed wrapper over the existing modules — `parcels.ts`,
`pipeline.ts`, `claude.ts`, `brain/` — no logic is duplicated in the MCP layer.
Tools that take a questionnaire accept a **partial** one and merge it over the
bundled sample (800 sqft modern cabin on a Lac Ste. Anne Agricultural parcel);
tools that take a journey accept a full `JourneyState` or default to the
bundled sample journey.

| Tool | Stage | What it does |
|---|---|---|
| `check_parcel` | LAND | Evaluates parcel listings against a design: district minimum dwelling size (the hard gate — the 800 sqft sample design REJECTS at Lakeside Estates' 1,076 sqft Country Residential minimum), aquifer, grid distance, septic soils. |
| `generate_design_brief` | DESIGN | Questionnaire -> constraint-checked design brief (SIP shell spec, screw piles, winter solar/battery floor, aquifer-driven water source, FDWR check). Narrative via Claude when `ANTHROPIC_API_KEY` is set, else the deterministic offline fallback. |
| `budget_estimate` | BUDGET | Brief -> LOW/MID/HIGH budget lines + totals from `data/alberta/cost-model.json`, with an explicit reconciliation block against the file's `totalsExLand` (equal to the dollar at the 800 sqft reference spec). |
| `milestone_schedule` | ESCROW | Budget (MID column) -> 5-phase escrow milestone schedule with the Alberta statutory 10% holdback per milestone, 60-day release period — mirrors `AuraBuildEscrow`. |
| `journey_status` | brain | Stage, per-stage substep progress, open blockers, escrow money position (funded / released net / held back / awaiting). |
| `next_actions` | brain | The next 3 actions: who does it, why, what it costs — facts cited from docs/ALBERTA-PLAYBOOK.md. |
| `detect_slips` | brain | Ball-drop detection: SIP kit unordered, permit unsubmitted, matured holdback still held, stale 2-of-3 approval, winter window, waiting-on escalation. `nowISO` injectable for deterministic runs. |
| `digest_preview` | brain | Renders the weekly "Your build update" email (subject + plain text + HTML). |
| `supplier_directory` | data | Queries the Alberta-first directory in `data/alberta/suppliers.json` by category, `albertaOnly`, or free-text query. |
| `alberta_fact` | data | Structured facts table (permits, district minimums, professional requirements, money rules) from docs/ALBERTA-PLAYBOOK.md; every fact returns with its basis. No arguments returns the index. |

### Run it

```
npm install
npm run mcp          # build + serve on stdio (free mode)
npm run mcp:paid     # build + serve with x402 demo-tier metering
npm run mcp:smoke    # spawn the server and drive initialize / tools/list /
                     # check_parcel / the paid 402 -> receipt round-trip
```

### Client configuration

```json
{
  "mcpServers": {
    "aura-brain": {
      "command": "node",
      "args": ["C:\\Users\\lucid\\Desktop\\aura-homes\\agent\\dist\\mcp\\server.js"]
    }
  }
}
```

Replace the path with your absolute path to `agent/dist/mcp/server.js` (run
`npm run build` first). Add `"--paid"` to `args` (or set env `AURA_PAID=1`) for
the metered demo tier.

### Paid tier — x402-style metering (demo)

With `--paid` (or `AURA_PAID=1`), every tool call is gated the way an
x402 / OKX Agent Payments Protocol integration would gate it:

1. A call without payment fails with an MCP error, code `402`, whose data is a
   402-style challenge:

   ```json
   {
     "code": 402,
     "scheme": "exact",
     "network": "eip155:1952",
     "asset": "0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3",
     "amount": "10000",
     "payTo": "0x831Fb0C6f8A96dE7c7253bF76C98a780d6E0f260"
   }
   ```

   `network` is X Layer testnet (chain id 1952, post-Terigon), `asset` is the
   native testnet USDC address (never USDC.e), and `amount` is $0.01 at USDC's
   6 decimals.

2. Retrying the same call with `{"payment": {"simulated": true}}` in the tool
   arguments succeeds, and the result carries a `receipt` field
   (`"settlement": "simulated"`).

Free mode (the default) never gates.

**Honest status:** this demonstrates the x402/OKX Agent Payments Protocol
*flow shape* with **simulated settlement** — no wallet is contacted, no
signature is verified, and no on-chain transfer occurs. Real settlement
(verifying a signed payment payload and settling native USDC on X Layer) is
roadmap, tracked in docs/ARCHITECTURE.md "Payments & fees".

## Layout

```
src/
  types.ts        domain language (Questionnaire, Parcel, DesignBrief, Budget, ...)
  pipeline.ts     pure functions: questionnaire -> brief -> budget -> milestones
  parcels.ts      LAND-stage parcel filter (district minimums are the hard gate)
  claude.ts       Claude narrative with deterministic offline fallback
  index.ts        demo CLI
  brain/          journey state machine, guidance, slip rules, digest, brain CLI
  mcp/
    server.ts     the aura-brain stdio server (tools/list, tools/call, 402 gate)
    tools.ts      the 10 tool definitions (zod schemas + handlers)
    payment.ts    x402-style demo metering (challenge, receipt, honest status)
    facts.ts      structured Alberta facts table for alberta_fact
    load.ts       data/sample loaders + partial-questionnaire merge (I/O only)
    smoke.ts      no-framework smoke driver for npm run mcp:smoke
samples/          questionnaire, parcels, and journey samples the tools default to
```

Anchors (run before claiming anything works): `npm run build`,
`npm run mcp:smoke`, `npm run demo`, `npm run brain` — the demo's budget must
reconcile to the dollar with `data/alberta/cost-model.json`.
