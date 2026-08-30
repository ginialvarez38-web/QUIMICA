/**
 * RESONANCE ENGINE (§14, §15, §26).
 *
 * QUE PROBLEMA RESUELVE
 * La estructura de Lewis del nitrato coloca un doble enlace en UNO de los tres
 * oxigenos. Pero los tres enlaces N–O del nitrato miden lo mismo (1,24 A). La
 * estructura de Lewis, tomada al pie de la letra, es FALSA.
 *
 * La resonancia es el parche que el modelo de Lewis se pone a si mismo: si
 * varias estructuras equivalentes son igual de buenas y solo se distinguen en
 * DONDE estan los electrones pi, entonces ninguna de ellas es la molecula. La
 * molecula es una sola cosa intermedia, el hibrido, y los electrones estan
 * deslocalizados.
 *
 * ADVERTENCIA QUE ESTE MODULO EMITE SIEMPRE (§59)
 * La molecula NO oscila entre las estructuras. No pasa un tercio del tiempo en
 * cada una. Las estructuras de resonancia son limitaciones de nuestra NOTACION,
 * no estados por los que la molecula pase. Es el malentendido mas extendido
 * sobre este tema y el motor lo dice explicitamente.
 *
 * COMO SE DETECTA
 * No se busca la resonancia en una tabla: se deduce del propio motor de Lewis.
 * Si varias estructuras validas empatan en la mejor puntuacion y difieren solo
 * en la permutacion de ordenes de enlace entre atomos terminales del mismo
 * elemento, eso ES resonancia. La consecuencia util es que funciona para
 * cualquier especie, no solo para las que alguien haya catalogado.
 */

import type { LewisResult, LewisStructure } from './lewis.js';
import { structureScore } from './lewis.js';

export interface ResonanceBond {
  /** Indices de los atomos que une. */
  readonly a: number;
  readonly b: number;
  /** Etiqueta legible: "N1–O2". */
  readonly label: string;
  /** Ordenes que toma este enlace en cada estructura contribuyente. */
  readonly orders: readonly number[];
  /** Orden de enlace del hibrido: la media de los anteriores. */
  readonly averageOrder: number;
  /** Si el orden cambia entre estructuras, el enlace participa en la deslocalizacion. */
  readonly delocalized: boolean;
}

export interface ResonanceResult {
  readonly hasResonance: boolean;
  /** Las estructuras que contribuyen, todas con el mismo peso. */
  readonly contributors: readonly LewisStructure[];
  /** Cuantas son. */
  readonly count: number;
  /** Orden de enlace promedio, enlace a enlace. */
  readonly bonds: readonly ResonanceBond[];
  /** Numero de electrones pi deslocalizados sobre el sistema. */
  readonly delocalizedElectrons: number;
  /** Atomos sobre los que se reparte la carga. */
  readonly chargeSharedBy: readonly string[];
  /**
   * Estabilizacion por resonancia, en terminos cualitativos.
   * NO se da un numero: la energia de resonancia es experimental y depende de
   * la especie. Inventar un valor seria exactamente lo que el §32 prohibe.
   */
  readonly stabilization: string;
  readonly explanation: string;
  /** La advertencia del §59, siempre presente cuando hay resonancia. */
  readonly caution: string;
  readonly steps: readonly { readonly n: number; readonly text: string; readonly math?: string }[];
}

const CAUTION =
  'La molecula NO salta de una estructura a otra ni pasa parte del tiempo en cada una. ' +
  'Las estructuras de resonancia son una limitacion de la NOTACION de Lewis, que solo sabe ' +
  'dibujar pares de electrones en sitios concretos. La molecula real es una sola cosa: el ' +
  'hibrido, con los electrones repartidos por igual.';

/**
 * Huella de una estructura para reconocer permutaciones.
 *
 * Dos estructuras son la MISMA salvo por el nombre de los atomos si, al
 * ordenar sus enlaces por (simbolo del terminal, orden), sale la misma lista.
 * Es lo que distingue una permutacion del doble enlace del nitrato de una
 * estructura genuinamente distinta.
 */
function permutationFingerprint(structure: LewisStructure): string {
  return structure.bonds
    .map((b) => {
      const terminal = structure.atoms[b.a === structure.centralIndex ? b.b : b.a]!;
      return `${terminal.symbol}${b.order}`;
    })
    .sort()
    .join('|');
}

function bondLabel(structure: LewisStructure, a: number, b: number): string {
  return `${structure.atoms[a]!.id}–${structure.atoms[b]!.id}`;
}

/** Clave estable de un enlace, independiente del orden en que se listen sus extremos. */
function bondKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/**
 * Analiza la resonancia de una especie a partir de su analisis de Lewis.
 *
 * El criterio es doble y ambas condiciones importan:
 *   1. Varias estructuras deben EMPATAR en puntuacion. Una estructura peor no
 *      contribuye al hibrido de forma apreciable, y contarla falsearia el
 *      orden de enlace promedio.
 *   2. Deben ser permutaciones unas de otras. Si difieren en algo mas que en
 *      donde esta el doble enlace, no son formas resonantes equivalentes.
 */
export function analyzeResonance(lewis: LewisResult): ResonanceResult {
  const best = lewis.best;
  const bestScore = structureScore(best);
  const fingerprint = permutationFingerprint(best);

  // Empatan en puntuacion y son permutaciones de la mejor.
  const contributors = lewis.alternatives.filter(
    (s) =>
      Math.abs(structureScore(s) - bestScore) < 1e-9 &&
      permutationFingerprint(s) === fingerprint,
  );

  const bondMap = new Map<string, { a: number; b: number; orders: number[] }>();
  for (const bond of best.bonds) {
    bondMap.set(bondKey(bond.a, bond.b), { a: bond.a, b: bond.b, orders: [] });
  }
  for (const structure of contributors) {
    for (const bond of structure.bonds) {
      bondMap.get(bondKey(bond.a, bond.b))?.orders.push(bond.order);
    }
  }

  const bonds: ResonanceBond[] = [...bondMap.values()].map((entry) => {
    const average = entry.orders.reduce((sum, o) => sum + o, 0) / (entry.orders.length || 1);
    return {
      a: entry.a,
      b: entry.b,
      label: bondLabel(best, entry.a, entry.b),
      orders: entry.orders,
      averageOrder: average,
      delocalized: new Set(entry.orders).size > 1,
    };
  });

  const delocalizedBonds = bonds.filter((b) => b.delocalized);
  const hasResonance = contributors.length > 1 && delocalizedBonds.length > 1;

  if (!hasResonance) {
    return {
      hasResonance: false,
      contributors: [best],
      count: 1,
      bonds,
      delocalizedElectrons: 0,
      chargeSharedBy: [],
      stabilization: 'Sin resonancia: no hay estabilizacion adicional por deslocalizacion.',
      explanation:
        'Una sola estructura de Lewis describe la especie. Ningun par de electrones puede ' +
        'situarse en dos sitios distintos dando estructuras igual de buenas.',
      caution: '',
      steps: [],
    };
  }

  /*
   * Electrones pi deslocalizados.
   *
   * Cada enlace del sistema tiene, en el hibrido, un orden promedio que excede
   * en (media − minimo) al de un enlace simple. Sumado sobre todos los enlaces
   * del sistema y multiplicado por dos, eso es exactamente el numero de
   * electrones pi que el hibrido reparte.
   *
   * Comprobado: nitrato 2 (un par pi sobre tres enlaces), sulfato 4,
   * perclorato 6. Coincide con contar los enlaces multiples de una estructura
   * contribuyente, que es como debe ser: la deslocalizacion redistribuye esos
   * electrones, no los crea.
   */
  const piElectrons = Math.round(
    delocalizedBonds.reduce((sum, b) => sum + (b.averageOrder - Math.min(...b.orders)), 0) * 2,
  );

  /*
   * La carga se reparte solo sobre los atomos cuya carga formal CAMBIA de una
   * estructura a otra. El nitrogeno del nitrato lleva +1 en las tres: esa
   * carga no esta deslocalizada, esta fija. Los tres oxigenos alternan entre
   * 0 y −1, y esos si comparten.
   */
  const chargeSharedBy = best.atoms
    .filter((atom) => {
      const charges = new Set(contributors.map((s) => s.atoms[atom.index]!.formalCharge));
      return charges.size > 1;
    })
    .map((atom) => atom.id);

  const centralSymbol = best.atoms[best.centralIndex]?.symbol ?? '?';
  const averages = [...new Set(delocalizedBonds.map((b) => b.averageOrder))];
  const averageText = averages.map((a) => a.toFixed(2).replace(/\.?0+$/, '')).join(', ');

  const steps = [
    {
      n: 1,
      text:
        `El motor encontro ${contributors.length} estructuras de Lewis igual de buenas: misma suma de ` +
        'cargas formales, mismo reparto, y se distinguen solo en cual de los enlaces equivalentes ' +
        'lleva el enlace multiple.',
    },
    {
      n: 2,
      text:
        'Cuando varias estructuras equivalentes empatan, ninguna es la molecula. Los electrones no ' +
        `estan en un enlace concreto: estan repartidos sobre los ${delocalizedBonds.length} enlaces a la vez.`,
    },
    {
      n: 3,
      text: 'El orden de enlace del hibrido es la media de los ordenes en las estructuras contribuyentes.',
      math: delocalizedBonds
        .slice(0, 1)
        .map(
          (b) =>
            `orden(${b.label}) = (${b.orders.join(' + ')}) / ${b.orders.length} = ${b.averageOrder.toFixed(2)}`,
        )
        .join('  '),
    },
    {
      n: 4,
      text:
        'Consecuencia medible (§26): los enlaces implicados tienen TODOS la misma longitud, ' +
        'intermedia entre la de un enlace simple y la de uno doble. Es la comprobacion ' +
        'experimental de que la deslocalizacion existe.',
    },
  ];

  return {
    hasResonance: true,
    contributors,
    count: contributors.length,
    bonds,
    delocalizedElectrons: piElectrons,
    chargeSharedBy,
    stabilization:
      `El hibrido es MAS ESTABLE que cualquiera de las ${contributors.length} estructuras por separado. ` +
      'Repartir los electrones sobre varios atomos baja la energia. Cuanto mayor es el numero de ' +
      'estructuras equivalentes, mayor la estabilizacion. (La magnitud concreta es un dato ' +
      'experimental que este motor no estima.)',
    explanation:
      `Hay ${contributors.length} estructuras de resonancia equivalentes. Los ${delocalizedBonds.length} enlaces ` +
      `alrededor del ${centralSymbol} son IDENTICOS entre si, con orden de enlace ${averageText}: ` +
      'ni simples ni dobles, sino intermedios.' +
      (chargeSharedBy.length > 0
        ? ` La carga tampoco esta sobre un atomo concreto: se reparte entre ${chargeSharedBy.join(', ')}.`
        : ''),
    caution: CAUTION,
    steps,
  };
}

/**
 * Reglas para juzgar cual de varias estructuras NO equivalentes contribuye mas
 * al hibrido (§15). Se aplica cuando las estructuras difieren en calidad.
 */
export function contributionRules(): readonly { readonly rule: string; readonly why: string }[] {
  return [
    {
      rule: 'Contribuye mas la estructura con las cargas formales mas pequenas.',
      why: 'Separar carga cuesta energia: una estructura sin cargas es mas estable que una con +1 y −1.',
    },
    {
      rule: 'Con la misma separacion de carga, contribuye mas la que pone la carga negativa sobre el atomo mas electronegativo.',
      why: 'El atomo que atrae mejor los electrones es el que mejor sostiene una carga negativa.',
    },
    {
      rule: 'Contribuyen mas las estructuras con octetos completos.',
      why: 'El octeto es la configuracion de baja energia; dejar un atomo deficiente cuesta.',
    },
    {
      rule: 'Contribuyen menos las estructuras con cargas del mismo signo en atomos vecinos.',
      why: 'Dos cargas iguales juntas se repelen.',
    },
    {
      rule: 'Las estructuras equivalentes contribuyen todas por igual.',
      why: 'Si no hay nada que las distinga, no hay razon para que una pese mas.',
    },
  ];
}

/**
 * Relacion orden de enlace / longitud / energia (§26).
 *
 * Se expresa como tendencia, no como numero: convertir orden de enlace en
 * picometros exige datos experimentales por pareja de elementos, y este motor
 * prefiere declarar la tendencia antes que inventar la cifra.
 */
export function bondOrderConsequences(averageOrder: number): {
  readonly length: string;
  readonly strength: string;
} {
  if (averageOrder === 1) {
    return {
      length: 'Enlace simple: el mas largo de los tres y el mas facil de romper.',
      strength: 'Un solo par compartido (un enlace sigma).',
    };
  }
  if (averageOrder === 2) {
    return {
      length: 'Enlace doble: mas corto y mas fuerte que el simple.',
      strength: 'Dos pares compartidos (un sigma y un pi).',
    };
  }
  if (averageOrder === 3) {
    return {
      length: 'Enlace triple: el mas corto y el mas fuerte.',
      strength: 'Tres pares compartidos (un sigma y dos pi).',
    };
  }
  const lower = Math.floor(averageOrder);
  const upper = Math.ceil(averageOrder);
  return {
    length:
      `Orden ${averageOrder.toFixed(2)}: la longitud queda ENTRE la de un enlace de orden ${lower} y la de uno ` +
      `de orden ${upper}, y todos los enlaces equivalentes miden lo mismo. Es la prueba experimental ` +
      'de la deslocalizacion.',
    strength: `Mas fuerte que un enlace de orden ${lower}, mas debil que uno de orden ${upper}.`,
  };
}
