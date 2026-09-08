/**
 * UNIDAD 1 — LA MATERIA.
 *
 * El temario completo, con una diferencia respecto a un libro: donde una ley
 * se puede DEMOSTRAR calculando, se demuestra calculando.
 *
 * POR QUE ESTO NO ES UN TEXTO
 * Escribir «la masa se conserva» es una afirmacion que el lector tiene que
 * creerse. Contar los atomos de los dos lados de una ecuacion que el propio
 * balanceador ha resuelto, y ensenar la tabla, es otra cosa: es la ley
 * ocurriendo delante. Lo mismo con las proporciones definidas (el porcentaje
 * en masa sale del desglose de la masa molar) y con las multiples (el cociente
 * entre las masas combinadas se calcula y sale entero, sin que nadie lo haya
 * escrito a mano).
 *
 * Cada demostracion se recalcula a partir de los datos, asi que no puede
 * desincronizarse: si manana cambia una masa atomica, cambia el numero que se
 * ensena.
 *
 * LO QUE ESTE MODULO DECLARA QUE NO TIENE (§32)
 * El sandbox trabaja con SUSTANCIAS PURAS. No hay modelo de mezclas: no se
 * puede simular una disolucion al 30 % ni separar sus componentes. El apartado
 * 1.6 lo explica igualmente, porque forma parte del temario, pero dice
 * abiertamente que ahi el motor no acompana.
 */

import { getElement } from '../data/elements.js';
import { getReaction } from '../data/reactions.js';
import { parseFormula } from '../core/formula/parse.js';
import { molarMass } from '../core/formula/composition.js';
import { formatPlainUnicode } from '../core/formula/render.js';
import type { Composition } from '../core/types.js';

/**
 * Numero de Avogadro.
 *
 * Desde la redefinicion del SI de 2019 NO es una medida: es una constante
 * EXACTA por definicion. El mol se define como la cantidad que contiene
 * exactamente este numero de entidades. Por eso no lleva incertidumbre.
 */
export const AVOGADRO = 6.02214076e23;

// ---------------------------------------------------------------------------
// Demostraciones calculadas
// ---------------------------------------------------------------------------

export interface AtomCountRow {
  readonly symbol: string;
  readonly left: number;
  readonly right: number;
  readonly balanced: boolean;
}

export interface ConservationDemo {
  readonly kind: 'conservation';
  readonly equation: string;
  readonly rows: readonly AtomCountRow[];
  readonly massLeft: number;
  readonly massRight: number;
}

export interface DefiniteProportionsDemo {
  readonly kind: 'definite';
  readonly formula: string;
  readonly display: string;
  readonly total: number;
  readonly rows: readonly {
    readonly symbol: string;
    readonly count: number;
    readonly subtotal: number;
    readonly percent: number;
  }[];
  /** Dos muestras de tamano distinto con el mismo reparto. */
  readonly samples: readonly { readonly grams: number; readonly parts: readonly { symbol: string; grams: number }[] }[];
}

export interface MultipleProportionsDemo {
  readonly kind: 'multiple';
  readonly fixedElement: string;
  readonly variableElement: string;
  readonly rows: readonly {
    readonly formula: string;
    readonly display: string;
    /** Gramos del elemento variable por gramo del fijo. */
    readonly perGram: number;
    /** Ese valor normalizado al menor de la serie. */
    readonly relative: number;
    readonly integer: number;
  }[];
  readonly ratioText: string;
}

export interface GayLussacDemo {
  readonly kind: 'gay-lussac';
  readonly equation: string;
  readonly volumes: readonly { readonly formula: string; readonly display: string; readonly volumes: number; readonly side: 'izquierda' | 'derecha' }[];
  readonly ratioText: string;
}

export interface MoleDemo {
  readonly kind: 'mole';
  readonly formula: string;
  readonly display: string;
  readonly molarMass: number;
  readonly molecules: number;
  readonly atoms: readonly { readonly symbol: string; readonly perMolecule: number; readonly moles: number; readonly atoms: number }[];
  readonly totalAtoms: number;
}

export type TheoryDemo =
  | ConservationDemo
  | DefiniteProportionsDemo
  | MultipleProportionsDemo
  | GayLussacDemo
  | MoleDemo;

/** Suma los atomos de un lado de la ecuacion, con sus coeficientes. */
function countSide(terms: readonly { formula: string; coefficient: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const term of terms) {
    const parsed = parseFormula(term.formula);
    if (!parsed.ok) continue;
    for (const [symbol, count] of parsed.value.composition) {
      out.set(symbol, (out.get(symbol) ?? 0) + count * term.coefficient);
    }
  }
  return out;
}

function massOfSide(terms: readonly { formula: string; coefficient: number }[]): number {
  let total = 0;
  for (const term of terms) {
    const parsed = parseFormula(term.formula);
    if (!parsed.ok) continue;
    const m = molarMass(parsed.value.composition);
    if (m.ok) total += m.value.total * term.coefficient;
  }
  return total;
}

/**
 * LEY DE CONSERVACION DE LA MATERIA, contada.
 *
 * No se afirma que la masa se conserve: se cuentan los atomos de cada elemento
 * a los dos lados de una ecuacion que el balanceador resolvio por su cuenta, y
 * se ensena que coinciden. Si no coincidieran, la reaccion no habria pasado el
 * arranque del modulo de datos.
 */
export function conservationDemo(reactionId: string): ConservationDemo | null {
  const reaction = getReaction(reactionId);
  if (!reaction) return null;

  const left = countSide(reaction.equation.reactants);
  const right = countSide(reaction.equation.products);
  const symbols = [...new Set([...left.keys(), ...right.keys()])];

  const side = (terms: readonly { formula: string; coefficient: number }[]): string =>
    terms
      .map((t) => `${t.coefficient > 1 ? t.coefficient + ' ' : ''}${formatPlainUnicode(t.formula)}`)
      .join(' + ');

  return {
    kind: 'conservation',
    equation: `${side(reaction.equation.reactants)} → ${side(reaction.equation.products)}`,
    rows: symbols.map((symbol) => ({
      symbol,
      left: left.get(symbol) ?? 0,
      right: right.get(symbol) ?? 0,
      balanced: (left.get(symbol) ?? 0) === (right.get(symbol) ?? 0),
    })),
    massLeft: massOfSide(reaction.equation.reactants),
    massRight: massOfSide(reaction.equation.products),
  };
}

/**
 * LEY DE LAS PROPORCIONES DEFINIDAS, calculada.
 *
 * El reparto en masa de un compuesto no depende del tamano de la muestra. Se
 * calcula el porcentaje de cada elemento y se aplica a dos muestras de tamano
 * muy distinto para que se vea que los porcentajes son los mismos.
 */
export function definiteProportionsDemo(formula: string): DefiniteProportionsDemo | null {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return null;
  const mass = molarMass(parsed.value.composition);
  if (!mass.ok) return null;

  const rows = mass.value.perElement.map((e) => ({
    symbol: e.symbol,
    count: e.count,
    subtotal: e.subtotal,
    percent: e.massPercent,
  }));

  const samples = [10, 250].map((grams) => ({
    grams,
    parts: rows.map((r) => ({ symbol: r.symbol, grams: (grams * r.percent) / 100 })),
  }));

  return {
    kind: 'definite',
    formula,
    display: formatPlainUnicode(formula),
    total: mass.value.total,
    rows,
    samples,
  };
}

/**
 * Aproxima un numero real por la fraccion de denominador pequeno mas cercana.
 *
 * Hace falta porque la ley de las proporciones multiples afirma que el
 * cociente es una razon de numeros ENTEROS PEQUENOS, y las masas atomicas
 * tienen decimales: el cociente sale 1,4999 y hay que reconocer el 3/2. El
 * limite de 12 en el denominador es deliberado — si hiciera falta uno mayor,
 * la razon ya no seria «de numeros pequenos» y la ley no se estaria cumpliendo.
 */
function smallFraction(value: number, maxDenominator = 12): { num: number; den: number; error: number } | null {
  let best: { num: number; den: number; error: number } | null = null;
  for (let den = 1; den <= maxDenominator; den++) {
    const num = Math.round(value * den);
    if (num === 0) continue;
    const error = Math.abs(value - num / den);
    if (best === null || error < best.error) best = { num, den, error };
  }
  return best && best.error < 0.02 ? best : null;
}

/**
 * LEY DE LAS PROPORCIONES MULTIPLES, calculada.
 *
 * Cuando dos elementos forman varios compuestos, las masas de uno que se
 * combinan con una masa fija del otro estan en razon de numeros enteros
 * pequenos. Se toman las formulas que se pasen, se fija un gramo del primer
 * elemento y se calcula cuanto del segundo le acompana en cada compuesto.
 *
 * Devuelve null si las formulas no comparten exactamente dos elementos: la ley
 * no habla de otra cosa, y forzarla seria inventarse el enunciado.
 */
export function multipleProportionsDemo(formulas: readonly string[]): MultipleProportionsDemo | null {
  if (formulas.length < 2) return null;

  const compositions: Composition[] = [];
  for (const f of formulas) {
    const parsed = parseFormula(f);
    if (!parsed.ok || parsed.value.composition.size !== 2) return null;
    compositions.push(parsed.value.composition);
  }

  // Los dos elementos tienen que ser los mismos en todos.
  const symbols = [...compositions[0]!.keys()];
  for (const c of compositions) {
    if (symbols.some((s) => !c.has(s))) return null;
  }
  const [fixed, variable] = symbols as [string, string];
  const massFixed = getElement(fixed)?.atomicMass;
  const massVariable = getElement(variable)?.atomicMass;
  if (massFixed === undefined || massVariable === undefined) return null;

  const perGram = compositions.map(
    (c) => (c.get(variable)! * massVariable) / (c.get(fixed)! * massFixed),
  );
  const smallest = Math.min(...perGram);

  const rows = formulas.map((f, i) => {
    const relative = perGram[i]! / smallest;
    const fraction = smallFraction(relative);
    return {
      formula: f,
      display: formatPlainUnicode(f),
      perGram: perGram[i]!,
      relative,
      integer: fraction ? fraction.num / fraction.den : relative,
    };
  });

  // Se lleva la serie a enteros multiplicando por el minimo comun de los
  // denominadores: 1 : 1,5 se muestra como 2 : 3, que es lo que dice la ley.
  const fractions = rows.map((r) => smallFraction(r.relative));
  if (fractions.some((f) => f === null)) return null;
  const lcm = fractions.reduce((acc, f) => {
    const den = f!.den;
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    return (acc * den) / gcd(acc, den);
  }, 1);
  const integers = fractions.map((f) => (f!.num * lcm) / f!.den);

  return {
    kind: 'multiple',
    fixedElement: fixed,
    variableElement: variable,
    rows: rows.map((r, i) => ({ ...r, integer: integers[i]! })),
    ratioText: integers.join(' : '),
  };
}

/**
 * LEY DE GAY-LUSSAC DE LOS VOLUMENES DE COMBINACION.
 *
 * Cuando todos los participantes son gases medidos en las mismas condiciones,
 * sus volumenes estan en la misma razon que los coeficientes de la ecuacion.
 * Y esa razon la calculo el balanceador, no una tabla.
 *
 * Es donde encaja el principio de Avogadro: los volumenes van como los moles
 * porque volumenes iguales de gases distintos contienen el mismo numero de
 * moleculas.
 */
export function gayLussacDemo(reactionId: string): GayLussacDemo | null {
  const reaction = getReaction(reactionId);
  if (!reaction) return null;

  const volumes = [
    ...reaction.equation.reactants.map((t) => ({
      formula: t.formula,
      display: formatPlainUnicode(t.formula),
      volumes: t.coefficient,
      side: 'izquierda' as const,
    })),
    ...reaction.equation.products.map((t) => ({
      formula: t.formula,
      display: formatPlainUnicode(t.formula),
      volumes: t.coefficient,
      side: 'derecha' as const,
    })),
  ];

  const side = (s: 'izquierda' | 'derecha'): string =>
    volumes.filter((v) => v.side === s).map((v) => v.volumes).join(' : ');

  return {
    kind: 'gay-lussac',
    equation: `${reaction.equation.reactants.map((t) => `${t.coefficient > 1 ? t.coefficient + ' ' : ''}${formatPlainUnicode(t.formula)}`).join(' + ')} → ${reaction.equation.products.map((t) => `${t.coefficient > 1 ? t.coefficient + ' ' : ''}${formatPlainUnicode(t.formula)}`).join(' + ')}`,
    volumes,
    ratioText: `${side('izquierda')} → ${side('derecha')}`,
  };
}

/**
 * MOL DE ATOMOS FRENTE A MOL DE MOLECULAS.
 *
 * La confusion clasica: un mol de agua no es un mol de atomos. Son 3 moles de
 * atomos — dos de hidrogeno y uno de oxigeno — y por tanto 3·6,022·10²³
 * atomos. Se calcula para la formula que se pida.
 */
export function moleDemo(formula: string): MoleDemo | null {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return null;
  const mass = molarMass(parsed.value.composition);
  if (!mass.ok) return null;

  const atoms = [...parsed.value.composition].map(([symbol, count]) => ({
    symbol,
    perMolecule: count,
    moles: count,
    atoms: count * AVOGADRO,
  }));

  return {
    kind: 'mole',
    formula,
    display: formatPlainUnicode(formula),
    molarMass: mass.value.total,
    molecules: AVOGADRO,
    atoms,
    totalAtoms: atoms.reduce((sum, a) => sum + a.atoms, 0),
  };
}

// ---------------------------------------------------------------------------
// Metodos de separacion (1.6.3)
// ---------------------------------------------------------------------------

export interface SeparationMethod {
  readonly name: string;
  /** Que clase de mezcla separa. */
  readonly separates: string;
  /** La PROPIEDAD que se aprovecha. Es lo que hay que entender, no la lista. */
  readonly property: string;
  readonly example: string;
}

/**
 * Los metodos que se estudian, ordenados de mas sencillo a mas fino.
 *
 * Lo que importa de esta tabla no son los nombres: es la columna de la
 * PROPIEDAD. Todo metodo de separacion aprovecha una propiedad fisica en la
 * que los componentes se diferencian, y elegir el metodo es identificar esa
 * diferencia. Aprenderse la lista sin eso no sirve para nada.
 */
export const SEPARATION_METHODS: readonly SeparationMethod[] = [
  {
    name: 'Filtracion',
    separates: 'Heterogenea: solido insoluble en un liquido',
    property: 'Tamano de particula',
    example: 'Arena en agua: la arena queda en el papel de filtro.',
  },
  {
    name: 'Decantacion',
    separates: 'Heterogenea: dos liquidos inmiscibles, o solido sedimentado',
    property: 'Densidad',
    example: 'Aceite y agua: el aceite queda arriba porque es menos denso.',
  },
  {
    name: 'Centrifugacion',
    separates: 'Heterogenea: solido muy fino en suspension',
    property: 'Densidad (acelerada por la fuerza centrifuga)',
    example: 'Separar las celulas del plasma en una muestra de sangre.',
  },
  {
    name: 'Tamizado',
    separates: 'Heterogenea: solidos de distinto grano',
    property: 'Tamano de particula',
    example: 'Separar grava de arena.',
  },
  {
    name: 'Imantacion',
    separates: 'Heterogenea: un componente ferromagnetico',
    property: 'Respuesta a un campo magnetico',
    example: 'Limaduras de hierro mezcladas con azufre.',
  },
  {
    name: 'Evaporacion',
    separates: 'Homogenea: solido disuelto en un liquido',
    property: 'Volatilidad (solo interesa el soluto)',
    example: 'Obtener sal de agua salada; el agua se pierde.',
  },
  {
    name: 'Destilacion',
    separates: 'Homogenea: liquidos miscibles, o solido disuelto',
    property: 'Punto de ebullicion',
    example: 'Separar alcohol y agua: el alcohol hierve a 78 °C y el agua a 100 °C.',
  },
  {
    name: 'Cristalizacion',
    separates: 'Homogenea: solido disuelto',
    property: 'Solubilidad, que cambia con la temperatura',
    example: 'Purificar sulfato de cobre enfriando su disolucion saturada.',
  },
  {
    name: 'Cromatografia',
    separates: 'Homogenea: componentes muy parecidos, en poca cantidad',
    property: 'Distinta afinidad por una fase fija y una movil',
    example: 'Separar los pigmentos de una tinta sobre papel.',
  },
  {
    name: 'Extraccion',
    separates: 'Homogenea: un soluto entre dos disolventes',
    property: 'Solubilidad distinta en cada disolvente',
    example: 'Pasar el yodo del agua al hexano, donde es mucho mas soluble.',
  },
];

// ---------------------------------------------------------------------------
// El temario
// ---------------------------------------------------------------------------

/**
 * Un apartado del temario.
 *
 * Es GENERICO en el tipo de demostracion, y esa es la unica razon de que lo
 * sea: cada unidad tiene sus propias demostraciones — la 1 calcula leyes
 * ponderales, la 2 cuenta nucleones— y compartir una union con todas
 * obligaria a que cada modulo conociera los tipos de los demas. Asi cada
 * unidad declara los suyos, y su vista los recorre con comprobacion
 * exhaustiva.
 */
/**
 * Una comparacion, CON SU LIMITE.
 *
 * Las analogias son la herramienta mas potente y mas peligrosa de la
 * ensenanza: explican rapido y dejan una idea falsa pegada. «El atomo es como
 * un sistema solar» hace entender la idea de nucleo y corteza, y a cambio deja
 * creyendo que los electrones giran en orbitas, que es justo lo que la
 * mecanica cuantica niega.
 *
 * Por eso aqui toda analogia va obligada a declarar donde deja de valer. Sin
 * el limite, la comparacion no se admite.
 */
export interface Analogy {
  readonly image: string;
  /** Donde la comparacion deja de ser cierta. Obligatorio. */
  readonly limit: string;
}

/** Un ejercicio resuelto, con el desarrollo a la vista. */
export interface WorkedExample {
  readonly question: string;
  readonly steps: readonly { readonly text: string; readonly math?: string }[];
  readonly answer: string;
}

/**
 * Pregunta de autocomprobacion.
 *
 * La respuesta llega oculta y se descubre al pulsar. El motivo no es el
 * suspense: leer la pregunta y la respuesta a la vez da sensacion de haber
 * entendido sin haber recuperado nada de memoria, que es la ilusion de
 * competencia mejor documentada que existe. Obligar a intentarlo antes es lo
 * unico que convierte la lectura en aprendizaje.
 */
export interface SelfCheck {
  readonly question: string;
  readonly answer: string;
}

export interface TheoryTopic<D = TheoryDemo> {
  readonly id: string;
  readonly title: string;
  /** La explicacion. */
  readonly body: string;
  /** La frase que hay que llevarse. */
  readonly keyIdea?: string;
  /** El error que casi todo el mundo comete aqui. */
  readonly pitfall?: string;
  /** Comparacion util, con su limite declarado. */
  readonly analogy?: Analogy;
  /** Ejercicio resuelto paso a paso. */
  readonly worked?: WorkedExample;
  /** Preguntas para recuperar de memoria antes de seguir. */
  readonly check?: readonly SelfCheck[];
  /** Con que otros apartados se conecta esto. */
  readonly connects?: readonly { readonly label: string; readonly topic?: string; readonly mode?: string }[];
  /** Demostracion calculada, cuando la hay. */
  readonly demo?: D | null;
  /** Lo que este motor NO cubre de este apartado (§32). */
  readonly gap?: string;
  /** A que parte de la aplicacion lleva. */
  readonly tryIt?: { readonly label: string; readonly mode?: string; readonly formula?: string };
  readonly children?: readonly TheoryTopic<D>[];
}

/**
 * La unidad entera.
 *
 * Se construye con una funcion y no como una constante porque las
 * demostraciones se calculan: si un dato cambia, el texto que se ensena cambia
 * con el.
 */
export function unitMateria(): TheoryTopic<TheoryDemo> {
  return {
    id: '1',
    title: 'La materia',
    body:
      'Todo lo que tiene masa y ocupa un volumen. Esta unidad va de como se clasifica, con que leyes ' +
      'se combina y como se cuenta.',
    children: [
      {
        id: '1.1',
        title: 'Materia',
        body:
          'Materia es todo lo que tiene MASA y ocupa un VOLUMEN. Un trozo de hierro, el aire de una ' +
          'habitacion y el agua de un vaso son materia; el calor, la luz y el sonido no lo son: son ' +
          'formas de energia.',
        keyIdea: 'Masa y volumen: las dos a la vez. Sin ellas no es materia.',
        pitfall:
          'Confundir masa con peso. La masa es la cantidad de materia y no cambia; el peso es la fuerza ' +
          'con que la gravedad tira de ella, y en la Luna seria seis veces menor con la misma masa.',
      },
      {
        id: '1.2',
        title: 'Propiedades',
        body:
          'Las propiedades EXTENSIVAS dependen de cuanta materia hay: masa, volumen, longitud. Las ' +
          'INTENSIVAS no: densidad, punto de fusion, punto de ebullicion, color, solubilidad. Son las ' +
          'intensivas las que sirven para identificar una sustancia, precisamente porque no dependen ' +
          'del tamano de la muestra.',
        keyIdea:
          'Una gota de agua y un oceano tienen densidades distintas de masa, pero la MISMA densidad: ' +
          '1 g/cm³. Por eso la densidad identifica y la masa no.',
        pitfall:
          'Otra division que conviene no mezclar: propiedades FISICAS (se miden sin cambiar la sustancia) ' +
          'frente a QUIMICAS (describen como reacciona, y comprobarlas la transforma).',
        analogy: {
          image:
            'Extensivo es «cuanto hay» e intensivo es «de que es». Si partes un ladrillo por la mitad, ' +
            'cada trozo pesa la mitad (extensivo) pero sigue siendo igual de duro y de denso (intensivo).',
          limit:
            'La comparacion se rompe cuando el trozo se hace muy pequeno. Unas pocas decenas de atomos ' +
            'de oro no son amarillos ni conducen: las propiedades intensivas EMERGEN del conjunto y en ' +
            'la escala nanometrica cambian. En eso se basa toda la nanotecnologia.',
        },
        worked: {
          question:
            'Tienes dos liquidos incoloros. Uno pesa 25 g y ocupa 25 mL; el otro pesa 40 g y ocupa 50 mL. ' +
            '¿Son la misma sustancia?',
          steps: [
            { text: 'Las masas y los volumenes son extensivos: no sirven para identificar. Hay que pasar a una propiedad intensiva.' },
            { text: 'Se calcula la densidad de cada uno.', math: 'd₁ = 25 g / 25 mL = 1,00 g/mL     d₂ = 40 g / 50 mL = 0,80 g/mL' },
            { text: 'Las densidades son distintas, luego las sustancias son distintas, por mucho que las dos sean incoloras.' },
            { text: 'De hecho 1,00 g/mL apunta a agua y 0,80 g/mL a un alcohol.' },
          ],
          answer: 'No. Distinta densidad, distinta sustancia — y la densidad lo dice aunque el aspecto no.',
        },
        check: [
          {
            question: 'La temperatura, ¿es extensiva o intensiva?',
            answer:
              'INTENSIVA. Si juntas dos vasos de agua a 20 °C no obtienes agua a 40 °C: sigue a 20 °C. ' +
              'Lo que si se suma es el CALOR, que es extensivo. Confundir temperatura con calor es el ' +
              'error clasico de este apartado.',
          },
          {
            question: '¿Por que el punto de fusion sirve para identificar una sustancia y la masa no?',
            answer:
              'Porque el punto de fusion es intensivo: el hielo funde a 0 °C sea un cubito o un iceberg. ' +
              'La masa depende de cuanto tengas, asi que no dice nada sobre QUE es.',
          },
        ],
        tryIt: { label: 'Ver las propiedades del agua', formula: 'H2O' },
      },
      {
        id: '1.3',
        title: 'Elementos',
        body:
          'Un elemento es una sustancia formada por atomos con el MISMO numero atomico, es decir, con ' +
          'los mismos protones en el nucleo. No se puede descomponer en otras mas simples por medios ' +
          'quimicos. Hay 118 reconocidos.',
        keyIdea:
          'Lo que define a un elemento es el numero de PROTONES, no el de neutrones ni el de electrones. ' +
          'Cambiar los neutrones da un isotopo; cambiar los electrones, un ion; y sigue siendo el mismo ' +
          'elemento.',
        pitfall:
          'No confundas ELEMENTO con SUSTANCIA SIMPLE. El oxigeno es un elemento, pero forma dos ' +
          'sustancias simples distintas: el O₂ que respiramos y el ozono O₃, que es toxico. Mismo ' +
          'elemento, sustancias con propiedades opuestas. A eso se le llama alotropia — como el ' +
          'diamante y el grafito, que son los dos carbono puro.',
        check: [
          {
            question:
              '¿Puede un elemento «convertirse» en otro? ¿Y en que se diferencia eso de una reaccion quimica?',
            answer:
              'En una reaccion QUIMICA, nunca: los nucleos no se tocan y Z no cambia. Solo se reorganizan ' +
              'los electrones. En una reaccion NUCLEAR si — es lo que ocurre en el Sol y en una central — ' +
              'porque ahi cambia el numero de protones. Los alquimistas fracasaron durante siglos ' +
              'buscando con quimica algo que solo la fisica nuclear puede hacer.',
          },
        ],
        connects: [{ label: '2.4 Numero atomico', mode: 'atomo' }],
        tryIt: { label: 'Explorar los elementos', mode: 'react' },
      },
      {
        id: '1.4',
        title: 'Compuestos',
        body:
          'Un compuesto es una sustancia formada por dos o mas elementos unidos QUIMICAMENTE en una ' +
          'proporcion fija. Sus propiedades no se parecen a las de los elementos que lo forman.',
        keyIdea:
          'El sodio es un metal que arde con el agua y el cloro es un gas toxico. Unidos dan sal de ' +
          'mesa. Un compuesto no es la suma de sus partes: es algo distinto.',
        analogy: {
          image:
            'Un compuesto es a sus elementos lo que una palabra es a sus letras. «Casa» no se parece a ' +
            'una C, una A y una S sueltas, y cambiar el orden da otra cosa.',
          limit:
            'La comparacion sugiere que basta con reordenar, y no es asi: para separar un compuesto hace ' +
            'falta una REACCION QUIMICA con su energia, no un simple reordenamiento. Descomponer agua ' +
            'exige electricidad.',
        },
        check: [
          {
            question:
              'El agua es H₂O y el agua oxigenada H₂O₂. Los mismos dos elementos. ¿Por que una se bebe y la otra desinfecta?',
            answer:
              'Porque la PROPORCION es distinta, y en un compuesto la proporcion lo es todo. Un atomo mas ' +
              'de oxigeno cambia la sustancia por completo: el enlace O–O del peroxido es debil y se ' +
              'rompe con facilidad liberando oxigeno, y eso es lo que mata a las bacterias.',
          },
        ],
        tryIt: { label: 'Construir compuestos', mode: 'tabla' },
      },
      {
        id: '1.5',
        title: 'Sustancias puras',
        body:
          'Una sustancia pura tiene composicion FIJA y propiedades constantes. Hay dos clases: los ' +
          'elementos (un solo tipo de atomo) y los compuestos (varios, en proporcion fija). Una ' +
          'sustancia pura funde y hierve a una temperatura definida, no en un intervalo.',
        keyIdea:
          'El criterio practico: el agua pura hierve a 100 °C exactos. El agua salada empieza a hervir ' +
          'por encima y la temperatura va SUBIENDO mientras hierve. Ese intervalo delata la mezcla.',
        pitfall:
          '«Puro» en quimica no significa lo mismo que en el supermercado. Un «zumo puro» es una mezcla ' +
          'compleja de agua, azucares, acidos y vitaminas. En quimica, puro quiere decir UNA sola ' +
          'sustancia — y en ese sentido el agua destilada es pura y el agua mineral no.',
        check: [
          {
            question:
              'Te dan un solido blanco y una placa calefactora. ¿Como averiguas si es una sustancia pura?',
            answer:
              'Lo calientas midiendo la temperatura mientras funde. Si es PURA, la temperatura se queda ' +
              'clavada en un valor mientras dura la fusion — toda la energia va a romper la red, no a ' +
              'calentar. Si es una mezcla, la temperatura sube durante todo el proceso y funde en un ' +
              'INTERVALO. Esa meseta plana es la firma de la pureza, y es como se comprueba en un ' +
              'laboratorio de verdad.',
          },
        ],
        connects: [{ label: '1.6 Mezclas', topic: '1.6' }],
      },
      {
        id: '1.6',
        title: 'Mezclas',
        body:
          'Una mezcla es la union FISICA de dos o mas sustancias que conservan sus propiedades. Ni hay ' +
          'proporcion fija ni se forman enlaces nuevos, y por eso se pueden separar por medios fisicos.',
        keyIdea:
          'Compuesto o mezcla se decide por dos preguntas: ¿la proporcion es fija? ¿hace falta una ' +
          'reaccion quimica para separarlo? Dos sies, compuesto. Dos noes, mezcla.',
        worked: {
          question:
            'Tienes agua con sal y agua con arena. ¿Como distingues cual es cual y como separas cada una?',
          steps: [
            { text: 'Se miran: la de arena tiene dos fases visibles (heterogenea) y la de sal se ve una sola (homogenea).' },
            { text: 'La arena se separa por FILTRACION: la propiedad que las distingue es el tamano de particula, y la arena no pasa el filtro.' },
            {
              text: 'La sal NO se puede filtrar: esta disuelta a escala molecular y atraviesa cualquier filtro. Hace falta una propiedad distinta.',
            },
            {
              text: 'Se aprovecha la volatilidad. La diferencia entre sus puntos de ebullicion es enorme, asi que evaporando el agua queda la sal sola.',
              math: 'H₂O hierve a 100 °C   ·   NaCl hierve a 1465 °C   →   diferencia de 1365 °C',
            },
            { text: 'Y si lo que interesa es el agua, se DESTILA: se recoge el vapor y se condensa aparte.' },
          ],
          answer:
            'Filtracion para la arena (tamano), evaporacion o destilacion para la sal (punto de ' +
            'ebullicion). El metodo lo elige la propiedad en la que se diferencian.',
        },
        check: [
          {
            question: 'El aire, ¿es una sustancia pura o una mezcla? ¿Y por que no lo delata su aspecto?',
            answer:
              'Es una MEZCLA homogenea de gases (78 % N₂, 21 % O₂, 1 % Ar y otros). El aspecto no lo ' +
              'delata porque los gases se mezclan a escala molecular. Lo delatan dos cosas: su ' +
              'composicion varia con el lugar y la altura, y al licuarlo no hierve a temperatura fija ' +
              'sino en un intervalo — de hecho asi se separa industrialmente el oxigeno del nitrogeno.',
          },
        ],
        gap:
          'Este sandbox trabaja con SUSTANCIAS PURAS. No tiene modelo de mezclas: no puede simular una ' +
          'disolucion al 30 % ni separar sus componentes. El temario se explica igual, pero aqui el ' +
          'motor no acompana, y es mejor decirlo que fingir lo contrario.',
        children: [
          {
            id: '1.6.1',
            title: 'Homogeneas',
            body:
              'Se ve una sola fase: los componentes estan mezclados a escala molecular y no se ' +
              'distinguen ni con microscopio. Tambien se llaman DISOLUCIONES. El componente en mayor ' +
              'cantidad es el disolvente y el resto, solutos.',
            keyIdea:
              'Homogeneo no significa liquido. El aire es una disolucion de gases y el bronce, una ' +
              'disolucion solida de cobre y estano.',
            pitfall:
              'Una disolucion puede tener CUALQUIER proporcion dentro de sus limites, y ahi esta la ' +
              'diferencia con un compuesto. Puedes echar una cucharada de azucar o tres; el agua sigue ' +
              'siendo agua azucarada. En el H₂O, en cambio, la proporcion 2:1 no es negociable.',
            check: [
              {
                question: 'El agua del grifo, ¿es una sustancia pura o una disolucion?',
                answer:
                  'Una DISOLUCION. Lleva sales minerales, cloro y gases disueltos, y por eso deja cal al ' +
                  'evaporarse — si fuera pura no dejaria nada. Tambien por eso su sabor cambia de una ' +
                  'ciudad a otra: la composicion varia, cosa que en una sustancia pura no puede pasar.',
              },
            ],
          },
          {
            id: '1.6.2',
            title: 'Heterogeneas',
            body:
              'Se distinguen dos o mas fases a simple vista o con microscopio. Agua con arena, aceite ' +
              'con agua, granito.',
            keyIdea:
              'Casos intermedios: en un COLOIDE (la leche, la niebla) las particulas no sedimentan y ' +
              'parecen homogeneas, pero dispersan la luz — es el efecto Tyndall, y es lo que las delata.',
            analogy: {
              image:
                'La diferencia entre disolucion y coloide es la del azucar y la harina en agua. El ' +
                'azucar desaparece; la harina enturbia, y si apuntas con una linterna ves el haz ' +
                'atravesar el vaso.',
              limit:
                'La comparacion sugiere que basta con mirar, y no siempre: hay coloides transparentes ' +
                'que solo el haz de luz delata. La prueba fiable es el efecto Tyndall, no el aspecto.',
            },
            check: [
              {
                question: '¿Por que el cielo es azul y las nubes blancas, si los dos son aire con agua?',
                answer:
                  'Por el tamano de las particulas. Las moleculas del aire son mucho mas pequenas que la ' +
                  'longitud de onda de la luz y dispersan sobre todo el azul (dispersion de Rayleigh). En ' +
                  'una nube las gotitas son mayores que esa longitud de onda y dispersan todos los ' +
                  'colores por igual, y todos juntos dan blanco. La nube es un COLOIDE; el aire limpio, ' +
                  'una disolucion.',
              },
            ],
          },
          {
            id: '1.6.3',
            title: 'Metodos de separacion',
            body:
              'Todo metodo aprovecha una PROPIEDAD FISICA en la que los componentes se diferencian. ' +
              'Elegir el metodo es identificar esa diferencia; memorizar la lista sin entender que ' +
              'propiedad usa cada uno no sirve de nada.',
            keyIdea:
              'La pregunta util no es «¿que metodos hay?» sino «¿en que se diferencian fisicamente estos ' +
              'dos componentes?». La respuesta senala el metodo.',
            check: [
              {
                question:
                  'Quieres separar limaduras de hierro, sal y arena, todo mezclado. ¿En que orden actuas?',
                answer:
                  'Primero el IMAN, que se lleva el hierro sin tocar lo demas — siempre conviene empezar ' +
                  'por lo mas selectivo. Despues echas agua: la sal se disuelve y la arena no. FILTRAS y ' +
                  'te queda la arena en el filtro. Y por ultimo EVAPORAS el agua para recuperar la sal. ' +
                  'Tres metodos, tres propiedades: magnetismo, solubilidad y volatilidad.',
              },
              {
                question: '¿Por que la evaporacion y la destilacion no son lo mismo?',
                answer:
                  'Porque en la evaporacion el vapor se pierde: solo te quedas con lo que NO se evapora. ' +
                  'En la destilacion recoges y condensas ese vapor, asi que te quedas con los dos ' +
                  'componentes. Si lo que quieres es agua potable a partir de agua de mar, evaporar no ' +
                  'te sirve de nada.',
              },
            ],
          },
        ],
      },
      {
        id: '1.7',
        title: 'Transformaciones quimicas',
        body:
          'En un cambio FISICO la sustancia sigue siendo la misma: cambia de estado, de forma o de ' +
          'tamano. En un cambio QUIMICO se rompen y se forman enlaces, y aparecen sustancias nuevas ' +
          'con propiedades distintas.',
        keyIdea:
          'La prueba: ¿se puede deshacer sin una reaccion? El hielo que se derrite sigue siendo agua ' +
          '(fisico). El papel que arde no vuelve a ser papel (quimico).',
        pitfall:
          'Hervir agua NO la descompone. Al hervir se separan las moleculas unas de otras, pero cada ' +
          'H₂O sigue entera: el vapor sigue siendo agua. Romper los enlaces O–H cuesta veinte veces mas.',
        check: [
          {
            question: 'Disolver azucar en agua, ¿es cambio fisico o quimico?',
            answer:
              'FISICO. Las moleculas de sacarosa siguen enteras, solo se han separado unas de otras y ' +
              'rodeado de agua. La prueba: evaporando el agua recuperas el azucar intacto. Si lo ' +
              'CALIENTAS hasta caramelizarlo, eso ya es quimico, y no hay forma de volver atras.',
          },
          {
            question: 'Cuatro senales de que ha ocurrido un cambio quimico. ¿Cuales?',
            answer:
              'Cambio de color inesperado, desprendimiento de gas (burbujas sin hervir), formacion de un ' +
              'solido en una disolucion transparente (precipitado), y desprendimiento o absorcion de ' +
              'calor o luz. Ninguna es concluyente por si sola — el agua hirviendo hace burbujas y es ' +
              'fisico — pero juntas son buena pista.',
          },
        ],
        connects: [
          { label: '1.8 Las leyes que gobiernan esas transformaciones', topic: '1.8' },
          { label: '2.2.1.2 Los modelos atomicos que las explican', mode: 'atomo' },
        ],
        tryIt: { label: 'Hacer reaccionar sustancias', mode: 'react' },
      },
      {
        id: '1.8',
        title: 'Leyes de las reacciones quimicas',
        body:
          'Cinco leyes descubiertas entre 1789 y 1811, antes de que nadie hubiera visto un atomo. Son ' +
          'la base experimental de la que Dalton dedujo que la materia esta hecha de particulas.',
        keyIdea:
          'El orden historico importa: primero se midio, despues se explico. Las leyes son hechos ' +
          'medidos; la teoria atomica es la explicacion que se invento para que cuadraran.',
        children: [
          {
            id: '1.8.1',
            title: 'Ley de conservacion de la materia',
            body:
              'Lavoisier, 1789. En una reaccion quimica la masa total de los reactivos es igual a la de ' +
              'los productos. Nada se crea ni se destruye: los atomos se reorganizan.',
            keyIdea:
              'Es la razon de que las ecuaciones se AJUSTEN. Los coeficientes no son un adorno: son la ' +
              'ley escrita en numeros.',
            pitfall:
              'Parece que se incumple cuando algo arde y «pesa menos», o cuando un metal se oxida y ' +
              '«pesa mas». No es asi: en el primer caso escapan gases y en el segundo entra oxigeno del ' +
              'aire. Contando el sistema cerrado, la masa cuadra.',
            demo: conservationDemo('caco3-hcl'),
            worked: {
              question:
                'Quemas 12 g de carbon en un recipiente CERRADO con 32 g de oxigeno y se consume todo. ' +
                '¿Cuanto pesa el CO₂ formado?',
              steps: [
                { text: 'La ecuacion es C + O₂ → CO₂. Todo lo que entra tiene que salir.' },
                { text: 'Se suman las masas de los reactivos.', math: '12 g + 32 g = 44 g' },
                { text: 'Como el recipiente esta cerrado, no se escapa nada: los productos pesan lo mismo.', math: 'masa de CO₂ = 44 g' },
                {
                  text: 'Comprobacion con las masas molares: 12,011 (C) + 31,998 (O₂) = 44,009 g/mol de CO₂. Cuadra.',
                },
              ],
              answer: '44 g. Y si el recipiente estuviera ABIERTO pesarias menos al final, no porque se destruya masa, sino porque el CO₂ se ha ido volando.',
            },
            check: [
              {
                question:
                  'Un clavo de hierro se oxida al aire libre y despues PESA MAS. ¿Se ha creado materia?',
                answer:
                  'No. El hierro se ha combinado con oxigeno del AIRE: 4 Fe + 3 O₂ → 2 Fe₂O₃. La masa ' +
                  'extra es la del oxigeno que ha entrado. Si pesaras el clavo y el aire juntos, en un ' +
                  'recipiente cerrado, la masa no cambiaria. La ley solo se cumple contando el sistema ' +
                  'entero.',
              },
            ],
          },
          {
            id: '1.8.2',
            title: 'Ley de las proporciones definidas',
            body:
              'Proust, 1799. Un compuesto puro siempre contiene los mismos elementos en la misma ' +
              'proporcion en masa, venga de donde venga y sea cual sea la cantidad.',
            keyIdea:
              'El agua es 11,19 % de hidrogeno y 88,81 % de oxigeno. Siempre. En una gota, en un vaso o ' +
              'en un oceano; extraida de un rio o sintetizada en el laboratorio.',
            pitfall:
              'Es lo que separa un compuesto de una mezcla: una disolucion de sal admite cualquier ' +
              'proporcion, un compuesto no.',
            demo: definiteProportionsDemo('H2O'),
          },
          {
            id: '1.8.3',
            title: 'Ley de las proporciones multiples',
            body:
              'Dalton, 1803. Cuando dos elementos forman VARIOS compuestos distintos, las masas de uno ' +
              'que se combinan con una masa fija del otro estan en razon de numeros enteros sencillos.',
            keyIdea:
              'Es la ley que obligo a aceptar los atomos. Que la razon salga 1:2 y no 1:1,87 solo tiene ' +
              'sentido si lo que se combina son unidades indivisibles que se cuentan de una en una.',
            demo: multipleProportionsDemo(['CO', 'CO2']),
            analogy: {
              image:
                'Es como comprar bicicletas: por cada cuadro puedes llevarte 2 ruedas o 4 (si es un ' +
                'remolque), pero nunca 2,7. Las ruedas van de una en una, y por eso las razones salen ' +
                'enteras.',
              limit:
                'La comparacion sugiere que los atomos son objetos macroscopicos que se cuentan a mano. ' +
                'Lo que de verdad ocurre es que se combinan en razones fijas por como se comparten los ' +
                'ELECTRONES, y eso no se supo hasta cien anos despues de Dalton.',
            },
            check: [
              {
                question:
                  'Por que la ley de las proporciones multiples fue LA prueba de que existen los atomos?',
                answer:
                  'Porque una razon de 1:2 exacta no tiene explicacion si la materia es continua. Si ' +
                  'pudieras coger cualquier cantidad de oxigeno, las razones saldrian numeros ' +
                  'cualesquiera. Que salgan enteros pequenos solo se entiende si lo que se combina son ' +
                  'unidades indivisibles que entran de una en una.',
              },
            ],
          },
          {
            id: '1.8.4',
            title: 'Ley de Gay-Lussac',
            body:
              'Gay-Lussac, 1808. Cuando los gases reaccionan entre si, los volumenes de reactivos y ' +
              'productos —medidos a la misma presion y temperatura— estan en razon de numeros enteros ' +
              'sencillos.',
            keyIdea:
              'Fijate en que habla de VOLUMENES, no de masas. Es una ley distinta de las anteriores, y ' +
              'la que dio a Avogadro la pista para su principio.',
            pitfall:
              'Solo vale para gases y solo si estan en las mismas condiciones. Con solidos o liquidos no ' +
              'se cumple.',
            demo: gayLussacDemo('haber-bosch'),
          },
          {
            id: '1.8.5',
            title: 'Principio de Avogadro',
            body:
              'Avogadro, 1811. Volumenes iguales de gases distintos, en las mismas condiciones de ' +
              'presion y temperatura, contienen el MISMO numero de moleculas.',
            keyIdea:
              'Es lo que explica la ley de Gay-Lussac: si los volumenes van como el numero de moleculas, ' +
              'la razon de volumenes tiene que ser la razon de los coeficientes. Una ley medida quedaba ' +
              'explicada por una hipotesis sobre particulas invisibles.',
            pitfall:
              'Se llama PRINCIPIO porque cuando se enuncio era una hipotesis sin demostrar. Tardo casi ' +
              'cincuenta anos en ser aceptado, hasta que Cannizzaro lo defendio en 1860.',
          },
        ],
      },
      {
        id: '1.9',
        title: 'Numero de Avogadro',
        body:
          `N_A = ${AVOGADRO.toExponential(8).replace('e+', ' × 10^')} entidades por mol. Es el numero de ` +
          'particulas que hay en un mol de cualquier cosa: atomos, moleculas, iones o electrones.',
        keyIdea:
          'Desde la redefinicion del SI de 2019 ya NO es una medida con incertidumbre: es una constante ' +
          'EXACTA por definicion. El mol se define como la cantidad que contiene exactamente ese numero ' +
          'de entidades.',
        pitfall:
          'No es un numero magico de la naturaleza: es un factor de conversion elegido para que la masa ' +
          'de un mol en gramos coincida con la masa atomica en unidades de masa atomica. Se escogio para ' +
          'que las cuentas salieran comodas.',
      },
      {
        id: '1.10',
        title: 'Mol de atomos y mol de moleculas',
        body:
          'El mol cuenta ENTIDADES, y hay que decir de que. Un mol de moleculas de agua son 6,022·10²³ ' +
          'moleculas, pero contiene tres moles de atomos: dos de hidrogeno y uno de oxigeno.',
        keyIdea: 'Un mol de agua NO es un mol de atomos. Es un mol de moleculas y tres moles de atomos.',
        pitfall:
          'La trampa clasica de los examenes: «¿cuantos atomos hay en 2 moles de H₂SO₄?». No son ' +
          '2·6,022·10²³, sino 7 veces eso, porque cada molecula tiene 7 atomos.',
        analogy: {
          image:
            'El mol es una DOCENA muy grande. Igual que dices «una docena de huevos» sin contarlos uno a ' +
            'uno, dices «un mol de moleculas» y son 6,022·10²³.',
          limit:
            'La comparacion falla en el tamano y eso importa: una docena la puedes contar, un mol no. Si ' +
            'contaras mil millones de particulas por segundo desde el Big Bang, aun no habrias llegado ' +
            'ni a la millonesima parte de un mol.',
        },
        worked: {
          question: '¿Cuantos atomos de oxigeno hay en 2 moles de H₂SO₄?',
          steps: [
            { text: 'Primero, cuantos atomos de oxigeno tiene CADA molecula. La formula lo dice: 4.' },
            { text: 'Dos moles de moleculas contienen, por tanto, ocho moles de atomos de oxigeno.', math: '2 mol H₂SO₄ × 4 = 8 mol de O' },
            { text: 'Cada mol son 6,022·10²³ atomos.', math: '8 × 6,022·10²³ = 4,818·10²⁴ atomos de O' },
            {
              text: 'La trampa habitual es responder 2 × 6,022·10²³. Eso son las MOLECULAS, no los atomos — y ni siquiera todos los atomos, que serian 7 por molecula.',
            },
          ],
          answer: '4,818·10²⁴ atomos de oxigeno.',
        },
        check: [
          {
            question: '¿Que tiene mas atomos: un mol de agua o un mol de oxigeno molecular (O₂)?',
            answer:
              'El agua. Un mol de H₂O son 3 moles de atomos (2 H + 1 O); un mol de O₂ son 2 moles de ' +
              'atomos. Los dos tienen el mismo numero de MOLECULAS, pero no de atomos.',
          },
        ],
        connects: [{ label: '1.9 El numero de Avogadro', topic: '1.9' }],
        demo: moleDemo('H2O'),
      },
      {
        id: '1.11',
        title: 'Peso atomico',
        body:
          'La masa atomica de un elemento es la masa MEDIA de sus atomos, ponderada por la abundancia ' +
          'de cada isotopo, y se expresa en unidades de masa atomica (u). Numericamente coincide con ' +
          'los gramos que pesa un mol de sus atomos.',
        keyIdea:
          'Por eso el cloro es 35,45 u y no un numero entero: en la naturaleza hay un 75,8 % de ³⁵Cl y ' +
          'un 24,2 % de ³⁷Cl. Ningun atomo de cloro pesa 35,45 u — es una media.',
        pitfall:
          '«Peso atomico» es el nombre tradicional, pero es una MASA, no un peso: no depende de la ' +
          'gravedad. La IUPAC recomienda decir masa atomica relativa.',
      },
      {
        id: '1.12',
        title: 'Peso molecular',
        body:
          'La masa molecular es la suma de las masas atomicas de todos los atomos de la formula. En ' +
          'gramos por mol da la MASA MOLAR, que es el puente entre lo que se pesa en la balanza y el ' +
          'numero de particulas.',
        keyIdea:
          'Es la conversion mas usada de toda la quimica: gramos ÷ masa molar = moles, y moles × N_A = ' +
          'particulas.',
        pitfall:
          'Para un compuesto ionico no existen moleculas, asi que se habla de masa FORMULA: la masa de ' +
          'la unidad minima que expresa la proporcion de iones, no de una particula real.',
        worked: {
          question: '¿Cuantos moles hay en 25 g de NaOH? ¿Y cuantas unidades formula?',
          steps: [
            {
              text: 'Se calcula la masa molar sumando las masas atomicas de la formula.',
              math: 'Na 22,990 + O 15,999 + H 1,008 = 39,997 ≈ 40,00 g/mol',
            },
            { text: 'Los moles salen de dividir los gramos entre la masa molar.', math: 'n = 25 g ÷ 40,00 g/mol = 0,625 mol' },
            { text: 'Y las particulas, multiplicando por el numero de Avogadro.', math: '0,625 × 6,022·10²³ = 3,76·10²³ unidades formula' },
            {
              text: 'Se dice «unidades formula» y no «moleculas» porque el NaOH es ionico: no existen moleculas de NaOH, sino una red de iones Na⁺ y OH⁻.',
            },
          ],
          answer: '0,625 mol, es decir 3,76·10²³ unidades formula.',
        },
        check: [
          {
            question: '¿Por que se habla de masa FORMULA y no molecular en el NaCl?',
            answer:
              'Porque no existen moleculas de NaCl. Lo que hay es una red donde cada Na⁺ esta rodeado de ' +
              'seis Cl⁻ y viceversa. La formula da la PROPORCION 1:1, no el contenido de una particula. ' +
              'La masa formula es la masa de esa proporcion minima.',
          },
        ],
        connects: [
          { label: '1.11 Peso atomico', topic: '1.11' },
          { label: '2.9 De donde salen las masas atomicas', mode: 'atomo' },
        ],
        demo: definiteProportionsDemo('H2SO4'),
        tryIt: { label: 'Calcular masas molares', mode: 'react' },
      },
    ],
  };
}
