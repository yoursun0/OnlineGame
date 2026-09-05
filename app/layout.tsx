import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PLAYROOM — quick games, no accounts',
  description: 'A frictionless lobby for short multiplayer games.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
