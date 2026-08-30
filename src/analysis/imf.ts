/**
 * INTERMOLECULAR FORCES (§29, §30, §31).
 *
 * Es el escalon que conecta la ESTRUCTURA con lo que se ve en el laboratorio.
 * Toda la cadena anterior (Lewis, geometria, polaridad) no explica por si sola
 * por que el agua hierve a 100 °C y el sulfuro de hidrogeno, mas pesado, a
 * −60 °C. Lo explica esto.
 *
 * LA DISTINCION QUE MAS SE CONFUNDE
 * Las fuerzas intermoleculares NO son enlaces. Un enlace covalente O–H cuesta
 * unos 460 kJ/mol romperlo; un puente de hidrogeno entre dos aguas, unos 20.
 * Cuando el agua hierve NO se rompe ningun enlace O–H: se separan las
 * moleculas unas de otras. Las moleculas de vapor de agua siguen siendo H2O.
 *
 * QUE NO SE INVENTA (§32)
 * Este modulo NO estima puntos de ebullicion. Predice el ORDEN relativo entre
 * especies comparables, que es lo que las fuerzas intermoleculares determinan,
 * y dice explicitamente que la cifra concreta es un dato experimental.
 */

import type { LewisStructure } from './lewis.js';
import type { PolarityResult } from './polarity.js';
import { getElement } from '../data/elements.js';

export type ForceKind =
  /** Siempre presentes: dipolos instantaneos por fluctuacion de la nube electronica. */
  | 'dispersion'
  /** Entre moleculas polares permanentes. */
  | 'dipolo-dipolo'
  /** Caso extremo del anterior, con H unido a N, O o F. */
  | 'puente-hidrogeno'
  /** Entre un ion y una molecula polar: disolucion de sales. */
  | 'ion-dipolo';

export interface Force {
  readonly kind: ForceKind;
  readonly present: boolean;
  /** Fuerza relativa 1..4; solo sirve para ordenar, no es una energia. */
  readonly relativeStrength: number;
  readonly because: string;
}

export interface ImfResult {
  readonly forces: readonly Force[];
  /** La que domina el comportamiento de la sustancia. */
  readonly dominant: Force | null;
  /** Numero de electrones: es lo que gobierna la dispersion. */
  readonly electronCount: number;
  readonly molarMass: number;
  /** Sitios donadores de puente de hidrogeno (H unido a N, O o F). */
  readonly hydrogenBondDonors: number;
  /** Sitios aceptores (pares libres sobre N, O o F). */
  readonly hydrogenBondAcceptors: number;
  readonly steps: readonly { readonly n: number; readonly text: string; readonly math?: string }[];
  readonly consequences: readonly { readonly property: string; readonly prediction: string }[];
  readonly caution: string;
}

const CAUTION =
  'Las fuerzas intermoleculares NO son enlaces. Romper un enlace covalente O–H cuesta unos ' +
  '460 kJ/mol; separar dos moleculas de agua unidas por un puente de hidrogeno, unos 20. Cuando ' +
  'el agua hierve no se rompe ningun enlace O–H: las moleculas se separan unas de otras y siguen ' +
  'siendo H2O. Confundir las dos cosas lleva a creer que hervir agua la descompone.';

/** Elementos suficientemente electronegativos y pequenos para el puente de hidrogeno. */
const HYDROGEN_BOND_ELEMENTS = new Set(['N', 'O', 'F']);

export function analyzeIntermolecularForces(
  structure: LewisStructure,
  polarity: PolarityResult,
): ImfResult {
  const electronCount = structure.atoms.reduce(
    (sum, atom) => sum + (getElement(atom.symbol)?.Z ?? 0),
    0,
  ) - structure.charge;

  const molarMass = structure.atoms.reduce(
    (sum, atom) => sum + (getElement(atom.symbol)?.atomicMass ?? 0),
    0,
  );

  /*
   * Donador de puente de hidrogeno: un H unido DIRECTAMENTE a N, O o F.
   *
   * El matiz importa: el CH4 tiene cuatro hidrogenos y no forma ni uno. Hace
   * falta que el atomo al que el H esta unido sea muy electronegativo y muy
   * pequeno, para que el H quede casi como un proton desnudo.
   */
  const hydrogenBondDonors = structure.bonds.filter((bond) => {
    const a = structure.atoms[bond.a]!;
    const b = structure.atoms[bond.b]!;
    return (
      (a.symbol === 'H' && HYDROGEN_BOND_ELEMENTS.has(b.symbol)) ||
      (b.symbol === 'H' && HYDROGEN_BOND_ELEMENTS.has(a.symbol))
    );
  }).length;

  const hydrogenBondAcceptors = structure.atoms
    .filter((atom) => HYDROGEN_BOND_ELEMENTS.has(atom.symbol))
    .reduce((sum, atom) => sum + atom.lonePairs, 0);

  const isIon = structure.charge !== 0;
  const hasHydrogenBonding = hydrogenBondDonors > 0 && hydrogenBondAcceptors > 0;

  const forces: Force[] = [
    {
      kind: 'dispersion',
      present: true,
      relativeStrength: 1,
      because:
        'Presentes SIEMPRE, en toda sustancia sin excepcion. La nube electronica fluctua y crea ' +
        'dipolos instantaneos que inducen otros en las moleculas vecinas. Aumentan con el numero de ' +
        `electrones: esta especie tiene ${electronCount}. Es la razon de que el yodo sea solido y el ` +
        'fluor un gas, siendo los dos moleculas apolares.',
    },
    {
      kind: 'dipolo-dipolo',
      present: polarity.isPolar && !isIon,
      relativeStrength: 2,
      because: polarity.isPolar
        ? 'La molecula tiene un dipolo permanente, asi que el extremo δ+ de una atrae al δ− de la ' +
          'siguiente. Es una atraccion adicional a la dispersion, que sigue estando.'
        : 'La molecula es apolar: no hay dipolo permanente que atraiga a los vecinos.',
    },
    {
      kind: 'puente-hidrogeno',
      present: hasHydrogenBonding,
      relativeStrength: 3,
      because: hasHydrogenBonding
        ? `Hay ${hydrogenBondDonors} hidrogeno${hydrogenBondDonors === 1 ? '' : 's'} unido${hydrogenBondDonors === 1 ? '' : 's'} ` +
          `directamente a N, O o F, y ${hydrogenBondAcceptors} par${hydrogenBondAcceptors === 1 ? '' : 'es'} libre${hydrogenBondAcceptors === 1 ? '' : 's'} ` +
          'sobre atomos de ese tipo que pueden recibirlos. Es el caso extremo del dipolo-dipolo: el ' +
          'hidrogeno, sin electrones internos que lo apantallen, queda casi como un proton desnudo.'
        : hydrogenBondDonors === 0
          ? 'No hay ningun hidrogeno unido directamente a N, O o F. (El CH4 tiene cuatro hidrogenos ' +
            'y no forma ni un puente: el carbono no es lo bastante electronegativo.)'
          : 'Hay hidrogenos sobre N, O o F, pero no quedan pares libres que puedan aceptarlos.',
    },
    {
      kind: 'ion-dipolo',
      present: isIon,
      relativeStrength: 4,
      because: isIon
        ? `La especie tiene carga ${structure.charge > 0 ? '+' : ''}${structure.charge}. Frente a un disolvente polar ` +
          'como el agua, la atraccion ion-dipolo es la interaccion dominante, y es la que explica que ' +
          'las sales se disuelvan.'
        : 'La especie es neutra: no hay ion que atraer.',
    },
  ];

  const present = forces.filter((f) => f.present);
  const dominant = present.reduce<Force | null>(
    (best, f) => (best === null || f.relativeStrength > best.relativeStrength ? f : best),
    null,
  );

  const steps: { n: number; text: string; math?: string }[] = [
    {
      n: 1,
      text:
        'Las fuerzas de dispersion de London estan siempre. Su intensidad depende del numero de ' +
        'electrones y de lo deformable que sea la nube electronica.',
      math: `${electronCount} electrones · masa molar ≈ ${molarMass.toFixed(2)} g/mol`,
    },
    {
      n: 2,
      text: polarity.isPolar
        ? 'Como la molecula resulto POLAR en el paso anterior, se suman las fuerzas dipolo-dipolo.'
        : 'Como la molecula resulto APOLAR, no hay fuerzas dipolo-dipolo: solo dispersion.',
    },
    {
      n: 3,
      text: hasHydrogenBonding
        ? 'Ademas hay puentes de hidrogeno, que son con diferencia las mas intensas de las fuerzas ' +
          'intermoleculares habituales.'
        : 'No se cumplen las condiciones del puente de hidrogeno.',
    },
    {
      n: 4,
      text: dominant
        ? `La fuerza DOMINANTE es ${dominant.kind}. Es la que decide el comportamiento macroscopico: ` +
          'punto de ebullicion, solubilidad y viscosidad.'
        : 'No se ha identificado ninguna fuerza dominante.',
    },
  ];

  const consequences: { property: string; prediction: string }[] = [];

  if (hasHydrogenBonding) {
    consequences.push({
      property: 'Punto de ebullicion',
      prediction:
        'ANORMALMENTE ALTO para su masa molar. Es la anomalia del agua: con 18 g/mol deberia hervir ' +
        'muy por debajo de cero, como el H2S (34 g/mol, hierve a −60 °C). Hierve a 100 °C porque hay ' +
        'que romper una red de puentes de hidrogeno.',
    });
    consequences.push({
      property: 'Solubilidad',
      prediction: 'Muy soluble en agua y en otros disolventes capaces de formar puentes de hidrogeno.',
    });
  } else if (polarity.isPolar) {
    consequences.push({
      property: 'Punto de ebullicion',
      prediction:
        'Mas alto que el de una molecula apolar de masa parecida, porque hay que vencer la atraccion ' +
        'entre dipolos permanentes ademas de la dispersion.',
    });
    consequences.push({
      property: 'Solubilidad',
      prediction: 'Soluble en disolventes polares. "Lo semejante disuelve a lo semejante".',
    });
  } else {
    consequences.push({
      property: 'Punto de ebullicion',
      prediction:
        'Bajo para su masa molar: solo hay que vencer fuerzas de dispersion. Dentro de una familia ' +
        'de apolares, sube al aumentar el numero de electrones.',
    });
    consequences.push({
      property: 'Solubilidad',
      prediction:
        'Soluble en disolventes apolares (hexano, tetracloruro de carbono) e insoluble o poco soluble en agua.',
    });
  }

  if (isIon) {
    consequences.push({
      property: 'Comportamiento en disolucion',
      prediction:
        'Como especie cargada, en agua queda rodeada por moleculas de disolvente orientadas hacia su ' +
        'carga (solvatacion). Es lo que hace conductora a una disolucion de sal.',
    });
  }

  return {
    forces,
    dominant,
    electronCount,
    molarMass,
    hydrogenBondDonors,
    hydrogenBondAcceptors,
    steps,
    consequences,
    caution: CAUTION,
  };
}

/**
 * Compara dos especies y predice cual hierve a mayor temperatura (§31).
 *
 * Devuelve null cuando el criterio no decide: si una gana en un factor y
 * pierde en otro, decir "no se puede predecir con este modelo" es la respuesta
 * correcta, y es preferible a jugarselo a una regla.
 */
export function compareBoilingPoint(
  a: { readonly name: string; readonly imf: ImfResult; readonly polar: boolean },
  b: { readonly name: string; readonly imf: ImfResult; readonly polar: boolean },
): { readonly higher: string; readonly because: string } | null {
  const strengthOf = (x: ImfResult): number => x.dominant?.relativeStrength ?? 0;

  // 1. Gana quien tenga la fuerza dominante mas intensa.
  if (strengthOf(a.imf) !== strengthOf(b.imf)) {
    const winner = strengthOf(a.imf) > strengthOf(b.imf) ? a : b;
    const loser = winner === a ? b : a;
    return {
      higher: winner.name,
      because:
        `${winner.name} tiene ${winner.imf.dominant?.kind} como fuerza dominante y ${loser.name} solo ` +
        `${loser.imf.dominant?.kind}. Hace falta mas energia para separar sus moleculas.`,
    };
  }

  // 2. Con la misma clase de fuerza, decide el numero de electrones.
  const da = a.imf.electronCount;
  const db = b.imf.electronCount;
  if (da !== db) {
    const winner = da > db ? a : b;
    const loser = winner === a ? b : a;
    return {
      higher: winner.name,
      because:
        `Las dos tienen el mismo tipo de fuerza dominante, asi que decide la dispersion: ` +
        `${winner.name} tiene ${winner.imf.electronCount} electrones frente a ${loser.imf.electronCount}. ` +
        'Mas electrones, nube mas deformable, dispersion mas intensa.',
    };
  }

  return null;
}
