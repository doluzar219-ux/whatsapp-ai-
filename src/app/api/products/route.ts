import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { getSessionContext } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.businessId, ctx.business.id))
    .orderBy(products.id);
  return NextResponse.json({ ok: true, products: rows });
}

export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim().slice(0, 100);
  const price = Number(body.price);
  if (!name) return NextResponse.json({ ok: false, error: "Product name required" }, { status: 400 });
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ ok: false, error: "Valid price required" }, { status: 400 });
  }

  const [created] = await db
    .insert(products)
    .values({
      businessId: ctx.business.id,
      name,
      price,
      stock: Math.max(0, Math.round(Number(body.stock) || 0)),
      description: String(body.description ?? "").trim().slice(0, 300) || null,
      imageUrl: String(body.imageUrl ?? "").trim().slice(0, 500) || null,
      active: body.active === undefined ? true : Boolean(body.active),
    })
    .returning();

  return NextResponse.json({ ok: true, product: created });
}

export async function PATCH(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ ok: false, error: "invalid id" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim().slice(0, 100);
  if (body.price !== undefined && Number.isFinite(Number(body.price)))
    patch.price = Number(body.price);
  if (body.stock !== undefined) patch.stock = Math.max(0, Math.round(Number(body.stock) || 0));
  if (body.description !== undefined)
    patch.description = String(body.description).trim().slice(0, 300) || null;
  if (body.imageUrl !== undefined)
    patch.imageUrl = String(body.imageUrl).trim().slice(0, 500) || null;
  if (body.active !== undefined) patch.active = Boolean(body.active);

  const [updated] = await db
    .update(products)
    .set(patch)
    .where(and(eq(products.id, id), eq(products.businessId, ctx.business.id)))
    .returning();

  if (!updated) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, product: updated });
}

export async function DELETE(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ ok: false, error: "invalid id" }, { status: 400 });
  }
  await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.businessId, ctx.business.id)));
  return NextResponse.json({ ok: true });
}
