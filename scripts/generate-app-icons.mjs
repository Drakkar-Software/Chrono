// Generate the Expo app-icon set from a single source logo — the same output
// shape OctoChat ships. Run with sharp available (no permanent dep needed):
//
//   npx --yes -p sharp@0.33 node scripts/generate-app-icons.mjs [sourcePNG]
//
// Default source: apps/mobile/assets/images/source-logo.png. The source is
// trimmed to its content first (so a wide alpha/white margin doesn't shrink the
// glyph), then composed at each size. Outputs into the same dir:
//   icon.png (1024, on ICON_BG)          — expo.icon (iOS/Android, no alpha)
//   logo.png (1024, transparent)         — README / splash image
//   logo-512.png (512, transparent)
//   favicon.png (64, on ICON_BG)         — expo.web.favicon
//   android-icon-foreground.png (512)    — adaptive foreground, safe-zone padded
//   android-icon-background.png (512)     — solid ANDROID_BG
//   android-icon-monochrome.png (432)    — mark silhouette (themed icons)

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const HERE = dirname(fileURLToPath(import.meta.url));
const IMAGES = resolve(HERE, '../apps/mobile/assets/images');
const SRC = process.argv[2] ? resolve(process.argv[2]) : resolve(IMAGES, 'source-logo.png');

// The source is a dark navy mark on a WHITE field, so back the icons with white
// (a dark backing would show the logo's own white card as a tile).
const ICON_BG = '#ffffff';
const ANDROID_BG = '#ffffff';
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const WHITE_CUTOFF = 235; // luminance >= this = background (trim + silhouette)

// Trimmed-to-content base: strip the flat white margin so the mark fills the
// frame. Cached across all outputs.
let baseBuf;
async function base() {
  if (!baseBuf) {
    baseBuf = await sharp(SRC)
      .trim({ background: '#ffffff', threshold: 255 - WHITE_CUTOFF })
      .toBuffer();
  }
  return baseBuf;
}

// The trimmed glyph fit into a `size` square, centered, with `pad` fractional
// margin, over an optional flat background.
async function composed(size, { pad = 0, background } = {}) {
  const inner = Math.round(size * (1 - pad));
  const glyph = await sharp(await base())
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: background ?? TRANSPARENT } })
    .composite([{ input: glyph, gravity: 'center' }])
    .png();
}

async function write(name, pipeline) {
  const out = resolve(IMAGES, name);
  await pipeline.toFile(out);
  const { width, height } = await sharp(out).metadata();
  console.log(`  ${name.padEnd(30)} ${width}x${height}`);
}

async function main() {
  await sharp(SRC).metadata(); // fail fast if SRC is missing
  console.log(`Generating icons from ${SRC}`);

  // Transparent logo variants (README / splash / marketing). Trimmed then padded
  // a touch so it isn't edge-to-edge.
  await write('logo.png', await composed(1024, { pad: 0.06 }));
  await write('logo-512.png', await composed(512, { pad: 0.06 }));

  // Store icons must be opaque — flatten onto ICON_BG.
  await write('icon.png', (await composed(1024, { pad: 0.12, background: ICON_BG })).flatten({ background: ICON_BG }));
  await write('favicon.png', (await composed(64, { pad: 0.06, background: ICON_BG })).flatten({ background: ICON_BG }));

  // Android adaptive layers: foreground keeps ~1/3 safe-zone padding, background
  // is a solid tile.
  await write('android-icon-foreground.png', await composed(512, { pad: 0.3 }));
  await write(
    'android-icon-background.png',
    sharp({ create: { width: 512, height: 512, channels: 4, background: ANDROID_BG } }).png(),
  );

  // Monochrome silhouette: everything that isn't the white field, painted white
  // on transparent (a themed-icon mask of the whole mark).
  const SZ = 432;
  const glyph = await sharp(await base())
    .resize(Math.round(SZ * 0.7), Math.round(SZ * 0.7), { fit: 'contain', background: '#ffffff' })
    .toBuffer();
  const padded = await sharp({ create: { width: SZ, height: SZ, channels: 4, background: '#ffffff' } })
    .composite([{ input: glyph, gravity: 'center' }])
    .png()
    .toBuffer();
  // Alpha = the mark: luminance >= cutoff -> 255 (bg), negate so mark -> 255.
  const alphaRaw = await sharp(padded)
    .greyscale()
    .threshold(WHITE_CUTOFF)
    .negate()
    .toColourspace('b-w')
    .raw()
    .toBuffer();
  const whiteRaw = Buffer.alloc(SZ * SZ * 3, 255);
  await write(
    'android-icon-monochrome.png',
    sharp(whiteRaw, { raw: { width: SZ, height: SZ, channels: 3 } })
      .joinChannel(alphaRaw, { raw: { width: SZ, height: SZ, channels: 1 } })
      .png(),
  );

  console.log('Done.');
}

main().catch((err) => {
  console.error(`\nicon generation failed: ${err.message}`);
  console.error('Provide a square PNG at apps/mobile/assets/images/source-logo.png (or pass a path).');
  process.exit(1);
});
