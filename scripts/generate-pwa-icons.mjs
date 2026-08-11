import sharp from 'sharp';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(projectRoot, 'public', 'logo.png');
const outputDirectory = resolve(projectRoot, 'public', 'icons');
const icons = [
  ['favicon-16.png', 16],
  ['favicon-32.png', 32],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
];

await Promise.all(
  icons.map(([name, size]) =>
    sharp(source)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: size <= 32 })
      .toFile(resolve(outputDirectory, name))
  )
);

console.log(`Generated ${icons.length} PWA icons from public/logo.png.`);
