import fs from 'fs';

const filePath = 'src/pages/Result.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// Replace Carto with Stadia's Alidade Smooth Dark (it often works without a key if referred from localhost or non-commercial, 
// wait, Stadia sometimes requires an API key too). 
// Let's use Carto's no-key-needed endpoint (usually Voyager or just direct openstreetmap with CSS invert)
// For best dark theme that is free: We can use openstreetmap and add CSS invert filter.

code = code.replace(
  /url="https:\/\/{s}\.basemaps\.cartocdn\.com\/dark_all\/{z}\/{x}\/{y}\/{r}\.png"/,
  `url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              className="map-tiles-dark"`
);

fs.writeFileSync(filePath, code);

// Add the CSS to index.css
const cssPath = 'src/index.css';
let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('.map-tiles-dark')) {
  css += `\n\n.map-tiles-dark {\n  filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);\n}`;
  fs.writeFileSync(cssPath, css);
}

