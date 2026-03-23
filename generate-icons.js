// Run with: node generate-icons.js
// Requires: npm install canvas  (or: brew install pkg-config cairo pango && npm install canvas)
// Generates icons/icon16.png, icon48.png, icon128.png

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 48, 128];

for (const size of SIZES) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = size * 0.25; // corner radius

  // Background: Substack orange
  ctx.fillStyle = '#FF6719';
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
  ctx.fill();

  // Three horizontal lines (newspaper / archive icon)
  ctx.fillStyle = '#FFFFFF';
  const lw = size * 0.56;   // line width
  const lh = Math.max(1.5, size * 0.08); // line height
  const x0 = (size - lw) / 2;
  const gaps = [0.28, 0.48, 0.68];

  for (const frac of gaps) {
    const y = size * frac - lh / 2;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(x0, y, lw, lh, lh / 2)
      : ctx.rect(x0, y, lw, lh);
    ctx.fill();
  }

  const out = path.join(__dirname, 'icons', `icon${size}.png`);
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  console.log(`Written ${out}`);
}
console.log('Done.');
