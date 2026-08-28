/**
 * Icon set.
 *
 * One consistent family, drawn on a 24-unit grid with a 1.6 stroke: geometric,
 * unfilled, no decorative flourishes. Icons that name laboratory objects are
 * drawn as those objects (a burette is a burette, not a generic "flask") so
 * they carry information rather than colour.
 */

import { svg } from './dom.js';

export type IconName =
  | 'inicio' | 'universidad' | 'laboratorio' | 'mundo' | 'industria' | 'datos'
  | 'investigacion' | 'perfil' | 'buscar' | 'menu' | 'cerrar' | 'chevron'
  | 'chevron-derecha' | 'flecha-derecha' | 'mas' | 'menos' | 'reproducir'
  | 'pausa' | 'reiniciar' | 'ajustes' | 'info' | 'aviso' | 'peligro' | 'ok'
  | 'molecula' | 'tabla-periodica' | 'matraz' | 'bureta' | 'vaso' | 'pipeta'
  | 'balanza' | 'phmetro' | 'espectro' | 'cromatograma' | 'grafico' | 'tabla'
  | 'cuaderno' | 'reaccion' | 'equilibrio' | 'termometro' | 'reactor' | 'valvula'
  | 'bomba' | 'sensor' | 'alarma' | 'calibrar' | 'exportar' | 'copiar'
  | 'expandir' | 'contraer' | 'tema-claro' | 'tema-oscuro' | 'tutor' | 'pista'
  | 'bloqueado' | 'completado' | 'progreso' | 'grafo' | 'capas' | 'medir'
  | 'zoom' | 'residuo' | 'epp' | 'temporizador' | 'agitador';

const P: Record<IconName, string> = {
  inicio: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-6h5v6',
  universidad: 'M12 3 2.5 8 12 13l9.5-5L12 3ZM6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5M21.5 8v6',
  laboratorio: 'M9 3h6M10 3v6.2L4.6 18.4A2 2 0 0 0 6.3 21.5h11.4a2 2 0 0 0 1.7-3.1L14 9.2V3M7.2 14.5h9.6',
  mundo: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.2 9.5h17.6M3.2 14.5h17.6M12 3c-2.4 2.5-3.6 5.5-3.6 9s1.2 6.5 3.6 9c2.4-2.5 3.6-5.5 3.6-9S14.4 5.5 12 3Z',
  industria: 'M3 21V10l6 4V10l6 4V6l6 4v11H3ZM3 21h18M7 17v1.5M12 17v1.5M17 17v1.5',
  datos: 'M4 20V9M9.3 20V4M14.7 20v-8M20 20v-5M3 21h18',
  investigacion: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.2 15.2 21 21M8 10.5h5M10.5 8v5',
  perfil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM16 16l5 5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  cerrar: 'M6 6l12 12M18 6 6 18',
  chevron: 'm6 9 6 6 6-6',
  'chevron-derecha': 'm9 6 6 6-6 6',
  'flecha-derecha': 'M4 12h15M13 6l6 6-6 6',
  mas: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  reproducir: 'M7 4.5v15l13-7.5-13-7.5Z',
  pausa: 'M8.5 4.5v15M15.5 4.5v15',
  reiniciar: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5',
  ajustes: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.6v.6',
  aviso: 'M12 3.5 1.8 20.5h20.4L12 3.5ZM12 10v4.5M12 17.6v.6',
  peligro: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5v6M12 16.4v.6',
  ok: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12.2l2.8 2.8L16.2 9.6',
  molecula: 'M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM5.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM10.4 10.2 7.1 15.3M13.6 10.2l3.3 5.1M8 17.5h8',
  'tabla-periodica': 'M3.5 4.5h4v4h-4v-4ZM16.5 4.5h4v4h-4v-4ZM3.5 11h4v4h-4v-4ZM10 11h4v4h-4v-4ZM16.5 11h4v4h-4v-4ZM3.5 17.5h4v2h-4v-2ZM10 17.5h4v2h-4v-2ZM16.5 17.5h4v2h-4v-2Z',
  matraz: 'M9.5 3h5M10.5 3v6L5.2 18.6A1.8 1.8 0 0 0 6.8 21.3h10.4a1.8 1.8 0 0 0 1.6-2.7L13.5 9V3M7.6 15h8.8',
  bureta: 'M10 2.5h4M10.8 2.5v14.8c0 .6.2 1.1.6 1.5l.6.7 .6-.7c.4-.4.6-.9.6-1.5V2.5M8.6 6h1.6M8.6 9h1.6M8.6 12h1.6M8.6 15h1.6M12 19.5v2',
  vaso: 'M6 4.5h12l-1.3 15.2a1.6 1.6 0 0 1-1.6 1.5H8.9a1.6 1.6 0 0 1-1.6-1.5L6 4.5ZM6.7 12.5h10.6',
  pipeta: 'M12 2.5c-1.4 2-2.2 3.5-2.2 4.6 0 .9.8 1.6 2.2 1.6s2.2-.7 2.2-1.6c0-1.1-.8-2.6-2.2-4.6ZM11 8.7v9.6c0 .6.4 1.2 1 1.2s1-.6 1-1.2V8.7M12 19.5v2',
  balanza: 'M12 4.5v13M8 4.5h8M4 21h16M6.5 21v-3.5h11V21M3 11l3-6 3 6a3 3 0 0 1-6 0ZM15 11l3-6 3 6a3 3 0 0 1-6 0Z',
  phmetro: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 12l4-4M12 12v.01M7 12h1M16 12h1M12 7v1',
  espectro: 'M3 20h18M4.5 20V9M8 20V5M11.5 20v-9M15 20V7.5M18.5 20v-6',
  cromatograma: 'M3 18h18M3 18c2.2 0 2.4-9 4-9s1.9 6 3.2 6 1.6-11 3.1-11 1.8 8 3 8 1.5-2 2.7-2',
  grafico: 'M3 20h18M3 20V4M6.5 15.5l4-5 3.5 3L20 6',
  tabla: 'M3.5 4.5h17v15h-17v-15ZM3.5 9.5h17M3.5 14.5h17M9.5 4.5v15M15 4.5v15',
  cuaderno: 'M6 3.5h12a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1ZM5 8h3M5 12h3M5 16h3M11 8h5M11 12h5M11 16h3',
  reaccion: 'M4 8h11M12 5l3 3-3 3M20 16H9M12 13l-3 3 3 3',
  equilibrio: 'M4 9h13M14 6.5 17 9l-3 2.5M20 15H7M10 12.5 7 15l3 2.5',
  termometro: 'M12 15.2V5a2 2 0 1 1 4 0v10.2a4 4 0 1 1-4 0ZM14 18.5v.01M14 9h2M14 12h2',
  reactor: 'M8 3.5h8M8 3.5v3.2a6 6 0 0 0-2 4.5v6.3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-6.3a6 6 0 0 0-2-4.5V3.5M6 13.5h12M12 3.5v3',
  valvula: 'M12 12 4.5 7.5v9L12 12ZM12 12l7.5-4.5v9L12 12ZM12 12V6M9 6h6',
  bomba: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM12 12l4.5-2.6M2.5 12H5M19 12h2.5M12 2.5V5',
  sensor: 'M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM12 14.5V21M8.4 8.4a5 5 0 0 1 7.2 0M5.8 5.8a8.6 8.6 0 0 1 12.4 0',
  alarma: 'M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5ZM10.3 19.5a2 2 0 0 0 3.4 0',
  calibrar: 'M3 12h4l2.5-7 4 14L16 12h5',
  exportar: 'M12 3v11M8 10.5l4 3.5 4-3.5M4.5 16.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3',
  copiar: 'M8.5 8.5h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1ZM4.5 15.5h-1a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  expandir: 'M9 3.5H3.5V9M15 3.5h5.5V9M9 20.5H3.5V15M15 20.5h5.5V15',
  contraer: 'M3.5 8.5H9V3M20.5 8.5H15V3M3.5 15.5H9V21M20.5 15.5H15V21',
  'tema-claro': 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8',
  'tema-oscuro': 'M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a6.6 6.6 0 0 0 10.8 10.8Z',
  tutor: 'M12 3 2.5 7.5 12 12l9.5-4.5L12 3ZM5.5 9.6v4.9c0 2 2.9 3.5 6.5 3.5s6.5-1.5 6.5-3.5V9.6M12 18v3',
  pista: 'M9.5 18.5h5M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2h5c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z',
  bloqueado: 'M6.5 10.5h11a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3',
  completado: 'M20.5 11.2V12a8.5 8.5 0 1 1-5-7.8M21 5 12 14l-2.7-2.7',
  progreso: 'M12 3a9 9 0 1 0 9 9M12 3v9l6.4 6.4',
  grafo: 'M6 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM12 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8.5 5.5h7M7 7.6l3.7 8M17 7.6l-3.7 8',
  capas: 'M12 3 2.5 8 12 13l9.5-5L12 3ZM2.5 12.5 12 17.5l9.5-5M2.5 17 12 22l9.5-5',
  medir: 'M3.5 9h17v6h-17V9ZM7 9v3M10.5 9v2M14 9v3M17.5 9v2',
  zoom: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM16 16l5 5M8 11h6M11 8v6',
  residuo: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6',
  epp: 'M4 9.5c0-3.6 3.6-6 8-6s8 2.4 8 6M2.5 11.5h19M4.5 11.5v2a3 3 0 0 0 3 3h2M19.5 11.5v2a3 3 0 0 1-3 3h-2M9.5 16.5h5',
  temporizador: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2.5M9 2.5h6',
  agitador: 'M6 7.5h12l-1 11.5a2 2 0 0 1-2 1.8H9a2 2 0 0 1-2-1.8L6 7.5ZM9.5 16.5h5M12 3.5v4',
};

/** Icons that need a filled shape rather than a stroke. */
const FILLED = new Set<IconName>(['reproducir']);

export function icon(name: IconName, opts: { size?: number; class?: string; title?: string } = {}): SVGSVGElement {
  const size = opts.size ?? 18;
  const filled = FILLED.has(name);
  const node = svg('svg', {
    viewBox: '0 0 24 24',
    width: size, height: size,
    fill: filled ? 'currentColor' : 'none',
    stroke: filled ? 'none' : 'currentColor',
    'stroke-width': 1.6,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: opts.class,
    'aria-hidden': opts.title ? undefined : 'true',
    role: opts.title ? 'img' : undefined,
  });
  if (opts.title) node.appendChild(svg('title', {}, opts.title));
  node.appendChild(svg('path', { d: P[name] }));
  return node;
}

/**
 * GHS hazard pictograms — the red diamond with its black symbol.
 * Drawn rather than imported so they scale cleanly and follow the theme, and
 * because §41 requires the hazard information to be present wherever a
 * substance appears.
 */
const GHS_SYMBOL: Record<string, { path: string; label: string }> = {
  corrosivo: {
    label: 'Corrosión',
    path: 'M20 30h9l-3 8M20 30l-6 8h6M31 32l4 6M36 44a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 44a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM10 46h30M16 30h6v4h-6z',
  },
  inflamable: {
    label: 'Llama',
    path: 'M25 12c1 6-3 8-3 13a6 6 0 0 0 12 0c0-3-2-5-3-8-2 5-6 2-6-5ZM19 26c-2 3-3 5-3 8a9 9 0 0 0 18 0c0-2-1-4-2-6',
  },
  comburente: {
    label: 'Llama sobre círculo',
    path: 'M25 14c1 5-2 7-2 11a5 5 0 0 0 10 0c0-3-2-4-3-7-1 4-5 2-5-4ZM14 30a11 11 0 0 0 22 0M14 30h22',
  },
  'toxico-agudo': {
    label: 'Calavera y tibias',
    path: 'M25 14a10 10 0 0 0-10 10c0 4 2 6 4 8v4h12v-4c2-2 4-4 4-8a10 10 0 0 0-10-10ZM21 24a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM29 24a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM23 30h4M14 40l22 6M36 40l-22 6',
  },
  irritante: {
    label: 'Signo de exclamación',
    path: 'M25 14v18M25 37v3',
  },
  'peligro-salud': {
    label: 'Peligro para la salud',
    path: 'M25 12a8 8 0 0 0-8 8v12a8 8 0 0 0 16 0V20a8 8 0 0 0-8-8ZM25 20v8M20 24h10M13 42h24',
  },
  'peligro-ambiental': {
    label: 'Medio ambiente',
    path: 'M10 32h30M14 32c4-4 8-4 12 0M22 20c4 4 4 8 0 12M30 22c-2 4-6 6-10 6M34 36c-3 3-7 4-11 4',
  },
  explosivo: {
    label: 'Bomba explotando',
    path: 'M25 26a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM25 26l-3-8M25 26l6-6M25 26l8 2M25 26l-9 1M25 26l3-10',
  },
  'gas-presion': {
    label: 'Botella de gas',
    path: 'M20 18h10v22a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V18ZM23 18v-4h4v4',
  },
};

export function ghsPictogram(hazard: string, size = 42): SVGSVGElement | null {
  const s = GHS_SYMBOL[hazard];
  if (!s) return null;
  const node = svg('svg', {
    viewBox: '0 0 50 50', width: size, height: size,
    role: 'img', 'aria-label': `Pictograma GHS: ${s.label}`,
  });
  node.appendChild(svg('title', {}, s.label));
  // The regulatory diamond: red border, white ground, black symbol.
  node.appendChild(svg('rect', {
    x: 25, y: 1.5, width: 33, height: 33,
    transform: 'rotate(45 25 25)',
    fill: '#ffffff', stroke: '#d32f2f', 'stroke-width': 3,
    rx: 2,
  }));
  node.appendChild(svg('path', {
    d: s.path, fill: 'none', stroke: '#111111',
    'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    transform: 'translate(0, -2) scale(0.92) translate(2, 3)',
  }));
  return node;
}
