import { Playfair_Display, Cormorant_Garamond, Josefin_Sans } from 'next/font/google'
import MenuBook from '@/components/menu-book/menu-book'
import { getPublicMenuCategories } from '@/lib/public-menu'

const display = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-menu-display',
  display: 'swap',
})

const body = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-menu-body',
  display: 'swap',
})

const sans = Josefin_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-menu-sans',
  display: 'swap',
})

export const metadata = {
  title: 'Our Menu',
  description:
    'Explore the full menu at Kathmandu Momo, Birendranagar, Surkhet — live from our kitchen.',
}

/** Always read latest admin menu (no stale static data) */
export const dynamic = 'force-dynamic'

export default async function MenuPage() {
  const categories = await getPublicMenuCategories()

  return (
    <div
      className={`${display.variable} ${body.variable} ${sans.variable} font-[family-name:var(--font-menu-sans)]`}
    >
      <MenuBook categories={categories} />
    </div>
  )
}
