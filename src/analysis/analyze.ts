/**
 * ORQUESTADOR DEL ANALISIS (§64, §50, §66).
 *
 * Recorre la cadena completa que pide el brief
 *
 *   ATOMOS → ELECTRONES → ORBITALES → LEWIS → ENLACES → RESONANCIA →
 *   HIBRIDACION → GEOMETRIA → POLARIDAD → FUERZAS INTERMOLECULARES →
 *   PROPIEDADES
 *
 * y convierte cada resultado en un HALLAZGO que declara de que otros hallazgos
 * depende.
 *
 * POR QUE ASI Y NO DE OTRA MANERA
 * El requisito mas exigente del brief es el §66: cada resultado debe poder
 * abrirse con «¿por que?» y llevar a los resultados que lo fundamentan, tan
 * abajo como el usuario quiera. Si eso se implementa como un arbol de textos
 * escrito a mano, se desincroniza del calculo en la primera modificacion y
 * acaba mintiendo. Aqui la explicacion ES el grafo que el calculo construyo,
 * asi que no puede contradecirlo.
 *
 * Este modulo NO calcula quimica. Solo la llama y la conecta. Los motores
 * (lewis, resonance, hybridization, polarity, imf) no se conocen entre si ni
 * saben nada de hallazgos, lo que cumple el §62.
 */

import { parseFormula } from '../core/formula/parse.js';
import { classify } from '../core/classify.js';
import { assignOxidationStates, fmt } from '../core/oxidation.js';
import { nameFormula, preferredName } from '../core/nomenclature/inorganic.js';
import { getElement } from '../data/elements.js';
import { formatFormulaUnicode } from '../core/formula/render.js';

import { FindingGraph } from './findings.js';
import type { Finding } from './findings.js';
import { configureAtom, orbitalDiagram } from './electronic.js';
import { deriveLewis, diagnoseLewis, lewisLine, formalChargeWorkings } from './lewis.js';
import { analyzeResonance, bondOrderConsequences } from './resonance.js';
import { analyzeGeometry } from './hybridization.js';
import { analyzePolarity } from './polarity.js';
import { analyzeIntermolecularForces } from './imf.js';

import type { LewisResult } from './lewis.js';
import type { ResonanceResult } from './resonance.js';
import type { GeometryResult } from './hybridization.js';
import type { PolarityResult } from './polarity.js';
import type { ImfResult } from './imf.js';

export interface AnalysisProfile {
  readonly formula: string;
  readonly pretty: string;
  readonly charge: number;
  /** El grafo completo: es la respuesta a «¿por que?» de cualquier resultado. */
  readonly graph: FindingGraph;
  /** Resultados en bruto, por si la interfaz necesita mas detalle. */
  readonly lewis: LewisResult | null;
  readonly resonance: ResonanceResult | null;
  readonly geometry: GeometryResult | null;
  readonly polarity: PolarityResult | null;
  readonly imf: ImfResult | null;
  /** Lo que el motor NO ha podido determinar, y por que (§32, §58). */
  readonly limitations: readonly string[];
}

/** Atajo para no repetir el objeto entero en cada hallazgo. */
function finding(f: Finding): Finding {
  return f;
}

export function analyzeSpecies(input: string): AnalysisProfile | null {
  const formula = input.trim();
  const parsed = parseFormula(formula);
  if (!parsed.ok) return null;

  const composition = parsed.value.composition;
  const charge = parsed.value.charge;
  const graph = new FindingGraph();
  const limitations: string[] = [];
  // Se usa el arbol ya analizado, no la cadena en bruto: asi "SO4-2" sale
  // como SO₄²⁻ y no como SO₄-2.
  const pretty = formatFormulaUnicode(parsed.value);

  // =========================================================================
  // IDENTIDAD Y COMPOSICION
  // =========================================================================

  const totalAtoms = [...composition.values()].reduce((sum, n) => sum + n, 0);
  const molarMass = [...composition].reduce(
    (sum, [symbol, count]) => sum + (getElement(symbol)?.atomicMass ?? 0) * count,
    0,
  );

  graph.add(
    finding({
      id: 'identity.formula',
      section: 'identidad',
      label: 'Formula',
      value: pretty,
      because: 'Es el dato de partida: lo que el usuario ha introducido, ya interpretado.',
      confidence: 'calculated',
      dependsOn: [],
      level: 1,
    }),
  );

  graph.add(
    finding({
      id: 'composition.atoms',
      section: 'composicion',
      label: 'Composicion',
      value: [...composition].map(([s, c]) => `${c}×${s}`).join(' + ') + ` (${totalAtoms} atomos)`,
      because: 'Sale de leer la formula elemento a elemento, resolviendo parentesis e hidratos.',
      confidence: 'calculated',
      dependsOn: ['identity.formula'],
      level: 1,
    }),
  );

  graph.add(
    finding({
      id: 'composition.molarMass',
      section: 'composicion',
      label: 'Masa molar',
      value: `${molarMass.toFixed(3)} g/mol`,
      because: 'Suma de las masas atomicas de todos los atomos de la formula.',
      confidence: 'calculated',
      dependsOn: ['composition.atoms'],
      steps: [
        {
          text: 'Se multiplica la masa atomica de cada elemento por cuantas veces aparece y se suman.',
          math:
            [...composition]
              .map(([s, c]) => `${c}×${(getElement(s)?.atomicMass ?? 0).toFixed(3)}`)
              .join(' + ') + ` = ${molarMass.toFixed(3)}`,
        },
      ],
      source: 'Masas atomicas IUPAC',
      level: 1,
    }),
  );

  const classification = classify(formula, composition, charge);
  graph.add(
    finding({
      id: 'identity.class',
      section: 'identidad',
      label: 'Tipo de compuesto',
      value: classification.label,
      because: classification.reason,
      confidence: 'calculated',
      dependsOn: ['composition.atoms'],
      level: 1,
    }),
  );

  const nomenclature = nameFormula(formula);
  const name = nomenclature ? preferredName(nomenclature) : null;
  if (name) {
    graph.add(
      finding({
        id: 'identity.name',
        section: 'identidad',
        label: 'Nombre',
        value: name,
        because:
          'Se construye a partir del tipo de compuesto y de los estados de oxidacion, siguiendo las ' +
          'reglas de nomenclatura.',
        confidence: 'calculated',
        dependsOn: ['identity.class'],
        level: 1,
      }),
    );
  } else {
    limitations.push('No se ha podido nombrar esta especie con las reglas implementadas.');
  }

  // =========================================================================
  // ATOMOS Y ELECTRONES
  // =========================================================================

  for (const [symbol] of composition) {
    const element = getElement(symbol);
    if (!element) continue;
    const config = configureAtom(symbol);
    if (!config) continue;

    graph.add(
      finding({
        id: `atom.${symbol}`,
        section: 'atomos',
        label: `${element.name} (${symbol})`,
        value: `Z = ${element.Z} · grupo ${element.group ?? '—'} · periodo ${element.period}`,
        because:
          `El numero atomico ${element.Z} identifica al elemento: son los protones de su nucleo. ` +
          'La posicion en la tabla no es una convencion: es consecuencia de su configuracion electronica.',
        confidence: 'experimental',
        dependsOn: ['composition.atoms'],
        source: 'Tabla periodica IUPAC',
        level: 1,
      }),
    );

    graph.add(
      finding({
        id: `electrons.config.${symbol}`,
        section: 'electrones',
        label: `Configuracion de ${symbol}`,
        value: config.condensed,
        because:
          'Los electrones ocupan los orbitales de menor energia primero (Aufbau), sin repetir los ' +
          'cuatro numeros cuanticos (Pauli) y desapareandose antes de emparejarse (Hund).' +
          (config.isAnomalous && config.anomalyReason ? ` ${config.anomalyReason}` : ''),
        confidence: config.isAnomalous ? 'experimental' : 'theoretical',
        model: 'Aufbau + Pauli + Hund',
        dependsOn: [`atom.${symbol}`],
        steps: orbitalDiagram(config).map((text) => ({ text })),
        level: 3,
      }),
    );

    graph.add(
      finding({
        id: `electrons.valence.${symbol}`,
        section: 'electrones',
        label: `Electrones de valencia de ${symbol}`,
        value: `${config.valenceElectrons} (${config.unpairedElectrons} desapareados, ${config.magnetism})`,
        because:
          'Son los que quedan fuera del core de gas noble. Son los unicos que participan en los ' +
          'enlaces: los internos estan demasiado ligados al nucleo.',
        confidence: 'calculated',
        dependsOn: [`electrons.config.${symbol}`],
        level: 2,
      }),
    );
  }

  // Estados de oxidacion.
  const oxidation = assignOxidationStates(composition, charge, formula);
  if (oxidation.ok) {
    graph.add(
      finding({
        id: 'redox.oxidationStates',
        section: 'redox',
        label: 'Estados de oxidacion',
        value: oxidation.value.assignments
          .map((a) => `${a.symbol} ${fmt(a.state)}${a.isAverage ? ' (promedio)' : ''}`)
          .join(' · '),
        because:
          'Se asignan aplicando por orden las reglas de prioridad, y la suma tiene que dar la carga ' +
          'de la especie. Esa comprobacion es lo que hace fiable el resultado.',
        confidence: 'calculated',
        model: 'Reglas de estado de oxidacion',
        dependsOn: ['composition.atoms', 'identity.class'],
        steps: [
          ...oxidation.value.assignments.map((a) => ({ text: `${a.symbol}: ${a.reason}`, math: `${a.rule}` })),
          { text: 'Comprobacion final.', math: oxidation.value.balanceText },
        ],
        level: 2,
      }),
    );
  } else {
    limitations.push(
      'No se han podido asignar los estados de oxidacion: las reglas dejan mas de una incognita.',
    );
  }

  // =========================================================================
  // LEWIS Y TODO LO QUE CUELGA DE ELLA
  // =========================================================================

  // Un compuesto ionico extendido no es una molecula, y aplicarle la cadena
  // molecular produciria una respuesta bien formada y falsa (§32).
  if (classification.ionic && charge === 0) {
    graph.add(
      finding({
        id: 'lewis.notApplicable',
        section: 'lewis',
        label: 'Estructura de Lewis',
        value: 'No aplicable: no es una molecula',
        because:
          `${pretty} es un compuesto IONICO. No existe "una molecula" de ${pretty}: lo que hay es una ` +
          'red tridimensional en la que cada ion esta rodeado de iones de carga contraria. La formula ' +
          'da la PROPORCION entre iones, no el contenido de una particula. Se puede analizar cada ion ' +
          'por separado, pero no el conjunto como si fuera molecular.',
        confidence: 'calculated',
        dependsOn: ['identity.class'],
        level: 2,
      }),
    );

    graph.add(
      finding({
        id: 'intermoleculares.ionic',
        section: 'intermoleculares',
        label: 'Fuerzas presentes',
        value: 'Atraccion ionica en red',
        because:
          'Las fuerzas que mantienen unido el solido no son intermoleculares: son atracciones ' +
          'electrostaticas entre iones, mucho mas intensas. Es la razon de que las sales tengan puntos ' +
          'de fusion tan altos y de que conduzcan la electricidad fundidas o disueltas, pero no en solido.',
        confidence: 'theoretical',
        dependsOn: ['lewis.notApplicable'],
        level: 2,
      }),
    );

    limitations.push(
      `${pretty} es ionico: geometria molecular, polaridad y fuerzas intermoleculares no se aplican ` +
        'al conjunto. El motor lo declara en lugar de calcularlas sobre una molecula que no existe.',
    );

    return {
      formula,
      pretty,
      charge,
      graph,
      lewis: null,
      resonance: null,
      geometry: null,
      polarity: null,
      imf: null,
      limitations,
    };
  }

  const lewis = deriveLewis(formula);
  if (!lewis) {
    const reason = diagnoseLewis(formula) ?? 'El modelo de Lewis no cubre esta especie.';
    graph.add(
      finding({
        id: 'lewis.unavailable',
        section: 'lewis',
        label: 'Estructura de Lewis',
        value: 'No determinable con este modelo',
        because: reason,
        confidence: 'unknown',
        dependsOn: ['composition.atoms'],
        level: 2,
      }),
    );
    limitations.push(reason);
    return {
      formula, pretty, charge, graph,
      lewis: null, resonance: null, geometry: null, polarity: null, imf: null,
      limitations,
    };
  }

  const structure = lewis.best;

  graph.add(
    finding({
      id: 'lewis.valenceCount',
      section: 'lewis',
      label: 'Electrones de valencia totales',
      value: `${structure.totalValenceElectrons} e⁻`,
      because:
        'Se suman los electrones de valencia de cada atomo y se corrige por la carga: un anion ha ' +
        'ganado electrones y un cation los ha perdido. Este numero es la restriccion que toda ' +
        'estructura valida tiene que respetar.',
      confidence: 'calculated',
      dependsOn: [...composition.keys()].map((s) => `electrons.valence.${s}`).filter((id) => graph.has(id)),
      steps: lewis.steps.slice(0, 1).map((s) => ({ text: s.text, math: s.math })),
      level: 2,
    }),
  );

  graph.add(
    finding({
      id: 'lewis.structure',
      section: 'lewis',
      label: 'Estructura de Lewis',
      value: lewisLine(structure),
      because:
        'Se reparten los electrones de valencia como enlaces y pares libres de forma que se cumplan ' +
        'los octetos y la suma de cargas formales sea la carga de la especie. Entre las opciones ' +
        'validas se elige la de cargas formales mas pequenas.',
      confidence: 'theoretical',
      model: 'Lewis',
      dependsOn: ['lewis.valenceCount'],
      steps: lewis.steps.slice(1).map((s) => ({ text: s.text, math: s.math })),
      level: 2,
    }),
  );

  const charged = structure.atoms.filter((a) => a.formalCharge !== 0);
  graph.add(
    finding({
      id: 'lewis.formalCharges',
      section: 'lewis',
      label: 'Cargas formales',
      value:
        charged.length === 0
          ? 'Todas cero'
          : charged.map((a) => `${a.id}: ${a.formalCharge > 0 ? '+' : ''}${a.formalCharge}`).join(' · '),
      because:
        'La carga formal supone que los electrones de cada enlace se reparten a partes iguales. NO es ' +
        'la carga real del atomo, que depende de la electronegatividad: es una herramienta de ' +
        'contabilidad para comparar estructuras.',
      confidence: 'calculated',
      dependsOn: ['lewis.structure'],
      steps: structure.atoms.map((a) => ({
        text: formalChargeWorkings(a).formula,
        math: formalChargeWorkings(a).substituted,
      })),
      level: 3,
    }),
  );

  for (const note of structure.notes) {
    graph.add(
      finding({
        id: `lewis.note.${structure.notes.indexOf(note)}`,
        section: 'lewis',
        label: 'Excepcion al octeto',
        value: note.split(':')[0] ?? 'Excepcion',
        because: note,
        confidence: 'theoretical',
        dependsOn: ['lewis.structure'],
        level: 3,
      }),
    );
  }

  // ---- Resonancia ---------------------------------------------------------

  const resonance = analyzeResonance(lewis);
  if (resonance.hasResonance) {
    const delocalized = resonance.bonds.filter((b) => b.delocalized);
    graph.add(
      finding({
        id: 'resonance.exists',
        section: 'resonancia',
        label: 'Resonancia',
        value: `Si — ${resonance.count} estructuras equivalentes`,
        because: resonance.explanation + ' ' + resonance.caution,
        confidence: 'theoretical',
        model: 'Resonancia (Lewis)',
        dependsOn: ['lewis.structure', 'lewis.formalCharges'],
        steps: resonance.steps.map((s) => ({ text: s.text, math: s.math })),
        level: 3,
      }),
    );

    const order = delocalized[0]?.averageOrder ?? 1;
    graph.add(
      finding({
        id: 'resonance.bondOrder',
        section: 'resonancia',
        label: 'Orden de enlace del hibrido',
        value: order.toFixed(2),
        because:
          `Media de los ordenes que toma cada enlace en las ${resonance.count} estructuras. ` +
          bondOrderConsequences(order).length,
        confidence: 'calculated',
        dependsOn: ['resonance.exists'],
        level: 3,
      }),
    );

    if (resonance.chargeSharedBy.length > 0) {
      graph.add(
        finding({
          id: 'resonance.chargeDelocalization',
          section: 'resonancia',
          label: 'Deslocalizacion de la carga',
          value: `Repartida entre ${resonance.chargeSharedBy.join(', ')}`,
          because:
            `Los ${resonance.delocalizedElectrons} electrones pi del sistema no estan en un enlace ` +
            'concreto, y la carga tampoco esta sobre un atomo concreto. ' +
            resonance.stabilization,
          confidence: 'theoretical',
          dependsOn: ['resonance.exists'],
          level: 4,
        }),
      );
    }
  }

  // ---- Hibridacion y geometria -------------------------------------------

  const geometry = analyzeGeometry(structure);
  const central = geometry.central;

  if (central) {
    graph.add(
      finding({
        id: 'geometry.steric',
        section: 'geometria',
        label: 'Regiones de densidad electronica',
        value: `${central.stericNumber} (${central.bondedAtoms} enlaces + ${central.lonePairs} pares libres)`,
        because:
          'Se cuentan alrededor del atomo central. Un enlace multiple cuenta como UNA region: los ' +
          'electrones pi ocupan el mismo espacio angular que el sigma al que acompanan. Por eso el ' +
          'CO2, con dos dobles enlaces, es lineal.',
        confidence: 'calculated',
        dependsOn: ['lewis.structure'],
        level: 2,
      }),
    );

    graph.add(
      finding({
        id: 'hybridization.central',
        section: 'hibridacion',
        label: `Hibridacion del ${central.symbol}`,
        value: central.hybridization,
        because: central.hybridizationDerivation + ' ' + geometry.caution,
        confidence: 'educational',
        model: 'Teoria del enlace de valencia',
        dependsOn: ['geometry.steric'],
        level: 4,
      }),
    );

    if (central.vsepr) {
      graph.add(
        finding({
          id: 'geometry.electronic',
          section: 'geometria',
          label: 'Geometria electronica',
          value: central.vsepr.electronGeometry,
          because:
            `Las ${central.stericNumber} regiones de densidad electronica se repelen y se separan lo ` +
            'maximo posible. Esa disposicion es la geometria electronica, e incluye los pares libres.',
          confidence: 'theoretical',
          model: 'VSEPR',
          dependsOn: ['geometry.steric'],
          level: 2,
        }),
      );

      graph.add(
        finding({
          id: 'geometry.molecular',
          section: 'geometria',
          label: 'Geometria molecular',
          value: geometry.shape,
          because:
            central.lonePairs > 0
              ? `La geometria molecular describe solo donde estan los ATOMOS. Los ${central.lonePairs} ` +
                'pares libres ocupan sitio y determinan la forma, pero no se ven: quitandolos del ' +
                `dibujo, la ${central.vsepr.electronGeometry} queda como ${central.vsepr.geometry}.`
              : 'Sin pares libres, la geometria molecular coincide con la electronica.',
          confidence: 'theoretical',
          model: 'VSEPR',
          dependsOn: ['geometry.electronic'],
          steps: geometry.steps.map((s) => ({ text: s.text, math: s.math })),
          level: 2,
        }),
      );

      graph.add(
        finding({
          id: 'geometry.angle',
          section: 'geometria',
          label: 'Angulo de enlace',
          value: `≈ ${central.vsepr.idealAngle}°`,
          because:
            central.lonePairs > 0
              ? 'Los pares libres empujan mas que los pares enlazantes, porque solo estan sujetos a un ' +
                'nucleo y se extienden mas. Comprimen el angulo por debajo del valor ideal de la ' +
                'geometria electronica.'
              : 'Es el angulo que separa al maximo las regiones de densidad electronica.',
          confidence: 'theoretical',
          model: 'VSEPR',
          dependsOn: ['geometry.molecular'],
          level: 3,
        }),
      );
    }

    if (geometry.piBonds > 0) {
      graph.add(
        finding({
          id: 'enlaces.sigmaPi',
          section: 'enlaces',
          label: 'Enlaces sigma y pi',
          value: `${geometry.sigmaBonds} σ · ${geometry.piBonds} π`,
          because:
            'El primer enlace entre dos atomos siempre es sigma (solapamiento frontal, sobre el eje ' +
            'que une los nucleos). Los siguientes son pi (solapamiento lateral de orbitales p sin ' +
            'hibridar). Un enlace pi impide el giro alrededor del enlace, y de ahi sale la isomeria ' +
            'cis/trans.',
          confidence: 'theoretical',
          model: 'Teoria del enlace de valencia',
          dependsOn: ['lewis.structure', 'hybridization.central'],
          level: 4,
        }),
      );
    }
  }

  // ---- Polaridad ----------------------------------------------------------

  const polarity = analyzePolarity(structure, geometry);

  const distinctBonds = [...new Map(polarity.bonds.map((b) => [`${b.a}${b.b}`, b])).values()];
  graph.add(
    finding({
      id: 'polarity.bonds',
      section: 'polaridad',
      label: 'Polaridad de los enlaces',
      value: distinctBonds.map((b) => `${b.a}–${b.b}: ${b.kind} (Δχ ${b.deltaEN.toFixed(2)})`).join(' · '),
      because:
        'Un enlace es polar cuando los dos atomos atraen los electrones con fuerza distinta. Lo mide ' +
        'la diferencia de electronegatividad, y solo eso: la geometria aqui no interviene.',
      confidence: 'calculated',
      model: 'Electronegatividad de Pauling',
      dependsOn: ['lewis.structure'],
      steps: distinctBonds.map((b) => ({ text: b.explanation })),
      source: 'Electronegatividades de Pauling',
      level: 2,
    }),
  );

  graph.add(
    finding({
      id: 'polarity.molecular',
      section: 'polaridad',
      label: 'Polaridad de la molecula',
      value: polarity.isPolar ? 'POLAR' : 'APOLAR',
      because: polarity.reason,
      confidence: 'calculated',
      dependsOn: central?.vsepr ? ['polarity.bonds', 'geometry.molecular'] : ['polarity.bonds'],
      steps: [
        ...polarity.steps.map((s) => ({ text: s.text, math: s.math })),
        { text: polarity.direction },
        { text: polarity.caution },
      ],
      level: 3,
    }),
  );

  // ---- Fuerzas intermoleculares y propiedades -----------------------------

  const imf = analyzeIntermolecularForces(structure, polarity);
  const present = imf.forces.filter((f) => f.present);

  graph.add(
    finding({
      id: 'imf.forces',
      section: 'intermoleculares',
      label: 'Fuerzas intermoleculares',
      value: present.map((f) => f.kind).join(' · '),
      because:
        'Las fuerzas presentes se deducen de la polaridad de la molecula y de si hay hidrogenos ' +
        'unidos a N, O o F. ' + imf.caution,
      confidence: 'theoretical',
      dependsOn: ['polarity.molecular'],
      steps: present.map((f) => ({ text: `${f.kind}: ${f.because}` })),
      level: 3,
    }),
  );

  if (imf.dominant) {
    graph.add(
      finding({
        id: 'imf.dominant',
        section: 'intermoleculares',
        label: 'Fuerza dominante',
        value: imf.dominant.kind,
        because:
          imf.dominant.because +
          ' Es la que decide el comportamiento macroscopico de la sustancia.',
        confidence: 'theoretical',
        dependsOn: ['imf.forces'],
        level: 3,
      }),
    );
  }

  for (const consequence of imf.consequences) {
    graph.add(
      finding({
        id: `properties.${consequence.property.toLowerCase().replace(/[^a-z]+/g, '-')}`,
        section: 'propiedades',
        label: consequence.property,
        value: consequence.prediction.split('.')[0] + '.',
        because: consequence.prediction,
        confidence: 'theoretical',
        dependsOn: imf.dominant ? ['imf.dominant'] : ['imf.forces'],
        level: 1,
      }),
    );
  }

  limitations.push(
    'Los puntos de fusion y ebullicion concretos son datos EXPERIMENTALES. Este motor predice el ' +
      'orden relativo entre especies comparables, que es lo que las fuerzas intermoleculares ' +
      'determinan, pero no estima las cifras.',
  );

  if (resonance.hasResonance) {
    limitations.push(
      'La estructura de Lewis mostrada es una de las formas resonantes. La molecula real es el ' +
        'hibrido, y ninguna de las estructuras dibujadas existe por separado.',
    );
  }

  for (const warning of lewis.warnings) limitations.push(warning);

  return { formula, pretty, charge, graph, lewis, resonance, geometry, polarity, imf, limitations };
}
