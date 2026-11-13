import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { orderEvents } from "@/lib/events";
import { getSessionContext } from "@/lib/auth";
import { ORDER_STATUSES, serializeOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH order status.
 * - Owners (session) may set any status for their own orders.
 * - Public (no session) may ONLY move their own order PENDING → PAID_MOCK
 *   (used by the customer-facing mock checkout page).
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ ok: false, error: "invalid order id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const status = String(body.status ?? "").toUpperCase();
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { ok: false, error: `status must be one of ${ORDER_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const [existing] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "order not found" }, { status: 404 });
  }

  const session = await getSessionContext();
  const isOwner = session?.business.id === existing.businessId;
  const isPublicPayment = status === "PAID_MOCK" && existing.status === "PENDING";

  if (!isOwner && !isPublicPayment) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (existing.status === status) {
    return NextResponse.json({ ok: true, order: serializeOrder(existing), unchanged: true });
  }

  const [updated] = await db
    .update(orders)
    .set({ status })
    .where(eq(orders.id, orderId))
    .returning();

  const [cust] = await db
    .select({ name: customers.name, address: customers.address })
    .from(customers)
    .where(
      and(eq(customers.businessId, updated.businessId), eq(customers.phone, updated.userPhone)),
    )
    .limit(1);

  const serialized = serializeOrder(updated, cust ?? null);

  orderEvents.emit(`order:${updated.businessId}`, {
    type: "upsert",
    kind: "status",
    order: serialized,
  });

  const notifiers = await import("@/lib/notifiers");
  const task =
    status === "PAID_MOCK"
      ? notifiers.notifyPaymentReceived(orderId)
      : status === "DISPATCHED"
        ? notifiers.notifyDispatched(orderId)
        : status === "DELIVERED"
          ? notifiers.notifyDelivered(orderId)
          : Promise.resolve([]);

  const notifiedChannels = await task.catch(() => [] as string[]);

  return NextResponse.json({ ok: true, order: serialized, notifiedChannels });
}
