/**
 * Pruebas de clasificacion y nomenclatura.
 *
 * El caso Fe2O3 del brief es la prueba central: los tres sistemas a la vez,
 * y cada uno etiquetado con su nombre.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { classifyFormula, isAcid, isBase, isSalt } from '../src/core/classify.js';
import { nameFormula, roman } from '../src/core/nomenclature/inorganic.js';

describe('clasificacion de compuestos', () => {
  const cls = (f: string): string => classifyFormula(f)!.compoundClass;

  test('sustancias simples', () => {
    assert.equal(cls('Fe'), 'element');
    assert.equal(cls('O2'), 'element');
    assert.equal(cls('S8'), 'element');
  });

  test('oxidos: basico frente a acido', () => {
    assert.equal(cls('CaO'), 'basic-oxide');
    assert.equal(cls('Na2O'), 'basic-oxide');
    assert.equal(cls('Fe2O3'), 'basic-oxide');
    assert.equal(cls('CO2'), 'acidic-oxide');
    assert.equal(cls('SO3'), 'acidic-oxide');
    assert.equal(cls('SO2'), 'acidic-oxide');
    assert.equal(cls('N2O5'), 'acidic-oxide');
  });

  test('oxidos anfoteros', () => {
    assert.equal(cls('Al2O3'), 'amphoteric-oxide');
    assert.equal(cls('ZnO'), 'amphoteric-oxide');
  });

  test('peroxidos, que no son oxidos normales', () => {
    assert.equal(cls('H2O2'), 'peroxide');
    assert.equal(cls('Na2O2'), 'peroxide');
  });

  test('hidroxidos', () => {
    assert.equal(cls('NaOH'), 'hydroxide');
    assert.equal(cls('Ca(OH)2'), 'hydroxide');
    assert.equal(cls('Fe(OH)3'), 'hydroxide');
  });

  test('acidos binarios frente a oxoacidos', () => {
    assert.equal(cls('HCl'), 'binary-acid');
    assert.equal(cls('H2S'), 'binary-acid');
    assert.equal(cls('H2SO4'), 'oxoacid');
    assert.equal(cls('HNO3'), 'oxoacid');
    assert.equal(cls('H3PO4'), 'oxoacid');
    assert.equal(cls('H2CO3'), 'oxoacid');
  });

  test('sales binarias, oxosales y sales acidas', () => {
    assert.equal(cls('NaCl'), 'binary-salt');
    assert.equal(cls('CaCl2'), 'binary-salt');
    assert.equal(cls('CaCO3'), 'oxosalt');
    assert.equal(cls('KNO3'), 'oxosalt');
    assert.equal(cls('Na2SO4'), 'oxosalt');
    assert.equal(cls('NaHCO3'), 'acid-salt');
    assert.equal(cls('NaHSO4'), 'acid-salt');
  });

  test('aniones poliatomicos ENTRE PARENTESIS, con subindice', () => {
    // Regresion: la separacion cation/anion comparaba cadenas sobre la formula
    // aplanada, y "Al2(SO4)3" aplanado es "Al2SO43", que no termina en "SO4".
    // Todos estos acababan clasificados como "other", perdiendo de golpe la
    // nomenclatura, las reglas de prediccion y la estructura 3D.
    assert.equal(cls('Al2(SO4)3'), 'oxosalt');
    assert.equal(cls('Ca3(PO4)2'), 'oxosalt');
    assert.equal(cls('Fe2(SO4)3'), 'oxosalt');
    assert.equal(cls('Ca(NO3)2'), 'oxosalt');
    assert.equal(cls('Pb(NO3)2'), 'oxosalt');
    assert.equal(cls('Ca(HCO3)2'), 'acid-salt');

    // Y se identifican bien los dos iones, no solo la familia.
    const al = classifyFormula('Al2(SO4)3')!;
    assert.equal(al.cationSymbol, 'Al');
    assert.equal(al.anionFormula, 'SO4');
    assert.equal(al.ionic, true);
  });

  test('hidruros', () => {
    assert.equal(cls('NaH'), 'metal-hydride');
    assert.equal(cls('CaH2'), 'metal-hydride');
    assert.equal(cls('NH3'), 'nonmetal-hydride');
  });

  test('compuestos organicos, sin confundir carbonatos', () => {
    assert.equal(cls('CH4'), 'organic');
    assert.equal(cls('C2H5OH'), 'organic');
    assert.equal(cls('CH3COOH'), 'organic');
    // Contiene carbono, pero es quimica inorganica.
    assert.equal(cls('CaCO3'), 'oxosalt');
    assert.equal(cls('NaHCO3'), 'acid-salt');
  });

  test('los predicados de familia funcionan', () => {
    assert.ok(isAcid(classifyFormula('H2SO4')!));
    assert.ok(isAcid(classifyFormula('HCl')!));
    assert.ok(isBase(classifyFormula('NaOH')!));
    assert.ok(isSalt(classifyFormula('NaCl')!));
    assert.ok(isSalt(classifyFormula('CaCO3')!));
    assert.ok(!isAcid(classifyFormula('NaOH')!));
  });

  test('cada clasificacion trae su justificacion', () => {
    const c = classifyFormula('CaO')!;
    assert.ok(c.reason.length > 30);
    assert.match(c.reason, /[Mm]etal/);
    assert.equal(c.ionic, true);
  });
});

describe('numeros romanos', () => {
  test('conversion', () => {
    assert.equal(roman(1), 'I');
    assert.equal(roman(2), 'II');
    assert.equal(roman(3), 'III');
    assert.equal(roman(4), 'IV');
    assert.equal(roman(5), 'V');
    assert.equal(roman(6), 'VI');
    assert.equal(roman(7), 'VII');
  });
});

describe('nomenclatura (§28)', () => {
  test('Fe2O3 — el ejemplo exacto del brief, con los tres sistemas', () => {
    const n = nameFormula('Fe2O3')!;
    assert.equal(n.stock, 'oxido de hierro(III)');
    assert.equal(n.systematic, 'trioxido de dihierro');
    assert.equal(n.traditional, 'oxido ferrico');
  });

  test('FeO, el otro oxido de hierro, se distingue del anterior', () => {
    const n = nameFormula('FeO')!;
    assert.equal(n.stock, 'oxido de hierro(II)');
    assert.equal(n.systematic, 'monoxido de hierro');
    assert.equal(n.traditional, 'oxido ferroso');
  });

  test('un metal con un solo estado no lleva numero romano', () => {
    assert.equal(nameFormula('CaO')!.stock, 'oxido de calcio');
    assert.equal(nameFormula('Na2O')!.stock, 'oxido de sodio');
    assert.equal(nameFormula('Al2O3')!.stock, 'oxido de aluminio');
  });

  test('la sistematica cuenta los atomos', () => {
    assert.equal(nameFormula('CaO')!.systematic, 'monoxido de calcio');
    assert.equal(nameFormula('Na2O')!.systematic, 'monoxido de disodio');
    assert.equal(nameFormula('Al2O3')!.systematic, 'trioxido de dialuminio');
  });

  test('hidroxidos', () => {
    assert.equal(nameFormula('NaOH')!.stock, 'hidroxido de sodio');
    assert.equal(nameFormula('Ca(OH)2')!.stock, 'hidroxido de calcio');
    assert.equal(nameFormula('Fe(OH)3')!.stock, 'hidroxido de hierro(III)');
  });

  test('sales binarias', () => {
    assert.equal(nameFormula('NaCl')!.stock, 'cloruro de sodio');
    assert.equal(nameFormula('CaCl2')!.stock, 'cloruro de calcio');
    assert.equal(nameFormula('FeCl3')!.stock, 'cloruro de hierro(III)');
    assert.equal(nameFormula('FeCl2')!.stock, 'cloruro de hierro(II)');
    assert.equal(nameFormula('FeCl3')!.traditional, 'cloruro ferrico');
  });

  test('oxosales', () => {
    assert.equal(nameFormula('CaCO3')!.stock, 'carbonato de calcio');
    assert.equal(nameFormula('KNO3')!.stock, 'nitrato de potasio');
    assert.equal(nameFormula('Na2SO4')!.stock, 'sulfato de sodio');
    assert.equal(nameFormula('KMnO4')!.stock, 'permanganato de potasio');
  });

  test('sales acidas', () => {
    assert.equal(nameFormula('NaHCO3')!.stock, 'hidrogenocarbonato de sodio');
    assert.equal(nameFormula('NaHSO4')!.stock, 'hidrogenosulfato de sodio');
  });

  test('sales de amonio, cuyo cation no es un elemento', () => {
    assert.equal(nameFormula('NH4NO3')!.stock, 'nitrato de amonio');
  });

  test('oxosales con el anion entre parentesis', () => {
    assert.equal(nameFormula('Al2(SO4)3')!.stock, 'sulfato de aluminio');
    assert.equal(nameFormula('Ca3(PO4)2')!.stock, 'fosfato de calcio');
    assert.equal(nameFormula('Ca(NO3)2')!.stock, 'nitrato de calcio');
    // El estado de oxidacion del metal se despeja bien pese al parentesis.
    assert.equal(nameFormula('Fe2(SO4)3')!.stock, 'sulfato de hierro(III)');
    assert.equal(nameFormula('Pb(NO3)2')!.stock, 'nitrato de plomo(II)');
  });

  test('acidos binarios en nomenclatura tradicional', () => {
    assert.equal(nameFormula('HCl')!.traditional, 'acido clorhidrico');
    assert.equal(nameFormula('H2S')!.traditional, 'acido sulfhidrico');
  });

  test('oxoacidos: los sufijos dependen del estado de oxidacion', () => {
    assert.equal(nameFormula('H2SO4')!.traditional, 'acido sulfurico'); // S +6
    assert.equal(nameFormula('H2SO3')!.traditional, 'acido sulfuroso'); // S +4
    assert.equal(nameFormula('HNO3')!.traditional, 'acido nitrico'); // N +5
    assert.equal(nameFormula('HNO2')!.traditional, 'acido nitroso'); // N +3
  });

  test('la serie completa del cloro usa hipo- y per-', () => {
    assert.equal(nameFormula('HClO')!.traditional, 'acido hipocloroso'); // +1
    assert.equal(nameFormula('HClO2')!.traditional, 'acido cloroso'); // +3
    assert.equal(nameFormula('HClO3')!.traditional, 'acido clorico'); // +5
    assert.equal(nameFormula('HClO4')!.traditional, 'acido perclorico'); // +7
  });

  test('binarios covalentes: el mas electronegativo va primero', () => {
    assert.equal(nameFormula('CO2')!.systematic, 'dioxido de carbono');
    assert.equal(nameFormula('CO')!.systematic, 'monoxido de carbono');
    assert.equal(nameFormula('SO2')!.systematic, 'dioxido de azufre');
    assert.equal(nameFormula('SO3')!.systematic, 'trioxido de azufre');
  });

  test('nunca se devuelve un nombre inventado: mejor null', () => {
    const n = nameFormula('Og2Ts3');
    // Sin datos de estado de oxidacion fiables, los campos son null.
    if (n) {
      assert.equal(n.traditional, null);
    }
  });
});
