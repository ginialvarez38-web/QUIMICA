/**
 * Molecular model: atoms, bonds, geometry and validation.
 *
 * §17–§18: 3D visualisation with real geometry, and a builder that checks
 * valence, charge and plausibility. Coordinates are in ångström and come from
 * either the stored library or from a VSEPR construction, never from an
 * arbitrary layout — an angle a student measures on screen has to be the angle
 * the geometry actually predicts.
 */

import { elementBySymbol, atomicMass } from '../../data/elements.js';

export interface Atom {
  /** Index within the molecule. */
  id: number;
  element: string;
  /** Position in ångström. */
  x: number;
  y: number;
  z: number;
  /** Formal charge. */
  charge?: number;
  /** Lone pairs, needed for the VSEPR count. */
  lonePairs?: number;
  /** Label overriding the element symbol, e.g. "Cα". */
  label?: string;
}

export type BondOrder = 1 | 2 | 3 | 1.5;

export interface Bond {
  a: number;
  b: number;
  order: BondOrder;
  /** Aromatic ring membership, drawn as a dashed inner circle. */
  aromatic?: boolean;
  /** Stereochemistry for a 2D depiction. */
  wedge?: 'up' | 'down';
}

export interface Molecule {
  id: string;
  name: string;
  formula: string;
  atoms: Atom[];
  bonds: Bond[];
  /** Overall charge. */
  charge: number;
  /** Multiplicity, 1 for a closed shell. */
  multiplicity?: number;
  /** Point group, when known. */
  pointGroup?: string;
  /** Experimental or computed dipole moment, debye. */
  dipole?: number;
  /** Where the geometry came from — never presented as experimental if it is not (§53). */
  geometrySource: 'experimental' | 'construida' | 'optimizada';
  notes?: string[];
}

// ---------------------------------------------------------------------------
// Covalent radii and CPK colours
// ---------------------------------------------------------------------------

/** Fallback covalent radius, pm. */
export function covalentRadius(symbol: string): number {
  return elementBySymbol(symbol)?.radiusCovalent ?? 77;
}

/** Van der Waals radius, pm — the space-filling model uses this. */
export function vdwRadius(symbol: string): number {
  const e = elementBySymbol(symbol);
  return e?.radiusVdW ?? (e?.radiusCovalent ?? 77) * 1.7;
}

/**
 * CPK colouring, the convention every molecular viewer uses. Kept as explicit
 * hex rather than theme tokens because these colours *are* the standard —
 * changing oxygen from red would make the model wrong, not restyled.
 */
export const CPK: Record<string, string> = {
  H: '#ffffff', C: '#303030', N: '#3050f8', O: '#ff0d0d', F: '#90e050',
  Cl: '#1ff01f', Br: '#a62929', I: '#940094', S: '#ffff30', P: '#ff8000',
  B: '#ffb5b5', Si: '#f0c8a0', Se: '#ffa100', Na: '#ab5cf2', K: '#8f40d4',
  Li: '#cc80ff', Mg: '#8aff00', Ca: '#3dff00', Fe: '#e06633', Cu: '#c88033',
  Zn: '#7d80b0', Ag: '#c0c0c0', Au: '#ffd123', Hg: '#b8b8d0', Pb: '#575961',
  Mn: '#9c7ac7', Cr: '#8a99c7', Ni: '#50d050', Co: '#f090a0', Al: '#bfa6a6',
};

export const atomColour = (symbol: string): string => CPK[symbol] ?? '#ff69b4';

/** Display radius in ångström for the ball-and-stick model. */
export const displayRadius = (symbol: string): number =>
  Math.max(0.25, (covalentRadius(symbol) / 100) * 0.45);

// ---------------------------------------------------------------------------
// Measurement (§17)
// ---------------------------------------------------------------------------

export const distance = (a: Atom, b: Atom): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Bond angle a–b–c in degrees, with b at the vertex. */
export function angle(a: Atom, b: Atom, c: Atom): number {
  const u = [a.x - b.x, a.y - b.y, a.z - b.z];
  const v = [c.x - b.x, c.y - b.y, c.z - b.z];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const nu = Math.hypot(...u);
  const nv = Math.hypot(...v);
  return (Math.acos(Math.max(-1, Math.min(1, dot / (nu * nv)))) * 180) / Math.PI;
}

/** Dihedral (torsion) angle a–b–c–d in degrees. */
export function dihedral(a: Atom, b: Atom, c: Atom, d: Atom): number {
  const sub = (p: Atom, q: Atom): number[] => [p.x - q.x, p.y - q.y, p.z - q.z];
  const cross = (u: number[], v: number[]): number[] => [
    u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0],
  ];
  const dot = (u: number[], v: number[]): number => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

  const b1 = sub(b, a);
  const b2 = sub(c, b);
  const b3 = sub(d, c);
  const n1 = cross(b1, b2);
  const n2 = cross(b2, b3);
  const m = cross(n1, b2.map((v) => v / Math.hypot(...b2)));
  return (Math.atan2(dot(m, n2), dot(n1, n2)) * 180) / Math.PI;
}

export const centroid = (atoms: Atom[]): { x: number; y: number; z: number } => ({
  x: atoms.reduce((s, a) => s + a.x, 0) / atoms.length,
  y: atoms.reduce((s, a) => s + a.y, 0) / atoms.length,
  z: atoms.reduce((s, a) => s + a.z, 0) / atoms.length,
});

/** Centre a molecule on its centre of mass. */
export function centreOnMass(mol: Molecule): Molecule {
  let m = 0, cx = 0, cy = 0, cz = 0;
  for (const a of mol.atoms) {
    const w = atomicMass(a.element);
    m += w; cx += w * a.x; cy += w * a.y; cz += w * a.z;
  }
  return {
    ...mol,
    atoms: mol.atoms.map((a) => ({ ...a, x: a.x - cx / m, y: a.y - cy / m, z: a.z - cz / m })),
  };
}

/** Largest distance from the centroid — used to fit the camera. */
export function boundingRadius(mol: Molecule): number {
  const c = centroid(mol.atoms);
  return mol.atoms.reduce((r, a) =>
    Math.max(r, Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z) + vdwRadius(a.element) / 100), 0);
}

export const molecularFormula = (mol: Molecule): string => mol.formula;

export function molecularMass(mol: Molecule): number {
  return mol.atoms.reduce((s, a) => s + atomicMass(a.element), 0);
}

// ---------------------------------------------------------------------------
// Valence validation (§18)
// ---------------------------------------------------------------------------

/** Typical valences used to check a structure a student has drawn. */
const TYPICAL_VALENCE: Record<string, number[]> = {
  H: [1], F: [1], Cl: [1, 3, 5, 7], Br: [1, 3, 5, 7], I: [1, 3, 5, 7],
  O: [2], S: [2, 4, 6], Se: [2, 4, 6],
  N: [3], P: [3, 5], As: [3, 5],
  C: [4], Si: [4], Ge: [4],
  B: [3], Al: [3],
  Li: [1], Na: [1], K: [1], Mg: [2], Ca: [2], Zn: [2],
};

export interface ValidationIssue {
  severity: 'error' | 'aviso' | 'nota';
  atomId?: number;
  message: string;
  /** What to do about it. */
  suggestion?: string;
}

/**
 * Check a structure for chemical plausibility.
 *
 * Reports rather than silently corrects: a student who draws pentavalent carbon
 * should be told precisely that, at that atom, with the count that is wrong —
 * not have it quietly fixed.
 */
export function validate(mol: Molecule): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const bondsOf = new Map<number, number>();
  const neighbours = new Map<number, number[]>();

  for (const b of mol.bonds) {
    bondsOf.set(b.a, (bondsOf.get(b.a) ?? 0) + b.order);
    bondsOf.set(b.b, (bondsOf.get(b.b) ?? 0) + b.order);
    neighbours.set(b.a, [...(neighbours.get(b.a) ?? []), b.b]);
    neighbours.set(b.b, [...(neighbours.get(b.b) ?? []), b.a]);
  }

  for (const atom of mol.atoms) {
    const used = bondsOf.get(atom.id) ?? 0;
    const expected = TYPICAL_VALENCE[atom.element];
    const q = atom.charge ?? 0;

    if (used === 0 && mol.atoms.length > 1) {
      issues.push({
        severity: 'error', atomId: atom.id,
        message: `${atom.element}${atom.id} no tiene ningún enlace: queda como fragmento aislado.`,
        suggestion: 'Enlázalo o elimínalo de la estructura.',
      });
      continue;
    }

    if (expected) {
      // A formal charge shifts the expected valence: N⁺ takes 4 bonds, O⁻ one.
      const adjusted = expected.map((v) => v + (atom.element === 'B' ? -q : q));
      if (!adjusted.some((v) => Math.abs(v - used) < 0.01)) {
        issues.push({
          severity: 'error', atomId: atom.id,
          message: `${atom.element}${atom.id} tiene ${used} enlaces`
            + `${q !== 0 ? ` con carga ${q > 0 ? '+' : ''}${q}` : ''}, `
            + `pero su valencia habitual es ${expected.join(' o ')}${q !== 0 ? ` (${adjusted.join(' o ')} con esa carga)` : ''}.`,
          suggestion: q === 0
            ? 'Ajusta el número de enlaces o asigna una carga formal.'
            : 'Revisa la carga formal o el número de enlaces.',
        });
      }
    }

    // Second-period elements cannot expand their octet.
    const period = elementBySymbol(atom.element)?.period ?? 3;
    if (period === 2 && used > 4) {
      issues.push({
        severity: 'error', atomId: atom.id,
        message: `${atom.element}${atom.id} supera el octeto con ${used} enlaces. Los elementos del segundo periodo no tienen orbitales d disponibles.`,
        suggestion: 'Usa una estructura de resonancia con carga formal en lugar de expandir el octeto.',
      });
    }
  }

  // Overall charge consistency.
  const sumFormal = mol.atoms.reduce((s, a) => s + (a.charge ?? 0), 0);
  if (Math.abs(sumFormal - mol.charge) > 0.01) {
    issues.push({
      severity: 'aviso',
      message: `Las cargas formales suman ${sumFormal} pero la molécula está declarada con carga ${mol.charge}.`,
      suggestion: 'La suma de cargas formales debe igualar la carga total de la especie.',
    });
  }

  // Geometric sanity: overlapping atoms.
  for (let i = 0; i < mol.atoms.length; i++) {
    for (let j = i + 1; j < mol.atoms.length; j++) {
      const d = distance(mol.atoms[i], mol.atoms[j]);
      const bonded = mol.bonds.some((b) =>
        (b.a === mol.atoms[i].id && b.b === mol.atoms[j].id)
        || (b.b === mol.atoms[i].id && b.a === mol.atoms[j].id));
      const minimum = bonded ? 0.7 : 1.6;
      if (d < minimum) {
        issues.push({
          severity: bonded ? 'aviso' : 'error',
          message: `${mol.atoms[i].element}${mol.atoms[i].id} y ${mol.atoms[j].element}${mol.atoms[j].id} `
            + `están a ${d.toFixed(2)} Å: ${bonded ? 'una distancia de enlace anormalmente corta' : 'demasiado cerca para no estar enlazados'}.`,
        });
      }
    }
  }

  return issues;
}

/** Remaining bonds an atom can still form. */
export function remainingValence(mol: Molecule, atomId: number): number {
  const atom = mol.atoms.find((a) => a.id === atomId);
  if (!atom) return 0;
  const used = mol.bonds
    .filter((b) => b.a === atomId || b.b === atomId)
    .reduce((s, b) => s + b.order, 0);
  const expected = TYPICAL_VALENCE[atom.element]?.[0] ?? 4;
  return Math.max(0, expected + (atom.charge ?? 0) - used);
}

// ---------------------------------------------------------------------------
// VSEPR geometry (§18: build a structure with the right shape)
// ---------------------------------------------------------------------------

export interface VseprResult {
  /** Steric number: σ bonds + lone pairs. */
  stericNumber: number;
  bondingPairs: number;
  lonePairs: number;
  /** Electron-pair geometry. */
  electronGeometry: string;
  /** Molecular geometry — what you actually see. */
  molecularGeometry: string;
  /** Ideal bond angle, degrees. */
  idealAngle: number;
  /** Actual angle after lone-pair compression. */
  predictedAngle: number;
  hybridisation: string;
  /** Unit vectors for the σ bonds, in the local frame. */
  directions: Array<[number, number, number]>;
  explanation: string;
}

const GEOMETRY_TABLE: Record<number, { electron: string; angle: number; hybrid: string; dirs: Array<[number, number, number]> }> = {
  2: {
    electron: 'lineal', angle: 180, hybrid: 'sp',
    dirs: [[1, 0, 0], [-1, 0, 0]],
  },
  3: {
    electron: 'trigonal plana', angle: 120, hybrid: 'sp²',
    dirs: [[1, 0, 0], [-0.5, 0.8660254, 0], [-0.5, -0.8660254, 0]],
  },
  4: {
    electron: 'tetraédrica', angle: 109.47, hybrid: 'sp³',
    dirs: [
      [0.5773503, 0.5773503, 0.5773503],
      [0.5773503, -0.5773503, -0.5773503],
      [-0.5773503, 0.5773503, -0.5773503],
      [-0.5773503, -0.5773503, 0.5773503],
    ],
  },
  5: {
    electron: 'bipiramidal trigonal', angle: 120, hybrid: 'sp³d',
    dirs: [
      [0, 0, 1], [0, 0, -1],
      [1, 0, 0], [-0.5, 0.8660254, 0], [-0.5, -0.8660254, 0],
    ],
  },
  6: {
    electron: 'octaédrica', angle: 90, hybrid: 'sp³d²',
    dirs: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  },
};

const MOLECULAR_SHAPE: Record<string, string> = {
  '2-0': 'lineal',
  '3-0': 'trigonal plana', '3-1': 'angular',
  '4-0': 'tetraédrica', '4-1': 'piramidal trigonal', '4-2': 'angular',
  '5-0': 'bipiramidal trigonal', '5-1': 'balancín (see-saw)', '5-2': 'forma de T', '5-3': 'lineal',
  '6-0': 'octaédrica', '6-1': 'piramidal cuadrada', '6-2': 'cuadrada plana',
};

/**
 * VSEPR prediction from the σ-bond and lone-pair counts.
 *
 * The lone-pair compression is applied explicitly (≈2.5° per lone pair), which
 * is why this predicts 104.5° for water rather than the ideal 109.5° — and why
 * a student can see the rule working instead of memorising the exception.
 */
export function vsepr(bondingPairs: number, lonePairs: number): VseprResult {
  const steric = bondingPairs + lonePairs;
  const base = GEOMETRY_TABLE[steric] ?? GEOMETRY_TABLE[4];
  const shape = MOLECULAR_SHAPE[`${steric}-${lonePairs}`] ?? base.electron;
  const predicted = base.angle - lonePairs * (steric === 4 ? 2.5 : 2);

  return {
    stericNumber: steric,
    bondingPairs, lonePairs,
    electronGeometry: base.electron,
    molecularGeometry: shape,
    idealAngle: base.angle,
    predictedAngle: Math.max(predicted, 60),
    hybridisation: base.hybrid,
    directions: base.dirs.slice(0, steric),
    explanation: lonePairs === 0
      ? `${steric} pares de electrones alrededor del átomo central se repelen hasta la disposición ${base.electron}, con ángulos de ${base.angle}°.`
      : `${steric} pares (${bondingPairs} enlazantes y ${lonePairs} solitario${lonePairs > 1 ? 's' : ''}) adoptan una disposición electrónica ${base.electron}. `
        + `Como los pares solitarios ocupan más espacio que los enlazantes, comprimen el ángulo de ${base.angle}° a unos ${predicted.toFixed(1)}°, `
        + `y la forma que se observa es ${shape}.`,
  };
}

/**
 * Build a molecule with correct VSEPR geometry from a central atom and a list
 * of substituents — the mechanism behind the "átomo → enlace → átomo" builder.
 */
export function buildFromVsepr(
  central: string,
  substituents: Array<{ element: string; order?: BondOrder }>,
  lonePairs: number,
  opts: { name?: string; charge?: number } = {},
): Molecule {
  const geometry = vsepr(substituents.length, lonePairs);
  const atoms: Atom[] = [{
    id: 0, element: central, x: 0, y: 0, z: 0,
    charge: opts.charge ?? 0, lonePairs,
  }];
  const bonds: Bond[] = [];

  substituents.forEach((sub, i) => {
    const dir = geometry.directions[i] ?? [0, 0, 1];
    // Bond length from the sum of covalent radii.
    const length = (covalentRadius(central) + covalentRadius(sub.element)) / 100;
    atoms.push({
      id: i + 1, element: sub.element,
      x: dir[0] * length, y: dir[1] * length, z: dir[2] * length,
    });
    bonds.push({ a: 0, b: i + 1, order: sub.order ?? 1 });
  });

  const counts: Record<string, number> = {};
  atoms.forEach((a) => { counts[a.element] = (counts[a.element] ?? 0) + 1; });
  const formula = Object.entries(counts)
    .sort((a, b) => (a[0] === central ? -1 : b[0] === central ? 1 : a[0].localeCompare(b[0])))
    .map(([el, n]) => (n === 1 ? el : `${el}${n}`))
    .join('');

  return {
    id: `built-${Date.now()}`,
    name: opts.name ?? formula,
    formula,
    atoms, bonds,
    charge: opts.charge ?? 0,
    geometrySource: 'construida',
    notes: [geometry.explanation],
  };
}

/** Count σ bonds and infer lone pairs on the central atom of a molecule. */
export function vseprOf(mol: Molecule, centreId = 0): VseprResult | null {
  const atom = mol.atoms.find((a) => a.id === centreId);
  if (!atom) return null;
  const sigma = mol.bonds.filter((b) => b.a === centreId || b.b === centreId).length;
  const lone = atom.lonePairs ?? inferLonePairs(atom, mol);
  return vsepr(sigma, lone);
}

function inferLonePairs(atom: Atom, mol: Molecule): number {
  const e = elementBySymbol(atom.element);
  if (!e) return 0;
  const valence = e.valenceElectrons;
  const bondElectrons = mol.bonds
    .filter((b) => b.a === atom.id || b.b === atom.id)
    .reduce((s, b) => s + b.order, 0);
  return Math.max(0, Math.round((valence - bondElectrons - (atom.charge ?? 0)) / 2));
}

/**
 * Dipole moment estimated by vector-summing bond dipoles from the
 * electronegativity difference.
 *
 * Explicitly an estimate, labelled as such (§53, §66): it gets the *direction*
 * and the qualitative magnitude right, which is the teaching point, and it does
 * not pretend to reproduce an experimental value.
 */
export function estimateDipole(mol: Molecule): { magnitude: number; vector: [number, number, number]; note: string } {
  let vx = 0, vy = 0, vz = 0;
  for (const b of mol.bonds) {
    const a1 = mol.atoms.find((a) => a.id === b.a);
    const a2 = mol.atoms.find((a) => a.id === b.b);
    if (!a1 || !a2) continue;
    const e1 = elementBySymbol(a1.element)?.electronegativity ?? 2.2;
    const e2 = elementBySymbol(a2.element)?.electronegativity ?? 2.2;
    const dEN = e2 - e1;
    const d = distance(a1, a2) || 1;
    // Rough proportionality: µ_bond ≈ 1.5 D per unit of Δχ per Å.
    const scale = (dEN * 1.5) / d;
    vx += (a2.x - a1.x) * scale;
    vy += (a2.y - a1.y) * scale;
    vz += (a2.z - a1.z) * scale;
  }
  return {
    magnitude: Math.hypot(vx, vy, vz),
    vector: [vx, vy, vz],
    note: 'Estimación a partir de las diferencias de electronegatividad y la geometría. '
      + 'Reproduce el sentido y el orden de magnitud, no el valor experimental.',
  };
}
