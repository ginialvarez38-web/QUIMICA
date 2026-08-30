/**
 * TABLA DE COMBINACIONES ION A ION.
 *
 * Responde a «¿que puedo construir?» de un vistazo, en lugar de una pareja
 * cada vez: 47 cationes × 54 aniones puestos en una cuadricula.
 *
 * EL PROBLEMA QUE ESTE MODULO EXISTE PARA RESOLVER
 * Cruzar todos los cationes con todos los aniones da 2538 formulas, y la
 * aritmetica de cargas las valida TODAS. Pero solo 58 de ellas son sustancias
 * que este proyecto tenga verificadas, y algunas de las restantes ni siquiera
 * son compuestos: H⁺ combinado con H⁻ da la cadena "HH", que no significa
 * nada.
 *
 * Presentar las 2538 como compuestos seria exactamente lo que prohibe el §32
 * del primer brief: inventar quimica. Presentar solo las 58 verificadas
 * dejaria inservible la tabla, porque el ejercicio de formulacion consiste
 * precisamente en construir combinaciones que uno no ha visto antes.
 *
 * La salida es distinguir las dos cosas y DECIRLO en cada celda:
 *
 *   VERIFICADA  la sustancia esta en la base de datos curada. Nombre real,
 *               solubilidad medida, propiedades. Existe.
 *
 *   DERIVADA    la formula se deduce de las cargas y el nombre de las reglas
 *               de nomenclatura. Es la respuesta correcta al ejercicio de
 *               formulacion. El motor NO afirma que el compuesto exista, sea
 *               estable, o se pueda preparar.
 *
 *   IMPOSIBLE   el modelo ionico no se aplica a esa pareja, y se explica por
 *               que en lugar de mostrar una formula sin sentido.
 *
 * La distincion no es un adorno: es la diferencia entre una herramienta de
 * estudio y un generador de compuestos falsos.
 */

import type { Ion, Composition } from '../core/types.js';
import { CATION_LIST, ANION_LIST } from '../data/ions.js';
import { allSpecies } from '../data/species.js';
import { buildIonicFormula } from '../core/build/ionicFormula.js';
import type { BuiltFormula } from '../core/build/ionicFormula.js';
import { nameFormula, preferredName } from '../core/nomenclature/inorganic.js';
import { solubilityOf } from './rules/solubility.js';
import type { Solubility } from './rules/solubility.js';
import { formatPlainUnicode } from '../core/formula/render.js';

export type ComboStatus = 'verified' | 'derived' | 'impossible';

export interface Combination {
  readonly cation: Ion;
  readonly anion: Ion;
  readonly status: ComboStatus;
  /** Formula canonica. Null si la combinacion es imposible. */
  readonly formula: string | null;
  /** Formula con subindices Unicode. */
  readonly display: string | null;
  readonly name: string | null;
  /** Cuantos iones de cada clase entran en la formula. */
  readonly cationCount: number;
  readonly anionCount: number;
  /** "2(+3) + 3(-2) = 0" */
  readonly neutralityCheck: string | null;
  readonly solubility: Solubility;
  /** Por que es imposible, cuando lo es. */
  readonly reason: string | null;
  /** La derivacion en seis pasos, para el inspector. */
  readonly built: BuiltFormula | null;
}

/** Clave estable de una celda: sirve de identificador en el DOM. */
export function comboKey(cation: Ion, anion: Ion): string {
  return `${cation.id}|${anion.id}`;
}

/**
 * Indice de la biblioteca curada por COMPOSICION, no por cadena.
 *
 * El constructor puede escribir una formula correcta pero con otra grafia que
 * la curada: del H⁺ con el OH⁻ sale "HOH", que es agua escrita de forma
 * inusual. Comparar cadenas la daria por desconocida; comparar composiciones
 * la reconoce.
 *
 * INVARIANTE del que depende esto: no puede haber dos sustancias curadas
 * distintas con la misma composicion. Hoy se cumple — 101 composiciones, cero
 * colisiones — y hay una prueba que lo vigila, porque el dia que alguien anada
 * un par de isomeros la tabla empezaria a llamar a uno por el nombre del otro
 * sin avisar.
 */
function compositionKey(composition: Composition): string {
  return [...composition]
    .map(([symbol, count]) => `${symbol}${count}`)
    .sort()
    .join('');
}

let curatedIndex: Map<string, { formula: string; name: string | null }> | null = null;

function curatedByComposition(): Map<string, { formula: string; name: string | null }> {
  if (curatedIndex) return curatedIndex;
  curatedIndex = new Map();
  for (const species of allSpecies()) {
    if (species.charge !== 0) continue;
    const key = compositionKey(species.composition);
    if (!curatedIndex.has(key)) {
      curatedIndex.set(key, { formula: species.formula, name: preferredName(species.names) });
    }
  }
  return curatedIndex;
}

/**
 * ¿Tiene sentido combinar estos dos iones?
 *
 * La unica regla que hace falta, y es una regla de verdad y no una lista: un
 * mismo ELEMENTO no puede ceder y captar electrones a la vez dentro del mismo
 * compuesto ionico. El hidrogeno es el caso que aparece, porque esta en las
 * dos listas (H⁺ e H⁻), y su producto "HH" no es un compuesto: seria
 * hidrogeno molecular, que es covalente.
 */
function impossibleReason(cation: Ion, anion: Ion): string | null {
  if (cation.formula === anion.formula) {
    return (
      `El ${cation.name} y el ${anion.name} son el MISMO elemento con cargas opuestas. Un elemento no ` +
      'cede y capta electrones a la vez dentro del mismo compuesto: lo que se formaria es la ' +
      'sustancia simple, que es covalente y no ionica.'
    );
  }

  /*
   * El HIDRONIO no es un cation que forme sales al modo de los demas.
   *
   * H3O⁺ es un proton HIDRATADO: solo existe rodeado de agua, en disolucion.
   * Tratarlo como una pieza mas del constructor produce cadenas que nadie
   * escribe — "H3OCl", "(H3O)2O" — y esas cadenas no son «formulas sin
   * verificar»: son formulas MAL ESCRITAS. Lo que se escribe para esa
   * disolucion es el acido, HCl.
   *
   * La diferencia con el H⁺ importa y es la razon de que este caso se trate
   * aparte: del H⁺ con el cloruro sale HCl, que si es como se escribe.
   */
  if (cation.formula === 'H3O') {
    const acid = `H${anion.formula}`;
    return (
      'El hidronio es un proton HIDRATADO: solo existe en disolucion acuosa, rodeado de moleculas de ' +
      'agua. No forma sales como los demas cationes, y escribirlo pegado a un anion daria una formula ' +
      `que nadie usa. Lo que se escribe para esta combinacion es el ACIDO: usa la fila del ion ` +
      `hidrogeno (H⁺), que da ${acid.replace(/(\\d)/g, '$1')}.`
    );
  }

  return null;
}

/**
 * Construye una combinacion concreta con toda su informacion.
 */
export function combine(cation: Ion, anion: Ion): Combination {
  const impossible = impossibleReason(cation, anion);
  if (impossible) {
    return {
      cation, anion,
      status: 'impossible',
      formula: null, display: null, name: null,
      cationCount: 0, anionCount: 0,
      neutralityCheck: null,
      solubility: 'unknown',
      reason: impossible,
      built: null,
    };
  }

  const result = buildIonicFormula(cation, anion);
  if (!result.ok) {
    return {
      cation, anion,
      status: 'impossible',
      formula: null, display: null, name: null,
      cationCount: 0, anionCount: 0,
      neutralityCheck: null,
      solubility: 'unknown',
      reason: result.error,
      built: null,
    };
  }

  const built = result.value;
  const curated = curatedByComposition().get(compositionKey(built.composition));

  // Cuando la sustancia esta curada, manda su grafia y su nombre de uso: es
  // agua, no "HOH"; es acido sulfurico, no "sulfato de hidrogeno".
  const formula = curated?.formula ?? built.formula;
  const derivedName = nameFormula(formula);

  return {
    cation, anion,
    status: curated ? 'verified' : 'derived',
    formula,
    display: curated ? formatPlainUnicode(curated.formula) : built.display,
    name: curated?.name ?? (derivedName ? preferredName(derivedName) : null),
    cationCount: built.cationCount,
    anionCount: built.anionCount,
    neutralityCheck: built.neutralityCheck,
    solubility: solubilityOf(formula).solubility,
    reason: null,
    built,
  };
}

export interface CombinationTable {
  readonly cations: readonly Ion[];
  readonly anions: readonly Ion[];
  /** Indexada por `comboKey`. */
  readonly cells: ReadonlyMap<string, Combination>;
  readonly counts: {
    readonly total: number;
    readonly verified: number;
    readonly derived: number;
    readonly impossible: number;
  };
}

/**
 * La tabla completa para los iones que se le pasen.
 *
 * Se calcula entera de una vez (2538 celdas en unos 30 ms) en lugar de por
 * demanda: asi los contadores del encabezado son exactos desde el primer
 * fotograma, y filtrar es quedarse con un subconjunto en vez de recalcular.
 */
export function buildCombinationTable(
  cations: readonly Ion[] = CATION_LIST,
  anions: readonly Ion[] = ANION_LIST,
): CombinationTable {
  const cells = new Map<string, Combination>();
  let verified = 0;
  let derived = 0;
  let impossible = 0;

  for (const cation of cations) {
    for (const anion of anions) {
      const combination = combine(cation, anion);
      cells.set(comboKey(cation, anion), combination);
      if (combination.status === 'verified') verified++;
      else if (combination.status === 'derived') derived++;
      else impossible++;
    }
  }

  return {
    cations,
    anions,
    cells,
    counts: { total: cells.size, verified, derived, impossible },
  };
}

export const STATUS_LABEL: Record<ComboStatus, string> = {
  verified: 'Verificada',
  derived: 'Derivada',
  impossible: 'No procede',
};

export const STATUS_NOTE: Record<ComboStatus, string> = {
  verified:
    'La sustancia esta en la base de datos: existe, y su nombre, su solubilidad y sus propiedades ' +
    'son datos, no deducciones.',
  derived:
    'La formula se deduce de las cargas y el nombre de las reglas de nomenclatura. Es la respuesta ' +
    'correcta al ejercicio de formulacion, pero el motor NO afirma que el compuesto exista, sea ' +
    'estable, o se pueda preparar en el laboratorio.',
  impossible:
    'El modelo ionico no se aplica a esta pareja. Se explica el motivo en lugar de mostrar una ' +
    'formula sin sentido.',
};

export const SOLUBILITY_LABEL: Record<Solubility, string> = {
  soluble: 'Soluble en agua',
  'slightly-soluble': 'Poco soluble',
  insoluble: 'Insoluble (precipita)',
  unknown: 'Solubilidad no determinada',
};

export const SOLUBILITY_SHORT: Record<Solubility, string> = {
  soluble: 'sol.',
  'slightly-soluble': 'poco',
  insoluble: 'insol.',
  unknown: '',
};
