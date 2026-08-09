#!/usr/bin/env node
// aura-brain — the Aura Homes journey brain as an MCP server over stdio
// (docs/AI-BRAIN.md "Interface: MCP-first"). Ten typed tools wrap the existing
// aura-architect pipeline (LAND/DESIGN/BUDGET/ESCROW) and brain modules
// (journey state, guidance, slip detection, digest).
//
// Modes:
//   free (default)         — every tool call runs ungated.
//   paid (--paid/AURA_PAID=1) — x402-style DEMO metering: unpaid calls fail
//     with a 402-shaped MCP error (scheme/network/asset/amount/payTo); calls
//     bearing {payment: {simulated: true}} succeed and carry a receipt.
//     Settlement is SIMULATED — see ./payment.ts for the honest status.
//
// Run: node dist/mcp/server.js [--paid]

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  isPaidMode,
  makeReceipt,
  paymentArgSchema,
  X402_CHALLENGE,
} from "./payment";
import { ToolDef, TOOLS } from "./tools";

const SERVER_NAME = "aura-brain";
const SERVER_VERSION = "0.1.0";

const paid = isPaidMode();

/** Every tool accepts the optional x402-style payment argument. */
function fullSchema(tool: ToolDef): z.ZodObject<z.ZodRawShape> {
  return tool.schema.extend({ payment: paymentArgSchema });
}

const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(
    (tool): Tool => ({
      name: tool.name,
      description:
        tool.description +
        (paid ? " [Metered: $0.01 USDC per call — x402 demo tier, simulated settlement.]" : ""),
      inputSchema: z.toJSONSchema(fullSchema(tool)) as Tool["inputSchema"],
    })
  ),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = TOOLS.find((t) => t.name === request.params.name);
  if (!tool) {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
  }

  const parsed = fullSchema(tool).safeParse(request.params.arguments ?? {});
  if (!parsed.success) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid arguments for ${tool.name}: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ")}`
    );
  }

  // x402-style gate (demo tier). Free mode never gates.
  const { payment, ...args } = parsed.data as { payment?: { simulated?: boolean } };
  if (paid && payment?.simulated !== true) {
    throw new McpError(
      402,
      `Payment required: ${tool.name} is metered at $0.01 USDC per call (x402 demo tier). ` +
        `Retry with {"payment": {"simulated": true}} to simulate settlement.`,
      { ...X402_CHALLENGE }
    );
  }

  const result = await tool.handler(args as never);
  const payload = paid ? { ...result, receipt: makeReceipt() } : result;
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout carries the protocol; all logging goes to stderr.
  console.error(
    `[${SERVER_NAME}] MCP server ready on stdio — ${TOOLS.length} tools, mode: ` +
      (paid ? "paid (x402 demo tier, simulated settlement)" : "free (no gating)")
  );
}

main().catch((err) => {
  console.error(`[${SERVER_NAME}] fatal:`, err);
  process.exit(1);
});
