/**
 * DE LA COMPOSICION PORCENTUAL A LA FORMULA (§4.2.1 y §4.2.2).
 *
 * POR QUE HACIA FALTA ESCRIBIR ESTO
 * El proyecto ya sabia ir de la formula al porcentaje: `molarMass` devuelve el
 * desglose con el `massPercent` de cada elemento, y de ahi sale el apartado
 * 4.2.3 entero. Lo que no existia era el camino CONTRARIO, que es el que se
 * pide en los examenes y el unico que reproduce lo que hace un quimico de
 * verdad: el analisis elemental de una muestra da porcentajes, y de ellos hay
 * que deducir la formula.
 *
 * Es tambien el unico apartado del temario donde la formula NO se conoce de
 * antemano. En todos los demas se parte de «H₂O» y se analiza; aqui se parte de
 * «40,00 % C, 6,71 % H, 53,29 % O» y hay que llegar a C₆H₁₂O₆. Sin esto, el
 * 4.2.1 y el 4.2.2 serian dos definiciones de diccionario.
 *
 * LOS TRES SITIOS DONDE ESTE CALCULO SE PUEDE MENTIR, Y QUE SE HACE EN CADA UNO
 *
 * 1. LOS PORCENTAJES NO SUMAN 100. Puede ser redondeo (99,99) o puede ser que
 *    falte un elemento del analisis, que es un error real y grave. Se avisa
 *    siempre que la desviacion pase de 0,5 puntos, y se RECHAZA por encima de
 *    2, porque a partir de ahi la formula que saliera no describiria la
 *    muestra.
 *
 * 2. LAS RAZONES NO CAEN EN ENTEROS. Aqui esta la tentacion grande: redondear
 *    1,33 a 1 y seguir. Lo correcto es multiplicar el conjunto por 3 y obtener
 *    4. Se prueban los multiplicadores del 1 al 6 y se toma el PRIMERO que deja
 *    todas las razones a menos de 0,1 de un entero. Si ninguno lo consigue, la
 *    funcion NO devuelve una formula aproximada: devuelve un error diciendo
 *    cual es la razon que no cuadra. Inventar un subindice es inventar una
 *    sustancia (§32).
 *
 * 3. EL MULTIPLICADOR MOLECULAR NO ES ENTERO. n = M / M(empirica) tiene que
 *    salir entero: una molecula no puede tener 2,4 veces la formula minima. Si
 *    sale 2,4, o la masa molar esta mal o los porcentajes lo estan. Se declara
 *    en lugar de redondear.
 *
 * En los tres casos la regla es la misma que en el resto del proyecto: cuando
 * el dato no da para concluir, se dice — no se rellena.
 */

import type { Composition, Result } from '../types.js';
import { err, ok } from '../types.js';
import { getElement } from '../../data/elements.js';
import { hillOrder, molarMass } from './composition.js';

/** Cuanto puede alejarse una razon de un entero para seguir considerandola ese entero. */
const INTEGER_TOLERANCE = 0.1;

/** Hasta que multiplicador se prueba para convertir las razones en enteros. */
const MAX_MULTIPLIER = 6;

/** Desviacion de la suma de porcentajes que solo merece un aviso. */
const SUM_WARN = 0.5;

/** Desviacion de la suma de porcentajes a partir de la cual se rechaza. */
const SUM_REFUSE = 2;

/** Un elemento del analisis, tal como lo da el laboratorio. */
export interface PercentEntry {
  readonly symbol: string;
  readonly percent: number;
}

/** El calculo de un elemento, paso a paso, para poder ENSENARLO. */
export interface EmpiricalStep {
  readonly symbol: string;
  readonly percent: number;
  readonly atomicMass: number;
  /** Moles en 100 g de muestra: el porcentaje dividido por la masa atomica. */
  readonly moles: number;
  /** Los moles divididos por el menor de todos. */
  readonly ratio: number;
  /** La razon multiplicada por el factor comun, si hizo falta. */
  readonly scaled: number;
  /** El subindice final, ya entero. */
  readonly subscript: number;
}

export interface EmpiricalResult {
  readonly steps: readonly EmpiricalStep[];
  /** El factor por el que hubo que multiplicar todas las razones. 1 si ninguno. */
  readonly multiplier: number;
  readonly empirical: Composition;
  readonly empiricalFormula: string;
  readonly empiricalMass: number;
  /** Suma real de los porcentajes dados: se ensena, no se corrige por detras. */
  readonly percentSum: number;
}

export interface MolecularResult extends EmpiricalResult {
  /** n = M / M(empirica), sin redondear: es el numero que hay que mirar. */
  readonly factorRaw: number;
  /** n ya entero. */
  readonly factor: number;
  readonly molecular: Composition;
  readonly molecularFormula: string;
  readonly molecularMass: number;
}

/** Escribe una composicion como formula en orden de Hill: C, H, y el resto alfabetico. */
export function formulaOf(composition: Composition): string {
  return hillOrder(composition)
    .map((s) => {
      const n = composition.get(s) ?? 0;
      return n === 1 ? s : `${s}${n}`;
    })
    .join('');
}

/** ¿Esta este numero a menos de la tolerancia de un entero? */
function nearInteger(x: number): boolean {
  return Math.abs(x - Math.round(x)) <= INTEGER_TOLERANCE;
}

/**
 * FORMULA EMPIRICA (MINIMA) A PARTIR DE PORCENTAJES EN MASA.
 *
 * El procedimiento es el de siempre, y cada paso queda guardado en `steps`
 * porque el apartado 4.2.1 tiene que poder ensenarlo y no solo dar el
 * resultado:
 *
 *   1. Tomar 100 g de muestra. Asi cada porcentaje se lee directamente como
 *      gramos, que es el truco que hace todo esto facil.
 *   2. Pasar los gramos a moles dividiendo por la masa atomica.
 *   3. Dividir todos los moles por el menor. Sale la proporcion.
 *   4. Si la proporcion no es de enteros, multiplicar hasta que lo sea.
 */
export function empiricalFromPercent(entries: readonly PercentEntry[]): Result<EmpiricalResult> {
  if (entries.length === 0) return err('Hace falta al menos un elemento.');

  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.symbol)) return err(`El elemento "${e.symbol}" aparece dos veces.`);
    seen.add(e.symbol);
    if (!(e.percent > 0)) {
      return err(
        `El porcentaje de "${e.symbol}" es ${e.percent}.`,
        'Un elemento presente tiene porcentaje positivo; si no esta, no se incluye.',
      );
    }
  }

  const percentSum = entries.reduce((a, e) => a + e.percent, 0);
  const deviation = Math.abs(percentSum - 100);
  if (deviation > SUM_REFUSE) {
    return err(
      `Los porcentajes suman ${percentSum.toFixed(2)} %, no 100 %.`,
      'Una desviacion asi no es redondeo: o falta un elemento del analisis o alguno esta mal medido. ' +
        'Con datos que no describen la muestra, la formula que saliera tampoco la describiria.',
    );
  }

  // Paso 1 y 2: 100 g de muestra, gramos a moles.
  const rows: { symbol: string; percent: number; atomicMass: number; moles: number }[] = [];
  for (const e of entries) {
    const el = getElement(e.symbol);
    if (!el) return err(`Elemento desconocido: "${e.symbol}".`);
    rows.push({ symbol: e.symbol, percent: e.percent, atomicMass: el.atomicMass, moles: e.percent / el.atomicMass });
  }

  // Paso 3: dividir por el menor.
  const minMoles = Math.min(...rows.map((r) => r.moles));
  if (!(minMoles > 0)) return err('Todos los moles salen cero: revisa los porcentajes.');
  const ratios = rows.map((r) => r.moles / minMoles);

  // Paso 4: buscar el multiplicador que deja TODAS las razones en enteros.
  let multiplier = 0;
  for (let k = 1; k <= MAX_MULTIPLIER; k++) {
    if (ratios.every((r) => nearInteger(r * k))) {
      multiplier = k;
      break;
    }
  }

  if (multiplier === 0) {
    // Se declara cual es la razon que no cuadra: es la informacion util.
    const worst = ratios
      .map((r, i) => ({ symbol: rows[i]!.symbol, ratio: r, off: Math.abs(r - Math.round(r)) }))
      .sort((a, b) => b.off - a.off)[0]!;
    return err(
      `Las proporciones no caen en numeros enteros: ${worst.symbol} da ${worst.ratio.toFixed(3)}.`,
      `Se ha probado a multiplicar el conjunto por 2, 3, 4, 5 y 6 y ninguno lo arregla. Redondear ` +
        `${worst.ratio.toFixed(3)} a ${Math.round(worst.ratio)} seria inventarse la formula.`,
    );
  }

  const steps: EmpiricalStep[] = rows.map((r, i) => {
    const ratio = ratios[i]!;
    const scaled = ratio * multiplier;
    return {
      symbol: r.symbol,
      percent: r.percent,
      atomicMass: r.atomicMass,
      moles: r.moles,
      ratio,
      scaled,
      subscript: Math.round(scaled),
    };
  });

  const empirical: Composition = new Map(steps.map((s) => [s.symbol, s.subscript]));
  const mass = molarMass(empirical);
  if (!mass.ok) return mass;

  const warnings: string[] = [];
  if (deviation > SUM_WARN) {
    warnings.push(
      `Los porcentajes suman ${percentSum.toFixed(2)} % en lugar de 100 %. Es poco, y la formula sale ` +
        'igual, pero conviene saberlo.',
    );
  }

  return ok(
    {
      steps,
      multiplier,
      empirical,
      empiricalFormula: formulaOf(empirical),
      empiricalMass: mass.value.total,
      percentSum,
    },
    warnings,
  );
}

/**
 * FORMULA MOLECULAR: la minima, multiplicada por un entero.
 *
 * La formula empirica sola NO distingue el formaldehido (CH₂O) del acido
 * acetico (C₂H₄O₂) ni de la glucosa (C₆H₁₂O₆): las tres dan exactamente los
 * mismos porcentajes, porque tienen la misma proporcion. Lo que las separa es
 * la MASA MOLAR, y por eso hace falta un dato mas que el analisis elemental no
 * da. Ese es el argumento entero del apartado 4.2.2.
 */
export function molecularFromPercent(
  entries: readonly PercentEntry[],
  molarMassValue: number,
): Result<MolecularResult> {
  const base = empiricalFromPercent(entries);
  if (!base.ok) return base;
  if (!(molarMassValue > 0)) return err('La masa molar tiene que ser un numero positivo.');

  const factorRaw = molarMassValue / base.value.empiricalMass;
  if (!nearInteger(factorRaw)) {
    return err(
      `M / M(empirica) = ${factorRaw.toFixed(3)}, que no es un numero entero.`,
      'Una molecula contiene un numero entero de veces la formula minima, asi que este cociente tiene ' +
        'que salir entero. Si no sale, el fallo esta en la masa molar o en los porcentajes — no en la ' +
        'formula minima, que ya estaba bien.',
    );
  }

  const factor = Math.max(1, Math.round(factorRaw));
  const molecular: Composition = new Map(
    [...base.value.empirical].map(([s, n]) => [s, n * factor] as const),
  );
  const mass = molarMass(molecular);
  if (!mass.ok) return mass;

  return ok(
    {
      ...base.value,
      factorRaw,
      factor,
      molecular,
      molecularFormula: formulaOf(molecular),
      molecularMass: mass.value.total,
    },
    base.warnings,
  );
}

/**
 * El camino de ida, para poder cerrar el circulo: formula → porcentajes.
 *
 * Existe para que el apartado 4.2.3 pueda COMPROBARSE contra el 4.2.1 en lugar
 * de pedir que se crea: se parte de C₆H₁₂O₆, se sacan los porcentajes, se
 * vuelven a meter en `empiricalFromPercent` y tiene que volver a salir CH₂O.
 * Una prueba hace exactamente eso.
 */
export function percentOf(composition: Composition): Result<readonly PercentEntry[]> {
  const mass = molarMass(composition);
  if (!mass.ok) return mass;
  return ok(mass.value.perElement.map((r) => ({ symbol: r.symbol, percent: r.massPercent })));
}
