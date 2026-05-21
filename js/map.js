// ══════════════════════════════════════════
// map.js  —  Leaflet map setup & layer control
// ══════════════════════════════════════════

let MAP, INSET_MAP;
let baseLayer = null;
let insetBaseLayer = null;
let geojsonLayer = null;
let symbolsLayer = null;
let scaleControl = null;

const BASEMAPS = {
  'none':       null,
  'osm':        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  'carto-light':'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  'carto-dark': 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  'esri-topo':  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
};

const BASEMAP_ATTR = {
  'osm':        '© OpenStreetMap contributors',
  'carto-light':'© CARTO, © OpenStreetMap contributors',
  'carto-dark': '© CARTO, © OpenStreetMap contributors',
  'esri-topo':  '© Esri, © OpenStreetMap contributors'
};

function initMap() {
  MAP = L.map('map', {
    center: [20, 0],
    zoom: 2,
    zoomControl: true,
    attributionControl: true
  });

  // Default: white background (no tile layer)
  MAP.getContainer().style.background = '#e8eaf0';

  // Scale bar (metric + imperial)
  scaleControl = L.control.scale({ position: 'bottomright', imperial: true }).addTo(MAP);

  // Inset map (hidden by default)
  INSET_MAP = L.map('inset-map', {
    center: [20, 0],
    zoom: 0,
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false
  });

  // Sync inset with main
  MAP.on('moveend zoomend', () => {
    if (INSET_MAP) {
      INSET_MAP.setView(MAP.getCenter(), Math.max(0, MAP.getZoom() - 4));
    }
  });
}

function setBasemap(key) {
  if (baseLayer) { MAP.removeLayer(baseLayer); baseLayer = null; }
  if (insetBaseLayer) { INSET_MAP.removeLayer(insetBaseLayer); insetBaseLayer = null; }

  if (key === 'none') {
    MAP.getContainer().style.background = '#e8eaf0';
    INSET_MAP.getContainer().style.background = '#e8eaf0';
    return;
  }

  const url  = BASEMAPS[key];
  const attr = BASEMAP_ATTR[key] || '';
  if (!url) return;

  MAP.getContainer().style.background = '';
  baseLayer = L.tileLayer(url, { attribution: attr, maxZoom: 19 }).addTo(MAP);
  insetBaseLayer = L.tileLayer(url, { attribution: '', maxZoom: 6 }).addTo(INSET_MAP);
}

// ── GeoJSON choropleth layer ──────────────
function renderChoropleth(geojson, colorFn, styleFn, popupFn) {
  if (geojsonLayer) { MAP.removeLayer(geojsonLayer); geojsonLayer = null; }
  if (!geojson) return;

  geojsonLayer = L.geoJSON(geojson, {
    style: styleFn,
    onEachFeature: (feature, layer) => {
      layer.on({
        mouseover: highlightFeature,
        mouseout:  resetHighlight,
        click:     (e) => {
          const popup = popupFn(feature);
          if (popup) layer.bindPopup(popup).openPopup(e.latlng);
        }
      });
    }
  }).addTo(MAP);

  fitToLayer();
}

function highlightFeature(e) {
  const layer = e.target;
  layer.setStyle({ weight: 2.5, color: '#333', fillOpacity: 0.95 });
  layer.bringToFront();
}

function resetHighlight(e) {
  if (geojsonLayer) geojsonLayer.resetStyle(e.target);
}

// ── Proportional symbols layer ────────────
function renderSymbols(geojson, sizeFn, colorFn, opacityFn, popupFn) {
  if (symbolsLayer) { MAP.removeLayer(symbolsLayer); symbolsLayer = null; }
  if (!geojson) return;

  symbolsLayer = L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => {
      const r = sizeFn(feature);
      if (r <= 0) return null;
      return L.circleMarker(latlng, {
        radius: r,
        fillColor: colorFn(feature),
        color: 'rgba(0,0,0,0.3)',
        weight: 1,
        fillOpacity: opacityFn()
      });
    },
    filter: feature => {
      if (!feature.geometry) return false;
      if (feature.geometry.type === 'Point' || feature.geometry.type === 'MultiPoint') return true;
      return false; // for polygon features, we'll use centroid approach
    },
    onEachFeature: (feature, layer) => {
      if (!layer) return;
      layer.on('click', (e) => {
        const popup = popupFn(feature);
        if (popup) layer.bindPopup(popup).openPopup(e.latlng);
      });
    }
  });

  // For polygon centroids: add circle markers at centroid
  if (geojson && geojson.features) {
    geojson.features.forEach(feature => {
      if (!feature.geometry) return;
      const type = feature.geometry.type;
      if (type === 'Polygon' || type === 'MultiPolygon') {
        const r = sizeFn(feature);
        if (r <= 0) return;
        try {
          const layer2 = L.geoJSON(feature);
          const bounds = layer2.getBounds();
          const center = bounds.getCenter();
          const circle = L.circleMarker(center, {
            radius: r,
            fillColor: colorFn(feature),
            color: 'rgba(0,0,0,0.3)',
            weight: 1,
            fillOpacity: opacityFn()
          });
          circle.on('click', (e) => {
            const popup = popupFn(feature);
            if (popup) circle.bindPopup(popup).openPopup(e.latlng);
          });
          circle.addTo(MAP);
          // store reference so we can clear later
          if (!symbolsLayer._extraLayers) symbolsLayer._extraLayers = [];
          symbolsLayer._extraLayers.push(circle);
        } catch(err) {}
      }
    });
  }

  symbolsLayer.addTo(MAP);
}

function clearSymbols() {
  if (symbolsLayer) {
    if (symbolsLayer._extraLayers) {
      symbolsLayer._extraLayers.forEach(l => MAP.removeLayer(l));
    }
    MAP.removeLayer(symbolsLayer);
    symbolsLayer = null;
  }
}

// ── Fit to GeoJSON bounds ─────────────────
function fitToLayer() {
  if (!geojsonLayer) return;
  try {
    const bounds = geojsonLayer.getBounds();
    if (bounds.isValid()) MAP.fitBounds(bounds, { padding: [20, 20] });
  } catch(e) {}
}

// ── Scale bar toggle ──────────────────────
function toggleScale(show) {
  if (show && !scaleControl) {
    scaleControl = L.control.scale({ position: 'bottomright', imperial: true }).addTo(MAP);
  } else if (!show && scaleControl) {
    MAP.removeControl(scaleControl);
    scaleControl = null;
  }
}

// ── Export PNG ────────────────────────────
function exportMapPNG() {
  const mapEl = document.querySelector('.map-area');
  html2canvas(mapEl, {
    useCORS: true,
    allowTaint: false,
    scale: 2,
    backgroundColor: '#e8eaf0'
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = 'epimap_export.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }).catch(err => {
    alert('Export failed. Try a different basemap (tiles may block CORS). White background works best.');
  });
}

// ── Make legend draggable ─────────────────
function makeDraggable(el, handle) {
  let isDragging = false, startX, startY, origLeft, origBottom;

  handle.addEventListener('mousedown', e => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = el.getBoundingClientRect();
    origLeft   = rect.left;
    origBottom = window.innerHeight - rect.bottom;
    el.style.right = 'auto';
    el.style.top   = 'auto';
    el.style.left  = origLeft + 'px';
    el.style.bottom = origBottom + 'px';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = startY - e.clientY; // inverted because bottom
    el.style.left   = (origLeft + dx) + 'px';
    el.style.bottom = (origBottom + dy) + 'px';
  });

  document.addEventListener('mouseup', () => { isDragging = false; });
}
