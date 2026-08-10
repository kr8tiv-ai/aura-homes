// Order persistence for the MCP server — server-side only (fs). The app never
// imports this file; it imports the pure modules (order/reducer/catalog).
// Orders live as JSON under agent/out/concierge/, one file per order, same
// convention as the memory store (agent/out/memory).

import * as fs from "fs";
import * as path from "path";
import { Order } from "./order";

const OUT_DIR = path.join(__dirname, "..", "..", "out", "concierge");

export function orderPath(orderId: string): string {
  return path.join(OUT_DIR, `${orderId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
}

export function saveOrder(order: Order): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(orderPath(order.id), JSON.stringify(order, null, 2));
}

export function loadOrder(orderId: string): Order | undefined {
  const file = orderPath(orderId);
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8")) as Order;
}

export function listOrders(): Array<{ id: string; status: string; createdAtISO: string }> {
  if (!fs.existsSync(OUT_DIR)) return [];
  return fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const o = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), "utf8")) as Order;
      return { id: o.id, status: o.status, createdAtISO: o.createdAtISO };
    })
    .sort((a, b) => a.createdAtISO.localeCompare(b.createdAtISO));
}
