# Ombu Spatial Layer · Stuttgart Prototype

Part of [ombu-webgis-starter](https://github.com/mcalabresi90/ombu-webgis-starter) (`demos/stuttgart/`).

Territorial demo for **Stuttgart-Mitte** — official **ALKIS** parcels (WMS) plus **OSM context** as static GeoJSON aligned with [ETL-Geodata-Pipeline](https://github.com/Manoela-Calabresi-Portfolio/ETL-Geodata-Pipeline).

Not a product build: no PostGIS, no backend, no full ETL run required to view.

## Quick start

From the **repository root** (not this subfolder alone):

```bash
cd ombu-webgis-starter
python -m http.server 8080
```

Open **http://localhost:8080/demos/stuttgart/** (not `file://`).

## Data

| Layer | Delivery |
|-------|----------|
| Parcels | ALKIS WMS (LGL Baden-Württemberg) |
| Roads, buildings, POIs, transit, cycleways, green | `data/map_geojson/*.geojson` |

See **DATA_INTEGRATION_NOTES.md** for provenance, gaps, and re-export.

## Regenerate OSM GeoJSON

```bash
python scripts/export_stuttgart_layers.py
```

Uses local ETL parquet if present under `../ETL-Geodata-Pipeline/`; otherwise Overpass for the Mitte bbox.

## ETL clone

```bash
git clone https://github.com/Manoela-Calabresi-Portfolio/ETL-Geodata-Pipeline.git ../ETL-Geodata-Pipeline
```

## Structure

```text
index.html
js/stuttgart_map.js
js/ombu_palette_tokens.js
viewer/config/demo_map_layers.json
data/map_geojson/
scripts/export_stuttgart_layers.py
```

Based on `exports/webgis-starter-pack` (palette only).
