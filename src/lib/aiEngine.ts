import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, orders, products } from "@/db/schema";
import { ai, AI_MODEL_CANDIDATES } from "./aiClient";
import { orderEvents, waEvents } from "./events";
import {
  getBusinessById,
  getCatalog,
  getOrderWithUser,
  serializeOrder,
  trackingIdFor,
  upsertCustomer,
} from "./orders";
import { formatMoney } from "./money";
import type { OrderItem } from "./types";
import type { Business } from "@/db/schema";

/* ===================================================================== */
/* Multi-tenant AI Sales Engine                                          */
/* Every business gets its own persona, catalog, quota and conversations */
/* ===================================================================== */

export type Channel = "whatsapp" | "telegram" | "web";
export type SendFn = (text: string) => unknown | Promise<unknown>;

export interface OrderDraftPayload {
  name?: string;
  address?: string;
  items?: Array<{ id?: number; name?: string; qty?: number; price?: number }>;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface FallbackDraft {
  step: "name" | "address" | "confirm";
  items: OrderItem[];
  name?: string;
  address?: string;
}

export interface CreatedOrder {
  id: number;
  businessId: number;
  phone: string;
  name: string | null;
  address: string | null;
  items: OrderItem[];
  total: number;
  currency: string;
}

export interface EngineMode {
  type: "ai" | "fallback";
  model?: string;
  t: number;
}

export interface EngineResult {
  mode: EngineMode;
  quota?: { used: number; limit: number; blocked: boolean };
}

interface EngineGlobal {
  conversations: Map<string, ChatMessage[]>;
  drafts: Map<string, FallbackDraft>;
  queues: Map<string, Promise<void>>;
  logs: Map<number, Array<{ t: number; msg: string }>>;
  senders: Map<string, (identifier: string, text: string) => Promise<boolean>>;
  lastMode: Map<string, EngineMode>;
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

const g = globalThis as unknown as { __shopflowAiEngine?: EngineGlobal };

const E: EngineGlobal =
  g.__shopflowAiEngine ??
  (g.__shopflowAiEngine = {
    conversations: new Map(),
    drafts: new Map(),
    queues: new Map(),
    logs: new Map(),
    senders: new Map(),
    lastMode: new Map(),
  });

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/* ---------------------------- activity log ---------------------------- */

export function logActivity(businessId: number, msg: string) {
  let arr = E.logs.get(businessId);
  if (!arr) {
    arr = [];
    E.logs.set(businessId, arr);
  }
  arr.push({ t: Date.now(), msg });
  if (arr.length > 60) arr.splice(0, arr.length - 60);
  waEvents.emit(`log:${businessId}`, arr[arr.length - 1]);
}

export function getLogs(businessId: number) {
  return E.logs.get(businessId) ?? [];
}

/* ------------------------- channel sender registry ------------------------ */

function senderKey(channel: Channel, businessId: number) {
  return `${channel}:${businessId}`;
}

export function registerChannelSender(
  channel: Channel,
  businessId: number,
  sender: (identifier: string, text: string) => Promise<boolean>,
) {
  E.senders.set(senderKey(channel, businessId), sender);
}

export function unregisterChannelSender(channel: Channel, businessId: number) {
  E.senders.delete(senderKey(channel, businessId));
}

/** Fan a message out to every reachable channel for this business. */
async function broadcast(
  businessId: number,
  identifier: string,
  text: string,
): Promise<Channel[]> {
  const notified: Channel[] = [];
  for (const [key, sender] of E.senders) {
    const [channel, bid] = key.split(":");
    if (Number(bid) !== businessId || channel === "web") continue;
    try {
      if (await sender(identifier, text)) notified.push(channel as Channel);
    } catch {
      /* best effort */
    }
  }
  return notified;
}

/* --------------------------- conversation store --------------------------- */

function keyFor(businessId: number, channel: Channel, identifier: string): string {
  return `${businessId}:${channel}:${identifier.replace(/\D/g, "")}`;
}

function getHistory(key: string): ChatMessage[] {
  let h = E.conversations.get(key);
  if (!h) {
    h = [];
    E.conversations.set(key, h);
    if (E.conversations.size > 2000) {
      const first = E.conversations.keys().next().value;
      if (first && first !== key) E.conversations.delete(first);
    }
  }
  return h;
}

export function clearConversation(
  businessId: number,
  channel: Channel,
  identifier: string,
) {
  const key = keyFor(businessId, channel, identifier);
  E.conversations.delete(key);
  E.drafts.delete(key);
}

/* ------------------- business-specific system prompt --------------------- */

const TONE_GUIDE: Record<string, string> = {
  hinglish:
    'Natural, respectful Hinglish/English mix (e.g. "Namaste ji!", "Bohot badhiya choice hai aapki!"). Mirror the customer\'s language.',
  english: "Warm, polished English. Friendly but professional.",
  hindi: "Respectful conversational Hindi (Devanagari), warm and personal.",
  genz: "Casual, upbeat, emoji-friendly tone — like texting a friend. Still respectful.",
  formal: "Formal, concise, business-professional tone. Minimal emoji.",
};

export async function buildSystemPrompt(business: Business): Promise<string> {
  const catalog = await getCatalog(business.id);
  const cur = business.currency || "INR";
  const lines = catalog.length
    ? catalog
        .map(
          (p) =>
            `   - #${p.id} ${p.name}: ${formatMoney(p.price, cur)}${
              p.description ? ` (${p.description})` : ""
            } — ${p.stock} in stock`,
        )
        .join("\n")
    : "   (No products added yet — politely tell the customer the catalog is being updated.)";

  const tone = TONE_GUIDE[business.botTone] ?? TONE_GUIDE.hinglish;

  return `You are "${business.botName}", the warm, polite and extremely helpful shopkeeper running ${business.name}${
    business.city ? ` in ${business.city}` : ""
  }${business.category ? `, a ${business.category} business` : ""}.
Your primary goal is to make every customer feel valued, welcome and fully guided — like a trusted local dukandar.

ABOUT THE BUSINESS:
${business.tagline ? `- Tagline: ${business.tagline}\n` : ""}${
    business.description ? `- About: ${business.description}\n` : ""
  }${business.deliveryInfo ? `- Delivery: ${business.deliveryInfo}\n` : ""}${
    business.paymentInfo ? `- Payment: ${business.paymentInfo}\n` : ""
  }${business.policies ? `- Policies: ${business.policies}\n` : ""}${
    business.supportPhone ? `- Support contact: ${business.supportPhone}\n` : ""
  }
KEY CONVERSATION GUIDELINES:
1. Tone & Style: ${tone} Keep replies under ~60 words unless summarising an order. Use *bold* for product names and prices, 1–2 emojis max.
2. Customer Care: Treat every user like a valued customer walking into the shop. Ask about their needs, recommend lovingly, guide step-by-step. NEVER invent products, prices or offers that are not listed below.
3. Product Catalog (prices in ${cur} — these are final, never change them):
${lines}
4. Order Flow:
   - Confirm items and quantities politely.
   - To place an order you MUST have: items + quantities, customer's full NAME, and full DELIVERY ADDRESS. Ask politely for whatever is missing — max two questions per message.
   - Before creating the order, recap items, total, name and address with genuine enthusiasm and ask for confirmation.
   - ONLY after the customer explicitly confirms, append exactly one final line at the very end (no code fence, single line, valid JSON):
ORDER_JSON:{"name":"Full Name","address":"Full delivery address","items":[{"id":<catalog id>,"name":"<product>","qty":<number>}]}
   - ids must come from the catalog above. Never output ORDER_JSON before explicit confirmation or with missing name/address.
5. If asked something you don't know (order status, custom requests), reassure them the team will update them right here in this chat.`;
}

/* ------------------------------ AI call ------------------------------ */

async function askAi(
  business: Business,
  channel: Channel,
  identifier: string,
  text: string,
): Promise<{ reply: string; model: string }> {
  const system = await buildSystemPrompt(business);
  const key = keyFor(business.id, channel, identifier);
  const history = getHistory(key);

  let lastErr: unknown;
  for (const model of AI_MODEL_CANDIDATES) {
    try {
      const completion = await ai.chat.completions.create({
        model,
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          ...history.slice(-16),
          { role: "user", content: text },
        ],
      });
      const reply = completion.choices?.[0]?.message?.content?.trim() ?? "";
      if (!reply) throw new Error("empty AI reply");
      history.push({ role: "user", content: text });
      history.push({ role: "assistant", content: reply });
      while (history.length > 28) history.shift();
      if (model !== AI_MODEL_CANDIDATES[0]) {
        logActivity(business.id, `primary model down — carried by ${model}`);
      }
      return { reply, model };
    } catch (err) {
      lastErr = err;
      logActivity(business.id, `model ${model} failed (${errMsg(err).slice(0, 60)})`);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all AI models failed");
}

/** Pulls an ORDER_JSON:{...} directive out of the assistant reply. */
export function extractOrderPayload(reply: string): {
  clean: string;
  payload: OrderDraftPayload | null;
} {
  const idx = reply.toUpperCase().indexOf("ORDER_JSON:");
  if (idx === -1) return { clean: reply.trim(), payload: null };

  const clean = reply.slice(0, idx).trim();
  const jsonStart = reply.indexOf("{", idx);
  if (jsonStart === -1) return { clean, payload: null };

  let depth = 0;
  let end = -1;
  let inStr = false;
  let esc = false;
  for (let i = jsonStart; i < reply.length; i++) {
    const c = reply[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return { clean, payload: null };

  try {
    const raw = JSON.parse(reply.slice(jsonStart, end + 1)) as OrderDraftPayload;
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.items) || raw.items.length === 0) {
      return { clean, payload: null };
    }
    return { clean, payload: raw };
  } catch {
    return { clean, payload: null };
  }
}

/* ----------------------------- order creation ----------------------------- */

export async function createOrderFromPayload(
  business: Business,
  identifier: string,
  payload: OrderDraftPayload,
  channel: Channel = "whatsapp",
): Promise<CreatedOrder | null> {
  const catalog = await getCatalog(business.id);
  const items: OrderItem[] = [];

  for (const it of payload.items ?? []) {
    const qty = Math.max(1, Math.min(100, Math.round(Number(it?.qty)) || 1));
    const nameNeedle = String(it?.name ?? "").toLowerCase();
    const byId =
      it?.id != null && !Number.isNaN(Number(it.id))
        ? catalog.find((p) => p.id === Number(it.id))
        : undefined;
    const byName =
      catalog.find((p) => p.name.toLowerCase() === nameNeedle) ??
      catalog.find((p) => nameNeedle && p.name.toLowerCase().includes(nameNeedle));
    const prod = byId ?? byName;
    if (!prod) continue;
    const existing = items.find((x) => x.id === prod.id);
    if (existing) existing.qty += qty;
    else items.push({ id: prod.id, name: prod.name, qty, price: prod.price });
  }

  if (items.length === 0) return null;

  const cleanPhone = identifier.replace(/\D/g, "");
  const name = String(payload.name ?? "").trim().slice(0, 80) || null;
  const address = String(payload.address ?? "").trim().slice(0, 300) || null;

  await upsertCustomer(business.id, cleanPhone, name, address);

  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  const [order] = await db
    .insert(orders)
    .values({
      businessId: business.id,
      userPhone: cleanPhone,
      channel,
      items: JSON.stringify(items),
      totalAmount: total,
      status: "PENDING",
    })
    .returning();

  for (const it of items) {
    if (it.id == null) continue;
    try {
      await db.execute(
        sql`UPDATE products SET stock = GREATEST(stock - ${it.qty}, 0) WHERE id = ${it.id}`,
      );
    } catch {
      /* ignore */
    }
  }

  orderEvents.emit(`order:${business.id}`, {
    type: "upsert",
    kind: "created",
    order: serializeOrder(order, { name, address }, business.name),
  });

  logActivity(
    business.id,
    `order #${order.id} created (+${cleanPhone}) — ${formatMoney(total, business.currency)}`,
  );

  return {
    id: order.id,
    businessId: business.id,
    phone: cleanPhone,
    name,
    address,
    items,
    total,
    currency: business.currency,
  };
}

/* ---------------------- deterministic fallback flow ----------------------- */

async function fallbackFlow(
  business: Business,
  channel: Channel,
  identifier: string,
  pushName: string | undefined,
  text: string,
  send: SendFn,
) {
  const catalog = await getCatalog(business.id);
  const cur = business.currency;
  const catalogText = catalog
    .map((p) => `${p.id}. *${p.name}* — ${formatMoney(p.price, cur)}`)
    .join("\n");
  const lower = text.toLowerCase();
  const key = keyFor(business.id, channel, identifier);
  const draft = E.drafts.get(key);

  if (!draft) {
    const product =
      catalog.find((p) => lower.includes(p.name.toLowerCase())) ??
      catalog.find((p) =>
        p.name
          .toLowerCase()
          .split(/\s+/)
          .some((w) => w.length > 3 && lower.includes(w)),
      ) ??
      (lower.match(/#?(\d+)/)
        ? catalog.find((p) => p.id === Number(lower.match(/#?(\d+)/)![1]))
        : undefined);

    if (product) {
      const qtyMatch = lower.match(/(\d+)\s*(x|pcs|pieces|units)?/);
      const qty = Math.max(1, Math.min(50, qtyMatch ? Number(qtyMatch[1]) : 1));
      E.drafts.set(key, {
        step: "name",
        items: [{ id: product.id, name: product.name, qty, price: product.price }],
      });
      await send(
        `Bohot badhiya choice! 🔥\n*${product.name}* × ${qty} = *${formatMoney(product.price * qty, cur)}*\n\nAapka *poora naam* bata dijiye, ji.`,
      );
      return;
    }

    await send(
      business.greeting?.trim()
        ? `${business.greeting}\n\n${catalogText}`
        : `Namaste ji! 🙏 *${business.name}* mein aapka swagat hai${pushName ? `, ${pushName}` : ""}.\n\n${
            catalogText || "Catalog abhi update ho raha hai, ji."
          }\n\nBataiye kya chahiye?`,
    );
    return;
  }

  if (draft.step === "name") {
    draft.name = text.trim().slice(0, 80);
    draft.step = "address";
    await send(`Shukriya ${draft.name.split(" ")[0]}-ji! Ab *poora delivery address* bhej dijiye.`);
    return;
  }

  if (draft.step === "address") {
    draft.address = text.trim().slice(0, 300);
    draft.step = "confirm";
    const total = draft.items.reduce((s, i) => s + i.qty * i.price, 0);
    await send(
      `Ek baar confirm kar lijiye:\n${draft.items
        .map((i) => `• ${i.qty} × *${i.name}* — ${formatMoney(i.qty * i.price, cur)}`)
        .join("\n")}\n\n*Total: ${formatMoney(total, cur)}*\nNaam: ${draft.name}\nAddress: ${draft.address}\n\n*YES* likhiye confirm ke liye, ya *NO*.`,
    );
    return;
  }

  if (/^y(es)?\b/i.test(lower) || lower.includes("confirm") || lower.includes("haan")) {
    const created = await createOrderFromPayload(
      business,
      identifier,
      { name: draft.name, address: draft.address, items: draft.items },
      channel,
    );
    E.drafts.delete(key);
    if (created) {
      await send(orderSummaryMessage(business, created));
      await send(paymentLinkMessage(business, created));
    } else {
      await send("Arre, kuch gadbad ho gayi! Ek baar phir try kijiye. 🙏");
    }
    return;
  }
  if (/^no?\b/i.test(lower) || lower.includes("cancel")) {
    E.drafts.delete(key);
    await send("Koi baat nahi ji, order cancel. Aur kuch chahiye toh batayiye 😊");
    return;
  }
  await send("Bas *YES* ya *NO* bol dijiye, ji 😊");
}

/* ---------------------- message builders ------------------------- */

function orderSummaryMessage(business: Business, o: CreatedOrder): string {
  const cur = o.currency;
  const lines = o.items
    .map((i) => `• ${i.qty} × *${i.name}* — ${formatMoney(i.qty * i.price, cur)}`)
    .join("\n");
  return (
    `Wah! 🎉 *Order #${o.id}* confirm ho gaya — *${business.name}*\n\n${lines}\n━━━━━━━━━━━━━\n*Total: ${formatMoney(o.total, cur)}*` +
    (o.name ? `\n\n👤 ${o.name}` : "") +
    (o.address ? `\n🏠 ${o.address}` : "") +
    (business.deliveryInfo ? `\n\n🚚 ${business.deliveryInfo}` : "")
  );
}

function paymentLinkMessage(business: Business, o: CreatedOrder): string {
  return (
    `Bas ek chhota step, ji 💳\n*Order #${o.id}* — *${formatMoney(o.total, o.currency)}*\n\n${APP_URL}/pay/${o.id}\n\n` +
    `Link kholiye aur payment complete kijiye — hum packing shuru karte hain! 🚀`
  );
}

/* --------------------- per-conversation serial queue ------------------- */

function enqueue(key: string, task: () => Promise<void>): Promise<void> {
  const prev = E.queues.get(key) ?? Promise.resolve();
  const next = prev.then(task).catch(() => undefined);
  E.queues.set(key, next);
  return next;
}

/* ------------------------ trial quota enforcement ----------------------- */

async function consumeQuota(
  business: Business,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  if (business.plan !== "TRIAL") {
    return { allowed: true, used: business.trialMessagesUsed, limit: -1 };
  }
  const [row] = await db
    .update(businesses)
    .set({ trialMessagesUsed: sql`${businesses.trialMessagesUsed} + 1` })
    .where(eq(businesses.id, business.id))
    .returning({ used: businesses.trialMessagesUsed, limit: businesses.trialMessageLimit });

  const used = row?.used ?? business.trialMessagesUsed + 1;
  const limit = row?.limit ?? business.trialMessageLimit;
  return { allowed: used <= limit, used, limit };
}

/* ----------------------- public conversation entry -------------------- */

export async function processIncomingText(
  businessId: number,
  channel: Channel,
  identifier: string,
  pushName: string | undefined,
  text: string,
  send: SendFn,
): Promise<EngineResult> {
  const business = await getBusinessById(businessId);
  if (!business) {
    await send("This store is not available right now.");
    return { mode: { type: "fallback", t: Date.now() } };
  }

  const quota = await consumeQuota(business);
  if (!quota.allowed) {
    logActivity(business.id, `trial limit reached (${quota.used}/${quota.limit})`);
    await send(
      `🚫 *Free trial limit reached* (${quota.limit} messages).\n\nAapka AI assistant abhi pause hai. Owner ko bolo *${APP_URL}* par upgrade karne ke liye — fir unlimited chat chालू! 🚀`.replace(
        "चालू",
        "chaalu",
      ),
    );
    return {
      mode: { type: "fallback", t: Date.now() },
      quota: { used: quota.used, limit: quota.limit, blocked: true },
    };
  }

  const clean = identifier.replace(/\D/g, "");
  const key = keyFor(business.id, channel, identifier);
  let mode: EngineMode = { type: "fallback", t: Date.now() };

  await enqueue(key, async () => {
    if (clean) await upsertCustomer(business.id, clean, pushName, null);
    try {
      const { reply, model } = await askAi(business, channel, identifier, text);
      mode = { type: "ai", model, t: Date.now() };
      E.lastMode.set(key, mode);
      if (E.drafts.has(key)) E.drafts.delete(key);
      const { clean: cleanReply, payload } = extractOrderPayload(reply);
      if (cleanReply) await send(cleanReply);
      if (payload) {
        if (!payload.address || String(payload.address).trim().length < 8) {
          await send("Bas *poora delivery address* chahiye, ji 🏠");
          return;
        }
        const created = await createOrderFromPayload(business, clean, payload, channel);
        if (created) {
          await send(orderSummaryMessage(business, created));
          await send(paymentLinkMessage(business, created));
        } else {
          await send("Ye item abhi catalog mein nahi hai — main list bhej doon?");
        }
      }
    } catch (err) {
      mode = { type: "fallback", t: Date.now() };
      E.lastMode.set(key, mode);
      logActivity(business.id, `AI unreachable (${errMsg(err).slice(0, 60)}) — fallback active`);
      await fallbackFlow(business, channel, identifier, pushName, text, send);
    }
  });

  return {
    mode,
    quota:
      quota.limit > 0
        ? { used: quota.used, limit: quota.limit, blocked: false }
        : undefined,
  };
}

export function getLastMode(
  businessId: number,
  channel: Channel,
  identifier: string,
): EngineMode | null {
  return E.lastMode.get(keyFor(businessId, channel, identifier)) ?? null;
}

/* ---------------------- lifecycle notifications ------------------------ */

async function notify(orderId: number, build: (o: NonNullable<Awaited<ReturnType<typeof getOrderWithUser>>>, b: Business) => string) {
  const order = await getOrderWithUser(orderId);
  if (!order) return [];
  const business = await getBusinessById(order.businessId);
  if (!business) return [];
  return broadcast(business.id, order.userPhone, build(order, business));
}

export async function notifyPaymentReceived(orderId: number): Promise<Channel[]> {
  return notify(orderId, (o, b) =>
    `🎉 *Payment received!* Order *#${o.id}* (${formatMoney(o.totalAmount, b.currency)}) is being processed at *${b.name}*.\n\nShip hote hi yahin update milega! 📦`,
  );
}

export async function notifyDispatched(orderId: number): Promise<Channel[]> {
  return notify(orderId, (o, b) =>
    `🚚 *Order dispatched!*\n\nOrder *#${o.id}* nikal chuka hai.\nTracking ID: *${trackingIdFor(o.id)}*\n${b.deliveryInfo ?? "ETA: 2–3 business days"} ⏱️`,
  );
}

export async function notifyDelivered(orderId: number): Promise<Channel[]> {
  return notify(orderId, (o, b) =>
    `✅ *Delivered!* Order *#${o.id}* aap tak pahunch gaya.\n\nShukriya for shopping with *${b.name}*! Koi dikkat ho toh yahin batayiye 💚`,
  );
}

export { products };
