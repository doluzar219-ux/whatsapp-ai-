import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShopFlow.ai — Your shop, on autopilot",
  description:
    "Turn your WhatsApp number into a 24/7 AI salesman. Add your business & products, scan a QR, and let AI chat with customers, create orders, send payment links and delivery updates.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrains.variable} bg-bg text-ink antialiased`}
      >
        <div className="bg-scene" />
        <div className="bg-grid" />
        {children}
      </body>
    </html>
  );
}
