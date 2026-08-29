/**
 * Estequiometria y cantidades reales (§26).
 *
 * Convierte entre gramos, moles, litros y molaridad; determina el reactivo
 * limitante y el exceso; calcula rendimiento teorico y real.
 *
 * CONVENCION INTERNA: todo se reduce a MOLES en la frontera del motor. Las
 * unidades solo existen en la entrada y en la salida. Asi el nucleo del
 * calculo no tiene que conocer catorce combinaciones de unidades.
 */

import type { ChemicalEquation, Result } from '../core/types.js';
import { err, ok } from '../core/types.js';
import { parseFormula } from '../core/formula/parse.js';
import { molarMassOf } from '../core/formula/composition.js';
import { getSpecies } from '../data/species.js';

/** Constante de los gases, en L·atm/(mol·K). */
export const R_GAS = 0.082057;

/** Volumen molar de un gas ideal en condiciones normales (0 °C, 1 atm), L/mol. */
export const MOLAR_VOLUME_STP = 22.414;

export type AmountUnit = 'g' | 'mg' | 'kg' | 'mol' | 'mmol' | 'L' | 'mL';

export interface AmountInput {
  readonly formula: string;
  readonly value: number;
  readonly unit: AmountUnit;
  /** Para disoluciones: concentracion en mol/L. Se combina con volumen. */
  readonly molarity?: number;
}

export interface ResolvedAmount {
  readonly formula: string;
  readonly moles: number;
  readonly grams: number | null;
  readonly molarMass: number | null;
  /** Como se ha llegado a los moles, para el modo profesor. */
  readonly derivation: string;
}

/**
 * Convierte cualquier entrada a moles.
 *
 * Casos:
 *   - masa (g, mg, kg)      -> n = m / M
 *   - cantidad (mol, mmol)  -> directo
 *   - volumen + molaridad   -> n = M · V
 *   - volumen de gas solo   -> n = V / 22,414 (condiciones normales)
 */
export function toMoles(input: AmountInput): Result<ResolvedAmount> {
  const parsed = parseFormula(input.formula);
  if (!parsed.ok) return err(`Formula invalida: ${input.formula}`, parsed.error);

  const molarMass = molarMassOf(parsed.value.composition);

  if (!Number.isFinite(input.value) || input.value < 0) {
    return err('La cantidad debe ser un numero positivo.');
  }

  switch (input.unit) {
    case 'mol':
      return ok({
        formula: input.formula,
        moles: input.value,
        grams: molarMass === null ? null : input.value * molarMass,
        molarMass,
        derivation: `${input.value} mol (dato directo)`,
      });

    case 'mmol':
      return ok({
        formula: input.formula,
        moles: input.value / 1000,
        grams: molarMass === null ? null : (input.value / 1000) * molarMass,
        molarMass,
        derivation: `${input.value} mmol = ${input.value / 1000} mol`,
      });

    case 'g':
    case 'mg':
    case 'kg': {
      if (molarMass === null) return err(`No se puede calcular la masa molar de ${input.formula}.`);
      const grams = input.unit === 'g' ? input.value : input.unit === 'mg' ? input.value / 1000 : input.value * 1000;
      const moles = grams / molarMass;
      return ok({
        formula: input.formula,
        moles,
        grams,
        molarMass,
        derivation: `n = m / M = ${grams.toPrecision(4)} g / ${molarMass.toFixed(3)} g/mol = ${moles.toPrecision(4)} mol`,
      });
    }

    case 'L':
    case 'mL': {
      const litres = input.unit === 'L' ? input.value : input.value / 1000;
      if (input.molarity !== undefined) {
        const moles = input.molarity * litres;
        return ok({
          formula: input.formula,
          moles,
          grams: molarMass === null ? null : moles * molarMass,
          molarMass,
          derivation: `n = M · V = ${input.molarity} mol/L × ${litres} L = ${moles.toPrecision(4)} mol`,
        });
      }
      // Sin molaridad, un volumen solo tiene sentido para un gas.
      const state = getSpecies(input.formula)?.properties.state;
      if (state !== 'g') {
        return err(
          `Un volumen de ${input.formula} necesita una concentracion.`,
          'Sin molaridad, un volumen solo determina la cantidad de sustancia si se trata de un gas, donde se puede usar el volumen molar.',
        );
      }
      const moles = litres / MOLAR_VOLUME_STP;
      return ok({
        formula: input.formula,
        moles,
        grams: molarMass === null ? null : moles * molarMass,
        molarMass,
        derivation: `n = V / Vm = ${litres} L / ${MOLAR_VOLUME_STP} L/mol = ${moles.toPrecision(4)} mol (condiciones normales: 0 °C y 1 atm)`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Reactivo limitante y rendimiento
// ---------------------------------------------------------------------------

export interface ReagentAnalysis {
  readonly formula: string;
  readonly coefficient: number;
  readonly molesAvailable: number;
  /** moles disponibles / coeficiente estequiometrico. */
  readonly equivalents: number;
  readonly isLimiting: boolean;
  /** Moles que sobran al terminar la reaccion. */
  readonly molesExcess: number;
  readonly gramsExcess: number | null;
}

export interface ProductYield {
  readonly formula: string;
  readonly coefficient: number;
  readonly molesProduced: number;
  readonly gramsProduced: number | null;
  /** Volumen en litros si es un gas, en condiciones normales. */
  readonly litresIfGas: number | null;
}

export interface StoichiometryResult {
  readonly reagents: readonly ReagentAnalysis[];
  readonly products: readonly ProductYield[];
  readonly limitingReagent: string;
  /** Cuantas "veces" avanza la reaccion tal como esta escrita. */
  readonly extentOfReaction: number;
  readonly workings: readonly string[];
  readonly explanation: string;
}

/**
 * Analisis estequiometrico completo (§26).
 *
 * @param equation  ecuacion BALANCEADA
 * @param available moles disponibles de cada reactivo, por formula
 */
export function analyzeStoichiometry(
  equation: ChemicalEquation,
  available: ReadonlyMap<string, number>,
): Result<StoichiometryResult> {
  if (!equation.balanced) {
    return err('La ecuacion debe estar balanceada antes de hacer calculos estequiometricos.');
  }

  const missing = equation.reactants.filter((t) => !available.has(t.formula)).map((t) => t.formula);
  if (missing.length > 0) {
    return err(
      `Falta indicar la cantidad de: ${missing.join(', ')}.`,
      'Para determinar el reactivo limitante hacen falta las cantidades de TODOS los reactivos.',
    );
  }

  const workings: string[] = [];
  workings.push(
    'Reactivo limitante: se divide los moles disponibles de cada reactivo entre su coeficiente. El menor cociente manda.',
  );

  // El cociente n/coeficiente dice cuantas "veces" puede ocurrir la reaccion
  // segun cada reactivo. El minimo es el que se agota primero.
  let limiting = equation.reactants[0]!.formula;
  let extent = Infinity;

  for (const t of equation.reactants) {
    const moles = available.get(t.formula)!;
    const equivalents = moles / t.coefficient;
    workings.push(
      `  ${t.formula}: ${moles.toPrecision(4)} mol / ${t.coefficient} = ${equivalents.toPrecision(4)}`,
    );
    if (equivalents < extent) {
      extent = equivalents;
      limiting = t.formula;
    }
  }

  workings.push(
    `El menor cociente es ${extent.toPrecision(4)}, correspondiente a ${limiting}: es el REACTIVO LIMITANTE.`,
  );

  const reagents: ReagentAnalysis[] = equation.reactants.map((t) => {
    const moles = available.get(t.formula)!;
    const consumed = extent * t.coefficient;
    const molesExcess = moles - consumed;
    const parsed = parseFormula(t.formula);
    const M = parsed.ok ? molarMassOf(parsed.value.composition) : null;
    return {
      formula: t.formula,
      coefficient: t.coefficient,
      molesAvailable: moles,
      equivalents: moles / t.coefficient,
      isLimiting: t.formula === limiting,
      molesExcess,
      gramsExcess: M === null ? null : molesExcess * M,
    };
  });

  const products: ProductYield[] = equation.products.map((t) => {
    const molesProduced = extent * t.coefficient;
    const parsed = parseFormula(t.formula);
    const M = parsed.ok ? molarMassOf(parsed.value.composition) : null;
    const isGas = getSpecies(t.formula)?.properties.state === 'g';
    return {
      formula: t.formula,
      coefficient: t.coefficient,
      molesProduced,
      gramsProduced: M === null ? null : molesProduced * M,
      litresIfGas: isGas ? molesProduced * MOLAR_VOLUME_STP : null,
    };
  });

  for (const p of products) {
    workings.push(
      `  ${p.formula}: ${extent.toPrecision(4)} × ${p.coefficient} = ${p.molesProduced.toPrecision(4)} mol` +
        (p.gramsProduced !== null ? ` = ${p.gramsProduced.toPrecision(4)} g` : ''),
    );
  }

  const excess = reagents.filter((r) => !r.isLimiting && r.molesExcess > 1e-12);
  const explanation =
    `El reactivo limitante es ${limiting}: se consume por completo y determina cuanto producto se puede formar. ` +
    (excess.length > 0
      ? `Sobra${excess.length === 1 ? '' : 'n'} ${excess
          .map((r) => `${r.molesExcess.toPrecision(3)} mol de ${r.formula}`)
          .join(', ')}, que quedan sin reaccionar. `
      : 'Todos los reactivos se consumen en proporcion exacta: la mezcla es estequiometrica. ') +
    'Anadir mas reactivo en exceso NO produce mas producto: la cantidad esta fijada por el limitante.';

  return ok({
    reagents,
    products,
    limitingReagent: limiting,
    extentOfReaction: extent,
    workings,
    explanation,
  });
}

/** Rendimiento porcentual: real frente a teorico (§26). */
export interface YieldResult {
  readonly theoreticalGrams: number;
  readonly actualGrams: number;
  readonly percentYield: number;
  readonly explanation: string;
}

export function percentYield(theoreticalGrams: number, actualGrams: number): Result<YieldResult> {
  if (theoreticalGrams <= 0) return err('El rendimiento teorico debe ser mayor que cero.');
  if (actualGrams < 0) return err('El rendimiento experimental no puede ser negativo.');

  const percent = (actualGrams / theoreticalGrams) * 100;

  let explanation: string;
  if (percent > 100) {
    explanation =
      `Un rendimiento del ${percent.toFixed(1)} % es IMPOSIBLE quimicamente: no puede obtenerse mas producto del que permite la conservacion de la materia. ` +
      'En la practica indica un error: producto sin secar (retiene disolvente), impurezas arrastradas, o un error en la pesada o en el calculo del teorico.';
  } else if (percent > 90) {
    explanation = `Rendimiento del ${percent.toFixed(1)} %: excelente. Las perdidas por manipulacion y purificacion han sido minimas.`;
  } else if (percent > 60) {
    explanation =
      `Rendimiento del ${percent.toFixed(1)} %: normal en el laboratorio. Las perdidas tipicas vienen de reacciones incompletas o en equilibrio, ` +
      'reacciones secundarias que consumen reactivo, y producto que se queda en el filtro o en las paredes del material.';
  } else {
    explanation =
      `Rendimiento del ${percent.toFixed(1)} %: bajo. Merece la pena revisar si la reaccion alcanzo el equilibrio antes de completarse, ` +
      'si hubo reacciones competidoras, o si se perdio producto en la separacion.';
  }

  return ok({ theoreticalGrams, actualGrams, percentYield: percent, explanation });
}

/**
 * Ley de los gases ideales: PV = nRT.
 * Se resuelve la incognita que se deje en null.
 */
export interface GasState {
  readonly pressure: number | null; // atm
  readonly volume: number | null; // L
  readonly moles: number | null;
  readonly temperature: number | null; // K
}

export function idealGas(state: GasState): Result<{ solved: Required<GasState>; forVariable: string; workings: string }> {
  const unknowns = Object.entries(state).filter(([, v]) => v === null);
  if (unknowns.length !== 1) {
    return err(
      `Hay que dejar exactamente una incognita; se han dejado ${unknowns.length}.`,
      'PV = nRT tiene cuatro variables: se dan tres y se despeja la cuarta.',
    );
  }

  const { pressure: P, volume: V, moles: n, temperature: T } = state;
  const variable = unknowns[0]![0];

  switch (variable) {
    case 'pressure': {
      const value = (n! * R_GAS * T!) / V!;
      return ok({
        solved: { pressure: value, volume: V!, moles: n!, temperature: T! },
        forVariable: 'presion',
        workings: `P = nRT/V = (${n} × ${R_GAS} × ${T}) / ${V} = ${value.toPrecision(4)} atm`,
      });
    }
    case 'volume': {
      const value = (n! * R_GAS * T!) / P!;
      return ok({
        solved: { pressure: P!, volume: value, moles: n!, temperature: T! },
        forVariable: 'volumen',
        workings: `V = nRT/P = (${n} × ${R_GAS} × ${T}) / ${P} = ${value.toPrecision(4)} L`,
      });
    }
    case 'moles': {
      const value = (P! * V!) / (R_GAS * T!);
      return ok({
        solved: { pressure: P!, volume: V!, moles: value, temperature: T! },
        forVariable: 'cantidad de sustancia',
        workings: `n = PV/RT = (${P} × ${V}) / (${R_GAS} × ${T}) = ${value.toPrecision(4)} mol`,
      });
    }
    case 'temperature': {
      const value = (P! * V!) / (R_GAS * n!);
      return ok({
        solved: { pressure: P!, volume: V!, moles: n!, temperature: value },
        forVariable: 'temperatura',
        workings: `T = PV/nR = (${P} × ${V}) / (${n} × ${R_GAS}) = ${value.toPrecision(4)} K`,
      });
    }
    default:
      return err('Variable desconocida.');
  }
}

/** Molaridad a partir de masa y volumen. */
export function molarity(
  formula: string,
  grams: number,
  litres: number,
): Result<{ molarity: number; moles: number; workings: string }> {
  if (litres <= 0) return err('El volumen debe ser mayor que cero.');
  const parsed = parseFormula(formula);
  if (!parsed.ok) return err(`Formula invalida: ${formula}`);
  const M = molarMassOf(parsed.value.composition);
  if (M === null) return err(`No se puede calcular la masa molar de ${formula}.`);

  const moles = grams / M;
  const c = moles / litres;
  return ok({
    molarity: c,
    moles,
    workings:
      `n = m/M = ${grams} g / ${M.toFixed(3)} g/mol = ${moles.toPrecision(4)} mol\n` +
      `c = n/V = ${moles.toPrecision(4)} mol / ${litres} L = ${c.toPrecision(4)} mol/L`,
  });
}
