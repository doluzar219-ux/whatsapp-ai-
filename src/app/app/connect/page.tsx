"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  BadgeCheck,
  Loader2,
  Power,
  QrCode,
  RefreshCcw,
  ScanLine,
  Smartphone,
  TerminalSquare,
  TriangleAlert,
  Wifi,
  WifiOff,
} from "lucide-react";

type Status = "idle" | "starting" | "qr" | "connected" | "reconnecting" | "offline";

const META: Record<Status, { label: string; tone: string; dot: string }> = {
  idle: { label: "ENGINE IDLE", tone: "text-muted", dot: "bg-muted" },
  starting: { label: "BOOTING", tone: "text-amber", dot: "bg-amber animate-blink" },
  qr: { label: "SCAN TO PAIR", tone: "text-brand-2", dot: "bg-brand-2 animate-blink" },
  connected: { label: "CONNECTED", tone: "text-brand-2", dot: "bg-brand-2" },
  reconnecting: { label: "RECONNECTING", tone: "text-amber", dot: "bg-amber animate-blink" },
  offline: { label: "SESSION EXPIRED", tone: "text-red", dot: "bg-red" },
};

const STEPS = [
  { icon: Smartphone, t: "WhatsApp kholiye", d: "Jis number se shop chalani hai." },
  { icon: ScanLine, t: "Linked devices", d: "Settings → Linked devices → Link a device." },
  { icon: QrCode, t: "QR scan kijiye", d: "Bas — aapka AI salesman live ho jayega." },
];

export default function ConnectPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [qr, setQr] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [logs, setLogs] = useState<Array<{ t: number; msg: string }>>([]);
  const [resetting, setResetting] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource("/api/whatsapp/qr");
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === "state") {
          setStatus(d.status ?? "idle");
          setQr(d.qr ?? null);
          setMe(d.me ?? null);
        } else if (d.type === "log") {
          setLogs((p) => [...p.slice(-40), { t: d.t, msg: d.msg }]);
        }
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  async function reset() {
    setResetting(true);
    try {
      await fetch("/api/whatsapp/logout", { method: "POST" });
    } finally {
      setTimeout(() => setResetting(false), 1200);
    }
  }

  const meta = META[status];

  return (
    <div>
      <div className="mb-8">
        <div className="chip mb-4">
          <QrCode className="size-3.5 text-brand-2" /> WhatsApp pairing
        </div>
        <h1 className="display text-3xl font-bold tracking-tight sm:text-4xl">
          Connect your WhatsApp
        </h1>
        <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-muted">
          Ek scan — aapka number ShopFlow AI se link ho jayega. Uske baad har incoming
          customer message ka jawab AI khud dega.
        </p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          {/* status */}
          <div className="glass flex items-center justify-between gap-4 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-3">
              {status === "connected" ? (
                <Wifi className="size-5 text-brand-2" />
              ) : (
                <WifiOff className="size-5 text-muted" />
              )}
              <div>
                <p className={`font-mono text-[12px] font-bold tracking-[0.2em] ${meta.tone}`}>
                  <span className={`mr-2 inline-block size-2 rounded-full ${meta.dot}`} />
                  {meta.label}
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {status === "connected" && me
                    ? `${me} — AI assistant live hai`
                    : status === "qr"
                      ? "Phone se scan karne ka intezaar…"
                      : status === "offline"
                        ? "Session logout ho gaya — reset kijiye"
                        : "Engine start ho raha hai…"}
                </p>
              </div>
            </div>
            <button onClick={reset} disabled={resetting} className="btn btn-ghost !px-4 !py-2 !text-[12px]">
              {resetting ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
              Reset
            </button>
          </div>

          {/* steps */}
          <div className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.t} className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <s.icon className="size-5 text-brand-2" strokeWidth={1.9} />
                  <span className="font-mono text-[10px] tracking-[0.25em] text-faint">0{i + 1}</span>
                </div>
                <p className="display mt-4 text-[13.5px] font-bold">{s.t}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{s.d}</p>
              </div>
            ))}
          </div>

          {/* terminal */}
          <div className="glass overflow-hidden rounded-2xl">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <TerminalSquare className="size-4 text-brand-2" />
              <p className="font-mono text-[11px] tracking-[0.2em] text-muted">ENGINE LOG</p>
            </div>
            <div ref={logRef} className="scroll-slim h-48 space-y-1 overflow-y-auto bg-black/40 px-4 py-3 font-mono text-[11px]">
              {logs.length === 0 && <p className="text-faint">waiting for engine…</p>}
              {logs.map((l, i) => (
                <p key={`${l.t}-${i}`} className="text-muted">
                  <span className="text-brand-deep">
                    {new Date(l.t).toLocaleTimeString("en-IN", { hour12: false })}
                  </span>{" "}
                  <span className="text-brand-2">›</span> {l.msg}
                </p>
              ))}
              <span className="inline-block h-3 w-2 animate-blink bg-brand-2/80" />
            </div>
          </div>
        </div>

        {/* QR */}
        <div className="lg:sticky lg:top-24">
          <div className="glass glow-ring relative overflow-hidden rounded-3xl p-6 sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <p className="font-mono text-[11px] tracking-[0.25em] text-faint">LINK CODE</p>
              {status === "qr" && <span className="chip !border-brand-2/40 !text-[10px] !text-brand-2">LIVE</span>}
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-[310px] overflow-hidden rounded-2xl bg-white p-5">
              {status === "qr" && qr ? (
                <>
                  <QRCodeSVG value={qr} size={1024} style={{ width: "100%", height: "100%" }} level="M" />
                  <div
                    className="pointer-events-none absolute inset-x-4 top-4 h-16 rounded-lg bg-gradient-to-b from-transparent via-brand-2/25 to-transparent"
                    style={{ animation: "shimmer-scan 2.6s ease-in-out infinite" }}
                  />
                </>
              ) : status === "connected" ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <span className="grid size-16 place-items-center rounded-full bg-brand-2/15" style={{ animation: "pulse-ring 2s infinite" }}>
                    <BadgeCheck className="size-8 text-[#0a8a45]" strokeWidth={2.2} />
                  </span>
                  <div>
                    <p className="display text-lg font-bold text-[#0a100d]">Connected! 🎉</p>
                    <p className="mt-1 text-[12px] text-[#5c6f66]">{me ? `${me} · ` : ""}AI replying to customers</p>
                  </div>
                  <Link href="/app" className="mt-1 rounded-full bg-[#0a100d] px-5 py-2 text-[12px] font-semibold text-white">
                    View orders →
                  </Link>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[#5c6f66]">
                  {status === "offline" ? (
                    <>
                      <TriangleAlert className="size-8 text-amber" />
                      <p className="text-[13px] font-medium">Session expire ho gaya.<br />Reset dabaiye.</p>
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="size-7 animate-spin-slow text-[#0a8a45]" />
                      <p className="text-[13px] font-medium">Secure session ban raha hai…</p>
                      <p className="max-w-[210px] text-[11px] text-[#8aa197]">Pehli baar ~10 second lag sakte hain.</p>
                    </>
                  )}
                </div>
              )}
            </div>

            <p className="mt-5 text-center text-[12px] leading-relaxed text-muted">
              QR har kuch second mein badalta hai (security). Atak jaye toh{" "}
              <button onClick={reset} className="font-semibold text-brand-2 hover:underline">
                Reset
              </button>{" "}
              dabaiye.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
