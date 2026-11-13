import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Boxes,
  Check,
  CreditCard,
  FileDown,
  LayoutDashboard,
  MessageSquareText,
  QrCode,
  Radio,
  Rocket,
  Shield,
  Sparkles,
  Store,
  Zap,
} from "lucide-react";
import { TiltCard } from "@/components/TiltCard";
import { TryDemo } from "@/components/TryDemo";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/* ------------------------------- nav ------------------------------- */

async function LandingNav() {
  const user = await getSessionUser();
  return (
    <header className="sticky top-0 z-50 border-b border-line/50 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-2 to-brand-deep shadow-[0_8px_24px_-8px_rgba(37,211,102,0.6)] transition-transform duration-300 group-hover:rotate-6">
            <Zap className="size-4.5 text-[#03130a]" strokeWidth={2.5} />
          </span>
          <span className="display text-[15px] font-bold tracking-tight">
            ShopFlow<span className="text-brand-2">.ai</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <a href="#demo" className="hidden rounded-full px-3.5 py-2 text-[13px] text-muted transition-colors hover:bg-white/5 hover:text-ink sm:block">
            Live Demo
          </a>
          <a href="#how" className="hidden rounded-full px-3.5 py-2 text-[13px] text-muted transition-colors hover:bg-white/5 hover:text-ink sm:block">
            How it works
          </a>
          <a href="#pricing" className="hidden rounded-full px-3.5 py-2 text-[13px] text-muted transition-colors hover:bg-white/5 hover:text-ink sm:block">
            Pricing
          </a>
          {user ? (
            <Link href="/app" className="btn btn-primary !px-4 !py-2 !text-[13px]">
              <LayoutDashboard className="size-3.5" /> Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-white/5">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-primary !px-4 !py-2 !text-[13px]">
                Start free <ArrowRight className="size-3.5" />
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

/* --------------------------- 3D hero visual --------------------------- */

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[430px]">
      <div className="aurora" />
      <TiltCard max={9}>
        <div className="relative" style={{ transformStyle: "preserve-3d" }}>
          {/* floating stat card — back layer */}
          <div
            className="glass absolute -left-10 top-10 hidden w-[170px] rounded-2xl p-3.5 sm:block"
            style={{ transform: "translateZ(70px)", animation: "float-card 6s ease-in-out infinite" }}
          >
            <p className="font-mono text-[9px] tracking-widest text-faint">TODAY</p>
            <p className="display mt-1 text-2xl font-bold text-brand-2">₹48,320</p>
            <p className="mt-0.5 text-[10px] text-muted">22 orders · all via chat</p>
            <div className="mt-2.5 flex h-8 items-end gap-1">
              {[40, 65, 45, 80, 55, 95, 70].map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-sm bg-gradient-to-t from-brand-deep to-brand-2"
                  style={{ height: `${h}%`, opacity: 0.55 + i * 0.06 }}
                />
              ))}
            </div>
          </div>

          {/* floating order card — front layer */}
          <div
            className="glass absolute -right-8 bottom-16 hidden w-[180px] rounded-2xl p-3.5 sm:block"
            style={{ transform: "translateZ(110px)", animation: "float-card 7s ease-in-out 1.2s infinite" }}
          >
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] tracking-widest text-faint">ORDER #1042</p>
              <span className="status-pill status-PAID_MOCK !px-1.5 !py-0.5 !text-[8px]">PAID</span>
            </div>
            <p className="mt-2 text-[11px] text-ink">2 × Wireless Earbuds</p>
            <p className="display mt-1 text-lg font-bold">₹2,598</p>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-brand-2">
              <BadgeCheck className="size-3" /> Auto-confirmed by AI
            </div>
          </div>

          {/* phone — main layer */}
          <div
            className="relative mx-auto w-[280px] overflow-hidden rounded-[2.2rem] border border-line bg-[#0b141a] shadow-[0_60px_140px_-40px_rgba(0,0,0,0.95)]"
            style={{ transform: "translateZ(40px)" }}
          >
            <div className="flex items-center gap-2.5 bg-[#1f2c34] px-4 py-3">
              <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-brand-2 to-brand-deep text-xs font-bold text-[#03130a]">
                S
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-[#e9edef]">Your Shop</p>
                <p className="text-[10px] text-brand-2">AI assistant · online</p>
              </div>
              <Radio className="size-3.5 text-[#8696a0]" />
            </div>
            <div
              className="flex h-[330px] flex-col gap-2 px-3 py-4"
              style={{
                backgroundImage: "radial-gradient(rgba(134,150,160,0.12) 1px, transparent 1px)",
                backgroundSize: "18px 18px",
              }}
            >
              {[
                { out: false, t: "bhaiya earbuds hain?", d: 0.4 },
                { out: true, t: "Namaste ji! 🙏 Haan — *Wireless Earbuds* ₹1,299. Bass heavy, 24h battery!", d: 1.3 },
                { out: false, t: "2 chahiye. Ravi Kumar, 12 MG Road Pune", d: 2.4 },
                { out: true, t: "Order *#1042* confirm! Total *₹2,598* 🎉\nPay: shopflow.ai/pay/1042", d: 3.5 },
                { out: true, t: "🚚 Dispatch ho gaya! Tracking: SF00104269IN", d: 5.0 },
              ].map((m, i) => (
                <div
                  key={i}
                  className={`wa-bubble animate-pop-in !text-[11px] ${m.out ? "wa-out" : "wa-in"}`}
                  style={{ animationDelay: `${m.d}s` }}
                >
                  {m.t.split("\n").map((l, j) => (
                    <p key={j}>
                      {l.split(/(\*[^*]+\*)/g).map((p, k) =>
                        p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
                          <strong key={k}>{p.slice(1, -1)}</strong>
                        ) : (
                          <span key={k}>{p}</span>
                        ),
                      )}
                    </p>
                  ))}
                </div>
              ))}
              <div className="wa-bubble wa-in animate-pop-in" style={{ animationDelay: "6s" }}>
                <span className="typing-dots text-[#e9edf0]">
                  <span /> <span /> <span />
                </span>
              </div>
            </div>
          </div>
        </div>
      </TiltCard>
    </div>
  );
}

/* ------------------------------ sections ------------------------------ */

const STEPS = [
  { icon: Store, t: "Tell us about your business", d: "Naam, category, delivery & payment info — AI poora context seekh leta hai." },
  { icon: Boxes, t: "Add your products", d: "Price, stock, photo, description. Catalog hi AI ki single source of truth hai." },
  { icon: QrCode, t: "Scan WhatsApp QR", d: "Ek scan — aapka number 24/7 AI salesman ban jaata hai." },
  { icon: Rocket, t: "Orders aane do", d: "AI baat karta hai, order banata hai, payment link bhejta hai. Aap bas dispatch karo." },
];

const FEATURES = [
  { icon: Bot, t: "AI jo aapki dukaan jaanta hai", d: "Har business ka apna prompt — aapke products, prices, policies aur tone par trained." },
  { icon: MessageSquareText, t: "Hinglish / English / Hindi", d: "Customer jis zubaan mein likhe, bot usi mein jawab deta hai — bilkul local dukandar jaisa." },
  { icon: CreditCard, t: "Payment link in chat", d: "Order banते hi chat mein link — ek click, status PAID, customer ko confirmation." },
  { icon: Radio, t: "Realtime dashboard", d: "SSE live orders, revenue metrics, status flips — refresh karne ki zaroorat nahi." },
  { icon: FileDown, t: "PDF shipping labels", d: "1-click thermal-style label with barcode tracking ID — courier ready." },
  { icon: Shield, t: "Aapka data, aapka tenant", d: "Har business ka data alag — products, orders, customers, WhatsApp session." },
];

export default async function LandingPage() {
  const user = await getSessionUser();

  return (
    <div className="relative overflow-x-hidden">
      <div className="noise" />
      <LandingNav />

      {/* ------------------------------ hero ------------------------------ */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 pb-24 pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:pt-24">
        <div>
          <div className="chip mb-6 animate-fade-up !border-brand-2/30">
            <span className="size-1.5 animate-blink rounded-full bg-brand-2" />
            AI sales agent for WhatsApp
          </div>
          <h1
            className="display animate-fade-up text-balance text-[3.1rem] font-bold leading-[0.98] tracking-tight sm:text-6xl lg:text-[4.6rem]"
            style={{ animationDelay: "0.06s" }}
          >
            Your shop.
            <br />
            <span className="shine-text">On autopilot.</span>
          </h1>
          <p
            className="mt-6 max-w-lg animate-fade-up text-pretty text-[15px] leading-relaxed text-muted sm:text-[16.5px]"
            style={{ animationDelay: "0.14s" }}
          >
            ShopFlow turns your WhatsApp number into a 24/7 AI salesman. Apna business
            bataiye, products add kijiye, QR scan kijiye — bas. AI customers se baat karega,
            orders banayega, payment link bhejega aur delivery updates dega.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3 animate-fade-up" style={{ animationDelay: "0.22s" }}>
            <Link href={user ? "/app" : "/signup"} className="btn btn-primary !px-6 !py-3.5 !text-[15px]">
              <Rocket className="size-4" strokeWidth={2.4} />
              {user ? "Go to dashboard" : "Start free — 10 messages"}
            </Link>
            <a href="#demo" className="btn btn-ghost !px-5 !py-3.5">
              <Sparkles className="size-4" /> Try the AI live
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-faint animate-fade-up" style={{ animationDelay: "0.3s" }}>
            {["No credit card", "Setup in 5 minutes", "Apna WhatsApp, apna data"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="size-3.5 text-brand-2" /> {t}
              </span>
            ))}
          </div>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "0.18s" }}>
          <HeroVisual />
        </div>
      </section>

      {/* ------------------------------ ticker ------------------------------ */}
      <div className="overflow-hidden border-y border-line/50 py-3">
        <div className="flex w-max animate-marquee gap-8 font-mono text-[11px] tracking-[0.3em] text-faint">
          {Array.from({ length: 2 }).map((_, d) => (
            <span key={d} className="flex gap-8">
              {["KIRANA", "ELECTRONICS", "FASHION", "BAKERY", "PHARMACY", "GIFTS", "MOBILE SHOP", "BOUTIQUE"].map((w) => (
                <span key={w} className="flex items-center gap-8">
                  {w} <span className="text-brand-deep">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ------------------------------ demo ------------------------------ */}
      <section id="demo" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="chip mb-5">
              <Sparkles className="size-3.5 text-brand-2" /> Free live demo
            </div>
            <h2 className="display text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              Baat karke <span className="shine-text">khud dekh lijiye</span>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              Ye real AI hai — scripted demo nahi. Isse product poocho, order karo, payment
              link tak jao. <span className="text-ink">5 messages bilkul free</span>, bina
              signup ke.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                "Real LLM replies — har message par ⚡ REAL AI badge",
                "Actual order database mein banta hai",
                "Payment link kaam karta hai — kholke dekh lo",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[13.5px] text-muted">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-2" />
                  {t}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="btn btn-primary mt-8">
              Apni dukaan banaiye <ArrowRight className="size-4" />
            </Link>
          </div>
          <TryDemo />
        </div>
      </section>

      {/* ------------------------------ how ------------------------------ */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <div className="mb-12 text-center">
          <div className="chip mx-auto mb-5">4 steps · 5 minutes</div>
          <h2 className="display text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Setup itna aasaan hai
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <TiltCard key={s.t} max={7}>
              <div
                className="glass h-full rounded-2xl p-6 animate-fade-up"
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-2/10 text-brand-2">
                    <s.icon className="size-5" strokeWidth={1.9} />
                  </span>
                  <span className="display text-3xl font-bold text-white/5">0{i + 1}</span>
                </div>
                <h3 className="display mt-5 text-[15px] font-bold">{s.t}</h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{s.d}</p>
              </div>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ------------------------------ features ------------------------------ */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mb-12">
          <div className="chip mb-5">Built for Indian businesses</div>
          <h2 className="display max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Sab kuch ready — aapko sirf bechna hai
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.t}
              className="glass card-hover rounded-2xl p-6 animate-fade-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <span className="mb-5 grid size-11 place-items-center rounded-xl bg-brand-2/10 text-brand-2">
                <f.icon className="size-5" strokeWidth={1.9} />
              </span>
              <h3 className="display text-[15px] font-bold">{f.t}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------ pricing ------------------------------ */}
      <section id="pricing" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-20">
        <div className="mb-12 text-center">
          <div className="chip mx-auto mb-5">Pricing</div>
          <h2 className="display text-4xl font-bold tracking-tight sm:text-5xl">
            Pehle try kijiye, phir pay
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <TiltCard max={6}>
            <div className="glass h-full rounded-3xl p-8">
              <p className="font-mono text-[11px] tracking-[0.2em] text-faint">FREE TRIAL</p>
              <p className="display mt-3 text-4xl font-bold">₹0</p>
              <p className="mt-1.5 text-[13px] text-muted">Apna setup test karne ke liye</p>
              <ul className="mt-6 space-y-2.5">
                {["10 AI messages", "Apna WhatsApp connect", "Unlimited products", "Realtime dashboard", "PDF labels"].map((t) => (
                  <li key={t} className="flex items-center gap-2 text-[13px] text-muted">
                    <Check className="size-4 text-brand-2" /> {t}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="btn btn-ghost mt-7 w-full justify-center">
                Start free
              </Link>
            </div>
          </TiltCard>

          <TiltCard max={6}>
            <div className="glass glow-ring relative h-full overflow-hidden rounded-3xl p-8">
              <div className="absolute -right-10 -top-10 size-40 rounded-full bg-brand-2/15 blur-3xl" />
              <div className="relative flex items-center justify-between">
                <p className="font-mono text-[11px] tracking-[0.2em] text-brand-2">PRO</p>
                <span className="chip !border-brand-2/40 !text-[10px] !text-brand-2">POPULAR</span>
              </div>
              <p className="display mt-3 text-4xl font-bold">
                ₹999<span className="text-base font-medium text-muted">/month</span>
              </p>
              <p className="mt-1.5 text-[13px] text-muted">Chalti hui dukaan ke liye</p>
              <ul className="mt-6 space-y-2.5">
                {[
                  "Unlimited AI messages",
                  "Priority AI models",
                  "Telegram + WhatsApp",
                  "Customer database",
                  "Priority support",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2 text-[13px] text-muted">
                    <Check className="size-4 text-brand-2" /> {t}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="btn btn-primary mt-7 w-full justify-center">
                Get started <ArrowRight className="size-4" />
              </Link>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* ------------------------------ CTA ------------------------------ */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="glass relative overflow-hidden rounded-[2rem] p-10 text-center sm:p-16">
          <div className="aurora" />
          <h2 className="display relative mx-auto max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Aaj hi apni dukaan ko <span className="shine-text">AI-powered</span> banaiye
          </h2>
          <p className="relative mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-muted">
            Koi credit card nahi, koi setup fee nahi. 5 minute mein aapka AI salesman live.
          </p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <Link href={user ? "/app" : "/signup"} className="btn btn-primary !px-7 !py-3.5 !text-[15px]">
              <Rocket className="size-4" strokeWidth={2.4} />
              {user ? "Open dashboard" : "Start free now"}
            </Link>
            <a href="#demo" className="btn btn-ghost !px-6 !py-3.5">
              Try demo first
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-line/50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand-2 to-brand-deep">
              <Zap className="size-4 text-[#03130a]" strokeWidth={2.5} />
            </span>
            <span className="display text-sm font-bold">ShopFlow<span className="text-brand-2">.ai</span></span>
          </div>
          <p className="font-mono text-[10px] tracking-widest text-faint">
            WHATSAPP · TELEGRAM · AI COMMERCE OS
          </p>
        </div>
      </footer>
    </div>
  );
}
