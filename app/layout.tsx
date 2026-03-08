import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title:       'Fin Ad Generator',
  description: 'Generate on-brand performance marketing ads for Fin',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
