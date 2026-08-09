// Smoke test for the aura-brain MCP server. No test framework: spawns the
// compiled stdio server twice (free mode, then paid mode) with the SDK client
// and drives initialize + tools/list + check_parcel + the x402 demo-tier
// 402 -> simulated-payment -> receipt round-trip, printing what it sees.
// Exit code 0 = all checks passed. Run: npm run mcp:smoke

import * as path from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

const SERVER_JS = path.join(__dirname, "server.js");

const EXPECTED_TOOLS = [
  "check_parcel",
  "generate_design_brief",
  "budget_estimate",
  "milestone_schedule",
  "journey_status",
  "next_actions",
  "detect_slips",
  "digest_preview",
  "supplier_directory",
  "alberta_fact",
  "journey_memory",
];

let failures = 0;
function check(ok: boolean, label: string): void {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures += 1;
}

async function connect(extraArgs: string[] = []): Promise<Client> {
  const client = new Client({ name: "aura-brain-smoke", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_JS, ...extraArgs],
  });
  await client.connect(transport);
  return client;
}

function resultJson(result: unknown): Record<string, unknown> {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
  const text = content?.find((c) => c.type === "text")?.text;
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

async function freeMode(): Promise<void> {
  console.log("\n=== FREE MODE (default: no gating) ===");
  const client = await connect();
  const info = client.getServerVersion();
  console.log(`initialize: connected to ${info?.name} v${info?.version}`);
  check(info?.name === "aura-brain", "initialize handshake returns server name aura-brain");

  // tools/list
  const { tools } = await client.listTools();
  console.log(`tools/list: ${tools.length} tools`);
  for (const t of tools) console.log(`  - ${t.name}`);
  check(tools.length === EXPECTED_TOOLS.length, `tools/list has ${EXPECTED_TOOLS.length} tools`);
  for (const name of EXPECTED_TOOLS) {
    check(tools.some((t) => t.name === name), `tool present: ${name}`);
  }

  // check_parcel over the bundled samples
  const raw = await client.callTool({ name: "check_parcel", arguments: {} });
  const parcelRun = resultJson(raw) as {
    designSqft: number;
    results: Array<{ parcel: { name: string }; verdict: string; reasons: string[] }>;
  };
  console.log(`check_parcel: ${parcelRun.designSqft} sqft design vs ${parcelRun.results.length} parcels`);
  for (const r of parcelRun.results) {
    console.log(`  ${r.verdict.padEnd(6)} ${r.parcel.name}`);
    if (r.verdict === "REJECT") console.log(`         ${r.reasons[0]}`);
  }
  const lakeside = parcelRun.results.find((r) => r.parcel.name === "Lakeside Estates");
  check(!!lakeside, "Lakeside Estates evaluated");
  check(lakeside?.verdict === "REJECT", "Lakeside Estates verdict is REJECT");
  check(
    !!lakeside?.reasons[0]?.includes("1,076"),
    "REJECT reason cites the 1,076 sqft Country Residential district minimum"
  );
  check(
    parcelRun.results.some((r) => r.verdict === "PASS"),
    "at least one parcel PASSes the same design"
  );

  await client.close();
}

async function paidMode(): Promise<void> {
  console.log("\n=== PAID MODE (--paid: x402 demo tier) ===");
  const client = await connect(["--paid"]);

  // 1. Unpaid call must fail with the 402-shaped challenge.
  let challenge: Record<string, unknown> | undefined;
  try {
    await client.callTool({ name: "check_parcel", arguments: {} });
    check(false, "unpaid call rejected with a 402 challenge");
  } catch (err) {
    const mcpErr = err instanceof McpError ? err : undefined;
    challenge = mcpErr?.data as Record<string, unknown> | undefined;
    console.log(`unpaid call -> MCP error code ${mcpErr?.code}`);
    console.log(`  challenge: ${JSON.stringify(challenge, null, 2).replace(/\n/g, "\n  ")}`);
    check(mcpErr?.code === 402, "error code is 402");
    check(challenge?.scheme === "exact", 'challenge scheme is "exact"');
    check(challenge?.network === "eip155:1952", "challenge network is eip155:1952 (X Layer testnet)");
    check(
      challenge?.asset === "0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3",
      "challenge asset is native testnet USDC"
    );
    check(challenge?.amount === "10000", "challenge amount is 10000 (= $0.01 at 6 decimals)");
    check(
      challenge?.payTo === "0x831Fb0C6f8A96dE7c7253bF76C98a780d6E0f260",
      "challenge payTo matches the demo pay-to address"
    );
  }

  // 2. Retry bearing the simulated payment must succeed and carry a receipt.
  const paidRaw = await client.callTool({
    name: "check_parcel",
    arguments: { payment: { simulated: true } },
  });
  const paidRun = resultJson(paidRaw) as {
    results?: Array<{ parcel: { name: string }; verdict: string }>;
    receipt?: Record<string, unknown>;
  };
  console.log(
    `paid call -> ${paidRun.results?.length ?? 0} verdicts + receipt:` +
      `\n  ${JSON.stringify(paidRun.receipt, null, 2).replace(/\n/g, "\n  ")}`
  );
  check(!!paidRun.results && paidRun.results.length > 0, "paid call returns the tool result");
  check(!!paidRun.receipt, "paid call result carries a receipt field");
  check(paidRun.receipt?.settlement === "simulated", 'receipt settlement is "simulated" (honest demo tier)');
  check(
    typeof paidRun.receipt?.note === "string" &&
      (paidRun.receipt.note as string).includes("No on-chain transfer occurred"),
    "receipt note states no on-chain transfer occurred"
  );

  await client.close();
}

async function main(): Promise<void> {
  console.log("aura-brain MCP smoke test");
  console.log(`server: ${SERVER_JS}`);
  await freeMode();
  await paidMode();
  console.log(`\n${failures === 0 ? "SMOKE PASSED" : `SMOKE FAILED (${failures} check(s))`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("smoke fatal:", err);
  process.exit(1);
});
