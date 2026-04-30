import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Toaster } from '@/components/ui/Toaster'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'FarmDirect — Fresh from Bhopal Farms',
    template: '%s | FarmDirect',
  },
  description:
    'Buy fresh vegetables, fruits, grains and more directly from local farmers in Bhopal. No middlemen. Honest prices.',
  keywords: ['farm fresh', 'Bhopal', 'organic', 'vegetables', 'direct farmer'],
  openGraph: {
    title: 'FarmDirect — Fresh from Bhopal Farms',
    description: 'Buy directly from local Bhopal farmers. No middlemen.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <body className="font-sans bg-cream text-soil antialiased min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <Toaster />
      </body>
    </html>
  )
}
