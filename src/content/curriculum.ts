/**
 * The academic plan.
 *
 * The 41 subjects of §9, organised into the progression a chemistry degree
 * actually follows, with prerequisites, objectives, unit structure and — most
 * importantly — the cross-links that make §10 work: every concept declares
 * which other subjects it depends on and which later ones depend on it, so the
 * knowledge graph and the curriculum view are two readings of one data set.
 */

export type CourseArea =
  | 'matematicas' | 'fisica' | 'general' | 'inorganica' | 'analitica'
  | 'organica' | 'fisicoquimica' | 'aplicada' | 'ambiental' | 'investigacion';

export const AREA_LABEL: Record<CourseArea, string> = {
  matematicas: 'Matemáticas',
  fisica: 'Física',
  general: 'Química General',
  inorganica: 'Química Inorgánica',
  analitica: 'Química Analítica',
  organica: 'Química Orgánica',
  fisicoquimica: 'Fisicoquímica',
  aplicada: 'Química Aplicada',
  ambiental: 'Química Ambiental y de Recursos',
  investigacion: 'Investigación',
};

export const AREA_SERIES: Record<CourseArea, number> = {
  matematicas: 4, fisica: 8, general: 1, inorganica: 3, analitica: 2,
  organica: 5, fisicoquimica: 6, aplicada: 7, ambiental: 3, investigacion: 4,
};

export interface Topic {
  id: string;
  title: string;
  /** Concept ids from the knowledge graph that this topic teaches. */
  concepts: string[];
  /** Whether an interactive simulation exists for this topic. */
  simulation?: string;
  /** Laboratory practical linked to this topic. */
  lab?: string;
  /** Estimated study time, minutes. */
  minutes: number;
}

export interface Chapter {
  id: string;
  title: string;
  topics: Topic[];
}

export interface Unit {
  id: string;
  title: string;
  summary: string;
  chapters: Chapter[];
}

export interface Course {
  id: string;
  /** Position in the study plan, 1–41, as listed in the specification. */
  number: number;
  code: string;
  name: string;
  area: CourseArea;
  /** Suggested term, 1–10. */
  term: number;
  credits: number;
  elective: boolean;
  /** Course ids that must be completed first. */
  prerequisites: string[];
  objectives: string[];
  units: Unit[];
  /** Substance ids introduced or used heavily in this course. */
  substances?: string[];
  /** Instrument ids the course requires. */
  instruments?: string[];
  /** The capstone project of the course. */
  project?: string;
  description: string;
}

/**
 * Compact unit builder. The full unit → chapter → topic → concept tree of §10
 * is expressed here as data; `u()` expands the shorthand so the file stays
 * readable at 41 courses.
 */
const u = (
  id: string, title: string, summary: string,
  chapters: Array<[string, string, Array<[string, string[], number, string?, string?]>]>,
): Unit => ({
  id, title, summary,
  chapters: chapters.map(([cid, ctitle, topics]) => ({
    id: `${id}.${cid}`,
    title: ctitle,
    topics: topics.map(([ttitle, concepts, minutes, simulation, lab]) => ({
      id: `${id}.${cid}.${ttitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
      title: ttitle, concepts, minutes, simulation, lab,
    })),
  })),
});

export const COURSES: Course[] = [
  // ======================= CICLO BÁSICO =====================================
  {
    id: 'geo1', number: 1, code: 'MAT-101', name: 'Geometría Analítica y Vectores I',
    area: 'matematicas', term: 1, credits: 6, elective: false, prerequisites: [],
    description: 'El lenguaje geométrico y vectorial con el que se describen las moléculas, los campos y las fuerzas. Es la base de la geometría molecular y de todo el tratamiento vectorial de la física.',
    objectives: [
      'Operar con vectores en dos y tres dimensiones y aplicarlos a problemas físicos.',
      'Describir rectas, planos y cónicas y reconocerlos en contextos químicos.',
      'Calcular ángulos y distancias, las magnitudes que definen una geometría molecular.',
    ],
    units: [
      u('u1', 'Vectores', 'El vector como objeto con módulo, dirección y sentido.', [
        ['c1', 'Álgebra vectorial', [
          ['Suma, resta y producto por un escalar', ['vector'], 45],
          ['Producto escalar y ángulo entre vectores', ['producto-escalar', 'angulo-enlace'], 60, 'vector-angle'],
          ['Producto vectorial y momento', ['producto-vectorial'], 60],
        ]],
        ['c2', 'Aplicaciones geométricas', [
          ['Rectas y planos en el espacio', ['plano'], 50],
          ['Distancia punto-plano y punto-recta', ['distancia'], 45],
          ['Ángulos de enlace a partir de coordenadas', ['angulo-enlace', 'geometria-molecular'], 55, 'bond-angle'],
        ]],
      ]),
      u('u2', 'Cónicas y coordenadas', 'Sistemas de coordenadas y curvas fundamentales.', [
        ['c1', 'Cónicas', [
          ['Circunferencia, elipse, parábola e hipérbola', ['conica'], 60],
          ['La elipse en la órbita electrónica de Sommerfeld', ['orbital'], 40],
        ]],
        ['c2', 'Coordenadas alternativas', [
          ['Coordenadas polares, cilíndricas y esféricas', ['coordenadas-esfericas'], 55],
          ['Por qué los orbitales se describen en esféricas', ['orbital', 'armonicos-esfericos'], 50, 'orbital-coords'],
        ]],
      ]),
    ],
  },
  {
    id: 'algebra', number: 2, code: 'MAT-102', name: 'Álgebra',
    area: 'matematicas', term: 1, credits: 6, elective: false, prerequisites: [],
    description: 'Estructuras algebraicas, polinomios y sistemas de ecuaciones. El ajuste de una ecuación química es, literalmente, un problema de espacio nulo.',
    objectives: [
      'Resolver sistemas de ecuaciones lineales por métodos matriciales.',
      'Manejar polinomios y sus raíces, que aparecen en todo equilibrio químico.',
      'Comprender el ajuste de ecuaciones químicas como problema algebraico.',
    ],
    units: [
      u('u1', 'Sistemas de ecuaciones', 'Resolución y estructura de los sistemas lineales.', [
        ['c1', 'Métodos de resolución', [
          ['Eliminación gaussiana', ['sistema-lineal'], 60, 'gauss'],
          ['Rango, compatibilidad e indeterminación', ['rango'], 50],
          ['Ajuste de ecuaciones químicas por espacio nulo', ['ajuste-ecuaciones', 'estequiometria'], 70, 'balance-nullspace'],
        ]],
      ]),
      u('u2', 'Polinomios y raíces', 'De la ecuación cuadrática al equilibrio químico.', [
        ['c1', 'Raíces de polinomios', [
          ['Ecuación de segundo grado y su uso en equilibrio', ['equilibrio-quimico'], 50],
          ['Métodos numéricos: bisección y Newton', ['raices-numericas'], 60, 'root-finding'],
          ['Por qué un equilibrio poliprótico no tiene solución cerrada', ['equilibrio-poliprotico'], 45],
        ]],
      ]),
    ],
  },
  {
    id: 'qg1', number: 3, code: 'QUI-101', name: 'Química General I',
    area: 'general', term: 1, credits: 8, elective: false, prerequisites: [],
    description: 'El punto de partida. Materia, átomo, mol, estequiometría, disoluciones y gases: el vocabulario y la contabilidad de toda la química posterior.',
    substances: ['h2o', 'hcl', 'naoh', 'nacl', 'ch3cooh', 'cuso4', 'zn', 'cu'],
    instruments: ['balanza', 'phmetro'],
    project: 'Determinar la fórmula empírica de un hidrato desconocido por gravimetría.',
    objectives: [
      'Manejar el concepto de mol y realizar cálculos estequiométricos con soltura.',
      'Escribir y ajustar ecuaciones químicas, y predecir el reactivo limitante.',
      'Preparar disoluciones de concentración conocida y expresarla en todas sus formas.',
      'Aplicar las leyes de los gases y reconocer cuándo dejan de valer.',
    ],
    units: [
      u('u1', 'Materia y medida', 'Qué se mide, con qué unidades y con qué incertidumbre.', [
        ['c1', 'Magnitudes y unidades', [
          ['El Sistema Internacional y las constantes que lo definen', ['si', 'constantes'], 40],
          ['Cifras significativas y propagación de incertidumbre', ['cifras-significativas', 'incertidumbre'], 60, 'sigfig'],
          ['Exactitud frente a precisión', ['exactitud', 'precision'], 45, undefined, 'lab-balanza'],
        ]],
        ['c2', 'Clasificación de la materia', [
          ['Sustancias puras, mezclas y métodos de separación', ['sustancia', 'mezcla'], 50],
          ['Propiedades físicas y químicas, intensivas y extensivas', ['propiedad-intensiva'], 40],
        ]],
      ]),
      u('u2', 'Átomos, moléculas e iones', 'La estructura discreta de la materia.', [
        ['c1', 'Teoría atómica', [
          ['Leyes ponderales y la hipótesis de Dalton', ['atomo', 'ley-proporciones'], 50],
          ['Número atómico, número másico e isótopos', ['isotopo', 'numero-atomico'], 55, 'isotopes'],
          ['Masa atómica como media ponderada de isótopos', ['masa-atomica'], 45, 'atomic-mass'],
        ]],
        ['c2', 'Nomenclatura', [
          ['Compuestos iónicos y covalentes binarios', ['nomenclatura-inorganica'], 60, 'nomenclature'],
          ['Ácidos, bases y sales', ['acido', 'base', 'sal'], 60, 'nomenclature'],
        ]],
      ]),
      u('u3', 'Estequiometría', 'La contabilidad de la reacción química.', [
        ['c1', 'El mol', [
          ['Constante de Avogadro y masa molar', ['mol', 'masa-molar'], 55, 'mole'],
          ['Composición porcentual y fórmula empírica', ['formula-empirica'], 65, 'empirical'],
        ]],
        ['c2', 'Reacciones', [
          ['Ajuste de ecuaciones químicas', ['ajuste-ecuaciones'], 60, 'balance'],
          ['Reactivo limitante y rendimiento', ['reactivo-limitante', 'rendimiento'], 70, 'stoichiometry'],
          ['Economía atómica: una segunda mirada al rendimiento', ['economia-atomica', 'quimica-verde'], 45],
        ]],
      ]),
      u('u4', 'Disoluciones', 'Concentración, dilución y reacciones en disolución.', [
        ['c1', 'Concentración', [
          ['Molaridad, molalidad, fracción molar y ppm', ['concentracion', 'molaridad'], 60, 'concentration'],
          ['Preparación de disoluciones y dilución', ['dilucion'], 55, 'dilution', 'lab-preparacion'],
        ]],
        ['c2', 'Reacciones en disolución', [
          ['Precipitación y reglas de solubilidad', ['precipitacion', 'solubilidad'], 60, 'precipitation'],
          ['Ácido-base: neutralización y valoración elemental', ['neutralizacion', 'valoracion'], 70, 'titration', 'lab-titulacion'],
          ['Oxidación-reducción: estados de oxidación', ['redox', 'estado-oxidacion'], 65, 'oxidation-states'],
        ]],
      ]),
      u('u5', 'Gases', 'El estado más simple de la materia y su modelo.', [
        ['c1', 'Leyes de los gases', [
          ['Boyle, Charles, Avogadro y la ecuación de estado', ['gas-ideal'], 60, 'ideal-gas'],
          ['Mezclas de gases y presiones parciales', ['presion-parcial'], 50, 'partial-pressure'],
        ]],
        ['c2', 'Gases reales', [
          ['Teoría cinético-molecular', ['teoria-cinetica'], 55, 'kinetic-theory'],
          ['Desviaciones y ecuación de van der Waals', ['gas-real', 'van-der-waals'], 60, 'van-der-waals'],
        ]],
      ]),
    ],
  },
  {
    id: 'prob1', number: 4, code: 'MAT-103', name: 'Probabilidad y Estadística I',
    area: 'matematicas', term: 2, credits: 6, elective: false, prerequisites: ['algebra'],
    description: 'Ninguna medida existe sin su incertidumbre. Esta asignatura da las herramientas para decir qué significa un resultado experimental y cuándo dos resultados difieren de verdad.',
    objectives: [
      'Describir un conjunto de datos experimentales y su dispersión.',
      'Aplicar los contrastes de hipótesis que se usan en el laboratorio.',
      'Detectar valores anómalos con criterios objetivos.',
    ],
    units: [
      u('u1', 'Estadística descriptiva', 'Resumir un conjunto de medidas.', [
        ['c1', 'Medidas de centro y dispersión', [
          ['Media, mediana, desviación típica y RSD', ['media', 'desviacion-tipica'], 55, 'descriptive'],
          ['Error estándar de la media y su dependencia con n', ['error-estandar'], 50],
        ]],
      ]),
      u('u2', 'Inferencia', 'Del conjunto medido a la conclusión.', [
        ['c1', 'Distribuciones', [
          ['Distribución normal y de Student', ['distribucion-normal', 'distribucion-t'], 60],
          ['Intervalos de confianza', ['intervalo-confianza'], 55, 'confidence'],
        ]],
        ['c2', 'Contrastes', [
          ['Contraste t para exactitud', ['contraste-t'], 60, 'ttest'],
          ['Contraste F para precisión', ['contraste-f'], 50, 'ftest'],
          ['Rechazo de datos: Grubbs y Dixon', ['valor-anomalo'], 55, 'outliers'],
        ]],
      ]),
    ],
  },
  {
    id: 'calculo', number: 5, code: 'MAT-104', name: 'Cálculo Diferencial e Integral',
    area: 'matematicas', term: 2, credits: 8, elective: false, prerequisites: ['algebra'],
    description: 'La velocidad de reacción es una derivada; la cantidad transformada, una integral; el área de un pico cromatográfico, otra. El cálculo no acompaña a la química: la constituye.',
    objectives: [
      'Derivar e integrar las funciones que aparecen en cinética y termodinámica.',
      'Interpretar una derivada como velocidad y una integral como acumulación.',
      'Aplicar la integración numérica a datos experimentales.',
    ],
    units: [
      u('u1', 'Derivación', 'La razón de cambio.', [
        ['c1', 'Concepto y reglas', [
          ['Límite, continuidad y derivada', ['derivada'], 60],
          ['Reglas de derivación y regla de la cadena', ['regla-cadena'], 60],
          ['La derivada como velocidad de reacción', ['velocidad-reaccion'], 55, 'rate-derivative'],
        ]],
        ['c2', 'Aplicaciones', [
          ['Máximos y mínimos: el óptimo de un proceso', ['optimizacion'], 60, 'optimize'],
          ['El punto de inflexión de una curva de valoración', ['punto-equivalencia'], 55, 'titration-derivative'],
        ]],
      ]),
      u('u2', 'Integración', 'La acumulación.', [
        ['c1', 'Integral definida e indefinida', [
          ['Teorema fundamental del cálculo', ['integral'], 60],
          ['Métodos de integración', ['integral'], 70],
        ]],
        ['c2', 'Integración numérica', [
          ['Trapecios y Simpson', ['integracion-numerica'], 55, 'numeric-integration'],
          ['Área de un pico cromatográfico', ['area-pico', 'cromatografia'], 60, 'peak-area'],
        ]],
      ]),
    ],
  },
  {
    id: 'mecanica', number: 6, code: 'FIS-101', name: 'Mecánica',
    area: 'fisica', term: 3, credits: 7, elective: false, prerequisites: ['geo1', 'calculo'],
    description: 'Fuerza, energía y movimiento. La energía que aquí se define es la misma que aparece en una entalpía de reacción y en un potencial de electrodo.',
    objectives: [
      'Aplicar las leyes de Newton y los principios de conservación.',
      'Relacionar trabajo, energía y potencia.',
      'Comprender el movimiento molecular como problema mecánico.',
    ],
    units: [
      u('u1', 'Cinemática y dinámica', 'Describir y explicar el movimiento.', [
        ['c1', 'Leyes de Newton', [
          ['Fuerza, masa y aceleración', ['fuerza', 'newton'], 60],
          ['Fuerzas de rozamiento y viscosidad', ['viscosidad'], 50],
        ]],
        ['c2', 'Conservación', [
          ['Trabajo y energía cinética', ['trabajo', 'energia-cinetica'], 60, 'work-energy'],
          ['Energía potencial y conservación', ['energia-potencial'], 55],
          ['Colisiones: el modelo de la teoría cinética', ['colision', 'teoria-cinetica'], 60, 'collisions'],
        ]],
      ]),
      u('u2', 'Fluidos', 'Estática y dinámica de fluidos.', [
        ['c1', 'Fluidos', [
          ['Presión hidrostática y principio de Arquímedes', ['presion'], 55],
          ['Ecuación de continuidad y Bernoulli', ['bernoulli'], 60, 'fluid-flow'],
          ['Flujo laminar y turbulento: número de Reynolds', ['reynolds'], 55, 'reynolds'],
        ]],
      ]),
    ],
  },
  {
    id: 'edo1', number: 7, code: 'MAT-201', name: 'Ecuaciones Diferenciales I',
    area: 'matematicas', term: 3, credits: 6, elective: false, prerequisites: ['calculo'],
    description: 'Toda cinética química es una ecuación diferencial. Aquí se aprende a plantearlas, resolverlas cuando tienen solución cerrada e integrarlas numéricamente cuando no.',
    objectives: [
      'Resolver ecuaciones diferenciales de primer orden separables y lineales.',
      'Plantear el sistema de ecuaciones de un mecanismo de reacción.',
      'Integrar numéricamente un sistema rígido.',
    ],
    units: [
      u('u1', 'Primer orden', 'La ecuación de la desintegración y del reactor.', [
        ['c1', 'Métodos elementales', [
          ['Variables separables', ['edo-separable'], 55],
          ['Ecuación lineal de primer orden', ['edo-lineal'], 55],
          ['Leyes de velocidad integradas de orden 0, 1 y 2', ['ley-velocidad-integrada'], 70, 'integrated-rate'],
        ]],
      ]),
      u('u2', 'Sistemas', 'Varios compuestos evolucionando a la vez.', [
        ['c1', 'Sistemas lineales', [
          ['Reacciones consecutivas A → B → C', ['reacciones-consecutivas'], 65, 'consecutive'],
          ['Aproximación del estado estacionario y sus límites', ['estado-estacionario'], 60, 'steady-state'],
        ]],
        ['c2', 'Métodos numéricos', [
          ['Euler y Runge–Kutta', ['runge-kutta'], 60, 'ode-solver'],
          ['Rigidez y métodos implícitos', ['rigidez'], 55, 'stiff'],
        ]],
      ]),
    ],
  },
  {
    id: 'electromag', number: 8, code: 'FIS-102', name: 'Electricidad y Magnetismo',
    area: 'fisica', term: 4, credits: 7, elective: false, prerequisites: ['mecanica', 'calculo'],
    description: 'El campo eléctrico que mantiene unido un cristal iónico, la doble capa de un electrodo y la señal de un detector son el mismo fenómeno visto a tres escalas.',
    objectives: [
      'Aplicar la ley de Coulomb y el concepto de campo y potencial.',
      'Analizar circuitos de corriente continua.',
      'Relacionar el potencial eléctrico con el potencial de electrodo.',
    ],
    units: [
      u('u1', 'Electrostática', 'Cargas en reposo.', [
        ['c1', 'Campo y potencial', [
          ['Ley de Coulomb y campo eléctrico', ['coulomb', 'campo-electrico'], 60, 'coulomb'],
          ['Potencial eléctrico y energía', ['potencial-electrico'], 55],
          ['Energía reticular de un cristal iónico', ['energia-reticular', 'enlace-ionico'], 60, 'lattice-energy'],
        ]],
        ['c2', 'Dieléctricos', [
          ['Constante dieléctrica y su papel en la solvatación', ['permitividad', 'solvatacion'], 55],
        ]],
      ]),
      u('u2', 'Corriente y magnetismo', 'Cargas en movimiento.', [
        ['c1', 'Circuitos', [
          ['Ley de Ohm, resistencia y conductividad', ['conductividad'], 55, 'ohm'],
          ['Circuitos y el puente de Wheatstone del conductímetro', ['conductimetro'], 50],
        ]],
        ['c2', 'Magnetismo', [
          ['Campo magnético y fuerza de Lorentz', ['lorentz'], 55],
          ['El analizador magnético de un espectrómetro de masas', ['espectrometria-masas'], 60, 'mass-analyzer'],
          ['Resonancia magnética nuclear: el fundamento físico', ['rmn'], 60],
        ]],
      ]),
    ],
  },
  {
    id: 'qg2', number: 9, code: 'QUI-102', name: 'Química General II',
    area: 'general', term: 3, credits: 8, elective: false, prerequisites: ['qg1'],
    description: 'Estructura electrónica, enlace y las primeras leyes de equilibrio y termoquímica. La asignatura que explica por qué las sustancias son como son.',
    substances: ['h2o', 'nh3', 'h2so4', 'hno3', 'h3po4', 'nahco3'],
    project: 'Predecir la geometría y polaridad de un conjunto de moléculas y contrastarla con datos espectroscópicos.',
    objectives: [
      'Escribir configuraciones electrónicas y justificar las tendencias periódicas.',
      'Construir estructuras de Lewis y predecir geometrías por RPECV.',
      'Aplicar el principio de Le Châtelier y calcular constantes de equilibrio.',
      'Calcular entalpías de reacción por la ley de Hess.',
    ],
    units: [
      u('u1', 'Estructura atómica', 'Del espectro del hidrógeno al orbital.', [
        ['c1', 'Modelo cuántico', [
          ['Espectros atómicos y el modelo de Bohr', ['espectro-atomico', 'bohr'], 60, 'bohr-model'],
          ['Dualidad onda-partícula y ecuación de Schrödinger', ['schrodinger', 'orbital'], 65],
          ['Números cuánticos y forma de los orbitales', ['numeros-cuanticos', 'orbital'], 70, 'orbitals'],
        ]],
        ['c2', 'Configuración electrónica', [
          ['Aufbau, Hund y Pauli', ['configuracion-electronica'], 60, 'aufbau'],
          ['Tendencias periódicas y su justificación', ['tendencia-periodica', 'electronegatividad'], 70, 'periodic-trends'],
        ]],
      ]),
      u('u2', 'Enlace químico', 'Por qué los átomos se unen y con qué geometría.', [
        ['c1', 'Modelos de enlace', [
          ['Enlace iónico y energía reticular', ['enlace-ionico'], 55],
          ['Enlace covalente y estructuras de Lewis', ['enlace-covalente', 'lewis'], 70, 'lewis-builder'],
          ['Carga formal y resonancia', ['resonancia', 'carga-formal'], 60, 'resonance'],
        ]],
        ['c2', 'Geometría', [
          ['RPECV y geometría molecular', ['rpecv', 'geometria-molecular'], 70, 'vsepr'],
          ['Polaridad y momento dipolar', ['polaridad', 'momento-dipolar'], 55, 'dipole'],
          ['Hibridación y enlaces múltiples', ['hibridacion'], 65, 'hybridization'],
        ]],
        ['c3', 'Fuerzas intermoleculares', [
          ['Dipolo-dipolo, dispersión y puente de hidrógeno', ['fuerzas-intermoleculares', 'puente-hidrogeno'], 65, 'imf'],
          ['Relación con puntos de fusión y ebullición', ['punto-ebullicion'], 50, 'bp-trend'],
        ]],
      ]),
      u('u3', 'Termoquímica', 'La energía de las reacciones.', [
        ['c1', 'Primera ley', [
          ['Sistema, entorno, calor y trabajo', ['primera-ley', 'entalpia'], 60],
          ['Entalpía y calorimetría', ['calorimetria'], 65, 'calorimetry', 'lab-calorimetria'],
          ['Ley de Hess y entalpías de formación', ['ley-hess'], 65, 'hess'],
        ]],
      ]),
      u('u4', 'Equilibrio químico', 'Reacciones que no se completan.', [
        ['c1', 'La constante de equilibrio', [
          ['Q y K: el criterio de desplazamiento', ['equilibrio-quimico', 'constante-equilibrio'], 65, 'equilibrium'],
          ['Principio de Le Châtelier, derivado de Q y K', ['le-chatelier'], 60, 'le-chatelier'],
          ['Equilibrios heterogéneos', ['equilibrio-heterogeneo'], 50],
        ]],
      ]),
    ],
  },
  {
    id: 'optica', number: 10, code: 'FIS-201', name: 'Óptica Física',
    area: 'fisica', term: 5, credits: 6, elective: false, prerequisites: ['electromag'],
    description: 'La física de la luz y su interacción con la materia: exactamente el fundamento de la espectroscopia, que es la técnica analítica más usada del laboratorio.',
    objectives: [
      'Describir la luz como onda electromagnética y explicar sus fenómenos.',
      'Comprender el funcionamiento óptico de un espectrofotómetro.',
      'Relacionar absorción, transmitancia y estructura electrónica.',
    ],
    units: [
      u('u1', 'Naturaleza de la luz', 'Onda y fotón.', [
        ['c1', 'Ondas electromagnéticas', [
          ['Espectro electromagnético y energía del fotón', ['fotón', 'espectro-em'], 60, 'em-spectrum'],
          ['Interferencia y difracción', ['difraccion'], 60, 'diffraction'],
          ['La red de difracción de un monocromador', ['monocromador'], 55],
        ]],
      ]),
      u('u2', 'Interacción luz-materia', 'Absorción, emisión y dispersión.', [
        ['c1', 'Absorción', [
          ['Transmitancia, absorbancia y ley de Beer–Lambert', ['beer-lambert', 'absorbancia'], 70, 'beer-lambert', 'lab-uvvis'],
          ['Desviaciones de la ley de Beer', ['desviacion-beer'], 55, 'beer-deviation'],
        ]],
        ['c2', 'Emisión y dispersión', [
          ['Fluorescencia y fosforescencia', ['fluorescencia'], 55, 'fluorescence'],
          ['Dispersión Rayleigh y Raman', ['raman'], 50],
          ['Polarimetría y actividad óptica', ['actividad-optica', 'quiralidad'], 60, 'polarimetry'],
        ]],
      ]),
    ],
  },

  // ======================= CICLO INTERMEDIO ================================
  {
    id: 'qinorg1', number: 11, code: 'QUI-201', name: 'Química Inorgánica I',
    area: 'inorganica', term: 4, credits: 7, elective: false, prerequisites: ['qg2'],
    description: 'Química descriptiva de los elementos representativos: hidrógeno, alcalinos, alcalinotérreos, y los grupos del boro al de los gases nobles.',
    substances: ['hcl', 'h2so4', 'hno3', 'nh3', 'na2co3', 'fecl3', 'cuso4'],
    objectives: [
      'Relacionar la posición en la tabla periódica con la reactividad.',
      'Predecir productos de reacción de los elementos representativos.',
      'Describir los métodos industriales de obtención de los compuestos principales.',
    ],
    units: [
      u('u1', 'Elementos del bloque s', 'Hidrógeno, alcalinos y alcalinotérreos.', [
        ['c1', 'Hidrógeno', [
          ['Isótopos, obtención y reactividad', ['hidrogeno'], 55],
          ['Hidruros: iónicos, covalentes y metálicos', ['hidruro'], 55],
        ]],
        ['c2', 'Grupos 1 y 2', [
          ['Tendencias en el grupo y reactividad frente al agua', ['alcalino'], 60, 'group1-reactivity'],
          ['Dureza del agua y química del calcio y el magnesio', ['dureza'], 60],
        ]],
      ]),
      u('u2', 'Elementos del bloque p', 'Del boro a los gases nobles.', [
        ['c1', 'Grupos 13 a 15', [
          ['Boro y aluminio: deficiencia electrónica y anfoterismo', ['anfoterismo'], 60],
          ['Carbono y silicio: catenación y silicatos', ['catenacion'], 60],
          ['Nitrógeno y fósforo: los ciclos y los oxoácidos', ['oxoacido', 'ciclo-nitrogeno'], 65],
        ]],
        ['c2', 'Grupos 16 a 18', [
          ['Oxígeno y azufre: óxidos y oxoácidos', ['oxido'], 60],
          ['Halógenos: reactividad y compuestos interhalogenados', ['halogeno'], 60],
          ['Gases nobles: por qué reaccionan los pesados', ['gas-noble'], 45],
        ]],
      ]),
    ],
  },
  {
    id: 'qan1', number: 12, code: 'QUI-202', name: 'Química Analítica I',
    area: 'analitica', term: 4, credits: 7, elective: false, prerequisites: ['qg2', 'prob1'],
    description: 'Análisis cuantitativo clásico: la disciplina del dato fiable. Gravimetría, volumetría, tratamiento estadístico y trazabilidad.',
    substances: ['naoh', 'hcl', 'khp', 'na2co3', 'agno3', 'nacl'],
    instruments: ['balanza', 'bureta', 'phmetro'],
    project: 'Normalizar una disolución de NaOH frente a ftalato ácido de potasio y documentar el presupuesto completo de incertidumbre.',
    objectives: [
      'Ejecutar una valoración con la exactitud que permite el material volumétrico.',
      'Construir un presupuesto de incertidumbre completo de una determinación.',
      'Seleccionar el indicador adecuado y cuantificar el error de valoración.',
      'Distinguir error sistemático de error aleatorio en datos reales.',
    ],
    units: [
      u('u1', 'El proceso analítico', 'Del problema al resultado con su incertidumbre.', [
        ['c1', 'Fundamentos', [
          ['Etapas del proceso analítico y muestreo', ['proceso-analitico', 'muestreo'], 55],
          ['Error sistemático y aleatorio', ['error-sistematico', 'error-aleatorio'], 65, 'error-types', 'lab-errores'],
          ['Trazabilidad, patrones y materiales de referencia', ['patron-primario', 'trazabilidad'], 60],
        ]],
        ['c2', 'Material volumétrico', [
          ['Tolerancias, clases y calibración del material', ['tolerancia', 'calibracion-volumetrica'], 60, undefined, 'lab-calibracion-material'],
          ['Uso correcto de bureta, pipeta y matraz aforado', ['bureta', 'pipeta', 'matraz-aforado'], 55, undefined, 'lab-volumetria'],
        ]],
      ]),
      u('u2', 'Volumetrías ácido-base', 'La valoración como método absoluto.', [
        ['c1', 'Curvas de valoración', [
          ['Ácido fuerte con base fuerte', ['curva-valoracion'], 60, 'titration', 'lab-titulacion'],
          ['Ácido débil: el salto reducido y el punto de semiequivalencia', ['acido-debil', 'pka'], 70, 'titration-weak'],
          ['Sistemas polipróticos y saltos múltiples', ['poliprotico'], 65, 'titration-polyprotic'],
        ]],
        ['c2', 'Detección del punto final', [
          ['Indicadores y su intervalo de viraje', ['indicador'], 60, 'indicators'],
          ['Error de valoración: cuantificarlo, no estimarlo', ['error-valoracion'], 60, 'titration-error'],
          ['Detección potenciométrica y primera derivada', ['potenciometria'], 55, 'titration-derivative'],
        ]],
      ]),
      u('u3', 'Gravimetría', 'Pesar como método de medida.', [
        ['c1', 'Análisis gravimétrico', [
          ['Precipitación, digestión y filtración', ['gravimetria'], 60, undefined, 'lab-gravimetria'],
          ['Factor gravimétrico y cálculo del resultado', ['factor-gravimetrico'], 50],
          ['Coprecipitación: el error que no se ve', ['coprecipitacion'], 55],
        ]],
      ]),
    ],
  },
  {
    id: 'qorg1', number: 13, code: 'QUI-203', name: 'Química Orgánica I',
    area: 'organica', term: 4, credits: 8, elective: false, prerequisites: ['qg2'],
    description: 'Estructura, nomenclatura y estereoquímica del carbono; hidrocarburos y halogenuros de alquilo; los mecanismos de sustitución y eliminación.',
    substances: ['etanol', 'acetona', 'benceno'],
    objectives: [
      'Nombrar y dibujar compuestos orgánicos con las reglas IUPAC.',
      'Analizar la estereoquímica de una molécula y sus consecuencias.',
      'Predecir el producto de una sustitución o eliminación y justificar el mecanismo.',
    ],
    units: [
      u('u1', 'Estructura y nomenclatura', 'El lenguaje de la química orgánica.', [
        ['c1', 'Representación', [
          ['Fórmulas, esqueletos y grupos funcionales', ['grupo-funcional'], 60, 'structure-builder'],
          ['Nomenclatura IUPAC de hidrocarburos', ['nomenclatura-organica'], 70, 'nomenclature-organic'],
        ]],
        ['c2', 'Isomería', [
          ['Isomería estructural', ['isomeria'], 55],
          ['Conformaciones y análisis conformacional', ['conformacion'], 60, 'conformation'],
          ['Quiralidad, R/S y actividad óptica', ['quiralidad', 'enantiomero'], 75, 'chirality'],
        ]],
      ]),
      u('u2', 'Reactividad', 'Los primeros mecanismos.', [
        ['c1', 'Fundamentos mecanísticos', [
          ['Ácidos y bases de Brønsted y de Lewis en orgánica', ['acido-lewis', 'nucleofilo'], 60],
          ['Efectos inductivo y de resonancia sobre la acidez', ['efecto-inductivo'], 60, 'acidity-trends'],
          ['Diagramas de energía y estados de transición', ['estado-transicion'], 60, 'energy-diagram'],
        ]],
        ['c2', 'Sustitución y eliminación', [
          ['SN1 y SN2: competencia y factores', ['sn1', 'sn2'], 80, 'substitution'],
          ['E1 y E2: regioselectividad de Zaitsev', ['e1', 'e2'], 70, 'elimination'],
          ['Elegir entre sustitución y eliminación', ['competencia-sn-e'], 55, 'sn-e-competition'],
        ]],
      ]),
    ],
  },
  {
    id: 'qinorg2', number: 14, code: 'QUI-301', name: 'Química Inorgánica II',
    area: 'inorganica', term: 5, credits: 7, elective: false, prerequisites: ['qinorg1'],
    description: 'Metales de transición y química de coordinación: campo cristalino, color, magnetismo y estabilidad de los complejos.',
    substances: ['cuso4', 'fecl3', 'edta', 'nh3', 'kmno4'],
    objectives: [
      'Aplicar la teoría del campo cristalino para explicar color y magnetismo.',
      'Nombrar complejos de coordinación y describir su isomería.',
      'Relacionar la constante de formación con la estabilidad y el efecto quelato.',
    ],
    units: [
      u('u1', 'Compuestos de coordinación', 'Estructura y nomenclatura.', [
        ['c1', 'Fundamentos', [
          ['Ligandos, número de coordinación y geometría', ['complejo', 'ligando'], 60, 'coordination'],
          ['Nomenclatura de complejos', ['nomenclatura-coordinacion'], 55],
          ['Isomería en complejos', ['isomeria-coordinacion'], 60],
        ]],
      ]),
      u('u2', 'Enlace y propiedades', 'Por qué son coloreados y magnéticos.', [
        ['c1', 'Teoría del campo cristalino', [
          ['Desdoblamiento de los orbitales d', ['campo-cristalino', 'desdoblamiento-d'], 70, 'crystal-field'],
          ['Alto y bajo espín; energía de apareamiento', ['alto-espin'], 60, 'spin-state'],
          ['Color y serie espectroquímica', ['serie-espectroquimica', 'color-complejo'], 65, 'complex-color'],
          ['Magnetismo y momento magnético efectivo', ['magnetismo'], 55],
        ]],
        ['c2', 'Estabilidad', [
          ['Constantes de formación sucesivas y globales', ['constante-formacion'], 65, 'complexation'],
          ['Efecto quelato y su origen entrópico', ['efecto-quelato'], 60, 'chelate'],
          ['Distorsión de Jahn–Teller', ['jahn-teller'], 50],
        ]],
      ]),
    ],
  },
  {
    id: 'qan2', number: 15, code: 'QUI-302', name: 'Química Analítica II',
    area: 'analitica', term: 5, credits: 7, elective: false, prerequisites: ['qan1'],
    description: 'Equilibrios iónicos en profundidad: sistemas polipróticos, tampones, complejación, precipitación fraccionada y especiación.',
    substances: ['edta', 'nh3', 'h3po4', 'na2co3', 'agno3', 'cacl2', 'mgso4'],
    instruments: ['phmetro', 'bureta', 'conductimetro'],
    project: 'Determinar la dureza total y cálcica de un agua por complexometría y contrastar con el equilibrio calculado.',
    objectives: [
      'Calcular la composición de cualquier sistema en equilibrio iónico.',
      'Diseñar un tampón y predecir su capacidad tamponante.',
      'Aplicar la complexometría con EDTA y el concepto de constante condicional.',
      'Predecir y aprovechar la precipitación fraccionada.',
    ],
    units: [
      u('u1', 'Equilibrios ácido-base avanzados', 'Sistemas reales.', [
        ['c1', 'Tratamiento sistemático', [
          ['Balances de masa, carga y condición protónica', ['balance-carga', 'balance-masa'], 70, 'systematic-treatment'],
          ['Cuándo falla Henderson–Hasselbalch', ['henderson-hasselbalch'], 60, 'henderson-limits'],
          ['Diagramas de distribución de especies', ['especiacion', 'diagrama-alfa'], 70, 'speciation'],
        ]],
        ['c2', 'Tampones', [
          ['Capacidad tamponante y su máximo en el pKa', ['capacidad-tamponante'], 65, 'buffer-capacity'],
          ['Diseño y preparación de un tampón', ['tampon'], 60, 'buffer-design', 'lab-tampon'],
          ['Efecto de la fuerza iónica y la temperatura', ['fuerza-ionica', 'actividad'], 60, 'activity-effects'],
        ]],
      ]),
      u('u2', 'Complejación', 'Volumetría con EDTA.', [
        ['c1', 'EDTA', [
          ['Fracción α₄ y constante condicional', ['constante-condicional'], 70, 'conditional-constant'],
          ['Curvas de valoración complexométrica', ['valoracion-complexometrica'], 65, 'edta-titration'],
          ['Indicadores metalocrómicos y enmascaramiento', ['enmascaramiento'], 60, undefined, 'lab-dureza'],
        ]],
      ]),
      u('u3', 'Precipitación', 'Solubilidad controlada.', [
        ['c1', 'Equilibrios de solubilidad', [
          ['Kps, Qps y el efecto del ion común', ['kps', 'ion-comun'], 65, 'solubility'],
          ['Efecto del pH y de la complejación sobre la solubilidad', ['solubilidad-condicional'], 60, 'solubility-ph'],
          ['Precipitación fraccionada y separación selectiva', ['precipitacion-fraccionada'], 65, 'fractional-precipitation'],
          ['Argentometría: Mohr, Volhard y Fajans', ['argentometria'], 60, undefined, 'lab-cloruros'],
        ]],
      ]),
    ],
  },
  {
    id: 'qorg2', number: 16, code: 'QUI-303', name: 'Química Orgánica II',
    area: 'organica', term: 5, credits: 8, elective: false, prerequisites: ['qorg1'],
    description: 'Compuestos insaturados, aromáticos y con grupos funcionales oxigenados; adición electrofílica y sustitución aromática.',
    substances: ['benceno', 'etanol', 'acetona', 'acido-salicilico'],
    objectives: [
      'Predecir la regioquímica y estereoquímica de una adición.',
      'Aplicar las reglas de orientación en sustitución aromática electrofílica.',
      'Proponer una síntesis de varios pasos con grupos funcionales oxigenados.',
    ],
    units: [
      u('u1', 'Insaturaciones', 'Alquenos y alquinos.', [
        ['c1', 'Adición electrofílica', [
          ['Regla de Markovnikov y estabilidad del carbocatión', ['markovnikov', 'carbocation'], 70, 'addition'],
          ['Estereoquímica: adición sin y anti', ['estereoquimica-adicion'], 60],
          ['Hidroboración, oxidación y ozonólisis', ['hidroboracion'], 65],
        ]],
      ]),
      u('u2', 'Aromaticidad', 'El anillo bencénico.', [
        ['c1', 'Aromaticidad', [
          ['Regla de Hückel y criterios de aromaticidad', ['aromaticidad', 'huckel'], 65, 'aromaticity'],
          ['Sustitución electrofílica aromática', ['sear'], 75, 'sear'],
          ['Efectos activantes, desactivantes y orientación', ['orientacion-sear'], 70, 'sear-orientation'],
        ]],
      ]),
      u('u3', 'Compuestos oxigenados', 'Alcoholes, éteres y fenoles.', [
        ['c1', 'Alcoholes y fenoles', [
          ['Acidez comparada de alcoholes, fenoles y ácidos', ['acidez-organica'], 60, 'organic-acidity'],
          ['Oxidación de alcoholes', ['oxidacion-alcohol'], 55],
          ['Síntesis de la aspirina como caso integrador', ['sintesis-multipaso'], 70, undefined, 'lab-aspirina'],
        ]],
      ]),
    ],
  },
  {
    id: 'termo', number: 17, code: 'FIS-301', name: 'Termodinámica',
    area: 'fisicoquimica', term: 6, credits: 7, elective: false, prerequisites: ['calculo', 'qg2'],
    description: 'Las leyes que gobiernan la dirección de todo proceso. Es la asignatura que responde a "¿puede ocurrir?" — nunca a "¿a qué velocidad?".',
    objectives: [
      'Aplicar el primer principio a procesos con y sin cambio de fase.',
      'Usar la entropía y la energía libre como criterios de espontaneidad.',
      'Calcular la constante de equilibrio a partir de datos termodinámicos.',
    ],
    units: [
      u('u1', 'Primer principio', 'Conservación de la energía.', [
        ['c1', 'Trabajo y calor', [
          ['Sistemas, procesos y funciones de estado', ['funcion-estado'], 55],
          ['Trabajo de expansión reversible e irreversible', ['trabajo-expansion'], 65, 'pv-work'],
          ['Entalpía y capacidad calorífica', ['entalpia', 'capacidad-calorifica'], 60],
        ]],
      ]),
      u('u2', 'Segundo y tercer principios', 'La flecha del tiempo.', [
        ['c1', 'Entropía', [
          ['Entropía y procesos espontáneos', ['entropia'], 70, 'entropy'],
          ['Interpretación estadística: la ecuación de Boltzmann', ['entropia-estadistica'], 60, 'boltzmann'],
          ['Tercer principio y entropías absolutas', ['tercer-principio'], 50],
        ]],
        ['c2', 'Energía libre', [
          ['Energía de Gibbs y de Helmholtz', ['energia-gibbs'], 65, 'gibbs'],
          ['ΔG y la constante de equilibrio', ['relacion-g-k'], 70, 'g-k-relation'],
          ['Van \'t Hoff y la dependencia con la temperatura', ['vant-hoff'], 60, 'vant-hoff'],
        ]],
        ['c3', 'Ciclos', [
          ['Ciclo de Carnot y rendimiento máximo', ['carnot'], 60, 'carnot'],
          ['Máquinas térmicas y refrigeradores', ['maquina-termica'], 50],
        ]],
      ]),
    ],
  },
  {
    id: 'algebra-lineal', number: 18, code: 'MAT-301', name: 'Álgebra Lineal I',
    area: 'matematicas', term: 6, credits: 6, elective: false, prerequisites: ['algebra'],
    description: 'Espacios vectoriales, transformaciones y el problema de autovalores. Es la maquinaria de la química cuántica y del análisis multivariante.',
    objectives: [
      'Trabajar con espacios vectoriales, bases y transformaciones lineales.',
      'Resolver el problema de autovalores y autovectores.',
      'Reconocer el papel de la diagonalización en química cuántica y en quimiometría.',
    ],
    units: [
      u('u1', 'Espacios vectoriales', 'Estructura y bases.', [
        ['c1', 'Fundamentos', [
          ['Espacios, subespacios y bases', ['espacio-vectorial'], 60],
          ['Transformaciones lineales y matrices', ['transformacion-lineal'], 60],
          ['Ortogonalidad y Gram–Schmidt', ['ortogonalidad'], 60],
        ]],
      ]),
      u('u2', 'Autovalores', 'El problema espectral.', [
        ['c1', 'Diagonalización', [
          ['Autovalores y autovectores', ['autovalor'], 70, 'eigen'],
          ['Diagonalización de matrices simétricas', ['diagonalizacion'], 60],
          ['El método de Hückel como problema de autovalores', ['huckel'], 70, 'huckel-method'],
          ['PCA como diagonalización de la covarianza', ['pca'], 65, 'pca'],
        ]],
      ]),
    ],
  },

  // ======================= CICLO SUPERIOR ==================================
  {
    id: 'qinorg-av', number: 19, code: 'QUI-401', name: 'Química Inorgánica Avanzada',
    area: 'inorganica', term: 7, credits: 6, elective: false, prerequisites: ['qinorg2', 'algebra-lineal'],
    description: 'Simetría y teoría de grupos aplicadas al enlace, orbitales moleculares en complejos, organometálicos y catálisis homogénea.',
    objectives: [
      'Clasificar una molécula por su grupo puntual de simetría.',
      'Construir diagramas de orbitales moleculares de complejos.',
      'Aplicar la regla de los 18 electrones a compuestos organometálicos.',
    ],
    units: [
      u('u1', 'Simetría', 'Teoría de grupos aplicada.', [
        ['c1', 'Grupos puntuales', [
          ['Elementos y operaciones de simetría', ['simetria', 'grupo-puntual'], 70, 'symmetry'],
          ['Tablas de caracteres y representaciones', ['tabla-caracteres'], 65],
          ['Reglas de selección espectroscópicas', ['regla-seleccion'], 60],
        ]],
      ]),
      u('u2', 'Orbitales moleculares y organometálicos', 'Enlace avanzado.', [
        ['c1', 'TOM en complejos', [
          ['Enlace σ y π; ligandos π-aceptores y π-donadores', ['tom-complejos', 'retrodonacion'], 70, 'mo-complexes'],
          ['Regla de los 18 electrones', ['regla-18e'], 55],
          ['Catálisis homogénea: ciclos catalíticos', ['catalisis-homogenea'], 70, 'catalytic-cycle'],
        ]],
      ]),
    ],
  },
  {
    id: 'qan3', number: 20, code: 'QUI-402', name: 'Química Analítica III',
    area: 'analitica', term: 6, credits: 7, elective: false, prerequisites: ['qan2', 'optica'],
    description: 'Análisis instrumental espectroscópico y electroanalítico: espectrofotometría, fluorimetría, potenciometría y volumetrías redox.',
    substances: ['kmno4', 'na2c2o4', 'ki', 'na2s2o3', 'h2o2', 'fecl3', 'cuso4'],
    instruments: ['espectrofotometro', 'fluorimetro', 'phmetro', 'potenciostato'],
    project: 'Determinar hierro en una muestra por espectrofotometría con tiocianato, con curva de calibración y validación por adición estándar.',
    objectives: [
      'Construir y validar una curva de calibración con su LOD y LOQ.',
      'Aplicar el método de adición estándar cuando hay efecto matriz.',
      'Ejecutar y calcular una volumetría redox.',
      'Interpretar una medida potenciométrica y sus fuentes de error.',
    ],
    units: [
      u('u1', 'Espectrofotometría', 'Medida basada en la absorción.', [
        ['c1', 'Fundamento y práctica', [
          ['Instrumentación UV-Vis: fuente, monocromador y detector', ['espectrofotometro'], 60, 'uvvis-instrument'],
          ['Curva de calibración, LOD y LOQ', ['calibracion', 'lod'], 70, 'calibration', 'lab-calibracion'],
          ['Adición estándar y efecto matriz', ['adicion-estandar', 'efecto-matriz'], 65, 'standard-addition'],
          ['Errores fotométricos y el intervalo óptimo de absorbancia', ['error-fotometrico'], 55],
        ]],
      ]),
      u('u2', 'Volumetrías redox', 'Valoraciones con transferencia de electrones.', [
        ['c1', 'Redox', [
          ['Curvas de valoración redox y potencial en el punto de equivalencia', ['curva-redox'], 70, 'redox-titration'],
          ['Permanganimetría', ['permanganimetria'], 60, undefined, 'lab-permanganimetria'],
          ['Yodometría y yodimetría', ['yodometria'], 65, undefined, 'lab-yodometria'],
          ['Dicromatometría y potenciales condicionales', ['potencial-condicional'], 55],
        ]],
      ]),
      u('u3', 'Potenciometría', 'Medida directa del potencial.', [
        ['c1', 'Electrodos', [
          ['Electrodos de referencia y de trabajo', ['electrodo-referencia'], 55],
          ['Electrodo de vidrio: funcionamiento y errores', ['electrodo-vidrio', 'error-alcalino'], 65, 'ph-electrode', 'lab-calibracion-ph'],
          ['Electrodos selectivos de iones', ['isе', 'electrodo-selectivo'], 60],
        ]],
      ]),
    ],
  },
  {
    id: 'qorg3', number: 21, code: 'QUI-403', name: 'Química Orgánica III',
    area: 'organica', term: 6, credits: 8, elective: false, prerequisites: ['qorg2'],
    description: 'Compuestos carbonílicos y nitrogenados, y la determinación estructural por espectroscopia: IR, RMN y espectrometría de masas combinadas.',
    substances: ['acetona', 'acido-salicilico', 'etanol', 'glucosa'],
    instruments: ['ftir', 'rmn', 'espectrometro-masas'],
    project: 'Identificar una sustancia desconocida combinando IR, RMN de ¹H y ¹³C y espectrometría de masas.',
    objectives: [
      'Predecir la reactividad de aldehídos, cetonas y derivados de ácido.',
      'Interpretar un espectro IR asignando las bandas a grupos funcionales.',
      'Deducir una estructura a partir de RMN, integración y multiplicidad.',
      'Interpretar un patrón de fragmentación en espectrometría de masas.',
    ],
    units: [
      u('u1', 'Compuestos carbonílicos', 'La química del C=O.', [
        ['c1', 'Adición nucleofílica', [
          ['Aldehídos y cetonas: adición al carbonilo', ['adicion-nucleofilica'], 70, 'carbonyl-addition'],
          ['Derivados de ácido y sustitución nucleofílica acílica', ['sustitucion-acilica'], 70],
          ['Enoles, enolatos y condensación aldólica', ['enolato', 'aldolica'], 70, 'aldol'],
        ]],
      ]),
      u('u2', 'Determinación estructural', 'Deducir una estructura de sus espectros.', [
        ['c1', 'Espectroscopia infrarroja', [
          ['Vibraciones moleculares y modos normales', ['vibracion-molecular'], 60, 'ir-modes'],
          ['Bandas características de los grupos funcionales', ['banda-ir'], 70, 'ir-spectrum'],
          ['La región de la huella dactilar', ['huella-dactilar'], 45],
        ]],
        ['c2', 'Resonancia magnética nuclear', [
          ['Desplazamiento químico y apantallamiento', ['desplazamiento-quimico'], 70, 'nmr-shift'],
          ['Integración y multiplicidad (regla n+1)', ['multiplicidad', 'acoplamiento'], 75, 'nmr-multiplicity'],
          ['RMN de ¹³C y DEPT', ['rmn-carbono'], 60],
        ]],
        ['c3', 'Espectrometría de masas', [
          ['Ionización, ion molecular y patrón isotópico', ['ion-molecular', 'patron-isotopico'], 70, 'ms-isotopes'],
          ['Reglas de fragmentación', ['fragmentacion'], 70, 'ms-fragmentation'],
          ['Alta resolución y fórmula molecular', ['masa-exacta'], 55],
        ]],
        ['c4', 'Integración', [
          ['Resolver una estructura desconocida combinando técnicas', ['determinacion-estructural'], 90, 'structure-elucidation', 'lab-desconocido'],
        ]],
      ]),
    ],
  },
  {
    id: 'fq1', number: 22, code: 'QUI-404', name: 'Fisicoquímica I',
    area: 'fisicoquimica', term: 7, credits: 8, elective: false, prerequisites: ['termo', 'edo1'],
    description: 'Termodinámica química aplicada: potencial químico, disoluciones reales, equilibrio de fases y propiedades coligativas.',
    objectives: [
      'Manejar el potencial químico como criterio de equilibrio material.',
      'Aplicar la regla de las fases e interpretar un diagrama de fases.',
      'Tratar disoluciones reales mediante actividades y coeficientes de actividad.',
    ],
    units: [
      u('u1', 'Potencial químico', 'El criterio de equilibrio material.', [
        ['c1', 'Fundamento', [
          ['Definición y significado del potencial químico', ['potencial-quimico'], 70],
          ['Fugacidad y actividad', ['fugacidad', 'actividad'], 65],
          ['Estados de referencia y su elección', ['estado-referencia'], 55],
        ]],
      ]),
      u('u2', 'Equilibrio de fases', 'Cuándo coexisten dos fases.', [
        ['c1', 'Sistemas de un componente', [
          ['Regla de las fases de Gibbs', ['regla-fases'], 60, 'phase-rule'],
          ['Ecuación de Clapeyron y Clausius–Clapeyron', ['clausius-clapeyron'], 65, 'clapeyron'],
          ['Diagramas de fases y punto triple', ['diagrama-fases'], 60, 'phase-diagram'],
        ]],
        ['c2', 'Disoluciones', [
          ['Ley de Raoult y disoluciones ideales', ['raoult'], 65, 'raoult'],
          ['Desviaciones positivas y negativas; azeótropos', ['azeotropo'], 65, 'azeotrope'],
          ['Propiedades coligativas', ['coligativa'], 65, 'colligative', 'lab-crioscopia'],
          ['Ley de Henry y solubilidad de gases', ['henry'], 55],
        ]],
      ]),
    ],
  },
  {
    id: 'hidro', number: 23, code: 'QUI-405', name: 'Hidroquímica',
    area: 'ambiental', term: 7, credits: 6, elective: false, prerequisites: ['qan2'],
    description: 'La química del agua natural: sistema carbonato, dureza, alcalinidad, especiación de metales y los índices que predicen si un agua incrusta o corroe.',
    substances: ['caco3', 'h2co3', 'cacl2', 'mgso4', 'edta', 'nahco3'],
    instruments: ['phmetro', 'conductimetro', 'espectrofotometro'],
    project: 'Caracterizar completamente una muestra de agua natural y diagnosticar su tendencia incrustante o corrosiva.',
    objectives: [
      'Calcular la especiación completa de un agua natural.',
      'Determinar dureza, alcalinidad y su relación con el sistema carbonato.',
      'Interpretar el índice de saturación de Langelier.',
    ],
    units: [
      u('u1', 'El sistema carbonato', 'El tampón de las aguas naturales.', [
        ['c1', 'Equilibrios del carbonato', [
          ['CO₂ atmosférico, sistemas abiertos y cerrados', ['sistema-carbonato', 'sistema-abierto'], 70, 'carbonate-system'],
          ['Alcalinidad: definición operativa y su medida', ['alcalinidad'], 65, undefined, 'lab-alcalinidad'],
          ['Diagrama de especiación del carbonato', ['especiacion'], 55, 'carbonate-speciation'],
        ]],
      ]),
      u('u2', 'Composición y calidad', 'Parámetros y su interpretación.', [
        ['c1', 'Parámetros', [
          ['Dureza total, cálcica y magnésica', ['dureza'], 60, undefined, 'lab-dureza'],
          ['Conductividad y sólidos disueltos totales', ['conductividad', 'tds'], 55],
          ['Balance iónico como control de calidad del análisis', ['balance-ionico'], 60, 'ion-balance'],
        ]],
        ['c2', 'Índices y metales', [
          ['Índice de saturación de Langelier', ['langelier'], 65, 'langelier'],
          ['Especiación de metales traza y biodisponibilidad', ['especiacion-metales'], 65, 'metal-speciation'],
        ]],
      ]),
    ],
  },
  {
    id: 'qan4', number: 24, code: 'QUI-406', name: 'Química Analítica IV',
    area: 'analitica', term: 7, credits: 7, elective: false, prerequisites: ['qan3'],
    description: 'Técnicas de separación: cromatografía de gases y líquidos, extracción, y el acoplamiento con la espectrometría de masas.',
    instruments: ['hplc', 'gc', 'espectrometro-masas'],
    project: 'Desarrollar y validar un método por HPLC para cuantificar un analito en una matriz compleja.',
    objectives: [
      'Explicar la separación cromatográfica en términos de la ecuación de van Deemter.',
      'Optimizar una separación variando fase móvil, temperatura y flujo.',
      'Cuantificar con patrón interno y validar el método.',
    ],
    units: [
      u('u1', 'Fundamentos de la separación', 'La teoría cromatográfica.', [
        ['c1', 'Parámetros', [
          ['Retención, factor de capacidad y selectividad', ['retencion', 'factor-capacidad'], 65, 'chromatography'],
          ['Eficacia: platos teóricos y altura de plato', ['platos-teoricos'], 60],
          ['Resolución y su optimización', ['resolucion-cromatografica'], 65, 'resolution'],
          ['Ecuación de van Deemter y el caudal óptimo', ['van-deemter'], 70, 'van-deemter'],
        ]],
      ]),
      u('u2', 'Técnicas', 'GC y HPLC en la práctica.', [
        ['c1', 'Cromatografía de gases', [
          ['Instrumentación, columnas y detectores', ['gc'], 60, 'gc-instrument'],
          ['Programación de temperatura', ['programacion-temperatura'], 55, 'gc-temperature'],
          ['Índices de retención de Kováts', ['kovats'], 50],
        ]],
        ['c2', 'Cromatografía líquida', [
          ['Fase reversa y control de la fase móvil', ['hplc', 'fase-reversa'], 65, 'hplc'],
          ['Gradiente frente a isocrático', ['gradiente'], 60, 'hplc-gradient'],
          ['Acoplamiento LC-MS', ['lc-ms'], 55],
        ]],
        ['c3', 'Cuantificación', [
          ['Patrón interno y patrón externo', ['patron-interno'], 60, 'internal-standard'],
          ['Validación de métodos: linealidad, exactitud, precisión, robustez', ['validacion-metodo'], 70],
        ]],
      ]),
    ],
  },
  {
    id: 'qorg4', number: 25, code: 'QUI-407', name: 'Química Orgánica IV',
    area: 'organica', term: 8, credits: 7, elective: false, prerequisites: ['qorg3'],
    description: 'Síntesis orgánica avanzada: análisis retrosintético, grupos protectores, reacciones pericíclicas y química organometálica de síntesis.',
    objectives: [
      'Aplicar el análisis retrosintético a una molécula objetivo.',
      'Seleccionar y justificar el uso de grupos protectores.',
      'Predecir el curso de una reacción pericíclica por sus reglas de selección.',
    ],
    units: [
      u('u1', 'Estrategia sintética', 'Cómo se diseña una síntesis.', [
        ['c1', 'Retrosíntesis', [
          ['Desconexiones, sintones y equivalentes sintéticos', ['retrosintesis', 'sinton'], 80, 'retrosynthesis'],
          ['Grupos protectores: cuándo y cuáles', ['grupo-protector'], 60],
          ['Economía de pasos y factor E', ['factor-e', 'quimica-verde'], 55],
        ]],
      ]),
      u('u2', 'Reacciones avanzadas', 'Herramientas del sintético.', [
        ['c1', 'Pericíclicas', [
          ['Diels–Alder y sus reglas de selección', ['diels-alder'], 70, 'diels-alder'],
          ['Reacciones electrocíclicas y sigmatrópicas', ['pericíclica'], 60],
        ]],
        ['c2', 'Organometálicos', [
          ['Reactivos de Grignard y organolíticos', ['grignard'], 60],
          ['Acoplamientos cruzados catalizados por paladio', ['acoplamiento-cruzado'], 65, 'cross-coupling'],
        ]],
      ]),
    ],
  },
  {
    id: 'fq2', number: 26, code: 'QUI-408', name: 'Fisicoquímica II',
    area: 'fisicoquimica', term: 8, credits: 8, elective: false, prerequisites: ['fq1'],
    description: 'Cinética química formal y teórica: leyes de velocidad, mecanismos, teoría de colisiones y del estado de transición, catálisis.',
    project: 'Determinar experimentalmente el orden y la energía de activación de una reacción y proponer un mecanismo compatible.',
    objectives: [
      'Determinar experimentalmente una ley de velocidad completa.',
      'Proponer un mecanismo compatible con la ley de velocidad observada.',
      'Aplicar la teoría del estado de transición y sus parámetros de activación.',
    ],
    units: [
      u('u1', 'Cinética formal', 'Medir y describir la velocidad.', [
        ['c1', 'Leyes de velocidad', [
          ['Velocidad, orden y molecularidad', ['orden-reaccion', 'molecularidad'], 65, 'rate-law'],
          ['Métodos de determinación del orden', ['metodo-aislamiento', 'velocidades-iniciales'], 70, 'order-determination', 'lab-cinetica'],
          ['Leyes integradas y tiempo de vida media', ['ley-velocidad-integrada'], 65, 'integrated-rate'],
        ]],
        ['c2', 'Temperatura', [
          ['Ecuación de Arrhenius y energía de activación', ['arrhenius', 'energia-activacion'], 70, 'arrhenius', 'lab-arrhenius'],
        ]],
      ]),
      u('u2', 'Mecanismos y teorías', 'Explicar la velocidad.', [
        ['c1', 'Mecanismos', [
          ['Etapa determinante y preequilibrio', ['etapa-determinante'], 65, 'mechanism'],
          ['Estado estacionario aplicado a un mecanismo', ['estado-estacionario'], 70, 'steady-state'],
          ['Reacciones en cadena', ['reaccion-cadena'], 60],
        ]],
        ['c2', 'Teorías', [
          ['Teoría de colisiones y factor estérico', ['teoria-colisiones'], 60, 'collision-theory'],
          ['Teoría del estado de transición y parámetros de activación', ['teoria-estado-transicion'], 70, 'tst'],
        ]],
        ['c3', 'Catálisis', [
          ['Catálisis homogénea, heterogénea y enzimática', ['catalisis'], 65, 'catalysis'],
          ['Michaelis–Menten y sus linealizaciones', ['michaelis-menten'], 70, 'michaelis-menten'],
        ]],
      ]),
    ],
  },
  {
    id: 'electro1', number: 27, code: 'QUI-409', name: 'Electroquímica I',
    area: 'fisicoquimica', term: 8, credits: 6, elective: false, prerequisites: ['fq1', 'electromag'],
    description: 'Termodinámica electroquímica: celdas, potenciales, Nernst, actividad iónica y conductividad de electrolitos.',
    substances: ['zn', 'cu', 'cuso4', 'nacl'],
    instruments: ['potenciostato', 'conductimetro', 'phmetro'],
    objectives: [
      'Relacionar el potencial de celda con la energía de Gibbs y con K.',
      'Aplicar la ecuación de Nernst a celdas y electrodos reales.',
      'Interpretar medidas de conductividad de electrolitos fuertes y débiles.',
    ],
    units: [
      u('u1', 'Celdas electroquímicas', 'Convertir química en electricidad.', [
        ['c1', 'Termodinámica de celda', [
          ['Celdas galvánicas y notación de celda', ['celda-galvanica'], 60, 'galvanic-cell', 'lab-daniell'],
          ['Potenciales estándar y la serie electroquímica', ['potencial-estandar'], 65, 'potential-series'],
          ['ΔG = −nFE y la constante de equilibrio', ['relacion-g-e'], 65],
          ['Ecuación de Nernst', ['nernst'], 70, 'nernst'],
        ]],
        ['c2', 'Electrolitos', [
          ['Conductividad y conductividad molar', ['conductividad-molar'], 60, 'conductivity', 'lab-conductividad'],
          ['Ley de Kohlrausch y electrolitos débiles', ['kohlrausch'], 60],
          ['Números de transporte y movilidad iónica', ['movilidad-ionica'], 55],
        ]],
      ]),
    ],
  },
  {
    id: 'qteo', number: 28, code: 'QUI-410', name: 'Química Teórica Computacional',
    area: 'fisicoquimica', term: 9, credits: 6, elective: false, prerequisites: ['algebra-lineal', 'fq1'],
    description: 'Métodos de la química cuántica computacional: desde Hückel hasta los fundamentos de Hartree–Fock y DFT, con énfasis en distinguir qué es un modelo y qué es un dato.',
    objectives: [
      'Comprender la jerarquía de métodos y sus aproximaciones.',
      'Optimizar geometrías y calcular propiedades moleculares.',
      'Distinguir con rigor un resultado calculado de un dato experimental.',
    ],
    units: [
      u('u1', 'Fundamentos', 'La ecuación de Schrödinger molecular.', [
        ['c1', 'Aproximaciones', [
          ['Aproximación de Born–Oppenheimer', ['born-oppenheimer'], 60],
          ['Método variacional y bases', ['metodo-variacional', 'base-funciones'], 65],
          ['Hückel: el modelo mínimo que ya predice', ['huckel'], 70, 'huckel-method'],
        ]],
      ]),
      u('u2', 'Métodos y práctica', 'Del cálculo al resultado.', [
        ['c1', 'Métodos', [
          ['Hartree–Fock y correlación electrónica', ['hartree-fock'], 65],
          ['Teoría del funcional de la densidad', ['dft'], 65],
          ['Optimización de geometría y superficie de energía potencial', ['superficie-energia-potencial'], 70, 'geometry-optimization'],
        ]],
        ['c2', 'Interpretación', [
          ['Orbitales frontera y reactividad', ['homo-lumo'], 65, 'frontier-orbitals'],
          ['Modelo, aproximación y dato experimental: no confundirlos', ['procedencia-dato'], 55, 'provenance'],
        ]],
      ]),
    ],
  },
  {
    id: 'fq3', number: 29, code: 'QUI-411', name: 'Fisicoquímica III',
    area: 'fisicoquimica', term: 9, credits: 7, elective: false, prerequisites: ['fq2'],
    description: 'Fenómenos de superficie, coloides, macromoléculas en disolución y termodinámica estadística aplicada.',
    objectives: [
      'Describir la adsorción con las isotermas de Langmuir y BET.',
      'Caracterizar un sistema coloidal y su estabilidad.',
      'Relacionar propiedades macroscópicas con la distribución de Boltzmann.',
    ],
    units: [
      u('u1', 'Superficies', 'La interfase como fase.', [
        ['c1', 'Fenómenos superficiales', [
          ['Tensión superficial y capilaridad', ['tension-superficial'], 60, 'surface-tension'],
          ['Isoterma de Langmuir', ['langmuir'], 65, 'langmuir'],
          ['Isoterma BET y área superficial', ['bet'], 60],
          ['Catálisis heterogénea y mecanismos superficiales', ['catalisis-heterogenea'], 60],
        ]],
      ]),
      u('u2', 'Coloides y termodinámica estadística', 'Sistemas dispersos y el puente micro-macro.', [
        ['c1', 'Coloides', [
          ['Tipos de coloides y estabilidad', ['coloide'], 55],
          ['Doble capa eléctrica y potencial zeta', ['potencial-zeta'], 60, 'zeta-potential'],
          ['Coagulación y floculación', ['coagulacion'], 55],
        ]],
        ['c2', 'Termodinámica estadística', [
          ['Distribución de Boltzmann y función de partición', ['boltzmann', 'funcion-particion'], 70, 'partition-function'],
          ['Capacidades caloríficas desde el modelo molecular', ['capacidad-calorifica'], 60],
        ]],
      ]),
    ],
  },
  {
    id: 'qnuclear', number: 30, code: 'QUI-412', name: 'Química Nuclear',
    area: 'aplicada', term: 9, credits: 5, elective: false, prerequisites: ['qg2', 'edo1'],
    description: 'Estructura nuclear, radiactividad, cinética de la desintegración, detección y aplicaciones analíticas y de datación.',
    objectives: [
      'Aplicar la cinética de primer orden a la desintegración radiactiva.',
      'Calcular actividad, dosis y blindaje.',
      'Comprender los métodos de datación y el análisis por activación.',
    ],
    units: [
      u('u1', 'Radiactividad', 'El núcleo inestable.', [
        ['c1', 'Desintegración', [
          ['Modos de desintegración: α, β, γ y captura electrónica', ['desintegracion'], 60, 'decay-modes'],
          ['Ley de desintegración y vida media', ['vida-media', 'actividad-radiactiva'], 65, 'decay-kinetics'],
          ['Series radiactivas y equilibrio secular', ['serie-radiactiva'], 60, 'decay-chain'],
          ['Energía de enlace nuclear y defecto de masa', ['energia-enlace-nuclear'], 55, 'binding-energy'],
        ]],
      ]),
      u('u2', 'Detección y aplicaciones', 'Medir la radiación y usarla.', [
        ['c1', 'Detectores y dosimetría', [
          ['Contadores Geiger, de centelleo y semiconductores', ['detector-radiacion'], 55],
          ['Estadística de recuento: distribución de Poisson', ['poisson'], 60, 'counting-statistics'],
          ['Dosimetría, blindaje y protección radiológica', ['dosimetria'], 60, 'shielding'],
        ]],
        ['c2', 'Aplicaciones', [
          ['Datación por ¹⁴C y por series del uranio', ['datacion'], 65, 'radiocarbon'],
          ['Análisis por activación neutrónica', ['activacion-neutronica'], 50],
          ['Radiofármacos y trazadores', ['radiofarmaco'], 50],
        ]],
      ]),
    ],
  },
  {
    id: 'qamb', number: 31, code: 'QUI-413', name: 'Química Ambiental',
    area: 'ambiental', term: 9, credits: 6, elective: false, prerequisites: ['hidro', 'qan4'],
    description: 'Química de la atmósfera, la hidrosfera y el suelo; contaminantes, su transporte y transformación, y las tecnologías de tratamiento.',
    substances: ['h2co3', 'h2so4', 'hno3', 'h2o2'],
    project: 'Evaluar el impacto de un vertido industrial sobre un cauce y proponer un tratamiento justificado.',
    objectives: [
      'Describir los ciclos biogeoquímicos y las alteraciones antropogénicas.',
      'Modelar el destino de un contaminante en un compartimento ambiental.',
      'Seleccionar una tecnología de tratamiento con criterio técnico.',
    ],
    units: [
      u('u1', 'Atmósfera', 'Química del aire.', [
        ['c1', 'Procesos atmosféricos', [
          ['Estructura de la atmósfera y química del ozono', ['ozono'], 65, 'ozone-chemistry'],
          ['Smog fotoquímico y radicales', ['smog-fotoquimico'], 60],
          ['Lluvia ácida: origen, química y efectos', ['lluvia-acida'], 65, 'acid-rain'],
          ['Gases de efecto invernadero y forzamiento radiativo', ['efecto-invernadero'], 60],
        ]],
      ]),
      u('u2', 'Hidrosfera y suelo', 'Contaminación y tratamiento.', [
        ['c1', 'Contaminación del agua', [
          ['DBO, DQO y oxígeno disuelto', ['dbo', 'dqo'], 65, undefined, 'lab-dqo'],
          ['Eutrofización y nutrientes', ['eutrofizacion'], 55],
          ['Metales pesados: especiación y toxicidad', ['metal-pesado'], 60],
        ]],
        ['c2', 'Tratamiento', [
          ['Tratamiento de aguas: primario, secundario y terciario', ['tratamiento-agua'], 70, 'water-treatment'],
          ['Procesos de oxidación avanzada', ['oxidacion-avanzada'], 55],
          ['Remediación de suelos', ['remediacion'], 55],
        ]],
      ]),
    ],
  },
  {
    id: 'fito1', number: 32, code: 'QUI-414', name: 'Fitoquímica I',
    area: 'aplicada', term: 9, credits: 6, elective: true, prerequisites: ['qorg3', 'qan4'],
    description: 'Metabolitos secundarios vegetales: extracción, fraccionamiento y caracterización de alcaloides, flavonoides, terpenos y taninos.',
    substances: ['etanol', 'acido-salicilico'],
    instruments: ['hplc', 'ftir', 'espectrofotometro'],
    objectives: [
      'Diseñar una extracción selectiva según la polaridad del metabolito.',
      'Fraccionar un extracto por cromatografía y caracterizar sus componentes.',
      'Realizar la marcha fitoquímica de identificación preliminar.',
    ],
    units: [
      u('u1', 'Metabolitos secundarios', 'Qué produce una planta y por qué.', [
        ['c1', 'Familias', [
          ['Rutas biosintéticas principales', ['metabolito-secundario'], 60],
          ['Alcaloides: estructura, basicidad y extracción', ['alcaloide'], 65],
          ['Flavonoides y compuestos fenólicos', ['flavonoide'], 60],
          ['Terpenos y aceites esenciales', ['terpeno'], 60],
        ]],
      ]),
      u('u2', 'Extracción y análisis', 'Del material vegetal al compuesto puro.', [
        ['c1', 'Extracción', [
          ['Maceración, Soxhlet y extracción asistida', ['extraccion'], 65, 'extraction', 'lab-extraccion'],
          ['Reparto líquido-líquido y selección de disolvente', ['reparto'], 60, 'partition'],
          ['Marcha fitoquímica preliminar', ['marcha-fitoquimica'], 60, undefined, 'lab-marcha'],
        ]],
        ['c2', 'Separación', [
          ['Cromatografía en capa fina y Rf', ['ccf'], 55, 'tlc', 'lab-ccf'],
          ['Cromatografía en columna y aislamiento', ['cromatografia-columna'], 60],
        ]],
      ]),
    ],
  },
  {
    id: 'electro2', number: 33, code: 'QUI-501', name: 'Electroquímica II',
    area: 'fisicoquimica', term: 10, credits: 6, elective: false, prerequisites: ['electro1'],
    description: 'Cinética electroquímica y aplicaciones: Butler–Volmer, voltamperometría, corrosión, baterías, celdas de combustible y electrosíntesis.',
    instruments: ['potenciostato'],
    project: 'Caracterizar un sistema redox por voltamperometría cíclica y determinar su reversibilidad.',
    objectives: [
      'Aplicar la ecuación de Butler–Volmer y el análisis de Tafel.',
      'Interpretar un voltamperograma cíclico y extraer parámetros cinéticos.',
      'Diagnosticar un problema de corrosión y proponer protección.',
    ],
    units: [
      u('u1', 'Cinética electroquímica', 'La velocidad de la transferencia de carga.', [
        ['c1', 'Fundamentos', [
          ['Doble capa eléctrica y capacidad', ['doble-capa'], 60],
          ['Ecuación de Butler–Volmer', ['butler-volmer'], 70, 'butler-volmer'],
          ['Análisis de Tafel y densidad de corriente de intercambio', ['tafel'], 65, 'tafel'],
          ['Control por transferencia de masa y corriente límite', ['corriente-limite'], 60],
        ]],
        ['c2', 'Voltamperometría', [
          ['Voltamperometría cíclica: reversible e irreversible', ['voltamperometria-ciclica'], 75, 'cyclic-voltammetry', 'lab-cv'],
          ['Ecuación de Randles–Ševčík', ['randles-sevcik'], 55],
        ]],
      ]),
      u('u2', 'Aplicaciones', 'Electroquímica en uso.', [
        ['c1', 'Sistemas prácticos', [
          ['Corrosión: mecanismo, velocidad y protección', ['corrosion'], 70, 'corrosion'],
          ['Baterías primarias, secundarias y de ion litio', ['bateria'], 65, 'battery'],
          ['Celdas de combustible', ['celda-combustible'], 55],
          ['Electrosíntesis y electrodeposición', ['electrosintesis'], 55],
          ['Sensores electroquímicos y biosensores', ['sensor-electroquimico'], 55],
        ]],
      ]),
    ],
  },
  {
    id: 'qbio', number: 34, code: 'QUI-502', name: 'Química Biológica',
    area: 'aplicada', term: 9, credits: 7, elective: false, prerequisites: ['qorg3', 'fq2'],
    description: 'Las macromoléculas de la vida y su química: proteínas, enzimas, ácidos nucleicos, carbohidratos y lípidos; bioenergética.',
    substances: ['glucosa', 'h3po4', 'kh2po4', 'na2hpo4'],
    objectives: [
      'Relacionar estructura y función en las macromoléculas biológicas.',
      'Aplicar la cinética enzimática y la inhibición.',
      'Comprender el acoplamiento energético en el metabolismo.',
    ],
    units: [
      u('u1', 'Macromoléculas', 'Estructura y función.', [
        ['c1', 'Proteínas', [
          ['Aminoácidos, punto isoeléctrico y curva de titulación', ['aminoacido', 'punto-isoelectrico'], 70, 'amino-acid-titration'],
          ['Estructura primaria a cuaternaria', ['estructura-proteina'], 65],
          ['Desnaturalización y plegamiento', ['desnaturalizacion'], 55],
        ]],
        ['c2', 'Otras macromoléculas', [
          ['Carbohidratos: mutarrotación y enlaces glicosídicos', ['carbohidrato', 'mutarrotacion'], 60],
          ['Lípidos y membranas', ['lipido'], 55],
          ['Ácidos nucleicos y el código genético', ['acido-nucleico'], 60],
        ]],
      ]),
      u('u2', 'Enzimas y bioenergética', 'La química que hace la vida.', [
        ['c1', 'Catálisis enzimática', [
          ['Cinética de Michaelis–Menten', ['michaelis-menten'], 70, 'michaelis-menten', 'lab-enzima'],
          ['Inhibición competitiva, no competitiva y acompetitiva', ['inhibicion-enzimatica'], 65, 'enzyme-inhibition'],
          ['Efecto del pH y la temperatura sobre la actividad', ['actividad-enzimatica'], 55],
        ]],
        ['c2', 'Bioenergética', [
          ['ATP y acoplamiento energético', ['atp'], 60],
          ['Cadena de transporte electrónico y potenciales redox', ['cadena-transporte'], 65],
        ]],
      ]),
    ],
  },
  {
    id: 'grasas', number: 35, code: 'QUI-503', name: 'Grasas y Aceites',
    area: 'aplicada', term: 8, credits: 5, elective: true, prerequisites: ['qorg3', 'qan4'],
    description: 'Química y análisis de materias grasas: composición, extracción, refinado, oxidación y los índices que definen su calidad.',
    instruments: ['gc', 'espectrofotometro', 'bureta'],
    objectives: [
      'Determinar los índices de acidez, peróxidos, yodo y saponificación.',
      'Analizar el perfil de ácidos grasos por cromatografía de gases.',
      'Explicar el mecanismo de la oxidación lipídica y su control.',
    ],
    units: [
      u('u1', 'Composición y obtención', 'Qué es una grasa.', [
        ['c1', 'Estructura', [
          ['Triglicéridos y perfil de ácidos grasos', ['trigliceido', 'acido-graso'], 60],
          ['Insaturación, isomería cis/trans y punto de fusión', ['insaturacion'], 60],
        ]],
        ['c2', 'Procesado', [
          ['Extracción por prensado y por disolvente', ['extraccion-aceite'], 55, undefined, 'lab-soxhlet'],
          ['Refinado: desgomado, neutralización, decoloración, desodorización', ['refinado'], 60],
          ['Hidrogenación e interesterificación', ['hidrogenacion'], 55],
        ]],
      ]),
      u('u2', 'Análisis y deterioro', 'Medir la calidad.', [
        ['c1', 'Índices de calidad', [
          ['Índice de acidez', ['indice-acidez'], 55, undefined, 'lab-acidez'],
          ['Índice de peróxidos y estado de oxidación', ['indice-peroxidos'], 60, undefined, 'lab-peroxidos'],
          ['Índices de yodo y de saponificación', ['indice-yodo'], 55],
          ['Perfil de ácidos grasos por GC de los ésteres metílicos', ['fame'], 65, 'fame-gc'],
        ]],
        ['c2', 'Oxidación', [
          ['Mecanismo radicalario de la autooxidación', ['autooxidacion'], 65, 'lipid-oxidation'],
          ['Antioxidantes y sinergistas', ['antioxidante'], 55],
        ]],
      ]),
    ],
  },
  {
    id: 'qsuelo', number: 36, code: 'QUI-504', name: 'Química de Suelo',
    area: 'ambiental', term: 8, credits: 5, elective: true, prerequisites: ['hidro', 'qan2'],
    description: 'Química de la fase sólida y de la disolución del suelo: intercambio catiónico, pH, materia orgánica, nutrientes y contaminación.',
    substances: ['caco3', 'cacl2', 'h3po4'],
    objectives: [
      'Determinar e interpretar el pH y la capacidad de intercambio catiónico.',
      'Relacionar la especiación con la disponibilidad de nutrientes.',
      'Evaluar la contaminación por metales y su movilidad.',
    ],
    units: [
      u('u1', 'El suelo como sistema químico', 'Fases y equilibrios.', [
        ['c1', 'Componentes', [
          ['Minerales de arcilla y superficies cargadas', ['arcilla', 'superficie-cargada'], 60],
          ['Materia orgánica y sustancias húmicas', ['materia-organica'], 55],
          ['Capacidad de intercambio catiónico', ['cic'], 65, 'cec', 'lab-cic'],
        ]],
        ['c2', 'Reacción del suelo', [
          ['pH del suelo, acidez de cambio y encalado', ['ph-suelo', 'encalado'], 65, 'soil-ph', 'lab-ph-suelo'],
          ['Potencial redox y suelos anegados', ['redox-suelo'], 55],
        ]],
      ]),
      u('u2', 'Nutrientes y contaminantes', 'Disponibilidad química.', [
        ['c1', 'Fertilidad y contaminación', [
          ['Nitrógeno, fósforo y potasio: formas y disponibilidad', ['nutriente'], 65],
          ['Fijación de fósforo y su dependencia del pH', ['fijacion-fosforo'], 60, 'phosphorus-fixation'],
          ['Metales pesados: movilidad y extracciones secuenciales', ['extraccion-secuencial'], 65],
          ['Salinidad y sodicidad', ['salinidad'], 55],
        ]],
      ]),
    ],
  },
  {
    id: 'metodologia', number: 37, code: 'INV-501', name: 'Metodología de la Investigación Científica',
    area: 'investigacion', term: 10, credits: 5, elective: false, prerequisites: ['prob1', 'qan3'],
    description: 'Cómo se produce conocimiento científico: del problema a la publicación, con el diseño experimental y la ética que lo hacen válido.',
    project: 'Diseñar, ejecutar y comunicar una investigación original sobre un problema abierto.',
    objectives: [
      'Formular un problema y una hipótesis contrastable.',
      'Diseñar un experimento con controles y réplicas adecuados.',
      'Redactar un informe científico completo y honesto.',
    ],
    units: [
      u('u1', 'El método científico en la práctica', 'De la pregunta al diseño.', [
        ['c1', 'Planteamiento', [
          ['Del problema a la pregunta investigable', ['pregunta-investigacion'], 55],
          ['Hipótesis, variables y operacionalización', ['hipotesis', 'variable'], 65, 'hypothesis'],
          ['Revisión bibliográfica y estado del arte', ['revision-bibliografica'], 50],
        ]],
        ['c2', 'Diseño experimental', [
          ['Controles, réplicas y aleatorización', ['control-experimental', 'replica'], 70, 'experimental-design'],
          ['Diseño factorial y superficies de respuesta', ['diseno-factorial'], 70, 'factorial-design'],
          ['Tamaño de muestra y potencia estadística', ['potencia-estadistica'], 60],
        ]],
      ]),
      u('u2', 'Comunicación y ética', 'El resultado como bien público.', [
        ['c1', 'Comunicación', [
          ['Estructura IMRyD de un artículo', ['imryd'], 60],
          ['Presentación de datos: tablas y figuras honestas', ['presentacion-datos'], 60],
          ['Citación y gestión bibliográfica', ['citacion'], 45],
        ]],
        ['c2', 'Ética', [
          ['Integridad científica y conducta responsable', ['integridad-cientifica'], 55],
          ['Reproducibilidad y datos abiertos', ['reproducibilidad'], 55],
        ]],
      ]),
    ],
  },
  {
    id: 'polimeros', number: 38, code: 'QUI-505', name: 'Macromoléculas y Polímeros',
    area: 'aplicada', term: 10, credits: 6, elective: false, prerequisites: ['qorg3', 'fq2'],
    description: 'Síntesis, estructura, caracterización y propiedades de los polímeros; relación estructura-propiedad y degradación.',
    instruments: ['ftir', 'hplc'],
    objectives: [
      'Distinguir polimerización en cadena y por etapas y sus consecuencias.',
      'Determinar y usar las distintas medias del peso molecular.',
      'Relacionar estructura, cristalinidad y propiedades mecánicas.',
    ],
    units: [
      u('u1', 'Síntesis', 'Cómo se construye una macromolécula.', [
        ['c1', 'Mecanismos de polimerización', [
          ['Polimerización por etapas y ecuación de Carothers', ['polimerizacion-etapas', 'carothers'], 70, 'step-growth'],
          ['Polimerización en cadena: radicalaria, iónica y coordinación', ['polimerizacion-cadena'], 70, 'chain-growth'],
          ['Copolímeros y arquitecturas', ['copolimero'], 55],
        ]],
      ]),
      u('u2', 'Caracterización y propiedades', 'Medir y predecir.', [
        ['c1', 'Peso molecular', [
          ['Medias Mn, Mw y polidispersidad', ['peso-molecular', 'polidispersidad'], 65, 'molecular-weight'],
          ['Cromatografía de exclusión por tamaño', ['gpc'], 55],
          ['Viscosimetría y ecuación de Mark–Houwink', ['mark-houwink'], 60, undefined, 'lab-viscosimetria'],
        ]],
        ['c2', 'Propiedades', [
          ['Cristalinidad, Tg y Tm', ['transicion-vitrea'], 65, 'polymer-thermal'],
          ['Propiedades mecánicas y viscoelasticidad', ['viscoelasticidad'], 60],
          ['Degradación, reciclaje y polímeros biodegradables', ['degradacion-polimero'], 60],
        ]],
      ]),
    ],
  },
  {
    id: 'qverde', number: 39, code: 'QUI-506', name: 'Química Verde',
    area: 'ambiental', term: 10, credits: 5, elective: false, prerequisites: ['qorg4', 'qamb'],
    description: 'Los doce principios y las métricas que permiten comparar objetivamente dos rutas sintéticas por su impacto, no por su rendimiento.',
    substances: ['h2o2', 'etanol', 'benceno'],
    project: 'Comparar dos rutas sintéticas industriales por sus métricas verdes y justificar cuál es preferible.',
    objectives: [
      'Calcular y comparar economía atómica, factor E e intensidad de masa.',
      'Seleccionar disolventes y catalizadores con criterio ambiental.',
      'Evaluar el ciclo de vida de un proceso químico.',
    ],
    units: [
      u('u1', 'Principios y métricas', 'Medir el impacto.', [
        ['c1', 'Los doce principios', [
          ['Prevención, economía atómica y síntesis menos peligrosa', ['principios-verdes'], 60],
          ['Disolventes: guías de selección y alternativas', ['seleccion-disolvente'], 65, 'solvent-selection'],
          ['Catálisis frente a reactivos estequiométricos', ['catalisis-verde'], 55],
        ]],
        ['c2', 'Métricas', [
          ['Economía atómica y factor E', ['economia-atomica', 'factor-e'], 70, 'green-metrics'],
          ['Intensidad de masa del proceso e intensidad energética', ['intensidad-masa'], 60],
          ['Comparación cuantitativa de dos rutas', ['comparacion-rutas'], 70, 'route-comparison'],
        ]],
      ]),
      u('u2', 'Aplicación', 'Del principio al proceso.', [
        ['c1', 'Tecnologías', [
          ['Materias primas renovables y biorrefinería', ['materia-prima-renovable'], 55],
          ['Procesos en agua, sin disolvente y en fluidos supercríticos', ['proceso-alternativo'], 60],
          ['Análisis de ciclo de vida', ['acv'], 65, 'lca'],
        ]],
      ]),
    ],
  },
  {
    id: 'fito2', number: 40, code: 'QUI-507', name: 'Fitoquímica II',
    area: 'aplicada', term: 10, credits: 6, elective: true, prerequisites: ['fito1'],
    description: 'Aislamiento, elucidación estructural y evaluación de la actividad de productos naturales; estandarización de extractos.',
    instruments: ['hplc', 'espectrometro-masas', 'rmn'],
    objectives: [
      'Aislar un metabolito puro mediante cromatografía preparativa.',
      'Elucidar su estructura combinando técnicas espectroscópicas.',
      'Estandarizar un extracto y validar su método de control.',
    ],
    units: [
      u('u1', 'Aislamiento y elucidación', 'Del extracto al compuesto puro.', [
        ['c1', 'Purificación', [
          ['Cromatografía preparativa y contracorriente', ['cromatografia-preparativa'], 65],
          ['Criterios de pureza', ['pureza'], 50],
        ]],
        ['c2', 'Elucidación', [
          ['Estrategia con RMN 1D y 2D', ['rmn-2d'], 75, 'nmr-2d'],
          ['Espectrometría de masas de alta resolución', ['masa-exacta'], 60],
          ['Determinación de la configuración absoluta', ['configuracion-absoluta'], 60],
        ]],
      ]),
      u('u2', 'Actividad y estandarización', 'Del compuesto al producto.', [
        ['c1', 'Evaluación', [
          ['Ensayos de actividad antioxidante y antimicrobiana', ['ensayo-actividad'], 65, undefined, 'lab-antioxidante'],
          ['Relación estructura-actividad', ['sar'], 55],
        ]],
        ['c2', 'Control de calidad', [
          ['Marcadores y estandarización de extractos', ['estandarizacion'], 60],
          ['Perfil cromatográfico como huella dactilar', ['fingerprint'], 55, 'fingerprint'],
        ]],
      ]),
    ],
  },
  {
    id: 'quimiometria', number: 41, code: 'QUI-508', name: 'Quimiometría Avanzada',
    area: 'analitica', term: 10, credits: 6, elective: false, prerequisites: ['prob1', 'algebra-lineal', 'qan4'],
    description: 'Análisis multivariante aplicado a datos químicos: PCA, regresión multivariante, clasificación, calibración multivariante y diseño de experimentos.',
    project: 'Construir y validar un modelo de calibración multivariante sobre un conjunto de espectros.',
    objectives: [
      'Preprocesar correctamente una matriz de datos espectrales.',
      'Aplicar e interpretar un análisis de componentes principales.',
      'Construir y validar un modelo de calibración multivariante.',
      'Diseñar un experimento factorial y analizar sus efectos.',
    ],
    units: [
      u('u1', 'Análisis exploratorio', 'Ver la estructura de los datos.', [
        ['c1', 'Preprocesado', [
          ['Centrado, autoescalado y corrección de línea base', ['preprocesado'], 60, 'preprocessing'],
          ['Derivadas y corrección multiplicativa de dispersión', ['msc'], 55],
        ]],
        ['c2', 'PCA', [
          ['Componentes principales: scores y loadings', ['pca'], 75, 'pca'],
          ['Elección del número de componentes', ['numero-componentes'], 55],
          ['Detección de anómalos por T² y residuales Q', ['deteccion-anomalos'], 60],
        ]],
      ]),
      u('u2', 'Modelado', 'Predecir y clasificar.', [
        ['c1', 'Calibración multivariante', [
          ['Regresión lineal múltiple y colinealidad', ['mlr', 'colinealidad'], 65],
          ['Regresión en componentes principales y PLS', ['pls'], 75, 'pls'],
          ['Validación cruzada y error de predicción', ['validacion-cruzada', 'rmsep'], 70, 'cross-validation'],
        ]],
        ['c2', 'Clasificación y diseño', [
          ['Clasificación supervisada y no supervisada', ['clasificacion', 'clustering'], 65, 'classification'],
          ['Diseño factorial y análisis de efectos', ['diseno-factorial'], 70, 'factorial-design'],
          ['Optimización por superficie de respuesta', ['superficie-respuesta'], 65, 'response-surface'],
        ]],
      ]),
    ],
  },
];

// ---------------------------------------------------------------------------
// Indexes and derived views
// ---------------------------------------------------------------------------

const BY_ID = new Map(COURSES.map((c) => [c.id, c]));
export const courseById = (id: string): Course | undefined => BY_ID.get(id);

export const coursesByTerm = (): Map<number, Course[]> => {
  const map = new Map<number, Course[]>();
  for (const c of COURSES) {
    const list = map.get(c.term) ?? [];
    list.push(c);
    map.set(c.term, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.number - b.number);
  return new Map([...map.entries()].sort((a, b) => a[0] - b[0]));
};

export const coursesByArea = (area: CourseArea): Course[] =>
  COURSES.filter((c) => c.area === area);

/** Courses that list `id` as a prerequisite. */
export const dependents = (id: string): Course[] =>
  COURSES.filter((c) => c.prerequisites.includes(id));

/** Total study minutes in a course. */
export function courseMinutes(course: Course): number {
  return course.units.reduce((sum, unit) =>
    sum + unit.chapters.reduce((s, ch) =>
      s + ch.topics.reduce((t, topic) => t + topic.minutes, 0), 0), 0);
}

export function courseTopicCount(course: Course): number {
  return course.units.reduce((sum, unit) =>
    sum + unit.chapters.reduce((s, ch) => s + ch.topics.length, 0), 0);
}

export const allTopics = (course: Course): Topic[] =>
  course.units.flatMap((unit) => unit.chapters.flatMap((ch) => ch.topics));

/** Every topic in the plan, with its course, for search and the graph. */
export function allTopicsWithCourse(): Array<{ course: Course; unit: Unit; chapter: Chapter; topic: Topic }> {
  const out: Array<{ course: Course; unit: Unit; chapter: Chapter; topic: Topic }> = [];
  for (const course of COURSES) {
    for (const unit of course.units) {
      for (const chapter of unit.chapters) {
        for (const topic of chapter.topics) out.push({ course, unit, chapter, topic });
      }
    }
  }
  return out;
}

/** Courses that teach a given concept — the basis of the cross-links in §10. */
export function coursesTeaching(conceptId: string): Course[] {
  return COURSES.filter((c) =>
    allTopics(c).some((t) => t.concepts.includes(conceptId)));
}

/** Topological order of the plan; detects a cycle in the prerequisites. */
export function studyOrder(): { order: Course[]; cycle: string[] } {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const order: Course[] = [];
  const cycle: string[] = [];

  const visit = (id: string): void => {
    if (visited.has(id) || cycle.length > 0) return;
    if (stack.has(id)) { cycle.push(id); return; }
    stack.add(id);
    const c = BY_ID.get(id);
    if (c) {
      for (const p of c.prerequisites) visit(p);
      visited.add(id);
      order.push(c);
    }
    stack.delete(id);
  };

  for (const c of COURSES) visit(c.id);
  return { order, cycle };
}

export const TOTAL_CREDITS = COURSES.reduce((s, c) => s + c.credits, 0);
export const TOTAL_MINUTES = COURSES.reduce((s, c) => s + courseMinutes(c), 0);
export const TOTAL_TOPICS = COURSES.reduce((s, c) => s + courseTopicCount(c), 0);
