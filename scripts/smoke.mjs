#!/usr/bin/env node
/**
 * ShopFlow AI — end-to-end smoke suite.
 * Zero-dependency; drives the live server over HTTP (pages, REST APIs, SSE
 * streams) and executes a full conversational order → payment → dispatch
 * lifecycle through the same AI engine the bots use.
 *
 * Usage: BASE=http://localhost:3000 node scripts/smoke.mjs
 */

const BASE = (process.env.BASE ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const PHONE = `91888${Math.floor(1000000 + Math.random() * 8999999)}`;

let passed = 0;
let failed = 0;
const results = [];

function report(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  if (ok) passed++;
  else failed++;
}

async function fetchJson(path, init, timeout = 30_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(BASE + path, { ...init, signal: controller.signal });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-json */
    }
    return { status: res.status, json, text, headers: res.headers };
  } finally {
    clearTimeout(t);
  }
}

function readSSE(path, seconds, predicate) {
  return new Promise((resolve) => {
    const found = [];
    const controller = new AbortController();
    let buf = "";
    fetch(BASE + path, { signal: controller.signal })
      .then(async (res) => {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        const timer = setTimeout(() => controller.abort(), seconds * 1000);
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const frames = buf.split("\n\n");
            buf = frames.pop() ?? "";
            for (const frame of frames) {
              if (!frame.startsWith("data:")) continue;
              try {
                const data = JSON.parse(frame.slice(5));
                if (predicate(data)) found.push(data);
              } catch {
                /* heartbeat */
              }
            }
            if (found.length) {
              clearTimeout(timer);
              controller.abort();
              return;
            }
          }
        } catch {
          /* abort = done */
        } finally {
          clearTimeout(timer);
        }
      })
      .catch(() => undefined)
      .finally(() =>
        // Wait the full window when nothing matched yet.
        setTimeout(() => resolve(found), found.length ? 0 : seconds * 1000),
      );
  });
}

async function simulate(text, extra = {}) {
  const res = await fetchJson(
    "/api/simulate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: PHONE, name: "Smoke Tester", text, ...extra }),
    },
    75_000,
  );
  return res;
}

async function main() {
  console.log(`\nShopFlow AI smoke suite → ${BASE}\nphone: ${PHONE}\n`);

  /* ----------------------------- pages (5) ----------------------------- */
  for (const [path, marker] of [
    ["/", "ShopFlow"],
    ["/whatsapp", "Baileys pairing console"],
    ["/admin", "Mission Control"],
    ["/demo", "Sales engine lab"],
  ]) {
    const home = await fetch(BASE + path);
    const body = await home.text();
    report(`GET ${path}`, home.status === 200 && body.includes(marker), `HTTP ${home.status}`);
  }

  /* ------------------------------ APIs -------------------------------- */
  const health = await fetchJson("/api/health");
  report("GET /api/health", health.status === 200 && health.json?.ok === true);

  const orders0 = await fetchJson("/api/orders");
  report(
    "GET /api/orders",
    orders0.status === 200 && Array.isArray(orders0.json?.orders),
    `${orders0.json?.orders?.length ?? 0} existing orders`,
  );

  const badStatus = await fetchJson(`/api/orders/999999/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PAID_MOCK" }),
  });
  report("PATCH missing order → 404", badStatus.status === 404);

  const badEnum = await fetchJson(`/api/orders/1/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "NOT_A_STATUS" }),
  });
  report("PATCH invalid status enum → 400", badEnum.status === 400);

  /* ------------------------- WhatsApp engine (SSE) ---------------------- */
  const waState = await readSSE("/api/whatsapp/qr", 14, (d) => d.type === "state");
  const hasEngineState = waState.some((s) => ["qr", "connected", "starting", "reconnecting", "offline"].includes(s.status));
  const hasQr = waState.some((s) => s.qr && s.qr.length > 50);
  report("WhatsApp engine SSE boots + emits state", hasEngineState, waState[0] ? `status=${waState[waState.length - 1].status}` : "no state");
  report("WhatsApp live QR payload emitted", hasQr || waState.some((s) => s.status === "connected"));

  const waLogs = await readSSE("/api/whatsapp/qr", 3, (d) => d.type === "log");
  report("WhatsApp engine log stream replay", waLogs.length > 0, `${waLogs.length} log frames`);

  /* ------------------------- Telegram bridge ---------------------------- */
  const tg = await fetchJson("/api/telegram/status", undefined, 25_000);
  report(
    "Telegram bridge registers + long-polls",
    tg.status === 200 && tg.json?.enabled === true && tg.json?.running === true && !!tg.json?.username,
    tg.json?.username ? `@${tg.json.username}` : tg.json?.lastError ?? "",
  );

  /* --------------------- order flow via shared engine -------------------- */
  await simulate("bhaiya 2 wireless earbuds chahiye");
  const s2 = await simulate("Smoke Tester");
  report("engine collects customer name", (s2.json?.replies?.join(" ") ?? "").toLowerCase().includes("address"));
  const s3 = await simulate("99 Test Street, Pune 411001");
  report("engine recaps order for confirmation", (s3.json?.replies?.join(" ") ?? "").includes("Total"));
  const s4 = await simulate("haan ji pakka final");
  const replies4 = s4.json?.replies ?? [];
  const payMatch = replies4.join("\n").match(/\/pay\/(\d+)/);
  report("engine creates order + payment link", !!payMatch, payMatch ? `order #${payMatch[1]}` : replies4[0]?.slice(0, 60));
  if (!payMatch) throw new Error("cannot continue lifecycle without order id");
  const ORDER_ID = Number(payMatch[1]);

  const orders1 = await fetchJson("/api/orders");
  const created = orders1.json?.orders?.find((o) => o.id === ORDER_ID);
  report(
    "order persisted with catalog-derived totals",
    !!created && created.totalAmount === 2598 && created.status === "PENDING" && created.items?.[0]?.id === 1 && created.items?.[0]?.qty === 2,
    created ? `total=₹${created.totalAmount} status=${created.status}` : "not found",
  );

  /* ----------------------------- admin SSE ------------------------------ */
  const snapshot = await readSSE("/api/orders/stream", 6, (d) => d.type === "snapshot");
  report(
    "admin SSE snapshot contains new order",
    snapshot.some((d) => d.orders?.some((o) => o.id === ORDER_ID)),
  );

  /* ----------------------------- pay page -------------------------------- */
  const payPage = await fetch(BASE + `/pay/${ORDER_ID}`);
  const payHtml = await payPage.text();
  report("pay page renders order + total", payPage.status === 200 && payHtml.includes("TOTAL DUE"));

  /* ---------------------------- payment PATCH ----------------------------- */
  const paid = await fetchJson(`/api/orders/${ORDER_ID}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PAID_MOCK" }),
  });
  report(
    "mock payment flips PENDING → PAID_MOCK",
    paid.json?.ok === true && paid.json?.order?.status === "PAID_MOCK" && Array.isArray(paid.json?.notifiedChannels),
    `notifiedChannels=${JSON.stringify(paid.json?.notifiedChannels ?? null)}`,
  );

  const payPageDone = await fetch(BASE + `/pay/${ORDER_ID}`);
  report("pay page shows paid success state", (await payPageDone.text()).includes("Payment received!"));

  const dispatch = await fetchJson(`/api/orders/${ORDER_ID}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "DISPATCHED" }),
  });
  report("admin dispatch update works", dispatch.json?.order?.status === "DISPATCHED");

  const deliver = await fetchJson(`/api/orders/${ORDER_ID}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "DELIVERED" }),
  });
  report("admin delivery update works", deliver.json?.order?.status === "DELIVERED");

  /* ----------------------------- PDF label -------------------------------- */
  const label = await fetch(BASE + `/api/orders/${ORDER_ID}/label`, { redirect: "follow" });
  const buf = Buffer.from(await label.arrayBuffer());
  const magic = buf.subarray(0, 5).toString("latin1");
  report(
    "PDF shipping label streams correctly",
    label.status === 200 &&
      (label.headers.get("content-type") ?? "").includes("application/pdf") &&
      magic === "%PDF-",
    `${buf.length} bytes, magic=${magic}`,
  );

  /* ------------------------------- summary -------------------------------- */
  console.log(`\n──────────── SMOKE SUMMARY ────────────`);
  console.log(`passed: ${passed}   failed: ${failed}   total: ${passed + failed}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("smoke suite crashed:", err);
  process.exit(2);
});
