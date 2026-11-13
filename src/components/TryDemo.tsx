"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Lock, SendHorizonal, Sparkles } from "lucide-react";

interface Msg {
  id: number;
  from: "user" | "bot";
  text: string;
  ai?: boolean | null;
  payId?: number | null;
}

let uid = 0;

function renderWa(text: string) {
  return text.split("\n").map((line, li) => (
    <p key={li} className={li > 0 ? "mt-1" : ""}>
      {line.split(/(\*[^*]+\*)/g).map((part, pi) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
          <strong key={pi} className="font-bold">
            {part.slice(1, -1)}
          </strong>
        ) : (
          <span key={pi}>{part}</span>
        ),
      )}
    </p>
  ));
}

const QUICK = ["Kya bechte ho?", "2 earbuds chahiye", "Ravi Kumar", "12 MG Road, Pune 411001", "haan confirm"];

export function TryDemo() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: ++uid,
      from: "bot",
      text: "Namaste ji! 🙏 Main *ShopFlow AI* ka demo assistant hoon.\n\nPoochiye — *kya bechte ho?* — aur pura order yahin bana ke dekhiye. Ye bilkul wahi AI hai jo aapke customers se WhatsApp par baat karega!",
      ai: null,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [trial, setTrial] = useState<{ used: number; limit: number } | null>(null);
  const [locked, setLocked] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy || locked) return;
    setInput("");
    setMessages((p) => [...p, { id: ++uid, from: "user", text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.trial) setTrial(data.trial);
      if (data.locked) setLocked(true);
      const replies: string[] = data.replies ?? [];
      const isAi = data.engine?.type === "ai";
      setMessages((p) => [
        ...p,
        ...replies.map((r: string) => {
          const m = r.match(/\/pay\/(\d+)/);
          return {
            id: ++uid,
            from: "bot" as const,
            text: r,
            ai: data.locked ? null : isAi,
            payId: m ? Number(m[1]) : null,
          };
        }),
      ]);
    } catch {
      setMessages((p) => [
        ...p,
        { id: ++uid, from: "bot", text: "Network issue — ek baar phir try kijiye.", ai: null },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const left = trial ? Math.max(0, trial.limit - trial.used) : 5;

  return (
    <div className="glass glow-ring relative overflow-hidden rounded-3xl">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-line bg-white/[0.03] px-5 py-3.5">
        <div className="relative">
          <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-brand-2 to-brand-deep font-display text-sm font-bold text-[#03130a]">
            S
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[#0a100d] bg-brand-2" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">ShopFlow Demo Store</p>
          <p className="text-[11px] text-brand-2">online · AI assistant</p>
        </div>
        <span
          className={`chip !text-[10px] ${
            locked ? "!border-red/40 !text-red" : "!border-brand-2/40 !text-brand-2"
          }`}
        >
          {locked ? <Lock className="size-3" /> : <Sparkles className="size-3" />}
          {locked ? "LIMIT REACHED" : `${left} FREE LEFT`}
        </span>
      </div>

      {/* chat */}
      <div
        ref={boxRef}
        className="scroll-slim flex h-[380px] flex-col gap-2 overflow-y-auto px-4 py-4"
        style={{
          backgroundColor: "#0b141a",
          backgroundImage: "radial-gradient(rgba(134,150,160,0.10) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`wa-bubble animate-pop-in ${m.from === "bot" ? "wa-in" : "wa-out"}`}
          >
            {m.from === "bot" && m.ai !== null && m.ai !== undefined && (
              <span
                className={`mb-1 inline-block rounded px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest ${
                  m.ai ? "bg-brand-2/15 text-brand-2" : "bg-amber/15 text-amber"
                }`}
              >
                {m.ai ? "⚡ REAL AI" : "SCRIPT"}
              </span>
            )}
            {m.from === "bot" ? renderWa(m.text) : <p>{m.text}</p>}
            {m.payId && (
              <a
                href={`/pay/${m.payId}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-brand-2/40 bg-brand-2/15 px-3 py-2 text-[12px] font-bold text-brand-2 transition-transform hover:scale-[1.02]"
              >
                💳 Open payment link — Order #{m.payId}
              </a>
            )}
          </div>
        ))}
        {busy && (
          <div className="wa-bubble wa-in animate-pop-in">
            <span className="typing-dots text-[#e9edf0]">
              <span /> <span /> <span />
            </span>
          </div>
        )}
        {locked && (
          <Link
            href="/signup"
            className="btn btn-primary mx-auto mt-2 !text-[12px] animate-pop-in"
          >
            Sign up free — get your own AI shop →
          </Link>
        )}
      </div>

      {/* quick prompts */}
      {!locked && (
        <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-2.5">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => void send(q)}
              disabled={busy}
              className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted transition-all hover:border-brand-2/40 hover:text-ink disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex items-center gap-2 border-t border-line bg-white/[0.02] px-4 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy || locked}
          placeholder={locked ? "Sign up to continue…" : "Type like a customer…"}
          className="field flex-1 !rounded-full"
        />
        <button
          type="submit"
          disabled={busy || locked || !input.trim()}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-2 to-brand-deep text-[#03130a] transition-transform hover:scale-105 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizonal className="size-4" strokeWidth={2.4} />
          )}
        </button>
      </form>
    </div>
  );
}
