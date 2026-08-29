/**
 * Biblioteca de sustancias — capa 2 (base de datos).
 *
 * PRINCIPIO DE DISENO
 * Aqui solo se guarda lo que NO se puede derivar. La composicion, la masa
 * molar, la aridad, la clasificacion y la nomenclatura las calcula el nucleo
 * a partir de la formula. Duplicarlas aqui seria invitar a que se
 * desincronicen.
 *
 * Lo que si se guarda: propiedades medidas (densidad, puntos de cambio de
 * estado, solubilidad, pKa, entalpias), sinonimos, nombres comunes,
 * apariencia y peligrosidad. Todo ello son HECHOS EXPERIMENTALES que ningun
 * algoritmo puede deducir.
 *
 * PROCEDENCIA
 *   Termodinamica (ΔHf°, ΔGf°, S°) ... CRC Handbook; NIST Chemistry WebBook.
 *                                      Valores estandar a 298,15 K y 1 bar.
 *   Constantes de acidez (pKa) ....... CRC Handbook, en agua a 25 °C.
 *   Densidades y puntos de cambio .... CRC Handbook.
 *
 * REGLA (§27): "No inventar propiedades." Un campo ausente en la definicion
 * se convierte en `null` y la ficha muestra "Dato no disponible".
 */

import type {
  HazardLevel,
  PhaseState,
  Species,
  SpeciesKind,
  SpeciesProperties,
  Provenance,
} from '../core/types.js';
import { measured, UNKNOWN } from '../core/types.js';
import { parseFormula } from '../core/formula/parse.js';
import { arityOf, molarMassOf } from '../core/formula/composition.js';
import { classify } from '../core/classify.js';
import { nameCompound, nameFormula } from '../core/nomenclature/inorganic.js';

const CRC: Provenance = { source: 'CRC Handbook of Chemistry and Physics' };
const NIST: Provenance = { source: 'NIST Chemistry WebBook', note: 'estado estandar, 298,15 K' };

type Solub = 'soluble' | 'slightly-soluble' | 'insoluble' | 'reacts';

/** Definicion curada. Todo campo opcional ausente significa "no disponible". */
interface SpeciesDef {
  readonly formula: string;
  readonly tags: readonly string[];
  readonly kind?: SpeciesKind;
  readonly state?: PhaseState;
  readonly charge?: number;
  /** Nombre comun o comercial: "cal viva", "sosa caustica". */
  readonly common?: string;
  readonly synonyms?: readonly string[];
  readonly appearance?: string;
  /** g/cm3 salvo que se indique 'g/L' en `densityUnit`. */
  readonly density?: number;
  readonly densityUnit?: 'g/cm3' | 'g/L';
  /** Punto de fusion en K. */
  readonly mp?: number;
  /** Punto de ebullicion en K. */
  readonly bp?: number;
  readonly solubility?: Solub;
  /** Solubilidad en g/100 mL de agua. */
  readonly gPer100mL?: number;
  readonly pKa?: number;
  readonly pKb?: number;
  /** Entalpia estandar de formacion, kJ/mol. */
  readonly dHf?: number;
  /** Energia libre de Gibbs estandar de formacion, kJ/mol. */
  readonly dGf?: number;
  /** Entropia molar estandar, J/(mol K). */
  readonly S?: number;
  readonly hazard?: HazardLevel;
  readonly notes?: readonly string[];
}

// ---------------------------------------------------------------------------
// SUSTANCIAS SIMPLES Y GASES
// ---------------------------------------------------------------------------

const DEFS: SpeciesDef[] = [
  { formula: 'H2', tags: ['element', 'gas'], state: 'g', common: 'hidrogeno molecular',
    appearance: 'gas incoloro e inodoro', density: 0.08988, densityUnit: 'g/L', mp: 13.99, bp: 20.271,
    dHf: 0, dGf: 0, S: 130.7, hazard: 'hazardous',
    notes: ['Extremadamente inflamable; forma mezclas explosivas con el aire.'] },
  { formula: 'O2', tags: ['element', 'gas'], state: 'g', common: 'oxigeno molecular',
    appearance: 'gas incoloro', density: 1.429, densityUnit: 'g/L', mp: 54.36, bp: 90.188,
    dHf: 0, dGf: 0, S: 205.2, hazard: 'special-conditions',
    notes: ['Comburente: no arde, pero alimenta la combustion.'] },
  { formula: 'N2', tags: ['element', 'gas'], state: 'g', appearance: 'gas incoloro',
    density: 1.2506, densityUnit: 'g/L', mp: 63.15, bp: 77.355, dHf: 0, dGf: 0, S: 191.6, hazard: 'safe',
    notes: ['El triple enlace N≡N es de los mas fuertes que se conocen (945 kJ/mol): por eso el N2 es tan inerte.'] },
  { formula: 'Cl2', tags: ['element', 'gas'], state: 'g', appearance: 'gas amarillo verdoso, olor picante',
    density: 3.2, densityUnit: 'g/L', mp: 171.6, bp: 239.11, dHf: 0, dGf: 0, S: 223.1, hazard: 'do-not-attempt',
    notes: ['Toxico por inhalacion. Historicamente usado como arma quimica.'] },
  { formula: 'F2', tags: ['element', 'gas'], state: 'g', appearance: 'gas amarillo palido',
    mp: 53.48, bp: 85.03, dHf: 0, hazard: 'do-not-attempt',
    notes: ['El oxidante elemental mas potente. Ataca al vidrio y a casi todo material organico.'] },
  { formula: 'Br2', tags: ['element'], state: 'l', appearance: 'liquido rojo pardo, vapores densos',
    density: 3.1028, mp: 265.8, bp: 332.0, dHf: 0, S: 152.2, hazard: 'do-not-attempt' },
  { formula: 'I2', tags: ['element'], state: 's', appearance: 'solido gris violaceo, brillo metalico',
    density: 4.933, mp: 386.85, bp: 457.4, dHf: 0, S: 116.1, solubility: 'slightly-soluble', hazard: 'hazardous',
    notes: ['Sublima facilmente dando vapores violetas.'] },
  { formula: 'Na', tags: ['element', 'metal'], state: 's', appearance: 'metal blando, plateado, se oxida al aire',
    density: 0.968, mp: 370.944, bp: 1156.09, dHf: 0, S: 51.3, hazard: 'do-not-attempt',
    notes: ['Reacciona violentamente con el agua liberando H2, que puede inflamarse.'] },
  { formula: 'K', tags: ['element', 'metal'], state: 's', appearance: 'metal blando plateado',
    density: 0.862, mp: 336.7, bp: 1032, dHf: 0, S: 64.7, hazard: 'do-not-attempt' },
  { formula: 'Ca', tags: ['element', 'metal'], state: 's', appearance: 'metal gris plateado, algo mas duro que el sodio',
    density: 1.55, mp: 1115, bp: 1757, dHf: 0, S: 41.6, hazard: 'hazardous',
    notes: ['Reacciona con el agua, mas lentamente que el sodio.'] },
  { formula: 'Mg', tags: ['element', 'metal'], state: 's', appearance: 'metal plateado ligero',
    density: 1.738, mp: 923, bp: 1363, dHf: 0, S: 32.7, hazard: 'special-conditions',
    notes: ['Arde con llama blanca deslumbrante; no debe mirarse directamente.'] },
  { formula: 'Al', tags: ['element', 'metal', 'industrial'], state: 's', appearance: 'metal plateado',
    density: 2.7, mp: 933.47, bp: 2743, dHf: 0, S: 28.3, hazard: 'safe',
    notes: ['Se pasiva con una capa de Al2O3 que lo protege de la corrosion.'] },
  { formula: 'Fe', tags: ['element', 'metal', 'industrial'], state: 's', appearance: 'metal gris',
    density: 7.874, mp: 1811, bp: 3134, dHf: 0, S: 27.3, hazard: 'safe' },
  { formula: 'Cu', tags: ['element', 'metal', 'industrial'], state: 's', appearance: 'metal rojizo',
    density: 8.96, mp: 1357.77, bp: 2835, dHf: 0, S: 33.2, hazard: 'safe' },
  { formula: 'Zn', tags: ['element', 'metal', 'industrial'], state: 's', appearance: 'metal gris azulado',
    density: 7.14, mp: 692.68, bp: 1180, dHf: 0, S: 41.6, hazard: 'safe' },
  { formula: 'Ag', tags: ['element', 'metal'], state: 's', appearance: 'metal blanco brillante',
    density: 10.49, mp: 1234.93, bp: 2435, dHf: 0, S: 42.6, hazard: 'safe' },
  { formula: 'C', tags: ['element'], state: 's', common: 'carbono (grafito)',
    appearance: 'solido negro, blando y conductor (grafito)', density: 2.267, dHf: 0, S: 5.7, hazard: 'safe',
    notes: ['ΔHf° = 0 se refiere al grafito, que es la forma estandar. El diamante tiene ΔHf° = +1,9 kJ/mol.'] },
  { formula: 'S', tags: ['element', 'industrial'], state: 's', common: 'azufre',
    appearance: 'solido amarillo', density: 2.07, mp: 388.36, bp: 717.8, dHf: 0, S: 32.1, hazard: 'safe',
    notes: ['En estado solido existe realmente como S8, anillos de ocho atomos.'] },
  { formula: 'P4', tags: ['element'], state: 's', common: 'fosforo blanco',
    appearance: 'solido blanco ceroso', hazard: 'do-not-attempt',
    notes: ['Se inflama espontaneamente al aire; se conserva bajo agua.'] },
  { formula: 'He', tags: ['element', 'gas'], state: 'g', appearance: 'gas incoloro',
    density: 0.1786, densityUnit: 'g/L', bp: 4.222, dHf: 0, S: 126.2, hazard: 'safe' },

  // -------------------------------------------------------------------------
  // OXIDOS
  // -------------------------------------------------------------------------
  { formula: 'H2O', tags: ['oxide', 'solvent', 'molecule'], state: 'l', common: 'agua',
    synonyms: ['agua', 'water', 'oxido de dihidrogeno'],
    appearance: 'liquido incoloro, inodoro e insipido', density: 0.997, mp: 273.15, bp: 373.15,
    solubility: 'soluble', dHf: -285.8, dGf: -237.1, S: 70.0, hazard: 'safe',
    notes: ['Densidad maxima a 4 °C: el hielo flota, algo excepcional entre las sustancias.'] },
  { formula: 'CaO', tags: ['oxide', 'industrial', 'mineral'], state: 's', common: 'cal viva',
    synonyms: ['cal viva', 'quicklime', 'oxido calcico'],
    appearance: 'solido blanco', density: 3.34, mp: 2886, bp: 3123, solubility: 'reacts',
    dHf: -635.1, dGf: -603.3, S: 38.1, hazard: 'hazardous',
    notes: ['Con agua libera mucho calor (reaccion de apagado): puede causar quemaduras.'] },
  { formula: 'CO2', tags: ['oxide', 'gas'], state: 'g', common: 'dioxido de carbono',
    synonyms: ['anhidrido carbonico', 'gas carbonico', 'carbon dioxide'],
    appearance: 'gas incoloro e inodoro', density: 1.977, densityUnit: 'g/L', solubility: 'soluble',
    dHf: -393.5, dGf: -394.4, S: 213.8, hazard: 'safe',
    notes: ['Sublima a 194,7 K a presion atmosferica: el hielo seco no funde, pasa directamente a gas.'] },
  { formula: 'CO', tags: ['oxide', 'gas'], state: 'g', appearance: 'gas incoloro e inodoro',
    density: 1.145, densityUnit: 'g/L', mp: 68.13, bp: 81.6, dHf: -110.5, dGf: -137.2, S: 197.7,
    hazard: 'do-not-attempt',
    notes: ['Toxico e inodoro: se une a la hemoglobina 200 veces mas fuerte que el O2.'] },
  { formula: 'SO2', tags: ['oxide', 'gas', 'industrial'], state: 'g', appearance: 'gas incoloro, olor irritante',
    mp: 200.0, bp: 263.1, solubility: 'soluble', dHf: -296.8, dGf: -300.1, S: 248.2, hazard: 'hazardous',
    notes: ['Responsable de la lluvia acida junto con los oxidos de nitrogeno.'] },
  { formula: 'SO3', tags: ['oxide', 'industrial'], state: 'g', appearance: 'solido o liquido incoloro, humea al aire',
    mp: 289.9, bp: 317.9, solubility: 'reacts', dHf: -395.7, dGf: -371.1, S: 256.8, hazard: 'do-not-attempt',
    notes: ['Con agua reacciona de forma violenta: es la etapa clave del proceso de contacto.'] },
  { formula: 'Fe2O3', tags: ['oxide', 'mineral', 'industrial'], state: 's', common: 'hematita',
    synonyms: ['hematita', 'oxido ferrico', 'herrumbre'],
    appearance: 'solido rojo pardo', density: 5.24, mp: 1838, solubility: 'insoluble',
    dHf: -824.2, dGf: -742.2, S: 87.4, hazard: 'safe' },
  { formula: 'FeO', tags: ['oxide'], state: 's', appearance: 'solido negro',
    density: 5.74, mp: 1650, solubility: 'insoluble', dHf: -272.0, hazard: 'safe' },
  { formula: 'Fe3O4', tags: ['oxide', 'mineral'], state: 's', common: 'magnetita',
    synonyms: ['magnetita'], appearance: 'solido negro, magnetico', density: 5.17, mp: 1870,
    solubility: 'insoluble', dHf: -1118.4, S: 146.4, hazard: 'safe',
    notes: ['Oxido mixto: contiene Fe(II) y Fe(III). Por eso el estado de oxidacion medio es +8/3.'] },
  { formula: 'Al2O3', tags: ['oxide', 'mineral', 'industrial'], state: 's', common: 'alumina',
    synonyms: ['alumina', 'corindon'], appearance: 'solido blanco muy duro', density: 3.95, mp: 2345,
    solubility: 'insoluble', dHf: -1675.7, dGf: -1582.3, S: 50.9, hazard: 'safe',
    notes: ['Anfotero: reacciona tanto con acidos como con bases fuertes.'] },
  { formula: 'MgO', tags: ['oxide', 'industrial'], state: 's', common: 'magnesia',
    appearance: 'solido blanco', density: 3.58, mp: 3125, solubility: 'insoluble',
    dHf: -601.6, dGf: -569.3, S: 27.0, hazard: 'safe' },
  { formula: 'ZnO', tags: ['oxide', 'industrial'], state: 's', appearance: 'solido blanco',
    density: 5.61, mp: 2247, solubility: 'insoluble', dHf: -350.5, dGf: -320.5, S: 43.7, hazard: 'safe' },
  { formula: 'CuO', tags: ['oxide'], state: 's', appearance: 'solido negro', density: 6.31, mp: 1599,
    solubility: 'insoluble', dHf: -157.3, dGf: -129.7, S: 42.6, hazard: 'safe' },
  { formula: 'Na2O', tags: ['oxide'], state: 's', appearance: 'solido blanco', density: 2.27,
    solubility: 'reacts', dHf: -414.2, hazard: 'hazardous' },
  { formula: 'SiO2', tags: ['oxide', 'mineral', 'industrial'], state: 's', common: 'cuarzo',
    synonyms: ['cuarzo', 'silice', 'arena'], appearance: 'solido incoloro cristalino',
    density: 2.65, mp: 1983, solubility: 'insoluble', dHf: -910.7, dGf: -856.3, S: 41.5, hazard: 'safe',
    notes: ['Red covalente extendida: no existen moleculas discretas de SiO2.'] },
  { formula: 'NO', tags: ['oxide', 'gas'], state: 'g', appearance: 'gas incoloro',
    dHf: 91.3, dGf: 87.6, S: 210.8, hazard: 'hazardous',
    notes: ['ΔHf° positivo: su formacion a partir de N2 y O2 es endotermica y solo ocurre a alta temperatura.'] },
  { formula: 'NO2', tags: ['oxide', 'gas'], state: 'g', appearance: 'gas pardo rojizo',
    dHf: 33.2, dGf: 51.3, S: 240.1, hazard: 'do-not-attempt' },
  { formula: 'H2O2', tags: ['peroxide'], state: 'l', common: 'agua oxigenada',
    synonyms: ['agua oxigenada', 'peroxido de hidrogeno'], appearance: 'liquido incoloro',
    density: 1.45, mp: 272.7, bp: 423.3, solubility: 'soluble', dHf: -187.8, dGf: -120.4, S: 109.6,
    hazard: 'hazardous', notes: ['Se descompone en agua y oxigeno; la luz y los metales aceleran el proceso.'] },

  // -------------------------------------------------------------------------
  // HIDROXIDOS Y BASES
  // -------------------------------------------------------------------------
  { formula: 'NaOH', tags: ['hydroxide', 'base', 'industrial'], state: 's', common: 'sosa caustica',
    synonyms: ['sosa caustica', 'soda caustica', 'hidroxido sodico', 'lejia de sosa'],
    appearance: 'solido blanco higroscopico', density: 2.13, mp: 596, bp: 1661,
    solubility: 'soluble', gPer100mL: 111, dHf: -425.6, dGf: -379.5, S: 64.5, hazard: 'hazardous',
    notes: ['Base fuerte: en agua se disocia por completo.', 'Muy corrosiva para la piel y los ojos.'] },
  { formula: 'KOH', tags: ['hydroxide', 'base', 'industrial'], state: 's', common: 'potasa caustica',
    appearance: 'solido blanco', density: 2.12, mp: 633, solubility: 'soluble', gPer100mL: 121,
    dHf: -424.6, hazard: 'hazardous' },
  { formula: 'Ca(OH)2', tags: ['hydroxide', 'base', 'industrial'], state: 's', common: 'cal apagada',
    synonyms: ['cal apagada', 'cal hidratada', 'lechada de cal', 'portlandita'],
    appearance: 'solido blanco', density: 2.211, solubility: 'slightly-soluble', gPer100mL: 0.173,
    dHf: -986.1, dGf: -898.5, S: 83.4, hazard: 'hazardous',
    notes: ['Su disolucion saturada es el "agua de cal", que se enturbia con CO2: es la prueba clasica del dioxido de carbono.'] },
  { formula: 'Mg(OH)2', tags: ['hydroxide', 'base'], state: 's', common: 'leche de magnesia',
    appearance: 'solido blanco', density: 2.34, solubility: 'insoluble', gPer100mL: 0.00064,
    dHf: -924.5, S: 63.2, hazard: 'safe' },
  { formula: 'Fe(OH)3', tags: ['hydroxide', 'base'], state: 's', appearance: 'precipitado gelatinoso pardo rojizo',
    solubility: 'insoluble', dHf: -823.0, hazard: 'safe' },
  { formula: 'Al(OH)3', tags: ['hydroxide', 'base'], state: 's', appearance: 'precipitado blanco gelatinoso',
    density: 2.42, solubility: 'insoluble', dHf: -1277.0, hazard: 'safe',
    notes: ['Anfotero: se disuelve tanto en acidos como en bases fuertes.'] },
  { formula: 'NH3', tags: ['base', 'gas', 'industrial'], state: 'g', common: 'amoniaco',
    synonyms: ['amoniaco', 'ammonia', 'azano'], appearance: 'gas incoloro, olor penetrante',
    mp: 195.4, bp: 239.8, solubility: 'soluble', pKb: 4.75, dHf: -45.9, dGf: -16.4, S: 192.8,
    hazard: 'hazardous',
    notes: ['Base debil: en agua solo una fraccion capta protones.', 'Se fabrica por el proceso Haber-Bosch, uno de los procesos industriales mas importantes.'] },

  // -------------------------------------------------------------------------
  // ACIDOS
  // -------------------------------------------------------------------------
  { formula: 'HCl', tags: ['acid', 'gas'], state: 'g', common: 'acido clorhidrico',
    synonyms: ['acido clorhidrico', 'acido muriatico', 'cloruro de hidrogeno'],
    appearance: 'gas incoloro; en disolucion, liquido incoloro que humea',
    mp: 158.9, bp: 188.1, solubility: 'soluble', pKa: -6.3, dHf: -92.3, dGf: -95.3, S: 186.9,
    hazard: 'hazardous',
    notes: ['Acido fuerte: en agua se disocia practicamente por completo.', 'El jugo gastrico contiene HCl a pH cercano a 1,5.'] },
  { formula: 'H2SO4', tags: ['acid', 'industrial'], state: 'l', common: 'acido sulfurico',
    synonyms: ['acido sulfurico', 'vitriolo', 'sulfuric acid'],
    appearance: 'liquido viscoso incoloro', density: 1.8302, mp: 283.5, bp: 610,
    solubility: 'reacts', pKa: -3.0, dHf: -814.0, dGf: -690.0, S: 156.9, hazard: 'do-not-attempt',
    notes: ['Diprotico: cede dos protones, con pKa1 ≈ -3 y pKa2 = 1,99.',
            'Al diluir SIEMPRE se anade el acido sobre el agua, nunca al reves: la hidratacion libera muchisimo calor.',
            'Es el producto quimico mas fabricado del mundo en masa.'] },
  { formula: 'HNO3', tags: ['acid', 'industrial'], state: 'l', common: 'acido nitrico',
    synonyms: ['acido nitrico', 'agua fuerte'], appearance: 'liquido incoloro a amarillento',
    density: 1.513, mp: 231.6, bp: 356, solubility: 'soluble', pKa: -1.4, dHf: -174.1, dGf: -80.7, S: 155.6,
    hazard: 'do-not-attempt', notes: ['Ademas de acido fuerte, es un oxidante potente.'] },
  { formula: 'H2CO3', tags: ['acid'], state: 'aq', common: 'acido carbonico',
    appearance: 'solo existe en disolucion', solubility: 'soluble', pKa: 6.35, dHf: -699.7,
    hazard: 'safe',
    notes: ['Inestable: se descompone en CO2 y H2O. Por eso las bebidas carbonatadas pierden gas.'] },
  { formula: 'H3PO4', tags: ['acid', 'industrial'], state: 's', common: 'acido fosforico',
    appearance: 'solido incoloro o jarabe viscoso', density: 1.885, mp: 315.5,
    solubility: 'soluble', pKa: 2.15, dHf: -1284.4, hazard: 'hazardous',
    notes: ['Triprotico: pKa1 = 2,15; pKa2 = 7,20; pKa3 = 12,35.'] },
  { formula: 'CH3COOH', tags: ['acid', 'organic', 'solvent'], state: 'l', common: 'acido acetico',
    synonyms: ['acido acetico', 'acido etanoico', 'vinagre'], appearance: 'liquido incoloro, olor a vinagre',
    density: 1.049, mp: 289.6, bp: 391.1, solubility: 'soluble', pKa: 4.76, dHf: -484.3, dGf: -389.9, S: 159.8,
    hazard: 'hazardous', notes: ['Acido debil: el vinagre comercial es una disolucion al 4-8 %.'] },
  { formula: 'H2S', tags: ['acid', 'gas'], state: 'g', appearance: 'gas incoloro, olor a huevos podridos',
    mp: 187.7, bp: 212.8, solubility: 'soluble', pKa: 7.0, dHf: -20.6, dGf: -33.4, S: 205.8,
    hazard: 'do-not-attempt',
    notes: ['Muy toxico. A concentraciones altas anula el olfato, lo que lo hace especialmente peligroso.'] },
  { formula: 'HF', tags: ['acid'], state: 'g', appearance: 'gas o liquido incoloro',
    mp: 189.8, bp: 292.7, solubility: 'soluble', pKa: 3.17, dHf: -273.3, hazard: 'do-not-attempt',
    notes: ['Unico halogenuro de hidrogeno que es acido debil.', 'Ataca al vidrio; se guarda en plastico.'] },

  // -------------------------------------------------------------------------
  // SALES
  // -------------------------------------------------------------------------
  { formula: 'NaCl', tags: ['salt', 'mineral'], state: 's', common: 'sal comun',
    synonyms: ['sal comun', 'sal de mesa', 'halita', 'table salt'],
    appearance: 'solido cristalino blanco', density: 2.17, mp: 1074, bp: 1738,
    solubility: 'soluble', gPer100mL: 36.0, dHf: -411.2, dGf: -384.1, S: 72.1, hazard: 'safe',
    notes: ['Red ionica cubica: no existe una "molecula" de NaCl, sino un cristal extendido.'] },
  { formula: 'CaCO3', tags: ['salt', 'mineral', 'industrial'], state: 's', common: 'carbonato de calcio',
    synonyms: ['caliza', 'marmol', 'calcita', 'creta', 'limestone'],
    appearance: 'solido blanco', density: 2.71, solubility: 'insoluble', gPer100mL: 0.0013,
    dHf: -1206.9, dGf: -1128.8, S: 92.9, hazard: 'safe',
    notes: ['Se descompone en CaO y CO2 por encima de unos 825 °C: es la calcinacion.',
            'Constituye conchas, corales y el esqueleto de muchos organismos marinos.'] },
  { formula: 'CaCl2', tags: ['salt'], state: 's', appearance: 'solido blanco muy higroscopico',
    density: 2.15, mp: 1045, bp: 2208, solubility: 'soluble', gPer100mL: 74.5,
    dHf: -795.4, dGf: -748.8, S: 108.4, hazard: 'safe',
    notes: ['Al disolverse libera calor; se usa como desecante y como fundente de hielo.'] },
  { formula: 'Na2CO3', tags: ['salt', 'industrial'], state: 's', common: 'sosa',
    synonyms: ['carbonato sodico', 'sosa', 'ceniza de sosa', 'soda ash'],
    appearance: 'solido blanco', density: 2.54, mp: 1129, solubility: 'soluble', gPer100mL: 21.5,
    dHf: -1130.7, dGf: -1044.4, S: 135.0, hazard: 'special-conditions' },
  { formula: 'NaHCO3', tags: ['salt'], state: 's', common: 'bicarbonato de sodio',
    synonyms: ['bicarbonato sodico', 'bicarbonato de sodio', 'baking soda', 'nahcolita'],
    appearance: 'polvo blanco', density: 2.20, solubility: 'soluble', gPer100mL: 9.6,
    dHf: -950.8, dGf: -851.0, S: 101.7, hazard: 'safe',
    notes: ['Al calentarse se descompone liberando CO2: por eso hace subir la masa en reposteria.'] },
  { formula: 'KNO3', tags: ['salt', 'mineral', 'industrial'], state: 's', common: 'nitro',
    synonyms: ['nitrato potasico', 'salitre', 'nitro'], appearance: 'solido blanco cristalino',
    density: 2.11, mp: 607, solubility: 'soluble', gPer100mL: 38.3, dHf: -494.6, dGf: -394.9, S: 133.1,
    hazard: 'special-conditions', notes: ['Oxidante: componente clasico de la polvora negra.'] },
  { formula: 'NH4NO3', tags: ['salt', 'industrial'], state: 's', appearance: 'solido blanco',
    density: 1.725, mp: 442.8, solubility: 'soluble', gPer100mL: 150, dHf: -365.6, dGf: -183.9, S: 151.1,
    hazard: 'do-not-attempt',
    notes: ['Al disolverse ABSORBE calor: es la base de las bolsas de frio instantaneo.',
            'Fertilizante muy usado, pero tambien explosivo bajo detonacion o calentamiento confinado.'] },
  { formula: 'CuSO4', tags: ['salt'], state: 's', appearance: 'solido blanco grisaceo (anhidro)',
    density: 3.60, solubility: 'soluble', gPer100mL: 22.0, dHf: -771.4, dGf: -662.2, S: 109.2,
    hazard: 'hazardous',
    notes: ['El anhidro es blanco; el pentahidrato CuSO4·5H2O es azul intenso. Sirve como prueba de humedad.'] },
  { formula: 'CuSO4·5H2O', tags: ['salt', 'mineral'], state: 's', common: 'vitriolo azul',
    synonyms: ['sulfato de cobre pentahidratado', 'vitriolo azul', 'piedra azul', 'calcantita'],
    appearance: 'cristales azules intensos', density: 2.286, solubility: 'soluble', gPer100mL: 32,
    hazard: 'hazardous' },
  { formula: 'AgCl', tags: ['salt'], state: 's', appearance: 'precipitado blanco que oscurece con la luz',
    density: 5.56, mp: 728, solubility: 'insoluble', gPer100mL: 0.00019, dHf: -127.0, dGf: -109.8, S: 96.3,
    hazard: 'safe', notes: ['Su insolubilidad es la base del ensayo clasico de cloruros.'] },
  { formula: 'BaSO4', tags: ['salt', 'mineral'], state: 's', common: 'baritina',
    appearance: 'solido blanco', density: 4.49, mp: 1853, solubility: 'insoluble', gPer100mL: 0.00024,
    dHf: -1473.2, dGf: -1362.2, S: 132.2, hazard: 'safe',
    notes: ['Tan insoluble que se usa como contraste radiologico pese a que el bario soluble es toxico.'] },
  { formula: 'Na2SO4', tags: ['salt', 'industrial'], state: 's', appearance: 'solido blanco',
    density: 2.66, mp: 1157, solubility: 'soluble', gPer100mL: 28, dHf: -1387.1, dGf: -1270.2, S: 149.6,
    hazard: 'safe' },
  { formula: 'KMnO4', tags: ['salt'], state: 's', common: 'permanganato de potasio',
    appearance: 'cristales violeta oscuro', density: 2.70, solubility: 'soluble', gPer100mL: 6.4,
    dHf: -837.2, hazard: 'hazardous',
    notes: ['Oxidante fuerte. Su color violeta desaparece al reducirse: sirve como autoindicador en valoraciones.'] },
  { formula: 'K2Cr2O7', tags: ['salt'], state: 's', appearance: 'cristales naranjas',
    density: 2.68, mp: 671, solubility: 'soluble', gPer100mL: 4.9, dHf: -2061.5, hazard: 'do-not-attempt',
    notes: ['El cromo(VI) es cancerigeno.'] },
  { formula: 'CaSO4', tags: ['salt', 'mineral', 'industrial'], state: 's', common: 'anhidrita',
    appearance: 'solido blanco', density: 2.96, mp: 1733, solubility: 'slightly-soluble', gPer100mL: 0.24,
    dHf: -1434.5, dGf: -1322.0, S: 106.5, hazard: 'safe' },
  { formula: 'Ca3(PO4)2', tags: ['salt', 'mineral'], state: 's', appearance: 'solido blanco',
    density: 3.14, solubility: 'insoluble', dHf: -4120.8, hazard: 'safe',
    notes: ['Componente principal del hueso y del mineral fosforita.'] },
  { formula: 'NH4Cl', tags: ['salt'], state: 's', common: 'sal amoniaco',
    appearance: 'solido blanco', density: 1.53, solubility: 'soluble', gPer100mL: 37.2,
    dHf: -314.4, dGf: -202.9, S: 94.6, hazard: 'safe',
    notes: ['Al disolverse absorbe calor y da disolucion ligeramente acida (hidrolisis del NH4⁺).'] },
  { formula: 'ZnCl2', tags: ['salt'], state: 's', appearance: 'solido blanco muy higroscopico',
    density: 2.907, mp: 565, bp: 1005, solubility: 'soluble', gPer100mL: 432, dHf: -415.1, hazard: 'hazardous' },
  { formula: 'FeCl3', tags: ['salt'], state: 's', appearance: 'solido pardo verdoso',
    density: 2.90, mp: 580, solubility: 'soluble', gPer100mL: 92, dHf: -399.5, hazard: 'hazardous' },
  { formula: 'FeCl2', tags: ['salt'], state: 's', appearance: 'solido verde palido',
    density: 3.16, mp: 950, solubility: 'soluble', dHf: -341.8, hazard: 'hazardous' },
  { formula: 'FeSO4', tags: ['salt'], state: 's', appearance: 'solido blanco o verde palido',
    density: 3.65, solubility: 'soluble', gPer100mL: 29.5, dHf: -928.4, hazard: 'special-conditions' },
  { formula: 'PbI2', tags: ['salt'], state: 's', appearance: 'precipitado amarillo brillante',
    density: 6.16, mp: 683, solubility: 'insoluble', gPer100mL: 0.076, dHf: -175.5, hazard: 'hazardous',
    notes: ['Su precipitacion da la clasica "lluvia de oro" al enfriarse lentamente.'] },
  { formula: 'AgNO3', tags: ['salt'], state: 's', appearance: 'solido blanco cristalino',
    density: 4.35, mp: 482, solubility: 'soluble', gPer100mL: 256, dHf: -124.4, hazard: 'hazardous',
    notes: ['Mancha la piel de negro por reduccion a plata metalica.'] },
  { formula: 'KI', tags: ['salt'], state: 's', appearance: 'solido blanco', density: 3.12, mp: 954,
    solubility: 'soluble', gPer100mL: 140, dHf: -327.9, hazard: 'safe' },
  { formula: 'KCl', tags: ['salt', 'mineral'], state: 's', common: 'silvina',
    appearance: 'solido blanco', density: 1.98, mp: 1043, solubility: 'soluble', gPer100mL: 34.0,
    dHf: -436.7, dGf: -409.1, S: 82.6, hazard: 'safe' },
  { formula: 'Ca(HCO3)2', tags: ['salt'], state: 'aq', appearance: 'solo estable en disolucion',
    solubility: 'soluble', hazard: 'safe',
    notes: ['Responsable de la dureza temporal del agua: al hervir precipita CaCO3 (la cal de las tuberias).'] },
  { formula: 'NaHSO4', tags: ['salt'], state: 's', appearance: 'solido blanco',
    density: 2.74, mp: 588, solubility: 'soluble', dHf: -1125.5, hazard: 'hazardous' },

  { formula: 'NaNO3', tags: ['salt', 'mineral', 'industrial'], state: 's', common: 'nitratina',
    synonyms: ['nitrato sodico', 'nitro de Chile', 'salitre de Chile'], appearance: 'solido blanco',
    density: 2.26, mp: 581, solubility: 'soluble', gPer100mL: 91.2, dHf: -467.9, dGf: -367.0, S: 116.5,
    hazard: 'special-conditions', notes: ['Oxidante; fertilizante nitrogenado clasico.'] },
  { formula: 'BaCl2', tags: ['salt'], state: 's', appearance: 'solido blanco',
    density: 3.856, mp: 1236, solubility: 'soluble', gPer100mL: 35.8, dHf: -855.0, hazard: 'hazardous',
    notes: ['Los compuestos de bario solubles son toxicos, a diferencia del BaSO4 insoluble.'] },
  { formula: 'Pb(NO3)2', tags: ['salt'], state: 's', appearance: 'cristales blancos',
    density: 4.53, solubility: 'soluble', gPer100mL: 52, dHf: -451.9, hazard: 'do-not-attempt',
    notes: ['El plomo es un toxico acumulativo; afecta sobre todo al desarrollo neurologico infantil.'] },
  { formula: 'ZnSO4', tags: ['salt'], state: 's', appearance: 'solido blanco',
    density: 3.54, solubility: 'soluble', gPer100mL: 57.7, dHf: -982.8, hazard: 'special-conditions' },
  { formula: 'Cu(NO3)2', tags: ['salt'], state: 's', appearance: 'cristales azules',
    density: 3.05, solubility: 'soluble', gPer100mL: 137, dHf: -302.9, hazard: 'hazardous' },
  { formula: 'MnCl2', tags: ['salt'], state: 's', appearance: 'solido rosa palido',
    density: 2.98, mp: 923, solubility: 'soluble', gPer100mL: 72.3, dHf: -481.3, hazard: 'special-conditions' },
  { formula: 'KClO3', tags: ['salt'], state: 's', common: 'clorato de potasio',
    appearance: 'solido blanco cristalino', density: 2.32, mp: 610, solubility: 'soluble', gPer100mL: 7.3,
    dHf: -397.7, hazard: 'do-not-attempt',
    notes: ['Oxidante fuerte. Mezclado con materia organica o azufre puede detonar por friccion.'] },
  { formula: 'FeS', tags: ['salt'], state: 's', appearance: 'solido gris negruzco',
    density: 4.84, mp: 1467, solubility: 'insoluble', dHf: -100.0, hazard: 'special-conditions',
    notes: ['Con acidos libera H2S, que es muy toxico.'] },
  { formula: 'H2SO3', tags: ['acid'], state: 'aq', common: 'acido sulfuroso',
    appearance: 'solo existe en disolucion acuosa', solubility: 'soluble', pKa: 1.85, hazard: 'hazardous',
    notes: ['No se puede aislar puro: se descompone en SO2 y agua.'] },

  // -------------------------------------------------------------------------
  // COMPUESTOS ORGANICOS Y DISOLVENTES
  // -------------------------------------------------------------------------
  { formula: 'CH3COONa', tags: ['salt', 'organic'], state: 's', common: 'acetato de sodio',
    synonyms: ['acetato sodico', 'etanoato de sodio'], appearance: 'solido blanco',
    density: 1.528, mp: 597, solubility: 'soluble', gPer100mL: 46.4, dHf: -708.8, hazard: 'safe',
    notes: ['Su trihidrato sobreenfriado cristaliza de golpe al perturbarlo: son las bolsas de calor reutilizables.'] },
  { formula: 'CH4', tags: ['organic', 'gas', 'industrial'], state: 'g', common: 'metano',
    synonyms: ['metano', 'gas natural', 'methane'], appearance: 'gas incoloro e inodoro',
    mp: 90.7, bp: 111.7, solubility: 'insoluble', dHf: -74.6, dGf: -50.5, S: 186.3,
    hazard: 'hazardous', notes: ['Principal componente del gas natural.', 'Gas de efecto invernadero mucho mas potente que el CO2 a corto plazo.'] },
  { formula: 'C2H6', tags: ['organic', 'gas'], state: 'g', common: 'etano', mp: 90.4, bp: 184.6,
    dHf: -84.0, dGf: -32.0, S: 229.2, hazard: 'hazardous' },
  { formula: 'C3H8', tags: ['organic', 'gas'], state: 'g', common: 'propano', mp: 85.5, bp: 231.0,
    dHf: -103.8, dGf: -23.4, S: 270.3, hazard: 'hazardous' },
  { formula: 'C2H4', tags: ['organic', 'gas', 'industrial'], state: 'g', common: 'eteno',
    synonyms: ['etileno', 'eteno'], mp: 104.0, bp: 169.4, dHf: 52.4, dGf: 68.4, S: 219.3,
    hazard: 'hazardous', notes: ['Hormona vegetal: acelera la maduracion de la fruta.', 'Materia prima del polietileno.'] },
  { formula: 'C2H2', tags: ['organic', 'gas', 'industrial'], state: 'g', common: 'etino',
    synonyms: ['acetileno', 'etino'], mp: 192.4, dHf: 227.4, dGf: 209.9, S: 200.9, hazard: 'hazardous',
    notes: ['ΔHf° muy positivo: al arder libera muchisima energia. Por eso el soplete oxiacetilenico alcanza mas de 3000 °C.'] },
  { formula: 'C2H5OH', tags: ['organic', 'solvent'], state: 'l', common: 'etanol',
    synonyms: ['etanol', 'alcohol etilico', 'alcohol', 'ethanol'],
    appearance: 'liquido incoloro, olor caracteristico', density: 0.789, mp: 159.0, bp: 351.5,
    solubility: 'soluble', dHf: -277.6, dGf: -174.8, S: 160.7, hazard: 'hazardous' },
  { formula: 'CH3OH', tags: ['organic', 'solvent', 'industrial'], state: 'l', common: 'metanol',
    synonyms: ['metanol', 'alcohol metilico', 'alcohol de madera'],
    appearance: 'liquido incoloro', density: 0.792, mp: 175.6, bp: 337.8, solubility: 'soluble',
    dHf: -239.2, dGf: -166.6, S: 126.8, hazard: 'do-not-attempt',
    notes: ['Muy toxico por ingestion: causa ceguera y muerte. No distinguible del etanol por el olor.'] },
  { formula: 'C6H12O6', tags: ['organic'], state: 's', common: 'glucosa',
    synonyms: ['glucosa', 'dextrosa', 'azucar de uva'], appearance: 'solido blanco cristalino',
    density: 1.54, mp: 419, solubility: 'soluble', gPer100mL: 91, dHf: -1273.3, dGf: -910.4, S: 212.1,
    hazard: 'safe' },
  { formula: 'C6H6', tags: ['organic', 'solvent'], state: 'l', common: 'benceno',
    appearance: 'liquido incoloro, olor dulce', density: 0.8765, mp: 278.7, bp: 353.2,
    solubility: 'insoluble', dHf: 49.1, dGf: 124.5, S: 173.4, hazard: 'do-not-attempt',
    notes: ['Cancerigeno reconocido.', 'Aromatico: los seis enlaces C-C son equivalentes, ni simples ni dobles.'] },
  { formula: 'CH3COOC2H5', tags: ['organic', 'solvent'], state: 'l', common: 'acetato de etilo',
    appearance: 'liquido incoloro, olor afrutado', density: 0.902, mp: 189.6, bp: 350.2,
    solubility: 'slightly-soluble', dHf: -479.0, hazard: 'hazardous',
    notes: ['Ester tipico: se obtiene por esterificacion de Fischer entre acido acetico y etanol.'] },
  { formula: 'CHCl3', tags: ['organic', 'solvent'], state: 'l', common: 'cloroformo',
    appearance: 'liquido incoloro denso', density: 1.489, mp: 209.6, bp: 334.3,
    solubility: 'slightly-soluble', dHf: -134.1, hazard: 'do-not-attempt' },
];

// ---------------------------------------------------------------------------
// Construccion: la formula manda, el resto se deriva
// ---------------------------------------------------------------------------

function buildProperties(d: SpeciesDef, molarMass: number | null): SpeciesProperties {
  return {
    molarMass: molarMass === null ? UNKNOWN('g/mol') : measured(molarMass, 'g/mol', { source: 'calculada a partir de los pesos atomicos IUPAC' }),
    state: d.state ?? null,
    density:
      d.density === undefined
        ? UNKNOWN('g/cm3')
        : measured(d.density, d.densityUnit ?? 'g/cm3', CRC),
    meltingPoint: d.mp === undefined ? UNKNOWN('K') : measured(d.mp, 'K', CRC),
    boilingPoint: d.bp === undefined ? UNKNOWN('K') : measured(d.bp, 'K', CRC),
    solubility: {
      water: d.solubility ?? null,
      ...(d.gPer100mL !== undefined
        ? { gramsPer100mL: measured(d.gPer100mL, 'g/100mL', CRC) }
        : {}),
    },
    pKa: d.pKa === undefined ? UNKNOWN('pKa') : measured(d.pKa, 'pKa', CRC),
    pKb: d.pKb === undefined ? UNKNOWN('pKb') : measured(d.pKb, 'pKb', CRC),
    deltaHf: d.dHf === undefined ? UNKNOWN('kJ/mol') : measured(d.dHf, 'kJ/mol', NIST),
    deltaGf: d.dGf === undefined ? UNKNOWN('kJ/mol') : measured(d.dGf, 'kJ/mol', NIST),
    standardEntropy: d.S === undefined ? UNKNOWN('J/(mol K)') : measured(d.S, 'J/(mol K)', NIST),
    hazard: d.hazard ?? 'special-conditions',
    appearance: d.appearance ?? null,
    notes: d.notes ?? [],
  };
}

function buildSpecies(d: SpeciesDef): Species {
  const parsed = parseFormula(d.formula);
  if (!parsed.ok) throw new Error(`Especie mal definida en la base de datos: ${d.formula} — ${parsed.error}`);

  const composition = parsed.value.composition;
  const charge = d.charge ?? parsed.value.charge;
  const classification = classify(d.formula, composition, charge);
  // nameFormula sabe tratar hidratos; nameCompound es el caso general.
  const derivedNames =
    parsed.value.hydrate.length > 0
      ? nameFormula(d.formula) ?? nameCompound(d.formula, composition, classification)
      : nameCompound(d.formula, composition, classification);

  const names = { ...derivedNames, common: d.common ?? derivedNames.common };

  // El buscador debe encontrar la sustancia por formula, por nombre en
  // cualquiera de los tres sistemas, por nombre comun y por sinonimo (§3).
  const synonyms = new Set<string>(d.synonyms ?? []);
  synonyms.add(d.formula);
  for (const n of [names.stock, names.systematic, names.traditional, names.common]) {
    if (n) synonyms.add(n);
  }

  return {
    id: d.formula,
    formula: d.formula,
    kind: d.kind ?? (classification.compoundClass === 'element' ? 'element' : 'compound'),
    charge,
    composition,
    arity: arityOf(composition),
    compoundClass: classification.compoundClass,
    names,
    synonyms: [...synonyms],
    properties: buildProperties(d, molarMassOf(composition)),
    tags: [...new Set([...d.tags, ...classification.tags])],
  };
}

export const SPECIES: readonly Species[] = DEFS.map(buildSpecies);

const BY_ID = new Map<string, Species>(SPECIES.map((s) => [s.id, s]));

export function getSpecies(id: string): Species | undefined {
  return BY_ID.get(id);
}

export function allSpecies(): readonly Species[] {
  return SPECIES;
}

/** Solubilidad curada de una sustancia; null si no se conoce. */
export function curatedSolubility(formula: string): Solub | null {
  return BY_ID.get(formula)?.properties.solubility.water ?? null;
}
