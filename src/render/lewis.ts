/**
 * Estructuras de Lewis en SVG (§15).
 *
 * Muestra electrones de valencia, pares libres, pares enlazantes, cargas
 * formales y el cumplimiento (o no) de la regla del octeto.
 *
 * NOTA SOBRE EL OCTETO: no es una ley, es una regla practica que funciona bien
 * para C, N, O y F. El boro se queda en 6 electrones, el fosforo y el azufre
 * pueden expandir a 10 o 12, y el hidrogeno se conforma con 2. El generador
 * detecta estas situaciones y las senala en lugar de forzar el octeto.
 */

import type { Structure } from '../core/types.js';
import { getElement } from '../data/elements.js';

export interface LewisAtomInfo {
  readonly symbol: string;
  readonly x: number;
  readonly y: number;
  readonly valenceElectrons: number;
  readonly bondingElectrons: number;
  readonly lonePairs: number;
  readonly totalElectrons: number;
  readonly formalCharge: number;
  readonly octetStatus: 'complete' | 'deficient' | 'expanded' | 'duet' | 'n/a';
  readonly note: string;
}

export interface LewisDiagram {
  readonly svg: string;
  readonly atoms: readonly LewisAtomInfo[];
  readonly totalValenceElectrons: number;
  readonly notes: readonly string[];
}

/**
 * Carga formal = electrones de valencia − pares libres×2 − enlaces
 * (contando cada enlace como UN electron para el atomo, es decir, mitad del
 * par compartido).
 */
function formalCharge(valence: number, lonePairs: number, bondCount: number): number {
  return valence - lonePairs * 2 - bondCount;
}

function octetStatus(symbol: string, total: number): { status: LewisAtomInfo['octetStatus']; note: string } {
  if (symbol === 'H') {
    return total === 2
      ? { status: 'duet', note: 'El hidrogeno se completa con 2 electrones (dueto), no con 8: solo tiene el orbital 1s.' }
      : { status: 'n/a', note: 'El hidrogeno deberia rodearse de 2 electrones.' };
  }
  if (symbol === 'He' || symbol === 'Be' || symbol === 'B') {
    if (total < 8) {
      return {
        status: 'deficient',
        note: `El ${getElement(symbol)?.name ?? symbol} es deficiente en electrones: se estabiliza con ${total} y no llega al octeto. Es una excepcion conocida, no un error.`,
      };
    }
  }
  if (total === 8) return { status: 'complete', note: 'Octeto completo.' };
  if (total > 8) {
    const el = getElement(symbol);
    const canExpand = el !== undefined && el.period >= 3;
    return {
      status: 'expanded',
      note: canExpand
        ? `Octeto EXPANDIDO a ${total} electrones. Es posible porque el ${el?.name} esta en el periodo ${el?.period} y dispone de orbitales d accesibles.`
        : `Aparecen ${total} electrones, mas de un octeto, lo que no deberia ocurrir en el periodo 2. Conviene revisar la estructura.`,
    };
  }
  return { status: 'deficient', note: `Solo ${total} electrones: no alcanza el octeto.` };
}

/**
 * Genera el diagrama de Lewis a partir de una estructura 3D, proyectando
 * sobre el plano XY. Es suficiente para las moleculas pequenas, que son las
 * que se dibujan en Lewis.
 */
export function buildLewis(structure: Structure, size = 320): LewisDiagram {
  const atoms = structure.atoms;
  if (atoms.length === 0) {
    return { svg: '', atoms: [], totalValenceElectrons: 0, notes: [] };
  }

  // Proyeccion y escalado al lienzo.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const a of atoms) {
    minX = Math.min(minX, a.position.x);
    maxX = Math.max(maxX, a.position.x);
    minY = Math.min(minY, a.position.y);
    maxY = Math.max(maxY, a.position.y);
  }
  const spanX = Math.max(maxX - minX, 0.5);
  const spanY = Math.max(maxY - minY, 0.5);
  const span = Math.max(spanX, spanY);
  const padding = size * 0.22;
  const scale = (size - padding * 2) / span;

  const px = (x: number): number => padding + (x - (minX + maxX) / 2) * scale + (size - padding * 2) / 2;
  const py = (y: number): number => size - (padding + (y - (minY + maxY) / 2) * scale + (size - padding * 2) / 2);

  // Recuento de enlaces por atomo.
  const bondCount = new Map<number, number>();
  for (const b of structure.bonds) {
    bondCount.set(b.a, (bondCount.get(b.a) ?? 0) + b.order);
    bondCount.set(b.b, (bondCount.get(b.b) ?? 0) + b.order);
  }

  const notes: string[] = [];
  let totalValence = 0;

  const info: LewisAtomInfo[] = atoms.map((atom, i) => {
    const element = getElement(atom.symbol);
    const valence = element?.valenceElectrons ?? 0;
    totalValence += valence;

    const bonds = bondCount.get(i) ?? 0;
    // Pares libres: los declarados, o los que quedan tras formar los enlaces.
    const lonePairs = atom.lonePairs ?? Math.max(0, Math.floor((valence - bonds) / 2));
    const bondingElectrons = bonds * 2;
    const total = bondingElectrons + lonePairs * 2;
    const charge = formalCharge(valence, lonePairs, bonds);
    const octet = octetStatus(atom.symbol, total);

    if (octet.status === 'expanded' || octet.status === 'deficient') {
      if (!notes.includes(octet.note)) notes.push(octet.note);
    }

    return {
      symbol: atom.symbol,
      x: px(atom.position.x),
      y: py(atom.position.y),
      valenceElectrons: valence,
      bondingElectrons,
      lonePairs,
      totalElectrons: total,
      formalCharge: charge,
      octetStatus: octet.status,
      note: octet.note,
    };
  });

  // --- SVG ---------------------------------------------------------------
  const parts: string[] = [];
  parts.push(
    `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" class="lewis-svg" role="img" aria-label="Estructura de Lewis">`,
  );

  // Enlaces: una linea por cada par compartido.
  for (const bond of structure.bonds) {
    const a = info[bond.a];
    const b = info[bond.b];
    if (!a || !b) continue;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    // Se recorta la linea para no invadir el simbolo del atomo.
    const inset = 16;
    const perpX = -uy;
    const perpY = ux;
    const spacing = 4;

    for (let k = 0; k < bond.order; k++) {
      const offset = (k - (bond.order - 1) / 2) * spacing;
      const x1 = a.x + ux * inset + perpX * offset;
      const y1 = a.y + uy * inset + perpY * offset;
      const x2 = b.x - ux * inset + perpX * offset;
      const y2 = b.y - uy * inset + perpY * offset;
      parts.push(
        `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="lewis-bond"/>`,
      );
    }
  }

  // Atomos: simbolo, pares libres y carga formal.
  info.forEach((atom, i) => {
    // Pares libres alrededor del simbolo, en las direcciones libres.
    const usedDirections: { x: number; y: number }[] = [];
    for (const bond of structure.bonds) {
      const other = bond.a === i ? info[bond.b] : bond.b === i ? info[bond.a] : null;
      if (!other) continue;
      const dx = other.x - atom.x;
      const dy = other.y - atom.y;
      const len = Math.hypot(dx, dy) || 1;
      usedDirections.push({ x: dx / len, y: dy / len });
    }

    const candidates = [
      { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
      { x: 0.707, y: -0.707 }, { x: 0.707, y: 0.707 }, { x: -0.707, y: 0.707 }, { x: -0.707, y: -0.707 },
    ];
    const free = candidates.filter((c) =>
      usedDirections.every((u) => u.x * c.x + u.y * c.y < 0.6),
    );

    for (let p = 0; p < atom.lonePairs && p < free.length; p++) {
      const dir = free[p]!;
      const cx = atom.x + dir.x * 20;
      const cy = atom.y + dir.y * 20;
      // Dos puntos perpendiculares a la direccion: un par de electrones.
      const perpX = -dir.y * 3.2;
      const perpY = dir.x * 3.2;
      parts.push(
        `<circle cx="${(cx + perpX).toFixed(1)}" cy="${(cy + perpY).toFixed(1)}" r="2.1" class="lewis-electron"/>`,
        `<circle cx="${(cx - perpX).toFixed(1)}" cy="${(cy - perpY).toFixed(1)}" r="2.1" class="lewis-electron"/>`,
      );
    }

    const color = getElement(atom.symbol)?.cpkColor ?? '#B0B7C3';
    parts.push(
      `<circle cx="${atom.x.toFixed(1)}" cy="${atom.y.toFixed(1)}" r="13" fill="${color}" class="lewis-atom-bg"/>`,
      `<text x="${atom.x.toFixed(1)}" y="${atom.y.toFixed(1)}" class="lewis-symbol" dominant-baseline="central" text-anchor="middle">${atom.symbol}</text>`,
    );

    if (atom.formalCharge !== 0) {
      const sign = atom.formalCharge > 0 ? '+' : '−';
      const magnitude = Math.abs(atom.formalCharge) > 1 ? Math.abs(atom.formalCharge) : '';
      parts.push(
        `<text x="${(atom.x + 15).toFixed(1)}" y="${(atom.y - 13).toFixed(1)}" class="lewis-charge" text-anchor="middle">${magnitude}${sign}</text>`,
      );
    }
  });

  parts.push('</svg>');

  if (info.some((a) => a.formalCharge !== 0)) {
    notes.push(
      'Hay cargas formales distintas de cero. La carga formal NO es una carga real: es un recuento contable que ayuda a elegir entre estructuras alternativas. La mejor suele ser la que reparte cargas mas pequenas y coloca la negativa sobre el atomo mas electronegativo.',
    );
  }

  return { svg: parts.join(''), atoms: info, totalValenceElectrons: totalValence, notes };
}
