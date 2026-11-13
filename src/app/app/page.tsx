import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { listOrdersForBusiness } from "@/lib/orders";
import { OrdersBoard } from "./OrdersBoard";

export const dynamic = "force-dynamic";

export default async function AppHome() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const orders = await listOrdersForBusiness(ctx.business.id);
  return (
    <OrdersBoard
      initial={orders}
      currency={ctx.business.currency}
      businessName={ctx.business.name}
      onboarded={ctx.business.onboarded}
    />
  );
}
