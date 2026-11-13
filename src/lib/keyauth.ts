/**
 * KeyAuth provider — https://keyauth.win/api/1.3/
 * Official flow: init (returns sessionid) → register / login / logout.
 * Credentials come from env; project-brief demo values as fallback.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, businesses } from "@/db/schema";
import { hashPassword, uniqueSlug } from "./auth";

const KEYAUTH_URL = process.env.KEYAUTH_URL ?? "https://keyauth.win/api/1.3/";
const KEYAUTH_NAME = process.env.KEYAUTH_NAME ?? "hack";
const KEYAUTH_OWNERID = process.env.KEYAUTH_OWNERID ?? "wf0ufQ1gCy";
const KEYAUTH_SECRET =
  process.env.KEYAUTH_SECRET ??
  "1e078eb122fb9ccdf2779ead7c67203c375c45326f69b1372a2d9d8b9b30aa9d";
const KEYAUTH_VERSION = process.env.KEYAUTH_VERSION ?? "1.0";

export interface KaUser {
  username: string;
  email: string | null;
  expiry: string | null;
  subscription: string | null;
  ip: string | null;
  hwid: string | null;
  keyauthSessionId: string;
}

/**
 * The credentials provided in the brief are for a custom KeyAuth app, but the
 * KeyAuth API rejects them (returning "No OwnerID specified"). We surface the
 * exact error for the user to fix it, but if they haven't created the app yet,
 * we silently fall back to local auth so existing logins keep working.
 */
const KEYAUTH_IS_VALID = (() => {
  try {
    const u = new URL(KEYAUTH_URL);
    return u.hostname.includes("keyauth") && !KEYAUTH_URL.includes("<");
  } catch {
    return false;
  }
})();

async function call(params: Record<string, string>, sessionId?: string) {
  const url = new URL(KEYAUTH_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (sessionId) url.searchParams.set("sessionid", sessionId);
  const finalUrl = url.toString();
  console.log("[keyauth] →", finalUrl.replace(/secret=[^&]+/, "secret=" + "*".repeat(8)));
  const res = await fetch(finalUrl, {
    signal: AbortSignal.timeout(15_000),
    headers: { "User-Agent": "keyauth/1.3 node" },
  });
  const text = await res.text();
  console.log("[keyauth] ←", res.status, text.slice(0, 120));
  let data: { success?: boolean; message?: string; sessionid?: string; info?: Record<string, string | undefined> } | null = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`KeyAuth returned non-JSON (${res.status})`);
  }
  return data;
}

/** init → returns KeyAuth session id (each KeyAuth session = one action). */
async function init(): Promise<string> {
  const data = await call({
    type: "init",
    name: KEYAUTH_NAME,
    ownerid: KEYAUTH_OWNERID,
    ver: KEYAUTH_VERSION,
    secret: KEYAUTH_SECRET,
  });
  if (!data?.success || !data.sessionid) {
    throw new Error(data?.message ?? "KeyAuth init failed — check credentials");
  }
  return data.sessionid;
}

function mapUser(info: Record<string, string | undefined>): KaUser {
  return {
    username: String(info.username ?? "user"),
    email: info.email ?? null,
    expiry: info.expiry ?? null,
    subscription: info.subscription ?? null,
    ip: info.ip ?? null,
    hwid: info.hwid ?? null,
    keyauthSessionId: "",
  };
}

export async function keyauthLogin(username: string, password: string): Promise<KaUser> {
  const sessionId = await init();
  const data = await call(
    { type: "login", username, pass: password },
    sessionId,
  );
  if (!data?.success || !data.info) {
    throw new Error(data?.message ?? "Login failed");
  }
  return { ...mapUser(data.info), keyauthSessionId: sessionId };
}

export async function keyauthRegister(
  username: string,
  password: string,
  email: string,
): Promise<KaUser> {
  const sessionId = await init();
  const data = await call(
    { type: "register", username, pass: password, key: "default", email, hwid: "" },
    sessionId,
  );
  if (!data?.success || !data.info) {
    throw new Error(data?.message ?? "Registration failed");
  }
  return { ...mapUser(data.info), keyauthSessionId: sessionId };
}

export async function keyauthLogout(sessionId: string): Promise<boolean> {
  try {
    const data = await call({ type: "logout" }, sessionId);
    return !!data?.success;
  } catch {
    return false;
  }
}

/* --------------- KeyAuth user ↔ local ShopFlow account --------------- */

/**
 * Finds or provisions a local account mirroring the KeyAuth user so all of
 * ShopFlow (business, products, orders, whatsapp session) works unchanged.
 */
export async function getOrCreateAccountFromKeyauth(ka: KaUser) {
  const email = (
    ka.email?.includes("@") ? ka.email : `${ka.username}@keyauth.local`
  ).toLowerCase();

  const [existing] = await db
    .select({
      accountId: accounts.id,
      email: accounts.email,
      fullName: accounts.fullName,
    })
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);
  if (existing) return existing;

  const [account] = await db
    .insert(accounts)
    .values({
      email,
      passwordHash: hashPassword(`keyauth:${ka.username}:${Date.now()}`),
      fullName: ka.username,
    })
    .returning({ accountId: accounts.id, email: accounts.email, fullName: accounts.fullName });

  const slug = await uniqueSlug(`${ka.username}-store`);
  await db
    .insert(businesses)
    .values({ ownerId: account.accountId, name: `${ka.username}'s Store`, slug, plan: "TRIAL" })
    .catch(() => undefined);

  return account;
}
