/**
 * Geometria molecular por VSEPR (§4, §15).
 *
 * Genera coordenadas 3D reales para que el sandbox no dibuje "bolitas al
 * azar": el agua sale angular a 104,5°, el metano tetraedrico, el CO2 lineal
 * y el SF6 octaedrico, porque esas son las geometrias que predice la teoria de
 * repulsion de los pares de electrones de la capa de valencia.
 *
 * MODELO
 *   Numero esterico = atomos enlazados + pares libres.
 *   Los dominios electronicos se separan al maximo sobre una esfera; los
 *   pares libres ocupan sitio pero no se dibujan como enlace, de ahi que el
 *   agua sea angular y no lineal.
 *
 * Las longitudes de enlace se estiman como la suma de radios covalentes
 * (Cordero et al.), corregida por el orden de enlace: un doble enlace es mas
 * corto que uno simple. Es una aproximacion declarada, no un calculo de
 * mecanica cuantica, y asi se documenta en la ficha.
 */

import type { Bond, BondKind, BondOrder, Structure, StructureAtom, Vec3 } from '../core/types.js';
import { getElement } from '../data/elements.js';

export type VseprGeometry =
  | 'lineal'
  | 'angular'
  | 'trigonal plana'
  | 'piramidal trigonal'
  | 'tetraedrica'
  | 'bipiramidal trigonal'
  | 'balancin'
  | 'forma de T'
  | 'octaedrica'
  | 'piramidal cuadrada'
  | 'cuadrada plana'
  | 'atomica'
  | 'compleja';

export interface VseprResult {
  readonly geometry: VseprGeometry;
  /** Disposicion de TODOS los dominios, incluidos los pares libres. */
  readonly electronGeometry: VseprGeometry;
  readonly stericNumber: number;
  readonly bondedAtoms: number;
  readonly lonePairs: number;
  /** Angulo de enlace ideal en grados. */
  readonly idealAngle: number;
  /** Notacion AXE: "AX2E2" para el agua. */
  readonly axeNotation: string;
  readonly explanation: string;
}

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** Direcciones unitarias de los dominios electronicos, por numero esterico. */
const DOMAIN_DIRECTIONS: Record<number, Vec3[]> = {
  1: [v(1, 0, 0)],
  2: [v(1, 0, 0), v(-1, 0, 0)],
  3: [v(1, 0, 0), v(-0.5, 0.8660254, 0), v(-0.5, -0.8660254, 0)],
  4: [
    v(0.5773503, 0.5773503, 0.5773503),
    v(0.5773503, -0.5773503, -0.5773503),
    v(-0.5773503, 0.5773503, -0.5773503),
    v(-0.5773503, -0.5773503, 0.5773503),
  ],
  5: [
    // Bipiramide trigonal: tres ecuatoriales y dos axiales.
    v(1, 0, 0),
    v(-0.5, 0.8660254, 0),
    v(-0.5, -0.8660254, 0),
    v(0, 0, 1),
    v(0, 0, -1),
  ],
  6: [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0), v(0, 0, 1), v(0, 0, -1)],
};

const IDEAL_ANGLE: Record<number, number> = { 2: 180, 3: 120, 4: 109.5, 5: 120, 6: 90 };

const ELECTRON_GEOMETRY: Record<number, VseprGeometry> = {
  1: 'atomica',
  2: 'lineal',
  3: 'trigonal plana',
  4: 'tetraedrica',
  5: 'bipiramidal trigonal',
  6: 'octaedrica',
};

/**
 * Geometria molecular a partir del numero de enlazados y de pares libres.
 * Es la tabla clasica de VSEPR.
 */
export function vsepr(bondedAtoms: number, lonePairs: number): VseprResult {
  const steric = bondedAtoms + lonePairs;
  const electronGeometry = ELECTRON_GEOMETRY[steric] ?? 'compleja';
  const key = `${bondedAtoms}:${lonePairs}`;

  const TABLE: Record<string, { geometry: VseprGeometry; angle: number; note: string }> = {
    '1:0': { geometry: 'atomica', angle: 0, note: 'Un solo enlace: no hay angulo que definir.' },
    '2:0': { geometry: 'lineal', angle: 180, note: 'Dos dominios se separan al maximo colocandose opuestos.' },
    '3:0': { geometry: 'trigonal plana', angle: 120, note: 'Tres dominios se reparten en un plano a 120°.' },
    '2:1': {
      geometry: 'angular',
      angle: 118,
      note: 'Hay tres dominios, pero uno es un par libre que no se dibuja: la molecula parece angular. El par libre ocupa mas espacio que un enlace, asi que cierra el angulo por debajo de 120°.',
    },
    '4:0': { geometry: 'tetraedrica', angle: 109.5, note: 'Cuatro dominios se separan al maximo en un tetraedro.' },
    '3:1': {
      geometry: 'piramidal trigonal',
      angle: 107,
      note: 'Cuatro dominios en tetraedro, pero uno es un par libre: quedan tres enlaces formando una piramide. El par libre comprime el angulo a unos 107°.',
    },
    '2:2': {
      geometry: 'angular',
      angle: 104.5,
      note: 'Cuatro dominios en tetraedro con DOS pares libres. Los dos pares empujan los enlaces y cierran el angulo hasta 104,5°: por eso el agua es angular y, en consecuencia, polar.',
    },
    '5:0': { geometry: 'bipiramidal trigonal', angle: 120, note: 'Cinco dominios: tres ecuatoriales a 120° y dos axiales a 90°.' },
    '4:1': { geometry: 'balancin', angle: 117, note: 'El par libre ocupa una posicion ecuatorial, que es donde menos repele.' },
    '3:2': { geometry: 'forma de T', angle: 90, note: 'Dos pares libres en posiciones ecuatoriales.' },
    '2:3': { geometry: 'lineal', angle: 180, note: 'Tres pares libres ecuatoriales dejan los dos enlaces axiales, luego lineal.' },
    '6:0': { geometry: 'octaedrica', angle: 90, note: 'Seis dominios equivalentes a 90°.' },
    '5:1': { geometry: 'piramidal cuadrada', angle: 90, note: 'Un par libre en un vertice del octaedro.' },
    '4:2': {
      geometry: 'cuadrada plana',
      angle: 90,
      note: 'Los dos pares libres se colocan opuestos para repelerse lo menos posible, dejando los cuatro enlaces en un plano.',
    },
  };

  const entry = TABLE[key];
  const geometry = entry?.geometry ?? 'compleja';
  const idealAngle = entry?.angle ?? IDEAL_ANGLE[steric] ?? 0;

  const axeNotation = `AX${bondedAtoms}${lonePairs > 0 ? `E${lonePairs}` : ''}`;

  const explanation = entry
    ? `${axeNotation}: numero esterico ${steric} (${bondedAtoms} enlace${bondedAtoms === 1 ? '' : 's'}` +
      `${lonePairs > 0 ? ` y ${lonePairs} par${lonePairs === 1 ? '' : 'es'} libre${lonePairs === 1 ? '' : 's'}` : ''}). ` +
      `Disposicion de los dominios: ${electronGeometry}. Geometria molecular: ${geometry}. ${entry.note}`
    : `Numero esterico ${steric}: fuera de la tabla VSEPR habitual.`;

  return {
    geometry,
    electronGeometry,
    stericNumber: steric,
    bondedAtoms,
    lonePairs,
    idealAngle,
    axeNotation,
    explanation,
  };
}

// ---------------------------------------------------------------------------
// Longitudes de enlace
// ---------------------------------------------------------------------------

/**
 * Longitud de enlace estimada, en angstrom.
 * Suma de radios covalentes, acortada un 10 % por enlace doble y un 18 % por
 * triple, que son las correcciones empiricas habituales.
 */
export function bondLength(a: string, b: string, order: BondOrder = 1): number {
  const ra = getElement(a)?.physical.covalentRadius.value;
  const rb = getElement(b)?.physical.covalentRadius.value;
  if (ra === null || ra === undefined || rb === null || rb === undefined) return 1.5;
  const single = (ra + rb) / 100; // pm -> angstrom
  const factor = order === 3 ? 0.82 : order === 2 ? 0.9 : 1;
  return single * factor;
}

/** Radio de dibujo del atomo, en angstrom. */
export function atomRadius(symbol: string, mode: 'covalent' | 'vdw'): number {
  const el = getElement(symbol);
  if (!el) return 0.7;
  const r =
    mode === 'vdw'
      ? el.physical.vanDerWaalsRadius.value ?? el.physical.covalentRadius.value
      : el.physical.covalentRadius.value;
  return r === null || r === undefined ? 0.7 : r / 100;
}

/**
 * Tipo de enlace segun la diferencia de electronegatividad.
 * Los umbrales (0,4 y 1,7) son la convencion didactica habitual. Es una
 * simplificacion: el caracter ionico varia de forma continua, no a saltos.
 */
export function bondKind(a: string, b: string): { kind: BondKind; delta: number } {
  const ea = getElement(a)?.electronegativity;
  const eb = getElement(b)?.electronegativity;
  if (ea == null || eb == null) return { kind: 'covalent-polar', delta: 0 };
  const delta = Math.abs(ea - eb);
  if (delta >= 1.7) return { kind: 'ionic', delta };
  if (delta >= 0.4) return { kind: 'covalent-polar', delta };
  return { kind: 'covalent-nonpolar', delta };
}

// ---------------------------------------------------------------------------
// Construccion de estructuras
// ---------------------------------------------------------------------------

/**
 * Especificacion de conectividad de una molecula.
 * Se declara solo lo que no se puede deducir: quien esta unido a quien.
 */
interface MoleculeSpec {
  /** Atomo central, si lo hay. */
  readonly central?: string;
  /** Ligandos del atomo central: [simbolo, orden de enlace]. */
  readonly ligands?: readonly [string, BondOrder][];
  /** Pares libres sobre el atomo central. */
  readonly lonePairs?: number;
  /** Hidrogenos unidos a ligandos concretos (por indice del ligando). */
  readonly hydrogensOnLigands?: readonly number[];
  /** Motivo estructural cuando no es una molecula discreta. */
  readonly motif?: Structure['motif'];
}

/**
 * Estructuras curadas de las moleculas mas frecuentes.
 *
 * La conectividad NO es deducible de la formula: CH3COOH y C2H4O2 tienen la
 * misma composicion y estructuras distintas. Donde importa, se declara.
 */
const SPECS: Record<string, MoleculeSpec> = {
  H2O: { central: 'O', ligands: [['H', 1], ['H', 1]], lonePairs: 2 },
  H2S: { central: 'S', ligands: [['H', 1], ['H', 1]], lonePairs: 2 },
  NH3: { central: 'N', ligands: [['H', 1], ['H', 1], ['H', 1]], lonePairs: 1 },
  CH4: { central: 'C', ligands: [['H', 1], ['H', 1], ['H', 1], ['H', 1]], lonePairs: 0 },
  CO2: { central: 'C', ligands: [['O', 2], ['O', 2]], lonePairs: 0 },
  SO2: { central: 'S', ligands: [['O', 2], ['O', 2]], lonePairs: 1 },
  SO3: { central: 'S', ligands: [['O', 2], ['O', 2], ['O', 2]], lonePairs: 0 },
  CO: { central: 'C', ligands: [['O', 3]], lonePairs: 1 },
  NO: { central: 'N', ligands: [['O', 2]], lonePairs: 1 },
  NO2: { central: 'N', ligands: [['O', 2], ['O', 1]], lonePairs: 1 },
  HF: { central: 'F', ligands: [['H', 1]], lonePairs: 3 },
  HCl: { central: 'Cl', ligands: [['H', 1]], lonePairs: 3 },
  HBr: { central: 'Br', ligands: [['H', 1]], lonePairs: 3 },
  HI: { central: 'I', ligands: [['H', 1]], lonePairs: 3 },
  H2O2: { central: 'O', ligands: [['O', 1], ['H', 1]], lonePairs: 2, hydrogensOnLigands: [0] },
  SiO2: { central: 'Si', ligands: [['O', 2], ['O', 2]], lonePairs: 0, motif: 'covalent-network' },
  // Oxoacidos: el central rodeado de oxigenos, con los H sobre algunos de ellos.
  H2SO4: {
    central: 'S',
    ligands: [['O', 2], ['O', 2], ['O', 1], ['O', 1]],
    lonePairs: 0,
    hydrogensOnLigands: [2, 3],
  },
  H2SO3: { central: 'S', ligands: [['O', 2], ['O', 1], ['O', 1]], lonePairs: 1, hydrogensOnLigands: [1, 2] },
  HNO3: { central: 'N', ligands: [['O', 2], ['O', 1], ['O', 1]], lonePairs: 0, hydrogensOnLigands: [2] },
  HNO2: { central: 'N', ligands: [['O', 2], ['O', 1]], lonePairs: 1, hydrogensOnLigands: [1] },
  H2CO3: { central: 'C', ligands: [['O', 2], ['O', 1], ['O', 1]], lonePairs: 0, hydrogensOnLigands: [1, 2] },
  H3PO4: {
    central: 'P',
    ligands: [['O', 2], ['O', 1], ['O', 1], ['O', 1]],
    lonePairs: 0,
    hydrogensOnLigands: [1, 2, 3],
  },
  HClO: { central: 'Cl', ligands: [['O', 1]], lonePairs: 3, hydrogensOnLigands: [0] },
  HClO4: { central: 'Cl', ligands: [['O', 2], ['O', 2], ['O', 2], ['O', 1]], lonePairs: 0, hydrogensOnLigands: [3] },
  // Iones poliatomicos.
  SO4: { central: 'S', ligands: [['O', 2], ['O', 2], ['O', 1], ['O', 1]], lonePairs: 0 },
  CO3: { central: 'C', ligands: [['O', 2], ['O', 1], ['O', 1]], lonePairs: 0 },
  NO3: { central: 'N', ligands: [['O', 2], ['O', 1], ['O', 1]], lonePairs: 0 },
  PO4: { central: 'P', ligands: [['O', 2], ['O', 1], ['O', 1], ['O', 1]], lonePairs: 0 },
  OH: { central: 'O', ligands: [['H', 1]], lonePairs: 3 },
  NH4: { central: 'N', ligands: [['H', 1], ['H', 1], ['H', 1], ['H', 1]], lonePairs: 0 },
  MnO4: { central: 'Mn', ligands: [['O', 2], ['O', 2], ['O', 2], ['O', 1]], lonePairs: 0 },
  // Halogenuros y otros AXn.
  BF3: { central: 'B', ligands: [['F', 1], ['F', 1], ['F', 1]], lonePairs: 0 },
  CCl4: { central: 'C', ligands: [['Cl', 1], ['Cl', 1], ['Cl', 1], ['Cl', 1]], lonePairs: 0 },
  PCl5: { central: 'P', ligands: [['Cl', 1], ['Cl', 1], ['Cl', 1], ['Cl', 1], ['Cl', 1]], lonePairs: 0 },
  SF6: {
    central: 'S',
    ligands: [['F', 1], ['F', 1], ['F', 1], ['F', 1], ['F', 1], ['F', 1]],
    lonePairs: 0,
  },
  CHCl3: { central: 'C', ligands: [['H', 1], ['Cl', 1], ['Cl', 1], ['Cl', 1]], lonePairs: 0 },
};

/**
 * Direcciones REALES de los enlaces, no las de los dominios.
 *
 * Este es el detalle que separa un dibujo correcto de uno que solo lo parece.
 * Las direcciones tetraedricas ideales dan 109,5° entre enlaces, pero en el
 * agua el angulo medido es 104,5°: los dos pares libres, que ocupan mas
 * volumen que un enlace, comprimen los enlaces O—H. Si se dibujan los
 * hidrogenos en las posiciones tetraedricas ideales, la molecula se ve mal y,
 * peor aun, contradice lo que la propia ficha VSEPR afirma tres lineas mas
 * abajo.
 *
 * Con pares libres, los ligandos se colocan sobre un CONO alrededor del eje de
 * simetria, con el semiangulo θ que produce exactamente el angulo de enlace
 * predicho φ. Para n ligandos repartidos en el cono:
 *
 *   cos φ = cos²θ + sin²θ · cos(2π/n)
 *
 * de donde se despeja θ. Para n = 2 se reduce a θ = φ/2.
 */
function ligandDirections(
  bondedAtoms: number,
  lonePairs: number,
  targetAngle: number,
  steric: number,
): Vec3[] {
  const ideal = DOMAIN_DIRECTIONS[steric] ?? DOMAIN_DIRECTIONS[4]!;

  // Sin pares libres, las direcciones ideales YA son las correctas.
  if (lonePairs === 0) return ideal;
  // Un solo ligando no define ningun angulo.
  if (bondedAtoms < 2) return ideal;
  // Con dos ligandos y tres pares libres la geometria es lineal (XeF2): las
  // direcciones ideales axiales ya son correctas.
  if (bondedAtoms === 2 && lonePairs === 3) return [v(0, 0, 1), v(0, 0, -1)];
  // Los casos de numero esterico 5 y 6 con pares libres (balancin, forma de T,
  // piramidal cuadrada) conservan angulos proximos a los ideales.
  if (steric >= 5) return ideal;

  const phi = (targetAngle * Math.PI) / 180;
  const n = bondedAtoms;
  const cosPhi = Math.cos(phi);
  const cos2piN = Math.cos((2 * Math.PI) / n);

  // cos φ = cos²θ + (1 − cos²θ)·cos(2π/n)  ->  cos²θ = (cos φ − k) / (1 − k)
  const denominator = 1 - cos2piN;
  const cosThetaSquared = denominator === 0 ? 0 : (cosPhi - cos2piN) / denominator;
  const cosTheta = Math.sqrt(Math.max(0, Math.min(1, cosThetaSquared)));
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));

  // Eje de simetria = +y. Los pares libres quedan del lado opuesto, que es
  // como se dibuja el agua en cualquier libro de texto.
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const azimuth = (i / n) * Math.PI * 2;
    out.push({
      x: sinTheta * Math.cos(azimuth),
      y: -cosTheta,
      z: sinTheta * Math.sin(azimuth),
    });
  }
  return out;
}

let idCounter = 0;
const nextId = (): string => `a${idCounter++}`;

const scale = (u: Vec3, k: number): Vec3 => ({ x: u.x * k, y: u.y * k, z: u.z * k });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/** Construye una molecula AXnEm a partir de su especificacion. */
function buildFromSpec(spec: MoleculeSpec): Structure {
  const central = spec.central!;
  const ligands = spec.ligands ?? [];
  const lonePairs = spec.lonePairs ?? 0;
  const steric = ligands.length + lonePairs;

  const geo = vsepr(ligands.length, lonePairs);
  const directions = ligandDirections(ligands.length, lonePairs, geo.idealAngle, steric);

  const atoms: StructureAtom[] = [
    { id: nextId(), symbol: central, position: v(0, 0, 0), lonePairs },
  ];
  const bonds: Bond[] = [];

  // Los pares libres ocupan las ULTIMAS direcciones, que es la convencion que
  // hace que el agua salga angular con los hidrogenos "hacia arriba".
  ligands.forEach(([symbol, order], i) => {
    const dir = directions[i] ?? v(0, 0, 1);
    const length = bondLength(central, symbol, order);
    const index = atoms.length;
    atoms.push({ id: nextId(), symbol, position: scale(dir, length) });
    bonds.push({
      a: 0,
      b: index,
      order,
      kind: bondKind(central, symbol).kind,
      electronegativityDelta: bondKind(central, symbol).delta,
    });

    // Hidrogeno colgando de este ligando (oxoacidos, peroxidos).
    if (spec.hydrogensOnLigands?.includes(i)) {
      const hLength = bondLength(symbol, 'H', 1);
      // Se coloca hacia fuera, desviado para no quedar alineado con el central.
      const outward = scale(dir, 1);
      const perp = perpendicular(outward);
      const hDir = normalize(add(scale(outward, 0.7), scale(perp, 0.7)));
      const hIndex = atoms.length;
      atoms.push({
        id: nextId(),
        symbol: 'H',
        position: add(scale(dir, length), scale(hDir, hLength)),
      });
      bonds.push({
        a: index,
        b: hIndex,
        order: 1,
        kind: bondKind(symbol, 'H').kind,
        electronegativityDelta: bondKind(symbol, 'H').delta,
      });
    }
  });

  return {
    motif: spec.motif ?? 'molecular',
    atoms,
    bonds,
    geometry: geo.geometry,
  };
}

function normalize(u: Vec3): Vec3 {
  const n = Math.hypot(u.x, u.y, u.z) || 1;
  return { x: u.x / n, y: u.y / n, z: u.z / n };
}

/** Un vector perpendicular arbitrario pero estable. */
function perpendicular(u: Vec3): Vec3 {
  const axis = Math.abs(u.x) < 0.9 ? v(1, 0, 0) : v(0, 1, 0);
  return normalize({
    x: u.y * axis.z - u.z * axis.y,
    y: u.z * axis.x - u.x * axis.z,
    z: u.x * axis.y - u.y * axis.x,
  });
}

/**
 * Red ionica (§4): NaCl no es una molecula, es un cristal. Se genera una
 * porcion de red cubica centrada en las caras para que el estudiante vea que
 * "una molecula de NaCl" no existe.
 */
function buildIonicLattice(cation: string, anion: string, size = 2): Structure {
  const atoms: StructureAtom[] = [];
  const rCation = atomRadius(cation, 'covalent');
  const rAnion = atomRadius(anion, 'covalent');
  const a = (rCation + rAnion) * 1.05; // parametro de red aproximado

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const isCation = (x + y + z) % 2 === 0;
        atoms.push({
          id: nextId(),
          symbol: isCation ? cation : anion,
          position: v((x - (size - 1) / 2) * a, (y - (size - 1) / 2) * a, (z - (size - 1) / 2) * a),
          oxidationState: undefined,
        });
      }
    }
  }

  // Enlaces entre vecinos mas proximos, para que se vea la red.
  const bonds: Bond[] = [];
  const kind = bondKind(cation, anion);
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const pa = atoms[i]!.position;
      const pb = atoms[j]!.position;
      const d = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
      if (d < a * 1.1) {
        bonds.push({ a: i, b: j, order: 1, kind: 'ionic', electronegativityDelta: kind.delta });
      }
    }
  }

  return { motif: 'ionic-lattice', atoms, bonds };
}

/** Molecula diatomica: O2, N2, Cl2, H2. */
function buildDiatomic(symbol: string, order: BondOrder): Structure {
  const length = bondLength(symbol, symbol, order);
  return {
    motif: 'molecular',
    atoms: [
      { id: nextId(), symbol, position: v(-length / 2, 0, 0) },
      { id: nextId(), symbol, position: v(length / 2, 0, 0) },
    ],
    bonds: [{ a: 0, b: 1, order, kind: 'covalent-nonpolar', electronegativityDelta: 0 }],
    geometry: 'lineal',
  };
}

/** Un solo atomo o ion. */
function buildSingleAtom(symbol: string): Structure {
  return {
    motif: 'atomic',
    atoms: [{ id: nextId(), symbol, position: v(0, 0, 0) }],
    bonds: [],
    geometry: 'atomica',
  };
}

/** Cadena carbonada sencilla para los hidrocarburos y alcoholes basicos. */
const ORGANIC_CHAINS: Record<string, { carbons: number; order: BondOrder; tail?: 'OH' | 'COOH' }> = {
  C2H6: { carbons: 2, order: 1 },
  C3H8: { carbons: 3, order: 1 },
  C2H4: { carbons: 2, order: 2 },
  C2H2: { carbons: 2, order: 3 },
  C2H5OH: { carbons: 2, order: 1, tail: 'OH' },
  CH3OH: { carbons: 1, order: 1, tail: 'OH' },
  CH3COOH: { carbons: 2, order: 1, tail: 'COOH' },
};

function buildOrganicChain(spec: { carbons: number; order: BondOrder; tail?: 'OH' | 'COOH' }): Structure {
  const atoms: StructureAtom[] = [];
  const bonds: Bond[] = [];
  const ccLength = bondLength('C', 'C', spec.order);
  const chLength = bondLength('C', 'H', 1);

  // Carbonos en zigzag, como corresponde a angulos tetraedricos.
  const carbonIndices: number[] = [];
  for (let i = 0; i < spec.carbons; i++) {
    const zig = spec.order === 1 ? (i % 2 === 0 ? 0.25 : -0.25) : 0;
    carbonIndices.push(atoms.length);
    atoms.push({ id: nextId(), symbol: 'C', position: v(i * ccLength, zig * ccLength, 0) });
    if (i > 0) {
      bonds.push({
        a: carbonIndices[i - 1]!,
        b: carbonIndices[i]!,
        order: spec.order,
        kind: 'covalent-nonpolar',
        electronegativityDelta: 0,
      });
    }
  }

  // Hidrogenos: los que quedan libres segun la valencia 4 del carbono.
  const hydrogensPerCarbon = (i: number): number => {
    const isTerminal = i === 0 || i === spec.carbons - 1;
    const bondsUsed = (isTerminal ? 1 : 2) * (spec.order === 1 ? 1 : spec.order);
    const base = 4 - bondsUsed;
    if (spec.tail && i === spec.carbons - 1) return Math.max(0, base - 1);
    return Math.max(0, base);
  };

  for (let i = 0; i < spec.carbons; i++) {
    const cIndex = carbonIndices[i]!;
    const n = hydrogensPerCarbon(i);
    const base = atoms[cIndex]!.position;
    for (let h = 0; h < n; h++) {
      const angle = (h / Math.max(1, n)) * Math.PI * 2;
      const dir = normalize(v(Math.cos(angle) * 0.4, Math.sin(angle) * 0.8, Math.cos(angle + 1) * 0.8));
      const hIndex = atoms.length;
      atoms.push({ id: nextId(), symbol: 'H', position: add(base, scale(dir, chLength)) });
      bonds.push({ a: cIndex, b: hIndex, order: 1, kind: 'covalent-polar', electronegativityDelta: 0.35 });
    }
  }

  // Grupo funcional terminal.
  if (spec.tail) {
    const last = carbonIndices[spec.carbons - 1]!;
    const base = atoms[last]!.position;
    const coLength = bondLength('C', 'O', 1);

    const oIndex = atoms.length;
    atoms.push({ id: nextId(), symbol: 'O', position: add(base, v(coLength, 0.3, 0)) });
    bonds.push({ a: last, b: oIndex, order: 1, kind: 'covalent-polar', electronegativityDelta: 0.89 });

    const hIndex = atoms.length;
    atoms.push({ id: nextId(), symbol: 'H', position: add(atoms[oIndex]!.position, v(0.5, 0.6, 0)) });
    bonds.push({ a: oIndex, b: hIndex, order: 1, kind: 'covalent-polar', electronegativityDelta: 1.24 });

    if (spec.tail === 'COOH') {
      const o2Index = atoms.length;
      atoms.push({ id: nextId(), symbol: 'O', position: add(base, v(0.4, -1.1, 0)) });
      bonds.push({ a: last, b: o2Index, order: 2, kind: 'covalent-polar', electronegativityDelta: 0.89 });
    }
  }

  return { motif: 'molecular', atoms, bonds, geometry: 'tetraedrica' };
}

/**
 * Genera la estructura 3D de una sustancia a partir de su formula.
 *
 * Devuelve null cuando no sabe construirla, en lugar de dibujar una nube de
 * atomos sin sentido: es preferible decir "estructura no disponible" a mostrar
 * una geometria falsa.
 */
export function buildStructure(
  formula: string,
  composition: ReadonlyMap<string, number>,
  options: { ionic?: boolean; cation?: string; anion?: string } = {},
): Structure | null {
  const clean = formula.replace(/·.*$/, '').trim();

  // 1. Molecula curada.
  const spec = SPECS[clean];
  if (spec) return buildFromSpec(spec);

  // 2. Cadena organica conocida.
  const chain = ORGANIC_CHAINS[clean];
  if (chain) return buildOrganicChain(chain);

  // 3. Sustancia simple.
  if (composition.size === 1) {
    const [symbol, count] = [...composition][0]!;
    if (count === 1) return buildSingleAtom(symbol);
    if (count === 2) {
      // El orden de enlace de las diatomicas conocidas.
      const order: BondOrder = symbol === 'N' ? 3 : symbol === 'O' ? 2 : 1;
      return buildDiatomic(symbol, order);
    }
    // S8, P4: se dispone en anillo, que es lo que realmente hacen.
    return buildRing(symbol, count);
  }

  // 4. Compuesto ionico.
  if (options.ionic && options.cation && options.anion) {
    const anionSpec = SPECS[options.anion];

    // Anion POLIATOMICO: no se puede dibujar una red cation/anion tratando al
    // sulfato como si fuera un atomo de azufre. Se construye un agregado con
    // los iones reales: los cationes como esferas sueltas y cada anion con su
    // geometria propia (el sulfato como tetraedro, el nitrato como triangulo).
    if (anionSpec) {
      const cluster = buildIonicCluster(options.cation, options.anion, composition);
      if (cluster) return cluster;
    }

    // Anion monoatomico: red cristalina extendida.
    if (options.anion.length <= 2 && getElement(options.anion)) {
      return buildIonicLattice(options.cation, options.anion);
    }
  }

  // 5. Binario A + B donde uno actua de central.
  if (composition.size === 2) {
    const entries = [...composition];
    const [symA, nA] = entries[0]!;
    const [symB, nB] = entries[1]!;
    // El menos abundante suele ser el central: en CH4 el carbono.
    const [central, ligand, ligandCount] = nA <= nB ? [symA, symB, nB] : [symB, symA, nA];
    if (ligandCount <= 6 && (nA === 1 || nB === 1)) {
      return buildFromSpec({
        central,
        ligands: Array.from({ length: ligandCount }, () => [ligand, 1] as [string, BondOrder]),
        lonePairs: 0,
      });
    }
  }

  return null;
}

/**
 * Agregado ionico con anion poliatomico: Al₂(SO₄)₃, Ca₃(PO₄)₂, Ca(NO₃)₂.
 *
 * No es una red cristalina completa —eso serian miles de iones— sino una
 * unidad formula: tantos cationes y tantos aniones como diga la formula,
 * repartidos en un anillo. Cada anion conserva su geometria real, asi que el
 * sulfato se ve como el tetraedro que es, y no como una bola generica.
 *
 * Los cationes NO se enlazan a los aniones con varillas: en un compuesto
 * ionico la union es electrostatica y no direccional, y dibujar palos
 * sugeriria enlaces covalentes que no existen.
 */
function buildIonicCluster(
  cation: string,
  anionFormula: string,
  composition: ReadonlyMap<string, number>,
): Structure | null {
  const spec = SPECS[anionFormula];
  if (!spec) return null;

  const cationCount = composition.get(cation) ?? 1;
  // Numero de aniones = atomos del elemento central del anion.
  const central = spec.central;
  if (!central) return null;
  const anionCount = central === cation ? 1 : composition.get(central) ?? 1;

  const atoms: StructureAtom[] = [];
  const bonds: Bond[] = [];

  const units = cationCount + anionCount;
  const radius = Math.max(2.2, units * 0.75);

  let placed = 0;
  const place = (): Vec3 => {
    const angle = (placed / units) * Math.PI * 2;
    // Ligera elevacion alterna para que no queden todos en un plano.
    const y = placed % 2 === 0 ? 0.35 : -0.35;
    placed++;
    return v(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  };

  // Cationes: esferas sueltas.
  for (let i = 0; i < cationCount; i++) {
    atoms.push({ id: nextId(), symbol: cation, position: place() });
  }

  // Aniones: cada uno con su geometria propia, trasladada a su posicion.
  for (let i = 0; i < anionCount; i++) {
    const unit = buildFromSpec(spec);
    const origin = place();
    const offset = atoms.length;
    for (const a of unit.atoms) {
      atoms.push({ ...a, id: nextId(), position: add(a.position, origin) });
    }
    for (const b of unit.bonds) {
      bonds.push({ ...b, a: b.a + offset, b: b.b + offset });
    }
  }

  return { motif: 'ionic-lattice', atoms, bonds };
}

/** Anillo plano, para S8 y P4. */
function buildRing(symbol: string, count: number): Structure {
  const length = bondLength(symbol, symbol, 1);
  const radius = length / (2 * Math.sin(Math.PI / count));
  const atoms: StructureAtom[] = [];
  const bonds: Bond[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    // Ligera alternancia vertical: el S8 real es una corona, no un plano.
    const pucker = i % 2 === 0 ? 0.25 : -0.25;
    atoms.push({
      id: nextId(),
      symbol,
      position: v(Math.cos(angle) * radius, pucker, Math.sin(angle) * radius),
    });
    bonds.push({
      a: i,
      b: (i + 1) % count,
      order: 1,
      kind: 'covalent-nonpolar',
      electronegativityDelta: 0,
    });
  }

  return { motif: 'molecular', atoms, bonds, geometry: 'compleja' };
}

/** Analiza la geometria de una estructura ya construida. */
export function describeGeometry(structure: Structure): VseprResult | null {
  if (structure.motif !== 'molecular') return null;
  if (structure.atoms.length < 2) return null;

  // El atomo central es el que tiene mas enlaces.
  const degree = new Map<number, number>();
  for (const b of structure.bonds) {
    degree.set(b.a, (degree.get(b.a) ?? 0) + 1);
    degree.set(b.b, (degree.get(b.b) ?? 0) + 1);
  }
  let centralIndex = 0;
  let maxDegree = 0;
  for (const [i, d] of degree) {
    if (d > maxDegree) {
      maxDegree = d;
      centralIndex = i;
    }
  }

  const central = structure.atoms[centralIndex];
  if (!central) return null;
  return vsepr(maxDegree, central.lonePairs ?? 0);
}
