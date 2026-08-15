import type { Metadata } from "next";
import WalletProvider from "@/components/chain/WalletProvider";
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

/* BN01: the wallet boundary is mounted HERE rather than inside
   XLayerProofLab, because the lab calls useAccount/useConnect/useChainId in
   its own body — a component cannot provide the context its own hooks read.
   Wrapping at the page keeps XLayerProofLab.tsx untouched, which matters:
   tests/release-truth.spec.ts:44 reads that file by path. */
export default function XLayerProofPage() {
  return (
    <WalletProvider>
      <XLayerProofLab />
    </WalletProvider>
  );
}
