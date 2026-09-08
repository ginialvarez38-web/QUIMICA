/**
 * ISOTOPOS.
 *
 * PROCEDENCIA
 * Masas isotopicas y abundancias de la evaluacion AME2020 / IUPAC 2021
 * («Atomic weights of the elements 2021», Pure Appl. Chem.). Las masas estan
 * en unidades de masa atomica unificada (u) y las abundancias en tanto por
 * ciento de la composicion isotopica terrestre representativa.
 *
 * POR QUE ESTA TABLA EXISTE
 * Sin ella, los apartados de isotopos, isobaras, isotonos y abundancia
 * isotopica solo podrian ser texto. Con ella se pueden CALCULAR:
 *
 *   - La masa atomica de un elemento como media ponderada de sus isotopos, y
 *     comprobar que coincide con el valor tabulado. Es la demostracion de por
 *     que el cloro pesa 35,45 y no un numero entero.
 *   - Las isobaras: agrupar por numero masico y ver que elementos distintos
 *     comparten A.
 *   - Los isotonos: agrupar por numero de neutrones.
 *
 * QUE NO INCLUYE
 * NO es la tabla completa de nucleidos — hay unos 3400 conocidos. Estan los
 * elementos cuya composicion isotopica se estudia y los nucleidos que hacen
 * falta para los ejemplos de isobaras e isotonos. Los elementos que no
 * aparecen aqui no es que no tengan isotopos: es que este proyecto no ha
 * curado sus datos, y `isotopesOf` devuelve una lista vacia en lugar de
 * inventarlos.
 */

export interface Isotope {
  readonly symbol: string;
  /** Numero atomico: protones. */
  readonly Z: number;
  /** Numero masico: protones + neutrones. */
  readonly A: number;
  /** Masa isotopica en u. */
  readonly mass: number;
  /** Abundancia natural en %. 0 para los que no aparecen en la naturaleza. */
  readonly abundance: number;
  /** Estable o radiactivo. */
  readonly radioactive: boolean;
  /** Periodo de semidesintegracion, cuando es radiactivo. */
  readonly halfLife?: string;
  /** Nombre propio, si lo tiene. */
  readonly name?: string;
  /** Para que se usa, cuando tiene un uso conocido. */
  readonly note?: string;
}

/**
 * Los datos.
 *
 * El ¹²C lleva masa 12 EXACTA y no es un redondeo: la unidad de masa atomica
 * se define como la doceava parte de la masa de un atomo de carbono-12. Es el
 * patron, asi que su masa es exacta por definicion.
 */
const DATA: readonly Isotope[] = [
  // --- Hidrogeno: el unico cuyos isotopos tienen nombre propio -------------
  { symbol: 'H', Z: 1, A: 1, mass: 1.00782503, abundance: 99.9885, radioactive: false, name: 'protio' },
  {
    symbol: 'H', Z: 1, A: 2, mass: 2.01410178, abundance: 0.0115, radioactive: false, name: 'deuterio',
    note: 'Forma agua pesada (D2O), moderador en reactores nucleares.',
  },
  {
    symbol: 'H', Z: 1, A: 3, mass: 3.01604928, abundance: 0, radioactive: true, halfLife: '12,32 anos',
    name: 'tritio', note: 'Radiactivo. Se produce artificialmente; solo hay trazas en la naturaleza.',
  },

  // --- Carbono ------------------------------------------------------------
  {
    symbol: 'C', Z: 6, A: 12, mass: 12, abundance: 98.93, radioactive: false,
    note: 'PATRON de la unidad de masa atomica: su masa es 12 u por definicion, exacta.',
  },
  { symbol: 'C', Z: 6, A: 13, mass: 13.00335484, abundance: 1.07, radioactive: false },
  {
    symbol: 'C', Z: 6, A: 14, mass: 14.00324199, abundance: 0, radioactive: true, halfLife: '5730 anos',
    note: 'Datacion por radiocarbono de restos organicos de hasta unos 50 000 anos.',
  },

  // --- Nitrogeno ----------------------------------------------------------
  { symbol: 'N', Z: 7, A: 14, mass: 14.00307401, abundance: 99.636, radioactive: false },
  { symbol: 'N', Z: 7, A: 15, mass: 15.00010890, abundance: 0.364, radioactive: false },

  // --- Oxigeno ------------------------------------------------------------
  { symbol: 'O', Z: 8, A: 16, mass: 15.99491462, abundance: 99.757, radioactive: false },
  { symbol: 'O', Z: 8, A: 17, mass: 16.99913176, abundance: 0.038, radioactive: false },
  {
    symbol: 'O', Z: 8, A: 18, mass: 17.99915961, abundance: 0.205, radioactive: false,
    note: 'Su proporcion en el hielo polar sirve para reconstruir climas del pasado.',
  },

  // --- Boro: el caso de la masa 10,81 -------------------------------------
  { symbol: 'B', Z: 5, A: 10, mass: 10.01293695, abundance: 19.9, radioactive: false },
  { symbol: 'B', Z: 5, A: 11, mass: 11.00930536, abundance: 80.1, radioactive: false },

  // --- Neon ---------------------------------------------------------------
  { symbol: 'Ne', Z: 10, A: 20, mass: 19.99244018, abundance: 90.48, radioactive: false },
  { symbol: 'Ne', Z: 10, A: 21, mass: 20.99384669, abundance: 0.27, radioactive: false },
  { symbol: 'Ne', Z: 10, A: 22, mass: 21.99138511, abundance: 9.25, radioactive: false },

  // --- Magnesio -----------------------------------------------------------
  { symbol: 'Mg', Z: 12, A: 24, mass: 23.98504170, abundance: 78.99, radioactive: false },
  { symbol: 'Mg', Z: 12, A: 25, mass: 24.98583698, abundance: 10.00, radioactive: false },
  { symbol: 'Mg', Z: 12, A: 26, mass: 25.98259297, abundance: 11.01, radioactive: false },

  // --- Azufre -------------------------------------------------------------
  { symbol: 'S', Z: 16, A: 32, mass: 31.97207117, abundance: 94.99, radioactive: false },
  { symbol: 'S', Z: 16, A: 33, mass: 32.97145891, abundance: 0.75, radioactive: false },
  { symbol: 'S', Z: 16, A: 34, mass: 33.96786700, abundance: 4.25, radioactive: false },
  { symbol: 'S', Z: 16, A: 36, mass: 35.96708071, abundance: 0.01, radioactive: false },

  // --- Cloro: el ejemplo canonico de masa no entera -----------------------
  { symbol: 'Cl', Z: 17, A: 35, mass: 34.96885268, abundance: 75.76, radioactive: false },
  { symbol: 'Cl', Z: 17, A: 37, mass: 36.96590260, abundance: 24.24, radioactive: false },

  // --- Argon, potasio y calcio: los tres comparten A = 40 (isobaras) ------
  { symbol: 'Ar', Z: 18, A: 36, mass: 35.96754511, abundance: 0.3336, radioactive: false },
  { symbol: 'Ar', Z: 18, A: 38, mass: 37.96273211, abundance: 0.0629, radioactive: false },
  { symbol: 'Ar', Z: 18, A: 40, mass: 39.96238312, abundance: 99.6035, radioactive: false },

  { symbol: 'K', Z: 19, A: 39, mass: 38.96370649, abundance: 93.2581, radioactive: false },
  {
    symbol: 'K', Z: 19, A: 40, mass: 39.96399817, abundance: 0.0117, radioactive: true,
    halfLife: '1,25 · 10⁹ anos',
    note: 'Radiactivo natural. Con el argon-40 que produce se datan rocas.',
  },
  { symbol: 'K', Z: 19, A: 41, mass: 40.96182526, abundance: 6.7302, radioactive: false },

  { symbol: 'Ca', Z: 20, A: 40, mass: 39.96259086, abundance: 96.941, radioactive: false },
  { symbol: 'Ca', Z: 20, A: 42, mass: 41.95861783, abundance: 0.647, radioactive: false },
  { symbol: 'Ca', Z: 20, A: 43, mass: 42.95876644, abundance: 0.135, radioactive: false },
  { symbol: 'Ca', Z: 20, A: 44, mass: 43.95548156, abundance: 2.086, radioactive: false },
  { symbol: 'Ca', Z: 20, A: 46, mass: 45.95368900, abundance: 0.004, radioactive: false },
  { symbol: 'Ca', Z: 20, A: 48, mass: 47.95252276, abundance: 0.187, radioactive: false },

  // --- Hierro -------------------------------------------------------------
  { symbol: 'Fe', Z: 26, A: 54, mass: 53.93960899, abundance: 5.845, radioactive: false },
  { symbol: 'Fe', Z: 26, A: 56, mass: 55.93493633, abundance: 91.754, radioactive: false },
  { symbol: 'Fe', Z: 26, A: 57, mass: 56.93539284, abundance: 2.119, radioactive: false },
  { symbol: 'Fe', Z: 26, A: 58, mass: 57.93327443, abundance: 0.282, radioactive: false },

  // --- Cobre: dos isotopos y una masa de 63,55 ----------------------------
  { symbol: 'Cu', Z: 29, A: 63, mass: 62.92959772, abundance: 69.15, radioactive: false },
  { symbol: 'Cu', Z: 29, A: 65, mass: 64.92778970, abundance: 30.85, radioactive: false },

  // --- Bromo: casi mitad y mitad, de ahi el 79,90 -------------------------
  { symbol: 'Br', Z: 35, A: 79, mass: 78.91833760, abundance: 50.69, radioactive: false },
  { symbol: 'Br', Z: 35, A: 81, mass: 80.91628970, abundance: 49.31, radioactive: false },

  // --- Uranio: la separacion isotopica que importa ------------------------
  { symbol: 'U', Z: 92, A: 234, mass: 234.04095011, abundance: 0.0054, radioactive: true, halfLife: '2,46 · 10⁵ anos' },
  {
    symbol: 'U', Z: 92, A: 235, mass: 235.04392819, abundance: 0.7204, radioactive: true,
    halfLife: '7,04 · 10⁸ anos',
    note: 'El unico fisionable con neutrones lentos. Enriquecer uranio es aumentar su proporcion.',
  },
  { symbol: 'U', Z: 92, A: 238, mass: 238.05078826, abundance: 99.2742, radioactive: true, halfLife: '4,47 · 10⁹ anos' },
];

/** Todos los nucleidos curados. */
export const ISOTOPES: readonly Isotope[] = DATA;

/** Los isotopos de un elemento, de menor a mayor numero masico. */
export function isotopesOf(symbol: string): readonly Isotope[] {
  return DATA.filter((i) => i.symbol === symbol).sort((a, b) => a.A - b.A);
}

/** Elementos para los que hay datos isotopicos curados. */
export function elementsWithIsotopes(): readonly string[] {
  return [...new Set(DATA.map((i) => i.symbol))];
}

/** Neutrones de un nucleido: N = A − Z. */
export function neutronsOf(isotope: Isotope): number {
  return isotope.A - isotope.Z;
}

/**
 * ISOBARAS: mismo numero MASICO, distinto numero atomico.
 *
 * Se buscan en los datos en lugar de escribirlas a mano, de modo que si se
 * anade un nucleido aparecen las parejas nuevas solas.
 */
export function isobarsOf(A: number): readonly Isotope[] {
  return DATA.filter((i) => i.A === A).sort((a, b) => a.Z - b.Z);
}

/** Todos los grupos de isobaras con al menos dos elementos distintos. */
export function allIsobarGroups(): readonly { readonly A: number; readonly members: readonly Isotope[] }[] {
  const byA = new Map<number, Isotope[]>();
  for (const i of DATA) {
    const list = byA.get(i.A) ?? [];
    list.push(i);
    byA.set(i.A, list);
  }
  return [...byA.entries()]
    .filter(([, members]) => new Set(members.map((m) => m.Z)).size > 1)
    .map(([A, members]) => ({ A, members: members.sort((a, b) => a.Z - b.Z) }))
    .sort((a, b) => a.A - b.A);
}

/**
 * ISOTONOS: mismo numero de NEUTRONES, distinto numero atomico.
 */
export function isotonesOf(neutrons: number): readonly Isotope[] {
  return DATA.filter((i) => neutronsOf(i) === neutrons).sort((a, b) => a.Z - b.Z);
}

export function allIsotoneGroups(): readonly { readonly N: number; readonly members: readonly Isotope[] }[] {
  const byN = new Map<number, Isotope[]>();
  for (const i of DATA) {
    const n = neutronsOf(i);
    const list = byN.get(n) ?? [];
    list.push(i);
    byN.set(n, list);
  }
  return [...byN.entries()]
    .filter(([, members]) => new Set(members.map((m) => m.Z)).size > 1)
    .map(([N, members]) => ({ N, members: members.sort((a, b) => a.Z - b.Z) }))
    .sort((a, b) => a.N - b.N);
}

/** Notacion de nucleido: "³⁵Cl". */
export function nuclideLabel(isotope: Isotope): string {
  const superscript = String(isotope.A)
    .split('')
    .map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]!)
    .join('');
  return `${superscript}${isotope.symbol}`;
}
