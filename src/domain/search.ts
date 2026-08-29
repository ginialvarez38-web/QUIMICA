/**
 * Universal search and the knowledge graph.
 *
 * §61: one search box. Typing "NaOH" must reach the substance, its properties,
 * its safety data, the reactions it takes part in, the experiments that use it
 * and the courses that teach it. Typing "bureta" must reach the instrument, its
 * calibration procedure, the errors it introduces and the practicals that need
 * it.
 *
 * §60 and §83: the same index is a graph. Every entity declares its relations,
 * so the concept map and the search are two views of one structure rather than
 * two hand-maintained lists.
 */

import { SUBSTANCES, substanceById } from '../data/substances.js';
import { ELEMENTS, CATEGORY_LABEL } from '../data/elements.js';
import { MOLECULES } from '../data/molecules.js';
import { COURSES, allTopicsWithCourse, AREA_LABEL } from '../content/curriculum.js';
import { EQUATIONS } from '../ui/equation.js';
import { HALF_REACTIONS } from '../core/chem/electrochem.js';
import { MECHANISMS } from '../core/chem/kinetics.js';
import { INDICATORS } from '../core/chem/titration.js';
import { INSTRUMENTS } from '../data/instruments.js';
import { CONCEPTS } from '../content/concepts.js';

export type EntityKind =
  | 'sustancia' | 'elemento' | 'molecula' | 'asignatura' | 'tema' | 'concepto'
  | 'ecuacion' | 'instrumento' | 'reaccion' | 'mecanismo' | 'indicador'
  | 'experimento' | 'proyecto';

export const KIND_LABEL: Record<EntityKind, string> = {
  sustancia: 'Sustancia',
  elemento: 'Elemento',
  molecula: 'Molécula',
  asignatura: 'Asignatura',
  tema: 'Tema',
  concepto: 'Concepto',
  ecuacion: 'Ecuación',
  instrumento: 'Instrumento',
  reaccion: 'Semirreacción',
  mecanismo: 'Mecanismo',
  indicador: 'Indicador',
  experimento: 'Experimento',
  proyecto: 'Proyecto',
};

export interface Entity {
  id: string;
  kind: EntityKind;
  title: string;
  subtitle?: string;
  /** Everything searchable about this entity, lower-cased and accent-folded. */
  keywords: string[];
  href: string;
  /** Related entity ids — the graph edges (§83). */
  related: string[];
  /** Sort weight when several entities match equally well. */
  weight?: number;
}

const fold = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------------------------------------------------------------------------
// Index construction
// ---------------------------------------------------------------------------

function buildIndex(): Entity[] {
  const out: Entity[] = [];

  // --- substances ---------------------------------------------------------
  for (const s of SUBSTANCES) {
    const related: string[] = [
      ...(s.reactsWith ?? []).map((r) => `sustancia:${r}`),
      ...(s.courses ?? []).map((c) => `asignatura:${c}`),
      ...(s.moleculeId ? [`molecula:${s.moleculeId}`] : []),
      ...Object.keys(s.composition).map((e) => `elemento:${e}`),
    ];
    out.push({
      id: `sustancia:${s.id}`,
      kind: 'sustancia',
      title: s.name,
      subtitle: `${s.formula} · ${s.molarMass.toFixed(2)} g·mol⁻¹`,
      keywords: [
        s.name, s.formula, s.id, ...s.synonyms, s.casNumber ?? '',
        ...s.categories, s.role ?? '',
        ...(s.acidBase ? ['acido', 'base', 'pka', 'ph', ...s.acidBase.conjugates] : []),
        ...(s.redox ? ['redox', 'oxidacion', 'reduccion', 'potencial'] : []),
        ...(s.spectra?.uv ? ['uv', 'vis', 'absorbancia', 'espectro'] : []),
        ...(s.spectra?.ir ? ['ir', 'infrarrojo', 'espectro'] : []),
        ...s.safety.ghs, ...s.safety.hazards.map((hz) => hz.code),
      ].map(fold),
      href: `#/mundo/sustancia/${s.id}`,
      related,
      weight: 10,
    });
  }

  // --- elements -----------------------------------------------------------
  for (const e of ELEMENTS) {
    out.push({
      id: `elemento:${e.symbol}`,
      kind: 'elemento',
      title: `${e.name} (${e.symbol})`,
      subtitle: `Z = ${e.Z} · ${CATEGORY_LABEL[e.category]}`,
      keywords: [
        e.name, e.symbol, String(e.Z), e.category, e.config, e.block,
        `grupo ${e.group ?? ''}`, `periodo ${e.period}`,
        'tabla periodica', 'elemento',
      ].map(fold),
      href: `#/mundo/elemento/${e.symbol}`,
      related: SUBSTANCES.filter((s) => e.symbol in s.composition).map((s) => `sustancia:${s.id}`),
      weight: 9,
    });
  }

  // --- molecules ----------------------------------------------------------
  for (const m of MOLECULES) {
    out.push({
      id: `molecula:${m.id}`,
      kind: 'molecula',
      title: m.name,
      subtitle: `${m.formula} · ${m.atoms.length} átomos${m.pointGroup ? ` · ${m.pointGroup}` : ''}`,
      keywords: [m.name, m.formula, m.id, 'molecula', '3d', 'geometria', m.pointGroup ?? ''].map(fold),
      href: `#/mundo/molecula/${m.id}`,
      related: SUBSTANCES.filter((s) => s.moleculeId === m.id).map((s) => `sustancia:${s.id}`),
      weight: 8,
    });
  }

  // --- courses ------------------------------------------------------------
  for (const c of COURSES) {
    out.push({
      id: `asignatura:${c.id}`,
      kind: 'asignatura',
      title: c.name,
      subtitle: `${c.code} · ${AREA_LABEL[c.area]} · cuatrimestre ${c.term}`,
      keywords: [
        c.name, c.code, c.id, AREA_LABEL[c.area], c.description,
        ...c.objectives, `cuatrimestre ${c.term}`, c.elective ? 'electiva' : 'obligatoria',
      ].map(fold),
      href: `#/universidad/${c.id}`,
      related: [
        ...c.prerequisites.map((p) => `asignatura:${p}`),
        ...(c.substances ?? []).map((s) => `sustancia:${s}`),
        ...(c.instruments ?? []).map((i) => `instrumento:${i}`),
      ],
      weight: 12,
    });
  }

  // --- topics -------------------------------------------------------------
  for (const { course, unit, topic } of allTopicsWithCourse()) {
    out.push({
      id: `tema:${topic.id}`,
      kind: 'tema',
      title: topic.title,
      subtitle: `${course.name} · ${unit.title}`,
      keywords: [topic.title, unit.title, course.name, ...topic.concepts].map(fold),
      href: `#/universidad/${course.id}/${encodeURIComponent(topic.id)}`,
      related: [
        `asignatura:${course.id}`,
        ...topic.concepts.map((c) => `concepto:${c}`),
      ],
      weight: 6,
    });
  }

  // --- concepts -----------------------------------------------------------
  for (const c of CONCEPTS) {
    out.push({
      id: `concepto:${c.id}`,
      kind: 'concepto',
      title: c.name,
      subtitle: c.short,
      keywords: [c.name, c.id, c.short, ...(c.aliases ?? [])].map(fold),
      href: `#/universidad/concepto/${c.id}`,
      related: [
        ...c.dependsOn.map((d) => `concepto:${d}`),
        ...(c.substances ?? []).map((s) => `sustancia:${s}`),
        ...(c.equations ?? []).map((e) => `ecuacion:${e}`),
      ],
      weight: 7,
    });
  }

  // --- equations ----------------------------------------------------------
  for (const e of EQUATIONS) {
    out.push({
      id: `ecuacion:${e.id}`,
      kind: 'ecuacion',
      title: e.name,
      subtitle: e.tex.replace(/\\[a-zA-Z]+|[{}]/g, ' ').replace(/\s+/g, ' ').trim(),
      keywords: [e.name, e.id, e.context, ...e.variables.map((v) => v.name)].map(fold),
      href: `#/universidad/ecuacion/${e.id}`,
      related: e.courses.map((c) => `asignatura:${c}`),
      weight: 8,
    });
  }

  // --- instruments --------------------------------------------------------
  for (const i of INSTRUMENTS) {
    out.push({
      id: `instrumento:${i.id}`,
      kind: 'instrumento',
      title: i.name,
      subtitle: i.principle,
      keywords: [
        i.name, i.id, i.principle, i.category,
        ...i.synonyms, ...i.components.map((c) => c.name),
        'calibracion', 'error', 'medida',
      ].map(fold),
      href: `#/laboratorio/instrumento/${i.id}`,
      related: COURSES.filter((c) => c.instruments?.includes(i.id)).map((c) => `asignatura:${c.id}`),
      weight: 11,
    });
  }

  // --- half reactions -----------------------------------------------------
  for (const r of HALF_REACTIONS) {
    out.push({
      id: `reaccion:${r.id}`,
      kind: 'reaccion',
      title: r.equation,
      subtitle: `E° = ${r.E0 >= 0 ? '+' : ''}${r.E0.toFixed(3)} V · n = ${r.n}`,
      keywords: [r.id, r.equation, r.category, r.notes ?? '', 'potencial', 'redox', 'nernst'].map(fold),
      href: `#/mundo/redox/${encodeURIComponent(r.id)}`,
      related: [],
      weight: 5,
    });
  }

  // --- mechanisms and indicators -----------------------------------------
  for (const m of MECHANISMS) {
    out.push({
      id: `mecanismo:${m.id}`,
      kind: 'mecanismo',
      title: m.name,
      subtitle: m.overall,
      keywords: [m.name, m.id, m.overall ?? '', 'cinetica', 'velocidad', 'mecanismo'].map(fold),
      href: `#/laboratorio/cinetica/${m.id}`,
      related: [],
      weight: 6,
    });
  }
  for (const i of INDICATORS) {
    out.push({
      id: `indicador:${i.id}`,
      kind: 'indicador',
      title: i.name,
      subtitle: `Viraje pH ${i.range[0]}–${i.range[1]} · ${i.acidColour} → ${i.baseColour}`,
      keywords: [i.name, i.id, 'indicador', 'viraje', 'valoracion', i.acidColour, i.baseColour].map(fold),
      href: `#/laboratorio/titulacion?indicador=${i.id}`,
      related: [],
      weight: 5,
    });
  }

  return out;
}

let indexCache: Entity[] | null = null;
export const entityIndex = (): Entity[] => (indexCache ??= buildIndex());

const byId = (): Map<string, Entity> => {
  entityIndex();
  return (byIdCache ??= new Map(entityIndex().map((e) => [e.id, e])));
};
let byIdCache: Map<string, Entity> | null = null;

export const entityById = (id: string): Entity | undefined => byId().get(id);

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchResult {
  entity: Entity;
  score: number;
  /** Which keyword matched, for highlighting. */
  matched: string;
}

/**
 * Rank entities against a query.
 *
 * Scoring is deliberately simple and explainable: an exact title or formula
 * match beats a prefix, which beats a substring, which beats a keyword hit,
 * with the entity's own weight breaking ties. That makes "NaOH" put the
 * substance first and "bureta" put the instrument first, which is what §61
 * actually asks for.
 */
export function search(query: string, opts: { limit?: number; kinds?: EntityKind[] } = {}): SearchResult[] {
  const q = fold(query.trim());
  if (q.length === 0) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const results: SearchResult[] = [];
  for (const entity of entityIndex()) {
    if (opts.kinds && !opts.kinds.includes(entity.kind)) continue;

    let best = 0;
    let matched = '';
    const title = fold(entity.title);

    if (title === q) { best = 1000; matched = entity.title; }
    else if (title.startsWith(q)) { best = 700; matched = entity.title; }
    else {
      for (const kw of entity.keywords) {
        if (!kw) continue;
        let score = 0;
        if (kw === q) score = 900;
        else if (kw.startsWith(q)) score = 500;
        else if (kw.includes(q)) score = 260;
        else if (terms.length > 1 && terms.every((t) => kw.includes(t))) score = 180;
        if (score > best) { best = score; matched = kw; }
      }
      if (best === 0 && title.includes(q)) { best = 300; matched = entity.title; }
    }

    if (best > 0) results.push({ entity, score: best + (entity.weight ?? 0), matched });
  }

  results.sort((a, b) => b.score - a.score || a.entity.title.localeCompare(b.entity.title));
  return results.slice(0, opts.limit ?? 30);
}

/** Group results by kind, in the order the sections should appear. */
export function groupResults(results: SearchResult[]): Array<{ kind: EntityKind; items: SearchResult[] }> {
  const order: EntityKind[] = [
    'sustancia', 'elemento', 'molecula', 'instrumento', 'asignatura', 'tema',
    'concepto', 'ecuacion', 'reaccion', 'mecanismo', 'indicador', 'experimento', 'proyecto',
  ];
  const map = new Map<EntityKind, SearchResult[]>();
  for (const r of results) {
    const list = map.get(r.entity.kind) ?? [];
    list.push(r);
    map.set(r.entity.kind, list);
  }
  return order
    .filter((k) => map.has(k))
    .map((kind) => ({ kind, items: map.get(kind)! }));
}

// ---------------------------------------------------------------------------
// Graph traversal (§60, §83)
// ---------------------------------------------------------------------------

export interface GraphNode {
  entity: Entity;
  /** Distance in edges from the origin. */
  depth: number;
}

/** Neighbours of an entity, following the relations in both directions. */
export function neighbours(id: string): Entity[] {
  const index = entityIndex();
  const self = entityById(id);
  const out = new Map<string, Entity>();

  for (const relId of self?.related ?? []) {
    const e = entityById(relId);
    if (e) out.set(e.id, e);
  }
  for (const e of index) {
    if (e.id !== id && e.related.includes(id)) out.set(e.id, e);
  }
  return [...out.values()];
}

/** Breadth-first neighbourhood, for drawing the concept map around a node. */
export function neighbourhood(id: string, maxDepth = 2, maxNodes = 40): GraphNode[] {
  const seen = new Set<string>([id]);
  const origin = entityById(id);
  if (!origin) return [];

  const out: GraphNode[] = [{ entity: origin, depth: 0 }];
  let frontier = [id];

  for (let depth = 1; depth <= maxDepth && out.length < maxNodes; depth++) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      for (const n of neighbours(nodeId)) {
        if (seen.has(n.id) || out.length >= maxNodes) continue;
        seen.add(n.id);
        out.push({ entity: n, depth });
        next.push(n.id);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return out;
}

/** Every edge among a set of nodes, for the graph renderer. */
export function edgesAmong(nodes: GraphNode[]): Array<[string, string]> {
  const ids = new Set(nodes.map((n) => n.entity.id));
  const edges = new Set<string>();
  for (const { entity } of nodes) {
    for (const rel of entity.related) {
      if (!ids.has(rel)) continue;
      const key = [entity.id, rel].sort().join('|');
      edges.add(key);
    }
  }
  return [...edges].map((k) => k.split('|') as [string, string]);
}

/**
 * Everything CHEMIA knows about one substance, gathered across modules — the
 * "NaOH" answer of §61 assembled in one call.
 */
export function substanceDossier(substanceId: string): {
  courses: string[];
  reactsWith: string[];
  relatedTopics: Array<{ title: string; href: string }>;
  equations: string[];
} | null {
  const s = substanceById(substanceId);
  if (!s) return null;
  const topics = allTopicsWithCourse()
    .filter(({ course }) => course.substances?.includes(substanceId))
    .slice(0, 12)
    .map(({ course, topic }) => ({
      title: topic.title,
      href: `#/universidad/${course.id}/${encodeURIComponent(topic.id)}`,
    }));

  return {
    courses: s.courses ?? [],
    reactsWith: s.reactsWith ?? [],
    relatedTopics: topics,
    equations: s.acidBase ? ['henderson'] : s.redox ? ['nernst'] : [],
  };
}
