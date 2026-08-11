"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { zeroAddress, type Hex } from "viem";

import type { BuilderOrderSnapshot } from "@/lib/builder/orderSnapshot";
import { loadLatestBuilderOrderSnapshot } from "@/lib/builder/orderSnapshot";
import { auraBuildRegistryAbi } from "@/lib/escrowAbi";
import {
  CHAIN_ID,
  ESCROW_ADDRESS,
  REGISTRY_ADDRESS,
  oklinkTx,
  shortAddr,
} from "@/lib/contracts";
import { fmtUsdcUnits, useEscrowLive } from "@/lib/hooks";
import {
  confirmRegistryMintReceipt,
  describeTransactionFailure,
  verifyRegistryRecord,
} from "@/lib/payments/xLayerLifecycle";

type Busy = null | "authorize" | "register";

interface Verification {
  tokenId: bigint;
  transactionHash: `0x${string}`;
  status: number;
}

const registryContract = {
  abi: auraBuildRegistryAbi,
  address: REGISTRY_ADDRESS,
  chainId: CHAIN_ID,
} as const;

export default function OperatorRegistryApp() {
  const [projectId, setProjectId] = useState("");
  const [snapshot, setSnapshot] = useState<BuilderOrderSnapshot | null>(null);
  const [notice, setNotice] = useState(
    "Load a locally saved, current quote. Full project and budget documents stay off-chain.",
  );
  const [busy, setBusy] = useState<Busy>(null);
  const [verification, setVerification] = useState<Verification | null>(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const live = useEscrowLive();
  const registrar = useReadContract({
    ...registryContract,
    functionName: "registrars",
    args: [address ?? zeroAddress],
    query: { enabled: !!address, refetchInterval: 30_000 },
  });

  const rightChain = chainId === CHAIN_ID;
  const isOwner =
    !!address && !!live.registryOwner && address.toLowerCase() === live.registryOwner.toLowerCase();
  const isRegistrar = registrar.data === true;
  const depositRecorded =
    live.depositAmount !== undefined &&
    live.depositAmount > BigInt(0) &&
    live.depositRefunded === false;
  const quoteCurrent =
    !!snapshot?.quote && Date.parse(snapshot.quote.validUntilISO) >= Date.now();

  useEffect(() => {
    const project = new URLSearchParams(window.location.search).get("project");
    if (project) setProjectId(project.slice(0, 96));
  }, []);

  const loadProject = async () => {
    setVerification(null);
    try {
      const loaded = await loadLatestBuilderOrderSnapshot(projectId, { requireQuote: true });
      setSnapshot(loaded);
      if (loaded.quote && Date.parse(loaded.quote.validUntilISO) < Date.now()) {
        setNotice(
          `Quote ${loaded.id} expired ${loaded.quote.validUntilISO}. Return to the concierge for a fresh immutable quote before registering it.`,
        );
      } else {
        setNotice(
          `Loaded ${loaded.id}. Design ${loaded.artifactHashes.designDocument}; budget ${loaded.artifactHashes.budget}.`,
        );
      }
    } catch (cause) {
      setSnapshot(null);
      setNotice(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const authorizeOperator = async () => {
    if (!address || !publicClient || !isOwner) return;
    setBusy("authorize");
    try {
      const hash = await writeContractAsync({
        ...registryContract,
        functionName: "setRegistrar",
        args: [address, true],
      });
      setNotice(`Operator authorization submitted — ${hash}. Waiting for the X Layer receipt.`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Operator authorization transaction reverted.");
      await registrar.refetch();
      setNotice(`Operator authorization confirmed · ${oklinkTx(hash)}`);
    } catch (cause) {
      setNotice(describeTransactionFailure(cause, "register"));
    } finally {
      setBusy(null);
    }
  };

  const registerBuild = async () => {
    if (!address || !publicClient || !snapshot?.quote || !snapshot.artifactHashes.budget) return;
    setBusy("register");
    setVerification(null);
    const expected = {
      designHash: snapshot.artifactHashes.designDocument as Hex,
      budgetHash: snapshot.artifactHashes.budget as Hex,
      escrow: ESCROW_ADDRESS,
    };
    try {
      const hash = await writeContractAsync({
        ...registryContract,
        functionName: "mint",
        args: [
          address,
          expected.designHash,
          expected.budgetHash,
          ESCROW_ADDRESS,
          `urn:aura:order:${encodeURIComponent(snapshot.id)}`,
        ],
      });
      setNotice(`Build registration submitted — ${hash}. Waiting for BuildMinted.`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const minted = confirmRegistryMintReceipt(receipt, REGISTRY_ADDRESS, expected);
      const [record, tokenOwner] = await Promise.all([
        publicClient.readContract({
          ...registryContract,
          functionName: "records",
          args: [minted.tokenId],
        }),
        publicClient.readContract({
          ...registryContract,
          functionName: "ownerOf",
          args: [minted.tokenId],
        }),
      ]);
      const checked = verifyRegistryRecord(
        { ...expected, owner: address },
        {
          designHash: record[0],
          budgetHash: record[1],
          escrow: record[2],
          status: Number(record[3]),
          owner: tokenOwner,
        },
      );
      if (!checked.ok) throw new Error(checked.problem);
      setVerification({ tokenId: minted.tokenId, transactionHash: minted.transactionHash, status: Number(record[3]) });
      setNotice(
        `Build record #${minted.tokenId} verified from chain read-back: owner, escrow, design hash and budget hash all match.`,
      );
      live.refetch();
    } catch (cause) {
      setNotice(describeTransactionFailure(cause, "register"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="py-16">
      <p className="aura-label mb-4">Restricted testnet operations</p>
      <h1 className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]">
        Build registry operator
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-aura-text/75">
        This unlisted surface creates the public build record after a real reservation deposit. It
        stores only the canonical design and budget hashes; complete documents remain in the local
        order snapshot. A refundable deposit creates a <em>Designed</em> record—not a funded-build
        claim. Funded status waits for deposit conversion after the cooling-off window.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="aura-panel p-6">
          <p className="aura-label">1 · Immutable quote</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              aria-label="Builder project identifier"
              placeholder="project-…"
              className="min-w-[240px] flex-1 rounded-md border aura-hairline bg-aura-bg px-4 py-2.5 font-mono text-xs"
            />
            <button
              onClick={loadProject}
              disabled={!projectId.trim()}
              className="rounded-md border aura-hairline px-4 py-2.5 text-xs font-medium uppercase tracking-label hover:border-aura-emerald disabled:opacity-40"
            >
              Load current quote
            </button>
          </div>
          <p className="mt-4 break-words text-xs leading-relaxed text-aura-text/70" role="status">
            {notice}
          </p>
          {snapshot?.quote && (
            <dl className="mt-5 grid gap-3 border-t aura-hairline pt-5 text-xs sm:grid-cols-2">
              <div><dt className="text-aura-text/55">Project</dt><dd className="mt-1 font-mono">{snapshot.projectId}</dd></div>
              <div><dt className="text-aura-text/55">Quote valid until</dt><dd className="mt-1 font-mono">{snapshot.quote.validUntilISO}</dd></div>
              <div className="sm:col-span-2"><dt className="text-aura-text/55">Design hash</dt><dd className="mt-1 break-all font-mono">{snapshot.artifactHashes.designDocument}</dd></div>
              <div className="sm:col-span-2"><dt className="text-aura-text/55">Budget hash</dt><dd className="mt-1 break-all font-mono">{snapshot.artifactHashes.budget}</dd></div>
            </dl>
          )}
        </section>

        <aside className="aura-panel p-6">
          <p className="aura-label">2 · Operator gate</p>
          {!isConnected ? (
            <div className="mt-4 space-y-2">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  disabled={connecting}
                  className="block w-full rounded-md border aura-hairline px-4 py-2.5 text-xs uppercase tracking-label hover:border-aura-emerald disabled:opacity-40"
                >
                  {connecting ? "Connecting" : `Connect ${connector.name}`}
                </button>
              ))}
              {connectors.length === 0 && <p className="text-xs text-aura-text/70">No injected wallet detected.</p>}
            </div>
          ) : !rightChain ? (
            <button
              onClick={() => switchChain({ chainId: CHAIN_ID })}
              disabled={switching}
              className="mt-4 w-full rounded-md border border-aura-emerald px-4 py-2.5 text-xs uppercase tracking-label text-aura-emerald disabled:opacity-40"
            >
              {switching ? "Switching" : "Switch to X Layer testnet"}
            </button>
          ) : !isOwner ? (
            <p className="mt-4 text-xs leading-relaxed text-aura-text/75">
              Connected as {shortAddr(address)}. This is not the on-chain registry owner
              ({shortAddr(live.registryOwner)}), so no operator transaction controls are exposed.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-xs leading-relaxed text-aura-text/75">
                Owner {shortAddr(address)} · deposit {fmtUsdcUnits(live.depositAmount)} · {depositRecorded ? "eligible" : "not eligible"}
              </p>
              {!isRegistrar ? (
                <button
                  onClick={authorizeOperator}
                  disabled={busy !== null}
                  className="w-full rounded-md border border-aura-emerald px-4 py-2.5 text-xs font-medium uppercase tracking-label text-aura-emerald disabled:opacity-40"
                >
                  {busy === "authorize" ? "Authorizing" : "Authorize this owner as registrar"}
                </button>
              ) : (
                <button
                  onClick={registerBuild}
                  disabled={!snapshot || !quoteCurrent || !depositRecorded || busy !== null || verification !== null}
                  className="w-full rounded-md bg-aura-ink px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-label text-aura-paper disabled:opacity-35"
                >
                  {busy === "register" ? "Registering and verifying" : "Create designed build record"}
                </button>
              )}
              {!depositRecorded && (
                <p className="text-[10px] uppercase tracking-label text-aura-violet">
                  Blocked until DepositPlaced exists and has not been refunded
                </p>
              )}
              {snapshot && !quoteCurrent && (
                <p className="text-[10px] uppercase tracking-label text-aura-violet">
                  Blocked because the quote is stale
                </p>
              )}
              <button onClick={() => disconnect()} className="text-xs text-aura-text/60 underline">Disconnect</button>
            </div>
          )}
          {verification && (
            <div className="mt-5 rounded-md border border-aura-emerald/50 bg-aura-emerald/[0.05] p-4 text-xs leading-relaxed">
              <p className="font-semibold text-aura-emerald">Verified on chain</p>
              <p className="mt-1">Token #{verification.tokenId.toString()} · status {verification.status === 0 ? "Designed" : verification.status}</p>
              <a href={oklinkTx(verification.transactionHash)} target="_blank" rel="noreferrer" className="mt-2 block break-all font-mono text-aura-emerald underline">{verification.transactionHash}</a>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
