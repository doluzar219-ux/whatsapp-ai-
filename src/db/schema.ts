import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ===================================================================== */
/* Multi-tenant SaaS schema                                              */
/* account → business (tenant) → products / customers / orders           */
/* ===================================================================== */

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  accountId: integer("account_id").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/** A tenant: one business = one WhatsApp bot + own catalog + own orders. */
export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  category: text("category"),
  tagline: text("tagline"),
  description: text("description"),
  city: text("city"),
  supportPhone: text("support_phone"),
  currency: text("currency").notNull().default("INR"),
  deliveryInfo: text("delivery_info"),
  paymentInfo: text("payment_info"),
  policies: text("policies"),
  botName: text("bot_name").notNull().default("ShopFlow Bhaiya"),
  botTone: text("bot_tone").notNull().default("hinglish"),
  greeting: text("greeting"),
  plan: text("plan").notNull().default("TRIAL"),
  trialMessagesUsed: integer("trial_messages_used").notNull().default(0),
  trialMessageLimit: integer("trial_message_limit").notNull().default(10),
  onboarded: boolean("onboarded").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  name: text("name").notNull(),
  price: doublePrecision("price").notNull(),
  stock: integer("stock").notNull().default(0),
  description: text("description"),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id").notNull(),
    phone: text("phone").notNull(),
    name: text("name"),
    address: text("address"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    bizPhone: uniqueIndex("customers_business_phone_idx").on(t.businessId, t.phone),
  }),
);

/**
 * items stores JSON: [{ "id":1, "name":"...", "qty":2, "price":1299 }]
 * status: PENDING → PAID_MOCK → DISPATCHED → DELIVERED (+ CANCELLED)
 */
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  userPhone: text("user_phone").notNull(),
  channel: text("channel").notNull().default("whatsapp"),
  items: text("items").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
