// Optional model layer over the pure reducer. The reducer's deterministic
// reply is ALWAYS computed first and is the guaranteed fallback; only
// free-text askAbout turns are upgraded through claude.ts (key present ->
// model grounded in the order context; key absent or any failure -> the
// deterministic reply verbatim). Every state transition stays in the pure
// reducer — the model writes prose, never state.

import { answerConciergeQuestion } from "../claude";
import { Order } from "./order";
import { ConciergeContext, ConciergeIntent, ReduceResult, reduce } from "./reducer";

export interface AssistedResult extends ReduceResult {
  replySource: "offline" | "claude";
}

export async function reduceWithAssist(
  order: Order,
  intent: ConciergeIntent,
  ctx: ConciergeContext
): Promise<AssistedResult> {
  const result = reduce(order, intent, ctx);
  if (intent.type !== "askAbout") {
    return { ...result, replySource: "offline" };
  }
  const orderContext = JSON.stringify(
    {
      status: result.order.status,
      home: result.order.home ?? null,
      parcel: result.order.parcel
        ? {
            name: result.order.parcel.listing.name,
            district: result.order.parcel.listing.district,
            verdict: result.order.parcel.verdict,
            reasons: result.order.parcel.reasons,
          }
        : null,
      quote: result.order.quote
        ? {
            totals: result.order.quote.budget?.total ?? null,
            depositCad: result.order.quote.depositCad,
            depositUsdc6: result.order.quote.depositUsdc6,
            refundWindowHours: result.order.quote.refundWindowHours,
          }
        : null,
    },
    null,
    2
  );
  const { answer, source } = await answerConciergeQuestion(intent.question, orderContext, result.reply);
  return {
    ...result,
    reply: answer,
    replySource: source === "claude" ? "claude" : "offline",
  };
}
