"""
Build structural base GeoJSON layers for the WebGIS viewer.

Starter pack copy: adjust DATA_DIR to your repo's data/map_geojson folder.
Production source: analysis/camoes_172/scripts/webgis/build_viewer_base_layers.py
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[4]
DATA_DIR = PROJECT_ROOT / "webgis" / "ombu-narrativo" / "data" / "map_geojson"

ROAD_SOURCE_FILES = ("vias_1000m.geojson", "vias_aoi.geojson")
QUADRA_SOURCE_FILE = "t1_02a_ocupacao_solo.geojson"


def read_geojson(filename: str) -> dict[str, Any]:
    path = DATA_DIR / filename
    raw = path.read_text(encoding="utf-8-sig")
    return json.loads(raw)


def write_geojson(filename: str, payload: dict[str, Any]) -> None:
    path = DATA_DIR / filename
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def normalized(value: Any) -> str:
    return str(value or "").strip()


def normalize_road_class(raw_value: Any) -> str:
    value = normalized(raw_value).lower()
    if value in {"motorway", "motorway_link", "trunk", "trunk_link"}:
        return "trunk"
    if value in {"primary", "primary_link"}:
        return "primary"
    if value in {"secondary", "secondary_link"}:
        return "secondary"
    if value in {"tertiary", "tertiary_link"}:
        return "tertiary"
    return ""


def is_cycle_feature(feature: dict[str, Any]) -> bool:
    props = feature.get("properties") or {}
    values = [
        props.get("classe"),
        props.get("tipo"),
        props.get("categoria"),
        props.get("infraestrutura"),
        props.get("modal"),
    ]
    for value in values:
        lowered = normalized(value).lower()
        if (
            "cycleway" in lowered
            or "cycle route" in lowered
            or "cycle_route" in lowered
            or "ciclovia" in lowered
            or "ciclorrota" in lowered
            or "ciclofaixa" in lowered
        ):
            return True
    return False


def feature_key(feature: dict[str, Any], class_name: str) -> str:
    props = feature.get("properties") or {}
    geom_key = json.dumps(feature.get("geometry"), separators=(",", ":"), ensure_ascii=False)
    via_id = normalized(props.get("via_id"))
    street_name = normalized(props.get("nome") or props.get("name"))
    return f"{class_name}|{via_id}|{street_name}|{geom_key}"


def build_road_hierarchy() -> dict[str, Any]:
    features: list[dict[str, Any]] = []
    seen: set[str] = set()

    for source_file in ROAD_SOURCE_FILES:
        geojson = read_geojson(source_file)
        for feature in geojson.get("features", []):
            road_class = normalize_road_class((feature.get("properties") or {}).get("classe"))
            if not road_class:
                continue
            key = feature_key(feature, road_class)
            if key in seen:
                continue
            seen.add(key)
            props = feature.get("properties") or {}
            features.append(
                {
                    "type": "Feature",
                    "geometry": feature.get("geometry"),
                    "properties": {
                        "road_class": road_class,
                        "highway": normalized(props.get("classe")).lower(),
                        "street_name": normalized(props.get("nome") or props.get("name")),
                        "via_id": normalized(props.get("via_id")),
                        "source_dataset": source_file,
                    },
                }
            )

    return {"type": "FeatureCollection", "features": features}


def build_cycleways() -> dict[str, Any]:
    features: list[dict[str, Any]] = []
    seen: set[str] = set()

    for source_file in ROAD_SOURCE_FILES:
        geojson = read_geojson(source_file)
        for feature in geojson.get("features", []):
            if not is_cycle_feature(feature):
                continue
            key = feature_key(feature, "cycle")
            if key in seen:
                continue
            seen.add(key)
            props = feature.get("properties") or {}
            features.append(
                {
                    "type": "Feature",
                    "geometry": feature.get("geometry"),
                    "properties": {
                        "category": "ciclovia",
                        "street_name": normalized(props.get("nome") or props.get("name")),
                        "highway": normalized(props.get("classe")).lower(),
                        "via_id": normalized(props.get("via_id")),
                        "source_dataset": source_file,
                    },
                }
            )

    return {"type": "FeatureCollection", "features": features}


def extract_lot_id(feature: dict[str, Any]) -> str:
    props = feature.get("properties") or {}
    return normalized(props.get("id_lote") or props.get("lote_id") or props.get("id") or props.get("fid"))


def derive_block_key(lot_id: str) -> str:
    digits = "".join(char for char in normalized(lot_id) if char.isdigit())
    return digits[:6] if len(digits) >= 6 else digits


def geometry_to_polygons(geometry: dict[str, Any] | None) -> list[Any]:
    if not geometry:
        return []
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if geometry_type == "Polygon":
        return [coordinates]
    if geometry_type == "MultiPolygon":
        return list(coordinates or [])
    return []


def build_quadras() -> dict[str, Any]:
    geojson = read_geojson(QUADRA_SOURCE_FILE)
    groups: dict[str, dict[str, Any]] = {}

    for feature in geojson.get("features", []):
        block_key = derive_block_key(extract_lot_id(feature))
        if not block_key:
            continue
        polygons = geometry_to_polygons(feature.get("geometry"))
        if not polygons:
            continue
        if block_key not in groups:
            groups[block_key] = {
                "type": "Feature",
                "geometry": {"type": "MultiPolygon", "coordinates": []},
                "properties": {
                    "quadra_id": block_key,
                    "spatial_unit": "quadra",
                    "lot_count": 0,
                },
            }
        groups[block_key]["geometry"]["coordinates"].extend(polygons)
        groups[block_key]["properties"]["lot_count"] += 1

    features = sorted(groups.values(), key=lambda feature: feature["properties"]["quadra_id"])
    return {"type": "FeatureCollection", "features": features}


def build_hidrografia() -> dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "features": [],
        "properties": {
            "note": "Camada estrutural reservada para hidrografia. Sem feições publicadas no recorte atual."
        },
    }


def main() -> None:
    write_geojson("road_hierarchy.geojson", build_road_hierarchy())
    write_geojson("ciclovias.geojson", build_cycleways())
    write_geojson("quadras.geojson", build_quadras())
    write_geojson("hidrografia.geojson", build_hidrografia())
    print("viewer base layers generated")


if __name__ == "__main__":
    main()
