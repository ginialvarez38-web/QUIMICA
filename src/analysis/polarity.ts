/**
 * POLARITY ENGINE (§21, §22, §23, §24).
 *
 * Responde a la pregunta que mas se falla en los examenes: por que el CO2, que
 * tiene dos enlaces MUY polares, es una molecula APOLAR.
 *
 * La respuesta esta en dos escalones que hay que separar:
 *
 *   ENLACE  — un enlace es polar si los dos atomos atraen los electrones con
 *             fuerza distinta. Depende SOLO de la diferencia de
 *             electronegatividad.
 *
 *   MOLECULA — la molecula es polar si los dipolos de sus enlaces NO se
 *             cancelan. Depende de la diferencia de electronegatividad Y DE LA
 *             GEOMETRIA. El CO2 tiene dos dipolos grandes apuntando en
 *             sentidos opuestos: se anulan.
 *
 * El calculo no es cualitativo: se toman las direcciones reales que VSEPR
 * asigna a los ligandos y se SUMAN los vectores. Con eso, el resultado no
 * depende de que alguien haya catalogado la molecula como simetrica.
 *
 * LO QUE ESTE MODULO NO HACE (§32)
 * No da el momento dipolar en debyes. El modulo del dipolo depende de la
 * longitud de enlace real y de la contribucion de los pares libres, que este
 * motor no calcula. Da la DIRECCION y si se cancelan o no, que es lo que
 * decide la polaridad, y lo dice en lugar de estimar un numero.
 */

import type { LewisStructure } from './lewis.js';
import type { GeometryResult } from './hybridization.js';
import { ligandDirections } from '../geometry/vsepr.js';
import { getElement } from '../data/elements.js';
import { METALLIC_CATEGORIES } from '../core/types.js';
import type { Vec3 } from '../core/types.js';

export type BondPolarityKind = 'apolar' | 'polar' | 'ionico';

export interface BondPolarity {
  readonly label: string;
  readonly a: string;
  readonly b: string;
  /** Diferencia de electronegatividad de Pauling. */
  readonly deltaEN: number;
  readonly kind: BondPolarityKind;
  /** Hacia que atomo se desplaza la densidad electronica. */
  readonly towards: string;
  /** Porcentaje de caracter ionico segun la relacion de Pauling. */
  readonly ionicCharacter: number;
  readonly explanation: string;
}

export interface PolarityResult {
  readonly bonds: readonly BondPolarity[];
  /** Suma vectorial de los dipolos de enlace, en unidades arbitrarias. */
  readonly netDipole: Vec3;
  /** Modulo de esa suma. */
  readonly magnitude: number;
  readonly isPolar: boolean;
  /** Direccion del dipolo, descrita en palabras. */
  readonly direction: string;
  /** Por que se cancelan o por que no. */
  readonly reason: string;
  readonly symmetric: boolean;
  /**
   * La polaridad la decide el par libre y no los enlaces: los dipolos de
   * enlace se cancelan (o son nulos) pero queda un par libre sin compensar.
   */
  readonly decidedByLonePairs: boolean;
  readonly steps: readonly { readonly n: number; readonly text: string; readonly math?: string }[];
  readonly caution: string;
}

/**
 * Umbral por debajo del cual la suma vectorial se considera nula.
 *
 * Las direcciones de VSEPR se calculan con trigonometria, asi que una
 * cancelacion exacta sale como 1e-16 y no como 0. El umbral esta muy por
 * debajo de cualquier dipolo real (el enlace C–H, el mas debil de los polares,
 * da 0,35) y muy por encima del ruido numerico.
 */
const CANCELLATION_THRESHOLD = 0.02;

/**
 * Criterios de Pauling, los que se ensenan: <0,4 apolar, 0,4–1,7 polar,
 * >1,7 ionico.
 *
 * PERO el umbral de 1,7 falla, y falla en casos famosos. El HF tiene Δχ = 1,78
 * y es un gas covalente; el B–F del BF3 llega a 1,94 y el BF3 tambien es un gas
 * covalente. La razon es que el criterio de Δχ ignora de que elementos se
 * trata: un enlace ionico exige que uno de los dos CEDA el electron, y para eso
 * hace falta un metal con energia de ionizacion baja. Entre dos no metales, por
 * grande que sea la diferencia, no hay transferencia: hay un enlace covalente
 * muy polarizado.
 *
 * Asi que aqui se usan las dos condiciones, y cuando la Δχ sola habria dicho
 * "ionico" se conserva ese dato para poder explicar por que la regla del 1,7
 * no basta.
 */
function classifyBond(deltaEN: number, symbolA: string, symbolB: string): {
  kind: BondPolarityKind;
  overridesThreshold: boolean;
} {
  const a = getElement(symbolA);
  const b = getElement(symbolB);
  const involvesMetal =
    (a !== undefined && METALLIC_CATEGORIES.has(a.category)) ||
    (b !== undefined && METALLIC_CATEGORIES.has(b.category));

  if (deltaEN < 0.4) return { kind: 'apolar', overridesThreshold: false };
  if (deltaEN < 1.7) return { kind: 'polar', overridesThreshold: false };
  if (involvesMetal) return { kind: 'ionico', overridesThreshold: false };
  // Δχ > 1,7 pero sin metal: covalente muy polar, no ionico.
  return { kind: 'polar', overridesThreshold: true };
}

/**
 * Caracter ionico porcentual segun Pauling: 100·(1 − e^(−¼·Δχ²)).
 *
 * Es una correlacion empirica que Pauling ajusto a datos de momentos
 * dipolares, no una deduccion. Sirve para ver que el paso de covalente a
 * ionico es GRADUAL: no hay ninguna frontera a la que algo deje de ser una
 * cosa y pase a ser la otra.
 */
function ionicCharacter(deltaEN: number): number {
  return 100 * (1 - Math.exp(-0.25 * deltaEN * deltaEN));
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(v: Vec3, k: number): Vec3 {
  return { x: v.x * k, y: v.y * k, z: v.z * k };
}

function norm(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

/**
 * Describe hacia donde apunta el dipolo en terminos de los atomos, no de
 * coordenadas: "del carbono hacia los oxigenos" dice algo, "(0, 0.4, 0)" no.
 */
function describeDirection(
  structure: LewisStructure,
  contributions: readonly { readonly index: number; readonly vector: Vec3 }[],
  net: Vec3,
): string {
  if (norm(net) < CANCELLATION_THRESHOLD) return 'Sin dipolo neto.';

  // El atomo cuyo dipolo mas se parece a la resultante marca el extremo negativo.
  let bestIndex = -1;
  let bestAlignment = -Infinity;
  for (const c of contributions) {
    const m = norm(c.vector);
    if (m < 1e-9) continue;
    const alignment = (c.vector.x * net.x + c.vector.y * net.y + c.vector.z * net.z) / (m * norm(net));
    if (alignment > bestAlignment) {
      bestAlignment = alignment;
      bestIndex = c.index;
    }
  }

  const central = structure.atoms[structure.centralIndex];
  const target = bestIndex >= 0 ? structure.atoms[bestIndex] : undefined;
  if (!central || !target) return 'Hay dipolo neto.';

  return (
    `El extremo negativo (δ−) queda del lado de ${target.symbol}; el positivo (δ+), del lado de ` +
    `${central.symbol}. El dipolo apunta del ${central.symbol} hacia ${target.symbol}.`
  );
}

export function analyzePolarity(structure: LewisStructure, geometry: GeometryResult): PolarityResult {
  const bonds: BondPolarity[] = structure.bonds.map((bond) => {
    const a = structure.atoms[bond.a]!;
    const b = structure.atoms[bond.b]!;
    const enA = getElement(a.symbol)?.electronegativity ?? 0;
    const enB = getElement(b.symbol)?.electronegativity ?? 0;
    const delta = Math.abs(enA - enB);
    const { kind, overridesThreshold } = classifyBond(delta, a.symbol, b.symbol);
    const towards = enA > enB ? a.symbol : enB > enA ? b.symbol : '—';

    return {
      label: `${a.id}–${b.id}`,
      a: a.symbol,
      b: b.symbol,
      deltaEN: delta,
      kind,
      towards,
      ionicCharacter: ionicCharacter(delta),
      explanation:
        delta === 0
          ? `Dos atomos del mismo elemento atraen los electrones por igual: el enlace es perfectamente apolar.`
          : `χ(${enA > enB ? a.symbol : b.symbol}) − χ(${enA > enB ? b.symbol : a.symbol}) = ` +
            `${Math.max(enA, enB).toFixed(2)} − ${Math.min(enA, enB).toFixed(2)} = ${delta.toFixed(2)}. ` +
            (kind === 'apolar'
              ? 'Por debajo de 0,4 la diferencia se considera despreciable: enlace covalente apolar.'
              : kind === 'ionico'
                ? 'Por encima de 1,7 y con un metal de por medio, el desplazamiento deja de ser un ' +
                  'reparto desigual y pasa a ser una transferencia: enlace ionico.'
                : overridesThreshold
                  ? `La densidad se desplaza mucho hacia el ${towards}. La regla que se ensena diria ` +
                    '"ionico" por pasar de 1,7, PERO aqui no hay ningun metal: ninguno de los dos ' +
                    'atomos puede ceder el electron. Es un enlace covalente MUY polar. El HF ' +
                    '(Δχ = 1,78) es el contraejemplo clasico de esa regla, y es un gas covalente.'
                  : `La densidad electronica se desplaza hacia el ${towards}, que queda con carga parcial δ−.`),
    };
  });

  /*
   * Suma vectorial.
   *
   * Se toman las MISMAS direcciones que usa el motor de geometria, de modo que
   * lo que se suma es la molecula que el usuario esta viendo en 3D y no una
   * idealizacion aparte. Cada dipolo tiene modulo Δχ y apunta del atomo menos
   * electronegativo al mas electronegativo.
   */
  const central = geometry.central;
  const contributions: { index: number; vector: Vec3 }[] = [];
  let net: Vec3 = { x: 0, y: 0, z: 0 };

  if (central && central.bondedAtoms >= 1) {
    const incident = structure.bonds.filter(
      (b) => b.a === central.index || b.b === central.index,
    );
    const directions = ligandDirections(
      central.bondedAtoms,
      central.lonePairs,
      central.vsepr?.idealAngle ?? 109.5,
      central.stericNumber,
    );

    const centralEN = getElement(central.symbol)?.electronegativity ?? 0;

    incident.forEach((bond, k) => {
      const other = structure.atoms[bond.a === central.index ? bond.b : bond.a]!;
      const otherEN = getElement(other.symbol)?.electronegativity ?? 0;
      const direction = directions[k];
      if (!direction) return;
      // Positivo: el dipolo apunta del central hacia el ligando (el ligando es
      // mas electronegativo). Negativo: apunta al reves.
      const vector = scale(direction, otherEN - centralEN);
      contributions.push({ index: other.index, vector });
      net = add(net, vector);
    });
  } else if (structure.bonds.length === 1) {
    // Diatomica: el dipolo es el del unico enlace.
    const bond = structure.bonds[0]!;
    const a = structure.atoms[bond.a]!;
    const b = structure.atoms[bond.b]!;
    const delta = (getElement(b.symbol)?.electronegativity ?? 0) - (getElement(a.symbol)?.electronegativity ?? 0);
    net = { x: delta, y: 0, z: 0 };
    contributions.push({ index: b.index, vector: net });
  }

  const magnitude = norm(net);
  const polarBonds = bonds.filter((b) => b.kind !== 'apolar');

  /*
   * CONTRIBUCION DE LOS PARES LIBRES.
   *
   * Sumar solo dipolos de ENLACE deja fuera algo real: un par libre es una
   * acumulacion de carga negativa que no esta compensada por ningun nucleo, y
   * tambien aporta al dipolo.
   *
   * Normalmente no cambia la conclusion, porque en las moleculas con pares
   * libres los enlaces ya son polares y apuntan al mismo lado (H2O, NH3). Pero
   * hay un caso en que decide: la FOSFINA. P y H tienen practicamente la misma
   * electronegatividad (2,19 y 2,20), asi que los dipolos de enlace son nulos
   * y la suma vectorial da cero — y sin embargo el PH3 es polar (μ = 0,58 D),
   * porque el par libre no esta compensado.
   *
   * En lugar de inventarle un modulo al par libre, se comprueba si su
   * DIRECCION queda sin compensar. Eso depende solo de la geometria molecular,
   * y estas cinco son las formas en que los pares libres no se cancelan entre
   * si.
   */
  const ASYMMETRIC_LONE_PAIR_SHAPES = new Set([
    'angular',
    'piramidal trigonal',
    'balancin',
    'forma de T',
    'piramidal cuadrada',
  ]);
  const lonePairsUncompensated =
    central !== null &&
    central.lonePairs > 0 &&
    central.vsepr !== null &&
    ASYMMETRIC_LONE_PAIR_SHAPES.has(central.vsepr.geometry);

  const bondDipolesCancel = magnitude < CANCELLATION_THRESHOLD;
  const isPolar = !bondDipolesCancel || lonePairsUncompensated;
  /** Los dipolos de enlace existen y la geometria los anula. */
  const symmetric = bondDipolesCancel && polarBonds.length > 0 && !lonePairsUncompensated;
  /** El resultado depende del par libre, no de los enlaces. */
  const decidedByLonePairs = bondDipolesCancel && lonePairsUncompensated;

  const steps: { n: number; text: string; math?: string }[] = [
    {
      n: 1,
      text:
        'Primero, enlace a enlace: un enlace es polar si los dos atomos atraen los electrones con ' +
        'fuerza distinta. Eso lo mide la diferencia de electronegatividad.',
      math: bonds
        .map((b) => `${b.label}: Δχ = ${b.deltaEN.toFixed(2)} (${b.kind})`)
        .filter((_, i, all) => all.indexOf(all[i]!) === i)
        .join('   '),
    },
    {
      n: 2,
      text:
        'Despues, la molecula entera. Cada enlace polar es un VECTOR que apunta hacia el atomo mas ' +
        'electronegativo. Se colocan esos vectores en las direcciones que da la geometria y se suman.',
    },
    {
      n: 3,
      text: decidedByLonePairs
        ? 'La suma de los dipolos de ENLACE da cero. Pero el atomo central tiene pares libres cuya ' +
          'direccion no esta compensada por ningun otro, y un par libre tambien es carga negativa ' +
          'acumulada. La molecula es POLAR por el par libre, no por los enlaces. La fosfina (PH3) es ' +
          'el caso de manual: P y H tienen casi la misma electronegatividad, los enlaces son ' +
          'practicamente apolares, y aun asi el PH3 tiene momento dipolar.'
        : !bondDipolesCancel
        ? 'La suma NO es cero: queda un momento dipolar neto y la molecula es POLAR.'
        : polarBonds.length > 0
          ? 'La suma es CERO. Los enlaces son polares, pero la geometria los coloca de forma que se ' +
            'cancelan exactamente. La molecula es APOLAR pese a tener enlaces polares.'
          : 'No hay ningun enlace polar que sumar: la molecula es apolar por partida doble.',
      math: `|Σμ| = ${magnitude.toFixed(3)} (unidades de Δχ)`,
    },
  ];

  if (symmetric) {
    steps.push({
      n: 4,
      text:
        'Este es el caso que mas se falla: tener enlaces polares NO basta para que la molecula sea ' +
        'polar. Hace falta que la geometria no los cancele. Es exactamente lo que pasa con el CO2, ' +
        'el CCl4 y el BF3.',
    });
  }

  const reason = decidedByLonePairs
    ? `Los dipolos de enlace se cancelan, pero la geometria (${central?.vsepr?.geometry}) deja los ` +
      'pares libres del atomo central sin compensar. Un par libre es carga negativa sin nucleo ' +
      'que la equilibre, asi que tambien contribuye al dipolo, y aqui es el unico que queda.'
    : isPolar
    ? central && central.lonePairs > 0
      ? `Los ${central.lonePairs} par${central.lonePairs === 1 ? '' : 'es'} libre${central.lonePairs === 1 ? '' : 's'} sobre el ` +
        `${central.symbol} rompen la simetria: los dipolos de enlace ya no pueden cancelarse porque no ` +
        'apuntan en direcciones opuestas.'
      : polarBonds.length > 0
        ? 'Los dipolos de enlace no estan distribuidos de forma simetrica alrededor del centro, asi ' +
          'que no se cancelan.'
        : 'Los atomos enlazados son distintos y la densidad electronica se desplaza hacia uno de ellos.'
    : polarBonds.length > 0
      ? `La geometria (${geometry.shape}) coloca los ${polarBonds.length} dipolos de enlace de forma ` +
        'perfectamente simetrica alrededor del atomo central. Cada uno tiene otro que lo compensa, y ' +
        'la suma vectorial es exactamente cero.'
      : 'No hay diferencia de electronegatividad apreciable en ningun enlace.';

  return {
    bonds,
    netDipole: net,
    magnitude,
    isPolar,
    direction: describeDirection(structure, contributions, net),
    reason,
    symmetric,
    decidedByLonePairs,
    steps,
    caution:
      'La magnitud que aparece aqui esta en unidades de diferencia de electronegatividad, NO en ' +
      'debyes. Sirve para decidir si los dipolos se cancelan o no, que es lo que determina la ' +
      'polaridad. El momento dipolar real exige la longitud de cada enlace y la contribucion de los ' +
      'pares libres, y este motor no los calcula: prefiere no dar un numero antes que dar uno falso.',
  };
}
