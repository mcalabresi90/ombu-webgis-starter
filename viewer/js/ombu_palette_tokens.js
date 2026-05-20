(function () {
  'use strict';

  const PALETTE_OVERRIDE_STORAGE_KEY = 'ombu.camoes172.paletteOverrides.v2';
  const LEGACY_PALETTE_OVERRIDE_STORAGE_KEY = 'ombu.camoes172.paletteOverrides.v1';
  const PALETTE_OVERRIDE_CHANNEL = 'ombu.camoes172.paletteOverrides';
  const ROAD_STYLE_MIGRATION_VERSION = 2;

  // Canonical palette source for the WebGIS runtime.
  // When these base tokens change, sync the cartographic guide with:
  // `node scripts/webgis/sync_palette_docs.js`
  // CANONICAL_BASE_TOKENS_START
  const baseTokens = {
    palette: [
      '#2C3E4F', '#A9C3CC', '#E7D8D0', '#D87070', '#F5DEBC', '#8E728E', '#9F4E1F', '#BF905A', '#D8CBA8', '#688B84',
      '#B7693A', '#A6B9CC', '#B75046', '#637F96', '#D3C153', '#C5B0C6', '#A29292', '#E2867C', '#817877', '#D7A8A1',
      '#BDA19B', '#91766F', '#57453B', '#D9C5B9', '#B19888', '#928376', '#E8A571', '#9C6111', '#C9BBA7', '#BBB5A7',
      '#DDD7C4', '#B07972', '#535245', '#C9CAAC', '#4D5134', '#818776', '#E0E5D7', '#869179', '#B6CBA8', '#B9CBB1',
      '#7FA071', '#A0AE9B', '#CAD7C6', '#62765F', '#C7D5C5', '#82A381', '#6F896F', '#AFBFB1', '#475549', '#949F97',
      '#8AB49E', '#AEC4BC', '#4F6E68', '#4A5554', '#343535', '#254040', '#B5C6C7', '#637074', '#26343D', '#7E8C9B',
      '#373647', '#CECDD1', '#6C6067', '#61555A', '#9E5B6C', '#C4A574', '#8B7355', '#D4B896', '#A17B6B', '#B89B8A',
      '#6B8E7A', '#7A9B8A', '#9A8B7A', '#C8B8A8', '#7D6B8A', '#A08898', '#8B9A8E', '#B5A090', '#6E7A6B', '#D1C4B8',
      '#967A6B', '#7A8A9C', '#9B7E6E', '#C8D4C4', '#8A7A6E', '#4A9BB5', '#5BA3B8', '#6B9B6B', '#D4B84A', '#6B9BC4',
      '#4B5F6E', '#7AB87A', '#5A8BA8', '#F5E6C8', '#6B7BA8', '#6B9B7A', '#5A7364', '#E8A878', '#55645A', '#9B7AB8'
    ],
    colors: {
      ink: '#2f2222',
      terracotta: '#c06158',
      terracottaDark: '#7f3c35',
      terracottaLight: '#e8c5b7',
      terracottaMid: '#d89683',
      beige: '#f3e6da',
      beigeSoft: '#f2e5dc',
      grayDark: '#595959',
      grayMid: '#8b8b8b',
      grayLight: '#cfcfcf',
      graySoft: '#e5e5e5',
      brownDark: '#5c2f2a',
      roseDark: '#8b4239'
    },
    ramps: {
      ombu_soft: ['#F1DCDA', '#DDAAA5', '#C06158', '#964C45', '#6C3631'],
      ombu_warm: ['#F1DCDA', '#DDAAA5', '#C06158', '#964C45', '#6C3631'],
      ombu_magma: ['#F1DCDA', '#DDAAA5', '#C06158', '#964C45', '#6C3631'],
      ombu_earth: ['#F1DCDA', '#DDAAA5', '#C06158', '#964C45', '#6C3631'],
      ombu_contrast: ['#FFF7E2', '#F5E1A4', '#E6C768', '#CFA23C', '#8F6D21'],
      ombu_teal: ['#e4f3ef', '#b8ddd5', '#72b9ad', '#2d8f84', '#15574f'],
      ombu_purple: ['#EFE7F6', '#D5BFE8', '#AB84C8', '#7A519F', '#4E2F6E'],
      ombu_gold: ['#FFF7E2', '#F5E1A4', '#E6C768', '#CFA23C', '#8F6D21'],
      ocupacao: ['#F9F4F2', '#ECD6CC', '#D9927C', '#AE6B5E', '#6E4640'],
      /* Altura: marrom com mais contraste entre faixas. */
      altura: ['#FAF8F7', '#D6BBB3', '#A27468', '#6E3F36', '#2A1714'],
      densidade: ['#F9F4F2', '#ECD6CC', '#D9927C', '#AE6B5E', '#6E4640'],
      venda: ['#F8EFEC', '#D9A89D', '#C06158', '#964C45', '#7A2020'],
      aluguel: ['#DDE3E8', '#ABBAC6', '#637F96', '#4D6375', '#374754']
    },
    solids: {
      morph_horizontal: '#F5F1ED',
      vertical_baixa: '#D6BBB3',
      vertical_media: '#A27468',
      vertical_alta: '#2A1714',
      horizontal: '#CFCFCF',
      horizontal_residencial: '#F5F1ED',
      horizontal_comercial: '#BDAFA3',
      horizontal_misto: '#656565',
      medio_porte_misto: '#A27468',
      tipologia_torres: '#2A1714',
      baixa_verticalizacao: '#8B8B8B',
      media_verticalizacao: '#C06158',
      alta_verticalizacao: '#6C3631',
      institucional: '#817877',
      poi_comercio: '#B5A090',
      poi_ensino_formal: '#B5C6C7',
      poi_saude: '#B9CBB1',
      poi_cultura: '#C5B0C6',
      poi_esporte: '#8AB49E',
      via_arterial: '#E6A18E',
      via_coletora: '#E8A571',
      via_local: '#B19888',
      lote_pin: '#F0796E'
    },
    patterns: {
      morph_horizontal: 'none',
      vertical_baixa: 'none',
      vertical_media: 'none',
      vertical_alta: 'none',
      lote_hatch: 'diagonal_red',
      tipologia_residencial: 'dots_soft',
      tipologia_misto: 'cross_soft',
      tipologia_institucional: 'diagonal_soft',
      compacidade: 'diagonal_red',
      ocupacao: 'none',
      altura: 'none',
      densidade: 'none',
      venda: 'none',
      aluguel: 'none',
      horizontal: 'none',
      baixa_verticalizacao: 'none',
      media_verticalizacao: 'none',
      alta_verticalizacao: 'none',
      poi_comercio: 'none',
      poi_ensino_formal: 'none',
      poi_saude: 'none',
      poi_cultura: 'none',
      poi_esporte: 'none',
      via_arterial: 'none',
      via_coletora: 'none',
      via_local: 'none',
      lote_pin: 'none',
      base_edificacoes: 'none',
      base_ruas_locais: 'none',
      base_limites_urbanos: 'none',
      base_texto: 'none',
      via_estrutural: 'none',
      via_arterial_secundaria: 'none',
      ciclovia: 'none',
      ciclofaixa: 'none',
      eixo_comercial_baixa: 'none',
      eixo_comercial_media: 'none',
      eixo_comercial_alta: 'none',
      eixo_comercial_forte: 'none',
      polo_gerador: 'none',
      barreira_urbana: 'none',
      parques: 'none',
      bosques: 'none',
      pracas: 'none',
      rio_principal: 'none',
      cursos_menores: 'none',
      lote_contorno: 'diagonal_red',
      buffer_500m: 'diagonal_red',
      buffer_1000m: 'none'
    },
    guide: {
      base_edificacoes: '#FFFEEC',
      base_ruas_locais: '#DDD7C4',
      base_limites_urbanos: '#817877',
      base_texto: '#4B2E2E',
      via_estrutural: '#4B2E2E',
      via_arterial_secundaria: '#7A8A9C',
      ciclovia: '#6B9B6B',
      ciclofaixa: '#7AB87A',
      eixo_comercial_baixa: '#C98B6B',
      eixo_comercial_media: '#B55A3C',
      eixo_comercial_alta: '#8A3F2B',
      eixo_comercial_forte: '#5C2A1E',
      polo_gerador: '#D4A876',
      barreira_urbana: '#4B3A50',
      parques: '#B6CBA8',
      bosques: '#A0AE9B',
      pracas: '#CAD7C6',
      rio_principal: '#5BA3B8',
      cursos_menores: '#A9C3CC',
      lote_contorno: '#4B2E2E',
      buffer_500m: '#B71405',
      buffer_1000m: '#817877'
    }
  };
  // CANONICAL_BASE_TOKENS_END

  function safeStorage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function readOverrides() {
    const storage = safeStorage();
    if (!storage) return {};
    try {
      const raw = storage.getItem(PALETTE_OVERRIDE_STORAGE_KEY) || storage.getItem(LEGACY_PALETTE_OVERRIDE_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      const migrated = migrateLegacyRoadStyleOverrides(parsed);
      if (migrated.__changed) {
        const payload = Object.assign({}, migrated);
        delete payload.__changed;
        const serialized = JSON.stringify(payload);
        try {
          if (storage.getItem(PALETTE_OVERRIDE_STORAGE_KEY) !== serialized) {
            storage.setItem(PALETTE_OVERRIDE_STORAGE_KEY, serialized);
          }
          /** Do not rewrite the legacy key here.
           *  Every same-origin iframe bootstrapping at once would emit duplicate storage events,
           *  which is exactly the kind of cross-frame chatter that makes the dossier feel unstable. */
        } catch (writeError) {
          // ignore storage write failures and keep in-memory migrated payload
        }
        return payload;
      }
      return migrated;
    } catch (error) {
      return {};
    }
  }

  function migrateLegacyRoadStyleOverrides(overrides) {
    const payload = JSON.parse(JSON.stringify(overrides || {}));
    const meta = Object.assign({}, payload._meta || {});
    if ((meta.roadStyleVersion || 0) >= ROAD_STYLE_MIGRATION_VERSION) {
      return payload;
    }

    let changed = false;
    payload.solids = Object.assign({}, payload.solids || {});
    payload.guide = Object.assign({}, payload.guide || {});

    if (payload.solids.via_arterial === '#4B2E2E' || payload.solids.via_arterial === '#D23B3B') {
      payload.solids.via_arterial = '#4B5F6E';
      changed = true;
    }

    if (
      payload.guide.via_arterial_secundaria === '#B75046'
      || payload.guide.via_arterial_secundaria === '#C06158'
      || payload.guide.via_arterial_secundaria === '#D23B3B'
    ) {
      payload.guide.via_arterial_secundaria = '#4B5F6E';
      changed = true;
    }

    meta.roadStyleVersion = ROAD_STYLE_MIGRATION_VERSION;
    payload._meta = meta;
    if (changed) payload.__changed = true;
    return payload;
  }

  function cloneTokens(source) {
    return {
      palette: Array.isArray(source && source.palette) ? source.palette.slice() : [],
      colors: Object.assign({}, (source && source.colors) || {}),
      ramps: Object.assign({}, (source && source.ramps) || {}),
      solids: Object.assign({}, (source && source.solids) || {}),
      patterns: Object.assign({}, (source && source.patterns) || {}),
      guide: Object.assign({}, (source && source.guide) || {})
    };
  }

  function mergeTokens(base, overrides) {
    const safeOverrides = overrides && typeof overrides === 'object' ? overrides : {};
    return Object.freeze({
      palette: Array.isArray(base && base.palette) ? base.palette.slice() : [],
      colors: Object.freeze(Object.assign({}, (base && base.colors) || {}, safeOverrides.colors || {})),
      ramps: Object.freeze(Object.assign({}, (base && base.ramps) || {}, safeOverrides.ramps || {})),
      solids: Object.freeze(Object.assign({}, (base && base.solids) || {}, safeOverrides.solids || {})),
      patterns: Object.freeze(Object.assign({}, (base && base.patterns) || {}, safeOverrides.patterns || {})),
      guide: Object.freeze(Object.assign({}, (base && base.guide) || {}, safeOverrides.guide || {}))
    });
  }

  const canonicalBaseTokens = Object.freeze(cloneTokens(baseTokens));
  const overrides = readOverrides();
  const tokens = mergeTokens(canonicalBaseTokens, overrides);

  window.OMBU_PALETTE_TOKENS = tokens;
  window.OMBU_CANONICAL_BASE_TOKENS = canonicalBaseTokens;
  window.OMBU_PALETTE_COMPUTE_TOKENS = function computePaletteTokens(runtimeOverrides) {
    return mergeTokens(canonicalBaseTokens, runtimeOverrides || readOverrides());
  };
  window.OMBU_PALETTE_OVERRIDE_STORAGE_KEY = PALETTE_OVERRIDE_STORAGE_KEY;
  window.OMBU_PALETTE_OVERRIDE_CHANNEL = PALETTE_OVERRIDE_CHANNEL;

  if (document && document.documentElement) {
    document.documentElement.style.setProperty('--lot-pin-color', tokens.solids.lote_pin);
    document.documentElement.style.setProperty('--lot-pin-ring-color', tokens.solids.lote_pin);
    document.documentElement.style.setProperty('--terrain-pin-color', tokens.solids.lote_pin);
  }
})();
