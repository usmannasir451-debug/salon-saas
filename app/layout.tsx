import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://snip-force.com'),
  title: {
    default: 'Snipforce - Salon & Spa Management Software',
    template: '%s | Snipforce',
  },
  description:
    'All-in-one salon management platform. Manage appointments, walk-ins, staff, inventory, payroll and finances in one place. White-label solution for modern salons.',
  keywords: [
    'salon management software',
    'spa management system',
    'appointment booking software',
    'salon POS',
    'staff management salon',
    'salon inventory management',
    'salon software Pakistan',
    'spa software',
    'hair salon management',
    'beauty salon software',
    'white-label salon software',
    'multi-branch salon management',
  ],
  authors: [{ name: 'Snipforce' }],
  creator: 'Snipforce',
  publisher: 'Snipforce',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://snip-force.com',
    languages: {
      en: 'https://snip-force.com',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://snip-force.com',
    siteName: 'Snipforce',
    title: 'Snipforce - Salon & Spa Management Software',
    description:
      'All-in-one salon management platform. Manage appointments, walk-ins, staff, inventory, payroll and finances in one place.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Snipforce - Salon & Spa Management Software Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Snipforce - Salon & Spa Management Software',
    description:
      'All-in-one salon management platform. Manage appointments, walk-ins, staff, inventory, payroll and finances in one place.',
    images: ['/og-image.png'],
    creator: '@snipforce',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  other: {
    'geo.region': 'PK',
    'geo.placename': 'Pakistan',
    'geo.position': '30.3753;69.3451',
    ICBM: '30.3753, 69.3451',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="canonical" href="https://snip-force.com" />
        <meta httpEquiv="content-language" content="en" />
        <link rel="alternate" hrefLang="en" href="https://snip-force.com" />
      </head>
      <body className="font-sans antialiased min-h-screen bg-background">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
