import fs from "node:fs/promises";
import path from "node:path";
import pino from "pino";
import { waEvents } from "./events";
import {
  getLogs,
  logActivity,
  processIncomingText,
  registerChannelSender,
  unregisterChannelSender,
} from "./aiEngine";

type WaModule = typeof import("@whiskeysockets/baileys");
type WASocket = import("@whiskeysockets/baileys").WASocket;
type WAMessage = import("@whiskeysockets/baileys").proto.IWebMessageInfo;
type WAIMessage = import("@whiskeysockets/baileys").proto.IMessage | null | undefined;

export type BotStatus =
  | "idle"
  | "starting"
  | "qr"
  | "connected"
  | "reconnecting"
  | "offline";

export interface BotState {
  businessId: number;
  status: BotStatus;
  qr: string | null;
  me: string | null;
  updatedAt: number;
}

interface Conn {
  sock: WASocket | null;
  starting: Promise<void> | null;
  reconnectTimer: NodeJS.Timeout | null;
  state: BotState;
}

interface WaGlobal {
  mod: WaModule | null;
  conns: Map<number, Conn>;
}

const AUTH_ROOT = path.join(process.cwd(), "auth_sessions");

const g = globalThis as unknown as { __shopflowWa?: WaGlobal };
const W: WaGlobal = g.__shopflowWa ?? (g.__shopflowWa = { mod: null, conns: new Map() });

function authDir(businessId: number) {
  return path.join(AUTH_ROOT, `biz_${businessId}`);
}

function conn(businessId: number): Conn {
  let c = W.conns.get(businessId);
  if (!c) {
    c = {
      sock: null,
      starting: null,
      reconnectTimer: null,
      state: {
        businessId,
        status: "idle",
        qr: null,
        me: null,
        updatedAt: Date.now(),
      },
    };
    W.conns.set(businessId, c);
  }
  return c;
}

function setState(businessId: number, partial: Partial<Omit<BotState, "businessId" | "updatedAt">>) {
  const c = conn(businessId);
  c.state = { ...c.state, ...partial, businessId, updatedAt: Date.now() };
  waEvents.emit(`state:${businessId}`, c.state);
}

export function getBotState(businessId: number): BotState {
  return conn(businessId).state;
}

export function getBotLogs(businessId: number) {
  return getLogs(businessId);
}

/* --------------------------- lifecycle --------------------------- */

export function ensureBot(businessId: number): Promise<void> {
  const c = conn(businessId);
  if (c.state.status === "connected") return Promise.resolve();
  if (c.starting) return c.starting;
  c.starting = connect(businessId)
    .catch((err) => {
      logActivity(
        businessId,
        `engine error: ${(err instanceof Error ? err.message : String(err)).slice(0, 110)}`,
      );
      setState(businessId, { status: "reconnecting" });
      scheduleReconnect(businessId, 8000);
    })
    .finally(() => {
      c.starting = null;
    });
  return c.starting;
}

async function loadMod(): Promise<WaModule> {
  if (!W.mod) W.mod = await import("@whiskeysockets/baileys");
  return W.mod;
}

async function connect(businessId: number): Promise<void> {
  const mod = await loadMod();
  const logger = pino({ level: "error" });
  const c = conn(businessId);

  setState(businessId, { status: "starting", qr: null });
  logActivity(businessId, "booting WhatsApp engine…");

  await fs.mkdir(AUTH_ROOT, { recursive: true }).catch(() => undefined);
  const { state, saveCreds } = await mod.useMultiFileAuthState(authDir(businessId));

  let version: [number, number, number] | undefined;
  try {
    version = (await mod.fetchLatestBaileysVersion()).version;
  } catch {
    version = undefined;
  }

  const sock = mod.default({
    ...(version ? { version } : {}),
    auth: {
      creds: state.creds,
      keys: mod.makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: false,
    browser: ["ShopFlow AI", "Chrome", "1.0.0"],
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  c.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      setState(businessId, { status: "qr", qr });
      logActivity(businessId, "QR ready — scan from WhatsApp › Linked devices");
    }
    if (connection === "open") {
      const me = sock.user?.name ?? sock.user?.id?.split(":")[0] ?? null;
      setState(businessId, { status: "connected", qr: null, me });
      registerChannelSender("whatsapp", businessId, (phone, text) =>
        sendWhatsAppText(businessId, phone, text),
      );
      logActivity(businessId, `connected${me ? ` as ${me}` : ""} — AI assistant live`);
    }
    if (connection === "close") {
      const code = (
        lastDisconnect?.error as { output?: { statusCode?: number } } | undefined
      )?.output?.statusCode;
      unregisterChannelSender("whatsapp", businessId);
      logActivity(businessId, `connection closed (code ${code ?? "unknown"})`);
      if (code === mod.DisconnectReason.loggedOut) {
        setState(businessId, { status: "offline", qr: null, me: null });
        void hardReset(businessId, true);
      } else {
        setState(businessId, { status: "reconnecting", qr: null });
        scheduleReconnect(businessId, 4000);
      }
    }
  });

  sock.ev.on("messages.upsert", (evt) => {
    if (evt.type !== "notify") return;
    for (const msg of evt.messages) void handleIncoming(businessId, sock, msg);
  });
}

function scheduleReconnect(businessId: number, delayMs: number) {
  const c = conn(businessId);
  if (c.reconnectTimer) return;
  c.reconnectTimer = setTimeout(() => {
    c.reconnectTimer = null;
    void ensureBot(businessId);
  }, delayMs);
}

async function hardReset(businessId: number, auto = false) {
  const c = conn(businessId);
  if (c.reconnectTimer) {
    clearTimeout(c.reconnectTimer);
    c.reconnectTimer = null;
  }
  try {
    await c.sock?.logout();
  } catch {
    /* ignore */
  }
  try {
    c.sock?.end(undefined);
  } catch {
    /* ignore */
  }
  c.sock = null;
  unregisterChannelSender("whatsapp", businessId);
  try {
    await fs.rm(authDir(businessId), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  logActivity(businessId, auto ? "session rotated — new QR incoming" : "session reset — new QR incoming");
  setState(businessId, { status: "starting", qr: null, me: null });
  scheduleReconnect(businessId, 1200);
}

export async function resetSession(businessId: number): Promise<void> {
  await hardReset(businessId, false);
}

/* --------------------------- inbound --------------------------- */

function extractText(message: WAIMessage): string {
  if (!message) return "";
  return String(
    message.conversation ??
      message.extendedTextMessage?.text ??
      message.imageMessage?.caption ??
      message.videoMessage?.caption ??
      message.buttonsResponseMessage?.selectedDisplayText ??
      message.listResponseMessage?.title ??
      "",
  ).trim();
}

async function handleIncoming(businessId: number, sock: WASocket, msg: WAMessage) {
  const key = msg.key;
  if (!key || key.fromMe) return;
  const jid = key.remoteJid ?? "";
  if (!jid || jid === "status@broadcast" || jid.endsWith("@g.us")) return;

  const text = extractText(msg.message);
  if (!text) return;
  const phone = jid.split("@")[0].replace(/\D/g, "");
  if (!phone) return;

  logActivity(businessId, `message from +${phone} — routing to AI`);
  try {
    await sock.readMessages([key]);
    await sock.sendPresenceUpdate("composing", jid);
  } catch {
    /* ignore */
  }

  await processIncomingText(
    businessId,
    "whatsapp",
    phone,
    msg.pushName ?? undefined,
    text,
    async (t: string) => {
      await sock.sendMessage(jid, { text: t });
    },
  );

  try {
    await sock.sendPresenceUpdate("paused", jid);
  } catch {
    /* ignore */
  }
}

/* --------------------------- outbound --------------------------- */

export async function sendWhatsAppText(
  businessId: number,
  phone: string,
  text: string,
): Promise<boolean> {
  const c = conn(businessId);
  if (!c.sock || c.state.status !== "connected") return false;
  try {
    await c.sock.sendMessage(`${phone.replace(/\D/g, "")}@s.whatsapp.net`, { text });
    logActivity(businessId, `→ +${phone}: ${text.split("\n")[0].slice(0, 60)}`);
    return true;
  } catch (err) {
    logActivity(
      businessId,
      `send failed: ${(err instanceof Error ? err.message : String(err)).slice(0, 80)}`,
    );
    return false;
  }
}

/** Boot every business that already has a saved session (server restart). */
export async function restoreAllSessions(): Promise<void> {
  try {
    const dirs = await fs.readdir(AUTH_ROOT).catch(() => [] as string[]);
    for (const d of dirs) {
      const m = d.match(/^biz_(\d+)$/);
      if (!m) continue;
      const files = await fs
        .readdir(path.join(AUTH_ROOT, d))
        .catch(() => [] as string[]);
      if (files.includes("creds.json")) void ensureBot(Number(m[1]));
    }
  } catch {
    /* ignore */
  }
}
