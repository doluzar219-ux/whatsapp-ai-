import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { getSessionContext } from "@/lib/auth";
import { ProductsManager } from "./ProductsManager";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.businessId, ctx.business.id))
    .orderBy(products.id);

  return (
    <ProductsManager
      initial={rows.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        description: p.description,
        imageUrl: p.imageUrl,
        active: p.active,
      }))}
      currency={ctx.business.currency}
    />
  );
}
