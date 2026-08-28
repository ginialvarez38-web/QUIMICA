/**
 * Hash-based routing.
 *
 * Deep links matter here: a lesson, a substance, an element, a titration setup
 * and a research project all need to be linkable, so a student can send a
 * colleague "look at this" and land on the same screen with the same state.
 */

import { signal, type Signal } from './reactive.js';

export interface Route {
  /** Path segments, e.g. ['mundo', 'elemento', 'Fe']. */
  segments: string[];
  /** Query parameters after '?'. */
  params: URLSearchParams;
  /** The raw hash, without the leading '#'. */
  raw: string;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  return {
    segments: path.split('/').filter(Boolean).map(decodeURIComponent),
    params: new URLSearchParams(query ?? ''),
    raw,
  };
}

export const route: Signal<Route> = signal(
  parse(typeof location !== 'undefined' ? location.hash : ''),
  (a, b) => a.raw === b.raw,
);

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => route.set(parse(location.hash)));
}

/** Navigate. `replace` avoids adding a history entry (for filter changes). */
export function navigate(path: string, opts: { replace?: boolean; params?: Record<string, string | number | undefined> } = {}): void {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.params ?? {})) {
    if (v !== undefined && v !== '') query.set(k, String(v));
  }
  const qs = query.toString();
  const target = `#/${path.replace(/^\//, '')}${qs ? `?${qs}` : ''}`;
  if (opts.replace) history.replaceState(null, '', target);
  else location.hash = target;
  route.set(parse(target));
}

/** Build an href for a link, without navigating. */
export function href(path: string, params?: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== '') query.set(k, String(v));
  }
  const qs = query.toString();
  return `#/${path.replace(/^\//, '')}${qs ? `?${qs}` : ''}`;
}

/** Update one query parameter in place, keeping the rest. */
export function setParam(key: string, value: string | number | undefined): void {
  const current = route.peek();
  const params = new URLSearchParams(current.params);
  if (value === undefined || value === '') params.delete(key);
  else params.set(key, String(value));
  const qs = params.toString();
  const target = `#/${current.segments.join('/')}${qs ? `?${qs}` : ''}`;
  history.replaceState(null, '', target);
  route.set(parse(target));
}

export const currentSection = (): string => route().segments[0] ?? 'inicio';
