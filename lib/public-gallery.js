/**
 * Curated public-site imagery — client-provided local assets only.
 * Paths match public/kathmandu-momo.html. Drop photos under public/images/kathmandu-momo/.
 */

export const STOREFRONT = [
  { src: '/images/kathmandu-momo/hero.jpg', alt: 'Kathmandu Momo dining room in Birendranagar, Surkhet' },
  { src: '/images/kathmandu-momo/about-1.jpg', alt: 'Open kitchen at Kathmandu Momo' },
];

/** Hero imagery (distinct from every other section). */
export const HERO = {
  main: { src: '/images/kathmandu-momo/dishes/dish-chicken-momo.jpg', alt: 'Steamed chicken momo with achar at Kathmandu Momo' },
  inset: { src: '/images/kathmandu-momo/dishes/dish-fry-momo.jpg', alt: 'Pan-fried kothey momo' },
};

/** Signature dishes on the home page — all distinct photos. */
export const SIGNATURE_ITEMS = [
  { name: 'Chicken Momo', img: '/images/kathmandu-momo/dishes/dish-chicken-momo.jpg', category: 'Momo' },
  { name: 'Fry Momo', img: '/images/kathmandu-momo/dishes/dish-fry-momo.jpg', category: 'Momo' },
  { name: 'Chatamari', img: '/images/kathmandu-momo/dishes/dish-chatamari.jpg', category: 'Newari' },
  { name: 'Chicken Chilly', img: '/images/kathmandu-momo/dishes/dish-chicken-chilly.jpg', category: 'Snacks' },
];

/** Popular categories — distinct photos; `img: null` renders a branded tile. */
export const POPULAR_CATEGORIES = [
  { title: 'Momo', note: 'Steam · Fry · Jhol', img: '/images/kathmandu-momo/dishes/dish-chicken-momo.jpg' },
  { title: 'Newari', note: 'Chatamari & more', img: '/images/kathmandu-momo/dishes/dish-chatamari.jpg' },
  { title: 'Snacks', note: 'Chilly & khaja', img: '/images/kathmandu-momo/dishes/dish-chicken-chilly.jpg' },
  { title: 'Café', note: 'Tea, coffee & sweets', img: null },
];

/** Gallery grid — room + food photos used by the static landing / CMS defaults. */
export const GALLERY = [
  '/images/kathmandu-momo/hero.jpg',
  '/images/kathmandu-momo/gallery-1.jpg',
  '/images/kathmandu-momo/gallery-2.jpg',
  '/images/kathmandu-momo/gallery-4.jpg',
  '/images/kathmandu-momo/gallery-5.jpg',
  '/images/kathmandu-momo/about-1.jpg',
  '/images/kathmandu-momo/about-2.jpg',
  '/images/kathmandu-momo/dishes/dish-chicken-momo.jpg',
  '/images/kathmandu-momo/dishes/dish-fry-momo.jpg',
  '/images/kathmandu-momo/dishes/dish-chatamari.jpg',
  '/images/kathmandu-momo/dishes/dish-chicken-chilly.jpg',
];
