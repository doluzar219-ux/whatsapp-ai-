/** Client-safe shared types — no server imports allowed in this file. */

export interface OrderItem {
  id?: number;
  name: string;
  qty: number;
  price: number;
}

export interface SerializedOrder {
  id: number;
  businessId: number;
  businessName?: string | null;
  userPhone: string;
  userName: string | null;
  userAddress: string | null;
  channel: string;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  createdAt: string;
}

export interface BusinessProfile {
  id: number;
  name: string;
  slug: string;
  category: string | null;
  tagline: string | null;
  description: string | null;
  city: string | null;
  supportPhone: string | null;
  currency: string;
  deliveryInfo: string | null;
  paymentInfo: string | null;
  policies: string | null;
  botName: string;
  botTone: string;
  greeting: string | null;
  plan: string;
  trialMessagesUsed: number;
  trialMessageLimit: number;
  onboarded: boolean;
}

export interface ProductDTO {
  id: number;
  name: string;
  price: number;
  stock: number;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
}
