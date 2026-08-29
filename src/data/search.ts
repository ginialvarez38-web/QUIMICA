/**
 * Buscador de la biblioteca quimica (§3).
 *
 * El requisito del brief es explicito: buscar "calcio", "Ca", "oxido de
 * calcio" o "CaO" debe llevar al mismo sitio. Eso obliga a indexar cada
 * sustancia por su formula, sus cuatro nombres (comun, Stock, sistematica,
 * tradicional), sus sinonimos y los nombres de sus elementos, en espanol y en
 * ingles, con y sin acentos.
 *
 * El indice se construye una sola vez al cargar y la busqueda es lineal sobre
 * unos cientos de entradas: sobra de rapido y evita meter una dependencia de
 * busqueda difusa.
 */

import type { Element, Ion, Species } from '../core/types.js';
import { SPECIES } from './species.js';
import { ELEMENTS, normalizeName } from './elements.js';
import { IONS } from './ions.js';

export type SearchKind = 'species' | 'element' | 'ion';

export interface SearchResult {
  readonly kind: SearchKind;
  readonly id: string;
  readonly formula: string;
  readonly label: string;
  readonly sublabel: string;
  readonly tags: readonly string[];
  /** Puntuacion: mayor es mejor coincidencia. */
  readonly score: number;
  readonly species?: Species;
  readonly element?: Element;
  readonly ion?: Ion;
}

interface IndexEntry {
  readonly kind: SearchKind;
  readonly id: string;
  readonly formula: string;
  readonly label: string;
  readonly sublabel: string;
  readonly tags: readonly string[];
  /** Terminos PROPIOS: formula, nombres y sinonimos de la entrada. */
  readonly terms: readonly string[];
  /**
   * Terminos SECUNDARIOS: nombres de los elementos que la componen.
   * Se puntuan mas bajo, porque buscar "calcio" debe llevar primero al calcio
   * y al oxido de calcio, no al fosfato de calcio solo porque tambien lo
   * contiene.
   */
  readonly weakTerms: readonly string[];
  readonly species?: Species;
  readonly element?: Element;
  readonly ion?: Ion;
}

function buildIndex(): IndexEntry[] {
  const entries: IndexEntry[] = [];

  // --- Sustancias --------------------------------------------------------
  for (const s of SPECIES) {
    const terms = new Set<string>();
    terms.add(normalizeName(s.formula));
    // La formula sin subindices tambien debe encontrarla: "h2o" y "h₂o".
    terms.add(normalizeName(s.formula.replace(/[0-9()·]/g, '')));
    for (const syn of s.synonyms) terms.add(normalizeName(syn));
    for (const n of [s.names.common, s.names.stock, s.names.systematic, s.names.traditional]) {
      if (n) terms.add(normalizeName(n));
    }

    // Nombres de los elementos que la componen: buscar "calcio" tambien
    // encuentra el CaO, pero con menos peso que su propio nombre.
    const weakTerms = new Set<string>();
    for (const symbol of s.composition.keys()) {
      const el = ELEMENTS.find((e) => e.symbol === symbol);
      if (el) {
        weakTerms.add(normalizeName(el.name));
        weakTerms.add(normalizeName(el.nameEn));
      }
    }

    const label = s.names.common ?? s.names.stock ?? s.names.systematic ?? s.formula;
    entries.push({
      kind: 'species',
      id: s.id,
      formula: s.formula,
      label,
      sublabel: s.names.stock && s.names.stock !== label ? s.names.stock : s.compoundClass,
      tags: s.tags,
      terms: [...terms],
      weakTerms: [...weakTerms].filter((t) => !terms.has(t)),
      species: s,
    });
  }

  // --- Elementos ---------------------------------------------------------
  for (const el of ELEMENTS) {
    entries.push({
      kind: 'element',
      id: `element:${el.symbol}`,
      formula: el.symbol,
      label: el.name,
      sublabel: `Elemento ${el.Z} · ${el.symbol}`,
      tags: ['element', el.category],
      terms: [
        normalizeName(el.symbol),
        normalizeName(el.name),
        normalizeName(el.nameEn),
        String(el.Z),
      ],
      weakTerms: [],
      element: el,
    });
  }

  // --- Iones -------------------------------------------------------------
  for (const ion of IONS) {
    const charge = `${Math.abs(ion.charge) > 1 ? Math.abs(ion.charge) : ''}${ion.charge > 0 ? '+' : '-'}`;
    entries.push({
      kind: 'ion',
      id: `ion:${ion.id}`,
      formula: `${ion.formula}${charge}`,
      label: `Ion ${ion.name}`,
      sublabel: `${ion.formula}${charge} · carga ${ion.charge > 0 ? '+' : ''}${ion.charge}`,
      tags: ['ion', ion.charge > 0 ? 'cation' : 'anion'],
      terms: [
        normalizeName(ion.formula),
        normalizeName(ion.name),
        normalizeName(ion.nameEn),
        ...(ion.traditionalName ? [normalizeName(ion.traditionalName)] : []),
        ...ion.synonyms.map(normalizeName),
      ],
      weakTerms: [],
      ion,
    });
  }

  return entries;
}

const INDEX: readonly IndexEntry[] = buildIndex();

/**
 * Puntua una entrada frente a la consulta.
 * Coincidencia exacta > empieza por > contiene. La coincidencia exacta de
 * FORMULA pesa mas que la de nombre, porque quien escribe "CaO" sabe lo que
 * busca.
 */
function score(entry: IndexEntry, query: string): number {
  let best = 0;
  const formulaNorm = normalizeName(entry.formula);

  if (formulaNorm === query) best = Math.max(best, 120);

  for (const term of entry.terms) {
    if (term === query) best = Math.max(best, 100);
    else if (term.startsWith(query)) best = Math.max(best, 70 - Math.min(20, term.length - query.length));
    else if (term.includes(query)) best = Math.max(best, 40 - Math.min(20, term.length - query.length));
  }

  // Coincidencia por elemento constituyente: cuenta, pero muy por debajo de
  // una coincidencia con el nombre propio de la sustancia.
  if (best < 30) {
    for (const term of entry.weakTerms) {
      if (term === query) best = Math.max(best, 25);
      else if (term.startsWith(query)) best = Math.max(best, 15);
    }
  }

  // Desempate: las sustancias por delante de los iones sueltos, y las
  // entradas con nombre comun por delante de las que no lo tienen.
  if (best > 0) {
    if (entry.kind === 'species') best += 6;
    if (entry.kind === 'element') best += 3;
  }

  return best;
}

export interface SearchOptions {
  /** Filtra por etiqueta de categoria: 'acid', 'base', 'oxide'... */
  readonly tag?: string;
  readonly kind?: SearchKind;
  readonly limit?: number;
}

/** Busca en la biblioteca. Devuelve resultados ordenados por relevancia. */
export function search(query: string, options: SearchOptions = {}): SearchResult[] {
  const q = normalizeName(query);
  const limit = options.limit ?? 40;

  let candidates = INDEX;
  if (options.tag) candidates = candidates.filter((e) => e.tags.includes(options.tag!));
  if (options.kind) candidates = candidates.filter((e) => e.kind === options.kind);

  // Sin consulta, se devuelve el catalogo de la categoria.
  if (!q) {
    return candidates.slice(0, limit).map((e) => toResult(e, 0));
  }

  const scored: SearchResult[] = [];
  for (const entry of candidates) {
    const s = score(entry, q);
    if (s > 0) scored.push(toResult(entry, s));
  }

  scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  // Una sustancia simple aparece a la vez como especie de la biblioteca y como
  // elemento de la tabla periodica. Se muestra una sola vez: la de mayor
  // puntuacion, que ya esta primera tras ordenar.
  const seen = new Set<string>();
  const unique: SearchResult[] = [];
  for (const r of scored) {
    const key = `${r.formula}|${r.kind === 'ion' ? 'ion' : 'substance'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
    if (unique.length >= limit) break;
  }
  return unique;
}

function toResult(entry: IndexEntry, score: number): SearchResult {
  return {
    kind: entry.kind,
    id: entry.id,
    formula: entry.formula,
    label: entry.label,
    sublabel: entry.sublabel,
    tags: entry.tags,
    score,
    ...(entry.species ? { species: entry.species } : {}),
    ...(entry.element ? { element: entry.element } : {}),
    ...(entry.ion ? { ion: entry.ion } : {}),
  };
}

/** Categorias de la biblioteca (§3), con su etiqueta y su filtro. */
export const LIBRARY_CATEGORIES: readonly { id: string; label: string; tag?: string; kind?: SearchKind }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'elements', label: 'Elementos', kind: 'element' },
  { id: 'ions', label: 'Iones', kind: 'ion' },
  { id: 'acids', label: 'Acidos', tag: 'acid' },
  { id: 'bases', label: 'Bases', tag: 'base' },
  { id: 'salts', label: 'Sales', tag: 'salt' },
  { id: 'oxides', label: 'Oxidos', tag: 'oxide' },
  { id: 'hydrides', label: 'Hidruros', tag: 'hydride' },
  { id: 'organic', label: 'Organicos', tag: 'organic' },
  { id: 'solvents', label: 'Disolventes', tag: 'solvent' },
  { id: 'gases', label: 'Gases', tag: 'gas' },
  { id: 'minerals', label: 'Minerales', tag: 'mineral' },
  { id: 'industrial', label: 'Industriales', tag: 'industrial' },
];

/** Cuantas entradas hay en cada categoria, para los contadores de la UI. */
export function categoryCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const cat of LIBRARY_CATEGORIES) {
    const results = search('', { ...(cat.tag ? { tag: cat.tag } : {}), ...(cat.kind ? { kind: cat.kind } : {}), limit: 10000 });
    counts.set(cat.id, cat.id === 'all' ? INDEX.length : results.length);
  }
  return counts;
}

export const INDEX_SIZE = INDEX.length;
