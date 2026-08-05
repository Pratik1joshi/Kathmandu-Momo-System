import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { ToastProvider } from '@/components/ui/toast'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://kathmandumomo.com.np'),
  title: {
    default: 'Kathmandu Momo | Restaurant POS & Online Ordering',
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
    title: 'Kathmandu Momo | Restaurant POS & Online Ordering',
    description:
      'सस्तो पनि, राम्रो पनि, छिटो पनि, मिठो पनि. Momo steamed to order in Birendranagar, Surkhet.',
    images: ['/images/kathmandu-momo/logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kathmandu Momo | Restaurant POS & Online Ordering',
    description:
      'Momo steamed to order. Nepali thali, chatamari and café classics in Birendranagar, Surkhet.',
    images: ['/images/kathmandu-momo/logo.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico?v=2083', sizes: 'any' },
      { url: '/icon-light-32x32.png?v=2083', sizes: '32x32', type: 'image/png' },
      { url: '/icon-dark-32x32.png?v=2083', sizes: '32x32', type: 'image/png', media: '(prefers-color-scheme: dark)' },
    ],
    apple: [{ url: '/apple-icon.png?v=2083', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico?v=2083',
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
