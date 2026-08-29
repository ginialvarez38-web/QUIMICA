/**
 * CHEMICAL SANDBOX — Modelo de datos quimico (capa 1: dominio puro).
 *
 * Este modulo no importa nada. No conoce la interfaz, ni el renderizador, ni
 * la base de datos. Define UNICAMENTE que es una entidad quimica.
 *
 * Regla de arquitectura (§31 del brief): la base de datos dice QUE sustancias
 * existen; el motor quimico dice QUE REGLAS se aplican; el motor de simulacion
 * dice COMO EVOLUCIONAN; el motor visual dice COMO SE REPRESENTAN; el motor
 * educativo dice COMO SE EXPLICAN. Este archivo pertenece al vocabulario
 * compartido por todos ellos y no debe adquirir dependencias.
 */

// ---------------------------------------------------------------------------
// Nivel de evidencia y procedencia (§32: NO INVENTAR QUIMICA)
// ---------------------------------------------------------------------------

/**
 * Cuanta confianza podemos depositar en una afirmacion quimica.
 * Toda reaccion y toda propiedad numerica del sistema lleva uno de estos.
 */
export type EvidenceLevel =
  /** Hecho de libro de texto, reproducible, sin ambiguedad. */
  | 'established'
  /** Correcto bajo condiciones concretas que DEBEN declararse. */
  | 'conditional'
  /** Prediccion de las reglas del motor, no una entrada curada. */
  | 'predicted'
  /** El sistema no tiene informacion suficiente. Se muestra como tal. */
  | 'unknown';

/** De donde procede un dato. Nunca se muestra un numero sin poder citarlo. */
export interface Provenance {
  /** Referencia legible: "CRC Handbook 97th ed.", "IUPAC 2021", etc. */
  readonly source: string;
  /** Nota opcional sobre condiciones de medida (p. ej. "a 25 C, 1 atm"). */
  readonly note?: string;
}

/**
 * Un valor numerico que puede no existir. El sistema NUNCA rellena huecos con
 * suposiciones: si no hay dato, `value` es null y la UI muestra
 * "Datos no disponibles para esta simulacion." (§18, §27)
 */
export interface Measured<U extends string = string> {
  readonly value: number | null;
  readonly unit: U;
  readonly provenance?: Provenance;
}

export function measured<U extends string>(
  value: number | null,
  unit: U,
  provenance?: Provenance,
): Measured<U> {
  return provenance ? { value, unit, provenance } : { value, unit };
}

/** Valor desconocido tipado: preferible a `undefined` disperso por el codigo. */
export const UNKNOWN = <U extends string>(unit: U): Measured<U> => ({ value: null, unit });

// ---------------------------------------------------------------------------
// Elementos y atomos
// ---------------------------------------------------------------------------

export type Block = 's' | 'p' | 'd' | 'f';

export type ElementCategory =
  | 'alkali-metal'
  | 'alkaline-earth-metal'
  | 'transition-metal'
  | 'post-transition-metal'
  | 'metalloid'
  | 'reactive-nonmetal'
  | 'halogen'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide'
  | 'unknown';

/** Familias que el motor consulta constantemente. */
export const METALLIC_CATEGORIES: ReadonlySet<ElementCategory> = new Set<ElementCategory>([
  'alkali-metal',
  'alkaline-earth-metal',
  'transition-metal',
  'post-transition-metal',
  'lanthanide',
  'actinide',
]);

export interface PhysicalElementData {
  /** Punto de fusion en kelvin. */
  readonly meltingPoint: Measured<'K'>;
  /** Punto de ebullicion en kelvin. */
  readonly boilingPoint: Measured<'K'>;
  /** Densidad en g/cm3 (solidos y liquidos) o g/L (gases, indicado en unit). */
  readonly density: Measured<'g/cm3' | 'g/L'>;
  /** Radio covalente en picometros. */
  readonly covalentRadius: Measured<'pm'>;
  /** Radio de van der Waals en picometros. */
  readonly vanDerWaalsRadius: Measured<'pm'>;
}

export interface Element {
  /** Numero atomico. Identidad canonica del elemento. */
  readonly Z: number;
  /** Simbolo IUPAC. Sensible a mayusculas: "Co" (cobalto) != "CO" (monoxido). */
  readonly symbol: string;
  /** Nombre en espanol. */
  readonly name: string;
  /** Nombre en ingles, para busqueda bilingue. */
  readonly nameEn: string;
  /** Peso atomico estandar (IUPAC). Para radionucleidos, numero masico del
   *  isotopo mas estable, marcado con `massIsNominal`. */
  readonly atomicMass: number;
  readonly massIsNominal: boolean;
  readonly category: ElementCategory;
  /** Grupo 1..18, o null para lantanidos/actinidos. */
  readonly group: number | null;
  readonly period: number;
  readonly block: Block;
  /** Electronegatividad de Pauling; null si no esta definida. */
  readonly electronegativity: number | null;
  /** Electrones de valencia usados para Lewis (grupo principal). */
  readonly valenceElectrons: number;
  /** Estados de oxidacion observados, ordenados; el mas comun primero. */
  readonly oxidationStates: readonly number[];
  /** Configuracion electronica abreviada, p. ej. "[Ne] 3s2 3p4". */
  readonly electronConfiguration: string;
  /** Color CPK/Jmol para visualizacion (hex). Pertenece al motor visual pero
   *  se almacena aqui por conveniencia de la tabla de datos. */
  readonly cpkColor: string;
  readonly physical: PhysicalElementData;
}

export function isMetal(el: Element): boolean {
  return METALLIC_CATEGORIES.has(el.category);
}

export function isNonmetal(el: Element): boolean {
  return (
    el.category === 'reactive-nonmetal' || el.category === 'halogen' || el.category === 'noble-gas'
  );
}

// ---------------------------------------------------------------------------
// Composicion y formulas
// ---------------------------------------------------------------------------

/**
 * Recuento de atomos por simbolo de elemento. Es la representacion canonica
 * usada para masa molar, balanceo y clasificacion.
 *
 * Se usa `Map` y no un objeto plano porque el orden de insercion es
 * significativo (orden de Hill / orden de escritura del usuario).
 */
export type Composition = ReadonlyMap<string, number>;

/** Nodo del arbol sintactico de una formula: `Ca(OH)2`, `CuSO4·5H2O`. */
export type FormulaNode =
  | { readonly kind: 'atom'; readonly symbol: string; readonly count: number }
  | { readonly kind: 'group'; readonly children: readonly FormulaNode[]; readonly count: number };

export interface ParsedFormula {
  /** Cadena original tal como la escribio el usuario. */
  readonly input: string;
  /** Arbol sintactico, conservando la agrupacion: Ca(OH)2 mantiene el (OH). */
  readonly nodes: readonly FormulaNode[];
  /** Composicion aplanada. */
  readonly composition: Composition;
  /** Carga neta; 0 para especies neutras. */
  readonly charge: number;
  /** Fragmentos de hidrato: CuSO4·5H2O -> [{count:5, formula:'H2O'}]. */
  readonly hydrate: readonly { readonly count: number; readonly formula: string }[];
}

// ---------------------------------------------------------------------------
// Enlaces
// ---------------------------------------------------------------------------

export type BondKind =
  | 'ionic'
  | 'covalent-nonpolar'
  | 'covalent-polar'
  | 'metallic'
  | 'coordinate'
  | 'hydrogen'
  | 'van-der-waals';

export type BondOrder = 1 | 2 | 3;

export interface Bond {
  /** Indices dentro de `Structure.atoms`. */
  readonly a: number;
  readonly b: number;
  readonly order: BondOrder;
  readonly kind: BondKind;
  /** Diferencia de electronegatividad que justifico `kind`, si aplica. */
  readonly electronegativityDelta?: number;
}

/** Un atomo posicionado dentro de una estructura concreta. */
export interface StructureAtom {
  /** Identidad estable a lo largo de una reaccion — permite "SEGUIR ATOMO". */
  readonly id: string;
  readonly symbol: string;
  /** Coordenadas en angstrom. */
  readonly position: Vec3;
  /** Carga formal, si se ha calculado. */
  readonly formalCharge?: number;
  /** Estado de oxidacion asignado, si se ha calculado. */
  readonly oxidationState?: number;
  /** Pares libres para el modo Lewis. */
  readonly lonePairs?: number;
}

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type StructureMotif =
  /** Molecula discreta (H2O, CO2, CH4). */
  | 'molecular'
  /** Red ionica extendida — no existe "una molecula" de NaCl. */
  | 'ionic-lattice'
  /** Red metalica. */
  | 'metallic-lattice'
  /** Red covalente extendida (SiO2, diamante). */
  | 'covalent-network'
  /** Atomo o ion aislado. */
  | 'atomic';

export interface Structure {
  readonly motif: StructureMotif;
  readonly atoms: readonly StructureAtom[];
  readonly bonds: readonly Bond[];
  /** Geometria VSEPR del atomo central, cuando es una molecula sencilla. */
  readonly geometry?: string;
}

// ---------------------------------------------------------------------------
// Especies quimicas
// ---------------------------------------------------------------------------

export type PhaseState = 's' | 'l' | 'g' | 'aq';

export type SpeciesKind =
  | 'element'
  | 'ion'
  | 'molecule'
  | 'compound'
  | 'polyatomic-ion'
  | 'functional-group';

/**
 * Clasificacion quimica de un compuesto. Es lo que alimenta la nomenclatura,
 * la prediccion de reacciones y el buscador de la biblioteca.
 */
export type CompoundClass =
  | 'element'
  | 'basic-oxide'
  | 'acidic-oxide'
  | 'amphoteric-oxide'
  | 'peroxide'
  | 'hydroxide'
  | 'binary-acid'
  | 'oxoacid'
  | 'binary-salt'
  | 'oxosalt'
  | 'acid-salt'
  | 'metal-hydride'
  | 'nonmetal-hydride'
  | 'binary-covalent'
  | 'organic'
  | 'coordination'
  | 'other';

/** Numero de ELEMENTOS DISTINTOS, no numero de atomos (§6, error clasico). */
export type Arity = 'unary' | 'binary' | 'ternary' | 'quaternary' | 'higher';

export interface SolubilityInfo {
  /** Solubilidad en agua, cualitativa — es lo que usan las reglas de
   *  precipitacion. `null` = desconocida, no "insoluble". */
  readonly water: 'soluble' | 'slightly-soluble' | 'insoluble' | 'reacts' | null;
  /** Solubilidad cuantitativa en g/100 mL de agua, si se conoce. */
  readonly gramsPer100mL?: Measured<'g/100mL'>;
}

export type HazardLevel =
  /** Verde: segura para simulacion educativa. */
  | 'safe'
  /** Amarillo: requiere condiciones especiales. */
  | 'special-conditions'
  /** Naranja: riesgo quimico relevante. */
  | 'hazardous'
  /** Rojo: no realizar fisicamente sin controles profesionales. */
  | 'do-not-attempt';

export interface SpeciesProperties {
  readonly molarMass: Measured<'g/mol'>;
  readonly state: PhaseState | null;
  readonly density: Measured<'g/cm3' | 'g/L'>;
  readonly meltingPoint: Measured<'K'>;
  readonly boilingPoint: Measured<'K'>;
  readonly solubility: SolubilityInfo;
  /** pKa de la primera desprotonacion, para acidos. */
  readonly pKa: Measured<'pKa'>;
  readonly pKb: Measured<'pKb'>;
  /** Entalpia estandar de formacion, kJ/mol. */
  readonly deltaHf: Measured<'kJ/mol'>;
  /** Energia libre de Gibbs estandar de formacion, kJ/mol. */
  readonly deltaGf: Measured<'kJ/mol'>;
  /** Entropia molar estandar, J/(mol K). */
  readonly standardEntropy: Measured<'J/(mol K)'>;
  readonly hazard: HazardLevel;
  /** Observaciones macroscopicas: color, olor, aspecto (§33 nivel 1). */
  readonly appearance: string | null;
  readonly notes: readonly string[];
}

export interface Nomenclature {
  /** Nomenclatura de Stock: "oxido de hierro(III)". */
  readonly stock: string | null;
  /** Sistematica con prefijos multiplicadores: "trioxido de dihierro". */
  readonly systematic: string | null;
  /** Tradicional: "oxido ferrico". */
  readonly traditional: string | null;
  /** Nombre comun/comercial: "cal viva". */
  readonly common: string | null;
}

/**
 * Una especie quimica: la unidad basica de la biblioteca y de las reacciones.
 */
export interface Species {
  /** Identificador estable, normalmente la formula canonica. */
  readonly id: string;
  readonly formula: string;
  readonly kind: SpeciesKind;
  readonly charge: number;
  readonly composition: Composition;
  readonly arity: Arity;
  readonly compoundClass: CompoundClass;
  readonly names: Nomenclature;
  /** Sinonimos para el buscador: "cal viva", "quicklime", "CaO". */
  readonly synonyms: readonly string[];
  readonly properties: SpeciesProperties;
  /** Etiquetas de biblioteca: 'acid', 'base', 'solvent', 'gas', 'mineral'... */
  readonly tags: readonly string[];
  /** Estructura 3D, si se ha generado o curado. */
  readonly structure?: Structure;
}

// ---------------------------------------------------------------------------
// Iones
// ---------------------------------------------------------------------------

export interface Ion {
  readonly id: string;
  readonly formula: string;
  readonly charge: number;
  readonly composition: Composition;
  readonly name: string;
  readonly nameEn: string;
  readonly polyatomic: boolean;
  /** Nombre tradicional del catión con varios estados: "ferrico" para Fe3+. */
  readonly traditionalName?: string;
  readonly synonyms: readonly string[];
  /** Para oxoaniones: el acido del que derivan. SO4^2- -> H2SO4. */
  readonly parentAcid?: string;
}

// ---------------------------------------------------------------------------
// Reacciones
// ---------------------------------------------------------------------------

export type ReactionType =
  | 'synthesis'
  | 'decomposition'
  | 'single-displacement'
  | 'double-displacement'
  | 'combustion'
  | 'neutralization'
  | 'precipitation'
  | 'acid-base'
  | 'redox'
  | 'hydrolysis'
  | 'hydration'
  | 'calcination'
  | 'dissolution'
  | 'complexation'
  // Organicas — el motor esta preparado desde el inicio (§29).
  | 'substitution'
  | 'elimination'
  | 'addition'
  | 'esterification'
  | 'saponification'
  | 'polymerization'
  | 'oxidation'
  | 'reduction';

export interface ReactionCondition {
  /** Temperatura en kelvin, o rango. */
  readonly temperature?: Measured<'K'>;
  readonly pressure?: Measured<'atm'>;
  readonly solvent?: string;
  readonly catalyst?: string;
  readonly pH?: Measured<'pH'>;
  readonly atmosphere?: string;
  /** Texto libre legible: "calentar a 900 C", "en exceso de oxigeno". */
  readonly description?: string;
}

/** Un termino de una ecuacion: coeficiente + especie + estado fisico. */
export interface EquationTerm {
  readonly speciesId: string;
  readonly formula: string;
  readonly coefficient: number;
  readonly state?: PhaseState;
}

export interface ChemicalEquation {
  readonly reactants: readonly EquationTerm[];
  readonly products: readonly EquationTerm[];
  readonly balanced: boolean;
  /** Si es reversible, se renderiza con doble flecha. */
  readonly reversible?: boolean;
}

/** Perfil energetico (§18). Todos los campos pueden faltar. */
export interface EnergyProfile {
  readonly deltaH: Measured<'kJ/mol'>;
  readonly activationEnergy: Measured<'kJ/mol'>;
  readonly deltaG: Measured<'kJ/mol'>;
  readonly deltaS: Measured<'J/(mol K)'>;
  readonly character: 'exothermic' | 'endothermic' | 'unknown';
}

export interface MechanismStep {
  readonly label: string;
  readonly description: string;
  /** Enlaces que se rompen y se forman, en notacion legible. */
  readonly bondsBroken?: readonly string[];
  readonly bondsFormed?: readonly string[];
}

export interface Reaction {
  readonly id: string;
  readonly equation: ChemicalEquation;
  readonly types: readonly ReactionType[];
  readonly conditions: ReactionCondition;
  readonly energy: EnergyProfile;
  readonly evidence: EvidenceLevel;
  readonly hazard: HazardLevel;
  /** Explicacion en prosa de POR QUE ocurre. Nucleo del objetivo educativo. */
  readonly explanation: string;
  readonly mechanism?: readonly MechanismStep[];
  /** Observaciones macroscopicas: "efervescencia", "precipitado blanco". */
  readonly observations: readonly string[];
  /** 1 = introductorio, 5 = avanzado. Alimenta el sistema de progresion. */
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  /** Conceptos que esta reaccion ensena, para el modo examen. */
  readonly concepts: readonly string[];
}

// ---------------------------------------------------------------------------
// Laboratorio: recipientes, medidas, experimentos
// ---------------------------------------------------------------------------

export type ContainerKind =
  | 'beaker'
  | 'flask'
  | 'test-tube'
  | 'burette'
  | 'pipette'
  | 'graduated-cylinder'
  | 'reactor';

export interface QuantityOfSubstance {
  readonly speciesId: string;
  /** Cantidad en moles. Es la unidad interna canonica: gramos, litros y
   *  molaridad se convierten a moles en la frontera del motor. */
  readonly moles: number;
  readonly state?: PhaseState;
}

export interface Container {
  readonly id: string;
  readonly kind: ContainerKind;
  readonly label: string;
  /** Capacidad en mL. */
  readonly capacity: number;
  /** Volumen de disolucion actual en mL, si aplica. */
  readonly volume: number | null;
  readonly contents: readonly QuantityOfSubstance[];
  readonly temperature: Measured<'K'>;
}

export interface Experiment {
  readonly id: string;
  readonly index: number;
  readonly createdAt: string;
  readonly title: string;
  readonly reactantIds: readonly string[];
  readonly conditions: ReactionCondition;
  readonly resultReactionId: string | null;
  readonly equationText: string;
  readonly notes: string;
}

// ---------------------------------------------------------------------------
// Resultado generico con diagnostico
// ---------------------------------------------------------------------------

/**
 * Muchas operaciones quimicas pueden fallar de forma informativa (una formula
 * mal escrita, una ecuacion no balanceable). Se devuelve un resultado
 * explicito en vez de lanzar excepciones, para que la UI pueda ensenar el
 * error en lugar de romperse.
 */
export type Result<T> =
  | { readonly ok: true; readonly value: T; readonly warnings?: readonly string[] }
  | { readonly ok: false; readonly error: string; readonly detail?: string };

export function ok<T>(value: T, warnings?: readonly string[]): Result<T> {
  return warnings && warnings.length ? { ok: true, value, warnings } : { ok: true, value };
}

export function err<T>(error: string, detail?: string): Result<T> {
  return detail ? { ok: false, error, detail } : { ok: false, error };
}
