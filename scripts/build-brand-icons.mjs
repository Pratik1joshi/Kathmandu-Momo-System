/**
 * Regenerate the Kathmandu Momo app icons (KM monogram) from one SVG source,
 * so favicon / apple-icon / PWA icons can never drift apart.
 *
 * Usage: npm run build:icons   (needs `sharp` — ships with Next's install;
 *                               `npm i -D sharp` if it ever goes missing)
 * Writes: app/icon.png, public/apple-icon.png, public/icon-{light,dark}-32x32.png,
 *         public/favicon.ico
 * (public/icon.svg is the hand-edited master — keep it in sync if you change colours.)
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const svg = (size, ring) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#14110E" stroke="${ring}" stroke-width="3"/>
  <text x="32" y="39.5" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="21" font-weight="700" fill="#D8B166" letter-spacing="0.5">KM</text>
</svg>`;

const targets = [
  ['app/icon.png', 192, '#B5764A'],
  ['public/apple-icon.png', 180, '#B5764A'],
  ['public/icon-light-32x32.png', 32, '#B5764A'],
  ['public/icon-dark-32x32.png', 32, '#D8B166'],
];

for (const [out, size, ring] of targets) {
  await sharp(Buffer.from(svg(size, ring)), { density: 384 }).png().toFile(out);
  console.log('wrote', out);
}

// favicon.ico — a single 32px PNG wrapped in an ICO container (every current
// browser reads PNG-in-ICO; avoids pulling in an ico encoder dependency).
const png = await sharp(Buffer.from(svg(32, '#B5764A')), { density: 384 }).png().toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // image count
const entry = Buffer.alloc(16);
entry[0] = 32; // width
entry[1] = 32; // height
entry.writeUInt16LE(1, 4); // colour planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(header.length + entry.length, 12);
writeFileSync('public/favicon.ico', Buffer.concat([header, entry, png]));
console.log('wrote public/favicon.ico');
