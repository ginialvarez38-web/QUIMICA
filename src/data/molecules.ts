/**
 * Molecular geometry library.
 *
 * Coordinates in ångström. Where a molecule's structure is known
 * experimentally, the geometry reproduces the measured bond lengths and angles
 * (water 0.958 Å / 104.5°, benzene 1.397 Å, methane 1.087 Å / 109.47°) and is
 * marked `experimental`. Anything built from VSEPR and covalent radii is marked
 * `construida` and says so in the interface — §53 and §66 forbid presenting a
 * constructed geometry as a measured one.
 */

import type { Molecule, Atom, Bond, BondOrder } from '../core/mol/molecule.js';

/** Terse atom constructor. */
const a = (id: number, element: string, x: number, y: number, z: number, extra: Partial<Atom> = {}): Atom =>
  ({ id, element, x, y, z, ...extra });

const b = (x: number, y: number, order: BondOrder = 1, extra: Partial<Bond> = {}): Bond =>
  ({ a: x, b: y, order, ...extra });

/** Regular tetrahedron directions scaled to a bond length. */
const TETRA: Array<[number, number, number]> = [
  [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
].map(([x, y, z]) => [x / Math.sqrt(3), y / Math.sqrt(3), z / Math.sqrt(3)]);

function tetrahedral(centre: string, ligand: string, length: number, name: string, formula: string, id: string): Molecule {
  return {
    id, name, formula,
    atoms: [
      a(0, centre, 0, 0, 0),
      ...TETRA.map((d, i) => a(i + 1, ligand, d[0] * length, d[1] * length, d[2] * length)),
    ],
    bonds: TETRA.map((_, i) => b(0, i + 1)),
    charge: 0,
    pointGroup: 'Td',
    dipole: 0,
    geometrySource: 'experimental',
  };
}

/** Planar hexagonal ring in the xy plane. */
function ring6(radius: number, zOffset = 0): Array<[number, number, number]> {
  return Array.from({ length: 6 }, (_, i) => {
    const t = (i * Math.PI) / 3;
    return [radius * Math.cos(t), radius * Math.sin(t), zOffset] as [number, number, number];
  });
}

const BENZENE_RING = ring6(1.397);
const BENZENE_H = ring6(1.397 + 1.084);

export const MOLECULES: Molecule[] = [
  {
    id: 'water', name: 'Agua', formula: 'H2O',
    // r(O–H) = 0.9578 Å, ∠HOH = 104.48°  (microwave spectroscopy)
    atoms: [
      a(0, 'O', 0, 0, 0, { lonePairs: 2 }),
      a(1, 'H', 0.7575, 0.5871, 0),
      a(2, 'H', -0.7575, 0.5871, 0),
    ],
    bonds: [b(0, 1), b(0, 2)],
    charge: 0, pointGroup: 'C2v', dipole: 1.85,
    geometrySource: 'experimental',
    notes: [
      'El ángulo de 104.5° es menor que el tetraédrico de 109.5° porque los dos pares solitarios del oxígeno ocupan más espacio que los pares enlazantes.',
      'Su momento dipolar de 1.85 D y su capacidad de formar cuatro puentes de hidrógeno explican casi todas sus propiedades anómalas.',
    ],
  },
  {
    id: 'ammonia', name: 'Amoníaco', formula: 'NH3',
    // r(N–H) = 1.012 Å, ∠HNH = 106.7°
    atoms: [
      a(0, 'N', 0, 0, 0.1173, { lonePairs: 1 }),
      a(1, 'H', 0.9377, 0, -0.2737),
      a(2, 'H', -0.4689, 0.8121, -0.2737),
      a(3, 'H', -0.4689, -0.8121, -0.2737),
    ],
    bonds: [b(0, 1), b(0, 2), b(0, 3)],
    charge: 0, pointGroup: 'C3v', dipole: 1.47,
    geometrySource: 'experimental',
    notes: [
      'Pirámide trigonal: cuatro pares electrónicos, tres enlazantes y uno solitario.',
      'La molécula se invierte como un paraguas 2.4×10¹⁰ veces por segundo; esa inversión fue la base del primer máser.',
    ],
  },
  tetrahedral('C', 'H', 1.087 / Math.sqrt(3) * Math.sqrt(3), 'Metano', 'CH4', 'methane'),
  {
    id: 'co2', name: 'Dióxido de carbono', formula: 'CO2',
    atoms: [
      a(0, 'C', 0, 0, 0),
      a(1, 'O', 1.163, 0, 0, { lonePairs: 2 }),
      a(2, 'O', -1.163, 0, 0, { lonePairs: 2 }),
    ],
    bonds: [b(0, 1, 2), b(0, 2, 2)],
    charge: 0, pointGroup: 'D∞h', dipole: 0,
    geometrySource: 'experimental',
    notes: [
      'Lineal y por tanto apolar, pese a que cada enlace C=O sí lo es: los dos dipolos de enlace se cancelan.',
      'Aun siendo apolar absorbe en el infrarrojo por sus modos de flexión y tensión asimétrica, y por eso es un gas de efecto invernadero.',
    ],
  },
  {
    id: 'benzene', name: 'Benceno', formula: 'C6H6',
    atoms: [
      ...BENZENE_RING.map((p, i) => a(i, 'C', p[0], p[1], p[2])),
      ...BENZENE_H.map((p, i) => a(i + 6, 'H', p[0], p[1], p[2])),
    ],
    bonds: [
      ...Array.from({ length: 6 }, (_, i) => b(i, (i + 1) % 6, 1.5, { aromatic: true })),
      ...Array.from({ length: 6 }, (_, i) => b(i, i + 6)),
    ],
    charge: 0, pointGroup: 'D6h', dipole: 0,
    geometrySource: 'experimental',
    notes: [
      'Los seis enlaces C–C miden exactamente lo mismo, 1.397 Å: entre un enlace simple (1.54 Å) y uno doble (1.34 Å).',
      'Esa igualdad es la prueba estructural de la deslocalización: no hay enlaces simples y dobles alternados, hay seis enlaces equivalentes.',
    ],
  },
  {
    id: 'ethanol', name: 'Etanol', formula: 'C2H6O',
    atoms: [
      a(0, 'C', -1.2154, 0.2761, 0.0000),
      a(1, 'C', 0.0000, -0.6058, 0.0000),
      a(2, 'O', 1.1970, 0.1550, 0.0000, { lonePairs: 2 }),
      a(3, 'H', -1.2500, 0.9159, 0.8850),
      a(4, 'H', -1.2500, 0.9159, -0.8850),
      a(5, 'H', -2.1149, -0.3450, 0.0000),
      a(6, 'H', 0.0300, -1.2520, 0.8850),
      a(7, 'H', 0.0300, -1.2520, -0.8850),
      a(8, 'H', 1.9600, -0.4300, 0.0000),
    ],
    bonds: [b(0, 1), b(1, 2), b(0, 3), b(0, 4), b(0, 5), b(1, 6), b(1, 7), b(2, 8)],
    charge: 0, pointGroup: 'Cs', dipole: 1.69,
    geometrySource: 'experimental',
    notes: ['El grupo –OH forma puentes de hidrógeno: por eso hierve a 78 °C y el etano, de masa parecida, a −89 °C.'],
  },
  {
    id: 'acetic-acid', name: 'Ácido acético', formula: 'C2H4O2',
    atoms: [
      a(0, 'C', 0.0000, 0.0000, 0.0000),
      a(1, 'C', 1.5200, 0.0000, 0.0000),
      a(2, 'O', 2.1600, 1.0400, 0.0000, { lonePairs: 2 }),
      a(3, 'O', 2.1000, -1.1800, 0.0000, { lonePairs: 2 }),
      a(4, 'H', -0.3700, 0.5300, 0.8850),
      a(5, 'H', -0.3700, 0.5300, -0.8850),
      a(6, 'H', -0.3700, -1.0300, 0.0000),
      a(7, 'H', 3.0600, -1.0900, 0.0000),
    ],
    bonds: [b(0, 1), b(1, 2, 2), b(1, 3), b(0, 4), b(0, 5), b(0, 6), b(3, 7)],
    charge: 0, dipole: 1.70,
    geometrySource: 'experimental',
    notes: ['En estado líquido y en disolventes apolares existe como dímero, unido por dos puentes de hidrógeno: por eso su banda O–H en el IR es tan ancha.'],
  },
  {
    id: 'acetone', name: 'Acetona', formula: 'C3H6O',
    atoms: [
      a(0, 'C', 0.0000, 0.1300, 0.0000),
      a(1, 'O', 0.0000, 1.3500, 0.0000, { lonePairs: 2 }),
      a(2, 'C', 1.2900, -0.6600, 0.0000),
      a(3, 'C', -1.2900, -0.6600, 0.0000),
      a(4, 'H', 1.3200, -1.3000, 0.8850),
      a(5, 'H', 1.3200, -1.3000, -0.8850),
      a(6, 'H', 2.1500, 0.0100, 0.0000),
      a(7, 'H', -1.3200, -1.3000, 0.8850),
      a(8, 'H', -1.3200, -1.3000, -0.8850),
      a(9, 'H', -2.1500, 0.0100, 0.0000),
    ],
    bonds: [b(0, 1, 2), b(0, 2), b(0, 3), b(2, 4), b(2, 5), b(2, 6), b(3, 7), b(3, 8), b(3, 9)],
    charge: 0, pointGroup: 'C2v', dipole: 2.88,
    geometrySource: 'experimental',
    notes: ['El carbonilo es plano y sp²; su fuerte momento dipolar explica que la acetona sea un buen disolvente aprótico polar.'],
  },
  {
    id: 'h2so4', name: 'Ácido sulfúrico', formula: 'H2SO4',
    atoms: [
      a(0, 'S', 0, 0, 0),
      a(1, 'O', 0.7200, 1.1600, 0.5000, { lonePairs: 2 }),
      a(2, 'O', -0.7200, -1.1600, 0.5000, { lonePairs: 2 }),
      a(3, 'O', 1.0000, -0.7000, -0.9000, { lonePairs: 2 }),
      a(4, 'O', -1.0000, 0.7000, -0.9000, { lonePairs: 2 }),
      a(5, 'H', 1.7400, -0.4000, -1.3500),
      a(6, 'H', -1.7400, 0.4000, -1.3500),
    ],
    bonds: [b(0, 1, 2), b(0, 2, 2), b(0, 3), b(0, 4), b(3, 5), b(4, 6)],
    charge: 0, dipole: 2.72,
    geometrySource: 'construida',
    notes: ['Azufre tetraédrico con dos enlaces S=O y dos S–OH; los dos protones no son equivalentes en su fuerza ácida (pKa −3 y 1.99).'],
  },
  {
    id: 'h3po4', name: 'Ácido fosfórico', formula: 'H3PO4',
    atoms: [
      a(0, 'P', 0, 0, 0),
      a(1, 'O', 0, 0, 1.4800, { lonePairs: 2 }),
      a(2, 'O', 1.3900, 0, -0.5100, { lonePairs: 2 }),
      a(3, 'O', -0.6950, 1.2038, -0.5100, { lonePairs: 2 }),
      a(4, 'O', -0.6950, -1.2038, -0.5100, { lonePairs: 2 }),
      a(5, 'H', 1.7000, 0.8000, -0.9500),
      a(6, 'H', -1.5400, 1.3300, -0.9500),
      a(7, 'H', -1.0000, -1.9000, -0.9500),
    ],
    bonds: [b(0, 1, 2), b(0, 2), b(0, 3), b(0, 4), b(2, 5), b(3, 6), b(4, 7)],
    charge: 0,
    geometrySource: 'construida',
    notes: ['Tres protones con pKa muy separados (2.15, 7.20, 12.35): por eso su curva de valoración muestra saltos claramente diferenciados.'],
  },
  {
    id: 'hno3', name: 'Ácido nítrico', formula: 'HNO3',
    atoms: [
      a(0, 'N', 0, 0, 0, { charge: 1 }),
      a(1, 'O', 1.2100, 0.0000, 0, { lonePairs: 2 }),
      a(2, 'O', -0.6300, 1.0900, 0, { lonePairs: 2, charge: -1 }),
      a(3, 'O', -0.6800, -1.1800, 0, { lonePairs: 2 }),
      a(4, 'H', -1.6400, -1.1200, 0),
    ],
    bonds: [b(0, 1, 2), b(0, 2), b(0, 3), b(3, 4)],
    charge: 0, dipole: 2.17,
    geometrySource: 'experimental',
    notes: ['Plana. El nitrógeno lleva carga formal +1 porque forma cuatro enlaces sin poder expandir el octeto.'],
  },
  {
    id: 'hcl', name: 'Cloruro de hidrógeno', formula: 'HCl',
    atoms: [a(0, 'Cl', 0, 0, 0, { lonePairs: 3 }), a(1, 'H', 1.2746, 0, 0)],
    bonds: [b(0, 1)],
    charge: 0, pointGroup: 'C∞v', dipole: 1.08,
    geometrySource: 'experimental',
    notes: ['Un solo enlace polar. En agua se disocia completamente; en benceno, prácticamente nada — el disolvente decide.'],
  },
  {
    id: 'h2o2', name: 'Peróxido de hidrógeno', formula: 'H2O2',
    atoms: [
      a(0, 'O', 0, 0.7375, -0.0528, { lonePairs: 2 }),
      a(1, 'O', 0, -0.7375, -0.0528, { lonePairs: 2 }),
      a(2, 'H', 0.8190, 0.8170, 0.4220),
      a(3, 'H', -0.8190, -0.8170, 0.4220),
    ],
    bonds: [b(0, 1), b(0, 2), b(1, 3)],
    charge: 0, pointGroup: 'C2', dipole: 2.26,
    geometrySource: 'experimental',
    notes: ['No es plana: el ángulo diedro de 111° es el ejemplo clásico de una molécula cuya forma sólo se aprecia en tres dimensiones.'],
  },
  {
    id: 'glucose', name: 'β-D-glucopiranosa', formula: 'C6H12O6',
    // Chair conformation with every substituent equatorial — the reason β-D-glucose
    // is the most abundant monosaccharide in nature.
    atoms: [
      a(0, 'C', 1.2800, -0.4200, 0.2400),
      a(1, 'C', 0.6600, 0.9500, 0.4600),
      a(2, 'C', -0.7900, 1.0000, -0.0200),
      a(3, 'C', -1.5600, -0.1800, 0.5600),
      a(4, 'C', -0.8100, -1.4800, 0.2800),
      a(5, 'O', 0.5400, -1.4300, 0.7500),
      a(6, 'O', 2.5800, -0.4600, 0.8100, { lonePairs: 2 }),
      a(7, 'O', 1.3700, 1.9700, -0.2300, { lonePairs: 2 }),
      a(8, 'O', -1.4000, 2.2100, 0.4000, { lonePairs: 2 }),
      a(9, 'O', -2.8600, -0.1900, 0.0000, { lonePairs: 2 }),
      a(10, 'C', -1.4800, -2.7000, 0.8800),
      a(11, 'O', -0.8400, -3.8600, 0.3800, { lonePairs: 2 }),
      a(12, 'H', 1.3800, -0.6100, -0.8400),
      a(13, 'H', 0.6800, 1.1800, 1.5400),
      a(14, 'H', -0.8000, 0.9500, -1.1200),
      a(15, 'H', -1.6300, -0.0900, 1.6500),
      a(16, 'H', -0.7900, -1.6000, -0.8200),
      a(17, 'H', 3.0000, 0.4000, 0.6800),
      a(18, 'H', 2.2900, 1.9200, 0.0700),
      a(19, 'H', -1.0400, 2.9800, -0.0600),
      a(20, 'H', -3.3200, 0.6100, 0.2600),
      a(21, 'H', -2.5400, -2.7100, 0.5900),
      a(22, 'H', -1.4700, -2.6900, 1.9800),
      a(23, 'H', -1.2900, -4.6100, 0.7700),
    ],
    bonds: [
      b(0, 1), b(1, 2), b(2, 3), b(3, 4), b(4, 5), b(5, 0),
      b(0, 6), b(1, 7), b(2, 8), b(3, 9), b(4, 10), b(10, 11),
      b(0, 12), b(1, 13), b(2, 14), b(3, 15), b(4, 16),
      b(6, 17), b(7, 18), b(8, 19), b(9, 20), b(10, 21), b(10, 22), b(11, 23),
    ],
    charge: 0,
    geometrySource: 'construida',
    notes: [
      'Conformación de silla con todos los sustituyentes en posición ecuatorial: la disposición de menor energía posible.',
      'Esa estabilidad excepcional es la razón de que la glucosa, y no otro hexosa, sea el azúcar central del metabolismo.',
    ],
  },
  {
    id: 'salicylic-acid', name: 'Ácido salicílico', formula: 'C7H6O3',
    atoms: [
      ...ring6(1.397).map((p, i) => a(i, 'C', p[0], p[1], 0)),
      a(6, 'C', 2.5000, 0.5000, 0),
      a(7, 'O', 3.1500, 1.5300, 0, { lonePairs: 2 }),
      a(8, 'O', 3.0500, -0.7100, 0, { lonePairs: 2 }),
      a(9, 'O', 0.1500, 2.6400, 0, { lonePairs: 2 }),
      a(10, 'H', 3.9800, -0.6300, 0),
      a(11, 'H', 1.0400, 3.0300, 0),
      a(12, 'H', -1.9700, 2.0500, 0),
      a(13, 'H', -2.9200, -0.2500, 0),
      a(14, 'H', -1.1900, -2.2000, 0),
      a(15, 'H', 0.9800, -1.9800, 0),
    ],
    bonds: [
      ...Array.from({ length: 6 }, (_, i) => b(i, (i + 1) % 6, 1.5, { aromatic: true })),
      b(0, 6), b(6, 7, 2), b(6, 8), b(1, 9), b(8, 10), b(9, 11),
      b(2, 12), b(3, 13), b(4, 14), b(5, 15),
    ],
    charge: 0,
    geometrySource: 'construida',
    notes: [
      'El –OH en posición orto forma un puente de hidrógeno intramolecular con el carbonilo.',
      'Ese puente interno es la razón de que su pKa (2.97) sea mucho menor que el del ácido benzoico (4.20): estabiliza la base conjugada.',
    ],
  },
];

const BY_ID = new Map(MOLECULES.map((m) => [m.id, m]));
export const moleculeById = (id: string): Molecule | undefined => BY_ID.get(id);

export const moleculeByFormula = (formula: string): Molecule | undefined =>
  MOLECULES.find((m) => m.formula === formula);

export function searchMolecules(query: string): Molecule[] {
  const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return MOLECULES.filter((m) =>
    m.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)
    || m.formula.toLowerCase().includes(query.toLowerCase()));
}
