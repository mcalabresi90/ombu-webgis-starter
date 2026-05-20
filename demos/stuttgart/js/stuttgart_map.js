/**
 * Ombu Stuttgart spatial prototype
 * ALKIS: LGL-BW WMS · OSM context: static GeoJSON (ETL-Geodata-Pipeline taxonomy)
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
    cycle: '#6b9b6b',
    green: '#b6cba8',
    focusRing: '#c06158'
  }, PALETTE.colors || {});

  const VIEW = { center: [48.7768, 9.1825], zoom: 16 };
  const DATA_BASE = new URL('data/map_geojson/', window.location.href);
  const CONFIG_URL = new URL('viewer/config/demo_map_layers.json', window.location.href);

  const ALKIS_WMS_URL = 'https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_INSP_BW_Flst_ALKIS';
  const ALKIS_LAYER = 'alkis:CP.CadastralParcel';

  const LAYER_DEFS = [
    { id: 'alkis', label: 'Parcels / ALKIS', kind: 'wms', visible: true },
    { id: 'roads', label: 'Roads', kind: 'geojson', visible: true },
    { id: 'buildings', label: 'Buildings', kind: 'geojson', visible: true },
    { id: 'pois', label: 'Amenities', kind: 'geojson', visible: true },
    { id: 'transit', label: 'Transit', kind: 'geojson', visible: true },
    { id: 'cycleways', label: 'Cycleways', kind: 'geojson', visible: true },
    { id: 'green_areas', label: 'Green areas', kind: 'geojson', visible: true },
    { id: 'market', label: 'Future market layer', kind: 'placeholder', visible: false, disabled: true }
  ];

  const state = { map: null, layers: {}, manifest: null };

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg) {
    const el = $('status');
    if (el) el.textContent = msg;
  }

  function geojsonUrl(file) {
    const u = new URL(file, DATA_BASE);
    u.searchParams.set('v', state.manifest && state.manifest.source ? state.manifest.source : '1');
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

  function addAlkisLayer() {
    const layer = L.tileLayer.wms(ALKIS_WMS_URL, {
      layers: ALKIS_LAYER,
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 0.9,
      attribution: '&copy; LGL Baden-Württemberg · ALKIS',
      maxZoom: 22
    });
    layer.addTo(state.map);
    state.layers.alkis = layer;
  }

  function renderLayerControls() {
    const host = $('layer-list');
    if (!host) return;
    host.innerHTML = '';
    LAYER_DEFS.forEach((def) => {
      const row = document.createElement('label');
      if (def.disabled) row.className = 'disabled';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!def.visible && !def.disabled;
      cb.disabled = !!def.disabled;
      if (!def.disabled && def.kind !== 'placeholder') {
        cb.addEventListener('change', () => {
          const layer = state.layers[def.id];
          if (!layer) return;
          if (cb.checked) {
            layer.addTo(state.map);
            if (def.id === 'alkis' && layer.bringToFront) layer.bringToFront();
          } else {
            state.map.removeLayer(layer);
          }
        });
      }
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

    renderLayerControls();
    setStatus('Loading ALKIS + OSM layers…');

    addAlkisLayer();
    await loadManifest();

    let config;
    try {
      config = await fetchJson(CONFIG_URL.href);
    } catch (err) {
      console.warn(err);
      config = { layers: [] };
    }

    const counts = [];
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

    if (state.layers.alkis && state.layers.alkis.bringToFront) {
      state.layers.alkis.bringToFront();
    }

    const src = (state.manifest && state.manifest.source) || 'static GeoJSON';
    setStatus(`Ready · ${src} · ${counts.join(' · ')}`);
  }

  init().catch((err) => {
    console.error(err);
    setStatus(`Error: ${err.message}`);
  });
})();
