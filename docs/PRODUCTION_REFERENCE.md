# Production path reference (Camões 172)

This starter pack mirrors modules from the paths below. Edit files only under `exports/webgis-starter-pack/` when experimenting.

## Analysis → WebGIS pipeline

| Step | Location |
|------|----------|
| Study docs | `analysis/camoes_172/` |
| Base layer ETL | `analysis/camoes_172/scripts/webgis/build_viewer_base_layers.py` |
| T03 → JSON | `analysis/camoes_172/T03/scripts/sync_t03_to_webgis.py` |
| T04 → JSON | `analysis/camoes_172/T04/scripts/sync_t04_to_webgis.py` |
| Published GeoJSON | `webgis/ombu-narrativo/data/map_geojson/` |

## Viewer (production)

| Module | Path |
|--------|------|
| Main HTML | `webgis/ombu-narrativo/camoes172/mapa-dashboard/mapa_2d.html` |
| Runtime | `webgis/ombu-narrativo/camoes172/mapa-dashboard/js/mapa_2d.js` |
| Base layers | `webgis/ombu-narrativo/camoes172/mapa-dashboard/js/viewer_base_layers.js` |
| Palette | `webgis/ombu-narrativo/camoes172/mapa-dashboard/js/ombu_palette_tokens.js` |
| Per-map JSON (legacy) | `webgis/ombu-narrativo/camoes172/mapa-dashboard/config/t1_map_layers.json`, … |
| Guide | `docs/guides/webgis/README.md` |

## Build requirements (production)

- **Runtime**: static files + HTTP server; Leaflet/Turf/CDN plugins loaded in `mapa_2d.html`
- **No bundler** for the 2D viewer
- **Python 3** for GeoJSON ETL scripts (stdlib + repo PostGIS helpers in full pipeline)
- **PostGIS** for analytical source layers (not bundled in starter)

## Layer config shapes

**Legacy JSON** (used by starter demo): array of `{ id, label, type, url, style, visible }`.

**Production embedded config** (`mapa_2d.js`): `RAW_MAP_CONFIG` entries with `render`, `framing`, `visibleLayers`, `legend`, etc.

Both consume the same published GeoJSON folder.
