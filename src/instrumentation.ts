/**
 * Boots messaging engines when the server starts:
 *  - restores every business's saved WhatsApp session
 *  - starts the Telegram demo bridge
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { restoreAllSessions } = await import("@/lib/whatsappBot");
    void restoreAllSessions();
  } catch {
    /* sessions restore on demand */
  }
  try {
    const { ensureTelegramBot } = await import("@/lib/telegramBot");
    void ensureTelegramBot();
  } catch {
    /* telegram optional */
  }
}
