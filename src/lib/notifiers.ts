/**
 * Import point that guarantees channel senders are registered before
 * lifecycle notifications fan out.
 */
import "@/lib/whatsappBot";
import "@/lib/telegramBot";

export {
  notifyPaymentReceived,
  notifyDispatched,
  notifyDelivered,
} from "@/lib/aiEngine";
