// ══════════════════════════════════════════
// app.js  —  Main application logic
// v2 — smart aggregation, attribute table,
//       hover-flicker fix, granular CSV detect
// ══════════════════════════════════════════

// ── State ─────────────────────────────────
const STATE = {
  geojson:        null,
  csvData:        null,
  csvHeaders:     [],
  shpFields:      [],
  breaks:         [],
  colors:         [],
  choroVar:       null,
  symbolVar:      null,
  bivX:           null,
  bivY:           null,
  tooltipFields:  [],
  mode:           'choropleth',
  isGranular:     false,   // true = long/granular CSV detected
  catCols:        [],      // detected categorical columns
  numCols:        [],      // detected numeric columns
  aggData:        null,    // aggregated data map: joinKey → {col: value}
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
  document.getElementById('input-shp').addEventListener('change', e => loadShapefile(e.target.files[0]));
  document.getElementById('input-csv').addEventListener('change', e => loadCSV(e.target.files[0]));
  setupDropZone('drop-shp', 'input-shp', loadShapefile);
  setupDropZone('drop-csv', 'input-csv', loadCSV);

  document.getElementById('btn-join').addEventListener('click', performJoin);
  document.getElementById('btn-apply-choro').addEventListener('click', applyChoropleth);
  document.getElementById('btn-apply-biv').addEventListener('click', applyBivariate);
  document.getElementById('btn-apply-agg').addEventListener('click', applyAggregation);

  // Attribute table
  document.getElementById('btn-attr-table').addEventListener('click', showAttributeTable);
  document.getElementById('btn-attr-table-close').addEventListener('click', () =>
    document.getElementById('modal-attr-table').style.display = 'none');
  document.getElementById('modal-attr-table').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-attr-table'))
      document.getElementById('modal-attr-table').style.display = 'none';
  });

  // Age range sliders sync
  document.getElementById('range-age-min').addEventListener('input', e => {
    document.getElementById('lbl-age-min').textContent = e.target.value;
    if (parseInt(e.target.value) > parseInt(document.getElementById('range-age-max').value))
      document.getElementById('range-age-max').value = e.target.value;
    document.getElementById('lbl-age-max').textContent = document.getElementById('range-age-max').value;
  });
  document.getElementById('range-age-max').addEventListener('input', e => {
    document.getElementById('lbl-age-max').textContent = e.target.value;
    if (parseInt(e.target.value) < parseInt(document.getElementById('range-age-min').value))
      document.getElementById('range-age-min').value = e.target.value;
    document.getElementById('lbl-age-min').textContent = document.getElementById('range-age-min').value;
  });

  // Classification manual breaks
  document.getElementById('sel-classification').addEventListener('change', e => {
    document.getElementById('manual-breaks-wrapper').style.display =
      e.target.value === 'manual' ? 'block' : 'none';
  });

  // Palette
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

  // Annotations
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

  // Map element toggles
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

  document.getElementById('input-legend-title').addEventListener('input', e => {
    document.getElementById('legend-title-text').textContent = e.target.value || 'Legend';
  });
  document.getElementById('btn-legend-close').addEventListener('click', () => {
    document.getElementById('map-legend').style.display = 'none';
    document.getElementById('chk-legend').checked = false;
  });

  document.getElementById('sel-basemap').addEventListener('change', e => setBasemap(e.target.value));
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

// ══════════════════════════════════════════
// SHAPEFILE LOADING
// ══════════════════════════════════════════
async function loadShapefile(file) {
  if (!file) return;
  setStatus('status-shp', `Reading ${file.name}…`, '');
  try {
    const buffer = await file.arrayBuffer();
    const geojson = await shp(buffer);
    STATE.geojson = Array.isArray(geojson)
      ? { type: 'FeatureCollection', features: geojson.flatMap(g => g.features || []) }
      : geojson;

    const count = STATE.geojson.features.length;
    STATE.shpFields = count > 0 ? Object.keys(STATE.geojson.features[0].properties || {}) : [];

    setStatus('status-shp', `✓ ${file.name} — ${count} features, ${STATE.shpFields.length} fields`, 'ok');
    document.getElementById('drop-shp').classList.add('loaded');
    document.getElementById('btn-attr-table').style.display = 'inline-block';
    populateSelect('sel-shp-key', STATE.shpFields);
    renderPlainMap();
    checkShowJoinSection();
  } catch(err) {
    setStatus('status-shp', `Error: ${err.message}`, 'err');
    console.error(err);
  }
}

// ══════════════════════════════════════════
// CSV LOADING + GRANULARITY DETECTION
// ══════════════════════════════════════════
function loadCSV(file) {
  if (!file) return;
  setStatus('status-csv', `Reading ${file.name}…`, '');
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    complete: result => {
      STATE.csvData    = result.data;
      STATE.csvHeaders = result.meta.fields || [];

      // Classify columns as categorical vs numeric
      STATE.numCols = STATE.csvHeaders.filter(h => isNumericCol(h));
      STATE.catCols = STATE.csvHeaders.filter(h => !isNumericCol(h));

      setStatus('status-csv', `✓ ${file.name} — ${STATE.csvData.length} rows, ${STATE.csvHeaders.length} cols`, 'ok');
      document.getElementById('drop-csv').classList.add('loaded');
      populateSelect('sel-csv-key', STATE.csvHeaders);
      checkShowJoinSection();
    },
    error: err => setStatus('status-csv', `Error: ${err.message}`, 'err')
  });
}

function isNumericCol(field) {
  if (!STATE.csvData) return false;
  const sample = STATE.csvData.slice(0, 20).map(r => r[field]).filter(v => v !== null && v !== '');
  const numCount = sample.filter(v => !isNaN(parseFloat(v))).length;
  return numCount > sample.length * 0.7;
}

function checkShowJoinSection() {
  if (STATE.geojson && STATE.csvData) {
    document.getElementById('section-join').style.display = 'block';
  }
}

// ══════════════════════════════════════════
// GRANULARITY DETECTION & AGGREGATION UI
// ══════════════════════════════════════════
function detectGranularity(joinKey) {
  // Count how many CSV rows share the same join key value
  const keyCounts = new Map();
  STATE.csvData.forEach(row => {
    const k = String(row[joinKey] || '').trim();
    keyCounts.set(k, (keyCounts.get(k) || 0) + 1);
  });
  const vals = [...keyCounts.values()];
  const avgDupes = vals.reduce((a,b) => a+b, 0) / vals.length;
  return avgDupes > 1.5; // if avg >1.5 rows per key, it's granular
}

function showAggPanel(joinKey) {
  document.getElementById('section-agg').style.display = 'block';
  document.getElementById('agg-warning').textContent =
    `⚠ Granular data detected — multiple rows per "${joinKey}". Configure aggregation below before joining.`;

  // Populate categorical filter selectors
  const catCols = STATE.catCols.filter(c => c !== joinKey);
  const filterContainer = document.getElementById('agg-filters');
  filterContainer.innerHTML = '';

  catCols.forEach(col => {
    const uniqueVals = [...new Set(STATE.csvData.map(r => String(r[col] || '')).filter(v => v !== ''))].sort();

    // Detect if this column looks like age (numeric-ish col named age/Age)
    const isAgeLike = /age/i.test(col) && isNumericCol(col);

    if (isAgeLike) {
      // Show age range slider instead
      const allAges = STATE.csvData.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
      const minAge  = Math.min(...allAges);
      const maxAge  = Math.max(...allAges);
      document.getElementById('agg-age-section').style.display = 'block';
      document.getElementById('agg-age-col').value = col;
      document.getElementById('range-age-min').min = minAge;
      document.getElementById('range-age-min').max = maxAge;
      document.getElementById('range-age-min').value = minAge;
      document.getElementById('lbl-age-min').textContent = minAge;
      document.getElementById('range-age-max').min = minAge;
      document.getElementById('range-age-max').max = maxAge;
      document.getElementById('range-age-max').value = maxAge;
      document.getElementById('lbl-age-max').textContent = maxAge;
      return;
    }

    // Categorical filter dropdown
    const wrap = document.createElement('div');
    wrap.style.marginBottom = '8px';
    wrap.innerHTML = `<label class="field-label">${col} <span style="color:var(--text-muted);font-size:9px">(filter, optional)</span></label>`;
    const sel = document.createElement('select');
    sel.className = 'field-select';
    sel.id = `agg-cat-${col}`;
    sel.multiple = true;
    sel.size = Math.min(uniqueVals.length, 4);
    sel.style.height = 'auto';
    uniqueVals.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      sel.appendChild(opt);
    });
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:9px;color:var(--text-muted);margin-top:2px';
    hint.textContent = 'Hold Ctrl/Cmd to select multiple. Leave all unselected = include all.';
    wrap.appendChild(sel);
    wrap.appendChild(hint);
    filterContainer.appendChild(wrap);
  });

  // Populate agg variable selector (numeric cols only)
  populateSelect('sel-agg-var', STATE.numCols);
}

// ══════════════════════════════════════════
// AGGREGATION
// ══════════════════════════════════════════
function applyAggregation() {
  const joinKey  = document.getElementById('sel-csv-key').value;
  const aggVar   = document.getElementById('sel-agg-var').value;
  const aggFn    = document.getElementById('sel-agg-fn').value;

  if (!joinKey || !aggVar) {
    setStatus('status-join', 'Select join key and variable', 'err'); return;
  }

  // Build filters
  let rows = [...STATE.csvData];

  // Age filter
  const ageColEl = document.getElementById('agg-age-col');
  const ageCol   = ageColEl ? ageColEl.value : '';
  if (ageCol && document.getElementById('agg-age-section').style.display !== 'none') {
    const ageMin = parseFloat(document.getElementById('range-age-min').value);
    const ageMax = parseFloat(document.getElementById('range-age-max').value);
    rows = rows.filter(r => {
      const a = parseFloat(r[ageCol]);
      return !isNaN(a) && a >= ageMin && a <= ageMax;
    });
  }

  // Categorical filters
  const catCols = STATE.catCols.filter(c => c !== joinKey);
  catCols.forEach(col => {
    const sel = document.getElementById(`agg-cat-${col}`);
    if (!sel) return;
    const selected = [...sel.selectedOptions].map(o => o.value);
    if (selected.length > 0) {
      rows = rows.filter(r => selected.includes(String(r[col] || '')));
    }
  });

  // Group by join key and aggregate
  const groups = new Map();
  rows.forEach(row => {
    const k = String(row[joinKey] || '').trim();
    if (!groups.has(k)) groups.set(k, []);
    const v = parseFloat(row[aggVar]);
    if (!isNaN(v)) groups.get(k).push(v);
  });

  const aggregated = new Map();
  groups.forEach((vals, k) => {
    let result;
    switch(aggFn) {
      case 'sum':    result = vals.reduce((a,b) => a+b, 0); break;
      case 'mean':   result = vals.reduce((a,b) => a+b, 0) / vals.length; break;
      case 'median': const s = [...vals].sort((a,b)=>a-b); result = s[Math.floor(s.length/2)]; break;
      case 'count':  result = vals.length; break;
      case 'max':    result = Math.max(...vals); break;
      case 'min':    result = Math.min(...vals); break;
      default:       result = vals.reduce((a,b) => a+b, 0);
    }
    aggregated.set(k, result);
  });

  STATE.aggData = aggregated;
  const aggColName = `${aggFn}(${aggVar})`;

  // Inject aggregated values back into geojson features
  const shpKey = document.getElementById('sel-shp-key').value;
  let matched = 0;
  STATE.geojson.features.forEach(f => {
    const k = String((f.properties || {})[shpKey] || '').trim();
    if (aggregated.has(k)) {
      f.properties[aggColName] = parseFloat(aggregated.get(k).toFixed(4));
      matched++;
    } else {
      f.properties[aggColName] = null;
    }
  });

  const filterDesc = buildFilterDescription(ageCol, catCols);
  setStatus('status-join',
    `✓ Aggregated: ${aggFn}(${aggVar}) for ${matched}/${STATE.geojson.features.length} features${filterDesc}`, 'ok');

  // Expose the new column for choropleth
  const existingNums = STATE.numCols.map(c => `${aggFn}(${c})`);
  const allAggCols = [...new Set([
    aggColName,
    ...STATE.geojson.features.flatMap(f =>
      Object.keys(f.properties).filter(k => k.includes('('))
    )
  ])];

  populateSelect('sel-choro-var', allAggCols);
  populateSelect('sel-symbol-var', allAggCols);
  populateSelect('sel-biv-x', allAggCols);
  populateSelect('sel-biv-y', allAggCols);

  // Also populate tooltip with all feature properties
  const allProps = STATE.geojson.features.length > 0
    ? Object.keys(STATE.geojson.features[0].properties)
    : [];
  renderTooltipFields(allProps);

  // Show mapping panels
  document.getElementById('section-choropleth').style.display = 'block';
  document.getElementById('section-symbols').style.display    = 'block';
  document.getElementById('section-bivariate').style.display  = 'block';
  document.getElementById('section-tooltip').style.display    = 'block';
  document.getElementById('section-summary').style.display    = 'block';

  renderDataSummary(aggColName);
}

function buildFilterDescription(ageCol, catCols) {
  const parts = [];
  if (ageCol && document.getElementById('agg-age-section').style.display !== 'none') {
    const lo = document.getElementById('range-age-min').value;
    const hi = document.getElementById('range-age-max').value;
    parts.push(`age ${lo}–${hi}`);
  }
  catCols.forEach(col => {
    const sel = document.getElementById(`agg-cat-${col}`);
    if (!sel) return;
    const selected = [...sel.selectedOptions].map(o => o.value);
    if (selected.length > 0) parts.push(`${col}=${selected.join('/')}`);
  });
  return parts.length > 0 ? ` [${parts.join(', ')}]` : '';
}

// ══════════════════════════════════════════
// JOIN (pre-aggregated / wide format)
// ══════════════════════════════════════════
function performJoin() {
  const shpKey = document.getElementById('sel-shp-key').value;
  const csvKey = document.getElementById('sel-csv-key').value;
  if (!shpKey || !csvKey) { setStatus('status-join', 'Select join keys', 'err'); return; }

  // Detect granularity FIRST
  const granular = detectGranularity(csvKey);
  STATE.isGranular = granular;

  if (granular) {
    showAggPanel(csvKey);
    setStatus('status-join', `⚠ Granular CSV detected. Set aggregation options and click "Aggregate & Join".`, '');
    return;
  }

  // Pre-aggregated / wide format — direct join
  const lookup = new Map();
  STATE.csvData.forEach(row => {
    const k = String(row[csvKey] || '').trim();
    if (!lookup.has(k)) lookup.set(k, row); // take first row per key
  });

  let matched = 0;
  STATE.geojson.features.forEach(f => {
    const k = String((f.properties || {})[shpKey] || '').trim();
    if (lookup.has(k)) {
      f.properties = { ...f.properties, ...lookup.get(k) };
      matched++;
    }
  });

  setStatus('status-join', `✓ Joined ${matched}/${STATE.geojson.features.length} features`, matched > 0 ? 'ok' : 'err');

  if (matched > 0) {
    const numericFields = STATE.csvHeaders.filter(h => h !== csvKey && isNumericCol(h));
    populateSelect('sel-choro-var', numericFields);
    populateSelect('sel-symbol-var', numericFields);
    populateSelect('sel-biv-x', numericFields);
    populateSelect('sel-biv-y', numericFields.length > 1 ? numericFields.slice(1) : numericFields);

    const allFields = STATE.csvHeaders.filter(h => h !== csvKey);
    renderTooltipFields(allFields);

    document.getElementById('section-choropleth').style.display = 'block';
    document.getElementById('section-symbols').style.display    = 'block';
    document.getElementById('section-bivariate').style.display  = 'block';
    document.getElementById('section-tooltip').style.display    = 'block';
    document.getElementById('section-summary').style.display    = 'block';

    if (numericFields.length > 0) renderDataSummary(numericFields[0]);
  }
}

// ══════════════════════════════════════════
// CHOROPLETH
// ══════════════════════════════════════════
function applyChoropleth() {
  const varName    = document.getElementById('sel-choro-var').value;
  const method     = document.getElementById('sel-classification').value;
  const nClass     = parseInt(document.getElementById('range-classes').value);
  const palette    = document.getElementById('sel-palette').value;
  const reverse    = document.getElementById('chk-reverse').checked;
  const opacity    = parseInt(document.getElementById('range-opacity').value) / 100;
  const borderColor= document.getElementById('pick-border').value;
  const borderWidth= parseFloat(document.getElementById('range-border').value);

  if (!STATE.geojson || !varName) return;

  const values = STATE.geojson.features.map(f => {
    const v = (f.properties || {})[varName];
    return v !== null && v !== undefined ? parseFloat(v) : NaN;
  });
  const validVals = values.filter(v => !isNaN(v));

  let manualBreaks = [];
  if (method === 'manual') {
    manualBreaks = document.getElementById('input-manual-breaks').value
      .split(',').map(v => parseFloat(v.trim()));
  }

  const breaks = classify(validVals, nClass, method, manualBreaks);
  const colors = getPaletteColors(palette, breaks.length - 1, reverse);
  STATE.breaks   = breaks;
  STATE.colors   = colors;
  STATE.choroVar = varName;
  STATE.mode     = 'choropleth';

  // Cache style per feature for flicker-free hover
  STATE.geojson.features.forEach((f, i) => {
    const val = parseFloat((f.properties || {})[varName]);
    const cls = getClass(val, breaks);
    f._style = {
      fillColor:   cls >= 0 ? colors[cls] : '#cccccc',
      fillOpacity: cls >= 0 ? opacity      : 0.3,
      color:       borderColor,
      weight:      borderWidth,
    };
  });

  renderChoropleth(STATE.geojson, null, f => f._style || {}, buildPopupFn());

  if (document.getElementById('chk-symbols').checked) applySymbols();

  renderLegendChoropleth(breaks, colors, varName);
  document.getElementById('map-legend').style.display =
    document.getElementById('chk-legend').checked ? 'block' : 'none';
  renderDataSummary(varName);
}

// ══════════════════════════════════════════
// PROPORTIONAL SYMBOLS
// ══════════════════════════════════════════
function applySymbols() {
  const varName  = document.getElementById('sel-symbol-var').value;
  const maxR     = parseInt(document.getElementById('range-sym-size').value);
  const symColor = document.getElementById('pick-sym-color').value;
  const opacity  = parseInt(document.getElementById('range-sym-opacity').value) / 100;

  if (!STATE.geojson || !varName) return;

  const values = STATE.geojson.features
    .map(f => parseFloat((f.properties || {})[varName]))
    .filter(v => !isNaN(v) && v > 0);
  const maxVal = Math.max(...values);
  if (maxVal <= 0) return;

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

// ══════════════════════════════════════════
// BIVARIATE
// ══════════════════════════════════════════
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

  STATE.geojson.features.forEach(f => {
    const xv = parseFloat((f.properties||{})[xVar]);
    const yv = parseFloat((f.properties||{})[yVar]);
    const xi = Math.min(Math.max(getClass(xv, xBreaks), 0), 2);
    const yi = Math.min(Math.max(getClass(yv, yBreaks), 0), 2);
    if (isNaN(xv) || isNaN(yv)) {
      f._style = { fillColor: '#ccc', fillOpacity: 0.4, color: '#fff', weight: 0.5 };
    } else {
      f._style = { fillColor: bivColors[yi * 3 + xi], fillOpacity: 0.85, color: '#fff', weight: 0.5 };
    }
  });

  renderChoropleth(STATE.geojson, null, f => f._style || {}, buildPopupFn());
  renderLegendBivariate(bivColors, xVar, yVar);
  document.getElementById('map-legend').style.display =
    document.getElementById('chk-legend').checked ? 'block' : 'none';
}

// ══════════════════════════════════════════
// PLAIN MAP (no data)
// ══════════════════════════════════════════
function renderPlainMap() {
  if (!STATE.geojson) return;
  STATE.geojson.features.forEach(f => {
    f._style = { fillColor: '#b0bec5', fillOpacity: 0.6, color: '#fff', weight: 0.8 };
  });
  renderChoropleth(STATE.geojson, null, f => f._style, buildPopupFn());
}

// ══════════════════════════════════════════
// POPUP BUILDER
// ══════════════════════════════════════════
function buildPopupFn() {
  return feature => {
    const props = feature.properties || {};
    const fields = STATE.tooltipFields.length > 0
      ? STATE.tooltipFields
      : Object.keys(props).slice(0, 8);

    const titleField = ['name','NAME','Name','county','COUNTY','state','STATE','region','REGION','GEOID']
      .find(f => props[f]) || Object.keys(props)[0];

    let html = `<div class="popup-title">${props[titleField] || 'Feature'}</div>`;
    fields.forEach(f => {
      if (f === titleField) return;
      const val = props[f];
      if (val === undefined || val === null || val === '') return;
      const numVal = parseFloat(val);
      const display = !isNaN(numVal) && isFinite(numVal)
        ? numVal.toLocaleString(undefined, { maximumFractionDigits: 4 })
        : val;
      html += `<div class="popup-row"><span class="popup-key">${f}</span><span class="popup-val">${display}</span></div>`;
    });
    return html;
  };
}

// ══════════════════════════════════════════
// ATTRIBUTE TABLE
// ══════════════════════════════════════════
function showAttributeTable() {
  const modal = document.getElementById('modal-attr-table');
  const tbody = document.getElementById('attr-table-body');
  const thead = document.getElementById('attr-table-head');
  modal.style.display = 'flex';

  if (!STATE.geojson || !STATE.geojson.features.length) {
    tbody.innerHTML = '<tr><td colspan="99" style="text-align:center;color:#999;padding:20px">No data loaded</td></tr>';
    return;
  }

  // Get all property keys
  const allKeys = [...new Set(STATE.geojson.features.flatMap(f => Object.keys(f.properties || {})))];
  // Show up to 20 columns
  const cols = allKeys.slice(0, 20);

  thead.innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';

  // Show up to 500 rows
  const rows = STATE.geojson.features.slice(0, 500);
  tbody.innerHTML = rows.map(f => {
    const p = f.properties || {};
    return '<tr>' + cols.map(c => {
      const v = p[c] !== undefined && p[c] !== null ? p[c] : '';
      return `<td>${v}</td>`;
    }).join('') + '</tr>';
  }).join('');

  const note = document.getElementById('attr-table-note');
  note.textContent = `Showing ${rows.length} of ${STATE.geojson.features.length} features, ${cols.length} of ${allKeys.length} columns`;
}

// ══════════════════════════════════════════
// LEGEND RENDERERS
// ══════════════════════════════════════════
function renderLegendChoropleth(breaks, colors, varName) {
  const body = document.getElementById('legend-body');
  body.innerHTML = '';
  for (let i = 0; i < colors.length; i++) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<div class="legend-swatch" style="background:${colors[i]}"></div>
      <span>${fmtBreak(breaks[i])} – ${fmtBreak(breaks[i+1])}</span>`;
    body.appendChild(item);
  }
  const nd = document.createElement('div');
  nd.className = 'legend-item';
  nd.innerHTML = `<div class="legend-swatch" style="background:#ccc;opacity:0.5"></div><span>No data</span>`;
  body.appendChild(nd);
  document.getElementById('legend-title-text').textContent =
    document.getElementById('input-legend-title').value || varName;
}

function renderLegendBivariate(bivColors, xVar, yVar) {
  document.getElementById('legend-body').innerHTML = `
    <div class="biv-legend-grid">
      ${bivColors.map(c => `<div class="biv-cell" style="background:${c}"></div>`).join('')}
    </div>
    <div class="biv-axis-labels"><span>← low ${xVar}</span><span>high →</span></div>
    <div style="font-size:9px;color:#777;margin-top:4px">↑ high ${yVar}<br>↓ low</div>`;
  document.getElementById('legend-title-text').textContent = 'Bivariate';
}

// ══════════════════════════════════════════
// TOOLTIP FIELDS
// ══════════════════════════════════════════
function renderTooltipFields(fields) {
  const container = document.getElementById('tooltip-fields-list');
  container.innerHTML = '';
  STATE.tooltipFields = [];
  fields.slice(0, 15).forEach(f => {
    const label = document.createElement('label');
    label.className = 'tooltip-field-item';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.addEventListener('change', () => {
      if (chk.checked) STATE.tooltipFields.push(f);
      else STATE.tooltipFields = STATE.tooltipFields.filter(x => x !== f);
    });
    label.appendChild(chk);
    label.appendChild(document.createTextNode(f));
    container.appendChild(label);
  });
}

// ══════════════════════════════════════════
// DATA SUMMARY
// ══════════════════════════════════════════
function renderDataSummary(varName) {
  if (!STATE.geojson || !varName) return;
  const values = STATE.geojson.features
    .map(f => {
      const v = (f.properties || {})[varName];
      return v !== null && v !== undefined ? parseFloat(v) : NaN;
    })
    .filter(v => !isNaN(v));
  if (values.length === 0) return;

  const sorted = [...values].sort((a,b) => a-b);
  const mean   = values.reduce((a,b) => a+b, 0) / values.length;
  const median = sorted[Math.floor(sorted.length/2)];
  const std    = Math.sqrt(values.reduce((a,b) => a+(b-mean)**2, 0) / values.length);

  document.getElementById('data-summary-body').innerHTML = [
    ['Variable', varName],
    ['N (mapped)', values.length],
    ['Min',  fmtBreak(sorted[0])],
    ['Max',  fmtBreak(sorted[sorted.length-1])],
    ['Mean', fmtBreak(mean)],
    ['Median', fmtBreak(median)],
    ['Std Dev', fmtBreak(std)],
  ].map(([k,v]) =>
    `<div class="summary-row"><span class="summary-key">${k}</span><span class="summary-val">${v}</span></div>`
  ).join('');
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
function populateSelect(id, options) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join('');
}

function setStatus(id, msg, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'upload-status' + (cls ? ' ' + cls : '');
}

// ══════════════════════════════════════════
// DEMO DATA
// ══════════════════════════════════════════
async function loadDemoData() {
  setStatus('status-shp', 'Loading demo shapefile…', '');
  setStatus('status-csv', 'Loading demo data…', '');
  try {
    const resp = await fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json');
    if (!resp.ok) throw new Error('Network error');
    const geojson = await resp.json();
    STATE.geojson  = geojson;
    STATE.shpFields = geojson.features.length > 0 ? Object.keys(geojson.features[0].properties) : [];
    setStatus('status-shp', `✓ Demo: US States — ${geojson.features.length} features`, 'ok');
    document.getElementById('drop-shp').classList.add('loaded');
    document.getElementById('btn-attr-table').style.display = 'inline-block';

    const demoCSV = generateDemoCSV();
    STATE.csvData    = demoCSV;
    STATE.csvHeaders = Object.keys(demoCSV[0]);
    STATE.numCols    = ['mortality_rate','incidence_rate','pct_uninsured','poverty_pct','pop_density','median_income'];
    STATE.catCols    = ['state'];
    setStatus('status-csv', `✓ Demo: US State Health Data — ${demoCSV.length} rows`, 'ok');
    document.getElementById('drop-csv').classList.add('loaded');

    populateSelect('sel-shp-key', STATE.shpFields);
    populateSelect('sel-csv-key', STATE.csvHeaders);
    document.getElementById('sel-shp-key').value = 'name';
    document.getElementById('sel-csv-key').value = 'state';
    document.getElementById('section-join').style.display = 'block';
    performJoin();

    document.getElementById('sel-choro-var').value    = 'mortality_rate';
    document.getElementById('sel-classification').value = 'jenks';
    document.getElementById('range-classes').value    = 5;
    document.getElementById('lbl-classes').textContent = '5';
    document.getElementById('sel-palette').value      = 'YlOrRd';
    document.getElementById('input-map-title').value  = 'US State Mortality Rates (Demo)';
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
  const rng = seed => { let s = seed; return () => { s ^= s<<13; s ^= s>>17; s ^= s<<5; return (s>>>0)/4294967296; }; };
  const r = rng(42);
  return states.map(state => {
    const base = 200 + r() * 400;
    return {
      state,
      mortality_rate: parseFloat(base.toFixed(1)),
      incidence_rate: parseFloat((base * 2.2 + r()*200).toFixed(1)),
      pct_uninsured:  parseFloat((3 + r()*18).toFixed(1)),
      poverty_pct:    parseFloat((7 + r()*18).toFixed(1)),
      pop_density:    parseFloat((10 + r()*900).toFixed(1)),
      median_income:  Math.round(35000 + r()*45000),
    };
  });
}
