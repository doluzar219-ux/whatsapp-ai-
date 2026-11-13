import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import {
  clearConversation,
  logActivity,
  processIncomingText,
  registerChannelSender,
} from "./aiEngine";

/**
 * Telegram testing bridge — pure fetch long polling.
 * Bound to the public demo/playground business (slug `demo-store`) so anyone
 * can try the AI assistant from Telegram without pairing WhatsApp.
 */

interface TgMessage {
  message_id: number;
  from?: { id: number; first_name?: string; username?: string };
  chat: { id: number; type: string };
  text?: string;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

export interface TelegramState {
  enabled: boolean;
  running: boolean;
  username: string | null;
  businessId: number | null;
  lastError: string | null;
  updatedAt: number;
}

interface TgGlobal {
  started: Promise<void> | null;
  stopRequested: boolean;
  offset: number;
  businessId: number | null;
  state: TelegramState;
}

const DEFAULT_TELEGRAM_BOT_TOKEN = "8921668191:AAHur22BDS6BQ0C5XR8Fik80D9wpD9zTiIU";
const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? DEFAULT_TELEGRAM_BOT_TOKEN;
const ENABLED =
  (process.env.USE_TELEGRAM_TESTING ?? "true") === "true" && TOKEN.length > 8;

const DEMO_SLUG = process.env.DEMO_BUSINESS_SLUG ?? "demo-store";

function apiUrl(method: string) {
  return `https://api.telegram.org/bot${TOKEN}/${method}`;
}

const g = globalThis as unknown as { __shopflowTg?: TgGlobal };
const T: TgGlobal =
  g.__shopflowTg ??
  (g.__shopflowTg = {
    started: null,
    stopRequested: false,
    offset: 0,
    businessId: null,
    state: {
      enabled: ENABLED,
      running: false,
      username: null,
      businessId: null,
      lastError: null,
      updatedAt: Date.now(),
    },
  });

function setState(p: Partial<Omit<TelegramState, "updatedAt" | "enabled">>) {
  T.state = { ...T.state, ...p, updatedAt: Date.now() };
}

export function getTelegramState(): TelegramState {
  return { ...T.state, enabled: ENABLED };
}

export function ensureTelegramBot(): Promise<void> {
  if (!ENABLED) {
    setState({ running: false, lastError: "Telegram disabled" });
    return Promise.resolve();
  }
  if (T.state.running) return Promise.resolve();
  if (T.started) return T.started;
  T.stopRequested = false;
  T.started = boot()
    .catch((err) => {
      setState({
        running: false,
        lastError: (err instanceof Error ? err.message : String(err)).slice(0, 150),
      });
    })
    .finally(() => {
      T.started = null;
    });
  return T.started;
}

async function resolveDemoBusiness(): Promise<number | null> {
  try {
    const [b] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.slug, DEMO_SLUG))
      .limit(1);
    return b?.id ?? null;
  } catch {
    return null;
  }
}

async function boot(): Promise<void> {
  setState({ running: false, lastError: null });
  const me = await apiCall<{ username?: string }>("getMe");
  T.businessId = await resolveDemoBusiness();
  setState({ username: me.username ?? null, businessId: T.businessId });

  await apiCall("deleteWebhook", { drop_pending_updates: false }).catch(() => undefined);
  setState({ running: true });
  if (T.businessId) {
    registerChannelSender("telegram", T.businessId, sendTelegramText);
    logActivity(T.businessId, `Telegram live as @${T.state.username ?? "bot"}`);
  }
  void pollLoop();
}

async function pollLoop(): Promise<void> {
  let backoff = 0;
  while (!T.stopRequested) {
    try {
      const updates = await apiCall<TgUpdate[]>(
        "getUpdates",
        { timeout: 30, offset: T.offset, allowed_updates: ["message"] },
        40_000,
      );
      backoff = 0;
      for (const u of updates ?? []) {
        T.offset = u.update_id + 1;
        void handleMessage(u.message).catch(() => undefined);
      }
    } catch (err) {
      setState({ lastError: (err instanceof Error ? err.message : String(err)).slice(0, 150) });
      backoff = Math.min(backoff ? backoff * 2 : 4000, 30_000);
      await sleep(backoff);
    }
  }
  setState({ running: false });
}

async function handleMessage(msg: TgMessage | undefined): Promise<void> {
  if (!msg || msg.chat.type !== "private") return;
  const text = String(msg.text ?? "").trim();
  if (!text) return;

  if (!T.businessId) {
    T.businessId = await resolveDemoBusiness();
    if (T.businessId) {
      registerChannelSender("telegram", T.businessId, sendTelegramText);
      setState({ businessId: T.businessId });
    }
  }
  const businessId = T.businessId;
  if (!businessId) return;

  const chatId = String(msg.chat.id);
  const pushName = msg.from?.first_name ?? msg.from?.username ?? undefined;
  const send = async (t: string) => {
    await sendTelegramText(chatId, t);
  };

  if (/^\/(start|reset)\b/i.test(text)) {
    clearConversation(businessId, "telegram", chatId);
    await send(
      /^\/reset\b/i.test(text)
        ? "Thik hai ji, naye sire se shuru karte hain 🔄"
        : "Namaste ji! 🙏 Main ShopFlow AI demo assistant hoon.\nPoochiye — *kya bechte ho?* — aur poora order yahin bana lijiye!",
    );
    return;
  }

  void sendTyping(chatId);
  await processIncomingText(businessId, "telegram", chatId, pushName, text, send);
}

export async function sendTelegramText(identifier: string, text: string): Promise<boolean> {
  if (!ENABLED) return false;
  const chatId = Number(identifier.replace(/\D/g, ""));
  if (!chatId) return false;
  try {
    await apiCall("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
    return true;
  } catch {
    try {
      await apiCall("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
      return true;
    } catch {
      return false;
    }
  }
}

async function sendTyping(chatIdRaw: string): Promise<void> {
  const chatId = Number(chatIdRaw.replace(/\D/g, ""));
  if (!chatId) return;
  try {
    await apiCall("sendChatAction", { chat_id: chatId, action: "typing" });
  } catch {
    /* ignore */
  }
}

async function apiCall<R = unknown>(
  method: string,
  payload?: Record<string, unknown>,
  timeoutMs = 20_000,
): Promise<R> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: R;
      description?: string;
    };
    if (!res.ok || !data.ok) throw new Error(data.description ?? `Telegram ${res.status}`);
    return data.result as R;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
