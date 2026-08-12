"use client";

/* /escrow → /labs/xlayer-proof. The founder's call: "get rid of the escrow
   talk… it isn't a problem we're solving." The testnet content itself moved
   to the lab page, reframed as an X Layer proof-of-lifecycle demo. */

import LegacyRedirect from "@/components/LegacyRedirect";

export default function EscrowRedirect() {
  return (
    <LegacyRedirect
      to="/labs/xlayer-proof"
      label="Open the X Layer proof-of-lifecycle lab"
      note="The testnet demonstration that lived here is now an Aura Labs page: the same live chain reads, framed as a proof of mechanism rather than a product."
    />
  );
}
