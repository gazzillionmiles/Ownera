import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
const iconsDir = path.join(publicDir, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generic SVG logo with dark background and gradient path
const createSvgIcon = (width, height, isMaskable = false) => {
  const padding = isMaskable ? Math.round(width * 0.15) : Math.round(width * 0.05);
  const size = width - padding * 2;
  const scale = size / 512;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" rx="${isMaskable ? 0 : Math.round(width * 0.22)}" fill="#09090b" />
    <g transform="translate(${padding}, ${padding}) scale(${scale})">
      <defs>
        <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2CB7A5" />
          <stop offset="50%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#06b6d4" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#2CB7A5" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#09090b" stop-opacity="0" />
        </radialGradient>
      </defs>

      <circle cx="256" cy="256" r="220" fill="url(#glow)" />
      
      <path d="M 128 256 L 256 128 L 384 256 L 256 384 Z" 
            fill="none" 
            stroke="url(#primaryGrad)" 
            stroke-width="36" 
            stroke-linecap="round" 
            stroke-linejoin="round" />
    </g>
  </svg>`;
};

async function generateIcons() {
  console.log('Generating PWA Icons...');

  const sizes = [
    { name: 'icon-192x192.png', size: 192, maskable: false },
    { name: 'icon-192-maskable.png', size: 192, maskable: true },
    { name: 'icon-512x512.png', size: 512, maskable: false },
    { name: 'icon-512-maskable.png', size: 512, maskable: true },
    { name: 'apple-touch-icon.png', size: 180, maskable: false },
    { name: 'favicon-32x32.png', size: 32, maskable: false },
    { name: 'favicon-16x16.png', size: 16, maskable: false },
  ];

  for (const item of sizes) {
    const svg = createSvgIcon(item.size, item.size, item.maskable);
    const outputPath = path.join(iconsDir, item.name);
    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);
    console.log(`Generated: ${outputPath}`);
  }

  const faviconSvg = createSvgIcon(32, 32, false);
  await sharp(Buffer.from(faviconSvg))
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));

  console.log('Icons generated successfully.');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
