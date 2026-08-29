/**
 * Instrumentation.
 *
 * §31 requires every instrument to declare its physical principle, components,
 * controls, calibration, range, resolution, precision, noise, drift,
 * maintenance, characteristic errors and the data it produces. §33 requires
 * that it never produce ideal data. This file is the declaration; `lab/measure`
 * is the model that turns it into a reading.
 *
 * The numbers are those of real teaching-laboratory instruments: an analytical
 * balance that reads to 0.1 mg with ±0.2 mg repeatability, a pH electrode with
 * a 59.16 mV/decade ideal slope that degrades with age, a UV-Vis with 0.001 AU
 * of photometric noise. A student who learns these figures here recognises them
 * on a real instrument's specification sheet.
 */

export type InstrumentCategory =
  | 'pesada' | 'electroquimica' | 'espectroscopia' | 'separacion'
  | 'termica' | 'mecanica' | 'volumetria';

export const CATEGORY_LABEL: Record<InstrumentCategory, string> = {
  pesada: 'Pesada',
  electroquimica: 'Electroquímica',
  espectroscopia: 'Espectroscopia',
  separacion: 'Separación',
  termica: 'Tratamiento térmico',
  mecanica: 'Operaciones mecánicas',
  volumetria: 'Volumetría',
};

export interface InstrumentComponent {
  name: string;
  role: string;
}

export interface InstrumentControl {
  id: string;
  label: string;
  kind: 'numero' | 'seleccion' | 'boton' | 'interruptor';
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  default?: number | string | boolean;
  description: string;
}

export interface CalibrationStep {
  id: string;
  title: string;
  detail: string;
  /** What the student must supply: a standard, a blank, a wait. */
  requires?: { kind: 'patron' | 'blanco' | 'espera' | 'ajuste'; value?: string | number };
  /** How long the step takes in the simulation, seconds. */
  seconds?: number;
}

export interface ErrorSource {
  name: string;
  /** What it does to the result. */
  effect: string;
  /** How to recognise it. */
  symptom: string;
  /** How to avoid or correct it. */
  remedy: string;
  kind: 'sistematico' | 'aleatorio' | 'humano' | 'deriva';
}

export interface Instrument {
  id: string;
  name: string;
  synonyms: string[];
  category: InstrumentCategory;
  /** The physical principle, in one sentence a student can repeat. */
  principle: string;
  /** A fuller explanation of how it works. */
  howItWorks: string;
  components: InstrumentComponent[];
  controls: InstrumentControl[];
  /** Measurement range, in the instrument's own unit. */
  range: [number, number];
  unit: string;
  /** Smallest displayed increment. */
  resolution: number;
  /** Repeatability, 1σ, in the instrument's unit. */
  precision: number;
  /** Random noise, 1σ, added to every reading. */
  noise: number;
  /** Drift per hour since the last calibration, in the instrument's unit. */
  driftPerHour: number;
  /** Time to a stable reading, seconds. */
  settlingTime: number;
  /** Calibration is required before the instrument gives valid results. */
  requiresCalibration: boolean;
  /** How long a calibration remains valid, hours. */
  calibrationValidHours: number;
  calibrationSteps: CalibrationStep[];
  errorSources: ErrorSource[];
  maintenance: string[];
  /** What the instrument outputs: a scalar, a spectrum, a chromatogram. */
  output: 'escalar' | 'espectro' | 'cromatograma' | 'voltamperograma' | 'serie-temporal';
  /** Consumable cost per determination, arbitrary currency units — the research
   *  mode's budget constraint (§56) needs it. */
  costPerRun?: number;
  courses?: string[];
}

export const INSTRUMENTS: Instrument[] = [
  {
    id: 'balanza',
    name: 'Balanza analítica',
    synonyms: ['balanza', 'balanza de precisión', 'pesada'],
    category: 'pesada',
    principle: 'Compensa la fuerza gravitatoria sobre la muestra con una fuerza electromagnética, y mide la corriente necesaria.',
    howItWorks:
      'La muestra desplaza un brazo unido a una bobina situada en un campo magnético permanente. '
      + 'Un servomecanismo hace pasar por la bobina la corriente exacta que devuelve el brazo a su posición: '
      + 'esa corriente es proporcional a la masa. Por eso una balanza analítica mide fuerza, no masa, '
      + 'y hay que recalibrarla si se traslada a un lugar con distinta gravedad.',
    components: [
      { name: 'Celda electromagnética', role: 'Genera la fuerza de compensación.' },
      { name: 'Detector de posición', role: 'Cierra el lazo de realimentación del servo.' },
      { name: 'Cámara de pesada', role: 'Aísla de corrientes de aire; hay que cerrarla antes de leer.' },
      { name: 'Nivel de burbuja y patas ajustables', role: 'Garantizan que la fuerza medida sea vertical.' },
      { name: 'Sensor de temperatura', role: 'Compensa la deriva térmica de la celda.' },
    ],
    controls: [
      { id: 'tara', label: 'Tara', kind: 'boton', description: 'Pone a cero con el recipiente colocado.' },
      { id: 'calibrar', label: 'Calibración interna', kind: 'boton', description: 'Aplica la masa patrón interna.' },
      { id: 'puerta', label: 'Puerta de la cámara', kind: 'interruptor', default: false, description: 'Debe estar cerrada para leer.' },
    ],
    range: [0, 220],
    unit: 'g',
    resolution: 0.0001,
    precision: 0.0002,
    noise: 0.00008,
    driftPerHour: 0.00015,
    settlingTime: 4,
    requiresCalibration: true,
    calibrationValidHours: 24,
    calibrationSteps: [
      { id: 'nivel', title: 'Nivelar la balanza', detail: 'Centrar la burbuja con las patas ajustables. Una balanza inclinada mide una componente de la fuerza y da resultados bajos de forma sistemática.', seconds: 20 },
      { id: 'estabilizar', title: 'Esperar la estabilización térmica', detail: 'Al menos 30 min encendida. La celda deriva mientras alcanza el equilibrio térmico.', requires: { kind: 'espera', value: 30 }, seconds: 15 },
      { id: 'cero', title: 'Poner a cero con el plato vacío', detail: 'Con la cámara cerrada.', seconds: 8 },
      { id: 'patron', title: 'Colocar la masa patrón de 200 g', detail: 'Clase E2 certificada. Con pinzas: la huella dactilar pesa del orden de 0.1 mg.', requires: { kind: 'patron', value: 200 }, seconds: 12 },
      { id: 'ajuste', title: 'Aceptar el ajuste de span', detail: 'La balanza corrige su factor de escala.', requires: { kind: 'ajuste' }, seconds: 6 },
      { id: 'verificar', title: 'Verificar con una masa intermedia', detail: 'Comprobar con 50 g que la respuesta es lineal en todo el intervalo.', requires: { kind: 'patron', value: 50 }, seconds: 10 },
    ],
    errorSources: [
      { name: 'Corrientes de aire', kind: 'aleatorio', effect: 'La lectura oscila y no se estabiliza.', symptom: 'El último dígito no se fija; el indicador de estabilidad no se enciende.', remedy: 'Cerrar la cámara de pesada y esperar.' },
      { name: 'Electricidad estática', kind: 'sistematico', effect: 'Desvía la lectura hasta varios miligramos, en cualquier sentido.', symptom: 'Deriva lenta y monótona; sucede con plásticos y polvos secos.', remedy: 'Usar recipiente metálico o de vidrio, ionizador, o aumentar la humedad ambiente.' },
      { name: 'Muestra higroscópica', kind: 'deriva', effect: 'La masa aumenta continuamente al captar humedad.', symptom: 'La lectura sube de forma sostenida en lugar de estabilizarse.', remedy: 'Pesar en recipiente cerrado y por diferencia, lo más rápido posible.' },
      { name: 'Muestra fuera de temperatura', kind: 'sistematico', effect: 'Una muestra caliente genera una corriente convectiva que la hace pesar menos.', symptom: 'Lectura baja que aumenta al enfriarse.', remedy: 'Enfriar en desecador hasta temperatura ambiente antes de pesar.' },
      { name: 'Empuje del aire', kind: 'sistematico', effect: 'Hasta 0.1 % en sustancias de baja densidad.', symptom: 'Discrepancia sistemática frente a un valor certificado.', remedy: 'Aplicar la corrección por empuje en trabajos de máxima exactitud.' },
    ],
    maintenance: [
      'Limpiar el plato y la cámara antes de cada sesión.',
      'Calibración interna diaria; verificación externa con masas certificadas cada semana.',
      'Nunca pesar directamente sobre el plato: usar vidrio de reloj o navecilla.',
    ],
    output: 'escalar',
    costPerRun: 0,
    courses: ['qg1', 'qan1'],
  },

  {
    id: 'phmetro',
    name: 'pH-metro',
    synonyms: ['ph-metro', 'phmetro', 'potenciómetro', 'electrodo de vidrio'],
    category: 'electroquimica',
    principle: 'Mide la diferencia de potencial que aparece a través de una membrana de vidrio sensible a los protones, que sigue la ecuación de Nernst.',
    howItWorks:
      'La membrana de vidrio desarrolla un potencial proporcional a la diferencia de actividad de H⁺ entre '
      + 'sus dos caras. Como la cara interna está a actividad fija, el potencial mide la actividad externa. '
      + 'A 25 °C la pendiente ideal es 59.16 mV por unidad de pH, y una pendiente medida por debajo del 95 % '
      + 'de ese valor indica un electrodo agotado. El pH-metro no mide concentración: mide actividad, '
      + 'que es por lo que un pH medido y uno calculado sin corrección de actividad no coinciden.',
    components: [
      { name: 'Electrodo de vidrio', role: 'Membrana sensible a H⁺; genera el potencial que se mide.' },
      { name: 'Electrodo de referencia Ag/AgCl', role: 'Potencial fijo contra el que se compara.' },
      { name: 'Unión líquida', role: 'Cierra el circuito; es la fuente del potencial de unión.' },
      { name: 'Sonda de temperatura', role: 'Compensa la pendiente de Nernst, que es proporcional a T.' },
      { name: 'Amplificador de alta impedancia', role: 'Mide sin drenar corriente de una celda de 100 MΩ.' },
    ],
    controls: [
      { id: 'temperatura', label: 'Temperatura', kind: 'numero', unit: 'degC', min: 0, max: 100, step: 0.1, default: 25, description: 'Compensación automática o manual.' },
      { id: 'modo', label: 'Modo', kind: 'seleccion', default: 'ph', options: [{ value: 'ph', label: 'pH' }, { value: 'mv', label: 'mV' }], description: 'Lectura directa en pH o el potencial en bruto.' },
      { id: 'agitacion', label: 'Agitación', kind: 'interruptor', default: true, description: 'Acelera la estabilización, pero un agitador magnético puede introducir ruido.' },
    ],
    range: [0, 14],
    unit: '',
    resolution: 0.01,
    precision: 0.02,
    noise: 0.006,
    driftPerHour: 0.012,
    settlingTime: 25,
    requiresCalibration: true,
    calibrationValidHours: 8,
    calibrationSteps: [
      { id: 'lavar', title: 'Lavar el electrodo con agua destilada', detail: 'Secar por contacto con papel, sin frotar: frotar carga el vidrio electrostáticamente.', seconds: 10 },
      { id: 'buffer7', title: 'Sumergir en el tampón de pH 7.00', detail: 'Es el punto de cero: fija el desplazamiento del electrodo.', requires: { kind: 'patron', value: 7.00 }, seconds: 15 },
      { id: 'estabilizar7', title: 'Esperar la estabilización', detail: 'Hasta que la lectura no varíe más de 0.01 en 10 s.', requires: { kind: 'espera', value: 25 }, seconds: 25 },
      { id: 'aceptar7', title: 'Aceptar el primer punto', detail: 'El instrumento registra el potencial a pH 7.', requires: { kind: 'ajuste' }, seconds: 4 },
      { id: 'lavar2', title: 'Lavar de nuevo', detail: 'Arrastrar el tampón anterior evita la contaminación cruzada entre patrones.', seconds: 10 },
      { id: 'buffer4', title: 'Sumergir en el tampón de pH 4.01', detail: 'El segundo punto define la pendiente. Elegirlo del mismo lado que las muestras reduce el error.', requires: { kind: 'patron', value: 4.01 }, seconds: 15 },
      { id: 'estabilizar4', title: 'Esperar la estabilización', detail: 'La respuesta es más lenta en disolución poco tamponada.', requires: { kind: 'espera', value: 25 }, seconds: 25 },
      { id: 'pendiente', title: 'Calcular y validar la pendiente', detail: 'Debe quedar entre el 95 % y el 102 % de 59.16 mV/pH. Fuera de ese intervalo, el electrodo debe regenerarse o sustituirse.', requires: { kind: 'ajuste' }, seconds: 6 },
    ],
    errorSources: [
      { name: 'Calibración con un solo punto', kind: 'sistematico', effect: 'Corrige el desplazamiento pero no la pendiente: el error crece al alejarse del punto calibrado.', symptom: 'Buen acuerdo cerca de pH 7 y desviación creciente hacia los extremos.', remedy: 'Calibrar siempre con dos puntos que abarquen el intervalo de trabajo.' },
      { name: 'Error alcalino', kind: 'sistematico', effect: 'Por encima de pH 12 el vidrio responde también al sodio y el pH leído es menor que el real.', symptom: 'Lecturas bajas en disoluciones muy alcalinas de sodio.', remedy: 'Usar un electrodo de vidrio de litio, o corregir según la curva del fabricante.' },
      { name: 'Error ácido', kind: 'sistematico', effect: 'Por debajo de pH 1 la actividad del agua deja de ser unitaria y el pH leído es mayor que el real.', symptom: 'Lecturas altas en ácidos muy concentrados.', remedy: 'Diluir, o trabajar en unidades de acidez de Hammett.' },
      { name: 'Unión líquida obstruida', kind: 'deriva', effect: 'El potencial de unión se vuelve inestable y dependiente de la muestra.', symptom: 'Respuesta lentísima, lecturas que nunca terminan de estabilizarse.', remedy: 'Limpiar el diafragma y renovar el electrolito de referencia.' },
      { name: 'Electrodo seco', kind: 'sistematico', effect: 'La capa de gel hidratada del vidrio se deshidrata y el electrodo pierde sensibilidad.', symptom: 'Pendiente por debajo del 90 %.', remedy: 'Rehidratar 24 h en KCl 3 M. Guardar siempre en disolución, nunca en agua destilada.' },
      { name: 'Descompensación de temperatura', kind: 'sistematico', effect: 'La pendiente de Nernst cambia 0.2 mV/pH por grado.', symptom: 'El pH medido varía al cambiar la temperatura de la muestra.', remedy: 'Usar compensación automática y calibrar a la temperatura de trabajo.' },
    ],
    maintenance: [
      'Guardar en KCl 3 M saturado con AgCl; nunca en agua destilada.',
      'Comprobar la pendiente al inicio de cada sesión.',
      'Limpiar con pepsina/HCl si se ha usado con proteínas, con tiourea si con sulfuros.',
    ],
    output: 'escalar',
    costPerRun: 0.5,
    courses: ['qg1', 'qan1', 'qan2', 'qan3', 'hidro'],
  },

  {
    id: 'conductimetro',
    name: 'Conductímetro',
    synonyms: ['conductímetro', 'conductividad', 'célula de conductividad'],
    category: 'electroquimica',
    principle: 'Mide la resistencia de la disolución entre dos electrodos con corriente alterna, y la convierte en conductividad mediante la constante de célula.',
    howItWorks:
      'Se aplica corriente alterna (para no electrolizar ni polarizar los electrodos) y se mide la '
      + 'resistencia. La conductividad κ es la constante de célula dividida por esa resistencia. '
      + 'Como la conductividad depende de todos los iones presentes, es una medida no selectiva: '
      + 'excelente para seguir una valoración o vigilar la pureza del agua, inútil para identificar una especie.',
    components: [
      { name: 'Célula de dos o cuatro electrodos', role: 'Define el volumen de disolución medido.' },
      { name: 'Generador de corriente alterna', role: 'Evita la polarización de los electrodos.' },
      { name: 'Sonda de temperatura', role: 'La conductividad cambia ~2 % por grado.' },
    ],
    controls: [
      { id: 'constante', label: 'Constante de célula', kind: 'numero', unit: '', min: 0.01, max: 10, step: 0.001, default: 1.0, description: 'Se determina con un patrón de KCl.' },
      { id: 'temperatura', label: 'Temperatura', kind: 'numero', unit: 'degC', min: 0, max: 100, step: 0.1, default: 25, description: 'Referencia de compensación.' },
      { id: 'compensacion', label: 'Compensación térmica', kind: 'interruptor', default: true, description: 'Corrige a 25 °C con un coeficiente del 2 %/°C.' },
    ],
    range: [0.05, 200000],
    unit: 'uS/cm',
    resolution: 0.01,
    precision: 0.005,
    noise: 0.003,
    driftPerHour: 0.002,
    settlingTime: 10,
    requiresCalibration: true,
    calibrationValidHours: 168,
    calibrationSteps: [
      { id: 'lavar', title: 'Enjuagar la célula con la disolución patrón', detail: 'El agua residual diluye el patrón y da una constante de célula baja.', seconds: 10 },
      { id: 'kcl', title: 'Medir el patrón de KCl 0.01 M', detail: 'Su conductividad certificada es 1413 µS·cm⁻¹ a 25 °C.', requires: { kind: 'patron', value: 1413 }, seconds: 20 },
      { id: 'constante', title: 'Calcular la constante de célula', detail: 'K = κ_patrón × R_medida. Debe coincidir con la nominal en un ±10 %.', requires: { kind: 'ajuste' }, seconds: 5 },
    ],
    errorSources: [
      { name: 'Burbujas en la célula', kind: 'aleatorio', effect: 'Reducen el área efectiva y elevan la resistencia.', symptom: 'Lecturas erráticamente bajas.', remedy: 'Golpear suavemente la célula al sumergirla.' },
      { name: 'Electrodos contaminados', kind: 'sistematico', effect: 'Alteran la constante de célula real.', symptom: 'Deriva progresiva frente al patrón.', remedy: 'Limpiar con ácido nítrico diluido y recalibrar.' },
      { name: 'CO₂ atmosférico', kind: 'sistematico', effect: 'Aporta unos 1.0 µS·cm⁻¹ al agua pura.', symptom: 'El agua ultrapura nunca baja de ~1 µS·cm⁻¹ al aire.', remedy: 'Medir en celda cerrada o bajo nitrógeno.' },
    ],
    maintenance: ['Guardar la célula húmeda.', 'Recalibrar la constante mensualmente o tras cualquier limpieza agresiva.'],
    output: 'escalar',
    costPerRun: 0.3,
    courses: ['qan2', 'electro1', 'hidro'],
  },

  {
    id: 'espectrofotometro',
    name: 'Espectrofotómetro UV-Vis',
    synonyms: ['espectrofotómetro', 'uv-vis', 'absorbancia', 'colorímetro'],
    category: 'espectroscopia',
    principle: 'Compara la intensidad de luz que atraviesa la muestra con la que atraviesa el blanco, y expresa el resultado como absorbancia.',
    howItWorks:
      'Una lámpara de deuterio (ultravioleta) o de tungsteno (visible) ilumina un monocromador que '
      + 'selecciona una banda estrecha de longitudes de onda. El haz atraviesa la cubeta y llega a un '
      + 'detector. La absorbancia A = −log(I/I₀) es proporcional a la concentración por la ley de '
      + 'Beer-Lambert, pero sólo mientras la disolución sea diluida, monocromática la luz y no haya '
      + 'asociación química: por eso la linealidad se pierde por encima de A ≈ 1.5.',
    components: [
      { name: 'Lámpara de deuterio', role: 'Fuente continua de 190 a 400 nm.' },
      { name: 'Lámpara de tungsteno-halógeno', role: 'Fuente continua de 350 a 1100 nm.' },
      { name: 'Monocromador de red', role: 'Selecciona la longitud de onda; su anchura de banda limita la resolución.' },
      { name: 'Portacubetas', role: 'Define el paso óptico, normalmente 1.000 cm.' },
      { name: 'Fotodiodo o fotomultiplicador', role: 'Convierte la intensidad luminosa en corriente.' },
    ],
    controls: [
      { id: 'longitud', label: 'Longitud de onda', kind: 'numero', unit: 'nm', min: 190, max: 1100, step: 1, default: 500, description: 'Elegir el máximo de absorción para máxima sensibilidad y mínima sensibilidad al error de λ.' },
      { id: 'anchura', label: 'Anchura de banda espectral', kind: 'numero', unit: 'nm', min: 0.5, max: 5, step: 0.5, default: 2, description: 'Más estrecha da mejor resolución y peor relación señal/ruido.' },
      { id: 'paso', label: 'Paso óptico', kind: 'numero', unit: 'cm', min: 0.1, max: 10, step: 0.1, default: 1, description: 'La b de la ley de Beer.' },
      { id: 'blanco', label: 'Ajustar el blanco', kind: 'boton', description: 'Define I₀. Debe hacerse con el mismo disolvente y la misma cubeta.' },
    ],
    range: [0, 3],
    unit: 'AU',
    resolution: 0.001,
    precision: 0.003,
    noise: 0.0012,
    driftPerHour: 0.004,
    settlingTime: 3,
    requiresCalibration: true,
    calibrationValidHours: 4,
    calibrationSteps: [
      { id: 'calentar', title: 'Encender y estabilizar las lámparas', detail: 'La de deuterio necesita 20 min para estabilizar su intensidad.', requires: { kind: 'espera', value: 20 }, seconds: 15 },
      { id: 'longitud', title: 'Seleccionar la longitud de onda de trabajo', detail: 'Registrar primero un barrido y elegir el λ máximo: allí la pendiente dA/dλ es nula y un pequeño error de longitud de onda no afecta.', seconds: 20 },
      { id: 'blanco', title: 'Ajustar el cero con el blanco', detail: 'El blanco debe contener todo menos el analito, en la misma cubeta y con la misma cara hacia el haz.', requires: { kind: 'blanco' }, seconds: 12 },
      { id: 'patrones', title: 'Medir la serie de patrones', detail: 'Al menos cinco niveles, del más diluido al más concentrado para minimizar el arrastre.', requires: { kind: 'patron' }, seconds: 40 },
      { id: 'recta', title: 'Ajustar la recta de calibración', detail: 'Comprobar r² > 0.995 y examinar los residuales: una curvatura sistemática indica desviación de Beer.', requires: { kind: 'ajuste' }, seconds: 10 },
    ],
    errorSources: [
      { name: 'Cubetas mal emparejadas', kind: 'sistematico', effect: 'Introduce un desplazamiento constante de absorbancia.', symptom: 'Ordenada en el origen distinta de cero con el blanco.', remedy: 'Usar cubetas emparejadas y siempre en la misma orientación.' },
      { name: 'Huellas y arañazos en la cubeta', kind: 'aleatorio', effect: 'Dispersan luz y elevan la absorbancia aparente.', symptom: 'Resultados altos e irreproducibles.', remedy: 'Manipular por las caras esmeriladas y limpiar con papel de óptica.' },
      { name: 'Absorbancia fuera del intervalo óptimo', kind: 'aleatorio', effect: 'El error relativo en concentración es mínimo cerca de A = 0.4 y crece mucho fuera de 0.1–1.0.', symptom: 'Precisión pobre en muestras muy diluidas o muy concentradas.', remedy: 'Diluir o concentrar hasta el intervalo óptimo.' },
      { name: 'Luz parásita', kind: 'sistematico', effect: 'Limita la absorbancia máxima medible y curva la calibración hacia abajo.', symptom: 'La recta se aplana por encima de A ≈ 2.', remedy: 'Trabajar por debajo de A = 1.5 y verificar con un filtro de corte.' },
      { name: 'Burbujas o partículas en suspensión', kind: 'aleatorio', effect: 'Dispersión de Tyndall que se suma a la absorbancia.', symptom: 'Absorbancia elevada también fuera de la banda del analito.', remedy: 'Filtrar o centrifugar la muestra; desgasificar.' },
    ],
    maintenance: [
      'Registrar las horas de lámpara; la de deuterio dura unas 1000 h.',
      'Verificar la exactitud de longitud de onda con el filtro de holmio.',
      'Comprobar la luz parásita con disolución de NaI o NaNO₂.',
    ],
    output: 'espectro',
    costPerRun: 2,
    courses: ['qan3', 'optica', 'hidro', 'qamb'],
  },

  {
    id: 'ftir',
    name: 'Espectrómetro FTIR',
    synonyms: ['ftir', 'infrarrojo', 'ir'],
    category: 'espectroscopia',
    principle: 'Mide la absorción de radiación infrarroja por los modos normales de vibración que cambian el momento dipolar de la molécula.',
    howItWorks:
      'Un interferómetro de Michelson genera un interferograma que contiene todas las frecuencias a la vez; '
      + 'la transformada de Fourier lo convierte en espectro. Esa multiplexación es lo que le da su ventaja '
      + 'en relación señal/ruido frente a un instrumento dispersivo. Sólo absorben los modos que modifican '
      + 'el momento dipolar: por eso el N₂ y el O₂ son transparentes en el infrarrojo, y el CO₂ no.',
    components: [
      { name: 'Fuente de Globar', role: 'Emisor térmico de infrarrojo medio.' },
      { name: 'Interferómetro de Michelson', role: 'Modula todas las frecuencias simultáneamente.' },
      { name: 'Láser de He-Ne', role: 'Referencia de posición del espejo móvil; fija la exactitud del eje de números de onda.' },
      { name: 'Detector DTGS o MCT', role: 'Convierte la radiación en señal eléctrica.' },
      { name: 'Accesorio ATR de diamante', role: 'Permite medir sólidos y líquidos sin preparación.' },
    ],
    controls: [
      { id: 'resolucion', label: 'Resolución', kind: 'seleccion', default: '4', options: [{ value: '1', label: '1 cm⁻¹' }, { value: '2', label: '2 cm⁻¹' }, { value: '4', label: '4 cm⁻¹' }, { value: '8', label: '8 cm⁻¹' }], description: 'Mayor resolución exige más tiempo para la misma relación señal/ruido.' },
      { id: 'barridos', label: 'Número de barridos', kind: 'numero', min: 1, max: 256, step: 1, default: 16, description: 'La relación señal/ruido mejora como la raíz del número de barridos.' },
      { id: 'fondo', label: 'Registrar el fondo', kind: 'boton', description: 'Con el accesorio limpio, para descontar el aire y el propio instrumento.' },
    ],
    range: [400, 4000],
    unit: 'cm-1',
    resolution: 4,
    precision: 0.01,
    noise: 0.0015,
    driftPerHour: 0.001,
    settlingTime: 30,
    requiresCalibration: true,
    calibrationValidHours: 8,
    calibrationSteps: [
      { id: 'purga', title: 'Purgar el compartimento', detail: 'El vapor de agua y el CO₂ del aire absorben con fuerza; sin purga sus bandas contaminan el espectro.', requires: { kind: 'espera', value: 10 }, seconds: 15 },
      { id: 'limpiar', title: 'Limpiar el cristal ATR', detail: 'Con isopropanol y papel de óptica; cualquier residuo aparece en todos los espectros siguientes.', seconds: 15 },
      { id: 'fondo', title: 'Registrar el espectro de fondo', detail: 'Con el cristal limpio y en las mismas condiciones que la muestra.', requires: { kind: 'blanco' }, seconds: 25 },
      { id: 'poliestireno', title: 'Verificar con la película de poliestireno', detail: 'Sus bandas a 3027, 1601 y 906 cm⁻¹ comprueban la exactitud del eje.', requires: { kind: 'patron' }, seconds: 20 },
    ],
    errorSources: [
      { name: 'Vapor de agua sin purgar', kind: 'sistematico', effect: 'Bandas finas y ruidosas entre 3900–3500 y 1800–1400 cm⁻¹.', symptom: 'Estructura fina superpuesta al espectro.', remedy: 'Purgar con nitrógeno seco y volver a tomar el fondo.' },
      { name: 'Contacto insuficiente en ATR', kind: 'sistematico', effect: 'Bandas débiles en un sólido.', symptom: 'Espectro correcto en forma pero de intensidad muy baja.', remedy: 'Aumentar la presión del yunque hasta contacto óptico.' },
      { name: 'Muestra demasiado gruesa', kind: 'sistematico', effect: 'Las bandas intensas saturan y se deforman.', symptom: 'Bandas con la cima plana.', remedy: 'Reducir el espesor o diluir en KBr.' },
    ],
    maintenance: ['Vigilar el desecante del compartimento.', 'Verificar el eje con poliestireno cada semana.'],
    output: 'espectro',
    costPerRun: 3,
    courses: ['qorg3', 'polimeros', 'fito1'],
  },

  {
    id: 'hplc',
    name: 'Cromatógrafo de líquidos (HPLC)',
    synonyms: ['hplc', 'cromatógrafo de líquidos', 'cromatografía líquida'],
    category: 'separacion',
    principle: 'Separa los componentes de una mezcla por su reparto entre una fase estacionaria empaquetada y una fase móvil líquida bombeada a alta presión.',
    howItWorks:
      'Una bomba impulsa la fase móvil a través de una columna rellena de partículas de sílice modificada. '
      + 'Cada soluto se reparte continuamente entre las dos fases; cuanto mayor sea su afinidad por la '
      + 'estacionaria, más tarda en salir. La eficacia de la separación la describe la ecuación de van '
      + 'Deemter, que tiene un mínimo: por encima y por debajo del caudal óptimo, los picos se ensanchan.',
    components: [
      { name: 'Bomba cuaternaria', role: 'Entrega la fase móvil a caudal constante hasta 400 bar.' },
      { name: 'Desgasificador', role: 'Elimina el aire disuelto, que formaría burbujas en el detector.' },
      { name: 'Inyector automático', role: 'Introduce un volumen exacto y reproducible de muestra.' },
      { name: 'Columna C18', role: 'Fase estacionaria apolar: los compuestos apolares se retienen más.' },
      { name: 'Horno de columna', role: 'La temperatura afecta a la viscosidad y a la retención.' },
      { name: 'Detector de red de diodos', role: 'Registra el espectro completo de cada pico.' },
    ],
    controls: [
      { id: 'caudal', label: 'Caudal', kind: 'numero', unit: 'mL/min', min: 0.1, max: 3, step: 0.05, default: 1.0, description: 'El óptimo de van Deemter para una columna de 5 µm está cerca de 1 mL/min.' },
      { id: 'organico', label: 'Fase móvil (% orgánico)', kind: 'numero', unit: '', min: 0, max: 100, step: 1, default: 50, description: 'Más orgánico eluye antes; el logaritmo de la retención cae linealmente con él.' },
      { id: 'temperatura', label: 'Temperatura de columna', kind: 'numero', unit: 'degC', min: 20, max: 60, step: 1, default: 30, description: 'Mejora la eficacia y reduce la presión.' },
      { id: 'longitud', label: 'Longitud de onda del detector', kind: 'numero', unit: 'nm', min: 190, max: 800, step: 1, default: 254, description: 'Elegir donde el analito absorba y la fase móvil no.' },
      { id: 'gradiente', label: 'Elución en gradiente', kind: 'interruptor', default: false, description: 'Aumenta el porcentaje orgánico durante la separación: resuelve el problema del pico general.' },
    ],
    range: [0, 60],
    unit: 'min',
    resolution: 0.001,
    precision: 0.005,
    noise: 0.0008,
    driftPerHour: 0.003,
    settlingTime: 600,
    requiresCalibration: true,
    calibrationValidHours: 24,
    calibrationSteps: [
      { id: 'equilibrar', title: 'Equilibrar la columna', detail: 'Al menos 10 volúmenes de columna con la fase móvil final. Sin equilibrar, los tiempos de retención derivan durante toda la secuencia.', requires: { kind: 'espera', value: 15 }, seconds: 30 },
      { id: 'linea-base', title: 'Verificar la línea base', detail: 'Debe ser plana y con ruido inferior al 1 % de la señal esperada.', seconds: 20 },
      { id: 'blanco', title: 'Inyectar el blanco de disolvente', detail: 'Detecta arrastres del análisis anterior.', requires: { kind: 'blanco' }, seconds: 30 },
      { id: 'idoneidad', title: 'Ensayo de idoneidad del sistema', detail: 'Seis inyecciones del patrón: RSD del área < 2 %, factor de asimetría < 2, N > 2000 platos.', requires: { kind: 'patron' }, seconds: 60 },
      { id: 'calibracion', title: 'Construir la curva de calibración', detail: 'Con patrón interno si la inyección no es suficientemente reproducible.', requires: { kind: 'ajuste' }, seconds: 40 },
    ],
    errorSources: [
      { name: 'Columna no equilibrada', kind: 'deriva', effect: 'Los tiempos de retención se desplazan a lo largo de la secuencia.', symptom: 'La primera inyección difiere de las siguientes.', remedy: 'Equilibrar más tiempo e incluir inyecciones de acondicionamiento.' },
      { name: 'Burbuja en la bomba', kind: 'aleatorio', effect: 'Caudal irregular, áreas erráticas.', symptom: 'Presión oscilante y línea base ruidosa.', remedy: 'Purgar la bomba y verificar el desgasificador.' },
      { name: 'Sobrecarga de columna', kind: 'sistematico', effect: 'Los picos se deforman con cola frontal y la retención disminuye.', symptom: 'Asimetría creciente con la concentración.', remedy: 'Reducir la masa inyectada.' },
      { name: 'Efecto de disolvente de inyección', kind: 'sistematico', effect: 'Un disolvente de muestra más fuerte que la fase móvil deforma los primeros picos.', symptom: 'Picos desdoblados o con hombro sólo al principio del cromatograma.', remedy: 'Disolver la muestra en la fase móvil inicial.' },
      { name: 'Arrastre entre inyecciones', kind: 'sistematico', effect: 'Aparece señal del analito en el blanco siguiente.', symptom: 'Pico pequeño al tiempo de retención del analito en un blanco.', remedy: 'Aumentar el lavado de la aguja; revisar el sello del inyector.' },
    ],
    maintenance: [
      'Filtrar y desgasificar toda fase móvil; nunca dejar tampón en la columna.',
      'Lavar con agua y luego con metanol antes de guardar.',
      'Registrar la presión de trabajo: su aumento anuncia el bloqueo del filtro de entrada.',
    ],
    output: 'cromatograma',
    costPerRun: 12,
    courses: ['qan4', 'fito1', 'fito2', 'polimeros'],
  },

  {
    id: 'gc',
    name: 'Cromatógrafo de gases',
    synonyms: ['gc', 'cromatógrafo de gases', 'cromatografía gaseosa'],
    category: 'separacion',
    principle: 'Separa compuestos volátiles por su reparto entre un gas portador y una fase estacionaria líquida sobre la pared de una columna capilar.',
    howItWorks:
      'La muestra se vaporiza en el inyector y el gas portador la arrastra por una columna capilar cuya '
      + 'pared está recubierta de fase estacionaria. La retención depende de la volatilidad y de la '
      + 'afinidad por la fase: en una columna apolar, el orden de elución es prácticamente el de los '
      + 'puntos de ebullición. La programación de temperatura resuelve el problema de que los compuestos '
      + 'pesados tardarían horas a temperatura constante.',
    components: [
      { name: 'Inyector split/splitless', role: 'Vaporiza la muestra y controla qué fracción entra en la columna.' },
      { name: 'Columna capilar', role: '30 m de sílice fundida con la fase estacionaria en la pared.' },
      { name: 'Horno programable', role: 'Aumenta la temperatura durante la separación.' },
      { name: 'Detector FID', role: 'Quema el eluato en hidrógeno y mide los iones producidos: universal para compuestos orgánicos.' },
      { name: 'Control de gas portador', role: 'Helio o hidrógeno a presión o caudal constante.' },
    ],
    controls: [
      { id: 'temp-inicial', label: 'Temperatura inicial', kind: 'numero', unit: 'degC', min: 35, max: 300, step: 1, default: 60, description: 'Baja para retener los volátiles al principio.' },
      { id: 'rampa', label: 'Rampa', kind: 'numero', unit: '', min: 1, max: 40, step: 1, default: 10, description: 'Grados por minuto. Más lenta separa mejor y tarda más.' },
      { id: 'temp-final', label: 'Temperatura final', kind: 'numero', unit: 'degC', min: 50, max: 350, step: 1, default: 250, description: 'No superar el límite de la fase estacionaria: se sangra y ensucia el detector.' },
      { id: 'split', label: 'Relación de split', kind: 'numero', unit: '', min: 1, max: 200, step: 1, default: 50, description: 'Fracción de muestra descartada. Alto para muestras concentradas.' },
      { id: 'caudal', label: 'Caudal de portador', kind: 'numero', unit: 'mL/min', min: 0.5, max: 5, step: 0.1, default: 1.2, description: 'El óptimo depende del gas: ~20 cm/s para helio.' },
    ],
    range: [0, 90],
    unit: 'min',
    resolution: 0.001,
    precision: 0.004,
    noise: 0.0006,
    driftPerHour: 0.002,
    settlingTime: 300,
    requiresCalibration: true,
    calibrationValidHours: 24,
    calibrationSteps: [
      { id: 'fugas', title: 'Comprobar estanqueidad', detail: 'Una fuga en el inyector oxida la fase estacionaria y arruina la columna.', seconds: 25 },
      { id: 'estabilizar', title: 'Estabilizar el horno y el detector', detail: 'El FID necesita alcanzar temperatura para no condensar agua de combustión.', requires: { kind: 'espera', value: 20 }, seconds: 20 },
      { id: 'blanco', title: 'Inyectar el blanco de disolvente', detail: 'Revela contaminación del inyector y sangrado de la columna.', requires: { kind: 'blanco' }, seconds: 40 },
      { id: 'patron', title: 'Inyectar la mezcla de n-alcanos', detail: 'Establece los índices de retención de Kováts, que permiten identificar sin patrón puro.', requires: { kind: 'patron' }, seconds: 60 },
    ],
    errorSources: [
      { name: 'Discriminación en el inyector', kind: 'sistematico', effect: 'Los componentes menos volátiles se transfieren peor y aparecen subestimados.', symptom: 'Los picos tardíos son sistemáticamente pequeños.', remedy: 'Elevar la temperatura del inyector o usar inyección en frío.' },
      { name: 'Sitios activos en el liner', kind: 'sistematico', effect: 'Adsorben compuestos polares y producen colas.', symptom: 'Asimetría sólo en alcoholes, aminas o ácidos.', remedy: 'Cambiar el liner desactivado y la lana de vidrio.' },
      { name: 'Sangrado de columna', kind: 'deriva', effect: 'La línea base sube al final de la rampa.', symptom: 'Deriva creciente con la temperatura.', remedy: 'No superar el límite térmico de la fase; sustituir la columna si persiste.' },
      { name: 'Sobrecarga por split insuficiente', kind: 'sistematico', effect: 'Picos deformados con frente inclinado.', symptom: 'Asimetría inversa a la habitual.', remedy: 'Aumentar la relación de split o diluir.' },
    ],
    maintenance: ['Cambiar el liner y el septum periódicamente.', 'Acondicionar la columna nueva antes de usarla.', 'Vigilar la pureza del gas portador con trampas de oxígeno y humedad.'],
    output: 'cromatograma',
    costPerRun: 10,
    courses: ['qan4', 'grasas', 'qamb'],
  },

  {
    id: 'espectrometro-masas',
    name: 'Espectrómetro de masas',
    synonyms: ['espectrometría de masas', 'ms', 'masas'],
    category: 'espectroscopia',
    principle: 'Ioniza las moléculas, las separa por su relación masa/carga y cuenta los iones de cada valor.',
    howItWorks:
      'El impacto electrónico a 70 eV arranca un electrón y deja un ion molecular con exceso de energía '
      + 'que se fragmenta siguiendo reglas predecibles. El analizador separa los iones por m/z y el detector '
      + 'los cuenta. El patrón isotópico del ion molecular es una huella de la composición elemental: '
      + 'un cloro da M+2 al 32 %, un bromo al 97 %, y cada carbono suma un 1.1 % al M+1.',
    components: [
      { name: 'Fuente de impacto electrónico', role: 'Ioniza a 70 eV, una energía normalizada que hace los espectros comparables entre laboratorios.' },
      { name: 'Analizador cuadrupolar', role: 'Filtra los iones por m/z mediante campos de radiofrecuencia.' },
      { name: 'Multiplicador de electrones', role: 'Amplifica el impacto de un solo ion hasta una señal medible.' },
      { name: 'Bomba turbomolecular', role: 'Mantiene el alto vacío necesario para que los iones no colisionen.' },
    ],
    controls: [
      { id: 'modo', label: 'Modo de adquisición', kind: 'seleccion', default: 'scan', options: [{ value: 'scan', label: 'Barrido completo' }, { value: 'sim', label: 'Ion selectivo (SIM)' }], description: 'SIM gana dos órdenes de magnitud en sensibilidad a cambio de perder la información estructural.' },
      { id: 'rango', label: 'Intervalo de masas', kind: 'numero', unit: '', min: 10, max: 1000, step: 5, default: 300, description: 'Masa máxima registrada.' },
      { id: 'energia', label: 'Energía de ionización', kind: 'numero', unit: 'eV', min: 10, max: 100, step: 5, default: 70, description: '70 eV es el estándar que hace comparables las bibliotecas.' },
    ],
    range: [10, 1000],
    unit: '',
    resolution: 0.1,
    precision: 0.02,
    noise: 0.5,
    driftPerHour: 0.01,
    settlingTime: 60,
    requiresCalibration: true,
    calibrationValidHours: 168,
    calibrationSteps: [
      { id: 'vacio', title: 'Verificar el vacío', detail: 'Por debajo de 10⁻⁵ mbar; con peor vacío los iones colisionan y el espectro se degrada.', requires: { kind: 'espera', value: 30 }, seconds: 20 },
      { id: 'sintonizar', title: 'Sintonizar con PFTBA', detail: 'La perfluorotributilamina da iones de referencia a m/z 69, 219 y 502.', requires: { kind: 'patron' }, seconds: 45 },
      { id: 'verificar', title: 'Verificar la exactitud de masa y las proporciones isotópicas', detail: 'Comprobar que las abundancias relativas coinciden con las teóricas.', requires: { kind: 'ajuste' }, seconds: 20 },
    ],
    errorSources: [
      { name: 'Saturación del detector', kind: 'sistematico', effect: 'Las proporciones isotópicas se distorsionan y el ion molecular parece menor.', symptom: 'M+1 anormalmente bajo respecto de M.', remedy: 'Reducir la cantidad inyectada.' },
      { name: 'Fuente sucia', kind: 'deriva', effect: 'Pérdida de sensibilidad y aparición de fondo.', symptom: 'Necesidad de subir la ganancia para la misma señal.', remedy: 'Limpiar la fuente y el volumen de ionización.' },
      { name: 'Fuga de aire', kind: 'sistematico', effect: 'Picos de N₂ (28), O₂ (32) y agua (18) dominantes.', symptom: 'Relación 28/32 cercana a 4 en el fondo.', remedy: 'Localizar la fuga; revisar septum y férulas.' },
    ],
    maintenance: ['Sintonización semanal.', 'Limpieza de la fuente según horas de uso.', 'Cambio periódico del aceite de la bomba primaria.'],
    output: 'espectro',
    costPerRun: 18,
    courses: ['qorg3', 'qan4', 'fito2'],
  },

  {
    id: 'potenciostato',
    name: 'Potenciostato',
    synonyms: ['potenciostato', 'voltamperometría', 'celda de tres electrodos'],
    category: 'electroquimica',
    principle: 'Impone un potencial controlado al electrodo de trabajo frente a una referencia y mide la corriente que circula por un contraelectrodo.',
    howItWorks:
      'La configuración de tres electrodos separa las dos funciones que en dos electrodos se confunden: '
      + 'la referencia fija el potencial sin que pase corriente por ella (y por tanto sin polarizarse), '
      + 'mientras la corriente circula entre el trabajo y el contraelectrodo. Un amplificador operacional '
      + 'ajusta continuamente la tensión aplicada para que la diferencia trabajo-referencia sea la '
      + 'programada.',
    components: [
      { name: 'Electrodo de trabajo', role: 'Donde ocurre la reacción de interés; carbono vítreo, platino u oro.' },
      { name: 'Electrodo de referencia Ag/AgCl', role: 'Potencial fijo; no debe circular corriente por él.' },
      { name: 'Contraelectrodo de platino', role: 'Cierra el circuito de corriente.' },
      { name: 'Amplificador de control', role: 'Mantiene el potencial programado.' },
      { name: 'Convertidor corriente-tensión', role: 'Mide la corriente faradaica.' },
    ],
    controls: [
      { id: 'inicial', label: 'Potencial inicial', kind: 'numero', unit: 'V', min: -2, max: 2, step: 0.01, default: -0.2, description: 'Donde no ocurre reacción.' },
      { id: 'vertice', label: 'Potencial de inversión', kind: 'numero', unit: 'V', min: -2, max: 2, step: 0.01, default: 0.8, description: 'Límite del barrido.' },
      { id: 'velocidad', label: 'Velocidad de barrido', kind: 'numero', unit: '', min: 0.001, max: 10, step: 0.001, default: 0.1, description: 'V/s. La corriente de pico crece con su raíz cuadrada (Randles–Ševčík).' },
      { id: 'ciclos', label: 'Ciclos', kind: 'numero', min: 1, max: 20, step: 1, default: 3, description: 'Repeticiones del barrido.' },
    ],
    range: [-2, 2],
    unit: 'V',
    resolution: 0.001,
    precision: 0.002,
    noise: 0.0015,
    driftPerHour: 0.003,
    settlingTime: 15,
    requiresCalibration: true,
    calibrationValidHours: 24,
    calibrationSteps: [
      { id: 'pulir', title: 'Pulir el electrodo de trabajo', detail: 'Con alúmina de 0.05 µm sobre paño. Un electrodo sucio da picos anchos y desplazados.', seconds: 60 },
      { id: 'desoxigenar', title: 'Desoxigenar con nitrógeno', detail: 'El oxígeno disuelto se reduce en dos ondas que enmascaran la señal.', requires: { kind: 'espera', value: 10 }, seconds: 30 },
      { id: 'ferrocianuro', title: 'Verificar con ferrocianuro 1 mM', detail: 'Sistema reversible de referencia: ΔEp debe salir cercano a 59 mV y la razón de picos, 1.', requires: { kind: 'patron' }, seconds: 45 },
    ],
    errorSources: [
      { name: 'Oxígeno disuelto', kind: 'sistematico', effect: 'Dos ondas de reducción alrededor de −0.1 y −0.9 V.', symptom: 'Corriente catódica de fondo muy grande.', remedy: 'Burbujear nitrógeno 10 min y mantener atmósfera inerte.' },
      { name: 'Caída óhmica no compensada', kind: 'sistematico', effect: 'Separa artificialmente los picos y simula irreversibilidad.', symptom: 'ΔEp mayor de 59/n mV que crece con la velocidad de barrido.', remedy: 'Añadir electrolito soporte y activar la compensación de resistencia.' },
      { name: 'Electrodo pasivado', kind: 'deriva', effect: 'Corrientes decrecientes ciclo a ciclo.', symptom: 'El pico disminuye en barridos sucesivos.', remedy: 'Repulir el electrodo.' },
    ],
    maintenance: ['Pulir el electrodo antes de cada serie.', 'Renovar el electrolito de la referencia.', 'Verificar con un sistema reversible conocido.'],
    output: 'voltamperograma',
    costPerRun: 4,
    courses: ['electro1', 'electro2', 'qan3'],
  },

  {
    id: 'bureta',
    name: 'Bureta',
    synonyms: ['bureta', 'volumetría', 'titulación'],
    category: 'volumetria',
    principle: 'Entrega volúmenes variables y medidos de disolución mediante una llave de paso, con la escala calibrada por vertido.',
    howItWorks:
      'Una bureta clase A de 50 mL tiene una tolerancia de ±0.05 mL y divisiones de 0.1 mL, lo que permite '
      + 'estimar hasta 0.02 mL. Está calibrada "por vertido" (Ex): la escala tiene en cuenta la película de '
      + 'líquido que queda mojando la pared, y por eso hay que respetar el tiempo de escurrido. La lectura '
      + 'se hace en el fondo del menisco, con el ojo a su altura para evitar el error de paralaje.',
    components: [
      { name: 'Tubo graduado', role: 'Escala de 0.1 mL sobre 50 mL.' },
      { name: 'Llave de PTFE', role: 'Controla el caudal; no necesita grasa.' },
      { name: 'Punta afilada', role: 'Permite entregar fracciones de gota.' },
    ],
    controls: [
      { id: 'llave', label: 'Apertura de la llave', kind: 'numero', unit: '', min: 0, max: 1, step: 0.01, default: 0, description: 'De goteo lento a chorro.' },
      { id: 'purgar', label: 'Purgar y enrasar', kind: 'boton', description: 'Elimina la burbuja de la punta y lleva el menisco al cero.' },
    ],
    range: [0, 50],
    unit: 'mL',
    resolution: 0.02,
    precision: 0.02,
    noise: 0.005,
    driftPerHour: 0,
    settlingTime: 30,
    requiresCalibration: false,
    calibrationValidHours: 8760,
    calibrationSteps: [
      { id: 'lavar', title: 'Lavar y acondicionar con el titrante', detail: 'Tres enjuagues con la propia disolución: el agua residual la diluye y produce un error sistemático por exceso de volumen.', seconds: 30 },
      { id: 'burbuja', title: 'Eliminar la burbuja de la punta', detail: 'Abrir la llave a chorro. Una burbuja que sale durante la valoración añade su volumen al leído.', seconds: 15 },
      { id: 'enrasar', title: 'Enrasar en cero', detail: 'Fondo del menisco tangente a la línea, con el ojo a su altura.', seconds: 20 },
    ],
    errorSources: [
      { name: 'Error de paralaje', kind: 'humano', effect: 'Hasta 0.1 mL en cada lectura, en cualquier sentido.', symptom: 'Dispersión entre operadores mayor que la del material.', remedy: 'Leer con el ojo a la altura del menisco; usar una tarjeta de contraste.' },
      { name: 'Bureta no acondicionada', kind: 'sistematico', effect: 'El titrante se diluye y hace falta más volumen: el resultado sale alto.', symptom: 'La primera valoración de la serie difiere de las siguientes.', remedy: 'Enjuagar tres veces con el titrante antes de llenar.' },
      { name: 'Burbuja en la punta', kind: 'sistematico', effect: 'El volumen leído supera al entregado.', symptom: 'Resultado alto y punto final tardío.', remedy: 'Purgar antes de enrasar y revisar durante la valoración.' },
      { name: 'Escurrido insuficiente', kind: 'sistematico', effect: 'Se lee antes de que baje la película de la pared: volumen subestimado.', symptom: 'Diferencias sistemáticas al valorar deprisa.', remedy: 'Esperar 30 s tras cerrar la llave antes de leer.' },
      { name: 'Gota colgando de la punta', kind: 'sistematico', effect: 'Añade unos 0.02 mL no incorporados al matraz.', symptom: 'Resultado ligeramente alto de forma constante.', remedy: 'Arrastrar la gota con la pared del matraz y enjuagar.' },
    ],
    maintenance: ['Limpiar con mezcla sulfocrómica sólo si el agua no moja uniformemente.', 'Verificar el volumen por pesada de agua una vez al año.'],
    output: 'escalar',
    costPerRun: 0,
    courses: ['qan1', 'qan2', 'qan3'],
  },

  {
    id: 'estufa',
    name: 'Estufa de secado',
    synonyms: ['estufa', 'secado', 'horno de laboratorio'],
    category: 'termica',
    principle: 'Mantiene una temperatura uniforme por convección forzada para eliminar humedad sin descomponer la muestra.',
    howItWorks:
      'Una resistencia calienta el aire que un ventilador hace circular; un termostato PID mantiene la '
      + 'consigna. Secar a peso constante significa repetir el ciclo secar-enfriar-pesar hasta que dos '
      + 'pesadas consecutivas difieran menos que la incertidumbre de la balanza: es el criterio operativo '
      + 'que evita confundir humedad residual con descomposición incipiente.',
    components: [
      { name: 'Resistencia y ventilador', role: 'Convección forzada para uniformidad térmica.' },
      { name: 'Control PID', role: 'Mantiene la consigna con oscilación mínima.' },
      { name: 'Sonda Pt100', role: 'Mide la temperatura real de la cámara.' },
    ],
    controls: [
      { id: 'temperatura', label: 'Consigna', kind: 'numero', unit: 'degC', min: 30, max: 300, step: 1, default: 105, description: '105 °C es la condición estándar de secado.' },
      { id: 'tiempo', label: 'Tiempo', kind: 'numero', unit: 'min', min: 5, max: 1440, step: 5, default: 120, description: 'Hasta peso constante.' },
    ],
    range: [30, 300],
    unit: 'degC',
    resolution: 1,
    precision: 2,
    noise: 0.6,
    driftPerHour: 0.4,
    settlingTime: 900,
    requiresCalibration: false,
    calibrationValidHours: 8760,
    calibrationSteps: [
      { id: 'verificar', title: 'Verificar con termómetro certificado', detail: 'La temperatura indicada y la real pueden diferir varios grados según la posición en la cámara.', requires: { kind: 'patron' }, seconds: 30 },
    ],
    errorSources: [
      { name: 'Enfriar fuera del desecador', kind: 'sistematico', effect: 'La muestra recupera humedad y pesa de más.', symptom: 'La masa aumenta mientras se pesa.', remedy: 'Enfriar siempre en desecador con sílica activa.' },
      { name: 'Temperatura excesiva', kind: 'sistematico', effect: 'Descompone la muestra: la masa sigue bajando indefinidamente.', symptom: 'Nunca se alcanza peso constante.', remedy: 'Bajar la consigna y comprobar la estabilidad térmica del compuesto.' },
      { name: 'Gradiente térmico en la cámara', kind: 'aleatorio', effect: 'Distintas posiciones secan de forma desigual.', symptom: 'Réplicas discordantes según dónde se colocaron.', remedy: 'Situar las muestras en la zona central verificada.' },
    ],
    maintenance: ['Verificar la temperatura anualmente.', 'Regenerar la sílica del desecador asociado.'],
    output: 'serie-temporal',
    costPerRun: 0.2,
    courses: ['qan1', 'qsuelo'],
  },

  {
    id: 'centrifuga',
    name: 'Centrífuga',
    synonyms: ['centrífuga', 'centrifugación'],
    category: 'mecanica',
    principle: 'Sustituye la gravedad por una aceleración centrífuga mucho mayor para acelerar la sedimentación de las partículas suspendidas.',
    howItWorks:
      'La aceleración relativa (RCF, en unidades de g) es 1.118×10⁻⁵·r·rpm², con r el radio del rotor en '
      + 'centímetros. Informar de las revoluciones sin el radio es por tanto insuficiente: dos centrífugas '
      + 'a las mismas rpm con rotores distintos aplican fuerzas distintas. La velocidad de sedimentación '
      + 'sigue la ley de Stokes y depende del cuadrado del radio de partícula.',
    components: [
      { name: 'Rotor de ángulo fijo', role: 'Sostiene los tubos; su radio determina la RCF.' },
      { name: 'Motor sin escobillas', role: 'Acelera y frena de forma controlada.' },
      { name: 'Detector de desequilibrio', role: 'Detiene el aparato si la carga no está compensada.' },
      { name: 'Enclavamiento de tapa', role: 'Impide abrir con el rotor en movimiento.' },
    ],
    controls: [
      { id: 'velocidad', label: 'Velocidad', kind: 'numero', unit: '', min: 500, max: 15000, step: 100, default: 4000, description: 'Revoluciones por minuto.' },
      { id: 'tiempo', label: 'Tiempo', kind: 'numero', unit: 'min', min: 1, max: 60, step: 1, default: 10, description: 'Duración del ciclo.' },
      { id: 'radio', label: 'Radio del rotor', kind: 'numero', unit: 'cm', min: 5, max: 20, step: 0.5, default: 10, description: 'Necesario para convertir rpm en RCF.' },
    ],
    range: [500, 15000],
    unit: '',
    resolution: 100,
    precision: 50,
    noise: 20,
    driftPerHour: 0,
    settlingTime: 30,
    requiresCalibration: false,
    calibrationValidHours: 8760,
    calibrationSteps: [
      { id: 'equilibrar', title: 'Equilibrar los tubos', detail: 'Enfrentados y con masas iguales a ±0.1 g. Un desequilibrio a 10 000 rpm puede destruir el rotor.', requires: { kind: 'ajuste' }, seconds: 30 },
    ],
    errorSources: [
      { name: 'Carga desequilibrada', kind: 'humano', effect: 'Vibración intensa, daño al eje y riesgo de rotura del rotor.', symptom: 'Ruido y vibración; el aparato se detiene por seguridad.', remedy: 'Compensar siempre con un tubo de igual masa en la posición opuesta.' },
      { name: 'Frenado brusco', kind: 'sistematico', effect: 'Resuspende el sedimento.', symptom: 'Sobrenadante turbio pese a una centrifugación suficiente.', remedy: 'Usar rampa de frenado suave.' },
    ],
    maintenance: ['Inspeccionar el rotor en busca de corrosión.', 'Respetar la vida útil del rotor en ciclos.'],
    output: 'escalar',
    costPerRun: 0.1,
    courses: ['qbio', 'fito1'],
  },
];

const BY_ID = new Map(INSTRUMENTS.map((i) => [i.id, i]));
export const instrumentById = (id: string): Instrument | undefined => BY_ID.get(id);

export const instrumentsByCategory = (category: InstrumentCategory): Instrument[] =>
  INSTRUMENTS.filter((i) => i.category === category);

export const instrumentsForCourse = (courseId: string): Instrument[] =>
  INSTRUMENTS.filter((i) => i.courses?.includes(courseId));

/** Relative centrifugal force from rotor radius and speed. */
export const rcf = (radiusCm: number, rpm: number): number =>
  1.118e-5 * radiusCm * rpm * rpm;
