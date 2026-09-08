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

export type AtomDemo =
  | CompositionDemo
  | AbundanceDemo
  | NuclideGroupDemo
  | PeriodicStatsDemo
  | ModelsDemo;

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
                title: 'Modelos atomicos',
                body:
                  'Cada modelo resolvio un problema del anterior y dejo otro abierto. Estudiarlos por ' +
                  'separado, como cinco dibujos que memorizar, es perder lo unico interesante: la ' +
                  'cadena de experimentos que obligo a cambiarlos.',
                keyIdea:
                  'Un modelo no se abandona por ser «falso»: se abandona cuando aparece un experimento ' +
                  'que no puede explicar. Y el modelo viejo sigue sirviendo dentro de sus limites — el ' +
                  'de Dalton, de 1803, es el que usas para ajustar una ecuacion.',
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
          answer: '26 protones, 30 neutrones y 23 electrones.',
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
    ],
  };
}

/** Elementos con datos isotopicos curados, para la interfaz. */
export const ISOTOPE_ELEMENTS = elementsWithIsotopes();
