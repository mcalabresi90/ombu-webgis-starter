/**
 * Minimal WebGIS demo runtime (starter pack).
 * Mirrors the production contract: GeoJSON under data/map_geojson/, layer JSON under config/.
 * Production full runtime: webgis/ombu-narrativo/camoes172/mapa-dashboard/js/mapa_2d.js
 */
(function () {
  'use strict';

  const RUNTIME_VERSION = 'starter-1';
  const DATA_BASE = new URL('../../data/map_geojson/', window.location.href);
  const CONFIG_BASE = new URL('../config/', window.location.href);
  const PALETTE = window.OMBU_PALETTE_TOKENS || {};
  const BASE_CFG = (window.OMBU_VIEWER_BASE_LAYERS && window.OMBU_VIEWER_BASE_LAYERS.CONFIG) || {};
  const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';

  const MAP_REGISTRY = Object.freeze({
    'demo-site-context': {
      title: 'Demo — Site context',
      subtitle: 'Study boundary, buffers, and structural base layers.',
      configFile: 'demo_map_layers.json'
    }
  });

  const state = {
    map: null,
    layers: {},
    config: null,
    mapKey: 'demo-site-context'
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(text) {
    const el = $('map-status');
    if (el) el.textContent = text;
  }

  function resolveMapKey() {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('map') || 'demo-site-context').trim();
    return MAP_REGISTRY[raw] ? raw : 'demo-site-context';
  }

  function geojsonUrl(filename) {
    const u = new URL(filename, DATA_BASE);
    u.searchParams.set('v', RUNTIME_VERSION);
    return u.href;
  }

  async function fetchGeoJSON(filename) {
    const res = await fetch(geojsonUrl(filename), { cache: 'default' });
    if (!res.ok) throw new Error(`GeoJSON ${filename}: HTTP ${res.status}`);
    return res.json();
  }

  async function fetchConfig(filename) {
    const u = new URL(filename, CONFIG_BASE);
    u.searchParams.set('v', RUNTIME_VERSION);
    const res = await fetch(u.href, { cache: 'default' });
    if (!res.ok) throw new Error(`Config ${filename}: HTTP ${res.status}`);
    return res.json();
  }

  function leafletStyleFromConfig(style) {
    const s = style || {};
    return {
      color: s.color || '#4b2e2e',
      weight: s.weight != null ? s.weight : 1,
      opacity: s.opacity != null ? s.opacity : 1,
      fillColor: s.fillColor || s.color || '#c06158',
      fillOpacity: s.fillOpacity != null ? s.fillOpacity : 0.2,
      dashArray: s.dashArray || null
    };
  }

  function roadStyleForFeature(feature) {
    const mod = window.OMBU_VIEWER_BASE_LAYERS;
    const cls = mod && mod.normalizeRoadHierarchyClass
      ? mod.normalizeRoadHierarchyClass((feature.properties || {}).road_class || (feature.properties || {}).highway)
      : 'tertiary';
    const styles = (BASE_CFG.roadHierarchy && BASE_CFG.roadHierarchy.styles) || {};
    const bucket = styles[cls] || styles.tertiary || { color: '#b19888', weight: 2, opacity: 0.7, dashArray: '' };
    return {
      color: bucket.color,
      weight: bucket.weight,
      opacity: bucket.opacity,
      dashArray: bucket.dashArray || null
    };
  }

  async function addGeoJsonLayer(id, filename, options) {
    const gj = await fetchGeoJSON(filename);
    const layer = L.geoJSON(gj, options).addTo(state.map);
    state.layers[id] = layer;
    return layer;
  }

  async function loadStructuralBase() {
    const quadCfg = BASE_CFG.quadras || {};
    await addGeoJsonLayer('quadras_base', `${quadCfg.dataset || 'quadras'}.geojson`, {
      style: () => ({
        color: quadCfg.color || 'rgba(0,0,0,0)',
        weight: quadCfg.weight || 0,
        fillColor: quadCfg.fillColor || '#f2f2f2',
        fillOpacity: quadCfg.fillOpacity != null ? quadCfg.fillOpacity : 0.88
      })
    });

    await addGeoJsonLayer('road_hierarchy_base', `${(BASE_CFG.roadHierarchy && BASE_CFG.roadHierarchy.dataset) || 'road_hierarchy'}.geojson`, {
      style: (feature) => roadStyleForFeature(feature)
    });

    const cycleCfg = BASE_CFG.ciclovias || {};
    await addGeoJsonLayer('ciclovias_base', `${cycleCfg.dataset || 'ciclovias'}.geojson`, {
      style: () => ({
        color: cycleCfg.color || '#6b9b6b',
        weight: cycleCfg.weight || 2,
        opacity: cycleCfg.opacity || 0.9,
        dashArray: cycleCfg.dashArray || '4,4'
      })
    });

    const hydroCfg = BASE_CFG.hidrografia || {};
    await addGeoJsonLayer('hidrografia_base', `${hydroCfg.dataset || 'hidrografia'}.geojson`, {
      style: () => ({
        color: hydroCfg.color || '#5a8ba8',
        weight: hydroCfg.weight || 1.6,
        opacity: hydroCfg.opacity || 0.72
      })
    });
  }

  function addMarkerLayer(entry) {
    const pos = entry.position;
    if (!Array.isArray(pos) || pos.length < 2) return null;
    const color = (entry.style && entry.style.color) || ((PALETTE.solids && PALETTE.solids.lote_pin) || '#c06158');
    const layer = L.circleMarker([pos[1], pos[0]], {
      radius: (entry.style && entry.style.size) ? entry.style.size / 2 : 9,
      color,
      fillColor: color,
      fillOpacity: (entry.style && entry.style.opacity) != null ? entry.style.opacity : 1,
      weight: 2
    });
    if (entry.visible !== false) layer.addTo(state.map);
    state.layers[entry.id] = layer;
    return layer;
  }

  async function loadConfigLayers(config) {
    const list = Array.isArray(config.layers) ? config.layers : [];
    for (let i = 0; i < list.length; i += 1) {
      const entry = list[i];
      if (!entry) continue;
      if (entry.type === 'marker') {
        addMarkerLayer(entry);
        continue;
      }
      if (entry.type !== 'geojson') continue;
      const file = entry.url ? entry.url.replace(/^.*\//, '') : `${entry.id}.geojson`;
      const layer = await addGeoJsonLayer(entry.id, file, {
        style: () => leafletStyleFromConfig(entry.style)
      });
      if (entry.visible === false) state.map.removeLayer(layer);
    }
  }

  function renderLayerControls(config) {
    const host = $('layer-list');
    if (!host) return;
    host.innerHTML = '';
    const structural = [
      ['quadras_base', 'Blocks (base)'],
      ['road_hierarchy_base', 'Road hierarchy (base)'],
      ['ciclovias_base', 'Cycleways (base)'],
      ['hidrografia_base', 'Hydrography (base)']
    ];
    const thematic = (config.layers || []).map((l) => [l.id, l.label || l.id]);
    [...structural, ...thematic].forEach(([id, label]) => {
      const layer = state.layers[id];
      if (!layer) return;
      const row = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = state.map.hasLayer(layer);
      cb.addEventListener('change', () => {
        if (cb.checked) layer.addTo(state.map);
        else state.map.removeLayer(layer);
      });
      row.appendChild(cb);
      row.appendChild(document.createTextNode(label));
      host.appendChild(row);
    });
  }

  function renderLegend(config) {
    const host = $('legend-list');
    if (!host) return;
    host.innerHTML = '';
    (config.layers || []).forEach((entry) => {
      if (!entry || !entry.style) return;
      const row = document.createElement('div');
      row.className = 'legend-item';
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = entry.style.fillColor || entry.style.color || '#ccc';
      row.appendChild(sw);
      row.appendChild(document.createTextNode(entry.label || entry.id));
      host.appendChild(row);
    });
  }

  function fitToConfig(config) {
    const center = config.center;
    const zoom = config.zoom != null ? config.zoom : 14;
    if (Array.isArray(center) && center.length >= 2) {
      state.map.setView([center[1], center[0]], zoom);
      return;
    }
    const boundsLayer = state.layers.site_boundary || state.layers.buffer_1000m;
    if (boundsLayer && typeof boundsLayer.getBounds === 'function') {
      state.map.fitBounds(boundsLayer.getBounds(), { padding: [24, 24] });
    }
  }

  async function init() {
    state.mapKey = resolveMapKey();
    const entry = MAP_REGISTRY[state.mapKey];
    $('map-title').textContent = entry.title;
    $('map-subtitle').textContent = entry.subtitle;

    state.map = L.map('map', { zoomControl: true, attributionControl: true });
    L.tileLayer(TILE_URL, {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(state.map);

    setStatus('Loading structural layers…');
    await loadStructuralBase();

    setStatus('Loading map config…');
    const config = await fetchConfig(entry.configFile);
    state.config = config;
    await loadConfigLayers(config);
    fitToConfig(config);
    renderLayerControls(config);
    renderLegend(config);
    setStatus('Ready — served from data/map_geojson/');
  }

  init().catch((err) => {
    console.error(err);
    setStatus(`Error: ${err.message}`);
  });
})();
