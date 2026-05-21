// ══════════════════════════════════════════
// classify.js  —  Data classification schemes
// ══════════════════════════════════════════

/**
 * Returns n+1 break values (including min and max).
 * @param {number[]} values - array of numeric values
 * @param {number}   n      - number of classes
 * @param {string}   method - 'jenks'|'quantile'|'equal'|'stddev'|'manual'
 * @param {number[]} manualBreaks - used when method === 'manual'
 * @returns {number[]} breaks array length n+1
 */
function classify(values, n, method, manualBreaks = []) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (valid.length === 0) return [];

  const sorted = [...valid].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  switch (method) {
    case 'jenks':    return jenksBreaks(sorted, n);
    case 'quantile': return quantileBreaks(sorted, n);
    case 'equal':    return equalIntervalBreaks(min, max, n);
    case 'stddev':   return stddevBreaks(valid, n);
    case 'manual':   return manualBreaksClean(manualBreaks, min, max);
    default:         return jenksBreaks(sorted, n);
  }
}

// ── Natural Breaks (Jenks) ────────────────
function jenksBreaks(sorted, k) {
  const n = sorted.length;
  if (n <= k) return [sorted[0], ...sorted, sorted[n-1]].slice(0, k+1);

  // Use simple-statistics if available
  if (typeof ss !== 'undefined' && ss.jenksBreaks) {
    try {
      const breaks = ss.jenksBreaks(sorted, k);
      return breaks;
    } catch(e) {}
  }

  // Fallback: manual Jenks implementation
  return jenksManual(sorted, k);
}

function jenksManual(sorted, k) {
  const n = sorted.length;
  // lower class limits
  const lcl  = Array.from({length: n+1}, () => new Array(k+1).fill(0));
  // variance combinations
  const vrc  = Array.from({length: n+1}, () => new Array(k+1).fill(0));

  for (let i = 1; i <= k; i++) { lcl[1][i] = 1; vrc[1][i] = 0; }
  for (let i = 2; i <= n; i++) { vrc[i][1] = 0; lcl[i][1] = 1; }

  let v = 0;
  for (let l = 2; l <= n; l++) {
    let s3 = 0, s2 = 0, w = 0;
    vrc[l][1] = 0;
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1;
      s2 += sorted[i3-1];
      w++;
      s3 += sorted[i3-1] * sorted[i3-1];
      v = s3 - (s2 * s2) / w;
      const i4 = i3 - 1;
      if (i4 !== 0) {
        for (let j = 2; j <= k; j++) {
          if (vrc[l][j] >= v + vrc[i4][j-1]) {
            lcl[l][j] = i3;
            vrc[l][j] = v + vrc[i4][j-1];
          }
        }
      }
    }
    lcl[l][1] = 1;
    vrc[l][1] = v;
  }

  const kclass = new Array(k+1).fill(0);
  kclass[k] = sorted[n-1];
  kclass[0] = sorted[0];

  let countNum = k;
  let id = n;
  while (countNum >= 2) {
    const idx = lcl[id][countNum] - 2;
    kclass[countNum-1] = sorted[idx];
    id = lcl[id][countNum] - 1;
    countNum--;
  }

  return kclass;
}

// ── Quantile ──────────────────────────────
function quantileBreaks(sorted, k) {
  const breaks = [sorted[0]];
  for (let i = 1; i < k; i++) {
    const q = i / k;
    const idx = Math.floor(q * sorted.length);
    breaks.push(sorted[idx]);
  }
  breaks.push(sorted[sorted.length - 1]);
  return breaks;
}

// ── Equal Interval ────────────────────────
function equalIntervalBreaks(min, max, k) {
  const step = (max - min) / k;
  return Array.from({length: k+1}, (_, i) => min + i * step);
}

// ── Standard Deviation ────────────────────
function stddevBreaks(values, k) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std  = Math.sqrt(values.reduce((a, b) => a + (b-mean)**2, 0) / values.length);
  const min  = Math.min(...values);
  const max  = Math.max(...values);

  // Center on mean, step by std
  const half = Math.floor(k / 2);
  const breaks = [];
  for (let i = -half; i <= half; i++) {
    breaks.push(mean + i * std);
  }
  // Ensure min/max are included
  breaks[0] = Math.min(breaks[0], min);
  breaks[breaks.length - 1] = Math.max(breaks[breaks.length - 1], max);

  // Dedupe and ensure exactly k+1 breaks
  const unique = [...new Set(breaks)].sort((a,b) => a-b);
  if (unique.length < k+1) {
    // pad with equal intervals
    return equalIntervalBreaks(min, max, k);
  }
  return unique.slice(0, k+1);
}

// ── Manual ────────────────────────────────
function manualBreaksClean(inputBreaks, min, max) {
  const parsed = inputBreaks
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v))
    .sort((a, b) => a - b);

  if (parsed.length === 0) return equalIntervalBreaks(min, max, 5);

  const breaks = [Math.min(min, parsed[0]), ...parsed, Math.max(max, parsed[parsed.length-1])];
  return [...new Set(breaks)].sort((a,b) => a-b);
}

/**
 * Given a value and break array, return the class index (0-based).
 */
function getClass(value, breaks) {
  if (value === null || value === undefined || isNaN(value)) return -1;
  const n = breaks.length - 1;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      if (value <= breaks[i+1]) return i;
    } else {
      if (value < breaks[i+1]) return i;
    }
  }
  if (value <= breaks[n]) return n - 1;
  return -1;
}

/**
 * Format a break value for display.
 */
function fmtBreak(v) {
  if (v === undefined || v === null) return '';
  if (Math.abs(v) >= 10000) return v.toLocaleString(undefined, {maximumFractionDigits: 0});
  if (Math.abs(v) >= 100)   return v.toLocaleString(undefined, {maximumFractionDigits: 1});
  if (Math.abs(v) >= 1)     return v.toLocaleString(undefined, {maximumFractionDigits: 2});
  return v.toLocaleString(undefined, {maximumFractionDigits: 4});
}
