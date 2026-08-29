/**
 * Red de transformaciones quimicas (§21, §22, §42, §45).
 *
 * "El objetivo final es crear un Google Maps de las transformaciones
 * quimicas." Este modulo es ese mapa.
 *
 * MODELO
 *   Nodo   = una sustancia.
 *   Arista = una reaccion que la convierte en otra.
 *
 * Una reaccion con varios productos genera varias aristas desde cada reactivo
 * principal. Lo que NO se hace es tratar todos los reactivos como origen: en
 *   CaCO3 + 2 HCl -> CaCl2 + H2O + CO2
 * la arista interesante es CaCO3 -> CaCl2, no HCl -> H2O. Se distingue el
 * SUSTRATO (la sustancia que se transforma) de los REACTIVOS AUXILIARES,
 * usando el criterio de continuidad de elementos: el sustrato es el reactivo
 * que comparte con el producto el elemento "pesado" que da identidad al
 * compuesto.
 *
 * BUSQUEDA DE RUTAS
 * Dijkstra con coste configurable, no solo BFS: asi "la ruta mas corta" puede
 * significar menos pasos, o menos dificultad, o condiciones mas suaves, que es
 * lo que pide §42 al comparar rutas.
 */

import type { Reaction } from '../core/types.js';
import { REACTIONS } from '../data/reactions.js';
import { getSpecies } from '../data/species.js';
import { parseFormula } from '../core/formula/parse.js';
import { getElement } from '../data/elements.js';

export interface Edge {
  readonly from: string;
  readonly to: string;
  readonly reaction: Reaction;
  /** Reactivos distintos del sustrato que hacen falta. */
  readonly reagents: readonly string[];
  /** Productos distintos del objetivo (subproductos). */
  readonly byproducts: readonly string[];
}

export interface RouteStep {
  readonly from: string;
  readonly to: string;
  readonly reaction: Reaction;
  readonly reagents: readonly string[];
  readonly byproducts: readonly string[];
}

export interface Route {
  readonly steps: readonly RouteStep[];
  readonly nodes: readonly string[];
  /** Numero de reacciones. */
  readonly length: number;
  /** Suma de dificultades, 1..5 por paso. */
  readonly totalDifficulty: number;
  /** Reactivos auxiliares necesarios en toda la ruta, sin repetir. */
  readonly requiredReagents: readonly string[];
  /** Conceptos quimicos que la ruta ensena. */
  readonly concepts: readonly string[];
  /** ¿Alguna etapa exige condiciones especiales? */
  readonly needsSpecialConditions: boolean;
  /** Nivel de peligro maximo de la ruta. */
  readonly maxHazard: Reaction['hazard'];
}

// ---------------------------------------------------------------------------
// Construccion del grafo
// ---------------------------------------------------------------------------

/**
 * "Peso" de un elemento como portador de identidad quimica.
 * El agua, el CO2 y los acidos comunes suelen ser auxiliares; el metal o el
 * elemento central pesado es el que sigue la ruta.
 */
const UBIQUITOUS = new Set(['H', 'O']);

function identityElements(formula: string): Set<string> {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return new Set();
  const symbols = [...parsed.value.composition.keys()];
  const distinctive = symbols.filter((s) => !UBIQUITOUS.has(s));
  return new Set(distinctive.length > 0 ? distinctive : symbols);
}

/** Sustancias demasiado comunes para ser el sustrato de una transformacion. */
const AUXILIARY = new Set(['H2O', 'O2', 'H2', 'HCl', 'H2SO4', 'HNO3', 'NaOH', 'KOH', 'CO2', 'CO', 'N2']);

/**
 * ¿Es razonable considerar que `reactant` se transforma en `product`?
 * Criterio: comparten al menos un elemento identitario.
 */
function isTransformation(reactant: string, product: string): boolean {
  if (reactant === product) return false;
  const a = identityElements(reactant);
  const b = identityElements(product);
  for (const e of a) if (b.has(e)) return true;
  return false;
}

function buildEdges(): Edge[] {
  const edges: Edge[] = [];

  for (const reaction of REACTIONS) {
    const reactants = reaction.equation.reactants.map((t) => t.formula);
    const products = reaction.equation.products.map((t) => t.formula);

    for (const from of reactants) {
      for (const to of products) {
        if (!isTransformation(from, to)) continue;

        // Si el sustrato candidato es una sustancia ubicua Y hay otro
        // reactivo que tambien conecta, se prefiere el otro: en
        // CaO + H2O -> Ca(OH)2 el sustrato es CaO, no el agua.
        if (AUXILIARY.has(from) && reactants.some((r) => r !== from && isTransformation(r, to))) {
          continue;
        }
        // Lo mismo del lado de los productos: CaCO3 + HCl -> CaCl2 + H2O + CO2
        // no debe generar la arista CaCO3 -> H2O.
        if (AUXILIARY.has(to) && products.some((p) => p !== to && isTransformation(from, p))) {
          continue;
        }

        edges.push({
          from,
          to,
          reaction,
          reagents: reactants.filter((r) => r !== from),
          byproducts: products.filter((p) => p !== to),
        });
      }
    }
  }

  return edges;
}

export const EDGES: readonly Edge[] = buildEdges();

const OUTGOING = new Map<string, Edge[]>();
const INCOMING = new Map<string, Edge[]>();
for (const e of EDGES) {
  (OUTGOING.get(e.from) ?? OUTGOING.set(e.from, []).get(e.from)!).push(e);
  (INCOMING.get(e.to) ?? INCOMING.set(e.to, []).get(e.to)!).push(e);
}

/** Todos los nodos del grafo. */
export const NODES: readonly string[] = [...new Set(EDGES.flatMap((e) => [e.from, e.to]))].sort();

/** Transformaciones que parten de esta sustancia (§20). */
export function outgoingFrom(formula: string): readonly Edge[] {
  return OUTGOING.get(formula) ?? [];
}

/** Transformaciones que llegan a esta sustancia (§21). */
export function incomingTo(formula: string): readonly Edge[] {
  return INCOMING.get(formula) ?? [];
}

// ---------------------------------------------------------------------------
// Busqueda de rutas
// ---------------------------------------------------------------------------

export type RouteCost = 'steps' | 'difficulty' | 'safety';

const HAZARD_COST: Record<Reaction['hazard'], number> = {
  safe: 1,
  'special-conditions': 2,
  hazardous: 5,
  'do-not-attempt': 12,
};

function edgeCost(edge: Edge, mode: RouteCost): number {
  switch (mode) {
    case 'steps':
      return 1;
    case 'difficulty':
      return edge.reaction.difficulty;
    case 'safety':
      return HAZARD_COST[edge.reaction.hazard];
  }
}

function buildRoute(steps: RouteStep[], origin: string): Route {
  const nodes = [origin, ...steps.map((s) => s.to)];
  const reagents = new Set<string>();
  const concepts = new Set<string>();
  let maxHazardIndex = 0;
  const hazardOrder: Reaction['hazard'][] = ['safe', 'special-conditions', 'hazardous', 'do-not-attempt'];

  for (const s of steps) {
    for (const r of s.reagents) reagents.add(r);
    for (const c of s.reaction.concepts) concepts.add(c);
    maxHazardIndex = Math.max(maxHazardIndex, hazardOrder.indexOf(s.reaction.hazard));
  }

  return {
    steps,
    nodes,
    length: steps.length,
    totalDifficulty: steps.reduce((a, s) => a + s.reaction.difficulty, 0),
    requiredReagents: [...reagents],
    concepts: [...concepts],
    needsSpecialConditions: steps.some(
      (s) => s.reaction.evidence === 'conditional' || s.reaction.conditions.catalyst !== undefined,
    ),
    maxHazard: hazardOrder[maxHazardIndex]!,
  };
}

/**
 * Ruta optima entre dos sustancias (§21).
 *
 * Dijkstra sobre el grafo de transformaciones. `mode` decide que significa
 * "optima": menos pasos, menos dificultad conceptual, o menos peligro.
 */
export function findRoute(origin: string, target: string, mode: RouteCost = 'steps'): Route | null {
  if (origin === target) return buildRoute([], origin);

  const dist = new Map<string, number>([[origin, 0]]);
  const prev = new Map<string, Edge>();
  const visited = new Set<string>();
  // Cola de prioridad sencilla: el grafo es pequeno (decenas de nodos) y una
  // busqueda lineal del minimo es mas clara que un monticulo binario.
  const queue = new Set<string>([origin]);

  while (queue.size > 0) {
    let current: string | null = null;
    let best = Infinity;
    for (const node of queue) {
      const d = dist.get(node) ?? Infinity;
      if (d < best) {
        best = d;
        current = node;
      }
    }
    if (current === null) break;
    queue.delete(current);
    visited.add(current);

    if (current === target) break;

    for (const edge of outgoingFrom(current)) {
      if (visited.has(edge.to)) continue;
      const candidate = best + edgeCost(edge, mode);
      if (candidate < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, candidate);
        prev.set(edge.to, edge);
        queue.add(edge.to);
      }
    }
  }

  if (!prev.has(target) && origin !== target) return null;

  const steps: RouteStep[] = [];
  let node = target;
  const guard = new Set<string>();
  while (node !== origin) {
    if (guard.has(node)) return null; // proteccion frente a ciclos
    guard.add(node);
    const edge = prev.get(node);
    if (!edge) return null;
    steps.unshift({
      from: edge.from,
      to: edge.to,
      reaction: edge.reaction,
      reagents: edge.reagents,
      byproducts: edge.byproducts,
    });
    node = edge.from;
  }

  return buildRoute(steps, origin);
}

/**
 * Varias rutas alternativas entre dos sustancias (§21: "Permitir explorar
 * rutas alternativas cuando existan", §42: comparar rutas).
 *
 * Busqueda en profundidad acotada, devolviendo rutas ordenadas por longitud.
 * El limite de profundidad evita la explosion combinatoria y refleja que una
 * sintesis de mas de 6 etapas no es util como material didactico.
 */
export function findAllRoutes(
  origin: string,
  target: string,
  options: { maxDepth?: number; maxRoutes?: number } = {},
): Route[] {
  const maxDepth = options.maxDepth ?? 6;
  const maxRoutes = options.maxRoutes ?? 8;
  const routes: Route[] = [];
  const path: RouteStep[] = [];
  const onPath = new Set<string>([origin]);

  const walk = (node: string): void => {
    if (routes.length >= maxRoutes) return;
    if (node === target && path.length > 0) {
      routes.push(buildRoute([...path], origin));
      return;
    }
    if (path.length >= maxDepth) return;

    for (const edge of outgoingFrom(node)) {
      if (onPath.has(edge.to)) continue; // sin ciclos
      onPath.add(edge.to);
      path.push({
        from: edge.from,
        to: edge.to,
        reaction: edge.reaction,
        reagents: edge.reagents,
        byproducts: edge.byproducts,
      });
      walk(edge.to);
      path.pop();
      onPath.delete(edge.to);
    }
  };

  walk(origin);
  return routes.sort((a, b) => a.length - b.length || a.totalDifficulty - b.totalDifficulty);
}

/**
 * Comparacion de dos rutas (§42).
 */
export interface RouteComparison {
  readonly rows: readonly {
    readonly criterion: string;
    readonly a: string;
    readonly b: string;
    /** 'a', 'b' o null si empatan o no es comparable. */
    readonly better: 'a' | 'b' | null;
  }[];
  readonly summary: string;
}

export function compareRoutes(a: Route, b: Route): RouteComparison {
  const hazardOrder: Reaction['hazard'][] = ['safe', 'special-conditions', 'hazardous', 'do-not-attempt'];
  const hazardLabel: Record<Reaction['hazard'], string> = {
    safe: 'Segura',
    'special-conditions': 'Condiciones especiales',
    hazardous: 'Riesgo relevante',
    'do-not-attempt': 'No realizar fisicamente',
  };

  const rows: RouteComparison['rows'] = [
    {
      criterion: 'Numero de pasos',
      a: String(a.length),
      b: String(b.length),
      better: a.length === b.length ? null : a.length < b.length ? 'a' : 'b',
    },
    {
      criterion: 'Dificultad acumulada',
      a: String(a.totalDifficulty),
      b: String(b.totalDifficulty),
      better:
        a.totalDifficulty === b.totalDifficulty ? null : a.totalDifficulty < b.totalDifficulty ? 'a' : 'b',
    },
    {
      criterion: 'Reactivos necesarios',
      a: a.requiredReagents.join(', ') || '—',
      b: b.requiredReagents.join(', ') || '—',
      better:
        a.requiredReagents.length === b.requiredReagents.length
          ? null
          : a.requiredReagents.length < b.requiredReagents.length
            ? 'a'
            : 'b',
    },
    {
      criterion: 'Condiciones especiales',
      a: a.needsSpecialConditions ? 'Si' : 'No',
      b: b.needsSpecialConditions ? 'Si' : 'No',
      better:
        a.needsSpecialConditions === b.needsSpecialConditions ? null : a.needsSpecialConditions ? 'b' : 'a',
    },
    {
      criterion: 'Peligrosidad maxima',
      a: hazardLabel[a.maxHazard],
      b: hazardLabel[b.maxHazard],
      better:
        a.maxHazard === b.maxHazard
          ? null
          : hazardOrder.indexOf(a.maxHazard) < hazardOrder.indexOf(b.maxHazard)
            ? 'a'
            : 'b',
    },
    {
      criterion: 'Conceptos que ensena',
      a: String(a.concepts.length),
      b: String(b.concepts.length),
      better: null, // mas conceptos no es "mejor": es distinto
    },
  ];

  const aWins = rows.filter((r) => r.better === 'a').length;
  const bWins = rows.filter((r) => r.better === 'b').length;

  let summary: string;
  if (aWins > bWins) {
    summary = `La ruta A es preferible en ${aWins} de los criterios comparables. `;
  } else if (bWins > aWins) {
    summary = `La ruta B es preferible en ${bWins} de los criterios comparables. `;
  } else {
    summary = 'Las dos rutas estan equilibradas: la eleccion depende de que se priorice. ';
  }

  if (a.length !== b.length) {
    const shorter = a.length < b.length ? 'A' : 'B';
    const longer = shorter === 'A' ? 'B' : 'A';
    summary +=
      `La ruta ${shorter} tiene menos etapas, pero eso no la hace automaticamente mejor: ` +
      `la ruta ${longer} puede usar reactivos mas accesibles, condiciones mas suaves o pasar por intermedios utiles.`;
  }

  return { rows, summary };
}

// ---------------------------------------------------------------------------
// Datos para la visualizacion de la red (§22)
// ---------------------------------------------------------------------------

export interface GraphNode {
  readonly id: string;
  readonly label: string;
  readonly compoundClass: string;
  readonly degreeIn: number;
  readonly degreeOut: number;
}

export interface GraphView {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly { from: string; to: string; reactionId: string; label: string }[];
}

/**
 * Subgrafo alrededor de una sustancia, hasta `depth` saltos en ambos sentidos.
 * Es lo que dibuja el mapa de transformaciones sin volcar los 45 nodos de
 * golpe, que seria ilegible.
 */
export function neighbourhood(center: string, depth = 2): GraphView {
  const included = new Set<string>([center]);
  let frontier = new Set<string>([center]);

  for (let d = 0; d < depth; d++) {
    const next = new Set<string>();
    for (const node of frontier) {
      for (const e of outgoingFrom(node)) if (!included.has(e.to)) next.add(e.to);
      for (const e of incomingTo(node)) if (!included.has(e.from)) next.add(e.from);
    }
    for (const n of next) included.add(n);
    frontier = next;
  }

  const edges = EDGES.filter((e) => included.has(e.from) && included.has(e.to)).map((e) => ({
    from: e.from,
    to: e.to,
    reactionId: e.reaction.id,
    label: e.reagents.length ? `+ ${e.reagents.join(' + ')}` : '',
  }));

  const nodes: GraphNode[] = [...included].map((id) => {
    const species = getSpecies(id);
    return {
      id,
      label: species?.names.common ?? species?.names.stock ?? id,
      compoundClass: species?.compoundClass ?? 'other',
      degreeIn: incomingTo(id).length,
      degreeOut: outgoingFrom(id).length,
    };
  });

  return { nodes, edges };
}

/** Grafo completo, para la vista general del mapa. */
export function fullGraph(): GraphView {
  const nodes: GraphNode[] = NODES.map((id) => {
    const species = getSpecies(id);
    return {
      id,
      label: species?.names.common ?? species?.names.stock ?? id,
      compoundClass: species?.compoundClass ?? 'other',
      degreeIn: incomingTo(id).length,
      degreeOut: outgoingFrom(id).length,
    };
  });
  const edges = EDGES.map((e) => ({
    from: e.from,
    to: e.to,
    reactionId: e.reaction.id,
    label: e.reagents.length ? `+ ${e.reagents.join(' + ')}` : '',
  }));
  return { nodes, edges };
}

/** ¿Que elementos comparten origen y destino? Sirve para explicar la ruta. */
export function sharedElements(a: string, b: string): string[] {
  const ea = identityElements(a);
  const eb = identityElements(b);
  return [...ea].filter((e) => eb.has(e)).map((e) => getElement(e)?.name ?? e);
}
