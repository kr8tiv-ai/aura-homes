import type { Metadata } from "next";
import XLayerProofLab from "./XLayerProofLab";

/* The lab is deliberately unlisted: reachable from /how-crypto-works, the
   story's blockchain journey, and the /escrow compatibility redirect — but
   kept out of search indexes because it demonstrates a mechanism on testnet,
   not a product Aura offers. */
export const metadata: Metadata = {
  title: "X Layer proof of lifecycle — Aura Labs",
  description:
    "A testnet lab demonstration: milestone lifecycle receipts read live from X Layer. A proof of mechanism, not a product promise.",
  robots: { index: false },
};

export default function XLayerProofPage() {
  return <XLayerProofLab />;
}
