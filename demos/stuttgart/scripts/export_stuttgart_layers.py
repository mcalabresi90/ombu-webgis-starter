#!/usr/bin/env python3
"""
Export lightweight GeoJSON for the Stuttgart spatial prototype.

Primary path: read processed layers from a local ETL-Geodata-Pipeline clone
  (data/processed/stuttgart/*.parquet or data/staging/stuttgart/*.parquet).

Fallback: Overpass API bbox query (Stuttgart-Mitte) — same OSM source the ETL uses,
  without PostGIS or full QuackOSM pipeline.

Usage (from this folder):
  python scripts/export_stuttgart_layers.py
  python scripts/export_stuttgart_layers.py --etl-root ../ETL-Geodata-Pipeline
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

# Stuttgart-Mitte study window (matches viewer)
BBOX = {"south": 48.7718, "west": 9.1725, "north": 48.7818, "east": 9.1925}

PROTOTYPE_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = PROTOTYPE_ROOT / "data" / "map_geojson"

ETL_LAYER_MAP = {
    "roads": ["roads", "osm_roads"],
    "buildings": ["buildings", "osm_buildings"],
    "pois": ["amenities", "osm_amenities"],
    "transit": ["pt_stops", "osm_pt_stops", "public_transport"],
    "cycleways": ["cycle", "osm_cycle", "cycleways"],
    "green_areas": ["landuse", "osm_landuse", "green_spaces"],
}


def overpass_query() -> str:
    b = BBOX
    return f"""[out:json][timeout:90];
(
  way["highway"]({b['south']},{b['west']},{b['north']},{b['east']});
  way["building"]({b['south']},{b['west']},{b['north']},{b['east']});
  node["amenity"]({b['south']},{b['west']},{b['north']},{b['east']});
  node["public_transport"]({b['south']},{b['west']},{b['north']},{b['east']});
  node["railway"~"^(station|halt|tram_stop|subway_entrance)$"]({b['south']},{b['west']},{b['north']},{b['east']});
  node["highway"="bus_stop"]({b['south']},{b['west']},{b['north']},{b['east']});
  way["highway"~"^(cycleway|path)$"]["bicycle"]({b['south']},{b['west']},{b['north']},{b['east']});
  way["cycleway"]({b['south']},{b['west']},{b['north']},{b['east']});
  way["landuse"~"^(forest|grass|meadow|recreation_ground)$"]({b['south']},{b['west']},{b['north']},{b['east']});
  way["leisure"~"^(park|garden|nature_reserve)$"]({b['south']},{b['west']},{b['north']},{b['east']});
  relation["leisure"="park"]({b['south']},{b['west']},{b['north']},{b['east']});
);
out geom;"""


def fetch_overpass() -> dict[str, Any]:
    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({"data": overpass_query()}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    req.add_header("User-Agent", "ombu-stuttgart-spatial-prototype/1.0 (demo export)")
    req.add_header("Accept", "application/json")
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def slim_props(tags: dict[str, Any], keys: list[str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k in keys:
        if k in tags and tags[k] not in (None, ""):
            out[k] = tags[k]
    if "name" in tags:
        out["name"] = tags["name"]
    return out


def osm_elements_to_features(elements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    features: list[dict[str, Any]] = []
    for el in elements:
        tags = el.get("tags") or {}
        if el["type"] == "node" and "lat" in el and "lon" in el:
            features.append(
                {
                    "type": "Feature",
                    "properties": {"osm_id": el.get("id"), **tags},
                    "geometry": {"type": "Point", "coordinates": [el["lon"], el["lat"]]},
                }
            )
            continue
        geom = el.get("geometry")
        if not geom:
            continue
        coords = [[pt["lon"], pt["lat"]] for pt in geom]
        if el["type"] == "way":
            is_closed = len(coords) > 2 and coords[0] == coords[-1]
            is_poly = bool(tags.get("building") or tags.get("landuse") or tags.get("leisure"))
            if is_poly or (is_closed and (tags.get("landuse") or tags.get("leisure"))):
                geometry = {"type": "Polygon", "coordinates": [coords]}
            else:
                geometry = {"type": "LineString", "coordinates": coords}
        elif el["type"] == "relation":
            continue
        else:
            continue
        features.append(
            {"type": "Feature", "properties": {"osm_id": el.get("id"), **tags}, "geometry": geometry}
        )
    return features


def classify_feature(props: dict[str, Any], geom_type: str) -> str | None:
    if props.get("building"):
        return "buildings"
    if props.get("highway"):
        hw = str(props.get("highway", "")).lower()
        if hw in ("cycleway", "path") or props.get("cycleway") or props.get("bicycle") == "designated":
            return "cycleways"
        return "roads"
    if props.get("amenity"):
        return "pois"
    if props.get("public_transport") or props.get("railway") or props.get("highway") == "bus_stop":
        return "transit"
    if props.get("landuse") in ("forest", "grass", "meadow", "recreation_ground") or props.get("leisure") in (
        "park",
        "garden",
        "nature_reserve",
    ):
        return "green_areas"
    return None


def split_collections(features: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    buckets: dict[str, list[dict[str, Any]]] = {k: [] for k in ETL_LAYER_MAP}
    for f in features:
        props = f.get("properties") or {}
        geom = f.get("geometry") or {}
        layer = classify_feature(props, geom.get("type", ""))
        if not layer:
            continue
        slim = dict(f)
        if layer == "roads":
            slim["properties"] = slim_props(props, ["highway", "name", "osm_id"])
        elif layer == "buildings":
            slim["properties"] = slim_props(props, ["building", "building:levels", "name", "osm_id"])
        elif layer == "pois":
            slim["properties"] = slim_props(props, ["amenity", "name", "osm_id"])
        elif layer == "transit":
            slim["properties"] = slim_props(
                props, ["public_transport", "railway", "highway", "name", "operator", "osm_id"]
            )
        elif layer == "cycleways":
            slim["properties"] = slim_props(props, ["highway", "cycleway", "name", "osm_id"])
        elif layer == "green_areas":
            slim["properties"] = slim_props(props, ["landuse", "leisure", "name", "osm_id"])
        buckets[layer].append(slim)
    return buckets


def write_geojson(path: Path, features: list[dict[str, Any]]) -> None:
    payload = {"type": "FeatureCollection", "features": features}
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def try_etl_parquet(etl_root: Path) -> dict[str, list[dict[str, Any]]] | None:
    try:
        import geopandas as gpd
    except ImportError:
        return None

    search_dirs = [
        etl_root / "data" / "processed" / "stuttgart",
        etl_root / "data" / "staging" / "stuttgart",
        etl_root / "data_final" / "stuttgart",
        etl_root / "cities" / "stuttgart" / "data" / "processed",
    ]
    files: list[Path] = []
    for d in search_dirs:
        if d.is_dir():
            files.extend(d.glob("*.parquet"))
            files.extend(d.glob("*.gpkg"))

    if not files:
        return None

    b = BBOX
    bbox = (b["west"], b["south"], b["east"], b["north"])
    out: dict[str, list[dict[str, Any]]] = {k: [] for k in ETL_LAYER_MAP}

    for path in files:
        stem = path.stem.lower()
        target = None
        for out_name, aliases in ETL_LAYER_MAP.items():
            if any(a in stem for a in aliases):
                target = out_name
                break
        if not target:
            continue
        try:
            gdf = gpd.read_file(path)
            if gdf.crs and str(gdf.crs) != "EPSG:4326":
                gdf = gdf.to_crs(4326)
            gdf = gdf.cx[bbox[0] : bbox[2], bbox[1] : bbox[3]]
            if len(gdf) == 0:
                continue
            fc = json.loads(gdf.to_json())
            out[target].extend(fc.get("features", []))
            print(f"  ETL: {path.name} -> {target} ({len(gdf)} features)")
        except Exception as exc:
            print(f"  skip {path.name}: {exc}", file=sys.stderr)

    if not any(out.values()):
        return None
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--etl-root",
        type=Path,
        default=None,
        help="Local clone of ETL-Geodata-Pipeline (optional; e.g. ../../../ETL-Geodata-Pipeline)",
    )
    args = parser.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    buckets: dict[str, list[dict[str, Any]]] | None = None
    source = "overpass"

    etl_root = args.etl_root or (PROTOTYPE_ROOT.parent.parent.parent / "ETL-Geodata-Pipeline")
    if etl_root.is_dir():
        print(f"Checking ETL processed data: {etl_root}")
        buckets = try_etl_parquet(etl_root)
        if buckets:
            source = "etl-local"

    if not buckets:
        print("No local ETL parquet found — fetching OSM via Overpass (Stuttgart-Mitte bbox)...")
        osm = fetch_overpass()
        features = osm_elements_to_features(osm.get("elements", []))
        buckets = split_collections(features)
        source = "overpass-etl-taxonomy"

    manifest: dict[str, Any] = {"source": source, "bbox": BBOX, "layers": {}}
    for name, feats in buckets.items():
        out_path = OUT_DIR / f"{name}.geojson"
        write_geojson(out_path, feats)
        manifest["layers"][name] = {"file": out_path.name, "features": len(feats)}
        print(f"  wrote {out_path.name} ({len(feats)} features)")

    (OUT_DIR / "export_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print(f"Done. Source: {source}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
