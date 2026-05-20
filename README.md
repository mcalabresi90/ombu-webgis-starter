# Ombu WebGIS Starter Pack

Minimal, copy-pasteable WebGIS demo extracted from the **Camões 172** analysis stack (`analysis/camoes_172` + `webgis/ombu-narrativo`). Production code in the main repo is **unchanged**; this folder is a standalone export.

## What you get

| Piece | Role |
|-------|------|
| `viewer/mapa_demo.html` | Leaflet map entry point |
| `viewer/js/starter_viewer.js` | Slim demo runtime (JSON-driven layers) |
| `viewer/js/ombu_palette_tokens.js` | Canonical color / ramp tokens |
| `viewer/js/viewer_base_layers.js` | Structural base layer contract (blocks, roads, cycleways, hydro) |
| `viewer/config/demo_map_layers.json` | Sample thematic layer config |
| `data/map_geojson/` | Placeholder GeoJSON (no client data) |
| `scripts/build_viewer_base_layers.py` | Reference ETL to derive base layers from road/quadra sources |

Production full runtime (~700 KB): `webgis/ombu-narrativo/camoes172/mapa-dashboard/js/mapa_2d.js` — multi-map dossier viewer with embedded `MAP_CONFIG`. Not copied here by design; see `MIGRATION_REPORT.md`.

## Install

No npm build step. Dependencies load from CDN in the HTML:

- [Leaflet 1.9.4](https://leafletjs.com/)
- Carto basemap tiles (network required)

Optional (for ETL only):

- Python 3.10+ with stdlib only for `scripts/build_viewer_base_layers.py`

Copy the entire `webgis-starter-pack` folder into your new demo repo and keep this layout:

```text
your-repo/
  viewer/
  data/map_geojson/
  scripts/          # optional
```

## Demos in this repo

| Demo | Path | Description |
|------|------|-------------|
| **Generic starter** | `viewer/mapa_demo.html` | Placeholder site context (copy-paste template) |
| **Stuttgart prototype** | `demos/stuttgart/` | ALKIS cadastral WMS + OSM GeoJSON ([ETL-Geodata-Pipeline](https://github.com/Manoela-Calabresi-Portfolio/ETL-Geodata-Pipeline) layer taxonomy) |

Stuttgart details: `demos/stuttgart/DATA_INTEGRATION_NOTES.md`

## Run locally

**Important:** serve the **repository root** so `viewer/`, `data/`, and `demos/` share a common ancestor.

```bash
git clone https://github.com/mcalabresi90/ombu-webgis-starter.git
cd ombu-webgis-starter
python -m http.server 8080
```

Open:

- http://localhost:8080/ — demo index  
- http://localhost:8080/viewer/mapa_demo.html?map=demo-site-context  
- http://localhost:8080/demos/stuttgart/ — **Stuttgart spatial prototype**

Do **not** open HTML via `file://` — browsers block GeoJSON fetches.

## Expected data format

### GeoJSON (2D contract)

- CRS: WGS84 longitude/latitude (`EPSG:4326`)
- Type: `FeatureCollection` with named properties for styling joins
- One published file per layer (e.g. `site_boundary.geojson`, `road_hierarchy.geojson`)
- Road hierarchy features should expose `road_class` or `highway` (`primary`, `secondary`, `tertiary`, `trunk`, …) for `viewer_base_layers.js` styling

### PMTiles

Not used by this starter demo. Production 3D viewers (`mapa_3d_lidar.html`, MapLibre) may use vector/terrain tiles separately. If you adopt PMTiles, place them under e.g. `data/pmtiles/` and wire a MapLibre source — out of scope for the Leaflet starter.

### JSON sidecars (production)

Camões pipeline also publishes analysis JSON under `webgis/ombu-narrativo/data/t3_*.json`, `t4_*.json` for dossier slides. Omitted from this pack (no secrets / no client metrics).

## Where files go

| Path | Contents |
|------|----------|
| `data/map_geojson/` | All 2D layers consumed by the viewer |
| `viewer/config/` | Per-map layer manifests (`*_map_layers.json`) |
| `viewer/js/` | Runtime + shared tokens (edit palette here) |

After PostGIS export in a full project:

```text
PostGIS → publish script → data/map_geojson/*.geojson → viewer
```

## How to add a new layer

1. **Export** your layer to `data/map_geojson/my_layer.geojson`.
2. **Register** it in `viewer/config/demo_map_layers.json`:

```json
{
  "id": "my_layer",
  "label": "My layer",
  "type": "geojson",
  "visible": true,
  "url": "../../data/map_geojson/my_layer.geojson",
  "style": {
    "color": "#4b2e2e",
    "weight": 1.2,
    "opacity": 0.9,
    "fillColor": "#c06158",
    "fillOpacity": 0.2
  }
}
```

3. **Reload** the demo page. The layer appears in the sidebar toggles and legend.

For **structural** layers shared by every map (blocks, classified roads), update `viewer/js/viewer_base_layers.js` and add the GeoJSON file name there — same pattern as production.

For a **new map** in the starter:

1. Add a JSON config under `viewer/config/`.
2. Register it in `MAP_REGISTRY` inside `viewer/js/starter_viewer.js`.
3. Open `?map=your-map-key`.

To graduate to the production viewer, copy `mapa_2d.js` / `mapa_2d.html` from the main repo and extend `RAW_MAP_CONFIG` with a custom `render*` function per map.

## Production references

- WebGIS guide: `docs/guides/webgis/README.md` (main repo)
- Camões map dashboard: `webgis/ombu-narrativo/camoes172/mapa-dashboard/`
- Base layer builder: `analysis/camoes_172/scripts/webgis/build_viewer_base_layers.py`
- YAML map configs (QGIS / PostGIS): `config/webgis/camoes_maps.yaml`, `config/webgis/morphology_mvp.yaml`

## License / data

Placeholder geometries only. Replace before shipping a client-facing demo.
