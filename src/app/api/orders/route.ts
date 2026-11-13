import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { listOrdersForBusiness } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const orders = await listOrdersForBusiness(ctx.business.id);
    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
