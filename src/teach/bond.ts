/**
 * UNIDAD 3 — EL ENLACE QUIMICO.
 *
 * ES LA UNIDAD QUE MAS SE PUEDE CALCULAR DE TODO EL PROYECTO.
 *
 * Las otras dos unidades tenian que apoyarse en datos tabulados (masas
 * atomicas, abundancias isotopicas). Esta, no: el motor de analisis lleva
 * escrito y probado desde hace tiempo todo lo que la unidad explica, y lo hace
 * DERIVANDOLO de la formula:
 *
 *   analysis/lewis.ts          cuenta electrones de valencia, elige atomo
 *                              central, prueba ordenes de enlace y se queda
 *                              con el de menor carga formal. La estructura de
 *                              Lewis de los apartados 3.2.1.2 y 3.2.2.4 no
 *                              esta dibujada: sale de ahi.
 *   analysis/hybridization.ts  numero esterico, hibridacion y geometria VSEPR.
 *   analysis/polarity.ts       polaridad de cada enlace por ΔEN y —lo
 *                              importante— la SUMA VECTORIAL de los dipolos
 *                              sobre la geometria real. Es lo que hace que el
 *                              apartado 3.2.2.5 pueda demostrar que el CO₂
 *                              tiene dos enlaces polares y momento dipolar
 *                              cero, en lugar de pedir que se crea.
 *   analysis/imf.ts            fuerzas intermoleculares y orden de puntos de
 *                              ebullicion, que es el apartado 3.3 entero.
 *
 * Asi que aqui no se afirma casi nada. Se pregunta.
 *
 * LO QUE ESTA UNIDAD DECLARA QUE NO TIENE (§32)
 * El ENLACE METALICO no tiene motor. No hay modelo de bandas ni de mar de
 * electrones en ninguna capa de la aplicacion, y el apartado 3.2.3 lo dice:
 * explica el modelo con datos medidos de los propios elementos (puntos de
 * fusion, densidades) pero no calcula nada sobre el enlace. Fingir lo
 * contrario seria justo lo que el proyecto no hace.
 */

import { getElement, ELEMENTS } from '../data/elements.js';
import { getSpecies } from '../data/species.js';
import { analyzeSpecies } from '../analysis/analyze.js';
import { configureAtom, lewisValenceElectrons } from '../analysis/electronic.js';
import { lewisLine } from '../analysis/lewis.js';
import { compareBoilingPoint } from '../analysis/imf.js';
import { classifyBond } from '../analysis/polarity.js';
import { formatPlainUnicode } from '../core/formula/render.js';
import type { TheoryTopic } from './theory.js';

// ---------------------------------------------------------------------------
// Demostraciones
// ---------------------------------------------------------------------------

/** 3.1 — cuantos electrones le faltan a cada elemento, y a que gas noble va. */
export interface OctetDemo {
  readonly kind: 'octet';
  readonly rows: readonly {
    readonly symbol: string;
    readonly name: string;
    readonly valence: number;
    readonly needs: number;
    readonly gives: number;
    readonly route: 'capta' | 'cede' | 'comparte' | 'ya lo tiene';
    readonly target: string;
    readonly ion: string | null;
  }[];
  /** Los que rompen la regla, con su motivo. Se ensenan, no se esconden. */
  readonly exceptions: readonly { readonly formula: string; readonly why: string }[];
}

/** 3.2.1 — la transferencia, con las configuraciones antes y despues. */
export interface TransferDemo {
  readonly kind: 'transfer';
  readonly metal: string;
  readonly nonmetal: string;
  readonly before: readonly { readonly label: string; readonly config: string }[];
  readonly after: readonly { readonly label: string; readonly config: string; readonly like: string }[];
  readonly deltaEN: number;
  readonly formula: string;
  readonly steps: readonly string[];
}

/** 3.2.1.2 y 3.2.2.4 — estructuras de Lewis DERIVADAS de la formula. */
export interface LewisSetDemo {
  readonly kind: 'lewis-set';
  readonly title: string;
  readonly rows: readonly {
    readonly formula: string;
    readonly pretty: string;
    readonly line: string;
    readonly valenceElectrons: number;
    readonly shape: string;
    readonly note: string | null;
  }[];
  /** Lo que el motor se niega a derivar, y por que (§32). */
  readonly refused: readonly { readonly formula: string; readonly why: string }[];
}

/** 3.2.2.1 / 3.2.2.2 — el continuo de ΔEN, no tres cajones. */
export interface BondScaleDemo {
  readonly kind: 'bond-scale';
  readonly rows: readonly {
    readonly label: string;
    readonly deltaEN: number;
    readonly kind: string;
    readonly ionicCharacter: number;
    readonly towards: string;
  }[];
}

/** 3.2.2.5 — LA demostracion de la unidad: dipolos de enlace frente a neto. */
export interface DipoleDemo {
  readonly kind: 'dipole';
  readonly rows: readonly {
    readonly formula: string;
    readonly pretty: string;
    readonly shape: string;
    readonly bonds: readonly { readonly label: string; readonly deltaEN: number; readonly kind: string }[];
    readonly bondsArePolar: boolean;
    readonly netMagnitude: number;
    readonly isPolar: boolean;
    readonly symmetric: boolean;
    readonly reason: string;
  }[];
}

/** 3.2.2.3 — de donde sale el par compartido en un enlace coordinado. */
export interface CoordinateDemo {
  readonly kind: 'coordinate';
  readonly rows: readonly {
    readonly formula: string;
    readonly pretty: string;
    readonly donor: string;
    readonly acceptor: string;
    readonly line: string;
    readonly note: string;
  }[];
}

/** 3.2.3 — el enlace metalico: datos medidos, porque motor no hay. */
export interface MetallicDemo {
  readonly kind: 'metallic';
  readonly rows: readonly {
    readonly symbol: string;
    readonly name: string;
    readonly valence: number;
    readonly melting: number | null;
    readonly density: number | null;
  }[];
  readonly gap: string;
}

/** 3.3 — fuerzas intermoleculares y puntos de ebullicion MEDIDOS. */
export interface ImfDemo {
  readonly kind: 'imf';
  readonly rows: readonly {
    readonly formula: string;
    readonly pretty: string;
    readonly polar: boolean;
    readonly dominant: string;
    readonly electrons: number;
    readonly molarMass: number;
    readonly donors: number;
    readonly acceptors: number;
    /** Punto de ebullicion medido, en °C. `null` si no esta en la base. */
    readonly boiling: number | null;
  }[];
  /** Comparaciones que hace el motor, con su razon. */
  readonly comparisons: readonly {
    readonly a: string;
    readonly b: string;
    readonly higher: string;
    readonly because: string;
    /** ¿Lo confirman los puntos de ebullicion medidos? */
    readonly confirmed: boolean | null;
  }[];
  readonly caution: string;
}

export type BondDemo =
  | OctetDemo
  | TransferDemo
  | LewisSetDemo
  | BondScaleDemo
  | DipoleDemo
  | CoordinateDemo
  | MetallicDemo
  | ImfDemo;

// ---------------------------------------------------------------------------
// Calculo de las demostraciones
// ---------------------------------------------------------------------------

/**
 * A que gas noble se parece un ion, preguntandoselo al motor electronico.
 *
 * No es una tabla de «Na⁺ es como el Ne»: se configura el ion y se mira si su
 * configuracion condensada empieza por el gas noble. Si manana se corrigiera
 * una anomalia de llenado, esto cambiaria con ella.
 */
function nobleGasLike(symbol: string, charge: number): string {
  const config = configureAtom(symbol, charge);
  if (!config) return '—';
  return config.isNobleGasLike ? `configuracion de gas noble (${config.condensed})` : config.condensed;
}

function octetDemo(): OctetDemo {
  const chosen = ['Na', 'Mg', 'Al', 'C', 'N', 'O', 'F', 'Ne'];

  const rows = chosen.flatMap((symbol) => {
    const element = getElement(symbol);
    if (!element) return [];
    const valence = lewisValenceElectrons(element);
    const needs = Math.max(0, 8 - valence);

    // La ruta la decide la ARITMETICA, no una tabla: ceder tres es mas barato
    // que captar cinco, y ahi esta el limite entre metales y no metales.
    const route: OctetDemo['rows'][number]['route'] =
      valence === 8 || (symbol === 'He' && valence === 2)
        ? 'ya lo tiene'
        : valence <= 3
          ? 'cede'
          : needs <= 2
            ? 'capta'
            : 'comparte';

    const charge = route === 'cede' ? valence : route === 'capta' ? -needs : 0;

    return [
      {
        symbol,
        name: element.name,
        valence,
        needs,
        gives: valence,
        route,
        target: nobleGasLike(symbol, charge),
        ion: charge === 0 ? null : `${symbol}${Math.abs(charge) > 1 ? Math.abs(charge) : ''}${charge > 0 ? '+' : '−'}`,
      },
    ];
  });

  return {
    kind: 'octet',
    rows,
    exceptions: [
      {
        formula: 'BF₃',
        why:
          'El boro se queda con SEIS electrones y es estable asi. Tiene tres electrones de valencia y ' +
          'forma tres enlaces: no le llegan para ocho, y captar los que faltan le costaria mas de lo ' +
          'que gana. Por eso el BF₃ acepta pares de otras moleculas — es un acido de Lewis.',
      },
      {
        formula: 'PCl₅ · SF₆',
        why:
          'Diez y doce electrones alrededor del atomo central. A partir del periodo 3 hay orbitales d ' +
          'disponibles y la capa se puede EXPANDIR. Por eso existe el SF₆ y no existe el OF₆: el ' +
          'oxigeno es del periodo 2 y no tiene donde meterlos.',
      },
      {
        formula: 'NO · NO₂',
        why:
          'Numero IMPAR de electrones de valencia: no hay forma de emparejarlos todos. Queda un ' +
          'electron desapareado, la molecula es un radical libre y por eso son tan reactivos.',
      },
      {
        formula: 'H · He',
        why:
          'El hidrogeno y el helio no buscan ocho sino DOS: su unica capa, la n = 1, solo tiene un ' +
          'orbital 1s y ahi caben dos electrones. Se llama regla del dueto, y no es una excepcion ' +
          'caprichosa — es la misma regla contando los sitios que de verdad hay.',
      },
    ],
  };
}

function transferDemo(): TransferDemo {
  const na = getElement('Na')!;
  const cl = getElement('Cl')!;

  return {
    kind: 'transfer',
    metal: 'Na',
    nonmetal: 'Cl',
    before: [
      { label: 'Na (11 electrones)', config: configureAtom('Na')!.condensed },
      { label: 'Cl (17 electrones)', config: configureAtom('Cl')!.condensed },
    ],
    after: [
      { label: 'Na⁺ (10 electrones)', config: configureAtom('Na', 1)!.condensed, like: 'neon' },
      { label: 'Cl⁻ (18 electrones)', config: configureAtom('Cl', -1)!.condensed, like: 'argon' },
    ],
    deltaEN: Math.abs((cl.electronegativity ?? 0) - (na.electronegativity ?? 0)),
    formula: 'NaCl',
    steps: [
      'El sodio tiene UN electron en la capa 3s, solo y lejos del nucleo. Soltarlo le deja la capa ' +
        'anterior completa.',
      'Al cloro le falta UNO para completar su 3p. Captarlo le deja la capa completa.',
      'Los dos ganan lo mismo con la misma operacion, asi que el electron pasa de uno a otro. No se ' +
        'comparte: cambia de dueno.',
      'Quedan dos iones de carga opuesta, y lo que los mantiene juntos es la atraccion electrostatica ' +
        'entre ellos — eso es el enlace ionico.',
    ],
  };
}

/** Las estructuras que el motor DERIVA, y las que se niega a derivar. */
function lewisSetDemo(title: string, formulas: readonly string[]): LewisSetDemo {
  const rows: LewisSetDemo['rows'][number][] = [];
  const refused: { formula: string; why: string }[] = [];

  for (const formula of formulas) {
    const profile = analyzeSpecies(formula);
    const structure = profile?.lewis?.best;

    if (!profile || !structure) {
      /*
       * Que el motor SE NIEGUE es contenido, no un fallo, y por eso se recoge
       * con su motivo en lugar de saltarselo. El NaCl no tiene estructura de
       * Lewis molecular; la glucosa la tiene pero su busqueda no termina en un
       * tiempo razonable. Son dos negativas distintas y las dos ensenan algo.
       */
      refused.push({
        formula: formatPlainUnicode(formula),
        why:
          profile?.limitations[0] ??
          'El motor no deriva esta estructura y prefiere no ensenar una inventada.',
      });
      continue;
    }

    rows.push({
      formula,
      pretty: formatPlainUnicode(formula),
      line: lewisLine(structure),
      valenceElectrons: structure.totalValenceElectrons,
      shape: profile.geometry?.shape ?? '—',
      note: profile.lewis!.warnings[0] ?? null,
    });
  }

  return { kind: 'lewis-set', title, rows, refused };
}

/**
 * EL CONTINUO DE LA ELECTRONEGATIVIDAD.
 *
 * Ordenado por ΔEN, se ve que no hay tres cajones sino una rampa: del Cl–Cl
 * (0,00) al Na–Cl (2,23) no hay ningun salto, solo una diferencia que crece. El
 * motor pone la etiqueta donde el convenio dice, y la tabla ensena que el
 * convenio es eso, un convenio.
 */
function bondScaleDemo(): BondScaleDemo {
  const pairs: readonly [string, string][] = [
    ['Cl', 'Cl'], ['C', 'H'], ['S', 'H'], ['C', 'Cl'], ['N', 'H'],
    ['C', 'O'], ['O', 'H'], ['H', 'F'], ['Al', 'O'], ['Na', 'Cl'], ['K', 'F'],
  ];

  const rows = pairs.flatMap(([a, b]) => {
    const ea = getElement(a);
    const eb = getElement(b);
    if (!ea || !eb || ea.electronegativity === null || eb.electronegativity === null) return [];
    const delta = Math.abs(ea.electronegativity - eb.electronegativity);

    /*
     * Se le pregunta al MISMO clasificador que usa el analizador de especies.
     * Reimplementar aqui el convenio de ΔEN habria creado una segunda version
     * de la frontera, y ademas una peor: `classifyBond` contempla que haya un
     * metal, y sin esa condicion el HF (ΔEN = 1,78) saldria ionico.
     */
    const verdict = classifyBond(delta, a, b);

    /*
     * El porcentaje de caracter ionico, por la relacion empirica de Pauling.
     * Es el numero que mejor ensena que la frontera de 1,7 es un convenio: da
     * ahi un 51 %, es decir, alguien llamo «ionico» a partir de donde el
     * caracter ionico pasa de la mitad. Ni mas ni menos razon que esa.
     */
    const ionicCharacter = 100 * (1 - Math.exp(-0.25 * delta * delta));

    return [
      {
        label: `${a}–${b}`,
        deltaEN: delta,
        kind: verdict.kind,
        ionicCharacter,
        towards: ea.electronegativity > eb.electronegativity ? a : b,
      },
    ];
  });

  return { kind: 'bond-scale', rows: [...rows].sort((x, y) => x.deltaEN - y.deltaEN) };
}

/**
 * DIPOLOS DE ENLACE FRENTE A DIPOLO NETO.
 *
 * La demostracion mas valiosa de la unidad, y la que no se puede hacer con
 * texto. El CO₂ tiene DOS enlaces polares y momento dipolar CERO; el H₂O tiene
 * dos enlaces igual de polares y momento dipolar grande. La diferencia no esta
 * en los enlaces: esta en la GEOMETRIA, y solo se ve sumando vectores.
 *
 * El motor los suma de verdad sobre las posiciones reales de los atomos.
 */
function dipoleDemo(): DipoleDemo {
  const formulas = ['CO2', 'H2O', 'CCl4', 'CHCl3', 'BF3', 'NH3', 'CH4', 'HCl'];

  const rows = formulas.flatMap((formula) => {
    const profile = analyzeSpecies(formula);
    const p = profile?.polarity;
    if (!profile || !p) return [];

    return [
      {
        formula,
        pretty: formatPlainUnicode(formula),
        shape: profile.geometry?.shape ?? '—',
        bonds: p.bonds.map((b) => ({ label: b.label, deltaEN: b.deltaEN, kind: b.kind })),
        bondsArePolar: p.bonds.some((b) => b.kind !== 'apolar'),
        netMagnitude: p.magnitude,
        isPolar: p.isPolar,
        symmetric: p.symmetric,
        reason: p.reason,
      },
    ];
  });

  return { kind: 'dipole', rows };
}

function coordinateDemo(): CoordinateDemo {
  const cases: readonly { formula: string; donor: string; acceptor: string; note: string }[] = [
    {
      formula: 'NH4+',
      donor: 'el par libre del nitrogeno en el NH₃',
      acceptor: 'un H⁺, que llega sin ningun electron',
      note:
        'Los CUATRO enlaces N–H del ion amonio son identicos: misma longitud, misma energia. Una vez ' +
        'formado no hay forma experimental de saber cual fue el coordinado. La distincion es sobre el ' +
        'ORIGEN del par, no sobre el enlace resultante.',
    },
    {
      formula: 'H3O+',
      donor: 'un par libre del oxigeno en el H₂O',
      acceptor: 'un H⁺ de un acido',
      note:
        'Es lo que de verdad ocurre cuando un acido se disuelve en agua: el proton no anda suelto, se ' +
        'engancha a una molecula de agua por un enlace coordinado. Por eso la especie acida real es el ' +
        'H₃O⁺ y no el H⁺.',
    },
  ];

  const rows = cases.flatMap((c) => {
    const profile = analyzeSpecies(c.formula);
    const structure = profile?.lewis?.best;
    if (!structure) return [];
    return [
      {
        formula: c.formula,
        pretty: formatPlainUnicode(c.formula),
        donor: c.donor,
        acceptor: c.acceptor,
        line: lewisLine(structure),
        note: c.note,
      },
    ];
  });

  return { kind: 'coordinate', rows };
}

function metallicDemo(): MetallicDemo {
  const chosen = ['Na', 'Mg', 'Al', 'Fe', 'Cu', 'W', 'Hg'];

  const rows = chosen.flatMap((symbol) => {
    const element = ELEMENTS.find((e) => e.symbol === symbol);
    if (!element) return [];
    return [
      {
        symbol,
        name: element.name,
        valence: lewisValenceElectrons(element),
        melting: element.physical.meltingPoint.value,
        density: element.physical.density.value,
      },
    ];
  });

  return {
    kind: 'metallic',
    rows,
    gap:
      'Estos numeros son datos MEDIDOS de cada elemento, no un calculo del enlace metalico. La ' +
      'aplicacion no tiene modelo de bandas ni de mar de electrones: no puede predecir la ' +
      'conductividad de un metal ni su punto de fusion a partir de su estructura electronica. La ' +
      'tabla sirve para ver la tendencia —mas electrones cedidos al mar, enlace mas fuerte, mayor ' +
      'punto de fusion— y para ver donde esa tendencia falla, que es tan instructivo como lo otro.',
  };
}

/** Punto de ebullicion medido, en grados Celsius. */
function boilingCelsius(formula: string): number | null {
  const species = getSpecies(formula);
  const kelvin = species?.properties.boilingPoint?.value ?? null;
  return kelvin === null ? null : Math.round((kelvin - 273.15) * 10) / 10;
}

/**
 * LAS FUERZAS INTERMOLECULARES, Y LA MEDIDA QUE LAS CONFIRMA.
 *
 * El motor predice cual de dos sustancias hierve a mayor temperatura y por
 * que. Y despues se comprueba contra los puntos de ebullicion MEDIDOS que hay
 * en la base de datos, con su procedencia. Una prediccion que no se contrasta
 * es una opinion.
 */
function imfDemo(): ImfDemo {
  const formulas = ['CH4', 'HCl', 'H2S', 'H2O', 'NH3', 'HF', 'CO2', 'Cl2'];

  const analyzed = formulas.flatMap((formula) => {
    const profile = analyzeSpecies(formula);
    if (!profile?.imf || !profile.polarity) return [];
    return [{ formula, profile }];
  });

  const rows = analyzed.map(({ formula, profile }) => ({
    formula,
    pretty: formatPlainUnicode(formula),
    polar: profile.polarity!.isPolar,
    dominant: profile.imf!.dominant?.kind ?? '—',
    electrons: profile.imf!.electronCount,
    molarMass: profile.imf!.molarMass,
    donors: profile.imf!.hydrogenBondDonors,
    acceptors: profile.imf!.hydrogenBondAcceptors,
    boiling: boilingCelsius(formula),
  }));

  // Las parejas elegidas son las que mas ensenan: dos casos donde el puente de
  // hidrogeno da la vuelta a lo que diria la masa molecular, y uno donde
  // manda la dispersion.
  const pairs: readonly [string, string][] = [
    ['H2O', 'H2S'],
    ['NH3', 'CH4'],
    ['HF', 'HCl'],
    ['Cl2', 'CH4'],
  ];

  const comparisons = pairs.flatMap(([fa, fb]) => {
    const a = analyzed.find((x) => x.formula === fa);
    const b = analyzed.find((x) => x.formula === fb);
    if (!a || !b) return [];

    const verdict = compareBoilingPoint(
      { name: formatPlainUnicode(fa), imf: a.profile.imf!, polar: a.profile.polarity!.isPolar },
      { name: formatPlainUnicode(fb), imf: b.profile.imf!, polar: b.profile.polarity!.isPolar },
    );
    if (!verdict) return [];

    // El contraste con la realidad. `null` si falta el dato: no se inventa.
    const ta = boilingCelsius(fa);
    const tb = boilingCelsius(fb);
    const confirmed =
      ta === null || tb === null
        ? null
        : (ta > tb ? formatPlainUnicode(fa) : formatPlainUnicode(fb)) === verdict.higher;

    return [
      {
        a: formatPlainUnicode(fa),
        b: formatPlainUnicode(fb),
        higher: verdict.higher,
        because: verdict.because,
        confirmed,
      },
    ];
  });

  return {
    kind: 'imf',
    rows,
    comparisons,
    caution: analyzed[0]?.profile.imf?.caution ?? '',
  };
}

// ---------------------------------------------------------------------------
// El temario
// ---------------------------------------------------------------------------

export function unitEnlace(): TheoryTopic<BondDemo> {
  return {
    id: '3',
    title: 'Enlace quimico',
    body:
      'Por que los atomos se unen, de cuantas maneras distintas lo hacen, y como esa manera decide ' +
      'todo lo demas: si una sustancia es dura o blanda, si conduce la electricidad, a que temperatura ' +
      'hierve y en que se disuelve.',
    children: [
      {
        id: '3.1',
        title: 'Regla del octeto',
        requires: ['2.11.1.2', '2.10.2'],
        body:
          'Los atomos se unen para quedarse con OCHO electrones en su capa de valencia — la ' +
          'configuracion que ya tienen los gases nobles, que son justamente los elementos que no ' +
          'reaccionan con casi nada. No es que los atomos «quieran» nada: es que esa disposicion tiene ' +
          'menos energia, y todo sistema fisico cae hacia donde la energia es menor.',
        figure: 'octeto',
        keyIdea:
          'El octeto no es una ley: es una REGLA PRACTICA que funciona muy bien para los elementos del ' +
          'periodo 2 y bastante bien para el 3. Las excepciones no la invalidan — la acotan.',
        pitfall:
          'Decir que un atomo «busca» o «quiere» completar su octeto es una manera de hablar, y es ' +
          'peligrosa: da a entender que hay una intencion. Lo que hay es que la configuracion completa ' +
          'tiene menos energia, y los sistemas evolucionan hacia la energia minima igual que una pelota ' +
          'rueda cuesta abajo. La pelota tampoco quiere bajar.',
        analogy: {
          image:
            'Como una fila de asientos en un cine: la gente se sienta donde queda sitio, y una fila ' +
            'completa ya no admite a nadie mas. Los gases nobles son las filas llenas.',
          limit:
            'La comparacion falla en lo esencial: un asiento vacio no atrae a nadie, y aqui el hueco SI ' +
            'cambia la energia del conjunto. Ademas los electrones no ocupan asientos numerados sino ' +
            'orbitales, que son regiones de probabilidad — eso ya se vio en el 2.11.1.',
        },
        demo: octetDemo(),
        worked: {
          question:
            '¿Por que el sodio forma Na⁺ y el oxigeno forma O²⁻, y no al reves? Deducelo de sus ' +
            'configuraciones.',
          steps: [
            { text: 'El sodio es [Ne] 3s¹: tiene UN electron de valencia.', math: 'Na: [Ne] 3s¹ → 1 e⁻ de valencia' },
            {
              text: 'Para llegar a ocho tendria que captar siete. Para vaciar la capa le basta con ceder uno.',
              math: 'captar 7  frente a  ceder 1',
            },
            {
              text: 'Ceder uno le deja la configuracion del neon, que ya esta completa. Por eso cede.',
              math: 'Na − 1 e⁻ → Na⁺ = [Ne]',
            },
            { text: 'El oxigeno es [He] 2s² 2p⁴: tiene SEIS de valencia.', math: 'O: [He] 2s² 2p⁴ → 6 e⁻' },
            {
              text: 'Captar dos le completa el octeto; ceder seis le costaria muchisimo mas.',
              math: 'O + 2 e⁻ → O²⁻ = [Ne]',
            },
          ],
          answer:
            'Cada uno toma el camino MAS CORTO hacia una capa completa, y el camino mas corto lo decide ' +
            'cuantos electrones de valencia tiene. Esa es tambien la frontera entre metales (pocos ' +
            'electrones de valencia, ceden) y no metales (muchos, captan).',
        },
        check: [
          {
            question:
              'Si la regla del octeto tiene tantas excepciones —BF₃, PCl₅, SF₆, NO—, ¿por que se sigue ' +
              'ensenando?',
            answer:
              'Porque acierta en la inmensa mayoria de los compuestos del periodo 2, que son los de la ' +
              'quimica organica y la bioquimica: carbono, nitrogeno, oxigeno. Una regla que funciona en ' +
              'el 90 % de los casos y avisa de donde falla es mucho mas util que ninguna regla. Lo ' +
              'importante es saber que es una aproximacion, no una ley de la naturaleza: quien la toma ' +
              'por ley se queda sin poder explicar el SF₆.',
          },
          {
            question: '¿Por que el hidrogeno se conforma con dos electrones y no busca ocho?',
            answer:
              'Porque su unica capa es la n = 1, y ahi solo hay un orbital, el 1s, en el que caben dos ' +
              'electrones. No es que se conforme: es que no hay mas sitios. Ocho electrones en la capa ' +
              'n = 1 es tan imposible como un orbital 1p, y por el mismo motivo — l tiene que ser menor ' +
              'que n, que se vio en el 2.11.1.1.',
          },
        ],
        connects: [
          { label: '2.11.1.2 Configuracion electronica', topic: '2.11.1.2' },
          { label: '3.2 Como se unen entonces', topic: '3.2' },
        ],
      },

      {
        id: '3.2',
        title: 'Uniones interatomicas',
        requires: ['3.1'],
        body:
          'Hay tres formas de resolver el mismo problema. Si un atomo cede y otro capta, queda un ENLACE ' +
          'IONICO. Si ninguno de los dos puede permitirse ceder, COMPARTEN: enlace covalente. Y si todos ' +
          'son metales y ninguno tiene a quien cederle, sueltan sus electrones a un fondo comun: enlace ' +
          'METALICO.',
        keyIdea:
          'Los tres tipos no son tres cajones: son los tres vertices de un triangulo, y casi todos los ' +
          'compuestos reales caen en algun punto intermedio. La pregunta util no es «¿de que tipo es?» ' +
          'sino «¿cuanto tiene de cada uno?».',
        figure: 'uniones',
        pitfall:
          'La frontera ΔEN = 1,7 que se usa para separar ionico de covalente es un CONVENIO, no un ' +
          'hecho. El HF tiene ΔEN = 1,78 y es covalente; el AlCl₃, con 1,55, tiene mas caracter ionico ' +
          'del que sugiere el numero. Lo que de verdad manda es si hay un metal y un no metal.',
        demo: bondScaleDemo(),
        check: [
          {
            question:
              'Mirando la escala de ΔEN, ¿donde esta exactamente la raya entre un enlace polar y uno ' +
              'ionico?',
            answer:
              'En ninguna parte: no hay raya. La tabla esta ordenada por ΔEN y se ve que es una RAMPA ' +
              'continua, del Cl–Cl con 0,00 al K–F con 3,16, sin ningun salto. La etiqueta cambia en 1,7 ' +
              'porque alguien eligio ese numero para poder hablar, no porque ahi ocurra nada fisico. Por ' +
              'eso el porcentaje de caracter ionico es mas informativo que la etiqueta.',
          },
        ],
        connects: [{ label: '3.1 De donde viene la necesidad de unirse', topic: '3.1' }],
        children: [
          {
            id: '3.2.1',
            title: 'Enlace ionico',
            requires: ['3.2'],
            body:
              'Un metal cede electrones y un no metal los capta. Quedan dos iones de carga opuesta, y lo ' +
              'que los une es la atraccion electrostatica entre cargas — la misma fuerza de un iman de ' +
              'nevera, pero entre particulas. El electron no se comparte: CAMBIA DE DUENO.',
            figure: 'ionico',
            keyIdea:
              'NO EXISTE LA MOLECULA DE NaCl. Lo que existe es una red tridimensional donde cada Na⁺ ' +
              'esta rodeado de seis Cl⁻ y cada Cl⁻ de seis Na⁺, repetida millones de veces. La formula ' +
              'NaCl no dice «una molecula»: dice «hay un sodio por cada cloro».',
            analogy: {
              image:
                'Como los ladrillos de una pared: no hay «una unidad de pared», hay un patron que se ' +
                'repite. Contar ladrillos y mortero da la proporcion, no el tamano de la pieza.',
              limit:
                'En una pared los ladrillos se tocan y se sostienen por gravedad y rozamiento. Aqui lo ' +
                'que sujeta es la atraccion electrica, que actua a distancia y en todas las direcciones ' +
                'a la vez — por eso la red es tan rigida y por eso se rompe de golpe al deformarla.',
            },
            demo: transferDemo(),
            check: [
              {
                question:
                  'Si el cloruro de sodio no tiene moleculas, ¿que significa entonces la formula NaCl?',
                answer:
                  'Una PROPORCION, no una particula. Dice que en el cristal hay exactamente un ion sodio ' +
                  'por cada ion cloruro. Por eso a NaCl se le llama «unidad formula» y no «molecula»: ' +
                  'senala la relacion minima de numeros enteros, igual que decir que una pared tiene un ' +
                  'ladrillo por cada dos dedos de mortero no describe ninguna pieza suelta.',
              },
            ],
            connects: [{ label: '3.2.2 Cuando ninguno puede ceder', topic: '3.2.2' }],
            children: [
              {
                id: '3.2.1.1',
                title: 'Caracteristicas',
                requires: ['3.2.1'],
                body:
                  'Todas las propiedades de un compuesto ionico salen de lo mismo: la red es rigida y las ' +
                  'cargas estan fijas en su sitio. Puntos de fusion altisimos (el NaCl funde a 801 °C), ' +
                  'solidos duros pero FRAGILES, no conducen en solido y SI conducen fundidos o disueltos.',
                keyIdea:
                  'La fragilidad y la conduccion son la misma explicacion vista dos veces: las cargas no ' +
                  'se pueden mover. Al golpear el cristal, una capa se desplaza, quedan cargas iguales ' +
                  'enfrentadas y se repelen — se parte. Al fundirlo, los iones por fin pueden moverse, y ' +
                  'un ion que se mueve es una corriente.',
                pitfall:
                  'Un compuesto ionico solido NO conduce, y esto sorprende porque «esta lleno de cargas». ' +
                  'Lo esta, pero atrapadas: para conducir no basta tener cargas, tienen que poder ' +
                  'DESPLAZARSE. Es la diferencia entre tener dinero y tenerlo disponible.',
                check: [
                  {
                    question:
                      'Un metal se abolla al golpearlo y un cristal de sal se hace polvo. Los dos son ' +
                      'solidos con cargas dentro. ¿Por que se comportan al reves?',
                    answer:
                      'Porque en el metal los electrones son comunes a todos los cationes, asi que una ' +
                      'capa puede deslizarse sobre otra y el enlace se rehace sobre la marcha: se ' +
                      'deforma. En el cristal ionico cada carga tiene signo y posicion fijos; al ' +
                      'desplazar una capa, los Na⁺ quedan frente a Na⁺ y los Cl⁻ frente a Cl⁻, la ' +
                      'repulsion sustituye a la atraccion y el cristal se parte por ese plano. La ' +
                      'maleabilidad de uno y la fragilidad del otro salen del mismo hecho: si las cargas ' +
                      'son moviles o no.',
                  },
                ],
                connects: [{ label: '3.2.3 El enlace metalico, para comparar', topic: '3.2.3' }],
              },
              {
                id: '3.2.1.2',
                title: 'Estructura de Lewis',
                requires: ['3.2.1'],
                body:
                  'En un compuesto ionico la estructura de Lewis se dibuja distinto: NO hay pares ' +
                  'compartidos. Se escribe cada ion por separado, entre corchetes y con su carga fuera, ' +
                  'y el anion lleva ya los electrones que capto. La flecha del electron que se transfiere ' +
                  'se dibuja solo para explicar el origen; en la estructura final no aparece.',
                keyIdea:
                  'Si ves un par de puntos ENTRE dos simbolos, es covalente. En un ionico los puntos ' +
                  'estan todos sobre el anion, porque son suyos.',
                pitfall:
                  'El motor de esta aplicacion SE NIEGA a derivar la estructura de Lewis de un compuesto ' +
                  'ionico tratandolo como molecular, y hace bien: si lo intentara, colocaria el sodio ' +
                  'como atomo central con carga formal negativa, que es una estructura falsa y ' +
                  'convincente. Abajo se ve que lo dice en lugar de dibujarla.',
                demo: lewisSetDemo('Lo que el motor deriva y lo que rehusa', [
                  'H2O',
                  'NaCl',
                  'CaO',
                  'NaOH',
                ]),
                check: [
                  {
                    question:
                      'En la estructura de Lewis del NaCl, ¿por que los ocho electrones se dibujan todos ' +
                      'sobre el cloro y ninguno sobre el sodio?',
                    answer:
                      'Porque el sodio se ha quedado SIN capa de valencia: cedio su unico electron 3s y lo ' +
                      'que le queda debajo es la capa completa del neon, que no se dibuja nunca. El cloro ' +
                      'tenia siete y capto uno, asi que tiene ocho y son suyos. Dibujar un par entre los ' +
                      'dos simbolos seria decir que lo comparten, y no lo comparten: se lo dio.',
                  },
                ],
                connects: [{ label: '3.2.2.4 Las de los covalentes', topic: '3.2.2.4' }],
              },
            ],
          },

          {
            id: '3.2.2',
            title: 'Enlace covalente',
            requires: ['3.2'],
            body:
              'Cuando los dos atomos necesitan captar electrones, ninguno puede ceder: la unica salida es ' +
              'COMPARTIR. Cada uno aporta un electron al par compartido, y ese par cuenta para el octeto ' +
              'de los DOS a la vez. Ahi esta el truco — un mismo par se cuenta dos veces, y por eso ocho ' +
              'electrones alcanzan para todos.',
            figure: 'covalente',
            keyIdea:
              'Compartir no es partir por la mitad: el par compartido pertenece a los dos atomos ' +
              'enteramente. Es la razon de que la cuenta del octeto salga.',
            pitfall:
              'Un enlace covalente no es «dos electrones en medio, quietos». Es una region donde la ' +
              'densidad electronica es alta, entre los dos nucleos, y esa densidad es lo que los sujeta: ' +
              'los dos nucleos positivos son atraidos por la misma carga negativa del centro.',
            analogy: {
              image:
                'Dos personas sujetando la misma cuerda, cada una por un extremo. Ninguna suelta, y es ' +
                'la cuerda tensa lo que las mantiene a distancia fija.',
              limit:
                'La cuerda no atrae a nadie: mantiene unidas por tension. Aqui lo que une es una ' +
                'ATRACCION de los dos nucleos hacia la nube compartida, y ademas el par no esta en un ' +
                'sitio concreto sino repartido como una densidad de probabilidad.',
            },
            check: [
              {
                question:
                  'Dos atomos de cloro tienen siete electrones de valencia cada uno: catorce en total. Si ' +
                  'al unirse cada uno «tiene ocho», eso serian dieciseis. ¿De donde salen los dos que ' +
                  'sobran?',
                answer:
                  'De ninguna parte: no sobran, se cuentan dos veces. El par compartido pertenece a los ' +
                  'DOS atomos enteramente, asi que entra en la cuenta del octeto de uno y tambien en la ' +
                  'del otro. Hay catorce electrones y siguen siendo catorce; lo que pasa es que dos de ' +
                  'ellos son de los dos a la vez. Ese doble recuento no es una trampa de la ' +
                  'contabilidad: refleja que la nube del par esta fisicamente entre los dos nucleos y ' +
                  'los dos la sienten como suya.',
              },
            ],
            connects: [{ label: '3.1 De donde sale la cuenta de ocho', topic: '3.1' }],
            children: [
              {
                id: '3.2.2.1',
                title: 'Enlace covalente apolar',
                requires: ['3.2.2'],
                body:
                  'Cuando los dos atomos son el mismo elemento —o tienen electronegatividades casi ' +
                  'iguales— tiran del par compartido con la misma fuerza. El par se queda centrado y no ' +
                  'aparece ninguna carga parcial: el enlace es APOLAR.',
                keyIdea:
                  'El caso perfecto es una molecula diatomica de un mismo elemento: H₂, O₂, N₂, Cl₂. Ahi ' +
                  'ΔEN = 0,00 exactamente, y no por aproximacion: los dos atomos tienen la misma ' +
                  'electronegatividad porque son el mismo elemento.',
                pitfall:
                  'El enlace C–H se cuenta como apolar (ΔEN = 0,35) aunque no sea cero. Es un convenio ' +
                  'util —por debajo de 0,4 la diferencia apenas se nota— y es lo que permite decir que ' +
                  'los hidrocarburos son apolares y no se mezclan con el agua.',
                check: [
                  {
                    question: '¿Puede un enlace entre atomos DISTINTOS ser apolar?',
                    answer:
                      'Practicamente si. Lo que hace falta es que las electronegatividades sean casi ' +
                      'iguales, no que los atomos lo sean. El C–H tiene ΔEN = 0,35 y se trata como ' +
                      'apolar; el S–H, con 0,38, tambien. En rigor no son cero, pero la diferencia es tan ' +
                      'pequena que no produce efectos observables: la molecula se comporta como apolar. ' +
                      'Cero exacto solo lo da un enlace entre dos atomos del mismo elemento.',
                  },
                ],
                connects: [{ label: '3.2.2.2 Cuando si hay diferencia', topic: '3.2.2.2' }],
              },
              {
                id: '3.2.2.2',
                title: 'Enlace covalente polar',
                requires: ['3.2.2.1'],
                body:
                  'Si un atomo es mas electronegativo que el otro, tira mas del par compartido. El par no ' +
                  'se va del todo —eso seria ionico— pero se desplaza: sobre el atomo mas electronegativo ' +
                  'aparece una carga parcial negativa (δ−) y sobre el otro una positiva (δ+). El enlace ' +
                  'tiene un DIPOLO.',
                keyIdea:
                  'δ+ y δ− no son cargas enteras como las de un ion: son fracciones de carga. Por eso se ' +
                  'escriben con delta, la letra que en matematicas significa «un poco de».',
                pitfall:
                  'Que un enlace sea polar NO significa que la molecula lo sea. Es el error mas comun de ' +
                  'toda la unidad, y tiene su propio apartado: el 3.2.2.5.',
                demo: lewisSetDemo('Enlaces polares derivados de la formula', ['HCl', 'H2O', 'NH3', 'HF']),
                check: [
                  {
                    question: '¿Que significa exactamente la δ del δ+ y el δ−?',
                    answer:
                      'Que la carga es PARCIAL, una fraccion de la carga de un electron, no un electron ' +
                      'entero. En el HCl el cloro no se ha quedado con el electron del hidrogeno: se ha ' +
                      'quedado con una parte mayor del tiempo de ese par compartido. Si se lo quedara ' +
                      'entero tendriamos H⁺ y Cl⁻, es decir, un enlace ionico. El delta es justamente lo ' +
                      'que distingue «tira mas» de «se lo lleva».',
                  },
                ],
                connects: [
                  { label: '3.2.2.5 Polaridad de la MOLECULA', topic: '3.2.2.5' },
                  { label: '2.11 De donde sale la electronegatividad', topic: '2.11' },
                ],
              },
              {
                id: '3.2.2.3',
                title: 'Enlace covalente coordinado',
                requires: ['3.2.2'],
                body:
                  'Un caso particular: el par compartido lo pone UN SOLO atomo. El otro aporta un orbital ' +
                  'vacio y ningun electron. Se llama coordinado o dativo, y se dibuja con una flecha que ' +
                  'sale del que dona el par.',
                keyIdea:
                  'Una vez formado, el enlace coordinado es INDISTINGUIBLE de un covalente normal. Los ' +
                  'cuatro enlaces N–H del ion amonio miden lo mismo y cuestan lo mismo romper. La ' +
                  'distincion habla del ORIGEN del par, no del enlace que queda.',
                pitfall:
                  'La flecha es una herramienta de contabilidad, no una descripcion fisica. Sirve para ' +
                  'llevar la cuenta de los electrones al explicar como se formo la especie; en la ' +
                  'molecula terminada no hay ninguna flecha ni ninguna asimetria.',
                demo: coordinateDemo(),
                check: [
                  {
                    question:
                      'El NH₄⁺ tiene cuatro enlaces N–H y uno de ellos es coordinado. ¿Que experimento ' +
                      'distinguiria cual?',
                    answer:
                      'Ninguno, y esa es la respuesta importante. Los cuatro enlaces tienen la misma ' +
                      'longitud, la misma energia de disociacion y el mismo angulo: el ion es un ' +
                      'tetraedro perfecto. Una vez que el par esta compartido, da igual quien lo puso. ' +
                      'La etiqueta «coordinado» describe la HISTORIA de como se formo el enlace, no una ' +
                      'propiedad del enlace — y por eso no se puede medir.',
                  },
                ],
                connects: [{ label: '3.3.1.2 El puente de hidrogeno se le parece', topic: '3.3.1.2' }],
              },
              {
                id: '3.2.2.4',
                title: 'Formulas estructurales de Lewis',
                requires: ['3.2.2.2', '3.2.2.3'],
                body:
                  'Una estructura de Lewis dibuja TODOS los electrones de valencia: los pares ' +
                  'compartidos, como una raya entre los atomos, y los pares libres, como dos puntos sobre ' +
                  'el atomo. Dibujarla bien es el paso previo a saber la geometria, la polaridad y las ' +
                  'fuerzas intermoleculares — todo el resto de la unidad cuelga de aqui.',
                figure: 'lewis3d',
                keyIdea:
                  'Los PARES LIBRES son los protagonistas escondidos. No se ven en la formula molecular, ' +
                  'pero ocupan sitio, empujan a los enlaces y deciden la geometria: el agua es angular y ' +
                  'no lineal por culpa de sus dos pares libres.',
                pitfall:
                  'Las estructuras de esta aplicacion no estan dibujadas a mano: el motor cuenta los ' +
                  'electrones de valencia, elige el atomo central, prueba ordenes de enlace y se queda ' +
                  'con la de menor carga formal. Y cuando no puede hacerlo con garantias, LO DICE en ' +
                  'lugar de ensenar una estructura plausible pero falsa.',
                demo: lewisSetDemo('Derivadas por el motor, no dibujadas', [
                  'H2O',
                  'CO2',
                  'NH3',
                  'CH4',
                  'O3',
                  'HCN',
                  'C6H12O6',
                ]),
                worked: {
                  question: 'Deriva la estructura de Lewis del CO₂ paso a paso.',
                  steps: [
                    {
                      text: 'Se cuentan los electrones de valencia de todos los atomos.',
                      math: 'C: 4 · O: 6 × 2 = 12 → total 16 e⁻',
                    },
                    {
                      text: 'Se elige el atomo central: el menos electronegativo de los que pueden tener varios vecinos.',
                      math: 'el carbono va al centro',
                    },
                    {
                      text: 'Se ponen enlaces simples y se reparte el resto como pares libres.',
                      math: 'O–C–O usa 4 e⁻; quedan 12 para repartir',
                    },
                    {
                      text: 'Al carbono le faltan cuatro electrones para el octeto. Se forman enlaces multiples acercando pares libres de los oxigenos.',
                      math: 'O=C=O',
                    },
                    {
                      text: 'Se comprueban las cargas formales: la estructura buena es la que las deja mas cerca de cero.',
                      math: 'con dos dobles enlaces, todas las cargas formales son 0 ✓',
                    },
                  ],
                  answer:
                    'O=C=O, con dos pares libres sobre cada oxigeno. Y fijate en que los dobles enlaces no ' +
                    'se han puesto porque «el CO₂ los tiene», sino porque son la unica forma de que el ' +
                    'carbono llegue a ocho sin dejar cargas formales.',
                },
                check: [
                  {
                    question:
                      '¿Por que el motor se niega a derivar la estructura de la glucosa (C₆H₁₂O₆) ' +
                      'teniendo las reglas escritas?',
                    answer:
                      'Porque su metodo es probar combinaciones de ordenes de enlace y quedarse con la ' +
                      'mejor, y eso crece como 3 elevado al numero de terminales. Con los 23 terminales de ' +
                      'la glucosa serian unos 9,4·10¹⁰ combinaciones: la pagina se quedaria colgada. ' +
                      'Podria dibujar una estructura cualquiera y no decir nada, pero entonces estaria ' +
                      'ensenando algo que no ha comprobado. Prefiere decir que no puede.',
                  },
                ],
                connects: [
                  { label: '3.2.1.2 Las de los ionicos, que son distintas', topic: '3.2.1.2' },
                  { label: '3.2.2.5 Lo que la estructura permite calcular', topic: '3.2.2.5' },
                ],
              },
              {
                id: '3.2.2.5',
                title: 'Polaridad y momentos dipolares',
                requires: ['3.2.2.4'],
                body:
                  'El momento dipolar de una molecula es la SUMA VECTORIAL de los dipolos de todos sus ' +
                  'enlaces. Vectorial: con direccion y sentido, no solo con tamano. Por eso una molecula ' +
                  'con enlaces muy polares puede tener momento dipolar CERO si su geometria los coloca ' +
                  'de forma que se cancelen.',
                figure: 'polaridad',
                keyIdea:
                  'ENLACE POLAR Y MOLECULA POLAR SON COSAS DISTINTAS. El CO₂ tiene dos enlaces C=O muy ' +
                  'polares (ΔEN = 0,89) y es una molecula APOLAR, porque es lineal y los dos dipolos ' +
                  'apuntan en sentidos opuestos. El agua tiene dos enlaces igual de polares y SI es ' +
                  'polar, porque es angular y no se cancelan.',
                pitfall:
                  'Este es el error mas repetido de toda la quimica de bachillerato: contestar «es polar ' +
                  'porque tiene enlaces polares». La pregunta correcta tiene dos partes — ¿son polares ' +
                  'los enlaces? y ¿los coloca la geometria de forma que se cancelen? — y hay que ' +
                  'contestar las dos.',
                analogy: {
                  image:
                    'Como una cuerda tirada por varias personas. Dos personas igual de fuertes tirando ' +
                    'en sentidos opuestos dejan la cuerda quieta, por mucha fuerza que hagan las dos.',
                  limit:
                    'En el tira y afloja la fuerza es real aunque se cancele, y aqui tambien: los enlaces ' +
                    'del CO₂ siguen siendo polares y eso se nota en su reactividad. Lo que se cancela es ' +
                    'el efecto NETO a distancia, no la polaridad de cada enlace.',
                },
                demo: dipoleDemo(),
                worked: {
                  question:
                    'El CO₂ y el H₂O tienen los dos enlaces polares. ¿Por que uno es apolar y el otro el ' +
                    'disolvente mas polar que existe?',
                  steps: [
                    {
                      text: 'Se miran los enlaces. Los dos casos tienen dipolos de enlace parecidos.',
                      math: 'C=O: ΔEN 0,89 · O–H: ΔEN 1,24',
                    },
                    {
                      text: 'Se mira la GEOMETRIA, que sale de la estructura de Lewis. El carbono no tiene pares libres; el oxigeno tiene dos.',
                      math: 'CO₂ lineal (180°) · H₂O angular (104,5°)',
                    },
                    {
                      text: 'Se suman los vectores. En el CO₂ los dos apuntan hacia fuera en la misma recta y sentidos opuestos.',
                      math: '→ + ← = 0',
                    },
                    {
                      text: 'En el agua forman un angulo, asi que su suma no se anula: apunta por la bisectriz, hacia el oxigeno.',
                      math: '↘ + ↙ = ↓  (no nulo)',
                    },
                  ],
                  answer:
                    'La diferencia no esta en los enlaces: esta en los PARES LIBRES del oxigeno, que ' +
                    'doblan la molecula. Sin ellos el agua seria lineal, seria apolar, no formaria ' +
                    'puentes de hidrogeno, herviria a unos −80 °C y no habria oceanos. Dos pares libres.',
                },
                check: [
                  {
                    question:
                      'El CCl₄ y el CHCl₃ se parecen muchisimo. ¿Por que uno es apolar y el otro polar?',
                    answer:
                      'Por la simetria. El CCl₄ es un tetraedro con cuatro enlaces C–Cl identicos: los ' +
                      'cuatro dipolos apuntan a los cuatro vertices y se cancelan exactamente, momento ' +
                      'dipolar cero. En el CHCl₃ uno de esos cuatro es un C–H, que tira mucho menos, asi ' +
                      'que la cancelacion se rompe y queda un dipolo neto apuntando hacia el lado de los ' +
                      'cloros. Cambiar UN atomo de cuatro convierte una molecula apolar en polar, y por ' +
                      'eso el cloroformo disuelve cosas que el tetracloruro no.',
                  },
                  {
                    question:
                      'Una molecula tiene todos sus enlaces apolares. ¿Puede ser polar la molecula?',
                    answer:
                      'No. Si no hay dipolos de enlace no hay nada que sumar, y la suma de ceros es cero. ' +
                      'La implicacion solo funciona en esa direccion: enlaces apolares garantizan ' +
                      'molecula apolar, pero enlaces polares NO garantizan molecula polar. El CO₂ y el ' +
                      'CCl₄ son la prueba.',
                  },
                ],
                connects: [
                  { label: '3.3 Lo que la polaridad decide', topic: '3.3' },
                  { label: '3.2.2.4 La estructura de la que sale la geometria', topic: '3.2.2.4' },
                ],
              },
            ],
          },

          {
            id: '3.2.3',
            title: 'Enlace metalico',
            requires: ['3.2'],
            body:
              'Entre metales no hay a quien cederle electrones —todos quieren ceder— ni sentido en ' +
              'compartirlos de dos en dos. Lo que ocurre es otra cosa: los atomos sueltan sus electrones ' +
              'de valencia a un fondo comun y quedan como cationes ordenados en una red, banados por un ' +
              'MAR DE ELECTRONES que pertenece a todos y a ninguno.',
            figure: 'metalico',
            keyIdea:
              'Un electron deslocalizado no pertenece a ningun atomo: se mueve por todo el metal. De ahi ' +
              'salen de golpe todas las propiedades metalicas — conduce la electricidad y el calor, ' +
              'brilla, y se deforma sin romperse.',
            pitfall:
              'El «mar de electrones» es un MODELO sencillo y viejo, util para entender pero incapaz de ' +
              'explicar por que unos metales conducen mas que otros, o por que el silicio es ' +
              'semiconductor. Eso lo explica la teoria de bandas, que necesita la mecanica cuantica de ' +
              'la unidad 2 llevada mucho mas lejos.',
            analogy: {
              image:
                'Como canicas ordenadas en una bandeja, cubiertas de agua. Las canicas son los cationes ' +
                'y el agua los electrones: empuja la bandeja y el agua se mueve entera.',
              limit:
                'El agua es un liquido clasico con particulas localizables; los electrones deslocalizados ' +
                'no estan en ningun sitio concreto, y ademas su comportamiento —incluida la ' +
                'conductividad— depende de reglas cuanticas que el agua no obedece.',
            },
            demo: metallicDemo(),
            check: [
              {
                question:
                  'El cobre conduce la electricidad en solido y la sal solo fundida. Los dos tienen ' +
                  'cargas. ¿Que cambia?',
                answer:
                  'Quien puede moverse. En el cobre los que se mueven son los ELECTRONES del mar, y estan ' +
                  'libres desde el primer momento: el metal conduce tal cual, sin fundirlo. En la sal ' +
                  'solida las cargas son iones atrapados en su posicion de la red, y no hay electrones ' +
                  'libres: hay que fundirla o disolverla para que los iones puedan desplazarse, y ' +
                  'entonces conduce. En los dos casos la corriente es carga en movimiento; lo que cambia ' +
                  'es si hay algo que se pueda mover.',
              },
            ],
            connects: [{ label: '3.2.1.1 Compararlo con el ionico', topic: '3.2.1.1' }],
          },
        ],
      },

      {
        id: '3.3',
        title: 'Uniones intermoleculares',
        requires: ['3.2.2.5'],
        body:
          'Las fuerzas que mantienen unidas unas MOLECULAS con otras, que no es lo mismo que el enlace ' +
          'que mantiene unidos los atomos DENTRO de una molecula. Son mucho mas debiles, y aun asi son ' +
          'las que deciden el estado fisico de una sustancia: si a temperatura ambiente es gas, liquido ' +
          'o solido.',
        keyIdea:
          'Cuando el agua hierve NO se rompe ningun enlace O–H: las moleculas de H₂O se separan unas de ' +
          'otras y siguen siendo H₂O. Por eso el vapor de agua es agua y no una mezcla de hidrogeno y ' +
          'oxigeno.',
        pitfall:
          'La diferencia de energia es de un orden de magnitud: romper un enlace covalente O–H cuesta ' +
          'unos 460 kJ/mol; separar dos moleculas de agua unidas por un puente de hidrogeno, unos 20. ' +
          'Llamar «enlace» al puente de hidrogeno induce justamente a esa confusion.',
        check: [
          {
            question:
              'Al hervir agua salen burbujas. ¿Que hay dentro de esas burbujas: hidrogeno y oxigeno, o ' +
              'agua?',
            answer:
              'Agua. Vapor de agua, es decir, moleculas de H₂O sueltas unas de otras. Hervir separa las ' +
              'moleculas ENTRE SI —rompe fuerzas intermoleculares de unos 20 kJ/mol— pero no toca los ' +
              'enlaces O–H de dentro, que cuestan unos 460. Para obtener hidrogeno y oxigeno hace falta ' +
              'electrolizar el agua, que es un cambio QUIMICO; hervirla es un cambio fisico. Si hervir ' +
              'descompusiera el agua, una olla al fuego seria una bomba.',
          },
        ],
        connects: [{ label: '3.2.2.5 La polaridad que lo decide todo', topic: '3.2.2.5' }],
        children: [
          {
            id: '3.3.1',
            title: 'Tipos, propiedades fisicas y relacion con la estructura',
            requires: ['3.3'],
            body:
              'Hay tres tipos, y se pueden ordenar por intensidad: dispersion < dipolo-dipolo < puente de ' +
              'hidrogeno. Cual domina en una sustancia lo decide su estructura —si es polar, si tiene H ' +
              'unido a N, O o F, cuantos electrones tiene— y de ahi salen su punto de ebullicion, su ' +
              'viscosidad y en que se disuelve.',
            figure: 'intermoleculares',
            keyIdea:
              'La regla practica que resume el apartado: «lo semejante disuelve a lo semejante». Polar ' +
              'con polar, apolar con apolar. El aceite y el agua no se mezclan porque las moleculas de ' +
              'agua prefieren muchisimo estar entre ellas.',
            demo: imfDemo(),
            worked: {
              question:
                'El H₂O y el H₂S son casi gemelos: mismo grupo, misma forma, el azufre incluso pesa mas. ' +
                '¿Por que uno es liquido y el otro un gas maloliente?',
              steps: [
                {
                  text: 'Por masa molecular, el H₂S deberia hervir a MAYOR temperatura: pesa casi el doble.',
                  math: 'H₂O 18,02 g/mol · H₂S 34,08 g/mol',
                },
                {
                  text: 'Los dos son polares, asi que los dos tienen fuerzas dipolo-dipolo.',
                  math: 'H₂O |μ| = 1,52 · H₂S |μ| = 0,47 (unidades del motor)',
                },
                {
                  text: 'Pero solo el agua tiene H unido a un atomo de los tres que permiten puente de hidrogeno: N, O o F. El azufre no esta en esa lista.',
                  math: 'H–O ✓  ·  H–S ✗',
                },
                {
                  text: 'El puente de hidrogeno es mucho mas intenso que un dipolo-dipolo normal, y gana a la diferencia de masa.',
                  math: 'H₂O hierve a 100 °C · H₂S a −60 °C',
                },
              ],
              answer:
                '160 grados de diferencia, y no los explica la masa: los explica que el oxigeno es lo ' +
                'bastante pequeno y electronegativo para formar puentes de hidrogeno y el azufre no. Si ' +
                'el agua siguiera la tendencia de su grupo, herviria hacia −80 °C: no habria oceanos, ni ' +
                'lluvia, ni probablemente vida.',
            },
            check: [
              {
                question:
                  'Si las fuerzas intermoleculares son tan debiles comparadas con un enlace covalente, ' +
                  '¿por que se les da tanta importancia?',
                answer:
                  'Porque son las que deciden lo que observamos. La quimica de una sustancia la fijan sus ' +
                  'enlaces, pero su ESTADO —solido, liquido o gas—, su punto de ebullicion, su ' +
                  'viscosidad, su tension superficial y en que se disuelve los fijan las fuerzas entre ' +
                  'moleculas. El agua y el sulfuro de hidrogeno tienen enlaces casi iguales y uno moja y ' +
                  'el otro apesta en forma de gas. Debil no es lo mismo que irrelevante: son debiles una ' +
                  'a una y son billones.',
              },
            ],
            connects: [{ label: '3.2.2.5 La polaridad, que es el punto de partida', topic: '3.2.2.5' }],
            children: [
              {
                id: '3.3.1.1',
                title: 'Fuerzas dipolo-dipolo',
                requires: ['3.3.1'],
                body:
                  'Entre moleculas POLARES. El extremo δ+ de una se orienta hacia el δ− de la vecina, y ' +
                  'esa atraccion electrostatica las mantiene mas juntas de lo que estarian si no fueran ' +
                  'polares. Son mas intensas que la dispersion y mas debiles que un puente de hidrogeno.',
                keyIdea:
                  'Exigen que la molecula ENTERA sea polar, no que tenga enlaces polares. Por eso el CO₂, ' +
                  'con dos enlaces muy polares, no tiene fuerzas dipolo-dipolo: su momento dipolar neto ' +
                  'es cero y no hay ningun extremo δ+ ni δ− que orientar.',
                pitfall:
                  'Las moleculas no se quedan quietas y alineadas: giran sin parar por agitacion termica. ' +
                  'La atraccion dipolo-dipolo es un promedio estadistico — en promedio pasan mas tiempo ' +
                  'orientadas favorablemente que al reves, y ese pequeno sesgo basta.',
                check: [
                  {
                    question:
                      '¿Por que el CO₂ no tiene fuerzas dipolo-dipolo si sus enlaces C=O son muy polares?',
                    answer:
                      'Porque para atraerse por dipolo-dipolo hace falta que la MOLECULA tenga un extremo ' +
                      'positivo y otro negativo, y el CO₂ no lo tiene: es lineal y simetrico, sus dos ' +
                      'dipolos de enlace se cancelan y el momento neto es cero. Por fuera se comporta ' +
                      'como si fuera apolar, asi que solo le quedan las fuerzas de dispersion — y por eso ' +
                      'es un gas a temperatura ambiente pese a pesar 44 g/mol.',
                  },
                ],
                connects: [{ label: '3.3.1.2 El caso extremo', topic: '3.3.1.2' }],
              },
              {
                id: '3.3.1.2',
                title: 'Puentes de hidrogeno',
                requires: ['3.3.1.1'],
                body:
                  'El caso extremo del dipolo-dipolo, y merece nombre propio. Ocurre cuando un hidrogeno ' +
                  'esta unido a NITROGENO, OXIGENO o FLUOR: solo esos tres. Al ser tan electronegativos y ' +
                  'tan pequenos, dejan al hidrogeno casi como un proton desnudo, y ese H queda expuesto y ' +
                  'es atraido con fuerza por un par libre de la molecula vecina.',
                figure: 'puentes',
                keyIdea:
                  'Hacen falta las DOS cosas: un donador (un H unido a N, O o F) y un aceptor (un par ' +
                  'libre sobre N, O o F). El agua es excepcional porque cada molecula tiene dos ' +
                  'donadores y dos aceptores — puede formar cuatro puentes a la vez, y por eso su red es ' +
                  'tan resistente.',
                pitfall:
                  'No es un enlace, pese al nombre. Cuesta unos 20 kJ/mol frente a los 460 de un O–H. Y ' +
                  'la lista N, O, F no es arbitraria ni ampliable por analogia: el cloro es igual de ' +
                  'electronegativo que el nitrogeno y NO forma puentes de hidrogeno, porque es demasiado ' +
                  'grande y su carga queda repartida en un volumen mayor.',
                analogy: {
                  image:
                    'Como velcro: cada gancho agarra poco, pero hay tantos que la union entera resiste ' +
                    'mucho y se puede despegar y volver a pegar sin romperse.',
                  limit:
                    'Los ganchos del velcro son mecanicos y permanentes hasta que se tira. Los puentes de ' +
                    'hidrogeno se rompen y se rehacen billones de veces por segundo a temperatura ' +
                    'ambiente: el agua liquida es una red que se esta rehaciendo constantemente.',
                },
                worked: {
                  question:
                    '¿Por que el hielo FLOTA, si casi todos los solidos se hunden en su propio liquido?',
                  steps: [
                    {
                      text: 'Cada molecula de agua puede formar cuatro puentes: dos por sus H y dos por sus pares libres.',
                      math: '2 donadores + 2 aceptores = 4 puentes',
                    },
                    {
                      text: 'Al congelarse, las moleculas se colocan de forma que TODOS esos puentes queden formados a la vez.',
                      math: 'red hexagonal, angulos de 109°',
                    },
                    {
                      text: 'Esa disposicion deja HUECOS en el centro de cada hexagono: es una estructura abierta.',
                      math: 'hielo 0,917 g/cm³',
                    },
                    {
                      text: 'En el agua liquida los puentes se rompen y rehacen, las moleculas se apinan mejor y caben mas en el mismo volumen.',
                      math: 'agua 0,997 g/cm³ — mas densa que el hielo',
                    },
                  ],
                  answer:
                    'El hielo es MENOS denso que el agua porque sus puentes de hidrogeno lo obligan a ' +
                    'ordenarse con huecos. Por eso los lagos se congelan por arriba y no por abajo, y ' +
                    'por eso los peces sobreviven al invierno bajo una capa de hielo que los aisla. Una ' +
                    'geometria de 104,5° explica esto.',
                },
                check: [
                  {
                    question:
                      'El cloro es tan electronegativo como el nitrogeno (3,16 frente a 3,04). ¿Por que ' +
                      'el HCl no forma puentes de hidrogeno y el NH₃ si?',
                    answer:
                      'Porque hace falta electronegatividad Y tamano pequeno, y el cloro solo cumple lo ' +
                      'primero. En el N–H la carga negativa se concentra en un atomo pequeno, el H queda ' +
                      'muy desnudo y el par libre del nitrogeno vecino esta compacto y accesible. El ' +
                      'cloro es bastante mayor: su carga se reparte en mas volumen, la densidad de carga ' +
                      'baja y la atraccion resultante es la de un dipolo-dipolo corriente. Por eso la ' +
                      'lista es N, O y F y no admite ampliaciones por parecido.',
                  },
                ],
                connects: [
                  { label: '3.2.2.3 Se parece a un enlace coordinado', topic: '3.2.2.3' },
                  { label: '3.2.2.5 De donde sale el dipolo del agua', topic: '3.2.2.5' },
                ],
              },
              {
                id: '3.3.1.3',
                title: 'Fuerzas de dispersion',
                requires: ['3.3.1.1'],
                body:
                  'Las mas debiles, las mas universales y las unicas que tienen TODAS las sustancias, ' +
                  'sean polares o no. Los electrones de una molecula se mueven, y en un instante dado ' +
                  'pueden estar mas a un lado que a otro: aparece un dipolo INSTANTANEO, que induce otro ' +
                  'en la molecula vecina, y los dos se atraen. Duran un instante y se rehacen sin parar.',
                figure: 'dispersion',
                keyIdea:
                  'Su intensidad la gobierna el NUMERO DE ELECTRONES: cuantos mas hay, mas facil es que ' +
                  'la nube se deforme. Por eso los halogenos pasan de gas (F₂, Cl₂) a liquido (Br₂) y a ' +
                  'solido (I₂) segun se baja por el grupo, sin que cambie nada mas.',
                pitfall:
                  'Llamarlas «despreciables» es un error. Son las unicas fuerzas que tiene un alcano, y ' +
                  'sin embargo la parafina es solida: con moleculas suficientemente grandes, la suma de ' +
                  'muchisimas fuerzas debiles supera a unos pocos puentes de hidrogeno.',
                analogy: {
                  image:
                    'Como el roce de dos manos: cada punto de contacto agarra poquisimo, pero con ' +
                    'suficiente superficie se puede levantar un peso.',
                  limit:
                    'El rozamiento necesita contacto y es un efecto de superficies rugosas. Aqui no hay ' +
                    'contacto ni rugosidad: es atraccion electrica entre desequilibrios de carga que ' +
                    'aparecen y desaparecen por el propio movimiento de los electrones.',
                },
                check: [
                  {
                    question:
                      'Si las fuerzas de dispersion son las mas debiles, ¿como puede el yodo ser solido ' +
                      'a temperatura ambiente teniendo solo esas?',
                    answer:
                      'Porque «debil» se refiere a cada interaccion, no al total. El I₂ tiene 106 ' +
                      'electrones frente a los 18 del F₂: su nube es enorme y se deforma con facilidad, ' +
                      'asi que los dipolos instantaneos que aparecen son mucho mayores. Multiplicado por ' +
                      'la cantidad de puntos donde dos moleculas se aproximan, el resultado basta para ' +
                      'mantenerlas en una red solida. La dispersion es debil por unidad y muy poderosa ' +
                      'acumulada — igual que el agua de un rio no empuja, y sin embargo mueve piedras.',
                  },
                ],
                connects: [{ label: '3.3.1 El orden de las tres fuerzas', topic: '3.3.1' }],
              },
            ],
          },
        ],
      },
    ],
  };
}
