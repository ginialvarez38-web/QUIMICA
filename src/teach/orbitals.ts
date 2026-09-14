/**
 * ORBITALES ATOMICOS, MUESTREADOS DE LA FUNCION DE ONDA REAL.
 *
 * POR QUE ESTE MODULO EXISTE
 * Las figuras de orbitales que se ven en casi todas partes son dibujos: dos
 * globos para un p, un trebol para un d. Estan hechas a mano, y al hacerlas a
 * mano se pierde justo lo que habria que ensenar — que la forma NO es una
 * convencion ni una decoracion, sino la consecuencia geometrica de una
 * ecuacion.
 *
 * Aqui no se dibuja ningun globo. Se escriben las funciones de onda del atomo
 * hidrogenoide —las soluciones exactas de la ecuacion de Schrodinger, las
 * unicas que tienen forma cerrada— y se sortean puntos con probabilidad
 * proporcional a |ψ|². La nube que sale ES la densidad de probabilidad. Si el
 * 2p tiene dos lobulos es porque cos θ se anula en el ecuador, y eso se ve
 * ocurrir en la figura en lugar de contarse.
 *
 * ESTO NO ES UNA SIMULACION DE UN ATOMO CUALQUIERA (§32, §59)
 * Las formulas son exactas SOLO para un electron: hidrogeno, He⁺, Li²⁺. En un
 * atomo polielectronico los electrones se apantallan entre si y las funciones
 * de onda verdaderas no tienen forma cerrada — hay que resolverlas
 * numericamente. Lo que se conserva del caso hidrogenoide es la FORMA
 * angular, que es lo que usa la quimica y lo que estas figuras ensenan; los
 * tamanos relativos son orientativos, no de un elemento concreto.
 *
 * Y UNA NUBE DE PUNTOS NO ES UN ORBITAL
 * El electron no esta en ninguno de los puntos. Cada punto es «un sitio donde
 * podria encontrarse si se midiera», y la densidad de puntos es la
 * probabilidad. Un orbital no tiene superficie: la frontera que se dibuja en
 * los libros es un contorno elegido —normalmente el que encierra el 90 % de
 * la probabilidad— y podria elegirse otro. Cada escena que use este modulo lo
 * dice en su limite.
 */

import type { Vec3 } from '../core/types.js';

/** Los orbitales con solucion hidrogenoide escrita aqui: n = 1, 2 y 3. */
export type OrbitalKey =
  | '1s'
  | '2s'
  | '3s'
  | '2px'
  | '2py'
  | '2pz'
  | '3pz'
  | '3dz2'
  | '3dxz'
  | '3dyz'
  | '3dxy'
  | '3dx2y2';

interface OrbitalSpec {
  readonly n: number;
  readonly l: number;
  /** Nombre habitual en quimica. */
  readonly label: string;
  /**
   * Nodos RADIALES: esferas donde la probabilidad es exactamente cero.
   * Son n − l − 1, y se guardan para poder comprobarlo contra el muestreo.
   */
  readonly radialNodes: number;
  /** Nodos ANGULARES: planos o conos de probabilidad nula. Son l. */
  readonly angularNodes: number;
}

export const ORBITALS: Record<OrbitalKey, OrbitalSpec> = {
  '1s': { n: 1, l: 0, label: '1s', radialNodes: 0, angularNodes: 0 },
  '2s': { n: 2, l: 0, label: '2s', radialNodes: 1, angularNodes: 0 },
  '3s': { n: 3, l: 0, label: '3s', radialNodes: 2, angularNodes: 0 },
  '2px': { n: 2, l: 1, label: '2pₓ', radialNodes: 0, angularNodes: 1 },
  '2py': { n: 2, l: 1, label: '2p_y', radialNodes: 0, angularNodes: 1 },
  '2pz': { n: 2, l: 1, label: '2p_z', radialNodes: 0, angularNodes: 1 },
  '3pz': { n: 3, l: 1, label: '3p_z', radialNodes: 1, angularNodes: 1 },
  '3dz2': { n: 3, l: 2, label: '3d_z²', radialNodes: 0, angularNodes: 2 },
  '3dxz': { n: 3, l: 2, label: '3d_xz', radialNodes: 0, angularNodes: 2 },
  '3dyz': { n: 3, l: 2, label: '3d_yz', radialNodes: 0, angularNodes: 2 },
  '3dxy': { n: 3, l: 2, label: '3d_xy', radialNodes: 0, angularNodes: 2 },
  '3dx2y2': { n: 3, l: 2, label: '3d_x²−y²', radialNodes: 0, angularNodes: 2 },
};

// ---------------------------------------------------------------------------
// La parte radial
// ---------------------------------------------------------------------------

const SQRT = Math.sqrt;

/**
 * R_{n,l}(r) para Z = 1, con r en radios de Bohr (a₀ = 52,9 pm).
 *
 * Son las expresiones exactas, con sus constantes de normalizacion. No hacen
 * falta para el muestreo —que solo mira proporciones— pero se escriben
 * completas porque la funcion tambien se usa para localizar los nodos, y ahi
 * el cero tiene que caer donde le toca.
 *
 * El polinomio entre parentesis es el de Laguerre asociado, y sus raices son
 * exactamente los nodos radiales: el 2s se anula en r = 2 a₀ porque ahi
 * (2 − r) = 0. Ese cero no se ha puesto a mano en ningun sitio.
 */
export function radial(n: number, l: number, r: number): number {
  if (n === 1 && l === 0) return 2 * Math.exp(-r);
  if (n === 2 && l === 0) return (1 / (2 * SQRT(2))) * (2 - r) * Math.exp(-r / 2);
  if (n === 2 && l === 1) return (1 / (2 * SQRT(6))) * r * Math.exp(-r / 2);
  if (n === 3 && l === 0) {
    return (2 / (81 * SQRT(3))) * (27 - 18 * r + 2 * r * r) * Math.exp(-r / 3);
  }
  if (n === 3 && l === 1) return (4 / (81 * SQRT(6))) * (6 * r - r * r) * Math.exp(-r / 3);
  if (n === 3 && l === 2) return (4 / (81 * SQRT(30))) * r * r * Math.exp(-r / 3);
  throw new Error(`No hay expresion radial escrita para n=${n}, l=${l}`);
}

// ---------------------------------------------------------------------------
// La parte angular
// ---------------------------------------------------------------------------

/**
 * Armonicos esfericos REALES, que son los que usa la quimica.
 *
 * Las soluciones naturales de la ecuacion son complejas, y para l = 1 valen
 * e^{imφ}. La quimica trabaja con sus combinaciones reales —pₓ, p_y, p_z— que
 * son igual de validas (cualquier combinacion lineal de soluciones con la
 * misma energia lo es) y que ademas apuntan a sitios, que es lo que hace falta
 * para hablar de enlaces.
 *
 * Aqui esta el origen de TODO lo que se ve en las figuras:
 *
 *   l = 0  el factor es una constante  →  no depende de la direccion  →  esfera
 *   l = 1  el factor es ẑ (o x̂, o ŷ)  →  se anula en un plano entero  →  dos lobulos
 *   l = 2  el factor es un producto o una diferencia de cuadrados
 *          →  se anula en dos superficies  →  cuatro lobulos (o el caso raro del d_z²)
 *
 * El signo importa y no se tira: dos lobulos de un p tienen SIGNO OPUESTO, y
 * esa es la razon de que dos orbitales puedan sumarse o cancelarse al formar
 * un enlace. Las escenas pintan cada signo de un color.
 */
export function angular(key: OrbitalKey, ux: number, uy: number, uz: number): number {
  const c1 = SQRT(3 / (4 * Math.PI));
  const c2xz = SQRT(15 / (4 * Math.PI));
  const c2z2 = SQRT(5 / (16 * Math.PI));
  const c2x2y2 = SQRT(15 / (16 * Math.PI));

  switch (key) {
    case '1s':
    case '2s':
    case '3s':
      return 1 / (2 * SQRT(Math.PI));
    case '2px':
      return c1 * ux;
    case '2py':
      return c1 * uy;
    case '2pz':
    case '3pz':
      return c1 * uz;
    case '3dz2':
      return c2z2 * (3 * uz * uz - 1);
    case '3dxz':
      return c2xz * ux * uz;
    case '3dyz':
      return c2xz * uy * uz;
    case '3dxy':
      return c2xz * ux * uy;
    case '3dx2y2':
      return c2x2y2 * (ux * ux - uy * uy);
  }
}

/** ψ(x, y, z) en unidades de a₀. El signo se conserva. */
export function psi(key: OrbitalKey, x: number, y: number, z: number): number {
  const spec = ORBITALS[key];
  const r = Math.hypot(x, y, z);
  if (r === 0) {
    // En el origen solo el s tiene densidad; los demas se anulan por el factor
    // angular, que va multiplicado por componentes de un vector unitario.
    return spec.l === 0 ? radial(spec.n, 0, 0) * angular(key, 0, 0, 1) : 0;
  }
  return radial(spec.n, spec.l, r) * angular(key, x / r, y / r, z / r);
}

// ---------------------------------------------------------------------------
// El muestreo
// ---------------------------------------------------------------------------

/**
 * Hasta donde hay que mirar para no recortar la nube.
 *
 * La funcion decae como e^{−r/n}, asi que el radio util crece con n. Los
 * valores son generosos a proposito: recortar la cola de un 3s le quitaria el
 * segundo nodo, que es justo lo que esa figura ensena.
 */
const BOX: Record<number, number> = { 1: 4.5, 2: 13, 3: 26 };

export interface OrbitalPoint {
  readonly position: Vec3;
  /** Signo de ψ en ese punto: las dos fases del orbital. */
  readonly phase: 1 | -1;
}

/**
 * Direccion desde la que mira la camara al abrirse una figura.
 *
 * Sale de los angulos con los que arranca el renderizador —yaw 0,6 y
 * pitch 0,35— y su unico uso es orientar el corte de `hemisphere` para que la
 * cara cortada quede de frente. Si algun dia cambiara el encuadre inicial del
 * visor, esta constante habria que cambiarla con el: el precio de un corte que
 * mira al observador es que sabe donde esta el observador.
 */
const EYE = {
  x: Math.cos(0.35) * Math.sin(0.6),
  y: Math.sin(0.35),
  z: Math.cos(0.35) * Math.cos(0.6),
};

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * LA TABLA DE LA DISTRIBUCION RADIAL, UNA POR (n, l).
 *
 * La probabilidad de que el electron este entre r y r+dr es |R_{n,l}(r)|² r² dr
 * — con el r², que es lo que casi todo el mundo olvida y lo que hace que el
 * maximo del 1s NO este en el nucleo sino en r = a₀. Se tabula su integral
 * acumulada para poder sortear un radio invirtiendola.
 */
const RADIAL_CDF = new Map<string, { r: Float64Array; cdf: Float64Array }>();

function radialTable(n: number, l: number): { r: Float64Array; cdf: Float64Array } {
  const key = `${n}${l}`;
  const cached = RADIAL_CDF.get(key);
  if (cached) return cached;

  const steps = 3000;
  const rmax = BOX[n]! * 1.6;
  const r = new Float64Array(steps + 1);
  const cdf = new Float64Array(steps + 1);
  let acc = 0;
  let previous = 0;
  for (let i = 0; i <= steps; i++) {
    const value = (i * rmax) / steps;
    const density = radial(n, l, value) ** 2 * value * value;
    if (i > 0) acc += ((previous + density) / 2) * (rmax / steps);
    previous = density;
    r[i] = value;
    cdf[i] = acc;
  }
  for (let i = 0; i <= steps; i++) cdf[i]! /= acc;

  const table = { r, cdf };
  RADIAL_CDF.set(key, table);
  return table;
}

/** Maximo de |Y|² para el factor angular de cada orbital. Se busca una vez. */
const ANGULAR_MAX = new Map<OrbitalKey, number>();

function angularMax(key: OrbitalKey): number {
  const cached = ANGULAR_MAX.get(key);
  if (cached !== undefined) return cached;

  let max = 0;
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const theta = (Math.PI * i) / steps;
    for (let j = 0; j < 2 * steps; j++) {
      const phi = (Math.PI * j) / steps;
      const value = angular(
        key,
        Math.sin(theta) * Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
        Math.cos(theta),
      ) ** 2;
      if (value > max) max = value;
    }
  }
  max *= 1.02;
  ANGULAR_MAX.set(key, max);
  return max;
}

/**
 * Sortea `count` puntos con probabilidad proporcional a |ψ|².
 *
 * SE APROVECHA QUE LA FUNCION DE ONDA FACTORIZA
 * ψ(r, θ, φ) = R(r) · Y(θ, φ), y por tanto
 *
 *     |ψ|² dV  =  |R(r)|² r² dr  ×  |Y(θ, φ)|² dΩ
 *
 * es decir, el radio y la direccion son INDEPENDIENTES. Eso no es un atajo de
 * programacion: es una propiedad de la solucion, y es exactamente la razon de
 * que se pueda hablar del «tamano» (que es cosa de n y l) y de la «forma» (que
 * es cosa de l y m_l) como de dos cosas separadas. Los apartados 2.11.1.1 y
 * siguientes se apoyan enteros en esa separacion.
 *
 * Asi que se sortea cada factor por su lado:
 *
 *   - El RADIO, invirtiendo la distribucion acumulada tabulada. Exacto y de
 *     coste constante.
 *   - La DIRECCION, uniforme sobre la esfera y despues aceptada con
 *     probabilidad |Y|²/max. Como Y solo depende de la direccion, aqui la
 *     aceptacion es alta (1/3 para un p) en vez de la milesima que salia al
 *     tirar puntos dentro de un cubo del tamano de un 3d.
 *
 * La primera version lo hacia todo por rechazo en 3D. Daba la misma nube
 * —comprobado contra ⟨r⟩ = (3n²−l(l+1))/2— pero tardaba casi un segundo en
 * construir las figuras del apartado, con la pestana congelada mientras tanto.
 *
 * La semilla es fija: dos personas mirando la misma figura tienen que ver la
 * misma nube para poder hablar de ella.
 */
export interface SampleOptions {
  /**
   * Recorta la nube a este radio, en a₀.
   *
   * Existe porque una nube sin recortar tiene una cola larguisima y tenue: el
   * 3d llega a 26 a₀ pero el 90 % de la probabilidad cabe en 15,8. Dibujada
   * entera, la camara tiene que alejarse para encuadrar unos pocos puntos
   * perdidos y la forma —que es lo que la figura viene a ensenar— se queda del
   * tamano de una mosca.
   *
   * Recortar al radio del 90 % no es maquillaje: es EXACTAMENTE la convencion
   * con la que estan dibujados los orbitales de todos los libros, y el radio
   * se calcula con `radiusContaining`, no se elige a ojo. Las escenas que lo
   * usan lo dicen en su limite.
   */
  readonly maxRadius?: number;
  /**
   * Dibuja solo una LAMINA de este grosor (en a₀) que pasa por el centro.
   *
   * Una nube de puntos es opaca, y los nodos radiales del 2s y el 3s son
   * huecos INTERIORES: desde fuera no se ven.
   *
   * Partirla por la mitad —lo primero que se probo— no basta. Aunque se quite
   * la mitad que estorba, lo que queda sigue siendo media bola de veinte
   * radios de Bohr de fondo, y al proyectarla sobre la pantalla los puntos de
   * delante y los de detras rellenan los huecos. Se intuian; no se veian.
   *
   * Una lamina delgada si: reduce la profundidad a casi nada y deja un disco
   * con los anillos y los huecos separados y limpios. Es exactamente la
   * seccion con la que estan dibujados los orbitales de los libros.
   *
   * La lamina va perpendicular a la direccion desde la que mira la camara al
   * abrirse la figura, para que se vea de frente y no de canto.
   */
  readonly slice?: number;
}

export function sampleOrbital(
  key: OrbitalKey,
  count: number,
  seed = 20240501,
  options: SampleOptions = {},
): OrbitalPoint[] {
  const spec = ORBITALS[key];
  const rng = seeded(seed);
  const { r: radii, cdf } = radialTable(spec.n, spec.l);
  const maxY = angularMax(key);
  const maxRadius = options.maxRadius ?? Infinity;

  const out: OrbitalPoint[] = [];
  // Un tope de intentos para que un error de formula no cuelgue la pagina:
  // vale mas una nube pobre que una pestana congelada.
  const limit = count * 200;

  for (let tries = 0; tries < limit && out.length < count; tries++) {
    // --- radio: busqueda binaria sobre la acumulada ---
    const u = rng();
    let lo = 0;
    let hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid]! < u) lo = mid + 1;
      else hi = mid;
    }
    const r = radii[lo]!;
    if (r > maxRadius) continue;

    // --- direccion: uniforme sobre la esfera, pesada por |Y|² ---
    const cosTheta = 2 * rng() - 1;
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    const phi = 2 * Math.PI * rng();
    const ux = sinTheta * Math.cos(phi);
    const uy = sinTheta * Math.sin(phi);
    const uz = cosTheta;

    if (options.slice !== undefined) {
      const depth = r * (ux * EYE.x + uy * EYE.y + uz * EYE.z);
      if (Math.abs(depth) > options.slice) continue;
    }

    const y = angular(key, ux, uy, uz);
    if (rng() * maxY >= y * y) continue;

    // El signo de ψ es el del producto: el radial tambien cambia de signo al
    // cruzar un nodo, y por eso el 2s tiene dos fases pese a ser esferico.
    const sign = radial(spec.n, spec.l, r) * y;
    out.push({
      position: { x: r * ux, y: r * uy, z: r * uz },
      phase: sign >= 0 ? 1 : -1,
    });
  }
  return out;
}

/**
 * Radio que encierra una fraccion dada de la probabilidad.
 *
 * Sirve para poner numero a lo que se dibuja: cuando una figura ensena una
 * frontera, esa frontera tiene que ser UNA de verdad y no un contorno elegido
 * a ojo. Se integra |R|²r² por el metodo del trapecio.
 */
export function radiusContaining(n: number, l: number, fraction: number): number {
  const rmax = BOX[n]! * 1.5;
  const steps = 4000;
  const h = rmax / steps;
  const f = (r: number) => radial(n, l, r) ** 2 * r * r;

  let total = 0;
  for (let i = 0; i < steps; i++) total += ((f(i * h) + f((i + 1) * h)) / 2) * h;

  let acc = 0;
  for (let i = 0; i < steps; i++) {
    acc += ((f(i * h) + f((i + 1) * h)) / 2) * h;
    if (acc >= fraction * total) return (i + 1) * h;
  }
  return rmax;
}
