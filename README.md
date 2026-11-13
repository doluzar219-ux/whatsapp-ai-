# ShopFlow AI — WhatsApp & Telegram-Native E-Commerce Platform

> Sell on autopilot, inside the chat. An AI shopkeeper ("ShopFlow Bhaiya")
> negotiates with customers on WhatsApp or Telegram, builds real orders in
> PostgreSQL, drops mock payment links, and pings delivery updates — while a
> realtime admin dashboard watches everything.

**Status:** ✅ 23/23 automated checks passing · see [`report.md`](report.md)

---

## ✨ Screenshots

### 🏠 Landing · Live Catalog · Pipeline
![Landing](docs/screenshots/01-landing.png)

### 📱 WhatsApp QR Pairing Console (`/whatsapp`)
Live Baileys QR streamed over SSE, with a real-time engine-log terminal,
connection states and 1-click session reset.

![WhatsApp QR Console](docs/screenshots/02-whatsapp-qr.png)

### 📊 Realtime Admin Mission Control (`/admin`)
Live SSE order stream, revenue / orders / pending-payment / delivered metrics,
status dropdowns that auto-notify the customer on their messaging app, and
1-click PDF shipping labels. Note the **TELEGRAM LIVE** chip.

![Admin Dashboard](docs/screenshots/03-admin-dashboard.png)

### 🧪 AI Sales Engine Simulator (`/demo`)
Drive the *exact* bot brain from the browser — no QR scan needed. Real orders,
real payment links.

![AI Simulator](docs/screenshots/04-ai-simulator.png)

### 💳 Mock Checkout (`/pay/:orderId`)
| Before payment | After payment |
|---|---|
| ![Pay](docs/screenshots/05-payment-page.png) | ![Paid](docs/screenshots/06-payment-success.png) |

---

## 🚀 Feature Set

| Surface | What it does |
|---|---|
| `/whatsapp` | Baileys WhatsApp pairing: live rotating QR via SSE, engine logs, session reset |
| **Telegram Bot** | Long-polling bridge (pure `fetch`, no extra deps) — message `@Shoppinglol_bot` → same AI engine, same orders, same notifications |
| `/demo` | Browser simulator wired into the identical `processIncomingText()` pipeline |
| `/admin` | Realtime SSE dashboard: metrics, status lifecycle, auto customer notifications, PDF labels |
| `/pay/:id` | Self-contained mock checkout → `PENDING → PAID_MOCK` + chat confirmation |
| AI Engine | Custom OpenAI-compatible gateway (`AI_BASE_URL`/`AI_MODEL`), "ShopFlow Bhaiya" Hinglish Dukandar persona, single-line `ORDER_JSON:` order protocol |
| Fallback Brain | Deterministic Dukandar conversation takes over seamlessly if the AI gateway rate-limits — no message ever goes unanswered |
| PDF Labels | A6 thermal-style slip with deterministic tracking barcode, generated with PDFKit |

## 🧠 How the Workflow Runs

```
CUSTOMER (phone)                         SERVER                              ADMIN
─────────────────                        ──────                              ─────
"2 earbuds chahiye" ──┐
 (WhatsApp /          │  1. inbound message
  Telegram)           ▼
                ┌──────────────┐   chat completions   ┌──────────────────┐
                │  AI ENGINE   │ ───────────────────▶ │ ai.apinex.bond   │
                │ "ShopFlow    │ ◀─────────────────── │ free/gemini-*    │
                │  Bhaiya"     │   reply + ORDER_JSON  └──────────────────┘
                └──────┬───────┘
                       │ 2. prices re-derived from Postgres catalog
                       ▼
                ┌──────────────┐   SSE "order.created"   ┌───────────────┐
                │  PostgreSQL  │ ──────────────────────▶ │  /admin board │
                │ users/orders │                         │ updates live  │
                └──────┬───────┘                         └───────────────┘
                       │ 3. "Order #N pakka ho gaya 🎉"  + payment link
 💳 opens link ◀───────┘    "${APP_URL}/pay/N"
     /pay/N            ┐
  "Complete Mock      │  4. PENDING → PAID_MOCK
   Payment" ──────────┼──▶ PATCH /api/orders/N/status ──▶ 🎉 chat confirm
                       │                                   (WA + Telegram)
                       │  5. admin flips status
                       │     DISPATCHED  ──▶ 🚚 tracking ID on chat
                       │     DELIVERED   ──▶ ✅ delivery note on chat
                       │  6. GET /api/orders/N/label ──▶ A6 PDF shipping slip
```

**Status lifecycle:** `PENDING → PAID_MOCK → DISPATCHED → DELIVERED` (+ `CANCELLED`)

---

## 🏗️ Architecture

One **shared channel-agnostic brain** (`src/lib/aiEngine.ts`) — WhatsApp,
Telegram and the web simulator are thin adapters that register a sender and
forward text in/out. Lifecycle notifications fan out to every registered
channel.

```
src/
├── lib/
│   ├── aiEngine.ts        ★ shared sales brain (persona, ORDER_JSON protocol,
│   │                        orders, fallback flow, channel registry, notifiers)
│   ├── whatsappBot.ts       Baileys v7 lifecycle (QR, reconnects) + WA sender
│   ├── telegramBot.ts       fetch long-polling bridge + TG sender
│   ├── notifiers.ts         import-once bridge → fan-out to all channels
│   ├── aiClient.ts          OpenAI SDK → custom OpenAI-compatible gateway
│   ├── orders.ts            Drizzle queries, serializers, tracking IDs, seed
│   ├── labelGen.ts          PDFKit A6 shipping label generator
│   ├── events.ts            in-process SSE event bus (globalThis singletons)
│   └── money.ts / types.ts  client-safe helpers
├── app/
│   ├── page.tsx             landing (live catalog from Postgres)
│   ├── whatsapp/page.tsx    QR pairing console (SSE-driven)
│   ├── demo/page.tsx        AI simulator chat
│   ├── admin/page.tsx       realtime ops dashboard (SSE-driven)
│   ├── pay/[orderId]/       mock checkout (server page + client checkout)
│   └── api/
│       ├── whatsapp/qr      SSE stream (state + logs) — boots engine
│       ├── whatsapp/logout  session reset → fresh QR
│       ├── telegram/status  bridge health (boots poller)
│       ├── orders           GET all orders (joined with users)
│       ├── orders/stream    SSE: snapshot + upsert events
│       ├── orders/[id]/status  PATCH lifecycle (+ notifications fan-out)
│       ├── orders/[id]/label   GET → streamed PDF (attachment)
│       └── simulate           POST → drives the real engine from the browser
└── instrumentation.ts       boots both messaging engines at server start
```

### Database schema (PostgreSQL via Drizzle)

```sql
users(phone PK, name, address)
products(id, name, price, stock)
orders(id, user_phone, items JSON, total_amount, status, created_at)
```

Seed catalog: **Wireless Earbuds ₹1,299** · **Smart Watch ₹1,999** ·
**Mechanical Keyboard ₹2,499**.

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, RSC, SSE route handlers) · React 19 · TypeScript |
| Data | PostgreSQL + Drizzle ORM (`drizzle-kit push`) |
| WhatsApp | `@whiskeysockets/baileys` v7 (multi-file auth session in `auth_info_baileys/`) |
| Telegram | Bot API long polling over native `fetch` (no dependency) |
| AI | `openai` SDK → custom gateway (`AI_BASE_URL`, model `AI_MODEL`) |
| PDF | PDFKit (A6 thermal-style label w/ deterministic barcode) |
| UI | Tailwind CSS 4 design system · `qrcode.react` · Lucide icons |
| Tests | `scripts/smoke.mjs` (23 checks) · `scripts/screenshot.mjs` (Playwright) |

## ⚙️ Setup

```bash
npm install
# env (also baked-in demo fallbacks from the project brief):
#   DATABASE_URL, AI_API_KEY, AI_BASE_URL, AI_MODEL,
#   NEXT_PUBLIC_APP_URL, TELEGRAM_BOT_TOKEN, USE_TELEGRAM_TESTING=true
npx drizzle-kit push --force          # create tables
psql "$DATABASE_URL" -c "INSERT INTO products (name, price, stock) VALUES
  ('Wireless Earbuds',1299,25),('Smart Watch',1999,18),('Mechanical Keyboard',2499,12)
  ON CONFLICT DO NOTHING;"            # seed catalog
npm run build && npm run start          # or npm run dev
```

> Env vars are always read via `process.env` first; the repo additionally ships
> the brief's demo credentials as fallbacks so sandbox runtimes that regenerate
> env files keep every integration alive. Override with real values in
> production.

## ✅ Testing

```bash
node scripts/smoke.mjs        # 23 end-to-end checks → 23 PASS (see report.md)
node scripts/screenshot.mjs   # regenerates docs/screenshots/*
```

The smoke suite covers: all pages, API guardrails (400/404), WhatsApp SSE
boot + live QR + log stream + session reset → fresh QR, Telegram bridge
health, a full 4-turn Dukandar order conversation, server-side price
integrity, SSE snapshot propagation, the entire payment lifecycle,
dispatch/delivery transitions and PDF label byte-stream validation.

## 🧾 Engine Transparency (real AI vs scripted)

Every reply is stamped with its origin so you always know when the LLM — and
your token balance — is in play:

- **Model fallback chain** (`AI_MODEL` → `AI_FALLBACK_MODELS`): if the primary
  free model rate-limits or errors, the next free model carries the reply —
  still **real AI with real token spend** — before the scripted brain is ever
  reached.
- `/api/simulate` returns `engine: { type: "ai" | "fallback", model }` per
  response (also readable via `getLastMode()` for bot channels).
- The `/demo` chat badges every bot bubble (**⚡ REAL AI** / **SCRIPT**) and
  pins the live model (`LIVE AI · gemini-3.8-flash`) or an amber
  **SCRIPTED · 0 AI TOKENS** chip in the header.
- The `/whatsapp` engine-log terminal shows `[channel] model X failed …` and
  `carried by fallback model …` events live.

Verified: full AI order loop (`free/gemini-3.8-flash` → recap → `ORDER_JSON` →
order row → payment link) on the deployed build.

## 🎙️ The Persona: "ShopFlow Bhaiya"

A warm, respectful neighborhood shopkeeper (*Dukandar*): Hinglish-first
("Namaste ji!", "Bohot badhiya choice hai aapki!"), mirrors the customer's
language, max 1–2 emojis, short WhatsApp-native messages, loving product
recommendations, polite name/address collection, enthusiastic recap before
ordering — and prices always enforced from the database, never from the model.

## 🔒 Security & Integrity Notes

- Prices are **never** trusted from the LLM — the engine re-derives totals
  from the `products` table when materializing `ORDER_JSON`.
- Secrets are read from `process.env` (demo fallbacks are clearly marked).
- AI gateway failures degrade gracefully to the deterministic Dukandar flow.
- Baileys auth session lives in `auth_info_baileys/`; reset via the QR page
  or `POST /api/whatsapp/logout`.

---

**Verification:** full automated matrix & environment details → [`report.md`](report.md)
