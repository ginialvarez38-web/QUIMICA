/**
 * HYBRIDIZATION + GEOMETRY (§16, §17, §18, §19, §20).
 *
 * Toma la estructura de Lewis ya derivada y saca de ella el numero esterico,
 * la hibridacion, la geometria electronica y la geometria molecular. No
 * consulta ninguna tabla de moleculas: todo sale del recuento de regiones de
 * densidad electronica alrededor de cada atomo.
 *
 * QUE ES Y QUE NO ES LA HIBRIDACION (§59)
 * La hibridacion es un ARTEFACTO MATEMATICO. No es un proceso que le ocurra al
 * atomo: nadie ha visto un carbono "hibridarse" antes de enlazarse. Es una
 * combinacion lineal de orbitales atomicos que se elige porque reproduce bien
 * las direcciones de los enlaces observados. Es util y es el lenguaje estandar
 * de la quimica organica, pero describir la hibridacion como algo que el atomo
 * "hace" es exactamente el error que el §59 pide no cometer.
 *
 * Este modulo etiqueta la hibridacion como 'educational', no como 'calculated'.
 */

import type { LewisStructure } from './lewis.js';
import { vsepr } from '../geometry/vsepr.js';
import type { VseprResult } from '../geometry/vsepr.js';
import { getElement } from '../data/elements.js';

export type Hybridization = 'sp' | 'sp²' | 'sp³' | 'sp³d' | 'sp³d²' | 'sin hibridar' | 'no aplicable';

export interface AtomGeometry {
  readonly atomId: string;
  readonly symbol: string;
  readonly index: number;
  /** Regiones de densidad electronica: enlaces (cuenten como uno) + pares libres. */
  readonly stericNumber: number;
  readonly bondedAtoms: number;
  readonly lonePairs: number;
  readonly hybridization: Hybridization;
  /** Como se obtiene: "4 regiones → un orbital s + tres p → sp³". */
  readonly hybridizationDerivation: string;
  readonly vsepr: VseprResult | null;
  /** Enlaces sigma que salen del atomo. */
  readonly sigmaBonds: number;
  /** Enlaces pi que salen del atomo. */
  readonly piBonds: number;
  /** Orbitales p sin hibridar que quedan disponibles para el sistema pi. */
  readonly unhybridizedP: number;
}

export interface GeometryResult {
  /** Analisis del atomo central. */
  readonly central: AtomGeometry | null;
  /** Analisis de todos los atomos que tienen mas de un vecino o pares libres. */
  readonly atoms: readonly AtomGeometry[];
  /** Forma de la especie entera, ya resuelta la ambiguedad de las diatomicas. */
  readonly shape: string;
  readonly sigmaBonds: number;
  readonly piBonds: number;
  readonly steps: readonly { readonly n: number; readonly text: string; readonly math?: string }[];
  readonly caution: string;
}

const HYBRID_BY_STERIC: Record<number, { hybrid: Hybridization; orbitals: string }> = {
  1: { hybrid: 'sin hibridar', orbitals: 'un unico enlace no exige mezclar orbitales' },
  2: { hybrid: 'sp', orbitals: 'un orbital s + un orbital p' },
  3: { hybrid: 'sp²', orbitals: 'un orbital s + dos orbitales p' },
  4: { hybrid: 'sp³', orbitals: 'un orbital s + tres orbitales p' },
  5: { hybrid: 'sp³d', orbitals: 'un orbital s + tres p + un d' },
  6: { hybrid: 'sp³d²', orbitals: 'un orbital s + tres p + dos d' },
};

const HYBRIDIZATION_CAUTION =
  'La hibridacion es un MODELO, no un suceso. El atomo no "se hibrida" antes de enlazarse: se ' +
  'llama hibridacion a una combinacion matematica de orbitales atomicos que se elige porque ' +
  'reproduce las direcciones de enlace que se observan. Explica muy bien la geometria y es el ' +
  'lenguaje habitual de la quimica organica, pero no describe un proceso fisico. Para los ' +
  'elementos del periodo 3 en adelante (sp³d, sp³d²) el propio modelo es discutido: los calculos ' +
  'modernos indican que la participacion de los orbitales d es mucho menor de lo que sugiere el ' +
  'nombre.';

/**
 * Numero de regiones de densidad electronica de un atomo.
 *
 * Un enlace multiple cuenta como UNA region, no como dos ni como tres: los
 * electrones pi ocupan el mismo espacio angular que el sigma que acompanan. Es
 * la razon por la que el CO2, con dos dobles enlaces, es lineal y no otra cosa.
 */
function stericNumber(bondedAtoms: number, lonePairs: number): number {
  return bondedAtoms + lonePairs;
}

function analyzeAtom(structure: LewisStructure, index: number): AtomGeometry {
  const atom = structure.atoms[index]!;
  const incident = structure.bonds.filter((b) => b.a === index || b.b === index);
  const bondedAtoms = incident.length;
  const steric = stericNumber(bondedAtoms, atom.lonePairs);

  // Sigma: uno por vecino. Pi: los ordenes que sobrepasan el primero.
  const sigmaBonds = bondedAtoms;
  const piBonds = incident.reduce((sum, b) => sum + (b.order - 1), 0);

  const entry = HYBRID_BY_STERIC[steric];
  const element = getElement(atom.symbol);
  const canUseD = element !== undefined && element.period >= 3;

  let hybrid: Hybridization = entry?.hybrid ?? 'no aplicable';
  let derivation: string;

  if (atom.symbol === 'H') {
    hybrid = 'no aplicable';
    derivation =
      'El hidrogeno solo tiene un orbital 1s. No hay nada que mezclar, asi que no se le asigna hibridacion.';
  } else if (steric === 0) {
    hybrid = 'no aplicable';
    derivation = 'Sin enlaces ni pares libres no hay geometria que describir.';
  } else if (steric >= 5 && !canUseD) {
    hybrid = 'no aplicable';
    derivation =
      `${atom.symbol} esta en el periodo 2 y no dispone de orbitales d: no puede alcanzar ${steric} regiones.`;
  } else {
    derivation =
      `${steric} region${steric === 1 ? '' : 'es'} de densidad electronica ` +
      `(${bondedAtoms} enlace${bondedAtoms === 1 ? '' : 's'}${atom.lonePairs > 0 ? ` + ${atom.lonePairs} par${atom.lonePairs === 1 ? '' : 'es'} libre${atom.lonePairs === 1 ? '' : 's'}` : ''}) ` +
      `exigen ${steric} orbitales equivalentes que apunten en direcciones distintas. ` +
      `Mezclando ${entry?.orbitals} salen exactamente ${steric}: ${hybrid}.`;
  }

  /*
   * Orbitales p que quedan sin mezclar.
   *
   * Son los que forman los enlaces pi. Un carbono sp² conserva un p, y ese p
   * es el que hace el doble enlace; un carbono sp conserva dos, y de ahi salen
   * los dos pi del triple. Que la cuenta cuadre con los pi contados a partir
   * del orden de enlace es una comprobacion interna del modelo.
   */
  const unhybridizedP =
    hybrid === 'sp' ? 2 : hybrid === 'sp²' ? 1 : 0;

  return {
    atomId: atom.id,
    symbol: atom.symbol,
    index,
    stericNumber: steric,
    bondedAtoms,
    lonePairs: atom.lonePairs,
    hybridization: hybrid,
    hybridizationDerivation: derivation,
    vsepr: bondedAtoms > 0 && steric >= 2 && steric <= 6 ? vsepr(bondedAtoms, atom.lonePairs) : null,
    sigmaBonds,
    piBonds,
    unhybridizedP,
  };
}

export function analyzeGeometry(structure: LewisStructure): GeometryResult {
  const atoms = structure.atoms
    .map((_, index) => analyzeAtom(structure, index))
    .filter((a) => a.symbol !== 'H');

  const central =
    structure.centralIndex >= 0
      ? (atoms.find((a) => a.index === structure.centralIndex) ?? null)
      : null;

  const sigmaBonds = structure.bonds.length;
  const piBonds = structure.bonds.reduce((sum, b) => sum + (b.order - 1), 0);

  /*
   * Forma de la especie entera.
   *
   * Con dos atomos la pregunta no tiene contenido: dos puntos definen una
   * recta, haya los pares libres que haya. VSEPR devuelve ahi una etiqueta que
   * no significa nada, asi que se resuelve antes de mirarla.
   */
  const shape =
    structure.atoms.length === 1
      ? 'Atomo o ion aislado: no hay geometria que describir.'
      : structure.atoms.length === 2
        ? 'Lineal por definicion: dos atomos siempre estan alineados.'
        : (central?.vsepr?.geometry ?? 'No determinada por este modelo.');

  const steps: { n: number; text: string; math?: string }[] = [];

  if (structure.atoms.length === 2) {
    steps.push({
      n: 1,
      text:
        'Con solo dos atomos la geometria no depende de nada: dos puntos definen una recta. ' +
        'La molecula es lineal siempre, tenga los pares libres que tenga.',
    });
  } else if (central) {
    steps.push({
      n: 1,
      text:
        'Se cuentan las REGIONES de densidad electronica alrededor del atomo central. Un enlace ' +
        'multiple cuenta como una sola region: los electrones pi ocupan el mismo espacio angular ' +
        'que el sigma al que acompanan. Es la razon de que el CO2, con dos dobles enlaces, sea lineal.',
      math: `${central.bondedAtoms} enlace(s) + ${central.lonePairs} par(es) libre(s) = numero esterico ${central.stericNumber}`,
    });
    steps.push({ n: 2, text: central.hybridizationDerivation });

    if (central.vsepr) {
      steps.push({
        n: 3,
        text:
          `Las ${central.stericNumber} regiones se separan lo maximo posible: eso da la GEOMETRIA ` +
          `ELECTRONICA, que es ${central.vsepr.electronGeometry}.`,
        math: `Notacion AXE: ${central.vsepr.axeNotation}`,
      });
      steps.push({
        n: 4,
        text:
          central.lonePairs > 0
            ? `La GEOMETRIA MOLECULAR describe solo donde estan los ATOMOS, y los ${central.lonePairs} ` +
              `par${central.lonePairs === 1 ? '' : 'es'} libre${central.lonePairs === 1 ? '' : 's'} no se ve${central.lonePairs === 1 ? '' : 'n'}. ` +
              `Quitandolo${central.lonePairs === 1 ? '' : 's'} del dibujo queda: ${central.vsepr.geometry}.`
            : `Sin pares libres, la geometria molecular coincide con la electronica: ${central.vsepr.geometry}.`,
        math: `Angulo previsto ≈ ${central.vsepr.idealAngle}°`,
      });

      if (central.lonePairs > 0) {
        steps.push({
          n: 5,
          text:
            'Los pares libres empujan mas que los pares enlazantes, porque solo estan sujetos a un ' +
            `nucleo y se extienden mas. Por eso el angulo real (${central.vsepr.idealAngle}°) es MENOR ` +
            'que el de la geometria electronica sin pares libres.',
        });
      }
    }

    if (piBonds > 0) {
      steps.push({
        n: steps.length + 1,
        text:
          `De los ${sigmaBonds + piBonds} pares enlazantes, ${sigmaBonds} forman enlaces SIGMA (solapamiento ` +
          `frontal, sobre el eje que une los nucleos) y ${piBonds} forman enlaces PI (solapamiento lateral ` +
          'de orbitales p sin hibridar, por encima y por debajo del eje). Un enlace pi impide el giro ' +
          'en torno al enlace, que es el origen de la isomeria cis/trans.',
      });
    }
  }

  return { central, atoms, shape, sigmaBonds, piBonds, steps, caution: HYBRIDIZATION_CAUTION };
}
