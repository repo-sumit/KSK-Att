// Generates every derived brand asset from the untouched source logo
// (Doc/mh_ksk_logo.png, 1254x1254 RGB on white). Run with `npm run icons`;
// outputs are committed so builds never depend on this script.
//
// Crops (measured from the source; see docs/DESIGN_SYSTEM.md → Branding):
//   emblem  — map outline + figures + book, no Devanagari wordmark (rows 130–875)
//   mark    — figures + cap + book only, for 16/32 px where the thin map line vanishes
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = path.join(ROOT, 'Doc/mh_ksk_logo.png');
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

const CROPS = {
  emblem: { left: 160, top: 130, width: 930, height: 745 },
  mark: { left: 262, top: 300, width: 742, height: 572 },
};

// Below row 846 the book has converged to its centre point (x≈625–647); anything
// further right in rows 846–875 is the top of the wordmark's "ौ" matra — blank it.
const ERASE = [{ left: 700, top: 846, width: 400, height: 40 }];

async function cleanSource() {
  const overlays = ERASE.map((r) => ({
    input: { create: { width: r.width, height: r.height, channels: 4, background: WHITE } },
    left: r.left,
    top: r.top,
  }));
  return sharp(SRC).composite(overlays).png().toBuffer();
}

/** Crop a region and pad it to a centred square on white (no distortion). */
async function square(source, crop, padRatio = 0.06) {
  const side = Math.max(crop.width, crop.height);
  const pad = Math.round(side * padRatio);
  const full = side + pad * 2;
  const region = await sharp(source).extract(crop).toBuffer();
  return sharp({ create: { width: full, height: full, channels: 4, background: WHITE } })
    .composite([{ input: region, left: Math.round((full - crop.width) / 2), top: Math.round((full - crop.height) / 2) }])
    .png()
    .toBuffer();
}

const png = (input, size) => sharp(input).resize(size, size, { fit: 'contain', background: WHITE }).png({ compressionLevel: 9 }).toBuffer();

/** Minimal ICO container that embeds PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

async function main() {
  const brandingDir = path.join(ROOT, 'public/branding');
  const appDir = path.join(ROOT, 'src/app');
  await mkdir(brandingDir, { recursive: true });

  const clean = await cleanSource();
  const emblem = await square(clean, CROPS.emblem);
  const mark = await square(clean, CROPS.mark, 0.04);
  // Maskable icons need the artwork inside the central 80% safe zone.
  const maskable = await square(clean, CROPS.emblem, 0.2);

  const outputs = [
    [path.join(brandingDir, 'ksk-logo-full.png'), await png(SRC, 512)],
    [path.join(brandingDir, 'ksk-emblem.png'), await png(emblem, 256)],
    [path.join(brandingDir, 'icon-192.png'), await png(emblem, 192)],
    [path.join(brandingDir, 'icon-512.png'), await png(emblem, 512)],
    [path.join(brandingDir, 'icon-maskable-512.png'), await png(maskable, 512)],
    [path.join(appDir, 'icon.png'), await png(emblem, 512)],
    [path.join(appDir, 'apple-icon.png'), await png(emblem, 180)],
    [path.join(appDir, 'favicon.ico'), ico([
      { size: 16, data: await png(mark, 16) },
      { size: 32, data: await png(mark, 32) },
      { size: 48, data: await png(mark, 48) },
    ])],
  ];
  for (const [file, data] of outputs) {
    await writeFile(file, data);
    console.log(`wrote ${path.relative(ROOT, file)} (${data.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
