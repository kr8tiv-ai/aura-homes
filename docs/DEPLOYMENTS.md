# Deployments

## Custom domain — aurahomes.fun (LIVE DNS, 2026-08-09)

**The site's home is [aurahomes.fun](https://aurahomes.fun).** Configured end-to-end:
- Hostinger DNS zone (set via hPanel; the API token is expired — OPEN-QUESTIONS #9): apex `A @` → GitHub Pages IPs `185.199.108.153 / 109.153 / 110.153 / 111.153` (TTL 14400), `CNAME www` → `kr8tiv-ai.github.io` (TTL 300); the parking record deleted.
- GitHub Pages: `CNAME` file on `gh-pages` + custom domain registered on the repo. HTTPS cert auto-provisions after DNS propagates (15 min–24 h); then enforce HTTPS (`gh api -X PUT repos/kr8tiv-ai/aura-homes/pages -F https_enforced=true`).
- **Build-mode rule:** with the custom domain, the site serves at the domain ROOT — deploys now build **without** the `/aura-homes` basePath (`GH_PAGES=1` keeps the export mode; the basePath only applies when no custom domain is set). The old kr8tiv-ai.github.io/aura-homes URL 301s to the domain.

## Hosted web demo — GitHub Pages (decision 2026-08-09)

**LIVE: [https://kr8tiv-ai.github.io/aura-homes/](https://kr8tiv-ai.github.io/aura-homes/)** — all five pipeline pages verified serving (200): landing, /land, /design, /budget, /escrow, plus /dashboard. Ships from the `gh-pages` branch (static export: `GH_PAGES=1 npm run build` in `app/`, output pushed to the branch — no workflow file, no server). The Hostinger API token on this machine is expired (401 — re-mint is a founder task, tracked in OPEN-QUESTIONS); if re-minted later a custom domain can front this, but Pages is fully sufficient for judging.

## X Layer Testnet (chain 1952) — READY, awaiting 0.2 OKB

| | |
|---|---|
| Deployer (dev wallet) | `0x831Fb0C6f8A96dE7c7253bF76C98a780d6E0f260` |
| Key location | `contracts/.env` (gitignored, this machine only — throwaway dev key, holds nothing of value) |
| Chain ID | 1952 — verified live via `eth_chainId` against `https://testrpc.xlayer.tech/terigon` |
| Status | **Blocked on faucet OKB only.** The OKX faucet gates claims behind a GeeTest CAPTCHA, which our agents will not solve — by policy, CAPTCHAs are a human step. |

**The 30-second human step (Matt):** open [web3.okx.com/xlayer/faucet/xlayerfaucet](https://web3.okx.com/xlayer/faucet/xlayerfaucet), paste `0x831Fb0C6f8A96dE7c7253bF76C98a780d6E0f260`, click **Get 0.2 OKB**, solve the captcha. (Alternative: send ~0.2 testnet OKB to that address from any funded testnet wallet.)

**Then the deploy is one command** (any session, human or AI):

```bash
cd C:\Users\lucid\Desktop\aura-homes\contracts && npm run deploy:testnet
```

The script deploys `AuraBuildEscrow` (constructor: native testnet USDC `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3`, 1000 bps holdback, 60-day period) and `AuraBuildRegistry`, prints both addresses, and they must be recorded below + verified on the [OKLink testnet explorer](https://www.oklink.com/xlayer-test) before anything claims "deployed."

### Deployed addresses

| Contract | Testnet (1952) | Mainnet (196) |
|---|---|---|
| AuraBuildEscrow | *pending faucet* | — |
| AuraBuildRegistry | *pending faucet* | — |

## Mainnet (chain 196) — after testnet validation

Same command with `--network xlayer` (`npm run` script to be added at deploy time), funded with a few dollars of real OKB. Per hackathon rules: testnet during the event, mainnet after. Record here + OKLink links.
