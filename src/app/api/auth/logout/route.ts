import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicOrigin(req: Request): string {
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    new URL(req.url).host;
  const proto =
    host.includes("localhost") || host.startsWith("127.") || host.startsWith("0.0.0.0")
      ? "http"
      : "https";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/", publicOrigin(req)), { status: 303 });
}
