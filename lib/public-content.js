/**
 * Server-side bridge that lets the public site show CMS-managed content while
 * keeping lib/restaurant-info.js + lib/public-gallery.js as the guaranteed
 * fallback. If a CMS value is empty or the store is unreachable, the original
 * approved constant is used — so the public site can never render blank because
 * of the CMS.
 *
 * Menu prices are intentionally NOT sourced here; the public menu keeps using
 * the POS menu source.
 */

import Database from '@/lib/db/index';
import { getCmsContent } from '@/lib/cms.js';
import { RESTAURANT } from '@/lib/restaurant-info.js';
import { HERO, GALLERY, SIGNATURE_ITEMS, POPULAR_CATEGORIES, STOREFRONT } from '@/lib/public-gallery.js';

const pick = (cmsVal, fallback) => {
  const v = typeof cmsVal === 'string' ? cmsVal.trim() : cmsVal;
  return v || v === 0 ? v : fallback;
};

async function loadCms() {
  try {
    return await getCmsContent(Database.getInstance());
  } catch {
    return null;
  }
}

/** Full home-page content for the public site. Never throws. */
export async function getPublicHome() {
  const cms = await loadCms();
  const h = cms?.home || {};
  const sec = h.sections || {};

  const popular = (h.popularCategories?.length ? h.popularCategories : POPULAR_CATEGORIES).map((c) => ({
    title: c.title,
    note: c.note || '',
    img: c.img || null,
    href: c.href || '/menu',
  }));

  const signature = (h.signatureItems?.length ? h.signatureItems : SIGNATURE_ITEMS).map((it) => ({
    name: it.name,
    category: it.category || '',
    img: it.img || '',
    href: it.href || '/menu',
  }));

  const steps = (h.howItWorksSteps?.length ? h.howItWorksSteps : [
    { title: 'Order at the counter', text: 'Pick your dishes and pay right at the counter.' },
    { title: 'Served ready-to-eat', text: 'Biryani, momo, sekuwa and fast food, freshly prepared.' },
    { title: 'Takeaway & delivery', text: 'Or message on WhatsApp to order ahead.' },
  ]);

  return {
    heroHeadingLine1: pick(h.heroHeadingLine1, 'Viral Matka Biryani,'),
    heroHeadingLine2: pick(h.heroHeadingLine2, 'momo & sekuwa'),
    heroHeadingLine3: pick(h.heroHeadingLine3, 'served fresh.'),
    heroDescription: pick(h.heroDescription, RESTAURANT.intro),
    heroImage: pick(h.heroImage, HERO.main.src),
    heroImageAlt: pick(h.heroImageAlt, HERO.main.alt),
    heroInsetImage: pick(h.heroInsetImage, HERO.inset.src),
    heroInsetAlt: pick(h.heroInsetAlt, HERO.inset.alt),
    heroBadgeValue: pick(h.heroBadgeValue, '103+'),
    heroBadgeLabel: pick(h.heroBadgeLabel, 'dishes on the menu'),
    heroEyebrow: pick(h.heroEyebrow, 'Counter service · Dine-in & takeaway · Birendranagar-6, Surkhet'),
    primaryCta: {
      label: pick(h.primaryCta?.label, 'View Menu'),
      href: pick(h.primaryCta?.href, '/menu'),
    },
    secondaryCta: {
      label: pick(h.secondaryCta?.label, 'WhatsApp'),
      href: pick(h.secondaryCta?.href, 'whatsapp'),
    },
    tertiaryCta: {
      label: pick(h.tertiaryCta?.label, 'Call'),
      href: pick(h.tertiaryCta?.href, 'tel'),
    },

    popularTitle: pick(h.popularTitle, 'Popular categories'),
    popularLead: pick(h.popularLead, 'The dishes our counter is known for.'),
    popularCategories: popular,

    signatureTitle: pick(h.signatureTitle, 'Signature dishes'),
    signatureLead: pick(h.signatureLead, 'Straight from our counter kitchen.'),
    signatureItems: signature,

    howItWorksTitle: pick(h.howItWorksTitle, 'How it works'),
    howItWorksLead: pick(h.howItWorksLead, 'No table service, no waiting on a waiter — just good food, fast.'),
    howItWorksSteps: steps,

    menuTitle: pick(h.menuTitle, 'On the menu'),
    menuLead: pick(h.menuLead, 'Live prices, straight from our counter system.'),
    menuCtaLabel: pick(h.menuCtaLabel, 'Full menu'),
    menuCtaHref: pick(h.menuCtaHref, '/menu'),

    aboutStripTitle: pick(h.aboutStripTitle, 'A quick, friendly counter in Surkhet'),
    aboutStripText: pick(
      h.aboutStripText,
      'On New Road in Birendranagar-6, we serve ready-to-eat fast food across 13 categories — coffee and cold drinks, breakfast, momo, sekuwa, pizza, biryani and more. Order at the counter, dine in or take away.'
    ),
    aboutStripImage: pick(h.aboutStripImage, STOREFRONT[1]?.src || RESTAURANT.storefront[1]),
    aboutStripImageAlt: pick(h.aboutStripImageAlt, STOREFRONT[1]?.alt || 'Kathmandu Momo kitchen'),
    aboutStripCtaLabel: pick(h.aboutStripCtaLabel, 'More about us'),
    aboutStripCtaHref: pick(h.aboutStripCtaHref, '/about'),

    galleryTitle: pick(h.galleryTitle, 'Gallery'),
    galleryCtaLabel: pick(h.galleryCtaLabel, 'See more'),
    galleryCtaHref: pick(h.galleryCtaHref, '/gallery'),
    galleryLimit: Number(h.galleryLimit) > 0 ? Number(h.galleryLimit) : 6,

    findUsTitle: pick(h.findUsTitle, 'Find us'),
    findUsLead: pick(h.findUsLead, 'Birendranagar-6, New Road — on the way through Surkhet.'),

    sections: {
      hero: sec.hero !== false,
      popular: sec.popular !== false,
      signature: sec.signature !== false,
      howItWorks: sec.howItWorks !== false,
      menu: sec.menu !== false,
      about: sec.about !== false,
      gallery: sec.gallery !== false,
      findUs: sec.findUs !== false,
    },
  };
}

/** Merged About page content. Never throws. */
export async function getPublicAbout() {
  const cms = await loadCms();
  const a = cms?.about || {};
  const features = (a.features?.length ? a.features : [
    { title: 'Counter service', text: 'Order and pay at the counter — quick and straightforward.' },
    { title: 'Wide menu', text: '103 dishes across 13 categories, from biryani to coffee.' },
    { title: 'Fresh coffee', text: 'Espresso, cappuccino, cold coffee, tea and more.' },
    { title: 'Dine-in & takeaway', text: 'Eat in, take away, or order online for delivery.' },
  ]);
  return {
    heading: pick(a.heading, RESTAURANT.name),
    description: pick(a.description, RESTAURANT.intro),
    descriptionExtra: pick(
      a.descriptionExtra,
      'Located on New Road in Birendranagar-6, Surkhet, we run a simple counter-service model: you order at the counter and your food is served ready to eat, dine-in or takeaway. Our menu spans coffee and tea, cold beverages and fresh juice, breakfast, sandwiches and burgers, pizza, soups, vegetarian and non-vegetarian snacks, momo, fast food, and our Viral Matka Biryani.'
    ),
    image: pick((a.images || [])[0], STOREFRONT[0]?.src || RESTAURANT.storefront[0]),
    images: (a.images?.length ? a.images : RESTAURANT.storefront).filter(Boolean),
    features,
    visitHeading: pick(a.visitHeading, 'Visit us'),
    visible: a.visible !== false,
  };
}

/** Merged Gallery items. Falls back to the built-in gallery when CMS is empty. */
export async function getPublicGallery() {
  const cms = await loadCms();
  const heading = pick(cms?.gallery?.heading, 'Gallery');
  const lead = pick(cms?.gallery?.lead, 'Food and room photos from Kathmandu Momo.');
  const items = (cms?.gallery?.items || [])
    .filter((i) => i && i.url && i.visible !== false)
    .sort((x, y) => (x.order || 0) - (y.order || 0))
    .map((i) => ({ url: i.url, alt: i.alt || i.title || 'Kathmandu Momo', title: i.title || '' }));
  if (items.length) return { heading, lead, items };
  return {
    heading,
    lead,
    items: GALLERY.map((src) => ({ url: src, alt: 'Kathmandu Momo', title: '' })),
  };
}

/** Merged contact block for the public Contact page. Never throws. */
export async function getPublicContact() {
  const cms = await loadCms();
  const c = cms?.contact || {};
  const b = cms?.brand || {};
  const social = c.social || b.social || {};

  const phoneDisplay = pick(c.phone, RESTAURANT.phoneDisplay);
  const email = pick(c.email, RESTAURANT.email);
  const location = pick(c.location, RESTAURANT.address.full);
  const whatsappRaw = pick(c.whatsapp, RESTAURANT.whatsappNumber);
  const whatsappNumber = String(whatsappRaw).replace(/[^0-9]/g, '') || RESTAURANT.whatsappNumber;
  const phoneE164 = phoneDisplay.startsWith('+') ? `+${phoneDisplay.replace(/[^0-9]/g, '')}` : RESTAURANT.phoneE164;

  return {
    phoneDisplay,
    phoneE164,
    email,
    location,
    whatsappNumber,
    mapEmbedSrc: pick(c.mapEmbed || b.mapEmbed, RESTAURANT.mapEmbedSrc),
    social: {
      facebook: pick(social.facebook, RESTAURANT.social.facebook),
      tiktok: pick(social.tiktok, RESTAURANT.social.tiktok),
      instagram: pick(social.instagram, ''),
    },
    hrefs: {
      tel: `tel:${phoneE164}`,
      mailto: `mailto:${email}`,
      whatsapp: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hello Kathmandu Momo! I'd like to place an order.")}`,
      directions: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${RESTAURANT.name}, ${location}`)}`,
    },
  };
}

/** Brand bits for shell / structured data. */
export async function getPublicBrand() {
  const cms = await loadCms();
  const b = cms?.brand || {};
  return {
    name: pick(b.businessName, RESTAURANT.name),
    shortName: pick(b.shortName, RESTAURANT.shortName),
    tagline: pick(b.tagline, RESTAURANT.tagline),
    logo: pick(b.logo, RESTAURANT.logo),
  };
}
