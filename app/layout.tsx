import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'SalonPro - Salon & Spa Management',
  description:
    'World-class salon and spa management software. Appointments, staff, services, and analytics — all in one beautiful dashboard.',
  keywords: 'salon management, spa software, appointment booking, salon software',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased min-h-screen bg-background">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
