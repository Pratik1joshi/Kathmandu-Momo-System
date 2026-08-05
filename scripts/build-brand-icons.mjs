/**
 * Regenerate Kathmandu Momo icons from the approved repository logo.
 * Small favicon sizes use the central mountain/momo emblem so the restaurant
 * name is not squeezed into an unreadable 16/32px mark.
 *
 * Usage: npm run build:icons
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const source = 'public/images/kathmandu-momo/logo.png';
const smallEmblem = { left: 400, top: 150, width: 480, height: 480 };

const targets = [
  ['app/icon.png', 192],
  ['public/apple-icon.png', 180],
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
];

for (const [out, size] of targets) {
  await sharp(source).resize(size, size, { fit: 'cover' }).png().toFile(out);
  console.log('wrote', out);
}

for (const out of ['public/icon-light-32x32.png', 'public/icon-dark-32x32.png']) {
  await sharp(source).extract(smallEmblem).resize(32, 32, { fit: 'cover' }).png().toFile(out);
  console.log('wrote', out);
}

// A 32px PNG wrapped in an ICO container for current browsers.
const png = await sharp(source).extract(smallEmblem).resize(32, 32, { fit: 'cover' }).png().toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry[0] = 32;
entry[1] = 32;
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(header.length + entry.length, 12);
const ico = Buffer.concat([header, entry, png]);

for (const out of ['public/favicon.ico', 'app/favicon.ico']) {
  writeFileSync(out, ico);
  console.log('wrote', out);
}
