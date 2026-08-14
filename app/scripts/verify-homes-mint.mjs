/* VT03 — verify the live HOMES mint on-chain (X Layer mainnet 196).
 *
 * Reads the ERC-20 surface of the founder-launched token directly from the
 * public RPC and writes the artifact the /homes page (and any doc) may cite:
 * data/homes/mint-verification.json. Until this artifact exists and is
 * surfaced, the 30/10/10/20/30 supply split must be labelled a design
 * target, never the live distribution.
 *
 * Read-only. No keys, no writes, no dependencies beyond fetch.
 * Run from app/:  node scripts/verify-homes-mint.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RPC = "https://rpc.xlayer.tech";
const TOKEN = "0x642855d557ada1eba8a66014aaff902e6394c0de";
const HOLDERS = {
  creatorWallet: "0x5e8abc953f4d685943f1a0a730afffbba9df41de",
  xlaunchLocker: "0xa5c6b1a1b76d3db979381faede0cdbd4e089e47b",
  wspcxxPool: "0xf59d07dfe38807b398f0b4697f187d2f943b06a4",
};

const SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
};

let rpcId = 0;
async function rpc(method, params) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  if (!response.ok) throw new Error(`${method} HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

const call = (data) => rpc("eth_call", [{ to: TOKEN, data }, "latest"]);
const decodeUint = (hex) => BigInt(hex);
function decodeString(hex) {
  const raw = hex.slice(2);
  const length = Number(BigInt(`0x${raw.slice(64, 128)}`));
  const bytes = raw.slice(128, 128 + length * 2);
  return Buffer.from(bytes, "hex").toString("utf8");
}
const balanceOf = (address) =>
  call(`0x70a08231${address.slice(2).toLowerCase().padStart(64, "0")}`).then(decodeUint);

const chainIdHex = await rpc("eth_chainId", []);
const chainId = Number(BigInt(chainIdHex));
if (chainId !== 196) throw new Error(`Expected X Layer mainnet 196, RPC reports ${chainId}`);
const blockHex = await rpc("eth_blockNumber", []);

const [name, symbol, decimalsHex, totalSupplyHex] = await Promise.all([
  call(SELECTORS.name).then(decodeString),
  call(SELECTORS.symbol).then(decodeString),
  call(SELECTORS.decimals).then(decodeUint),
  call(SELECTORS.totalSupply).then(decodeUint),
]);
const decimals = Number(decimalsHex);
const totalSupply = decodeUint(`0x${totalSupplyHex.toString(16)}`);

const balances = {};
for (const [label, address] of Object.entries(HOLDERS)) {
  balances[label] = { address, raw: (await balanceOf(address)).toString() };
}

const asTokens = (raw) => Number(BigInt(raw) / BigInt(10 ** Math.max(0, decimals - 6))) / 1e6;
const pct = (raw) => totalSupply > 0n ? Number((BigInt(raw) * 10_000n) / totalSupply) / 100 : null;
for (const entry of Object.values(balances)) {
  entry.tokens = asTokens(entry.raw);
  entry.percentOfSupply = pct(entry.raw);
}

const artifact = {
  schema: "HomesMintVerificationV1",
  verifiedAt: new Date().toISOString(),
  rpc: RPC,
  chainId,
  block: Number(BigInt(blockHex)),
  token: { address: TOKEN, name, symbol, decimals },
  totalSupply: { raw: totalSupply.toString(), tokens: asTokens(totalSupply.toString()) },
  knownHolders: balances,
  notes: [
    "Read directly from the public X Layer RPC; no indexer, no third-party API.",
    "knownHolders covers only the addresses the site already publishes (creator, venue locker, pool). A full holder census needs an indexer and is out of scope here.",
    "Compare knownHolders percentages against the DESIGN split (30/10/10/20/30) before ever presenting a design number as live.",
  ],
};

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "homes");
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, "mint-verification.json");
await writeFile(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify(artifact, null, 2));
