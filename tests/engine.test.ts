/**
 * Pruebas del motor quimico: prediccion, redox, solubilidad, rutas,
 * termodinamica y estequiometria.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { predict, reactionsAvailableFor } from '../src/engine/predict.js';
import { analyzeRedox, ionicTransferSteps } from '../src/engine/redox.js';
import { solubilityOf, splitSalt } from '../src/engine/rules/solubility.js';
import { displaces, reactsWithAcid, halogenDisplaces } from '../src/engine/rules/activity.js';
import { analyzeEnergy, crossoverTemperature, gibbsAt } from '../src/engine/energy.js';
import { findRoute, findAllRoutes, compareRoutes, NODES, EDGES, neighbourhood } from '../src/engine/graph.js';
import { toMoles, analyzeStoichiometry, percentYield, idealGas, molarity } from '../src/engine/stoichiometry.js';
import { REACTIONS, getReaction } from '../src/data/reactions.js';
import { SPECIES, getSpecies } from '../src/data/species.js';
import { oxidationStatesOfFormula } from '../src/core/oxidation.js';
import { explain, explainSubstance } from '../src/teach/explain.js';
import { formatEquation } from '../src/core/formula/render.js';
import { parseFormula } from '../src/core/formula/parse.js';
import { classifyFormula } from '../src/core/classify.js';
import { buildStructure } from '../src/geometry/vsepr.js';

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: string; detail?: string }): T {
  if (!r.ok) throw new Error(`${r.error} ${r.detail ?? ''}`);
  return r.value;
}

// ---------------------------------------------------------------------------

describe('integridad de la base de datos', () => {
  test('todas las reacciones curadas estan balanceadas', () => {
    // El modulo lanzaria al cargarse si no fuera asi, pero se comprueba
    // explicitamente porque es la garantia central del diseno.
    for (const r of REACTIONS) {
      assert.equal(r.equation.balanced, true, `${r.id} deberia estar balanceada`);
      assert.ok(r.equation.reactants.every((t) => t.coefficient > 0), `${r.id}: coeficientes positivos`);
      assert.ok(r.equation.products.every((t) => t.coefficient > 0), `${r.id}: coeficientes positivos`);
    }
  });

  test('toda reaccion explica por que ocurre', () => {
    for (const r of REACTIONS) {
      assert.ok(r.explanation.length > 60, `${r.id} necesita una explicacion de verdad`);
    }
  });

  test('toda sustancia de la biblioteca tiene masa molar calculada', () => {
    for (const s of SPECIES) {
      assert.ok(
        (s.properties.molarMass.value ?? 0) > 0,
        `${s.formula} deberia tener masa molar`,
      );
    }
  });

  test('las especies referidas por las reacciones existen en la biblioteca', () => {
    const missing: string[] = [];
    for (const r of REACTIONS) {
      for (const t of [...r.equation.reactants, ...r.equation.products]) {
        if (!getSpecies(t.formula)) missing.push(`${r.id}: ${t.formula}`);
      }
    }
    assert.deepEqual(missing, [], 'toda formula usada deberia tener ficha');
  });

  test('ningun dato numerico esta inventado: o hay valor o hay null', () => {
    for (const s of SPECIES) {
      const p = s.properties;
      for (const m of [p.density, p.meltingPoint, p.boilingPoint, p.deltaHf, p.pKa]) {
        assert.ok(m.value === null || Number.isFinite(m.value), `${s.formula}: valor no finito`);
        // Si hay valor, debe traer procedencia.
        if (m.value !== null) assert.ok(m.provenance, `${s.formula}: valor sin procedencia`);
      }
    }
  });
});

// ---------------------------------------------------------------------------

describe('reglas de solubilidad', () => {
  test('separa sales en cation y anion', () => {
    assert.deepEqual(splitSalt('NaCl'), { cation: 'Na', anion: 'Cl' });
    assert.deepEqual(splitSalt('CaCO3'), { cation: 'Ca', anion: 'CO3' });
    assert.deepEqual(splitSalt('Al2(SO4)3'), { cation: 'Al', anion: 'SO4' });
    assert.deepEqual(splitSalt('NH4NO3'), { cation: 'NH4', anion: 'NO3' });
  });

  test('todos los nitratos y las sales de alcalinos son solubles', () => {
    assert.equal(solubilityOf('NaNO3').solubility, 'soluble');
    assert.equal(solubilityOf('KNO3').solubility, 'soluble');
    assert.equal(solubilityOf('Na2CO3').solubility, 'soluble');
  });

  test('las excepciones clasicas precipitan', () => {
    assert.equal(solubilityOf('AgCl').solubility, 'insoluble');
    assert.equal(solubilityOf('BaSO4').solubility, 'insoluble');
    assert.equal(solubilityOf('PbI2').solubility, 'insoluble');
    assert.equal(solubilityOf('CaCO3').solubility, 'insoluble');
  });

  test('el dato medido gana a la regla general', () => {
    // El Ca(OH)2 es "poco soluble", matiz que la regla binaria perderia.
    const v = solubilityOf('Ca(OH)2');
    assert.equal(v.solubility, 'slightly-soluble');
    assert.equal(v.source, 'curated');
  });

  test('cada veredicto trae el enunciado de su regla', () => {
    assert.ok(solubilityOf('AgBr').rule.length > 20);
  });
});

// ---------------------------------------------------------------------------

describe('serie de actividad', () => {
  test('el zinc desplaza al cobre, pero no al reves', () => {
    assert.equal(displaces('Zn', 'Cu').displaces, true);
    assert.equal(displaces('Cu', 'Zn').displaces, false);
  });

  test('el potencial de celda tiene el signo correcto', () => {
    const v = displaces('Zn', 'Cu');
    // E = E(cat) - E(an) = 0.34 - (-0.76) = 1.10 V, la pila Daniell.
    assert.ok(Math.abs(v.cellPotential! - 1.1) < 0.01, `obtenido ${v.cellPotential}`);
  });

  test('solo los metales por encima del hidrogeno reaccionan con acidos', () => {
    assert.equal(reactsWithAcid('Zn').displaces, true);
    assert.equal(reactsWithAcid('Mg').displaces, true);
    assert.equal(reactsWithAcid('Fe').displaces, true);
    assert.equal(reactsWithAcid('Cu').displaces, false);
    assert.equal(reactsWithAcid('Ag').displaces, false);
    assert.equal(reactsWithAcid('Au').displaces, false);
  });

  test('los halogenos siguen su propio orden', () => {
    assert.equal(halogenDisplaces('Cl', 'Br').displaces, true);
    assert.equal(halogenDisplaces('Cl', 'I').displaces, true);
    assert.equal(halogenDisplaces('I', 'Cl').displaces, false);
  });
});

// ---------------------------------------------------------------------------

describe('estados de oxidacion en sales poliatomicas', () => {
  const state = (f: string, sym: string): number =>
    unwrap(oxidationStatesOfFormula(f)).assignments.find((a) => a.symbol === sym)!.state;

  test('el reconocimiento del oxoanion resuelve lo que el balance de carga solo no puede', () => {
    // ZnSO4 tiene dos incognitas (Zn y S) y una sola ecuacion de carga.
    // Solo reconociendo el sulfato se puede resolver.
    assert.equal(state('ZnSO4', 'Zn'), 2);
    assert.equal(state('ZnSO4', 'S'), 6);
    assert.equal(state('CuSO4', 'Cu'), 2);
    assert.equal(state('FeSO4', 'Fe'), 2);
    assert.equal(state('Fe2(SO4)3', 'Fe'), 3);
    assert.equal(state('Fe2(SO4)3', 'S'), 6);
    assert.equal(state('Ca3(PO4)2', 'Ca'), 2);
    assert.equal(state('Ca3(PO4)2', 'P'), 5);
    assert.equal(state('AgNO3', 'Ag'), 1);
    assert.equal(state('Pb(NO3)2', 'Pb'), 2);
  });

  test('la suma sigue cuadrando con la carga', () => {
    for (const f of ['ZnSO4', 'Fe2(SO4)3', 'Ca3(PO4)2', 'K2Cr2O7', 'NaHCO3']) {
      const r = unwrap(oxidationStatesOfFormula(f));
      assert.equal(r.consistent, true, `${f}: ${r.balanceText}`);
      assert.equal(r.sum, 0);
    }
  });
});

// ---------------------------------------------------------------------------

describe('analisis redox', () => {
  test('Zn + Cu2+ da las semirreacciones del brief (§17)', () => {
    const p = predict(['Zn', 'CuSO4']).predictions[0]!;
    const a = analyzeRedox(p.equation);
    assert.equal(a.isRedox, true);
    assert.equal(a.reducingAgent, 'Zn');
    assert.equal(a.oxidizingAgent, 'CuSO4');
    assert.equal(a.electronsTransferred, 2);
    const texts = a.halfReactions.map((h) => h.text);
    assert.deepEqual(texts, ['Zn → Zn²⁺ + 2e⁻', 'Cu²⁺ + 2e⁻ → Cu']);
  });

  test('una neutralizacion NO es redox', () => {
    const p = predict(['HCl', 'NaOH']).predictions[0]!;
    const a = analyzeRedox(p.equation);
    assert.equal(a.isRedox, false);
    assert.match(a.explanation, /NO es una reaccion redox/);
  });

  test('una precipitacion NO es redox', () => {
    const p = predict(['AgNO3', 'NaCl']).predictions[0]!;
    assert.equal(analyzeRedox(p.equation).isRedox, false);
  });

  test('detecta la desproporcion del peroxido de hidrogeno', () => {
    const a = analyzeRedox(getReaction('h2o2-descomposicion')!.equation);
    assert.equal(a.isRedox, true);
    assert.equal(a.isDisproportionation, true);
    assert.match(a.explanation, /DESPROPORCION/);
  });

  test('el que se oxida es el agente reductor', () => {
    const a = analyzeRedox(getReaction('fe2o3-al-termita')!.equation);
    assert.equal(a.reducingAgent, 'Al');
    assert.equal(a.oxidizingAgent, 'Fe2O3');
  });

  test('modo ionico: transferencia electronica paso a paso (§16)', () => {
    const t = ionicTransferSteps('Na', 1, 'Cl', -1, 'NaCl');
    assert.equal(t.steps[0], 'Na → Na⁺ + 1e⁻');
    assert.equal(t.steps[1], 'Cl + 1e⁻ → Cl⁻');
    assert.match(t.steps[2]!, /NaCl/);
  });
});

// ---------------------------------------------------------------------------

describe('prediccion de reacciones', () => {
  test('el ejemplo del brief: HCl + NaOH', () => {
    const r = predict(['HCl', 'NaOH']);
    assert.ok(r.predictions.length >= 1);
    const p = r.predictions[0]!;
    assert.deepEqual([...p.products].sort(), ['H2O', 'NaCl']);
    assert.ok(p.types.includes('neutralization'));
    assert.equal(formatEquation(p.equation), 'HCl + NaOH → NaCl + H₂O');
  });

  test('Fe + O2 devuelve VARIAS alternativas y avisa (§23, §32)', () => {
    const r = predict(['Fe', 'O2']);
    assert.ok(r.predictions.length >= 2, 'deberia ofrecer FeO y Fe2O3');
    assert.equal(r.conditionDependent, true);
    const products = r.predictions.map((p) => p.products.join(''));
    assert.ok(products.includes('FeO'));
    assert.ok(products.includes('Fe2O3'));
  });

  test('la combustion distingue completa de incompleta', () => {
    const r = predict(['CH4', 'O2']);
    const products = r.predictions.map((p) => p.products.join('+'));
    assert.ok(products.some((p) => p.includes('CO2')));
    assert.ok(products.some((p) => p.includes('CO') && !p.includes('CO2')));
    assert.equal(r.conditionDependent, true);
  });

  test('sin fuerza motriz no hay reaccion, y se explica por que', () => {
    const r = predict(['NaCl', 'KNO3']);
    const p = r.predictions[0];
    if (p) {
      assert.equal(p.evidence, 'unknown');
      assert.match(p.explanation, /NO HAY REACCION|solubles/i);
    }
  });

  test('un metal por debajo del otro no reacciona, y el motor lo justifica', () => {
    const r = predict(['Cu', 'ZnSO4']);
    assert.equal(r.predictions.length, 0);
    assert.match(r.message, /NO HAY REACCION/);
    assert.match(r.message, /serie de actividad/);
  });

  test('un metal por debajo del hidrogeno no ataca a un acido no oxidante', () => {
    const r = predict(['Cu', 'HCl']);
    assert.equal(r.predictions.length, 0);
    assert.match(r.message, /por debajo del hidrogeno/);
  });

  test('toda prediccion sale balanceada', () => {
    for (const reagents of [
      ['HCl', 'NaOH'], ['AgNO3', 'NaCl'], ['Zn', 'CuSO4'], ['CaO', 'H2O'],
      ['Fe', 'O2'], ['CH4', 'O2'], ['CaCO3', 'HCl'], ['Na', 'Cl2'],
    ]) {
      for (const p of predict(reagents).predictions) {
        assert.equal(p.equation.balanced, true, `${reagents.join('+')} → ${p.products.join('+')}`);
      }
    }
  });

  test('"¿que puedo hacer con esto?" devuelve las reacciones disponibles (§20)', () => {
    const available = reactionsAvailableFor('CaO');
    const products = available.map((p) => p.products.join('+'));
    assert.ok(available.length >= 3, `CaO deberia tener varias salidas, hay ${available.length}`);
    assert.ok(products.some((p) => p.includes('Ca(OH)2')));
    assert.ok(products.some((p) => p.includes('CaCO3')));
    assert.ok(products.some((p) => p.includes('CaCl2')));
  });
});

// ---------------------------------------------------------------------------

describe('termodinamica', () => {
  test('la combustion del metano es exotermica, con el valor conocido', () => {
    const e = analyzeEnergy(getReaction('ch4-combustion')!.equation);
    // ΔH = [(-393.5) + 2(-285.8)] - [(-74.6) + 0] = -890.5 kJ/mol
    assert.ok(Math.abs(e.profile.deltaH.value! - -890.5) < 1.0, `obtenido ${e.profile.deltaH.value}`);
    assert.equal(e.profile.character, 'exothermic');
  });

  test('el apagado de la cal es exotermico', () => {
    const e = analyzeEnergy(getReaction('cao-h2o-caoh2')!.equation);
    // ΔH = -986.1 - (-635.1 - 285.8) = -65.2 kJ/mol
    assert.ok(e.profile.deltaH.value! < 0);
    assert.match(e.summary, /EXOTERMICA/);
  });

  test('la calcinacion de la caliza es endotermica', () => {
    const e = analyzeEnergy(getReaction('caco3-calcinacion')!.equation);
    // ΔH = (-635.1 - 393.5) - (-1206.9) = +178.3 kJ/mol
    assert.ok(Math.abs(e.profile.deltaH.value! - 178.3) < 1.0, `obtenido ${e.profile.deltaH.value}`);
    assert.equal(e.profile.character, 'endothermic');
  });

  test('cuando falta un dato NO se estima: se dice cual falta', () => {
    const e = analyzeEnergy(getReaction('esterificacion-fischer')!.equation);
    if (e.profile.deltaH.value === null) {
      assert.match(e.summary, /Datos no disponibles/);
      assert.ok(e.missingEnthalpy.length > 0);
    }
  });

  test('la energia de activacion NUNCA se estima', () => {
    for (const r of REACTIONS) {
      assert.equal(analyzeEnergy(r.equation).profile.activationEnergy.value, null);
    }
  });

  test('temperatura de cruce solo cuando entalpia y entropia se oponen', () => {
    // ΔH>0 y ΔS>0: depende de la temperatura.
    assert.ok(crossoverTemperature(178.3, 160.6)! > 1000);
    // ΔH<0 y ΔS>0: espontanea siempre, no hay cruce.
    assert.equal(crossoverTemperature(-100, 50), null);
    // ΔH>0 y ΔS<0: nunca espontanea, no hay cruce.
    assert.equal(crossoverTemperature(100, -50), null);
  });

  test('la calcinacion se hace espontanea a alta temperatura', () => {
    const e = analyzeEnergy(getReaction('caco3-calcinacion')!.equation);
    const cold = gibbsAt(e.profile.deltaH.value, e.profile.deltaS.value, 298.15);
    const hot = gibbsAt(e.profile.deltaH.value, e.profile.deltaS.value, 1200);
    assert.ok(cold.value! > 0, 'a 25 C no deberia ser espontanea');
    assert.ok(hot.value! < 0, 'a 927 C si deberia serlo');
  });
});

// ---------------------------------------------------------------------------

describe('red de transformaciones', () => {
  test('el grafo tiene nodos y aristas', () => {
    assert.ok(NODES.length > 40);
    assert.ok(EDGES.length > 40);
  });

  test('la cadena del calcio del brief (§1) sale del grafo', () => {
    const route = findRoute('Ca', 'CaCO3')!;
    assert.ok(route);
    assert.deepEqual([...route.nodes], ['Ca', 'CaO', 'CaCO3']);
    assert.deepEqual([...route.requiredReagents].sort(), ['CO2', 'O2']);
  });

  test('la ruta del azufre al acido sulfurico (§45)', () => {
    const route = findRoute('S', 'H2SO4')!;
    assert.deepEqual([...route.nodes], ['S', 'SO2', 'SO3', 'H2SO4']);
    assert.equal(route.length, 3);
  });

  test('hay rutas alternativas y se pueden explorar (§21)', () => {
    const routes = findAllRoutes('Ca', 'CaCO3');
    assert.ok(routes.length >= 2, `deberia haber varias rutas, hay ${routes.length}`);
    const asText = routes.map((r) => r.nodes.join('>'));
    assert.ok(asText.includes('Ca>CaO>CaCO3'));
    assert.ok(asText.some((r) => r.includes('Ca(OH)2')));
  });

  test('las rutas se pueden comparar (§42)', () => {
    const routes = findAllRoutes('Ca', 'CaCO3');
    const short = routes[0]!;
    const long = routes.find((r) => r.length > short.length)!;
    const cmp = compareRoutes(short, long);
    assert.ok(cmp.rows.length >= 5);
    assert.equal(cmp.rows.find((r) => r.criterion === 'Numero de pasos')!.better, 'a');
    assert.ok(cmp.summary.length > 40);
  });

  test('devuelve null cuando no hay ruta, en lugar de inventarla', () => {
    assert.equal(findRoute('NaCl', 'C6H6'), null);
  });

  test('el vecindario de una sustancia es un subgrafo conexo', () => {
    const view = neighbourhood('CaO', 1);
    assert.ok(view.nodes.some((n) => n.id === 'CaO'));
    assert.ok(view.nodes.length > 2);
    for (const e of view.edges) {
      assert.ok(view.nodes.some((n) => n.id === e.from));
      assert.ok(view.nodes.some((n) => n.id === e.to));
    }
  });
});

// ---------------------------------------------------------------------------

describe('estequiometria (§26)', () => {
  test('conversion de masa a moles', () => {
    const r = unwrap(toMoles({ formula: 'CaCO3', value: 2.0, unit: 'g' }));
    // M(CaCO3) = 100.086 g/mol
    assert.ok(Math.abs(r.moles - 0.019983) < 1e-5, `obtenido ${r.moles}`);
    assert.match(r.derivation, /n = m \/ M/);
  });

  test('conversion de volumen y molaridad a moles', () => {
    const r = unwrap(toMoles({ formula: 'HCl', value: 50, unit: 'mL', molarity: 1.0 }));
    assert.ok(Math.abs(r.moles - 0.05) < 1e-9);
    assert.match(r.derivation, /n = M · V/);
  });

  test('un volumen sin molaridad solo vale para gases', () => {
    assert.equal(toMoles({ formula: 'CaCO3', value: 1, unit: 'L' }).ok, false);
    assert.equal(toMoles({ formula: 'CO2', value: 22.414, unit: 'L' }).ok, true);
  });

  test('el ejemplo exacto del brief: 2,00 g de CaCO3 en 50 mL de HCl 1,0 M', () => {
    const reaction = getReaction('caco3-hcl')!;
    const caco3 = unwrap(toMoles({ formula: 'CaCO3', value: 2.0, unit: 'g' }));
    const hcl = unwrap(toMoles({ formula: 'HCl', value: 50, unit: 'mL', molarity: 1.0 }));

    const result = unwrap(
      analyzeStoichiometry(
        reaction.equation,
        new Map([['CaCO3', caco3.moles], ['HCl', hcl.moles]]),
      ),
    );

    // CaCO3: 0.01998 / 1 = 0.01998 ; HCl: 0.05 / 2 = 0.025
    // El limitante es el carbonato.
    assert.equal(result.limitingReagent, 'CaCO3');
    const hclRow = result.reagents.find((r) => r.formula === 'HCl')!;
    assert.ok(hclRow.molesExcess > 0, 'deberia sobrar acido');
    assert.ok(Math.abs(hclRow.molesExcess - 0.01003) < 1e-4, `sobra ${hclRow.molesExcess}`);

    const co2 = result.products.find((p) => p.formula === 'CO2')!;
    assert.ok(Math.abs(co2.molesProduced - 0.019983) < 1e-5);
    assert.ok(co2.litresIfGas !== null, 'el CO2 es un gas: deberia dar volumen');
    assert.ok(Math.abs(co2.litresIfGas! - 0.4479) < 1e-3, `obtenido ${co2.litresIfGas}`);
  });

  test('una mezcla estequiometrica no deja exceso', () => {
    const reaction = getReaction('hcl-naoh')!;
    const r = unwrap(analyzeStoichiometry(reaction.equation, new Map([['HCl', 0.1], ['NaOH', 0.1]])));
    assert.ok(r.reagents.every((x) => Math.abs(x.molesExcess) < 1e-12));
    assert.match(r.explanation, /estequiometrica/);
  });

  test('exige las cantidades de TODOS los reactivos', () => {
    const reaction = getReaction('caco3-hcl')!;
    const r = analyzeStoichiometry(reaction.equation, new Map([['CaCO3', 0.02]]));
    assert.equal(r.ok, false);
  });

  test('rendimiento porcentual, incluido el caso imposible', () => {
    assert.ok(Math.abs(unwrap(percentYield(10, 8.5)).percentYield - 85) < 1e-9);
    const impossible = unwrap(percentYield(10, 12));
    assert.match(impossible.explanation, /IMPOSIBLE/);
  });

  test('ley de los gases ideales', () => {
    const r = unwrap(idealGas({ pressure: 1, volume: null, moles: 1, temperature: 273.15 }));
    assert.ok(Math.abs(r.solved.volume! - 22.41) < 0.02, `obtenido ${r.solved.volume}`);
  });

  test('la ley de los gases exige exactamente una incognita', () => {
    assert.equal(idealGas({ pressure: null, volume: null, moles: 1, temperature: 273 }).ok, false);
    assert.equal(idealGas({ pressure: 1, volume: 1, moles: 1, temperature: 273 }).ok, false);
  });

  test('molaridad', () => {
    const r = unwrap(molarity('NaCl', 5.844, 1.0));
    assert.ok(Math.abs(r.molarity - 0.1) < 0.001, `obtenido ${r.molarity}`);
  });
});

// ---------------------------------------------------------------------------

describe('modo profesor (§34)', () => {
  test('responde a las diez preguntas', () => {
    const p = predict(['HCl', 'NaOH']).predictions[0]!;
    const lesson = explain(p);
    assert.equal(lesson.sections.length, 10);
    for (let i = 0; i < 10; i++) {
      assert.equal(lesson.sections[i]!.n, i + 1);
      assert.ok(lesson.sections[i]!.answer.length > 10, `seccion ${i + 1} vacia`);
    }
  });

  test('la seccion de balanceo muestra la tabla de recuento', () => {
    const p = predict(['CH4', 'O2']).predictions[0]!;
    const lesson = explain(p);
    const balance = lesson.sections.find((s) => s.n === 6)!;
    assert.ok(balance.details.some((d) => d.includes('Elemento')));
    assert.ok(balance.details.some((d) => d.includes('C') && d.includes('✓')));
  });

  test('la seccion de electrones distingue redox de no redox', () => {
    const neutralization = explain(predict(['HCl', 'NaOH']).predictions[0]!);
    assert.match(neutralization.sections.find((s) => s.n === 8)!.answer, /NO es una reaccion redox/);

    const redox = explain(predict(['Zn', 'CuSO4']).predictions[0]!);
    assert.match(redox.sections.find((s) => s.n === 8)!.answer, /SE OXIDA/);
  });

  test('ficha explicativa de una sustancia', () => {
    const lesson = explainSubstance('CaO')!;
    assert.equal(lesson.display, 'CaO');
    assert.ok(lesson.sections.length >= 4);
    const mass = lesson.sections.find((s) => s.question.includes('mol'))!;
    assert.match(mass.answer, /56\.077/);
  });
});

// ---------------------------------------------------------------------------

describe('geometria de compuestos ionicos', () => {
  const structureOf = (formula: string) => {
    const parsed = parseFormula(formula);
    if (!parsed.ok) return null;
    const c = classifyFormula(formula);
    return buildStructure(formula, parsed.value.composition, {
      ionic: c?.ionic ?? false,
      ...(c?.cationSymbol ? { cation: c.cationSymbol } : {}),
      ...(c?.anionFormula ? { anion: c.anionFormula } : {}),
    });
  };

  test('un anion monoatomico da una red cristalina', () => {
    const s = structureOf('NaCl')!;
    assert.equal(s.motif, 'ionic-lattice');
    assert.ok(s.atoms.length > 4, 'la red debe mostrar varios iones');
    assert.ok(s.atoms.some((a) => a.symbol === 'Na'));
    assert.ok(s.atoms.some((a) => a.symbol === 'Cl'));
  });

  test('un anion poliatomico conserva su geometria propia', () => {
    // Al2(SO4)3 = 2 aluminios sueltos + 3 sulfatos, cada uno con sus 5 atomos.
    const s = structureOf('Al2(SO4)3')!;
    assert.equal(s.atoms.length, 2 + 3 * 5);
    assert.equal(s.atoms.filter((a) => a.symbol === 'Al').length, 2);
    assert.equal(s.atoms.filter((a) => a.symbol === 'S').length, 3);
    assert.equal(s.atoms.filter((a) => a.symbol === 'O').length, 12);
    // Cuatro enlaces S-O por sulfato, y ninguno entre el aluminio y el sulfato:
    // la union ionica no es direccional y no debe dibujarse como varilla.
    assert.equal(s.bonds.length, 12);
    for (const b of s.bonds) {
      assert.notEqual(s.atoms[b.a]!.symbol, 'Al');
      assert.notEqual(s.atoms[b.b]!.symbol, 'Al');
    }
  });

  test('Ca3(PO4)2 sale con las proporciones correctas', () => {
    const s = structureOf('Ca3(PO4)2')!;
    assert.equal(s.atoms.filter((a) => a.symbol === 'Ca').length, 3);
    assert.equal(s.atoms.filter((a) => a.symbol === 'P').length, 2);
    assert.equal(s.atoms.filter((a) => a.symbol === 'O').length, 8);
  });
});
