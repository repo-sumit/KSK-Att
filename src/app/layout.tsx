import type { Metadata, Viewport } from 'next';
import { Montserrat, Mukta } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppProviders } from '@/app-shell/AppProviders';
import '@/styles/tokens.css';
import '@/styles/typography.css';
import '@/styles/globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});

const mukta = Mukta({
  subsets: ['devanagari', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-mukta',
  // Fetched only when Devanagari renders (unicode-range), so English users never download it.
  preload: false,
  fallback: ['system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: { default: 'KSK Attendance', template: '%s · KSK Attendance' },
  description: 'Attendance for ITI instructors and principals in Maharashtra — a SwiftChat MiniApp.',
  applicationName: 'KSK Attendance',
  robots: { index: false, follow: false },
  formatDetection: { telephone: false, address: false, email: false },
  appleWebApp: { capable: true, title: 'KSK Attendance', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
  colorScheme: 'light',
  interactiveWidget: 'resizes-content',
};

/** Applies the saved language before first paint, so Marathi never flashes in English metrics. */
const LANGUAGE_BOOT = `try{var l=JSON.parse(localStorage.getItem('ksk-prefs:language'));if(l==='mr')document.documentElement.lang='mr'}catch(e){}`;

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${mukta.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANGUAGE_BOOT }} />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
