import './globals.css';

import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';

import { AuthProvider } from '@/components/auth/AuthProvider';
import { siteConfig } from '@/lib/seo/site';

const displayFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800']
});

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700']
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: 'Spokio | Complete IELTS SaaS',
    template: '%s | Spokio'
  },
  description:
    'Speaking-safe IELTS SaaS platform with writing, reading, listening, full tests, and role-based admin operations.',
  applicationName: 'Spokio',
  keywords: [
    'IELTS',
    'IELTS speaking practice',
    'IELTS writing',
    'IELTS reading',
    'IELTS listening',
    'IELTS mock test',
    'IELTS preparation'
  ],
  alternates: {
    canonical: '/'
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: siteConfig.name,
    title: 'Spokio | Complete IELTS SaaS',
    description:
      'Speaking-safe IELTS SaaS platform with writing, reading, listening, full tests, and role-based admin operations.',
    url: '/'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Spokio | Complete IELTS SaaS',
    description:
      'Speaking-safe IELTS SaaS platform with writing, reading, listening, full tests, and role-based admin operations.'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1
    }
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL,GRAD,opsz@400,0,0,24"
          rel="stylesheet"
        />
      </head>
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
