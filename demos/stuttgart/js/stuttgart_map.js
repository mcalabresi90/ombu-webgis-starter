/**
 * Ombu Stuttgart spatial prototype
 * WMS: ALKIS parcels + Bodenrichtwertkarte (official) · OSM: static GeoJSON
 */
(function () {
  'use strict';

  const PALETTE = window.OMBU_PALETTE_TOKENS || {};
  const COLORS = Object.assign({
    ink: '#2f2222',
    terracotta: '#c06158',
    buildingFill: '#e7d8d0',
    buildingStroke: '#b19888',
    roadStructural: '#4b2e2e',
    roadArterial: '#7a8a9c',
    roadLocal: '#ddd7c4',
    amenity: '#c06158',
    transit: '#4b6279',
    focusRing: '#c06158'
  }, PALETTE.colors || {});

  const VIEW = { center: [48.7768, 9.1825], zoom: 16 };
  const DATA_BASE = new URL('data/map_geojson/', window.location.href);
  const CONFIG_URL = new URL('viewer/config/demo_map_layers.json', window.location.href);

  /** Layer control order (WMS + GeoJSON). */
  const CONTROL_ORDER = [
    'alkis',
    'bodenrichtwert',
    'roads',
    'buildings',
    'pois',
    'transit',
    'cycleways',
    'green_areas'
  ];

  const state = {
    map: null,
    layers: {},
    layerDefs: [],
    manifest: null,
    wmsConfig: {}
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg) {
    const el = $('status');
    if (el) el.textContent = msg;
  }

  function geojsonUrl(file) {
    const u = new URL(file, DATA_BASE);
    u.searchParams.set('v', (state.manifest && state.manifest.source) || '1');
    return u.href;
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'default' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }

  function roadStyle(feature) {
    const hw = String((feature.properties && feature.properties.highway) || '').toLowerCase();
    if (/^(motorway|trunk|primary)/.test(hw)) {
      return { color: COLORS.roadStructural, weight: 3.2, opacity: 0.9 };
    }
    if (/^(secondary|tertiary)/.test(hw)) {
      return { color: COLORS.roadArterial, weight: 2.2, opacity: 0.82, dashArray: '10 6' };
    }
    return { color: COLORS.roadLocal, weight: 1.2, opacity: 0.65 };
  }

  function styleFromConfig(entry) {
    const s = entry.style || {};
    if (entry.id === 'roads') {
      return (feature) => roadStyle(feature);
    }
    return () => ({
      color: s.color || COLORS.ink,
      weight: s.weight != null ? s.weight : 1,
      opacity: s.opacity != null ? s.opacity : 1,
      dashArray: s.dashArray || null,
      fillColor: s.fillColor || s.color || COLORS.buildingFill,
      fillOpacity: s.fillOpacity != null ? s.fillOpacity : 0.3
    });
  }

  function pointStyle(entry) {
    const s = entry.style || {};
    const color = s.color || (entry.id === 'transit' ? COLORS.transit : COLORS.amenity);
    return () => ({
      radius: s.radius || 4,
      color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: 1.5,
      opacity: 0.95
    });
  }

  function addWmsLayer(entry) {
    const layer = L.tileLayer.wms(entry.url, {
      layers: entry.layers,
      format: entry.format || 'image/png',
      transparent: true,
      version: entry.version || '1.3.0',
      opacity: entry.opacity != null ? entry.opacity : 0.85,
      attribution: entry.attribution || '',
      maxZoom: 22
    });
    state.layers[entry.id] = layer;
    if (entry.visible !== false) {
      layer.addTo(state.map);
    }
    return layer;
  }

  function refreshWmsStack() {
    const brw = state.layers.bodenrichtwert;
    const alkis = state.layers.alkis;
    if (brw && brw.bringToFront) brw.bringToFront();
    if (alkis && alkis.bringToFront) alkis.bringToFront();
  }

  async function loadGeoJsonLayer(entry) {
    const gj = await fetchJson(geojsonUrl(entry.file));
    const isPoint = entry.type === 'geojson-point'
      || (gj.features && gj.features[0] && gj.features[0].geometry.type === 'Point');
    let layer;
    if (isPoint) {
      layer = L.geoJSON(gj, {
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointStyle(entry)()),
        interactive: false
      });
    } else {
      layer = L.geoJSON(gj, {
        style: styleFromConfig(entry),
        interactive: false
      });
    }
    state.layers[entry.id] = layer;
    if (entry.visible !== false) layer.addTo(state.map);
    return gj.features ? gj.features.length : 0;
  }

  function buildLayerDefs(config) {
    const wms = config.wms || {};
    state.wmsConfig = wms;
    const defs = [];
    CONTROL_ORDER.forEach((id) => {
      if (wms[id]) {
        defs.push({
          id,
          label: wms[id].label || id,
          kind: 'wms',
          visible: wms[id].visible !== false
        });
        return;
      }
      const gj = (config.layers || []).find((l) => l.id === id);
      if (gj) {
        defs.push({
          id,
          label: gj.label || id,
          kind: 'geojson',
          visible: gj.visible !== false
        });
      }
    });
    state.layerDefs = defs;
  }

  function renderLayerControls() {
    const host = $('layer-list');
    if (!host) return;
    host.innerHTML = '';
    state.layerDefs.forEach((def) => {
      const row = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!def.visible;
      cb.addEventListener('change', () => {
        const layer = state.layers[def.id];
        if (!layer) return;
        def.visible = cb.checked;
        if (cb.checked) {
          layer.addTo(state.map);
          if (def.kind === 'wms') refreshWmsStack();
        } else {
          state.map.removeLayer(layer);
        }
      });
      row.appendChild(cb);
      row.appendChild(document.createTextNode(def.label));
      host.appendChild(row);
    });
  }

  async function loadManifest() {
    try {
      state.manifest = await fetchJson(new URL('export_manifest.json', DATA_BASE).href);
    } catch (_) {
      state.manifest = { source: 'static' };
    }
  }

  async function init() {
    state.map = L.map('map', { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      opacity: 0.7
    }).addTo(state.map);
    state.map.setView(VIEW.center, VIEW.zoom);

    setStatus('Loading map config…');

    let config;
    try {
      config = await fetchJson(CONFIG_URL.href);
    } catch (err) {
      console.warn(err);
      config = { layers: [], wms: {} };
    }

    buildLayerDefs(config);
    renderLayerControls();
    await loadManifest();

    const counts = [];
    const wmsEntries = config.wms || {};
    Object.keys(wmsEntries).forEach((key) => {
      const entry = wmsEntries[key];
      try {
        addWmsLayer(entry);
        counts.push(`${entry.id}: WMS`);
      } catch (err) {
        console.warn(`WMS ${entry.id} failed`, err);
        counts.push(`${entry.id}: WMS error`);
      }
    });

    const stack = Array.isArray(config.layers) ? config.layers.slice() : [];
    for (let i = 0; i < stack.length; i += 1) {
      const entry = stack[i];
      try {
        const n = await loadGeoJsonLayer(entry);
        counts.push(`${entry.id}: ${n}`);
      } catch (err) {
        console.warn(`Layer ${entry.id} skipped`, err);
        counts.push(`${entry.id}: missing`);
      }
    }

    refreshWmsStack();

    const src = (state.manifest && state.manifest.source) || 'static GeoJSON';
    setStatus(`Ready · ${src} · ${counts.join(' · ')}`);
  }

  init().catch((err) => {
    console.error(err);
    setStatus(`Error: ${err.message}`);
  });
})();
