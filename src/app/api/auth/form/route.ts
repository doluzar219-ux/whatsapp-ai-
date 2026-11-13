import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, businesses, products } from "@/db/schema";
import {
  createSession,
  hashPassword,
  uniqueSlug,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STARTER_PRODUCTS = [
  { name: "Wireless Earbuds", price: 1299, stock: 25, description: "Bass heavy, 24h battery" },
  { name: "Smart Watch", price: 1999, stock: 18, description: "HD display, fitness tracking" },
  { name: "Mechanical Keyboard", price: 2499, stock: 12, description: "RGB, ultra-fast response" },
];

function publicOrigin(req: Request): string {
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    new URL(req.url).host;
  const proto =
    host.includes("localhost") || host.startsWith("127.") || host.startsWith("0.0.0.0")
      ? "http"
      : "https";
  return `${proto}://${host}`;
}

function bounce(req: Request, path: "/login" | "/signup", error?: string, provider?: string) {
  const url = new URL(path, publicOrigin(req));
  if (error) url.searchParams.set("error", error);
  if (provider) url.searchParams.set("provider", provider);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const action = String(form.get("action") ?? "login") as "login" | "signup";
  const provider = String(form.get("provider") ?? "local") as "local" | "keyauth";

  /* ----------------------------- KeyAuth provider ----------------------------- */
  if (provider === "keyauth") {
    const username = String(form.get("email") ?? form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!username || !password) {
      return bounce(req, action === "signup" ? "/signup" : "/login", "KeyAuth username + password required", provider);
    }
    try {
      const keyauth = await import("@/lib/keyauth");
      const ka =
        action === "signup"
          ? await keyauth.keyauthRegister(
              username.includes("@") ? username.split("@")[0] : username,
              password,
              username.includes("@") ? username : `${username}@keyauth.local`,
            )
          : await keyauth.keyauthLogin(
              username.includes("@") ? username.split("@")[0] : username,
              password,
            );
      const account = await keyauth.getOrCreateAccountFromKeyauth(ka);
      await createSession(account.accountId);
      return NextResponse.redirect(new URL(action === "signup" ? "/app/business?welcome=1" : "/app", req.url), { status: 303 });
    } catch (err) {
      return bounce(
        req,
        action === "signup" ? "/signup" : "/login",
        err instanceof Error ? err.message : "KeyAuth failed",
        provider,
      );
    }
  }

  /* ----------------------------- Local provider ----------------------------- */
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bounce(req, action === "signup" ? "/signup" : "/login", "Enter a valid email", provider);
  }
  if (password.length < 6) {
    return bounce(req, action === "signup" ? "/signup" : "/login", "Password must be at least 6 characters", provider);
  }

  if (action === "signup") {
    const [existing] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, email)).limit(1);
    if (existing) {
      return bounce(req, "/signup", "This email is already registered — please log in.", provider);
    }

    const fullName = String(form.get("fullName") ?? "").trim().slice(0, 80) || null;
    const businessName = String(form.get("businessName") ?? "").trim().slice(0, 80) || `${fullName ?? "My"} Store`;

    const [account] = await db
      .insert(accounts)
      .values({ email, passwordHash: hashPassword(password), fullName })
      .returning();

    const slug = await uniqueSlug(businessName);
    const [business] = await db
      .insert(businesses)
      .values({ ownerId: account.id, name: businessName, slug, plan: "TRIAL", trialMessageLimit: 10 })
      .returning();

    await db.insert(products).values(STARTER_PRODUCTS.map((p) => ({ ...p, businessId: business.id }))).catch(() => undefined);
    await createSession(account.id);
    return NextResponse.redirect(new URL("/app/business?welcome=1", publicOrigin(req)), {
      status: 303,
    });
  }

  const [account] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return bounce(req, "/login", "Wrong email or password", provider);
  }

  await createSession(account.id);
  return NextResponse.redirect(new URL("/app", publicOrigin(req)), { status: 303 });
}
