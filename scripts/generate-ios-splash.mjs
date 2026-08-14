import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(projectRoot, 'public', 'logo.png');
const outputDirectory = resolve(projectRoot, 'public', 'icons', 'splash');

await mkdir(outputDirectory, { recursive: true });

// Latar splash mengikuti background_color manifest (dark surface).
const BACKGROUND = { r: 11, g: 15, b: 20, alpha: 1 };

// Ukuran fisik (pixel) per perangkat iOS beserta media query `link` yang cocok.
// Set fokus portrait iPhone + iPad (aplikasi berorientasi portrait).
const splashTargets = [
  { file: '640x1136.png', width: 640, height: 1136, media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)' },
  { file: '750x1334.png', width: 750, height: 1334, media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' },
  { file: '1242x2208.png', width: 1242, height: 2208, media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)' },
  { file: '1125x2436.png', width: 1125, height: 2436, media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)' },
  { file: '828x1792.png', width: 828, height: 1792, media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)' },
  { file: '1242x2688.png', width: 1242, height: 2688, media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)' },
  { file: '1170x2532.png', width: 1170, height: 2532, media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)' },
  { file: '1284x2778.png', width: 1284, height: 2778, media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)' },
  { file: '1179x2556.png', width: 1179, height: 2556, media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)' },
  { file: '1290x2796.png', width: 1290, height: 2796, media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' },
  { file: '1536x2048.png', width: 1536, height: 2048, media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)' },
  { file: '1668x2224.png', width: 1668, height: 2224, media: '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)' },
  { file: '2048x2732.png', width: 2048, height: 2732, media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)' },
];

for (const { file, width, height } of splashTargets) {
  const logoSize = Math.round(Math.min(width, height) * 0.28);
  const logo = await sharp(source)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .toBuffer();

  await sharp({
    create: { width, height, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(outputDirectory, file));
}

console.log(`Generated ${splashTargets.length} iOS splash images into public/icons/splash.`);