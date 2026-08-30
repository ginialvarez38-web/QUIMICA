/**
 * CHEMICAL ANALYSIS ENGINE — pruebas.
 *
 * Los casos no estan elegidos por comodidad: son los que un profesor pondria
 * en un examen precisamente porque distinguen a quien entiende el modelo de
 * quien lo aplica de memoria. CO con su carga formal invertida, BF3 sin
 * octeto, SF6 con el octeto expandido, Fe2+ perdiendo los 4s antes que los 3d.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { configureAtom, lewisValenceElectrons, ionise, quantumNumbers } from '../src/analysis/electronic.js';
import { deriveLewis, lewisLine, validateLewis, formalChargeWorkings } from '../src/analysis/lewis.js';
import { FindingGraph } from '../src/analysis/findings.js';
import { analyzeResonance } from '../src/analysis/resonance.js';
import { analyzeGeometry } from '../src/analysis/hybridization.js';
import { analyzePolarity } from '../src/analysis/polarity.js';
import { analyzeIntermolecularForces, compareBoilingPoint } from '../src/analysis/imf.js';
import { analyzeSpecies } from '../src/analysis/analyze.js';
import { getElement } from '../src/data/elements.js';

// ---------------------------------------------------------------------------

describe('configuracion electronica', () => {
  test('el orden de llenado sigue a Madelung', () => {
    const o = configureAtom('O');
    assert.equal(o?.condensed, '[He] 2s² 2p⁴');
    assert.equal(o?.valenceElectrons, 6);
    assert.equal(o?.unpairedElectrons, 2);
  });

  test('el hierro neutro tiene 8 electrones de valencia y 4 desapareados', () => {
    const fe = configureAtom('Fe');
    assert.equal(fe?.condensed, '[Ar] 3d⁶ 4s²');
    assert.equal(fe?.valenceElectrons, 8);
    assert.equal(fe?.unpairedElectrons, 4);
  });

  test('un cation pierde primero los electrones s de mayor n, no los ultimos que entraron', () => {
    // Es el error clasico: Madelung dice que el 4s se llena antes que el 3d,
    // de donde se deduce (mal) que el 3d se vacia antes. Fe2+ es [Ar]3d6.
    const fe2 = configureAtom('Fe', 2);
    assert.equal(fe2?.condensed, '[Ar] 3d⁶');
    assert.equal(fe2?.valenceElectrons, 6);

    const fe3 = configureAtom('Fe', 3);
    assert.equal(fe3?.condensed, '[Ar] 3d⁵');
    assert.equal(fe3?.unpairedElectrons, 5, 'd5 de alto espin: los cinco desapareados');
  });

  test('las anomalias de cromo y cobre estan recogidas', () => {
    assert.equal(configureAtom('Cr')?.condensed, '[Ar] 3d⁵ 4s¹');
    assert.equal(configureAtom('Cu')?.condensed, '[Ar] 3d¹⁰ 4s¹');
  });

  test('un ion isoelectronico con un gas noble se abrevia con ese gas noble', () => {
    // La abreviatura importa: "[Ne]" dice de un vistazo POR QUE se forma el
    // ion, y "[He] 2s² 2p⁶" obliga a reconocerlo mentalmente.
    assert.equal(configureAtom('Cl', -1)?.condensed, '[Ar]');
    assert.equal(configureAtom('O', -2)?.condensed, '[Ne]');
    assert.equal(configureAtom('Mg', 2)?.condensed, '[Ne]');
    assert.equal(configureAtom('Li', 1)?.condensed, '[He]');
    assert.equal(configureAtom('Ne')?.condensed, '[He] 2s² 2p⁶', 'el propio gas noble no se abrevia consigo mismo');
  });

  test('un ion con capa completa tiene su octeto, no cero electrones de valencia', () => {
    assert.equal(configureAtom('Cl', -1)?.valenceElectrons, 8);
    assert.equal(configureAtom('Na', 1)?.valenceElectrons, 8);
    assert.equal(configureAtom('Li', 1)?.valenceElectrons, 2, 'dueto: la capa externa del helio');
  });

  test('los numeros cuanticos describen el orbital y el espin', () => {
    const nitrogen = configureAtom('N')!;
    const p = nitrogen.subshells.find((s) => s.subshell === 'p')!;
    const q = quantumNumbers(p.orbitals[0]!, 0);
    assert.equal(q.n, 2);
    assert.equal(q.l, 1, 'el ultimo electron del nitrogeno esta en un orbital p');
    assert.equal(q.ms, '+1/2');
  });

  test('los tres electrones p del nitrogeno estan desapareados (Hund)', () => {
    const p = configureAtom('N')!.subshells.find((s) => s.subshell === 'p')!;
    assert.deepEqual(p.orbitals.map((o) => o.electrons), [1, 1, 1]);
  });

  test('la ionizacion explica el paso y reconoce el gas noble', () => {
    const step = ionise('Mg', 1, 2);
    assert.ok(step);
    assert.equal(step.after.condensed, '[Ne]');
    assert.equal(step.reachesNobleGas, true);
    assert.ok(step.explanation.length > 0);
  });

  test('los electrones de valencia de Lewis son los del grupo principal', () => {
    assert.equal(lewisValenceElectrons(getElement('C')!), 4);
    assert.equal(lewisValenceElectrons(getElement('O')!), 6);
    assert.equal(lewisValenceElectrons(getElement('Cl')!), 7);
    assert.equal(lewisValenceElectrons(getElement('H')!), 1);
  });
});

// ---------------------------------------------------------------------------

describe('estructura de Lewis', () => {
  /** Atajo: describe la estructura como cadena para comparar de un vistazo. */
  const line = (formula: string): string => {
    const result = deriveLewis(formula);
    assert.ok(result, `no se pudo derivar la estructura de ${formula}`);
    return lewisLine(result.best);
  };

  const structure = (formula: string) => {
    const result = deriveLewis(formula);
    assert.ok(result, `no se pudo derivar la estructura de ${formula}`);
    return result;
  };

  test('moleculas sencillas', () => {
    assert.equal(line('H2O'), 'H—O—H');
    assert.equal(line('CO2'), 'O=C=O');
    assert.equal(line('N2'), 'N≡N');
    assert.equal(line('HCN'), 'H—C≡N');
    assert.equal(line('CH4'), 'C(—H)(—H)(—H)(—H)');
  });

  test('el oxigeno molecular sale con doble enlace', () => {
    // ADVERTENCIA DECLARADA: Lewis predice O2 diamagnetico, y no lo es. Es el
    // fallo mas conocido del modelo, y hace falta la teoria de orbitales
    // moleculares para explicarlo. La prueba fija lo que el modelo dice, no
    // lo que ocurre en el laboratorio.
    const o2 = structure('O2');
    assert.equal(o2.best.bonds[0]?.order, 2);
    assert.equal(o2.best.atoms[0]?.lonePairs, 2);
  });

  test('el monoxido de carbono lleva carga formal, y sobre el carbono', () => {
    const co = structure('CO');
    assert.equal(co.best.bonds[0]?.order, 3);
    assert.equal(co.best.atoms[0]?.formalCharge, -1, 'C⁻');
    assert.equal(co.best.atoms[1]?.formalCharge, +1, 'O⁺');
    assert.equal(lewisLine(co.best), 'C⁻≡O⁺');
  });

  test('el ozono es asimetrico: un enlace simple y uno doble', () => {
    const o3 = structure('O3');
    const orders = o3.best.bonds.map((b) => b.order).sort();
    assert.deepEqual(orders, [1, 2]);
    assert.equal(o3.best.formalChargeSpread, 2);
  });

  test('el trifluoruro de boro se queda sin octeto, y el motor lo dice', () => {
    const bf3 = structure('BF3');
    const boron = bf3.best.atoms.find((a) => a.symbol === 'B');
    assert.equal(boron?.electronCount, 6);
    assert.equal(boron?.octetStatus, 'deficient');
    assert.equal(bf3.best.formalChargeSpread, 0, 'sin cargas formales, que es por lo que se prefiere');
    assert.ok(bf3.best.notes.some((n) => n.includes('EXCEPCION')));
  });

  test('el hexafluoruro de azufre expande el octeto porque puede', () => {
    const sf6 = structure('SF6');
    const sulfur = sf6.best.atoms.find((a) => a.symbol === 'S');
    assert.equal(sulfur?.electronCount, 12);
    assert.equal(sulfur?.octetStatus, 'expanded');
    assert.ok(sf6.best.notes.some((n) => n.includes('periodo 3')));
  });

  test('el tetrafluoruro de xenon conserva dos pares libres sobre el xenon', () => {
    // Son esos dos pares los que luego doblan la geometria a plano-cuadrada.
    const xef4 = structure('XeF4');
    assert.equal(xef4.best.atoms.find((a) => a.symbol === 'Xe')?.lonePairs, 2);
  });

  test('en los iones la suma de cargas formales es la carga de la especie', () => {
    for (const formula of ['NO3-', 'SO4-2', 'CO3-2', 'PO4-3', 'NH4+', 'ClO4-', 'OH-', 'CN-']) {
      const result = structure(formula);
      const sum = result.best.atoms.reduce((total, a) => total + a.formalCharge, 0);
      assert.equal(sum, result.best.charge, `${formula}: las cargas formales no suman la carga`);
    }
  });

  test('el nitrato reparte la carga sobre dos oxigenos y deja un doble enlace', () => {
    const no3 = structure('NO3-');
    const orders = no3.best.bonds.map((b) => b.order).sort();
    assert.deepEqual(orders, [1, 1, 2]);
    const negative = no3.best.atoms.filter((a) => a.formalCharge === -1);
    assert.equal(negative.length, 2);
    assert.ok(negative.every((a) => a.symbol === 'O'));
  });

  test('el amonio deja al nitrogeno sin pares libres y con carga +1', () => {
    const nh4 = structure('NH4+');
    const nitrogen = nh4.best.atoms.find((a) => a.symbol === 'N');
    assert.equal(nitrogen?.lonePairs, 0);
    assert.equal(nitrogen?.formalCharge, 1);
    assert.equal(nitrogen?.electronCount, 8, 'sigue cumpliendo el octeto');
  });

  test('el amoniaco conserva el par libre que luego explica su geometria', () => {
    assert.equal(structure('NH3').best.atoms.find((a) => a.symbol === 'N')?.lonePairs, 1);
  });

  test('el recuento de electrones de valencia corrige por la carga', () => {
    assert.equal(structure('NH4+').best.totalValenceElectrons, 8, '5 + 4×1 − 1');
    assert.equal(structure('SO4-2').best.totalValenceElectrons, 32, '6 + 4×6 + 2');
  });

  test('el desarrollo de la carga formal es legible y coincide con el valor', () => {
    const no3 = structure('NO3-');
    const nitrogen = no3.best.atoms.find((a) => a.symbol === 'N')!;
    const workings = formalChargeWorkings(nitrogen);
    assert.equal(workings.result, nitrogen.formalCharge);
    assert.ok(workings.substituted.includes(`${nitrogen.valenceElectrons}`));
  });

  test('la estructura derivada se valida a si misma', () => {
    for (const formula of ['H2O', 'CO2', 'NH3', 'NO3-', 'SF6', 'BF3']) {
      const result = structure(formula);
      const check = validateLewis(result.best, result.best.charge);
      assert.ok(check.valid, `${formula}: ${check.problems.map((p) => p.issue).join('; ')}`);
    }
  });

  test('la validacion senala donde esta el fallo, no solo que lo hay', () => {
    const co2 = structure('CO2');
    // Se rompe a proposito: se le quita un par libre a un oxigeno.
    const broken = {
      ...co2.best,
      atoms: co2.best.atoms.map((a, i) =>
        i === 1 ? { ...a, lonePairs: 1, electronCount: 6, formalCharge: 1, octetStatus: 'deficient' as const } : a,
      ),
    };
    const check = validateLewis(broken, 0);
    assert.equal(check.valid, false);
    assert.ok(check.problems.some((p) => p.where === co2.best.atoms[1]!.id));
    assert.ok(check.problems.every((p) => p.fix.length > 0), 'todo problema trae una indicacion de arreglo');
  });

  test('cada atomo conserva una identidad estable (§55)', () => {
    const ids = structure('SO4-2').best.atoms.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, 'los identificadores no se repiten');
  });
});

// ---------------------------------------------------------------------------

describe('grafo de hallazgos', () => {
  const build = (): FindingGraph =>
    new FindingGraph()
      .add({
        id: 'lewis.structure', section: 'lewis', label: 'Estructura', value: 'O=C=O',
        because: 'Reparto de 16 electrones de valencia.', confidence: 'theoretical',
        dependsOn: [], level: 2,
      })
      .add({
        id: 'geometry.shape', section: 'geometria', label: 'Geometria', value: 'Lineal',
        because: 'Dos regiones de densidad electronica sobre el carbono.', confidence: 'theoretical',
        dependsOn: ['lewis.structure'], level: 2,
      })
      .add({
        id: 'polarity.molecular', section: 'polaridad', label: 'Polaridad', value: 'Apolar',
        because: 'Los dos dipolos C=O son opuestos y se cancelan.', confidence: 'calculated',
        dependsOn: ['geometry.shape', 'lewis.structure'], level: 3,
      });

  test('«por que» da un nivel hacia abajo', () => {
    const ids = build().why('polarity.molecular').map((f) => f.id);
    assert.deepEqual(ids, ['geometry.shape', 'lewis.structure']);
  });

  test('la explicacion desciende hasta los cimientos sin repetir ramas', () => {
    const chain = build().explain('polarity.molecular');
    assert.deepEqual(chain.map((c) => c.finding.id), [
      'polarity.molecular',
      'geometry.shape',
      'lewis.structure',
    ]);
    assert.equal(chain[0]?.depth, 0);
    assert.equal(chain[2]?.depth, 1, 'lewis se alcanza por el camino mas corto');
  });

  test('el grafo sabe quien usa cada resultado', () => {
    assert.deepEqual(
      build().usedBy('lewis.structure').map((f) => f.id),
      ['geometry.shape', 'polarity.molecular'],
    );
  });

  test('una dependencia inexistente se registra como problema', () => {
    const graph = new FindingGraph().add({
      id: 'a', section: 'x', label: 'A', value: 'v', because: 'b',
      confidence: 'calculated', dependsOn: ['no-existe'], level: 1,
    });
    assert.equal(graph.problems().length, 1);
    assert.ok(graph.problems()[0]?.includes('no-existe'));
  });

  test('los niveles de profundidad filtran (§48)', () => {
    assert.equal(build().upToLevel(2).length, 2);
  });

  test('el reparto por confianza cuenta todos los hallazgos', () => {
    const breakdown = build().confidenceBreakdown();
    assert.equal(breakdown.theoretical, 2);
    assert.equal(breakdown.calculated, 1);
  });
});

// ---------------------------------------------------------------------------

describe('resonancia', () => {
  const resonanceOf = (formula: string) => {
    const lewis = deriveLewis(formula);
    assert.ok(lewis, `no se pudo derivar ${formula}`);
    return analyzeResonance(lewis);
  };

  test('el orden de enlace del hibrido sale del promedio, no de una tabla', () => {
    // Son los valores de los libros. Aqui estan CALCULADOS: si el motor de
    // Lewis cambiara, estos numeros cambiarian con el, y por eso valen como
    // prueba de que la deduccion es correcta.
    const expected: [string, number, number][] = [
      // formula, numero de estructuras, orden de enlace promedio
      ['NO3-', 3, 4 / 3],
      ['CO3-2', 3, 4 / 3],
      ['NO2-', 2, 1.5],
      ['O3', 2, 1.5],
      ['SO4-2', 6, 1.5],
      ['PO4-3', 4, 1.25],
      ['ClO4-', 4, 1.75],
    ];
    for (const [formula, count, order] of expected) {
      const r = resonanceOf(formula);
      assert.equal(r.hasResonance, true, `${formula} deberia tener resonancia`);
      assert.equal(r.count, count, `${formula}: numero de estructuras`);
      const delocalized = r.bonds.filter((b) => b.delocalized);
      for (const bond of delocalized) {
        assert.ok(
          Math.abs(bond.averageOrder - order) < 1e-9,
          `${formula} ${bond.label}: orden ${bond.averageOrder}, esperado ${order}`,
        );
      }
    }
  });

  test('todos los enlaces equivalentes salen con el MISMO orden', () => {
    // Es la razon de ser de la resonancia: los tres N–O del nitrato miden lo
    // mismo, y una sola estructura de Lewis no lo explicaria.
    const orders = new Set(resonanceOf('NO3-').bonds.map((b) => b.averageOrder));
    assert.equal(orders.size, 1);
  });

  test('sin estructuras equivalentes no hay resonancia', () => {
    for (const formula of ['CO2', 'H2O', 'CH4', 'BF3', 'N2', 'NH3']) {
      assert.equal(resonanceOf(formula).hasResonance, false, `${formula} no deberia tener resonancia`);
    }
  });

  test('la carga se reparte solo entre los atomos cuya carga formal cambia', () => {
    // El nitrogeno del nitrato lleva +1 en las TRES estructuras: esa carga no
    // esta deslocalizada, esta fija. Los oxigenos alternan y esos si comparten.
    const shared = resonanceOf('NO3-').chargeSharedBy;
    assert.deepEqual([...shared], ['O2', 'O3', 'O4']);
  });

  test('la advertencia del §59 acompana siempre al resultado', () => {
    const r = resonanceOf('NO3-');
    assert.ok(r.caution.includes('NO salta'));
    assert.ok(r.caution.includes('NOTACION'));
  });

  test('no se inventa una energia de resonancia', () => {
    assert.ok(resonanceOf('CO3-2').stabilization.includes('no estima'));
  });
});

// ---------------------------------------------------------------------------

describe('geometria e hibridacion', () => {
  const geom = (formula: string) => {
    const lewis = deriveLewis(formula);
    assert.ok(lewis, `no se pudo derivar ${formula}`);
    return analyzeGeometry(lewis.best);
  };

  test('numero esterico, hibridacion y geometria de los casos de manual', () => {
    const cases: [string, number, string, string][] = [
      // formula, numero esterico, hibridacion, geometria molecular
      ['CH4', 4, 'sp³', 'tetraedrica'],
      ['NH3', 4, 'sp³', 'piramidal trigonal'],
      ['H2O', 4, 'sp³', 'angular'],
      ['CO2', 2, 'sp', 'lineal'],
      ['BF3', 3, 'sp²', 'trigonal plana'],
      ['SO2', 3, 'sp²', 'angular'],
      ['PCl5', 5, 'sp³d', 'bipiramidal trigonal'],
      ['SF6', 6, 'sp³d²', 'octaedrica'],
      ['SF4', 5, 'sp³d', 'balancin'],
      ['ClF3', 5, 'sp³d', 'forma de T'],
      ['XeF4', 6, 'sp³d²', 'cuadrada plana'],
      ['BrF5', 6, 'sp³d²', 'piramidal cuadrada'],
      ['I3^-', 5, 'sp³d', 'lineal'],
    ];
    for (const [formula, steric, hybrid, shape] of cases) {
      const central = geom(formula).central;
      assert.ok(central, `${formula}: no se identifico atomo central`);
      assert.equal(central.stericNumber, steric, `${formula}: numero esterico`);
      assert.equal(central.hybridization, hybrid, `${formula}: hibridacion`);
      assert.equal(central.vsepr?.geometry, shape, `${formula}: geometria molecular`);
    }
  });

  test('un enlace multiple cuenta como UNA region', () => {
    // Es lo que hace lineal al CO2 pese a tener cuatro pares enlazantes.
    const co2 = geom('CO2').central;
    assert.equal(co2?.stericNumber, 2);
    assert.equal(co2?.vsepr?.idealAngle, 180);
  });

  test('el recuento sigma/pi coincide con los ordenes de enlace', () => {
    const n2 = geom('N2');
    assert.equal(n2.sigmaBonds, 1);
    assert.equal(n2.piBonds, 2, 'el triple enlace es un sigma y dos pi');

    const co2 = geom('CO2');
    assert.equal(co2.sigmaBonds, 2);
    assert.equal(co2.piBonds, 2);
  });

  test('los orbitales p sin hibridar cuadran con los enlaces pi que hacen falta', () => {
    assert.equal(geom('CO2').central?.unhybridizedP, 2, 'sp deja dos p para los dos pi');
    assert.equal(geom('SO2').central?.unhybridizedP, 1, 'sp² deja un p');
    assert.equal(geom('CH4').central?.unhybridizedP, 0, 'sp³ no deja ninguno');
  });

  test('con dos atomos la geometria no depende de nada', () => {
    assert.match(geom('N2').shape, /^Lineal por definicion/);
    assert.match(geom('HF').shape, /^Lineal por definicion/);
  });

  test('se declara que la hibridacion es un modelo, no un suceso', () => {
    const caution = geom('CH4').caution;
    assert.ok(caution.includes('MODELO'));
    assert.ok(caution.includes('no describe un proceso fisico'));
  });
});

// ---------------------------------------------------------------------------

describe('polaridad', () => {
  const pol = (formula: string) => {
    const lewis = deriveLewis(formula);
    assert.ok(lewis, `no se pudo derivar ${formula}`);
    return analyzePolarity(lewis.best, analyzeGeometry(lewis.best));
  };

  test('moleculas con enlaces polares que son APOLARES por simetria', () => {
    // Es la pregunta que mas se falla, y la respuesta sale de una suma
    // vectorial, no de una lista de moleculas simetricas.
    for (const formula of ['CO2', 'CCl4', 'BF3', 'SO3', 'PCl5', 'SF6', 'XeF4', 'XeF2', 'BeCl2']) {
      const p = pol(formula);
      assert.equal(p.isPolar, false, `${formula} deberia salir apolar`);
      assert.equal(p.symmetric, true, `${formula}: tiene enlaces polares que se cancelan`);
      assert.ok(p.bonds.some((b) => b.kind !== 'apolar'), `${formula}: los enlaces si son polares`);
    }
  });

  test('moleculas polares', () => {
    for (const formula of ['H2O', 'NH3', 'SO2', 'CHCl3', 'HCl', 'HF', 'SF4', 'BrF5', 'H2S']) {
      assert.equal(pol(formula).isPolar, true, `${formula} deberia salir polar`);
    }
  });

  test('la fosfina es polar aunque sus enlaces no lo sean', () => {
    // P y H tienen casi la misma electronegatividad: los dipolos de enlace son
    // nulos. Lo que hace polar al PH3 es el par libre, y el motor lo dice.
    const ph3 = pol('PH3');
    assert.equal(ph3.isPolar, true);
    assert.equal(ph3.decidedByLonePairs, true);
    assert.ok(ph3.bonds.every((b) => b.kind === 'apolar'));
    assert.ok(ph3.reason.includes('par'));
  });

  test('la regla del Δχ > 1,7 no se aplica a ciegas', () => {
    // HF (Δχ = 1,78) y B–F (1,94) la superan y son covalentes: no hay ningun
    // metal que pueda ceder el electron.
    assert.equal(pol('HF').bonds[0]?.kind, 'polar');
    assert.equal(pol('BF3').bonds[0]?.kind, 'polar');
    // Con un metal de por medio si es ionico.
    assert.equal(pol('NaCl').bonds[0]?.kind, 'ionico');
    assert.equal(pol('LiF').bonds[0]?.kind, 'ionico');
  });

  test('un enlace entre atomos iguales es perfectamente apolar', () => {
    for (const formula of ['O2', 'N2', 'Cl2', 'H2']) {
      const p = pol(formula);
      assert.equal(p.isPolar, false);
      assert.equal(p.bonds[0]?.deltaEN, 0);
    }
  });

  test('no se da un momento dipolar en debyes que el motor no puede calcular', () => {
    assert.ok(pol('H2O').caution.includes('NO en'));
    assert.ok(pol('H2O').caution.includes('debyes'));
  });
});

// ---------------------------------------------------------------------------

describe('fuerzas intermoleculares', () => {
  const forces = (formula: string) => {
    const lewis = deriveLewis(formula);
    assert.ok(lewis, `no se pudo derivar ${formula}`);
    const geometry = analyzeGeometry(lewis.best);
    const polarity = analyzePolarity(lewis.best, geometry);
    return { imf: analyzeIntermolecularForces(lewis.best, polarity), polar: polarity.isPolar, name: formula };
  };

  test('el puente de hidrogeno exige H unido a N, O o F', () => {
    for (const formula of ['H2O', 'NH3', 'HF']) {
      assert.equal(forces(formula).imf.dominant?.kind, 'puente-hidrogeno', formula);
    }
    // El CH4 tiene cuatro hidrogenos y no forma ni uno.
    assert.equal(forces('CH4').imf.hydrogenBondDonors, 0);
    // El H2S tiene hidrogenos pero el azufre no sirve: es demasiado grande.
    assert.equal(forces('H2S').imf.hydrogenBondDonors, 0);
    assert.equal(forces('H2S').imf.dominant?.kind, 'dipolo-dipolo');
  });

  test('las fuerzas de dispersion estan siempre', () => {
    for (const formula of ['H2O', 'CH4', 'N2', 'CO2']) {
      const dispersion = forces(formula).imf.forces.find((f) => f.kind === 'dispersion');
      assert.equal(dispersion?.present, true, formula);
    }
  });

  test('el orden de puntos de ebullicion se predice sin conocer las cifras', () => {
    const higher = (a: string, b: string): string | undefined =>
      compareBoilingPoint(forces(a), forces(b))?.higher;

    // La anomalia del agua: mas ligera que el H2S y hierve 160 °C mas alto.
    assert.equal(higher('H2O', 'H2S'), 'H2O');
    assert.equal(higher('NH3', 'PH3'), 'NH3');
    // Entre apolares de la misma familia decide el numero de electrones.
    assert.equal(higher('I2', 'F2'), 'I2');
    assert.equal(higher('Br2', 'Cl2'), 'Br2');
  });

  test('se declara que las fuerzas intermoleculares NO son enlaces', () => {
    const caution = forces('H2O').imf.caution;
    assert.ok(caution.includes('NO son enlaces'));
    assert.ok(caution.includes('no se rompe ningun enlace'));
  });
});

// ---------------------------------------------------------------------------

describe('perfil completo', () => {
  test('el analisis conecta la formula con una propiedad observable', () => {
    // Es el §66 en una prueba: se parte de "el agua hierve muy alto" y se
    // desciende, paso a paso, hasta la formula. Cada eslabon es un calculo.
    const profile = analyzeSpecies('H2O');
    assert.ok(profile);

    const boiling = profile.graph.section('propiedades')[0];
    assert.ok(boiling, 'deberia haber una prediccion de punto de ebullicion');

    const chain = profile.graph.explain(boiling.id).map((c) => c.finding.id);
    for (const link of [
      'imf.dominant',
      'imf.forces',
      'polarity.molecular',
      'geometry.molecular',
      'lewis.structure',
      'lewis.valenceCount',
      'electrons.valence.O',
      'electrons.config.O',
      'atom.O',
      'composition.atoms',
      'identity.formula',
    ]) {
      assert.ok(chain.includes(link), `la cadena de razonamiento deberia pasar por ${link}`);
    }
  });

  test('ningun hallazgo depende de otro que no exista', () => {
    // Una dependencia rota convertiria el boton «¿por que?» en un callejon
    // sin salida, y es el tipo de fallo que solo se ve cuando alguien lo pulsa.
    for (const formula of ['H2O', 'CO2', 'NH3', 'NO3-', 'SO4-2', 'CH4', 'BF3', 'NaCl', 'SF6', 'O3']) {
      const profile = analyzeSpecies(formula);
      assert.ok(profile, formula);
      assert.deepEqual(profile.graph.problems(), [], `${formula}: dependencias rotas`);
    }
  });

  test('un compuesto ionico no se analiza como si fuera una molecula', () => {
    const profile = analyzeSpecies('NaCl');
    assert.ok(profile);
    assert.equal(profile.lewis, null);
    assert.equal(profile.geometry, null);
    const note = profile.graph.get('lewis.notApplicable');
    assert.ok(note, 'deberia declararse que no aplica');
    assert.ok(note.because.includes('No existe "una molecula"'));
    assert.ok(profile.limitations.some((l) => l.includes('ionico')));
  });

  test('un radical se declara fuera del modelo en lugar de forzarlo', () => {
    for (const formula of ['NO', 'NO2']) {
      const profile = analyzeSpecies(formula);
      assert.ok(profile, formula);
      assert.equal(profile.lewis, null);
      const note = profile.graph.get('lewis.unavailable');
      assert.ok(note, `${formula}: deberia explicarse por que no se puede`);
      assert.equal(note.confidence, 'unknown');
      assert.ok(note.because.includes('radical'), `${formula}: deberia decir que es un radical`);
    }
  });

  test('la hibridacion se etiqueta como modelo educativo, no como calculo', () => {
    // §59: no presentar un modelo didactico como si fuera la realidad cuantica.
    const profile = analyzeSpecies('CH4');
    assert.equal(profile?.graph.get('hybridization.central')?.confidence, 'educational');
  });

  test('la formula se muestra con los subindices y la carga en superindice', () => {
    assert.equal(analyzeSpecies('SO4-2')?.pretty, 'SO₄²⁻');
    assert.equal(analyzeSpecies('Al2(SO4)3')?.pretty, 'Al₂(SO₄)₃');
    assert.equal(analyzeSpecies('NH4+')?.pretty, 'NH₄⁺');
  });
});

// ---------------------------------------------------------------------------

describe('limites del motor', () => {
  test('una formula grande no cuelga el motor', () => {
    // La busqueda de estructuras prueba 3^terminales combinaciones. Con la
    // glucosa (23 terminales) serian 9,4·10¹⁰ y el motor se quedaba colgado
    // en lugar de contestar. El limite se comprueba ANTES del bucle.
    const started = Date.now();
    for (const formula of ['C6H12O6', 'C8H18', 'CH3COOH', 'IF7']) {
      const profile = analyzeSpecies(formula);
      assert.ok(profile, formula);
      assert.equal(profile.lewis, null, `${formula} queda fuera del modelo central-terminal`);
      assert.ok(profile.graph.get('lewis.unavailable'), `${formula}: deberia explicarse`);
    }
    assert.ok(Date.now() - started < 2000, 'el analisis debe ser inmediato');
  });

  test('seis terminales siguen entrando', () => {
    for (const formula of ['SF6', 'XeF6']) {
      assert.ok(deriveLewis(formula), formula);
    }
  });
});

describe('clasificacion y nombre de las especies analizadas', () => {
  test('un ion no se clasifica ni se nombra como un compuesto neutro', () => {
    // El nitrato encajaba en la rama de los oxidos y salia como "oxido de
    // nitrogeno(VI)": las reglas de los oxidos suponen carga cero, y con un
    // anion esa suposicion es falsa.
    const no3 = analyzeSpecies('NO3-');
    assert.equal(no3?.graph.get('identity.class')?.value, 'Anion');
    assert.equal(no3?.graph.get('identity.name')?.value, 'nitrato');
    assert.equal(no3?.graph.get('redox.oxidationStates')?.value, 'N +5 · O -2');

    assert.equal(analyzeSpecies('SO4-2')?.graph.get('identity.name')?.value, 'sulfato');
    assert.equal(analyzeSpecies('NH4+')?.graph.get('identity.name')?.value, 'amonio');
  });

  test('el agua no es un hidracido', () => {
    // "H2O" encajaba en el patron "H seguido de un no metal" y salia como
    // acido binario. El agua es anfotera.
    const water = analyzeSpecies('H2O');
    assert.match(water?.graph.get('identity.class')?.value ?? '', /agua/);
    assert.match(water?.graph.get('identity.class')?.because ?? '', /ANFOTERA/);
    // Los hidracidos de verdad siguen siendolo.
    for (const acid of ['HCl', 'HF', 'H2S']) {
      assert.equal(analyzeSpecies(acid)?.graph.get('identity.class')?.value, 'Acido binario (hidracido)', acid);
    }
  });

  test('el agua oxigenada es molecular, no una red ionica', () => {
    // Marcarla como ionica la dejaba fuera de todo el analisis molecular.
    const profile = analyzeSpecies('H2O2');
    assert.ok(profile?.lewis, 'deberia analizarse como molecula');
  });

  test('el nombre de uso gana al derivado cuando existe', () => {
    // Las reglas dan "nitrato de hidrogeno", que es correcto, pero nadie lo
    // llama asi.
    assert.equal(analyzeSpecies('HNO3')?.graph.get('identity.name')?.value, 'acido nitrico');
    assert.equal(analyzeSpecies('H2SO4')?.graph.get('identity.name')?.value, 'acido sulfurico');
    assert.equal(analyzeSpecies('H2O')?.graph.get('identity.name')?.value, 'agua');
  });
});
