import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { ToastProvider } from '@/components/ui/toast'
import { ConfirmProvider } from '@/components/ui/confirm'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

const SITE_DESCRIPTION =
  'Kathmandu Momo — momo steamed to order, Nepali thali, chatamari and café classics in Birendranagar, Surkhet. Call +977 984-9216081.'

// Bump `v` whenever the favicon assets change to bust browser/CDN caches.
const ICON_VERSION = '2083b'

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://kathmandumomo.com.np'),
  title: {
    default: 'Kathmandu Momo | Momo, Nepali Kitchen & Café',
    template: '%s | Kathmandu Momo',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'Kathmandu Momo',
  manifest: `/site.webmanifest?v=${ICON_VERSION}`,
  icons: {
    icon: [
      { url: `/favicon.ico?v=${ICON_VERSION}`, sizes: 'any' },
      { url: `/icon-light-32x32.png?v=${ICON_VERSION}`, type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: `/apple-icon.png?v=${ICON_VERSION}`, sizes: '180x180' }],
    shortcut: [{ url: `/favicon.ico?v=${ICON_VERSION}` }],
  },
  openGraph: {
    type: 'website',
    siteName: 'Kathmandu Momo',
    title: 'Kathmandu Momo | Momo, Nepali Kitchen & Café | Surkhet',
    description: SITE_DESCRIPTION,
    images: [{ url: '/icon-512.png', alt: 'Kathmandu Momo' }],
  },
  twitter: {
    card: 'summary',
    title: 'Kathmandu Momo | Surkhet',
    description: SITE_DESCRIPTION,
    images: ['/icon-512.png'],
  },
}

export const viewport = {
  themeColor: '#e30613',
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
            <ConfirmProvider>
              {children}
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
