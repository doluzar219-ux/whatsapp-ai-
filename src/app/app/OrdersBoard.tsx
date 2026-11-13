"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  Clock3,
  FileDown,
  Inbox,
  IndianRupee,
  LayoutDashboard,
  Loader2,
  PackageCheck,
  QrCode,
  Radio,
  ShoppingBag,
  Sparkles,
  Store,
  Wallet,
} from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { SerializedOrder } from "@/lib/types";

const STATUSES = ["PENDING", "PAID_MOCK", "DISPATCHED", "DELIVERED"] as const;
const FILTERS = ["ALL", ...STATUSES] as const;

interface Toast {
  id: number;
  text: string;
}

function timeAgo(iso: string, now: number) {
  const m = Math.floor(Math.max(0, now - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function OrdersBoard({
  initial,
  currency,
  businessName,
  onboarded,
}: {
  initial: SerializedOrder[];
  currency: string;
  businessName: string;
  onboarded: boolean;
}) {
  const [orders, setOrders] = useState<SerializedOrder[]>(initial);
  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [updating, setUpdating] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const tid = useRef(0);

  const toast = useCallback((text: string) => {
    const id = ++tid.current;
    setToasts((p) => [...p.slice(-3), { id, text }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4200);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      es = new EventSource("/api/orders/stream");
      es.onopen = () => setLive(true);
      es.onerror = () => {
        setLive(false);
        es?.close();
        retry = setTimeout(connect, 3000);
      };
      es.onmessage = (evt) => {
        try {
          const d = JSON.parse(evt.data);
          if (d.type === "snapshot") setOrders(d.orders ?? []);
          else if (d.type === "upsert" && d.order) {
            const o = d.order as SerializedOrder;
            setOrders((prev) => {
              const i = prev.findIndex((x) => x.id === o.id);
              if (i === -1) return [o, ...prev];
              const copy = [...prev];
              copy[i] = o;
              return copy;
            });
            setFlash(o.id);
            setTimeout(() => setFlash(null), 1600);
            toast(
              d.kind === "created"
                ? `🎉 New order #${o.id} — ${formatMoney(o.totalAmount, currency)}`
                : `Order #${o.id} → ${o.status}`,
            );
          }
        } catch {
          /* ignore */
        }
      };
    };
    connect();
    return () => {
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, [toast, currency]);

  async function change(id: number, status: string) {
    setUpdating(id);
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "failed");
      setOrders((p) => p.map((o) => (o.id === id ? data.order : o)));
      const ch: string[] = data.notifiedChannels ?? [];
      toast(ch.length ? `#${id} → ${status} · customer notified on ${ch.join(" & ")}` : `#${id} → ${status}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(null);
    }
  }

  const m = useMemo(() => {
    const paid = orders.filter((o) => o.status !== "PENDING" && o.status !== "CANCELLED");
    return {
      revenue: paid.reduce((s, o) => s + o.totalAmount, 0),
      total: orders.length,
      pending: orders.filter((o) => o.status === "PENDING").length,
      delivered: orders.filter((o) => o.status === "DELIVERED").length,
    };
  }, [orders]);

  const visible = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  const CARDS = [
    { icon: IndianRupee, l: "REVENUE", v: formatMoney(m.revenue, currency), c: "text-brand-2" },
    { icon: ShoppingBag, l: "ORDERS", v: String(m.total), c: "text-sky" },
    { icon: Wallet, l: "PENDING PAY", v: String(m.pending), c: "text-amber" },
    { icon: PackageCheck, l: "DELIVERED", v: String(m.delivered), c: "text-violet" },
  ];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="chip mb-4">
            <LayoutDashboard className="size-3.5 text-brand-2" /> {businessName}
          </div>
          <h1 className="display text-3xl font-bold tracking-tight sm:text-4xl">
            Order <span className="shine-text">Mission Control</span>
          </h1>
        </div>
        <div className={`chip !text-[11px] ${live ? "!border-brand-2/40 !text-brand-2" : "!border-amber/40 !text-amber"}`}>
          <span className={`size-1.5 rounded-full ${live ? "bg-brand-2 animate-blink" : "bg-amber"}`} />
          {live ? "LIVE" : "RECONNECTING…"}
        </div>
      </div>

      {!onboarded && (
        <div className="glass glow-ring mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-brand-2" />
            <div>
              <p className="display text-[14px] font-bold">Setup pura kijiye</p>
              <p className="mt-1 text-[12.5px] text-muted">
                Business info bhariye, products add kijiye, phir WhatsApp connect — 3 steps.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/app/business" className="btn btn-ghost !px-4 !py-2 !text-[12px]">
              <Store className="size-3.5" /> Business
            </Link>
            <Link href="/app/connect" className="btn btn-primary !px-4 !py-2 !text-[12px]">
              <QrCode className="size-3.5" /> Connect
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c, i) => (
          <div key={c.l} className="glass card-hover rounded-2xl p-5 animate-fade-up" style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-[0.22em] text-faint">{c.l}</p>
              <c.icon className={`size-4 ${c.c}`} strokeWidth={2} />
            </div>
            <p className="display mt-3 text-[26px] font-bold leading-none">{c.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-1.5 font-mono text-[11px] tracking-widest transition-all ${
              filter === f ? "border-brand-2/50 bg-brand-2/10 text-brand-2" : "border-line text-muted hover:border-brand-2/30 hover:text-ink"
            }`}
          >
            {f}
            {f !== "ALL" && <span className="ml-2 text-faint">{orders.filter((o) => o.status === f).length}</span>}
          </button>
        ))}
      </div>

      <div className="glass mt-4 overflow-hidden rounded-2xl">
        <div className="scroll-slim overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line font-mono text-[10px] tracking-[0.2em] text-faint">
                <th className="px-5 py-3.5 font-medium">ORDER</th>
                <th className="px-5 py-3.5 font-medium">CUSTOMER</th>
                <th className="px-5 py-3.5 font-medium">ITEMS</th>
                <th className="px-5 py-3.5 font-medium">TOTAL</th>
                <th className="px-5 py-3.5 font-medium">PLACED</th>
                <th className="px-5 py-3.5 font-medium">STATUS</th>
                <th className="px-5 py-3.5 text-right font-medium">LABEL</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr key={o.id} className={`border-b border-line/60 align-top transition-colors duration-700 hover:bg-white/[0.025] ${flash === o.id ? "bg-brand-2/[0.07]" : ""}`}>
                  <td className="px-5 py-4">
                    <p className="mono font-bold text-brand-2">#{o.id}</p>
                    <p className="mono mt-0.5 text-[10px] uppercase text-faint">{o.channel}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold">{o.userName ?? "Customer"}</p>
                    <p className="mono mt-0.5 text-[11px] text-muted">+{o.userPhone}</p>
                    {o.userAddress && (
                      <p className="mt-1 max-w-[180px] truncate text-[11px] text-faint" title={o.userAddress}>
                        {o.userAddress}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <ul className="space-y-0.5">
                      {o.items.map((it, i) => (
                        <li key={i} className="text-[12px] text-muted">
                          <span className="font-semibold text-ink">{it.qty}×</span> {it.name}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-5 py-4">
                    <p className="display font-bold">{formatMoney(o.totalAmount, currency)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="flex items-center gap-1.5 text-[12px] text-muted">
                      <Clock3 className="size-3" /> {timeAgo(o.createdAt, now)}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="relative inline-flex items-center">
                      {updating === o.id && <Loader2 className="absolute -left-5 size-3.5 animate-spin text-brand-2" />}
                      <select
                        value={o.status}
                        disabled={updating === o.id}
                        onChange={(e) => change(o.id, e.target.value)}
                        className={`status-pill status-${o.status} cursor-pointer appearance-none bg-transparent pr-6 outline-none disabled:opacity-60`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s} className="bg-panel text-ink">{s}</option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-2 text-[9px] opacity-70">▾</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <a
                      href={`/api/orders/${o.id}/label`}
                      download
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[11px] font-semibold text-muted transition-all hover:border-brand-2/40 hover:text-brand-2"
                    >
                      <FileDown className="size-3.5" /> PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {visible.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <Inbox className="size-8 text-faint" strokeWidth={1.6} />
              <p className="text-sm text-muted">
                {filter === "ALL" ? "Abhi koi order nahi — WhatsApp connect karke customers ko message karne dijiye." : `${filter} mein kuch nahi.`}
              </p>
              <Link href="/app/connect" className="btn btn-ghost !px-4 !py-2 !text-[12px]">
                <QrCode className="size-3.5" /> Connect WhatsApp
              </Link>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 flex items-center gap-2 text-[11px] text-faint">
        <Radio className="size-3.5" />
        DISPATCHED ya DELIVERED karte hi customer ko uske chat par automatic message chala jata hai.
      </p>

      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[320px] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="glass animate-pop-in flex items-start gap-2.5 rounded-xl px-4 py-3 shadow-2xl">
            <BellRing className="mt-0.5 size-4 shrink-0 text-brand-2" />
            <p className="text-[12px] leading-relaxed">{t.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
