import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { BusinessForm } from "./BusinessForm";

export const dynamic = "force-dynamic";

export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const { welcome } = await searchParams;
  return <BusinessForm business={ctx.business} welcome={welcome === "1"} />;
}
