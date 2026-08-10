# Deployments

## Custom domain — aurahomes.fun (LIVE DNS, 2026-08-09)

**The site's home is [aurahomes.fun](https://aurahomes.fun).** Configured end-to-end:
- Hostinger DNS zone (set via hPanel; the API token is expired — OPEN-QUESTIONS #9): apex `A @` → GitHub Pages IPs `185.199.108.153 / 109.153 / 110.153 / 111.153` (TTL 14400), `CNAME www` → `kr8tiv-ai.github.io` (TTL 300); the parking record deleted.
- GitHub Pages: `CNAME` file on `gh-pages` + custom domain registered on the repo. HTTPS cert auto-provisions after DNS propagates (15 min–24 h); then enforce HTTPS (`gh api -X PUT repos/kr8tiv-ai/aura-homes/pages -F https_enforced=true`).
- **Build-mode rule:** with the custom domain, the site serves at the domain ROOT — deploys now build **without** the `/aura-homes` basePath (`GH_PAGES=1` keeps the export mode; the basePath only applies when no custom domain is set). The old kr8tiv-ai.github.io/aura-homes URL 301s to the domain.

## Hosted web demo — GitHub Pages (decision 2026-08-09)

**LIVE: [https://kr8tiv-ai.github.io/aura-homes/](https://kr8tiv-ai.github.io/aura-homes/)** — all five pipeline pages verified serving (200): landing, /land, /design, /budget, /escrow, plus /dashboard. Ships from the `gh-pages` branch (static export: `GH_PAGES=1 npm run build` in `app/`, output pushed to the branch — no workflow file, no server). The Hostinger API token on this machine is expired (401 — re-mint is a founder task, tracked in OPEN-QUESTIONS); if re-minted later a custom domain can front this, but Pages is fully sufficient for judging.

## X Layer Testnet (chain 1952) — DEPLOYED 2026-08-10

| | |
|---|---|
| Deployer (dev wallet) | `0x831Fb0C6f8A96dE7c7253bF76C98a780d6E0f260` |
| Key location | `contracts/.env` (gitignored, this machine only — throwaway dev key, holds nothing of value) |
| Chain ID | 1952 — re-verified live via `eth_chainId` against `https://testrpc.xlayer.tech/terigon` immediately before deploy |
| Funding | Faucet 0.2 OKB landed 2026-08-10. Both deploys cost ~0.0000643 OKB combined; **0.19993 OKB remains** for demo transactions |
| Status | **DEPLOYED & VERIFIED ON-CHAIN.** 21/21 hardhat tests green immediately before deploy. Post-deploy proof (not assumed): `eth_getCode` non-empty at both addresses, constructor getters read back and matched, both OKLink pages resolve (HTTP 200). |

### Deployed addresses

| Contract | Testnet (1952) | Mainnet (196) |
|---|---|---|
| AuraBuildEscrow | [`0xCe0562ABC9e1d05C219E14b519d5A176582e58bd`](https://www.oklink.com/xlayer-test/address/0xCe0562ABC9e1d05C219E14b519d5A176582e58bd) | — |
| AuraBuildRegistry | [`0x7478E68576a8B1D48954403132FBB4cB878de4A4`](https://www.oklink.com/xlayer-test/address/0x7478E68576a8B1D48954403132FBB4cB878de4A4) | — |

### Deployment record (2026-08-10)

| | AuraBuildEscrow | AuraBuildRegistry |
|---|---|---|
| Address | `0xCe0562ABC9e1d05C219E14b519d5A176582e58bd` | `0x7478E68576a8B1D48954403132FBB4cB878de4A4` |
| Deploy tx | [`0x49e38f4ccb65f6bdbaa169b9e19923ecb33999d3c4f42df4562d3b6cc88b4a91`](https://www.oklink.com/xlayer-test/tx/0x49e38f4ccb65f6bdbaa169b9e19923ecb33999d3c4f42df4562d3b6cc88b4a91) | [`0x36afd840e2ec58f44ee9face6f24e496c5e9557f5329d0c55eadc71ba97d756f`](https://www.oklink.com/xlayer-test/tx/0x36afd840e2ec58f44ee9face6f24e496c5e9557f5329d0c55eadc71ba97d756f) |
| Block | 37,930,116 (status 1) | 37,930,112 (status 1) |
| Gas used | 1,784,131 @ 0.02 gwei | 1,428,427 @ 0.02 gwei |
| Deployed bytecode | 7,910 bytes | 6,003 bytes |

**Escrow parameters (read back on-chain post-deploy, not from the script):** `usdc` = `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3` (native testnet USDC — its bytecode was confirmed non-empty *before* deploying against it), `holdbackBps` = 1000 (10%), `holdbackPeriod` = 5,184,000 s (60 days), `refundWindow` = 1,209,600 s (14 days), `state` = Active. Registry: `owner` = deployer, `nextTokenId` = 0 (nothing minted yet).

**Honest caveats:**
- Homeowner, builder, and arbiter all default to the deployer address — **dev-only wiring**. The demo buy flow (U4) should deploy or configure an escrow instance with distinct role addresses before filming 2-of-3 approvals.
- Contract *source* is not yet verified on OKLink — the bytecode is live and every getter is publicly readable, but the explorer shows unverified source until the optional source-verify pass is done.
- The deploy script's immediate post-deploy getter read hit RPC lag once (returned `0x`); a separate verification pass ~1 minute later read every getter clean. Trust the read-back values above, which are that pass.

**For the app team (U4/U5 wiring):**

```ts
export const XLAYER_TESTNET = {
  chainId: 1952,
  rpc: "https://testrpc.xlayer.tech/terigon",
  escrow: "0xCe0562ABC9e1d05C219E14b519d5A176582e58bd",
  registry: "0x7478E68576a8B1D48954403132FBB4cB878de4A4",
  usdc: "0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3", // native USDC, 6 decimals
};
```

**Redeploy, if ever needed** (any session, human or AI — `contracts/.env` now loads automatically via `hardhat.config.js`):

```bash
cd C:\Users\lucid\Desktop\aura-homes\contracts && npm run deploy:testnet
```

The script deploys `AuraBuildEscrow` (constructor: native testnet USDC `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3`, 1000 bps holdback, 60-day period, 14-day refund window) and `AuraBuildRegistry`, prints both addresses, and they must be recorded here + verified on the [OKLink testnet explorer](https://www.oklink.com/xlayer-test) before anything claims "deployed."

## Mainnet (chain 196) — after testnet validation

Same command with `--network xlayer` (`npm run` script to be added at deploy time), funded with a few dollars of real OKB. Per hackathon rules: testnet during the event, mainnet after. Record here + OKLink links.
