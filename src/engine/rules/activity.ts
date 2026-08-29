/**
 * Serie de actividad de los metales y potenciales estandar de reduccion.
 *
 * Decide si una sustitucion simple ocurre (§8): un metal solo desplaza a otro
 * que este POR DEBAJO de el en la serie. Zn desplaza a Cu²⁺, pero Cu no
 * desplaza a Zn²⁺, y saber por que es justo lo que el sandbox debe ensenar.
 *
 * PROCEDENCIA: potenciales estandar de reduccion E° a 298,15 K frente al
 * electrodo estandar de hidrogeno, en voltios (CRC Handbook).
 */

export interface ActivityEntry {
  readonly symbol: string;
  /** Formula del ion que forma habitualmente. */
  readonly ionFormula: string;
  readonly ionCharge: number;
  /** Potencial estandar de reduccion, en voltios. */
  readonly standardPotential: number;
  /** Posicion en la serie: 0 = mas reactivo. */
  readonly rank: number;
}

/**
 * Serie ordenada de MAS reactivo (mas facilmente oxidable, E° mas negativo) a
 * MENOS reactivo. El hidrogeno se incluye porque es la referencia que decide
 * si un metal reacciona con los acidos.
 */
const SERIES: [string, string, number, number][] = [
  // [simbolo, formula del ion, carga, E° de reduccion en V]
  ['Li', 'Li', 1, -3.04],
  ['K', 'K', 1, -2.93],
  ['Ba', 'Ba', 2, -2.91],
  ['Sr', 'Sr', 2, -2.89],
  ['Ca', 'Ca', 2, -2.87],
  ['Na', 'Na', 1, -2.71],
  ['Mg', 'Mg', 2, -2.37],
  ['Al', 'Al', 3, -1.66],
  ['Mn', 'Mn', 2, -1.18],
  ['Zn', 'Zn', 2, -0.76],
  ['Cr', 'Cr', 3, -0.74],
  ['Fe', 'Fe', 2, -0.44],
  ['Cd', 'Cd', 2, -0.40],
  ['Co', 'Co', 2, -0.28],
  ['Ni', 'Ni', 2, -0.25],
  ['Sn', 'Sn', 2, -0.14],
  ['Pb', 'Pb', 2, -0.13],
  ['H', 'H', 1, 0.0],
  ['Cu', 'Cu', 2, 0.34],
  ['Ag', 'Ag', 1, 0.80],
  ['Hg', 'Hg', 2, 0.85],
  ['Pt', 'Pt', 2, 1.19],
  ['Au', 'Au', 3, 1.50],
];

export const ACTIVITY_SERIES: readonly ActivityEntry[] = SERIES.map(
  ([symbol, ionFormula, ionCharge, standardPotential], rank) => ({
    symbol,
    ionFormula,
    ionCharge,
    standardPotential,
    rank,
  }),
);

const BY_SYMBOL = new Map<string, ActivityEntry>(ACTIVITY_SERIES.map((e) => [e.symbol, e]));

export function activityOf(symbol: string): ActivityEntry | undefined {
  return BY_SYMBOL.get(symbol);
}

export interface DisplacementVerdict {
  readonly displaces: boolean;
  /** Diferencia de potencial de la reaccion global, en voltios. */
  readonly cellPotential: number | null;
  readonly explanation: string;
}

/**
 * ¿Desplaza el metal `metal` al ion del metal `other` de su sal?
 *
 * El criterio es el potencial de celda:
 *   E°celda = E°(catodo, el que se reduce) − E°(anodo, el que se oxida)
 * Si sale positivo, la reaccion es espontanea.
 */
export function displaces(metal: string, other: string): DisplacementVerdict {
  const a = BY_SYMBOL.get(metal);
  const b = BY_SYMBOL.get(other);

  if (!a || !b) {
    const unknown = !a ? metal : other;
    return {
      displaces: false,
      cellPotential: null,
      explanation: `No hay datos de potencial estandar para ${unknown}, asi que no se puede decidir si la sustitucion ocurre.`,
    };
  }

  const cellPotential = b.standardPotential - a.standardPotential;
  const yes = cellPotential > 0;

  if (yes) {
    return {
      displaces: true,
      cellPotential,
      explanation:
        `${metal} esta por encima de ${other} en la serie de actividad ` +
        `(E° = ${a.standardPotential.toFixed(2)} V frente a ${b.standardPotential.toFixed(2)} V), ` +
        `luego cede electrones con mas facilidad y reduce al ion ${other}. ` +
        `El potencial de la reaccion es E° = ${b.standardPotential.toFixed(2)} − (${a.standardPotential.toFixed(2)}) = +${cellPotential.toFixed(2)} V, positivo, luego es espontanea.`,
    };
  }

  return {
    displaces: false,
    cellPotential,
    explanation:
      `${metal} esta por DEBAJO de ${other} en la serie de actividad ` +
      `(E° = ${a.standardPotential.toFixed(2)} V frente a ${b.standardPotential.toFixed(2)} V). ` +
      `El potencial seria E° = ${cellPotential.toFixed(2)} V, negativo: la reaccion no ocurre en ese sentido. ` +
      `Si ocurriria la inversa, con ${other} desplazando a ${metal}.`,
  };
}

/** ¿Reacciona el metal con un acido desprendiendo hidrogeno? */
export function reactsWithAcid(metal: string): DisplacementVerdict {
  const verdict = displaces(metal, 'H');
  if (verdict.cellPotential === null) return verdict;
  if (verdict.displaces) {
    return {
      ...verdict,
      explanation:
        `${metal} esta por encima del hidrogeno en la serie de actividad, luego desplaza al H⁺ del acido y se desprende H₂ gaseoso. ` +
        `E° = +${verdict.cellPotential.toFixed(2)} V.`,
    };
  }
  return {
    ...verdict,
    explanation:
      `${metal} esta por debajo del hidrogeno en la serie de actividad, luego NO desplaza al H⁺ de un acido no oxidante: no hay reaccion con HCl diluido. ` +
      `(Con acidos oxidantes como el HNO3 la historia es distinta, porque alli el oxidante no es el H⁺ sino el nitrato.)`,
  };
}

/**
 * Serie de actividad de los halogenos, para las sustituciones simples de no
 * metales: F₂ > Cl₂ > Br₂ > I₂. Un halogeno desplaza a los que estan por
 * debajo de su sal.
 */
const HALOGEN_SERIES: [string, number][] = [
  ['F', 2.87],
  ['Cl', 1.36],
  ['Br', 1.07],
  ['I', 0.54],
];

const HALOGEN_POTENTIAL = new Map<string, number>(HALOGEN_SERIES);

export function halogenDisplaces(halogen: string, other: string): DisplacementVerdict {
  const a = HALOGEN_POTENTIAL.get(halogen);
  const b = HALOGEN_POTENTIAL.get(other);
  if (a === undefined || b === undefined) {
    return {
      displaces: false,
      cellPotential: null,
      explanation: 'No hay datos de potencial para alguno de los dos halogenos.',
    };
  }
  const cellPotential = a - b;
  if (cellPotential > 0) {
    return {
      displaces: true,
      cellPotential,
      explanation:
        `${halogen}₂ es mas oxidante que ${other}₂ (E° = ${a.toFixed(2)} V frente a ${b.toFixed(2)} V), ` +
        `luego arranca los electrones al ion ${other}⁻ y lo desplaza de su sal. E° = +${cellPotential.toFixed(2)} V.`,
    };
  }
  return {
    displaces: false,
    cellPotential,
    explanation:
      `${halogen}₂ es menos oxidante que ${other}₂, luego no puede desplazarlo. La reaccion espontanea es la inversa.`,
  };
}

export function isInActivitySeries(symbol: string): boolean {
  return BY_SYMBOL.has(symbol);
}

export function isHalogen(symbol: string): boolean {
  return HALOGEN_POTENTIAL.has(symbol);
}
