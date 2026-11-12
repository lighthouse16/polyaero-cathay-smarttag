import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-cathay',
});

export const metadata: Metadata = {
  title: 'Cathay Pacific | Ground Operations & Baggage Recovery Copilot',
  description: 'Cathay Pacific Ground Operations & SmartTag Baggage Recovery Copilot Portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className={jakarta.className}>{children}</body>
    </html>
  );
}
