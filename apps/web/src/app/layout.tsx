import type { Metadata } from 'next';
import { Inter, Cinzel, Playfair_Display, Bodoni_Moda, Montserrat } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { brandConfig } from '@tofa/core';

const inter = Inter({ subsets: ['latin'] });
const cinzel = Cinzel({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
});
const playfairDisplay = Playfair_Display({
  weight: ['600', '700'],
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});
const bodoniModa = Bodoni_Moda({
  weight: ['600', '700'],
  subsets: ['latin'],
  variable: '--font-bodoni',
  display: 'swap',
  adjustFontFallback: false,
});
const montserrat = Montserrat({
  weight: ['500', '700'],
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${brandConfig.name} CRM`,
  description: `CRM system for ${brandConfig.name}`,
  robots: 'noindex, nofollow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${cinzel.variable} ${playfairDisplay.variable} ${bodoniModa.variable} ${montserrat.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}


