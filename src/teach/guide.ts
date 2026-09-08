/**
 * EL GUIA — motor de pistas.
 *
 * Es el cerebro del avatar. Mira en que punto esta el usuario y decide QUE
 * decirle a continuacion.
 *
 * LA REGLA QUE GOBIERNA ESTE MODULO
 * El guia no sabe quimica. Ni una sola de sus frases afirma algo que no venga
 * de un motor: la familia de un compuesto la da `classify`, el riesgo y el
 * tipo de reaccion los da `predict`, la neutralidad la da el constructor. Cada
 * pista lleva ademas de DONDE sale, y esa procedencia se muestra.
 *
 * El motivo no es purismo. Un ayudante que suelta animos genericos —«¡muy
 * bien!», «sigue asi»— es ruido que el usuario aprende a ignorar en tres
 * pantallas. Y uno que se inventa quimica para parecer util es peor que no
 * tenerlo, porque el estudiante no puede distinguir lo inventado de lo cierto.
 * Cuando el motor no sabe algo, el guia lo dice.
 *
 * EL MODO DESCUBRIMIENTO (§23)
 * La pieza mas valiosa esta en las reacciones. Con dos reactivos en el banco y
 * antes de predecir, el guia NO adelanta el resultado: nombra las familias de
 * los dos —que es un hecho, no una pista— y pregunta que crees que va a pasar.
 * Predecir sin haberse mojado antes no ensena nada; equivocarse y ver por que,
 * si.
 *
 * La pregunta es sobre el TIPO de reaccion y no sobre los productos, y eso es
 * deliberado: el vocabulario de tipos es cerrado y conocido, asi que las
 * opciones falsas son tipos reales que no tocan, no formulas inventadas.
 */

import type { Ion, HazardLevel, ReactionType } from '../core/types.js';
import type { Prediction } from '../engine/predict.js';
import { predict, reactionsAvailableFor } from '../engine/predict.js';
import { classifyFormula } from '../core/classify.js';
import { formatPlainUnicode } from '../core/formula/render.js';

export type GuideMood =
  /** Nada que hacer todavia: orienta. */
  | 'idle'
  /** Falta un paso concreto. */
  | 'pointing'
  /** Hay una pregunta sobre la mesa (§23). */
  | 'asking'
  /** Riesgo quimico que conviene leer antes de seguir. */
  | 'warning'
  /** Se ha llegado a algo: senala lo que merece la pena mirar. */
  | 'done';

/** Una pista, con la procedencia obligatoria. */
export interface GuideHint {
  readonly text: string;
  /** Que motor lo afirma: 'Clasificacion', 'Motor de reacciones', 'Datos'… */
  readonly from: string;
}

export interface DiscoveryOption {
  readonly id: string;
  readonly label: string;
  readonly correct: boolean;
}

/** La pregunta del §23: mojarse antes de ver el resultado. */
export interface DiscoveryQuestion {
  readonly text: string;
  readonly options: readonly DiscoveryOption[];
  /** Lo que se explica al responder, se acierte o no. */
  readonly reveal: string;
}

export interface GuideMessage {
  readonly mood: GuideMood;
  readonly headline: string;
  readonly body: string;
  readonly hints: readonly GuideHint[];
  readonly question: DiscoveryQuestion | null;
}

export interface GuideContext {
  readonly mode: string;
  readonly builder: { readonly cation: Ion | null; readonly anion: Ion | null };
  readonly builtFormula: string | null;
  readonly bench: readonly string[];
  readonly predictions: readonly Prediction[];
  readonly activePrediction: Prediction | null;
  readonly selected: string | null;
  /** La pregunta de descubrimiento ya se contesto en esta pareja. */
  readonly answeredFor: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  synthesis: 'Sintesis (dos cosas se unen en una)',
  decomposition: 'Descomposicion (una se parte en varias)',
  'single-displacement': 'Sustitucion simple (un elemento desplaza a otro)',
  'double-displacement': 'Doble sustitucion (los iones se intercambian)',
  combustion: 'Combustion',
  neutralization: 'Neutralizacion (acido + base)',
  precipitation: 'Precipitacion (se forma un solido insoluble)',
  'acid-base': 'Acido-base',
  redox: 'Redox (hay transferencia de electrones)',
  hydrolysis: 'Hidrolisis',
  hydration: 'Hidratacion (se incorpora agua)',
  calcination: 'Calcinacion (descomposicion por calor)',
  dissolution: 'Disolucion',
  complexation: 'Complejacion',
};

const HAZARD_NOTE: Record<HazardLevel, string | null> = {
  safe: null,
  'special-conditions': 'Necesita condiciones especiales: no ocurre sin mas.',
  hazardous: 'Cuidado: esta reaccion tiene riesgo quimico relevante.',
  'do-not-attempt': 'NO intentes esto fisicamente sin controles profesionales.',
};

/** Tipos que sirven de opcion falsa: son reales y frecuentes en el temario. */
const COMMON_TYPES: readonly ReactionType[] = [
  'synthesis',
  'decomposition',
  'double-displacement',
  'single-displacement',
  'neutralization',
  'precipitation',
  'redox',
];

const pretty = (formula: string): string => formatPlainUnicode(formula);

/** La familia de una sustancia, que es un hecho y no una pista. */
function familyOf(formula: string): string | null {
  return classifyFormula(formula)?.label ?? null;
}

/**
 * Construye la pregunta del modo descubrimiento.
 *
 * La respuesta correcta sale de predecir por dentro; lo que NO se muestra es
 * el resultado. Las opciones falsas son tipos de reaccion reales que no
 * corresponden, elegidos de forma estable a partir de los propios reactivos
 * para que la misma pareja de siempre las mismas opciones — si cambiaran en
 * cada repintado, el usuario creeria que el programa duda.
 */
function buildQuestion(bench: readonly string[]): DiscoveryQuestion | null {
  const result = predict(bench);
  const best = result.predictions[0];

  const label = (t: string): string => TYPE_LABEL[t] ?? t;
  const seed = bench.join('|').length;

  /*
   * «Evidencia desconocida» es como el motor marca una pareja que PODRIA
   * intercambiar iones pero no lo hace: sin precipitado, sin gas y sin agua
   * formada no hay fuerza motriz, y los cuatro iones se quedan mezclados.
   *
   * Es el caso del NaCl con el KI. El motor lo explica bien; el guia, si mira
   * solo `types[0]`, ve «doble sustitucion» y lo daria por bueno — ensenando
   * justo lo contrario de lo que el motor dice. La respuesta correcta ahi es
   * que NO reaccionan, y la explicacion del motor ya lo razona.
   */
  const noReaction = best === undefined || best.evidence === 'unknown';

  if (noReaction) {
    // Que NO ocurra nada es una respuesta legitima, y de las que mas ensenan.
    // Se ofrecen tipos reales como opciones falsas — incluido, cuando lo hay,
    // el que el motor descarto: es el error que de verdad se comete.
    const tempting = best?.types[0];
    const distractors = [
      ...(tempting ? [tempting] : []),
      ...COMMON_TYPES.filter((t) => t !== tempting),
    ]
      .slice(0, 3)
      .map((t) => ({ id: t, label: label(t), correct: false }));

    const cut = seed % (distractors.length + 1);
    return {
      text: `Antes de mirar: con ${bench.map(pretty).join(' y ')}, ¿que crees que pasa?`,
      options: [
        ...distractors.slice(0, cut),
        { id: 'none', label: 'No reaccionan', correct: true },
        ...distractors.slice(cut),
      ],
      reveal:
        best?.explanation ??
        'No reaccionan. Que dos sustancias esten juntas no significa que ocurra algo: hace falta una ' +
          'fuerza impulsora — que se forme un solido, un gas, agua, o que haya transferencia de electrones.',
    };
  }

  const correct = best.types[0];
  if (!correct) return null;

  const wrong = COMMON_TYPES.filter((t) => !best.types.includes(t)).slice(0, 2);
  const options: DiscoveryOption[] = [
    { id: correct, label: label(correct), correct: true },
    ...wrong.map((t) => ({ id: t, label: label(t), correct: false })),
    { id: 'none', label: 'No reaccionan', correct: false },
  ];

  // Barajado estable: depende de los reactivos, no del momento.
  const rotated = options.slice(seed % options.length).concat(options.slice(0, seed % options.length));

  return {
    text: `Antes de mirar: con ${bench.map(pretty).join(' y ')}, ¿que tipo de reaccion crees que ocurre?`,
    options: rotated,
    reveal: best.explanation,
  };
}

// ---------------------------------------------------------------------------

function guideBuild(ctx: GuideContext): GuideMessage {
  const { cation, anion } = ctx.builder;

  if (!cation && !anion) {
    return {
      mood: 'idle',
      headline: 'Vamos a formular',
      body:
        'Aqui no ocurre ninguna reaccion: los iones ya estan juntos en el compuesto. Lo que vas a ' +
        'averiguar es en que PROPORCION se combinan para que la carga total sea cero.',
      hints: [
        { text: 'Elige un cation (los marcados +) y un anion (los marcados −) en la lista.', from: 'Constructor' },
        { text: 'Prueba con calcio y oxido: son los dos mas sencillos para empezar.', from: 'Constructor' },
      ],
      question: null,
    };
  }

  if (!cation || !anion) {
    const have = cation ?? anion!;
    const missing = cation ? 'anion' : 'cation';
    return {
      mood: 'pointing',
      headline: `Falta el ${missing}`,
      body: `Ya tienes el ${have.name} (${pretty(have.formula)}, carga ${have.charge > 0 ? '+' : ''}${have.charge}). ` +
        `Necesitas un ${missing} para equilibrar la carga.`,
      hints: [
        {
          text: `Busca en la lista uno marcado con ${cation ? '−' : '+'}.`,
          from: 'Constructor',
        },
      ],
      question: null,
    };
  }

  const family = ctx.builtFormula ? familyOf(ctx.builtFormula) : null;
  return {
    mood: 'done',
    headline: `${ctx.builtFormula ? pretty(ctx.builtFormula) : 'Compuesto'} construido`,
    body:
      `Fijate en la comprobacion de cargas: ${cation.charge > 0 ? '+' : ''}${cation.charge} y ` +
      `${anion.charge} tienen que cancelarse exactamente. Esa es toda la regla.`,
    hints: [
      ...(family ? [{ text: `Se clasifica como ${family.toLowerCase()}.`, from: 'Clasificacion' }] : []),
      { text: 'Pulsa «Ver derivacion» para los seis pasos del razonamiento.', from: 'Constructor' },
      {
        text: 'En la pestana Tabla lo tienes cruzado con todos los demas iones a la vez.',
        from: 'Tabla de combinaciones',
      },
    ],
    question: null,
  };
}

function guideReact(ctx: GuideContext): GuideMessage {
  const n = ctx.bench.length;

  if (n === 0) {
    return {
      mood: 'idle',
      headline: 'Vamos a hacer reaccionar algo',
      body:
        'Aqui SI ocurre algo: unas sustancias se convierten en otras. Anade dos con el boton + de la ' +
        'lista y te dire que se forma — o por que no pasa nada.',
      hints: [
        { text: 'Prueba «cal viva» y «agua»: es el apagado de la cal, y desprende mucho calor.', from: 'Reacciones curadas' },
        { text: 'O «acido clorhidrico» y «hidroxido de sodio»: la neutralizacion de manual.', from: 'Reacciones curadas' },
      ],
      question: null,
    };
  }

  if (n === 1) {
    const only = ctx.bench[0]!;
    const family = familyOf(only);
    const available = reactionsAvailableFor(only);
    return {
      mood: 'pointing',
      headline: 'Falta el segundo reactivo',
      body: `Tienes ${pretty(only)}${family ? `, clasificado como ${family.toLowerCase()}` : ''}. Anade otra sustancia.`,
      hints: [
        available.length > 0
          ? {
              text: `Hay ${available.length} transformacion${available.length === 1 ? '' : 'es'} documentada${available.length === 1 ? '' : 's'} que parten de ${pretty(only)}: las tienes listadas abajo.`,
              from: 'Reacciones curadas',
            }
          : {
              text: `No hay reacciones curadas que partan de ${pretty(only)}, pero el motor aplicara sus reglas igualmente.`,
              from: 'Reacciones curadas',
            },
      ],
      question: null,
    };
  }

  // --- Dos reactivos: la pregunta del §23 antes de revelar nada ------------
  const key = [...ctx.bench].sort().join('+');
  if (ctx.predictions.length === 0) {
    const answered = ctx.answeredFor === key;
    const families = ctx.bench
      .map((f) => ({ f, family: familyOf(f) }))
      .filter((x) => x.family !== null);

    /*
     * La pregunta se devuelve TAMBIEN despues de contestada.
     *
     * Retirarla al responder — que es lo que hacia antes — se llevaba por
     * delante la explicacion, que es justo la parte que ensena: el usuario se
     * mojaba y no llegaba a ver por que. La vista se encarga de mostrarla ya
     * resuelta, con la opcion correcta senalada aunque se haya fallado.
     */
    return {
      mood: answered ? 'pointing' : 'asking',
      headline: answered ? 'Ahora comprueba' : 'Antes de pulsar Predecir',
      body: answered
        ? 'Pulsa «Predecir» y compara tu razonamiento con el desarrollo completo del motor.'
        : 'Mojate primero. Ver el resultado sin haber pensado una respuesta no ensena casi nada; ' +
          'equivocarse y ver por que, si.',
      hints: families.map((x) => ({
        text: `${pretty(x.f)} se clasifica como ${x.family!.toLowerCase()}.`,
        from: 'Clasificacion',
      })),
      question: buildQuestion(ctx.bench),
    };
  }

  // --- Ya hay prediccion: senalar lo que merece la pena mirar --------------
  const p = ctx.activePrediction ?? ctx.predictions[0]!;
  const hazard = HAZARD_NOTE[p.hazard];
  const hints: GuideHint[] = [];

  if (p.types.length > 0) {
    hints.push({
      text: `Es ${(TYPE_LABEL[p.types[0]!] ?? p.types[0]!).toLowerCase()}.`,
      from: 'Motor de reacciones',
    });
  }
  if (p.evidence === 'predicted') {
    hints.push({
      text: 'Esta prediccion sale de aplicar reglas, no de una reaccion documentada. Puede no ocurrir tal cual.',
      from: 'Nivel de evidencia',
    });
  }
  if (p.conditions.description) {
    hints.push({ text: `Condiciones: ${p.conditions.description}.`, from: 'Reacciones curadas' });
  }
  if (ctx.predictions.length > 1) {
    hints.push({
      text: `Hay ${ctx.predictions.length} caminos posibles segun las condiciones. Mira los demas antes de quedarte con uno.`,
      from: 'Motor de reacciones',
    });
  }
  hints.push({ text: 'Pulsa «Explicame» en la tarjeta para el desarrollo completo.', from: 'Modo profesor' });

  return {
    mood: hazard && (p.hazard === 'hazardous' || p.hazard === 'do-not-attempt') ? 'warning' : 'done',
    headline: hazard ?? 'Reaccion resuelta',
    body: p.explanation,
    hints,
    question: null,
  };
}

// ---------------------------------------------------------------------------

export function guide(ctx: GuideContext): GuideMessage {
  switch (ctx.mode) {
    case 'build':
      return guideBuild(ctx);

    case 'react':
      return guideReact(ctx);

    case 'tabla':
      return {
        mood: 'idle',
        headline: 'Todas las combinaciones a la vez',
        body:
          'Cada casilla cruza un cation con un anion. Lo importante es el color: verde con punto ' +
          'significa que la sustancia esta VERIFICADA en la base de datos; sin color, que la formula ' +
          'es correcta pero el compuesto no esta comprobado.',
        hints: [
          { text: 'Marca «Solo verificadas» para quedarte con las sustancias que existen de verdad.', from: 'Tabla' },
          { text: 'Marca «Solo precipitados» para trabajar solubilidad.', from: 'Reglas de solubilidad' },
          { text: 'Las casillas rayadas no proceden, y al pasar por encima dicen por que.', from: 'Tabla' },
        ],
        question: null,
      };

    case 'teoria':
      return {
        mood: 'idle',
        headline: 'La unidad 1, con las leyes calculadas',
        body:
          'Los bloques marcados con ⚙ no son texto: se calculan con los mismos motores que usa el resto ' +
          'de la aplicacion. Si manana cambiara una masa atomica, cambiarian esos numeros.',
        hints: [
          { text: 'Usa el indice de la izquierda para saltar a un apartado.', from: 'Temario' },
          {
            text: 'El apartado 1.6 dice abiertamente lo que este sandbox NO tiene: modelo de mezclas.',
            from: 'Temario',
          },
        ],
        question: null,
      };

    case 'routes':
      return {
        mood: 'idle',
        headline: 'De una sustancia a otra',
        body: 'Encadena reacciones para llegar de un punto de partida a un destino.',
        hints: [
          { text: 'Prueba S → H2SO4: es la ruta industrial del acido sulfurico.', from: 'Red de transformaciones' },
        ],
        question: null,
      };

    case 'lab':
      return {
        mood: 'idle',
        headline: 'Cantidades',
        body:
          'El motor de moles, gramos y reactivo limitante esta hecho y probado; su interfaz es lo ' +
          'siguiente en la hoja de ruta. Prefiero decirtelo a ensenarte una pantalla que no calcula.',
        hints: [],
        question: null,
      };

    default:
      return { mood: 'idle', headline: '', body: '', hints: [], question: null };
  }
}
