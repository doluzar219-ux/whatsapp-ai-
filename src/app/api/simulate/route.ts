import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, products } from "@/db/schema";
import { getSessionContext } from "@/lib/auth";
import { processIncomingText } from "@/lib/aiEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_SLUG = process.env.DEMO_BUSINESS_SLUG ?? "demo-store";
const PUBLIC_TRIAL_LIMIT = 5;
const TRIAL_COOKIE = "shopflow_try";

const DEMO_PRODUCTS = [
  { name: "Wireless Earbuds", price: 1299, stock: 25, description: "Bass heavy, 24h battery" },
  { name: "Smart Watch", price: 1999, stock: 18, description: "HD display, fitness tracking" },
  { name: "Mechanical Keyboard", price: 2499, stock: 12, description: "RGB, ultra-fast response" },
];

/** Public playground business — created on first use. */
async function getDemoBusiness() {
  const [existing] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.slug, DEMO_SLUG))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(businesses)
    .values({
      ownerId: 0,
      name: "ShopFlow Demo Store",
      slug: DEMO_SLUG,
      category: "Electronics",
      tagline: "Gadgets that just work",
      description: "A demo electronics store used for the public ShopFlow AI playground.",
      city: "Mumbai",
      currency: "INR",
      deliveryInfo: "Free delivery in 2–3 days",
      plan: "PRO",
      onboarded: true,
    })
    .returning();

  await db
    .insert(products)
    .values(DEMO_PRODUCTS.map((p) => ({ ...p, businessId: created.id })))
    .catch(() => undefined);

  return created;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    phone?: string;
    name?: string;
  };
  const text = String(body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "text is required" }, { status: 400 });
  }

  const session = await getSessionContext();
  const jar = await cookies();

  // Logged-in owners test their OWN store with their own trial quota.
  // Anonymous visitors get the shared demo store with a 5-message taster.
  let business;
  let publicTrial: { used: number; limit: number } | undefined;

  if (session) {
    business = session.business;
  } else {
    business = await getDemoBusiness();
    const used = Number(jar.get(TRIAL_COOKIE)?.value ?? "0") || 0;
    if (used >= PUBLIC_TRIAL_LIMIT) {
      return NextResponse.json({
        ok: true,
        locked: true,
        trial: { used, limit: PUBLIC_TRIAL_LIMIT },
        replies: [
          `🔒 *Free demo limit reached* (${PUBLIC_TRIAL_LIMIT} messages).\n\nSign up free to get your own AI shop assistant — apna business, apne products, apna WhatsApp. 🚀`,
        ],
      });
    }
    jar.set(TRIAL_COOKIE, String(used + 1), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });
    publicTrial = { used: used + 1, limit: PUBLIC_TRIAL_LIMIT };
  }

  const phone =
    (body.phone ?? "").replace(/\D/g, "").slice(0, 15) ||
    `9100000${String(business.id).padStart(4, "0")}`;

  const replies: string[] = [];
  try {
    const result = await processIncomingText(
      business.id,
      "web",
      phone,
      body.name?.trim() || undefined,
      text,
      (t) => {
        replies.push(String(t));
      },
    );
    return NextResponse.json({
      ok: true,
      phone,
      replies,
      engine: result.mode,
      quota: result.quota,
      trial: publicTrial,
      businessName: business.name,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "engine failed", replies },
      { status: 500 },
    );
  }
}
