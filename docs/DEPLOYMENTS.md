# Deployments

This ledger separates the currently executable configuration from prior deployments. Application code in `app/lib/contracts.ts` and `app/lib/chains.ts` is the source of truth for the browser experience; the values below were independently read from X Layer testnet before publication.

## Web production — aurahomes.fun

Aura Homes is served as a static GitHub Pages export at [aurahomes.fun](https://aurahomes.fun).

| Surface | Configuration |
| --- | --- |
| Source | `main` in `kr8tiv-ai/aura-homes` |
| Production output | `gh-pages` |
| Export command | `GH_PAGES=1 npm run build` from `app/` |
| DNS | Hostinger-managed apex A records to GitHub Pages; `www` CNAME to `kr8tiv-ai.github.io` |
| Domain files | `CNAME` and `.nojekyll` are preserved on every deployment |

The custom domain serves from `/`, so production builds do not use the historical `/aura-homes` base path. Hostinger remains the registrar and DNS provider; the Hostinger VPS is reserved for the later evidence-grounded API and is not required to serve the current static application.

## Current X Layer testnet proof — deployed 2026-08-12

| Field | Value |
| --- | --- |
| Network | X Layer testnet |
| Chain ID | `1952` |
| RPC used for read-back | `https://testrpc.xlayer.tech/terigon` |
| Deployer / current dev roles | `0x831Fb0C6f8A96dE7c7253bF76C98a780d6E0f260` |
| Settlement token | `0xcB8BF24c6cE16Ad21D707c9505421a17f2bec79D` — 6-decimal faucet-compatible test USDC |
| Verification | Non-empty bytecode, successful creation receipts, constructor getters, registry owner and zero-state token count read over JSON-RPC |
| Test suite | `24 passing` in the Hardhat suite at the release checkpoint |

### Executable addresses

| Contract | Address | Creation proof |
| --- | --- | --- |
| `AuraBuildEscrow` | [`0x4A777bf71d8809244c77A3c2b39ef68793A463b5`](https://www.oklink.com/xlayer-test/address/0x4A777bf71d8809244c77A3c2b39ef68793A463b5) | [tx `0x19129a…8bbce`](https://www.oklink.com/xlayer-test/tx/0x19129a38eeb9a72531ad9c21a5fb93737814b2e17b533eb2ad9cc595f648bbce), block `38,035,193`, status `1`, 1,784,131 gas |
| `AuraBuildRegistry` | [`0x1195ED713EEF2Adc32DcF5Bb1c4627F43f1EC32e`](https://www.oklink.com/xlayer-test/address/0x1195ED713EEF2Adc32DcF5Bb1c4627F43f1EC32e) | [tx `0xd3e783…30800`](https://www.oklink.com/xlayer-test/tx/0xd3e783c02b803256865593081a7442062949b341884dbce32d5a23632c430800), block `38,035,190`, status `1`, 1,428,427 gas |

The escrow creation block was timestamped `2026-08-12 00:54:38 UTC`. A later verification read at block `38,053,635` returned:

- deployed bytecode: 7,910 bytes for `AuraBuildEscrow`, 6,003 bytes for `AuraBuildRegistry`, and 1,798 bytes for the test USDC;
- escrow `usdc`: `0xcB8BF24c6cE16Ad21D707c9505421a17f2bec79D`;
- `holdbackBps`: `1000` (10%);
- `holdbackPeriod`: `5,184,000` seconds (60 days);
- `refundWindow`: `1,209,600` seconds (14 days);
- escrow `state`: `0` (`Active`);
- homeowner, builder, and arbiter: the dev address above;
- registry `owner`: the dev address above; and
- registry `nextTokenId`: `0` — an honest public zero state, with no home record minted.

### Application configuration

```ts
export const XLAYER_TESTNET = {
  chainId: 1952,
  rpc: "https://testrpc.xlayer.tech/terigon",
  escrow: "0x4A777bf71d8809244c77A3c2b39ef68793A463b5",
  registry: "0x1195ED713EEF2Adc32DcF5Bb1c4627F43f1EC32e",
  usdc: "0xcB8BF24c6cE16Ad21D707c9505421a17f2bec79D",
};
```

### What this deployment proves — and what it does not

The contracts prove that Aura's reservation deposit, refund window, milestone funding, multi-party release, holdback, and design/budget registry model can execute on X Layer testnet. The browser verifies the selected network, allowance, transaction receipt events, and stored hashes.

This is development wiring, not a live construction escrow:

- homeowner, builder, and arbiter currently resolve to one dev wallet;
- the settlement asset is a test token with no monetary value;
- registry state remains empty until an owner-only test flow records a build;
- explorer source verification is still a separate release task; and
- X Layer mainnet, HOMES, staking, the property trust, and owner project vaults are not deployed.

Before a real pilot, Aura must deploy a project-specific escrow with distinct parties, verify source on the explorer, complete independent contract review, and exercise the entire lifecycle with the intended counterparties.

## Retired testnet deployment — preserved for provenance

The first X Layer deployment remains public but is no longer used by the application because it was constructed against a retired test token.

| Contract | Retired address | Creation record |
| --- | --- | --- |
| `AuraBuildEscrow` | [`0xCe0562ABC9e1d05C219E14b519d5A176582e58bd`](https://www.oklink.com/xlayer-test/address/0xCe0562ABC9e1d05C219E14b519d5A176582e58bd) | [tx `0x49e38f…b4a91`](https://www.oklink.com/xlayer-test/tx/0x49e38f4ccb65f6bdbaa169b9e19923ecb33999d3c4f42df4562d3b6cc88b4a91), block `37,930,116` |
| `AuraBuildRegistry` | [`0x7478E68576a8B1D48954403132FBB4cB878de4A4`](https://www.oklink.com/xlayer-test/address/0x7478E68576a8B1D48954403132FBB4cB878de4A4) | [tx `0x36afd8…d756f`](https://www.oklink.com/xlayer-test/tx/0x36afd840e2ec58f44ee9face6f24e496c5e9557f5329d0c55eadc71ba97d756f), block `37,930,112` |

Retired escrow token: `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3`. These addresses are retained only to make the deployment history auditable.

## Redeploying to testnet

The deployer key is read from `PRIVATE_KEY`; never commit it.

```bash
cd contracts
npm install
npm test
npm run deploy:testnet
```

Record the new addresses, creation transactions, constructor getters, roles, bytecode, and registry zero state here before changing application configuration.

## Mainnet — not deployed

X Layer mainnet uses chain ID `196`. Aura remains testnet-only. No mainnet contract, real customer funds, HOMES token, trust, staking contract, property vault, exchange market, or automated bridge is part of the current release.
