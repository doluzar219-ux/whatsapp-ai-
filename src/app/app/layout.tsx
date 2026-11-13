import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Boxes, LayoutDashboard, LogOut, QrCode, Store, Zap } from "lucide-react";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/app", label: "Orders", icon: LayoutDashboard },
  { href: "/app/business", label: "Business", icon: Store },
  { href: "/app/products", label: "Products", icon: Boxes },
  { href: "/app/connect", label: "Connect", icon: QrCode },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const { business } = ctx;
  const trialLeft = Math.max(0, business.trialMessageLimit - business.trialMessagesUsed);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-line/50 bg-bg/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <Link href="/app" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-2 to-brand-deep">
              <Zap className="size-4.5 text-[#03130a]" strokeWidth={2.5} />
            </span>
            <span className="hidden sm:block">
              <span className="display block text-[13px] font-bold leading-tight">
                {business.name}
              </span>
              <span className="font-mono text-[9px] tracking-widest text-faint">
                {business.plan === "TRIAL" ? `TRIAL · ${trialLeft} MSG LEFT` : "PRO PLAN"}
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-white/5 hover:text-ink"
              >
                <n.icon className="size-3.5" />
                <span className="hidden sm:inline">{n.label}</span>
              </Link>
            ))}
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-white/5 hover:text-red"
                title="Log out"
              >
                <LogOut className="size-3.5" />
              </button>
            </form>
          </nav>
        </div>
      </header>

      {business.plan === "TRIAL" && trialLeft <= 3 && (
        <div className="border-b border-amber/20 bg-amber/[0.07] px-5 py-2.5 text-center text-[12.5px] text-amber">
          {trialLeft === 0
            ? "⚠️ Free trial khatam — AI ne replies rok diye hain. Upgrade karke unlimited chat chaalu kijiye."
            : `⚠️ Sirf ${trialLeft} free AI message bache hain.`}
        </div>
      )}

      <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
    </div>
  );
}
