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
          'Entre el nucleo y los electrones no hay NADA. Ni aire, ni materia, ni una sustancia que los una: vacio. Un atomo es, sobre todo, espacio vacio.',
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

const SETS = new Map<string, SceneSet>();

/** Los conjuntos de escenas, construidos una sola vez. */
export function sceneSet(id: string): SceneSet | null {
  if (SETS.size === 0) {
    for (const set of [scaleSet(), modelSet(), matterSet(), changeSet()]) SETS.set(set.id, set);
  }
  return SETS.get(id) ?? null;
}

export function allSceneSets(): readonly SceneSet[] {
  sceneSet('escala');
  return [...SETS.values()];
}
