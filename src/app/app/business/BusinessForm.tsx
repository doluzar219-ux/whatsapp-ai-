"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Loader2, Save, Sparkles, Store } from "lucide-react";
import type { Business } from "@/db/schema";

const TONES = [
  { v: "hinglish", label: "Hinglish (recommended)", hint: '"Namaste ji! Bohot badhiya choice!"' },
  { v: "english", label: "English", hint: '"Hello! Great choice."' },
  { v: "hindi", label: "Hindi", hint: '"नमस्ते जी! बढ़िया पसंद है।"' },
  { v: "genz", label: "Gen-Z casual", hint: '"yooo this one slaps 🔥"' },
  { v: "formal", label: "Formal", hint: '"Good afternoon. How may I assist?"' },
];

const CATEGORIES = [
  "Electronics", "Fashion & Clothing", "Grocery / Kirana", "Bakery & Sweets",
  "Pharmacy", "Mobile & Accessories", "Home & Kitchen", "Beauty & Cosmetics",
  "Gifts & Decor", "Books & Stationery", "Sports & Fitness", "Other",
];

export function BusinessForm({ business, welcome }: { business: Business; welcome: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: business.name ?? "",
    category: business.category ?? "",
    tagline: business.tagline ?? "",
    description: business.description ?? "",
    city: business.city ?? "",
    supportPhone: business.supportPhone ?? "",
    currency: business.currency ?? "INR",
    deliveryInfo: business.deliveryInfo ?? "",
    paymentInfo: business.paymentInfo ?? "",
    policies: business.policies ?? "",
    botName: business.botName ?? "ShopFlow Bhaiya",
    botTone: business.botTone ?? "hinglish",
    greeting: business.greeting ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, onboarded: true }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {welcome && (
        <div className="glass glow-ring mb-8 rounded-2xl p-6 animate-pop-in">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-2/15 text-brand-2">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="display text-lg font-bold">Swagat hai! 🎉 Ab AI ko apna business bataiye</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                Jitni detail dengi, AI utna hi accha salesman banega. Ye info har customer
                conversation mein use hoti hai — products, delivery, policies sab.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="chip mb-4">
            <Store className="size-3.5 text-brand-2" /> Business profile
          </div>
          <h1 className="display text-3xl font-bold tracking-tight sm:text-4xl">
            Tell AI about your business
          </h1>
        </div>
        <Link href="/app/products" className="btn btn-ghost !text-[13px]">
          Next: add products <ArrowRight className="size-4" />
        </Link>
      </div>

      <form onSubmit={save} className="grid gap-5 lg:grid-cols-2">
        {/* identity */}
        <section className="glass rounded-2xl p-6">
          <h3 className="display mb-5 text-[15px] font-bold">Basic info</h3>
          <div className="space-y-3.5">
            <Input label="Business name *" value={f.name} onChange={set("name")} placeholder="Sharma Electronics" />
            <Select label="Category" value={f.category} onChange={set("category")} options={CATEGORIES} placeholder="Select category" />
            <Input label="City" value={f.city} onChange={set("city")} placeholder="Pune" />
            <Input label="Tagline" value={f.tagline} onChange={set("tagline")} placeholder="Best gadgets at best prices" />
            <Textarea
              label="About your business"
              value={f.description}
              onChange={set("description")}
              placeholder="Hum 15 saal se electronics bech rahe hain. Original products, warranty ke saath..."
              rows={4}
            />
          </div>
        </section>

        {/* operations */}
        <section className="glass rounded-2xl p-6">
          <h3 className="display mb-5 text-[15px] font-bold">Operations</h3>
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Support phone" value={f.supportPhone} onChange={set("supportPhone")} placeholder="+91 98765 43210" />
              <Select label="Currency" value={f.currency} onChange={set("currency")} options={["INR", "USD", "AED", "GBP", "EUR"]} />
            </div>
            <Textarea label="Delivery info" value={f.deliveryInfo} onChange={set("deliveryInfo")} placeholder="Pune mein free delivery, 2-3 din. Baaki India ₹60 charge." rows={2} />
            <Textarea label="Payment info" value={f.paymentInfo} onChange={set("paymentInfo")} placeholder="UPI, cards, COD available" rows={2} />
            <Textarea label="Policies (returns, warranty)" value={f.policies} onChange={set("policies")} placeholder="7 din return, 1 saal warranty" rows={3} />
          </div>
        </section>

        {/* AI persona */}
        <section className="glass rounded-2xl p-6 lg:col-span-2">
          <h3 className="display mb-1 text-[15px] font-bold">AI assistant ki personality</h3>
          <p className="mb-5 text-[12.5px] text-muted">
            Ye decide karta hai ki aapka bot customers se kaise baat karega.
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3.5">
              <Input label="Bot ka naam" value={f.botName} onChange={set("botName")} placeholder="Sharma Bhaiya" />
              <Textarea
                label="Welcome message (optional)"
                value={f.greeting}
                onChange={set("greeting")}
                placeholder="Namaste ji! Sharma Electronics mein aapka swagat hai 🙏"
                rows={3}
              />
            </div>
            <div>
              <label className="mb-2 block text-[12px] font-medium text-muted">Tone</label>
              <div className="space-y-2">
                {TONES.map((t) => (
                  <button
                    key={t.v}
                    type="button"
                    onClick={() => set("botTone")(t.v)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                      f.botTone === t.v
                        ? "border-brand-2/50 bg-brand-2/10"
                        : "border-line hover:border-brand-2/30"
                    }`}
                  >
                    <span>
                      <span className="block text-[13px] font-medium">{t.label}</span>
                      <span className="block text-[11px] text-faint">{t.hint}</span>
                    </span>
                    {f.botTone === t.v && <Check className="size-4 shrink-0 text-brand-2" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3 lg:col-span-2">
          <button type="submit" disabled={busy} className="btn btn-primary !px-6 !py-3">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save & train AI
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-[13px] text-brand-2 animate-pop-in">
              <Check className="size-4" /> Saved — AI updated!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

/* ------------------------------ fields ------------------------------ */

function Input({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-muted">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="field w-full" />
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-muted">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="field w-full resize-none" />
    </div>
  );
}

function Select({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-muted">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field w-full cursor-pointer">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
