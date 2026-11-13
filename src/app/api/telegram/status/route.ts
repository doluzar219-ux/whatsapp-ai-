import { NextResponse } from "next/server";
import { ensureTelegramBot, getTelegramState } from "@/lib/telegramBot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    void ensureTelegramBot();
    return NextResponse.json({ ok: true, ...getTelegramState() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
