/**
 * Scientific correctness tests.
 *
 * Priority 1 of the product specification is scientific correctness, so the
 * test suite checks numbers against the literature rather than against the
 * implementation's own output. Every expected value below is one a student can
 * look up or derive by hand.
 *
 * Run with: npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ELEMENTS, elementBySymbol, atomicMass } from '../src/data/elements.js';
import {
  parseFormula, molarMass, monoisotopic, isotopePattern,
  elementalAnalysis, empiricalFromPercent, degreeOfUnsaturation, hillOrder,
} from '../src/core/chem/formula.js';
import { balance, parseEquation, formatEquation, stoichiometry, atomEconomy, splitSide } from '../src/core/chem/balance.js';
import { debyeHuckelA, debyeHuckelB, activityCoefficient, ionicStrength } from '../src/core/chem/activity.js';
import { solveSolution } from '../src/core/chem/solution.js';
import { solveEquilibrium, kwAt, vantHoff } from '../src/core/chem/equilibrium.js';
import { R, FARADAY, NA, NERNST_DECADE_25 } from '../src/core/constants.js';
import { linearRegression, inversePredict, describe as stats, tCritical, pca, grubbs } from '../src/core/math/stats.js';
import { integrate } from '../src/core/math/ode.js';
import { brent, newtonSystem } from '../src/core/math/roots.js';
import { nullSpace, solve, det, jacobiEigen, toSmallestIntegers } from '../src/core/math/linalg.js';
import { detectPeaks, gaussian, trapezoid, resolution, estimateNoise } from '../src/core/math/signal.js';
import { propagate, meas, pFunction, sampleMean } from '../src/core/uncertainty.js';
import { fmt, fmtWithU, sigRound, formulaText } from '../src/core/format.js';
import { convert, toCanonical } from '../src/core/units.js';

/** Assert `actual` is within `tol` of `expected`. */
const near = (actual: number, expected: number, tol: number, msg?: string): void => {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${msg ?? ''} esperado ${expected} ± ${tol}, obtenido ${actual}`,
  );
};

// ===========================================================================
describe('Constantes fundamentales', () => {
  test('R = N_A·k_B', () => near(R, 8.314462618, 1e-8));
  test('F = N_A·e', () => near(FARADAY, 96485.332, 1e-3));
  test('N_A es exacto por definición SI', () => assert.equal(NA, 6.02214076e23));
  test('pendiente de Nernst decádica a 25 °C', () => near(NERNST_DECADE_25, 0.05916, 1e-5));
});

// ===========================================================================
describe('Unidades', () => {
  test('°C → K', () => near(convert(25, 'degC', 'K'), 298.15, 1e-9));
  test('K → °C', () => near(convert(373.15, 'K', 'degC'), 100, 1e-9));
  test('atm → Pa', () => near(convert(1, 'atm', 'Pa'), 101325, 1e-6));
  test('mmHg → atm', () => near(convert(760, 'mmHg', 'atm'), 1, 1e-9));
  test('kcal → kJ', () => near(convert(1, 'kcal', 'kJ'), 4.184, 1e-9));
  test('mL a la unidad canónica (L)', () => near(toCanonical(250, 'mL'), 0.25, 1e-12));
  test('conversión entre dimensiones distintas falla', () => {
    assert.throws(() => convert(1, 'L', 'g'));
  });
});

// ===========================================================================
describe('Tabla periódica', () => {
  test('contiene los 118 elementos con Z consecutivo', () => {
    assert.equal(ELEMENTS.length, 118);
    ELEMENTS.forEach((e, i) => assert.equal(e.Z, i + 1, `Z incorrecto en ${e.symbol}`));
  });

  test('cada configuración electrónica suma exactamente Z electrones', () => {
    for (const e of ELEMENTS) {
      const total = e.shells.reduce((a, b) => a + b, 0);
      assert.equal(total, e.Z, `${e.symbol}: la configuración da ${total} e⁻ pero Z = ${e.Z}`);
    }
  });

  test('masas atómicas de referencia', () => {
    near(atomicMass('C'), 12.011, 1e-3);
    near(atomicMass('O'), 15.999, 1e-3);
    near(atomicMass('Fe'), 55.845, 1e-3);
    near(atomicMass('U'), 238.03, 1e-2);
  });

  test('tendencia periódica: la electronegatividad crece en el periodo 2', () => {
    const en = ['Li', 'Be', 'B', 'C', 'N', 'O', 'F']
      .map((s) => elementBySymbol(s)!.electronegativity!);
    for (let i = 1; i < en.length; i++) {
      assert.ok(en[i] > en[i - 1], 'la electronegatividad debe crecer de Li a F');
    }
  });

  test('tendencia periódica: el radio covalente crece en el grupo 1', () => {
    const r = ['Li', 'Na', 'K', 'Rb', 'Cs']
      .map((s) => elementBySymbol(s)!.radiusCovalent!);
    for (let i = 1; i < r.length; i++) assert.ok(r[i] > r[i - 1]);
  });

  test('el flúor es el elemento más electronegativo', () => {
    const max = ELEMENTS.reduce((a, b) =>
      (b.electronegativity ?? 0) > (a.electronegativity ?? 0) ? b : a);
    assert.equal(max.symbol, 'F');
  });

  test('un símbolo inexistente lanza error en vez de devolver 0', () => {
    assert.throws(() => atomicMass('Xx'));
  });
});

// ===========================================================================
describe('Fórmulas químicas', () => {
  test('masas molares', () => {
    near(molarMass('H2O'), 18.015, 1e-3);
    near(molarMass('H2SO4'), 98.072, 1e-3);
    near(molarMass('Ca(OH)2'), 74.092, 1e-3);
    near(molarMass('K4[Fe(CN)6]'), 368.345, 1e-3);
    near(molarMass('CuSO4·5H2O'), 249.677, 1e-3);
    near(molarMass('C6H12O6'), 180.156, 1e-3);
  });

  test('cargas en todas las notaciones aceptadas', () => {
    assert.equal(parseFormula('SO4^2-').charge, -2);
    assert.equal(parseFormula('SO4 2-').charge, -2);
    assert.equal(parseFormula('NH4+').charge, 1);
    assert.equal(parseFormula('Fe3+').charge, 3);
    assert.equal(parseFormula('OH-').charge, -1);
    assert.equal(parseFormula('H2O').charge, 0);
  });

  test('NH4+ interpreta el 4 como subíndice, no como carga', () => {
    const p = parseFormula('NH4+');
    assert.equal(p.composition.H, 4);
    assert.equal(p.charge, 1);
  });

  test('hidratos', () => {
    const p = parseFormula('CuSO4·5H2O');
    assert.equal(p.hydrate, 5);
    assert.equal(p.composition.H, 10);
    assert.equal(p.composition.O, 9);
  });

  test('un elemento inexistente lanza FormulaError con posición', () => {
    assert.throws(() => parseFormula('H2Q4'), /desconocido/);
  });

  test('paréntesis sin cerrar se detecta', () => {
    assert.throws(() => parseFormula('Ca(OH2'));
  });

  test('análisis elemental de la glucosa', () => {
    const a = elementalAnalysis('C6H12O6');
    const c = a.find((x) => x.element === 'C')!;
    const h = a.find((x) => x.element === 'H')!;
    const o = a.find((x) => x.element === 'O')!;
    near(c.massPercent, 40.00, 0.02);
    near(h.massPercent, 6.71, 0.02);
    near(o.massPercent, 53.29, 0.02);
  });

  test('fórmula empírica a partir de porcentajes devuelve CH2O', () => {
    const r = empiricalFromPercent({ C: 40.00, H: 6.71, O: 53.29 });
    assert.deepEqual(r.composition, { C: 1, H: 2, O: 1 });
  });

  test('grados de insaturación', () => {
    assert.equal(degreeOfUnsaturation(parseFormula('C6H6').composition), 4);   // benceno
    assert.equal(degreeOfUnsaturation(parseFormula('C6H12').composition), 1);  // ciclohexano
    assert.equal(degreeOfUnsaturation(parseFormula('C6H14').composition), 0);  // hexano
  });

  test('orden de Hill: C, H, luego alfabético', () => {
    const order = hillOrder(parseFormula('H2SO4C2').composition).map((e) => e[0]);
    assert.deepEqual(order, ['C', 'H', 'O', 'S']);
  });

  test('masa monoisotópica difiere de la masa molar', () => {
    // El agua: 18.0106 frente a 18.0153. La diferencia es real y medible en EM.
    near(monoisotopic('H2O'), 18.01056, 1e-4);
    assert.ok(monoisotopic('H2O') < molarMass('H2O'));
  });
});

// ===========================================================================
describe('Patrones isotópicos (espectrometría de masas)', () => {
  test('CHCl3 reproduce el patrón M : M+2 : M+4 : M+6 del tricloruro', () => {
    const p = isotopePattern('CHCl3');
    const at = (offset: number): number =>
      p.filter((x) => x.offset === offset).reduce((s, x) => s + x.intensity, 0);
    near(at(0), 100, 0.5);
    near(at(2), 95.8, 1.5, 'M+2');
    near(at(4), 30.6, 1.0, 'M+4');
    near(at(6), 3.3, 0.4, 'M+6');
  });

  test('un bromuro da el doblete 1:1 característico', () => {
    const p = isotopePattern('C2H5Br');
    const at = (o: number): number =>
      p.filter((x) => x.offset === o).reduce((s, x) => s + x.intensity, 0);
    near(at(0), 100, 0.5);
    near(at(2), 97.3, 1.5);
  });

  test('el pico M+1 de un hidrocarburo crece 1.1 % por carbono', () => {
    const p = isotopePattern('C10H22');
    const m1 = p.filter((x) => x.offset === 1).reduce((s, x) => s + x.intensity, 0);
    near(m1, 11.0, 0.8, '10 C × 1.1 %');
  });
});

// ===========================================================================
describe('Ajuste de ecuaciones', () => {
  const balanced = (input: string): string => formatEquation(balance(input).equation);

  test('el separador + no rompe las cargas', () => {
    assert.deepEqual(splitSide('Fe2+ + MnO4- + H+'), ['Fe2+', 'MnO4-', 'H+']);
  });

  test('combustión y neutralización', () => {
    assert.equal(balanced('H2 + O2 -> H2O'), '2 H2 + O2 → 2 H2O');
    assert.equal(balanced('C3H8 + O2 -> CO2 + H2O'), 'C3H8 + 5 O2 → 3 CO2 + 4 H2O');
    assert.equal(balanced('C6H12O6 + O2 -> CO2 + H2O'), 'C6H12O6 + 6 O2 → 6 CO2 + 6 H2O');
    assert.equal(balanced('NaOH + H2SO4 -> Na2SO4 + H2O'), '2 NaOH + H2SO4 → Na2SO4 + 2 H2O');
  });

  test('redox en medio ácido con cargas explícitas', () => {
    assert.equal(
      balanced('Fe2+ + MnO4- + H+ -> Fe3+ + Mn2+ + H2O'),
      '5 Fe2+ + MnO4- + 8 H+ → 5 Fe3+ + Mn2+ + 4 H2O',
    );
    assert.equal(
      balanced('Cr2O7 2- + Fe2+ + H+ -> Cr3+ + Fe3+ + H2O'),
      'Cr2O7 2- + 6 Fe2+ + 14 H+ → 2 Cr3+ + 6 Fe3+ + 7 H2O',
    );
    assert.equal(
      balanced('S2O3 2- + I2 -> S4O6 2- + I-'),
      '2 S2O3 2- + I2 → S4O6 2- + 2 I-',
    );
  });

  test('todas las ecuaciones ajustadas conservan masa y carga', () => {
    for (const eq of [
      'KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2',
      'Ca(OH)2 + H3PO4 -> Ca3(PO4)2 + H2O',
      'Cu + NO3- + H+ -> Cu2+ + NO + H2O',
    ]) {
      const r = balance(eq);
      assert.ok(r.equation.balanced, `${eq} no quedó ajustada`);
      assert.equal(r.equation.chargeLeft, r.equation.chargeRight);
    }
  });

  test('un sistema indeterminado se detecta y se explica', () => {
    // El H2O2 puede reducir al permanganato y a la vez dismutar: dos
    // reacciones independientes entre las mismas seis especies.
    const r = balance('MnO4- + H2O2 + H+ -> Mn2+ + O2 + H2O');
    assert.equal(r.unique, false);
    assert.ok(r.error?.includes('indeterminado'));
    assert.ok(r.equation.balanced, 'aun así debe devolver una solución válida');
  });

  test('estequiometría: reactivo limitante y rendimiento teórico', () => {
    const eq = balance(parseEquation('Zn + HCl -> ZnCl2 + H2')).equation;
    const s = stoichiometry(eq, { available: { Zn: 10 / 65.38, HCl: 0.100 } });
    assert.equal(s.limiting, 'HCl');
    near(s.extent, 0.05, 1e-6);
    near(s.produced.H2, 0.05, 1e-6);
    near(s.theoreticalYieldGrams.H2, 0.1008, 1e-3);
  });

  test('economía atómica', () => {
    const eq = balance('C2H4 + H2O -> C2H6O').equation;
    near(atomEconomy(eq, 'C2H6O'), 100, 0.01, 'una adición es 100 % económica');
  });
});

// ===========================================================================
describe('Coeficientes de actividad', () => {
  test('parámetro A de Debye–Hückel a 25 °C', () => near(debyeHuckelA(), 0.5108, 0.002));
  test('parámetro B de Debye–Hückel a 25 °C', () => near(debyeHuckelB(), 0.328, 0.003));

  test('coincide con la tabla de Kielland', () => {
    const ctx = (I: number) => ({ model: 'extended-dh' as const, I, temperature: 298.15 });
    near(activityCoefficient(1, ctx(0.01), 'Na+'), 0.902, 0.004);
    near(activityCoefficient(2, ctx(0.01), 'Ca2+'), 0.675, 0.006);
    near(activityCoefficient(1, ctx(0.1), 'H+'), 0.83, 0.01);
  });

  test('las especies neutras tienen γ = 1', () => {
    assert.equal(activityCoefficient(0, { model: 'davies', I: 0.5, temperature: 298.15 }), 1);
  });

  test('fuerza iónica de un electrolito 2:1', () => {
    near(ionicStrength([{ c: 0.2, z: 1 }, { c: 0.1, z: -2 }]), 0.3, 1e-12);
  });
});

// ===========================================================================
describe('Equilibrio ácido-base', () => {
  const A = (id: string, moles: number): { substanceId: string; moles: number } =>
    ({ substanceId: id, moles });
  const pH = (additions: Array<{ substanceId: string; moles: number }>, volume: number,
    atmosphere?: Record<string, number>): number =>
    solveSolution({ additions, volume, atmosphere }, { activityModel: 'ideal' }).pH;

  test('ácidos y bases fuertes', () => {
    near(pH([A('hcl', 0.01)], 0.1), 1.000, 0.002);
    near(pH([A('naoh', 0.01)], 0.1), 13.000, 0.002);
    near(pH([], 0.1), 7.000, 0.002, 'agua pura');
  });

  test('HCl 10⁻⁷ M: la autoprotólisis del agua no es despreciable', () => {
    // El resultado ingenuo sería pH 7.00; el correcto es 6.79.
    near(pH([A('hcl', 1e-8)], 0.1), 6.79, 0.02);
  });

  test('ácido débil monoprótico', () => {
    near(pH([A('ch3cooh', 0.01)], 0.1), 2.881, 0.005);
  });

  test('base débil', () => {
    near(pH([A('nh3', 0.01)], 0.1), 11.122, 0.005);
  });

  test('sal anfótera: pH ≈ ½(pKa₁ + pKa₂)', () => {
    const p = pH([A('nahco3', 0.01)], 0.1);
    near(p, 8.34, 0.03);
    near(p, (6.352 + 10.329) / 2, 0.02, 'la aproximación clásica es buena aquí');
  });

  test('sistemas polipróticos', () => {
    near(pH([A('na2co3', 0.01)], 0.1), 11.65, 0.03);
    near(pH([A('h3po4', 0.01)], 0.1), 1.63, 0.02);
    near(pH([A('kh2po4', 0.01)], 0.1), 4.68, 0.03);
    near(pH([A('h2so4', 0.005)], 0.1), 1.24, 0.02);
  });

  test('tampón equimolar da pH = pKa', () => {
    near(pH([A('ch3cooh', 0.01), A('naoh', 0.005)], 0.1), 4.756, 0.005);
    near(pH([A('kh2po4', 0.005), A('na2hpo4', 0.005)], 0.1), 7.198, 0.005);
  });

  test('sistema abierto: el CO₂ atmosférico acidifica el agua destilada', () => {
    near(pH([], 1, { 'CO2(g)': 400e-6 }), 5.61, 0.05);
    near(pH([], 1, { 'CO2(g)': 1 }), 3.92, 0.05);
  });

  test('la corrección de actividad separa pH de pcH', () => {
    const r = solveSolution(
      { additions: [A('nacl', 0.1), A('ch3cooh', 0.01)], volume: 0.1 },
      { activityModel: 'davies' },
    );
    assert.ok(r.pH > r.pcH, 'γ_H < 1 hace que el pH medido supere al pcH');
    assert.ok(r.ionicStrength > 0.09);
  });

  test('el balance de cargas cierra en todos los casos', () => {
    for (const spec of [
      { additions: [A('hcl', 0.01)], volume: 0.1 },
      { additions: [A('na2co3', 0.01)], volume: 0.1 },
      { additions: [A('kh2po4', 0.005), A('na2hpo4', 0.005)], volume: 0.1 },
    ]) {
      const r = solveSolution(spec, { activityModel: 'ideal' });
      assert.ok(Math.abs(r.chargeBalance) < 1e-9,
        `desbalance de ${r.chargeBalance} eq·L⁻¹`);
      assert.ok(r.converged);
    }
  });

  test('Kw depende de la temperatura', () => {
    near(-Math.log10(kwAt(298.15)), 14.00, 0.01);
    // A 50 °C el agua neutra está a pH 6.63, no a 7.
    const kw50 = kwAt(323.15);
    near(-Math.log10(kw50) / 2, 6.63, 0.05);
  });

  test('van \'t Hoff desplaza la constante en el sentido correcto', () => {
    // Una ionización endotérmica aumenta con la temperatura.
    assert.ok(vantHoff(-14, 55840, 323.15) > -14);
  });
});

// ===========================================================================
describe('Precipitación', () => {
  const A = (id: string, moles: number): { substanceId: string; moles: number } =>
    ({ substanceId: id, moles });

  test('el AgCl precipita cuando se supera el Kps', () => {
    const r = solveSolution(
      { additions: [A('agno3', 0.001), A('nacl', 0.001)], volume: 0.1 },
      { activityModel: 'ideal' },
    );
    const p = r.precipitates.find((x) => x.id === 'AgCl(s)');
    assert.ok(p, 'debería haber precipitado AgCl');
    assert.ok(p!.amount > 0);
    // La plata residual queda cerca de √Kps.
    const ag = r.free.Ag;
    near(Math.log10(ag), -0.5 * 9.75, 0.4);
  });

  test('efecto del ion común: exceso de cloruro reduce la plata disuelta', () => {
    const solve = (extraCl: number): number => solveSolution(
      { additions: [A('agno3', 0.001), A('nacl', 0.001 + extraCl)], volume: 0.1 },
      { activityModel: 'ideal' },
    ).free.Ag;
    assert.ok(solve(0.01) < solve(0), 'el exceso de Cl⁻ debe suprimir la solubilidad');
  });

  test('sin sobresaturación no se forma precipitado', () => {
    const r = solveSolution(
      { additions: [A('agno3', 1e-7), A('nacl', 1e-7)], volume: 1 },
      { activityModel: 'ideal' },
    );
    assert.equal(r.precipitates.length, 0);
  });

  test('con precipitado presente el producto iónico iguala exactamente al Kps', () => {
    const r = solveSolution(
      { additions: [A('agno3', 0.001), A('nacl', 0.002)], volume: 0.1 },
      { activityModel: 'ideal' },
    );
    near(Math.log10(r.free.Ag) + Math.log10(r.free.Cl), -9.75, 1e-6);
  });

  test('la calcita fija el producto [Ca²⁺][CO₃²⁻] en su Kps', () => {
    const r = solveSolution(
      { additions: [A('cacl2', 0.001), A('na2co3', 0.001)], volume: 0.1 },
      { activityModel: 'ideal' },
    );
    assert.ok(r.precipitates.some((p) => p.id === 'CaCO3(s)'));
    near(Math.log10(r.free.Ca) + Math.log10(r.free.h2co3), -8.48, 1e-5);
  });

  test('el Fe(III) hidroliza y precipita: la disolución es ácida', () => {
    const r = solveSolution(
      { additions: [A('fecl3', 0.001)], volume: 0.1 },
      { activityModel: 'ideal' },
    );
    assert.ok(r.pH < 3, `una disolución de FeCl₃ es ácida por hidrólisis, pH = ${r.pH}`);
    assert.ok(r.precipitates.some((p) => p.id === 'Fe(OH)3(s)'));
  });
});

// ===========================================================================
describe('Complejación', () => {
  const A = (id: string, moles: number): { substanceId: string; moles: number } =>
    ({ substanceId: id, moles });

  test('el cobre en amoníaco es mayoritariamente el tetraamino complejo', () => {
    const r = solveSolution(
      { additions: [A('cuso4', 0.001), A('nh3', 0.01)], volume: 0.1 },
      { activityModel: 'ideal' },
    );
    const tetra = r.species.find((s) => s.id === 'Cu(NH3)4^2+')!;
    assert.ok(tetra.fractions.Cu > 0.85,
      `Cu(NH₃)₄²⁺ debería dominar, fracción obtenida ${tetra.fractions.Cu}`);
  });

  test('el EDTA reduce el calcio libre en varios órdenes de magnitud', () => {
    const sinEdta = solveSolution(
      { additions: [A('cacl2', 0.001)], volume: 0.1 }, { activityModel: 'ideal' },
    ).free.Ca;
    const conEdta = solveSolution(
      { additions: [A('cacl2', 0.001), A('edta', 0.001), A('naoh', 0.004)], volume: 0.1 },
      { activityModel: 'ideal' },
    ).free.Ca;
    assert.ok(conEdta < sinEdta / 100,
      `el EDTA debe acomplejar el calcio: ${sinEdta} → ${conEdta}`);
  });

  test('la constante condicional del EDTA crece con el pH', () => {
    const libre = (pH: number): number => solveSolution(
      { additions: [A('cacl2', 0.001), A('edta', 0.001)], volume: 0.1 },
      { activityModel: 'ideal', fixedPH: pH },
    ).free.Ca;
    assert.ok(libre(10) < libre(5),
      'a pH bajo el EDTA está protonado y acompleja peor');
  });
});

// ===========================================================================
describe('Álgebra lineal', () => {
  test('resolución de un sistema lineal', () => {
    const x = solve([[2, 1, -1], [-3, -1, 2], [-2, 1, 2]], [8, -11, -3]);
    near(x[0], 2, 1e-10); near(x[1], 3, 1e-10); near(x[2], -1, 1e-10);
  });

  test('determinante', () => near(det([[1, 2], [3, 4]]), -2, 1e-12));

  test('espacio nulo', () => {
    const ns = nullSpace([[1, 1, -1]]);
    assert.equal(ns.length, 2);
    for (const v of ns) near(v[0] + v[1] - v[2], 0, 1e-12);
  });

  test('los autovalores de una matriz simétrica salen ordenados', () => {
    const { values } = jacobiEigen([[2, 1], [1, 2]]);
    near(values[0], 3, 1e-10);
    near(values[1], 1, 1e-10);
  });

  test('reducción a enteros mínimos', () => {
    assert.deepEqual(toSmallestIntegers([0.5, 0.25, 1]), [2, 1, 4]);
  });
});

// ===========================================================================
describe('Raíces y EDO', () => {
  test('Brent encuentra la raíz de cos x − x', () => {
    const r = brent((x) => Math.cos(x) - x, 0, 2);
    assert.ok(r.converged);
    near(r.root, 0.7390851332, 1e-9);
  });

  test('Newton multidimensional', () => {
    const r = newtonSystem(
      ([x, y]) => [x * x + y * y - 4, x - y],
      [1, 0.5],
    );
    assert.ok(r.converged);
    near(r.x[0], Math.SQRT2, 1e-7);
  });

  test('la integración de EDO reproduce la solución analítica', () => {
    // Primer orden: dA/dt = −kA con k = 0.5 s⁻¹, A₀ = 1.
    const k = 0.5;
    const sol = integrate((_t, y) => [-k * y[0]], [1], 0, 10, { tEval: [0, 1, 2, 5, 10] });
    sol.t.forEach((t, i) => {
      near(sol.y[i][0], Math.exp(-k * t), 1e-8, `t = ${t}`);
    });
  });

  test('el integrador conserva la masa en un sistema A ⇌ B', () => {
    const sol = integrate(
      (_t, y) => [-2 * y[0] + 0.5 * y[1], 2 * y[0] - 0.5 * y[1]],
      [1, 0], 0, 20,
    );
    for (const y of sol.y) near(y[0] + y[1], 1, 1e-7);
  });
});

// ===========================================================================
describe('Estadística y regresión', () => {
  test('estadística descriptiva', () => {
    const d = stats([10.1, 10.3, 9.9, 10.2, 10.0]);
    near(d.mean, 10.1, 1e-9);
    near(d.sd, 0.1581, 1e-4);
    near(d.median, 10.1, 1e-9);
  });

  test('valores críticos de t', () => {
    near(tCritical(0.95, 4), 2.776, 0.005);
    near(tCritical(0.95, 10), 2.228, 0.005);
    near(tCritical(0.99, 10), 3.169, 0.01);
  });

  test('regresión lineal exacta sobre datos exactos', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = xs.map((x) => 2.5 * x + 1.2);
    const fit = linearRegression(xs, ys);
    near(fit.slope, 2.5, 1e-10);
    near(fit.intercept, 1.2, 1e-10);
    near(fit.r2, 1, 1e-12);
  });

  test('calibración: predicción inversa con su incertidumbre', () => {
    const xs = [0, 2, 4, 6, 8, 10];
    const ys = [0.002, 0.204, 0.397, 0.601, 0.802, 0.998];
    const fit = linearRegression(xs, ys);
    near(fit.slope, 0.0996, 0.002);
    const p = inversePredict(fit, 0.500, 3);
    near(p.x, 5.0, 0.1);
    assert.ok(p.u > 0 && p.u < 0.2, 'la incertidumbre debe ser pequeña pero no nula');
  });

  test('el test de Grubbs detecta un valor anómalo', () => {
    const r = grubbs([10.0, 10.1, 9.9, 10.2, 15.0]);
    assert.equal(r.index, 4);
    assert.ok(r.reject);
  });

  test('PCA: la primera componente recoge la varianza dominante', () => {
    const X = Array.from({ length: 40 }, (_, i) => {
      const t = i / 10;
      return [t, 2 * t + 0.01, -t + 0.02];
    });
    const r = pca(X);
    assert.ok(r.explained[0] > 0.99, 'datos colineales: una sola componente');
  });
});

// ===========================================================================
describe('Incertidumbre', () => {
  test('propagación en un producto: las relativas se suman en cuadratura', () => {
    const a = meas(10, 0.1, '');
    const b = meas(20, 0.4, '');
    const p = propagate(([x, y]) => x * y, [a, b]);
    near(p.value, 200, 1e-9);
    // u_rel = √(0.01² + 0.02²) = 0.02236 → u = 4.47
    near(p.u, 200 * Math.hypot(0.01, 0.02), 1e-6);
  });

  test('propagación logarítmica: u(pH) = u([H+]) / ([H+]·ln10)', () => {
    const h = meas(1e-3, 5e-5, 'mol/L');
    const p = pFunction(h);
    near(p.value, 3, 1e-12);
    near(p.u, 5e-5 / (1e-3 * Math.LN10), 1e-12);
  });

  test('la procedencia se propaga al caso menos fiable', () => {
    const theory = meas(1, 0, '', 'theoretical');
    const measured = meas(2, 0.1, '', 'measured');
    assert.equal(propagate(([a, b]) => a + b, [theory, measured]).provenance, 'measured');
  });

  test('media muestral y error estándar', () => {
    const m = sampleMean([10.1, 10.3, 9.9, 10.2, 10.0]);
    near(m.value, 10.1, 1e-9);
    near(m.u, 0.1581 / Math.sqrt(5), 1e-4);
    assert.equal(m.df, 4);
  });
});

// ===========================================================================
describe('Formato científico', () => {
  test('cifras significativas', () => {
    assert.equal(fmt(0.000123456, { sig: 3 }), '1.23×10⁻⁴');
    assert.equal(fmt(1234.5678, { sig: 5 }), '1234.6');
    assert.equal(fmt(0, {}), '0');
    assert.equal(fmt(NaN, {}), '—');
  });

  test('redondeo a cifras significativas', () => {
    near(sigRound(1234.5678, 3), 1230, 1e-9);
    near(sigRound(0.00098765, 2), 0.00099, 1e-12);
  });

  test('el valor se redondea al mismo decimal que su incertidumbre', () => {
    assert.equal(fmtWithU(meas(1.23456, 0.0012, ''), { style: 'plusminus' }), '1.2346 ± 0.0012');
    assert.equal(fmtWithU(meas(9.81, 0.03, ''), { style: 'plusminus' }), '9.81 ± 0.03');
  });

  test('fórmulas con subíndices Unicode', () => {
    assert.equal(formulaText('H2SO4'), 'H₂SO₄');
    assert.equal(formulaText('SO4^2-'), 'SO₄²⁻');
  });
});

// ===========================================================================
describe('Procesamiento de señal', () => {
  test('detección e integración de un pico gaussiano', () => {
    const xs = Array.from({ length: 400 }, (_, i) => i * 0.05);
    const ys = xs.map((x) => gaussian(x, 100, 10, 0.5));
    const peaks = detectPeaks(xs, ys, { minHeight: 1 });
    assert.equal(peaks.length, 1);
    near(peaks[0].x, 10, 0.05);
    near(peaks[0].height, 100, 0.5);
    // FWHM = 2√(2 ln2)·σ = 2.3548·0.5
    near(peaks[0].fwhm, 2.3548 * 0.5, 0.05);
    // Área = A·σ·√(2π)
    near(peaks[0].area, 100 * 0.5 * Math.sqrt(2 * Math.PI), 1.0);
  });

  test('resolución cromatográfica de dos picos', () => {
    const xs = Array.from({ length: 800 }, (_, i) => i * 0.02);
    const ys = xs.map((x) => gaussian(x, 100, 6, 0.3) + gaussian(x, 100, 8, 0.3));
    const peaks = detectPeaks(xs, ys, { minHeight: 5 });
    assert.equal(peaks.length, 2);
    // R_s = Δt/(4σ) con σ igual: (8−6)/(4·0.3) = 1.67 → separación de base.
    near(resolution(peaks[0], peaks[1]), 1.67, 0.15);
  });

  test('la integración trapezoidal reproduce el área de una gaussiana', () => {
    const xs = Array.from({ length: 2001 }, (_, i) => -10 + i * 0.01);
    const ys = xs.map((x) => gaussian(x, 1, 0, 1));
    near(trapezoid(xs, ys), Math.sqrt(2 * Math.PI), 1e-4);
  });

  test('la estimación de ruido es robusta frente a los picos', () => {
    const n = 500;
    const ys = Array.from({ length: n }, (_, i) =>
      gaussian(i, 100, 250, 5) + Math.sin(i * 7.3) * 0.5);
    const noise = estimateNoise(ys);
    assert.ok(noise < 5, `el ruido estimado (${noise}) no debe contaminarse con el pico`);
  });
});
