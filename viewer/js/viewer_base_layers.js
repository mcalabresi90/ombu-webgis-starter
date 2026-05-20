(function () {
  'use strict';

  const SHARED_PALETTE_TOKENS = window.OMBU_PALETTE_TOKENS || {};
  const GUIDE_TOKENS = Object.freeze((SHARED_PALETTE_TOKENS && SHARED_PALETTE_TOKENS.guide) || {});
  const SOLID_TOKENS = Object.freeze((SHARED_PALETTE_TOKENS && SHARED_PALETTE_TOKENS.solids) || {});

  const MARKET_CONTEXT_MAP_KEYS = Object.freeze(new Set([
    'amostras_mercado',
    'demanda_territorial',
    'valor_venda',
    'valor_aluguel',
    'hotspots_imobiliarios',
    'estrutura_oferta',
    'submercado_competitivo',
    'terrenos_comparaveis',
    'decisao_imobiliaria'
  ]));

  const CONFIG = Object.freeze({
    background: '#ffffff',
    quadras: Object.freeze({
      dataset: 'quadras',
      fillColor: '#F2F2F2',
      fillOpacity: 0.88,
      color: 'rgba(0,0,0,0)',
      opacity: 0,
      weight: 0
    }),
    roadHierarchy: Object.freeze({
      dataset: 'road_hierarchy',
      styles: Object.freeze({
        trunk: Object.freeze({
          color: GUIDE_TOKENS.via_estrutural || '#4B2E2E',
          weight: 4.5,
          opacity: 0.71,
          dashArray: '',
          legendLabel: 'Rodovias'
        }),
        primary: Object.freeze({
          color: GUIDE_TOKENS.via_arterial_secundaria || SOLID_TOKENS.via_arterial || '#7A8A9C',
          weight: 3.5,
          opacity: 0.69,
          dashArray: '12 8',
          legendLabel: 'Central / eixo estruturante'
        }),
        secondary: Object.freeze({
          color: SOLID_TOKENS.via_coletora || '#E8A571',
          weight: 3,
          opacity: 0.68,
          dashArray: '',
          legendLabel: 'Setorial'
        }),
        tertiary: Object.freeze({
          color: SOLID_TOKENS.via_local || '#B19888',
          weight: 2,
          opacity: 0.66,
          dashArray: '',
          legendLabel: 'Coletora'
        })
      })
    }),
    ciclovias: Object.freeze({
      dataset: 'ciclovias',
      color: GUIDE_TOKENS.ciclovia || '#6B9B6B',
      weight: 2,
      opacity: 0.9,
      dashArray: '4,4'
    }),
    hidrografia: Object.freeze({
      dataset: 'hidrografia',
      color: GUIDE_TOKENS.rio_principal || '#5A8BA8',
      weight: 1.6,
      opacity: 0.72
    }),
    focusWindow: Object.freeze({
      fillColor: '#ffffff',
      zone1Opacity: 0,
      zone2Opacity: 0.18,
      zone3Opacity: 0.32
    })
  });

  function normalized(value) {
    return String(value || '').trim();
  }

  function normalizeRoadHierarchyClass(rawValue) {
    const value = normalized(rawValue).toLowerCase();
    if (['motorway', 'motorway_link', 'trunk', 'trunk_link'].includes(value)) return 'trunk';
    if (['primary', 'primary_link'].includes(value)) return 'primary';
    if (['secondary', 'secondary_link'].includes(value)) return 'secondary';
    if (['tertiary', 'tertiary_link'].includes(value)) return 'tertiary';
    return '';
  }

  function normalizeRoadClass(rawValue) {
    const hierarchy = normalizeRoadHierarchyClass(rawValue);
    if (hierarchy === 'trunk' || hierarchy === 'primary') return 'arterial';
    if (hierarchy === 'secondary' || hierarchy === 'tertiary') return 'collector';
    return 'local';
  }

  function normalizeInsertionRoadClass(rawValue) {
    const hierarchy = normalizeRoadHierarchyClass(rawValue);
    if (hierarchy === 'trunk') return 'structural';
    if (hierarchy === 'primary') return 'arterial';
    if (hierarchy === 'secondary' || hierarchy === 'tertiary') return 'collector';
    return 'local';
  }

  function isCycleInfrastructureFeature(feature) {
    const props = (feature && feature.properties) || {};
    const values = [
      props.classe,
      props.tipo,
      props.categoria,
      props.infraestrutura,
      props.modal,
      props.highway
    ];
    return values.some((value) => {
      const lowered = normalized(value).toLowerCase();
      return (
        lowered.includes('cycleway')
        || lowered.includes('cycle route')
        || lowered.includes('cycle_route')
        || lowered.includes('ciclovia')
        || lowered.includes('ciclorrota')
        || lowered.includes('ciclofaixa')
      );
    });
  }

  function isMarketContextMap(mapKey) {
    return MARKET_CONTEXT_MAP_KEYS.has(String(mapKey || '').trim());
  }

  window.OMBU_VIEWER_BASE_LAYERS = Object.freeze({
    CONFIG: CONFIG,
    MARKET_CONTEXT_MAP_KEYS: MARKET_CONTEXT_MAP_KEYS,
    normalizeRoadHierarchyClass: normalizeRoadHierarchyClass,
    normalizeRoadClass: normalizeRoadClass,
    normalizeInsertionRoadClass: normalizeInsertionRoadClass,
    isCycleInfrastructureFeature: isCycleInfrastructureFeature,
    isMarketContextMap: isMarketContextMap
  });
})();
