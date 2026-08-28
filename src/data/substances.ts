/**
 * The substance database.
 *
 * One record per substance, shared by every module (§2, §15, §76). Values are
 * literature data — CRC Handbook 102nd ed., NIST Chemistry WebBook, IUPAC
 * stability-constant compilations and the current GHS classification. Where a
 * property is genuinely unavailable the field is simply absent; nothing here
 * is a placeholder.
 *
 * The set is chosen to cover the reagents a chemistry degree actually uses:
 * the standard acids and bases, the buffer systems, the titrants and primary
 * standards, the common salts and their solubility behaviour, the redox
 * couples, the solvents, the indicators, and a working set of organic
 * compounds for spectroscopy and chromatography.
 */

import { makeSubstance, type Substance, type SubstanceInput } from '../domain/substance.js';

const S = (input: SubstanceInput): Substance => makeSubstance(input);

// Reusable safety fragments — keeps the records readable and consistent.
const NO_HAZARD: Substance['safety'] = {
  ghs: [],
  signal: null,
  hazards: [],
  ppe: ['Bata', 'Gafas de seguridad'],
  storage: 'Almacenamiento general en armario de reactivos.',
  incompatibilities: [] as string[],
  wasteStream: 'Residuo acuoso no peligroso (verificar pH antes de verter).',
};

const STRONG_ACID_SAFETY = (extra: Partial<Substance['safety']> = {}): Substance['safety'] => ({
  ghs: ['corrosivo'],
  signal: 'Peligro',
  hazards: [
    { code: 'H314', text: 'Provoca quemaduras graves en la piel y lesiones oculares graves.' },
    { code: 'H290', text: 'Puede ser corrosivo para los metales.' },
  ],
  ppe: ['Bata', 'Gafas de seguridad integrales', 'Guantes de nitrilo', 'Pantalla facial si > 1 L'],
  storage: 'Armario de ácidos, con contención secundaria. Separado de bases y de cianuros.',
  incompatibilities: ['naoh', 'koh', 'nh3', 'nahco3', 'na2co3'],
  wasteStream: 'Residuo ácido inorgánico. Neutralizar antes de la retirada.',
  notes: ['Añadir siempre el ácido sobre el agua, nunca al revés: la dilución es fuertemente exotérmica.'],
  ...extra,
});

const STRONG_BASE_SAFETY = (extra: Partial<Substance['safety']> = {}): Substance['safety'] => ({
  ghs: ['corrosivo'],
  signal: 'Peligro',
  hazards: [
    { code: 'H314', text: 'Provoca quemaduras graves en la piel y lesiones oculares graves.' },
    { code: 'H290', text: 'Puede ser corrosivo para los metales.' },
  ],
  ppe: ['Bata', 'Gafas de seguridad integrales', 'Guantes de nitrilo'],
  storage: 'Armario de bases. Recipiente de plástico: ataca el vidrio con el tiempo.',
  incompatibilities: ['hcl', 'h2so4', 'hno3', 'ch3cooh', 'h3po4'],
  wasteStream: 'Residuo básico inorgánico. Neutralizar antes de la retirada.',
  notes: ['La disolución de los pellets es fuertemente exotérmica: enfriar y añadir despacio.'],
  ...extra,
});

// ===========================================================================
// Water and the acid–base workhorses
// ===========================================================================

export const SUBSTANCES: Substance[] = [
  S({
    id: 'h2o', formula: 'H2O', name: 'Agua', synonyms: ['óxido de dihidrógeno', 'agua destilada'],
    casNumber: '7732-18-5', structure: 'O', moleculeId: 'water',
    phase: 'l', categories: ['disolvente', 'inorgánico'],
    role: 'Disolvente universal y referencia de todo el equilibrio acuoso.',
    courses: ['qg1'],
    physical: {
      meltingPoint: 273.15, boilingPoint: 373.124, density: 0.99705,
      viscosity: 0.890, refractiveIndex: 1.3330, permittivity: 78.38,
      antoine: { A: 5.40221, B: 1838.675, C: -31.737, range: [273, 373] },
      appearance: 'Líquido incoloro, inodoro',
    },
    thermo: { dHf: -285.83, dGf: -237.14, S0: 69.95, Cp: 75.29, dHfus: 6.01, dHvap: 40.65, phase: 'l' },
    acidBase: {
      pKa: [14.00], fullyProtonated: 'H2O', conjugates: ['OH-'], chargeProtonated: 0,
      deltaH: [55840],
    },
    spectra: {
      ir: [
        { wavenumber: 3400, intensity: 1.0, width: 350, assignment: 'tensión O–H (asociada)', mode: 'tension' },
        { wavenumber: 1640, intensity: 0.35, width: 60, assignment: 'flexión H–O–H', mode: 'flexion' },
      ],
    },
    safety: { ...NO_HAZARD, storage: 'Sin restricciones.', wasteStream: 'Vertido al desagüe.' },
  }),

  S({
    id: 'hcl', formula: 'HCl', name: 'Ácido clorhídrico', synonyms: ['cloruro de hidrógeno', 'ácido muriático'],
    casNumber: '7647-01-0', structure: 'Cl', moleculeId: 'hcl',
    phase: 'ac', categories: ['ácido', 'ácido fuerte', 'inorgánico', 'titrante'],
    role: 'Ácido fuerte monoprótico de referencia; titrante primario de bases y patrón de pH.',
    courses: ['qg1', 'qan1', 'qan2', 'qinorg1'],
    physical: {
      meltingPoint: 158.98, boilingPoint: 188.1, density: 1.18,
      solubilityWater: 72, appearance: 'Disolución incolora, humos ácidos',
    },
    thermo: { dHf: -167.16, dGf: -131.25, S0: 56.5, Cp: -136.4, phase: 'ac' },
    acidBase: {
      pKa: [-6.3], fullyProtonated: 'HCl', conjugates: ['Cl-'], chargeProtonated: 0, strong: true,
    },
    redox: [{ halfReaction: 'Cl2 + 2 e- ⇌ 2 Cl-', E0: 1.35827, n: 2 }],
    safety: STRONG_ACID_SAFETY({
      hazards: [
        { code: 'H314', text: 'Provoca quemaduras graves en la piel y lesiones oculares graves.' },
        { code: 'H335', text: 'Puede irritar las vías respiratorias.' },
        { code: 'H290', text: 'Puede ser corrosivo para los metales.' },
      ],
      exposureLimitPpm: 5,
      incompatibilities: ['naoh', 'koh', 'nh3', 'nahco3', 'na2co3', 'kmno4', 'naclo'],
      notes: [
        'Manipular el concentrado en vitrina: emite HCl gaseoso.',
        'Con hipoclorito libera cloro gas: nunca mezclar residuos.',
      ],
    }),
    reactsWith: ['naoh', 'nahco3', 'na2co3', 'caco3', 'zn', 'agno3'],
  }),

  S({
    id: 'h2so4', formula: 'H2SO4', name: 'Ácido sulfúrico', synonyms: ['aceite de vitriolo'],
    casNumber: '7664-93-9', moleculeId: 'h2so4',
    phase: 'l', categories: ['ácido', 'ácido fuerte', 'diprótico', 'inorgánico', 'deshidratante'],
    role: 'Ácido diprótico: primera ionización fuerte, segunda débil — el mejor ejemplo del contraste.',
    courses: ['qg1', 'qg2', 'qan1', 'qan2'],
    physical: {
      meltingPoint: 283.46, boilingPoint: 610, density: 1.8302,
      viscosity: 24.2, refractiveIndex: 1.4183, appearance: 'Líquido viscoso incoloro',
    },
    thermo: { dHf: -813.99, dGf: -690.00, S0: 20.1, phase: 'ac' },
    acidBase: {
      pKa: [-3.0, 1.99], fullyProtonated: 'H2SO4', conjugates: ['HSO4-', 'SO4^2-'],
      chargeProtonated: 0, deltaH: [0, 22000],
    },
    safety: STRONG_ACID_SAFETY({
      hazards: [
        { code: 'H314', text: 'Provoca quemaduras graves en la piel y lesiones oculares graves.' },
        { code: 'H290', text: 'Puede ser corrosivo para los metales.' },
      ],
      exposureLimitPpm: 0.2,
      incompatibilities: ['naoh', 'koh', 'nh3', 'kmno4', 'nacl', 'etanol'],
      notes: [
        'La dilución libera ~880 J·g⁻¹: SIEMPRE ácido sobre agua, con agitación y baño de hielo.',
        'Deshidratante enérgico: carboniza materia orgánica, papel y piel.',
      ],
    }),
    reactsWith: ['naoh', 'bacl2', 'nacl', 'cu'],
  }),

  S({
    id: 'hno3', formula: 'HNO3', name: 'Ácido nítrico', synonyms: ['agua fuerte'],
    casNumber: '7697-37-2', moleculeId: 'hno3',
    phase: 'l', categories: ['ácido', 'ácido fuerte', 'oxidante', 'inorgánico'],
    role: 'Ácido fuerte y oxidante: disuelve metales que el HCl no ataca.',
    courses: ['qg2', 'qinorg1', 'qan3'],
    physical: {
      meltingPoint: 231.6, boilingPoint: 356, density: 1.5129,
      appearance: 'Líquido incoloro a amarillento (NO₂ disuelto)',
    },
    thermo: { dHf: -207.36, dGf: -111.25, S0: 146.4, phase: 'ac' },
    acidBase: { pKa: [-1.4], fullyProtonated: 'HNO3', conjugates: ['NO3-'], chargeProtonated: 0, strong: true },
    redox: [
      { halfReaction: 'NO3- + 4 H+ + 3 e- ⇌ NO + 2 H2O', E0: 0.957, n: 3, protons: 4 },
      { halfReaction: 'NO3- + 2 H+ + e- ⇌ NO2 + H2O', E0: 0.803, n: 1, protons: 2 },
    ],
    safety: STRONG_ACID_SAFETY({
      ghs: ['corrosivo', 'comburente'],
      hazards: [
        { code: 'H272', text: 'Puede agravar un incendio; comburente.' },
        { code: 'H314', text: 'Provoca quemaduras graves en la piel y lesiones oculares graves.' },
        { code: 'H331', text: 'Tóxico en caso de inhalación.' },
      ],
      exposureLimitPpm: 2,
      incompatibilities: ['naoh', 'nh3', 'etanol', 'acetona', 'metales'],
      notes: [
        'Con materia orgánica puede reaccionar violentamente. Nunca en el mismo bidón de residuos que disolventes.',
        'Los vapores nitrosos son tóxicos con efecto retardado: trabajar siempre en vitrina.',
      ],
    }),
  }),

  S({
    id: 'ch3cooh', formula: 'CH3COOH', name: 'Ácido acético', synonyms: ['ácido etanoico', 'AcOH'],
    casNumber: '64-19-7', structure: 'CC(=O)O', moleculeId: 'acetic-acid',
    phase: 'l', categories: ['ácido', 'ácido débil', 'orgánico', 'tampón', 'disolvente'],
    role: 'El ácido débil canónico: define el tampón acetato y la curva de titulación con salto reducido.',
    courses: ['qg1', 'qan1', 'qan2', 'qorg1'],
    physical: {
      meltingPoint: 289.6, boilingPoint: 391.05, density: 1.0492,
      viscosity: 1.056, refractiveIndex: 1.3720, solubilityWater: Infinity,
      logP: -0.17, permittivity: 6.2, flashPoint: 312,
      antoine: { A: 4.68206, B: 1642.54, C: -39.764, range: [290, 391] },
      appearance: 'Líquido incoloro, olor penetrante a vinagre',
    },
    thermo: { dHf: -484.5, dGf: -389.9, S0: 159.8, Cp: 123.3, dHvap: 23.7, phase: 'l' },
    acidBase: {
      pKa: [4.756], fullyProtonated: 'CH3COOH', conjugates: ['CH3COO-'],
      chargeProtonated: 0, deltaH: [-410],
    },
    spectra: {
      ir: [
        { wavenumber: 3000, intensity: 0.9, width: 400, assignment: 'tensión O–H de ácido carboxílico (dímero)', mode: 'tension' },
        { wavenumber: 1712, intensity: 1.0, width: 30, assignment: 'tensión C=O', mode: 'tension' },
        { wavenumber: 1412, intensity: 0.45, width: 25, assignment: 'flexión O–H', mode: 'flexion' },
        { wavenumber: 1294, intensity: 0.6, width: 30, assignment: 'tensión C–O', mode: 'tension' },
      ],
      nmr: [
        { nucleus: '1H', shift: 11.4, integration: 1, neighbours: 0, assignment: '–COOH' },
        { nucleus: '1H', shift: 2.10, integration: 3, neighbours: 0, assignment: '–CH₃' },
      ],
    },
    safety: {
      ghs: ['corrosivo', 'inflamable'],
      signal: 'Peligro',
      hazards: [
        { code: 'H226', text: 'Líquido y vapores inflamables.' },
        { code: 'H314', text: 'Provoca quemaduras graves en la piel y lesiones oculares graves.' },
      ],
      ppe: ['Bata', 'Gafas integrales', 'Guantes de nitrilo'],
      storage: 'Armario de inflamables. El glacial solidifica por debajo de 16 °C.',
      incompatibilities: ['naoh', 'koh', 'hno3', 'kmno4'],
      wasteStream: 'Residuo orgánico halogenado: NO. Bidón de disolventes no halogenados o residuo ácido diluido.',
      exposureLimitPpm: 10,
    },
    reactsWith: ['naoh', 'nahco3', 'etanol'],
  }),

  S({
    id: 'naoh', formula: 'NaOH', name: 'Hidróxido de sodio', synonyms: ['sosa cáustica', 'lejía sólida'],
    casNumber: '1310-73-2',
    phase: 's', categories: ['base', 'base fuerte', 'inorgánico', 'titrante'],
    role: 'Base fuerte y titrante estándar; su carbonatación al aire es una lección de error sistemático.',
    courses: ['qg1', 'qan1', 'qan2'],
    physical: {
      meltingPoint: 596, boilingPoint: 1661, density: 2.13, solubilityWater: 111,
      appearance: 'Sólido blanco higroscópico, lentejas o escamas',
    },
    thermo: { dHf: -469.15, dGf: -419.2, S0: 48.1, phase: 'ac' },
    acidBase: {
      pKa: [14.0], fullyProtonated: 'H2O', conjugates: ['OH-'], chargeProtonated: 0, strong: true,
    },
    safety: STRONG_BASE_SAFETY({
      notes: [
        'Muy higroscópico y carbonatable: las disoluciones deben normalizarse contra ftalato ácido de potasio antes de cada uso.',
        'Con aluminio o zinc desprende hidrógeno: riesgo de sobrepresión en recipientes cerrados.',
      ],
      incompatibilities: ['hcl', 'h2so4', 'hno3', 'ch3cooh', 'al', 'zn'],
    }),
    reactsWith: ['hcl', 'h2so4', 'ch3cooh', 'khp', 'cuso4', 'fecl3'],
  }),

  S({
    id: 'nh3', formula: 'NH3', name: 'Amoníaco', synonyms: ['amoniaco', 'trihidruro de nitrógeno'],
    casNumber: '7664-41-7', structure: 'N', moleculeId: 'ammonia',
    phase: 'g', categories: ['base', 'base débil', 'inorgánico', 'ligando', 'tampón'],
    role: 'Base débil y ligando: el mismo NH₃ actúa como base en Analítica y como ligando en Inorgánica.',
    courses: ['qg1', 'qan2', 'qinorg1', 'qinorg2'],
    physical: {
      meltingPoint: 195.42, boilingPoint: 239.81, density: 0.000769, solubilityWater: 53,
      permittivity: 16.9, appearance: 'Gas incoloro de olor picante',
      antoine: { A: 4.86886, B: 1113.928, C: -10.409, range: [190, 240] },
    },
    thermo: { dHf: -80.29, dGf: -26.50, S0: 111.3, phase: 'ac' },
    acidBase: {
      pKa: [9.25], fullyProtonated: 'NH4+', conjugates: ['NH3'], chargeProtonated: 1,
      deltaH: [52220], pKbSource: [4.75],
    },
    spectra: {
      ir: [
        { wavenumber: 3336, intensity: 0.7, width: 40, assignment: 'tensión N–H asimétrica', mode: 'tension' },
        { wavenumber: 1626, intensity: 0.5, width: 30, assignment: 'flexión N–H', mode: 'flexion' },
        { wavenumber: 950, intensity: 1.0, width: 60, assignment: 'inversión (paraguas)', mode: 'flexion' },
      ],
    },
    safety: {
      ghs: ['corrosivo', 'toxico-agudo', 'gas-presion', 'peligro-ambiental'],
      signal: 'Peligro',
      hazards: [
        { code: 'H314', text: 'Provoca quemaduras graves en la piel y lesiones oculares graves.' },
        { code: 'H331', text: 'Tóxico en caso de inhalación.' },
        { code: 'H400', text: 'Muy tóxico para los organismos acuáticos.' },
      ],
      ppe: ['Bata', 'Gafas integrales', 'Guantes', 'Trabajo en vitrina obligatorio'],
      storage: 'Vitrina ventilada, lejos de ácidos y de hipoclorito.',
      incompatibilities: ['hcl', 'h2so4', 'hno3', 'naclo', 'i2'],
      wasteStream: 'Residuo básico. No mezclar con hipoclorito (cloraminas).',
      exposureLimitPpm: 20,
      notes: ['Con hipoclorito forma cloraminas tóxicas. Con yodo forma triyoduro de nitrógeno, explosivo por fricción al secarse.'],
    },
  }),

  S({
    id: 'h3po4', formula: 'H3PO4', name: 'Ácido fosfórico', synonyms: ['ácido ortofosfórico'],
    casNumber: '7664-38-2', moleculeId: 'h3po4',
    phase: 'l', categories: ['ácido', 'triprótico', 'inorgánico', 'tampón'],
    role: 'Ácido triprótico: tres pKa bien separados y el sistema tampón fisiológico por excelencia.',
    courses: ['qg2', 'qan1', 'qan2', 'qbio'],
    physical: {
      meltingPoint: 315.5, boilingPoint: 431, density: 1.885, solubilityWater: Infinity,
      appearance: 'Líquido viscoso incoloro',
    },
    thermo: { dHf: -1288.3, dGf: -1142.5, S0: 158.2, phase: 'ac' },
    acidBase: {
      pKa: [2.148, 7.198, 12.35],
      fullyProtonated: 'H3PO4',
      conjugates: ['H2PO4-', 'HPO4^2-', 'PO4^3-'],
      chargeProtonated: 0,
      deltaH: [-8000, 4200, 14700],
    },
    safety: STRONG_ACID_SAFETY({
      signal: 'Peligro',
      incompatibilities: ['naoh', 'koh', 'nh3'],
      notes: ['Menos agresivo que el sulfúrico pero igualmente corrosivo en concentrado.'],
    }),
  }),

  S({
    id: 'h2co3', formula: 'H2CO3', name: 'Ácido carbónico', synonyms: ['dióxido de carbono disuelto'],
    casNumber: '463-79-6',
    phase: 'ac', categories: ['ácido', 'diprótico', 'inorgánico', 'tampón', 'ambiental'],
    role: 'Sistema carbonato: gobierna el pH de las aguas naturales, la alcalinidad y la dureza.',
    courses: ['qan2', 'hidro', 'qamb'],
    physical: { solubilityWater: Infinity, appearance: 'Sólo existe en disolución' },
    thermo: { dHf: -699.65, dGf: -623.08, S0: 187.4, phase: 'ac' },
    acidBase: {
      // Apparent constants: pKa1 refers to total dissolved CO2 (CO2(ac) + H2CO3).
      pKa: [6.352, 10.329],
      fullyProtonated: 'H2CO3',
      conjugates: ['HCO3-', 'CO3^2-'],
      chargeProtonated: 0,
      deltaH: [9150, 14900],
    },
    spectra: {
      ir: [{ wavenumber: 1400, intensity: 1.0, width: 90, assignment: 'tensión asimétrica CO₃²⁻', mode: 'tension' }],
    },
    safety: { ...NO_HAZARD, wasteStream: 'Vertido al desagüe tras neutralización.' },
  }),

  S({
    id: 'khp', formula: 'C8H5KO4', name: 'Ftalato ácido de potasio', synonyms: ['hidrogenoftalato de potasio', 'KHP'],
    casNumber: '877-24-7',
    phase: 's', categories: ['patrón primario', 'ácido débil', 'orgánico'],
    role: 'Patrón primario para normalizar NaOH: no higroscópico, alta masa equivalente, pureza certificable.',
    courses: ['qan1', 'qan2'],
    physical: {
      meltingPoint: 568, density: 1.636, solubilityWater: 8.0,
      appearance: 'Cristales blancos, estables al aire',
    },
    acidBase: {
      pKa: [5.408], fullyProtonated: 'C8H5KO4', conjugates: ['C8H4KO4-'], chargeProtonated: 0,
    },
    safety: {
      ...NO_HAZARD,
      ppe: ['Bata', 'Gafas de seguridad'],
      storage: 'Desecador o estufa a 110 °C durante 2 h antes de pesar.',
      notes: ['Secar a 110 °C y enfriar en desecador: la humedad superficial es la principal fuente de error sistemático.'],
    },
    reactsWith: ['naoh'],
  }),

  S({
    id: 'na2co3', formula: 'Na2CO3', name: 'Carbonato de sodio', synonyms: ['sosa', 'carbonato sódico anhidro'],
    casNumber: '497-19-8',
    phase: 's', categories: ['sal', 'patrón primario', 'base', 'inorgánico'],
    role: 'Patrón primario para ácidos; base diprótica con dos puntos de equivalencia distinguibles.',
    courses: ['qan1', 'qan2', 'hidro'],
    physical: {
      meltingPoint: 1124, density: 2.54, solubilityWater: 21.5,
      appearance: 'Polvo blanco higroscópico',
    },
    thermo: { dHf: -1130.7, dGf: -1044.4, S0: 135.0, phase: 's' },
    safety: {
      ghs: ['irritante'], signal: 'Atención',
      hazards: [{ code: 'H319', text: 'Provoca irritación ocular grave.' }],
      ppe: ['Bata', 'Gafas de seguridad'],
      storage: 'Recipiente cerrado; secar a 270 °C antes de usar como patrón.',
      incompatibilities: ['hcl', 'h2so4', 'hno3'],
      wasteStream: 'Residuo básico diluido.',
    },
    reactsWith: ['hcl', 'h2so4', 'cacl2'],
  }),

  S({
    id: 'nahco3', formula: 'NaHCO3', name: 'Bicarbonato de sodio', synonyms: ['hidrogenocarbonato de sodio', 'bicarbonato sódico'],
    casNumber: '144-55-8',
    phase: 's', categories: ['sal', 'anfótero', 'tampón', 'inorgánico'],
    role: 'Especie anfótera: el ejemplo con el que se enseña el pH de una sal ácida, pH ≈ ½(pKa₁+pKa₂).',
    courses: ['qan2', 'hidro', 'qamb'],
    physical: { meltingPoint: 323, density: 2.20, solubilityWater: 9.6, appearance: 'Polvo blanco' },
    thermo: { dHf: -950.8, dGf: -851.0, S0: 101.7, phase: 's' },
    safety: { ...NO_HAZARD, wasteStream: 'Neutralizante habitual de derrames ácidos.' },
    reactsWith: ['hcl', 'h2so4', 'ch3cooh'],
  }),

  // =========================================================================
  // Salts, precipitation and complexation
  // =========================================================================

  S({
    id: 'nacl', formula: 'NaCl', name: 'Cloruro de sodio', synonyms: ['sal común', 'halita'],
    casNumber: '7647-14-5',
    phase: 's', categories: ['sal', 'electrolito fuerte', 'inorgánico'],
    role: 'Electrolito fuerte de referencia y ajuste de fuerza iónica.',
    courses: ['qg1', 'qan1', 'electro1'],
    physical: {
      meltingPoint: 1074, boilingPoint: 1738, density: 2.17, solubilityWater: 36.0,
      refractiveIndex: 1.544, appearance: 'Cristales cúbicos incoloros',
    },
    thermo: { dHf: -411.15, dGf: -384.14, S0: 72.1, Cp: 50.5, phase: 's' },
    safety: { ...NO_HAZARD },
    reactsWith: ['agno3', 'h2so4'],
  }),

  S({
    id: 'agno3', formula: 'AgNO3', name: 'Nitrato de plata', synonyms: ['piedra infernal'],
    casNumber: '7761-88-8',
    phase: 's', categories: ['sal', 'titrante', 'oxidante', 'inorgánico'],
    role: 'Titrante argentométrico (métodos de Mohr, Volhard y Fajans).',
    courses: ['qan2', 'qan3'],
    physical: {
      meltingPoint: 482, density: 4.35, solubilityWater: 234,
      appearance: 'Cristales incoloros que oscurecen con la luz',
    },
    thermo: { dHf: -124.4, dGf: -33.4, S0: 140.9, phase: 's' },
    redox: [{ halfReaction: 'Ag+ + e- ⇌ Ag', E0: 0.7996, n: 1 }],
    safety: {
      ghs: ['corrosivo', 'comburente', 'peligro-ambiental'], signal: 'Peligro',
      hazards: [
        { code: 'H272', text: 'Puede agravar un incendio; comburente.' },
        { code: 'H314', text: 'Provoca quemaduras graves en la piel y lesiones oculares graves.' },
        { code: 'H410', text: 'Muy tóxico para los organismos acuáticos, con efectos nocivos duraderos.' },
      ],
      ppe: ['Bata', 'Gafas integrales', 'Guantes de nitrilo'],
      storage: 'Frasco topacio, protegido de la luz. Separado de materia orgánica.',
      incompatibilities: ['nh3', 'etanol', 'hcl'],
      wasteStream: 'Residuo de metales pesados — recuperación de plata. NUNCA al desagüe.',
      notes: [
        'Mancha la piel de negro de forma persistente (plata metálica fotorreducida).',
        'Con amoníaco concentrado en medio básico puede formar nitruro de plata (fulminante). No dejar residuos amoniacales de plata.',
      ],
    },
    reactsWith: ['nacl', 'ki', 'k2cro4', 'nh3'],
  }),

  S({
    id: 'agcl', formula: 'AgCl', name: 'Cloruro de plata', synonyms: ['clorargirita'],
    casNumber: '7783-90-6',
    phase: 's', categories: ['precipitado', 'sal poco soluble', 'inorgánico'],
    role: 'Precipitado de referencia para el Kps, el efecto del ion común y la fotosensibilidad.',
    courses: ['qan2', 'qan3', 'qinorg1'],
    physical: {
      meltingPoint: 728, boilingPoint: 1820, density: 5.56, solubilityWater: 0.00019,
      appearance: 'Precipitado blanco caseoso, violeta con la luz',
    },
    thermo: { dHf: -127.0, dGf: -109.8, S0: 96.3, phase: 's' },
    safety: {
      ghs: ['peligro-ambiental'], signal: 'Atención',
      hazards: [{ code: 'H410', text: 'Muy tóxico para los organismos acuáticos.' }],
      ppe: ['Bata', 'Gafas de seguridad'],
      storage: 'Frasco topacio.',
      incompatibilities: ['nh3'],
      wasteStream: 'Residuo de plata para recuperación.',
    },
  }),

  S({
    id: 'caco3', formula: 'CaCO3', name: 'Carbonato de calcio', synonyms: ['calcita', 'caliza', 'mármol'],
    casNumber: '471-34-1',
    phase: 's', categories: ['precipitado', 'mineral', 'inorgánico', 'ambiental'],
    role: 'Controla la dureza, la alcalinidad y el índice de Langelier de las aguas naturales.',
    courses: ['qan2', 'hidro', 'qamb', 'qsuelo'],
    physical: {
      meltingPoint: 1612, density: 2.71, solubilityWater: 0.0013,
      refractiveIndex: 1.6584, appearance: 'Sólido blanco',
    },
    thermo: { dHf: -1207.6, dGf: -1129.1, S0: 91.7, Cp: 83.5, phase: 's' },
    safety: { ...NO_HAZARD, wasteStream: 'Residuo sólido inerte.' },
    reactsWith: ['hcl', 'h2so4', 'h2co3'],
  }),

  S({
    id: 'edta', formula: 'C10H16N2O8', name: 'Ácido etilendiaminotetraacético', synonyms: ['EDTA', 'ácido edético'],
    casNumber: '60-00-4', structure: 'OC(=O)CN(CC(=O)O)CCN(CC(=O)O)CC(=O)O',
    phase: 's', categories: ['ligando', 'quelante', 'titrante', 'orgánico'],
    role: 'Ligando hexadentado: base de toda la volumetría de complejación y del enmascaramiento de metales.',
    courses: ['qan2', 'qan3', 'qinorg2', 'hidro'],
    physical: {
      meltingPoint: 518, density: 0.86, solubilityWater: 0.05,
      appearance: 'Polvo blanco cristalino, poco soluble en su forma ácida',
    },
    acidBase: {
      pKa: [1.99, 2.67, 6.16, 10.26],
      fullyProtonated: 'H4Y',
      conjugates: ['H3Y-', 'H2Y^2-', 'HY^3-', 'Y^4-'],
      chargeProtonated: 0,
    },
    safety: {
      ghs: ['irritante'], signal: 'Atención',
      hazards: [{ code: 'H319', text: 'Provoca irritación ocular grave.' }],
      ppe: ['Bata', 'Gafas de seguridad'],
      storage: 'Recipiente cerrado. La sal disódica (Na₂H₂Y·2H₂O) es la forma de trabajo.',
      incompatibilities: [],
      wasteStream: 'Residuo acuoso con metales complejados: tratar como residuo de metales.',
      notes: ['La fracción α₄ (Y⁴⁻) depende fuertemente del pH: por eso toda valoración con EDTA se tampona.'],
    },
    reactsWith: ['cacl2', 'mgso4', 'cuso4', 'fecl3'],
  }),

  S({
    id: 'cuso4', formula: 'CuSO4·5H2O', name: 'Sulfato de cobre(II) pentahidratado', synonyms: ['vitriolo azul', 'piedra lipes'],
    casNumber: '7758-99-8',
    phase: 's', categories: ['sal', 'complejo', 'inorgánico', 'colorimetría'],
    role: 'Ion Cu²⁺: color, complejación con amoníaco y EDTA, y patrón de UV-Vis por Beer-Lambert.',
    courses: ['qg1', 'qinorg1', 'qinorg2', 'qan3'],
    physical: {
      meltingPoint: 383, density: 2.286, solubilityWater: 32,
      appearance: 'Cristales azul intenso; blanco cuando se deshidrata',
    },
    thermo: { dHf: -2279.7, dGf: -1880.0, S0: 300.4, phase: 's' },
    redox: [{ halfReaction: 'Cu2+ + 2 e- ⇌ Cu', E0: 0.3419, n: 2 }],
    spectra: {
      uv: [{
        lambdaMax: 810, epsilon: 12, width: 220, species: 'Cu(H2O)6^2+',
        assignment: 'transición d–d del acuocomplejo octaédrico (distorsión Jahn-Teller)',
      }, {
        lambdaMax: 600, epsilon: 55, width: 130, species: 'Cu(NH3)4^2+',
        assignment: 'd–d del tetraamminocuprato(II): el desplazamiento al azul intenso al añadir NH₃',
      }],
    },
    safety: {
      ghs: ['toxico-agudo', 'irritante', 'peligro-ambiental'], signal: 'Peligro',
      hazards: [
        { code: 'H302', text: 'Nocivo en caso de ingestión.' },
        { code: 'H315', text: 'Provoca irritación cutánea.' },
        { code: 'H410', text: 'Muy tóxico para los organismos acuáticos, con efectos duraderos.' },
      ],
      ppe: ['Bata', 'Gafas de seguridad', 'Guantes'],
      storage: 'Recipiente cerrado, ambiente seco.',
      incompatibilities: ['naoh', 'nh3'],
      wasteStream: 'Residuo de metales pesados. NUNCA al desagüe.',
    },
    reactsWith: ['naoh', 'nh3', 'edta', 'zn', 'fe'],
  }),

  S({
    id: 'fecl3', formula: 'FeCl3', name: 'Cloruro de hierro(III)', synonyms: ['cloruro férrico'],
    casNumber: '7705-08-0',
    phase: 's', categories: ['sal', 'ácido de Lewis', 'inorgánico', 'coagulante'],
    role: 'Fe³⁺: hidrólisis ácida, complejos coloreados con tiocianato y coagulante en tratamiento de aguas.',
    courses: ['qinorg1', 'qan3', 'qamb', 'hidro'],
    physical: {
      meltingPoint: 580, boilingPoint: 588, density: 2.90, solubilityWater: 92,
      appearance: 'Sólido pardo-verdoso muy higroscópico; disolución amarilla',
    },
    thermo: { dHf: -399.5, dGf: -334.0, S0: 142.3, phase: 's' },
    redox: [{ halfReaction: 'Fe3+ + e- ⇌ Fe2+', E0: 0.771, n: 1 }],
    spectra: {
      uv: [{
        lambdaMax: 447, epsilon: 5000, width: 90, species: 'FeSCN^2+',
        assignment: 'transferencia de carga del tiocianatohierro(III) — base del ensayo colorimétrico de Fe',
      }],
    },
    safety: {
      ghs: ['corrosivo', 'toxico-agudo'], signal: 'Peligro',
      hazards: [
        { code: 'H302', text: 'Nocivo en caso de ingestión.' },
        { code: 'H314', text: 'Provoca quemaduras graves en la piel y lesiones oculares graves.' },
      ],
      ppe: ['Bata', 'Gafas integrales', 'Guantes'],
      storage: 'Muy higroscópico y delicuescente: recipiente hermético.',
      incompatibilities: ['naoh', 'nh3'],
      wasteStream: 'Residuo de metales.',
      notes: ['Las disoluciones son ácidas por hidrólisis: [Fe(H₂O)₆]³⁺ tiene pKa ≈ 2.2.'],
    },
    reactsWith: ['naoh', 'kscn', 'edta'],
  }),

  // =========================================================================
  // Redox reagents
  // =========================================================================

  S({
    id: 'kmno4', formula: 'KMnO4', name: 'Permanganato de potasio', synonyms: ['camaleón mineral'],
    casNumber: '7722-64-7',
    phase: 's', categories: ['oxidante', 'titrante', 'inorgánico'],
    role: 'Titrante redox autoindicador: el color violeta desaparece hasta el punto final.',
    courses: ['qan3', 'qan4', 'qinorg2'],
    physical: {
      meltingPoint: 513, density: 2.70, solubilityWater: 6.4,
      appearance: 'Cristales violeta oscuro de brillo metálico',
    },
    thermo: { dHf: -837.2, dGf: -737.6, S0: 171.7, phase: 's' },
    redox: [
      { halfReaction: 'MnO4- + 8 H+ + 5 e- ⇌ Mn2+ + 4 H2O', E0: 1.507, n: 5, protons: 8, conditions: 'medio ácido' },
      { halfReaction: 'MnO4- + 2 H2O + 3 e- ⇌ MnO2 + 4 OH-', E0: 0.595, n: 3, conditions: 'medio neutro o básico' },
      { halfReaction: 'MnO4- + e- ⇌ MnO4^2-', E0: 0.558, n: 1, conditions: 'medio fuertemente básico' },
    ],
    spectra: {
      uv: [{
        lambdaMax: 525, epsilon: 2455, width: 45, species: 'MnO4-',
        assignment: 'transferencia de carga ligando→metal; base de la determinación espectrofotométrica de Mn',
      }],
    },
    safety: {
      ghs: ['comburente', 'toxico-agudo', 'peligro-ambiental'], signal: 'Peligro',
      hazards: [
        { code: 'H272', text: 'Puede agravar un incendio; comburente.' },
        { code: 'H302', text: 'Nocivo en caso de ingestión.' },
        { code: 'H410', text: 'Muy tóxico para los organismos acuáticos, con efectos duraderos.' },
      ],
      ppe: ['Bata', 'Gafas integrales', 'Guantes'],
      storage: 'Separado de todo material orgánico, glicerina y ácidos concentrados.',
      incompatibilities: ['ch3cooh', 'etanol', 'acetona', 'h2so4', 'hcl'],
      wasteStream: 'Reducir con bisulfito antes de la retirada; residuo de manganeso.',
      notes: [
        'Con glicerina o etanol puede inflamarse espontáneamente.',
        'Sus disoluciones no son patrón primario: se descomponen con la luz y hay que normalizarlas con oxalato sódico.',
      ],
    },
    reactsWith: ['na2c2o4', 'h2o2', 'fecl2', 'hcl'],
  }),

  S({
    id: 'na2c2o4', formula: 'Na2C2O4', name: 'Oxalato de sodio', synonyms: ['etanodioato de sodio'],
    casNumber: '62-76-0',
    phase: 's', categories: ['patrón primario', 'reductor', 'orgánico'],
    role: 'Patrón primario para normalizar permanganato — la reacción es autocatalítica por Mn²⁺.',
    courses: ['qan3'],
    physical: { meltingPoint: 523, density: 2.34, solubilityWater: 3.7, appearance: 'Polvo blanco' },
    acidBase: {
      pKa: [1.25, 4.14], fullyProtonated: 'H2C2O4', conjugates: ['HC2O4-', 'C2O4^2-'], chargeProtonated: 0,
    },
    redox: [{ halfReaction: '2 CO2 + 2 H+ + 2 e- ⇌ H2C2O4', E0: -0.49, n: 2, protons: 2 }],
    safety: {
      ghs: ['toxico-agudo'], signal: 'Atención',
      hazards: [
        { code: 'H302', text: 'Nocivo en caso de ingestión.' },
        { code: 'H312', text: 'Nocivo en contacto con la piel.' },
      ],
      ppe: ['Bata', 'Gafas de seguridad', 'Guantes'],
      storage: 'Secar a 105 °C antes de pesar como patrón.',
      incompatibilities: ['kmno4'],
      wasteStream: 'Residuo acuoso; el oxalato precipita calcio, no verter con residuos cálcicos.',
      notes: ['La valoración con KMnO₄ requiere 60 °C: por debajo la cinética es demasiado lenta y el punto final se pasa.'],
    },
    reactsWith: ['kmno4', 'cacl2'],
  }),

  S({
    id: 'ki', formula: 'KI', name: 'Yoduro de potasio', synonyms: [],
    casNumber: '7681-11-0',
    phase: 's', categories: ['sal', 'reductor', 'inorgánico'],
    role: 'Fuente de yoduro en yodometría; con yodo forma triyoduro, que es lo que realmente se valora.',
    courses: ['qan3'],
    physical: { meltingPoint: 954, boilingPoint: 1603, density: 3.12, solubilityWater: 140, appearance: 'Cristales blancos' },
    thermo: { dHf: -327.9, dGf: -324.9, S0: 106.3, phase: 's' },
    redox: [{ halfReaction: 'I2 + 2 e- ⇌ 2 I-', E0: 0.5355, n: 2 }],
    safety: {
      ...NO_HAZARD,
      ghs: ['irritante'], signal: 'Atención',
      hazards: [{ code: 'H319', text: 'Provoca irritación ocular grave.' }],
      storage: 'Frasco topacio: se oxida lentamente a yodo con la luz y el aire (color amarillo).',
      wasteStream: 'Residuo acuoso.',
    },
    reactsWith: ['agno3', 'i2', 'kmno4'],
  }),

  S({
    id: 'na2s2o3', formula: 'Na2S2O3', name: 'Tiosulfato de sodio', synonyms: ['hiposulfito sódico', 'antichlor'],
    casNumber: '7772-98-7',
    phase: 's', categories: ['reductor', 'titrante', 'inorgánico'],
    role: 'Titrante de yodometría; el almidón como indicador se añade cerca del punto final, no antes.',
    courses: ['qan3'],
    physical: { meltingPoint: 321, density: 1.667, solubilityWater: 70, appearance: 'Cristales incoloros' },
    redox: [{ halfReaction: 'S4O6^2- + 2 e- ⇌ 2 S2O3^2-', E0: 0.08, n: 2 }],
    safety: {
      ...NO_HAZARD,
      storage: 'Las disoluciones se descomponen por bacterias y por CO₂: preparar con agua hervida y normalizar semanalmente.',
      wasteStream: 'Residuo acuoso.',
      notes: ['Añadir el almidón sólo cuando el color pardo del I₂ haya virado a amarillo pálido: si se añade antes, el complejo yodo-almidón se libera con dificultad y el punto final se retrasa.'],
    },
    reactsWith: ['i2', 'ki'],
  }),

  S({
    id: 'h2o2', formula: 'H2O2', name: 'Peróxido de hidrógeno', synonyms: ['agua oxigenada'],
    casNumber: '7722-84-1', moleculeId: 'h2o2',
    phase: 'l', categories: ['oxidante', 'reductor', 'inorgánico', 'química verde'],
    role: 'Oxidante y reductor a la vez; oxidante limpio por excelencia en Química Verde (su residuo es agua).',
    courses: ['qan3', 'qverde', 'qamb'],
    physical: {
      meltingPoint: 272.7, boilingPoint: 423.3, density: 1.45, solubilityWater: Infinity,
      appearance: 'Líquido incoloro, ligeramente viscoso',
    },
    thermo: { dHf: -191.17, dGf: -134.03, S0: 143.9, phase: 'ac' },
    acidBase: { pKa: [11.62], fullyProtonated: 'H2O2', conjugates: ['HO2-'], chargeProtonated: 0 },
    redox: [
      { halfReaction: 'H2O2 + 2 H+ + 2 e- ⇌ 2 H2O', E0: 1.776, n: 2, protons: 2 },
      { halfReaction: 'O2 + 2 H+ + 2 e- ⇌ H2O2', E0: 0.695, n: 2, protons: 2 },
    ],
    safety: {
      ghs: ['comburente', 'corrosivo'], signal: 'Peligro',
      hazards: [
        { code: 'H271', text: 'Puede provocar un incendio o una explosión; muy comburente.' },
        { code: 'H314', text: 'Provoca quemaduras graves en la piel y lesiones oculares graves.' },
      ],
      ppe: ['Bata', 'Gafas integrales', 'Guantes'],
      storage: 'Frasco ventilado, en oscuridad y frío. Nunca en recipiente hermético: se descompone liberando O₂.',
      incompatibilities: ['kmno4', 'fecl3', 'acetona'],
      wasteStream: 'Diluir mucho y descomponer catalíticamente antes de verter.',
      notes: ['Con acetona en medio ácido forma peróxido de acetona, explosivo por choque. Prohibido mezclar esos residuos.'],
    },
    reactsWith: ['kmno4', 'ki'],
  }),

  S({
    id: 'zn', formula: 'Zn', name: 'Zinc', synonyms: ['cinc'],
    casNumber: '7440-66-6',
    phase: 's', categories: ['metal', 'reductor', 'electrodo'],
    role: 'Ánodo de la pila Daniell y reductor en la serie de actividad.',
    courses: ['qg1', 'electro1', 'electro2'],
    physical: { meltingPoint: 692.68, boilingPoint: 1180, density: 7.14, appearance: 'Metal gris azulado' },
    thermo: { dHf: 0, dGf: 0, S0: 41.6, Cp: 25.4, phase: 's' },
    redox: [{ halfReaction: 'Zn2+ + 2 e- ⇌ Zn', E0: -0.7618, n: 2 }],
    safety: {
      ghs: ['inflamable', 'peligro-ambiental'], signal: 'Peligro',
      hazards: [
        { code: 'H250', text: 'Se inflama espontáneamente en contacto con el aire (polvo fino).' },
        { code: 'H410', text: 'Muy tóxico para los organismos acuáticos.' },
      ],
      ppe: ['Bata', 'Gafas de seguridad'],
      storage: 'Seco. El polvo de zinc es pirofórico.',
      incompatibilities: ['hcl', 'h2so4', 'naoh'],
      wasteStream: 'Residuo metálico para reciclaje.',
      notes: ['Con ácidos o con NaOH desprende hidrógeno: riesgo de atmósfera explosiva en recipiente cerrado.'],
    },
    reactsWith: ['hcl', 'h2so4', 'cuso4'],
  }),

  S({
    id: 'cu', formula: 'Cu', name: 'Cobre', synonyms: [],
    casNumber: '7440-50-8',
    phase: 's', categories: ['metal', 'electrodo'],
    role: 'Cátodo de la pila Daniell; no desplaza al hidrógeno de los ácidos no oxidantes.',
    courses: ['qg1', 'electro1'],
    physical: { meltingPoint: 1357.77, boilingPoint: 2835, density: 8.96, appearance: 'Metal rojizo' },
    thermo: { dHf: 0, dGf: 0, S0: 33.2, Cp: 24.4, phase: 's' },
    redox: [
      { halfReaction: 'Cu2+ + 2 e- ⇌ Cu', E0: 0.3419, n: 2 },
      { halfReaction: 'Cu2+ + e- ⇌ Cu+', E0: 0.153, n: 1 },
    ],
    safety: { ...NO_HAZARD, wasteStream: 'Residuo metálico para reciclaje.' },
    reactsWith: ['hno3', 'agno3'],
  }),

  // =========================================================================
  // Solvents and organics
  // =========================================================================

  S({
    id: 'etanol', formula: 'C2H6O', name: 'Etanol', synonyms: ['alcohol etílico', 'EtOH'],
    casNumber: '64-17-5', structure: 'CCO', moleculeId: 'ethanol',
    phase: 'l', categories: ['disolvente', 'orgánico', 'alcohol', 'química verde'],
    role: 'Disolvente prótico polar; extracción fitoquímica y disolvente preferente en Química Verde.',
    courses: ['qorg1', 'qorg2', 'fito1', 'qverde'],
    physical: {
      meltingPoint: 159.05, boilingPoint: 351.44, density: 0.7893,
      viscosity: 1.074, refractiveIndex: 1.3611, solubilityWater: Infinity,
      logP: -0.31, permittivity: 24.5, flashPoint: 286,
      antoine: { A: 5.24677, B: 1598.673, C: -46.424, range: [293, 366] },
      appearance: 'Líquido incoloro, olor característico',
    },
    thermo: { dHf: -277.6, dGf: -174.8, S0: 160.7, Cp: 112.3, dHvap: 38.56, phase: 'l' },
    spectra: {
      ir: [
        { wavenumber: 3350, intensity: 0.95, width: 300, assignment: 'tensión O–H (con puente de hidrógeno)', mode: 'tension' },
        { wavenumber: 2974, intensity: 0.7, width: 40, assignment: 'tensión C–H', mode: 'tension' },
        { wavenumber: 1050, intensity: 0.9, width: 40, assignment: 'tensión C–O de alcohol primario', mode: 'tension' },
      ],
      nmr: [
        { nucleus: '1H', shift: 3.69, integration: 2, neighbours: 3, J: 7.0, assignment: '–CH₂–' },
        { nucleus: '1H', shift: 2.60, integration: 1, neighbours: 0, assignment: '–OH (intercambiable)' },
        { nucleus: '1H', shift: 1.22, integration: 3, neighbours: 2, J: 7.0, assignment: '–CH₃' },
      ],
      msFragments: [
        { mz: 46, intensity: 25, assignment: 'M⁺·' },
        { mz: 45, intensity: 55, assignment: '[M–H]⁺' },
        { mz: 31, intensity: 100, assignment: 'CH₂=OH⁺ (ruptura α, pico base de alcoholes primarios)' },
        { mz: 29, intensity: 30, assignment: 'C₂H₅⁺ / CHO⁺' },
      ],
    },
    chromatography: { gcKovats: 450, hplcC18: { k0: 1.2, S: 2.1 } },
    safety: {
      ghs: ['inflamable', 'irritante'], signal: 'Peligro',
      hazards: [
        { code: 'H225', text: 'Líquido y vapores muy inflamables.' },
        { code: 'H319', text: 'Provoca irritación ocular grave.' },
      ],
      ppe: ['Bata', 'Gafas de seguridad'],
      storage: 'Armario de inflamables, lejos de fuentes de ignición.',
      incompatibilities: ['hno3', 'kmno4', 'h2so4'],
      wasteStream: 'Bidón de disolventes NO halogenados.',
      exposureLimitPpm: 1000,
    },
  }),

  S({
    id: 'acetona', formula: 'C3H6O', name: 'Acetona', synonyms: ['propanona', 'dimetilcetona'],
    casNumber: '67-64-1', structure: 'CC(=O)C', moleculeId: 'acetone',
    phase: 'l', categories: ['disolvente', 'orgánico', 'cetona'],
    role: 'Disolvente aprótico polar y cetona modelo para IR (C=O) y RMN.',
    courses: ['qorg1', 'qorg2'],
    physical: {
      meltingPoint: 178.5, boilingPoint: 329.22, density: 0.7845,
      viscosity: 0.306, refractiveIndex: 1.3588, solubilityWater: Infinity,
      logP: -0.24, permittivity: 20.7, flashPoint: 253,
      antoine: { A: 4.42448, B: 1312.253, C: -32.445, range: [259, 508] },
      appearance: 'Líquido incoloro muy volátil',
    },
    thermo: { dHf: -248.4, dGf: -155.4, S0: 199.8, Cp: 125.5, dHvap: 31.3, phase: 'l' },
    spectra: {
      ir: [
        { wavenumber: 1715, intensity: 1.0, width: 25, assignment: 'tensión C=O de cetona', mode: 'tension' },
        { wavenumber: 2990, intensity: 0.5, width: 40, assignment: 'tensión C–H', mode: 'tension' },
        { wavenumber: 1360, intensity: 0.6, width: 25, assignment: 'flexión CH₃', mode: 'flexion' },
      ],
      nmr: [{ nucleus: '1H', shift: 2.17, integration: 6, neighbours: 0, assignment: '2 × –CH₃' }],
      msFragments: [
        { mz: 58, intensity: 60, assignment: 'M⁺·' },
        { mz: 43, intensity: 100, assignment: 'CH₃CO⁺ (acilio, pico base)' },
        { mz: 15, intensity: 35, assignment: 'CH₃⁺' },
      ],
    },
    chromatography: { gcKovats: 472 },
    safety: {
      ghs: ['inflamable', 'irritante'], signal: 'Peligro',
      hazards: [
        { code: 'H225', text: 'Líquido y vapores muy inflamables.' },
        { code: 'H319', text: 'Provoca irritación ocular grave.' },
        { code: 'H336', text: 'Puede provocar somnolencia o vértigo.' },
      ],
      ppe: ['Bata', 'Gafas de seguridad', 'Guantes de nitrilo (permeación rápida: cambiar a menudo)'],
      storage: 'Armario de inflamables. Punto de inflamación −20 °C: los vapores se acumulan a ras de mesa.',
      incompatibilities: ['h2o2', 'hno3', 'h2so4'],
      wasteStream: 'Bidón de disolventes NO halogenados.',
      exposureLimitPpm: 500,
    },
  }),

  S({
    id: 'benceno', formula: 'C6H6', name: 'Benceno', synonyms: ['benzol'],
    casNumber: '71-43-2', structure: 'c1ccccc1', moleculeId: 'benzene',
    phase: 'l', categories: ['orgánico', 'aromático', 'disolvente'],
    role: 'Aromaticidad, resonancia y el singlete a 7.26 ppm; también el ejemplo de disolvente prohibido en Química Verde.',
    courses: ['qorg1', 'qorg2', 'qverde'],
    physical: {
      meltingPoint: 278.68, boilingPoint: 353.24, density: 0.8765,
      viscosity: 0.604, refractiveIndex: 1.5011, solubilityWater: 0.18,
      logP: 2.13, permittivity: 2.28, flashPoint: 262,
      antoine: { A: 4.72583, B: 1660.652, C: -1.461, range: [287, 354] },
      appearance: 'Líquido incoloro, olor dulce característico',
    },
    thermo: { dHf: 49.0, dGf: 124.5, S0: 173.4, Cp: 136.0, dHvap: 30.72, phase: 'l' },
    spectra: {
      uv: [{ lambdaMax: 254, epsilon: 204, width: 12, assignment: 'transición π→π* prohibida (banda B)' }],
      ir: [
        { wavenumber: 3030, intensity: 0.6, width: 30, assignment: 'tensión C–H aromático', mode: 'tension' },
        { wavenumber: 1478, intensity: 0.7, width: 25, assignment: 'tensión C=C del anillo', mode: 'tension' },
        { wavenumber: 674, intensity: 1.0, width: 20, assignment: 'flexión C–H fuera del plano (monosustituido)', mode: 'flexion' },
      ],
      nmr: [{ nucleus: '1H', shift: 7.26, integration: 6, neighbours: 0, assignment: 'H aromáticos equivalentes' }],
      msFragments: [
        { mz: 78, intensity: 100, assignment: 'M⁺· (ion molecular muy estable)' },
        { mz: 77, intensity: 22, assignment: '[M–H]⁺, catión fenilo' },
        { mz: 51, intensity: 18, assignment: 'C₄H₃⁺' },
      ],
    },
    chromatography: { gcKovats: 657, hplcC18: { k0: 12, S: 3.4 } },
    safety: {
      ghs: ['inflamable', 'peligro-salud', 'irritante'], signal: 'Peligro',
      hazards: [
        { code: 'H225', text: 'Líquido y vapores muy inflamables.' },
        { code: 'H350', text: 'Puede provocar cáncer (leucemia).' },
        { code: 'H340', text: 'Puede provocar defectos genéticos.' },
        { code: 'H372', text: 'Provoca daños en la médula ósea tras exposiciones prolongadas.' },
      ],
      ppe: ['Bata', 'Gafas integrales', 'Guantes de nitrilo laminado', 'Vitrina obligatoria'],
      storage: 'Armario de inflamables, con registro de uso (cancerígeno categoría 1A).',
      incompatibilities: ['hno3', 'kmno4'],
      wasteStream: 'Bidón de disolventes no halogenados, identificado como cancerígeno.',
      exposureLimitPpm: 1,
      notes: ['Cancerígeno humano confirmado. En un laboratorio docente debe sustituirse por tolueno o ciclohexano siempre que sea posible — es el caso de estudio de sustitución de disolventes en Química Verde.'],
    },
  }),

  S({
    id: 'glucosa', formula: 'C6H12O6', name: 'D-Glucosa', synonyms: ['dextrosa', 'azúcar de uva'],
    casNumber: '50-99-7', structure: 'OCC1OC(O)C(O)C(O)C1O', moleculeId: 'glucose',
    phase: 's', categories: ['orgánico', 'carbohidrato', 'bioquímico'],
    role: 'Monosacárido de referencia: mutarrotación, poder reductor y punto de partida del metabolismo.',
    courses: ['qbio', 'qorg3'],
    physical: {
      meltingPoint: 419, density: 1.54, solubilityWater: 91, logP: -3.24,
      appearance: 'Sólido cristalino blanco, sabor dulce',
    },
    thermo: { dHf: -1273.3, dGf: -910.4, S0: 209.2, Cp: 218.6, phase: 's' },
    safety: { ...NO_HAZARD },
  }),

  S({
    id: 'acido-salicilico', formula: 'C7H6O3', name: 'Ácido salicílico', synonyms: ['ácido 2-hidroxibenzoico'],
    casNumber: '69-72-7', structure: 'OC(=O)c1ccccc1O', moleculeId: 'salicylic-acid',
    phase: 's', categories: ['orgánico', 'aromático', 'ácido débil', 'fitoquímico'],
    role: 'Producto natural de la corteza de sauce; sustrato de la síntesis de aspirina y ejemplo de puente de hidrógeno intramolecular.',
    courses: ['qorg2', 'fito1', 'fito2'],
    physical: {
      meltingPoint: 432, boilingPoint: 484, density: 1.44, solubilityWater: 0.22,
      logP: 2.26, appearance: 'Agujas blancas',
    },
    acidBase: {
      pKa: [2.97, 13.6], fullyProtonated: 'C7H6O3', conjugates: ['C7H5O3-', 'C7H4O3^2-'], chargeProtonated: 0,
    },
    spectra: {
      uv: [
        { lambdaMax: 296, epsilon: 3600, width: 30, assignment: 'π→π* del anillo sustituido' },
        { lambdaMax: 235, epsilon: 9000, width: 22, assignment: 'banda K' },
      ],
      ir: [
        { wavenumber: 3230, intensity: 0.7, width: 250, assignment: 'tensión O–H fenólico (puente intramolecular)', mode: 'tension' },
        { wavenumber: 1655, intensity: 1.0, width: 30, assignment: 'tensión C=O conjugada y quelatada', mode: 'tension' },
        { wavenumber: 1610, intensity: 0.6, width: 25, assignment: 'tensión C=C aromático', mode: 'tension' },
      ],
    },
    chromatography: { hplcC18: { k0: 25, S: 3.9 }, gcKovats: 1180 },
    safety: {
      ghs: ['irritante', 'toxico-agudo'], signal: 'Atención',
      hazards: [
        { code: 'H302', text: 'Nocivo en caso de ingestión.' },
        { code: 'H315', text: 'Provoca irritación cutánea.' },
        { code: 'H318', text: 'Provoca lesiones oculares graves.' },
      ],
      ppe: ['Bata', 'Gafas integrales', 'Guantes'],
      storage: 'Recipiente cerrado, protegido de la luz.',
      incompatibilities: ['fecl3'],
      wasteStream: 'Residuo orgánico sólido.',
      notes: ['Con FeCl₃ da un complejo violeta intenso: ensayo cualitativo clásico de fenoles.'],
    },
    reactsWith: ['fecl3', 'naoh'],
  }),

  // =========================================================================
  // Buffers and reference materials
  // =========================================================================

  S({
    id: 'kh2po4', formula: 'KH2PO4', name: 'Dihidrogenofosfato de potasio', synonyms: ['fosfato monopotásico'],
    casNumber: '7778-77-0',
    phase: 's', categories: ['sal', 'tampón', 'patrón de pH'],
    role: 'Componente del tampón patrón de pH 6.865 (con Na₂HPO₄) para calibrar el pH-metro.',
    courses: ['qan1', 'qan2', 'qbio'],
    physical: { meltingPoint: 526, density: 2.34, solubilityWater: 22.6, appearance: 'Cristales blancos' },
    safety: { ...NO_HAZARD },
  }),

  S({
    id: 'na2hpo4', formula: 'Na2HPO4', name: 'Hidrogenofosfato de disodio', synonyms: ['fosfato disódico'],
    casNumber: '7558-79-4',
    phase: 's', categories: ['sal', 'tampón', 'patrón de pH'],
    role: 'Segundo componente del tampón fosfato; con KH₂PO₄ define el patrón de pH 6.865 a 25 °C.',
    courses: ['qan1', 'qan2', 'qbio'],
    physical: { meltingPoint: 513, density: 1.70, solubilityWater: 7.7, appearance: 'Polvo blanco' },
    safety: { ...NO_HAZARD },
  }),

  S({
    id: 'khc4h4o6', formula: 'KHC4H4O6', name: 'Hidrogenotartrato de potasio', synonyms: ['crémor tártaro', 'bitartrato potásico'],
    casNumber: '868-14-4',
    phase: 's', categories: ['sal', 'patrón de pH'],
    role: 'Disolución saturada: patrón de pH 3.557 a 25 °C, auto-tamponado por su propia solubilidad.',
    courses: ['qan1'],
    physical: { meltingPoint: 503, density: 1.98, solubilityWater: 0.57, appearance: 'Polvo blanco cristalino' },
    acidBase: {
      pKa: [3.036, 4.366], fullyProtonated: 'H2C4H4O6', conjugates: ['HC4H4O6-', 'C4H4O6^2-'], chargeProtonated: 0,
    },
    safety: { ...NO_HAZARD },
  }),

  S({
    id: 'na2b4o7', formula: 'Na2B4O7·10H2O', name: 'Tetraborato de sodio decahidratado', synonyms: ['bórax'],
    casNumber: '1303-96-4',
    phase: 's', categories: ['sal', 'tampón', 'patrón de pH', 'patrón primario'],
    role: 'Patrón de pH 9.180 a 25 °C y patrón primario alternativo para ácidos fuertes.',
    courses: ['qan1', 'qan2'],
    physical: { meltingPoint: 348, density: 1.73, solubilityWater: 5.1, appearance: 'Cristales incoloros' },
    acidBase: {
      pKa: [9.24], fullyProtonated: 'H3BO3', conjugates: ['B(OH)4-'], chargeProtonated: 0,
    },
    safety: {
      ghs: ['peligro-salud'], signal: 'Peligro',
      hazards: [{ code: 'H360FD', text: 'Puede perjudicar a la fertilidad y dañar al feto.' }],
      ppe: ['Bata', 'Gafas de seguridad', 'Guantes'],
      storage: 'Recipiente cerrado. Sustancia tóxica para la reproducción: registro de uso.',
      incompatibilities: [],
      wasteStream: 'Residuo acuoso identificado (boro).',
    },
  }),

  S({
    id: 'cacl2', formula: 'CaCl2', name: 'Cloruro de calcio', synonyms: [],
    casNumber: '10043-52-4',
    phase: 's', categories: ['sal', 'desecante', 'inorgánico'],
    role: 'Fuente de Ca²⁺ para dureza y complexometría con EDTA; desecante de laboratorio.',
    courses: ['qan2', 'hidro', 'qsuelo'],
    physical: {
      meltingPoint: 1045, boilingPoint: 2208, density: 2.15, solubilityWater: 74.5,
      appearance: 'Sólido blanco muy delicuescente',
    },
    thermo: { dHf: -795.4, dGf: -748.8, S0: 108.4, phase: 's' },
    safety: {
      ghs: ['irritante'], signal: 'Atención',
      hazards: [{ code: 'H319', text: 'Provoca irritación ocular grave.' }],
      ppe: ['Bata', 'Gafas de seguridad'],
      storage: 'Hermético: es delicuescente y se licua al aire.',
      incompatibilities: ['na2co3', 'na2c2o4'],
      wasteStream: 'Residuo acuoso.',
      notes: ['La disolución es exotérmica (ΔH ≈ −82 kJ·mol⁻¹): útil como demostración de calorimetría.'],
    },
    reactsWith: ['na2co3', 'edta', 'na2c2o4'],
  }),

  S({
    id: 'mgso4', formula: 'MgSO4·7H2O', name: 'Sulfato de magnesio heptahidratado', synonyms: ['sal de Epsom', 'epsomita'],
    casNumber: '10034-99-8',
    phase: 's', categories: ['sal', 'inorgánico'],
    role: 'Fuente de Mg²⁺ para dureza total; agente de secado de fases orgánicas.',
    courses: ['qan2', 'qorg2', 'hidro'],
    physical: { meltingPoint: 423, density: 1.68, solubilityWater: 71, appearance: 'Cristales incoloros' },
    safety: { ...NO_HAZARD },
    reactsWith: ['edta', 'naoh'],
  }),
];

// ===========================================================================
// Indexes
// ===========================================================================

const BY_ID = new Map(SUBSTANCES.map((s) => [s.id, s]));
const BY_FORMULA = new Map(SUBSTANCES.map((s) => [s.formula, s]));

export const substanceById = (id: string): Substance | undefined => BY_ID.get(id);
export const substanceByFormula = (f: string): Substance | undefined => BY_FORMULA.get(f);

/** All substances tagged with a category, e.g. "titrante" or "ácido débil". */
export const substancesByCategory = (category: string): Substance[] =>
  SUBSTANCES.filter((s) => s.categories.includes(category));

/** Substances introduced in a given course. */
export const substancesForCourse = (courseId: string): Substance[] =>
  SUBSTANCES.filter((s) => s.courses?.includes(courseId));

/** Free-text search over names, synonyms, formula and CAS number. */
export function searchSubstances(query: string, limit = 20): Substance[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const nq = norm(q);

  const scored = SUBSTANCES.map((s) => {
    let score = 0;
    if (s.formula.toLowerCase() === q) score = 100;
    else if (norm(s.name) === nq) score = 95;
    else if (s.id === q) score = 90;
    else if (s.casNumber === q) score = 90;
    else if (norm(s.name).startsWith(nq)) score = 70;
    else if (s.formula.toLowerCase().startsWith(q)) score = 65;
    else if (s.synonyms.some((y) => norm(y).startsWith(nq))) score = 60;
    else if (norm(s.name).includes(nq)) score = 40;
    else if (s.synonyms.some((y) => norm(y).includes(nq))) score = 30;
    else if (s.categories.some((c) => norm(c).includes(nq))) score = 20;
    return { s, score };
  }).filter((e) => e.score > 0);

  scored.sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name));
  return scored.slice(0, limit).map((e) => e.s);
}
