/**
 * Isotopic masses and natural abundances.
 *
 * Two engines depend on these directly:
 *  - Mass spectrometry (§36): the isotope pattern of a molecular ion is a
 *    genuine convolution of the elemental isotope distributions, not a drawing.
 *    The M+2 signature of a chloride and the 1.1 % per carbon of the M+1 peak
 *    fall out of this table by themselves.
 *  - Nuclear chemistry (§52): decay modes and half-lives.
 *
 * Only elements with a meaningful isotope pattern (and the radionuclides the
 * nuclear module teaches) are tabulated; the rest are treated as monoisotopic
 * at their standard atomic weight, which is stated explicitly rather than
 * silently assumed.
 */

export interface Isotope {
  symbol: string;
  Z: number;
  /** Mass number A. */
  A: number;
  /** Exact isotopic mass, u. */
  mass: number;
  /** Natural mole fraction (0–1); 0 for synthetic / trace radionuclides. */
  abundance: number;
  /** Half-life in seconds; null for a stable nuclide. */
  halfLife: number | null;
  decayMode?: 'β−' | 'β+' | 'α' | 'CE' | 'FE' | 'TI';
  /** Nuclide produced by the decay, as "symbol-A". */
  daughter?: string;
}

const iso = (
  symbol: string, Z: number, A: number, mass: number, abundance: number,
  halfLife: number | null = null, decayMode?: Isotope['decayMode'], daughter?: string,
): Isotope => ({ symbol, Z, A, mass, abundance, halfLife, decayMode, daughter });

const YEAR = 31557600;
const DAY = 86400;
const HOUR = 3600;
const MIN = 60;

/**
 * Stable / naturally-occurring isotopes, grouped by element symbol.
 * Abundances are IUPAC 2013 representative values and sum to 1 per element.
 */
export const ISOTOPES: Record<string, Isotope[]> = {
  H: [iso('H', 1, 1, 1.00782503207, 0.999885), iso('H', 1, 2, 2.01410177785, 0.000115)],
  He: [iso('He', 2, 3, 3.01602931914, 0.00000134), iso('He', 2, 4, 4.00260325415, 0.99999866)],
  Li: [iso('Li', 3, 6, 6.015122795, 0.0759), iso('Li', 3, 7, 7.01600455, 0.9241)],
  Be: [iso('Be', 4, 9, 9.0121822, 1)],
  B: [iso('B', 5, 10, 10.0129370, 0.199), iso('B', 5, 11, 11.0093054, 0.801)],
  C: [iso('C', 6, 12, 12.0, 0.9893), iso('C', 6, 13, 13.0033548378, 0.0107)],
  N: [iso('N', 7, 14, 14.0030740048, 0.99636), iso('N', 7, 15, 15.0001088982, 0.00364)],
  O: [
    iso('O', 8, 16, 15.99491461956, 0.99757),
    iso('O', 8, 17, 16.99913170, 0.00038),
    iso('O', 8, 18, 17.9991610, 0.00205),
  ],
  F: [iso('F', 9, 19, 18.99840322, 1)],
  Ne: [
    iso('Ne', 10, 20, 19.9924401754, 0.9048),
    iso('Ne', 10, 21, 20.99384668, 0.0027),
    iso('Ne', 10, 22, 21.991385114, 0.0925),
  ],
  Na: [iso('Na', 11, 23, 22.9897692809, 1)],
  Mg: [
    iso('Mg', 12, 24, 23.985041700, 0.7899),
    iso('Mg', 12, 25, 24.98583692, 0.1000),
    iso('Mg', 12, 26, 25.982592929, 0.1101),
  ],
  Al: [iso('Al', 13, 27, 26.98153863, 1)],
  Si: [
    iso('Si', 14, 28, 27.9769265325, 0.92223),
    iso('Si', 14, 29, 28.976494700, 0.04685),
    iso('Si', 14, 30, 29.97377017, 0.03092),
  ],
  P: [iso('P', 15, 31, 30.97376163, 1)],
  S: [
    iso('S', 16, 32, 31.97207100, 0.9499),
    iso('S', 16, 33, 32.97145876, 0.0075),
    iso('S', 16, 34, 33.96786690, 0.0425),
    iso('S', 16, 36, 35.96708076, 0.0001),
  ],
  Cl: [iso('Cl', 17, 35, 34.96885268, 0.7576), iso('Cl', 17, 37, 36.96590259, 0.2424)],
  Ar: [
    iso('Ar', 18, 36, 35.967545106, 0.003336),
    iso('Ar', 18, 38, 37.9627324, 0.000629),
    iso('Ar', 18, 40, 39.9623831225, 0.996035),
  ],
  K: [
    iso('K', 19, 39, 38.96370668, 0.932581),
    iso('K', 19, 40, 39.96399848, 0.000117, 1.248e9 * YEAR, 'β−', 'Ca-40'),
    iso('K', 19, 41, 40.96182576, 0.067302),
  ],
  Ca: [
    iso('Ca', 20, 40, 39.96259098, 0.96941),
    iso('Ca', 20, 42, 41.95861801, 0.00647),
    iso('Ca', 20, 43, 42.9587666, 0.00135),
    iso('Ca', 20, 44, 43.9554818, 0.02086),
    iso('Ca', 20, 46, 45.9536926, 0.00004),
    iso('Ca', 20, 48, 47.952534, 0.00187),
  ],
  Ti: [
    iso('Ti', 22, 46, 45.9526316, 0.0825), iso('Ti', 22, 47, 46.9517631, 0.0744),
    iso('Ti', 22, 48, 47.9479463, 0.7372), iso('Ti', 22, 49, 48.9478700, 0.0541),
    iso('Ti', 22, 50, 49.9447912, 0.0518),
  ],
  V: [iso('V', 23, 50, 49.9471585, 0.0025), iso('V', 23, 51, 50.9439595, 0.9975)],
  Cr: [
    iso('Cr', 24, 50, 49.9460442, 0.04345), iso('Cr', 24, 52, 51.9405075, 0.83789),
    iso('Cr', 24, 53, 52.9406494, 0.09501), iso('Cr', 24, 54, 53.9388804, 0.02365),
  ],
  Mn: [iso('Mn', 25, 55, 54.9380451, 1)],
  Fe: [
    iso('Fe', 26, 54, 53.9396105, 0.05845), iso('Fe', 26, 56, 55.9349375, 0.91754),
    iso('Fe', 26, 57, 56.9353940, 0.02119), iso('Fe', 26, 58, 57.9332756, 0.00282),
  ],
  Co: [iso('Co', 27, 59, 58.9331950, 1)],
  Ni: [
    iso('Ni', 28, 58, 57.9353429, 0.680769), iso('Ni', 28, 60, 59.9307864, 0.262231),
    iso('Ni', 28, 61, 60.9310560, 0.011399), iso('Ni', 28, 62, 61.9283451, 0.036345),
    iso('Ni', 28, 64, 63.9279660, 0.009256),
  ],
  Cu: [iso('Cu', 29, 63, 62.9295975, 0.6915), iso('Cu', 29, 65, 64.9277895, 0.3085)],
  Zn: [
    iso('Zn', 30, 64, 63.9291422, 0.48268), iso('Zn', 30, 66, 65.9260334, 0.27975),
    iso('Zn', 30, 67, 66.9271273, 0.04102), iso('Zn', 30, 68, 67.9248442, 0.19024),
    iso('Zn', 30, 70, 69.9253193, 0.00631),
  ],
  Br: [iso('Br', 35, 79, 78.9183371, 0.5069), iso('Br', 35, 81, 80.9162906, 0.4931)],
  Ag: [iso('Ag', 47, 107, 106.905097, 0.51839), iso('Ag', 47, 109, 108.904752, 0.48161)],
  Sn: [
    iso('Sn', 50, 112, 111.904818, 0.0097), iso('Sn', 50, 114, 113.902779, 0.0066),
    iso('Sn', 50, 115, 114.903342, 0.0034), iso('Sn', 50, 116, 115.901741, 0.1454),
    iso('Sn', 50, 117, 116.902952, 0.0768), iso('Sn', 50, 118, 117.901603, 0.2422),
    iso('Sn', 50, 119, 118.903308, 0.0859), iso('Sn', 50, 120, 119.9021947, 0.3258),
    iso('Sn', 50, 122, 121.9034390, 0.0463), iso('Sn', 50, 124, 123.9052739, 0.0579),
  ],
  I: [iso('I', 53, 127, 126.904473, 1)],
  Ba: [
    iso('Ba', 56, 130, 129.9063208, 0.00106), iso('Ba', 56, 132, 131.9050613, 0.00101),
    iso('Ba', 56, 134, 133.9045084, 0.02417), iso('Ba', 56, 135, 134.9056886, 0.06592),
    iso('Ba', 56, 136, 135.9045759, 0.07854), iso('Ba', 56, 137, 136.9058274, 0.11232),
    iso('Ba', 56, 138, 137.9052472, 0.71698),
  ],
  Pb: [
    iso('Pb', 82, 204, 203.9730436, 0.014), iso('Pb', 82, 206, 205.9744653, 0.241),
    iso('Pb', 82, 207, 206.9758969, 0.221), iso('Pb', 82, 208, 207.9766521, 0.524),
  ],
  Hg: [
    iso('Hg', 80, 196, 195.965833, 0.0015), iso('Hg', 80, 198, 197.9667690, 0.0997),
    iso('Hg', 80, 199, 198.9682799, 0.1687), iso('Hg', 80, 200, 199.9683260, 0.2310),
    iso('Hg', 80, 201, 200.9703023, 0.1318), iso('Hg', 80, 202, 201.9706430, 0.2986),
    iso('Hg', 80, 204, 203.9734939, 0.0687),
  ],
};

/**
 * Radionuclides taught in Química Nuclear (§52). Kept separate from the
 * natural-abundance table because their abundance is zero: including them in
 * the isotope pattern of an ordinary molecule would be wrong.
 */
export const RADIONUCLIDES: Isotope[] = [
  iso('H', 1, 3, 3.0160492777, 0, 12.32 * YEAR, 'β−', 'He-3'),
  iso('C', 6, 11, 11.0114336, 0, 20.364 * MIN, 'β+', 'B-11'),
  iso('C', 6, 14, 14.003241989, 0, 5700 * YEAR, 'β−', 'N-14'),
  iso('N', 7, 13, 13.00573861, 0, 9.965 * MIN, 'β+', 'C-13'),
  iso('O', 8, 15, 15.0030656, 0, 122.24, 'β+', 'N-15'),
  iso('F', 9, 18, 18.0009380, 0, 109.77 * MIN, 'β+', 'O-18'),
  iso('Na', 11, 22, 21.9944364, 0, 2.6018 * YEAR, 'β+', 'Ne-22'),
  iso('P', 15, 32, 31.97390727, 0, 14.268 * DAY, 'β−', 'S-32'),
  iso('S', 16, 35, 34.96903216, 0, 87.37 * DAY, 'β−', 'Cl-35'),
  iso('K', 19, 40, 39.96399848, 0.000117, 1.248e9 * YEAR, 'β−', 'Ca-40'),
  iso('Co', 27, 60, 59.9338171, 0, 5.2714 * YEAR, 'β−', 'Ni-60'),
  iso('Sr', 38, 90, 89.907738, 0, 28.79 * YEAR, 'β−', 'Y-90'),
  iso('Tc', 43, 99, 98.9062547, 0, 6.0067 * HOUR, 'TI', 'Tc-99'),
  iso('I', 53, 125, 124.9046302, 0, 59.4 * DAY, 'CE', 'Te-125'),
  iso('I', 53, 131, 130.9061246, 0, 8.0252 * DAY, 'β−', 'Xe-131'),
  iso('Cs', 55, 137, 136.9070895, 0, 30.08 * YEAR, 'β−', 'Ba-137'),
  iso('Ra', 88, 226, 226.0254098, 0, 1600 * YEAR, 'α', 'Rn-222'),
  iso('Rn', 86, 222, 222.0175777, 0, 3.8235 * DAY, 'α', 'Po-218'),
  iso('Th', 90, 232, 232.0380553, 1, 1.405e10 * YEAR, 'α', 'Ra-228'),
  iso('U', 92, 234, 234.0409521, 0.000054, 2.455e5 * YEAR, 'α', 'Th-230'),
  iso('U', 92, 235, 235.0439299, 0.007204, 7.04e8 * YEAR, 'α', 'Th-231'),
  iso('U', 92, 238, 238.0507882, 0.992742, 4.468e9 * YEAR, 'α', 'Th-234'),
  iso('Pu', 94, 239, 239.0521634, 0, 24110 * YEAR, 'α', 'U-235'),
  iso('Am', 95, 241, 241.0568291, 0, 432.6 * YEAR, 'α', 'Np-237'),
];

const RADIO_INDEX = new Map(RADIONUCLIDES.map((r) => [`${r.symbol}-${r.A}`, r]));

export const radionuclide = (key: string): Isotope | undefined => RADIO_INDEX.get(key);

/** All tabulated nuclides for an element, natural first. */
export function isotopesOf(symbol: string): Isotope[] {
  const natural = ISOTOPES[symbol] ?? [];
  const radio = RADIONUCLIDES.filter((r) => r.symbol === symbol && !natural.some((n) => n.A === r.A));
  return [...natural, ...radio];
}

/**
 * Monoisotopic (exact) mass of an element: the mass of its most abundant
 * isotope. Distinct from the standard atomic weight — the difference matters
 * as soon as a student looks at a high-resolution mass spectrum.
 */
export function monoisotopicMass(symbol: string, fallback: number): number {
  const list = ISOTOPES[symbol];
  if (!list || list.length === 0) return fallback;
  return list.reduce((best, i) => (i.abundance > best.abundance ? i : best), list[0]).mass;
}

/** Average atomic mass recomputed from the isotope table — a consistency check. */
export function averageMassFromIsotopes(symbol: string): number | null {
  const list = ISOTOPES[symbol];
  if (!list) return null;
  const total = list.reduce((s, i) => s + i.abundance, 0);
  if (total <= 0) return null;
  return list.reduce((s, i) => s + i.mass * i.abundance, 0) / total;
}
