// ══════════════════════════════════════════
// palettes.js  —  ColorBrewer + Viridis-family
// ══════════════════════════════════════════

const PALETTES = {
  // Sequential
  YlOrRd:  ['#ffffcc','#ffeda0','#fed976','#feb24c','#fd8d3c','#fc4e2a','#e31a1c','#bd0026','#800026'],
  Blues:   ['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#08519c','#08306b'],
  Greens:  ['#f7fcf5','#e5f5e0','#c7e9c0','#a1d99b','#74c476','#41ab5d','#238b45','#006d2c','#00441b'],
  Purples: ['#fcfbfd','#efedf5','#dadaeb','#bcbddc','#9e9ac8','#807dba','#6a51a3','#54278f','#3f007d'],
  OrRd:    ['#fff7ec','#fee8c8','#fdd49e','#fdbb84','#fc8d59','#ef6548','#d7301f','#b30000','#7f0000'],
  BuPu:    ['#f7fcfd','#e0ecf4','#bfd3e6','#9ebcda','#8c96c6','#8c6bb1','#88419d','#810f7c','#4d004b'],

  // Diverging
  RdBu:    ['#67001f','#b2182b','#d6604d','#f4a582','#fddbc7','#f7f7f7','#d1e5f0','#92c5de','#4393c3','#2166ac','#053061'],
  PiYG:    ['#8e0152','#c51b7d','#de77ae','#f1b6da','#fde0ef','#f7f7f7','#e6f5d0','#b8e186','#7fbc41','#4d9221','#276419'],
  PRGn:    ['#40004b','#762a83','#9970ab','#c2a5cf','#e7d4e8','#f7f7f7','#d9f0d3','#a6dba0','#5aae61','#1b7837','#00441b'],
  RdYlGn:  ['#a50026','#d73027','#f46d43','#fdae61','#fee08b','#ffffbf','#d9ef8b','#a6d96a','#66bd63','#1a9850','#006837'],

  // Colorblind-safe perceptual
  Viridis: ['#440154','#482777','#3f4a8a','#31678e','#26838f','#1f9d8a','#6cce5a','#b6de2b','#fee825'],
  Cividis: ['#00204c','#002b6d','#11366f','#374368','#535165','#6d6c6a','#888472','#a49d7e','#c2b68e','#e2cf9e','#fdea9b'],
  Plasma:  ['#0d0887','#3d049e','#6300a7','#8707a6','#ab2494','#c73e77','#dd5e55','#ed7f35','#f9a521','#fcc726','#f0f921'],
  YlGnBu:  ['#ffffd9','#edf8b1','#c7e9b4','#7fcdbb','#41b6c4','#1d91c0','#225ea8','#253494','#081d58'],

  // Bivariate matrix schemes (3×3 = 9 colors, row-major: low-low to high-high)
  _biv_bluered: [
    '#e8e8e8','#e4acac','#c85a5a',
    '#b0d5df','#ad9ea5','#985356',
    '#64acbe','#627f8c','#574249'
  ],
  _biv_purpgreen: [
    '#e8e8e8','#b5c0da','#6c83b5',
    '#b8d6be','#90b2b3','#567994',
    '#73ae80','#5a9178','#2a5a5b'
  ],
  _biv_pinkblue: [
    '#e8e8e8','#ace4e4','#5ac8c8',
    '#dfb0d6','#a5add3','#5698b9',
    '#be64ac','#8c62aa','#3b4994'
  ]
};

// Get N colors from a named palette (interpolated if needed)
function getPaletteColors(name, n, reverse = false) {
  const base = PALETTES[name];
  if (!base) return Array(n).fill('#ccc');

  let colors;
  if (n <= base.length) {
    // Evenly sample from base
    const step = (base.length - 1) / (n - 1);
    colors = Array.from({length: n}, (_, i) => base[Math.round(i * step)]);
  } else {
    colors = interpolatePalette(base, n);
  }

  return reverse ? [...colors].reverse() : colors;
}

// Simple hex interpolation to get more steps
function interpolatePalette(colors, n) {
  const result = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const idx = t * (colors.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, colors.length - 1);
    const frac = idx - lo;
    result.push(lerpHex(colors[lo], colors[hi], frac));
  }
  return result;
}

function lerpHex(c1, c2, t) {
  const r1 = parseInt(c1.slice(1,3),16), g1 = parseInt(c1.slice(3,5),16), b1 = parseInt(c1.slice(5,7),16);
  const r2 = parseInt(c2.slice(1,3),16), g2 = parseInt(c2.slice(3,5),16), b2 = parseInt(c2.slice(5,7),16);
  const r = Math.round(r1 + (r2-r1)*t);
  const g = Math.round(g1 + (g2-g1)*t);
  const b = Math.round(b1 + (b2-b1)*t);
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

function renderPalettePreview(name, reverse = false) {
  const el = document.getElementById('palette-preview');
  if (!el) return;
  const base = PALETTES[name];
  if (!base) return;
  const colors = reverse ? [...base].reverse() : base;
  el.innerHTML = colors.map(c => `<div style="background:${c}"></div>`).join('');
}
