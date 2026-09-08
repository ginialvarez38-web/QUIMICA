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
export interface TheoryTopic<D = TheoryDemo> {
  readonly id: string;
  readonly title: string;
  /** La explicacion. */
  readonly body: string;
  /** La frase que hay que llevarse. */
  readonly keyIdea?: string;
  /** El error que casi todo el mundo comete aqui. */
  readonly pitfall?: string;
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
          'por encima y la temperatura va subiendo mientras hierve. Ese intervalo delata la mezcla.',
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
        demo: definiteProportionsDemo('H2SO4'),
        tryIt: { label: 'Calcular masas molares', mode: 'react' },
      },
    ],
  };
}
