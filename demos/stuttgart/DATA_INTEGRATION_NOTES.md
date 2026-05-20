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
| **Official Parcels / ALKIS** | — (WMS tiles) | [LGL-BW INSPIRE WMS](https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_INSP_BW_Flst_ALKIS) · `alkis:CP.CadastralParcel` | Live WMS · on by default |
| **Official land value zones / Bodenrichtwerte** | — (WMS tiles) | [WMS Bodenrichtwertkarte – Landeshauptstadt Stuttgart](https://metadaten.geoportal-bw.de/geonetwork/srv/api/records/1ffa90b9-f3f9-16d4-839e-db8af4066350) · `geoserver.stuttgart.de` layer `GEOLINE_FLEX:A62_BRWK25_Innenstadt_2025_EPSG25832` (same as [Stadtplan](https://maps.stuttgart.de/stadtplan/)) | Live WMS · **off by default** (opacity ~0.48) |
| Roads | `roads.geojson` | OSM via export script (ETL layer name `roads`) | Exported |
| Buildings | `buildings.geojson` | OSM · ETL `buildings` | Exported |
| Amenities | `pois.geojson` | OSM · ETL `amenities` | Exported |
| Transit | `transit.geojson` | OSM · ETL `pt_stops` | Exported |
| Cycleways | `cycleways.geojson` | OSM · ETL `cycle` | Exported |
| Green areas | `green_areas.geojson` | OSM landuse/leisure · ETL `landuse` subset | Exported |
| Client market / listings | — | Sidebar describes future overlay only | Not implemented |

Export manifest: `data/map_geojson/export_manifest.json`

## Bodenrichtwert WMS (official land value)

| Field | Value |
|-------|--------|
| **Origin** | Landeshauptstadt Stuttgart, Stadtmessungsamt (Gutachterausschuss) |
| **Service** | WMS Bodenrichtwertkarte – Landeshauptstadt Stuttgart |
| **Type** | WMS (raster map, zones with €/m² reference values) |
| **Endpoint** | `https://geoserver.stuttgart.de/geoserver/ows/` |
| **Layer name** | `GEOLINE_FLEX:A62_BRWK25_Innenstadt_2025_EPSG25832` (Innenstadt detail, 2025) |
| **Retired** | `gis5.stuttgart.de/.../WMS_BRWK` — ArcGIS 499 / service removed from REST catalog |
| **Layer id** | `0` (ArcGIS MapServer export) |
| **Metadata** | [Geoportal BW record](https://metadaten.geoportal-bw.de/geonetwork/srv/api/records/1ffa90b9-f3f9-16d4-839e-db8af4066350) |

**Limitation (important):** Bodenrichtwerte are **official land reference values** (*Bodenrichtwert*), not apartment **asking prices**, **transaction prices**, or Ombu market listings. Do not label this layer as “market price” or “sale price”.

Config: `viewer/config/demo_map_layers.json` → `wms.bodenrichtwert`.

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
- **Bodenrichtwert WMS** uses `geoserver.stuttgart.de` (not the retired `gis5` ArcGIS path). Detail layer is visible from scale **1:30 000** onward — zoom to Stuttgart-Mitte (~z15–16). If tiles fail, the status line shows a hint (Leaflet does not log WMS image errors to the console).
- **Click → €/m² in popup:** `getBRWbyCoords.json` (BORIS-BW / `gis-rest.nrw.de`) with GeoJSON `FeatureCollection` + `EPSG:4326` — same backend as the official BORIS portal. Config: `viewer/config/demo_map_layers.json` → `borisApi`.
- **Client market data** (listings, valuations) — not connected; sidebar describes future overlay only.
- Re-export overwrites GeoJSON; commit only if you intend to version demo data.

## Success criteria (this build)

- ALKIS parcels visible on load (WMS on top)
- Bodenrichtwert zones available as optional WMS (official €/m² reference)
- Roads + buildings + cycleways + green areas from static files
- POIs + transit points when export succeeded
- Sidebar + prototype caption unchanged
- No database required at view time
