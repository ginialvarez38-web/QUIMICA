/**
 * UNIDAD 2 — ESTRUCTURA ATOMICA.
 *
 * Mismo criterio que la unidad 1: donde algo se puede calcular, se calcula.
 *
 * LO QUE AQUI SE DEMUESTRA EN LUGAR DE AFIRMARSE
 *
 *   - La composicion de un nucleido: protones, neutrones y electrones salen
 *     de Z y A, no de una tabla escrita a mano.
 *   - LA ABUNDANCIA ISOTOPICA. Es la demostracion mas valiosa de la unidad:
 *     la masa atomica del cloro no es 35,45 porque lo diga un libro, sino
 *     porque 75,76 % de ³⁵Cl y 24,24 % de ³⁷Cl dan esa media ponderada. El
 *     calculo se hace con los datos y se compara con el valor IUPAC.
 *   - Las ISOBARAS y los ISOTONOS se BUSCAN en los datos agrupando por A y
 *     por N. Si manana se anade un nucleido, aparecen las parejas nuevas
 *     solas.
 *   - La tabla periodica sale de los 118 elementos con su grupo, periodo,
 *     bloque y familia. No hay ninguna imagen: es la base de datos dibujada.
 *
 * LO QUE NO HAY (§32)
 * La tabla de nucleidos NO esta completa — hay unos 3400 conocidos y aqui se
 * han curado los que se estudian. Los elementos sin datos isotopicos lo dicen
 * en lugar de mostrar una tabla vacia como si no tuvieran isotopos.
 */

import { getElement, ELEMENTS } from '../data/elements.js';
import {
  isotopesOf,
  neutronsOf,
  allIsobarGroups,
  allIsotoneGroups,
  nuclideLabel,
  elementsWithIsotopes,
} from '../data/isotopes.js';
import type { Isotope } from '../data/isotopes.js';
import type { TheoryTopic } from './theory.js';
import {
  configureAtom,
  orbitalDiagram,
  orbitalName,
  quantumNumbers,
} from '../analysis/electronic.js';

// ---------------------------------------------------------------------------
// Demostraciones
// ---------------------------------------------------------------------------

export interface CompositionDemo {
  readonly kind: 'atom-composition';
  readonly rows: readonly {
    readonly label: string;
    readonly symbol: string;
    readonly Z: number;
    readonly A: number;
    readonly protons: number;
    readonly neutrons: number;
    readonly electrons: number;
    readonly charge: number;
    readonly note: string;
  }[];
}

export interface AbundanceDemo {
  readonly kind: 'abundance';
  readonly symbol: string;
  readonly elementName: string;
  readonly rows: readonly {
    readonly label: string;
    readonly A: number;
    readonly mass: number;
    readonly abundance: number;
    readonly contribution: number;
  }[];
  /** Media ponderada calculada aqui. */
  readonly weighted: number;
  /** Valor tabulado por la IUPAC. */
  readonly tabulated: number;
  readonly difference: number;
}

export interface NuclideGroupDemo {
  readonly kind: 'isobars' | 'isotones';
  readonly groups: readonly {
    readonly value: number;
    readonly members: readonly {
      readonly label: string;
      readonly symbol: string;
      readonly Z: number;
      readonly A: number;
      readonly neutrons: number;
    }[];
  }[];
}

export interface PeriodicStatsDemo {
  readonly kind: 'periodic-stats';
  readonly total: number;
  readonly byCategory: readonly { readonly category: string; readonly label: string; readonly count: number }[];
  readonly byBlock: readonly { readonly block: string; readonly count: number; readonly meaning: string }[];
  readonly metals: number;
  readonly nonmetals: number;
  readonly metalloids: number;
}

/**
 * Un modelo atomico, con lo unico que importa de el: que problema resolvio y
 * que problema no pudo resolver.
 */
export interface AtomicModel {
  readonly year: string;
  readonly author: string;
  readonly name: string;
  /** Que propone. */
  readonly proposal: string;
  /** El experimento que lo sostiene. */
  readonly evidence: string;
  /** Lo que explica bien. */
  readonly explains: string;
  /** Lo que NO puede explicar: la razon de que apareciera el siguiente. */
  readonly fails: string;
  /** Que sigue valiendo hoy. */
  readonly survives: string;
}

export interface ModelsDemo {
  readonly kind: 'models';
  readonly models: readonly AtomicModel[];
}

/**
 * LOS CUATRO NUMEROS CUANTICOS DE ELECTRONES CONCRETOS.
 *
 * No una tabla de «que significa cada letra» —eso es texto— sino los cuatro
 * numeros de cada electron de un atomo de verdad, sacados del motor. Leida de
 * arriba abajo se ve lo unico que hay que entender: no hay dos filas iguales.
 * Eso ES el principio de exclusion de Pauli, y aqui se comprueba contandolo.
 */
export interface QuantumDemo {
  readonly kind: 'quantum-numbers';
  readonly symbol: string;
  readonly elementName: string;
  readonly rows: readonly {
    readonly orbital: string;
    readonly n: number;
    readonly l: number;
    readonly ml: number;
    readonly ms: string;
    readonly subshell: string;
  }[];
  /** Combinaciones distintas encontradas. Si coincide con el total, Pauli se cumple. */
  readonly distinct: number;
  readonly total: number;
  /** Cuantos orbitales y electrones caben en cada capa, CONTANDOLOS. */
  readonly shells: readonly {
    readonly n: number;
    readonly subshells: readonly string[];
    readonly orbitals: number;
    readonly electrons: number;
  }[];
}

export interface ConfigDemo {
  readonly kind: 'configuration';
  readonly rows: readonly {
    readonly symbol: string;
    readonly name: string;
    readonly Z: number;
    readonly full: string;
    readonly condensed: string;
    readonly valenceElectrons: number;
    readonly note: string | null;
  }[];
}

export interface FillingDemo {
  readonly kind: 'filling';
  readonly rows: readonly {
    readonly symbol: string;
    readonly name: string;
    readonly Z: number;
    readonly diagram: readonly string[];
    readonly unpaired: number;
    readonly anomaly: string | null;
  }[];
}

export interface MagnetismDemo {
  readonly kind: 'magnetism';
  readonly rows: readonly {
    readonly label: string;
    readonly symbol: string;
    readonly charge: number;
    readonly condensed: string;
    readonly unpaired: number;
    readonly behaviour: 'paramagnetico' | 'diamagnetico';
  }[];
}

/** Una tendencia periodica medida sobre datos reales, no afirmada. */
export interface TrendDemo {
  readonly kind: 'periodic-trend';
  readonly series: readonly {
    readonly title: string;
    readonly axis: string;
    readonly rows: readonly {
      readonly symbol: string;
      readonly name: string;
      readonly radius: number | null;
      readonly electronegativity: number | null;
      readonly valence: number;
    }[];
    readonly reading: string;
  }[];
  /** Lo que NO se puede calcular con los datos que hay (§32). */
  readonly gap: string;
}

export type AtomDemo =
  | CompositionDemo
  | AbundanceDemo
  | NuclideGroupDemo
  | PeriodicStatsDemo
  | ModelsDemo
  | QuantumDemo
  | ConfigDemo
  | FillingDemo
  | MagnetismDemo
  | TrendDemo;

/**
 * LOS MODELOS ATOMICOS, como cadena de experimentos.
 *
 * Estudiarlos como cinco dibujos que memorizar es perder lo unico que
 * ensenan. Un modelo no se abandona por «ser falso»: se abandona el dia que
 * aparece un experimento que no puede explicar. Y el modelo viejo sigue
 * sirviendo dentro de sus limites — el de Dalton basta para ajustar
 * ecuaciones, y es de 1803.
 *
 * De ahi que cada entrada lleve las cuatro columnas que de verdad importan:
 * que propone, que experimento lo sostiene, que NO puede explicar (que es la
 * razon de que exista el siguiente) y que ha sobrevivido.
 */
export function modelsDemo(): ModelsDemo {
  return {
    kind: 'models',
    models: [
      {
        year: '1803',
        author: 'Dalton',
        name: 'Esfera maciza',
        proposal:
          'La materia esta hecha de atomos indivisibles e indestructibles. Los de un mismo elemento ' +
          'son identicos; los de elementos distintos, diferentes. Se combinan en proporciones de ' +
          'numeros enteros sencillos.',
        evidence:
          'Las leyes ponderales de la unidad 1: conservacion de la masa, proporciones definidas y, ' +
          'sobre todo, proporciones multiples. Que la razon salga 1:2 y no 1:1,87 obliga a que lo que ' +
          'se combina sean unidades que se cuentan de una en una.',
        explains: 'Por que las ecuaciones se ajustan con numeros enteros y por que un compuesto tiene composicion fija.',
        fails:
          'No explica la electricidad. Si el atomo es una esfera maciza e indivisible, ¿de donde salen ' +
          'los rayos catodicos, que aparecen sea cual sea el metal?',
        survives:
          'Casi todo, para la quimica de reacciones. Ajustar una ecuacion es aplicar a Dalton, y se ' +
          'hace igual hoy.',
      },
      {
        year: '1904',
        author: 'Thomson',
        name: 'Pudin de pasas',
        proposal:
          'El atomo es una esfera de carga positiva difusa con los electrones incrustados, como las ' +
          'pasas en un bizcocho. El conjunto es neutro.',
        evidence:
          'Los rayos catodicos: particulas negativas que salen de CUALQUIER metal, con la misma ' +
          'relacion carga/masa. Si de todos los materiales sale la misma particula, esa particula esta ' +
          'en todos los atomos.',
        explains: 'Que el atomo tenga partes con carga y siga siendo neutro. Y que sea divisible.',
        fails:
          'No sobrevive al experimento de la lamina de oro. Si la carga positiva estuviera repartida, ' +
          'ninguna particula alfa podria rebotar hacia atras.',
        survives: 'La idea de que el atomo contiene electrones y de que es divisible.',
      },
      {
        year: '1911',
        author: 'Rutherford',
        name: 'Modelo nuclear',
        proposal:
          'Casi toda la masa y toda la carga positiva estan concentradas en un NUCLEO diminuto. Los ' +
          'electrones estan fuera, y entre medias no hay practicamente nada.',
        evidence:
          'La lamina de oro (Geiger y Marsden). Casi todas las particulas alfa atravesaban la lamina ' +
          'sin desviarse, pero una de cada 8000 rebotaba. Rutherford lo describio como disparar a un ' +
          'papel de seda y que la bala volviera.',
        explains: 'Que el atomo sea sobre todo espacio vacio, y que exista un nucleo denso y positivo.',
        fails:
          'Es INESTABLE segun la propia fisica de la epoca: una carga que gira emite radiacion, pierde ' +
          'energia y deberia caer al nucleo en una fraccion de segundo. Tampoco explica los espectros ' +
          'de rayas.',
        survives: 'El nucleo. Toda la fisica nuclear parte de aqui.',
      },
      {
        year: '1913',
        author: 'Bohr',
        name: 'Orbitas cuantizadas',
        proposal:
          'Los electrones solo pueden estar en ciertas orbitas de energia definida. Girando en una ' +
          'orbita permitida NO radian. Al saltar de una a otra absorben o emiten un foton de energia ' +
          'exactamente igual a la diferencia.',
        evidence:
          'Los ESPECTROS DE RAYAS. Un gas caliente no emite todos los colores: emite unas rayas ' +
          'concretas y siempre las mismas. Bohr calculo las del hidrogeno y le salieron exactas.',
        explains:
          'Por que el atomo es estable y por que cada elemento tiene su espectro, que es su huella ' +
          'dactilar. Es la base de la idea de NIVEL de energia.',
        fails:
          'Solo funciona para el hidrogeno. Con dos electrones ya falla, y no explica por que unas ' +
          'rayas son mas intensas que otras ni el efecto de un campo magnetico.',
        survives:
          'La cuantizacion: la energia del electron solo toma valores concretos. Y el numero cuantico ' +
          'n, que es el numero de periodo de la tabla.',
      },
      {
        year: '1926',
        author: 'Schrodinger y Heisenberg',
        name: 'Modelo cuantico',
        proposal:
          'El electron no tiene trayectoria. Lo que hay es una funcion de onda cuyo cuadrado da la ' +
          'PROBABILIDAD de encontrarlo en cada punto. Un orbital es la region donde esa probabilidad ' +
          'es alta, no un camino.',
        evidence:
          'La dualidad onda-particula (De Broglie, confirmada por difraccion de electrones) y el ' +
          'principio de incertidumbre: posicion y velocidad no se pueden conocer a la vez con ' +
          'precision arbitraria, asi que hablar de orbita carece de sentido.',
        explains:
          'Los espectros de todos los elementos, la forma de los enlaces, la geometria molecular y la ' +
          'estructura de la tabla periodica.',
        fails:
          'Nada de la quimica ordinaria, pero deja de ser dibujable. El precio de la exactitud es ' +
          'perder la imagen intuitiva.',
        survives: 'Es el modelo vigente. Toda la unidad de estructura electronica de este programa lo usa.',
      },
    ],
  };
}

/**
 * COMPOSICION DE UN NUCLEIDO.
 *
 * Protones = Z. Neutrones = A − Z. Electrones = Z − carga. Tres restas, pero
 * son las tres que hay que tener claras, y se incluye un ion a proposito
 * porque es donde se falla: en un ion cambian los ELECTRONES, nunca los
 * protones. Si cambiaran los protones ya no seria el mismo elemento.
 */
export function compositionDemo(): CompositionDemo {
  const cases: [string, number, number, string][] = [
    ['H', 1, 0, 'El atomo mas simple: un proton y un electron. Su isotopo mas comun no tiene neutrones.'],
    ['C', 12, 0, 'El patron de la unidad de masa atomica.'],
    ['Cl', 35, 0, 'Isotopo mas abundante del cloro.'],
    ['Cl', 37, 0, 'Mismo elemento, dos neutrones mas: cambia A, no Z.'],
    ['Na', 23, 1, 'Ion sodio: ha perdido UN ELECTRON. Los protones siguen siendo 11.'],
    ['O', 16, -2, 'Ion oxido: ha ganado DOS ELECTRONES. Sigue siendo oxigeno.'],
  ];

  return {
    kind: 'atom-composition',
    rows: cases.map(([symbol, A, charge, note]) => {
      const element = getElement(symbol)!;
      return {
        label:
          nuclideLabel({ symbol, Z: element.Z, A, mass: 0, abundance: 0, radioactive: false }) +
          (charge !== 0 ? (charge > 0 ? `${charge}+` : `${Math.abs(charge)}−`) : ''),
        symbol,
        Z: element.Z,
        A,
        protons: element.Z,
        neutrons: A - element.Z,
        electrons: element.Z - charge,
        charge,
        note,
      };
    }),
  };
}

/**
 * ABUNDANCIA ISOTOPICA — la masa atomica, deducida.
 *
 * Se multiplica cada masa isotopica por su abundancia, se suma, y se compara
 * con el valor que publica la IUPAC. Que coincidan no es casualidad: ES la
 * definicion de masa atomica estandar.
 *
 * Devuelve null si el elemento no tiene datos curados, en lugar de una tabla
 * vacia que pareceria decir que no tiene isotopos.
 */
export function abundanceDemo(symbol: string): AbundanceDemo | null {
  const element = getElement(symbol);
  if (!element) return null;

  const isotopes = isotopesOf(symbol).filter((i) => i.abundance > 0);
  if (isotopes.length === 0) return null;

  const rows = isotopes.map((i) => ({
    label: nuclideLabel(i),
    A: i.A,
    mass: i.mass,
    abundance: i.abundance,
    contribution: (i.mass * i.abundance) / 100,
  }));

  const weighted = rows.reduce((sum, r) => sum + r.contribution, 0);

  return {
    kind: 'abundance',
    symbol,
    elementName: element.name,
    rows,
    weighted,
    tabulated: element.atomicMass,
    difference: Math.abs(weighted - element.atomicMass),
  };
}

const describe = (i: Isotope) => ({
  label: nuclideLabel(i),
  symbol: i.symbol,
  Z: i.Z,
  A: i.A,
  neutrons: neutronsOf(i),
});

/**
 * ISOBARAS: se buscan agrupando por numero masico.
 *
 * No hay lista escrita: se recorren los nucleidos curados y se quedan los
 * numeros masicos que comparten dos elementos distintos. El grupo clasico
 * —⁴⁰Ar, ⁴⁰K y ⁴⁰Ca— aparece porque esta en los datos, no porque nadie lo
 * haya puesto ahi.
 */
export function isobarsDemo(): NuclideGroupDemo {
  return {
    kind: 'isobars',
    groups: allIsobarGroups().map((g) => ({ value: g.A, members: g.members.map(describe) })),
  };
}

/** ISOTONOS: lo mismo, agrupando por numero de neutrones. */
export function isotonesDemo(): NuclideGroupDemo {
  return {
    kind: 'isotones',
    groups: allIsotoneGroups()
      // Con muchos nucleidos aparecen decenas de grupos; se muestran los que
      // reunen mas elementos, que son los que ilustran la idea.
      .filter((g) => g.members.length >= 2)
      .sort((a, b) => b.members.length - a.members.length || a.N - b.N)
      .slice(0, 6)
      .map((g) => ({ value: g.N, members: g.members.map(describe) })),
  };
}

const CATEGORY_LABEL: Record<string, string> = {
  'alkali-metal': 'Metales alcalinos',
  'alkaline-earth-metal': 'Metales alcalinoterreos',
  'transition-metal': 'Metales de transicion',
  'post-transition-metal': 'Metales del bloque p',
  metalloid: 'Metaloides (semimetales)',
  'reactive-nonmetal': 'No metales',
  halogen: 'Halogenos',
  'noble-gas': 'Gases nobles',
  lanthanide: 'Lantanidos',
  actinide: 'Actinidos',
  unknown: 'Propiedades sin confirmar',
};

const BLOCK_MEANING: Record<string, string> = {
  s: 'El ultimo electron entra en un orbital s. Grupos 1 y 2, mas el helio.',
  p: 'El ultimo electron entra en un orbital p. Grupos 13 a 18.',
  d: 'El ultimo electron entra en un orbital d. Los metales de transicion.',
  f: 'El ultimo electron entra en un orbital f. Lantanidos y actinidos.',
};

/**
 * La tabla periodica CONTADA.
 *
 * Los recuentos salen de recorrer los 118 elementos. Sirve para responder a
 * «¿cuantos metales hay?» sin que nadie tenga que fiarse de un numero suelto.
 */
export function periodicStatsDemo(): PeriodicStatsDemo {
  const counts = new Map<string, number>();
  const blocks = new Map<string, number>();
  for (const e of ELEMENTS) {
    counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    blocks.set(e.block, (blocks.get(e.block) ?? 0) + 1);
  }

  const metallic = new Set([
    'alkali-metal',
    'alkaline-earth-metal',
    'transition-metal',
    'post-transition-metal',
    'lanthanide',
    'actinide',
  ]);
  const nonmetallic = new Set(['reactive-nonmetal', 'halogen', 'noble-gas']);

  let metals = 0;
  let nonmetals = 0;
  let metalloids = 0;
  for (const e of ELEMENTS) {
    if (metallic.has(e.category)) metals++;
    else if (nonmetallic.has(e.category)) nonmetals++;
    else if (e.category === 'metalloid') metalloids++;
  }

  return {
    kind: 'periodic-stats',
    total: ELEMENTS.length,
    byCategory: [...counts.entries()]
      .map(([category, count]) => ({ category, label: CATEGORY_LABEL[category] ?? category, count }))
      .sort((a, b) => b.count - a.count),
    byBlock: ['s', 'p', 'd', 'f'].map((block) => ({
      block,
      count: blocks.get(block) ?? 0,
      meaning: BLOCK_MEANING[block]!,
    })),
    metals,
    nonmetals,
    metalloids,
  };
}

// ---------------------------------------------------------------------------
// El temario
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Las demostraciones de la estructura electronica (2.11)
// ---------------------------------------------------------------------------

/**
 * Los cuatro numeros cuanticos de TODOS los electrones de un atomo.
 *
 * El motor ya reparte los electrones por orbitales aplicando Aufbau, Hund y
 * Pauli; aqui solo se le pregunta y se tabula. La comprobacion del final —
 * cuantas combinaciones (n, l, m_l, m_s) distintas hay frente a cuantos
 * electrones— es Pauli puesto a prueba: si el motor se equivocara y metiera
 * dos electrones identicos, el numero de combinaciones distintas bajaria y la
 * tabla lo diria.
 */
function quantumDemo(symbol: string): QuantumDemo | null {
  const element = getElement(symbol);
  const config = configureAtom(symbol);
  if (!element || !config) return null;

  const rows: QuantumDemo['rows'] = config.subshells.flatMap((shell) =>
    shell.orbitals.flatMap((orbital) =>
      orbital.spins.map((_spin, index) => {
        const q = quantumNumbers(orbital, index);
        return {
          orbital: orbitalName(orbital),
          n: q.n,
          l: q.l,
          ml: q.ml,
          ms: q.ms,
          subshell: `${shell.n}${shell.subshell}`,
        };
      }),
    ),
  );

  const seen = new Set(rows.map((r) => `${r.n}|${r.l}|${r.ml}|${r.ms}`));

  /*
   * Cuantos electrones caben en la capa n.
   *
   * La regla que se ensena es 2n², y se podria escribir «2n²» y quedarse tan
   * ancho. Aqui se CUENTA: para cada l de 0 a n−1 hay 2l+1 valores de m_l, y
   * cada orbital admite 2 espines. Que la suma de 2n² es la consecuencia, no
   * el punto de partida.
   */
  const NAMES = ['s', 'p', 'd', 'f', 'g'];
  const shells = [1, 2, 3, 4].map((n) => {
    let orbitals = 0;
    const subshells: string[] = [];
    for (let l = 0; l < n; l++) {
      orbitals += 2 * l + 1;
      subshells.push(`${n}${NAMES[l]}`);
    }
    return { n, subshells, orbitals, electrons: orbitals * 2 };
  });

  return {
    kind: 'quantum-numbers',
    symbol: element.symbol,
    elementName: element.name,
    rows,
    distinct: seen.size,
    total: rows.length,
    shells,
  };
}

function configDemo(symbols: readonly string[]): ConfigDemo {
  const rows = symbols.flatMap((symbol) => {
    const element = getElement(symbol);
    const config = configureAtom(symbol);
    if (!element || !config) return [];
    return [
      {
        symbol: element.symbol,
        name: element.name,
        Z: element.Z,
        full: config.full,
        condensed: config.condensed,
        valenceElectrons: config.valenceElectrons,
        note: config.anomalyReason,
      },
    ];
  });
  return { kind: 'configuration', rows };
}

function fillingDemo(symbols: readonly string[]): FillingDemo {
  const rows = symbols.flatMap((symbol) => {
    const element = getElement(symbol);
    const config = configureAtom(symbol);
    if (!element || !config) return [];
    return [
      {
        symbol: element.symbol,
        name: element.name,
        Z: element.Z,
        diagram: orbitalDiagram(config),
        unpaired: config.unpairedElectrons,
        anomaly: config.anomalyReason,
      },
    ];
  });
  return { kind: 'filling', rows };
}

function magnetismDemo(): MagnetismDemo {
  const cases: readonly { symbol: string; charge: number; label: string }[] = [
    { symbol: 'He', charge: 0, label: 'Helio' },
    { symbol: 'C', charge: 0, label: 'Carbono' },
    { symbol: 'N', charge: 0, label: 'Nitrogeno' },
    { symbol: 'O', charge: 0, label: 'Oxigeno' },
    { symbol: 'Ne', charge: 0, label: 'Neon' },
    { symbol: 'Fe', charge: 0, label: 'Hierro' },
    { symbol: 'Fe', charge: 2, label: 'Ion hierro(II)' },
    { symbol: 'Fe', charge: 3, label: 'Ion hierro(III)' },
    { symbol: 'Zn', charge: 0, label: 'Cinc' },
    { symbol: 'Cu', charge: 0, label: 'Cobre' },
  ];

  const rows = cases.flatMap(({ symbol, charge, label }) => {
    const config = configureAtom(symbol, charge);
    if (!config) return [];
    return [
      {
        label,
        symbol,
        charge,
        condensed: config.condensed,
        unpaired: config.unpairedElectrons,
        behaviour: config.magnetism,
      },
    ];
  });
  return { kind: 'magnetism', rows };
}

/**
 * Las tendencias periodicas, LEIDAS de los datos.
 *
 * Se recorre un periodo y un grupo y se sacan el radio covalente y la
 * electronegatividad que tiene cada elemento en la base. La frase «el radio
 * disminuye a lo largo de un periodo» no se escribe: se ve en la columna.
 *
 * Y donde no hay datos, no hay tendencia (§32). No se guarda energia de
 * ionizacion, asi que no se dibuja ninguna: se dice que falta.
 */
function trendDemo(): TrendDemo {
  const row = (symbol: string) => {
    const element = getElement(symbol);
    const config = configureAtom(symbol);
    if (!element) return null;
    return {
      symbol: element.symbol,
      name: element.name,
      radius: element.physical.covalentRadius.value,
      electronegativity: element.electronegativity,
      valence: config?.valenceElectrons ?? 0,
    };
  };

  const build = (symbols: readonly string[]) =>
    symbols.map(row).filter((r): r is NonNullable<typeof r> => r !== null);

  return {
    kind: 'periodic-trend',
    series: [
      {
        title: 'A lo largo del periodo 3 (de izquierda a derecha)',
        axis: 'periodo',
        rows: build(['Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl']),
        reading:
          'La capa de valencia es la misma (n = 3) en los siete, pero el nucleo gana un proton en cada ' +
          'paso y tira mas fuerte de ella. Por eso el atomo se ENCOGE hacia la derecha mientras la ' +
          'electronegatividad sube.',
      },
      {
        title: 'Bajando por el grupo 1 (los alcalinos)',
        axis: 'grupo',
        rows: build(['Li', 'Na', 'K', 'Rb', 'Cs']),
        reading:
          'Todos tienen UN electron de valencia, y sin embargo el atomo crece en cada fila: se estrena ' +
          'una capa nueva, mas lejos del nucleo y apantallada por las de dentro. Ese electron cada vez ' +
          'mas suelto es la razon de que el cesio reaccione mas violentamente que el litio.',
      },
    ],
    gap:
      'No hay energias de ionizacion en la base de datos, asi que esa tendencia —la mas directa de ' +
      'todas, porque mide literalmente lo que cuesta arrancar el electron— no se puede calcular aqui. ' +
      'Se dice en lugar de estimarla.',
  };
}

export function unitAtomo(): TheoryTopic<AtomDemo> {
  const withIsotopes = elementsWithIsotopes();

  return {
    id: '2',
    title: 'Estructura atomica',
    body:
      'De que esta hecho un atomo, como se llego a saberlo, y por que ese conocimiento ordena a los ' +
      '118 elementos en una tabla que predice propiedades.',
    children: [
      {
        id: '2.1',
        requires: ['1.1'],
        title: 'Composicion del atomo',
        body:
          'Un atomo tiene un NUCLEO diminuto con protones (carga +1) y neutrones (sin carga), y una ' +
          'CORTEZA donde estan los electrones (carga −1). El nucleo concentra casi toda la masa; la ' +
          'corteza, casi todo el volumen.',
        figure: 'escala',
        keyIdea:
          'Un atomo es, sobre todo, ESPACIO VACIO. El nucleo ocupa una billonesima parte del volumen y ' +
          'concentra el 99,97 % de la masa.',
        analogy: {
          image:
            'Si el nucleo fuera una canica de 1 cm en el centro del circulo central de un campo de ' +
            'futbol, los electrones andarian por las gradas y entre medias no habria nada.',
          limit:
            'La comparacion sirve para las ESCALAS y solo para eso. Los electrones no son bolitas ni ' +
            'estan en un sitio concreto de las gradas: forman una nube de probabilidad. Y no hay nada ' +
            'que los sujete «girando», como se vera en el apartado 2.2.1.2.',
        },
        pitfall:
          'El proton y el neutron pesan casi lo mismo (≈1 u), pero el electron pesa 1836 veces menos. Por ' +
          'eso la masa se cuenta con A = protones + neutrones y los electrones no entran en esa suma.',
        check: [
          {
            question: 'Si un atomo es casi todo vacio, ¿por que no atraviesas una mesa con la mano?',
            answer:
              'Porque lo que te detiene no es la materia, es la REPULSION entre las nubes electronicas ' +
              'de tus atomos y las de la mesa. Nunca llegas a tocar nada: las cargas negativas se ' +
              'rechazan mucho antes. La solidez es un efecto electrico, no una cuestion de que este ' +
              'lleno.',
          },
          {
            question: '¿Que pesa mas, un proton o 1000 electrones?',
            answer:
              'El proton, y por bastante. Pesa 1836 veces mas que un electron, asi que sigue ganando a ' +
              '1000 electrones (1836 frente a 1000).',
          },
        ],
        connects: [
          { label: '2.3 Constitucion del nucleo', topic: '2.3' },
          { label: '1.1 Materia: masa y volumen', mode: 'teoria' },
        ],
        demo: null,
      },
      {
        id: '2.2',
        requires: ['2.1'],
        title: 'Estructura nuclear y propiedades derivadas',
        body:
          'Del nucleo salen dos numeros que lo determinan todo: el numero atomico Z fija QUE elemento ' +
          'es, y el numero masico A fija CUANTO pesa ese atomo concreto. De la corteza sale el ' +
          'comportamiento quimico.',
        keyIdea:
          'La quimica la hacen los electrones; la identidad, los protones. Por eso un ion sigue siendo ' +
          'el mismo elemento aunque reaccione de otro modo.',
        check: [
          {
            question:
              'El sodio metalico arde en el agua y el ion Na⁺ del salero no hace nada. Si son el mismo ' +
              'elemento, ¿por que se comportan de forma tan distinta?',
            answer:
              'Porque lo que cambia es la CORTEZA, que es donde se hace la quimica. El sodio metalico ' +
              'tiene un electron de valencia suelto y lo cede con facilidad — de ahi la violencia. El ' +
              'Na⁺ ya lo ha cedido y le queda una capa completa: no tiene nada que ofrecer. El nucleo es ' +
              'identico en los dos, once protones, y por eso los dos siguen siendo sodio.',
          },
        ],
        children: [
          {
            id: '2.2.1',
            requires: ['2.2'],
            title: 'Antecedentes historicos',
            body:
              'Nada de esto se vio: se dedujo de experimentos. El orden importa, porque cada modelo ' +
              'nacio para explicar algo que el anterior no podia.',
            check: [
              {
                question:
                  'Nadie ha visto nunca un atomo con sus partes. ¿Como se puede afirmar entonces que ' +
                  'tiene un nucleo diminuto y cargado?',
                answer:
                  'Por lo que hacen las cosas al chocar con el. En la lamina de oro, unas pocas ' +
                  'particulas alfa de cada diez mil rebotaban hacia atras: para desviar asi algo tan ' +
                  'rapido hace falta concentrar mucha carga y mucha masa en muy poco sitio, y para que ' +
                  'solo le pase a unas pocas, ese sitio tiene que ser diminuto. La conclusion no sale de ' +
                  'ver el nucleo, sale de MEDIR angulos de desvio y descartar lo que no los explica.',
              },
            ],
            children: [
              {
                id: '2.2.1.1',
                requires: ['2.2.1'],
                title: 'Naturaleza electrica de los atomos',
                body:
                  'La electrolisis (Faraday, 1834) mostro que la materia y la electricidad estan ' +
                  'relacionadas: para depositar una cantidad fija de sustancia hace falta una cantidad ' +
                  'fija de carga. Los rayos catodicos (Crookes, 1875) resultaron ser particulas ' +
                  'negativas que salian de CUALQUIER metal, y eso fue la prueba de que hay algo con ' +
                  'carga dentro de todos los atomos.',
                keyIdea:
                  'La clave del experimento de los rayos catodicos es que el resultado NO dependia del ' +
                  'metal del catodo. Si de cualquier material sale la misma particula, esa particula ' +
                  'esta en todos: el atomo no es indivisible.',
                pitfall:
                  'Thomson no midio la masa del electron ni su carga por separado: midio el COCIENTE ' +
                  'carga/masa desviando el haz con campos electricos y magneticos. La carga la midio ' +
                  'Millikan catorce anos despues, con las gotas de aceite, y solo entonces se pudo ' +
                  'despejar la masa.',
                check: [
                  {
                    question:
                      '¿Por que fue tan importante que los rayos catodicos salieran iguales de cualquier metal?',
                    answer:
                      'Porque significa que el electron no es una peculiaridad de un material: es un ' +
                      'componente COMUN de toda la materia. Si de un catodo de cobre y de otro de ' +
                      'aluminio sale exactamente la misma particula, esa particula tiene que estar dentro ' +
                      'de los dos. Y eso tumba la indivisibilidad de Dalton.',
                  },
                ],
              },
              {
                id: '2.2.1.2',
                requires: ['2.2.1.1', '1.8.3'],
                title: 'Modelos atomicos',
                body:
                  'Cada modelo resolvio un problema del anterior y dejo otro abierto. Estudiarlos por ' +
                  'separado, como cinco dibujos que memorizar, es perder lo unico interesante: la ' +
                  'cadena de experimentos que obligo a cambiarlos.',
                keyIdea:
                  'Un modelo no se abandona por ser «falso»: se abandona cuando aparece un experimento ' +
                  'que no puede explicar. Y el modelo viejo sigue sirviendo dentro de sus limites — el ' +
                  'de Dalton, de 1803, es el que usas para ajustar una ecuacion.',
                figure: 'modelos',
                demo: modelsDemo(),
                check: [
                  {
                    question:
                      '¿Que vio Rutherford en la lamina de oro que no encajaba con el modelo de Thomson?',
                    answer:
                      'Que una de cada 8000 particulas alfa REBOTABA hacia atras. Con la carga positiva ' +
                      'repartida por toda la esfera, como proponia Thomson, ninguna podria rebotar: no ' +
                      'habria nada lo bastante concentrado para frenarla. Hacia falta un nucleo diminuto ' +
                      'y masivo.',
                  },
                  {
                    question: '¿Por que el modelo de Rutherford era INESTABLE segun la fisica de su epoca?',
                    answer:
                      'Porque una carga acelerada emite radiacion, y un electron girando esta acelerado. ' +
                      'Perderia energia continuamente y caeria al nucleo en una fraccion de segundo. Que ' +
                      'la materia exista contradecia el modelo, y de ahi la cuantizacion de Bohr.',
                  },
                  {
                    question: '¿Que experimento obligo a inventar los niveles de energia de Bohr?',
                    answer:
                      'Los ESPECTROS DE RAYAS. Un gas caliente no emite todos los colores, sino unas ' +
                      'rayas concretas y siempre las mismas. Si el electron pudiera tener cualquier ' +
                      'energia, el espectro seria continuo. Que sea discreto significa que las energias ' +
                      'permitidas tambien lo son.',
                  },
                ],
                connects: [
                  { label: '2.10 La tabla periodica sale de aqui', topic: '2.10' },
                  { label: 'Analizar una especie de verdad', mode: 'react' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: '2.3',
        requires: ['2.1'],
        title: 'Constitucion del nucleo',
        body:
          'El nucleo contiene protones y neutrones, llamados juntos NUCLEONES. Los protones se repelen ' +
          'entre si con una fuerza electrica enorme a esa distancia, asi que hace falta algo mas fuerte ' +
          'para mantenerlos unidos: la interaccion nuclear fuerte, que actua entre nucleones a muy ' +
          'corta distancia y no distingue carga.',
        keyIdea:
          'Los neutrones son el pegamento que hace viable un nucleo con varios protones. Por eso, segun ' +
          'crece Z, hace falta cada vez MAS neutrones que protones para que el nucleo aguante.',
        pitfall:
          'De ahi que los elementos pesados sean radiactivos: llega un punto en que ninguna proporcion ' +
          'de neutrones basta para contener la repulsion, y el nucleo se rompe.',
        check: [
          {
            question:
              'Dos protones juntos se repelen con una fuerza enorme. ¿Por que no sale disparado cualquier ' +
              'nucleo que tenga mas de uno?',
            answer:
              'Porque a distancias nucleares actua otra fuerza mucho mas intensa: la interaccion nuclear ' +
              'FUERTE, que atrae a los nucleones entre si y no distingue si tienen carga o no. Su alcance ' +
              'es cortisimo, asi que solo cuenta entre vecinos inmediatos, mientras que la repulsion ' +
              'electrica llega a todo el nucleo. De ese pulso sale todo lo demas: por eso hacen falta ' +
              'cada vez mas neutrones segun crece Z, y por eso los nucleos muy grandes acaban rompiendose.',
          },
        ],
        demo: compositionDemo(),
      },
      {
        id: '2.4',
        requires: ['2.3'],
        title: 'Numero atomico (Z)',
        body:
          'Z es el numero de PROTONES del nucleo. Es la identidad del elemento: cambiarlo es cambiar de ' +
          'elemento. En un atomo neutro coincide con el numero de electrones.',
        keyIdea:
          'La tabla periodica esta ordenada por Z creciente, y no por masa. Moseley lo demostro en 1913, ' +
          'y con ese cambio se arreglaron solas las tres parejas que estaban descolocadas en la tabla de ' +
          'Mendeleiev.',
        pitfall:
          'Z no cambia nunca en una reaccion quimica. Un ion Na⁺ tiene 11 protones, igual que el atomo ' +
          'neutro; lo que ha perdido es un electron.',
        analogy: {
          image:
            'Z es como el numero del DNI: identifica y no se puede cambiar. Los electrones son mas bien ' +
            'el dinero que llevas encima — puedes ganarlo o perderlo sin dejar de ser tu.',
          limit:
            'La comparacion falla en un punto importante: Z SI puede cambiar, pero no en quimica. En una ' +
            'reaccion NUCLEAR un elemento se transforma en otro, y eso es exactamente lo que buscaban ' +
            'los alquimistas.',
        },
        check: [
          {
            question: 'Un atomo tiene 17 protones, 18 neutrones y 18 electrones. ¿Que es?',
            answer:
              'Es un ion CLORURO, Cl⁻. El elemento lo dan los 17 protones (Z = 17 → cloro). Como tiene ' +
              '18 electrones, uno mas que protones, la carga es −1. Y A = 17 + 18 = 35, asi que es ' +
              'concretamente ³⁵Cl⁻.',
          },
        ],
      },
      {
        id: '2.5',
        requires: ['2.4'],
        title: 'Numero masico (A)',
        body:
          'A = protones + neutrones, es decir, el numero de nucleones. Es un numero ENTERO y se refiere ' +
          'a un atomo concreto, no al elemento.',
        keyIdea:
          'A no es la masa atomica. A es un recuento de particulas (entero); la masa atomica es una ' +
          'media ponderada de masas medidas (con decimales). El cloro tiene isotopos con A = 35 y A = 37, ' +
          'y masa atomica 35,45.',
        pitfall:
          'Notacion: el numero masico va arriba y el atomico abajo, ambos a la IZQUIERDA del simbolo. ' +
          'Escribirlos al reves es el error mas repetido.',
        worked: {
          question:
            'El ion ⁵⁶Fe³⁺ del hierro. ¿Cuantos protones, neutrones y electrones tiene?',
          steps: [
            { text: 'El simbolo da el elemento: hierro. En la tabla, Z = 26.', math: 'Z = 26 → 26 protones' },
            { text: 'El numero masico esta escrito: A = 56. Los neutrones son la diferencia.', math: 'N = A − Z = 56 − 26 = 30' },
            {
              text: 'La carga 3+ significa que ha PERDIDO tres electrones. Se restan a los 26 del atomo neutro.',
              math: 'e⁻ = Z − carga = 26 − 3 = 23',
            },
            {
              text: 'Comprobacion: 26 cargas positivas y 23 negativas dejan un saldo de +3, que es la carga escrita.',
              math: '(+26) + (−23) = +3 ✓',
            },
          ],
          answer:
            '26 protones, 30 neutrones y 23 electrones. Los tres numeros salen de sitios distintos: los ' +
            'protones son Z y no cambian nunca —si cambiaran ya no seria hierro—, los neutrones son la ' +
            'resta A − Z, y los electrones son los unicos que la carga modifica.',
        },
        check: [
          {
            question: '¿Por que la masa atomica del cloro (35,45) no puede ser un numero masico?',
            answer:
              'Porque A cuenta PARTICULAS y tiene que ser entero: no existen 0,45 nucleones. El 35,45 es ' +
              'una media ponderada de las masas de sus isotopos, que es otra cosa. Se ve en el apartado 2.9.',
          },
        ],
        connects: [{ label: '2.9 De donde sale el 35,45', topic: '2.9' }],
      },
      {
        id: '2.6',
        requires: ['2.5'],
        title: 'Isotopos',
        body:
          'Atomos del MISMO elemento (igual Z) con distinto numero de neutrones, y por tanto distinto A. ' +
          'Tienen las mismas propiedades quimicas, porque la quimica depende de los electrones, pero ' +
          'distinta masa.',
        keyIdea:
          'Isotopo significa «mismo lugar»: ocupan la misma casilla de la tabla periodica porque son el ' +
          'mismo elemento.',
        pitfall:
          'Los isotopos del hidrogeno son los unicos con nombre propio — protio, deuterio y tritio — ' +
          'porque en el hidrogeno anadir un neutron DUPLICA la masa. En los demas elementos el cambio ' +
          'relativo es tan pequeno que no compensa distinguirlos con nombres.',
        analogy: {
          image:
            'Dos monedas del mismo valor, una de cobre y otra de acero: en la maquina expendedora valen ' +
            'igual (misma quimica) pero pesan distinto (distinta masa).',
          limit:
            'La diferencia de masa entre isotopos SI tiene efectos medibles cuando es grande. El agua ' +
            'pesada (D₂O) hierve a 101,4 °C en lugar de a 100, y los procesos biologicos van mas lentos ' +
            'con ella. En los elementos pesados el efecto es despreciable; en el hidrogeno, no.',
        },
        check: [
          {
            question: '¿En que se diferencian quimicamente el ³⁵Cl y el ³⁷Cl?',
            answer:
              'En nada apreciable. La quimica la hacen los ELECTRONES, y los dos tienen 17. Cambian dos ' +
              'neutrones, que no participan en los enlaces. Por eso ocupan la misma casilla de la tabla ' +
              'periodica: son el mismo elemento.',
          },
        ],
        demo: abundanceDemo('H'),
      },
      {
        id: '2.7',
        requires: ['2.5'],
        title: 'Isobaras',
        body:
          'Nucleidos de elementos DISTINTOS (distinto Z) que tienen el mismo numero masico A. Son ' +
          'sustancias diferentes que pesan casi lo mismo.',
        keyIdea:
          'Iso-baro: «mismo peso». No confundir con isotopo: ahi lo que coincide es el elemento, aqui ' +
          'lo que coincide es A y el elemento es distinto.',
        check: [
          {
            question:
              'El ⁴⁰Ar, el ⁴⁰K y el ⁴⁰Ca pesan practicamente lo mismo. ¿Por que uno es un gas inerte, ' +
              'otro un metal reactivo y el tercero el metal de los huesos?',
            answer:
              'Porque pesar lo mismo no tiene nada que ver con comportarse igual. Lo que comparten es A ' +
              '—40 nucleones— pero su Z es 18, 19 y 20: tienen 18, 19 y 20 protones, y por tanto 18, 19 ' +
              'y 20 electrones. La quimica la deciden los electrones, no la masa. Son tres elementos ' +
              'distintos que da la casualidad de que pesan igual.',
          },
        ],
        demo: isobarsDemo(),
      },
      {
        id: '2.8',
        requires: ['2.5'],
        title: 'Isotonos',
        body:
          'Nucleidos de elementos distintos que tienen el mismo numero de NEUTRONES. Ni el elemento ni ' +
          'el numero masico coinciden: solo N = A − Z.',
        keyIdea:
          'Los tres «iso» se distinguen por lo que comparten: isotopos comparten Z (protones), isobaras ' +
          'comparten A (nucleones), isotonos comparten N (neutrones).',
        check: [
          {
            question:
              'Sin mirar la tabla: ¿que comparten dos isotopos, dos isobaras y dos isotonos? ¿Y cual de ' +
              'los tres parentescos hace que dos nucleidos sean el mismo elemento?',
            answer:
              'Los isotopos comparten Z, los isobaros comparten A y los isotonos comparten N = A − Z. ' +
              'Solo el primero implica ser el mismo elemento, porque la identidad quimica la fija el ' +
              'numero de protones y nada mas. Un truco para no mezclarlos: isoTOpo lleva la P de ' +
              'Protones escondida en «mismo elemento», isoBAro viene de «baros», peso, que es A, y a los ' +
              'isotonos les queda lo que sobra, los neutrones.',
          },
        ],
        demo: isotonesDemo(),
      },
      {
        id: '2.9',
        requires: ['2.6', '1.11'],
        title: 'Abundancia isotopica',
        body:
          'En la naturaleza cada elemento aparece como una mezcla de sus isotopos en proporciones ' +
          'practicamente constantes. La masa atomica que figura en la tabla periodica es la MEDIA ' +
          'PONDERADA de las masas isotopicas por esas abundancias.',
        keyIdea:
          'Aqui esta la respuesta a «¿por que el cloro pesa 35,45 si sus isotopos son 35 y 37?». Porque ' +
          'hay tres veces mas ³⁵Cl que ³⁷Cl, y la media se acerca al mas abundante.',
        pitfall:
          'Ningun atomo de cloro pesa 35,45 u. La masa atomica es una media, y ninguna particula real ' +
          'tiene el valor medio — igual que ninguna familia tiene 1,3 hijos.',
        worked: {
          question:
            'El cobre tiene dos isotopos: ⁶³Cu (62,930 u, 69,15 %) y ⁶⁵Cu (64,928 u, 30,85 %). ' +
            '¿Cual es su masa atomica?',
          steps: [
            {
              text: 'La abundancia en tanto por ciento se pasa a fraccion dividiendo entre 100.',
              math: '69,15 % → 0,6915   ·   30,85 % → 0,3085',
            },
            {
              text: 'Cada isotopo aporta su masa multiplicada por lo abundante que es.',
              math: '62,930 × 0,6915 = 43,516     64,928 × 0,3085 = 20,030',
            },
            { text: 'La masa atomica es la suma de esas aportaciones.', math: '43,516 + 20,030 = 63,546 u' },
            {
              text: 'Comprobacion de sentido: el resultado tiene que caer ENTRE 62,93 y 64,93, y mas cerca del mas abundante. 63,55 esta mas cerca de 62,93. ✓',
            },
          ],
          answer: '63,55 u, que es exactamente lo que figura en la tabla periodica.',
        },
        check: [
          {
            question:
              'El bromo tiene dos isotopos, ⁷⁹Br y ⁸¹Br, y su masa atomica es 79,90. ¿Que te dice ese valor sobre sus abundancias?',
            answer:
              'Que estan casi al 50 % cada uno. El 79,90 cae practicamente en el punto medio entre 79 y ' +
              '81, y la media solo se queda en el centro cuando los dos pesan lo mismo en el reparto. ' +
              'Las abundancias reales son 50,69 % y 49,31 %.',
          },
          {
            question: '¿Cuanto pesa un atomo concreto de cloro?',
            answer:
              'O 34,97 u (si es ³⁵Cl) o 36,97 u (si es ³⁷Cl). NINGUNO pesa 35,45: ese es el valor medio, ' +
              'y ninguna particula real tiene la media, igual que ninguna familia tiene 1,3 hijos.',
          },
        ],
        connects: [
          { label: '2.6 Isotopos', topic: '2.6' },
          { label: '1.11 Peso atomico', mode: 'teoria' },
        ],
        demo: abundanceDemo('Cl'),
      },
      {
        id: '2.10',
        requires: ['2.4', '2.2.1.2'],
        title: 'Tabla periodica',
        body:
          'Los 118 elementos ordenados por numero atomico creciente y colocados de modo que los de ' +
          'propiedades parecidas queden en la misma columna. No es una lista: es una prediccion, y ' +
          'Mendeleiev la uso para dejar huecos y anticipar elementos que aun no se habian descubierto.',
        keyIdea:
          'La periodicidad tiene causa: las propiedades se repiten porque se repite la CONFIGURACION de ' +
          'la capa de valencia. La tabla es la estructura electronica dibujada en dos dimensiones.',
        check: [
          {
            question:
              'Mendeleiev dejo HUECOS en su tabla en lugar de juntar los elementos que conocia. ' +
              '¿Por que fue eso lo que convirtio su tabla en ciencia y no en una lista?',
            answer:
              'Porque un hueco es una PREDICCION comprobable. Al dejarlo, estaba afirmando que existia un ' +
              'elemento aun sin descubrir, y ademas se atrevio a decir cuanto pesaria y como se ' +
              'comportaria, deduciendolo de sus vecinos. Cuando aparecieron el galio, el escandio y el ' +
              'germanio y encajaron con lo predicho, la tabla dejo de ser una clasificacion comoda y paso ' +
              'a ser una teoria que habia arriesgado algo y habia acertado.',
          },
        ],
        demo: periodicStatsDemo(),
        children: [
          {
            id: '2.10.1',
            requires: ['2.10'],
            title: 'Clasificacion de los elementos',
            body:
              'Por comportamiento: METALES (ceden electrones, conducen, brillan, son ductiles), NO ' +
              'METALES (captan electrones, aislantes, fragiles) y METALOIDES, en la frontera, con ' +
              'propiedades intermedias — de ahi que sirvan como semiconductores.',
            keyIdea:
              'La frontera entre metales y no metales es una escalera diagonal que baja desde el boro ' +
              'hasta el astato. Los metaloides son justo los que la tocan.',
            analogy: {
              image:
                'Un metal es como una multitud con el dinero en un fondo comun: los electrones de ' +
                'valencia no pertenecen a ningun atomo concreto y se mueven por todo el material. De ahi ' +
                'que conduzcan, brillen y se puedan estirar sin romperse.',
              limit:
                'La comparacion explica bien la conduccion y la maleabilidad, pero no que unos metales ' +
                'sean duros y otros blandos, ni que el mercurio sea liquido. Eso depende de la fuerza ' +
                'del enlace metalico concreto, y la imagen del fondo comun no lo distingue.',
            },
            check: [
              {
                question: '¿Por que los metaloides sirven para hacer semiconductores y los metales no?',
                answer:
                  'Porque un metal conduce SIEMPRE y un aislante NUNCA, y ninguno de los dos es util para ' +
                  'controlar una senal. El metaloide conduce solo en ciertas condiciones — segun la ' +
                  'temperatura, la luz o las impurezas que se le anadan — y esa conduccion gobernable es ' +
                  'exactamente lo que hace falta para un transistor. Toda la electronica se apoya en el ' +
                  'silicio por eso.',
              },
            ],
          },
          {
            id: '2.10.2',
            requires: ['2.10'],
            title: 'Grupos y periodos',
            body:
              'Los GRUPOS son las 18 columnas: sus elementos tienen la misma configuracion de valencia ' +
              'y por eso se comportan parecido. Los PERIODOS son las 7 filas: indican el nivel de ' +
              'energia mas externo que se esta llenando.',
            keyIdea:
              'El numero de periodo es el numero cuantico n de la capa de valencia, y en los grupos ' +
              'principales el numero de grupo da los electrones de valencia (grupo 1 → 1 electron, ' +
              'grupo 17 → 7). Las dos coordenadas de la tabla son datos electronicos.',
            pitfall:
              'Los lantanidos y actinidos se dibujan aparte solo para que la tabla quepa en una hoja. ' +
              'Su sitio real esta intercalado en los periodos 6 y 7, entre los grupos 3 y 4.',
            worked: {
              question: 'Sin mirar la tabla: ¿en que grupo y periodo esta el azufre (Z = 16)?',
              steps: [
                {
                  text: 'Se escribe la configuracion electronica llenando por orden de energia.',
                  math: '1s² 2s² 2p⁶ 3s² 3p⁴',
                },
                {
                  text: 'El PERIODO es el numero cuantico n mas alto que aparece. Aqui es el 3.',
                  math: 'n maximo = 3 → periodo 3',
                },
                {
                  text: 'Los electrones de valencia son los de esa ultima capa: 2 en el 3s y 4 en el 3p.',
                  math: '3s² 3p⁴ → 6 electrones de valencia',
                },
                {
                  text: 'En los grupos principales del bloque p, el grupo es los electrones de valencia mas 10.',
                  math: '6 + 10 = grupo 16',
                },
              ],
              answer: 'Grupo 16, periodo 3. Y por tener 6 electrones de valencia se comporta como el oxigeno, que esta justo encima.',
            },
            check: [
              {
                question: '¿Por que el sodio y el potasio reaccionan de forma tan parecida?',
                answer:
                  'Porque los dos tienen UN solo electron de valencia (3s¹ el sodio, 4s¹ el potasio), y ' +
                  'la quimica la hacen los electrones externos. Estan en el mismo grupo precisamente por ' +
                  'eso. El potasio reacciona mas violentamente porque su electron esta mas lejos del ' +
                  'nucleo y se suelta con mas facilidad.',
              },
              {
                question: '¿Que tienen en comun todos los elementos del periodo 3?',
                answer:
                  'Que llenan la misma capa, la n = 3. No se parecen en sus propiedades — el sodio es un ' +
                  'metal reactivisimo y el argon un gas inerte — porque el numero de electrones de esa ' +
                  'capa va cambiando. El parecido va por COLUMNAS, no por filas.',
              },
            ],
            connects: [{ label: '2.10 La tabla completa', topic: '2.10' }],
          },
        ],
      },

      // ---------------------------------------------------------------------
      // 2.11 — donde la unidad se cierra sobre si misma
      // ---------------------------------------------------------------------
      {
        id: '2.11',
        requires: ['2.10.2'],
        title: 'Estructura electronica y propiedades periodicas',
        body:
          'Hasta aqui la tabla periodica era un hecho: los elementos se parecen por columnas y nadie ha ' +
          'dicho por que. La respuesta esta en como se colocan los electrones. Un grupo entero comparte ' +
          'propiedades porque comparte la CONFIGURACION de su ultima capa, y las tendencias que recorren ' +
          'la tabla —el tamano, la electronegatividad, el caracter metalico— son consecuencias de esa ' +
          'colocacion.',
        keyIdea:
          'La tabla periodica no ordena elementos: ordena CONFIGURACIONES ELECTRONICAS. Las dos ' +
          'coordenadas, grupo y periodo, son el numero de electrones de valencia y el numero cuantico n. ' +
          'Todo lo demas se sigue de ahi.',
        pitfall:
          'La periodicidad no la produce la masa. Mendeleiev ordeno por peso atomico y le funciono casi ' +
          'siempre, pero tuvo que invertir parejas (el telurio pesa mas que el yodo y va antes) sin saber ' +
          'por que. Lo que manda es Z, y por debajo de Z, la configuracion electronica.',
        demo: trendDemo(),
        check: [
          {
            question:
              'El argon (Z = 18) y el potasio (Z = 19) se diferencian en un solo electron. ¿Por que uno ' +
              'es un gas que no reacciona con nada y el otro un metal que arde en el agua?',
            answer:
              'Porque ese electron estrena una capa. El argon cierra la suya (3s² 3p⁶): para reaccionar ' +
              'tendria que tocar una capa completa, y eso cuesta muchisima energia. El potasio pone su ' +
              'electron n.º 19 en el 4s, solo, lejos del nucleo y apantallado por las 18 cargas de dentro; ' +
              'soltarlo es facilisimo. Un electron de diferencia, pero en una capa distinta.',
          },
        ],
        connects: [
          { label: '2.10.2 Grupos y periodos', topic: '2.10.2' },
          { label: '2.11.1.2 Configuracion electronica', topic: '2.11.1.2' },
        ],
        children: [
          {
            id: '2.11.1',
            requires: ['2.11', '2.2.1.2'],
            title: 'Electrones del atomo',
            body:
              'Los electrones no estan «dando vueltas». Ocupan ORBITALES: regiones del espacio donde la ' +
              'probabilidad de encontrarlos es alta. Un orbital no es una trayectoria ni una caja: es una ' +
              'funcion matematica —la solucion de la ecuacion de Schrodinger para ese atomo— y su forma ' +
              'no la ha elegido nadie.',
            figure: 'orbitales',
            keyIdea:
              'La pregunta «¿donde esta el electron?» no tiene respuesta. La que si la tiene es «¿que ' +
              'probabilidad hay de encontrarlo aqui?», y esa probabilidad, dibujada, es el orbital.',
            analogy: {
              image:
                'Como la foto de un ventilador en marcha: no se ve donde esta cada aspa, se ve una zona ' +
                'borrosa mas oscura donde el aspa pasa mas rato.',
              limit:
                'La comparacion falla en lo esencial. El aspa SI esta en un sitio concreto en cada ' +
                'instante y la borrosidad es culpa de la camara. El electron no tiene posicion definida ' +
                'entre medidas: la indeterminacion no es del aparato, es del electron.',
            },
            pitfall:
              'Los dos colores de las figuras NO son cargas ni dos clases de electron: son el SIGNO de ' +
              'la funcion de onda, positivo o negativo, como la cresta y el valle de una onda. Importa ' +
              'porque al juntarse dos atomos los lobulos del mismo signo se suman (enlace) y los de signo ' +
              'contrario se cancelan.',
            check: [
              {
                question: '¿Que significa que la nube del 1s «no termina» en ningun sitio?',
                answer:
                  'Que la probabilidad de encontrar el electron disminuye al alejarse pero nunca llega a ' +
                  'cero exactamente. A un metro del nucleo es ridiculamente pequena, no nula. Por eso la ' +
                  'esfera que se dibuja en los libros es un convenio: el contorno que encierra el 90 % de ' +
                  'la probabilidad. Con otro porcentaje saldria otra esfera.',
              },
            ],
            connects: [{ label: '2.2.1.2 De donde viene este modelo', topic: '2.2.1.2' }],
            children: [
              {
                id: '2.11.1.1',
                requires: ['2.11.1'],
                title: 'Numeros cuanticos',
                body:
                  'Para senalar un electron dentro de un atomo hacen falta cuatro numeros, y ni uno mas: ' +
                  'n (nivel y tamano), l (forma), m_l (orientacion) y m_s (espin). No son etiquetas ' +
                  'inventadas para clasificar: salen como constantes de la propia ecuacion, igual que al ' +
                  'resolver la ecuacion de una cuerda vibrante salen los armonicos.',
                keyIdea:
                  'Los tres primeros numeros identifican un ORBITAL; el cuarto distingue a los dos ' +
                  'electrones que caben dentro. Por eso no hacen falta cinco ni bastan tres.',
                pitfall:
                  'Las restricciones no son arbitrarias: l va de 0 a n−1 y m_l de −l a +l. De ahi que no ' +
                  'exista un orbital 1p (con n = 1, l solo puede valer 0) ni un 2d. Cuando en un ejercicio ' +
                  'sale una combinacion imposible, la respuesta no es «no se»: es «ese electron no puede ' +
                  'existir», y se dice cual de las reglas rompe.',
                analogy: {
                  image:
                    'Como una direccion postal: n es la ciudad, l el barrio, m_l la calle y m_s el ' +
                    'numero del portal, que solo puede ser el 1 o el 2.',
                  limit:
                    'En una direccion postal los cuatro datos son independientes y cualquiera vale con ' +
                    'cualquiera. Aqui no: l depende de n y m_l depende de l. Y, sobre todo, una direccion ' +
                    'senala UN punto; los numeros cuanticos senalan una region de probabilidad.',
                },
                demo: quantumDemo('N'),
                worked: {
                  question:
                    '¿Cuantos electrones caben en la capa n = 3, y por que exactamente esos?',
                  steps: [
                    {
                      text: 'Con n = 3, el numero l puede valer 0, 1 y 2. Son tres subcapas: 3s, 3p y 3d.',
                      math: 'l = 0, 1, 2',
                    },
                    {
                      text: 'Cada l tiene 2l+1 orientaciones posibles, que son los valores de m_l.',
                      math: 'l=0 → 1 orbital · l=1 → 3 · l=2 → 5',
                    },
                    { text: 'Se suman los orbitales de las tres subcapas.', math: '1 + 3 + 5 = 9 orbitales' },
                    {
                      text: 'En cada orbital caben dos electrones, y solo dos, porque m_s tiene dos valores.',
                      math: '9 × 2 = 18 electrones',
                    },
                    {
                      text: 'Y 18 es 2·3². La regla 2n² no es un dato suelto: es el resultado de esta suma.',
                      math: '2n² = 2·3² = 18 ✓',
                    },
                  ],
                  answer:
                    'Dieciocho. Y lo importante no es el numero, sino que sale de contar orientaciones y ' +
                    'espines: si m_s tuviera tres valores, la tabla periodica tendria otra forma.',
                },
                check: [
                  {
                    question:
                      '¿Puede existir un electron con n = 2, l = 2, m_l = 0, m_s = +1/2? ¿Y con n = 3, ' +
                      'l = 1, m_l = −2?',
                    answer:
                      'Ninguno de los dos. En el primero l = 2 con n = 2 es imposible: l llega como mucho ' +
                      'hasta n−1 = 1. Seria un orbital «2d», que no existe. En el segundo, con l = 1 los ' +
                      'valores de m_l son −1, 0 y +1: el −2 se sale del rango. Los dos fallan por la ' +
                      'misma razon de fondo, que cada numero acota al siguiente.',
                  },
                  {
                    question:
                      'Si dos electrones estan en el mismo orbital 2p_z, ¿en que se diferencian?',
                    answer:
                      'Solo en el espin. Comparten n = 2, l = 1 y m_l = 0 —los tres numeros que definen ' +
                      'el orbital— asi que el cuarto tiene que ser distinto: uno +1/2 y el otro −1/2. Si ' +
                      'tambien coincidiera el espin serian el mismo electron, y eso es lo que prohibe ' +
                      'Pauli. Ahi esta el tope de dos.',
                  },
                ],
                connects: [
                  { label: '2.11.1.3 El principio de Pauli', topic: '2.11.1.3' },
                  { label: '2.10.2 Grupos y periodos', topic: '2.10.2' },
                ],
              },
              {
                id: '2.11.1.2',
                requires: ['2.11.1.1'],
                title: 'Configuracion electronica',
                body:
                  'La configuracion electronica es la lista de que orbitales estan ocupados y con cuantos ' +
                  'electrones: 1s² 2s² 2p⁴ para el oxigeno. Se escribe llenando por orden de energia ' +
                  'creciente, y la forma abreviada sustituye el nucleo interno por el gas noble anterior ' +
                  '—[He] 2s² 2p⁴— porque lo que hace quimica es la capa de fuera.',
                keyIdea:
                  'Sabiendo la configuracion de un elemento se sabe su grupo, su periodo, su valencia, sus ' +
                  'estados de oxidacion probables y si es magnetico. Es el dato del que cuelga todo lo ' +
                  'demas de la unidad.',
                pitfall:
                  'El orden en que se LLENAN los orbitales y el orden en que se ESCRIBEN no coinciden. El ' +
                  '4s se llena antes que el 3d, pero la configuracion se escribe 3d antes que 4s porque se ' +
                  'ordena por n. Y al ionizar se quitan primero los del 4s, no los ultimos que entraron: ' +
                  'el Fe²⁺ es [Ar] 3d⁶, no [Ar] 3d⁴ 4s².',
                demo: configDemo(['H', 'C', 'O', 'Na', 'S', 'Ca', 'Fe', 'Cr', 'Cu', 'Br']),
                worked: {
                  question: '¿Cual es la configuracion del azufre (Z = 16) y que dice de el?',
                  steps: [
                    {
                      text: 'Se reparten los 16 electrones por orden de energia: 1s, 2s, 2p, 3s, 3p.',
                      math: '2 + 2 + 6 + 2 + 4 = 16',
                    },
                    { text: 'Queda la configuracion completa.', math: '1s² 2s² 2p⁶ 3s² 3p⁴' },
                    {
                      text: 'Los diez primeros son exactamente el neon, asi que se abrevia.',
                      math: '[Ne] 3s² 3p⁴',
                    },
                    {
                      text: 'La ultima capa es la n = 3 y tiene 2 + 4 = 6 electrones.',
                      math: 'periodo 3 · 6 electrones de valencia → grupo 16',
                    },
                    {
                      text: 'Le faltan dos para completar el octeto, de ahi su estado de oxidacion mas comun.',
                      math: 'S + 2e⁻ → S²⁻',
                    },
                  ],
                  answer:
                    '[Ne] 3s² 3p⁴. De una sola linea salen el periodo, el grupo, la valencia y el ion que ' +
                    'forma. Por eso se empieza siempre por aqui.',
                },
                check: [
                  {
                    question:
                      'El cromo deberia ser [Ar] 3d⁴ 4s² y es [Ar] 3d⁵ 4s¹. ¿Es un error de la regla o ' +
                      'un error del cromo?',
                    answer:
                      'Ninguno de los dos: es que la regla es una aproximacion. El orden de llenado que se ' +
                      'ensena vale casi siempre, pero las energias del 3d y el 4s son casi iguales, y ' +
                      'cuando pasar un electron de 4s a 3d deja la subcapa d SEMILLENA —cinco orbitales ' +
                      'con uno cada uno— el conjunto queda mas estable. La naturaleza no sigue la regla: ' +
                      'la regla intenta describir a la naturaleza, y aqui se queda corta. El cobre hace lo ' +
                      'mismo para dejar el 3d¹⁰ completo.',
                  },
                ],
                connects: [
                  { label: '2.11.1.3 Las tres reglas del llenado', topic: '2.11.1.3' },
                  { label: '2.10.1 Clasificacion por bloques', topic: '2.10.1' },
                ],
              },
              {
                id: '2.11.1.3',
                requires: ['2.11.1.2'],
                title: 'Principio de exclusion de Pauli · Regla de Hund · Principio de Aufbau',
                body:
                  'Tres reglas, y cada una contesta a una pregunta distinta. AUFBAU: ¿en que orden se ' +
                  'ocupan los orbitales? De menor a mayor energia. PAULI: ¿cuantos electrones caben en ' +
                  'uno? Dos, y con espines opuestos, porque no puede haber dos electrones con los cuatro ' +
                  'numeros iguales. HUND: ¿y si hay varios orbitales con la misma energia? Primero uno en ' +
                  'cada uno, todos con el mismo espin, y solo despues se emparejan.',
                figure: 'llenado',
                keyIdea:
                  'Hund no es una manía de la naturaleza: dos electrones en el mismo orbital ocupan la ' +
                  'misma region del espacio y se repelen. Repartirlos entre orbitales que apuntan a ' +
                  'direcciones distintas los aleja, y eso cuesta menos energia. La figura lo ensena mejor ' +
                  'que cualquier frase.',
                pitfall:
                  'Aufbau da el orden de ENERGIA, no el orden de los numeros. El 4s entra antes que el 3d ' +
                  'porque tiene menos energia, aunque n sea mayor. La regla de Madelung (menor n+l primero, ' +
                  'y a igualdad, menor n) lo resume, y aun asi falla en el cromo y en el cobre.',
                analogy: {
                  image:
                    'Como sentarse en un autobus medio vacio: la gente ocupa primero los asientos dobles ' +
                    'libres, uno por fila, y solo cuando no queda ninguno se sienta al lado de alguien.',
                  limit:
                    'El pasajero elige; el electron no. Y la razon de fondo no es solo la incomodidad de ' +
                    'ir juntos: que los espines salgan PARALELOS se debe a un efecto cuantico, el ' +
                    'intercambio, que no tiene ningun equivalente en el autobus.',
                },
                demo: fillingDemo(['B', 'C', 'N', 'O', 'F', 'Ne', 'Cr', 'Cu']),
                worked: {
                  question:
                    'Reparte los cuatro electrones 2p del oxigeno entre sus tres orbitales, paso a paso.',
                  steps: [
                    {
                      text: 'Hay tres orbitales 2p con la misma energia. Por Hund, primero uno en cada uno.',
                      math: '2p [↑ ] [↑ ] [↑ ]  (tres electrones)',
                    },
                    {
                      text: 'Los tres con el mismo espin: es lo que dice Hund, y ademas asi no violan Pauli, ' +
                        'porque tienen m_l distinto.',
                      math: 'm_l = −1, 0, +1 → los tres son distintos ✓',
                    },
                    {
                      text: 'Queda un cuarto electron y ya no hay orbital vacio: toca emparejar.',
                      math: '2p [↑↓] [↑ ] [↑ ]',
                    },
                    {
                      text: 'El que se empareja entra con el espin CONTRARIO, porque comparte n, l y m_l ' +
                        'con el que ya estaba.',
                      math: 'm_s = +1/2 y −1/2 → Pauli se cumple ✓',
                    },
                  ],
                  answer:
                    'Dos electrones apareados y dos desapareados. Esos dos sueltos son exactamente lo que ' +
                    'hace paramagnetico al oxigeno, y es el apartado siguiente.',
                },
                check: [
                  {
                    question:
                      '¿Por que el carbono tiene 2 electrones desapareados y no 0, si sus dos electrones ' +
                      '2p cabrian de sobra en un mismo orbital?',
                    answer:
                      'Porque caber no es lo mismo que convenir. Metidos en el mismo orbital ocuparian la ' +
                      'misma zona del espacio y se repelerian; repartidos en dos orbitales perpendiculares ' +
                      '—uno en el 2p_x y otro en el 2p_y— se estorban mucho menos, y ademas el estado con ' +
                      'espines paralelos es mas estable por el termino de intercambio. Esos dos electrones ' +
                      'desapareados son la razon de que el carbono forme cuatro enlaces.',
                  },
                  {
                    question: '¿Que regla rompe la configuracion 2p [↑↓] [  ] [↑ ]?',
                    answer:
                      'La de Hund. Pauli se cumple —los dos del orbital lleno tienen espines opuestos— y ' +
                      'Aufbau tambien, porque no se ha saltado ningun nivel. Lo que falla es el reparto: ' +
                      'habiendo un orbital vacio de la misma energia, el segundo electron deberia haber ' +
                      'ido alli en lugar de emparejarse. Esa configuracion existe, pero es un estado ' +
                      'EXCITADO: tiene mas energia que el fundamental.',
                  },
                ],
                connects: [
                  { label: '2.11.1.1 Los cuatro numeros', topic: '2.11.1.1' },
                  { label: '2.11.1.4 Lo que se puede medir con un iman', topic: '2.11.1.4' },
                ],
              },
              {
                id: '2.11.1.4',
                requires: ['2.11.1.3'],
                title: 'Propiedades magneticas',
                body:
                  'Cada electron desapareado deja un momento magnetico sin compensar, y eso se puede ' +
                  'MEDIR: basta con pesar una muestra dentro y fuera de un campo magnetico. Una sustancia ' +
                  'con electrones desapareados es PARAMAGNETICA y el iman la atrae; una con todos ' +
                  'apareados es DIAMAGNETICA y la repele muy debilmente.',
                figure: 'magnetismo',
                keyIdea:
                  'Es la comprobacion experimental de todo el apartado. Las reglas de llenado predicen ' +
                  'cuantos electrones quedan desapareados, y una balanza lo confirma. Si Hund fuera falsa, ' +
                  'el oxigeno no se pegaria a los polos de un iman.',
                pitfall:
                  'Paramagnetico no es lo mismo que magnetico en el sentido de la nevera. Eso es ' +
                  'FERROMAGNETISMO, y necesita ademas que los momentos de millones de atomos se alineen ' +
                  'entre si y se queden alineados. Solo lo hacen unos pocos solidos —hierro, cobalto, ' +
                  'niquel— y por encima de cierta temperatura dejan de hacerlo. El aluminio es ' +
                  'paramagnetico y no se pega a nada.',
                analogy: {
                  image:
                    'Como una sala llena de brujulas. Si estan emparejadas apuntando en sentidos ' +
                    'opuestos, de lejos no se nota nada; si sobran algunas sueltas, la sala entera ' +
                    'responde al acercar un iman.',
                  limit:
                    'Una brujula apunta a algun sitio siempre. El momento del electron no tiene una ' +
                    'direccion definida hasta que se mide, y la cancelacion de dos espines opuestos no es ' +
                    'geometrica sino cuantica.',
                },
                demo: magnetismDemo(),
                worked: {
                  question: '¿Es el ion Fe³⁺ mas o menos paramagnetico que el Fe²⁺?',
                  steps: [
                    {
                      text: 'Se parte del hierro neutro y se quitan electrones, primero los del 4s.',
                      math: 'Fe [Ar] 3d⁶ 4s² → Fe²⁺ [Ar] 3d⁶',
                    },
                    {
                      text: 'Con seis electrones en cinco orbitales d, por Hund hay uno doble y cuatro simples.',
                      math: 'Fe²⁺ 3d [↑↓][↑ ][↑ ][↑ ][↑ ] → 4 desapareados',
                    },
                    {
                      text: 'El Fe³⁺ pierde uno mas, y el que se va es justo el que estaba emparejado.',
                      math: 'Fe³⁺ [Ar] 3d⁵ → [↑ ][↑ ][↑ ][↑ ][↑ ]',
                    },
                    {
                      text: 'Quedan cinco orbitales con un electron cada uno: el maximo posible en el bloque d.',
                      math: 'Fe³⁺ → 5 desapareados',
                    },
                  ],
                  answer:
                    'Mas. El Fe³⁺ tiene CINCO desapareados frente a los cuatro del Fe²⁺: quitar un ' +
                    'electron ha aumentado el magnetismo, que es justo lo contrario de lo que sugiere la ' +
                    'intuicion. La subcapa semillena 3d⁵ es ademas especialmente estable, y por eso el ' +
                    'hierro(III) es tan comun.',
                },
                check: [
                  {
                    question:
                      'El cinc y el cobre son vecinos en la tabla. ¿Cual de los dos responde a un iman y ' +
                      'por que?',
                    answer:
                      'El cobre, aunque muy poco. Su configuracion es [Ar] 3d¹⁰ 4s¹: el 3d esta completo y ' +
                      'aparea todos sus electrones, pero queda ese 4s¹ solitario — un electron ' +
                      'desapareado, luego paramagnetico. El cinc es [Ar] 3d¹⁰ 4s²: absolutamente todo ' +
                      'apareado, cero desapareados, diamagnetico. Un electron de diferencia cambia la ' +
                      'respuesta.',
                  },
                  {
                    question:
                      'Si el hierro metalico se pega a un iman, ¿por que no le pasa lo mismo a una ' +
                      'disolucion de una sal de hierro(III), que tiene cinco electrones desapareados por ion?',
                    answer:
                      'Porque son dos fenomenos distintos. La disolucion SI es paramagnetica y una balanza ' +
                      'lo detecta, pero el efecto es debilisimo: cada ion responde por su cuenta y la ' +
                      'agitacion termica los desordena. En el hierro solido los momentos se alinean unos ' +
                      'con otros y actuan en bloque — eso es el ferromagnetismo, y es una propiedad del ' +
                      'SOLIDO, no del atomo suelto.',
                  },
                ],
                connects: [
                  { label: '2.11.1.3 De donde salen los desapareados', topic: '2.11.1.3' },
                  { label: '2.11 Las propiedades periodicas', topic: '2.11' },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Elementos con datos isotopicos curados, para la interfaz. */
export const ISOTOPE_ELEMENTS = elementsWithIsotopes();
