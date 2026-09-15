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

import { configureAtom, lewisValenceElectrons, ionise, quantumNumbers, orbitalName } from '../src/analysis/electronic.js';
import { deriveLewis, diagnoseLewis, lewisLine, validateLewis, formalChargeWorkings } from '../src/analysis/lewis.js';
import { FindingGraph } from '../src/analysis/findings.js';
import { analyzeResonance } from '../src/analysis/resonance.js';
import { analyzeGeometry } from '../src/analysis/hybridization.js';
import { analyzePolarity, classifyBond } from '../src/analysis/polarity.js';
import { analyzeIntermolecularForces, compareBoilingPoint } from '../src/analysis/imf.js';
import { analyzeSpecies } from '../src/analysis/analyze.js';
import { buildCombinationTable, comboKey } from '../src/engine/combinations.js';
import { filterTable, ionLabel } from '../src/ui/combos-view.js';
import { allSpecies } from '../src/data/species.js';
import { guide } from '../src/teach/guide.js';
import { predict } from '../src/engine/predict.js';
import {
  unitMateria, conservationDemo, definiteProportionsDemo, multipleProportionsDemo,
  gayLussacDemo, moleDemo, AVOGADRO, SEPARATION_METHODS,
} from '../src/teach/theory.js';
import {
  unitAtomo, abundanceDemo, compositionDemo, isobarsDemo, isotonesDemo, periodicStatsDemo, modelsDemo,
} from '../src/teach/atom.js';
import type { TheoryTopic } from '../src/teach/theory.js';
import { allSceneSets, sceneSet } from '../src/teach/scenes.js';
import { flattenTopics } from '../src/ui/theory-view.js';
import { cardsOf, deckOf, shuffle, progressOf } from '../src/teach/flashcards.js';
import { knowledgeTree, plannedBranches, neighbours } from '../src/teach/tree.js';
import { radial, psi, sampleOrbital, radiusContaining } from '../src/teach/orbitals.js';

/** Recorre un temario en profundidad. Lo usan varias pruebas. */
function walkTopics<D>(t: TheoryTopic<D>, out: TheoryTopic<D>[] = []): TheoryTopic<D>[] {
  out.push(t);
  for (const c of t.children ?? []) walkTopics(c, out);
  return out;
}
import { isotopesOf, isobarsOf, elementsWithIsotopes } from '../src/data/isotopes.js';
import { ELEMENTS } from '../src/data/elements.js';
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
    assert.equal(pol('HF').bonds[0]?.explanation.includes('contraejemplo clasico'), true);

    // La regla se comprueba directamente para las parejas con metal, porque
    // esos compuestos ya no tienen estructura de Lewis molecular: son redes
    // ionicas, y el motor lo declara antes de intentar construirlas.
    assert.equal(classifyBond(2.23, 'Na', 'Cl').kind, 'ionico');
    assert.equal(classifyBond(3.0, 'Li', 'F').kind, 'ionico');
    assert.equal(classifyBond(1.78, 'H', 'F').kind, 'polar');
    assert.equal(classifyBond(1.78, 'H', 'F').overridesThreshold, true);
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

  test('el agua oxigenada se clasifica como molecular, no como red ionica', () => {
    const profile = analyzeSpecies('H2O2');
    assert.ok(profile);
    assert.equal(profile.graph.get('lewis.notApplicable'), undefined,
      'no debe descartarse por ionica: no hay ningun metal');
    // Su estructura, en cambio, queda fuera de este modelo: H2O2 es H–O–O–H,
    // con un hidrogeno en CADA oxigeno, y el motor solo construye esqueletos
    // de un centro. Lo dice en vez de juntar los dos hidrogenos.
    assert.equal(profile.lewis, null);
    assert.match(profile.graph.get('lewis.unavailable')?.because ?? '', /H–O–O–H/);
  });

  test('el nombre de uso gana al derivado cuando existe', () => {
    // Las reglas dan "nitrato de hidrogeno", que es correcto, pero nadie lo
    // llama asi.
    assert.equal(analyzeSpecies('HNO3')?.graph.get('identity.name')?.value, 'acido nitrico');
    assert.equal(analyzeSpecies('H2SO4')?.graph.get('identity.name')?.value, 'acido sulfurico');
    assert.equal(analyzeSpecies('H2O')?.graph.get('identity.name')?.value, 'agua');
  });
});

// ---------------------------------------------------------------------------

describe('tabla de combinaciones', () => {
  const table = buildCombinationTable();
  const cation = (formula: string, charge: number) =>
    table.cations.find((i) => i.formula === formula && i.charge === charge)!;
  const anion = (formula: string) => table.anions.find((i) => i.formula === formula)!;
  const cell = (c: string, q: number, a: string) => table.cells.get(comboKey(cation(c, q), anion(a)))!;

  test('la cuadricula esta completa', () => {
    assert.equal(table.counts.total, table.cations.length * table.anions.length);
    for (const c of table.cations) {
      for (const a of table.anions) {
        assert.ok(table.cells.get(comboKey(c, a)), `falta la celda ${c.formula}+${a.formula}`);
      }
    }
  });

  test('lo verificado y lo derivado no se confunden', () => {
    // Es la distincion que justifica el modulo entero: presentar las 2500
    // combinaciones como compuestos existentes seria inventar quimica.
    assert.equal(cell('Na', 1, 'Cl').status, 'verified');
    assert.equal(cell('Ag', 1, 'Cl').status, 'verified');
    assert.equal(cell('NH4', 1, 'ClO4').status, 'derived');
    assert.ok(table.counts.verified > 0 && table.counts.derived > table.counts.verified);
  });

  test('una sustancia curada se reconoce aunque el constructor la escriba distinto', () => {
    // Del H⁺ con el OH⁻ sale la cadena "HOH", que es agua mal escrita.
    // Comparar cadenas la daria por desconocida; comparar composiciones no.
    const water = cell('H', 1, 'OH');
    assert.equal(water.status, 'verified');
    assert.equal(water.formula, 'H2O');
    assert.equal(water.name, 'agua');
  });

  test('el nombre de uso gana cuando la sustancia esta curada', () => {
    assert.equal(cell('H', 1, 'Cl').name, 'acido clorhidrico');
    assert.equal(cell('Na', 1, 'Cl').name, 'sal comun');
    // Y las derivadas se nombran con las reglas.
    assert.equal(cell('Al', 3, 'SO4').name, 'sulfato de aluminio');
  });

  test('un elemento no puede ser a la vez el cation y el anion', () => {
    const hydrogen = cell('H', 1, 'H');
    assert.equal(hydrogen.status, 'impossible');
    assert.equal(hydrogen.formula, null, 'no debe emitir la cadena "HH"');
    assert.match(hydrogen.reason ?? '', /MISMO elemento/);
  });

  test('el hidronio no se combina como un cation cualquiera', () => {
    // H3O⁺ es un proton hidratado: "H3OCl" no es una formula sin verificar,
    // es una formula mal escrita. Lo que se escribe es el acido.
    for (const a of ['Cl', 'SO4', 'NO3', 'O']) {
      const c = cell('H3O', 1, a);
      assert.equal(c.status, 'impossible', `H3O+ + ${a}`);
      assert.equal(c.formula, null);
      assert.match(c.reason ?? '', /HIDRATADO/);
    }
    // Pero el H⁺ si da el acido, que es como se escribe.
    assert.equal(cell('H', 1, 'Cl').formula, 'HCl');
  });

  test('la proporcion de iones y la comprobacion de cargas son correctas', () => {
    const alum = cell('Al', 3, 'SO4');
    assert.equal(alum.formula, 'Al2(SO4)3');
    assert.equal(alum.cationCount, 2);
    assert.equal(alum.anionCount, 3);
    assert.match(alum.neutralityCheck ?? '', /=\s*0/);

    const nacl = cell('Na', 1, 'Cl');
    assert.equal(nacl.cationCount, 1);
    assert.equal(nacl.anionCount, 1);
  });

  test('cada combinacion viable trae su derivacion completa', () => {
    for (const c of table.cells.values()) {
      if (c.status === 'impossible') continue;
      assert.ok(c.built, `${c.formula}: falta la derivacion`);
      assert.equal(c.built.derivation.length, 6, `${c.formula}: los seis pasos`);
    }
  });

  test('la solubilidad conocida llega a la celda', () => {
    assert.equal(cell('Ag', 1, 'Cl').solubility, 'insoluble');
    assert.equal(cell('Na', 1, 'Cl').solubility, 'soluble');
  });

  test('los filtros vacian filas y columnas enteras, no dejan huecos', () => {
    const verified = filterTable(table, { query: '', onlyVerified: true, onlyInsoluble: false });
    // Toda fila y toda columna que queden deben tener al menos un resultado.
    for (const c of verified.cations) {
      assert.ok(
        verified.anions.some((a) => table.cells.get(comboKey(c, a))?.status === 'verified'),
        `la fila ${c.formula} no tiene ninguna verificada`,
      );
    }
    assert.equal(verified.shown, table.counts.verified);
  });

  test('el filtro de texto busca en las dos listas a la vez', () => {
    const sulfate = filterTable(table, { query: 'sulfato', onlyVerified: false, onlyInsoluble: false });
    // "sulfato" no casa con ningun cation, asi que la lista de cationes se
    // deja entera: lo que se quiere ver es CON QUIEN se combina el sulfato.
    assert.equal(sulfate.cations.length, table.cations.length);
    assert.ok(sulfate.anions.length < table.anions.length);
    assert.ok(sulfate.anions.some((a) => a.formula === 'SO4'));

    const iron = filterTable(table, { query: 'hierro', onlyVerified: false, onlyInsoluble: false });
    assert.ok(iron.cations.every((c) => c.name.includes('hierro')));
    assert.equal(iron.anions.length, table.anions.length);
  });

  test('las etiquetas de los iones llevan carga y subindices', () => {
    assert.equal(ionLabel(cation('Ca', 2)), 'Ca²⁺');
    assert.equal(ionLabel(anion('SO4')), 'SO₄²⁻');
    assert.equal(ionLabel(anion('Cl')), 'Cl⁻');
    assert.equal(ionLabel(cation('Na', 1)), 'Na⁺');
    assert.equal(ionLabel(anion('PO4')), 'PO₄³⁻');
  });

  test('no hay dos sustancias curadas con la misma composicion', () => {
    // La tabla identifica una sustancia curada por su COMPOSICION, para
    // reconocer "HOH" como agua. Ese atajo deja de ser valido en cuanto
    // existan dos isomeros curados, y entonces la tabla llamaria a uno por el
    // nombre del otro sin avisar. Esta prueba es la alarma.
    const seen = new Map<string, string>();
    for (const species of allSpecies()) {
      if (species.charge !== 0) continue;
      const key = [...species.composition].map(([s, n]) => `${s}${n}`).sort().join('');
      const previous = seen.get(key);
      assert.equal(previous, undefined, `${species.formula} y ${previous} comparten composicion`);
      seen.set(key, species.formula);
    }
  });
});

// ---------------------------------------------------------------------------

describe('el motor de Lewis rehusa antes que mentir', () => {
  /*
   * Estas pruebas existen porque el fallo que cubren NO se manifiesta como un
   * error: el algoritmo cuelga todos los atomos del centro y, cuando esa
   * suposicion es falsa, devuelve una estructura bien formada y equivocada.
   * Se descubrieron mirando la pantalla, no viendo fallar una prueba.
   */
  const refuses = (formula: string, pattern: RegExp): void => {
    assert.equal(deriveLewis(formula), null, `${formula} no deberia construirse`);
    assert.match(diagnoseLewis(formula) ?? '', pattern, `${formula}: el motivo`);
  };

  test('el hidrogeno de un oxoacido va sobre el oxigeno, no sobre el centro', () => {
    // El sulfurico salia con los DOS hidrogenos sobre el azufre y un oxigeno
    // con carga formal +3. Es (HO)2SO2, un esqueleto de dos niveles.
    for (const acid of ['H2SO4', 'HNO3', 'HClO4', 'H2CO3', 'H3PO4', 'H2SO3']) {
      refuses(acid, /esta unido a un oxigeno/);
    }
  });

  test('un metal no forma estructura de Lewis molecular', () => {
    // El NaOH salia con el SODIO de atomo central y carga formal −1, y el
    // Ca(OH)2 con el calcio a −2.
    for (const salt of ['NaOH', 'Ca(OH)2', 'NaCl', 'FeCl3', 'KMnO4']) {
      refuses(salt, /es un METAL/);
    }
  });

  test('pero el berilio si, porque sus compuestos son covalentes', () => {
    // Reglas de Fajans: el Be2+ es tan pequeno y tan cargado que comparte en
    // lugar de ceder. Ademas es el ejemplo clasico de centro sin octeto.
    const becl2 = deriveLewis('BeCl2');
    assert.ok(becl2, 'BeCl2 deberia construirse');
    assert.equal(lewisLine(becl2.best), 'Cl—Be—Cl');
    assert.equal(becl2.best.atoms.find((a) => a.symbol === 'Be')?.electronCount, 4);
  });

  test('varios hidrogenos repartidos entre varios centros', () => {
    // El agua oxigenada es H–O–O–H, no HO(H)–O.
    refuses('H2O2', /H–O–O–H/);
    refuses('N2H4', /se reparten entre varios/);
    // Con UN solo hidrogeno no hay nada que repartir, y el HCN sale bien.
    const hcn = deriveLewis('HCN');
    assert.ok(hcn);
    assert.equal(lewisLine(hcn.best), 'H—C≡N');
  });

  test('una sustancia simple de cuatro atomos es un anillo o una jaula', () => {
    // El fosforo blanco es un tetraedro donde cada P se une a los otros tres;
    // salia como una estrella con el fosforo central a carga formal +2.
    refuses('P4', /ANILLO o una\s+JAULA|ANILLO o una JAULA/);
    refuses('S8', /ANILLO o una\s+JAULA|ANILLO o una JAULA/);
    // El corte esta en cuatro: el ozono si es angular y se construye.
    assert.equal(lewisLine(deriveLewis('O3')!.best), 'O=O⁺—O⁻');
  });

  test('todo lo que el motor SI construye sigue saliendo correcto', () => {
    const expected: [string, string][] = [
      ['H2O', 'H—O—H'],
      ['CO2', 'O=C=O'],
      ['NH3', 'N(—H)(—H)(—H)'],
      ['CH4', 'C(—H)(—H)(—H)(—H)'],
      ['SO2', 'O=S=O'],
      ['SO3', 'S(=O)(=O)(=O)'],
      ['N2', 'N≡N'],
      ['CO', 'C⁻≡O⁺'],
      ['HCl', 'Cl—H'],
      ['H2S', 'H—S—H'],
      ['CHCl3', 'C(—H)(—Cl)(—Cl)(—Cl)'],
    ];
    for (const [formula, line] of expected) {
      const result = deriveLewis(formula);
      assert.ok(result, formula);
      assert.equal(lewisLine(result.best), line, formula);
    }
  });
});

// ---------------------------------------------------------------------------

describe('el guia', () => {
  const base = {
    mode: 'react',
    builder: { cation: null, anion: null },
    builtFormula: null,
    bench: [] as string[],
    predictions: [] as never[],
    activePrediction: null,
    selected: null,
    answeredFor: null,
  };

  const ask = (bench: string[]) => guide({ ...base, bench });

  test('cada pista declara de que motor sale', () => {
    // Sin procedencia, el guia seria una voz sin respaldo, y el estudiante no
    // podria distinguir lo que afirma un motor de lo que suena bien.
    for (const mode of ['build', 'react', 'tabla', 'teoria', 'atomo', 'routes']) {
      const message = guide({ ...base, mode });
      for (const hint of message.hints) {
        assert.ok(hint.from.length > 0, `${mode}: pista sin procedencia`);
        assert.ok(hint.text.length > 0);
      }
    }
  });

  test('el guia tiene algo que decir en TODOS los modos de la aplicacion', () => {
    /*
     * El fallo que motivo la prueba: la pestana Atomo no tenia caso propio y
     * caia en el `default`, asi que el avatar se abria y ensenaba un panel
     * vacio — sin titulo, sin texto y sin pistas. Un control que se pulsa y no
     * hace nada ensena a desconfiar de todos los demas, que es el mismo dano
     * que hacian las pestanas muertas del inspector.
     *
     * La lista es la de `Mode` en la interfaz. Si manana se anade un modo y no
     * se le escribe guia, esta prueba lo dice antes que el usuario.
     */
    for (const mode of ['build', 'react', 'tabla', 'teoria', 'atomo', 'routes', 'lab']) {
      const message = guide({ ...base, mode });
      assert.ok(message.headline.length > 0, `${mode}: el guia se abre sin titulo`);
      assert.ok(message.body.length > 0, `${mode}: el guia se abre sin cuerpo`);
    }
  });

  test('en los modos de lectura el guia orienta sobre las figuras 3D', () => {
    // Las figuras se giran y tienen pestanas, y eso no se adivina mirandolas.
    // Ademas el recuadro del limite es lo que mas empeno pone el temario en
    // que nadie se salte, asi que el guia lo nombra.
    for (const mode of ['teoria', 'atomo']) {
      const hints = guide({ ...base, mode }).hints.map((h) => h.text.toLowerCase()).join(' ');
      assert.ok(hints.includes('girar') || hints.includes('gira'), `${mode}: no dice como girar la figura`);
      assert.ok(hints.includes('miente') || hints.includes('naranja'), `${mode}: no manda leer el limite`);
    }
  });

  test('con dos reactivos pregunta antes de revelar nada (§23)', () => {
    const message = ask(['CaO', 'H2O']);
    assert.equal(message.mood, 'asking');
    assert.ok(message.question, 'deberia haber pregunta');
    // Lo que se muestra son FAMILIAS, que son un hecho, no el resultado.
    assert.ok(message.hints.some((h) => h.text.includes('oxido basico')));
    // Y en ninguna parte aparece el producto.
    const visible = [message.headline, message.body, ...message.hints.map((h) => h.text)].join(' ');
    assert.ok(!visible.includes('Ca(OH)'), 'no debe adelantar el producto');
  });

  test('la pregunta tiene exactamente una respuesta correcta', () => {
    for (const pair of [['CaO', 'H2O'], ['HCl', 'NaOH'], ['AgNO3', 'NaCl'], ['NaCl', 'KI']]) {
      const q = ask(pair).question;
      assert.ok(q, pair.join('+'));
      assert.equal(q.options.filter((o) => o.correct).length, 1, pair.join('+'));
      assert.ok(q.options.length >= 3, `${pair.join('+')}: pocas opciones`);
    }
  });

  test('cuando el motor dice que NO hay reaccion, esa es la respuesta correcta', () => {
    /*
     * Este es el fallo que motivo la prueba. El NaCl con el KI intercambiarian
     * iones sobre el papel, pero los cuatro productos son solubles: sin
     * precipitado, gas ni agua no hay fuerza motriz y no pasa nada. El motor
     * lo marca con evidencia 'unknown' y lo explica.
     *
     * El guia miraba solo `types[0]`, veia «doble sustitucion» y la daba por
     * buena — ensenando justo lo contrario de lo que el motor afirma.
     */
    const q = ask(['NaCl', 'KI']).question;
    assert.ok(q);
    const correct = q.options.find((o) => o.correct);
    assert.equal(correct?.id, 'none', 'la respuesta correcta es que no reaccionan');
    // Y la doble sustitucion se ofrece como senuelo: es el error que se comete.
    assert.ok(q.options.some((o) => o.id === 'double-displacement' && !o.correct));
    assert.match(q.reveal, /NO HAY REACCION/);
  });

  test('las opciones no bailan entre repintados', () => {
    // Si cambiaran en cada render, el usuario creeria que el programa duda.
    const a = ask(['CaO', 'H2O']).question!.options.map((o) => o.id);
    const b = ask(['CaO', 'H2O']).question!.options.map((o) => o.id);
    assert.deepEqual(a, b);
  });

  test('tras contestar sigue habiendo pregunta, para poder ver la explicacion', () => {
    // Retirarla al responder se llevaba por delante el «por que», que es la
    // parte que ensena.
    const message = guide({ ...base, bench: ['CaO', 'H2O'], answeredFor: 'CaO+H2O' });
    assert.ok(message.question, 'la pregunta resuelta debe seguir disponible');
    assert.equal(message.mood, 'pointing');
    assert.match(message.headline, /comprueba/i);
  });

  test('un riesgo quimico pone al guia en alerta', () => {
    const result = predict(['CaO', 'H2O']);
    const message = guide({
      ...base,
      bench: ['CaO', 'H2O'],
      predictions: [...result.predictions] as never,
      activePrediction: result.predictions[0] as never,
      answeredFor: 'CaO+H2O',
    });
    assert.equal(message.mood, 'warning');
    assert.match(message.headline, /riesgo|Cuidado|NO intentes/i);
  });

  test('avisa cuando una prediccion sale de reglas y no de una reaccion documentada', () => {
    const result = predict(['ZnCl2', 'AgNO3']);
    if (result.predictions.length === 0) return; // el motor no propone nada: nada que comprobar
    const message = guide({
      ...base,
      bench: ['ZnCl2', 'AgNO3'],
      predictions: [...result.predictions] as never,
      activePrediction: result.predictions[0] as never,
      answeredFor: 'AgNO3+ZnCl2',
    });
    if (result.predictions[0]!.evidence === 'predicted') {
      assert.ok(
        message.hints.some((h) => h.text.includes('no de una reaccion documentada')),
        'deberia declarar que es una prediccion, no un dato',
      );
    }
  });

  test('en Construir explica que ahi NO ocurre ninguna reaccion', () => {
    const message = guide({ ...base, mode: 'build' });
    assert.match(message.body, /no ocurre ninguna reaccion/i);
    assert.match(message.body, /PROPORCION/);
  });

  test('con un solo reactivo dice cuantas transformaciones hay documentadas', () => {
    const message = ask(['CaO']);
    assert.equal(message.mood, 'pointing');
    assert.ok(message.hints.some((h) => h.from === 'Reacciones curadas'));
  });

  test('el laboratorio admite que su interfaz no esta hecha', () => {
    // Preferible a ensenar una pantalla que no calcula.
    assert.match(guide({ ...base, mode: 'lab' }).body, /hoja de ruta|no calcula/i);
  });
});

// ---------------------------------------------------------------------------

describe('unidad 1: las leyes calculadas', () => {
  /*
   * Estas pruebas valen por lo que NO hacen: no comparan contra numeros
   * escritos a mano en un texto. Comprueban que las leyes SALEN de los datos,
   * de modo que si manana cambiara una masa atomica, cambiarian a la vez el
   * calculo y lo que se ensena.
   */

  test('la ley de conservacion se comprueba contando atomos, no afirmandola', () => {
    const demo = conservationDemo('caco3-hcl');
    assert.ok(demo);
    assert.ok(demo.rows.length >= 4);
    for (const row of demo.rows) {
      assert.equal(row.left, row.right, `${row.symbol}: ${row.left} ≠ ${row.right}`);
      assert.equal(row.balanced, true);
    }
    // Y si los atomos cuadran, la masa cuadra: es la misma afirmacion.
    assert.ok(Math.abs(demo.massLeft - demo.massRight) < 1e-9);
  });

  test('vale para cualquier reaccion curada, no solo para la del ejemplo', () => {
    for (const id of ['cao-h2o-caoh2', 'hcl-naoh', 'haber-bosch', 'so2-o2-so3', 'agno3-nacl']) {
      const demo = conservationDemo(id);
      assert.ok(demo, id);
      assert.ok(demo.rows.every((r) => r.balanced), `${id}: no cuadra`);
      assert.ok(Math.abs(demo.massLeft - demo.massRight) < 1e-9, `${id}: masas distintas`);
    }
  });

  test('las proporciones definidas no dependen del tamano de la muestra', () => {
    const demo = definiteProportionsDemo('H2O');
    assert.ok(demo);
    const h = demo.rows.find((r) => r.symbol === 'H')!;
    const o = demo.rows.find((r) => r.symbol === 'O')!;
    assert.ok(Math.abs(h.percent - 11.19) < 0.02, `H: ${h.percent}`);
    assert.ok(Math.abs(o.percent - 88.81) < 0.02, `O: ${o.percent}`);
    assert.ok(Math.abs(h.percent + o.percent - 100) < 1e-6);

    // Dos muestras distintas, el mismo reparto proporcional.
    const [small, big] = demo.samples as [(typeof demo.samples)[0], (typeof demo.samples)[0]];
    for (let i = 0; i < small.parts.length; i++) {
      const ratioSmall = small.parts[i]!.grams / small.grams;
      const ratioBig = big.parts[i]!.grams / big.grams;
      assert.ok(Math.abs(ratioSmall - ratioBig) < 1e-9, 'la proporcion cambia con la muestra');
    }
  });

  test('las proporciones multiples salen en numeros enteros pequenos', () => {
    // Los cuatro casos de manual. Los enteros NO estan escritos en ningun
    // sitio: se obtienen dividiendo masas atomicas medidas.
    const cases: [string[], string][] = [
      [['CO', 'CO2'], '1 : 2'],
      [['SO2', 'SO3'], '2 : 3'],
      [['FeO', 'Fe2O3'], '2 : 3'],
      [['N2O', 'NO', 'NO2'], '1 : 2 : 4'],
    ];
    for (const [formulas, expected] of cases) {
      const demo = multipleProportionsDemo(formulas);
      assert.ok(demo, formulas.join('/'));
      assert.equal(demo.ratioText, expected, formulas.join('/'));
      // Y los enteros son de verdad pequenos: si hiciera falta un 17, la ley
      // no se estaria cumpliendo.
      for (const row of demo.rows) assert.ok(row.integer <= 8, `${row.formula}: ${row.integer}`);
    }
  });

  test('la ley de las proporciones multiples se niega a hablar de lo que no es suyo', () => {
    // Solo trata de DOS elementos que forman VARIOS compuestos.
    assert.equal(multipleProportionsDemo(['H2O']), null, 'hace falta mas de un compuesto');
    assert.equal(multipleProportionsDemo(['H2SO4', 'H2SO3']), null, 'tres elementos: no aplica');
    assert.equal(multipleProportionsDemo(['CO', 'H2O']), null, 'elementos distintos: no aplica');
  });

  test('Gay-Lussac: los volumenes son los coeficientes que puso el balanceador', () => {
    const demo = gayLussacDemo('haber-bosch');
    assert.ok(demo);
    assert.equal(demo.ratioText, '1 : 3 → 2', 'N2 + 3 H2 → 2 NH3');
    assert.equal(demo.volumes.filter((v) => v.side === 'izquierda').length, 2);
    assert.equal(demo.volumes.filter((v) => v.side === 'derecha').length, 1);
  });

  test('un mol de agua NO es un mol de atomos', () => {
    // La confusion mas repetida del temario.
    const demo = moleDemo('H2O');
    assert.ok(demo);
    assert.equal(demo.molecules, AVOGADRO);
    assert.equal(demo.atoms.find((a) => a.symbol === 'H')?.moles, 2);
    assert.equal(demo.atoms.find((a) => a.symbol === 'O')?.moles, 1);
    // Tres moles de atomos, no uno.
    assert.ok(Math.abs(demo.totalAtoms - 3 * AVOGADRO) < 1e10);
    assert.ok(Math.abs(demo.molarMass - 18.015) < 0.01);
  });

  test('el numero de Avogadro es el valor exacto del SI de 2019', () => {
    assert.equal(AVOGADRO, 6.02214076e23);
  });

  test('el temario cubre los doce apartados pedidos', () => {
    const unit = unitMateria();
    const ids: string[] = [];
    const walk = (t: typeof unit): void => {
      ids.push(t.id);
      for (const c of t.children ?? []) walk(c);
    };
    walk(unit);

    for (const id of [
      '1.1', '1.2', '1.3', '1.4', '1.5',
      '1.6', '1.6.1', '1.6.2', '1.6.3',
      '1.7',
      '1.8', '1.8.1', '1.8.2', '1.8.3', '1.8.4', '1.8.5',
      '1.9', '1.10', '1.11', '1.12',
    ]) {
      assert.ok(ids.includes(id), `falta el apartado ${id}`);
    }
  });

  test('cada apartado tiene cuerpo, y las leyes traen demostracion', () => {
    const unit = unitMateria();
    const withDemo: string[] = [];
    const walk = (t: typeof unit): void => {
      assert.ok(t.body.length > 40, `${t.id}: cuerpo demasiado corto`);
      if (t.demo) withDemo.push(t.id);
      for (const c of t.children ?? []) walk(c);
    };
    walk(unit);

    // Las cuatro leyes demostrables, mas los dos apartados de cantidad.
    for (const id of ['1.8.1', '1.8.2', '1.8.3', '1.8.4', '1.10', '1.12']) {
      assert.ok(withDemo.includes(id), `${id} deberia traer demostracion calculada`);
    }
  });

  test('se declara que aqui NO hay modelo de mezclas', () => {
    // §32: decirlo antes que fingir que se puede.
    const unit = unitMateria();
    const mezclas = unit.children?.find((c) => c.id === '1.6');
    assert.ok(mezclas?.gap, 'el apartado de mezclas debe declarar el hueco');
    assert.match(mezclas.gap, /SUSTANCIAS PURAS|no tiene modelo de mezclas/i);
  });

  test('los metodos de separacion nombran la propiedad que aprovechan', () => {
    // Es lo unico que importa de esa tabla: memorizar la lista sin saber que
    // propiedad usa cada metodo no sirve de nada.
    assert.ok(SEPARATION_METHODS.length >= 8);
    for (const m of SEPARATION_METHODS) {
      assert.ok(m.property.length > 0, `${m.name}: sin propiedad`);
      assert.ok(m.example.length > 0, `${m.name}: sin ejemplo`);
      assert.match(m.separates, /Homogenea|Heterogenea/);
    }
    assert.equal(SEPARATION_METHODS.find((m) => m.name === 'Destilacion')?.property, 'Punto de ebullicion');
  });
});

// ---------------------------------------------------------------------------

describe('unidad 2: estructura atomica', () => {
  test('la media ponderada de los isotopos REPRODUCE la masa atomica IUPAC', () => {
    /*
     * Es la prueba mas fuerte de la unidad, y la razon de que exista la tabla
     * de isotopos. La masa atomica del cloro no es 35,45 porque lo diga un
     * libro: es lo que sale de ponderar 75,76 % de ³⁵Cl con 24,24 % de ³⁷Cl.
     *
     * Si alguien mete mal una abundancia o una masa isotopica, esta prueba se
     * entera: el resultado deja de coincidir con el dato independiente que
     * publica la IUPAC.
     */
    for (const symbol of elementsWithIsotopes()) {
      const demo = abundanceDemo(symbol);
      assert.ok(demo, symbol);
      assert.ok(
        demo.difference < 0.01,
        `${symbol}: calculado ${demo.weighted.toFixed(5)}, IUPAC ${demo.tabulated} (dif ${demo.difference.toFixed(5)})`,
      );
    }
  });

  test('las abundancias de cada elemento suman 100 %', () => {
    for (const symbol of elementsWithIsotopes()) {
      const total = isotopesOf(symbol)
        .filter((i) => i.abundance > 0)
        .reduce((sum, i) => sum + i.abundance, 0);
      assert.ok(Math.abs(total - 100) < 0.001, `${symbol}: suman ${total} %`);
    }
  });

  test('el cloro es el caso de manual', () => {
    const cl = abundanceDemo('Cl');
    assert.ok(cl);
    assert.equal(cl.rows.length, 2);
    assert.ok(Math.abs(cl.weighted - 35.45) < 0.01);
    // Y ningun isotopo pesa el valor medio: la masa atomica es una media.
    assert.ok(cl.rows.every((r) => Math.abs(r.mass - cl.weighted) > 0.4));
  });

  test('protones, neutrones y electrones salen de Z, A y la carga', () => {
    const demo = compositionDemo();
    for (const row of demo.rows) {
      assert.equal(row.protons, row.Z, `${row.label}: protones = Z`);
      assert.equal(row.neutrons, row.A - row.Z, `${row.label}: neutrones = A − Z`);
      assert.equal(row.electrons, row.Z - row.charge, `${row.label}: electrones = Z − carga`);
    }
    // En un ion cambian los electrones, NUNCA los protones.
    const sodium = demo.rows.find((r) => r.symbol === 'Na' && r.charge === 1)!;
    assert.equal(sodium.protons, 11);
    assert.equal(sodium.electrons, 10);
  });

  test('las isobaras comparten A y difieren en Z', () => {
    const demo = isobarsDemo();
    assert.ok(demo.groups.length > 0);
    for (const group of demo.groups) {
      assert.ok(group.members.length >= 2);
      assert.ok(group.members.every((m) => m.A === group.value), `A = ${group.value}`);
      assert.ok(new Set(group.members.map((m) => m.Z)).size > 1, 'deben ser elementos distintos');
    }
    // El trio clasico: ⁴⁰Ar, ⁴⁰K y ⁴⁰Ca.
    const forty = demo.groups.find((g) => g.value === 40);
    assert.ok(forty, 'deberia estar el grupo A = 40');
    assert.deepEqual([...forty.members.map((m) => m.symbol)].sort(), ['Ar', 'Ca', 'K']);
  });

  test('los isotonos comparten N y difieren en Z', () => {
    const demo = isotonesDemo();
    assert.ok(demo.groups.length > 0);
    for (const group of demo.groups) {
      assert.ok(group.members.every((m) => m.neutrons === group.value), `N = ${group.value}`);
      assert.ok(new Set(group.members.map((m) => m.Z)).size > 1);
      // Isotonos, no isobaras: el numero masico NO coincide.
      assert.ok(new Set(group.members.map((m) => m.A)).size > 1, 'si coincide A serian isobaras');
    }
  });

  test('los tres «iso» no se confunden entre si', () => {
    // isotopos: mismo Z. isobaras: mismo A. isotonos: mismo N.
    const cl35 = isotopesOf('Cl').find((i) => i.A === 35)!;
    const cl37 = isotopesOf('Cl').find((i) => i.A === 37)!;
    assert.equal(cl35.Z, cl37.Z, 'isotopos: mismo Z');
    assert.notEqual(cl35.A, cl37.A);

    const ar40 = isobarsOf(40).find((i) => i.symbol === 'Ar')!;
    const ca40 = isobarsOf(40).find((i) => i.symbol === 'Ca')!;
    assert.equal(ar40.A, ca40.A, 'isobaras: mismo A');
    assert.notEqual(ar40.Z, ca40.Z);
  });

  test('la tabla periodica se cuenta sobre los 118 elementos', () => {
    const demo = periodicStatsDemo();
    assert.equal(demo.total, 118);
    // Los recuentos por familia y por bloque tienen que sumar el total.
    assert.equal(demo.byCategory.reduce((s, c) => s + c.count, 0), 118);
    assert.equal(demo.byBlock.reduce((s, b) => s + b.count, 0), 118);
    // La mayoria de los elementos son metales.
    assert.ok(demo.metals > demo.nonmetals + demo.metalloids);
  });

  test('cada elemento tiene una casilla, y solo una', () => {
    // Es lo que garantiza que la tabla dibujada no pierda ni duplique ninguno.
    const withGroup = ELEMENTS.filter((e) => e.group !== null);
    const inner = ELEMENTS.filter((e) => e.category === 'lanthanide' || e.category === 'actinide');
    assert.equal(withGroup.length + inner.length, 118, 'todos colocados');
    assert.equal(withGroup.filter((e) => inner.includes(e)).length, 0, 'sin duplicados');

    // Y ninguna casilla del cuerpo principal esta ocupada dos veces.
    const seen = new Set<string>();
    for (const e of withGroup) {
      const cellKey = `${e.period}:${e.group}`;
      assert.ok(!seen.has(cellKey), `dos elementos en la celda ${cellKey}`);
      seen.add(cellKey);
    }
  });

  test('el temario cubre los quince apartados pedidos', () => {
    const unit = unitAtomo();
    const ids: string[] = [];
    const walk = (t: typeof unit): void => {
      ids.push(t.id);
      for (const c of t.children ?? []) walk(c);
    };
    walk(unit);

    for (const id of [
      '2.1', '2.2', '2.2.1', '2.2.1.1', '2.2.1.2',
      '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.9',
      '2.10', '2.10.1', '2.10.2',
    ]) {
      assert.ok(ids.includes(id), `falta el apartado ${id}`);
    }
  });

  test('se declara que la tabla de nucleidos no esta completa', () => {
    // Hay unos 3400 nucleidos conocidos; aqui estan los que se estudian.
    // Un elemento sin datos devuelve lista vacia en vez de inventarlos.
    assert.deepEqual(isotopesOf('Au'), [], 'sin datos curados: lista vacia');
    assert.equal(abundanceDemo('Au'), null, 'y la demostracion se declara no disponible');
  });
});

// ---------------------------------------------------------------------------

describe('el contrato didactico de las dos unidades', () => {
  const walk = <D>(t: TheoryTopic<D>, out: TheoryTopic<D>[] = []): TheoryTopic<D>[] => {
    out.push(t);
    for (const c of t.children ?? []) walk(c, out);
    return out;
  };

  const materia = walk(unitMateria());
  const atomo = walk(unitAtomo());
  const todos = [...materia, ...atomo];

  test('TODA analogia declara donde deja de valer', () => {
    /*
     * Es la regla que justifica que el tipo `Analogy` tenga dos campos
     * obligatorios en vez de uno.
     *
     * Las analogias son la herramienta mas potente y mas peligrosa de la
     * ensenanza: explican rapido y dejan una idea falsa pegada. «El atomo es
     * como un sistema solar» hace entender la idea de nucleo y corteza, y a
     * cambio deja creyendo que los electrones giran en orbitas — que es justo
     * lo que la mecanica cuantica niega.
     */
    const conAnalogia = todos.filter((t) => t.analogy);
    assert.ok(conAnalogia.length >= 6, `solo ${conAnalogia.length} analogias`);
    for (const t of conAnalogia) {
      assert.ok(t.analogy!.image.length > 40, `${t.id}: la imagen es demasiado escueta`);
      assert.ok(t.analogy!.limit.length > 40, `${t.id}: el limite es demasiado escueto`);
    }
  });

  test('los ejercicios resueltos ensenan el desarrollo, no solo el resultado', () => {
    const conEjercicio = todos.filter((t) => t.worked);
    assert.ok(conEjercicio.length >= 7, `solo ${conEjercicio.length} ejercicios`);
    for (const t of conEjercicio) {
      const w = t.worked!;
      assert.ok(w.question.length > 25, `${t.id}: enunciado corto`);
      assert.ok(w.steps.length >= 3, `${t.id}: ${w.steps.length} pasos, hacen falta al menos 3`);
      assert.ok(w.answer.length > 5, `${t.id}: sin respuesta`);
      // Al menos un paso tiene que ensenar la cuenta, no solo describirla.
      assert.ok(w.steps.some((s) => s.math), `${t.id}: ningun paso muestra la operacion`);
    }
  });

  test('las preguntas de autocomprobacion traen respuesta razonada', () => {
    const preguntas = todos.flatMap((t) => (t.check ?? []).map((c) => ({ id: t.id, c })));
    assert.ok(preguntas.length >= 18, `solo ${preguntas.length} preguntas`);
    for (const { id, c } of preguntas) {
      assert.ok(c.question.includes('?') || c.question.includes('¿'), `${id}: no es una pregunta`);
      // Una respuesta de dos palabras no ensena: tiene que explicar por que.
      assert.ok(c.answer.length > 60, `${id}: respuesta sin razonar — "${c.answer}"`);
    }
  });

  test('las conexiones apuntan a apartados que existen', () => {
    // Un enlace roto convierte la navegacion en un callejon sin salida, que es
    // el tipo de fallo que solo se ve cuando alguien lo pulsa.
    const idsMateria = new Set(materia.map((t) => t.id));
    const idsAtomo = new Set(atomo.map((t) => t.id));

    for (const [lista, propios] of [
      [materia, idsMateria],
      [atomo, idsAtomo],
    ] as const) {
      for (const t of lista) {
        for (const c of t.connects ?? []) {
          if (c.topic) {
            assert.ok(propios.has(c.topic), `${t.id} enlaza a "${c.topic}", que no existe en su unidad`);
          }
          if (c.mode) {
            assert.ok(
              ['teoria', 'atomo', 'react', 'tabla', 'build', 'routes', 'lab'].includes(c.mode),
              `${t.id}: modo desconocido "${c.mode}"`,
            );
          }
        }
      }
    }
  });

  test('los modelos atomicos son una cadena, no una galeria', () => {
    /*
     * De cada modelo, lo que ensena es lo que NO pudo explicar: es la razon de
     * que exista el siguiente. Sin esa columna serian cinco dibujos sueltos.
     */
    const demo = modelsDemo();
    assert.equal(demo.models.length, 5);
    for (const m of demo.models) {
      assert.ok(m.fails.length > 50, `${m.name}: no dice que NO puede explicar`);
      assert.ok(m.evidence.length > 50, `${m.name}: no dice en que se apoya`);
      assert.ok(m.survives.length > 20, `${m.name}: no dice que sobrevive`);
    }
    // En orden cronologico.
    const years = demo.models.map((m) => Number(m.year));
    assert.deepEqual([...years].sort((a, b) => a - b), years, 'los modelos deben ir en orden');
    // Y el ultimo no «falla» como los otros: es el vigente.
    assert.match(demo.models[4]!.survives, /vigente/i);
  });

  test('cada apartado con contenido propio aporta algo mas que la definicion', () => {
    // Un apartado que solo define es un diccionario. Los que agrupan a otros
    // (2.2, 2.2.1, 1.6, 1.8) si pueden limitarse a presentar.
    const agrupadores = new Set(['1', '2', '1.6', '1.8', '2.2', '2.2.1', '2.10']);
    for (const t of todos) {
      if (agrupadores.has(t.id)) continue;
      const extras =
        (t.keyIdea ? 1 : 0) + (t.pitfall ? 1 : 0) + (t.analogy ? 1 : 0) +
        (t.worked ? 1 : 0) + (t.check ? 1 : 0) + (t.demo ? 1 : 0);
      assert.ok(extras >= 2, `${t.id} «${t.title}» solo tiene definicion`);
    }
  });
});

// ---------------------------------------------------------------------------

describe('las figuras 3D del temario', () => {
  const sets = allSceneSets();

  test('hay figura solo donde lo explicado es espacial', () => {
    // Siete conjuntos, y ninguno es decoracion: escala, modelos atomicos,
    // reparto de particulas en las mezclas, antes/despues de un cambio, la
    // forma de los orbitales, el llenado y el magnetismo.
    assert.deepEqual(
      sets.map((s) => s.id).sort(),
      ['cambio', 'escala', 'llenado', 'magnetismo', 'materia', 'modelos', 'orbitales'],
    );
  });

  test('TODA escena declara donde el dibujo miente', () => {
    /*
     * Misma regla que las analogias del temario, y por la misma razon: un
     * dibujo de un atomo ES una analogia visual. El modelo de Bohr con sus
     * orbitas es probablemente la imagen que mas ideas falsas ha dejado en
     * toda la quimica, y aparece aqui.
     */
    for (const set of sets) {
      for (const scene of set.scenes) {
        assert.ok(scene.limit.length > 50, `${set.id}/${scene.id}: limite ausente o escueto`);
        assert.ok(scene.caption.length > 40, `${set.id}/${scene.id}: pie escueto`);
      }
    }
  });

  test('el dibujo de Bohr avisa de que las orbitas no existen', () => {
    const bohr = sets.find((s) => s.id === 'modelos')!.scenes.find((s) => s.id === 'bohr')!;
    assert.match(bohr.limit, /NO recorren orbitas|no tienen trayectoria/i);
  });

  test('las estructuras son validas: los enlaces apuntan a atomos que existen', () => {
    for (const set of sets) {
      for (const scene of set.scenes) {
        const n = scene.structure.atoms.length;
        assert.ok(n > 0, `${set.id}/${scene.id}: escena vacia`);
        for (const bond of scene.structure.bonds) {
          assert.ok(bond.a >= 0 && bond.a < n, `${set.id}/${scene.id}: enlace a=${bond.a} fuera de rango`);
          assert.ok(bond.b >= 0 && bond.b < n, `${set.id}/${scene.id}: enlace b=${bond.b} fuera de rango`);
          assert.notEqual(bond.a, bond.b, `${set.id}/${scene.id}: enlace de un atomo consigo mismo`);
        }
      }
    }
  });

  test('cada esfera lleva radio y color propios', () => {
    // Un nucleo o una particula generica no son atomos de ningun elemento, asi
    // que no se les puede sacar el radio de una tabla de radios covalentes ni
    // el color de la paleta CPK.
    for (const set of sets) {
      for (const scene of set.scenes) {
        for (const atom of scene.structure.atoms) {
          assert.ok(typeof atom.radius === 'number' && atom.radius > 0, `${set.id}/${scene.id}: sin radio`);
          assert.match(atom.color ?? '', /^#[0-9a-f]{6}$/i, `${set.id}/${scene.id}: sin color`);
        }
      }
    }
  });

  test('las escenas no cambian entre visitas', () => {
    /*
     * Las de mezclas usan posiciones «al azar», pero con semilla fija: si
     * cambiaran a cada repintado, dos personas mirando la misma figura verian
     * cosas distintas y no se podria hablar de ella.
     */
    const primera = sceneSet('materia')!.scenes[1]!.structure.atoms.map((a) => a.position.x);
    const segunda = sceneSet('materia')!.scenes[1]!.structure.atoms.map((a) => a.position.x);
    assert.deepEqual(primera, segunda);
  });

  test('la mezcla homogenea y la heterogenea tienen las MISMAS particulas', () => {
    // Es lo que hace la comparacion valida: lo unico que cambia es el reparto.
    const materia = sceneSet('materia')!;
    const homogenea = materia.scenes.find((s) => s.id === 'homogenea')!;
    const heterogenea = materia.scenes.find((s) => s.id === 'heterogenea')!;
    assert.equal(homogenea.structure.atoms.length, heterogenea.structure.atoms.length);
    // Las dos usan dos colores; la diferencia esta en donde cae cada uno.
    for (const escena of [homogenea, heterogenea]) {
      assert.equal(new Set(escena.structure.atoms.map((a) => a.color)).size, 2, escena.id);
    }
  });

  test('el cambio quimico conserva los atomos, y el fisico las moleculas', () => {
    const cambio = sceneSet('cambio')!;
    const count = (id: string, symbol: string): number =>
      cambio.scenes.find((s) => s.id === id)!.structure.atoms.filter((a) => a.symbol === symbol).length;

    // Quimico: 8 H y 4 O antes, y los mismos despues. Es la conservacion de
    // la materia dibujada.
    assert.equal(count('antes', 'H'), 8);
    assert.equal(count('antes', 'O'), 4);
    assert.equal(count('despues', 'H'), 8);
    assert.equal(count('despues', 'O'), 4);

    // Fisico: lo que se conserva son los ENLACES. Cada molecula de agua tiene
    // dos, y ninguno se rompe al pasar de hielo a vapor.
    const hielo = cambio.scenes.find((s) => s.id === 'hielo')!.structure;
    const vapor = cambio.scenes.find((s) => s.id === 'vapor')!.structure;
    assert.equal(hielo.bonds.length, (hielo.atoms.length / 3) * 2);
    assert.equal(vapor.bonds.length, (vapor.atoms.length / 3) * 2);
  });

  test('los apartados que llevan figura son los espaciales', () => {
    const conFigura = [...walkTopics(unitMateria()), ...walkTopics(unitAtomo())]
      .filter((t) => t.figure)
      .map((t) => `${t.id}:${t.figure}`);
    assert.deepEqual(conFigura.sort(), [
      '1.5:materia',   // puro / homogeneo / heterogeneo
      '1.7:cambio',    // fisico / quimico
      // Ordenados como cadenas, no como numeros de apartado: «2.11.1:» va
      // antes que «2.1:» porque el '1' pesa menos que el ':'.
      '2.11.1.3:llenado',   // Pauli y Hund, vistos en el espacio
      '2.11.1.4:magnetismo',
      '2.11.1:orbitales',   // de donde sale la forma de un orbital
      '2.1:escala',    // el atomo es sobre todo vacio
      '2.2.1.2:modelos',
    ]);
  });

  test('cada figura apuntada existe de verdad', () => {
    // Un `figure` mal escrito no rompe nada: `renderFigure` devuelve cadena
    // vacia y el apartado sale sin figura, en silencio. Esta prueba es el
    // unico sitio donde eso se nota.
    for (const topic of [...walkTopics(unitMateria()), ...walkTopics(unitAtomo())]) {
      if (!topic.figure) continue;
      assert.ok(sceneSet(topic.figure), `${topic.id} apunta a la figura «${topic.figure}», que no existe`);
    }
  });
});

// ---------------------------------------------------------------------------

describe('los orbitales se calculan, no se dibujan', () => {
  /*
   * Estas pruebas son la diferencia entre una figura util y una bonita.
   *
   * Las formas de los orbitales del apartado 2.11 NO estan dibujadas a mano:
   * se sortean de la funcion de onda hidrogenoide. Si las formulas tuvieran un
   * signo cambiado o una constante mal, la nube seguiria pareciendo un orbital
   * —seguiria siendo una mancha simetrica y convincente— y nadie lo notaria
   * mirandola. Solo se nota comprobandola contra valores exactos conocidos.
   */

  test('las funciones radiales estan normalizadas', () => {
    // ∫|R|²r²dr = 1. Si una constante estuviera mal, esto lo dice.
    for (const [n, l] of [[1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [3, 2]] as const) {
      const steps = 40000;
      const rmax = 60;
      const h = rmax / steps;
      let total = 0;
      for (let i = 0; i < steps; i++) {
        const a = i * h;
        const b = (i + 1) * h;
        total += ((radial(n, l, a) ** 2 * a * a + radial(n, l, b) ** 2 * b * b) / 2) * h;
      }
      assert.ok(Math.abs(total - 1) < 0.002, `R(${n},${l}) integra ${total.toFixed(4)}, no 1`);
    }
  });

  test('los nodos radiales salen donde dice la teoria: n − l − 1', () => {
    for (const [n, l] of [[1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [3, 2]] as const) {
      let changes = 0;
      let previous = Math.sign(radial(n, l, 1e-6));
      for (let r = 1e-6; r < 40; r += 0.002) {
        const sign = Math.sign(radial(n, l, r));
        if (sign !== 0 && sign !== previous) {
          changes++;
          previous = sign;
        }
      }
      assert.equal(changes, n - l - 1, `R(${n},${l}) cruza el cero ${changes} veces`);
    }
  });

  test('el nodo del 2s cae exactamente en r = 2 a₀', () => {
    // No es un cero cualquiera: es la raiz del polinomio (2 − r), y por tanto
    // esta puesto por la formula, no ajustado para que la figura quede bien.
    assert.ok(radial(2, 0, 1.99) > 0);
    assert.ok(radial(2, 0, 2.01) < 0);
    assert.ok(Math.abs(radial(2, 0, 2)) < 1e-12);
  });

  test('los nodos angulares son planos y conos exactos, no zonas de poca densidad', () => {
    // El 2p_z se anula en TODO el plano ecuatorial; el 3d_xy en dos planos.
    for (const [x, y] of [[1, 1], [3, 0], [0, 5], [2, -7]] as const) {
      assert.equal(psi('2pz', x, y, 0), 0, `2pz no se anula en (${x},${y},0)`);
    }
    assert.equal(psi('3dxy', 2, 0, 2), 0, '3dxy deberia anularse en el plano xz');
    assert.equal(psi('3dxy', 0, 3, 1), 0, '3dxy deberia anularse en el plano yz');
    // Y el 2s NO se anula ahi: si lo hiciera, la esfera tendria un agujero.
    assert.notEqual(psi('2s', 1, 1, 0), 0);
  });

  test('la nube muestreada reproduce ⟨r⟩ = (3n² − l(l+1))/2 a₀', () => {
    /*
     * La prueba de fondo. El valor esperado del radio tiene formula cerrada
     * para el atomo hidrogenoide, y el muestreo no sabe nada de ella: si la
     * nube saliera mas gorda o mas flaca de lo que debe —por un maximo mal
     * estimado, por una cola recortada— este numero se iria.
     */
    for (const [key, n, l] of [
      ['1s', 1, 0],
      ['2s', 2, 0],
      ['2pz', 2, 1],
      ['3s', 3, 0],
      ['3dz2', 3, 2],
    ] as const) {
      const points = sampleOrbital(key, 4000, 4242);
      assert.equal(points.length, 4000, `${key}: el muestreo se quedo corto`);
      const mean =
        points.reduce((s, p) => s + Math.hypot(p.position.x, p.position.y, p.position.z), 0) /
        points.length;
      const exact = (3 * n * n - l * (l + 1)) / 2;
      const error = Math.abs(mean - exact) / exact;
      assert.ok(error < 0.05, `${key}: ⟨r⟩ = ${mean.toFixed(2)}, exacto ${exact} (${(100 * error).toFixed(1)} %)`);
    }
  });

  test('el 2p reparte su densidad en el eje, no en la esfera', () => {
    // Si ⟨z²⟩ no fuera muy mayor que ⟨x²⟩, la nube seria una bola y la figura
    // de «l · la forma» estaria ensenando una mentira.
    const points = sampleOrbital('2pz', 3000, 11);
    const mean = (f: (p: (typeof points)[number]) => number) =>
      points.reduce((s, p) => s + f(p), 0) / points.length;
    const z2 = mean((p) => p.position.z ** 2);
    const x2 = mean((p) => p.position.x ** 2);
    assert.ok(z2 > 2.5 * x2, `2p_z: ⟨z²⟩ = ${z2.toFixed(1)} frente a ⟨x²⟩ = ${x2.toFixed(1)}`);
  });

  test('el 3d_xy vive en su plano, y el 3d_z² en su eje', () => {
    const xy = sampleOrbital('3dxy', 3000, 12);
    const flat = xy.reduce((s, p) => s + p.position.x ** 2 + p.position.y ** 2, 0) / xy.length;
    const tall = xy.reduce((s, p) => s + p.position.z ** 2, 0) / xy.length;
    assert.ok(flat > 4 * tall, 'el d_xy deberia ser mucho mas ancho que alto');

    const z2 = sampleOrbital('3dz2', 3000, 13);
    const along = z2.reduce((s, p) => s + p.position.z ** 2, 0) / z2.length;
    const across = z2.reduce((s, p) => s + p.position.x ** 2, 0) / z2.length;
    assert.ok(along > 1.8 * across, 'el d_z² deberia alargarse por el eje z');
  });

  test('los dos lobulos de un p tienen SIGNO OPUESTO y el mismo peso', () => {
    // Las dos fases no son adorno: son la razon de que dos orbitales se sumen
    // o se cancelen al formar un enlace. Y por simetria tienen que salir mitad
    // y mitad — si no, el muestreo estaria sesgado.
    const points = sampleOrbital('2pz', 4000, 14);
    const positive = points.filter((p) => p.phase === 1).length;
    const fraction = positive / points.length;
    assert.ok(Math.abs(fraction - 0.5) < 0.05, `fase positiva al ${(100 * fraction).toFixed(0)} %`);
    // Y cada fase esta de un lado del plano nodal, no mezcladas.
    for (const p of points) {
      assert.equal(p.phase === 1, p.position.z >= 0, 'una fase esta del lado equivocado');
    }
  });

  test('el recorte al 90 % es el radio que de verdad encierra el 90 %', () => {
    // Las escenas recortan ahi y lo declaran en su limite. Si el numero
    // estuviera elegido a ojo, la declaracion seria falsa.
    for (const [n, l] of [[1, 0], [2, 1], [3, 2]] as const) {
      const cut = radiusContaining(n, l, 0.9);
      const points = sampleOrbital(`${n}${l === 0 ? 's' : l === 1 ? 'pz' : 'dz2'}` as never, 3000, 15);
      const inside = points.filter(
        (p) => Math.hypot(p.position.x, p.position.y, p.position.z) <= cut,
      ).length;
      const fraction = inside / points.length;
      assert.ok(
        Math.abs(fraction - 0.9) < 0.03,
        `n=${n} l=${l}: dentro de ${cut.toFixed(1)} a₀ cae el ${(100 * fraction).toFixed(0)} %`,
      );
    }
  });

  test('la misma escena sale igual en cada visita', () => {
    const a = sampleOrbital('2pz', 200, 99).map((p) => p.position.x);
    const b = sampleOrbital('2pz', 200, 99).map((p) => p.position.x);
    assert.deepEqual(a, b);
  });

  test('construir un conjunto de figuras no bloquea la interfaz', () => {
    /*
     * Un umbral flojo a proposito: no mide el rendimiento de la maquina, vigila
     * que nadie vuelva a meter aqui un muestreo por rechazo en 3D. El primero
     * que se escribio tardaba cerca de un segundo y congelaba la pestana.
     */
    const start = Date.now();
    sceneSet('orbitales');
    sceneSet('llenado');
    sceneSet('magnetismo');
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 400, `construir las figuras del 2.11 tardo ${elapsed} ms`);
  });

  test('pedir una figura NO construye las demas', () => {
    // Abrir la pestana Materia no debe pagar el coste de las nubes de
    // orbitales, que es lo que pasaba cuando se construian todas de golpe.
    const start = Date.now();
    sceneSet('materia');
    assert.ok(Date.now() - start < 60, 'construir «materia» deberia ser inmediato');
  });
});

describe('unidad 2.11: estructura electronica', () => {
  const topics = new Map(walkTopics(unitAtomo()).map((t) => [t.id, t]));

  test('estan los seis apartados que pide el temario', () => {
    for (const id of ['2.11', '2.11.1', '2.11.1.1', '2.11.1.2', '2.11.1.3', '2.11.1.4']) {
      assert.ok(topics.has(id), `falta el apartado ${id}`);
    }
  });

  test('los cuatro numeros cuanticos NO se repiten: Pauli, comprobado', () => {
    /*
     * La demostracion del 2.11.1.1 tabula los cuatro numeros de cada electron
     * y cuenta cuantas combinaciones distintas hay. Que coincida con el numero
     * de electrones ES el principio de exclusion. Si el motor repartiera mal,
     * dejarian de coincidir — y esta prueba lo dice antes que el alumno.
     */
    const demo = topics.get('2.11.1.1')!.demo;
    assert.equal(demo?.kind, 'quantum-numbers');
    if (demo?.kind !== 'quantum-numbers') return;
    assert.equal(demo.total, 7, 'el nitrogeno tiene 7 electrones');
    assert.equal(demo.distinct, demo.total, 'hay dos electrones con los cuatro numeros iguales');
    for (const row of demo.rows) {
      assert.ok(row.l < row.n, `l = ${row.l} con n = ${row.n} es imposible`);
      assert.ok(Math.abs(row.ml) <= row.l, `m_l = ${row.ml} se sale del rango de l = ${row.l}`);
    }
  });

  test('la capacidad de cada capa se CUENTA y da 2n²', () => {
    const demo = topics.get('2.11.1.1')!.demo;
    if (demo?.kind !== 'quantum-numbers') return assert.fail('demo equivocada');
    for (const shell of demo.shells) {
      assert.equal(shell.orbitals, shell.n ** 2, `n=${shell.n}: orbitales`);
      assert.equal(shell.electrons, 2 * shell.n ** 2, `n=${shell.n}: electrones`);
      assert.equal(shell.subshells.length, shell.n, `n=${shell.n}: subcapas`);
    }
  });

  test('las anomalias del cromo y el cobre se senalan, no se corrigen', () => {
    const demo = topics.get('2.11.1.2')!.demo;
    if (demo?.kind !== 'configuration') return assert.fail('demo equivocada');
    const cr = demo.rows.find((r) => r.symbol === 'Cr')!;
    const cu = demo.rows.find((r) => r.symbol === 'Cu')!;
    assert.ok(cr.note, 'el cromo deberia venir con su motivo');
    assert.ok(cu.note, 'el cobre deberia venir con su motivo');
    assert.match(cr.condensed, /3d⁵/, 'el cromo es 3d⁵ 4s¹, no 3d⁴ 4s²');
    assert.match(cu.condensed, /3d¹⁰/, 'el cobre es 3d¹⁰ 4s¹');
  });

  test('Hund se ve en el recuento: sube a 3 en el nitrogeno y baja despues', () => {
    const demo = topics.get('2.11.1.3')!.demo;
    if (demo?.kind !== 'filling') return assert.fail('demo equivocada');
    const unpaired = (symbol: string) => demo.rows.find((r) => r.symbol === symbol)!.unpaired;
    assert.deepEqual(
      ['B', 'C', 'N', 'O', 'F', 'Ne'].map(unpaired),
      [1, 2, 3, 2, 1, 0],
      'el reparto del 2p no sigue la regla de Hund',
    );
  });

  test('el magnetismo se deduce del recuento, no se escribe', () => {
    const demo = topics.get('2.11.1.4')!.demo;
    if (demo?.kind !== 'magnetism') return assert.fail('demo equivocada');
    for (const row of demo.rows) {
      const expected = row.unpaired > 0 ? 'paramagnetico' : 'diamagnetico';
      assert.equal(row.behaviour, expected, `${row.label}: ${row.unpaired} desapareados`);
    }
    // El caso que da la vuelta a la intuicion, y que el ejercicio resuelto usa.
    const fe2 = demo.rows.find((r) => r.symbol === 'Fe' && r.charge === 2)!;
    const fe3 = demo.rows.find((r) => r.symbol === 'Fe' && r.charge === 3)!;
    assert.equal(fe2.unpaired, 4);
    assert.equal(fe3.unpaired, 5);
    assert.ok(fe3.unpaired > fe2.unpaired, 'quitar un electron al Fe²⁺ AUMENTA los desapareados');
  });

  test('las tendencias periodicas salen de los datos y declaran su hueco', () => {
    const demo = topics.get('2.11')!.demo;
    if (demo?.kind !== 'periodic-trend') return assert.fail('demo equivocada');

    const period = demo.series[0]!.rows;
    assert.ok(
      period[0]!.radius! > period[period.length - 1]!.radius!,
      'el radio deberia encoger a lo largo del periodo 3',
    );
    assert.ok(
      period[0]!.electronegativity! < period[period.length - 1]!.electronegativity!,
      'la electronegatividad deberia subir a lo largo del periodo 3',
    );

    const group = demo.series[1]!.rows;
    assert.ok(group[0]!.radius! < group[group.length - 1]!.radius!, 'el radio deberia crecer bajando');
    for (const row of group) {
      assert.equal(row.valence, 1, `${row.symbol}: los alcalinos tienen 1 electron de valencia`);
    }

    // §32: lo que no hay, se dice.
    assert.match(demo.gap, /ionizacion/i, 'el hueco declarado deberia nombrar lo que falta');
  });

  test('las figuras del 2.11 leen la ocupacion del motor, no la escriben', () => {
    /*
     * La escena del nitrogeno tiene que tener TRES nubes de un solo color
     * (Hund: uno por orbital, espines paralelos) y la del neon seis mezcladas.
     * Si alguien tocara el motor de llenado, estas figuras cambiarian con el
     * — que es justo lo que se quiere, y lo que esta prueba vigila.
     */
    const colores = (setId: string, sceneId: string) => {
      const scene = sceneSet(setId)!.scenes.find((s) => s.id === sceneId)!;
      return new Set(scene.structure.atoms.map((a) => a.color));
    };
    // Nitrogeno segun Hund: los tres espines iguales → un solo color.
    assert.equal(colores('llenado', 'hund-bien').size, 1);
    // Neon: los tres orbitales llenos → los dos espines presentes.
    assert.equal(colores('llenado', 'pauli').size, 2);
    // Boro: un electron y dos orbitales vacios → color de espin + gris.
    assert.equal(colores('llenado', 'vacio').size, 2);
  });

  test('el orden de los orbitales p es el que describe el pie de la figura', () => {
    /*
     * El pie dice «el de la izquierda apunta a los lados, el del medio hacia
     * ti y el de la derecha arriba y abajo». Eso depende de en que orden
     * devuelve el motor los tres orbitales y de como se reparten los ejes. Si
     * cambiara el orden, el texto pasaria a ser falso sin que nadie lo notara
     * mirando la figura — las tres nubes seguirian ahi.
     */
    const config = configureAtom('N')!;
    const p = config.subshells.find((s) => s.n === 2 && s.subshell === 'p')!;
    assert.deepEqual(
      p.orbitals.map((o) => o.ml),
      [-1, 0, 1],
      'el orden de m_l cambio y el pie de la figura ya no describe lo que se ve',
    );
    assert.deepEqual(p.orbitals.map((o) => orbitalName(o)), ['2px', '2pz', '2py']);
  });
});

// ---------------------------------------------------------------------------

describe('el lector del temario', () => {
  /*
   * Lo que estas pruebas vigilan es una DECISION, no un detalle.
   *
   * El temario se pintaba entero de una vez: 28.085 px en la unidad 2, y un
   * solo apartado llegaba a 12.703. Ahora se lee de uno en uno, y eso solo
   * funciona si la lista de apartados que recorre «siguiente» es EXACTAMENTE
   * la que pinta el indice y la que cuenta el «7 de 21». Si se separaran, el
   * lector veria un numero que no corresponde a donde esta.
   */
  // Las dos unidades tienen demostraciones de tipos distintos; el lector las
  // guarda con el tipo ya olvidado, y aqui se hace lo mismo para poder
  // recorrerlas juntas.
  const unidades: readonly TheoryTopic<unknown>[] = [unitMateria(), unitAtomo()];

  test('las dos unidades se recorren en el mismo orden que el indice', () => {
    for (const unidad of unidades) {
      const plana = flattenTopics(unidad);
      // Tantos apartados como nodos tiene el arbol, sin contar la raiz.
      const contar = (t: TheoryTopic<unknown>): number =>
        1 + (t.children ?? []).reduce((s, c) => s + contar(c), 0);
      assert.equal(plana.length, contar(unidad) - 1, `${unidad.id}: la lista plana no cuadra`);
      // Y en orden de lectura: un padre siempre antes que sus hijos.
      for (const topic of plana) {
        for (const child of topic.children ?? []) {
          assert.ok(
            plana.indexOf(topic) < plana.indexOf(child),
            `${unidad.id}: ${child.id} sale antes que su padre ${topic.id}`,
          );
        }
      }
    }
  });

  test('ningun apartado se queda sin salida', () => {
    // Todo apartado tiene anterior o siguiente: uno aislado seria un callejon
    // sin salida, porque ya no hay una columna por la que seguir bajando.
    for (const unidad of unidades) {
      const plana = flattenTopics(unidad);
      assert.ok(plana.length > 1, `${unidad.id}: hace falta mas de un apartado`);
      for (let i = 0; i < plana.length; i++) {
        assert.ok(i > 0 || plana[1], `${plana[i]!.id}: sin anterior ni siguiente`);
      }
    }
  });

  test('los identificadores no se repiten entre las dos unidades', () => {
    /*
     * Ahora las dos unidades comparten lector, e ir a un apartado es buscarlo
     * por su id en la unidad abierta y, si no esta, en la otra. Dos apartados
     * con el mismo id harian que un enlace llevara al de la unidad equivocada.
     */
    const ids = unidades.flatMap((u) => flattenTopics(u).map((t) => t.id));
    assert.equal(new Set(ids).size, ids.length, 'hay identificadores repetidos');
  });

  test('todo enlace «se conecta con» apunta a un apartado que existe', () => {
    // Antes bastaba con que existiera en la misma unidad. Ahora el lector
    // cambia de unidad solo, asi que se admite cualquiera de las dos — pero
    // tiene que existir en ALGUNA.
    const ids = new Set(unidades.flatMap((u) => flattenTopics(u).map((t) => t.id)));
    for (const unidad of unidades) {
      for (const topic of flattenTopics(unidad)) {
        for (const link of topic.connects ?? []) {
          if (!link.topic) continue;
          assert.ok(ids.has(link.topic), `${topic.id} enlaza a «${link.topic}», que no existe`);
        }
      }
    }
  });

  test('la segunda capa nunca se queda vacia ni se lo lleva todo', () => {
    /*
     * El reparto: arriba lo que contesta «¿que es esto?» y detras de las
     * pestanas lo que contesta «¿lo he entendido?». Un apartado que dejara
     * ARRIBA solo el titulo —sin cuerpo— habria escondido su contenido, que es
     * justo lo contrario de lo que se buscaba al ordenarlo en capas.
     */
    for (const unidad of unidades) {
      for (const topic of flattenTopics(unidad)) {
        assert.ok(topic.body.length > 40, `${topic.id}: sin cuerpo, la primera capa queda vacia`);
        const segunda = [topic.pitfall, topic.analogy, topic.worked, topic.check?.length].filter(Boolean);
        // No es obligatorio tener segunda capa; si la tiene, que se pueda
        // etiquetar. Lo que no vale es tenerla vacia de contenido util.
        if (topic.check) {
          for (const c of topic.check) {
            assert.ok(c.question.length > 10 && c.answer.length > 40, `${topic.id}: autocomprobacion pobre`);
          }
        }
        void segunda;
      }
    }
  });

  test('las figuras siguen colgando de apartados que existen en el lector', () => {
    // Con un apartado por pantalla, la figura solo se monta si su apartado se
    // abre: una figura colgada de un id inexistente no se veria nunca.
    for (const unidad of unidades) {
      for (const topic of flattenTopics(unidad)) {
        if (!topic.figure) continue;
        assert.ok(sceneSet(topic.figure), `${topic.id}: figura «${topic.figure}» inexistente`);
      }
    }
  });
});

// ---------------------------------------------------------------------------

describe('las tarjetas de repaso', () => {
  const unidades: readonly TheoryTopic<unknown>[] = [unitMateria(), unitAtomo()];

  test('TODO apartado tiene al menos una tarjeta', () => {
    /*
     * La peticion era literal: una tarjeta por tema. Y es una regla que hay
     * que vigilar, porque las tarjetas se DERIVAN — un apartado nuevo sin
     * autocomprobacion ni ejercicio no daria error en ninguna parte: se
     * quedaria sin tarjeta y nadie se enteraria hasta abrirlo.
     */
    for (const unidad of unidades) {
      for (const topic of flattenTopics(unidad)) {
        assert.ok(cardsOf(topic).length > 0, `${topic.id} «${topic.title}» se quedo sin tarjeta`);
      }
    }
  });

  test('ninguna tarjeta se inventa: todas salen del apartado', () => {
    // Es la razon de que este modulo derive en lugar de guardar. Si una
    // tarjeta pudiera existir sin estar en el temario, seria una segunda
    // version de la misma quimica, libre de contradecir a la primera.
    for (const unidad of unidades) {
      for (const topic of flattenTopics(unidad)) {
        const propias = [
          ...(topic.check ?? []).map((c) => c.question),
          ...(topic.worked ? [topic.worked.question] : []),
        ];
        for (const card of cardsOf(topic)) {
          assert.ok(propias.includes(card.front), `${card.id}: su pregunta no esta en el apartado`);
          assert.equal(card.topicId, topic.id);
        }
      }
    }
  });

  test('los identificadores son unicos y estables', () => {
    /*
     * Con el id se guarda lo que el lector ya se sabe. Uno repetido haria que
     * marcar una tarjeta marcara otra; uno que dependiera de la posicion se
     * desplazaria entero al insertar una tarjeta en medio, y el progreso
     * quedaria movido de sitio sin que nadie lo tocara.
     */
    const ids = unidades.flatMap((u) => deckOf(u).map((c) => c.id));
    assert.equal(new Set(ids).size, ids.length, 'hay identificadores repetidos');
    for (const id of ids) assert.match(id, /^[\d.]+#[ce]\d+$/, `id con forma rara: ${id}`);

    // Y el mismo apartado da siempre los mismos ids, en el mismo orden.
    const primera = deckOf(unitAtomo()).map((c) => c.id);
    const segunda = deckOf(unitAtomo()).map((c) => c.id);
    assert.deepEqual(primera, segunda);
  });

  test('una tarjeta pregunta algo y responde algo', () => {
    // Una cara delantera de tres palabras no obliga a recordar nada, y una
    // trasera de dos no explica: seria un cromo, no una tarjeta.
    for (const unidad of unidades) {
      for (const card of deckOf(unidad)) {
        assert.ok(card.front.length > 25, `${card.id}: pregunta demasiado escueta`);
        assert.ok(card.back.length > 60, `${card.id}: respuesta demasiado escueta`);
        assert.notEqual(card.front, card.back, `${card.id}: la respuesta repite la pregunta`);
      }
    }
  });

  test('las preguntas estan escritas en espanol, con su signo de apertura', () => {
    // Una «¿» que falta no rompe nada y se cuela sin que nadie la vea; en una
    // tarjeta, que es una frase sola en medio de una pantalla, canta.
    for (const unidad of unidades) {
      for (const card of deckOf(unidad)) {
        const q = card.front.trim();
        if (!q.endsWith('?')) continue;
        assert.ok(q.includes('¿'), `${card.id}: pregunta sin «¿» de apertura`);
      }
    }
  });

  test('barajar conserva el mazo entero', () => {
    // Una baraja que pierde o duplica tarjetas es peor que no barajar: el
    // lector creeria haber repasado algo que nunca vio.
    const deck = deckOf(unitMateria());
    for (const seed of [1, 7, 4242, 99991]) {
      const mezclado = shuffle(deck, seed);
      assert.equal(mezclado.length, deck.length);
      assert.deepEqual(
        [...mezclado].map((c) => c.id).sort(),
        [...deck].map((c) => c.id).sort(),
        `semilla ${seed}: el mazo cambio de contenido`,
      );
    }
  });

  test('la misma semilla da siempre el mismo orden, y semillas distintas no', () => {
    const deck = deckOf(unitAtomo());
    assert.deepEqual(shuffle(deck, 33).map((c) => c.id), shuffle(deck, 33).map((c) => c.id));
    assert.notDeepEqual(shuffle(deck, 33).map((c) => c.id), shuffle(deck, 34).map((c) => c.id));
  });

  test('el recuento de sabidas no cuenta lo que no esta en el mazo', () => {
    const deck = deckOf(unitMateria());
    const known = new Set([deck[0]!.id, deck[1]!.id, '9.9.9#c0']);
    assert.equal(progressOf(deck, known), 2, 'una tarjeta ajena al mazo no deberia sumar');
    assert.equal(progressOf(deck, new Set()), 0);
  });

  test('el ejercicio resuelto va antes que las autocomprobaciones', () => {
    // Es la que mas cuesta y la que se contesta calculando: llega primera, con
    // la cabeza despejada.
    for (const unidad of unidades) {
      for (const topic of flattenTopics(unidad)) {
        if (!topic.worked) continue;
        assert.equal(cardsOf(topic)[0]!.from, 'ejercicio', `${topic.id}: el ejercicio no va primero`);
      }
    }
  });

  test('hay tarjetas suficientes para que el mazo signifique algo', () => {
    const total = unidades.reduce((n, u) => n + deckOf(u).length, 0);
    assert.ok(total >= 60, `solo ${total} tarjetas en total`);
  });
});

// ---------------------------------------------------------------------------

describe('el arbol del conocimiento', () => {
  const units = [unitMateria(), unitAtomo()] as unknown as TheoryTopic<never>[];
  const tree = knowledgeTree(units);
  const ids = new Set(tree.nodes.map((n) => n.id));

  test('no hay ciclos: siempre hay por donde empezar', () => {
    /*
     * LA prueba de este modulo.
     *
     * `requires` significa «esto va antes». Un ciclo ahi —A necesita B, B
     * necesita C, C necesita A— no es un detalle de dibujo: es un temario sin
     * punto de entrada, tres apartados que no se pueden estudiar en ningun
     * orden. Y es facilisimo de introducir sin darse cuenta al anadir una
     * dependencia «obvia» en el sentido contrario, que es justo lo que hace
     * `connects` a todas horas.
     */
    const salientes = new Map<string, string[]>();
    for (const edge of tree.edges) {
      salientes.set(edge.from, [...(salientes.get(edge.from) ?? []), edge.to]);
    }

    const estado = new Map<string, 'abierto' | 'cerrado'>();
    const camino: string[] = [];

    const visitar = (id: string): string[] | null => {
      if (estado.get(id) === 'cerrado') return null;
      if (estado.get(id) === 'abierto') return [...camino.slice(camino.indexOf(id)), id];

      estado.set(id, 'abierto');
      camino.push(id);
      for (const siguiente of salientes.get(id) ?? []) {
        const ciclo = visitar(siguiente);
        if (ciclo) return ciclo;
      }
      camino.pop();
      estado.set(id, 'cerrado');
      return null;
    };

    for (const node of tree.nodes) {
      const ciclo = visitar(node.id);
      assert.equal(ciclo, null, `ciclo: ${ciclo?.join(' → ')}`);
    }
  });

  test('toda dependencia declarada apunta a algo que existe', () => {
    // Una dependencia a un apartado inexistente no rompe nada: la arista
    // simplemente no se dibuja, y el nodo aparece flotando en la capa 0 como
    // si no necesitara nada. Silencioso y falso.
    for (const node of tree.nodes) {
      for (const required of node.requires) {
        assert.ok(ids.has(required), `${node.id} depende de «${required}», que no existe`);
        assert.notEqual(required, node.id, `${node.id} depende de si mismo`);
      }
    }
  });

  test('todo apartado del temario esta en el arbol, exactamente una vez', () => {
    // El arbol se construye recorriendo las unidades, asi que no puede
    // perderse ninguno — pero si puede duplicarse un identificador, y entonces
    // dos apartados distintos compartirian nodo.
    const delTemario = units.flatMap((u) => flattenTopics(u).map((t) => t.id));
    for (const id of delTemario) {
      assert.equal(
        tree.nodes.filter((n) => n.id === id).length,
        1,
        `${id} no aparece exactamente una vez en el arbol`,
      );
    }
    assert.equal(tree.nodes.length, delTemario.length + plannedBranches().length);
  });

  test('las capas respetan las dependencias: nada va antes de lo que necesita', () => {
    /*
     * Es la propiedad que hace que el mapa signifique algo. Si un nodo cayera
     * en la misma capa que algo que necesita, o antes, el dibujo diria que se
     * pueden estudiar a la vez — y estaria mintiendo sobre el orden.
     */
    const capaDe = new Map<string, number>();
    tree.layers.forEach((capa, i) => capa.forEach((n) => capaDe.set(n.id, i)));

    for (const edge of tree.edges) {
      const antes = capaDe.get(edge.from)!;
      const despues = capaDe.get(edge.to)!;
      assert.ok(
        antes < despues,
        `${edge.from} (capa ${antes}) deberia ir antes que ${edge.to} (capa ${despues})`,
      );
    }
  });

  test('la capa 0 son los apartados que no necesitan nada previo', () => {
    for (const node of tree.layers[0]!) {
      assert.equal(
        node.requires.filter((r) => ids.has(r)).length,
        0,
        `${node.id} esta en la capa 0 pero declara dependencias`,
      );
    }
    // Y tiene que haber al menos uno, o no habria por donde entrar.
    assert.ok(tree.layers[0]!.length > 0, 'ningun apartado de entrada');
  });

  test('las aristas que cruzan de unidad existen y estan marcadas', () => {
    /*
     * Son la razon de ser del mapa: leyendo el temario de arriba abajo no hay
     * forma de ver que la ley de las proporciones multiples (1.8.3) es lo que
     * empuja a los modelos atomicos (2.2.1.2), porque estan en unidades
     * distintas y a cuarenta pantallas.
     */
    const cruzan = tree.edges.filter((e) => e.crossesUnit);
    assert.ok(cruzan.length >= 3, `solo ${cruzan.length} aristas entre unidades`);
    assert.ok(
      cruzan.some((e) => e.from === '1.8.3' && e.to === '2.2.1.2'),
      'falta la arista 1.8.3 → 2.2.1.2, que es el puente entre las dos unidades',
    );
    // Y ninguna marcada de mas.
    for (const edge of tree.edges) {
      const deVerdad = edge.from.split('.')[0] !== edge.to.split('.')[0];
      assert.equal(edge.crossesUnit, deVerdad, `${edge.from} → ${edge.to}: marca equivocada`);
    }
  });

  test('toda rama prevista cuelga de algo que ya existe', () => {
    /*
     * Una rama prevista que no dependa de nada real seria una nota suelta, no
     * una ubicacion. El encargo era poder UBICAR los temas futuros, y ubicar
     * significa engancharlos a algo.
     */
    const reales = new Set(units.flatMap((u) => flattenTopics(u).map((t) => t.id)));
    const alcanzaAlgoReal = (id: string, visto = new Set<string>()): boolean => {
      if (visto.has(id)) return false;
      visto.add(id);
      const node = tree.nodes.find((n) => n.id === id);
      return (node?.requires ?? []).some((r) => reales.has(r) || alcanzaAlgoReal(r, visto));
    };
    for (const branch of plannedBranches()) {
      assert.ok(branch.requires.length > 0, `${branch.title} no cuelga de nada`);
      assert.ok(alcanzaAlgoReal(branch.id), `${branch.title} no llega a ningun apartado real`);
    }
  });

  test('cada rama prevista dice que tiene y que le falta (§32)', () => {
    for (const branch of plannedBranches()) {
      assert.ok(branch.note && branch.note.length > 60, `${branch.title}: sin explicacion`);
      assert.equal(branch.state, 'previsto');
      // Si declara motor, que sea una ruta de fichero de verdad.
      if (branch.engine) {
        assert.match(branch.engine, /\.ts|\//, `${branch.title}: «${branch.engine}» no parece un modulo`);
      }
    }
    // Y al menos varias tienen motor ya escrito: es lo que hace util el mapa.
    assert.ok(
      plannedBranches().filter((b) => b.engine).length >= 5,
      'el mapa deberia senalar las ramas que ya tienen motor',
    );
  });

  test('«antes de esto» y «esto abre» son coherentes entre si', () => {
    // Si A abre B, B tiene que tener a A antes. Son la misma arista leida en
    // los dos sentidos, y el pie del apartado las muestra por separado.
    for (const node of tree.nodes) {
      for (const after of neighbours(tree, node.id).after) {
        assert.ok(
          neighbours(tree, after.id).before.some((b) => b.id === node.id),
          `${node.id} abre ${after.id}, pero ${after.id} no lo tiene antes`,
        );
      }
    }
  });

  test('`requires` no es una copia de `connects`', () => {
    /*
     * Se intento derivar el arbol de `connects` y no valia: es lateral y va en
     * los dos sentidos. Esta prueba fija esa distincion — si alguien empezara
     * a rellenar `requires` copiando los `connects`, apareceria un par
     * reciproco y el arbol tendria un ciclo.
     */
    const pares = new Set(tree.edges.map((e) => `${e.from}>${e.to}`));
    for (const edge of tree.edges) {
      assert.ok(
        !pares.has(`${edge.to}>${edge.from}`),
        `${edge.from} y ${edge.to} se necesitan mutuamente: eso es un «connects», no un «requires»`,
      );
    }
  });
});
