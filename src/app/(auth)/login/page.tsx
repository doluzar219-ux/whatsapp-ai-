import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthForm } from "../AuthForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; provider?: string }>; 
}) {
  if (await getSessionUser()) redirect("/app");
  const sp = await searchParams;
  return (
    <AuthForm
      mode="login"
      initialError={sp.error ? decodeURIComponent(sp.error) : null}
      initialProvider={sp.provider === "keyauth" ? "keyauth" : "local"}
    />
  );
}
