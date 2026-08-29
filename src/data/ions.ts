/**
 * Base de datos de iones — monoatomicos y poliatomicos.
 *
 * Alimenta directamente:
 *   - el constructor de compuestos (§5): Ca²⁺ + O²⁻ -> CaO
 *   - el generador de formulas (§7): Al³⁺ + O²⁻ -> Al₂O₃
 *   - la nomenclatura de sales (§28)
 *   - las reglas de doble desplazamiento y precipitacion (§8)
 *
 * Los nombres tradicionales de cationes (-oso / -ico) se incluyen porque
 * siguen usandose en la ensenanza en espanol y el brief los pide (§28).
 */

import type { Ion } from '../core/types.js';
import { parseFormula } from '../core/formula/parse.js';

/**
 * [formula, carga, nombre_es, nombre_en, tradicional|'', acido_padre|'',
 *  sinonimos...]
 */
type IonRow = [string, number, string, string, string, string, ...string[]];

const CATIONS: IonRow[] = [
  ['H', 1, 'hidrogeno', 'hydrogen', '', '', 'proton', 'protón'],
  ['Li', 1, 'litio', 'lithium', '', ''],
  ['Na', 1, 'sodio', 'sodium', '', ''],
  ['K', 1, 'potasio', 'potassium', '', ''],
  ['Rb', 1, 'rubidio', 'rubidium', '', ''],
  ['Cs', 1, 'cesio', 'caesium', '', ''],
  ['Ag', 1, 'plata', 'silver', '', ''],
  ['NH4', 1, 'amonio', 'ammonium', '', ''],
  ['H3O', 1, 'hidronio', 'hydronium', '', '', 'oxonio'],
  ['Cu', 1, 'cobre(I)', 'copper(I)', 'cuproso', ''],
  ['Hg2', 2, 'mercurio(I)', 'mercury(I)', 'mercurioso', '', 'dimercurio(2+)'],
  ['Au', 1, 'oro(I)', 'gold(I)', 'auroso', ''],
  ['Tl', 1, 'talio(I)', 'thallium(I)', 'taloso', ''],

  ['Be', 2, 'berilio', 'beryllium', '', ''],
  ['Mg', 2, 'magnesio', 'magnesium', '', ''],
  ['Ca', 2, 'calcio', 'calcium', '', ''],
  ['Sr', 2, 'estroncio', 'strontium', '', ''],
  ['Ba', 2, 'bario', 'barium', '', ''],
  ['Ra', 2, 'radio', 'radium', '', ''],
  ['Zn', 2, 'zinc', 'zinc', '', '', 'cinc'],
  ['Cd', 2, 'cadmio', 'cadmium', '', ''],
  ['Cu', 2, 'cobre(II)', 'copper(II)', 'cuprico', '', 'cúprico'],
  ['Fe', 2, 'hierro(II)', 'iron(II)', 'ferroso', ''],
  ['Fe', 3, 'hierro(III)', 'iron(III)', 'ferrico', '', 'férrico'],
  ['Co', 2, 'cobalto(II)', 'cobalt(II)', 'cobaltoso', ''],
  ['Co', 3, 'cobalto(III)', 'cobalt(III)', 'cobaltico', ''],
  ['Ni', 2, 'niquel(II)', 'nickel(II)', 'niqueloso', '', 'níquel(II)'],
  ['Mn', 2, 'manganeso(II)', 'manganese(II)', 'manganoso', ''],
  ['Cr', 2, 'cromo(II)', 'chromium(II)', 'cromoso', ''],
  ['Cr', 3, 'cromo(III)', 'chromium(III)', 'cromico', '', 'crómico'],
  ['Pb', 2, 'plomo(II)', 'lead(II)', 'plumboso', ''],
  ['Pb', 4, 'plomo(IV)', 'lead(IV)', 'plumbico', ''],
  ['Sn', 2, 'estano(II)', 'tin(II)', 'estannoso', '', 'estaño(II)'],
  ['Sn', 4, 'estano(IV)', 'tin(IV)', 'estannico', '', 'estaño(IV)'],
  ['Hg', 2, 'mercurio(II)', 'mercury(II)', 'mercurico', '', 'mercúrico'],
  ['Pt', 2, 'platino(II)', 'platinum(II)', 'platinoso', ''],
  ['Pt', 4, 'platino(IV)', 'platinum(IV)', 'platinico', ''],

  ['Al', 3, 'aluminio', 'aluminium', '', ''],
  ['Ga', 3, 'galio', 'gallium', '', ''],
  ['Bi', 3, 'bismuto(III)', 'bismuth(III)', '', ''],
  ['Sc', 3, 'escandio', 'scandium', '', ''],
  ['Y', 3, 'itrio', 'yttrium', '', ''],
  ['La', 3, 'lantano', 'lanthanum', '', ''],
  ['Au', 3, 'oro(III)', 'gold(III)', 'aurico', ''],
  ['Ti', 4, 'titanio(IV)', 'titanium(IV)', '', ''],
  ['VO', 2, 'vanadilo', 'vanadyl', '', '', 'oxovanadio(IV)'],
  ['UO2', 2, 'uranilo', 'uranyl', '', ''],
];

const ANIONS: IonRow[] = [
  // Monoatomicos
  ['H', -1, 'hidruro', 'hydride', '', ''],
  ['F', -1, 'fluoruro', 'fluoride', '', 'HF'],
  ['Cl', -1, 'cloruro', 'chloride', '', 'HCl'],
  ['Br', -1, 'bromuro', 'bromide', '', 'HBr'],
  ['I', -1, 'yoduro', 'iodide', '', 'HI', 'ioduro'],
  ['O', -2, 'oxido', 'oxide', '', '', 'óxido'],
  ['S', -2, 'sulfuro', 'sulfide', '', 'H2S'],
  ['Se', -2, 'seleniuro', 'selenide', '', 'H2Se'],
  ['Te', -2, 'telururo', 'telluride', '', 'H2Te'],
  ['N', -3, 'nitruro', 'nitride', '', ''],
  ['P', -3, 'fosfuro', 'phosphide', '', ''],
  ['C', -4, 'carburo', 'carbide', '', ''],

  // Poliatomicos: oxoaniones
  ['OH', -1, 'hidroxido', 'hydroxide', '', 'H2O', 'hidróxido', 'oxidrilo'],
  ['O2', -2, 'peroxido', 'peroxide', '', 'H2O2', 'peróxido'],
  ['O2', -1, 'superoxido', 'superoxide', '', '', 'hiperóxido'],
  ['CN', -1, 'cianuro', 'cyanide', '', 'HCN'],
  ['SCN', -1, 'tiocianato', 'thiocyanate', '', 'HSCN'],
  ['NO3', -1, 'nitrato', 'nitrate', '', 'HNO3'],
  ['NO2', -1, 'nitrito', 'nitrite', '', 'HNO2'],
  ['SO4', -2, 'sulfato', 'sulfate', '', 'H2SO4'],
  ['SO3', -2, 'sulfito', 'sulfite', '', 'H2SO3'],
  ['S2O3', -2, 'tiosulfato', 'thiosulfate', '', 'H2S2O3'],
  ['HSO4', -1, 'hidrogenosulfato', 'hydrogensulfate', '', 'H2SO4', 'bisulfato', 'sulfato ácido'],
  ['HSO3', -1, 'hidrogenosulfito', 'hydrogensulfite', '', 'H2SO3', 'bisulfito'],
  ['HS', -1, 'hidrogenosulfuro', 'hydrogensulfide', '', 'H2S', 'bisulfuro'],
  ['CO3', -2, 'carbonato', 'carbonate', '', 'H2CO3'],
  ['HCO3', -1, 'hidrogenocarbonato', 'hydrogencarbonate', '', 'H2CO3', 'bicarbonato', 'carbonato ácido'],
  ['PO4', -3, 'fosfato', 'phosphate', '', 'H3PO4', 'ortofosfato'],
  ['HPO4', -2, 'hidrogenofosfato', 'hydrogenphosphate', '', 'H3PO4', 'fosfato ácido'],
  ['H2PO4', -1, 'dihidrogenofosfato', 'dihydrogenphosphate', '', 'H3PO4'],
  ['PO3', -3, 'fosfito', 'phosphite', '', 'H3PO3'],
  ['ClO', -1, 'hipoclorito', 'hypochlorite', '', 'HClO'],
  ['ClO2', -1, 'clorito', 'chlorite', '', 'HClO2'],
  ['ClO3', -1, 'clorato', 'chlorate', '', 'HClO3'],
  ['ClO4', -1, 'perclorato', 'perchlorate', '', 'HClO4'],
  ['BrO3', -1, 'bromato', 'bromate', '', 'HBrO3'],
  ['IO3', -1, 'yodato', 'iodate', '', 'HIO3'],
  ['MnO4', -1, 'permanganato', 'permanganate', '', 'HMnO4'],
  ['MnO4', -2, 'manganato', 'manganate', '', 'H2MnO4'],
  ['CrO4', -2, 'cromato', 'chromate', '', 'H2CrO4'],
  ['Cr2O7', -2, 'dicromato', 'dichromate', '', 'H2Cr2O7'],
  ['SiO3', -2, 'silicato', 'silicate', '', 'H2SiO3', 'metasilicato'],
  ['BO3', -3, 'borato', 'borate', '', 'H3BO3'],
  ['B4O7', -2, 'tetraborato', 'tetraborate', '', 'H2B4O7'],
  ['AlO2', -1, 'aluminato', 'aluminate', '', 'HAlO2'],
  ['ZnO2', -2, 'zincato', 'zincate', '', 'H2ZnO2'],
  ['AsO4', -3, 'arseniato', 'arsenate', '', 'H3AsO4'],
  ['AsO3', -3, 'arsenito', 'arsenite', '', 'H3AsO3'],
  ['N3', -1, 'azida', 'azide', '', 'HN3'],
  ['NH2', -1, 'amiduro', 'amide', '', 'NH3'],
  ['C2O4', -2, 'oxalato', 'oxalate', '', 'H2C2O4'],
  ['CH3COO', -1, 'acetato', 'acetate', '', 'CH3COOH', 'etanoato'],
  ['HCOO', -1, 'formiato', 'formate', '', 'HCOOH', 'metanoato'],
  ['C6H5COO', -1, 'benzoato', 'benzoate', '', 'C6H5COOH'],
];

function buildIon(row: IonRow, isCation: boolean): Ion {
  const [formula, chargeMagnitude, name, nameEn, traditional, parentAcid, ...synonyms] = row;
  const charge = isCation ? Math.abs(chargeMagnitude) : -Math.abs(chargeMagnitude);
  const parsed = parseFormula(formula);
  if (!parsed.ok) throw new Error(`Ion mal definido en la base de datos: ${formula}`);
  const composition = parsed.value.composition;

  const ion: Ion = {
    id: `${formula}^${charge > 0 ? '+' : '-'}${Math.abs(charge)}`,
    formula,
    charge,
    composition,
    name,
    nameEn,
    polyatomic: composition.size > 1 || (composition.get(formula) ?? 0) > 1 || [...composition.values()].reduce((a, b) => a + b, 0) > 1,
    synonyms,
    ...(traditional ? { traditionalName: traditional } : {}),
    ...(parentAcid ? { parentAcid } : {}),
  };
  return ion;
}

export const CATION_LIST: readonly Ion[] = CATIONS.map((r) => buildIon(r, true));
export const ANION_LIST: readonly Ion[] = ANIONS.map((r) => buildIon(r, false));
export const IONS: readonly Ion[] = [...CATION_LIST, ...ANION_LIST];

const BY_ID = new Map<string, Ion>(IONS.map((i) => [i.id, i]));

/** Todos los iones con una formula dada (Fe tiene Fe²⁺ y Fe³⁺). */
const BY_FORMULA = new Map<string, Ion[]>();
for (const ion of IONS) {
  const list = BY_FORMULA.get(ion.formula) ?? [];
  list.push(ion);
  BY_FORMULA.set(ion.formula, list);
}

export function getIon(formula: string, charge: number): Ion | undefined {
  return BY_ID.get(`${formula}^${charge > 0 ? '+' : '-'}${Math.abs(charge)}`);
}

export function getIonsByFormula(formula: string): readonly Ion[] {
  return BY_FORMULA.get(formula) ?? [];
}

/**
 * Reconoce si un fragmento de formula es un ion poliatomico conocido.
 * Lo usa el clasificador para distinguir CaCO₃ (oxosal con carbonato) de un
 * compuesto ternario cualquiera.
 */
export function findPolyatomicAnion(formula: string): Ion | undefined {
  return ANION_LIST.find((i) => i.formula === formula && i.polyatomic);
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const BY_NAME = new Map<string, Ion>();
for (const ion of IONS) {
  BY_NAME.set(norm(ion.name), ion);
  BY_NAME.set(norm(ion.nameEn), ion);
  if (ion.traditionalName) BY_NAME.set(norm(ion.traditionalName), ion);
  for (const s of ion.synonyms) BY_NAME.set(norm(s), ion);
}

export function getIonByName(name: string): Ion | undefined {
  return BY_NAME.get(norm(name));
}

/** Anion cuyo acido padre es el indicado: 'H2SO4' -> sulfato. */
export function anionOfAcid(acidFormula: string): Ion | undefined {
  return ANION_LIST.find((i) => i.parentAcid === acidFormula && !i.formula.startsWith('H'));
}

export const CATIONS_BY_ELEMENT = new Map<string, Ion[]>();
for (const c of CATION_LIST) {
  const sym = [...c.composition.keys()][0]!;
  if (c.composition.size !== 1) continue;
  const list = CATIONS_BY_ELEMENT.get(sym) ?? [];
  list.push(c);
  CATIONS_BY_ELEMENT.set(sym, list);
}
