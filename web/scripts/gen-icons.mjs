// Run once: node scripts/gen-icons.mjs
// Generates icon-192.png and icon-512.png in public/
// Same design as the canvas icon in Index.html

import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

function makeIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = Math.round(size * 0.22);

  // Rounded rect background
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = '#1E1B4B';
  ctx.fill();

  // "FT" text
  ctx.fillStyle = '#A5B4FC';
  ctx.font = `bold ${Math.round(size * 0.42)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FT', size / 2, size / 2 + size * 0.03);

  return canvas.toBuffer('image/png');
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');

writeFileSync(join(publicDir, 'icon-192.png'), makeIcon(192));
writeFileSync(join(publicDir, 'icon-512.png'), makeIcon(512));
console.log('✓ icon-192.png and icon-512.png generated in public/');
