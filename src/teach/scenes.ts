/**
 * ESCENAS DIDACTICAS EN 3D.
 *
 * CUANDO MERECE LA PENA UNA FIGURA
 * Solo cuando lo que se explica es ESPACIAL y el texto no puede con ello. Una
 * mezcla homogenea y una heterogenea se distinguen por como estan repartidas
 * las particulas — eso es geometria, y verlo es entenderlo. El numero de
 * Avogadro, en cambio, no gana nada dibujado: es un numero.
 *
 * Las cuatro figuras de este modulo cumplen ese criterio:
 *
 *   escala      el atomo es sobre todo vacio, y la unica forma de que eso se
 *               sienta es poder alejarse del nucleo hasta perderlo de vista.
 *   modelos     cada modelo atomico ES una propuesta espacial. Dibujarlos uno
 *               al lado del otro convierte la lista en una comparacion.
 *   materia     puro / homogeneo / heterogeneo se define por el reparto de
 *               las particulas. Es la definicion misma, dibujada.
 *   cambio      fisico frente a quimico: en uno las moleculas se separan, en
 *               el otro se rompen. Verlo antes y despues zanja la confusion.
 *
 * COMO SE CONSTRUYEN
 * Como `Structure`, que es lo que el renderizador ya sabe dibujar. Se anaden
 * radio y color por esfera porque un nucleo o una particula generica no son
 * atomos de ningun elemento y no tienen radio covalente ni color CPK.
 *
 * LO QUE ESTAS FIGURAS NO SON (§59)
 * Dibujos, no fotografias. Un electron no es una bolita y un orbital no tiene
 * superficie. Cada escena declara su propio limite, y la interfaz lo muestra
 * pegado a la figura — igual que las analogias del temario llevan el suyo.
 */

import type { Structure, StructureAtom, Bond, Vec3 } from '../core/types.js';
import type { OrbitalKey } from './orbitals.js';
import type { SampleOptions } from './orbitals.js';
import { sampleOrbital, radiusContaining, ORBITALS } from './orbitals.js';
import { configureAtom } from '../analysis/electronic.js';
import { buildStructure } from '../geometry/vsepr.js';
import { parseFormula } from '../core/formula/parse.js';

export interface Scene {
  readonly id: string;
  readonly title: string;
  /** Que hay que mirar. */
  readonly caption: string;
  /** Donde el dibujo deja de ser fiel. Obligatorio, como en las analogias. */
  readonly limit: string;
  readonly structure: Structure;
}

export interface SceneSet {
  readonly id: string;
  readonly title: string;
  readonly intro: string;
  readonly scenes: readonly Scene[];
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

let counter = 0;
function sphere(
  position: Vec3,
  radius: number,
  color: string,
  symbol = 'X',
  label?: string,
): StructureAtom {
  return { id: `s${counter++}`, symbol: label ?? symbol, position, radius, color };
}

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/**
 * Generador pseudoaleatorio con semilla.
 *
 * Las escenas de mezclas necesitan posiciones «al azar», pero tienen que salir
 * IGUALES en cada visita: si cambiaran a cada repintado, dos personas mirando
 * la misma figura verian cosas distintas y no se podria hablar de ella.
 */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const molecular = (atoms: StructureAtom[], bonds: Bond[] = []): Structure => ({
  motif: 'molecular',
  atoms,
  bonds,
});

// Paleta: se usan los colores que ya emplea la aplicacion para que las
// figuras no introduzcan un idioma visual nuevo.
const NUCLEUS = '#ff7a59';
const ELECTRON = '#4da3ff';
const POSITIVE = '#f5b342';
const NEUTRAL = '#8b96a8';
const SUBSTANCE_A = '#4da3ff';
const SUBSTANCE_B = '#35d6c3';
const PRODUCT = '#a78bfa';

// ---------------------------------------------------------------------------
// 1. LA ESCALA DEL ATOMO
// ---------------------------------------------------------------------------

/**
 * Tres escenas que son la misma cosa vista desde mas y mas lejos.
 *
 * El salto de la primera a la tercera es de cinco ordenes de magnitud, y esa
 * es toda la leccion: el nucleo esta ahi, pero para verlo junto a la corteza
 * hay que dibujarlo mucho mas grande de lo que es.
 */
function scaleSet(): SceneSet {
  const rng = seeded(7);

  // Nube de electrones: puntos repartidos en una corteza esferica.
  const cloud = (count: number, inner: number, outer: number, dot: number): StructureAtom[] =>
    Array.from({ length: count }, () => {
      const r = inner + (outer - inner) * Math.cbrt(rng());
      const theta = Math.acos(2 * rng() - 1);
      const phi = 2 * Math.PI * rng();
      return sphere(
        v(r * Math.sin(theta) * Math.cos(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta)),
        dot,
        ELECTRON,
        'e',
      );
    });

  return {
    id: 'escala',
    title: 'El tamano real del nucleo',
    intro:
      'Las tres vistas son el mismo atomo, cada una mas alejada. Fijate en lo que le pasa al nucleo.',
    scenes: [
      {
        id: 'nucleo',
        title: '1 · El nucleo',
        caption:
          'Protones (naranja) y neutrones (gris) apretados. Aqui esta el 99,97 % de la masa del atomo.',
        limit:
          'Los nucleones no son bolitas ordenadas: estan en movimiento constante y no tienen superficie ' +
          'definida. La imagen sirve para contar particulas, no para ver su forma.',
        structure: molecular(
          [
            ...Array.from({ length: 7 }, (_, i) => {
              const a = (i / 7) * Math.PI * 2;
              return sphere(v(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0), 0.42, NUCLEUS, 'p');
            }),
            ...Array.from({ length: 7 }, (_, i) => {
              const a = ((i + 0.5) / 7) * Math.PI * 2;
              return sphere(v(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.5), 0.42, NEUTRAL, 'n');
            }),
          ],
          [],
        ),
      },
      {
        id: 'atomo',
        title: '2 · El atomo entero',
        caption:
          'El mismo nucleo, ahora con la nube de electrones alrededor. El nucleo ya casi no se ve — y AUN esta dibujado unas mil veces mas grande de lo que le tocaria.',
        limit:
          'Si el nucleo estuviera a escala real, con la nube de este tamano, seria invisible: mediria ' +
          'menos de una decima de pixel. Se exagera a proposito para que quede algo que senalar.',
        structure: molecular([
          sphere(v(0, 0, 0), 0.55, NUCLEUS, 'nucleo'),
          ...cloud(220, 5, 13, 0.16),
        ]),
      },
      {
        id: 'vacio',
        title: '3 · Lo que hay en medio',
        caption:
          'Entre el nucleo y los electrones no hay NADA: ni aire, ni materia, ni una sustancia que los una. Solo vacio.',
        limit:
          'Lo que si hay es un CAMPO electrico, que no se puede dibujar como objeto. «Vacio» significa ' +
          'sin particulas, no sin fisica.',
        structure: molecular([
          sphere(v(0, 0, 0), 0.18, NUCLEUS, 'nucleo'),
          ...cloud(160, 11, 14, 0.1),
        ]),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 2. LOS MODELOS ATOMICOS
// ---------------------------------------------------------------------------

/**
 * Cada modelo, dibujado como lo que es: una propuesta sobre DONDE esta cada
 * cosa. Puestos uno tras otro, la lista se convierte en una comparacion.
 */
function modelSet(): SceneSet {
  const rng = seeded(19);

  const ring = (count: number, radius: number, tilt: number, color: string, r = 0.22): StructureAtom[] =>
    Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
      return sphere(
        v(Math.cos(a) * radius, Math.sin(a) * radius * Math.cos(tilt), Math.sin(a) * radius * Math.sin(tilt)),
        r,
        color,
        'e',
      );
    });

  // Aro de referencia: esferas diminutas que dibujan la orbita de Bohr.
  const orbit = (radius: number, tilt: number): StructureAtom[] =>
    Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      return sphere(
        v(Math.cos(a) * radius, Math.sin(a) * radius * Math.cos(tilt), Math.sin(a) * radius * Math.sin(tilt)),
        0.045,
        '#5a6478',
        '',
      );
    });

  return {
    id: 'modelos',
    title: 'Los modelos, dibujados',
    intro:
      'Cada modelo es una propuesta sobre DONDE esta cada cosa. Vistos seguidos, se entiende que cada ' +
      'uno movio algo de sitio para explicar un experimento que el anterior no podia.',
    scenes: [
      {
        id: 'dalton',
        title: 'Dalton, 1803',
        caption: 'Una esfera maciza e indivisible. No hay partes: el atomo es el ladrillo ultimo.',
        limit:
          'El modelo no dice de que esta hecha la esfera ni por que unos elementos se combinan con ' +
          'otros. No es que el dibujo simplifique: es que el modelo no lo contempla.',
        /*
         * Se acompana de tres esferas mas, separadas.
         *
         * Con una sola, la camara la encuadra llenando el lienzo y deja de
         * leerse como una esfera: parece un fondo. Varias dan escala y ademas
         * dicen algo cierto del modelo — que los atomos de un mismo elemento
         * son todos identicos.
         */
        structure: molecular([
          sphere(v(0, 0, 0), 1.5, '#8b96a8', 'atomo'),
          sphere(v(3.6, 1.1, -0.6), 1.5, '#8b96a8', 'atomo'),
          sphere(v(-3.4, -1.3, 0.8), 1.5, '#8b96a8', 'atomo'),
          sphere(v(0.7, -3.6, 1.4), 1.5, '#8b96a8', 'atomo'),
        ]),
      },
      {
        id: 'thomson',
        title: 'Thomson, 1904',
        caption:
          'Electrones incrustados en una masa positiva difusa, como pasas en un bizcocho. El conjunto es neutro.',
        limit:
          'La masa positiva se dibuja como una esfera con superficie, pero Thomson la proponia DIFUSA, ' +
          'sin borde. Ese detalle es justo el que hace que ninguna particula alfa pueda rebotar.',
        structure: molecular([
          sphere(v(0, 0, 0), 3.2, POSITIVE, '+'),
          ...Array.from({ length: 8 }, () => {
            const r = 2.6 * Math.cbrt(rng());
            const theta = Math.acos(2 * rng() - 1);
            const phi = 2 * Math.PI * rng();
            return sphere(
              v(r * Math.sin(theta) * Math.cos(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta)),
              0.34,
              ELECTRON,
              'e',
            );
          }),
        ]),
      },
      {
        id: 'rutherford',
        title: 'Rutherford, 1911',
        caption:
          'Toda la carga positiva concentrada en un nucleo diminuto, y los electrones fuera. Entre medias, vacio — y por eso casi todas las particulas alfa atravesaban la lamina.',
        limit:
          'El modelo no dice DONDE estan los electrones ni que los sostiene. Dibujarlos repartidos es ' +
          'una licencia: Rutherford no lo especificaba, y ahi estaba su problema.',
        structure: molecular([
          sphere(v(0, 0, 0), 0.4, NUCLEUS, 'nucleo'),
          ...Array.from({ length: 6 }, () => {
            const r = 2.4 + rng() * 1.2;
            const theta = Math.acos(2 * rng() - 1);
            const phi = 2 * Math.PI * rng();
            return sphere(
              v(r * Math.sin(theta) * Math.cos(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta)),
              0.28,
              ELECTRON,
              'e',
            );
          }),
        ]),
      },
      {
        id: 'bohr',
        title: 'Bohr, 1913',
        caption:
          'Los electrones solo pueden estar en ciertas orbitas, cada una con su energia. Saltar de una a otra emite o absorbe un foton — y eso explica los espectros de rayas.',
        limit:
          'ESTE ES EL DIBUJO MAS ENGANOSO DE LA QUIMICA. Los electrones NO recorren orbitas como ' +
          'planetas: no tienen trayectoria. La imagen es util para hablar de NIVELES de energia, y ' +
          'solo para eso.',
        structure: molecular([
          sphere(v(0, 0, 0), 0.45, NUCLEUS, 'nucleo'),
          ...orbit(1.8, 0),
          ...orbit(3.1, 0.35),
          ...ring(2, 1.8, 0, ELECTRON, 0.26),
          ...ring(4, 3.1, 0.35, ELECTRON, 0.26),
        ]),
      },
      {
        id: 'cuantico',
        title: 'Cuantico, 1926',
        caption:
          'No hay orbitas ni trayectorias. Cada punto de la nube es un sitio donde el electron PODRIA estar; donde la nube es mas densa, la probabilidad es mayor.',
        limit:
          'Los puntos no son electrones: un atomo de hidrogeno tiene UNO. La nube representa ' +
          'probabilidad, no una multitud de particulas. Y no tiene borde: se ha cortado donde la ' +
          'probabilidad se vuelve despreciable.',
        structure: molecular([
          sphere(v(0, 0, 0), 0.3, NUCLEUS, 'nucleo'),
          ...Array.from({ length: 300 }, () => {
            // Densidad decreciente con el radio, como en un orbital 1s.
            const r = -1.4 * Math.log(1 - rng() * 0.93);
            const theta = Math.acos(2 * rng() - 1);
            const phi = 2 * Math.PI * rng();
            return sphere(
              v(r * Math.sin(theta) * Math.cos(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta)),
              0.11,
              ELECTRON,
              '',
            );
          }),
        ]),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 3. SUSTANCIA PURA Y MEZCLAS
// ---------------------------------------------------------------------------

/**
 * La definicion de puro, homogeneo y heterogeneo ES el reparto de las
 * particulas. Aqui no se ilustra la definicion: se dibuja.
 */
function matterSet(): SceneSet {
  const rng = seeded(31);
  const grid = (
    picker: (x: number, y: number, z: number) => { color: string; symbol: string } | null,
  ): StructureAtom[] => {
    const out: StructureAtom[] = [];
    for (let x = -2; x <= 2; x++) {
      for (let y = -2; y <= 2; y++) {
        for (let z = -2; z <= 2; z++) {
          const pick = picker(x, y, z);
          if (!pick) continue;
          const jitter = 0.22;
          out.push(
            sphere(
              v(
                x * 1.5 + (rng() - 0.5) * jitter,
                y * 1.5 + (rng() - 0.5) * jitter,
                z * 1.5 + (rng() - 0.5) * jitter,
              ),
              0.42,
              pick.color,
              pick.symbol,
            ),
          );
        }
      }
    }
    return out;
  };

  return {
    id: 'materia',
    title: 'Puro, homogeneo, heterogeneo',
    intro:
      'Las tres vistas tienen las mismas particulas. Lo unico que cambia es COMO estan repartidas, y ' +
      'eso es exactamente lo que distingue una sustancia pura de una mezcla.',
    scenes: [
      {
        id: 'pura',
        title: 'Sustancia pura',
        caption:
          'Un solo tipo de particula. Por eso funde y hierve a una temperatura fija: todas las ' +
          'interacciones son iguales y se rompen a la vez.',
        limit:
          'Las particulas se dibujan quietas y ordenadas. En un liquido o un gas se mueven sin parar; ' +
          'la retícula es solo para poder compararlas con las otras dos vistas.',
        structure: molecular(grid(() => ({ color: SUBSTANCE_A, symbol: 'A' }))),
      },
      {
        id: 'homogenea',
        title: 'Mezcla homogenea',
        caption:
          'Dos tipos de particula MEZCLADOS a escala molecular. Mires donde mires, la proporcion es la ' +
          'misma: no hay fronteras, y por eso se ve una sola fase.',
        limit:
          'A esta escala se ven las dos clases de particula. En la realidad, mirando con un microscopio ' +
          'optico, no se distinguiria nada: por eso se llama homogenea.',
        structure: molecular(
          grid(() => (rng() < 0.7 ? { color: SUBSTANCE_A, symbol: 'A' } : { color: SUBSTANCE_B, symbol: 'B' })),
        ),
      },
      {
        id: 'heterogenea',
        title: 'Mezcla heterogenea',
        caption:
          'Las mismas particulas, pero AGRUPADAS. Hay una frontera visible entre las dos zonas: eso es ' +
          'una interfase, y es lo que hace que se distingan dos fases a simple vista.',
        limit:
          'La separacion se dibuja limpia; en una mezcla real la frontera es irregular y las dos zonas ' +
          'se interpenetran. Lo que importa aqui es que EXISTE frontera, no su forma.',
        structure: molecular(
          grid((x, y) => ({
            color: y + x * 0.35 > 0 ? SUBSTANCE_A : SUBSTANCE_B,
            symbol: y + x * 0.35 > 0 ? 'A' : 'B',
          })),
        ),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 4. CAMBIO FISICO Y CAMBIO QUIMICO
// ---------------------------------------------------------------------------

/**
 * La distincion que mas se falla, resuelta mirando las moleculas antes y
 * despues: en el cambio fisico siguen enteras y solo se separan; en el
 * quimico se rompen los enlaces y aparecen moleculas nuevas.
 */
function changeSet(): SceneSet {
  /*
   * Los enlaces se refieren a los atomos por INDICE dentro del array de la
   * escena, no por identificador. De ahi que cada ayudante lea la longitud
   * actual del array antes de anadir nada: ese es el indice que le tocara al
   * primer atomo nuevo.
   */
  const bond = (a: number, b: number): Bond => ({ a, b, order: 1, kind: 'covalent-polar' });

  // Agua: dos H y un O, con la geometria angular de verdad.
  const water = (cx: number, cy: number, cz: number, out: StructureAtom[], bonds: Bond[]): void => {
    const o = out.length;
    out.push(sphere(v(cx, cy, cz), 0.5, '#ff4d4d', 'O'));
    out.push(sphere(v(cx - 0.72, cy + 0.58, cz), 0.3, '#e8edf5', 'H'));
    out.push(sphere(v(cx + 0.72, cy + 0.58, cz), 0.3, '#e8edf5', 'H'));
    bonds.push(bond(o, o + 1), bond(o, o + 2));
  };

  const iceAtoms: StructureAtom[] = [];
  const iceBonds: Bond[] = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) water(x * 2.6, y * 2.6, z * 2.6, iceAtoms, iceBonds);
    }
  }

  const vaporAtoms: StructureAtom[] = [];
  const vaporBonds: Bond[] = [];
  const rng = seeded(53);
  for (let i = 0; i < 12; i++) {
    water((rng() - 0.5) * 13, (rng() - 0.5) * 13, (rng() - 0.5) * 13, vaporAtoms, vaporBonds);
  }

  // Antes de la reaccion: H2 y O2 sueltos.
  const beforeAtoms: StructureAtom[] = [];
  const beforeBonds: Bond[] = [];
  for (let i = 0; i < 4; i++) {
    const y = 2.2 - i * 1.5;
    const h = beforeAtoms.length;
    beforeAtoms.push(sphere(v(-3.4, y, 0), 0.3, '#e8edf5', 'H'));
    beforeAtoms.push(sphere(v(-2.6, y, 0), 0.3, '#e8edf5', 'H'));
    beforeBonds.push(bond(h, h + 1));
  }
  for (let i = 0; i < 2; i++) {
    const y = 1.5 - i * 3;
    const o = beforeAtoms.length;
    beforeAtoms.push(sphere(v(2.6, y, 0), 0.5, '#ff4d4d', 'O'));
    beforeAtoms.push(sphere(v(3.8, y, 0), 0.5, '#ff4d4d', 'O'));
    beforeBonds.push(bond(o, o + 1));
  }

  const afterAtoms: StructureAtom[] = [];
  const afterBonds: Bond[] = [];
  for (let i = 0; i < 4; i++) {
    water(-2.4 + (i % 2) * 4.8, 1.6 - Math.floor(i / 2) * 3.2, 0, afterAtoms, afterBonds);
  }

  return {
    id: 'cambio',
    title: 'Cambio fisico y cambio quimico',
    intro:
      'La pregunta que lo decide es una: ¿siguen enteras las moleculas? Compara el antes y el despues ' +
      'de cada pareja.',
    scenes: [
      {
        id: 'hielo',
        title: 'Fisico · antes (hielo)',
        caption:
          'Moleculas de agua ordenadas en una red. Cada una tiene sus dos enlaces O–H intactos.',
        limit: 'La red real del hielo es hexagonal; aqui se dibuja cubica por claridad.',
        structure: molecular(iceAtoms, iceBonds),
      },
      {
        id: 'vapor',
        title: 'Fisico · despues (vapor)',
        caption:
          'Las mismas moleculas, separadas y desordenadas. Cuenta los enlaces: NINGUNO se ha roto. ' +
          'Hervir agua no la descompone — el vapor sigue siendo H₂O.',
        limit:
          'Las moleculas de un gas se mueven a cientos de metros por segundo. Esta es una instantanea, ' +
          'no un estado quieto.',
        structure: molecular(vaporAtoms, vaporBonds),
      },
      {
        id: 'antes',
        title: 'Quimico · antes (H₂ + O₂)',
        caption: 'Cuatro moleculas de hidrogeno y dos de oxigeno. Ocho atomos de H y cuatro de O.',
        limit: 'Se dibujan ordenadas y separadas por bandos para poder contarlas; en realidad estan mezcladas.',
        structure: molecular(beforeAtoms, beforeBonds),
      },
      {
        id: 'despues',
        title: 'Quimico · despues (H₂O)',
        caption:
          'Los enlaces H–H y O–O se han ROTO y se han formado enlaces O–H. Sustancias nuevas. Y los ' +
          'atomos son los mismos ocho H y cuatro O: eso es la conservacion de la materia.',
        limit:
          'La reaccion no ocurre de golpe ni de esta forma ordenada: pasa por radicales intermedios. ' +
          'La imagen compara el principio y el final, no el camino.',
        structure: molecular(afterAtoms, afterBonds),
      },
    ],
  };
}

// ---------------------------------------------------------------------------

/*
 * CADA CONJUNTO SE CONSTRUYE LA PRIMERA VEZ QUE SE PIDE, NO ANTES.
 *
 * Antes se construian los siete de golpe al pedir el primero. Con las cuatro
 * figuras compuestas daba igual —son unas docenas de esferas colocadas a
 * mano— pero las de orbitales sortean once mil puntos por rechazo contra la
 * funcion de onda, y eso cuesta cerca de un segundo de hilo principal.
 *
 * El resultado era que abrir la pestana MATERIA, que no tiene ni un orbital,
 * congelaba la pagina casi un segundo calculando nubes que nadie iba a mirar.
 * Es el mismo error que el modulo ya evitaba con los contextos WebGL, cometido
 * un nivel mas abajo.
 *
 * Con el mapa de constructores, pedir «materia» cuesta lo que cuesta materia.
 * Y como el resultado se guarda, volver a una figura ya vista es gratis.
 */
const BUILDERS: Record<string, () => SceneSet> = {
  escala: scaleSet,
  modelos: modelSet,
  materia: matterSet,
  cambio: changeSet,
  orbitales: orbitalSet,
  llenado: fillingSet,
  magnetismo: magnetismSet,
  octeto: octetSet,
  uniones: bondTypesSet,
  ionico: ionicSet,
  covalente: covalentSet,
  lewis3d: lewis3dSet,
  polaridad: polaritySet,
  metalico: metallicSet,
  intermoleculares: imfSet,
  puentes: hydrogenBondSet,
  dispersion: dispersionSet,
};

const SETS = new Map<string, SceneSet>();

/** El conjunto pedido, construido la primera vez y guardado despues. */
export function sceneSet(id: string): SceneSet | null {
  const cached = SETS.get(id);
  if (cached) return cached;

  const build = BUILDERS[id];
  if (!build) return null;

  const set = build();
  SETS.set(id, set);
  return set;
}

/** Los identificadores, sin construir nada. Para indices y pruebas baratas. */
export function sceneSetIds(): readonly string[] {
  return Object.keys(BUILDERS);
}

/**
 * Todos los conjuntos, construidos. Cuesta, asi que se usa en las pruebas y
 * no en la interfaz: alli cada figura pide el suyo cuando entra en pantalla.
 */
export function allSceneSets(): readonly SceneSet[] {
  return sceneSetIds().map((id) => sceneSet(id)!);
}

// ---------------------------------------------------------------------------
// 5. LOS ORBITALES, DE DONDE SALE SU FORMA
// ---------------------------------------------------------------------------

/**
 * Estas escenas son distintas de las cuatro anteriores en una cosa
 * importante: no estan compuestas, estan CALCULADAS.
 *
 * Las de arriba colocan esferas donde hace falta para ilustrar una idea. Las
 * de aqui sortean cada punto de la funcion de onda exacta del atomo
 * hidrogenoide (`orbitals.ts`) con probabilidad proporcional a |ψ|². Nadie ha
 * dibujado dos lobulos en ningun sitio: los lobulos SALEN porque cos θ se
 * anula en el plano ecuatorial.
 *
 * Esa diferencia es el motivo de que el apartado 2.11 tenga figuras y no solo
 * tablas. Los cuatro numeros cuanticos son una lista imposible de retener
 * mientras sean cuatro letras; en cuanto se ven, dejan de serlo:
 *
 *   n   cuanto ocupa       la nube crece, y aparecen huecos (nodos radiales)
 *   l   que forma tiene    esfera, dos lobulos, cuatro lobulos
 *   m_l hacia donde apunta  la misma forma girada a tres o cinco posiciones
 *   m_s el espin            lo unico que no se puede dibujar (se dice)
 */

/** Un a₀ por unidad de escena; la camara encuadra sola. */
function cloud(
  key: OrbitalKey,
  count: number,
  colorPositive: string,
  colorNegative: string,
  offset: Vec3 = v(0, 0, 0),
  dot = 0.34,
  seed = 20240501,
  options: SampleOptions = {},
): StructureAtom[] {
  return sampleOrbital(key, count, seed, options).map((p) =>
    sphere(
      v(p.position.x + offset.x, p.position.y + offset.y, p.position.z + offset.z),
      dot,
      p.phase === 1 ? colorPositive : colorNegative,
      ORBITALS[key].label,
    ),
  );
}

// Las dos FASES de la funcion de onda. No son dos cosas distintas ni dos
// cargas: son el signo de ψ, y existen porque ψ es una onda. Que dos lobulos
// vecinos tengan signo opuesto es lo que permite que dos orbitales se sumen
// (enlace) o se cancelen (antienlace) al acercarse dos atomos.
const PHASE_A = '#4da3ff';
const PHASE_B = '#ff7a59';

/**
 * UNA IDEA POR ESCENA, Y LA NUBE LLENANDO EL ENCUADRE.
 *
 * El primer intento ponia varios orbitales lado a lado para compararlos — el
 * 1s junto al 2s junto al 3s, los cinco d en fila. Sobre el papel parecia la
 * mejor forma de ensenar; en el lienzo de 240 px fue un desastre. La camara
 * encuadra lo que haya, y al abarcar cien radios de Bohr cada nube se quedaba
 * del tamano de una mosca: la figura de «l · la forma», cuyo unico cometido es
 * distinguir una esfera de dos lobulos y de cuatro, mostraba tres manchas
 * identicas. Ensenaba lo contrario de lo que pretendia.
 *
 * Asi que cada escena lleva UN orbital y lo llena todo. La comparacion se hace
 * cambiando de pestana, y se gana algo de paso: al reencuadrar la camara en
 * cada escena, los tamanos se normalizan y lo unico que queda a la vista es la
 * FORMA, que es de lo que habla el numero l.
 *
 * Y para lo que de verdad necesita comparar tamanos —el numero n— no se usa
 * una fila de nubes sino los numeros del pie, que ademas estan calculados.
 *
 * DOS RECURSOS DE DIBUJANTE, LOS DOS DECLARADOS
 *   - Recorte al radio del 90 %: la cola tenue de un orbital obliga a la
 *     camara a alejarse para encuadrar cuatro puntos perdidos. Es la misma
 *     convencion con la que estan dibujados los orbitales de los libros.
 *   - Corte por la mitad: una nube de puntos es opaca y los nodos radiales son
 *     huecos INTERIORES. Sin partirla no se ven.
 */
function orbitalSet(): SceneSet {
  // Los radios del 90 % se calculan, no se eligen. Y ademas se ensenan: el pie
  // de la primera escena dice cual es, para que el recorte no sea un secreto.
  const r90 = (n: number, l: number) => radiusContaining(n, l, 0.9);
  const pm = (a0: number) => Math.round(a0 * 52.9);

  return {
    id: 'orbitales',
    title: 'De donde sale la forma de un orbital',
    intro:
      'Nadie ha dibujado estas formas: salen. Cada punto se sortea con probabilidad |ψ|² a partir de la ' +
      'solucion exacta de la ecuacion de Schrodinger, asi que si hay dos lobulos es porque la funcion ' +
      'los tiene. Los dos colores son los dos SIGNOS de la onda, no dos cargas.',
    scenes: [
      {
        id: 'nube',
        title: '¿Que es un orbital?',
        caption:
          `El 1s del hidrogeno. No hay orbita ni trayectoria: hay una nube mas densa cerca del nucleo y ` +
          `cada vez mas rala al alejarse. El 90 % de la probabilidad cabe dentro de ${r90(1, 0).toFixed(1)} a₀ ` +
          `(${pm(r90(1, 0))} pm), y eso es lo que se dibuja aqui.`,
        limit:
          'El electron NO es un enjambre de bolitas: es uno solo, y la nube es la probabilidad de ' +
          'hallarlo en cada sitio. Tampoco hay superficie: la nube no termina en ningun radio, solo se ' +
          'hace cada vez mas tenue, y lo que se ha dibujado es el corte del 90 % — con el 95 % saldria ' +
          'una bola mayor. Esa frontera es un convenio, no una piel.',
        structure: molecular(
          cloud('1s', 1400, PHASE_A, PHASE_A, v(0, 0, 0), 0.09, 1, { maxRadius: r90(1, 0) }),
        ),
      },
      {
        id: 'nodos',
        title: 'n · el tamano y los huecos',
        caption:
          `El 3s, cortado en una LAMINA que pasa por el centro para poder mirarle dentro. De fuera a ` +
          `dentro: una corteza, un hueco, otra corteza, otro hueco y un nucleo denso. Los dos huecos son ` +
          `los nodos radiales —n − l − 1 = 2— y ahi la probabilidad es exactamente cero. Y el tamano: el ` +
          `1s tiene ⟨r⟩ = 1,5 a₀ y el 3s 13,5. Nueve veces mas lejos con solo dos unidades mas de n.`,
        limit:
          'El orbital NO es un disco: es una esfera, y esto es una rodaja fina que se ha dibujado para ' +
          'que los huecos se vean. Al girar la figura se notara que no hay nada delante ni detras. Y los ' +
          'nodos son superficies, no camaras de aire: no hay nada dentro ni fuera de ellos, solo una ' +
          'probabilidad que pasa por cero al cruzarlos.',
        structure: molecular(
          cloud('3s', 1800, PHASE_A, PHASE_B, v(0, 0, 0), 0.4, 2, {
            maxRadius: r90(3, 0),
            slice: 1.6,
          }),
        ),
      },
      {
        id: 'forma',
        title: 'l · la forma',
        caption:
          'El 2p. El factor angular es cos θ, que vale cero en TODO el plano ecuatorial: por eso la nube ' +
          'se parte en dos lobulos con un plano vacio en medio. Y los dos colores no son adorno — los ' +
          'lobulos tienen signo opuesto, porque cos θ cambia de signo al cruzar ese plano.',
        limit:
          'Esta recortada al 90 %, asi que los lobulos parecen tener borde. No lo tienen. Y el plano ' +
          'nodal si es real y exacto: no es que haya «poca» probabilidad en el ecuador, es que hay cero.',
        structure: molecular(
          cloud('2pz', 1600, PHASE_A, PHASE_B, v(0, 0, 0), 0.22, 3, { maxRadius: r90(2, 1) }),
        ),
      },
      {
        id: 'ml',
        title: 'm_l · la orientacion',
        caption:
          'Los TRES orbitales 2p, separados para poder verlos: la misma forma apuntando a x, a y y a z. ' +
          'Eso es m_l = −1, 0, +1 — no tres cosas distintas, sino una sola en tres posiciones. Y aqui ' +
          'esta el origen de que la subcapa p tenga sitio para 6 electrones: 3 orientaciones × 2 espines ' +
          '= 6. No es un dato que memorizar.',
        limit:
          'En un atomo los tres estan CENTRADOS EN EL MISMO NUCLEO, uno dentro de otro; aqui se han ' +
          'apartado porque superpuestos llenan la esfera entera y las tres direcciones dejan de verse. ' +
          'Cada color marca un orbital distinto, no el signo de la onda como en las demas escenas.',
        structure: molecular([
          ...cloud('2px', 750, '#ff7a59', '#ff7a59', v(-19, 0, 0), 0.26, 11, { maxRadius: r90(2, 1) }),
          ...cloud('2py', 750, '#35d6c3', '#35d6c3', v(0, 0, 0), 0.26, 12, { maxRadius: r90(2, 1) }),
          ...cloud('2pz', 750, '#4da3ff', '#4da3ff', v(19, 0, 0), 0.26, 13, { maxRadius: r90(2, 1) }),
        ]),
      },
      {
        id: 'd',
        title: 'l = 2 · cuatro lobulos',
        caption:
          'Un orbital 3d, el d_xy. Ahora el factor angular es un PRODUCTO de dos coordenadas, y se anula ' +
          'en dos planos en vez de en uno: salen cuatro lobulos, alternando de signo. Hay cinco ' +
          'orientaciones distintas como esta, y por eso la subcapa d admite 10 electrones.',
        limit:
          'De los cinco orbitales d, cuatro son este mismo trebol girado, pero el quinto —el d_z²— tiene ' +
          'otro aspecto: dos lobulos y un anillo. Aun asi tiene la misma energia y es igual de valido. ' +
          'Ademas, emparejar cada dibujo con un valor concreto de m_l es una simplificacion: solo el ' +
          'd_z² corresponde limpiamente a m_l = 0; los otros cuatro son MEZCLAS de m_l = ±1 y ±2.',
        structure: molecular(
          cloud('3dxy', 1800, PHASE_A, PHASE_B, v(0, 0, 0), 0.3, 4, { maxRadius: r90(3, 2) }),
        ),
      },
      {
        id: 'dz2',
        title: 'El quinto orbital d',
        caption:
          'El d_z², el que parece de otra familia: dos lobulos grandes sobre el eje z y un anillo ' +
          'alrededor del ecuador. Su factor angular es 3cos²θ − 1, que se anula en dos CONOS en lugar de ' +
          'en dos planos. Misma energia que los otros cuatro, forma distinta.',
        limit:
          'Que parezca «el raro» es un efecto de como se eligen los cinco. Los orbitales d se pueden ' +
          'escribir de otras maneras igual de validas en las que ninguno destaca; esta es solo la ' +
          'eleccion habitual en quimica, porque es la que encaja con los ejes de un cristal.',
        structure: molecular(
          cloud('3dz2', 1800, PHASE_A, PHASE_B, v(0, 0, 0), 0.3, 5, { maxRadius: r90(3, 2) }),
        ),
      },
    ],
  };
}

/*
 * LA OCUPACION NO SE ESCRIBE AQUI: SE LE PREGUNTA AL MOTOR.
 *
 * Que el nitrogeno tenga tres electrones desapareados en el 2p y el neon
 * ninguno es una consecuencia de las reglas de llenado, y esas reglas ya estan
 * implementadas en `analysis/electronic.ts` — es el mismo codigo que produce
 * la configuracion que se muestra en la ficha de cualquier elemento.
 *
 * Asi que estas escenas LEEN de ahi. Si manana se corrigiera una anomalia del
 * cromo, el dibujo del cromo cambiaria solo. Escribir a mano «el nitrogeno
 * tiene tres flechas hacia arriba» habria sido mas corto y habria creado una
 * segunda verdad que puede contradecir a la primera sin que nadie se entere.
 */

/** Espin hacia arriba y hacia abajo. Un color cada uno. */
const SPIN_UP = '#4da3ff';
const SPIN_DOWN = '#ff7a59';
/** Un orbital que existe pero esta VACIO: se insinua, no se oculta. */
const EMPTY = '#6b7484';

/**
 * LOS TRES ORBITALES p, SEPARADOS EN EL ESPACIO.
 *
 * El primer intento los dibujaba SUPERPUESTOS, que es como estan de verdad:
 * los tres centrados en el mismo nucleo y perpendiculares entre si. No
 * funciono. Tres nubes encima llenan la esfera entera, y la figura de «Hund,
 * como SI es» —cuyo unico cometido es ensenar que los tres electrones ocupan
 * tres DIRECCIONES distintas— salia como una bola azul lisa. Ensenaba lo
 * contrario de lo que pretendia, que es el peor fallo que puede tener una
 * figura didactica.
 *
 * Separados, cada uno conserva SU orientacion: uno apunta a izquierda y
 * derecha, otro arriba y abajo, y el tercero hacia el observador. Se ve que
 * son tres direcciones y se puede contar cuantos electrones hay en cada uno.
 * Lo que se pierde —que comparten centro— lo dice el limite de cada escena.
 *
 * La densidad de puntos es proporcional al numero de electrones: un orbital
 * con dos se dibuja con el doble de puntos que uno con uno. Eso no es un
 * recurso grafico — la densidad electronica de un orbital doblemente ocupado
 * ES el doble.
 */
/*
 * Separacion entre los tres orbitales, en a₀.
 *
 * Con 19 quedaban holgados pero pequenos: la camara encuadra una esfera, y una
 * escena ancha y plana desperdicia la mitad del alto del lienzo. Con 14 se
 * rozan sin llegar a tocarse —el 2pₓ llega a 8 a₀ por su eje y el 2p_z solo a
 * 4 por el de al lado— y la figura llena el encuadre.
 */
const P_GAP = 14;

function pShell(symbol: string, n: number, override?: readonly ('up' | 'down')[][]): StructureAtom[] {
  const config = configureAtom(symbol);
  const shell = config?.subshells.find((s) => s.n === n && s.subshell === 'p');
  if (!shell) return [];

  // Recortadas al 90 %: sin recortar, las colas de las tres se tocarian y
  // volveria el problema que la separacion viene a resolver.
  const clip = { maxRadius: radiusContaining(2, 1, 0.9) };

  // El mismo reparto de m_l que usa `orbitalName` en el motor, para que la
  // figura y el texto no se contradigan.
  const axis: Record<number, OrbitalKey> = { [-1]: '2px', 0: '2pz', 1: '2py' };

  const out: StructureAtom[] = [];
  shell.orbitals.forEach((orbital, index) => {
    const key = axis[orbital.ml] ?? '2pz';
    const at = v((index - 1) * P_GAP, 0, 0);
    const spins = override ? (override[index] ?? []) : orbital.spins;

    if (spins.length === 0) {
      out.push(...cloud(key, 110, EMPTY, EMPTY, at, 0.2, 4242 + index, clip));
      return;
    }
    for (const [i, spin] of spins.entries()) {
      const color = spin === 'up' ? SPIN_UP : SPIN_DOWN;
      out.push(...cloud(key, 430, color, color, at, 0.26, 777 + index * 31 + i * 5, clip));
    }
  });
  return out;
}

function fillingSet(): SceneSet {
  return {
    id: 'llenado',
    title: 'Pauli y Hund, vistos en el espacio',
    intro:
      'Los tres orbitales 2p de un mismo atomo, apartados uno de otro para poder contarlos. Cada uno ' +
      'conserva su direccion: el de la izquierda apunta a los lados (2pₓ), el del medio hacia ti (2p_z) ' +
      'y el de la derecha arriba y abajo (2p_y). Azul y naranja son los dos espines, y donde hay el ' +
      'doble de puntos hay el doble de electrones. La ocupacion la calcula el mismo motor que escribe ' +
      'las configuraciones.',
    scenes: [
      {
        id: 'vacio',
        title: 'Los tres orbitales, vacios',
        caption:
          'El boro tiene un solo electron en el 2p, asi que dos de los tres orbitales estan vacios — y ' +
          'se dibujan igual, en gris. Existen tenga o no tenga electrones: son soluciones de la ' +
          'ecuacion, no cajas que aparezcan al llenarse.',
        limit:
          'Un orbital vacio no «esta ahi» en ningun sentido material: es una posibilidad calculada. Se ' +
          'dibuja en gris para poder contar los tres, no porque haya nada en el. Y los tres compartirian ' +
          'centro en un atomo de verdad: aqui se han separado para que se distingan.',
        structure: molecular(pShell('B', 2)),
      },
      {
        id: 'hund-mal',
        title: 'Hund · como NO es',
        caption:
          'Tres electrones en el 2p del nitrogeno, apilados en los dos primeros orbitales y dejando el ' +
          'tercero vacio (gris). Cuenta los puntos: el de la izquierda tiene el DOBLE, azul y naranja ' +
          'mezclados. Ahi esta la aglomeracion que el atomo evita.',
        limit:
          'Esta configuracion no existe en el nitrogeno: se dibuja a proposito para compararla con la ' +
          'siguiente. «Se estorban» es una manera de hablar: la repulsion entre dos electrones no es la ' +
          'de dos bolas chocando, sino un termino de energia entre dos densidades de carga. Y los tres ' +
          'orbitales estan apartados para poder contarlos; en el atomo comparten centro.',
        structure: molecular(pShell('N', 2, [['up', 'down'], ['up'], []])),
      },
      {
        id: 'hund-bien',
        title: 'Hund · como SI es',
        caption:
          'Los mismos tres electrones, uno en cada orbital y con el espin en el mismo sentido — los tres ' +
          'azules, y los tres con la misma densidad. Ocupan tres direcciones perpendiculares, se ' +
          'estorban lo menos posible, y el atomo queda en el estado de menor energia. Esta es la regla ' +
          'de Hund, y este es su motivo.',
        limit:
          'Que los tres espines salgan paralelos no se explica solo por la distancia: interviene un ' +
          'termino cuantico —el intercambio— que no tiene analogo clasico y que no se puede dibujar. La ' +
          'figura ensena la mitad geometrica de la razon, no la razon entera. Y, como en las demas, los ' +
          'tres orbitales comparten centro en el atomo real.',
        structure: molecular(pShell('N', 2)),
      },
      {
        id: 'pauli',
        title: 'Pauli · el tope de dos',
        caption:
          'El neon: los tres orbitales con dos electrones cada uno — azul y naranja mezclados, y el doble ' +
          'de densidad que en la escena anterior. Un cuarto electron en cualquiera de ellos tendria los ' +
          'mismos n, l y m_l que uno de los que ya estan, y solo quedan dos espines posibles. Por eso un ' +
          'orbital se llena con DOS y no con tres.',
        limit:
          'El espin no es un giro. Se dibuja como color porque no tiene forma ni direccion visible; ' +
          'llamarlo «hacia arriba» y «hacia abajo» es una etiqueta heredada, no una flecha en el espacio.',
        structure: molecular(pShell('Ne', 2)),
      },
    ],
  };
}

function magnetismSet(): SceneSet {
  return {
    id: 'magnetismo',
    title: 'Por que unas sustancias sienten el iman y otras no',
    intro:
      'Aqui se ven los que quedan sueltos. Busca los orbitales con UN solo color: esos son los ' +
      'desapareados. Los que llevan azul y naranja a la vez se cancelan entre si. El recuento lo hace ' +
      'el motor, no el dibujo.',
    scenes: [
      {
        id: 'oxigeno',
        title: 'Oxigeno · paramagnetico',
        caption:
          'El 2p del oxigeno tiene cuatro electrones: el primer orbital esta lleno —se ve el doble de ' +
          'densidad, y el azul y el naranja se cancelan— y los otros dos llevan uno solo cada uno, los ' +
          'dos azules. Quedan DOS espines sin pareja, y por eso el oxigeno liquido se queda pegado entre ' +
          'los polos de un iman.',
        limit:
          'El oxigeno del aire es O₂, una molecula, y su paramagnetismo se explica del todo con ' +
          'orbitales MOLECULARES, no con los del atomo suelto. El recuento de desapareados coincide ' +
          '—dos—, pero por un camino que esta figura no muestra.',
        structure: molecular(pShell('O', 2)),
      },
      {
        id: 'neon',
        title: 'Neon · diamagnetico',
        caption:
          'Los mismos tres orbitales, ahora con seis electrones: cada azul tiene su naranja. Todos los ' +
          'momentos magneticos se cancelan por parejas y no queda ninguno suelto. El neon no responde ' +
          'al iman — de hecho lo repele muy debilmente.',
        limit:
          'El diamagnetismo no es «no tener magnetismo»: es una repulsion debil que tienen TODAS las ' +
          'sustancias. En las paramagneticas queda tapada por la atraccion de los desapareados.',
        structure: molecular(pShell('Ne', 2)),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 7. EL ENLACE QUIMICO (unidad 3)
// ---------------------------------------------------------------------------

/*
 * ESTA UNIDAD ES LA MAS ESPACIAL DE LAS TRES, Y CON DIFERENCIA.
 *
 * «El CO₂ tiene dos enlaces polares y es una molecula apolar» es una frase que
 * se puede leer cien veces sin entenderla, porque lo que hay que entender es
 * una SUMA DE VECTORES en el espacio. Dicho: suena a contradiccion. Dibujado
 * con las dos flechas apuntando en sentidos opuestos sobre la misma recta:
 * deja de haber nada que memorizar.
 *
 * Lo mismo con la red del cloruro de sodio (no hay moleculas), con el mar de
 * electrones (no pertenecen a nadie) y con la red de puentes del hielo (por
 * eso flota). Las cuatro son geometria.
 *
 * DONDE SE PUEDE, LA GEOMETRIA ES LA DE VERDAD
 * `geometry/vsepr.ts` construye las moleculas reales con sus angulos medidos —
 * el agua a 104,5°, no a 90 ni a 120. Las escenas que ensenan una molecula la
 * piden alli en vez de colocar esferas a ojo, porque el angulo ES el argumento:
 * si el agua se dibujara a 180° la figura demostraria lo contrario de lo que
 * dice el texto.
 */

const DELTA_MINUS = '#4da3ff';
const DELTA_PLUS = '#ff7a59';
const METAL_CORE = '#f5b342';
const SEA = '#4da3ff';

/** Una flecha: un reguero de esferas que se ensancha hacia la punta. */
function arrow(from: Vec3, to: Vec3, color: string, beads = 11): StructureAtom[] {
  return Array.from({ length: beads }, (_, i) => {
    const t = i / (beads - 1);
    // La punta engorda: es lo que convierte una linea de puntos en una flecha.
    const radius = t > 0.82 ? 0.3 - (t - 0.82) * 1.2 : 0.11;
    return sphere(
      v(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, from.z + (to.z - from.z) * t),
      Math.max(0.07, radius),
      color,
      'μ',
    );
  });
}

/** La molecula real, pedida al constructor de geometrias. */
function realMolecule(formula: string): StructureAtom[] {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return [];
  const built = buildStructure(formula, parsed.value.composition);
  return built ? [...built.atoms] : [];
}

function realBonds(formula: string): Bond[] {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return [];
  const built = buildStructure(formula, parsed.value.composition);
  return built ? [...built.bonds] : [];
}

/** Una red cubica de iones alternos: el cristal, no una molecula. */
function lattice(n: number, spacing: number, radiusA: number, radiusB: number): StructureAtom[] {
  const out: StructureAtom[] = [];
  const half = ((n - 1) * spacing) / 2;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        const even = (i + j + k) % 2 === 0;
        out.push(
          sphere(
            v(i * spacing - half, j * spacing - half, k * spacing - half),
            even ? radiusA : radiusB,
            even ? POSITIVE : SUBSTANCE_A,
            even ? 'Na+' : 'Cl-',
          ),
        );
      }
    }
  }
  return out;
}

function octetSet(): SceneSet {
  // Capas de valencia como anillos de puntos. No son orbitales: son un
  // RECUENTO, y el limite lo dice.
  const shell = (count: number, radius: number, color: string, tilt = 0): StructureAtom[] =>
    Array.from({ length: count }, (_, i) => {
      const a = (i / Math.max(count, 1)) * Math.PI * 2;
      return sphere(
        v(Math.cos(a) * radius, Math.sin(a) * radius * Math.cos(tilt), Math.sin(a) * radius * Math.sin(tilt)),
        0.34,
        color,
        'e',
      );
    });

  const core = (label: string) => sphere(v(0, 0, 0), 1.5, NUCLEUS, label);

  return {
    id: 'octeto',
    title: 'Por que ocho',
    intro:
      'La capa de valencia como un recuento de sitios. Los gases nobles la tienen llena, y por eso no ' +
      'reaccionan con casi nada: ya estan donde los demas intentan llegar.',
    scenes: [
      {
        id: 'neon',
        title: 'Neon · ya la tiene llena',
        caption:
          'Ocho electrones en la capa de valencia. No le sobra ninguno que ceder ni le falta hueco donde ' +
          'meter otro, asi que no tiene motivo para unirse a nadie. Eso es un gas noble.',
        limit:
          'Los electrones NO estan en un anillo ni repartidos a distancias iguales: ocupan orbitales, que ' +
          'son nubes de probabilidad con formas distintas (apartado 2.11.1). El anillo aqui solo sirve ' +
          'para CONTAR ocho.',
        structure: molecular([core('Ne'), ...shell(8, 4.2, ELECTRON)]),
      },
      {
        id: 'sodio',
        title: 'Sodio · le sobra uno',
        caption:
          'Un solo electron en la capa de fuera, lejos del nucleo y mal sujeto. Captar siete seria ' +
          'carisimo; soltar ese uno deja debajo una capa que ya esta completa. Por eso el sodio CEDE.',
        limit:
          'La capa interna completa se ha dibujado como una esfera lisa. No lo es: son diez electrones ' +
          'en sus propios orbitales. Se resume asi porque en el enlace no participan.',
        structure: molecular([core('Na'), ...shell(8, 2.6, NEUTRAL), ...shell(1, 4.6, ELECTRON)]),
      },
      {
        id: 'cloro',
        title: 'Cloro · le falta uno',
        caption:
          'Siete en la capa de valencia: un solo hueco. Captar uno le completa el octeto, y eso es ' +
          'muchisimo mas barato que soltar siete. Por eso el cloro CAPTA — y por eso sodio y cloro ' +
          'encajan tan bien.',
        limit:
          'El «hueco» no es un agujero en ningun sitio: es que en uno de los orbitales 3p hay un electron ' +
          'en vez de dos. Se dibuja como un espacio vacio del anillo para poder senalarlo.',
        structure: molecular([core('Cl'), ...shell(8, 2.6, NEUTRAL), ...shell(7, 4.6, ELECTRON)]),
      },
    ],
  };
}

function bondTypesSet(): SceneSet {
  const rng = seeded(41);
  return {
    id: 'uniones',
    title: 'Las tres maneras de resolverlo',
    intro:
      'El mismo problema —llegar a una capa completa— con tres soluciones distintas, segun quien pueda ' +
      'ceder y quien pueda captar. Compara donde estan los electrones en cada una.',
    scenes: [
      {
        id: 'ionico',
        title: 'Ionico · el electron cambia de dueno',
        caption:
          'El de la izquierda cedio y quedo positivo; el de la derecha capto y quedo negativo. Los ' +
          'electrones estan TODOS sobre uno de los dos, y lo que los une es la atraccion entre cargas ' +
          'opuestas.',
        limit:
          'Dos iones sueltos no existen en la practica: en cuanto se forman se rodean de muchos mas y ' +
          'construyen una red. Esta pareja es un recorte para poder senalar quien tiene que.',
        structure: molecular([
          sphere(v(-3.2, 0, 0), 1.1, POSITIVE, 'Na+'),
          sphere(v(3.2, 0, 0), 1.9, SUBSTANCE_A, 'Cl-'),
          ...Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return sphere(v(3.2 + Math.cos(a) * 2.7, Math.sin(a) * 2.7, 0), 0.3, ELECTRON, 'e');
          }),
        ]),
      },
      {
        id: 'covalente',
        title: 'Covalente · el par se comparte',
        caption:
          'Ninguno de los dos puede permitirse ceder, asi que ponen un electron cada uno y los DOS ' +
          'cuentan el par como suyo. Fijate en que la nube densa esta justo en medio: es lo que sujeta ' +
          'a los dos nucleos.',
        limit:
          'El par compartido no son dos bolitas quietas en el centro. Es una densidad de probabilidad ' +
          'mayor en la zona internuclear, que es exactamente lo que se dibujo con los puntos.',
        structure: molecular([
          sphere(v(-2.4, 0, 0), 1.2, NUCLEUS, 'Cl'),
          sphere(v(2.4, 0, 0), 1.2, NUCLEUS, 'Cl'),
          ...Array.from({ length: 60 }, () => {
            const t = rng() * 2 - 1;
            const r = rng() * 0.9;
            const a = rng() * Math.PI * 2;
            return sphere(v(t * 2.2, Math.cos(a) * r, Math.sin(a) * r), 0.16, ELECTRON, 'e');
          }),
        ]),
      },
      {
        id: 'metalico',
        title: 'Metalico · los electrones son de todos',
        caption:
          'Cationes ordenados en una red, y los electrones de valencia sueltos entre ellos, sin ' +
          'pertenecer a ninguno. Ese mar es lo que conduce la electricidad y lo que permite deformar el ' +
          'metal sin romperlo.',
        limit:
          'El «mar» es un modelo antiguo y basto: no explica por que unos metales conducen mas que otros ' +
          'ni por que el silicio es semiconductor. Para eso hace falta la teoria de bandas.',
        structure: molecular([
          ...Array.from({ length: 27 }, (_, i) => {
            const x = (i % 3) - 1;
            const y = (Math.floor(i / 3) % 3) - 1;
            const z = Math.floor(i / 9) - 1;
            return sphere(v(x * 3, y * 3, z * 3), 0.85, METAL_CORE, 'M+');
          }),
          ...Array.from({ length: 150 }, () =>
            sphere(v((rng() - 0.5) * 8.5, (rng() - 0.5) * 8.5, (rng() - 0.5) * 8.5), 0.19, SEA, 'e'),
          ),
        ]),
      },
    ],
  };
}

function ionicSet(): SceneSet {
  return {
    id: 'ionico',
    title: 'El cristal, no la molecula',
    intro:
      'La afirmacion mas importante del apartado —que no existe la molecula de NaCl— es geometrica, y ' +
      'por eso hay que verla. Naranja: Na⁺. Azul: Cl⁻.',
    scenes: [
      {
        id: 'par',
        title: '1 · Lo que la formula parece decir',
        caption:
          'Un sodio y un cloro juntos. Es lo que casi todo el mundo imagina al leer «NaCl», y es FALSO: ' +
          'esta pareja aislada no existe en un cristal de sal.',
        limit:
          'Se dibuja a proposito una cosa que no existe, para poder compararla con la siguiente. Los ' +
          'pares ionicos sueltos solo se dan en fase gaseosa a temperaturas altisimas.',
        structure: molecular([
          sphere(v(-2.4, 0, 0), 1.1, POSITIVE, 'Na+'),
          sphere(v(2.4, 0, 0), 1.9, SUBSTANCE_A, 'Cl-'),
        ]),
      },
      {
        id: 'red',
        title: '2 · Lo que de verdad hay',
        caption:
          'Una red tridimensional. Cada Na⁺ tiene SEIS Cl⁻ alrededor y cada Cl⁻ seis Na⁺, repetido ' +
          'millones de veces. Gira la figura: no hay forma de senalar una pareja y decir «esta es una ' +
          'molecula de sal».',
        limit:
          'Se dibujan 125 iones; un grano de sal de un milimetro tiene del orden de 10¹⁸. Y los iones no ' +
          'estan quietos: vibran alrededor de su posicion. Los tamanos relativos si son los reales — el ' +
          'cloruro es bastante mayor que el sodio.',
        structure: molecular(lattice(5, 2.4, 0.75, 1.15)),
      },
      {
        id: 'proporcion',
        title: '3 · Que significa entonces la formula',
        caption:
          'Cuenta los iones de un color y los del otro: salen iguales. Eso es lo que dice «NaCl» — una ' +
          'PROPORCION de uno a uno, no una particula. Por eso se llama unidad formula y no molecula.',
        limit:
          'En el borde del trozo dibujado la cuenta no sale exacta, porque los iones de la superficie ' +
          'tienen menos vecinos. En un cristal real la proporcion es exacta porque la superficie es ' +
          'despreciable frente al interior.',
        structure: molecular(lattice(4, 2.4, 0.75, 1.15)),
      },
    ],
  };
}

function covalentSet(): SceneSet {
  const rng = seeded(73);
  const cloudBetween = (count: number, spread: number, centre: number): StructureAtom[] =>
    Array.from({ length: count }, () => {
      const t = (rng() - 0.5) * 2;
      const r = rng() * spread;
      const a = rng() * Math.PI * 2;
      return sphere(v(centre + t * 2.0, Math.cos(a) * r, Math.sin(a) * r), 0.15, ELECTRON, 'e');
    });

  return {
    id: 'covalente',
    title: 'Compartir, no partir',
    intro:
      'Un par compartido cuenta entero para los DOS atomos. Ese doble recuento es lo que hace que la ' +
      'suma del octeto salga, y es lo que mas cuesta creerse de toda la unidad.',
    scenes: [
      {
        id: 'antes',
        title: '1 · Antes: cada uno con lo suyo',
        caption:
          'Dos atomos de cloro, cada uno con siete electrones de valencia. A los dos les falta uno y ' +
          'ninguno puede ceder: ceder siete no lo hace nadie.',
        limit:
          'Los electrones se dibujan alrededor de cada nucleo como una nube difusa. En realidad ocupan ' +
          'orbitales con forma definida, que ya se vieron en el apartado 2.11.1.',
        structure: molecular([
          sphere(v(-4.5, 0, 0), 1.2, NUCLEUS, 'Cl'),
          sphere(v(4.5, 0, 0), 1.2, NUCLEUS, 'Cl'),
          ...cloudBetween(45, 1.5, -4.5),
          ...cloudBetween(45, 1.5, 4.5),
        ]),
      },
      {
        id: 'despues',
        title: '2 · Despues: la nube del medio',
        caption:
          'Se acercan y aparece una zona densa ENTRE los dos nucleos. Esa carga negativa del centro atrae ' +
          'a los dos nucleos positivos a la vez, y eso es el enlace: no un palo, una atraccion compartida.',
        limit:
          'La raya que se dibuja en una formula estructural representa este par compartido, pero un ' +
          'enlace no es un objeto rigido: los atomos vibran, se acercan y se separan constantemente ' +
          'alrededor de una distancia media.',
        structure: molecular([
          sphere(v(-2.1, 0, 0), 1.2, NUCLEUS, 'Cl'),
          sphere(v(2.1, 0, 0), 1.2, NUCLEUS, 'Cl'),
          ...cloudBetween(30, 1.3, -2.6),
          ...cloudBetween(30, 1.3, 2.6),
          ...cloudBetween(70, 0.85, 0),
        ]),
      },
    ],
  };
}

/** Moleculas reales, con los angulos que dice la VSEPR. */
function lewis3dSet(): SceneSet {
  const scene = (formula: string, title: string, caption: string, limit: string): Scene => ({
    id: formula.toLowerCase(),
    title,
    caption,
    limit,
    structure: molecular(realMolecule(formula), realBonds(formula)),
  });

  return {
    id: 'lewis3d',
    title: 'De la estructura plana a la molecula',
    intro:
      'Una formula de Lewis se dibuja en un papel, pero la molecula esta en el espacio. Estas son las ' +
      'mismas especies con sus angulos de verdad, construidas por el motor de geometria a partir de la ' +
      'estructura de Lewis.',
    scenes: [
      scene(
        'CH4',
        'Metano · tetraedrica',
        'Cuatro pares de enlace, ningun par libre. Se reparten lo mas lejos posible unos de otros y sale ' +
          'un tetraedro de 109,5°. En el papel se dibuja en cruz, y en cruz no esta.',
        'Los enlaces no son varillas rigidas. La molecula vibra: los angulos y las distancias oscilan ' +
          'alrededor del valor que se dibuja, que es una media.',
      ),
      scene(
        'NH3',
        'Amoniaco · piramidal',
        'Tres enlaces y UN par libre. El par libre no se ve pero ocupa sitio y empuja: el angulo baja de ' +
          '109,5° a 107°, y la molecula queda como una piramide en vez de plana.',
        'El par libre no esta dibujado. Es lo mas importante de esta figura y es justamente lo que no se ' +
          'puede representar con una esfera: ocupa una region difusa encima del nitrogeno.',
      ),
      scene(
        'H2O',
        'Agua · angular',
        'Dos enlaces y DOS pares libres, que empujan el doble: el angulo cae a 104,5°. Esa doblez es la ' +
          'razon de que el agua sea polar, de que forme puentes de hidrogeno y de que exista el mar.',
        'Igual que antes, los dos pares libres no se dibujan. Estan ahi, encima del oxigeno, y son los ' +
          'responsables del angulo que si se ve.',
      ),
      scene(
        'CO2',
        'Dioxido de carbono · lineal',
        'Dos dobles enlaces y ningun par libre sobre el carbono. Sin nada que empuje, los dos oxigenos se ' +
          'colocan en linea recta, a 180°. Recuerda esta forma para el apartado de polaridad.',
        'Los dobles enlaces se dibujan como dos cilindros paralelos, que es un convenio. Un doble enlace ' +
          'no son dos enlaces iguales: es un sigma y un pi, y el pi tiene otra forma.',
      ),
    ],
  };
}

/**
 * Las flechas se calculan DESDE las posiciones reales de los atomos.
 *
 * El primer intento las coloco en coordenadas supuestas —los hidrogenos del
 * agua «arriba»— y salieron espejadas: estan en y = −0,59, debajo del oxigeno.
 * El dibujo quedaba con las dos flechas apuntando hacia fuera y hacia arriba,
 * que es exactamente lo contrario de lo que dice el pie. Una figura que
 * contradice a su propio texto es peor que ninguna figura.
 *
 * Asi que se piden las posiciones al constructor de geometrias y se calculan a
 * partir de ellas. Si manana cambiara el angulo del agua, las flechas se
 * moverian con el.
 */
function dipoleArrow(from: Vec3, to: Vec3, color: string, overshoot = 0.82, beads = 9): StructureAtom[] {
  return arrow(
    from,
    v(
      from.x + (to.x - from.x) * overshoot,
      from.y + (to.y - from.y) * overshoot,
      from.z + (to.z - from.z) * overshoot,
    ),
    color,
    beads,
  );
}

/**
 * La molecula, agrandada.
 *
 * Un enlace O–H mide 0,96 unidades y una flecha legible necesita mas sitio que
 * eso: dibujadas a la escala de la molecula quedan del tamano de los atomos y
 * no se distingue la punta. Se multiplican las distancias —no los radios— por
 * un factor, y el limite de la escena lo dice.
 */
function scaledMolecule(formula: string, k: number): StructureAtom[] {
  /*
   * Solo se toca la POSICION. Ni el radio ni el color se ponen, y eso es
   * deliberado: los atomos de una molecula real son atomos de elementos, y el
   * renderizador les da su radio y su color CPK. Rellenarlos con un valor por
   * defecto —como se hizo en el primer intento— dejaba el oxigeno y los
   * hidrogenos del agua del mismo gris, y una figura sobre polaridad en la que
   * no se distingue el oxigeno no sirve de nada.
   */
  return realMolecule(formula).map((a) => ({
    ...a,
    position: v(a.position.x * k, a.position.y * k, a.position.z * k),
  }));
}

/** Localiza los atomos de una molecula real por su simbolo, ya escalados. */
function atomsOf(formula: string, symbol: string, k = 1): Vec3[] {
  return realMolecule(formula)
    .filter((a) => a.symbol === symbol)
    .map((a) => v(a.position.x * k, a.position.y * k, a.position.z * k));
}

function polaritySet(): SceneSet {
  // Las distancias se agrandan para que quepan las flechas; los angulos, que
  // son el argumento, no se tocan.
  const K = 2.6;
  const water = scaledMolecule('H2O', K);
  const co2 = scaledMolecule('CO2', K);

  // Posiciones REALES, no supuestas.
  const oWater = atomsOf('H2O', 'O', K)[0]!;
  const hWater = atomsOf('H2O', 'H', K);
  const cCo2 = atomsOf('CO2', 'C', K)[0]!;
  const oCo2 = atomsOf('CO2', 'O', K);

  return {
    id: 'polaridad',
    title: 'Enlace polar no es molecula polar',
    intro:
      'LA figura de la unidad. Cada flecha azul es el dipolo de UN enlace y apunta hacia el atomo que ' +
      'tira mas de los electrones. La polaridad de la molecula es la SUMA de esas flechas — y una suma ' +
      'de vectores depende de hacia donde apuntan, no solo de cuanto miden.',
    scenes: [
      {
        id: 'co2',
        title: 'CO₂ · dos flechas que se anulan',
        caption:
          'Dos enlaces muy polares (ΔEN = 0,89) y la molecula es APOLAR. Las dos flechas apuntan hacia ' +
          'los oxigenos, estan sobre la misma recta y van en sentidos opuestos: se cancelan exactamente. ' +
          'Momento dipolar neto, cero. No hay tercera flecha que dibujar.',
        limit:
          'Las flechas no existen: representan el desplazamiento de la densidad electronica. Y que se ' +
          'cancelen NO significa que los enlaces dejen de ser polares — lo siguen siendo, y eso se nota ' +
          'en como reacciona el CO₂. Lo que se anula es el efecto neto a distancia.',
        structure: molecular([
          ...co2,
          ...dipoleArrow(cCo2, oCo2[0]!, DELTA_MINUS),
          ...dipoleArrow(cCo2, oCo2[1]!, DELTA_MINUS),
        ]),
      },
      {
        id: 'agua',
        title: 'H₂O · dos flechas que no se anulan',
        caption:
          'Dos enlaces polares igual que antes, pero la molecula esta DOBLADA a 104,5°. Las flechas van ' +
          'de cada hidrogeno hacia el oxigeno y forman un angulo entre si, asi que su suma no es cero: ' +
          'es la flecha naranja, que apunta por la bisectriz hacia el oxigeno. La molecula es polar.',
        limit:
          'La flecha naranja es la SUMA, y esta dibujada a una escala distinta de las azules para que se ' +
          'vea — no mide lo que mediria el vector suma de verdad. Y los dos pares libres del oxigeno, ' +
          'que son los que doblan la molecula, no se pueden dibujar como esferas.',
        structure: molecular([
          ...water,
          ...dipoleArrow(hWater[0]!, oWater, DELTA_MINUS, 0.78, 8),
          ...dipoleArrow(hWater[1]!, oWater, DELTA_MINUS, 0.78, 8),
          /*
           * La SUMA. Arranca en el punto medio de los dos hidrogenos —que es
           * donde esta el centro de carga positiva— y apunta hacia el oxigeno
           * y mas alla. Ni empieza antes ni atraviesa la molecula por detras:
           * empezar por debajo de los hidrogenos hacia que pareciera venir de
           * fuera y cruzarla entera.
           */
          ...arrow(v(0, hWater[0]!.y, 0), v(0, oWater.y + 3.4, 0), DELTA_PLUS, 14),
        ]),
      },
      {
        id: 'ccl4',
        title: 'CCl₄ · cuatro que se anulan',
        caption:
          'Cuatro enlaces C–Cl polares apuntando a los cuatro vertices de un tetraedro. En tres ' +
          'dimensiones esa disposicion es tan simetrica que la suma vuelve a dar cero. Gira la figura: ' +
          'mires desde donde mires, esta equilibrada.',
        limit:
          'Aqui no se han dibujado las flechas: cuatro apuntando a un tetraedro dejan la figura ' +
          'ilegible. La simetria se ve mejor girando la molecula, que es lo que se pide hacer.',
        structure: molecular(realMolecule('CCl4'), realBonds('CCl4')),
      },
      {
        id: 'chcl3',
        title: 'CHCl₃ · cambia UN atomo y ya es polar',
        caption:
          'El mismo tetraedro con un cloro sustituido por un hidrogeno. El C–H tira mucho menos que los ' +
          'C–Cl, la cancelacion se rompe y queda un dipolo neto apuntando hacia el lado de los tres ' +
          'cloros — es decir, en sentido contrario al hidrogeno.',
        limit:
          'La flecha del dipolo neto tiene una longitud elegida para que se vea, no a escala con las ' +
          'distancias de la molecula.',
        structure: (() => {
          const h = atomsOf('CHCl3', 'H', 1)[0]!;
          // El dipolo neto va del hidrogeno hacia el centro y sigue: los tres
          // cloros estan del lado opuesto y entre ellos se lo reparten.
          return molecular([
            ...realMolecule('CHCl3'),
            ...arrow(v(h.x * 1.6, h.y * 1.6, h.z * 1.6), v(-h.x * 1.9, -h.y * 1.9, -h.z * 1.9), DELTA_PLUS, 14),
          ]);
        })(),
      },
    ],
  };
}

function metallicSet(): SceneSet {
  const rng = seeded(97);
  const cations = (n: number, spacing: number, offset = 0): StructureAtom[] =>
    Array.from({ length: n * n * n }, (_, i) => {
      const x = (i % n) - (n - 1) / 2;
      const y = (Math.floor(i / n) % n) - (n - 1) / 2;
      const z = Math.floor(i / (n * n)) - (n - 1) / 2;
      return sphere(v(x * spacing + offset, y * spacing, z * spacing), 0.9, METAL_CORE, 'M+');
    });

  return {
    id: 'metalico',
    title: 'El mar de electrones',
    intro:
      'Cationes fijos en una red, y los electrones de valencia sueltos entre ellos sin pertenecer a ' +
      'ninguno. De ahi salen de golpe todas las propiedades de un metal.',
    scenes: [
      {
        id: 'mar',
        title: 'La red y el mar',
        caption:
          'Los cationes (naranja) estan ordenados; los electrones (azul) no estan en ninguna parte ' +
          'concreta. Un electron deslocalizado se mueve por TODO el metal, y eso es exactamente lo que ' +
          'significa conducir la electricidad.',
        limit:
          'Los electrones no son bolitas ni se mueven en linea recta como un gas. Es un modelo clasico y ' +
          'viejo: no explica por que el cobre conduce mejor que el hierro ni por que el silicio es ' +
          'semiconductor. Para eso hace falta la teoria de bandas.',
        structure: molecular([
          ...cations(3, 3.4),
          ...Array.from({ length: 200 }, () =>
            sphere(v((rng() - 0.5) * 10, (rng() - 0.5) * 10, (rng() - 0.5) * 10), 0.2, SEA, 'e'),
          ),
        ]),
      },
      {
        id: 'deformar',
        title: 'Por que se dobla en vez de romperse',
        caption:
          'Una capa de cationes desplazada respecto de las otras. Como los electrones son de todos, el ' +
          'enlace se rehace sobre la marcha y el metal se deforma sin partirse. Compara esto con lo que ' +
          'le pasa a un cristal ionico al golpearlo.',
        limit:
          'El desplazamiento se dibuja congelado y limpio. En un metal real la deformacion ocurre por ' +
          'movimiento de defectos de la red —dislocaciones—, no por capas enteras deslizando a la vez.',
        structure: molecular([
          ...cations(3, 3.4).filter((a) => a.position.y < 0),
          ...cations(3, 3.4)
            .filter((a) => a.position.y >= 0)
            .map((a) => sphere(v(a.position.x + 1.7, a.position.y, a.position.z), 0.9, METAL_CORE, 'M+')),
          ...Array.from({ length: 180 }, () =>
            sphere(v((rng() - 0.5) * 11, (rng() - 0.5) * 10, (rng() - 0.5) * 10), 0.2, SEA, 'e'),
          ),
        ]),
      },
    ],
  };
}

function imfSet(): SceneSet {
  return {
    id: 'intermoleculares',
    title: 'Lo que pasa ENTRE moleculas',
    intro:
      'Ojo a la diferencia de escala: dentro de cada molecula hay enlaces covalentes de unos 460 kJ/mol; ' +
      'entre unas moleculas y otras, fuerzas de 20 o menos. Hervir separa lo segundo, no rompe lo ' +
      'primero.',
    scenes: [
      {
        id: 'dentro-fuera',
        title: 'Dentro y fuera de la molecula',
        caption:
          'Tres moleculas de agua. Las rayas cortas y gruesas son los enlaces O–H, DENTRO de cada una. Lo ' +
          'que separa unas moleculas de otras es mucho mas debil — y es lo unico que se rompe al hervir.',
        limit:
          'Las distancias entre moleculas estan comprimidas para que quepan las tres. En el agua liquida ' +
          'las moleculas estan mas juntas y en movimiento constante, chocando y girando.',
        structure: (() => {
          const atoms: StructureAtom[] = [];
          const bonds: Bond[] = [];
          for (const [dx, dy] of [[-4.5, 0], [0, 2.2], [4.5, 0]] as const) {
            const base = atoms.length;
            const mol = realMolecule('H2O');
            for (const a of mol) {
              atoms.push(sphere(v(a.position.x + dx, a.position.y + dy, a.position.z), a.radius ?? 0.6, a.color ?? '#888', a.symbol));
            }
            for (const b of realBonds('H2O')) bonds.push({ a: base + b.a, b: base + b.b, order: 1, kind: 'covalent-polar' });
          }
          return molecular(atoms, bonds);
        })(),
      },
    ],
  };
}

function hydrogenBondSet(): SceneSet {
  /** Una molecula de agua colocada y girada, con sus enlaces. */
  const placed = (dx: number, dy: number, dz: number, turn: number, out: StructureAtom[], bonds: Bond[]) => {
    const base = out.length;
    const mol = realMolecule('H2O');
    for (const a of mol) {
      const x = a.position.x * Math.cos(turn) - a.position.y * Math.sin(turn);
      const y = a.position.x * Math.sin(turn) + a.position.y * Math.cos(turn);
      out.push(sphere(v(x + dx, y + dy, a.position.z + dz), a.radius ?? 0.6, a.color ?? '#888', a.symbol));
    }
    for (const b of realBonds('H2O')) bonds.push({ a: base + b.a, b: base + b.b, order: 1, kind: 'covalent-polar' });
    return base;
  };

  const net = () => {
    const atoms: StructureAtom[] = [];
    const bonds: Bond[] = [];
    placed(0, 0, 0, 0, atoms, bonds);
    placed(-3.4, 2.6, 0, 2.1, atoms, bonds);
    placed(3.4, 2.6, 0, -2.1, atoms, bonds);
    placed(0, -3.4, 2.2, 3.14, atoms, bonds);
    placed(0, -3.4, -2.2, 3.14, atoms, bonds);
    return molecular(atoms, bonds);
  };

  return {
    id: 'puentes',
    title: 'La red que sostiene al agua',
    intro:
      'Cada molecula de agua puede formar CUATRO puentes de hidrogeno: dos por sus hidrogenos y dos por ' +
      'los pares libres del oxigeno. Cuatro es lo que hace del agua un caso aparte.',
    scenes: [
      {
        id: 'cuatro',
        title: 'Cuatro puentes por molecula',
        caption:
          'La molecula del centro rodeada de otras cuatro, dos por arriba y dos por abajo. Sus dos H ' +
          'apuntan a los pares libres de dos vecinas, y sus dos pares libres reciben los H de otras dos. ' +
          'Donador y aceptor a la vez.',
        limit:
          'Los puentes de hidrogeno NO estan dibujados como lineas: solo se ve la disposicion. Y la red ' +
          'no es estatica — en agua liquida los puentes se rompen y se rehacen billones de veces por ' +
          'segundo. Esto es una foto de un instante imposible.',
        structure: net(),
      },
    ],
  };
}

function dispersionSet(): SceneSet {
  const rng = seeded(131);
  /** Una molecula apolar con su nube desplazada un poco a un lado. */
  const blob = (cx: number, shift: number, color: string): StructureAtom[] => [
    sphere(v(cx, 0, 0), 1.3, NEUTRAL, 'X'),
    ...Array.from({ length: 70 }, () => {
      const r = Math.cbrt(rng()) * 2.1;
      const t = Math.acos(2 * rng() - 1);
      const p = rng() * Math.PI * 2;
      return sphere(
        v(cx + r * Math.sin(t) * Math.cos(p) + shift, r * Math.sin(t) * Math.sin(p), r * Math.cos(t)),
        0.15,
        color,
        'e',
      );
    }),
  ];

  return {
    id: 'dispersion',
    title: 'Dipolos que duran un instante',
    intro:
      'Los electrones de una molecula apolar se mueven, y en un instante dado pueden estar mas a un ' +
      'lado que a otro. Ese desequilibrio momentaneo induce otro en la vecina, y los dos se atraen.',
    scenes: [
      {
        id: 'simetrica',
        title: '1 · En promedio, simetrica',
        caption:
          'Dos moleculas apolares. Promediada en el tiempo, la nube de cada una esta centrada: no hay ' +
          'ningun lado mas negativo que otro, y por eso se dice que son apolares.',
        limit:
          'Un promedio no es una foto. En ningun instante concreto la nube esta perfectamente centrada — ' +
          'eso es justamente lo que hace posible la escena siguiente.',
        structure: molecular([...blob(-4, 0, ELECTRON), ...blob(4, 0, ELECTRON)]),
      },
      {
        id: 'instante',
        title: '2 · En un instante, no',
        caption:
          'La nube de la izquierda se ha corrido a un lado por puro azar: por un momento tiene un ' +
          'extremo δ− y otro δ+. Eso EMPUJA la nube de la derecha al mismo lado, apareciendo un dipolo ' +
          'inducido, y los dos extremos que ahora se enfrentan tienen signos opuestos: se atraen.',
        limit:
          'Estos desequilibrios duran del orden de 10⁻¹⁵ segundos y se rehacen sin parar en direcciones ' +
          'distintas. La figura congela uno; lo que hay de verdad es un parpadeo continuo, y la ' +
          'atraccion neta es el promedio de todos ellos.',
        structure: molecular([...blob(-4, -0.9, DELTA_MINUS), ...blob(4, -0.9, DELTA_MINUS)]),
      },
    ],
  };
}
