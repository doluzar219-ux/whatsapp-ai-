import { waEvents } from "@/lib/events";
import { getSessionContext } from "@/lib/auth";
import type { BotState } from "@/lib/whatsappBot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SSE: live QR + connection state + engine logs for the logged-in business. */
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

      const onState = (s: BotState) => push({ type: "state", ...s });
      const onLog = (l: { t: number; msg: string }) => push({ type: "log", ...l });

      waEvents.on(`state:${businessId}`, onState);
      waEvents.on(`log:${businessId}`, onLog);

      try {
        const bot = await import("@/lib/whatsappBot");
        onState(bot.getBotState(businessId));
        for (const l of bot.getBotLogs(businessId).slice(-25)) onLog(l);
        void bot.ensureBot(businessId);
      } catch {
        push({ type: "log", t: Date.now(), msg: "failed to boot engine" });
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
        waEvents.off(`state:${businessId}`, onState);
        waEvents.off(`log:${businessId}`, onLog);
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
