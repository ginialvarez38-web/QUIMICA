/**
 * Lesson composition.
 *
 * §11 asks for four depths of the same material, and §77 forbids filling the
 * platform with superficial text. Writing 414 topics × 4 depths by hand is not
 * possible; writing a generator that emits vague filler would be worse.
 *
 * The approach taken instead: a topic's lesson is *composed* from the concepts
 * it teaches, which carry real definitions, real prerequisite chains, real
 * equations and real substances. Each depth changes what is assembled and how
 * far the derivation goes — not merely how many words are produced. Topics with
 * hand-written material (`AUTHORED`) use it in preference, and the rest get a
 * structurally honest lesson that says what it is: a composition over the
 * concept graph, with every claim traceable to a concept, an equation or a
 * substance record.
 */

import { h, type Child } from '../ui/dom.js';
import { equation, namedEquation, equationById } from '../ui/equation.js';
import { note, panel, badge, causalChain } from '../ui/components.js';
import { href } from '../ui/router.js';
import { conceptById, prerequisiteChain, conceptDependents, TIER_LABEL, type Concept } from './concepts.js';
import { substanceById } from '../data/substances.js';
import { COURSES, allTopics, type Course, type Topic } from './curriculum.js';
import { formulaHtml } from '../core/format.js';

export type Depth = 'rapido' | 'universitario' | 'profundo' | 'avanzado';

export const DEPTHS: Array<{ id: Depth; label: string; description: string }> = [
  { id: 'rapido', label: 'Rápido', description: 'Resumen conceptual' },
  { id: 'universitario', label: 'Universitario', description: 'Explicación completa' },
  { id: 'profundo', label: 'Profundo', description: 'Derivación y fundamentos' },
  { id: 'avanzado', label: 'Avanzado', description: 'Tratamiento técnico' },
];

export interface Lesson {
  blocks: Child[];
  equations: string[];
  depth: Depth;
}

/**
 * Hand-written lessons for the topics that most need them: the ones a student
 * meets first, and the ones where a generated composition would be weakest.
 */
interface AuthoredLesson {
  rapido: string[];
  universitario: string[];
  profundo: string[];
  avanzado: string[];
  equations?: string[];
  causal?: Array<{ quantity: string; direction: 'up' | 'down' | 'flat'; why?: string }>;
  warning?: { title: string; body: string };
}

const AUTHORED: Record<string, AuthoredLesson> = {
  'qg1.u3.c1.constante-de-avogadro-y-masa-molar': {
    rapido: [
      'Un mol es una cantidad de entidades: exactamente 6.02214076×10²³, un número fijado por definición desde 2019.',
      'La masa molar es la masa de un mol, en gramos por mol, y coincide numéricamente con la masa atómica o molecular en unidades de masa atómica.',
    ],
    universitario: [
      'El problema que resuelve el mol es de contabilidad. Una reacción química ocurre entre partículas individuales —un átomo de zinc con dos iones hidrógeno— pero en el laboratorio no manipulamos partículas: pesamos gramos. El mol es el puente entre ambas escalas.',
      'Desde la redefinición del Sistema Internacional en 2019, la constante de Avogadro es un número exacto por definición: N_A = 6.02214076×10²³ mol⁻¹. Ya no se define a partir del carbono-12; al contrario, es la masa del carbono-12 la que ahora se mide.',
      'La consecuencia práctica es que la masa molar de una sustancia se obtiene sumando las masas atómicas de sus átomos, y el resultado, expresado en g·mol⁻¹, es numéricamente igual a la masa de una molécula expresada en unidades de masa atómica. El agua tiene una masa molecular de 18.015 u y una masa molar de 18.015 g·mol⁻¹.',
      'Tres relaciones bastan para casi todos los cálculos: n = m/M convierte masa en cantidad de sustancia, n = N/N_A convierte número de partículas en cantidad, y c = n/V convierte cantidad en concentración.',
    ],
    profundo: [
      'Conviene entender por qué la coincidencia numérica entre masa molecular y masa molar no es una casualidad, sino una consecuencia de cómo se eligieron las unidades.',
      'La unidad de masa atómica se define como 1/12 de la masa de un átomo de ¹²C. Si un átomo tiene una masa de x unidades de masa atómica, entonces N_A átomos tienen una masa de x·N_A·(1 u). Como el valor numérico de N_A se eligió históricamente para que N_A·(1 u) fuese exactamente 1 gramo, la masa de un mol resulta ser x gramos.',
      'Tras la redefinición de 2019 esa igualdad dejó de ser exacta y pasó a ser una excelente aproximación: la constante de masa molar M_u ya no vale exactamente 1 g·mol⁻¹, sino 0.99999999965 g·mol⁻¹. La diferencia, de una parte en 10⁹, es varios órdenes de magnitud menor que la incertidumbre de cualquier pesada de laboratorio, y por eso en la práctica se sigue trabajando como si la igualdad fuera exacta.',
      'Este es un buen primer ejemplo de algo que reaparecerá en toda la carrera: una relación puede ser exacta por definición, exacta por construcción histórica, o aproximada dentro de una tolerancia conocida, y conviene saber en cuál de los tres casos se está.',
    ],
    avanzado: [
      'La cantidad de sustancia es una de las siete magnitudes básicas del Sistema Internacional, y su condición de magnitud básica ha sido objeto de un debate largo y serio: hay quien sostiene que contar entidades no es medir, y que el mol es un factor de conversión disfrazado de unidad.',
      'El argumento a favor de mantenerla es operativo. En química, la proporcionalidad relevante no es entre masas sino entre números de partículas; una ley empírica como la de las proporciones múltiples sólo se enuncia con naturalidad en términos de cantidad de sustancia. Tratarla como magnitud básica hace que las ecuaciones de la termodinámica química —el potencial químico, la ecuación de estado, la constante de equilibrio— sean dimensionalmente coherentes sin factores de conversión escondidos.',
      'La redefinición de 2019 zanjó el debate desde el punto de vista metrológico al fijar N_A como un número exacto, del mismo modo que se fijaron h, e y k_B. El mol pasó a ser una unidad definida por un número, no por un artefacto ni por una sustancia de referencia.',
      'Una consecuencia menos obvia: la masa atómica del carbono-12 dejó de ser exactamente 12 u y pasó a ser una magnitud experimental, con incertidumbre. Todas las tablas de masas atómicas heredan esa incertidumbre, aunque en la práctica esté dominada por la variabilidad isotópica natural, que es mucho mayor.',
    ],
    causal: [
      { quantity: 'masa pesada', direction: 'up', why: 'lo que se mide en la balanza' },
      { quantity: 'n = m/M', direction: 'up', why: 'la masa molar convierte gramos en moles' },
      { quantity: 'moles de producto', direction: 'up', why: 'a través de los coeficientes estequiométricos' },
      { quantity: 'masa de producto', direction: 'up', why: 'volviendo a multiplicar por la masa molar' },
    ],
  },

  'qan1.u2.c1.acido-fuerte-con-base-fuerte': {
    rapido: [
      'La curva tiene tres tramos: antes del punto de equivalencia domina el ácido sin neutralizar, en la equivalencia el pH es 7 y después domina la base en exceso.',
      'El salto es muy grande —varias unidades de pH en una fracción de mililitro— porque no hay nada que tamponee la disolución.',
    ],
    universitario: [
      'Valorar ácido clorhídrico con hidróxido de sodio es el caso más simple posible, y por eso es el punto de referencia contra el que se comparan todos los demás.',
      'Antes del punto de equivalencia el pH lo fija sencillamente el ácido que queda sin neutralizar, corregido por la dilución que produce el titrante añadido. La concentración de protones es la diferencia entre los moles de ácido iniciales y los de base añadidos, dividida por el volumen total.',
      'En el punto de equivalencia sólo hay cloruro de sodio y agua. Ni el sodio ni el cloruro tienen propiedades ácido-base apreciables, de modo que el pH es el del agua pura: 7.00 a 25 °C. Este es el único caso en que el punto de equivalencia cae exactamente en 7.',
      'Después de la equivalencia el pH lo fija el exceso de hidróxido, otra vez con la corrección por dilución.',
      'La magnitud del salto es lo que hace útil la valoración. Al pasar de 24.95 a 25.05 mL —dos gotas— el pH recorre unas seis unidades. Cualquier indicador que vire dentro de ese intervalo señalará el punto final con un error inferior al 0.1 %.',
    ],
    profundo: [
      'El tratamiento riguroso no distingue tramos: plantea el sistema completo y lo resuelve en cada punto. Hay dos incógnitas independientes, la concentración de protones y la de hidróxido, ligadas por el producto iónico del agua, y una ecuación de electroneutralidad.',
      'La condición de electroneutralidad para esta valoración es [Na⁺] + [H⁺] = [Cl⁻] + [OH⁻]. Sustituyendo [OH⁻] = K_w/[H⁺] y escribiendo las concentraciones analíticas de sodio y cloruro en función de los volúmenes se obtiene una ecuación de segundo grado en [H⁺] que se resuelve exactamente.',
      'Ese planteamiento es el que usa CHEMIA para generar la curva, y tiene una consecuencia visible: la curva sigue siendo correcta cuando las aproximaciones por tramos fallan. Con ácido 10⁻⁶ M el salto casi desaparece y el punto de equivalencia ya no está en pH 7 aparente, porque la autoprotólisis del agua deja de ser despreciable. Prueba a bajar la concentración en el simulador y compruébalo.',
      'La otra corrección que suele omitirse es la de actividad. El pH que mide un electrodo es −log a(H⁺), no −log [H⁺]. En una valoración con concentraciones 0.1 M la fuerza iónica es 0.1 y el coeficiente de actividad del protón vale unos 0.78, lo que desplaza el pH inicial de 1.00 a 1.11. La curva simulada aplica esa corrección; por eso su primer punto no es exactamente 1.00.',
    ],
    avanzado: [
      'La derivada dpH/dV en el punto de equivalencia es lo que determina si una valoración es viable, y admite una expresión cerrada. Para un ácido fuerte con base fuerte, en la equivalencia, la pendiente es inversamente proporcional a la raíz de K_w y proporcional a la concentración: por eso diluir arruina la valoración mucho más deprisa de lo que sugiere la intuición.',
      'El criterio operativo habitual es que una valoración es practicable con detección visual si el salto supera unas dos unidades de pH en el volumen de una gota, unos 0.05 mL. Por debajo de 10⁻⁴ M el salto de un ácido fuerte deja de cumplirlo, y hay que recurrir a detección potenciométrica y a la segunda derivada.',
      'La detección por primera y segunda derivada es preferible a la visual incluso cuando el salto es grande, porque no depende del criterio del operador ni del error de viraje del indicador. El punto de inflexión se localiza como el cruce por cero de la segunda derivada, que es el máximo de la primera.',
      'Conviene notar una sutileza: el punto de inflexión de la curva y el punto de equivalencia estequiométrico coinciden exactamente sólo en el caso simétrico de ácido fuerte con base fuerte. En una valoración de ácido débil, la curva no es simétrica alrededor de la equivalencia y el máximo de la derivada está ligeramente desplazado. El error que eso introduce es pequeño, pero es sistemático.',
    ],
    equations: ['henderson'],
    causal: [
      { quantity: 'V(NaOH) añadido', direction: 'up', why: 'se abre la llave de la bureta' },
      { quantity: 'moles de HCl restantes', direction: 'down', why: 'neutralización 1:1' },
      { quantity: '[H⁺]', direction: 'down', why: 'menos ácido en más volumen' },
      { quantity: 'pH', direction: 'up', why: 'pH = −log a(H⁺)' },
      { quantity: 'forma del indicador', direction: 'up', why: 'la forma básica coloreada gana terreno al superar su pKa' },
    ],
  },

  'qg2.u4.c1.q-y-k-el-criterio-de-desplazamiento': {
    rapido: [
      'Q tiene la misma forma que K pero se calcula con las concentraciones del momento, no con las del equilibrio.',
      'Si Q < K la reacción avanza hacia productos; si Q > K retrocede; si Q = K está en equilibrio.',
    ],
    universitario: [
      'La constante de equilibrio y el cociente de reacción se escriben igual. La diferencia está en cuándo se evalúan: K con las concentraciones de equilibrio, Q con las que haya en ese instante.',
      'Comparar Q con K es el único criterio que hace falta para predecir el sentido de una reacción, y sustituye con ventaja a cualquier regla mnemotécnica. Si Q es menor que K faltan productos y la reacción avanza; si es mayor, sobran y retrocede.',
      'Este criterio es más general de lo que parece: es también el fundamento del principio de Le Châtelier. Cuando se añade un reactivo, Q disminuye instantáneamente porque el denominador crece; el sistema responde avanzando hacia productos hasta restaurar Q = K. No hace falta invocar ninguna tendencia del sistema a "oponerse" al cambio.',
      'La formulación en términos de Q y K también evita los errores clásicos del enunciado cualitativo. Añadir un gas inerte a volumen constante no cambia ninguna presión parcial, luego no cambia Q, luego no desplaza el equilibrio, por mucho que la presión total haya aumentado.',
    ],
    profundo: [
      'El vínculo con la termodinámica es directo y es lo que convierte el criterio en algo más que una regla. La energía de Gibbs de reacción en condiciones cualesquiera vale ΔG = ΔG° + RT·ln Q, y en el equilibrio ΔG = 0, de donde ΔG° = −RT·ln K.',
      'Sustituyendo, ΔG = RT·ln(Q/K). El signo de ΔG es por tanto el signo del logaritmo de Q/K: negativo cuando Q < K, que es exactamente la condición de avance espontáneo.',
      'De aquí salen dos advertencias importantes. La primera: ΔG° es una constante de la reacción a una temperatura dada, y su signo dice hacia dónde estaría desplazado el equilibrio en condiciones estándar, no si la reacción ocurrirá en las condiciones reales. Confundir ΔG con ΔG° es el error más frecuente del tema.',
      'La segunda: tanto Q como K deben escribirse en actividades. Usar concentraciones equivale a suponer coeficientes de actividad unitarios, lo que sólo es aceptable en disolución diluida. En un sistema con fuerza iónica apreciable, la constante calculada con concentraciones no es la constante termodinámica, y difiere de ella de forma sistemática.',
    ],
    avanzado: [
      'El tratamiento riguroso parte del potencial químico. Para una reacción Σν_i A_i = 0, la energía de Gibbs de reacción es ΔG = Σν_i·µ_i, y como µ_i = µ_i° + RT·ln a_i, se obtiene ΔG = ΔG° + RT·ln Π a_i^{ν_i}, que es la expresión anterior con Q identificado como el producto de actividades.',
      'La condición de equilibrio no es realmente ΔG = 0, sino (∂G/∂ξ)_{T,P} = 0, donde ξ es el grado de avance. La distinción importa: G es una función de ξ con un mínimo, y el equilibrio es ese mínimo. Un sistema que se aleja del equilibrio en cualquier dirección aumenta su energía de Gibbs, que es la razón termodinámica de que vuelva.',
      'La curvatura de G(ξ) en el mínimo determina la rigidez del equilibrio, es decir, cuánto se desplaza ante una perturbación dada. Esa segunda derivada está relacionada con la capacidad tamponante de un sistema ácido-base, que no es más que la misma idea aplicada al equilibrio protónico.',
      'Conviene retener que toda esta estructura es puramente termodinámica y no dice nada sobre velocidad. Una reacción con K = 10⁸⁰ y una barrera de activación de 300 kJ·mol⁻¹ no ocurrirá en la escala de tiempo humana. La termodinámica delimita lo posible; la cinética decide lo que se observa.',
    ],
    equations: ['gibbs', 'vant-hoff'],
  },
};

/**
 * Compose a lesson for a topic at the requested depth.
 */
export function lessonFor(topic: Topic, course: Course, depth: Depth): Lesson {
  const authored = AUTHORED[topic.id];
  if (authored) return renderAuthored(authored, depth, topic);

  return renderComposed(topic, course, depth);
}

function renderAuthored(lesson: AuthoredLesson, depth: Depth, topic: Topic): Lesson {
  const paragraphs = lesson[depth];
  const blocks: Child[] = [
    h('h2', { text: topic.title }),
    ...paragraphs.map((p) => h('p', { text: p })),
  ];

  if (lesson.warning) {
    blocks.push(note('warn', lesson.warning.title, lesson.warning.body));
  }
  if (lesson.causal && (depth === 'universitario' || depth === 'profundo' || depth === 'avanzado')) {
    blocks.push(
      h('h3', { text: '¿Qué está ocurriendo?' }),
      h('p', { class: 'dim', style: { fontSize: 'var(--fs-xs)' },
        text: 'La cadena causal que enlaza lo que controlas con lo que observas.' }),
      causalChain(lesson.causal),
    );
  }
  return { blocks, equations: lesson.equations ?? [], depth };
}

/**
 * Compose a lesson from the topic's concepts.
 *
 * This is not filler: every sentence is assembled from data that exists —
 * a concept's definition, its prerequisite chain, the courses that build on it,
 * the substances that instantiate it. Where the platform has no authored
 * treatment, it says so plainly rather than pretending otherwise (§81).
 */
function renderComposed(topic: Topic, course: Course, depth: Depth): Lesson {
  const concepts = topic.concepts.map((id) => conceptById(id)).filter((c): c is Concept => Boolean(c));
  const blocks: Child[] = [h('h2', { text: topic.title })];
  const equations = new Set<string>();

  if (concepts.length === 0) {
    blocks.push(
      note('info', 'Tema sin desarrollo redactado',
        `«${topic.title}» forma parte del plan de ${course.name} pero todavía no tiene material `
        + 'redactado ni conceptos asociados en el grafo. La estructura del plan está completa; '
        + 'el contenido de este tema concreto está pendiente.'),
    );
    return { blocks, equations: [], depth };
  }

  // --- Rápido: definitions only -------------------------------------------
  if (depth === 'rapido') {
    blocks.push(h('p', {
      text: `Este tema trata ${concepts.length === 1 ? 'un concepto' : `${concepts.length} conceptos`}, `
        + 'resumidos así:',
    }));
    blocks.push(h('ul', {}, ...concepts.map((c) => h('li', {},
      h('strong', { text: `${c.name}. ` }), c.short,
    ))));
    concepts.forEach((c) => c.equations?.forEach((e) => equations.add(e)));
    return { blocks, equations: [...equations], depth };
  }

  // --- Universitario: definition, place in the structure, instances --------
  for (const concept of concepts) {
    blocks.push(h('h3', { text: concept.name }));
    blocks.push(h('p', { text: concept.short }));

    const chain = prerequisiteChain(concept.id);
    if (chain.length > 0) {
      blocks.push(h('p', {},
        'Se apoya en ',
        ...joinLinks(chain.slice(-3).map((c) => ({
          label: c.name, href: href('universidad', { vista: 'conocimiento', concepto: c.id }),
        }))),
        '. Si alguno de esos no está firme, este tema resultará difícil por la razón equivocada.',
      ));
    }

    const after = conceptDependents(concept.id);
    if (after.length > 0 && depth !== 'universitario') {
      blocks.push(h('p', {},
        'A su vez, es requisito de ',
        ...joinLinks(after.slice(0, 4).map((c) => ({
          label: c.name, href: href('universidad', { vista: 'conocimiento', concepto: c.id }),
        }))),
        '.',
      ));
    }

    if (concept.substances?.length) {
      const subs = concept.substances.map((id) => substanceById(id)).filter(Boolean);
      if (subs.length > 0) {
        blocks.push(h('p', {},
          'Se concreta en ',
          ...joinLinks(subs.map((s) => ({ label: s!.name, href: href(`mundo/sustancia/${s!.id}`) }))),
          '. ',
          subs[0]!.role ?? '',
        ));
      }
    }

    concept.equations?.forEach((e) => {
      equations.add(e);
      const named = equationById(e);
      if (named && (depth === 'profundo' || depth === 'avanzado')) {
        blocks.push(namedEquation(e, { display: true }));
        blocks.push(h('p', { class: 'dim', style: { fontSize: 'var(--fs-xs)' }, text: named.context }));
      }
    });

    // --- Profundo / avanzado: where else this appears ----------------------
    if (depth === 'profundo' || depth === 'avanzado') {
      const elsewhere = COURSES.filter((c) =>
        c.id !== course.id && allTopics(c).some((t) => t.concepts.includes(concept.id)));
      if (elsewhere.length > 0) {
        blocks.push(h('p', {},
          'El mismo concepto reaparece en ',
          ...joinLinks(elsewhere.map((c) => ({ label: c.name, href: href(`universidad/${c.id}`) }))),
          '. En CHEMIA no se reimplementa en cada asignatura: es la misma entidad, con las mismas '
          + 'constantes y el mismo motor, vista desde contextos distintos.',
        ));
      }
    }
  }

  if (depth === 'avanzado') {
    blocks.push(
      h('h3', { text: 'Nivel de desarrollo de este tema' }),
      note('info', null,
        h('div', {},
          'Este tema todavía no tiene un tratamiento técnico redactado. Lo que se muestra arriba es '
          + 'una composición sobre el grafo de conceptos: definiciones, dependencias y conexiones '
          + 'reales, sin texto inventado para rellenar. ',
          h('a', { href: href('universidad', { vista: 'conocimiento', concepto: concepts[0].id }),
            text: 'Explorar estos conceptos en el mapa' }),
          '.',
        ),
      ),
    );
  }

  return { blocks, equations: [...equations], depth };
}

function joinLinks(items: Array<{ label: string; href: string }>): Child[] {
  const out: Child[] = [];
  items.forEach((item, i) => {
    if (i > 0) out.push(i === items.length - 1 ? ' y ' : ', ');
    out.push(h('a', { href: item.href, text: item.label }));
  });
  return out;
}

/** How many topics have hand-written material, for an honest progress figure. */
export const authoredTopicCount = (): number => Object.keys(AUTHORED).length;

void panel; void badge; void equation; void formulaHtml; void TIER_LABEL;
