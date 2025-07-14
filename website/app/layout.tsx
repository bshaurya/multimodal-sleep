import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sleep Stage Classification',
  description: 'Multimodal sleep stage classification using EEG, EOG, and EMG signals from EDF files',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}