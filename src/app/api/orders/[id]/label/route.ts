import { generateShippingLabel } from "@/lib/labelGen";
import { getSessionContext } from "@/lib/auth";
import { getOrderWithUser } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streams the A6 PDF shipping label (owner only). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return Response.json({ ok: false, error: "invalid order id" }, { status: 400 });
  }

  const order = await getOrderWithUser(orderId);
  if (!order) return Response.json({ ok: false, error: "order not found" }, { status: 404 });

  const session = await getSessionContext();
  if (session?.business.id !== order.businessId) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const pdf = await generateShippingLabel(order, session.business.name, session.business.currency);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="label-${orderId}.pdf"`,
      "Content-Length": String(pdf.length),
    },
  });
}
