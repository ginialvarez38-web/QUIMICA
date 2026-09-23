/**
 * EL ARBOL DEL CONOCIMIENTO.
 *
 * QUE ES, Y QUE NO ES EL INDICE
 * El indice numerado dice DONDE ESTA un tema: el 2.7 va despues del 2.6 porque
 * asi se numero el temario. El arbol dice otra cosa distinta y mas util: QUE
 * HACE FALTA ENTENDER ANTES. Son dos estructuras sobre el mismo material, y
 * confundirlas es el motivo de que un temario se pueda leer entero sin ver
 * nunca por que una cosa lleva a la otra.
 *
 * El numero 1.8.3 no explica que la ley de las proporciones multiples fue LA
 * prueba que empujo a Dalton, y que por eso hay que haberla entendido antes de
 * llegar a los modelos atomicos del 2.2.1.2 — que esta en otra unidad y
 * cuarenta pantallas mas alla.
 *
 * POR QUE NO SE PUEDE DERIVAR DE `connects`
 * Se intento primero, porque habria salido gratis. No sirve:
 *
 *   - `connects` es LATERAL y va en los dos sentidos. El 2.11.1.1 enlaza al
 *     2.11.1.3 y el 2.11.1.3 enlaza de vuelta al 2.11.1.1. Un arbol con esa
 *     arista tendria un ciclo, y un ciclo en un orden de estudio significa
 *     «para entender esto necesitas esto, que necesita aquello»: nada por
 *     donde empezar.
 *   - Solo 33 de los 58 apartados tienen alguno.
 *
 * Asi que `requires` es un dato NUEVO —una arista dirigida, «esto va antes que
 * esto»— y no una copia de nada. Cada apartado declara de que depende, y el
 * arbol se construye recorriendo esas declaraciones.
 *
 * LAS RAMAS QUE AUN NO EXISTEN
 * La otra mitad del encargo era poder UBICAR LOS TEMAS FUTUROS. Por eso el
 * arbol no dibuja solo lo que hay: dibuja tambien las ramas previstas, en
 * gris, colgando de aquello que ya las sostiene. Y dice, para cada una, que
 * motor de la aplicacion la soporta YA — porque varias estan implementadas y
 * probadas desde hace tiempo y lo unico que les falta es el temario encima.
 *
 * Eso convierte la pregunta «¿donde meto la termoquimica?» en algo que se mira
 * en lugar de discutirse.
 */

import type { TheoryTopic } from './theory.js';

export type NodeState = 'listo' | 'previsto';

export interface TreeNode {
  readonly id: string;
  readonly title: string;
  readonly state: NodeState;
  /** Profundidad en el temario: 1 para 1.8, 2 para 1.8.3. */
  readonly depth: number;
  /** De que depende. Identificadores de otros nodos. */
  readonly requires: readonly string[];
  /**
   * Para las ramas previstas: que motor las sostiene ya.
   *
   * Es la parte mas honesta del arbol. «Estequiometria» no es una idea vaga
   * pendiente de diseno: `engine/stoichiometry.ts` esta escrito y probado, y
   * lo que falta es el temario encima. Decirlo cambia lo que significa la
   * casilla gris.
   */
  readonly engine?: string;
  /** Una frase de que aporta esta rama. Solo en las previstas. */
  readonly note?: string;
}

export interface TreeEdge {
  readonly from: string;
  readonly to: string;
  /** Une dos unidades distintas: son las que mas cuesta ver leyendo. */
  readonly crossesUnit: boolean;
}

export interface KnowledgeTree {
  readonly nodes: readonly TreeNode[];
  readonly edges: readonly TreeEdge[];
  /** Los nodos repartidos por capas: capa 0 = nada previo hace falta. */
  readonly layers: readonly (readonly TreeNode[])[];
}

// ---------------------------------------------------------------------------
// Las ramas que aun no existen
// ---------------------------------------------------------------------------

/**
 * Lo que viene despues, y de que cuelga.
 *
 * No es una lista de deseos: cada entrada dice de que apartado REAL depende,
 * asi que se dibuja enganchada al sitio que le toca. Y las que ya tienen motor
 * lo declaran — son las que estan a un temario de distancia, no a un proyecto.
 */
const PLANNED: readonly TreeNode[] = [
  {
    id: '6',
    title: 'La reaccion quimica',
    state: 'previsto',
    depth: 1,
    requires: ['1.7', '1.8.1', '4.1'],
    engine: 'engine/predict.ts · core/balance.ts',
    note:
      'Tipos de reaccion, prediccion de productos y ajuste. Se apoya en las transformaciones del 1.7 ' +
      'y en la conservacion de la materia, que es lo que hace posible ajustar.',
  },
  {
    id: '7',
    title: 'Estequiometria',
    state: 'previsto',
    depth: 1,
    requires: ['1.10', '1.12', '6'],
    engine: 'engine/stoichiometry.ts',
    note:
      'Reactivo limitante, exceso, rendimiento, gases y molaridad. El motor esta completo y probado; ' +
      'es la rama que menos trabajo queda. Necesita el mol y la ecuacion ajustada.',
  },
  {
    id: '8',
    title: 'Disoluciones',
    state: 'previsto',
    depth: 1,
    requires: ['1.6.1', '7', '3.3.1'],
    note:
      'Concentracion, solubilidad y propiedades coligativas. Es la rama que tapa el hueco declarado ' +
      'del apartado 1.6: hoy el sandbox no tiene modelo de mezclas.',
  },
  {
    id: '9',
    title: 'Termoquimica',
    state: 'previsto',
    depth: 1,
    requires: ['6', '7'],
    engine: 'engine/energy.ts',
    note:
      'Entalpia, ley de Hess, espontaneidad. Ya calcula ΔH, ΔG y ΔS y la temperatura de cruce; falta ' +
      'el diagrama del perfil energetico y el temario.',
  },
  {
    id: '10',
    title: 'Equilibrio quimico',
    state: 'previsto',
    depth: 1,
    requires: ['9', '8'],
    note: 'Constante de equilibrio, Le Chatelier. No hay motor todavia: es rama nueva de verdad.',
  },
  {
    id: '11',
    title: 'Acidos y bases',
    state: 'previsto',
    depth: 1,
    requires: ['10'],
    engine: 'engine/rules/ (neutralizacion) · core/classify.ts',
    note:
      'pH, fuerza, neutralizacion y valoraciones. La neutralizacion ya se predice; el equilibrio de ' +
      'ionizacion y el pH, no.',
  },
  {
    id: '12',
    title: 'Redox y electroquimica',
    state: 'previsto',
    depth: 1,
    requires: ['6', '2.11.1.2'],
    engine: 'engine/redox.ts · rules/activity.ts',
    note:
      'Semirreacciones, agentes, pilas y electrolisis. El motor genera las semirreacciones en forma ' +
      'ionica y conoce la serie de actividad; necesita los electrones de valencia del 2.11.',
  },
  {
    id: '13',
    title: 'Quimica organica',
    state: 'previsto',
    depth: 1,
    requires: ['3.2.2.4', '4.1'],
    note:
      'Grupos funcionales, nomenclatura IUPAC y mecanismos. El modelo la admite desde el inicio, pero ' +
      'la nomenclatura organica y los mecanismos estan por hacer.',
  },
];

// ---------------------------------------------------------------------------

/** Los nodos que salen del temario real, con sus dependencias declaradas. */
function nodesOfUnit<D>(unit: TheoryTopic<D>): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (topic: TheoryTopic<D>, depth: number) => {
    out.push({
      id: topic.id,
      title: topic.title,
      state: 'listo',
      depth,
      requires: topic.requires ?? [],
    });
    for (const child of topic.children ?? []) walk(child, depth + 1);
  };
  for (const child of unit.children ?? []) walk(child, 1);
  return out;
}

/** La unidad a la que pertenece un identificador: «2.11.1.3» → «2». */
export function unitOf(id: string): string {
  return id.split('.')[0]!;
}

/**
 * Reparte los nodos en capas por CAMINO MAS LARGO, no por profundidad minima.
 *
 * La diferencia importa. Con el camino mas corto, un apartado que depende de
 * algo basico y de algo avanzado quedaria junto a lo basico, con una flecha
 * larguisima cruzando el dibujo desde lo avanzado. Con el mas largo, cada nodo
 * cae DESPUES de todo lo que necesita, que es lo que se viene a ver: si algo
 * esta en la capa 4 es que hay cuatro cosas encadenadas antes.
 *
 * Los nodos cuya dependencia no existe se tratan como si no la tuvieran, y una
 * prueba se encarga de que eso no pase: aqui no se puede fallar ruidosamente
 * sin dejar el arbol sin dibujar.
 */
function layerize(nodes: readonly TreeNode[]): (readonly TreeNode[])[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depth = new Map<string, number>();
  const visiting = new Set<string>();

  const compute = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;

    // Un ciclo no deberia existir —hay una prueba— pero si apareciera, cortar
    // aqui deja el arbol dibujado en lugar de colgar el navegador.
    if (visiting.has(id)) return 0;
    visiting.add(id);

    const node = byId.get(id);
    const parents = (node?.requires ?? []).filter((r) => byId.has(r));
    const value = parents.length === 0 ? 0 : Math.max(...parents.map(compute)) + 1;

    visiting.delete(id);
    depth.set(id, value);
    return value;
  };

  for (const node of nodes) compute(node.id);

  const total = Math.max(0, ...depth.values()) + 1;
  const layers: TreeNode[][] = Array.from({ length: total }, () => []);
  for (const node of nodes) layers[depth.get(node.id) ?? 0]!.push(node);
  return layers;
}

/**
 * El arbol entero: lo que hay y lo que viene.
 *
 * Las unidades se pasan como argumento en lugar de importarse para que el
 * modulo no dependa de ningun temario concreto. Anadir la unidad 3 fue
 * exactamente eso: pasarla aqui, sin tocar ni una linea de esta funcion.
 */
export function knowledgeTree(units: readonly TheoryTopic<never>[]): KnowledgeTree {
  const nodes: TreeNode[] = [...units.flatMap((u) => nodesOfUnit(u)), ...PLANNED];
  const ids = new Set(nodes.map((n) => n.id));

  const edges: TreeEdge[] = [];
  for (const node of nodes) {
    for (const required of node.requires) {
      if (!ids.has(required)) continue;
      edges.push({
        from: required,
        to: node.id,
        crossesUnit: unitOf(required) !== unitOf(node.id),
      });
    }
  }

  return { nodes, edges, layers: layerize(nodes) };
}

/** Las ramas previstas, para quien solo quiera esa lista. */
export function plannedBranches(): readonly TreeNode[] {
  return PLANNED;
}

/** Lo que hace falta antes de un apartado, y lo que ese apartado abre. */
export function neighbours(
  tree: KnowledgeTree,
  id: string,
): { readonly before: readonly TreeNode[]; readonly after: readonly TreeNode[] } {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  return {
    before: tree.edges.filter((e) => e.to === id).map((e) => byId.get(e.from)!),
    after: tree.edges.filter((e) => e.from === id).map((e) => byId.get(e.to)!),
  };
}
