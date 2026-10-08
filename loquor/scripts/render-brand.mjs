// Renders the app icon and splash from assets/brand/speek.svg.
// Dev-only: `node scripts/render-brand.mjs`. @resvg/resvg-js is a devDependency
// and never reaches the bundle.

import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const mark = readFileSync(new URL("../assets/brand/speek.svg", import.meta.url), "utf8");
const inner = mark.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

// The icon is full-bleed (iOS refuses transparency): the navy ground with a
// stage-blue wash and a green lamp glow, and the mark at about 72% so the rounded mask never clips it.
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  <defs>
    <radialGradient id="g1" cx="18" cy="12" r="70" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2E4A78" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#2E4A78" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="92" cy="96" r="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#4E9C6E" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#4E9C6E" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100" fill="#0B0F17"/>
  <rect width="100" height="100" fill="url(#g1)"/>
  <rect width="100" height="100" fill="url(#g2)"/>
  <g transform="translate(10 11) scale(0.8)">${inner}</g>
</svg>`;

function render(svg, width, out) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
  writeFileSync(new URL(`../assets/${out}`, import.meta.url), png);
  console.log(`assets/${out}`);
}

render(icon, 1024, "icon.png");
// Splash: the bare mark on transparency; app.json supplies the ground colour.
render(mark, 512, "splash-icon.png");
