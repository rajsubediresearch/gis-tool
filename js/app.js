// ══════════════════════════════════════════
// app.js  —  Main application logic
// v3 — fixed age slider, explicit filter UI
// ══════════════════════════════════════════

const STATE = {
  geojson:       null,
  csvData:       null,
  csvHeaders:    [],
  shpFields:     [],
  breaks:        [],
  colors:        [],
  choroVar:      null,
  symbolVar:     null,
  bivX:          null,
  bivY:          null,
  tooltipFields: [],
  mode:          'choropleth',
  isGranular:    false,
  catCols:       [],
  numCols:       [],
  ageCols:       [],   // numeric cols whose name matches /age/i
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

  document.getElementById('btn-attr-table').addEventListener('click', showAttributeTable);
  document.getElementById('btn-attr-table-close').addEventListener('click', () =>
    document.getElementById('modal-attr-table').style.display = 'none');
  document.getElementById('modal-attr-table').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-attr-table'))
      document.getElementById('modal-attr-table').style.display = 'none';
  });

  document.getElementById('sel-classification').addEventListener('change', e => {
    document.getElementById('manual-breaks-wrapper').style.display =
      e.target.value === 'manual' ? 'block' : 'none';
  });

  document.getElementById('sel-palette').addEventListener('change', () =>
    renderPalettePreview(document.getElementById('sel-palette').value,
                         document.getElementById('chk-reverse').checked));
  document.getElementById('chk-reverse').addEventListener('change', () =>
    renderPalettePreview(document.getElementById('sel-palette').value,
                         document.getElementById('chk-reverse').checked));

  bindRange('range-classes',       'lbl-classes',       v => v);
  bindRange('range-opacity',       'lbl-opacity',       v => v + '%');
  bindRange('range-border',        'lbl-border',        v => v + 'px');
  bindRange('range-sym-size',      'lbl-sym-size',      v => v + 'px');
  bindRange('range-sym-opacity',   'lbl-sym-opacity',   v => v + '%');
  bindRange('range-title-size',    'lbl-title-size',    v => v + 'px');
  bindRange('range-subtitle-size', 'lbl-subtitle-size', v => v + 'px');

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
    e.preventDefault(); zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) loadFn(file);
  });
  zone.addEventListener('click', () => document.getElementById(inputId).click());
}

// ══════════════════════════════════════════
// SHAPEFILE
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
// CSV LOADING
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

      // Classify every column
      STATE.numCols  = STATE.csvHeaders.filter(h => isNumericCol(h));
      STATE.catCols  = STATE.csvHeaders.filter(h => !isNumericCol(h));
      // Age-like = numeric AND name contains "age"
      STATE.ageCols  = STATE.numCols.filter(h => /^age$/i.test(h) || /\bage\b/i.test(h));

      setStatus('status-csv',
        `✓ ${file.name} — ${STATE.csvData.length.toLocaleString()} rows, ${STATE.csvHeaders.length} cols`, 'ok');
      document.getElementById('drop-csv').classList.add('loaded');
      populateSelect('sel-csv-key', STATE.csvHeaders);
      checkShowJoinSection();
    },
    error: err => setStatus('status-csv', `Error: ${err.message}`, 'err')
  });
}

function isNumericCol(field) {
  if (!STATE.csvData) return false;
  const sample = STATE.csvData.slice(0, 30)
    .map(r => r[field])
    .filter(v => v !== null && v !== '' && v !== undefined);
  if (sample.length === 0) return false;
  return sample.filter(v => typeof v === 'number' || !isNaN(parseFloat(v))).length > sample.length * 0.7;
}

function checkShowJoinSection() {
  if (STATE.geojson && STATE.csvData)
    document.getElementById('section-join').style.display = 'block';
}

// ══════════════════════════════════════════
// GRANULARITY DETECT
// ══════════════════════════════════════════
function detectGranularity(joinKey) {
  const keyCounts = new Map();
  STATE.csvData.forEach(row => {
    const k = String(row[joinKey] ?? '').trim();
    keyCounts.set(k, (keyCounts.get(k) || 0) + 1);
  });
  const vals = [...keyCounts.values()];
  const avg  = vals.reduce((a,b) => a+b, 0) / vals.length;
  return avg > 1.5;
}

// ══════════════════════════════════════════
// AGGREGATION PANEL — rebuilt cleanly
// ══════════════════════════════════════════
function showAggPanel(joinKey) {
  document.getElementById('section-agg').style.display = 'block';
  document.getElementById('agg-warning').textContent =
    `⚠ Granular data detected — multiple rows per "${joinKey}". Set filters below, then click Aggregate & Join.`;

  const container = document.getElementById('agg-filters');
  container.innerHTML = '';

  // ── 1. Age range slider (if any age-like numeric column exists) ──
  if (STATE.ageCols.length > 0) {
    const ageCol = STATE.ageCols[0];
    const allAges = STATE.csvData.map(r => r[ageCol]).filter(v => typeof v === 'number' && !isNaN(v));
    const minAge  = Math.min(...allAges);
    const maxAge  = Math.max(...allAges);

    const wrap = document.createElement('div');
    wrap.className = 'agg-filter-block';
    wrap.innerHTML = `
      <div class="agg-filter-label">
        <span class="field-label" style="margin:0">Age range <span class="filter-tag">numeric filter</span></span>
        <label class="toggle-row" style="gap:6px;margin:0">
          <input type="checkbox" id="chk-age-filter" checked />
          <span class="toggle-switch"></span>
          <span style="font-size:10px;color:var(--text-muted)">enabled</span>
        </label>
      </div>
      <input type="hidden" id="agg-age-col" value="${ageCol}" />
      <div id="age-slider-wrap" style="margin-top:8px">
        <div class="age-slider-row">
          <span class="age-bound-label">Min age</span>
          <input type="range" id="range-age-min" min="${minAge}" max="${maxAge}" value="${minAge}" class="range-slider" />
          <span class="age-bound-val" id="lbl-age-min">${minAge}</span>
        </div>
        <div class="age-slider-row">
          <span class="age-bound-label">Max age</span>
          <input type="range" id="range-age-max" min="${minAge}" max="${maxAge}" value="${maxAge}" class="range-slider" />
          <span class="age-bound-val" id="lbl-age-max">${maxAge}</span>
        </div>
        <div class="age-preview" id="age-preview">All ages: ${minAge}–${maxAge}</div>
      </div>`;
    container.appendChild(wrap);

    // Wire up sliders
    const rMin = wrap.querySelector('#range-age-min');
    const rMax = wrap.querySelector('#range-age-max');
    const lMin = wrap.querySelector('#lbl-age-min');
    const lMax = wrap.querySelector('#lbl-age-max');
    const prev = wrap.querySelector('#age-preview');
    const chk  = wrap.querySelector('#chk-age-filter');

    const updateAgePreview = () => {
      const lo = parseInt(rMin.value), hi = parseInt(rMax.value);
      const count = STATE.csvData.filter(r => {
        const a = r[ageCol];
        return typeof a === 'number' && a >= lo && a <= hi;
      }).length;
      prev.textContent = `Age ${lo}–${hi} · ${count.toLocaleString()} rows match`;
    };

    rMin.addEventListener('input', () => {
      if (parseInt(rMin.value) > parseInt(rMax.value)) rMax.value = rMin.value;
      lMin.textContent = rMin.value; lMax.textContent = rMax.value;
      updateAgePreview();
    });
    rMax.addEventListener('input', () => {
      if (parseInt(rMax.value) < parseInt(rMin.value)) rMin.value = rMax.value;
      lMax.textContent = rMax.value; lMin.textContent = rMin.value;
      updateAgePreview();
    });
    chk.addEventListener('change', () => {
      wrap.querySelector('#age-slider-wrap').style.opacity = chk.checked ? '1' : '0.35';
      wrap.querySelector('#age-slider-wrap').style.pointerEvents = chk.checked ? '' : 'none';
    });

    updateAgePreview();
  }

  // ── 2. Categorical filters (string columns, excluding join key) ──
  const catFilters = STATE.catCols.filter(c => c !== joinKey);
  catFilters.forEach(col => {
    const uniqueVals = [...new Set(
      STATE.csvData.map(r => String(r[col] ?? '')).filter(v => v !== '')
    )].sort();
    if (uniqueVals.length === 0 || uniqueVals.length > 50) return; // skip high-cardinality cols

    const wrap = document.createElement('div');
    wrap.className = 'agg-filter-block';
    wrap.innerHTML = `
      <div class="agg-filter-label">
        <span class="field-label" style="margin:0">${col} <span class="filter-tag">category filter</span></span>
        <span style="font-size:9px;color:var(--text-muted)">leave all unselected = include all</span>
      </div>`;

    // Render as checkboxes if ≤8 values, select if more
    if (uniqueVals.length <= 8) {
      const cbWrap = document.createElement('div');
      cbWrap.className = 'cat-checkbox-group';
      cbWrap.id = `agg-cat-${col}`;
      uniqueVals.forEach(v => {
        const lbl = document.createElement('label');
        lbl.className = 'cat-checkbox-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = v;
        cb.dataset.col = col;
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(v));
        cbWrap.appendChild(lbl);
      });
      wrap.appendChild(cbWrap);
    } else {
      const sel = document.createElement('select');
      sel.className = 'field-select';
      sel.id = `agg-cat-${col}`;
      sel.multiple = true;
      sel.size = Math.min(uniqueVals.length, 5);
      uniqueVals.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        sel.appendChild(opt);
      });
      const hint = document.createElement('div');
      hint.className = 'filter-hint';
      hint.textContent = 'Ctrl/Cmd+click to select multiple';
      wrap.appendChild(sel);
      wrap.appendChild(hint);
    }

    container.appendChild(wrap);
  });

  // ── 3. Variable + function selectors (only non-age numeric cols as targets) ──
  const aggTargets = STATE.numCols.filter(c => STATE.ageCols.indexOf(c) === -1 || STATE.ageCols.length === 0
    ? true : c === STATE.numCols[STATE.numCols.length - 1]);
  // Actually: show all numeric cols as aggregation targets (age could be summed too — user's choice)
  populateSelect('sel-agg-var', STATE.numCols);
  // Pre-select the most likely target (last numeric col, usually the measurement)
  const aggVarSel = document.getElementById('sel-agg-var');
  if (STATE.numCols.length > 0) aggVarSel.value = STATE.numCols[STATE.numCols.length - 1];
}

// ══════════════════════════════════════════
// COLLECT FILTERS FROM UI
// ══════════════════════════════════════════
function collectFilters(joinKey) {
  let rows = [...STATE.csvData];
  const desc = [];

  // Age filter
  const ageColEl = document.getElementById('agg-age-col');
  const ageChkEl = document.getElementById('chk-age-filter');
  if (ageColEl && ageColEl.value && ageChkEl && ageChkEl.checked) {
    const ageCol = ageColEl.value;
    const lo = parseInt(document.getElementById('range-age-min').value);
    const hi = parseInt(document.getElementById('range-age-max').value);
    rows = rows.filter(r => {
      const a = r[ageCol];
      return typeof a === 'number' && a >= lo && a <= hi;
    });
    desc.push(`age ${lo}–${hi}`);
  }

  // Categorical filters
  const catFilters = STATE.catCols.filter(c => c !== joinKey);
  catFilters.forEach(col => {
    const container = document.getElementById(`agg-cat-${col}`);
    if (!container) return;

    let selected = [];
    // Checkbox group
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    if (checkboxes.length > 0) {
      selected = [...checkboxes].map(cb => cb.value);
    } else if (container.tagName === 'SELECT') {
      // Multi-select
      selected = [...container.selectedOptions].map(o => o.value);
    }

    if (selected.length > 0) {
      rows = rows.filter(r => selected.includes(String(r[col] ?? '')));
      desc.push(`${col}=${selected.join('/')}`);
    }
  });

  return { rows, desc };
}

// ══════════════════════════════════════════
// APPLY AGGREGATION
// ══════════════════════════════════════════
function applyAggregation() {
  const joinKey = document.getElementById('sel-csv-key').value;
  const aggVar  = document.getElementById('sel-agg-var').value;
  const aggFn   = document.getElementById('sel-agg-fn').value;

  if (!joinKey || !aggVar) {
    setStatus('status-join', 'Select variable and function first', 'err'); return;
  }

  const { rows, desc } = collectFilters(joinKey);

  if (rows.length === 0) {
    setStatus('status-join', '⚠ No rows match the current filters — widen filters', 'err'); return;
  }

  // Group by join key → aggregate
  const groups = new Map();
  rows.forEach(row => {
    const k = String(row[joinKey] ?? '').trim();
    if (!groups.has(k)) groups.set(k, []);
    const v = typeof row[aggVar] === 'number' ? row[aggVar] : parseFloat(row[aggVar]);
    if (!isNaN(v)) groups.get(k).push(v);
  });

  const aggregated = new Map();
  groups.forEach((vals, k) => {
    if (vals.length === 0) return;
    let result;
    switch(aggFn) {
      case 'sum':    result = vals.reduce((a,b) => a+b, 0); break;
      case 'mean':   result = vals.reduce((a,b) => a+b, 0) / vals.length; break;
      case 'median': { const s = [...vals].sort((a,b)=>a-b); result = s[Math.floor(s.length/2)]; break; }
      case 'count':  result = vals.length; break;
      case 'max':    result = Math.max(...vals); break;
      case 'min':    result = Math.min(...vals); break;
      default:       result = vals.reduce((a,b) => a+b, 0);
    }
    aggregated.set(k, result);
  });

  // Build a readable column name
  const filterTag = desc.length > 0 ? `[${desc.join(', ')}]` : '';
  const colName   = `${aggFn}(${aggVar})${filterTag}`;

  // Inject into GeoJSON features
  const shpKey = document.getElementById('sel-shp-key').value;
  let matched = 0;
  STATE.geojson.features.forEach(f => {
    const k = String((f.properties || {})[shpKey] ?? '').trim();
    if (aggregated.has(k)) {
      f.properties[colName] = parseFloat(aggregated.get(k).toFixed(4));
      matched++;
    } else {
      f.properties[colName] = null;
    }
  });

  const filterSummary = desc.length > 0 ? ` [${desc.join(', ')}]` : ' [all rows]';
  setStatus('status-join',
    `✓ ${aggFn}(${aggVar})${filterSummary} → ${matched}/${STATE.geojson.features.length} features`, 'ok');

  // Collect all agg columns built so far
  const allAggCols = [...new Set(
    STATE.geojson.features.flatMap(f =>
      Object.keys(f.properties || {}).filter(k =>
        k.includes('(') || STATE.numCols.includes(k)
      )
    )
  )];

  populateSelect('sel-choro-var', allAggCols);
  populateSelect('sel-symbol-var', allAggCols);
  populateSelect('sel-biv-x', allAggCols);
  populateSelect('sel-biv-y', allAggCols);

  // Auto-select the just-created column
  document.getElementById('sel-choro-var').value = colName;

  const allProps = STATE.geojson.features.length > 0
    ? Object.keys(STATE.geojson.features[0].properties) : [];
  renderTooltipFields(allProps);

  document.getElementById('section-choropleth').style.display = 'block';
  document.getElementById('section-symbols').style.display    = 'block';
  document.getElementById('section-bivariate').style.display  = 'block';
  document.getElementById('section-tooltip').style.display    = 'block';
  document.getElementById('section-summary').style.display    = 'block';

  renderDataSummary(colName);
}

// ══════════════════════════════════════════
// JOIN (pre-aggregated)
// ══════════════════════════════════════════
function performJoin() {
  const shpKey = document.getElementById('sel-shp-key').value;
  const csvKey = document.getElementById('sel-csv-key').value;
  if (!shpKey || !csvKey) { setStatus('status-join', 'Select join keys', 'err'); return; }

  if (detectGranularity(csvKey)) {
    STATE.isGranular = true;
    showAggPanel(csvKey);
    setStatus('status-join', '⚠ Granular CSV detected — configure aggregation above.', '');
    return;
  }

  // Wide/pre-aggregated: direct join
  const lookup = new Map();
  STATE.csvData.forEach(row => {
    const k = String(row[csvKey] ?? '').trim();
    if (!lookup.has(k)) lookup.set(k, row);
  });

  let matched = 0;
  STATE.geojson.features.forEach(f => {
    const k = String((f.properties || {})[shpKey] ?? '').trim();
    if (lookup.has(k)) { f.properties = { ...f.properties, ...lookup.get(k) }; matched++; }
  });

  setStatus('status-join', `✓ Joined ${matched}/${STATE.geojson.features.length} features`,
    matched > 0 ? 'ok' : 'err');

  if (matched > 0) {
    const numericFields = STATE.csvHeaders.filter(h => h !== csvKey && isNumericCol(h));
    populateSelect('sel-choro-var',  numericFields);
    populateSelect('sel-symbol-var', numericFields);
    populateSelect('sel-biv-x',      numericFields);
    populateSelect('sel-biv-y',      numericFields.slice(1).length ? numericFields.slice(1) : numericFields);
    renderTooltipFields(STATE.csvHeaders.filter(h => h !== csvKey));
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
  const varName     = document.getElementById('sel-choro-var').value;
  const method      = document.getElementById('sel-classification').value;
  const nClass      = parseInt(document.getElementById('range-classes').value);
  const palette     = document.getElementById('sel-palette').value;
  const reverse     = document.getElementById('chk-reverse').checked;
  const opacity     = parseInt(document.getElementById('range-opacity').value) / 100;
  const borderColor = document.getElementById('pick-border').value;
  const borderWidth = parseFloat(document.getElementById('range-border').value);
  if (!STATE.geojson || !varName) return;

  const values    = STATE.geojson.features.map(f => {
    const v = (f.properties || {})[varName];
    return (v !== null && v !== undefined) ? parseFloat(v) : NaN;
  });
  const validVals = values.filter(v => !isNaN(v));

  let manualBreaks = [];
  if (method === 'manual') {
    manualBreaks = document.getElementById('input-manual-breaks').value
      .split(',').map(v => parseFloat(v.trim()));
  }

  const breaks = classify(validVals, nClass, method, manualBreaks);
  const colors  = getPaletteColors(palette, breaks.length - 1, reverse);
  STATE.breaks  = breaks; STATE.colors = colors; STATE.choroVar = varName; STATE.mode = 'choropleth';

  STATE.geojson.features.forEach(f => {
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
  const values = STATE.geojson.features.map(f => parseFloat((f.properties||{})[varName])).filter(v=>!isNaN(v)&&v>0);
  const maxVal = Math.max(...values);
  if (maxVal <= 0) return;
  renderSymbols(STATE.geojson,
    f => { const v=parseFloat((f.properties||{})[varName]); return (isNaN(v)||v<=0)?0:Math.sqrt(v/maxVal)*maxR; },
    () => symColor, () => opacity, buildPopupFn());
}

// ══════════════════════════════════════════
// BIVARIATE
// ══════════════════════════════════════════
function applyBivariate() {
  const xVar=document.getElementById('sel-biv-x').value, yVar=document.getElementById('sel-biv-y').value;
  const scheme=document.getElementById('sel-biv-scheme').value;
  if(!STATE.geojson||!xVar||!yVar) return;
  const bivColors=PALETTES['_biv_'+scheme]; if(!bivColors) return;
  const xVals=STATE.geojson.features.map(f=>parseFloat((f.properties||{})[xVar])).filter(v=>!isNaN(v));
  const yVals=STATE.geojson.features.map(f=>parseFloat((f.properties||{})[yVar])).filter(v=>!isNaN(v));
  const xBreaks=quantileBreaks([...xVals].sort((a,b)=>a-b),3);
  const yBreaks=quantileBreaks([...yVals].sort((a,b)=>a-b),3);
  STATE.mode='bivariate';
  STATE.geojson.features.forEach(f=>{
    const xv=parseFloat((f.properties||{})[xVar]), yv=parseFloat((f.properties||{})[yVar]);
    if(isNaN(xv)||isNaN(yv)){f._style={fillColor:'#ccc',fillOpacity:0.4,color:'#fff',weight:0.5};return;}
    const xi=Math.min(Math.max(getClass(xv,xBreaks),0),2), yi=Math.min(Math.max(getClass(yv,yBreaks),0),2);
    f._style={fillColor:bivColors[yi*3+xi],fillOpacity:0.85,color:'#fff',weight:0.5};
  });
  renderChoropleth(STATE.geojson,null,f=>f._style||{},buildPopupFn());
  renderLegendBivariate(bivColors,xVar,yVar);
  document.getElementById('map-legend').style.display=document.getElementById('chk-legend').checked?'block':'none';
}

// ══════════════════════════════════════════
// PLAIN MAP
// ══════════════════════════════════════════
function renderPlainMap() {
  if (!STATE.geojson) return;
  STATE.geojson.features.forEach(f => {
    f._style = { fillColor:'#b0bec5', fillOpacity:0.6, color:'#fff', weight:0.8 };
  });
  renderChoropleth(STATE.geojson, null, f => f._style, buildPopupFn());
}

// ══════════════════════════════════════════
// POPUP
// ══════════════════════════════════════════
function buildPopupFn() {
  return feature => {
    const props = feature.properties || {};
    const fields = STATE.tooltipFields.length > 0
      ? STATE.tooltipFields : Object.keys(props).slice(0, 8);
    const titleField = ['name','NAME','Name','county','COUNTY','state','STATE','region','GEOID']
      .find(f => props[f]) || Object.keys(props)[0];
    let html = `<div class="popup-title">${props[titleField] || 'Feature'}</div>`;
    fields.forEach(f => {
      if (f === titleField) return;
      const val = props[f];
      if (val === undefined || val === null || val === '') return;
      const numVal = parseFloat(val);
      const display = !isNaN(numVal) && isFinite(numVal)
        ? numVal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val;
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
  modal.style.display = 'flex';
  if (!STATE.geojson || !STATE.geojson.features.length) return;
  const allKeys = [...new Set(STATE.geojson.features.flatMap(f => Object.keys(f.properties || {})))];
  const cols    = allKeys.slice(0, 20);
  document.getElementById('attr-table-head').innerHTML =
    '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
  const rows = STATE.geojson.features.slice(0, 500);
  document.getElementById('attr-table-body').innerHTML = rows.map(f => {
    const p = f.properties || {};
    return '<tr>' + cols.map(c => `<td>${p[c] !== undefined && p[c] !== null ? p[c] : ''}</td>`).join('') + '</tr>';
  }).join('');
  document.getElementById('attr-table-note').textContent =
    `${rows.length} of ${STATE.geojson.features.length} features · ${cols.length} of ${allKeys.length} columns`;
}

// ══════════════════════════════════════════
// LEGENDS
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
    <div class="biv-legend-grid">${bivColors.map(c=>`<div class="biv-cell" style="background:${c}"></div>`).join('')}</div>
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
    .map(f => { const v=(f.properties||{})[varName]; return (v!==null&&v!==undefined)?parseFloat(v):NaN; })
    .filter(v => !isNaN(v));
  if (values.length === 0) return;
  const sorted = [...values].sort((a,b)=>a-b);
  const mean   = values.reduce((a,b)=>a+b,0)/values.length;
  document.getElementById('data-summary-body').innerHTML = [
    ['Variable', varName.length > 28 ? varName.slice(0,28)+'…' : varName],
    ['N (mapped)', values.length],
    ['Min',    fmtBreak(sorted[0])],
    ['Max',    fmtBreak(sorted[sorted.length-1])],
    ['Mean',   fmtBreak(mean)],
    ['Median', fmtBreak(sorted[Math.floor(sorted.length/2)])],
    ['Std Dev',fmtBreak(Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length))],
  ].map(([k,v])=>
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
    STATE.geojson   = geojson;
    STATE.shpFields = geojson.features.length > 0 ? Object.keys(geojson.features[0].properties) : [];
    setStatus('status-shp', `✓ Demo: US States — ${geojson.features.length} features`, 'ok');
    document.getElementById('drop-shp').classList.add('loaded');
    document.getElementById('btn-attr-table').style.display = 'inline-block';

    const demoCSV = generateDemoCSV();
    STATE.csvData    = demoCSV;
    STATE.csvHeaders = Object.keys(demoCSV[0]);
    STATE.numCols    = ['mortality_rate','incidence_rate','pct_uninsured','poverty_pct','pop_density','median_income'];
    STATE.catCols    = ['state'];
    STATE.ageCols    = [];
    setStatus('status-csv', `✓ Demo: US State Health Data — ${demoCSV.length} rows`, 'ok');
    document.getElementById('drop-csv').classList.add('loaded');

    populateSelect('sel-shp-key', STATE.shpFields);
    populateSelect('sel-csv-key', STATE.csvHeaders);
    document.getElementById('sel-shp-key').value = 'name';
    document.getElementById('sel-csv-key').value = 'state';
    document.getElementById('section-join').style.display = 'block';
    performJoin();

    document.getElementById('sel-choro-var').value      = 'mortality_rate';
    document.getElementById('sel-classification').value = 'jenks';
    document.getElementById('range-classes').value      = 5;
    document.getElementById('lbl-classes').textContent  = '5';
    document.getElementById('sel-palette').value        = 'YlOrRd';
    document.getElementById('input-map-title').value    = 'US State Mortality Rates (Demo)';
    document.getElementById('map-title-display').textContent = 'US State Mortality Rates (Demo)';
    document.getElementById('input-map-subtitle').value      = 'Synthetic demo data • EpiMap';
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
  const states=['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
    'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas',
    'Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota',
    'Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey',
    'New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon',
    'Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas',
    'Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];
  const rng=seed=>{let s=seed;return()=>{s^=s<<13;s^=s>>17;s^=s<<5;return(s>>>0)/4294967296;};};
  const r=rng(42);
  return states.map(state=>({
    state,
    mortality_rate: parseFloat((200+r()*400).toFixed(1)),
    incidence_rate: parseFloat((400+r()*800).toFixed(1)),
    pct_uninsured:  parseFloat((3+r()*18).toFixed(1)),
    poverty_pct:    parseFloat((7+r()*18).toFixed(1)),
    pop_density:    parseFloat((10+r()*900).toFixed(1)),
    median_income:  Math.round(35000+r()*45000),
  }));
}
