import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { getSessionContext } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = [
  "name",
  "category",
  "tagline",
  "description",
  "city",
  "supportPhone",
  "currency",
  "deliveryInfo",
  "paymentInfo",
  "policies",
  "botName",
  "botTone",
  "greeting",
] as const;

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, business: ctx.business });
}

export async function PATCH(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const patch: Record<string, string | boolean> = {};
  for (const f of FIELDS) {
    if (body[f] !== undefined && body[f] !== null) {
      patch[f] = String(body[f]).slice(0, 1200);
    }
  }
  if (typeof patch.name === "string" && !patch.name.trim()) delete patch.name;
  if (body.onboarded !== undefined) patch.onboarded = Boolean(body.onboarded);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, business: ctx.business });
  }

  const [updated] = await db
    .update(businesses)
    .set(patch)
    .where(eq(businesses.id, ctx.business.id))
    .returning();

  return NextResponse.json({ ok: true, business: updated });
}
