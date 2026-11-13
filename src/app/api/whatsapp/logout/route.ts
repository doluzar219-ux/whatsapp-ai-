import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { resetSession } from "@/lib/whatsappBot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    await resetSession(ctx.business.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "reset failed" },
      { status: 500 },
    );
  }
}
