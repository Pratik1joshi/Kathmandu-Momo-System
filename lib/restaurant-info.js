/**
 * Central factual identity for Kathmandu Momo.
 *
 * Sourced from public/kathmandu-momo.html + client-supplied assets.
 * Do NOT invent opening hours, ratings, or social URLs — only verified fields.
 */

export const RESTAURANT = {
  name: 'Kathmandu Momo',
  shortName: 'Kathmandu Momo',
  tagline: 'Momo, Nepali kitchen & café in Birendranagar, Surkhet',
  intro:
    'Momo steamed to order, Nepali thali, chatamari and café classics in Birendranagar, Surkhet. सस्तो पनि, राम्रो पनि, छिटो पनि, मिठो पनि.',
  address: {
    line: 'Birendranagar',
    city: 'Surkhet',
    postalCode: '',
    country: 'Nepal',
    full: 'Birendranagar, Surkhet, Karnali Province, Nepal',
  },
  coords: { lat: 28.5981066696641, lng: 81.61978015808363 },
  phoneDisplay: '+977 984-9216081',
  phoneE164: '+9779849216081',
  whatsappNumber: '9779849216081',
  email: '',
  social: {
    facebook: '',
    tiktok: '',
  },
  mapEmbedSrc:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d579.3031250130733!2d81.61978015808363!3d28.5981066696641!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39a285de47873bdb%3A0x91e9c9fe8fcda1b9!2sKathmandu%20Momo!5e0!3m2!1sen!2snp!4v1785665152488!5m2!1sen!2snp',
  logo: '/icon-512.png',
  storefront: ['/images/kathmandu-momo/hero.jpg', '/images/kathmandu-momo/about-1.jpg'],
};

export function telHref() {
  return `tel:${RESTAURANT.phoneE164}`;
}

export function mailtoHref() {
  return `mailto:${RESTAURANT.email}`;
}

export function whatsappHref(message = "Hello Kathmandu Momo! I'd like to place an order.") {
  return `https://wa.me/${RESTAURANT.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

/** External "Open in Google Maps" link (search by name near coordinates). */
export function directionsHref() {
  const { lat, lng } = RESTAURANT.coords;
  const q = encodeURIComponent(`${RESTAURANT.name}, ${RESTAURANT.address.full}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}&center=${lat},${lng}`;
}

/** "Read reviews on Google" — points to the live listing rather than copying reviews. */
export function googleReviewsHref() {
  const q = encodeURIComponent(`${RESTAURANT.name} ${RESTAURANT.address.city}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
