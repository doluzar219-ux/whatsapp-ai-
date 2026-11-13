"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Check,
  ImageIcon,
  Loader2,
  Package,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";

const EMPTY = { name: "", price: "", stock: "", description: "", imageUrl: "" };

export function ProductsManager({
  initial,
  currency,
}: {
  initial: ProductDTO[];
  currency: string;
}) {
  const [items, setItems] = useState<ProductDTO[]>(initial);
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function startEdit(p: ProductDTO) {
    setEditId(p.id);
    setForm({
      name: p.name,
      price: String(p.price),
      stock: String(p.stock),
      description: p.description ?? "",
      imageUrl: p.imageUrl ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditId(null);
    setForm({ ...EMPTY });
    setErr(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        ...(editId ? { id: editId } : {}),
        name: form.name,
        price: Number(form.price),
        stock: Number(form.stock || 0),
        description: form.description,
        imageUrl: form.imageUrl,
      };
      const res = await fetch("/api/products", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed");
      setItems((prev) =>
        editId ? prev.map((p) => (p.id === editId ? data.product : p)) : [...prev, data.product],
      );
      cancelEdit();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: ProductDTO) {
    const res = await fetch("/api/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, active: !p.active }),
    });
    const data = await res.json();
    if (data.ok) setItems((prev) => prev.map((x) => (x.id === p.id ? data.product : x)));
  }

  async function remove(id: number) {
    await fetch(`/api/products?id=${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  const totalValue = items.reduce((s, p) => s + p.price * p.stock, 0);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="chip mb-4">
            <Boxes className="size-3.5 text-brand-2" /> Catalog
          </div>
          <h1 className="display text-3xl font-bold tracking-tight sm:text-4xl">
            Your products
          </h1>
          <p className="mt-2 text-[13px] text-muted">
            AI sirf yahi products bechega — prices yahan se hi aate hain, hallucination
            impossible.
          </p>
        </div>
        <Link href="/app/connect" className="btn btn-ghost !text-[13px]">
          Next: connect WhatsApp <ArrowRight className="size-4" />
        </Link>
      </div>

      {/* stats */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ["TOTAL PRODUCTS", String(items.length)],
          ["ACTIVE", String(items.filter((p) => p.active).length)],
          ["STOCK VALUE", formatMoney(totalValue, currency)],
        ].map(([l, v]) => (
          <div key={l} className="glass rounded-xl px-4 py-3">
            <p className="font-mono text-[10px] tracking-[0.2em] text-faint">{l}</p>
            <p className="display mt-1 text-xl font-bold">{v}</p>
          </div>
        ))}
      </div>

      {/* add/edit form */}
      <form onSubmit={submit} className="glass glow-ring relative mb-8 rounded-2xl p-6">
        <h3 className="display mb-5 text-[15px] font-bold">
          {editId ? "Edit product" : "Add a product"}
        </h3>
        <div className="grid gap-3.5 md:grid-cols-[1.4fr_0.8fr_0.7fr]">
          <div>
            <label className="mb-1.5 block text-[12px] text-muted">Product name *</label>
            <input value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="Wireless Earbuds" className="field w-full" required />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] text-muted">Price ({currency}) *</label>
            <input type="number" min="0" step="1" value={form.price} onChange={(e) => set("price")(e.target.value)} placeholder="1299" className="field w-full" required />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] text-muted">Stock qty</label>
            <input type="number" min="0" value={form.stock} onChange={(e) => set("stock")(e.target.value)} placeholder="25" className="field w-full" />
          </div>
        </div>
        <div className="mt-3.5 grid gap-3.5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[12px] text-muted">Description (AI isse pitch karega)</label>
            <input value={form.description} onChange={(e) => set("description")(e.target.value)} placeholder="Bass heavy, 24h battery, fast charge" className="field w-full" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] text-muted">Photo URL (optional)</label>
            <input value={form.imageUrl} onChange={(e) => set("imageUrl")(e.target.value)} placeholder="https://… product photo link" className="field w-full" />
          </div>
        </div>

        {err && <p className="mt-3 rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[12px] text-red">{err}</p>}

        <div className="mt-5 flex items-center gap-2.5">
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? <Loader2 className="size-4 animate-spin" /> : editId ? <Check className="size-4" /> : <Plus className="size-4" />}
            {editId ? "Save changes" : "Add product"}
          </button>
          {editId && (
            <button type="button" onClick={cancelEdit} className="btn btn-ghost">
              <X className="size-4" /> Cancel
            </button>
          )}
        </div>
      </form>

      {/* list */}
      {items.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl py-16 text-center">
          <Package className="size-8 text-faint" strokeWidth={1.6} />
          <p className="text-sm text-muted">Abhi koi product nahi — upar se add kijiye.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className={`glass card-hover overflow-hidden rounded-2xl ${p.active ? "" : "opacity-55"}`}>
              <div className="relative h-36 overflow-hidden bg-gradient-to-br from-brand-deep/25 to-panel-2">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-faint">
                    <ImageIcon className="size-8" strokeWidth={1.4} />
                  </div>
                )}
                <span className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[9px] tracking-widest text-ink backdrop-blur">
                  #{p.id}
                </span>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="display text-[15px] font-bold leading-tight">{p.name}</h3>
                  <p className="display shrink-0 text-lg font-bold text-brand-2">
                    {formatMoney(p.price, currency)}
                  </p>
                </div>
                {p.description && (
                  <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
                    {p.description}
                  </p>
                )}
                <p className="mt-2.5 font-mono text-[11px] text-faint">{p.stock} in stock</p>
                <div className="mt-4 flex items-center gap-1.5">
                  <button onClick={() => startEdit(p)} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[11px] text-muted transition-all hover:border-brand-2/40 hover:text-brand-2">
                    <Pencil className="size-3" /> Edit
                  </button>
                  <button onClick={() => toggleActive(p)} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[11px] text-muted transition-all hover:border-sky/40 hover:text-sky">
                    {p.active ? "Hide" : "Show"}
                  </button>
                  <button onClick={() => remove(p.id)} className="ml-auto grid size-7 place-items-center rounded-full border border-line text-muted transition-all hover:border-red/40 hover:text-red">
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
