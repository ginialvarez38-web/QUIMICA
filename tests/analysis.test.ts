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
