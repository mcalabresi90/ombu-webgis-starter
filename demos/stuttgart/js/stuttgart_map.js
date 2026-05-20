/**
 * Ombu Stuttgart spatial prototype
 * WMS: ALKIS parcels + Bodenrichtwertkarte (official) · OSM: static GeoJSON
 * Interactive: GeoJSON popups + WMS GetFeatureInfo (ALKIS)
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
    focusRing: '#c06158',
    highlightFill: '#f3e0d8',
    highlightStroke: '#c06158'
  }, PALETTE.colors || {});

  const VIEW = { center: [48.7768, 9.1825], zoom: 16 };
  const DATA_BASE = new URL('data/map_geojson/', window.location.href);
  const CONFIG_URL = new URL('viewer/config/demo_map_layers.json', window.location.href);
  const BORIS_BW_URL = 'https://www.gutachterausschuesse-bw.de/borisbw/?lang=de';
  const BORIS_COORDS_API_DEFAULT =
    'https://www.gis-rest.nrw.de/grs/rest/boris-bw/orderService/getBRWbyCoords.json';

  const NUTA_LABELS = {
    MI: 'Mixed use (urban)',
    MK: 'Core area',
    MU: 'Urban',
    G: 'Commercial',
    GE: 'Commercial zone',
    GI: 'Industrial',
    W: 'Residential',
    MD: 'Village area',
    A: 'Arable land',
    F: 'Forest'
  };

  const INTERACTIVE_GEOJSON = new Set(['buildings', 'pois', 'transit', 'green_areas']);

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
    wmsConfig: {},
    borisApiUrl: BORIS_COORDS_API_DEFAULT,
    popup: null,
    highlight: null,
    identifyBusy: false
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg) {
    const el = $('status');
    if (el) el.textContent = msg;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatBrwEur(value) {
    if (value == null || String(value).trim() === '') return null;
    const n = Number(String(value).replace(/\./g, '').replace(',', '.'));
    if (Number.isNaN(n)) return escapeHtml(value) + ' €/m²';
    return `${n.toLocaleString('de-DE')} €/m²`;
  }

  function brwRowsFromProps(props) {
    if (!props || props.brw == null || String(props.brw).trim() === '') return [];
    const rows = [
      ['Bodenrichtwert', `<strong>${formatBrwEur(props.brw)}</strong>`]
    ];
    if (props.stag) rows.push(['Reference date', escapeHtml(props.stag)]);
    const nuta = [props.nuta, props.ergnuta].filter(Boolean).join(' · ');
    if (nuta) {
      const label = NUTA_LABELS[props.nuta] || props.nuta;
      rows.push(['Land use', escapeHtml(nuta + (label !== props.nuta ? ` (${label})` : ''))]);
    }
    if (props.entw) {
      const entwLabels = { B: 'Buildable land', R: 'Raw development land', E: 'Land awaiting development' };
      const entw = props.entw;
      rows.push(['Development', escapeHtml(entw + (entwLabels[entw] ? ` — ${entwLabels[entw]}` : ''))]);
    }
    if (props.wnum) rows.push(['Zone no.', escapeHtml(props.wnum)]);
    if (props.gena) rows.push(['Municipality', escapeHtml(props.gena)]);
    return rows;
  }

  async function fetchBrwAt(latlng) {
    const url = state.borisApiUrl || BORIS_COORDS_API_DEFAULT;
    const body = JSON.stringify({
      type: 'FeatureCollection',
      crs: { type: 'name', properties: { name: 'EPSG:4326' } },
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [latlng.lng, latlng.lat]
        },
        properties: {}
      }]
    });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body
      });
      if (!res.ok) return null;
      const data = await res.json();
      const features = data.features || [];
      if (!features.length) return null;
      return features[0].properties || null;
    } catch (err) {
      console.warn('[stuttgart_map] BORIS-BW lookup failed', err);
      return null;
    }
  }

  function popupHtml(title, rows, footer) {
    const body = rows.map((row) => (
      `<dt>${escapeHtml(row[0])}</dt><dd>${row[1]}</dd>`
    )).join('');
    const foot = footer ? `<p style="margin:10px 0 0;font-size:0.8rem;color:#817877">${footer}</p>` : '';
    return `<h4>${escapeHtml(title)}</h4><dl>${body}</dl>${foot}`;
  }

  function openPopup(latlng, html) {
    if (!state.popup) {
      state.popup = L.popup({ maxWidth: 320, closeButton: true });
    }
    state.popup.setLatLng(latlng).setContent(html).openOn(state.map);
  }

  function clearHighlight() {
    if (state.highlight) {
      state.map.removeLayer(state.highlight);
      state.highlight = null;
    }
  }

  function highlightGeoJsonFeature(layer) {
    clearHighlight();
    if (!layer || !layer.toGeoJSON) return;
    const gj = layer.toGeoJSON();
    state.highlight = L.geoJSON(gj, {
      style: {
        color: COLORS.highlightStroke,
        weight: 3,
        fillColor: COLORS.highlightFill,
        fillOpacity: 0.55
      },
      interactive: false
    }).addTo(state.map);
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

  function propsRows(props, keys) {
    const rows = [];
    keys.forEach((key) => {
      const val = props && props[key];
      if (val != null && String(val).trim() !== '') {
        rows.push([key.replace(/_/g, ' '), escapeHtml(val)]);
      }
    });
    return rows;
  }

  function geojsonPopupContent(entry, props) {
    if (entry.id === 'buildings') {
      return popupHtml('Building (OSM)', propsRows(props, [
        'name', 'building', 'building:levels', 'amenity', 'osm_id'
      ]));
    }
    if (entry.id === 'pois') {
      return popupHtml('Amenity (OSM)', propsRows(props, [
        'name', 'amenity', 'shop', 'tourism', 'osm_id'
      ]));
    }
    if (entry.id === 'transit') {
      return popupHtml('Transit (OSM)', propsRows(props, [
        'name', 'public_transport', 'railway', 'highway', 'osm_id'
      ]));
    }
    if (entry.id === 'green_areas') {
      return popupHtml('Green area (OSM)', propsRows(props, [
        'name', 'leisure', 'landuse', 'natural', 'osm_id'
      ]));
    }
    return popupHtml(entry.label || entry.id, propsRows(props, Object.keys(props || {}).slice(0, 8)));
  }

  function bindGeoJsonInteractivity(entry, layer) {
    if (!INTERACTIVE_GEOJSON.has(entry.id)) return;

    layer.eachLayer((featureLayer) => {
      featureLayer.on({
        mouseover: (e) => {
          const target = e.target;
          if (target.setStyle) {
            target.setStyle({
              weight: 3,
              color: COLORS.highlightStroke,
              fillOpacity: 0.55
            });
          }
          if (target.bringToFront) target.bringToFront();
        },
        mouseout: (e) => {
          const gjLayer = state.layers[entry.id];
          if (gjLayer && gjLayer.resetStyle) gjLayer.resetStyle(e.target);
        },
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          const props = (e.target.feature && e.target.feature.properties) || {};
          highlightGeoJsonFeature(e.target);
          openPopup(e.latlng, geojsonPopupContent(entry, props));
        }
      });
    });
  }

  function attachWmsDiagnostics(layer, entry) {
    let tileErrors = 0;
    let tileLoads = 0;

    layer.on('tileload', () => {
      tileLoads += 1;
      if (entry.id === 'bodenrichtwert' && tileErrors > 0) {
        setStatus('Ready · click map for parcel info · Bodenrichtwert loading…');
      }
    });

    layer.on('tileerror', () => {
      tileErrors += 1;
      if (entry.id !== 'bodenrichtwert') return;
      const zoom = state.map ? state.map.getZoom() : VIEW.zoom;
      const hint = zoom < 13
        ? 'Zoom in closer (detail from ~1:30 000) to see Bodenrichtwert zones.'
        : 'Bodenrichtwert tiles failed — check geoserver.stuttgart.de.';
      setStatus(hint);
      console.warn('[stuttgart_map] WMS tile error', entry.url, entry.layers);
    });
  }

  function addWmsLayer(entry) {
    const opts = {
      layers: entry.layers,
      format: entry.format || 'image/png',
      transparent: true,
      version: entry.version || '1.3.0',
      opacity: entry.opacity != null ? entry.opacity : 0.85,
      attribution: entry.attribution || '',
      maxZoom: 22
    };
    if (entry.maxScaleDenominator) {
      opts.maxNativeZoom = 18;
    }
    const layer = L.tileLayer.wms(entry.url, opts);
    attachWmsDiagnostics(layer, entry);
    state.layers[entry.id] = layer;
    if (entry.visible !== false) {
      layer.addTo(state.map);
    }
    return layer;
  }

  async function identifyAlkis(latlng) {
    const entry = state.wmsConfig.alkis;
    const layer = state.layers.alkis;
    if (!entry || !layer || !state.map.hasLayer(layer)) return null;

    const url = layer.getFeatureInfoUrl(latlng, state.map.getSize(), state.map.getZoom(), {
      info_format: 'application/json',
      format: entry.format || 'image/png',
      feature_count: 5
    });
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const features = data.features || [];
      if (!features.length) return null;
      return features[0];
    } catch (err) {
      console.warn('[stuttgart_map] ALKIS identify failed', err);
      return null;
    }
  }

  function locationPopupHtml(latlng, alkisFeature, brwProps) {
    const rows = [];
    if (brwProps) {
      rows.push(...brwRowsFromProps(brwProps));
    }
    if (alkisFeature) {
      const p = alkisFeature.properties || {};
      const label = p.label || p.flurstueckstext || p.nationalcadastralreference || '—';
      const area = p.areavalue != null
        ? `${Number(p.areavalue).toLocaleString('de-DE')} m²`
        : '—';
      rows.push(
        ['Flurstück (ALKIS)', escapeHtml(label)],
        ['Parcel area', escapeHtml(area)]
      );
      if (p.nationalcadastralreference) {
        rows.push([
          'Cadastral ref.',
          `<code style="font-size:0.78rem">${escapeHtml(p.nationalcadastralreference)}</code>`
        ]);
      }
    } else {
      rows.push([
        'Coordinates',
        `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`
      ]);
    }
    const title = brwProps ? 'Land value (official)' : (alkisFeature ? 'Cadastral parcel' : 'Map location');
    let footer = `Source: <a href="${BORIS_BW_URL}" target="_blank" rel="noopener">BORIS-BW</a> · official reference land value (€/m²), not market asking prices.`;
    if (!brwProps) {
      footer = `No Bodenrichtwert zone at this point. Try inside Stuttgart city limits or use <a href="${BORIS_BW_URL}" target="_blank" rel="noopener">BORIS-BW</a>.`;
    }
    return popupHtml(title, rows, footer);
  }

  function highlightAlkisFeature(feature) {
    clearHighlight();
    if (!feature || !feature.geometry) return;
    state.highlight = L.geoJSON(feature, {
      style: {
        color: COLORS.highlightStroke,
        weight: 3,
        fillColor: COLORS.highlightFill,
        fillOpacity: 0.35
      },
      interactive: false
    }).addTo(state.map);
  }

  async function onMapClick(e) {
    if (state.identifyBusy) return;
    state.identifyBusy = true;
    setStatus('Querying Bodenrichtwert + parcel…');

    const [alkisFeature, brwProps] = await Promise.all([
      identifyAlkis(e.latlng),
      fetchBrwAt(e.latlng)
    ]);

    if (alkisFeature) {
      highlightAlkisFeature(alkisFeature);
    } else {
      clearHighlight();
    }

    openPopup(e.latlng, locationPopupHtml(e.latlng, alkisFeature, brwProps));

    if (brwProps && brwProps.brw) {
      setStatus(`Bodenrichtwert ${formatBrwEur(brwProps.brw)} · click map or features for more`);
    } else if (alkisFeature) {
      setStatus('Parcel found · no BRW zone at this point');
    } else {
      setStatus('No data at click · zoom into Stuttgart-Mitte');
    }

    state.identifyBusy = false;
  }

  function syncAlkisOpacityForBrw() {
    const alkis = state.layers.alkis;
    const brw = state.layers.bodenrichtwert;
    if (!alkis) return;
    const cfg = state.wmsConfig.alkis || {};
    const base = cfg.opacity != null ? cfg.opacity : 0.9;
    const brwOn = brw && state.map && state.map.hasLayer(brw);
    alkis.setOpacity(brwOn ? 0.45 : base);
  }

  function refreshWmsStack() {
    const brw = state.layers.bodenrichtwert;
    const alkis = state.layers.alkis;
    const brwOn = brw && state.map && state.map.hasLayer(brw);
    if (alkis && alkis.bringToFront) alkis.bringToFront();
    if (brwOn && brw.bringToFront) brw.bringToFront();
  }

  async function loadGeoJsonLayer(entry) {
    const gj = await fetchJson(geojsonUrl(entry.file));
    const isPoint = entry.type === 'geojson-point'
      || (gj.features && gj.features[0] && gj.features[0].geometry.type === 'Point');
    const interactive = INTERACTIVE_GEOJSON.has(entry.id);
    let layer;
    if (isPoint) {
      layer = L.geoJSON(gj, {
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointStyle(entry)()),
        interactive
      });
    } else {
      layer = L.geoJSON(gj, {
        style: styleFromConfig(entry),
        interactive
      });
    }
    bindGeoJsonInteractivity(entry, layer);
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
          if (def.kind === 'wms') {
            syncAlkisOpacityForBrw();
            refreshWmsStack();
          }
        } else {
          if (def.kind === 'wms') syncAlkisOpacityForBrw();
          state.map.removeLayer(layer);
          if (def.kind === 'wms') refreshWmsStack();
        }
      });
      row.appendChild(cb);
      row.appendChild(document.createTextNode(def.label));
      host.appendChild(row);
    });
  }

  function bindMapChrome() {
    state.map.on('click', onMapClick);
    state.map.on('popupclose', clearHighlight);

    const chip = $('scale-chip');
    const updateChip = () => {
      if (!chip) return;
      const z = state.map.getZoom();
      chip.textContent = `Stuttgart-Mitte · zoom ${z} · click for parcel / feature info`;
    };
    state.map.on('zoomend moveend', updateChip);
    updateChip();
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
    bindMapChrome();

    setStatus('Loading map config…');

    let config;
    try {
      config = await fetchJson(CONFIG_URL.href);
    } catch (err) {
      console.warn(err);
      config = { layers: [], wms: {} };
    }

    if (config.borisApi && config.borisApi.url) {
      state.borisApiUrl = config.borisApi.url;
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

    syncAlkisOpacityForBrw();
    refreshWmsStack();

    const src = (state.manifest && state.manifest.source) || 'static GeoJSON';
    setStatus(`Ready · ${src} · click map or features · ${counts.join(' · ')}`);
  }

  init().catch((err) => {
    console.error(err);
    setStatus(`Error: ${err.message}`);
  });
})();
