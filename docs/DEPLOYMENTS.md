# Deployments

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
