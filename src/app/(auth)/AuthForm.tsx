"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Lock,
  Mail,
  Store,
  User,
  Zap,
} from "lucide-react";

export function AuthForm({
  mode,
  initialError = null,
  initialProvider = "local",
}: {
  mode: "login" | "signup";
  initialError?: string | null;
  initialProvider?: "local" | "keyauth";
}) {
  const [provider, setProvider] = useState<"local" | "keyauth">(initialProvider);
  const [busy, setBusy] = useState(false);

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <div className="aurora" />

      <Link href="/" className="relative mb-8 flex items-center gap-2.5 self-center">
        <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-brand-2 to-brand-deep shadow-[0_8px_24px_-8px_rgba(37,211,102,0.6)]">
          <Zap className="size-5 text-[#03130a]" strokeWidth={2.5} />
        </span>
        <span className="display text-lg font-bold">
          ShopFlow<span className="text-brand-2">.ai</span>
        </span>
      </Link>

      <div className="glass glow-ring relative rounded-3xl p-8">
        <h1 className="display text-2xl font-bold">
          {mode === "signup" ? "Apni dukaan shuru kijiye" : "Welcome back, ji"}
        </h1>
        <p className="mt-2 text-[13px] text-muted">
          {mode === "signup"
            ? "Free account — 10 AI messages, koi card nahi chahiye."
            : "Login karke apne orders aur AI assistant tak pahuchiye."}
        </p>

        {/* ⚠️ DIRECT BYPASS BUTTON */}
        <Link 
          href="/app" 
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-2 py-4 text-[15px] font-bold text-[#03130a] shadow-[0_10px_30px_-10px_rgba(37,211,102,0.6)] transition-transform hover:scale-[1.02]"
        >
          <Zap className="size-5" />
          DIRECT DASHBOARD ACCESS
        </Link>
        
        <div className="mt-6 flex items-center gap-2">
          <div className="h-px flex-1 bg-line" />
          <span className="text-[11px] font-bold text-faint">OR MANUAL LOGIN</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-xl border border-line bg-black/20 p-1">
          {(
            [
              { v: "local", l: "Email / Password" },
              { v: "keyauth", l: "KeyAuth" },
            ] as const
          ).map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => { setProvider(t.v); }}
              className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition-all ${
                provider === t.v
                  ? "bg-brand-2 text-[#03130a]"
                  : "text-muted hover:text-ink"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>

        <form
          action="/api/auth/form"
          method="post"
          onSubmit={() => setBusy(true)}
          className="mt-5 space-y-3"
          noValidate
        >
          <input type="hidden" name="action" value={mode} />
          <input type="hidden" name="provider" value={provider} />

          {provider === "local" && mode === "signup" && (
            <>
              <Field
                name="fullName"
                icon={User}
                placeholder="Aapka poora naam"
              />
              <Field
                name="businessName"
                icon={Store}
                placeholder="Business ka naam (e.g. Sharma Electronics)"
              />
            </>
          )}

          <Field
            name="email"
            icon={Mail}
            placeholder={
              provider === "keyauth"
                ? "KeyAuth username ya email"
                : "Email address"
            }
            type={provider === "keyauth" ? "text" : "email"}
            required
            autoComplete={provider === "keyauth" ? "username" : "email"}
          />

          <Field
            name="password"
            icon={Lock}
            placeholder="Password"
            type="password"
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {initialError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red/30 bg-red/[0.08] px-4 py-3">
              <span className="mt-0.5 text-red text-[18px] leading-none">⚠</span>
              <p className="text-[12.5px] leading-relaxed text-red">{initialError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary w-full justify-center !py-3.5 !text-[15px] transition-all"
          >
            {busy ? (
              <>
                <Loader2 className="size-4.5 animate-spin" />
                {mode === "login" ? "Logging in…" : "Working…"}
              </>
            ) : (
              <>
                {mode === "login" ? "Log in" : "Create free account"}
                <ArrowRight className="size-4.5" strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-2">
          <div className="h-px flex-1 bg-line" />
          <span className="text-[11px] text-faint">
            {mode === "login" ? "Naya hai?" : "Account pehle se hai?"}
          </span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <Link
          href={mode === "login" ? "/signup" : "/login"}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-[13px] font-medium text-muted transition-all hover:border-brand-2/40 hover:text-ink"
        >
          {mode === "login" ? "Create free account →" : "Log in instead →"}
        </Link>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  placeholder,
  type = "text",
  required,
  autoComplete,
  name,
}: {
  icon: typeof Mail;
  placeholder: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  name: string;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="field w-full !py-3.5 !pl-10 !text-[14px]"
      />
    </div>
  );
}
