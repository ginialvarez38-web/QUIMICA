/**
 * The concept graph.
 *
 * §60: a navigable scientific map. Each concept declares what it depends on,
 * which makes the graph a real prerequisite structure rather than a picture:
 * the platform can tell a student *why* they are stuck on speciation (they do
 * not yet hold "equilibrio químico" and "pKa") and what to revisit.
 *
 * The curriculum references these ids from its topics, so the two structures
 * stay consistent by construction (§10, §83).
 */

export type ConceptTier = 'fundamento' | 'nucleo' | 'aplicado' | 'avanzado';

export interface Concept {
  id: string;
  name: string;
  /** One sentence a student would accept as a definition. */
  short: string;
  tier: ConceptTier;
  /** Concept ids that must be understood first. */
  dependsOn: string[];
  /** Substances that make the concept concrete. */
  substances?: string[];
  /** Equation ids that express it. */
  equations?: string[];
  aliases?: string[];
  /** The competency this concept mainly builds. */
  competency?: 'quimica' | 'matematica' | 'fisica' | 'laboratorio' | 'instrumentos' | 'analisis' | 'investigacion';
}

const c = (
  id: string, name: string, short: string, tier: ConceptTier,
  dependsOn: string[] = [], extra: Partial<Concept> = {},
): Concept => ({ id, name, short, tier, dependsOn, competency: 'quimica', ...extra });

export const CONCEPTS: Concept[] = [
  // ---- the spine of §60: átomo → enlace → molécula → propiedades → reacción
  c('atomo', 'Átomo', 'La unidad más pequeña de un elemento que conserva su identidad química.', 'fundamento', []),
  c('numero-atomico', 'Número atómico', 'El número de protones, que define de qué elemento se trata.', 'fundamento', ['atomo']),
  c('isotopo', 'Isótopo', 'Átomos del mismo elemento que difieren en el número de neutrones.', 'fundamento', ['numero-atomico']),
  c('masa-atomica', 'Masa atómica', 'Media de las masas isotópicas ponderada por su abundancia natural.', 'fundamento', ['isotopo']),
  c('mol', 'Mol', 'La cantidad de sustancia que contiene exactamente 6.02214076×10²³ entidades.', 'fundamento', ['masa-atomica'], { equations: [] }),
  c('masa-molar', 'Masa molar', 'La masa de un mol de una sustancia, en gramos por mol.', 'fundamento', ['mol']),

  c('configuracion-electronica', 'Configuración electrónica', 'La distribución de los electrones en los orbitales del átomo.', 'nucleo', ['atomo', 'orbital']),
  c('orbital', 'Orbital atómico', 'Región del espacio donde es probable encontrar un electrón, descrita por una función de onda.', 'nucleo', ['atomo']),
  c('numeros-cuanticos', 'Números cuánticos', 'Los cuatro números que identifican de forma única el estado de un electrón.', 'nucleo', ['orbital']),
  c('tendencia-periodica', 'Tendencia periódica', 'La variación regular de una propiedad a lo largo de un periodo o un grupo.', 'nucleo', ['configuracion-electronica']),
  c('electronegatividad', 'Electronegatividad', 'La capacidad de un átomo enlazado para atraer hacia sí los electrones del enlace.', 'nucleo', ['tendencia-periodica']),

  c('enlace-ionico', 'Enlace iónico', 'Atracción electrostática entre iones de carga opuesta formados por transferencia de electrones.', 'nucleo', ['electronegatividad']),
  c('enlace-covalente', 'Enlace covalente', 'Unión por electrones compartidos entre dos átomos.', 'nucleo', ['electronegatividad']),
  c('lewis', 'Estructura de Lewis', 'Representación de los electrones de valencia que muestra enlaces y pares solitarios.', 'nucleo', ['enlace-covalente']),
  c('resonancia', 'Resonancia', 'Cuando una sola estructura de Lewis no basta y la real es un híbrido de varias.', 'nucleo', ['lewis']),
  c('rpecv', 'RPECV', 'Los pares de electrones de valencia se disponen tan lejos entre sí como pueden.', 'nucleo', ['lewis']),
  c('geometria-molecular', 'Geometría molecular', 'La disposición tridimensional de los núcleos de una molécula.', 'nucleo', ['rpecv'], { competency: 'quimica' }),
  c('polaridad', 'Polaridad molecular', 'El resultado de sumar vectorialmente los dipolos de enlace según la geometría.', 'nucleo', ['geometria-molecular', 'electronegatividad']),
  c('fuerzas-intermoleculares', 'Fuerzas intermoleculares', 'Las interacciones entre moléculas que determinan el estado físico.', 'nucleo', ['polaridad']),
  c('puente-hidrogeno', 'Puente de hidrógeno', 'Interacción fuerte entre un H unido a N, O o F y un par solitario vecino.', 'nucleo', ['fuerzas-intermoleculares'], { substances: ['h2o', 'ch3cooh', 'etanol'] }),

  c('estequiometria', 'Estequiometría', 'La contabilidad de átomos y moles en una reacción química.', 'nucleo', ['mol']),
  c('ajuste-ecuaciones', 'Ajuste de ecuaciones', 'Encontrar los coeficientes que conservan cada elemento y la carga.', 'nucleo', ['estequiometria'], { competency: 'matematica' }),
  c('reactivo-limitante', 'Reactivo limitante', 'El reactivo que se agota primero y fija cuánto producto puede formarse.', 'nucleo', ['estequiometria']),
  c('rendimiento', 'Rendimiento', 'La razón entre lo obtenido y lo teóricamente posible.', 'nucleo', ['reactivo-limitante']),
  c('economia-atomica', 'Economía atómica', 'La fracción de la masa de los reactivos que acaba en el producto deseado.', 'aplicado', ['rendimiento']),

  c('concentracion', 'Concentración', 'La cantidad de soluto por unidad de disolución o de disolvente.', 'fundamento', ['mol']),
  c('molaridad', 'Molaridad', 'Moles de soluto por litro de disolución.', 'fundamento', ['concentracion']),
  c('dilucion', 'Dilución', 'Añadir disolvente conservando la cantidad de soluto: C₁V₁ = C₂V₂.', 'fundamento', ['molaridad'], { competency: 'laboratorio' }),

  // ---- equilibrium branch
  c('equilibrio-quimico', 'Equilibrio químico', 'El estado en que las velocidades directa e inversa se igualan y las concentraciones dejan de cambiar.', 'nucleo', ['estequiometria']),
  c('constante-equilibrio', 'Constante de equilibrio', 'El valor que toma el cociente de reacción en el equilibrio, fijo a cada temperatura.', 'nucleo', ['equilibrio-quimico'], { equations: ['vant-hoff'] }),
  c('le-chatelier', 'Principio de Le Châtelier', 'Un sistema perturbado evoluciona en el sentido que restablece Q = K.', 'nucleo', ['constante-equilibrio']),
  c('acido', 'Ácido', 'Especie capaz de ceder un protón (Brønsted) o de aceptar un par de electrones (Lewis).', 'nucleo', ['enlace-covalente'], { substances: ['hcl', 'ch3cooh', 'h2so4'] }),
  c('base', 'Base', 'Especie capaz de aceptar un protón o de ceder un par de electrones.', 'nucleo', ['acido'], { substances: ['naoh', 'nh3'] }),
  c('pka', 'pKa', 'El −log₁₀ de la constante de acidez: cuanto menor, más fuerte es el ácido.', 'nucleo', ['acido', 'constante-equilibrio']),
  c('ph', 'pH', 'El −log₁₀ de la actividad del ion hidrógeno.', 'nucleo', ['pka'], { equations: ['henderson'] }),
  c('acido-debil', 'Ácido débil', 'Un ácido que se disocia sólo parcialmente, de modo que coexisten las dos formas.', 'nucleo', ['pka']),
  c('tampon', 'Disolución tampón', 'Mezcla de un ácido débil y su base conjugada que resiste los cambios de pH.', 'nucleo', ['acido-debil'], { equations: ['henderson'] }),
  c('capacidad-tamponante', 'Capacidad tamponante', 'Los moles de base fuerte necesarios para subir el pH de la disolución en una unidad.', 'aplicado', ['tampon'], { competency: 'analisis' }),
  c('henderson-hasselbalch', 'Henderson–Hasselbalch', 'La relación aproximada entre el pH de un tampón y la razón base/ácido.', 'nucleo', ['tampon'], { equations: ['henderson'] }),
  c('poliprotico', 'Sistema poliprótico', 'Un ácido con varios protones ionizables, cada uno con su pKa.', 'aplicado', ['pka'], { substances: ['h3po4', 'h2co3'] }),
  c('especiacion', 'Especiación', 'La distribución de un elemento entre todas sus formas químicas en disolución.', 'aplicado', ['poliprotico', 'ph']),
  c('diagrama-alfa', 'Diagrama de distribución', 'La fracción de cada especie representada frente al pH.', 'aplicado', ['especiacion'], { competency: 'analisis' }),

  c('fuerza-ionica', 'Fuerza iónica', 'Medida de la concentración total de carga en disolución: I = ½Σcᵢzᵢ².', 'aplicado', ['molaridad']),
  c('actividad', 'Actividad', 'La concentración efectiva de una especie, que es la que aparece en las constantes termodinámicas.', 'avanzado', ['fuerza-ionica'], { equations: ['debye-huckel'] }),

  c('kps', 'Producto de solubilidad', 'La constante de equilibrio de la disolución de un sólido poco soluble.', 'aplicado', ['constante-equilibrio']),
  c('ion-comun', 'Efecto del ion común', 'La solubilidad disminuye al añadir un ion que ya forma parte del precipitado.', 'aplicado', ['kps'], { substances: ['agcl', 'nacl'] }),
  c('precipitacion-fraccionada', 'Precipitación fraccionada', 'Separar dos iones aprovechando la diferencia entre sus productos de solubilidad.', 'avanzado', ['ion-comun'], { competency: 'analisis' }),

  c('complejo', 'Complejo de coordinación', 'Un ion metálico central rodeado de ligandos unidos por enlaces dativos.', 'aplicado', ['enlace-covalente']),
  c('ligando', 'Ligando', 'Especie que cede un par de electrones al metal central.', 'aplicado', ['complejo']),
  c('constante-formacion', 'Constante de formación', 'La constante de equilibrio de la formación de un complejo a partir de sus componentes.', 'aplicado', ['complejo', 'constante-equilibrio']),
  c('efecto-quelato', 'Efecto quelato', 'Un ligando polidentado forma complejos mucho más estables, por razones entrópicas.', 'avanzado', ['constante-formacion'], { substances: ['edta'] }),
  c('constante-condicional', 'Constante condicional', 'La constante de formación efectiva a un pH dado, que incorpora la protonación del ligando.', 'avanzado', ['efecto-quelato', 'especiacion']),
  c('campo-cristalino', 'Teoría del campo cristalino', 'El desdoblamiento de los orbitales d por la repulsión de los ligandos.', 'avanzado', ['complejo', 'orbital']),
  c('color-complejo', 'Color de los complejos', 'La absorción de la luz que promueve un electrón entre los orbitales d desdoblados.', 'avanzado', ['campo-cristalino', 'beer-lambert']),

  // ---- redox and electrochemistry
  c('estado-oxidacion', 'Estado de oxidación', 'La carga que tendría un átomo si todos sus enlaces fueran iónicos.', 'nucleo', ['electronegatividad']),
  c('redox', 'Reacción redox', 'Una reacción en la que hay transferencia de electrones.', 'nucleo', ['estado-oxidacion']),
  c('potencial-estandar', 'Potencial estándar', 'La tendencia de una semirreacción a ocurrir como reducción, medida frente al electrodo de hidrógeno.', 'aplicado', ['redox']),
  c('nernst', 'Ecuación de Nernst', 'Cómo cambia el potencial de un electrodo con las actividades y el pH.', 'aplicado', ['potencial-estandar'], { equations: ['nernst'] }),
  c('celda-galvanica', 'Celda galvánica', 'Un dispositivo que convierte energía química en eléctrica mediante una reacción redox espontánea.', 'aplicado', ['nernst'], { substances: ['zn', 'cu'] }),
  c('corrosion', 'Corrosión', 'La oxidación espontánea de un metal en su entorno.', 'aplicado', ['celda-galvanica']),
  c('conductividad', 'Conductividad', 'La capacidad de una disolución para transportar corriente, proporcional a la concentración de iones y a su movilidad.', 'aplicado', ['molaridad'], { competency: 'instrumentos' }),

  // ---- thermodynamics and kinetics
  c('primera-ley', 'Primer principio', 'La energía se conserva: ΔU = q + w.', 'nucleo', [], { competency: 'fisica' }),
  c('entalpia', 'Entalpía', 'La función de estado cuya variación es el calor intercambiado a presión constante.', 'nucleo', ['primera-ley']),
  c('ley-hess', 'Ley de Hess', 'La entalpía de una reacción no depende del camino, sólo de los estados inicial y final.', 'nucleo', ['entalpia']),
  c('calorimetria', 'Calorimetría', 'La medida experimental del calor de un proceso.', 'aplicado', ['entalpia'], { competency: 'laboratorio' }),
  c('entropia', 'Entropía', 'La medida del número de microestados compatibles con el estado macroscópico.', 'nucleo', ['primera-ley']),
  c('energia-gibbs', 'Energía de Gibbs', 'El criterio de espontaneidad a presión y temperatura constantes.', 'nucleo', ['entalpia', 'entropia'], { equations: ['gibbs'] }),
  c('relacion-g-k', 'Relación ΔG°–K', 'ΔG° = −RT ln K: la termodinámica fija la posición del equilibrio.', 'avanzado', ['energia-gibbs', 'constante-equilibrio']),
  c('vant-hoff', 'Ecuación de van \'t Hoff', 'Cómo varía la constante de equilibrio con la temperatura.', 'avanzado', ['relacion-g-k'], { equations: ['vant-hoff'] }),

  c('velocidad-reaccion', 'Velocidad de reacción', 'La derivada de la concentración respecto del tiempo, dividida por el coeficiente estequiométrico.', 'nucleo', ['estequiometria'], { competency: 'matematica' }),
  c('orden-reaccion', 'Orden de reacción', 'El exponente al que aparece cada concentración en la ley de velocidad. Es experimental.', 'nucleo', ['velocidad-reaccion'], { equations: ['rate-law'] }),
  c('ley-velocidad-integrada', 'Ley de velocidad integrada', 'La solución de la ecuación diferencial de velocidad: la concentración en función del tiempo.', 'aplicado', ['orden-reaccion']),
  c('energia-activacion', 'Energía de activación', 'La barrera energética que hay que superar para que la reacción ocurra.', 'aplicado', ['velocidad-reaccion'], { equations: ['arrhenius'] }),
  c('arrhenius', 'Ecuación de Arrhenius', 'La dependencia exponencial de la constante de velocidad con la temperatura.', 'aplicado', ['energia-activacion'], { equations: ['arrhenius'] }),
  c('catalisis', 'Catálisis', 'Un catalizador abre un camino de menor energía de activación sin desplazar el equilibrio.', 'aplicado', ['arrhenius', 'constante-equilibrio']),
  c('estado-estacionario', 'Estado estacionario', 'La aproximación de que la concentración de un intermedio reactivo permanece casi constante.', 'avanzado', ['ley-velocidad-integrada'], { competency: 'matematica' }),
  c('michaelis-menten', 'Michaelis–Menten', 'La cinética de saturación de una enzima, deducida del estado estacionario del complejo ES.', 'avanzado', ['estado-estacionario', 'catalisis']),

  // ---- measurement and analysis
  c('incertidumbre', 'Incertidumbre', 'El intervalo dentro del cual cabe razonablemente esperar que esté el valor verdadero.', 'fundamento', [], { competency: 'analisis' }),
  c('cifras-significativas', 'Cifras significativas', 'Los dígitos de un número que la medida realmente justifica.', 'fundamento', ['incertidumbre'], { competency: 'analisis' }),
  c('error-sistematico', 'Error sistemático', 'Un error que desplaza todas las medidas en el mismo sentido: afecta a la exactitud.', 'fundamento', ['incertidumbre'], { competency: 'analisis' }),
  c('error-aleatorio', 'Error aleatorio', 'La dispersión irreducible entre medidas repetidas: afecta a la precisión.', 'fundamento', ['incertidumbre'], { competency: 'analisis' }),
  c('exactitud', 'Exactitud', 'La cercanía de una medida al valor verdadero.', 'fundamento', ['error-sistematico'], { competency: 'analisis' }),
  c('precision', 'Precisión', 'La concordancia entre medidas repetidas, independientemente de su exactitud.', 'fundamento', ['error-aleatorio'], { competency: 'analisis' }),
  c('calibracion', 'Calibración', 'Establecer la relación entre la señal de un instrumento y la magnitud que mide.', 'aplicado', ['exactitud', 'precision'], { competency: 'instrumentos' }),
  c('lod', 'Límite de detección', 'La concentración mínima que puede distinguirse del blanco con confianza estadística.', 'aplicado', ['calibracion'], { competency: 'analisis' }),
  c('adicion-estandar', 'Adición estándar', 'Método de calibración que cancela el efecto de la matriz añadiendo cantidades conocidas de analito a la propia muestra.', 'avanzado', ['calibracion'], { competency: 'analisis' }),
  c('beer-lambert', 'Ley de Beer–Lambert', 'La absorbancia es proporcional a la concentración y al paso óptico.', 'aplicado', ['calibracion'], { equations: ['beer'], competency: 'instrumentos' }),
  c('valoracion', 'Valoración', 'Determinar una cantidad haciéndola reaccionar con un reactivo de concentración conocida.', 'nucleo', ['estequiometria'], { competency: 'laboratorio' }),
  c('curva-valoracion', 'Curva de valoración', 'El pH (o el potencial) representado frente al volumen de titrante añadido.', 'aplicado', ['valoracion', 'ph']),
  c('punto-equivalencia', 'Punto de equivalencia', 'El punto en que se han añadido cantidades estequiométricamente equivalentes.', 'aplicado', ['curva-valoracion']),
  c('indicador', 'Indicador', 'Una sustancia cuyo color cambia en un intervalo estrecho de pH.', 'aplicado', ['punto-equivalencia']),
  c('error-valoracion', 'Error de valoración', 'La diferencia entre el punto final observado y el punto de equivalencia real.', 'aplicado', ['indicador'], { competency: 'analisis' }),
  c('patron-primario', 'Patrón primario', 'Una sustancia lo bastante pura y estable para definir una concentración por pesada directa.', 'aplicado', ['valoracion'], { substances: ['khp', 'na2co3'], competency: 'laboratorio' }),
  c('gravimetria', 'Gravimetría', 'Determinar una cantidad pesando un producto de composición conocida.', 'aplicado', ['estequiometria'], { competency: 'laboratorio' }),

  c('cromatografia', 'Cromatografía', 'Separación por reparto repetido entre una fase móvil y una estacionaria.', 'aplicado', ['reparto'], { competency: 'instrumentos' }),
  c('reparto', 'Reparto', 'La distribución de un soluto entre dos fases inmiscibles en equilibrio.', 'aplicado', ['constante-equilibrio']),
  c('retencion', 'Retención', 'El tiempo que un compuesto tarda en atravesar la columna, fijado por su afinidad relativa.', 'aplicado', ['cromatografia']),
  c('resolucion-cromatografica', 'Resolución', 'La medida de cuán separados están dos picos consecutivos.', 'aplicado', ['retencion']),
  c('van-deemter', 'Ecuación de van Deemter', 'La relación entre la eficacia de la columna y el caudal, con su óptimo.', 'avanzado', ['resolucion-cromatografica']),

  c('espectroscopia', 'Espectroscopia', 'El estudio de la interacción entre la radiación y la materia.', 'nucleo', ['orbital'], { competency: 'instrumentos' }),
  c('vibracion-molecular', 'Vibración molecular', 'Los modos normales en que los enlaces de una molécula oscilan, y que absorben en el infrarrojo.', 'aplicado', ['espectroscopia', 'geometria-molecular']),
  c('desplazamiento-quimico', 'Desplazamiento químico', 'La posición de una señal de RMN, que depende del entorno electrónico del núcleo.', 'aplicado', ['espectroscopia']),
  c('multiplicidad', 'Multiplicidad', 'El desdoblamiento de una señal de RMN por acoplamiento con los núcleos vecinos.', 'aplicado', ['desplazamiento-quimico']),
  c('fragmentacion', 'Fragmentación', 'La rotura del ion molecular en el espectrómetro de masas, según patrones predecibles.', 'aplicado', ['espectroscopia']),
  c('patron-isotopico', 'Patrón isotópico', 'La distribución de intensidades que producen los isótopos naturales de los elementos presentes.', 'aplicado', ['isotopo', 'fragmentacion']),
  c('determinacion-estructural', 'Determinación estructural', 'Deducir una estructura combinando la información de varias técnicas espectroscópicas.', 'avanzado', ['vibracion-molecular', 'multiplicidad', 'fragmentacion'], { competency: 'analisis' }),

  c('pca', 'Análisis de componentes principales', 'La rotación de los ejes que concentra la varianza en unas pocas direcciones.', 'avanzado', ['calibracion'], { competency: 'analisis' }),
  c('diseno-factorial', 'Diseño factorial', 'Un experimento que varía todos los factores a la vez para detectar también sus interacciones.', 'avanzado', ['error-aleatorio'], { competency: 'investigacion' }),
  c('hipotesis', 'Hipótesis', 'Una afirmación contrastable que predice un resultado observable.', 'fundamento', [], { competency: 'investigacion' }),
  c('control-experimental', 'Control experimental', 'La condición de referencia que permite atribuir el efecto observado a la variable estudiada.', 'aplicado', ['hipotesis'], { competency: 'investigacion' }),
  c('reproducibilidad', 'Reproducibilidad', 'La propiedad de un resultado de volver a obtenerse en otras manos y otro laboratorio.', 'aplicado', ['control-experimental'], { competency: 'investigacion' }),
  c('procedencia-dato', 'Procedencia del dato', 'La distinción entre un valor teórico, uno simulado, uno medido y uno estimado.', 'fundamento', ['incertidumbre'], { competency: 'analisis' }),

  c('quimica-verde', 'Química verde', 'Diseñar procesos que reduzcan el uso y la generación de sustancias peligrosas.', 'aplicado', ['economia-atomica']),
  c('dureza', 'Dureza del agua', 'El contenido total de calcio y magnesio disueltos.', 'aplicado', ['constante-formacion'], { substances: ['cacl2', 'mgso4', 'edta'] }),
  c('alcalinidad', 'Alcalinidad', 'La capacidad de un agua para neutralizar ácido, definida operativamente por valoración.', 'aplicado', ['poliprotico'], { substances: ['nahco3', 'na2co3'] }),
  c('sistema-carbonato', 'Sistema carbonato', 'El equilibrio CO₂–HCO₃⁻–CO₃²⁻ que tampona las aguas naturales.', 'aplicado', ['alcalinidad', 'especiacion']),
];

const BY_ID = new Map(CONCEPTS.map((x) => [x.id, x]));
export const conceptById = (id: string): Concept | undefined => BY_ID.get(id);

/** Concepts that depend on this one. */
export const conceptDependents = (id: string): Concept[] =>
  CONCEPTS.filter((x) => x.dependsOn.includes(id));

/**
 * The full prerequisite closure of a concept, deepest first.
 * This is what lets the tutor answer "what do I need before this?" concretely.
 */
export function prerequisiteChain(id: string): Concept[] {
  const out: Concept[] = [];
  const seen = new Set<string>();
  const visit = (cid: string): void => {
    if (seen.has(cid)) return;
    seen.add(cid);
    const concept = BY_ID.get(cid);
    if (!concept) return;
    for (const dep of concept.dependsOn) visit(dep);
    if (cid !== id) out.push(concept);
  };
  visit(id);
  return out;
}

export const TIER_LABEL: Record<ConceptTier, string> = {
  fundamento: 'Fundamento',
  nucleo: 'Núcleo',
  aplicado: 'Aplicado',
  avanzado: 'Avanzado',
};

export const TIER_ORDER: ConceptTier[] = ['fundamento', 'nucleo', 'aplicado', 'avanzado'];
