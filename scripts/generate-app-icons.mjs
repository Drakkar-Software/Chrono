// Generate the Expo app-icon set from a single source logo — the same output
// shape OctoChat ships. Run with sharp available (no permanent dep needed):
//
//   npx --yes -p sharp@0.33 node scripts/generate-app-icons.mjs [sourcePNG]
//
// Default source: apps/mobile/assets/images/source-logo.png (a square,
// transparent-background PNG, ideally >= 1024px). Outputs into the same dir:
//   icon.png (1024, on ICON_BG)          — expo.icon (iOS/Android, no alpha)
//   logo.png (1024, transparent)         — splash image
//   logo-512.png (512, transparent)
//   favicon.png (64, transparent)        — expo.web.favicon
//   android-icon-foreground.png (512)    — adaptive foreground, safe-zone padded
//   android-icon-background.png (512)     — solid ANDROID_BG
//   android-icon-monochrome.png (432)    — white silhouette on transparent
//
// Colors are Chrono's marine palette; tweak below if the brand shifts.

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const HERE = dirname(fileURLToPath(import.meta.url));
const IMAGES = resolve(HERE, '../apps/mobile/assets/images');
const SRC = process.argv[2] ? resolve(process.argv[2]) : resolve(IMAGES, 'source-logo.png');

const ICON_BG = '#0b151c'; // dark marine behind the iOS/Android icon glyph
const ANDROID_BG = '#0b151c'; // adaptive-icon background layer

// Scale the glyph inside a canvas, centered, on an optional flat background.
async function composed(size, { pad = 0, background }) {
  const inner = Math.round(size * (1 - pad));
  const glyph = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
  return canvas.composite([{ input: glyph, gravity: 'center' }]).png();
}

async function write(name, pipeline) {
  const out = resolve(IMAGES, name);
  await pipeline.toFile(out);
  const { width, height } = await sharp(out).metadata();
  console.log(`  ${name.padEnd(30)} ${width}x${height}`);
}

async function main() {
  await sharp(SRC).metadata(); // fail fast with a clear error if SRC is missing
  console.log(`Generating icons from ${SRC}`);

  // Transparent logo variants (splash / marketing).
  await write('logo.png', sharp(SRC).resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png());
  await write('logo-512.png', sharp(SRC).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png());

  // App icon — flattened onto ICON_BG (store icons must not be transparent).
  await write('icon.png', (await composed(1024, { pad: 0.14, background: ICON_BG })).flatten({ background: ICON_BG }));

  // Web favicon.
  await write('favicon.png', (await composed(64, { pad: 0.08, background: ICON_BG })).flatten({ background: ICON_BG }));

  // Android adaptive layers. Foreground keeps the ~1/3 safe-zone padding so the
  // OS mask never clips the glyph; background is a solid tile; monochrome is the
  // glyph's alpha painted white for themed icons.
  await write('android-icon-foreground.png', await composed(512, { pad: 0.33 }));
  await write(
    'android-icon-background.png',
    sharp({ create: { width: 512, height: 512, channels: 4, background: ANDROID_BG } }).png(),
  );
  const mono = await composed(432, { pad: 0.33 });
  await write(
    'android-icon-monochrome.png',
    sharp(await mono.toBuffer())
      .ensureAlpha()
      // Recolor every visible pixel to white, keep the alpha as the silhouette.
      .composite([{ input: { create: { width: 432, height: 432, channels: 4, background: '#ffffff' } }, blend: 'in' }])
      .png(),
  );

  console.log('Done. Wire these in apps/mobile/app.json (icon / web.favicon / android.adaptiveIcon / splash).');
}

main().catch((err) => {
  console.error(`\nicon generation failed: ${err.message}`);
  console.error('Provide a square PNG at apps/mobile/assets/images/source-logo.png (or pass a path).');
  process.exit(1);
});
