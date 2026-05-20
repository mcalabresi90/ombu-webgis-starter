# Migration report — WebGIS starter pack

Generated from `ombu-piloto` for `analysis/camoes_172` WebGIS stack. **No production files were modified, renamed, or deleted.**

## Copied files

### Runtime & styling

| Source (repo) | Destination (starter pack) |
|---------------|----------------------------|
| `webgis/ombu-narrativo/camoes172/mapa-dashboard/js/ombu_palette_tokens.js` | `viewer/js/ombu_palette_tokens.js` |
| `webgis/ombu-narrativo/camoes172/mapa-dashboard/js/viewer_base_layers.js` | `viewer/js/viewer_base_layers.js` |

### ETL reference

| Source | Destination |
|--------|-------------|
| `analysis/camoes_172/scripts/webgis/build_viewer_base_layers.py` | `scripts/build_viewer_base_layers.py` |

### New files (not in production)

| File | Purpose |
|------|---------|
| `viewer/mapa_demo.html` | Demo entry HTML |
| `viewer/index.html` | Redirect to demo map |
| `viewer/js/starter_viewer.js` | Minimal JSON-driven Leaflet runtime |
| `viewer/config/demo_map_layers.json` | Sample layer manifest |
| `data/map_geojson/*.geojson` (8 files) | Synthetic placeholder layers |
| `data/map_geojson/README.md` | Data contract notes |
| `README.md` | Install / run / extend guide |
| `MIGRATION_REPORT.md` | This report |

## Omitted files (and why)

| Category | Examples | Reason |
|----------|----------|--------|
| Full 2D runtime | `mapa_2d.js` (~701 KB), `mapa_2d.html` | Camões-specific `RAW_MAP_CONFIG`, 15+ render pipelines; starter uses slim `starter_viewer.js` instead |
| Dossier / slides | `dossie_slides.html`, `dossie_v2/*`, `01-*.html` … | Client deliverable shell, not required for map demo |
| 3D / MapLibre | `mapa_3d_lidar.html`, `geocuritiba_maplibre.js`, `scenes/*` | Separate engine; needs terrain/tiles and optional IPPUC overlays |
| Map Editor (legacy) | `webgis/ombu-narrativo/map-editor/*` | Deprecated authoring path per project docs |
| Published GeoJSON (real) | `webgis/ombu-narrativo/data/map_geojson/*` | Client / study geometries — replaced by placeholders |
| Analysis JSON | `t3_*.json`, `t4_*.json`, `deck_*.json` | Fiscal / scenario payloads; not needed for base map demo |
| QGIS / PostGIS configs | `config/webgis/camoes_maps.yaml`, `morphology_mvp.yaml` | Backend-only; document in README, not copied |
| Sync scripts | `sync_t03_to_webgis.py`, `sync_t04_to_webgis.py`, `build_s7_*` | Project pipeline, not viewer bootstrap |
| Assets | `img/bus_stop.svg`, logos, archetype SVGs | UI chrome for full dossier |
| Secrets / env | `.env`, DB credentials, Bright Data | Explicitly excluded |
| `legenda_simbologia_aoi.js` | — | AOI T02 barrier symbology; optional for mercado maps only |

## Assumptions

1. **HTTP server root** is the starter pack folder (or equivalent with `viewer/` + `data/` siblings), matching production’s `webgis/ombu-narrativo` layout.
2. **2D contract** remains GeoJSON-on-disk; PostGIS is the analytical source of truth in full Ombu projects.
3. **Basemap** uses public Carto CDN tiles; offline use requires swapping tile URL in `starter_viewer.js`.
4. **Palette tokens** in the copied `ombu_palette_tokens.js` still reference Camões localStorage keys; harmless for demo, rename when forking.
5. **`build_viewer_base_layers.py`** paths still point at main-repo locations unless edited after copy (`DATA_DIR` comment added).
6. Starter demo map center uses **synthetic coordinates** near the Camões study area for visual familiarity — not real parcel geometry.

## Risks

| Risk | Mitigation |
|------|------------|
| Feature gap vs production viewer | Document upgrade path: copy `mapa_2d.js` + one `render*` template |
| Large GeoJSON in real projects | Consider PMTiles / vector tiles for national layers; starter stays GeoJSON |
| CORS / `file://` | Always use `python -m http.server` or static host |
| Token drift | Edit `ombu_palette_tokens.js` only for brand colors; run `sync_palette_docs.js` in main repo if syncing back |
| ETL script paths | Update `PROJECT_ROOT` / `DATA_DIR` after copying to a new repo |

## Next steps

1. **Replace placeholders** in `data/map_geojson/` with exports from your PostGIS publish step.
2. **Add maps** via new JSON configs + `MAP_REGISTRY` entries (starter) or migrate to full `mapa_2d.js` when you need choropleth / heat / label editing.
3. **Wire CI**: static deploy (Cloudflare Pages, GitHub Pages) with root = pack folder.
4. **Optional**: copy `legenda_simbologia_aoi.js` if you need AOI barrier hatch legends.
5. **Optional 3D**: add MapLibre examples from `mapa-dashboard/mapa_3d_lidar.html` as a second module.
6. **Rename storage keys** in `ombu_palette_tokens.js` (`ombu.camoes172.*`) to your project slug when publishing a fork.

## Quick inventory (starter pack)

```text
exports/webgis-starter-pack/
  README.md
  MIGRATION_REPORT.md
  viewer/
    index.html
    mapa_demo.html
    config/demo_map_layers.json
    js/
      starter_viewer.js
      ombu_palette_tokens.js
      viewer_base_layers.js
  data/map_geojson/
    README.md
    site_boundary.geojson
    buffer_500m.geojson
    buffer_1000m.geojson
    neighborhoods.geojson
    quadras.geojson
    road_hierarchy.geojson
    ciclovias.geojson
    hidrografia.geojson
  scripts/build_viewer_base_layers.py
```
