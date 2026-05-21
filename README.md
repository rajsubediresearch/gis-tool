# EpiMap — Browser-based GIS Visualization Tool

A fully client-side, interactive GIS visualization tool for epidemiological and public health data. No installation, no server, no dependencies to install.

**[→ Open EpiMap](https://rajsubediresearch.github.io/gis-tool/)**

---

## Features

- **Drag-and-drop upload** — zipped shapefiles (.zip with .shp, .dbf, .prj) and CSV data files
- **Attribute join** — link CSV data to shapefile features by any key field
- **Choropleth mapping** with 5 classification schemes:
  - Natural Breaks (Jenks)
  - Quantile
  - Equal Interval
  - Standard Deviation
  - Manual (user-defined breaks)
- **ColorBrewer palettes** — sequential, diverging, and colorblind-safe options (Viridis, Cividis, Plasma, YlGnBu)
- **Proportional symbols** — overlay circle markers sized by a second variable
- **Bivariate choropleth** — 3×3 color matrix for two simultaneous variables
- **Map annotations** — editable title and subtitle, custom font sizes and colors
- **Map elements** — draggable legend, north arrow, scale bar, inset overview map
- **Tooltip popups** — click any region to see attribute data; configure which fields appear
- **Data summary** — min, max, mean, median, std dev for any variable
- **Multiple basemaps** — OpenStreetMap, Carto Light/Dark, ESRI Topo, or plain background
- **PNG export** — download the map as a high-resolution PNG
- **Demo data** — built-in US states with synthetic public health indicators

---

## Usage

**Online** — open the live version directly in your browser:
https://rajsubediresearch.github.io/gis-tool/

**Locally** — clone this repo and open `index.html` in any modern browser, or serve it:

```bash
git clone https://github.com/rajsubediresearch/gis-tool.git
cd gis-tool
python -m http.server 8000
# then open http://localhost:8000
```

---

## Quick Start

1. Click **Load Demo Data** to see the tool immediately with US state health data
2. Or upload your own:
   - **Shapefile**: zip your `.shp`, `.dbf`, and `.prj` files into a single `.zip`
   - **CSV**: any tabular data with a column that matches a field in the shapefile
3. Set the **join keys** (the fields linking shapefile to CSV)
4. Choose a variable, classification scheme, and color palette
5. Optionally enable **Proportional Symbols** or **Bivariate** mode
6. Add a title, legend, north arrow using the right panel
7. **Export PNG** when ready

---

## Shapefile Requirements

- Coordinate system: **WGS84 (EPSG:4326)** — most shapefiles from GADM, Natural Earth, and Census TIGER are already in WGS84
- Zip your `.shp`, `.dbf`, `.prj` (and optionally `.shx`) into a single `.zip` file
- Large files (>50 MB) may be slow in the browser

---

## Classification Schemes

| Scheme | Best for |
|--------|----------|
| **Jenks (Natural Breaks)** | Most epidemiological data; minimizes within-class variance |
| **Quantile** | Skewed distributions; equal number of features per class |
| **Equal Interval** | Intuitive; best when data is uniformly distributed |
| **Std Deviation** | Showing deviation from the mean |
| **Manual** | When you have domain-specific thresholds |

---

## Colorblind-Safe Palettes

Palettes marked ✓CB are perceptually uniform and safe for all major types of color vision deficiency (deuteranopia, protanopia, tritanopia):

- **Viridis** ✓CB
- **Cividis** ✓CB
- **Plasma** ✓CB
- **YlGnBu** ✓CB

---

## Technology Stack

| Library | Purpose |
|---------|---------|
| [Leaflet.js](https://leafletjs.com/) v1.9 | Interactive map rendering |
| [shpjs](https://github.com/calvinmetcalf/shapefile-js) v4 | Shapefile parsing in the browser |
| [PapaParse](https://www.papaparse.com/) v5 | CSV parsing |
| [simple-statistics](https://simplestatistics.org/) v7 | Jenks natural breaks algorithm |
| [html2canvas](https://html2canvas.hertzen.com/) v1 | PNG export |

All libraries loaded from CDN. No npm, no build step.

---

## File Structure

```
gis-tool/
├── index.html        main application
├── css/
│   └── style.css     styling
├── js/
│   ├── palettes.js   ColorBrewer + Viridis color definitions
│   ├── classify.js   classification algorithms (Jenks, quantile, etc.)
│   ├── map.js        Leaflet map setup and layer management
│   └── app.js        main application logic
└── README.md
```

---

## Cite

If you use EpiMap in your work, please cite:

> Subedi, R. (2025). *EpiMap: Browser-based GIS Visualization Tool*. GitHub. https://github.com/rajsubediresearch/gis-tool

A Zenodo DOI will be added upon first release.

---

## License

MIT © Raj Subedi

---

## Related Tools

- [Age Standardization Dashboard](https://rajsubediresearch.github.io/age-standardization-dashboard/)
- [Biostat Explorer](https://rajsubediresearch.github.io/biostat-explorer/)
- [EpiModel Concepts](https://rajsubediresearch.github.io/epimodelconcepts/)
