# Aura Homes — Contracts

Hardhat project for the Aura Homes on-chain layer on X Layer.

## Contracts

- **AuraBuildEscrow.sol** — milestone escrow for one home build, settled in native USDC.
  Roles: homeowner (payer), builder (payee), arbiter (tie-breaker). Releases need 2-of-3
  approval. Every release retains a statutory holdback (default 10%, configurable in basis
  points) that only matures after a holdback period (default 60 days) — modeling Alberta's
  Prompt Payment and Construction Lien Act. Cancellation also needs 2-of-3 and refunds all
  funded-but-unreleased milestones to the homeowner.
- **AuraBuildRegistry.sol** — ERC-721 build registry (the RWA anchor). Each token stores
  designHash, budgetHash, escrow address, and status (Designed / Funded / UnderConstruction /
  Complete). Mint/update restricted to the linked escrow's homeowner or an approved registrar.
- **test/MockUSDC.sol** — 6-decimal test token, tests only.

## Setup

```bash
npm install
npm test
```

## Networks

| Network | Chain ID | RPC | Gas token |
| --- | --- | --- | --- |
| `xlayerTestnet` | 1952 | https://testrpc.xlayer.tech/terigon | OKB |
| `xlayer` (mainnet) | 196 | https://rpc.xlayer.tech | OKB |

- Explorer (mainnet): https://www.oklink.com/xlayer
- Faucet (testnet): https://web3.okx.com/xlayer/faucet

Native USDC (6 decimals) — always native, never bridged USDC.e:

| Network | USDC address |
| --- | --- |
| Mainnet (196) | `0xB6CEceAB302E2E4948951eE7843FC24E92933061` |
| Testnet (1952) | `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3` |

## Deploying

The deployer key is read from the `PRIVATE_KEY` environment variable. Never hardcode keys
or commit them; `.env` is gitignored.

```bash
# PowerShell
$env:PRIVATE_KEY = "0x..."
npm run deploy:testnet

# bash
PRIVATE_KEY=0x... npm run deploy:testnet
```

(`npm run deploy:testnet` wraps `npx hardhat run scripts/deploy.js --network xlayerTestnet`.)

Constructor for `AuraBuildEscrow`: `(usdc, homeowner, builder, arbiter, holdbackBps, holdbackPeriod)`.
Pass `0, 0` for the defaults (1000 bps = 10%, 60 days).
