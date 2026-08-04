import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { ToastProvider } from '@/components/ui/toast'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://kathmandumomo.com.np'),
  title: {
    default: 'Kathmandu Momo | Momo, Nepali Kitchen & Café | Birendranagar, Surkhet',
    template: '%s | Kathmandu Momo',
  },
  description:
    'Kathmandu Momo — momo steamed to order, Nepali thali, chatamari and café classics in Birendranagar, Surkhet. Reserve a table or order at the counter.',
  keywords: [
    'Kathmandu Momo',
    'momo Surkhet',
    'restaurant Birendranagar',
    'Nepali thali Surkhet',
    'chatamari',
    'thukpa',
  ],
  applicationName: 'Kathmandu Momo',
  openGraph: {
    type: 'website',
    siteName: 'Kathmandu Momo',
    locale: 'en_NP',
    title: 'Kathmandu Momo | Momo, Nepali Kitchen & Café | Surkhet',
    description:
      'सस्तो पनि, राम्रो पनि, छिटो पनि, मिठो पनि. Momo steamed to order in Birendranagar, Surkhet.',
    images: ['/images/kathmandu-momo/hero.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kathmandu Momo | Surkhet',
    description:
      'Momo steamed to order. Nepali thali, chatamari and café classics in Birendranagar, Surkhet.',
    images: ['/images/kathmandu-momo/hero.jpg'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-dark-32x32.png', sizes: '32x32', type: 'image/png', media: '(prefers-color-scheme: dark)' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const theme = localStorage.getItem('theme') || 'light';
              if (theme === 'dark') {
                document.documentElement.classList.add('dark');
              }
            })();
          `
        }} />
      </head>
      <body className={`font-sans antialiased`}>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
