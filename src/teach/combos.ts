/**
 * UNIDAD 4 — COMBINACIONES QUIMICAS.
 *
 * LA UNIDAD QUE CIERRA EL CIRCULO.
 *
 * Las tres anteriores van de DENTRO hacia fuera: que es la materia, como es un
 * atomo, como se unen dos atomos. Esta va al reves. Parte de lo que se mide en
 * un laboratorio —una masa, unos porcentajes— y vuelve a la formula. Es la
 * unica del temario donde la formula NO se sabe de antemano.
 *
 * DE QUE MOTORES SALE
 *
 *   core/nomenclature/inorganic.ts   los tres sistemas de nombre, y CUAL ES
 *                                    CUAL. Las tablas del 4.1 no estan
 *                                    escritas: se piden al motor formula a
 *                                    formula, con sus huecos incluidos.
 *   core/formula/composition.ts      `arityOf` cuenta ELEMENTOS DISTINTOS, que
 *                                    es de lo que va el 4.1.1 al 4.1.3, y
 *                                    `molarMass` da el desglose con los
 *                                    porcentajes, que es el 4.2.3 entero.
 *   core/formula/fromPercent.ts      el camino de vuelta: de porcentajes a
 *                                    formula minima y de ahi a la molecular.
 *                                    Se escribio para esta unidad porque no
 *                                    existia; todo lo demas ya estaba.
 *
 * EL ERROR QUE ESTA UNIDAD EXISTE PARA MATAR
 * Contar atomos en lugar de elementos. El acido sulfurico tiene SIETE atomos y
 * es TERNARIO; el bicarbonato tiene SEIS y es CUATERNARIO. Quien cuenta atomos
 * ordena los dos al reves. Por eso el 4.1.1 no empieza por una definicion sino
 * por una tabla con las dos cuentas una al lado de la otra, y por eso la figura
 * 3D de la unidad dibuja columnas y no moleculas: lo que hay que ver es el
 * recuento.
 *
 * LO QUE ESTA UNIDAD DECLARA QUE NO TIENE (§32)
 * El motor de nomenclatura no cubre los compuestos de coordinacion, los
 * organicos ni las sales con dos cationes poliatomicos: se ha comprobado que
 * (NH₄)₂SO₄ sale sin nombre. Eso se ensena como hueco, no se disimula — y el
 * apartado 4.1 muestra en su tabla las casillas vacias que devuelve el motor.
 */

import { molarMass, arityOf, atomCount, ARITY_LABEL_ES } from '../core/formula/composition.js';
import { empiricalFromPercent, molecularFromPercent, percentOf } from '../core/formula/fromPercent.js';
import { nameFormula } from '../core/nomenclature/inorganic.js';
import { parseFormula } from '../core/formula/parse.js';
import { classify } from '../core/classify.js';
import { formatPlainUnicode } from '../core/formula/render.js';
import type { Composition } from '../core/types.js';
import type { TheoryTopic } from './theory.js';

// ---------------------------------------------------------------------------
// Demostraciones
// ---------------------------------------------------------------------------

/** 4.1 — los tres sistemas, con sus huecos a la vista. */
export interface NamingDemo {
  readonly kind: 'naming';
  readonly title: string;
  readonly note: string;
  readonly rows: readonly {
    readonly formula: string;
    readonly pretty: string;
    readonly family: string;
    readonly stock: string | null;
    readonly systematic: string | null;
    readonly traditional: string | null;
  }[];
  /** Formulas a las que el motor NO pone nombre, y por que (§32). */
  readonly refused: readonly { readonly formula: string; readonly pretty: string; readonly why: string }[];
}

/** 4.1.1–4.1.3 — atomos frente a elementos: la cuenta que decide el nombre. */
export interface ArityDemo {
  readonly kind: 'arity';
  readonly rows: readonly {
    readonly formula: string;
    readonly pretty: string;
    readonly atoms: number;
    readonly elements: number;
    readonly label: string;
    readonly arity: string;
    /** true cuando contar atomos daria un orden distinto: son las filas que ensenan. */
    readonly trap: boolean;
  }[];
}

/** 4.2.1 y 4.2.2 — de los porcentajes a la formula, paso a paso. */
export interface EmpiricalDemo {
  readonly kind: 'empirical';
  readonly title: string;
  readonly sample: string;
  readonly steps: readonly {
    readonly symbol: string;
    readonly percent: number;
    readonly atomicMass: number;
    readonly moles: number;
    readonly ratio: number;
    readonly scaled: number;
    readonly subscript: number;
  }[];
  readonly multiplier: number;
  /** En crudo, para comparar; y con subindices, para mostrar. */
  readonly empiricalFormula: string;
  readonly empiricalPretty: string;
  readonly empiricalMass: number;
  /** Solo en el 4.2.2: la masa molar medida y el entero que sale. */
  readonly molar: {
    readonly given: number;
    readonly factorRaw: number;
    readonly factor: number;
    readonly molecularFormula: string;
    readonly molecularPretty: string;
    readonly molecularMass: number;
  } | null;
  /** Lo que el motor rechaza, con el motivo exacto. */
  readonly refused: readonly { readonly label: string; readonly why: string }[];
}

/** 4.2.2 — tres sustancias distintas con porcentajes identicos. */
export interface SameRatioDemo {
  readonly kind: 'same-ratio';
  readonly percents: readonly { readonly symbol: string; readonly percent: number }[];
  readonly rows: readonly {
    readonly formula: string;
    readonly pretty: string;
    readonly name: string;
    readonly molarMass: number;
    readonly factor: number;
    readonly empirical: string;
  }[];
}

/** 4.2.3 — el desglose de la masa molar, que ES la composicion porcentual. */
export interface PercentDemo {
  readonly kind: 'percent';
  readonly rows: readonly {
    readonly formula: string;
    readonly pretty: string;
    readonly total: number;
    readonly parts: readonly {
      readonly symbol: string;
      readonly count: number;
      readonly atomicMass: number;
      readonly subtotal: number;
      readonly percent: number;
    }[];
    readonly sum: number;
  }[];
}

export type ComboDemo =
  | NamingDemo
  | ArityDemo
  | EmpiricalDemo
  | SameRatioDemo
  | PercentDemo;

// ---------------------------------------------------------------------------
// Constructores
// ---------------------------------------------------------------------------

const pretty = (f: string): string => formatPlainUnicode(f);

function compositionOf(formula: string): Composition | null {
  const p = parseFormula(formula);
  return p.ok ? p.value.composition : null;
}

/** Etiqueta legible de la familia a la que pertenece un compuesto. */
const FAMILY_ES: Record<string, string> = {
  element: 'Sustancia simple',
  'basic-oxide': 'Oxido basico (metal + O)',
  'acidic-oxide': 'Oxido acido / anhidrido (no metal + O)',
  'amphoteric-oxide': 'Oxido anfotero',
  peroxide: 'Peroxido',
  hydroxide: 'Hidroxido',
  'binary-acid': 'Hidracido',
  oxoacid: 'Oxoacido',
  'binary-salt': 'Sal binaria',
  oxosalt: 'Oxosal',
  'acid-salt': 'Sal acida',
  'metal-hydride': 'Hidruro metalico',
  'nonmetal-hydride': 'Hidruro no metalico',
  'binary-covalent': 'Binario covalente',
  organic: 'Organico',
  coordination: 'Compuesto de coordinacion',
  other: 'Sin clasificar',
};

function namingRows(formulas: readonly string[]) {
  const rows = [];
  for (const formula of formulas) {
    const composition = compositionOf(formula);
    if (!composition) continue;
    const c = classify(formula, composition, 0);
    const n = nameFormula(formula);
    rows.push({
      formula,
      pretty: pretty(formula),
      family: FAMILY_ES[c.compoundClass] ?? c.compoundClass,
      stock: n?.stock ?? null,
      systematic: n?.systematic ?? null,
      traditional: n?.traditional ?? null,
    });
  }
  return rows;
}

/**
 * 4.1 — la panoramica.
 *
 * Las filas se piden al motor, incluidas las que vuelven con huecos. Un Fe₂O₃
 * trae los tres nombres; un NaCl no trae el tradicional, porque el sodio tiene
 * un solo estado de oxidacion y el adjetivo -oso/-ico no tendria nada que
 * distinguir. Ese hueco es informacion, no un fallo, y por eso se muestra.
 */
function namingDemo(): NamingDemo {
  return {
    kind: 'naming',
    title: 'La misma sustancia, dicha de tres maneras',
    note:
      'Las casillas vacias no son un fallo del programa: son sustancias que en ese sistema no tienen ' +
      'nombre propio. El sodio solo actua con +1, asi que «cloruro sodico» no necesita distinguir nada ' +
      'y la nomenclatura tradicional no aporta ahi.',
    rows: namingRows([
      'Fe2O3', 'FeO', 'CuO', 'CaO', 'CO2', 'SO3',
      'NaCl', 'CaCl2', 'NaH',
      'HCl', 'H2S',
      'NaOH', 'Fe(OH)3',
      'H2SO4', 'HNO3', 'HClO4',
      'CaCO3', 'KNO3',
      'NaHCO3',
    ]),
    refused: [
      {
        formula: '(NH4)2SO4',
        pretty: pretty('(NH4)2SO4'),
        why:
          'El motor no resuelve una sal con DOS cationes poliatomicos: no sabe separar los dos amonios ' +
          'del sulfato, y sin esa separacion no puede nombrarla. Devuelve vacio en lugar de arriesgar.',
      },
      {
        formula: 'CH4',
        pretty: pretty('CH4'),
        why:
          'Es un compuesto organico, y este motor es de nomenclatura INORGANICA. El metano se nombra ' +
          'con las reglas de los hidrocarburos, que son otras y no estan implementadas.',
      },
      {
        formula: 'CO',
        pretty: pretty('CO'),
        why:
          'En Stock y sistematica si tiene nombre —oxido de carbono(II), monoxido de carbono—, pero el ' +
          'tradicional «anhidrido carbonoso» no esta en la tabla curada de oxoacidos, y esa tabla es la ' +
          'unica fuente de la que se derivan los anhidridos. Antes de arreglarlo, aqui salia «oxido ' +
          'carboso», que no es una palabra.',
      },
    ],
  };
}

/** Un subconjunto de la panoramica, para cada apartado de aridad. */
function namingDemoFor(title: string, note: string, formulas: readonly string[]): NamingDemo {
  return { kind: 'naming', title, note, rows: namingRows(formulas), refused: [] };
}

/**
 * 4.1.1–4.1.3 — la cuenta que decide el nombre.
 *
 * `trap` marca las filas donde contar atomos llevaria a otra conclusion. Es lo
 * que convierte la tabla en un argumento en lugar de una lista: H₂SO₄ con siete
 * atomos es ternario y NaHCO₃ con seis es cuaternario, uno debajo del otro.
 */
function arityDemo(): ArityDemo {
  const formulas = ['NaCl', 'CaO', 'CO2', 'H2O', 'NaOH', 'CaCO3', 'H2SO4', 'HNO3', 'NaHCO3', 'NaHSO4'];
  const rows = [];
  for (const formula of formulas) {
    const composition = compositionOf(formula);
    if (!composition) continue;
    const atoms = atomCount(composition);
    const elements = composition.size;
    rows.push({
      formula,
      pretty: pretty(formula),
      atoms,
      elements,
      label: ARITY_LABEL_ES[arityOf(composition)],
      arity: arityOf(composition),
      trap: atoms !== elements,
    });
  }
  return { kind: 'arity', rows };
}

/** 4.2.1 — glucosa: de los porcentajes a CH₂O. */
function empiricalDemo(): EmpiricalDemo {
  const entries = [
    { symbol: 'C', percent: 40.0 },
    { symbol: 'H', percent: 6.71 },
    { symbol: 'O', percent: 53.29 },
  ];
  const r = empiricalFromPercent(entries);
  if (!r.ok) throw new Error(`La demostracion del 4.2.1 no deberia fallar: ${r.error}`);

  return {
    kind: 'empirical',
    title: 'Analisis de una muestra: 40,00 % C · 6,71 % H · 53,29 % O',
    sample:
      'Se parte de 100 g de muestra. Ese es el truco que hace todo lo demas facil: en 100 g, cada ' +
      'porcentaje se lee directamente como gramos.',
    steps: r.value.steps,
    multiplier: r.value.multiplier,
    empiricalFormula: r.value.empiricalFormula,
    empiricalPretty: pretty(r.value.empiricalFormula),
    empiricalMass: r.value.empiricalMass,
    molar: null,
    refused: [
      {
        label: 'C 52 % · H 13 % · O 35 %',
        why:
          empiricalFromPercent([
            { symbol: 'C', percent: 52 },
            { symbol: 'H', percent: 13 },
            { symbol: 'O', percent: 35 },
          ]).ok
            ? 'aceptada'
            : 'Las proporciones no caen en enteros ni multiplicando por 2, 3, 4, 5 o 6. El motor se ' +
              'niega a redondear: redondear un subindice es inventarse una sustancia.',
      },
      {
        label: 'C 40 % · H 6 % (y nada mas)',
        why:
          'Suman 46 %. Falta mas de la mitad de la muestra, asi que falta un elemento del analisis. ' +
          'Con datos que no describen la muestra, la formula tampoco la describiria.',
      },
    ],
  };
}

/** 4.2.2 — el mismo analisis, ahora con la masa molar. */
function molecularDemo(): EmpiricalDemo {
  const entries = [
    { symbol: 'C', percent: 40.0 },
    { symbol: 'H', percent: 6.71 },
    { symbol: 'O', percent: 53.29 },
  ];
  const M = 180.16;
  const r = molecularFromPercent(entries, M);
  if (!r.ok) throw new Error(`La demostracion del 4.2.2 no deberia fallar: ${r.error}`);

  const bad = molecularFromPercent(entries, 100);

  return {
    kind: 'empirical',
    title: 'El mismo analisis, mas un dato: la masa molar es 180,16 g/mol',
    sample:
      'La formula minima ya estaba: CH₂O. Lo que falta es saber cuantas veces se repite ese patron en ' +
      'una molecula, y eso no lo puede decir el analisis elemental — solo la masa molar.',
    steps: r.value.steps,
    multiplier: r.value.multiplier,
    empiricalFormula: r.value.empiricalFormula,
    empiricalPretty: pretty(r.value.empiricalFormula),
    empiricalMass: r.value.empiricalMass,
    molar: {
      given: M,
      factorRaw: r.value.factorRaw,
      factor: r.value.factor,
      molecularFormula: r.value.molecularFormula,
      molecularPretty: pretty(r.value.molecularFormula),
      molecularMass: r.value.molecularMass,
    },
    refused: [
      {
        label: 'Los mismos porcentajes, pero con M = 100 g/mol',
        why: bad.ok ? 'aceptada' : bad.error,
      },
    ],
  };
}

/**
 * 4.2.2 — la razon de ser del apartado, en una tabla.
 *
 * Los porcentajes NO se escriben: se calculan con `percentOf` a partir de la
 * glucosa, y despues se comprueba que las tres formulas dan los mismos. Si
 * alguna diera otros, la tabla lo ensenaria en lugar de esconderlo.
 */
function sameRatioDemo(): SameRatioDemo {
  const reference = compositionOf('C6H12O6')!;
  const pc = percentOf(reference);
  if (!pc.ok) throw new Error('No se pudo calcular la composicion porcentual de la glucosa.');

  const entries: { formula: string; name: string }[] = [
    { formula: 'CH2O', name: 'Formaldehido' },
    { formula: 'C2H4O2', name: 'Acido acetico (vinagre)' },
    { formula: 'C6H12O6', name: 'Glucosa' },
  ];

  const rows = [];
  for (const e of entries) {
    const composition = compositionOf(e.formula);
    if (!composition) continue;
    const mass = molarMass(composition);
    if (!mass.ok) continue;
    const own = percentOf(composition);
    if (!own.ok) continue;
    const derived = empiricalFromPercent(own.value);
    rows.push({
      formula: e.formula,
      pretty: pretty(e.formula),
      name: e.name,
      molarMass: mass.value.total,
      factor: Math.round(mass.value.total / 30.026),
      empirical: derived.ok ? pretty(derived.value.empiricalFormula) : '—',
    });
  }

  return {
    kind: 'same-ratio',
    percents: pc.value.map((p) => ({ symbol: p.symbol, percent: p.percent })),
    rows,
  };
}

/** 4.2.3 — el desglose que ES la composicion porcentual. */
function percentDemo(): PercentDemo {
  const rows = [];
  for (const formula of ['H2O', 'CaCO3', 'Fe2O3', 'H2SO4', 'C6H12O6']) {
    const composition = compositionOf(formula);
    if (!composition) continue;
    const mass = molarMass(composition);
    if (!mass.ok) continue;
    rows.push({
      formula,
      pretty: pretty(formula),
      total: mass.value.total,
      parts: mass.value.perElement.map((p) => ({
        symbol: p.symbol,
        count: p.count,
        atomicMass: p.atomicMass,
        subtotal: p.subtotal,
        percent: p.massPercent,
      })),
      sum: mass.value.perElement.reduce((a, p) => a + p.massPercent, 0),
    });
  }
  return { kind: 'percent', rows };
}

// ---------------------------------------------------------------------------
// El temario
// ---------------------------------------------------------------------------

export function unitCombinaciones(): TheoryTopic<ComboDemo> {
  return {
    id: '4',
    title: 'Combinaciones quimicas',
    body:
      'Como se ESCRIBE y como se DICE un compuesto, y como se llega a su formula partiendo de lo unico ' +
      'que un laboratorio mide de verdad: masas. Las tres unidades anteriores iban de dentro hacia ' +
      'fuera; esta va al reves, del dato a la formula.',
    children: [
      {
        id: '4.1',
        title: 'Notacion y nomenclatura de compuestos inorganicos',
        requires: ['3.2.1', '3.2.2'],
        body:
          'Una formula es una notacion: dice QUE elementos hay y EN QUE PROPORCION. El nombre es otra ' +
          'cosa, y en espanol hay tres sistemas conviviendo a la vez. No son tres opciones de gusto: ' +
          'cada uno codifica una informacion distinta, y conviene saber cual dice que.',
        figure: 'aridad',
        keyIdea:
          'Stock pone el numero de oxidacion entre parentesis y en romanos: oxido de hierro(III). La ' +
          'sistematica cuenta atomos con prefijos: trioxido de dihierro. La tradicional lo codifica en ' +
          'la terminacion: oxido ferrico. Las tres nombran el Fe₂O₃.',
        pitfall:
          'Creer que la nomenclatura tradicional esta «mal» porque IUPAC la desaconseja. Sigue siendo la ' +
          'que aparece en la mitad de los enunciados de examen y en casi todas las etiquetas ' +
          'industriales, asi que hay que saber leerla. Lo que no conviene es INVENTARLA: sus ' +
          'terminaciones tienen excepciones que no siguen ninguna regla.',
        analogy: {
          image:
            'Como las tres maneras de dar una direccion: coordenadas GPS, «el tercer portal de la calle ' +
            'Mayor» y «la casa de los Garcia». Las tres llevan al mismo sitio y cada una sirve mejor ' +
            'para una cosa.',
          limit:
            'La comparacion se rompe en que aqui los tres sistemas no son igual de fiables. La ' +
            'sistematica siempre se puede construir contando; la tradicional tiene nombres que hay que ' +
            'saberse y que no se deducen — por eso el motor los tiene en una tabla escrita a mano y, ' +
            'cuando una sustancia no esta en ella, prefiere no dar nombre.',
        },
        demo: namingDemo(),
        gap:
          'Este motor es de nomenclatura INORGANICA. No cubre los compuestos organicos, los de ' +
          'coordinacion ni las sales con dos cationes poliatomicos como (NH₄)₂SO₄, y cuando no sabe ' +
          'nombrar algo deja la casilla vacia en lugar de arriesgar un nombre.',
        worked: {
          question: '¿Como se nombra el Fe₂O₃ en los tres sistemas, y de donde sale cada nombre?',
          steps: [
            {
              text: 'Primero, el numero de oxidacion del hierro. El oxigeno actua con −2 y hay tres: −6 en total. Los dos hierros tienen que sumar +6.',
              math: '2 · x + 3 · (−2) = 0 → x = +3',
            },
            {
              text: 'Stock escribe ese numero en romanos entre parentesis. Es el sistema que dice el estado de oxidacion sin que haya que calcularlo.',
              math: 'oxido de hierro(III)',
            },
            {
              text: 'La sistematica no mira estados de oxidacion: cuenta atomos y les pone prefijo. Tres oxigenos y dos hierros.',
              math: 'trioxido de dihierro',
            },
            {
              text: 'La tradicional codifica el estado en la terminacion. El hierro tiene dos estados (+2 y +3); al mayor le toca -ico, sobre la raiz latina «ferr».',
              math: 'oxido ferrico',
            },
          ],
          answer:
            'Los tres nombran la misma sustancia y los tres se derivan, no se memorizan — salvo la raiz ' +
            'latina «ferr», que si hay que saberla. Fijate en que la sistematica es la unica que se ' +
            'puede construir sin saber quimica: basta contar.',
        },
        check: [
          {
            question:
              'El CaO y el Fe₂O₃ son los dos oxidos metalicos. ¿Por que el primero se llama «oxido de ' +
              'calcio» sin parentesis y el segundo lleva «(III)»?',
            answer:
              'Porque el calcio solo actua con +2 y el hierro puede actuar con +2 o con +3. El ' +
              'parentesis de Stock existe para RESOLVER una ambiguedad; donde no hay ambiguedad, sobra. ' +
              'Por eso en la tabla veras que las casillas tradicionales del calcio y del sodio estan ' +
              'vacias: el adjetivo -oso/-ico tampoco tendria nada que distinguir.',
          },
          {
            question:
              'Una tabla te da «anhidrido carbonico» para el CO₂ y «oxido ferrico» para el Fe₂O₃. Los ' +
              'dos son oxidos. ¿Por que uno es anhidrido y el otro no?',
            answer:
              'Porque el carbono es un NO METAL y el hierro un metal. El oxido de un no metal reacciona ' +
              'con agua dando un acido —CO₂ + H₂O da acido carbonico— y por eso se le llama anhidrido, ' +
              'que significa «sin agua»: es el acido al que le falta el agua. El oxido de un metal da ' +
              'una base. La palabra no es un capricho: dice de que lado del comportamiento acido-base ' +
              'esta la sustancia.',
          },
        ],
        connects: [
          { label: '3.2.1 Por que un metal y un no metal acaban en sal', topic: '3.2.1' },
          { label: '4.2 Y como se llega a la formula si no te la dan', topic: '4.2' },
        ],
        children: [
          {
            id: '4.1.1',
            title: 'Combinaciones binarias',
            requires: ['4.1'],
            body:
              'DOS elementos distintos. Solo dos, aunque haya muchos atomos: el H₂SO₄ no es binario por ' +
              'tener hidrogeno y azufre, porque tambien tiene oxigeno. Las familias binarias son los ' +
              'oxidos (elemento + O), los hidruros (elemento + H), los hidracidos (H + no metal de los ' +
              'grupos 16 y 17) y las sales binarias (metal + no metal).',
            figure: 'aridad',
            keyIdea:
              'Binario cuenta ELEMENTOS, no atomos. El Fe₂O₃ tiene cinco atomos y es binario; el agua ' +
              'tiene tres y tambien lo es.',
            pitfall:
              'El error numero uno de toda la unidad: contar atomos. Si cuentas atomos, el Fe₂O₃ te ' +
              'parecera «de cinco» y no existe tal categoria. Mira la figura: cuenta COLUMNAS.',
            demo: namingDemoFor(
              'Las cuatro familias binarias',
              'Fijate en que el oxido de un metal (CaO, Fe₂O₃) y el de un no metal (CO₂, SO₃) se ' +
                'nombran distinto en tradicional: los primeros son oxidos, los segundos anhidridos.',
              ['CaO', 'Fe2O3', 'CO2', 'SO3', 'NaH', 'CaH2', 'HCl', 'H2S', 'NaCl', 'CaCl2'],
            ),
            worked: {
              question: '¿Cuantos elementos tiene el Fe₂O₃? ¿Y cuantos atomos? ¿Es binario?',
              steps: [
                { text: 'Elementos distintos: hierro y oxigeno.', math: '{Fe, O} → 2 elementos' },
                { text: 'Atomos: dos de hierro mas tres de oxigeno.', math: '2 + 3 = 5 atomos' },
                {
                  text: 'La aridad la decide el primer numero, no el segundo.',
                  math: '2 elementos → BINARIO',
                },
              ],
              answer:
                'Binario, con cinco atomos. Las dos cuentas son distintas y solo una decide el nombre. ' +
                'Es exactamente la distincion que la figura dibuja: dos columnas, cinco esferas.',
            },
            check: [
              {
                question:
                  '¿Es el agua oxigenada (H₂O₂) una combinacion binaria? Tiene cuatro atomos.',
                answer:
                  'Si, binaria: solo hay dos elementos, hidrogeno y oxigeno. Los cuatro atomos no ' +
                  'cambian nada. Lo que si la distingue del agua es la PROPORCION —uno a uno en vez de ' +
                  'dos a uno—, y eso la convierte en otra sustancia con otras propiedades, que es ' +
                  'justamente la ley de las proporciones multiples del 1.8.3.',
              },
            ],
            connects: [{ label: '1.8.3 Misma pareja, otra proporcion, otra sustancia', topic: '1.8.3' }],
          },
          {
            id: '4.1.2',
            title: 'Combinaciones ternarias',
            requires: ['4.1.1'],
            body:
              'TRES elementos distintos. Las familias son los hidroxidos (metal + OH), los oxoacidos ' +
              '(H + no metal + O) y las oxosales (metal + no metal + O), que salen de sustituir el ' +
              'hidrogeno de un oxoacido por un metal.',
            figure: 'aridad',
            keyIdea:
              'Casi todas las ternarias llevan oxigeno, y no por casualidad: el oxigeno es el elemento ' +
              'que convierte un binario en un ternario al meterse en medio. Hidroxido, oxoacido y ' +
              'oxosal son las tres formas de que eso pase.',
            pitfall:
              'Confundir el oxoacido con la oxosal. H₂SO₄ y CaSO₄ tienen los dos el grupo sulfato; la ' +
              'diferencia es quien lo acompana. Con hidrogeno es un acido; con un metal, una sal. Y la ' +
              'sal se obtiene del acido cambiando lo uno por lo otro.',
            demo: namingDemoFor(
              'Las tres familias ternarias',
              'El sulfato aparece dos veces: con hidrogeno delante es acido sulfurico, con calcio es ' +
                'sulfato de calcio. Mismo anion, distinta sustancia.',
              ['NaOH', 'Ca(OH)2', 'Fe(OH)3', 'H2SO4', 'HNO3', 'H2CO3', 'HClO4', 'CaCO3', 'KNO3', 'CaSO4'],
            ),
            worked: {
              question: '¿Como se pasa del acido sulfurico al sulfato de calcio?',
              steps: [
                { text: 'El acido sulfurico es H₂SO₄: dos hidrogenos sujetando un grupo sulfato.', math: 'H₂SO₄ → 2 H⁺ + SO₄²⁻' },
                { text: 'El sulfato tiene carga −2, asi que necesita +2 para quedar neutro.', math: 'SO₄²⁻ necesita +2' },
                { text: 'El calcio aporta exactamente +2 con un solo ion. Encaja uno a uno.', math: 'Ca²⁺ + SO₄²⁻ → CaSO₄' },
                {
                  text: 'Los tres elementos siguen siendo tres: calcio, azufre y oxigeno. Ternario.',
                  math: '{Ca, S, O} → 3 elementos',
                },
              ],
              answer:
                'Se sustituyen los hidrogenos por un metal que aporte la misma carga. Por eso el sodio, ' +
                'que solo aporta +1, necesita DOS iones para el mismo sulfato: Na₂SO₄. La formula no se ' +
                'elige, se deduce de las cargas.',
            },
            check: [
              {
                question:
                  'El NaNO₃ y el NaNO₂ son los dos ternarios y los dos sales de sodio. ¿En que se ' +
                  'diferencian, y como lo dice el nombre?',
                answer:
                  'En el estado de oxidacion del nitrogeno: +5 en el primero y +3 en el segundo. El ' +
                  'nombre lo dice con la terminacion del anion: nitrATO para el mayor, nitrITO para el ' +
                  'menor. Es la misma logica -ico/-oso de los acidos de los que proceden, acido nitrico ' +
                  'y acido nitroso, trasladada a la sal.',
              },
            ],
          },
          {
            id: '4.1.3',
            title: 'Combinaciones cuaternarias',
            requires: ['4.1.2'],
            body:
              'CUATRO elementos distintos. La familia tipica son las sales acidas: una oxosal a la que ' +
              'le queda un hidrogeno sin sustituir. El bicarbonato de sodio, NaHCO₃, tiene sodio, ' +
              'hidrogeno, carbono y oxigeno.',
            figure: 'aridad',
            keyIdea:
              'Una sal acida es un acido al que solo se le ha sustituido PARTE de los hidrogenos. Por ' +
              'eso hace falta un acido con dos o mas: del H₂CO₃ salen el carbonato (los dos fuera) y el ' +
              'hidrogenocarbonato (uno dentro, uno fuera).',
            pitfall:
              'Aqui es donde contar atomos falla mas escandalosamente. El NaHCO₃ tiene SEIS atomos y es ' +
              'cuaternario; el H₂SO₄ tiene SIETE y es ternario. Quien cuente atomos los ordenara al ' +
              'reves. La figura pone los dos uno al lado del otro precisamente por esto.',
            demo: arityDemo(),
            worked: {
              question:
                'Ordena H₂SO₄ y NaHCO₃ por numero de atomos, y luego por aridad. ¿Sale el mismo orden?',
              steps: [
                { text: 'Atomos del acido sulfurico: 2 + 1 + 4.', math: 'H₂SO₄ → 7 atomos' },
                { text: 'Atomos del bicarbonato: 1 + 1 + 1 + 3.', math: 'NaHCO₃ → 6 atomos' },
                { text: 'Por atomos, el sulfurico va por delante.', math: '7 > 6' },
                { text: 'Elementos del sulfurico: hidrogeno, azufre, oxigeno.', math: '{H, S, O} → 3 → ternario' },
                { text: 'Elementos del bicarbonato: sodio, hidrogeno, carbono, oxigeno.', math: '{Na, H, C, O} → 4 → cuaternario' },
              ],
              answer:
                'NO sale el mismo orden: se invierte. Por atomos gana el sulfurico, por aridad gana el ' +
                'bicarbonato. Esto demuestra que las dos cuentas son independientes, y que solo la ' +
                'segunda tiene que ver con el nombre.',
            },
            check: [
              {
                question:
                  'Si una sal acida es «una oxosal con un hidrogeno sin sustituir», ¿puede existir una ' +
                  'sal acida del acido nitrico, HNO₃?',
                answer:
                  'No. El acido nitrico solo tiene UN hidrogeno: o lo sustituyes y tienes nitrato, o no ' +
                  'lo sustituyes y sigue siendo el acido. No hay estado intermedio. Las sales acidas ' +
                  'necesitan un acido con dos o mas hidrogenos, como el carbonico o el sulfurico — por ' +
                  'eso los ejemplos son siempre bicarbonatos y bisulfatos.',
              },
            ],
            connects: [{ label: '4.2.3 Y cuanto pesa cada elemento dentro', topic: '4.2.3' }],
          },
        ],
      },
      {
        id: '4.2',
        title: 'Formulas',
        requires: ['4.1', '1.12'],
        body:
          'Hasta aqui la formula venia dada y se analizaba. Ahora al reves: lo unico que hay es lo que ' +
          'mide un laboratorio —cuanta masa de cada elemento hay en una muestra— y de ahi hay que sacar ' +
          'la formula. Es lo que hace un quimico cuando encuentra una sustancia nueva.',
        figure: 'minima',
        keyIdea:
          'Hay tres formulas distintas y no significan lo mismo. La PORCENTUAL dice cuanta masa aporta ' +
          'cada elemento. La MINIMA dice la proporcion de atomos en numeros enteros pequenos. La ' +
          'MOLECULAR dice cuantos atomos hay de verdad en una molecula.',
        pitfall:
          'Pensar que la formula minima y la molecular son «la misma con mas detalle». Son respuestas a ' +
          'preguntas distintas: la minima es una PROPORCION y la molecular un RECUENTO. Por eso el ' +
          'cloruro de sodio tiene minima (NaCl) y no tiene molecular: no hay moleculas que contar.',
        demo: sameRatioDemo(),
        check: [
          {
            question:
              'Un analisis de una muestra desconocida da 40,00 % de carbono, 6,71 % de hidrogeno y ' +
              '53,29 % de oxigeno. ¿Que sustancia es?',
            answer:
              'No se puede saber. Esos porcentajes son compatibles con el formaldehido, con el acido ' +
              'acetico y con la glucosa —y con cualquier otra que tenga la misma proporcion—, porque ' +
              'los tres dan EXACTAMENTE los mismos numeros. El analisis elemental da la proporcion, no ' +
              'el recuento. Para elegir hace falta la masa molar, y de ahi sale el apartado 4.2.2.',
          },
          {
            question: '¿Por que la formula porcentual no es «otra formula» sino otra pregunta?',
            answer:
              'Porque no habla de atomos sino de MASA. La minima y la molecular cuentan particulas; la ' +
              'porcentual las pesa. En el agua, dos de cada tres atomos son hidrogeno y sin embargo el ' +
              'hidrogeno es el 11 % de la masa. Las dos afirmaciones son ciertas y dicen cosas ' +
              'distintas.',
          },
        ],
        connects: [
          { label: '1.12 De donde sale la masa molar', topic: '1.12' },
          { label: '3.2.1 Por que una sal no tiene moleculas', topic: '3.2.1' },
        ],
        children: [
          {
            id: '4.2.1',
            title: 'Minima',
            requires: ['4.2'],
            body:
              'La formula minima, o empirica, es la proporcion de atomos escrita con los numeros ' +
              'enteros MAS PEQUENOS posibles. Se obtiene del analisis elemental, que es lo unico que se ' +
              'mide directamente, y el procedimiento tiene cuatro pasos siempre iguales.',
            keyIdea:
              'Tomar 100 g de muestra. Ese es el truco entero: en 100 g cada porcentaje se lee como ' +
              'gramos sin convertir nada, y a partir de ahi todo es dividir.',
            pitfall:
              'Redondear una proporcion que no es entera. Si sale 1,5, NO es 2: es 3/2, y hay que ' +
              'multiplicar todo por dos. Si sale 1,33 es 4/3 y se multiplica por tres. Redondear ahi es ' +
              'cambiar de sustancia — y por eso el motor de esta aplicacion prefiere rechazar el ' +
              'calculo antes que redondear.',
            analogy: {
              image:
                'Como reducir una receta: si lleva 4 huevos y 8 vasos de harina, la proporcion es 1 a ' +
                '2. Esa es su «formula minima», y sirve para cualquier cantidad.',
              limit:
                'La receta se puede hacer a cualquier escala; una molecula, no. Existen la glucosa ' +
                '(seis veces CH₂O) y el acido acetico (dos veces), pero no existe «tres veces y media». ' +
                'El multiplicador tiene que ser un numero entero, y esa es justamente la razon de que ' +
                'el apartado siguiente pueda funcionar.',
            },
            demo: empiricalDemo(),
            worked: {
              question:
                'Una muestra da 69,94 % de hierro y 30,06 % de oxigeno. ¿Cual es su formula minima?',
              steps: [
                {
                  text: 'En 100 g hay 69,94 g de hierro y 30,06 g de oxigeno. Se pasan a moles dividiendo por la masa atomica.',
                  math: 'Fe: 69,94 / 55,845 = 1,2524 mol',
                },
                { text: 'Lo mismo con el oxigeno.', math: 'O: 30,06 / 15,999 = 1,8789 mol' },
                {
                  text: 'Se dividen los dos por el menor de ellos, que es el del hierro.',
                  math: 'Fe: 1,000 · O: 1,500',
                },
                {
                  text: 'Uno y medio no es entero. Se multiplican los DOS por 2, que es lo que convierte el medio en entero.',
                  math: 'Fe: 2 · O: 3',
                },
              ],
              answer:
                'Fe₂O₃, la hematita. Fijate en el paso decisivo: 1,500 no se redondea a 2, se multiplica ' +
                'por 2. Si se hubiera redondeado habria salido FeO, que existe pero es otra sustancia ' +
                'distinta con otro color y otras propiedades.',
            },
            check: [
              {
                question:
                  'Haciendo este calculo te sale una proporcion de 1 : 1,33. ¿Que haces?',
                answer:
                  'Multiplicar todo por 3, que da 3 : 4. El 1,33 es 4/3 disfrazado de decimal. La regla ' +
                  'practica: 0,5 pide multiplicar por 2; 0,33 y 0,67, por 3; 0,25 y 0,75, por 4; 0,2, ' +
                  'por 5. Si despues de probar hasta 6 sigue sin salir entero, el problema esta en los ' +
                  'datos, no en el metodo.',
              },
            ],
            tryIt: { label: 'Calcular masas molares en el laboratorio', mode: 'build' },
          },
          {
            id: '4.2.2',
            title: 'Molecular',
            requires: ['4.2.1'],
            body:
              'La formula molecular dice cuantos atomos hay REALMENTE en una molecula. Siempre es la ' +
              'minima multiplicada por un numero entero, y para saber cual hace falta un dato que el ' +
              'analisis elemental no da: la masa molar.',
            figure: 'minima',
            keyIdea:
              'n = M / M(minima), y tiene que salir entero. Una molecula contiene un numero entero de ' +
              'veces su formula minima: no existe una molecula con 2,4 veces el patron.',
            pitfall:
              'Creer que el analisis elemental basta para identificar una sustancia. No basta, y esta es ' +
              'la leccion del apartado: el formaldehido, el acido acetico y la glucosa dan EXACTAMENTE ' +
              'los mismos porcentajes. Un analisis que diga «40,00 % C» es compatible con las tres, y ' +
              'una de ellas es un conservante de cadaveres y otra es azucar.',
            demo: molecularDemo(),
            worked: {
              question:
                'Los porcentajes dan CH₂O y la masa molar medida es 180,16 g/mol. ¿Cual es la formula ' +
                'molecular?',
              steps: [
                {
                  text: 'Primero, cuanto pesa un mol de la formula minima: un carbono, dos hidrogenos y un oxigeno.',
                  math: 'M(CH₂O) = 12,011 + 2·1,008 + 15,999 = 30,026 g/mol',
                },
                {
                  text: 'Se divide la masa molar real entre esa. El cociente dice cuantas veces cabe el patron.',
                  math: 'n = 180,16 / 30,026 = 6,000',
                },
                { text: 'Sale seis, entero. Se multiplican TODOS los subindices por seis.', math: 'C₁·₆ H₂·₆ O₁·₆' },
              ],
              answer:
                'C₆H₁₂O₆: glucosa. Y el detalle que hay que mirar es que n saliera 6,000 y no 5,8: si no ' +
                'hubiera salido entero, el error estaria en la masa molar o en los porcentajes, porque ' +
                'una molecula no puede contener 5,8 veces su formula minima.',
            },
            check: [
              {
                question:
                  '¿Por que el NaCl no tiene formula molecular, si tiene formula minima?',
                answer:
                  'Porque no hay moleculas de NaCl que contar. Es un cristal de iones alternos, como se ' +
                  'vio en el 3.2.1: cada sodio esta rodeado de seis cloruros y al reves, hasta el borde ' +
                  'del grano. La formula NaCl expresa una PROPORCION —un sodio por cada cloro— y eso es ' +
                  'una formula minima. Preguntar cuantos atomos tiene «una molecula» de sal es ' +
                  'preguntar por algo que no existe.',
              },
            ],
            connects: [{ label: '3.2.1 El cristal, no la molecula', topic: '3.2.1' }],
          },
          {
            id: '4.2.3',
            title: 'Porcentual',
            requires: ['4.2'],
            body:
              'La composicion porcentual dice que tanto por ciento de la masa total aporta cada ' +
              'elemento. Es el camino contrario al del 4.2.1 —de la formula a los porcentajes— y es lo ' +
              'que permite comprobar un analisis, calcular la riqueza de un mineral o saber cuanto ' +
              'hierro se puede sacar de una tonelada de hematita.',
            keyIdea:
              'No sale de contar atomos sino de PESARLOS. En el agua hay el doble de hidrogenos que de ' +
              'oxigenos y aun asi el hidrogeno es solo el 11 % de la masa, porque cada oxigeno pesa ' +
              'dieciseis veces mas que cada hidrogeno.',
            pitfall:
              'Confundir proporcion de ATOMOS con proporcion de MASA. Son dos cosas distintas y casi ' +
              'nunca coinciden. «Dos de cada tres atomos del agua son hidrogeno» es cierto; «el agua es ' +
              'dos tercios hidrogeno» es falso: es un 11 % en masa.',
            demo: percentDemo(),
            worked: {
              question: '¿Que porcentaje de la masa del agua es hidrogeno?',
              steps: [
                { text: 'Masa de los dos hidrogenos.', math: '2 · 1,008 = 2,016 g/mol' },
                { text: 'Masa del oxigeno.', math: '1 · 15,999 = 15,999 g/mol' },
                { text: 'Masa molar total del agua.', math: '2,016 + 15,999 = 18,015 g/mol' },
                { text: 'La parte del hidrogeno sobre el total, en tanto por ciento.', math: '2,016 / 18,015 · 100 = 11,19 %' },
              ],
              answer:
                '11,19 %. Dos de cada tres ATOMOS son hidrogeno, pero solo uno de cada nueve GRAMOS. La ' +
                'diferencia entre contar y pesar es todo este apartado, y es la misma distincion del ' +
                '1.12: el mol cuenta particulas, la balanza mide masa.',
            },
            check: [
              {
                question:
                  'Una mina vende hematita (Fe₂O₃). ¿Cuanto hierro hay en una tonelada, como maximo?',
                answer:
                  'El 69,94 % de la masa del Fe₂O₃ es hierro —lo puedes leer en la tabla de arriba—, ' +
                  'asi que una tonelada de hematita PURA contiene 699,4 kg de hierro. Y el «como maximo» ' +
                  'de la pregunta es lo importante: un mineral real nunca es hematita pura, lleva ' +
                  'ganga. Ese porcentaje es el techo teorico, y compararlo con lo que se obtiene de ' +
                  'verdad es como se mide la riqueza de una mena.',
              },
            ],
            connects: [{ label: '1.12 Peso molecular', topic: '1.12' }],
            tryIt: { label: 'Ver el desglose de cualquier formula', mode: 'build' },
          },
        ],
      },
    ],
  };
}
