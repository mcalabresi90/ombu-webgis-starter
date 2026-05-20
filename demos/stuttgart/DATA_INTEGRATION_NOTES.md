# Data integration notes — Stuttgart prototype

## External ETL repo

| Item | Value |
|------|--------|
| Repository | [ETL-Geodata-Pipeline](https://github.com/Manoela-Calabresi-Portfolio/ETL-Geodata-Pipeline) |
| Local clone (this workspace) | `exports/ETL-Geodata-Pipeline/` |
| City module | `cities/stuttgart/` |
| Layer taxonomy | `roads`, `buildings`, `amenities` → **pois**, `pt_stops` → **transit**, `cycle` → **cycleways**, `landuse` (green) → **green_areas** |

Processed parquet/geojson are **not in git** (see ETL `.gitignore`). This prototype ships **pre-exported** GeoJSON under `data/map_geojson/`.

## Layer inventory

| Viewer layer | File | Source in this demo | Status |
|--------------|------|---------------------|--------|
| **Official Parcels / ALKIS** | — (WMS tiles) | [LGL-BW INSPIRE WMS](https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_INSP_BW_Flst_ALKIS) · `alkis:CP.CadastralParcel` | Live WMS |
| Roads | `roads.geojson` | OSM via export script (ETL layer name `roads`) | Exported |
| Buildings | `buildings.geojson` | OSM · ETL `buildings` | Exported |
| Amenities | `pois.geojson` | OSM · ETL `amenities` | Exported |
| Transit | `transit.geojson` | OSM · ETL `pt_stops` | Exported |
| Cycleways | `cycleways.geojson` | OSM · ETL `cycle` | Exported |
| Green areas | `green_areas.geojson` | OSM landuse/leisure · ETL `landuse` subset | Exported |
| Future market layer | — | UI placeholder only | Not implemented |

Export manifest: `data/map_geojson/export_manifest.json`

## What was not used

- PostGIS / database loaders from ETL
- Full QuackOSM / `process_layers.py` pipeline run (no local PBF staging in clone)
- ALKIS download via ETL (parcels stay **WMS only**)
- WFS, PMTiles, backend API

## How to regenerate GeoJSON

From the repository root (`ombu-webgis-starter/`) or `demos/stuttgart/`:

```bash
python scripts/export_stuttgart_layers.py
```

**Path A — local ETL outputs (preferred when you have them):**

1. Run or copy processed layers into the ETL clone, e.g. `data/processed/stuttgart/*.parquet`
2. Re-run the script; it clips to the Stuttgart-Mitte bbox and writes GeoJSON.

**Path B — fallback (used for the bundled demo):**

- Overpass API query for the same bbox as the map
- Feature split uses **ETL-Geodata-Pipeline layer names** (`export_manifest.json` → `source: overpass-etl-taxonomy`)

Requires network; ~5–15 s for the central window.

## Run the demo locally

```bash
cd ombu-webgis-starter
python -m http.server 8080
```

Open: **http://localhost:8080/demos/stuttgart/**

Do not use `file://` (browser blocks GeoJSON fetch).

## Limitations

- **BBox** is a small Stuttgart-Mitte window (~1 km), not the full city in `city.yaml` (`9.0–9.4, 48.6–48.9`).
- **ALKIS WMS** depends on LGL BW uptime; no offline parcels.
- **POI density** is raw OSM amenities, not ETL’s 21-category amenity rollup.
- **No market layer** — card is narrative only for the call.
- Re-export overwrites GeoJSON; commit only if you intend to version demo data.

## Success criteria (this build)

- ALKIS parcels visible on load (WMS on top)
- Roads + buildings + cycleways + green areas from static files
- POIs + transit points when export succeeded
- Sidebar + prototype caption unchanged
- No database required at view time
