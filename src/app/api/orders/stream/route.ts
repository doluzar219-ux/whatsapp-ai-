import { orderEvents } from "@/lib/events";
import { getSessionContext } from "@/lib/auth";
import { listOrdersForBusiness, type SerializedOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Realtime order feed scoped to the logged-in business. */
export async function GET(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return new Response("unauthorized", { status: 401 });
  const businessId = ctx.business.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const push = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const onOrder = (payload: { type: string; kind?: string; order: SerializedOrder }) =>
        push(payload);

      orderEvents.on(`order:${businessId}`, onOrder);

      try {
        push({ type: "snapshot", orders: await listOrdersForBusiness(businessId) });
      } catch {
        push({ type: "snapshot", orders: [] });
      }

      const hb = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`:hb\n\n`));
        } catch {
          /* closed */
        }
      }, 20_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(hb);
        orderEvents.off(`order:${businessId}`, onOrder);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
