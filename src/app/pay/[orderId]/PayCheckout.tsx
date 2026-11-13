"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CreditCard,
  Loader2,
  Lock,
  MessageCircle,
  ShieldCheck,
  Store,
} from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { SerializedOrder } from "@/lib/types";

export function PayCheckout({
  order,
  businessName,
  currency,
}: {
  order: SerializedOrder;
  businessName: string;
  currency: string;
}) {
  const [phase, setPhase] = useState<"idle" | "processing" | "done">(
    order.status === "PENDING" ? "idle" : "done",
  );
  const [channels, setChannels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setPhase("processing");
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 1100));
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID_MOCK" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "payment failed");
      setChannels(Array.isArray(data.notifiedChannels) ? data.notifiedChannels : []);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed — try again");
      setPhase("idle");
    }
  }

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 py-12">
      <div className="aurora" />

      <div className="relative mb-8 flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-brand-2 to-brand-deep">
          <Store className="size-5 text-[#03130a]" strokeWidth={2.4} />
        </span>
        <div className="text-left">
          <p className="display text-[15px] font-bold leading-none">{businessName}</p>
          <p className="mt-1 font-mono text-[10px] tracking-[0.2em] text-faint">SECURE CHECKOUT</p>
        </div>
      </div>

      {phase === "done" ? (
        <div className="glass glow-ring animate-pop-in relative w-full rounded-3xl p-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-2/15" style={{ animation: "pulse-ring 2s infinite" }}>
            <BadgeCheck className="size-8 text-brand-2" strokeWidth={2} />
          </span>
          <h1 className="display mt-5 text-2xl font-bold">Payment received!</h1>
          <p className="mt-2 text-sm text-muted">
            Order <span className="mono font-bold text-brand-2">#{order.id}</span> ·{" "}
            {formatMoney(order.totalAmount, currency)} confirmed.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-brand-2/25 bg-brand-2/[0.06] px-4 py-3 text-[12px] text-brand-2">
            <MessageCircle className="size-4" />
            {channels.length
              ? `Confirmation sent on ${channels.map((c) => c[0].toUpperCase() + c.slice(1)).join(" & ")}`
              : "Confirmation on its way to your chat"}
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-line pt-5 text-left">
            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-faint">STATUS</p>
              <p className="status-pill status-PAID_MOCK mt-2">PAID_MOCK</p>
            </div>
            <Link href="/" className="btn btn-ghost !px-4 !py-2 !text-[12px]">Done</Link>
          </div>
        </div>
      ) : (
        <div className="glass relative w-full overflow-hidden rounded-3xl">
          <div className="border-b border-line bg-white/[0.02] px-6 py-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-[0.25em] text-faint">
                ORDER <span className="text-brand-2">#{order.id}</span>
              </p>
              <span className="status-pill status-PENDING">{order.status}</span>
            </div>
            <p className="mt-3 text-sm text-muted">
              <span className="font-semibold text-ink">{order.userName ?? "Customer"}</span>
              <span className="mono ml-1.5 text-[11px] text-faint">+{order.userPhone}</span>
            </p>
          </div>

          <div className="space-y-3 px-6 py-5">
            {order.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <p className="text-muted">
                  <span className="font-semibold text-ink">{it.qty} ×</span> {it.name}
                </p>
                <p className="mono text-[13px]">{formatMoney(it.qty * it.price, currency)}</p>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-dashed border-line pt-4">
              <p className="font-mono text-[11px] tracking-[0.2em] text-faint">TOTAL DUE</p>
              <p className="display text-2xl font-bold text-brand-2">
                {formatMoney(order.totalAmount, currency)}
              </p>
            </div>
          </div>

          <div className="border-t border-line px-6 py-5">
            {error && (
              <p className="mb-3 rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[12px] text-red">{error}</p>
            )}
            <button onClick={pay} disabled={phase === "processing"} className="btn btn-primary w-full justify-center !py-3.5 !text-[15px]">
              {phase === "processing" ? (
                <>
                  <Loader2 className="size-4.5 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <CreditCard className="size-4.5" strokeWidth={2.2} /> Complete Mock Payment
                </>
              )}
            </button>
            <p className="mt-3.5 flex items-center justify-center gap-1.5 text-center text-[11px] text-faint">
              <Lock className="size-3" /> Demo checkout — no real money moves.
            </p>
          </div>
        </div>
      )}

      <p className="relative mt-6 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] text-faint">
        <ShieldCheck className="size-3.5 text-brand-deep" /> POWERED BY SHOPFLOW.AI
      </p>
    </div>
  );
}
