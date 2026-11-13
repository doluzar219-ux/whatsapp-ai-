import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  businesses,
  customers,
  orders,
  products,
  type Business,
  type Order,
  type Product,
} from "@/db/schema";

export const ORDER_STATUSES = [
  "PENDING",
  "PAID_MOCK",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type { OrderItem, SerializedOrder } from "./types";
import type { OrderItem, SerializedOrder } from "./types";

export { formatINR } from "./money";
import { formatMoney } from "./money";

export function parseItems(raw: string): OrderItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((it) => ({
        id: typeof it?.id === "number" ? it.id : undefined,
        name: String(it?.name ?? "Item"),
        qty: Math.max(1, Math.round(Number(it?.qty)) || 1),
        price: Number(it?.price) || 0,
      }))
      .filter((it) => it.name);
  } catch {
    return [];
  }
}

export function serializeOrder(
  o: Order,
  user?: { name: string | null; address: string | null } | null,
  businessName?: string | null,
): SerializedOrder {
  return {
    id: o.id,
    businessId: o.businessId,
    businessName: businessName ?? null,
    userPhone: o.userPhone,
    userName: user?.name ?? null,
    userAddress: user?.address ?? null,
    channel: o.channel,
    items: parseItems(o.items),
    totalAmount: o.totalAmount,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
  };
}

/* ------------------------------ queries ------------------------------ */

export async function listOrdersForBusiness(
  businessId: number,
): Promise<SerializedOrder[]> {
  const rows = await db
    .select({
      order: orders,
      name: customers.name,
      address: customers.address,
    })
    .from(orders)
    .leftJoin(
      customers,
      and(eq(customers.businessId, orders.businessId), eq(customers.phone, orders.userPhone)),
    )
    .where(eq(orders.businessId, businessId))
    .orderBy(desc(orders.createdAt));

  return rows.map((r) => serializeOrder(r.order, { name: r.name, address: r.address }));
}

export async function getOrderWithUser(id: number): Promise<SerializedOrder | null> {
  const [row] = await db
    .select({
      order: orders,
      name: customers.name,
      address: customers.address,
      businessName: businesses.name,
    })
    .from(orders)
    .leftJoin(
      customers,
      and(eq(customers.businessId, orders.businessId), eq(customers.phone, orders.userPhone)),
    )
    .leftJoin(businesses, eq(businesses.id, orders.businessId))
    .where(eq(orders.id, id))
    .limit(1);

  if (!row) return null;
  return serializeOrder(
    row.order,
    { name: row.name, address: row.address },
    row.businessName,
  );
}

export async function getBusinessById(id: number): Promise<Business | null> {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
  return b ?? null;
}

export async function getCatalog(businessId: number): Promise<Product[]> {
  try {
    return await db
      .select()
      .from(products)
      .where(and(eq(products.businessId, businessId), eq(products.active, true)))
      .orderBy(products.id);
  } catch {
    return [];
  }
}

export async function upsertCustomer(
  businessId: number,
  phone: string,
  name?: string | null,
  address?: string | null,
) {
  const clean = phone.replace(/\D/g, "");
  if (!clean) return;
  try {
    await db
      .insert(customers)
      .values({
        businessId,
        phone: clean,
        name: name?.trim() || null,
        address: address?.trim() || null,
      })
      .onConflictDoUpdate({
        target: [customers.businessId, customers.phone],
        set: {
          ...(name?.trim() ? { name: name.trim() } : {}),
          ...(address?.trim() ? { address: address.trim() } : {}),
        },
      });
  } catch {
    /* non-fatal */
  }
}

export function trackingIdFor(orderId: number): string {
  const checksum = (orderId * 7919) % 97;
  return `SF${String(orderId).padStart(6, "0")}${String(checksum).padStart(2, "0")}IN`;
}

export { formatMoney };
