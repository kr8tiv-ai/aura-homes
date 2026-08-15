"use client";

// ROOT PROVIDERS — everything here is paid for by every route, so nothing
// belongs here that only some routes need.
//
// BN01 removed two of them. WagmiProvider and QueryClientProvider used to wrap
// the whole application from this file, which put @wagmi/core and its storage
// layer into the module graph of the landing page, /build, /budget, /land and
// /projects — routes that never touch a wallet. They now mount per-surface in
// components/chain/WalletProvider.tsx, around the only three components that
// call wagmi hooks (XLayerProofLab, OperatorRegistryApp, ConciergeApp).
//
// AuraProjectProvider stays: it is the local-first project context and it is
// read on /land, /budget and by the builder, the project spine, the library,
// the catalogue and the contractor workbench — genuinely root-level.

import { AuraProjectProvider } from "@/components/project/ProjectContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuraProjectProvider>{children}</AuraProjectProvider>;
}
