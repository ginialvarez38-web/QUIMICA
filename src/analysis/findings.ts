/**
 * CHEMICAL ANALYSIS ENGINE — columna vertebral.
 *
 * DECISION DE ARQUITECTURA
 * El requisito mas distintivo del brief no es ninguna propiedad concreta: es
 * §50 y §66, que CADA resultado se pueda abrir con «¿por que?» y lleve a los
 * resultados que lo fundamentan.
 *
 * Eso se puede hacer de dos maneras:
 *
 *   a) Escribir a mano un arbol de textos explicativos. Se desincroniza del
 *      calculo en cuanto uno de los dos cambia, y acaba mintiendo.
 *
 *   b) Hacer que cada paso del analisis emita un HALLAZGO que declare de que
 *      otros hallazgos depende. Entonces «¿por que?» no es una funcion
 *      aparte: es recorrer las aristas del grafo que el propio calculo
 *      construyo.
 *
 * Este modulo implementa (b). La consecuencia es que la explicacion no puede
 * contradecir al resultado, porque es el mismo objeto.
 *
 * Un analisis completo es, literalmente, un grafo dirigido acíclico de
 * hallazgos. §47 (mapa de informacion), §50 (boton «¿por que?») y §66 (regla
 * de diseno mas importante) salen todos del mismo mecanismo.
 */

/**
 * De donde sale un dato (§57).
 *
 * Es una dimension SEPARADA de la certeza: un dato experimental puede tener
 * una incertidumbre grande, y un modelo educativo puede dar el numero exacto.
 * Lo que esta etiqueta comunica es QUE CLASE de afirmacion se esta haciendo,
 * para que nadie confunda una simplificacion didactica con una medida.
 */
export type Confidence =
  /** Medido en el laboratorio. */
  | 'experimental'
  /** Calculado por este motor a partir de datos y reglas. */
  | 'calculated'
  /** Prediccion de un modelo teorico (VSEPR, Pauling, Lewis). */
  | 'theoretical'
  /** Simplificacion deliberada para ensenar; NO es la realidad cuantica. */
  | 'educational'
  /** No hay informacion suficiente. */
  | 'unknown';

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  experimental: 'Experimental',
  calculated: 'Calculado',
  theoretical: 'Teorico',
  educational: 'Modelo educativo',
  unknown: 'Sin datos',
};

export const CONFIDENCE_NOTE: Record<Confidence, string> = {
  experimental: 'Valor medido experimentalmente. Se indica la fuente.',
  calculated: 'Calculado por el motor a partir de datos y reglas verificables.',
  theoretical: 'Prediccion de un modelo teorico. Puede no coincidir con el experimento.',
  educational:
    'Simplificacion pensada para ensenar. Es util para razonar, pero NO describe la realidad cuantica con exactitud.',
  unknown: 'El sistema no dispone de informacion suficiente y prefiere decirlo antes que inventarla.',
};

/** Un paso intermedio del razonamiento, con su expresion si la tiene. */
export interface Step {
  readonly text: string;
  readonly math?: string;
}

/**
 * Un resultado del analisis, con todo lo necesario para justificarlo.
 */
export interface Finding {
  /** Identificador jerarquico estable: 'polarity.molecular', 'lewis.formalCharges'. */
  readonly id: string;
  /** Categoria para agrupar en la interfaz: 'identidad', 'electrones', ... */
  readonly section: string;
  /** Titulo legible. */
  readonly label: string;
  /** El resultado, ya formateado para mostrar. */
  readonly value: string;
  /** Una frase que responde «¿por que?». */
  readonly because: string;
  readonly confidence: Confidence;
  /**
   * Hallazgos de los que depende ESTE. Recorrerlos es exactamente lo que hace
   * el boton «¿por que?»: llevar al usuario un nivel mas abajo.
   */
  readonly dependsOn: readonly string[];
  /** Desarrollo del razonamiento. */
  readonly steps?: readonly Step[];
  /** Modelo empleado, cuando conviene nombrarlo: 'VSEPR', 'Pauling', 'Lewis'. */
  readonly model?: string;
  /** Fuente del dato, cuando es experimental. */
  readonly source?: string;
  /** Nivel de profundidad (§48): 1 basico … 5 avanzado. */
  readonly level: 1 | 2 | 3 | 4 | 5;
}

/**
 * Coleccion de hallazgos de una especie: el grafo completo.
 *
 * Se construye con `add`, que valida que las dependencias existan. Esa
 * validacion importa: una dependencia mal escrita convertiria el boton
 * «¿por que?» en un callejon sin salida, y es justo el tipo de error que no
 * se ve hasta que un usuario lo pulsa.
 */
export class FindingGraph {
  private readonly findings = new Map<string, Finding>();
  private readonly order: string[] = [];
  private readonly warnings: string[] = [];

  add(finding: Finding): this {
    if (this.findings.has(finding.id)) {
      this.warnings.push(`Hallazgo duplicado: ${finding.id}`);
      return this;
    }
    for (const dep of finding.dependsOn) {
      if (!this.findings.has(dep)) {
        // Se registra en lugar de lanzar: un analisis incompleto sigue siendo
        // util, y el aviso aparece en las pruebas.
        this.warnings.push(`${finding.id} depende de "${dep}", que no existe (aun).`);
      }
    }
    this.findings.set(finding.id, finding);
    this.order.push(finding.id);
    return this;
  }

  /** Anade solo si el valor no es nulo; devuelve si se anadio. */
  addIf(condition: boolean, finding: Finding): boolean {
    if (!condition) return false;
    this.add(finding);
    return true;
  }

  get(id: string): Finding | undefined {
    return this.findings.get(id);
  }

  has(id: string): boolean {
    return this.findings.has(id);
  }

  all(): readonly Finding[] {
    return this.order.map((id) => this.findings.get(id)!);
  }

  /** Hallazgos de una seccion, en orden de creacion. */
  section(name: string): readonly Finding[] {
    return this.all().filter((f) => f.section === name);
  }

  /** Hasta cierto nivel de profundidad (§48). */
  upToLevel(level: number): readonly Finding[] {
    return this.all().filter((f) => f.level <= level);
  }

  sections(): readonly string[] {
    return [...new Set(this.all().map((f) => f.section))];
  }

  problems(): readonly string[] {
    return this.warnings;
  }

  /**
   * «¿POR QUE?» — un nivel hacia abajo.
   * Devuelve los hallazgos que fundamentan directamente al indicado.
   */
  why(id: string): readonly Finding[] {
    const finding = this.findings.get(id);
    if (!finding) return [];
    return finding.dependsOn
      .map((dep) => this.findings.get(dep))
      .filter((f): f is Finding => f !== undefined);
  }

  /**
   * La cadena completa de razonamiento hasta los cimientos.
   *
   * Es lo que permite el descenso del §66: de «CO2 es apolar» a «porque es
   * lineal», a «porque el carbono tiene dos regiones de densidad
   * electronica», hasta llegar a los datos de partida.
   *
   * Recorrido en anchura con marca de visitados, porque el grafo converge:
   * geometria y polaridad dependen ambas de la estructura de Lewis, y sin la
   * marca esa rama se recorreria dos veces.
   */
  explain(id: string): readonly { readonly depth: number; readonly finding: Finding }[] {
    const root = this.findings.get(id);
    if (!root) return [];

    const out: { depth: number; finding: Finding }[] = [];
    const seen = new Set<string>();
    const queue: { id: string; depth: number }[] = [{ id, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (seen.has(current.id)) continue;
      seen.add(current.id);

      const finding = this.findings.get(current.id);
      if (!finding) continue;
      out.push({ depth: current.depth, finding });

      for (const dep of finding.dependsOn) {
        if (!seen.has(dep)) queue.push({ id: dep, depth: current.depth + 1 });
      }
    }

    return out;
  }

  /** Quien depende de este hallazgo: la direccion contraria del grafo. */
  usedBy(id: string): readonly Finding[] {
    return this.all().filter((f) => f.dependsOn.includes(id));
  }

  /**
   * Aristas del grafo, para dibujar el mapa de informacion (§47).
   */
  edges(): readonly { readonly from: string; readonly to: string }[] {
    const out: { from: string; to: string }[] = [];
    for (const f of this.all()) {
      for (const dep of f.dependsOn) {
        if (this.findings.has(dep)) out.push({ from: dep, to: f.id });
      }
    }
    return out;
  }

  /** Reparto por nivel de confianza, para el resumen de fiabilidad. */
  confidenceBreakdown(): Record<Confidence, number> {
    const counts: Record<Confidence, number> = {
      experimental: 0,
      calculated: 0,
      theoretical: 0,
      educational: 0,
      unknown: 0,
    };
    for (const f of this.all()) counts[f.confidence]++;
    return counts;
  }

  get size(): number {
    return this.findings.size;
  }
}

/** Secciones del analisis, en el orden en que se presentan. */
export const SECTIONS = [
  'identidad',
  'composicion',
  'atomos',
  'electrones',
  'lewis',
  'resonancia',
  'enlaces',
  'hibridacion',
  'geometria',
  'polaridad',
  'intermoleculares',
  'propiedades',
  'acido-base',
  'redox',
  'reactividad',
] as const;

export type Section = (typeof SECTIONS)[number];

export const SECTION_LABEL: Record<string, string> = {
  identidad: 'Identidad',
  composicion: 'Composicion',
  atomos: 'Atomos',
  electrones: 'Estructura electronica',
  lewis: 'Estructura de Lewis',
  resonancia: 'Resonancia',
  enlaces: 'Enlaces',
  hibridacion: 'Hibridacion',
  geometria: 'Geometria',
  polaridad: 'Polaridad',
  intermoleculares: 'Fuerzas intermoleculares',
  propiedades: 'Propiedades',
  'acido-base': 'Acido-base',
  redox: 'Redox',
  reactividad: 'Reactividad',
};

/** Nivel de profundidad (§48). */
export const LEVEL_LABEL: Record<number, string> = {
  1: 'Basico',
  2: 'Estructural',
  3: 'Electronico',
  4: 'Molecular',
  5: 'Avanzado',
};
