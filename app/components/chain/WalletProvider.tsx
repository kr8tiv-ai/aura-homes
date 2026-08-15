"use client";

// THE WALLET BOUNDARY (BN01).
//
// wagmi used to be mounted in app/app/providers.tsx, which the ROOT layout
// renders — so @wagmi/core and its storage layer sat in the module graph of
// every route. Someone who only wanted to design a house downloaded ~77 KB of
// wallet plumbing on the landing page, /build, /budget, /land and /projects.
//
// WHY A PER-SURFACE WRAPPER and not the two obvious alternatives:
//   · A (chain) route-group layout would be tidier, but it means MOVING
//     app/app/labs/xlayer-proof/XLayerProofLab.tsx, and tests/release-truth.
//     spec.ts:44 reads that file by path. A bundle fix has no business
//     breaking a copy-honesty gate, so the file stays where it is.
//   · next/dynamic({ ssr: false }) would defer the chunk instead of scoping
//     it, and a deferred chunk is invisible to the route HTML — which would
//     make tests/bundle-isolation.spec.ts unable to prove the chain surfaces
//     STILL have their wallet code. Static import keeps the win measurable.
//
// Mount this around any component that calls a wagmi hook. A wagmi hook
// rendered outside this provider throws at RUNTIME, not at build time — tsc
// will not catch it, so the rule is: the hooks live in a CHILD component,
// never in the same component that renders this provider.
//
// @tanstack/react-query lives here too, deliberately. It was imported in
// exactly one first-party file (app/app/providers.tsx) and nothing in this
// repo calls useQuery/useMutation directly — its only consumer is wagmi's
// query-backed hooks (useReadContract/useReadContracts in lib/hooks.ts). It
// belongs to the wallet, so it ships with the wallet. If a non-wallet surface
// ever needs it, hoist QueryClientProvider back to the root and relax the
// matching assertion in tests/bundle-isolation.spec.ts with the reason.
//
// WHAT MOVING THESE OUT OF THE ROOT COSTS, named rather than discovered:
//   · The QueryClient is per-boundary now, not one app-wide cache. A
//     client-side navigation from /labs/xlayer-proof to /operator/registry
//     starts with a cold cache and re-reads the chain instead of showing the
//     previous route's cached values. Both surfaces already render a loading
//     state, and the reads poll on a 20–30 s interval anyway.
//   · Auto-reconnect no longer runs on every page in the app; it starts when
//     a wallet surface mounts. A returning visitor can see one frame of the
//     "Connect wallet" state on arrival. wagmiConfig itself is still a single
//     module-level store (lib/wagmi.ts), so a live connection survives moving
//     between the two wallet surfaces.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

export default function WalletProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
