/**
 * Pruebas del nucleo quimico.
 *
 * Estas pruebas son la red de seguridad del principio §32 (NO INVENTAR
 * QUIMICA): si el motor deja de dar 56.077 g/mol para el CaO o deja de
 * balancear una redox conocida, la prueba falla.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseFormula, normalizeFormulaInput } from '../src/core/formula/parse.js';
import { molarMassOfFormula, arityOf, atomCount, compositionKey } from '../src/core/formula/composition.js';
import { formatFormulaUnicode, formatEquation } from '../src/core/formula/render.js';
import { oxidationStatesOfFormula, fmt } from '../src/core/oxidation.js';
import { balanceFormulas, balanceEquationText, checkManualBalance, parseSpeciesList } from '../src/core/balance.js';
import { buildIonicFormula } from '../src/core/build/ionicFormula.js';
import { getIon } from '../src/data/ions.js';
import { ELEMENTS, getElement, getElementByName } from '../src/data/elements.js';
import { rat, nullSpace, toSmallestIntegers } from '../src/core/rational.js';

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: string; detail?: string }): T {
  if (!r.ok) throw new Error(`${r.error} ${r.detail ?? ''}`);
  return r.value;
}

// ---------------------------------------------------------------------------

describe('tabla periodica', () => {
  test('contiene los 118 elementos', () => {
    assert.equal(ELEMENTS.length, 118);
    assert.equal(ELEMENTS[0]!.symbol, 'H');
    assert.equal(ELEMENTS[117]!.symbol, 'Og');
  });

  test('los numeros atomicos son consecutivos', () => {
    ELEMENTS.forEach((e, i) => assert.equal(e.Z, i + 1));
  });

  test('masas atomicas de referencia', () => {
    assert.equal(getElement('C')!.atomicMass, 12.011);
    assert.equal(getElement('O')!.atomicMass, 15.999);
    assert.equal(getElement('Ca')!.atomicMass, 40.078);
  });

  test('la busqueda por simbolo distingue mayusculas: Co no es CO', () => {
    assert.equal(getElement('Co')!.name, 'Cobalto');
    assert.equal(getElement('CO'), undefined);
  });

  test('busqueda por nombre en espanol e ingles, con y sin acentos', () => {
    assert.equal(getElementByName('calcio')!.symbol, 'Ca');
    assert.equal(getElementByName('Sodium')!.symbol, 'Na');
    assert.equal(getElementByName('Fluor')!.symbol, 'F');
  });

  test('configuraciones electronicas anomalas conocidas', () => {
    assert.equal(getElement('Cr')!.electronConfiguration, '[Ar] 3d5 4s1');
    assert.equal(getElement('Cu')!.electronConfiguration, '[Ar] 3d10 4s1');
    // Caso regular derivado de la regla de Madelung.
    assert.equal(getElement('S')!.electronConfiguration, '[Ne] 3s2 3p4');
    assert.equal(getElement('Fe')!.electronConfiguration, '[Ar] 3d6 4s2');
  });

  test('los datos ausentes son null, nunca inventados', () => {
    // El meitnerio no tiene punto de fusion medido.
    assert.equal(getElement('Mt')!.physical.meltingPoint.value, null);
    // El helio no tiene electronegatividad de Pauling definida.
    assert.equal(getElement('He')!.electronegativity, null);
  });
});

// ---------------------------------------------------------------------------

describe('analisis de formulas', () => {
  test('formula simple', () => {
    const f = unwrap(parseFormula('H2O'));
    assert.equal(f.composition.get('H'), 2);
    assert.equal(f.composition.get('O'), 1);
    assert.equal(f.charge, 0);
  });

  test('grupos anidados con parentesis', () => {
    const f = unwrap(parseFormula('Ca(OH)2'));
    assert.equal(f.composition.get('Ca'), 1);
    assert.equal(f.composition.get('O'), 2);
    assert.equal(f.composition.get('H'), 2);
  });

  test('grupo poliatomico con subindice: Al2(SO4)3', () => {
    const f = unwrap(parseFormula('Al2(SO4)3'));
    assert.equal(f.composition.get('Al'), 2);
    assert.equal(f.composition.get('S'), 3);
    assert.equal(f.composition.get('O'), 12);
  });

  test('subindices Unicode', () => {
    const f = unwrap(parseFormula('H₂SO₄'));
    assert.equal(f.composition.get('H'), 2);
    assert.equal(f.composition.get('S'), 1);
    assert.equal(f.composition.get('O'), 4);
  });

  test('hidratos con punto medio y con punto normal', () => {
    const a = unwrap(parseFormula('CuSO4·5H2O'));
    assert.equal(a.composition.get('O'), 9); // 4 del sulfato + 5 del agua
    assert.equal(a.composition.get('H'), 10);
    assert.equal(a.hydrate.length, 1);
    assert.equal(a.hydrate[0]!.count, 5);

    const b = unwrap(parseFormula('CuSO4.5H2O'));
    assert.equal(b.composition.get('O'), 9);
  });

  test('cargas en distintas notaciones', () => {
    assert.equal(unwrap(parseFormula('SO4^2-')).charge, -2);
    assert.equal(unwrap(parseFormula('SO4(2-)')).charge, -2);
    assert.equal(unwrap(parseFormula('SO₄²⁻')).charge, -2);
    assert.equal(unwrap(parseFormula('NH4+')).charge, 1);
    assert.equal(unwrap(parseFormula('Fe3+')).charge, 3);
    assert.equal(unwrap(parseFormula('Ca++')).charge, 2);
    assert.equal(unwrap(parseFormula('PO4^3-')).charge, -3);
  });

  test('Fe3+ es un ion, pero Fe3O4 lleva subindice 3', () => {
    assert.equal(unwrap(parseFormula('Fe3+')).composition.get('Fe'), 1);
    assert.equal(unwrap(parseFormula('Fe3O4')).composition.get('Fe'), 3);
    assert.equal(unwrap(parseFormula('Fe3O4')).charge, 0);
  });

  test('formulas invalidas dan error explicativo, no excepcion', () => {
    assert.equal(parseFormula('Ca(OH').ok, false);
    assert.equal(parseFormula('').ok, false);
    assert.equal(parseFormula('H2)O').ok, false);
  });

  test('normalizacion de entrada', () => {
    assert.equal(normalizeFormulaInput('H₂O'), 'H2O');
  });
});

// ---------------------------------------------------------------------------

describe('composicion', () => {
  test('masa molar del CaO — el valor exacto del brief', () => {
    const m = unwrap(molarMassOfFormula('CaO'));
    assert.equal(m.total.toFixed(3), '56.077');
  });

  test('masa molar del agua', () => {
    assert.equal(unwrap(molarMassOfFormula('H2O')).total.toFixed(3), '18.015');
  });

  test('masa molar con hidrato', () => {
    // CuSO4·5H2O = 63.546 + 32.06 + 4(15.999) + 5(18.015)
    const m = unwrap(molarMassOfFormula('CuSO4·5H2O'));
    assert.ok(Math.abs(m.total - 249.681) < 0.01, `obtenido ${m.total}`);
  });

  test('el desglose suma el total', () => {
    const m = unwrap(molarMassOfFormula('Ca(OH)2'));
    const sum = m.perElement.reduce((a, r) => a + r.subtotal, 0);
    assert.ok(Math.abs(sum - m.total) < 1e-9);
    assert.ok(Math.abs(m.perElement.reduce((a, r) => a + r.massPercent, 0) - 100) < 1e-9);
  });

  test('ARIDAD cuenta elementos distintos, no atomos (§6)', () => {
    const cases: [string, string, number][] = [
      ['NaCl', 'binary', 2],
      ['CaO', 'binary', 2],
      ['Fe2O3', 'binary', 5],
      ['H2S', 'binary', 3],
      ['CO2', 'binary', 3],
      ['NaOH', 'ternary', 3],
      ['H2SO4', 'ternary', 7],
      ['CaCO3', 'ternary', 5],
      ['KNO3', 'ternary', 5],
      ['NaHCO3', 'quaternary', 6],
      ['Ca(HCO3)2', 'quaternary', 11],
      ['NaHSO4', 'quaternary', 7],
      // NH4NO3 aparece en el brief entre los CUATERNARIOS, pero contiene solo
      // TRES elementos distintos (N, H, O) repartidos en 9 atomos. Es
      // exactamente la confusion que el propio brief pide evitar: aridad
      // cuenta ELEMENTOS, no atomos. El motor aplica la regla, no el ejemplo.
      ['NH4NO3', 'ternary', 9],
    ];
    for (const [formula, expectedArity, expectedAtoms] of cases) {
      const f = unwrap(parseFormula(formula));
      assert.equal(arityOf(f.composition), expectedArity, `aridad de ${formula}`);
      assert.equal(atomCount(f.composition), expectedAtoms, `atomos de ${formula}`);
    }
  });

  test('la clave canonica identifica la misma sustancia escrita de dos formas', () => {
    const a = unwrap(parseFormula('Ca(OH)2')).composition;
    const b = unwrap(parseFormula('CaO2H2')).composition;
    assert.equal(compositionKey(a), compositionKey(b));
  });

  test('la carga forma parte de la clave', () => {
    const so4 = unwrap(parseFormula('SO4^2-'));
    assert.notEqual(
      compositionKey(so4.composition, so4.charge),
      compositionKey(so4.composition, 0),
    );
  });
});

// ---------------------------------------------------------------------------

describe('renderizado', () => {
  test('subindices y cargas Unicode', () => {
    assert.equal(formatFormulaUnicode(unwrap(parseFormula('H2SO4'))), 'H₂SO₄');
    assert.equal(formatFormulaUnicode(unwrap(parseFormula('Ca(OH)2'))), 'Ca(OH)₂');
    assert.equal(formatFormulaUnicode(unwrap(parseFormula('SO4^2-'))), 'SO₄²⁻');
    assert.equal(formatFormulaUnicode(unwrap(parseFormula('NH4+'))), 'NH₄⁺');
  });

  test('ecuacion completa; el coeficiente 1 no se escribe', () => {
    const text = formatEquation({
      reactants: [
        { speciesId: 'H2', formula: 'H2', coefficient: 2 },
        { speciesId: 'O2', formula: 'O2', coefficient: 1 },
      ],
      products: [{ speciesId: 'H2O', formula: 'H2O', coefficient: 2 }],
      balanced: true,
    });
    assert.equal(text, '2 H₂ + O₂ → 2 H₂O');
  });
});

// ---------------------------------------------------------------------------

describe('estados de oxidacion', () => {
  const state = (formula: string, symbol: string): number => {
    const r = unwrap(oxidationStatesOfFormula(formula));
    return r.assignments.find((a) => a.symbol === symbol)!.state;
  };

  test('elemento libre es 0', () => {
    assert.equal(state('O2', 'O'), 0);
    assert.equal(state('Fe', 'Fe'), 0);
    assert.equal(state('S8', 'S'), 0);
  });

  test('ion monoatomico es su carga', () => {
    assert.equal(state('Fe3+', 'Fe'), 3);
    assert.equal(state('Cl-', 'Cl'), -1);
  });

  test('casos estandar', () => {
    assert.equal(state('H2O', 'H'), 1);
    assert.equal(state('H2O', 'O'), -2);
    assert.equal(state('CaO', 'Ca'), 2);
    assert.equal(state('H2SO4', 'S'), 6);
    assert.equal(state('KMnO4', 'Mn'), 7);
    assert.equal(state('K2Cr2O7', 'Cr'), 6);
    assert.equal(state('HNO3', 'N'), 5);
    assert.equal(state('NH3', 'N'), -3);
    assert.equal(state('Fe2O3', 'Fe'), 3);
  });

  test('excepcion: peroxido de hidrogeno', () => {
    assert.equal(state('H2O2', 'O'), -1);
    assert.equal(state('H2O2', 'H'), 1);
  });

  test('excepcion: hidruro metalico', () => {
    assert.equal(state('NaH', 'H'), -1);
    assert.equal(state('CaH2', 'H'), -1);
  });

  test('excepcion: el fluor invierte el signo del oxigeno', () => {
    assert.equal(state('OF2', 'O'), 2);
    assert.equal(state('OF2', 'F'), -1);
  });

  test('estado fraccionario: Fe3O4 da +8/3 y se marca como promedio', () => {
    const r = unwrap(oxidationStatesOfFormula('Fe3O4'));
    const fe = r.assignments.find((a) => a.symbol === 'Fe')!;
    assert.ok(Math.abs(fe.state - 8 / 3) < 1e-9);
    assert.equal(fe.isAverage, true);
    assert.equal(fmt(fe.state), '+8/3');
    assert.ok(r.notes.some((n) => n.includes('medio')));
  });

  test('ion poliatomico: la suma iguala la carga', () => {
    const r = unwrap(oxidationStatesOfFormula('SO4^2-'));
    assert.equal(r.charge, -2);
    assert.equal(r.sum, -2);
    assert.equal(r.consistent, true);
    assert.equal(r.assignments.find((a) => a.symbol === 'S')!.state, 6);
  });

  test('cada asignacion trae la regla que la justifica', () => {
    const r = unwrap(oxidationStatesOfFormula('H2SO4'));
    for (const a of r.assignments) {
      assert.match(a.rule, /^R[1-8]$/);
      assert.ok(a.reason.length > 20, `la regla ${a.rule} debe explicarse`);
    }
  });

  test('formateo de estados', () => {
    assert.equal(fmt(3), '+3');
    assert.equal(fmt(-2), '-2');
    assert.equal(fmt(0), '0');
    assert.equal(fmt(-0.5), '-1/2');
  });
});

// ---------------------------------------------------------------------------

describe('aritmetica racional', () => {
  test('reduccion automatica', () => {
    assert.deepEqual(rat(4n, 8n), { n: 1n, d: 2n });
    assert.deepEqual(rat(-2n, -4n), { n: 1n, d: 2n });
    assert.deepEqual(rat(2n, -4n), { n: -1n, d: 2n });
  });

  test('minimos enteros', () => {
    assert.deepEqual(toSmallestIntegers([rat(1n, 2n), rat(1n, 3n)]), [3n, 2n]);
    assert.deepEqual(toSmallestIntegers([rat(4), rat(8)]), [1n, 2n]);
  });

  test('rechaza vectores con signos mezclados', () => {
    assert.equal(toSmallestIntegers([rat(1), rat(-1)]), null);
  });

  test('nucleo de una matriz', () => {
    // x - y = 0  ->  nucleo generado por (1,1)
    const k = nullSpace([[rat(1), rat(-1)]]);
    assert.equal(k.length, 1);
    assert.deepEqual(toSmallestIntegers(k[0]!), [1n, 1n]);
  });
});

// ---------------------------------------------------------------------------

describe('balanceo de ecuaciones', () => {
  const coefs = (r: string[], p: string[]): number[] => [...unwrap(balanceFormulas(r, p)).coefficients];

  test('sintesis del agua', () => {
    assert.deepEqual(coefs(['H2', 'O2'], ['H2O']), [2, 1, 2]);
  });

  test('combustion del metano', () => {
    assert.deepEqual(coefs(['CH4', 'O2'], ['CO2', 'H2O']), [1, 2, 1, 2]);
  });

  test('combustion del propano', () => {
    assert.deepEqual(coefs(['C3H8', 'O2'], ['CO2', 'H2O']), [1, 5, 3, 4]);
  });

  test('neutralizacion — el ejemplo del brief', () => {
    assert.deepEqual(coefs(['HCl', 'NaOH'], ['NaCl', 'H2O']), [1, 1, 1, 1]);
  });

  test('CaO + HCl da coeficiente 2 para el acido', () => {
    assert.deepEqual(coefs(['CaO', 'HCl'], ['CaCl2', 'H2O']), [1, 2, 1, 1]);
  });

  test('cadena del calcio completa (§1)', () => {
    assert.deepEqual(coefs(['Ca', 'O2'], ['CaO']), [2, 1, 2]);
    assert.deepEqual(coefs(['CaO', 'H2O'], ['Ca(OH)2']), [1, 1, 1]);
    assert.deepEqual(coefs(['Ca(OH)2', 'CO2'], ['CaCO3', 'H2O']), [1, 1, 1, 1]);
    assert.deepEqual(coefs(['CaCO3', 'HCl'], ['CaCl2', 'H2O', 'CO2']), [1, 2, 1, 1, 1]);
  });

  test('ruta del azufre al acido sulfurico (§45)', () => {
    assert.deepEqual(coefs(['S', 'O2'], ['SO2']), [1, 1, 1]);
    assert.deepEqual(coefs(['SO2', 'O2'], ['SO3']), [2, 1, 2]);
    assert.deepEqual(coefs(['SO3', 'H2O'], ['H2SO4']), [1, 1, 1]);
  });

  test('redox exigente: permanganato en medio acido', () => {
    assert.deepEqual(
      coefs(['KMnO4', 'HCl'], ['KCl', 'MnCl2', 'H2O', 'Cl2']),
      [2, 16, 2, 2, 8, 5],
    );
  });

  test('redox exigente: dicromato con hierro(II)', () => {
    assert.deepEqual(
      coefs(['K2Cr2O7', 'FeSO4', 'H2SO4'], ['Cr2(SO4)3', 'Fe2(SO4)3', 'K2SO4', 'H2O']),
      [1, 6, 7, 1, 3, 1, 7],
    );
  });

  test('combustion de un compuesto grande', () => {
    assert.deepEqual(coefs(['C6H12O6', 'O2'], ['CO2', 'H2O']), [1, 6, 6, 6]);
  });

  test('conserva la carga en una ecuacion ionica', () => {
    const r = unwrap(balanceFormulas(['Zn', 'Cu2+'], ['Zn2+', 'Cu']));
    assert.deepEqual(r.coefficients, [1, 1, 1, 1]);
    assert.equal(r.chargeTally.reactants, 2);
    assert.equal(r.chargeTally.products, 2);
    assert.equal(r.chargeTally.balanced, true);
  });

  test('semirreaccion con electrones y protones', () => {
    const r = unwrap(balanceFormulas(['MnO4-', 'H+', 'e-'], ['Mn2+', 'H2O']));
    assert.deepEqual(r.coefficients, [1, 8, 5, 1, 4]);
  });

  test('la tabla de recuento cuadra en ambos lados', () => {
    const r = unwrap(balanceFormulas(['H2', 'O2'], ['H2O']));
    const h = r.tally.find((t) => t.symbol === 'H')!;
    const o = r.tally.find((t) => t.symbol === 'O')!;
    assert.deepEqual([h.reactants, h.products], [4, 4]);
    assert.deepEqual([o.reactants, o.products], [2, 2]);
    assert.ok(r.tally.every((t) => t.balanced));
  });

  test('rechaza una ecuacion sin conservacion de atomos, y explica por que', () => {
    const r = balanceFormulas(['H2', 'O2'], ['H2O', 'NaCl']);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.match(r.error, /no se conservan los atomos|no puede balancearse/i);
      assert.match(r.detail ?? '', /Na|Cl/);
    }
  });

  test('rechaza una reaccion quimicamente imposible', () => {
    assert.equal(balanceFormulas(['H2O'], ['H2SO4']).ok, false);
  });

  test('analiza ecuaciones escritas en texto, con varias flechas', () => {
    for (const arrow of ['->', '=>', '→', '=']) {
      const r = unwrap(balanceEquationText(`H2 + O2 ${arrow} H2O`));
      assert.deepEqual(r.coefficients, [2, 1, 2]);
    }
  });

  test('ignora los coeficientes que ya haya escrito el usuario', () => {
    const r = unwrap(balanceEquationText('4 H2 + 7 O2 -> 3 H2O'));
    assert.deepEqual(r.coefficients, [2, 1, 2]);
  });
});

// ---------------------------------------------------------------------------

describe('modo manual de balanceo', () => {
  const setup = () => ({
    r: unwrap(parseSpeciesList(['H2', 'O2'])),
    p: unwrap(parseSpeciesList(['H2O'])),
  });

  test('acepta la solucion correcta', () => {
    const { r, p } = setup();
    const c = unwrap(checkManualBalance(r, p, [2, 1], [2]));
    assert.equal(c.correct, true);
    assert.match(c.feedback, /Correcto/);
  });

  test('senala exactamente que elemento falla', () => {
    const { r, p } = setup();
    const c = unwrap(checkManualBalance(r, p, [1, 1], [1]));
    assert.equal(c.correct, false);
    assert.deepEqual(c.unbalanced, ['O']);
    assert.match(c.feedback, /O \(2 a la izquierda, 1 a la derecha\)/);
  });

  test('detecta una solucion correcta pero no minima', () => {
    const { r, p } = setup();
    const c = unwrap(checkManualBalance(r, p, [4, 2], [4]));
    assert.equal(c.correct, false);
    assert.equal(c.correctButNotMinimal, true);
    assert.match(c.feedback, /divisibles por 2/);
  });

  test('rechaza coeficientes no enteros o negativos', () => {
    const { r, p } = setup();
    assert.equal(checkManualBalance(r, p, [1.5, 1], [2]).ok, false);
    assert.equal(checkManualBalance(r, p, [-1, 1], [2]).ok, false);
  });
});

// ---------------------------------------------------------------------------

describe('generador de formulas ionicas (§7)', () => {
  test('Al3+ + O2- da Al2O3 con la comprobacion 2(+3) + 3(-2) = 0', () => {
    const b = unwrap(buildIonicFormula(getIon('Al', 3)!, getIon('O', -2)!));
    assert.equal(b.formula, 'Al2O3');
    assert.equal(b.display, 'Al₂O₃');
    assert.equal(b.cationCount, 2);
    assert.equal(b.anionCount, 3);
    assert.equal(b.neutralityCheck, '2(+3) + 3(-2) = 6 - 6 = 0');
    assert.equal(b.derivation.length, 6);
  });

  test('Ca2+ + O2- se simplifica a CaO, no a Ca2O2', () => {
    const b = unwrap(buildIonicFormula(getIon('Ca', 2)!, getIon('O', -2)!));
    assert.equal(b.formula, 'CaO');
    assert.equal(b.cationCount, 1);
    assert.equal(b.anionCount, 1);
  });

  test('los iones poliatomicos con subindice llevan parentesis', () => {
    assert.equal(unwrap(buildIonicFormula(getIon('Ca', 2)!, getIon('OH', -1)!)).formula, 'Ca(OH)2');
    assert.equal(unwrap(buildIonicFormula(getIon('Ca', 2)!, getIon('HCO3', -1)!)).formula, 'Ca(HCO3)2');
    assert.equal(unwrap(buildIonicFormula(getIon('Al', 3)!, getIon('SO4', -2)!)).formula, 'Al2(SO4)3');
    // Sin subindice no hacen falta parentesis.
    assert.equal(unwrap(buildIonicFormula(getIon('Na', 1)!, getIon('OH', -1)!)).formula, 'NaOH');
    assert.equal(unwrap(buildIonicFormula(getIon('Ca', 2)!, getIon('SO4', -2)!)).formula, 'CaSO4');
  });

  test('bateria de sales', () => {
    const cases: [string, number, string, number, string][] = [
      ['Na', 1, 'Cl', -1, 'NaCl'],
      ['Ca', 2, 'Cl', -1, 'CaCl2'],
      ['Fe', 3, 'O', -2, 'Fe2O3'],
      ['Fe', 2, 'O', -2, 'FeO'],
      ['Na', 1, 'CO3', -2, 'Na2CO3'],
      ['Na', 1, 'HCO3', -1, 'NaHCO3'],
      ['NH4', 1, 'NO3', -1, 'NH4NO3'],
      ['Ca', 2, 'PO4', -3, 'Ca3(PO4)2'],
      ['K', 1, 'MnO4', -1, 'KMnO4'],
      ['Na', 1, 'HSO4', -1, 'NaHSO4'],
    ];
    for (const [c, cq, a, aq, expected] of cases) {
      const b = unwrap(buildIonicFormula(getIon(c, cq)!, getIon(a, aq)!));
      assert.equal(b.formula, expected, `${c}${cq}+ + ${a}${aq} deberia dar ${expected}`);
    }
  });

  test('la composicion resultante coincide con la del analizador', () => {
    const b = unwrap(buildIonicFormula(getIon('Al', 3)!, getIon('SO4', -2)!));
    const parsed = unwrap(parseFormula(b.formula));
    assert.equal(compositionKey(b.composition), compositionKey(parsed.composition));
  });

  test('la formula generada es neutra segun el motor de oxidacion', () => {
    const b = unwrap(buildIonicFormula(getIon('Al', 3)!, getIon('O', -2)!));
    const ox = unwrap(oxidationStatesOfFormula(b.formula));
    assert.equal(ox.sum, 0);
    assert.equal(ox.consistent, true);
  });

  test('rechaza combinaciones invalidas', () => {
    assert.equal(buildIonicFormula(getIon('Cl', -1)!, getIon('O', -2)!).ok, false);
  });
});
