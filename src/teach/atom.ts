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

export type AtomDemo = CompositionDemo | AbundanceDemo | NuclideGroupDemo | PeriodicStatsDemo;

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
        title: 'Composicion del atomo',
        body:
          'Un atomo tiene un NUCLEO diminuto con protones (carga +1) y neutrones (sin carga), y una ' +
          'CORTEZA donde estan los electrones (carga −1). El nucleo concentra casi toda la masa; la ' +
          'corteza, casi todo el volumen.',
        keyIdea:
          'Las escalas no se parecen en nada. Si el nucleo fuera una canica en el centro de un campo de ' +
          'futbol, los electrones andarian por las gradas. Un atomo es, sobre todo, espacio vacio.',
        pitfall:
          'El proton y el neutron pesan casi lo mismo (≈1 u), pero el electron pesa 1836 veces menos que ' +
          'el proton. Por eso la masa se cuenta con A = protones + neutrones y los electrones no entran.',
        demo: null,
      },
      {
        id: '2.2',
        title: 'Estructura nuclear y propiedades derivadas',
        body:
          'Del nucleo salen dos numeros que lo determinan todo: el numero atomico Z fija QUE elemento ' +
          'es, y el numero masico A fija CUANTO pesa ese atomo concreto. De la corteza sale el ' +
          'comportamiento quimico.',
        keyIdea:
          'La quimica la hacen los electrones; la identidad, los protones. Por eso un ion sigue siendo ' +
          'el mismo elemento aunque reaccione de otro modo.',
        children: [
          {
            id: '2.2.1',
            title: 'Antecedentes historicos',
            body:
              'Nada de esto se vio: se dedujo de experimentos. El orden importa, porque cada modelo ' +
              'nacio para explicar algo que el anterior no podia.',
            children: [
              {
                id: '2.2.1.1',
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
              },
              {
                id: '2.2.1.2',
                title: 'Modelos atomicos',
                body:
                  'Cada modelo resolvio un problema del anterior y dejo otro abierto. Estudiarlos por ' +
                  'separado, como cinco dibujos que memorizar, es perder lo unico interesante: la ' +
                  'cadena de experimentos que obligo a cambiarlos.',
                keyIdea:
                  'Un modelo no se abandona por ser «falso»: se abandona cuando aparece un experimento ' +
                  'que no puede explicar. Y el modelo viejo sigue sirviendo dentro de sus limites.',
              },
            ],
          },
        ],
      },
      {
        id: '2.3',
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
        demo: compositionDemo(),
      },
      {
        id: '2.4',
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
      },
      {
        id: '2.5',
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
      },
      {
        id: '2.6',
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
        demo: abundanceDemo('H'),
      },
      {
        id: '2.7',
        title: 'Isobaras',
        body:
          'Nucleidos de elementos DISTINTOS (distinto Z) que tienen el mismo numero masico A. Son ' +
          'sustancias diferentes que pesan casi lo mismo.',
        keyIdea:
          'Iso-baro: «mismo peso». No confundir con isotopo: ahi lo que coincide es el elemento, aqui ' +
          'lo que coincide es A y el elemento es distinto.',
        demo: isobarsDemo(),
      },
      {
        id: '2.8',
        title: 'Isotonos',
        body:
          'Nucleidos de elementos distintos que tienen el mismo numero de NEUTRONES. Ni el elemento ni ' +
          'el numero masico coinciden: solo N = A − Z.',
        keyIdea:
          'Los tres «iso» se distinguen por lo que comparten: isotopos comparten Z (protones), isobaras ' +
          'comparten A (nucleones), isotonos comparten N (neutrones).',
        demo: isotonesDemo(),
      },
      {
        id: '2.9',
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
        demo: abundanceDemo('Cl'),
      },
      {
        id: '2.10',
        title: 'Tabla periodica',
        body:
          'Los 118 elementos ordenados por numero atomico creciente y colocados de modo que los de ' +
          'propiedades parecidas queden en la misma columna. No es una lista: es una prediccion, y ' +
          'Mendeleiev la uso para dejar huecos y anticipar elementos que aun no se habian descubierto.',
        keyIdea:
          'La periodicidad tiene causa: las propiedades se repiten porque se repite la CONFIGURACION de ' +
          'la capa de valencia. La tabla es la estructura electronica dibujada en dos dimensiones.',
        demo: periodicStatsDemo(),
        children: [
          {
            id: '2.10.1',
            title: 'Clasificacion de los elementos',
            body:
              'Por comportamiento: METALES (ceden electrones, conducen, brillan, son ductiles), NO ' +
              'METALES (captan electrones, aislantes, fragiles) y METALOIDES, en la frontera, con ' +
              'propiedades intermedias — de ahi que sirvan como semiconductores.',
            keyIdea:
              'La frontera entre metales y no metales es una escalera diagonal que baja desde el boro ' +
              'hasta el astato. Los metaloides son justo los que la tocan.',
          },
          {
            id: '2.10.2',
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
          },
        ],
      },
    ],
  };
}

/** Elementos con datos isotopicos curados, para la interfaz. */
export const ISOTOPE_ELEMENTS = elementsWithIsotopes();
