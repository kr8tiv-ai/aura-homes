"use client";

// THE BUY FLOW — a chat over the agent's deterministic concierge reducer
// (agent/src/concierge/reducer.ts, imported directly — one source of truth).
// Every reply is computed from the real data: catalog, parcels, cost model.
// No model call, no key, no canned transcript.
//
// Honesty rules enforced here:
//  - The refund window shown with any quote comes from the CHAIN
//    (AuraBuildEscrow.refundWindow(), 14 days as deployed) — never a constant.
//    If the RPC read has not landed, the fallback figure is labeled as such.
//  - A transaction is either real (wallet, chain 1952, receipt, OKLink link)
//    or it does not happen. The walkthrough path is labeled "no transaction"
//    at every step; nothing simulated is ever presented as on-chain.
//  - The land gate binds BUY: disabled, with the bylaw citation visible,
//    until the chosen parcel passes for the chosen home.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
  type Connector,
} from "wagmi";
import type { ConciergeAction, ConciergeIntent } from "@agent/concierge/reducer";
import { reduce } from "@agent/concierge/reducer";
import type { Order } from "@agent/concierge/order";
import { createOrder, fmtCad, fmtUsdc6 } from "@agent/concierge/order";
import { buildContext, chipsForStatus, parseIntent } from "@/lib/concierge";
import { CHAIN_ID, ESCROW_ADDRESS, FAUCET_URL, USDC_TESTNET, oklinkTx, shortAddr } from "@/lib/contracts";
import { auraBuildEscrowAbi, erc20Abi, fmtUsdcUnits, useEscrowLive, useUsdcState } from "@/lib/hooks";
import type { BuilderOrderSnapshot } from "@/lib/builder/orderSnapshot";
import {
  confirmDepositReceipt,
  confirmRefundReceipt,
  describeTransactionFailure,
} from "@/lib/payments/xLayerLifecycle";
import LiveEscrowCard from "@/components/chain/LiveEscrowCard";
import WalletProvider from "@/components/chain/WalletProvider";
import { Counter, GrowBar, Reveal, Stagger, StaggerItem } from "@/components/Reveal";

/* Counter restarts its rAF whenever `format` changes identity, and this tree
   re-renders on every message and once a second while the refund countdown
   runs. Module scope keeps the formatters stable so each figure counts up
   once and then holds. */
const cadWhole = (n: number) => fmtCad(Math.round(n));
const asInt = (n: number) => Math.round(n).toLocaleString("en-CA");

// ---------------------------------------------------------------- types

interface Msg {
  id: number;
  role: "buyer" | "aura" | "system";
  text: string;
  refusal?: boolean;
}

interface Gate {
  enabled: boolean;
  reason?: string;
}

const WELCOME =
  "Welcome to the Aura concierge. Choose a catalog home or bring your builder design; one rule: the land gate runs " +
  "before any money moves. Every reply here is computed by the same deterministic reducer the " +
  "agent runs — real bylaw data, the open Alberta cost model, no model call needed. Ask " +
  "anything, or take the suggestions below.";

const WALKTHROUGH_TXREF = "walkthrough — no on-chain transaction";

// ---------------------------------------------------------------- component

/* BN01 — the wallet boundary. wagmi no longer wraps the whole application
   from app/app/providers.tsx, so this surface mounts its own. The hooks MUST
   sit in a child component: a component cannot read a context it renders
   itself, and that mistake throws at runtime, not at build time.

   Note for whoever routes this next: no page renders ConciergeApp today —
   app/app/concierge/page.tsx redirects to /dashboard — so this component is
   currently in no route's bundle. It is wrapped anyway, so that the day it is
   mounted it works instead of throwing "useConfig must be used within
   WagmiProvider" on first paint. */
export default function ConciergeApp() {
  return (
    <WalletProvider>
      <ConciergeConsole />
    </WalletProvider>
  );
}

function ConciergeConsole() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [order, setOrder] = useState<Order>(() => createOrder({ id: "aura-order-01", now: new Date(0) }));
  const orderRef = useRef(order);
  const handoffRef = useRef<BuilderOrderSnapshot | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const msgSeq = useRef(0);
  const [gate, setGate] = useState<Gate>({
    enabled: false,
    reason: "No home or parcel selected — the land gate runs before any money moves.",
  });
  const [pendingDepositUsdc6, setPendingDepositUsdc6] = useState<string | null>(null);
  const [depositMode, setDepositMode] = useState<"onchain" | "walkthrough" | null>(null);
  const [depositTxHash, setDepositTxHash] = useState<`0x${string}` | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const clockOffsetRef = useRef(0);
  const [txBusy, setTxBusy] = useState<null | "approve" | "deposit" | "refund">(null);
  const [input, setInput] = useState("");
  const [, setSecond] = useState(0); // 1 s re-render tick while the countdown runs

  const live = useEscrowLive();
  const liveRef = useRef(live);
  liveRef.current = live;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const usdcState = useUsdcState(address);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const push = useCallback((role: Msg["role"], text: string, refusal = false) => {
    setMessages((m) => [...m, { id: ++msgSeq.current, role, text, refusal }]);
  }, []);

  const nowFn = useCallback(() => new Date(Date.now() + clockOffsetRef.current), []);

  // ------------------------------------------------------------ dispatch

  const handleActions = useCallback(
    (actions: ConciergeAction[]) => {
      for (const a of actions) {
        switch (a.type) {
          case "disableBuy":
            setGate({ enabled: false, reason: a.reason });
            break;
          case "enableBuy":
            setGate({ enabled: true });
            break;
          case "approveUsdc":
            setPendingDepositUsdc6(a.amountUsdc6);
            break;
          case "fundMilestone":
            // Handled together with approveUsdc by the deposit panel.
            break;
          case "updateRegistry":
            push(
              "system",
              `Build record — ${a.status}. The registry write (AuraBuildRegistry.updateStatus) is ` +
                `owner-gated to the operator wallet ${shortAddr(liveRef.current.registryOwner)}; it is ` +
                `recorded in this order log and is not written on chain from this page.`
            );
            break;
          case "startRefundCountdown":
            // The countdown reads order.deposit.refundDeadlineISO directly.
            break;
          case "refundDeposit":
            // The real on-chain refund is triggered by the refund button below
            // (it needs a signature); in walkthrough mode nothing moves.
            break;
        }
      }
    },
    [push]
  );

  const dispatch = useCallback(
    (intent: ConciergeIntent, buyerLine?: string, nowOverride?: Date) => {
      if (buyerLine) push("buyer", buyerLine);
      const now = nowOverride ?? nowFn();
      const ctx = buildContext(now, liveRef.current.refundWindowHours);
      const res = reduce(orderRef.current, intent, ctx);
      orderRef.current = res.order;
      setOrder(res.order);
      push("aura", res.reply, res.reply.startsWith("I can't sell you this home"));
      handleActions(res.actions);
      if (
        intent.type === "requestQuote" &&
        res.order.quote &&
        res.order.home?.kind === "builder" &&
        handoffRef.current?.projectId === res.order.home.projectId
      ) {
        const handoff = handoffRef.current;
        const quote = res.order.quote;
        void (async () => {
          try {
            const snapshot = await import("@/lib/builder/orderSnapshot");
            const quoted = snapshot.createQuotedBuilderOrderSnapshot(handoff, quote);
            await snapshot.saveBuilderOrderSnapshot(quoted);
            push(
              "system",
              `Immutable quote snapshot saved locally: design ${quoted.home.documentHash}, budget ${quoted.artifactHashes.budget}, quote ${quoted.artifactHashes.quote}. Full documents stay off-chain.`,
            );
          } catch (cause) {
            push(
              "system",
              `The quote could not be bound to a durable local snapshot: ${cause instanceof Error ? cause.message : String(cause)}. Do not pay until you create a fresh saved handoff.`,
            );
          }
        })();
      }
      if (
        intent.type === "requestQuote" &&
        res.order.quote &&
        liveRef.current.refundWindowHours === undefined
      ) {
        push(
          "system",
          "The chain read for refundWindow() has not landed, so the refund-window figure above is " +
            "the catalog default. The deployed contract's value governs — it appears in the " +
            "on-chain panel the moment the RPC answers."
        );
      }
      return res;
    },
    [handleActions, nowFn, push]
  );

  // ------------------------------------------------------------ boot

  useEffect(() => {
    if (!mounted) return;
    let active = true;
    orderRef.current = createOrder({ id: "aura-order-01", now: new Date() });
    setOrder(orderRef.current);
    push("aura", WELCOME);
    const boot = async () => {
      // Deep links support either a same-origin builder snapshot or the
      // catalog/parcel handoff. The complete design never rides in the URL.
      const params = new URLSearchParams(window.location.search);
      const project = params.get("project");
      const home = params.get("home");
      const parcel = params.get("parcel");
      const ask = params.get("ask")?.trim().slice(0, 500) ?? null;
      if (project) {
        try {
          const { loadBuilderOrderSnapshot } = await import("@/lib/builder/orderSnapshot");
          const snapshot = await loadBuilderOrderSnapshot(project);
          if (!active) return;
          handoffRef.current = snapshot;
          dispatch(
            { type: "selectBuilderHome", home: snapshot.home },
            `Continue with my saved builder design ${snapshot.home.name}.`,
          );
          if (params.get("intent") === "quote") {
            push(
              "system",
              "Continue to quote is ready. Choose a parcel first: the district land gate is mandatory, then the cost-model quote can be issued against this exact design hash.",
            );
          }
        } catch (cause) {
          if (!active) return;
          push(
            "system",
            `${cause instanceof Error ? cause.message : String(cause)} The URL carries only a same-origin project id, never the full design. Import the .aura.json file in Build on this device, then continue again.`,
          );
        }
      } else if (home) {
        dispatch({ type: "selectHome", homeId: home }, `I want the ${home}.`);
      }
      if (parcel) dispatch({ type: "selectParcel", parcelId: parcel }, `Check parcel ${parcel} for me.`);
      if (ask) dispatch({ type: "askAbout", question: ask }, ask);
    };
    void boot();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Re-render every second while the refund countdown is live.
  useEffect(() => {
    if (order.status !== "refundWindowOpen") return;
    const t = setInterval(() => setSecond((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [order.status]);

  // ------------------------------------------------------------ tx helpers

  const depositAmount = pendingDepositUsdc6 ? BigInt(pendingDepositUsdc6) : null;
  const isHomeowner =
    !!address && !!live.homeowner && address.toLowerCase() === live.homeowner.toLowerCase();
  const rightChain = chainId === CHAIN_ID;
  const hasAllowance =
    depositAmount !== null && usdcState.allowance !== undefined && usdcState.allowance >= depositAmount;
  const hasBalance =
    depositAmount !== null && usdcState.balance !== undefined && usdcState.balance >= depositAmount;
  const chainDepositTaken = live.depositAmount !== undefined && live.depositAmount > BigInt(0);

  const approveUsdc = async () => {
    if (!depositAmount) return;
    setTxBusy("approve");
    try {
      if (!publicClient) throw new Error("X Layer testnet RPC client is unavailable.");
      const hash = await writeContractAsync({
        abi: erc20Abi,
        address: USDC_TESTNET,
        functionName: "approve",
        args: [ESCROW_ADDRESS, depositAmount],
        chainId: CHAIN_ID,
      });
      push("system", `USDC approval submitted — tx ${hash}. Waiting for an X Layer receipt.`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("USDC approval transaction reverted.");
      push("system", `USDC approval confirmed on chain ${CHAIN_ID} — tx ${hash} (${oklinkTx(hash)}).`);
      usdcState.refetch();
    } catch (e) {
      push("system", describeTransactionFailure(e, "approve"));
    } finally {
      setTxBusy(null);
    }
  };

  const placeDepositOnchain = async () => {
    if (!depositAmount) return;
    setTxBusy("deposit");
    try {
      if (!publicClient) throw new Error("X Layer testnet RPC client is unavailable.");
      const hash = await writeContractAsync({
        abi: auraBuildEscrowAbi,
        address: ESCROW_ADDRESS,
        functionName: "placeDeposit",
        args: [depositAmount],
        chainId: CHAIN_ID,
      });
      push("system", `placeDeposit() submitted — tx ${hash}. Waiting for the DepositPlaced event.`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const confirmed = confirmDepositReceipt(receipt, ESCROW_ADDRESS, depositAmount);
      setDepositMode("onchain");
      setDepositTxHash(hash);
      push(
        "system",
        `DepositPlaced confirmed for ${fmtUsdcUnits(confirmed.amount)} — refund deadline ${new Date(Number(confirmed.refundDeadline) * 1000).toISOString()} · tx ${hash} (${oklinkTx(hash)}).`,
      );
      dispatch({ type: "confirmDeposit", txRef: hash });
      live.refetch();
      usdcState.refetch();
    } catch (e) {
      push("system", describeTransactionFailure(e, "deposit"));
    } finally {
      setTxBusy(null);
    }
  };

  const walkthroughDeposit = () => {
    setDepositMode("walkthrough");
    push(
      "system",
      "Walkthrough deposit — NO transaction was sent and nothing moved on chain. The order " +
        "object advances so you can see the full flow; the on-chain panel keeps showing the real " +
        "contract state."
    );
    dispatch({ type: "confirmDeposit", txRef: WALKTHROUGH_TXREF });
  };

  const refundOnchain = async () => {
    setTxBusy("refund");
    try {
      if (!publicClient) throw new Error("X Layer testnet RPC client is unavailable.");
      const hash = await writeContractAsync({
        abi: auraBuildEscrowAbi,
        address: ESCROW_ADDRESS,
        functionName: "refundDeposit",
        args: [],
        chainId: CHAIN_ID,
      });
      push("system", `refundDeposit() submitted — tx ${hash}. Waiting for the DepositRefunded event.`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const confirmed = confirmRefundReceipt(receipt, ESCROW_ADDRESS, live.depositAmount);
      push(
        "system",
        `DepositRefunded confirmed for ${fmtUsdcUnits(confirmed.amount)} — tx ${hash} (${oklinkTx(hash)}). The full deposit is back in the wallet.`,
      );
      dispatch({ type: "requestRefund" });
      live.refetch();
      usdcState.refetch();
    } catch (e) {
      push("system", describeTransactionFailure(e, "refund"));
    } finally {
      setTxBusy(null);
    }
  };

  const advanceWalkthroughClock = () => {
    const deadline = orderRef.current.deposit?.refundDeadlineISO;
    if (!deadline) return;
    const offset = new Date(deadline).getTime() - Date.now() + 3_600_000;
    clockOffsetRef.current = offset;
    setClockOffsetMs(offset);
    push(
      "system",
      `Walkthrough clock advanced past the refund deadline (simulated time — the chain is untouched).`
    );
    dispatch({ type: "tick" }, undefined, new Date(Date.now() + offset));
  };

  const resetOrder = () => {
    orderRef.current = createOrder({ id: `aura-order-${String(Date.now()).slice(-4)}`, now: new Date() });
    setOrder(orderRef.current);
    setMessages([]);
    setGate({ enabled: false, reason: "No home or parcel selected — the land gate runs before any money moves." });
    setPendingDepositUsdc6(null);
    setDepositMode(null);
    setDepositTxHash(null);
    clockOffsetRef.current = 0;
    setClockOffsetMs(0);
    push("aura", WELCOME);
  };

  // ------------------------------------------------------------ derived

  const chips = chipsForStatus(order.status, !!order.home);
  const committed = !["browsing", "parcelSelected", "parcelRejected", "homeSelected", "quoted"].includes(order.status);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    dispatch(parseIntent(text), text);
  };

  if (!mounted) {
    return (
      <div className="py-16">
        <p className="aura-label mb-4">The buy flow</p>
        <h1 className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]">Concierge</h1>
        <p className="mt-4 max-w-xl text-[0.95rem] leading-[1.65] text-aura-text/75">Loading the concierge.</p>
      </div>
    );
  }

  return (
    <div className="py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Reveal y={12}>
          <p className="aura-label mb-4">The buy flow</p>
          <h1 className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]">Concierge</h1>
          <p className="mt-4 max-w-xl text-[0.95rem] leading-[1.65] text-aura-text/75">
            Pick a home, pick a parcel, get quoted to the dollar, and place a reservation deposit
            in the configured faucet-compatible test token — with a refusal, citation included, when the bylaw says no.
          </p>
        </Reveal>
        <Reveal delay={0.12} y={10}>
          <button
            onClick={resetOrder}
            data-cursor="Reset"
            className="rounded-md border aura-hairline px-4 py-2 text-xs uppercase tracking-label transition-colors hover:border-aura-teal"
          >
            Start a new order
          </button>
        </Reveal>
      </div>

      {/* --------------------------------------------------- the land gate */}
      {/* The gate border is the loudest signal on the page, so it has to
          survive the card-fx rule that repaints .aura-panel borders on
          hover-capable devices — hence the important modifier rather than a
          plain utility (the old inline rgba() did the same job but could
          never flip with the theme). */}
      <Reveal className="mt-8" delay={0.06} y={16}>
        <div
          className={`aura-panel aura-panel-lift flex flex-wrap items-center gap-x-6 gap-y-2 p-5 ${
            gate.enabled ? "!border-aura-emerald/60" : "!border-aura-violet/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-label ${
                gate.enabled ? "border-aura-emerald text-aura-emerald" : "border-aura-violet text-aura-violet"
              }`}
            >
              {committed ? "Committed" : gate.enabled ? "Buy enabled" : "Buy disabled"}
            </span>
            <BuyButton
              enabled={gate.enabled && !committed}
              status={order.status}
              onQuote={() => dispatch({ type: "requestQuote" }, "Quote it for me.")}
              onDeposit={() => dispatch({ type: "placeDeposit" }, "Place the deposit.")}
            />
          </div>
          <p className="min-w-[240px] flex-1 text-xs leading-relaxed text-aura-text/75">
            {committed
              ? "Deposit in motion — home and parcel are locked for this order."
              : gate.enabled
                ? "Home and land both check out. The gate stays open unless either changes."
                : gate.reason}
          </p>
        </div>
      </Reveal>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ------------------------------------------------------- chat */}
        <div className="aura-panel flex min-h-[520px] flex-col p-0">
          <div className="max-h-[560px] flex-1 space-y-4 overflow-y-auto p-6">
            {messages.map((m) => (
              <ChatMessage key={m.id} msg={m} />
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* deposit panel appears in-flow when the reducer asks for signatures */}
          {order.status === "depositPending" && depositAmount !== null && (
            <div className="border-t aura-hairline p-6">
              <DepositPanel
                amountUsdc6={pendingDepositUsdc6!}
                isConnected={isConnected}
                connecting={connecting}
                connectors={connectors}
                connect={(c) => connect({ connector: c })}
                disconnect={() => disconnect()}
                address={address}
                rightChain={rightChain}
                switching={switching}
                onSwitch={() => switchChain({ chainId: CHAIN_ID })}
                isHomeowner={isHomeowner}
                homeowner={live.homeowner}
                chainDepositTaken={chainDepositTaken}
                balance={usdcState.balance}
                hasBalance={hasBalance}
                hasAllowance={hasAllowance}
                txBusy={txBusy}
                onApprove={approveUsdc}
                onPlaceDeposit={placeDepositOnchain}
                onWalkthrough={walkthroughDeposit}
              />
            </div>
          )}

          {/* refund window controls */}
          {order.status === "refundWindowOpen" && order.deposit?.refundDeadlineISO && (
            <div className="border-t aura-hairline p-6">
              <RefundWindowPanel
                deadlineISO={order.deposit.refundDeadlineISO}
                now={nowFn()}
                windowHours={order.quote?.refundWindowHours}
                mode={depositMode}
                txBusy={txBusy}
                clockAdvanced={clockOffsetMs > 0}
                onRefundOnchain={refundOnchain}
                onRefundWalkthrough={() => dispatch({ type: "requestRefund" }, "Request the refund.")}
                onAdvanceClock={advanceWalkthroughClock}
                onTick={() => dispatch({ type: "tick" }, "Check the clock.")}
              />
            </div>
          )}

          {/* chips + input */}
          <div className="border-t aura-hairline p-4">
            {chips.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => dispatch(c.intent, c.label)}
                    data-cursor="Ask"
                    className="rounded-full border aura-hairline px-3.5 py-1.5 text-xs transition-colors hover:border-aura-emerald hover:text-aura-emerald"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={submit} className="flex gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the concierge — homes, parcels, prices, refunds"
                aria-label="Message the concierge"
                className="flex-1 rounded-md border aura-hairline bg-aura-bg px-4 py-2.5 text-sm text-aura-text placeholder:text-aura-text/40"
              />
              <button
                type="submit"
                data-cursor="Send"
                className="rounded-md bg-aura-ink px-5 py-2.5 font-mono text-xs font-medium uppercase tracking-label text-aura-paper transition-opacity hover:opacity-85"
              >
                Send
              </button>
            </form>
            <p className="mt-2 text-[10px] uppercase tracking-label text-aura-text/50">
              Deterministic replies — computed from the catalog, the bylaw data, and the open cost model
            </p>
          </div>
        </div>

        {/* ------------------------------------------------------- rail */}
        <Stagger className="space-y-6" gap={0.09}>
          <StaggerItem y={16}>
            <OrderPanel order={order} depositTxHash={depositTxHash} depositMode={depositMode} />
          </StaggerItem>
          <StaggerItem y={16}>
            <LiveEscrowCard compact />
          </StaggerItem>
          <StaggerItem y={16}>
            <EventLog order={order} />
          </StaggerItem>
        </Stagger>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function BuyButton({
  enabled,
  status,
  onQuote,
  onDeposit,
}: {
  enabled: boolean;
  status: string;
  onQuote: () => void;
  onDeposit: () => void;
}) {
  const next = status === "quoted" ? onDeposit : onQuote;
  const label = status === "quoted" ? "Buy — place the deposit" : "Buy";
  return (
    <button
      onClick={next}
      disabled={!enabled}
      data-cursor={status === "quoted" ? "Deposit" : "Buy"}
      className={`rounded-full px-5 py-2 font-mono text-xs font-semibold uppercase tracking-label transition-opacity ${
        enabled ? "bg-aura-ink text-aura-paper hover:opacity-85" : "bg-aura-ink/20 text-aura-text/45"
      }`}
    >
      {label}
    </button>
  );
}

function ChatMessage({ msg }: { msg: Msg }) {
  if (msg.role === "system") {
    return (
      <div className="rounded-md border border-dashed aura-hairline bg-aura-bg px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-label text-aura-teal">Chain and clock notes</p>
        <p className="mt-1 break-words text-xs leading-relaxed text-aura-text/75">{msg.text}</p>
      </div>
    );
  }
  if (msg.role === "buyer") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl bg-aura-ink px-4 py-3 text-sm leading-relaxed text-aura-paper">
          {msg.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex">
      <div
        className={`max-w-[92%] whitespace-pre-wrap rounded-xl border px-4 py-3 text-sm leading-relaxed ${
          msg.refusal ? "border-aura-violet/60 bg-aura-violet/[0.06]" : "aura-hairline bg-aura-bg"
        }`}
      >
        {msg.refusal && (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-label text-aura-violet">
            The land gate — refusal, with the citation
          </p>
        )}
        {msg.text}
      </div>
    </div>
  );
}

function DepositPanel(props: {
  amountUsdc6: string;
  isConnected: boolean;
  connecting: boolean;
  connectors: readonly Connector[];
  connect: (c: Connector) => void;
  disconnect: () => void;
  address?: `0x${string}`;
  rightChain: boolean;
  switching: boolean;
  onSwitch: () => void;
  isHomeowner: boolean;
  homeowner?: `0x${string}`;
  chainDepositTaken: boolean;
  balance?: bigint;
  hasBalance: boolean;
  hasAllowance: boolean;
  txBusy: null | "approve" | "deposit" | "refund";
  onApprove: () => void;
  onPlaceDeposit: () => void;
  onWalkthrough: () => void;
}) {
  const p = props;
  const amount = fmtUsdc6(p.amountUsdc6);

  let realPath: React.ReactNode;
  if (!p.isConnected) {
    realPath = (
      <div className="space-y-2">
        {p.connectors.map((c) => (
          <button
            key={c.uid}
            onClick={() => p.connect(c)}
            disabled={p.connecting}
            data-cursor="Connect"
            className="block w-full max-w-xs rounded-md border aura-hairline px-4 py-2 text-xs font-medium uppercase tracking-label transition-colors hover:border-aura-teal disabled:opacity-50"
          >
            {p.connecting ? "Connecting" : `Connect ${c.name}`}
          </button>
        ))}
        {p.connectors.length === 0 && (
          <p className="text-xs text-aura-text/70">
            No injected wallet detected in this browser. The walkthrough below shows the full flow
            without one.
          </p>
        )}
      </div>
    );
  } else if (!p.rightChain) {
    realPath = (
      <div className="space-y-2">
        <p className="text-xs text-aura-text/75">
          Wrong network — this escrow lives on X Layer testnet (chain {CHAIN_ID}).
        </p>
        <button
          onClick={p.onSwitch}
          disabled={p.switching}
          data-cursor="Switch"
          className="rounded-md border border-aura-emerald px-4 py-2 text-xs font-medium uppercase tracking-label text-aura-emerald transition-colors hover:bg-aura-emerald/5 disabled:opacity-50"
        >
          {p.switching ? "Switching" : `Switch to X Layer testnet (${CHAIN_ID})`}
        </button>
      </div>
    );
  } else if (!p.isHomeowner) {
    realPath = (
      <p className="text-xs leading-relaxed text-aura-text/75">
        Honest limit: this deployed escrow instance binds <span className="font-mono">homeowner</span> to
        the operator wallet {shortAddr(p.homeowner)} (dev wiring, one escrow per order in production).
        From {shortAddr(p.address)} the placeDeposit() call would revert NotHomeowner, so this page
        will not send it. Watch the live contract state in the panel opposite, or use the walkthrough.
      </p>
    );
  } else if (p.chainDepositTaken) {
    realPath = (
      <p className="text-xs leading-relaxed text-aura-text/75">
        This escrow instance already holds its one reservation deposit (one per escrow lifetime —
        see the live panel). Redeploy a fresh instance for another on-chain run, or use the
        walkthrough.
      </p>
    );
  } else if (!p.hasBalance) {
    realPath = (
      <div className="space-y-2">
        <p className="text-xs leading-relaxed text-aura-text/75">
          Testnet funds needed — this wallet holds {fmtUsdcUnits(p.balance)} of the configured faucet-compatible test USDC
          and the deposit is {amount}. Nothing here fakes a balance: get testnet OKB for gas at the{" "}
          <a
            href={FAUCET_URL}
            target="_blank"
            rel="noreferrer"
            data-cursor="Faucet"
            className="text-aura-emerald underline"
          >
            OKX faucet
          </a>{" "}
          and fund the wallet with testnet USDC ({shortAddr(USDC_TESTNET)}), then return. The
          walkthrough below works with an empty wallet.
        </p>
      </div>
    );
  } else {
    realPath = (
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={p.onApprove}
          disabled={p.hasAllowance || p.txBusy !== null}
          data-cursor="Approve"
          className="rounded-md border border-aura-emerald px-4 py-2 text-xs font-medium uppercase tracking-label text-aura-emerald transition-colors hover:bg-aura-emerald/5 disabled:opacity-40"
        >
          {p.txBusy === "approve" ? "Approving" : p.hasAllowance ? "1. Approved" : `1. Approve ${amount}`}
        </button>
        <button
          onClick={p.onPlaceDeposit}
          disabled={!p.hasAllowance || p.txBusy !== null}
          data-cursor="Deposit"
          className="rounded-md bg-aura-ink px-4 py-2 font-mono text-xs font-semibold uppercase tracking-label text-aura-paper transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {p.txBusy === "deposit" ? "Placing deposit" : "2. placeDeposit()"}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Copy reveals; the CONTROLS never do. A scroll-triggered once-only
          reveal on a signature button would hide it from a reader whose
          viewport never reached it. */}
      <Reveal y={10}>
        <p className="aura-label">Reservation deposit — {amount}</p>
        <p className="mt-2 text-xs leading-relaxed text-aura-text/70">
          Two signatures on the testnet contract: approve the configured test token, then placeDeposit(). The
          refund window opens the moment the deposit lands, and the chain enforces it.
        </p>
      </Reveal>
      <div className="mt-4">{realPath}</div>
      <div className="mt-4 border-t aura-hairline pt-4">
        <button
          onClick={p.onWalkthrough}
          data-cursor="Preview"
          className="rounded-md border aura-hairline px-4 py-2 text-xs uppercase tracking-label transition-colors hover:border-aura-teal"
        >
          Continue in walkthrough — no transaction
        </button>
        <p className="mt-2 text-[10px] uppercase tracking-label text-aura-violet">
          Walkthrough advances the order object only. Nothing moves on chain.
        </p>
      </div>
    </div>
  );
}

function RefundWindowPanel(props: {
  deadlineISO: string;
  now: Date;
  /** Total length of the window, so the bar below can show how much of it is
   *  left. Undefined until the quote lands — the bar simply does not render. */
  windowHours?: number;
  mode: "onchain" | "walkthrough" | null;
  txBusy: null | "approve" | "deposit" | "refund";
  clockAdvanced: boolean;
  onRefundOnchain: () => void;
  onRefundWalkthrough: () => void;
  onAdvanceClock: () => void;
  onTick: () => void;
}) {
  const msLeft = Math.max(0, new Date(props.deadlineISO).getTime() - props.now.getTime());
  const days = Math.floor(msLeft / 86_400_000);
  const hours = Math.floor((msLeft % 86_400_000) / 3_600_000);
  const minutes = Math.floor((msLeft % 3_600_000) / 60_000);
  const seconds = Math.floor((msLeft % 60_000) / 1000);
  const windowMs = props.windowHours !== undefined ? props.windowHours * 3_600_000 : undefined;
  const pctLeft =
    windowMs && windowMs > 0 ? Math.max(0, Math.min(100, (msLeft / windowMs) * 100)) : null;

  return (
    <div>
      <Reveal y={10}>
        <p className="aura-label">Refund window — open</p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="font-display text-[1.8rem] font-medium tabular-nums tracking-[-0.02em] text-aura-emerald">
            {days}d {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
            {String(seconds).padStart(2, "0")}
          </p>
          <p className="text-xs text-aura-text/65">
            until {props.deadlineISO.slice(0, 19).replace("T", " ")} UTC — you alone control the walk-away
          </p>
        </div>
        {pctLeft !== null && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-aura-ink/10">
            <GrowBar pct={pctLeft} className="h-full rounded-full bg-aura-emerald-bright" />
          </div>
        )}
      </Reveal>
      <div className="mt-4 flex flex-wrap gap-3">
        {props.mode === "onchain" ? (
          <button
            onClick={props.onRefundOnchain}
            disabled={props.txBusy !== null}
            data-cursor="Refund"
            className="rounded-md border border-aura-violet px-4 py-2 text-xs font-medium uppercase tracking-label text-aura-violet transition-colors hover:bg-aura-violet/5 disabled:opacity-50"
          >
            {props.txBusy === "refund" ? "Refunding" : "refundDeposit() — full refund"}
          </button>
        ) : (
          <>
            <button
              onClick={props.onRefundWalkthrough}
              data-cursor="Refund"
              className="rounded-md border border-aura-violet px-4 py-2 text-xs font-medium uppercase tracking-label text-aura-violet transition-colors hover:bg-aura-violet/5"
            >
              Request the refund (walkthrough)
            </button>
            {!props.clockAdvanced && (
              <button
                onClick={props.onAdvanceClock}
                data-cursor="Advance"
                className="rounded-md border aura-hairline px-4 py-2 text-xs uppercase tracking-label transition-colors hover:border-aura-teal"
              >
                Advance the clock past the deadline — simulated time
              </button>
            )}
            {props.clockAdvanced && (
              <button
                onClick={props.onTick}
                data-cursor="Check"
                className="rounded-md border aura-hairline px-4 py-2 text-xs uppercase tracking-label transition-colors hover:border-aura-teal"
              >
                Check the clock
              </button>
            )}
          </>
        )}
      </div>
      {props.mode === "walkthrough" && (
        <p className="mt-2 text-[10px] uppercase tracking-label text-aura-violet">
          Walkthrough — the countdown uses the chain&rsquo;s refund window; no funds are escrowed
        </p>
      )}
    </div>
  );
}

function OrderPanel({
  order,
  depositTxHash,
  depositMode,
}: {
  order: Order;
  depositTxHash: `0x${string}` | null;
  depositMode: "onchain" | "walkthrough" | null;
}) {
  const q = order.quote;
  return (
    <div className="aura-panel p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="aura-label">Order</p>
        <span className="rounded border aura-hairline px-2 py-0.5 font-mono text-[10px] uppercase tracking-label text-aura-text/70">
          {order.status}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-xs leading-relaxed text-aura-text/80">
        <p>
          <span className="text-aura-text/55">Home:</span>{" "}
          {order.home ? `${order.home.name} — ${order.home.sizeSqft.toLocaleString("en-CA")} sqft` : "not chosen"}
        </p>
        {order.home?.kind === "builder" ? (
          <p className="break-all font-mono text-[10px] text-aura-text/60">
            <span className="font-sans text-aura-text/55">Builder design:</span>{" "}
            v{order.home.documentVersion} · {order.home.documentHash}
          </p>
        ) : null}
        <p>
          <span className="text-aura-text/55">Parcel:</span>{" "}
          {order.parcel
            ? `${order.parcel.listing.name} — ${order.parcel.verdict}`
            : "not chosen"}
        </p>
        {q && (
          <>
            {q.budget ? (
              <p>
                <span className="text-aura-text/55">Budget (ex-land):</span> LOW {fmtCad(q.budget.total.lowCad)} ·
                MID {fmtCad(q.budget.total.midCad)} · HIGH {fmtCad(q.budget.total.highCad)}
              </p>
            ) : (
              <p>
                <span className="text-aura-text/55">Published base:</span> US$
                {q.publishedUsd?.toLocaleString("en-CA")}
              </p>
            )}
            <p>
              <span className="text-aura-text/55">Deposit:</span> {fmtCad(q.depositCad)} ={" "}
              {fmtUsdc6(q.depositUsdc6)}
            </p>
            <p>
              <span className="text-aura-text/55">Refund window:</span> {q.refundWindowHours} hours (
              {Math.round((q.refundWindowHours / 24) * 10) / 10} days)
            </p>
            <p>
              <span className="text-aura-text/55">Basis:</span> {q.basis.kind} · {q.basis.source} ·
              valid until {new Date(q.validUntilISO).toLocaleDateString("en-CA")}
            </p>
          </>
        )}
        {order.deposit?.fundedAtISO && (
          <p>
            <span className="text-aura-text/55">Deposit state:</span>{" "}
            {depositMode === "onchain" && depositTxHash ? (
              <a href={oklinkTx(depositTxHash)} target="_blank" rel="noreferrer" className="text-aura-emerald underline">
                on chain — {shortAddr(depositTxHash)}
              </a>
            ) : (
              "walkthrough (no transaction)"
            )}
          </p>
        )}
      </div>
      {q && (
        <p className="mt-3 text-[10px] leading-relaxed text-aura-text/55">
          {q.reconciliation.reconcilesToFile === true
            ? "Reconciliation: totals equal data/alberta/cost-model.json to the dollar."
            : q.reconciliation.reconcilesToFile === false
              ? "Reconciliation FAILED against the cost-model file — do not trust this quote."
              : "Reconciliation: n/a for this home (see the quote notes)."}
        </p>
      )}
    </div>
  );
}

function EventLog({ order }: { order: Order }) {
  const events = [...order.events].reverse();
  return (
    <div className="aura-panel p-6">
      <p className="aura-label">Event log</p>
      <p className="mt-1 text-[10px] uppercase tracking-label text-aura-text/50">
        Append-only — {order.events.length} events
      </p>
      <ol className="mt-3 max-h-[300px] space-y-2 overflow-y-auto">
        {events.map((e) => (
          <li key={e.seq} className="text-[11px] leading-relaxed text-aura-text/75">
            <span className="font-mono text-aura-text/50">
              {String(e.seq).padStart(2, "0")} · {e.atISO.slice(0, 19).replace("T", " ")}
            </span>
            <br />
            <span className="font-medium text-aura-text/85">{e.type}</span> — {e.summary}
          </li>
        ))}
      </ol>
    </div>
  );
}
