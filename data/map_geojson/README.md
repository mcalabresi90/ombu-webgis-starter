# Published map layers (`map_geojson/`)

This folder is the **2D publication contract** used by the starter viewer (same layout as production `webgis/ombu-narrativo/data/map_geojson/`).

## Formats

| Format | Use in starter | Notes |
|--------|----------------|-------|
| **GeoJSON** | Yes (required) | One file per layer; WGS84 (`EPSG:4326`); `FeatureCollection` preferred. |
| **PMTiles** | Not in starter demo | Production 3D / MapLibre paths may use vector tiles; add via MapLibre when scaling up. |

## Placeholder files shipped

Synthetic geometries only — safe to delete and replace with your study exports.

- `site_boundary.geojson` — parcel / AOI polygon
- `buffer_500m.geojson`, `buffer_1000m.geojson` — context rings
- `neighborhoods.geojson` — district polygons
- `quadras.geojson`, `road_hierarchy.geojson`, `ciclovias.geojson`, `hidrografia.geojson` — structural base (see `viewer/js/viewer_base_layers.js`)

## Production pipeline (reference)

```text
PostGIS → export script → map_geojson/*.geojson → viewer
```

Camões 172 example: `analysis/camoes_172/scripts/webgis/build_viewer_base_layers.py` (copied under `scripts/` in this pack).
