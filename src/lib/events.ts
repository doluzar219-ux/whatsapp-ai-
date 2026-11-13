import { EventEmitter } from "node:events";

/**
 * In-process event bus shared by the WhatsApp bot, API routes and SSE
 * streams. Stored on globalThis so hot-reloads / multiple module instances
 * in dev don't create duplicate emitters.
 */

interface EventStore {
  wa: EventEmitter; // "state" -> BotState, "log" -> { t, msg }
  orders: EventEmitter; // "order" -> { type, order }
}

const g = globalThis as unknown as { __shopflowEvents?: EventStore };

if (!g.__shopflowEvents) {
  const wa = new EventEmitter();
  wa.setMaxListeners(100);
  const orders = new EventEmitter();
  orders.setMaxListeners(200);
  g.__shopflowEvents = { wa, orders };
}

export const waEvents = g.__shopflowEvents.wa;
export const orderEvents = g.__shopflowEvents.orders;
