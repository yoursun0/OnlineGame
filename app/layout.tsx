import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from './language';

const appUrl = process.env.NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  title: 'PLAYROOM 玩房 — quick games, no accounts',
  description: 'A bilingual, frictionless lobby for short multiplayer games.',
  ...(appUrl ? { metadataBase: new URL(appUrl) } : {}),
  applicationName: 'PLAYROOM',
  openGraph: {
    type: 'website',
    siteName: 'PLAYROOM',
    title: 'PLAYROOM 玩房 — quick games, no accounts',
    description: 'A bilingual, frictionless lobby for short multiplayer games.',
  },
  twitter: {
    card: 'summary',
    title: 'PLAYROOM 玩房 — quick games, no accounts',
    description: 'A bilingual, frictionless lobby for short multiplayer games.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
