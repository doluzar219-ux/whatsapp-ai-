import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, businesses, products } from "@/db/schema";
import {
  createSession,
  destroySession,
  getSessionContext,
  hashPassword,
  uniqueSlug,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  action?: "signup" | "login" | "logout";
  provider?: "local" | "keyauth";
  email?: string;
  password?: string;
  fullName?: string;
  businessName?: string;
  username?: string;
}

const STARTER_PRODUCTS = [
  { name: "Wireless Earbuds", price: 1299, stock: 25, description: "Bass heavy, 24h battery" },
  { name: "Smart Watch", price: 1999, stock: 18, description: "HD display, fitness tracking" },
  { name: "Mechanical Keyboard", price: 2499, stock: 12, description: "RGB, ultra-fast response" },
];

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ ok: true, authenticated: false });
  return NextResponse.json({
    ok: true,
    authenticated: true,
    user: ctx.user,
    business: ctx.business,
  });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  /* ----------------------------- KeyAuth provider ----------------------------- */
  if (body.provider === "keyauth" && (body.action === "login" || body.action === "signup")) {
    const username = String(body.username ?? body.email ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "KeyAuth username + password required" },
        { status: 400 },
      );
    }
    try {
      const ka =
        body.action === "signup"
          ? await (
              await import("@/lib/keyauth")
            ).keyauthRegister(username, password, String(body.email ?? ""))
          : await (await import("@/lib/keyauth")).keyauthLogin(username, password);
      const account = await (
        await import("@/lib/keyauth")
      ).getOrCreateAccountFromKeyauth(ka);
      await createSession(account.accountId);
      return NextResponse.json({
        ok: true,
        provider: "keyauth",
        username: ka.username,
        expiresAt: ka.expiry,
      });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "KeyAuth failed" },
        { status: 401 },
      );
    }
  }

  if (body.action === "logout") {
    await destroySession();
    return NextResponse.json({ ok: true });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 6 characters" },
      { status: 400 },
    );
  }

  if (body.action === "signup") {
    const [existing] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.email, email))
      .limit(1);
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "This email is already registered — please log in." },
        { status: 409 },
      );
    }

    const fullName = String(body.fullName ?? "").trim().slice(0, 80) || null;
    const businessName =
      String(body.businessName ?? "").trim().slice(0, 80) || `${fullName ?? "My"} Store`;

    const [account] = await db
      .insert(accounts)
      .values({ email, passwordHash: hashPassword(password), fullName })
      .returning();

    const slug = await uniqueSlug(businessName);
    const [business] = await db
      .insert(businesses)
      .values({
        ownerId: account.id,
        name: businessName,
        slug,
        plan: "TRIAL",
        trialMessageLimit: 10,
      })
      .returning();

    // Seed a starter catalog so the AI has something to sell immediately.
    await db
      .insert(products)
      .values(STARTER_PRODUCTS.map((p) => ({ ...p, businessId: business.id })))
      .catch(() => undefined);

    await createSession(account.id);
    return NextResponse.json({ ok: true, business });
  }

  // login
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);

  if (!account || !verifyPassword(password, account.passwordHash)) {
    return NextResponse.json({ ok: false, error: "Wrong email or password" }, { status: 401 });
  }

  await createSession(account.id);
  return NextResponse.json({ ok: true });
}
