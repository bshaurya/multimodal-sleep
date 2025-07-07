import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sleep Disorder Prediction',
  description: 'Multimodal sleep stage classification using EEG, EOG, and EMG signals',
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