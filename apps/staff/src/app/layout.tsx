import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PolyAero Cathay SmartTag | Ground Staff Portal',
  description: 'Baggage verification and recovery portal for ground staff operations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
