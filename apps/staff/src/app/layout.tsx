import type { Metadata, Viewport } from "next";
import { DM_Sans, Lora } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-editorial",
});

export const metadata: Metadata = {
  title: "Cathay Pacific | Ground Operations — Baggage Transfer & Recovery",
  description:
    "Cathay Pacific Ground Operations Baggage Transfer Control & SmartTag Recovery Copilot",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${lora.variable}`}>
      <body className={dmSans.className}>{children}</body>
    </html>
  );
}
