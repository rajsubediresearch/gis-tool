// ══════════════════════════════════════════
// map.js  —  Leaflet map setup & layer control
// v2 — flicker-free hover using cached styles
// ══════════════════════════════════════════

let MAP, INSET_MAP;
let baseLayer = null, insetBaseLayer = null;
let geojsonLayer = null, symbolsLayer = null;
let scaleControl = null;
let _highlighted = null;  // track currently highlighted layer

const BASEMAPS = {
  'none':        null,
  'osm':         'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  'carto-light': 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  'carto-dark':  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  'esri-topo':   'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
};
const BASEMAP_ATTR = {
  'osm':         '© OpenStreetMap contributors',
  'carto-light': '© CARTO, © OpenStreetMap contributors',
  'carto-dark':  '© CARTO, © OpenStreetMap contributors',
  'esri-topo':   '© Esri, © OpenStreetMap contributors'
};

function initMap() {
  MAP = L.map('map', { center: [20, 0], zoom: 2, zoomControl: true });
  MAP.getContainer().style.background = '#e8eaf0';
  scaleControl = L.control.scale({ position: 'bottomright', imperial: true }).addTo(MAP);

  INSET_MAP = L.map('inset-map', {
    center: [20, 0], zoom: 0,
    zoomControl: false, attributionControl: false,
    dragging: false, scrollWheelZoom: false,
    doubleClickZoom: false, touchZoom: false
  });

  MAP.on('moveend zoomend', () => {
    if (INSET_MAP) INSET_MAP.setView(MAP.getCenter(), Math.max(0, MAP.getZoom() - 4));
  });
}

function setBasemap(key) {
  if (baseLayer)      { MAP.removeLayer(baseLayer);           baseLayer = null; }
  if (insetBaseLayer) { INSET_MAP.removeLayer(insetBaseLayer); insetBaseLayer = null; }
  if (key === 'none') {
    MAP.getContainer().style.background = '#e8eaf0';
    INSET_MAP.getContainer().style.background = '#e8eaf0';
    return;
  }
  const url = BASEMAPS[key], attr = BASEMAP_ATTR[key] || '';
  if (!url) return;
  MAP.getContainer().style.background = '';
  baseLayer      = L.tileLayer(url, { attribution: attr, maxZoom: 19 }).addTo(MAP);
  insetBaseLayer = L.tileLayer(url, { attribution: '', maxZoom: 6 }).addTo(INSET_MAP);
}

// ── GeoJSON choropleth — flicker-free hover ──
function renderChoropleth(geojson, _colorFn, styleFn, popupFn) {
  if (geojsonLayer) { MAP.removeLayer(geojsonLayer); geojsonLayer = null; }
  _highlighted = null;
  if (!geojson) return;

  geojsonLayer = L.geoJSON(geojson, {
    style: styleFn,
    onEachFeature: (feature, layer) => {
      layer.on({
        mouseover: e => {
          // Reset previous highlight without re-rendering all layers
          if (_highlighted && _highlighted !== e.target) {
            const prev = _highlighted;
            prev.setStyle(styleFn(prev.feature));
          }
          _highlighted = e.target;
          e.target.setStyle({
            weight:      2,
            color:       '#333',
            fillOpacity: Math.min((styleFn(feature).fillOpacity || 0.8) + 0.1, 1)
          });
          e.target.bringToFront();
        },
        mouseout: e => {
          // Restore exact cached style — no full layer reset, no flicker
          e.target.setStyle(styleFn(e.target.feature));
          _highlighted = null;
        },
        click: e => {
          const html = popupFn(feature);
          if (html) L.popup().setLatLng(e.latlng).setContent(html).openOn(MAP);
        }
      });
    }
  }).addTo(MAP);

  fitToLayer();
}

// ── Proportional symbols ──────────────────
function renderSymbols(geojson, sizeFn, colorFn, opacityFn, popupFn) {
  clearSymbols();
  if (!geojson) return;

  const extra = [];

  // For polygon features: place circle at centroid
  geojson.features.forEach(feature => {
    if (!feature.geometry) return;
    const type = feature.geometry.type;
    const r = sizeFn(feature);
    if (r <= 0) return;

    let center;
    try {
      if (type === 'Point') {
        center = L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
      } else {
        const bounds = L.geoJSON(feature).getBounds();
        center = bounds.getCenter();
      }
    } catch(e) { return; }

    const circle = L.circleMarker(center, {
      radius:      r,
      fillColor:   colorFn(feature),
      color:       'rgba(0,0,0,0.25)',
      weight:      1,
      fillOpacity: opacityFn()
    });
    circle.on('click', e => {
      const html = popupFn(feature);
      if (html) L.popup().setLatLng(e.latlng).setContent(html).openOn(MAP);
    });
    circle.addTo(MAP);
    extra.push(circle);
  });

  // Store a dummy layer group as symbolsLayer so clearSymbols works
  symbolsLayer = L.layerGroup().addTo(MAP);
  symbolsLayer._extraCircles = extra;
}

function clearSymbols() {
  if (symbolsLayer) {
    if (symbolsLayer._extraCircles) {
      symbolsLayer._extraCircles.forEach(l => MAP.removeLayer(l));
    }
    MAP.removeLayer(symbolsLayer);
    symbolsLayer = null;
  }
}

function fitToLayer() {
  if (!geojsonLayer) return;
  try {
    const bounds = geojsonLayer.getBounds();
    if (bounds.isValid()) MAP.fitBounds(bounds, { padding: [20, 20] });
  } catch(e) {}
}

function toggleScale(show) {
  if (show && !scaleControl) {
    scaleControl = L.control.scale({ position: 'bottomright', imperial: true }).addTo(MAP);
  } else if (!show && scaleControl) {
    MAP.removeControl(scaleControl);
    scaleControl = null;
  }
}

function exportMapPNG() {
  const mapEl = document.querySelector('.map-area');
  html2canvas(mapEl, { useCORS: true, allowTaint: false, scale: 2, backgroundColor: '#e8eaf0' })
    .then(canvas => {
      const a = document.createElement('a');
      a.download = 'epimap_export.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    })
    .catch(() => alert('Export failed — try white background (no basemap tiles).'));
}

function makeDraggable(el, handle) {
  let dragging = false, sx, sy, ol, ob;
  handle.addEventListener('mousedown', e => {
    dragging = true; sx = e.clientX; sy = e.clientY;
    const r = el.getBoundingClientRect();
    ol = r.left; ob = window.innerHeight - r.bottom;
    el.style.right = 'auto'; el.style.top = 'auto';
    el.style.left = ol + 'px'; el.style.bottom = ob + 'px';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    el.style.left   = (ol + e.clientX - sx) + 'px';
    el.style.bottom = (ob + sy - e.clientY) + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}
