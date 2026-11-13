import { notFound } from "next/navigation";
import { getBusinessById, getOrderWithUser } from "@/lib/orders";
import { PayCheckout } from "./PayCheckout";

export const dynamic = "force-dynamic";

export default async function PayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const order = await getOrderWithUser(id);
  if (!order) notFound();

  const business = await getBusinessById(order.businessId);

  return (
    <PayCheckout
      order={order}
      businessName={business?.name ?? "ShopFlow"}
      currency={business?.currency ?? "INR"}
    />
  );
}
