// ══════════════════════════════════════════
// app.js  —  Main application logic
// ══════════════════════════════════════════

// ── State ─────────────────────────────────
const STATE = {
  geojson:       null,   // raw GeoJSON from shapefile
  csvData:       null,   // parsed CSV rows (array of objects)
  csvHeaders:    [],
  shpFields:     [],
  joinedData:    null,   // Map: shp feature index → joined row
  breaks:        [],
  colors:        [],
  choroVar:      null,
  symbolVar:     null,
  bivX:          null,
  bivY:          null,
  tooltipFields: [],
  mode:          'choropleth',  // 'choropleth' | 'bivariate'
};

// ── Boot ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  bindEvents();
  makeDraggable(document.getElementById('map-legend'), document.getElementById('legend-drag-handle'));
  renderPalettePreview('YlOrRd', false);
});

// ── Event Binding ─────────────────────────
function bindEvents() {
  // File inputs
  document.getElementById('input-shp').addEventListener('change', e => loadShapefile(e.target.files[0]));
  document.getElementById('input-csv').addEventListener('change', e => loadCSV(e.target.files[0]));

  // Drag & drop — shapefile
  setupDropZone('drop-shp', 'input-shp', loadShapefile);
  setupDropZone('drop-csv', 'input-csv', loadCSV);

  // Join
  document.getElementById('btn-join').addEventListener('click', performJoin);

  // Choropleth apply
  document.getElementById('btn-apply-choro').addEventListener('click', applyChoropleth);

  // Bivariate apply
  document.getElementById('btn-apply-biv').addEventListener('click', applyBivariate);

  // Classification scheme
  document.getElementById('sel-classification').addEventListener('change', e => {
    document.getElementById('manual-breaks-wrapper').style.display =
      e.target.value === 'manual' ? 'block' : 'none';
  });

  // Palette preview
  document.getElementById('sel-palette').addEventListener('change', () =>
    renderPalettePreview(document.getElementById('sel-palette').value,
                         document.getElementById('chk-reverse').checked));
  document.getElementById('chk-reverse').addEventListener('change', () =>
    renderPalettePreview(document.getElementById('sel-palette').value,
                         document.getElementById('chk-reverse').checked));

  // Range labels
  bindRange('range-classes',       'lbl-classes',       v => v);
  bindRange('range-opacity',       'lbl-opacity',       v => v + '%');
  bindRange('range-border',        'lbl-border',        v => v + 'px');
  bindRange('range-sym-size',      'lbl-sym-size',      v => v + 'px');
  bindRange('range-sym-opacity',   'lbl-sym-opacity',   v => v + '%');
  bindRange('range-title-size',    'lbl-title-size',    v => v + 'px');
  bindRange('range-subtitle-size', 'lbl-subtitle-size', v => v + 'px');

  // Annotation live updates
  document.getElementById('input-map-title').addEventListener('input', e => {
    document.getElementById('map-title-display').textContent = e.target.value || 'Map Title';
  });
  document.getElementById('input-map-subtitle').addEventListener('input', e => {
    document.getElementById('map-subtitle-display').textContent = e.target.value || '';
  });
  document.getElementById('range-title-size').addEventListener('input', e => {
    document.getElementById('map-title-display').style.fontSize = e.target.value + 'px';
  });
  document.getElementById('range-subtitle-size').addEventListener('input', e => {
    document.getElementById('map-subtitle-display').style.fontSize = e.target.value + 'px';
  });
  document.getElementById('pick-title-color').addEventListener('input', e => {
    document.getElementById('map-title-display').style.color = e.target.value;
    document.getElementById('map-subtitle-display').style.color = e.target.value;
  });

  // Map elements toggles
  document.getElementById('chk-legend').addEventListener('change', e => {
    document.getElementById('map-legend').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('chk-north').addEventListener('change', e => {
    document.getElementById('north-arrow').style.display = e.target.checked ? 'flex' : 'none';
  });
  document.getElementById('chk-scale').addEventListener('change', e => toggleScale(e.target.checked));
  document.getElementById('chk-inset').addEventListener('change', e => {
    document.getElementById('inset-map-box').style.display = e.target.checked ? 'block' : 'none';
    if (e.target.checked && INSET_MAP) setTimeout(() => INSET_MAP.invalidateSize(), 100);
  });
  document.getElementById('chk-symbols').addEventListener('change', e => {
    document.getElementById('symbols-options').style.display = e.target.checked ? 'block' : 'none';
    if (!e.target.checked) clearSymbols();
  });
  document.getElementById('chk-bivariate').addEventListener('change', e => {
    document.getElementById('bivariate-options').style.display = e.target.checked ? 'block' : 'none';
  });

  // Legend title
  document.getElementById('input-legend-title').addEventListener('input', e => {
    document.getElementById('legend-title-text').textContent = e.target.value || 'Legend';
  });

  // Legend close
  document.getElementById('btn-legend-close').addEventListener('click', () => {
    document.getElementById('map-legend').style.display = 'none';
    document.getElementById('chk-legend').checked = false;
  });

  // Basemap
  document.getElementById('sel-basemap').addEventListener('change', e => setBasemap(e.target.value));

  // Header buttons
  document.getElementById('btn-export').addEventListener('click', exportMapPNG);
  document.getElementById('btn-demo').addEventListener('click', loadDemoData);
  document.getElementById('btn-help').addEventListener('click', () =>
    document.getElementById('modal-help').style.display = 'flex');
  document.getElementById('btn-help-close').addEventListener('click', () =>
    document.getElementById('modal-help').style.display = 'none');
  document.getElementById('modal-help').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-help'))
      document.getElementById('modal-help').style.display = 'none';
  });
}

function bindRange(rangeId, labelId, fmt) {
  const el = document.getElementById(rangeId);
  const lbl = document.getElementById(labelId);
  if (!el || !lbl) return;
  el.addEventListener('input', e => lbl.textContent = fmt(e.target.value));
}

function setupDropZone(zoneId, inputId, loadFn) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) loadFn(file);
  });
  zone.addEventListener('click', () => document.getElementById(inputId).click());
}

// ── Shapefile Loading ─────────────────────
async function loadShapefile(file) {
  if (!file) return;
  setStatus('status-shp', `Reading ${file.name}…`, '');
  try {
    const buffer = await file.arrayBuffer();
    const geojson = await shp(buffer);

    // shpjs can return FeatureCollection or array of them
    if (Array.isArray(geojson)) {
      STATE.geojson = { type: 'FeatureCollection', features: geojson.flatMap(g => g.features || []) };
    } else {
      STATE.geojson = geojson;
    }

    const count = STATE.geojson.features.length;
    STATE.shpFields = count > 0 ? Object.keys(STATE.geojson.features[0].properties || {}) : [];

    setStatus('status-shp', `✓ ${file.name} — ${count} features, ${STATE.shpFields.length} fields`, 'ok');
    document.getElementById('drop-shp').classList.add('loaded');

    // Populate key field selector
    populateSelect('sel-shp-key', STATE.shpFields);

    // Quick render with no data (grey fill)
    renderPlainMap();

    checkShowJoinSection();
  } catch(err) {
    setStatus('status-shp', `Error: ${err.message}`, 'err');
    console.error(err);
  }
}

// ── CSV Loading ───────────────────────────
function loadCSV(file) {
  if (!file) return;
  setStatus('status-csv', `Reading ${file.name}…`, '');
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: result => {
      STATE.csvData    = result.data;
      STATE.csvHeaders = result.meta.fields || [];
      setStatus('status-csv', `✓ ${file.name} — ${STATE.csvData.length} rows, ${STATE.csvHeaders.length} cols`, 'ok');
      document.getElementById('drop-csv').classList.add('loaded');
      populateSelect('sel-csv-key', STATE.csvHeaders);
      checkShowJoinSection();
    },
    error: err => setStatus('status-csv', `Error: ${err.message}`, 'err')
  });
}

function checkShowJoinSection() {
  if (STATE.geojson && STATE.csvData) {
    document.getElementById('section-join').style.display = 'block';
  }
}

// ── Join ──────────────────────────────────
function performJoin() {
  const shpKey = document.getElementById('sel-shp-key').value;
  const csvKey = document.getElementById('sel-csv-key').value;

  if (!shpKey || !csvKey) {
    setStatus('status-join', 'Select join keys', 'err'); return;
  }

  // Build lookup from CSV
  const lookup = new Map();
  STATE.csvData.forEach(row => {
    const k = String(row[csvKey]).trim();
    lookup.set(k, row);
  });

  let matched = 0;
  STATE.geojson.features.forEach(f => {
    const shpVal = String((f.properties || {})[shpKey] || '').trim();
    if (lookup.has(shpVal)) {
      f.properties = { ...f.properties, ...lookup.get(shpVal) };
      matched++;
    }
  });

  const numericFields = STATE.csvHeaders.filter(h => h !== csvKey && isNumericField(h));
  setStatus('status-join', `✓ Joined ${matched}/${STATE.geojson.features.length} features`, matched > 0 ? 'ok' : 'err');

  if (matched > 0) {
    // Populate variable selectors
    populateSelect('sel-choro-var', numericFields);
    populateSelect('sel-symbol-var', numericFields);
    populateSelect('sel-biv-x', numericFields);
    populateSelect('sel-biv-y', numericFields.length > 1 ? numericFields.slice(1) : numericFields);

    // Populate tooltip fields
    const allFields = STATE.csvHeaders.filter(h => h !== csvKey);
    renderTooltipFields(allFields);

    // Show panels
    document.getElementById('section-choropleth').style.display = 'block';
    document.getElementById('section-symbols').style.display    = 'block';
    document.getElementById('section-bivariate').style.display  = 'block';
    document.getElementById('section-tooltip').style.display    = 'block';
    document.getElementById('section-summary').style.display    = 'block';

    // Auto-pick first numeric and render summary
    if (numericFields.length > 0) {
      STATE.choroVar = numericFields[0];
      renderDataSummary(numericFields[0]);
    }
  }
}

function isNumericField(field) {
  if (!STATE.csvData) return false;
  return STATE.csvData.slice(0, 10).some(row => !isNaN(parseFloat(row[field])));
}

// ── Choropleth ────────────────────────────
function applyChoropleth() {
  const varName = document.getElementById('sel-choro-var').value;
  const method  = document.getElementById('sel-classification').value;
  const nClass  = parseInt(document.getElementById('range-classes').value);
  const palette = document.getElementById('sel-palette').value;
  const reverse = document.getElementById('chk-reverse').checked;
  const opacity = parseInt(document.getElementById('range-opacity').value) / 100;
  const borderColor = document.getElementById('pick-border').value;
  const borderWidth = parseFloat(document.getElementById('range-border').value);

  if (!STATE.geojson || !varName) return;

  // Extract values
  const values = STATE.geojson.features.map(f => parseFloat((f.properties || {})[varName]));
  const validVals = values.filter(v => !isNaN(v));

  // Manual breaks
  let manualBreaks = [];
  if (method === 'manual') {
    manualBreaks = document.getElementById('input-manual-breaks').value.split(',').map(v => parseFloat(v.trim()));
  }

  const breaks = classify(validVals, nClass, method, manualBreaks);
  const colors = getPaletteColors(palette, breaks.length - 1, reverse);
  STATE.breaks = breaks;
  STATE.colors = colors;
  STATE.choroVar = varName;
  STATE.mode = 'choropleth';

  const styleFn = feature => {
    const val = parseFloat((feature.properties || {})[varName]);
    const cls = getClass(val, breaks);
    return {
      fillColor:   cls >= 0 ? colors[cls] : '#cccccc',
      fillOpacity: cls >= 0 ? opacity      : 0.3,
      color:       borderColor,
      weight:      borderWidth,
    };
  };

  renderChoropleth(STATE.geojson, null, styleFn, buildPopupFn());

  // Apply symbols if enabled
  if (document.getElementById('chk-symbols').checked) {
    applySymbols();
  }

  renderLegendChoropleth(breaks, colors, varName);
  document.getElementById('map-legend').style.display =
    document.getElementById('chk-legend').checked ? 'block' : 'none';

  renderDataSummary(varName);
}

// ── Proportional Symbols ──────────────────
function applySymbols() {
  const varName  = document.getElementById('sel-symbol-var').value;
  const maxR     = parseInt(document.getElementById('range-sym-size').value);
  const symColor = document.getElementById('pick-sym-color').value;
  const opacity  = parseInt(document.getElementById('range-sym-opacity').value) / 100;

  if (!STATE.geojson || !varName) return;

  const values = STATE.geojson.features.map(f => parseFloat((f.properties || {})[varName]));
  const maxVal = Math.max(...values.filter(v => !isNaN(v)));

  renderSymbols(
    STATE.geojson,
    feature => {
      const v = parseFloat((feature.properties || {})[varName]);
      if (isNaN(v) || v <= 0) return 0;
      return Math.sqrt(v / maxVal) * maxR;
    },
    () => symColor,
    () => opacity,
    buildPopupFn()
  );
}

// ── Bivariate Choropleth ──────────────────
function applyBivariate() {
  const xVar   = document.getElementById('sel-biv-x').value;
  const yVar   = document.getElementById('sel-biv-y').value;
  const scheme = document.getElementById('sel-biv-scheme').value;

  if (!STATE.geojson || !xVar || !yVar) return;

  const bivColors = PALETTES['_biv_' + scheme];
  if (!bivColors) return;

  const xVals = STATE.geojson.features.map(f => parseFloat((f.properties||{})[xVar])).filter(v => !isNaN(v));
  const yVals = STATE.geojson.features.map(f => parseFloat((f.properties||{})[yVar])).filter(v => !isNaN(v));

  const xBreaks = quantileBreaks([...xVals].sort((a,b)=>a-b), 3);
  const yBreaks = quantileBreaks([...yVals].sort((a,b)=>a-b), 3);

  STATE.mode = 'bivariate';
  STATE.bivX = xVar;
  STATE.bivY = yVar;

  const styleFn = feature => {
    const xv = parseFloat((feature.properties||{})[xVar]);
    const yv = parseFloat((feature.properties||{})[yVar]);
    const xi = Math.min(getClass(xv, xBreaks), 2);
    const yi = Math.min(getClass(yv, yBreaks), 2);
    if (xi < 0 || yi < 0) return { fillColor: '#ccc', fillOpacity: 0.5, color: '#fff', weight: 0.5 };
    const colorIdx = yi * 3 + xi;
    return { fillColor: bivColors[colorIdx], fillOpacity: 0.85, color: '#fff', weight: 0.5 };
  };

  renderChoropleth(STATE.geojson, null, styleFn, buildPopupFn());
  renderLegendBivariate(bivColors, xVar, yVar);
  document.getElementById('map-legend').style.display =
    document.getElementById('chk-legend').checked ? 'block' : 'none';
}

// ── Plain map (no data) ───────────────────
function renderPlainMap() {
  if (!STATE.geojson) return;
  const styleFn = () => ({ fillColor: '#b0bec5', fillOpacity: 0.6, color: '#fff', weight: 0.8 });
  renderChoropleth(STATE.geojson, null, styleFn, buildPopupFn());
}

// ── Popup builder ─────────────────────────
function buildPopupFn() {
  return feature => {
    const props = feature.properties || {};
    const fields = STATE.tooltipFields.length > 0 ? STATE.tooltipFields : Object.keys(props).slice(0, 6);

    // Find a good title field
    const titleField = ['name','NAME','Name','state','STATE','county','COUNTY','region']
      .find(f => props[f]) || Object.keys(props)[0];

    let html = `<div class="popup-title">${props[titleField] || 'Feature'}</div>`;
    fields.forEach(f => {
      if (f === titleField) return;
      const val = props[f];
      if (val === undefined || val === null || val === '') return;
      const numVal = parseFloat(val);
      const display = !isNaN(numVal) ? numVal.toLocaleString() : val;
      html += `<div class="popup-row"><span class="popup-key">${f}</span><span class="popup-val">${display}</span></div>`;
    });
    return html;
  };
}

// ── Legend Renderers ──────────────────────
function renderLegendChoropleth(breaks, colors, varName) {
  const body = document.getElementById('legend-body');
  body.innerHTML = '';

  for (let i = 0; i < colors.length; i++) {
    const lo = fmtBreak(breaks[i]);
    const hi = fmtBreak(breaks[i+1]);
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <div class="legend-swatch" style="background:${colors[i]}"></div>
      <span>${lo} – ${hi}</span>`;
    body.appendChild(item);
  }

  // No-data item
  const nd = document.createElement('div');
  nd.className = 'legend-item';
  nd.innerHTML = `<div class="legend-swatch" style="background:#cccccc;opacity:0.5"></div><span>No data</span>`;
  body.appendChild(nd);

  document.getElementById('legend-title-text').textContent =
    document.getElementById('input-legend-title').value || varName;
}

function renderLegendBivariate(bivColors, xVar, yVar) {
  const body = document.getElementById('legend-body');
  body.innerHTML = `
    <div class="biv-legend-grid">
      ${bivColors.map(c => `<div class="biv-cell" style="background:${c}"></div>`).join('')}
    </div>
    <div class="biv-axis-labels">
      <span>← low ${xVar}</span><span>high →</span>
    </div>
    <div style="font-size:9px;color:#777;margin-top:4px">↑ high ${yVar}<br>↓ low</div>
  `;
  document.getElementById('legend-title-text').textContent = 'Bivariate';
}

// ── Tooltip field checkboxes ──────────────
function renderTooltipFields(fields) {
  const container = document.getElementById('tooltip-fields-list');
  container.innerHTML = '';
  STATE.tooltipFields = [];

  fields.slice(0, 12).forEach(f => {
    const label = document.createElement('label');
    label.className = 'tooltip-field-item';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = false;
    chk.addEventListener('change', () => {
      if (chk.checked) STATE.tooltipFields.push(f);
      else STATE.tooltipFields = STATE.tooltipFields.filter(x => x !== f);
    });
    label.appendChild(chk);
    label.appendChild(document.createTextNode(f));
    container.appendChild(label);
  });
}

// ── Data Summary ──────────────────────────
function renderDataSummary(varName) {
  if (!STATE.geojson || !varName) return;
  const values = STATE.geojson.features
    .map(f => parseFloat((f.properties || {})[varName]))
    .filter(v => !isNaN(v));
  if (values.length === 0) return;

  const sorted = [...values].sort((a,b) => a-b);
  const mean   = values.reduce((a,b) => a+b, 0) / values.length;
  const median = sorted[Math.floor(sorted.length/2)];
  const std    = Math.sqrt(values.reduce((a,b) => a+(b-mean)**2, 0) / values.length);

  const rows = [
    ['Variable', varName],
    ['N',        values.length],
    ['Min',      fmtBreak(sorted[0])],
    ['Max',      fmtBreak(sorted[sorted.length-1])],
    ['Mean',     fmtBreak(mean)],
    ['Median',   fmtBreak(median)],
    ['Std Dev',  fmtBreak(std)],
  ];

  const body = document.getElementById('data-summary-body');
  body.innerHTML = rows.map(([k,v]) =>
    `<div class="summary-row"><span class="summary-key">${k}</span><span class="summary-val">${v}</span></div>`
  ).join('');
}

// ── Populate select ───────────────────────
function populateSelect(id, options) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join('');
}

// ── Status helper ─────────────────────────
function setStatus(id, msg, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'upload-status' + (cls ? ' ' + cls : '');
}

// ══════════════════════════════════════════
// DEMO DATA  —  US States health indicators
// ══════════════════════════════════════════
async function loadDemoData() {
  setStatus('status-shp', 'Loading demo shapefile…', '');
  setStatus('status-csv', 'Loading demo data…', '');

  try {
    // Fetch built-in US states GeoJSON from a public CDN
    const resp = await fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json');
    if (!resp.ok) throw new Error('Network error fetching demo shapefile');
    const geojson = await resp.json();

    STATE.geojson = geojson;
    STATE.shpFields = geojson.features.length > 0 ? Object.keys(geojson.features[0].properties) : [];

    setStatus('status-shp', `✓ Demo: US States — ${geojson.features.length} features`, 'ok');
    document.getElementById('drop-shp').classList.add('loaded');

    // Demo CSV: synthetic state-level public health indicators
    const demoCSV = generateDemoCSV();
    STATE.csvData    = demoCSV;
    STATE.csvHeaders = Object.keys(demoCSV[0]);
    setStatus('status-csv', `✓ Demo: US State Health Data — ${demoCSV.length} rows`, 'ok');
    document.getElementById('drop-csv').classList.add('loaded');

    // Auto-join on state name
    populateSelect('sel-shp-key', STATE.shpFields);
    populateSelect('sel-csv-key', STATE.csvHeaders);
    document.getElementById('sel-shp-key').value = 'name';
    document.getElementById('sel-csv-key').value = 'state';
    document.getElementById('section-join').style.display = 'block';

    performJoin();

    // Auto-apply choropleth
    document.getElementById('sel-choro-var').value = 'mortality_rate';
    document.getElementById('sel-classification').value = 'jenks';
    document.getElementById('range-classes').value = 5;
    document.getElementById('lbl-classes').textContent = '5';
    document.getElementById('sel-palette').value = 'YlOrRd';
    document.getElementById('input-map-title').value = 'US State Mortality Rates (Demo)';
    document.getElementById('map-title-display').textContent = 'US State Mortality Rates (Demo)';
    document.getElementById('input-map-subtitle').value = 'Synthetic demo data • EpiMap';
    document.getElementById('map-subtitle-display').textContent = 'Synthetic demo data • EpiMap';
    document.getElementById('input-legend-title').value = 'Deaths per 100k';
    renderPalettePreview('YlOrRd', false);
    applyChoropleth();

  } catch(err) {
    setStatus('status-shp', `Demo error: ${err.message}`, 'err');
    console.error(err);
  }
}

function generateDemoCSV() {
  const states = [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
    'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
    'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
    'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
    'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
    'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
    'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
    'Wisconsin','Wyoming'
  ];

  // Seed-based deterministic pseudo-random for reproducibility
  const rng = seed => { let s = seed; return () => { s ^= s<<13; s ^= s>>17; s ^= s<<5; return (s>>>0)/4294967296; }; };
  const r = rng(42);

  return states.map(state => {
    const base = 200 + r() * 400;
    return {
      state:           state,
      mortality_rate:  parseFloat((base).toFixed(1)),
      incidence_rate:  parseFloat((base * 2.2 + r()*200).toFixed(1)),
      pct_uninsured:   parseFloat((3 + r()*18).toFixed(1)),
      poverty_pct:     parseFloat((7 + r()*18).toFixed(1)),
      pop_density:     parseFloat((10 + r()*900).toFixed(1)),
      median_income:   Math.round(35000 + r()*45000),
    };
  });
}
