/**
 * Motor termodinamico (§18).
 *
 * Calcula el perfil energetico de una reaccion por la LEY DE HESS a partir de
 * las entalpias de formacion de la base de especies:
 *
 *   ΔH°reaccion = Σ n·ΔHf°(productos) − Σ n·ΔHf°(reactivos)
 *
 * REGLA ABSOLUTA (§18, §32): si falta el ΔHf° de una sola especie, NO se
 * calcula un valor aproximado ni se omite ese termino. Se devuelve
 * "desconocido" y se indica exactamente que sustancia falta, porque un
 * balance energetico al que le falta un sumando no es una estimacion: es un
 * numero incorrecto.
 *
 * La energia de activacion NO se calcula. No se deriva de las entalpias de
 * formacion, depende del mecanismo, y no hay forma honesta de estimarla desde
 * los datos disponibles. Se muestra como dato no disponible salvo que este
 * curada para una reaccion concreta.
 */

import type { ChemicalEquation, EnergyProfile, Measured } from '../core/types.js';
import { measured, UNKNOWN } from '../core/types.js';
import { getSpecies } from '../data/species.js';

export interface EnergyAnalysis {
  readonly profile: EnergyProfile;
  /** Especies cuyo ΔHf° falta y por tanto impiden el calculo. */
  readonly missingEnthalpy: readonly string[];
  readonly missingGibbs: readonly string[];
  readonly missingEntropy: readonly string[];
  /** Desglose legible del calculo, para el modo profesor. */
  readonly workings: readonly string[];
  /** Explicacion en prosa del resultado. */
  readonly summary: string;
}

type Getter = (formula: string) => number | null;

const hf: Getter = (f) => getSpecies(f)?.properties.deltaHf.value ?? null;
const gf: Getter = (f) => getSpecies(f)?.properties.deltaGf.value ?? null;
const s0: Getter = (f) => getSpecies(f)?.properties.standardEntropy.value ?? null;

interface SumResult {
  readonly value: number | null;
  readonly missing: string[];
  readonly terms: string[];
}

/** Σ n·X(productos) − Σ n·X(reactivos), o null si falta algun dato. */
function hessSum(equation: ChemicalEquation, get: Getter): SumResult {
  const missing: string[] = [];
  const terms: string[] = [];
  let products = 0;
  let reactants = 0;

  for (const t of equation.products) {
    const v = get(t.formula);
    if (v === null) {
      missing.push(t.formula);
      continue;
    }
    products += t.coefficient * v;
    terms.push(`  productos: ${t.coefficient} × (${v.toFixed(1)}) = ${(t.coefficient * v).toFixed(1)}`);
  }
  for (const t of equation.reactants) {
    const v = get(t.formula);
    if (v === null) {
      missing.push(t.formula);
      continue;
    }
    reactants += t.coefficient * v;
    terms.push(`  reactivos: ${t.coefficient} × (${v.toFixed(1)}) = ${(t.coefficient * v).toFixed(1)}`);
  }

  if (missing.length > 0) return { value: null, missing, terms };
  return { value: products - reactants, missing, terms };
}

export function analyzeEnergy(equation: ChemicalEquation): EnergyAnalysis {
  const enthalpy = hessSum(equation, hf);
  const gibbs = hessSum(equation, gf);
  const entropy = hessSum(equation, s0);

  const workings: string[] = [];

  let deltaH: Measured<'kJ/mol'> = UNKNOWN('kJ/mol');
  if (enthalpy.value !== null) {
    deltaH = measured(enthalpy.value, 'kJ/mol', {
      source: 'calculado por la ley de Hess a partir de ΔHf° (NIST / CRC)',
      note: 'condiciones estandar: 298,15 K y 1 bar',
    });
    workings.push('ΔH° = Σ n·ΔHf°(productos) − Σ n·ΔHf°(reactivos)');
    workings.push(...enthalpy.terms);
    workings.push(`ΔH° = ${enthalpy.value.toFixed(1)} kJ/mol`);
  }

  let deltaG: Measured<'kJ/mol'> = UNKNOWN('kJ/mol');
  if (gibbs.value !== null) {
    deltaG = measured(gibbs.value, 'kJ/mol', {
      source: 'calculado por la ley de Hess a partir de ΔGf° (NIST / CRC)',
      note: 'condiciones estandar: 298,15 K y 1 bar',
    });
  }

  let deltaS: Measured<'J/(mol K)'> = UNKNOWN('J/(mol K)');
  if (entropy.value !== null) {
    deltaS = measured(entropy.value, 'J/(mol K)', {
      source: 'calculado a partir de S° (NIST / CRC)',
      note: 'condiciones estandar: 298,15 K',
    });
  }

  const character: EnergyProfile['character'] =
    enthalpy.value === null ? 'unknown' : enthalpy.value < 0 ? 'exothermic' : 'endothermic';

  const summary = buildSummary(enthalpy.value, gibbs.value, entropy.value, enthalpy.missing);

  return {
    profile: {
      deltaH,
      deltaG,
      deltaS,
      // Nunca se estima: solo puede venir curada por reaccion.
      activationEnergy: UNKNOWN('kJ/mol'),
      character,
    },
    missingEnthalpy: [...new Set(enthalpy.missing)],
    missingGibbs: [...new Set(gibbs.missing)],
    missingEntropy: [...new Set(entropy.missing)],
    workings,
    summary,
  };
}

function buildSummary(
  dH: number | null,
  dG: number | null,
  dS: number | null,
  missing: string[],
): string {
  if (dH === null) {
    const unique = [...new Set(missing)];
    return (
      'Datos no disponibles para esta simulacion. ' +
      (unique.length
        ? `Falta la entalpia de formacion de: ${unique.join(', ')}. Sin ese dato el balance energetico estaria incompleto, asi que no se calcula.`
        : '')
    );
  }

  const parts: string[] = [];
  if (dH < 0) {
    parts.push(
      `Reaccion EXOTERMICA: libera ${Math.abs(dH).toFixed(1)} kJ por mol de reaccion. Los enlaces que se forman son mas estables que los que se rompen, y la diferencia se desprende como calor.`,
    );
  } else if (dH > 0) {
    parts.push(
      `Reaccion ENDOTERMICA: absorbe ${dH.toFixed(1)} kJ por mol de reaccion. Hace falta aportar energia del entorno para que ocurra.`,
    );
  } else {
    parts.push('El balance de entalpia es practicamente nulo.');
  }

  if (dG !== null) {
    if (dG < 0) {
      parts.push(
        `ΔG° = ${dG.toFixed(1)} kJ/mol < 0: en condiciones estandar la reaccion es ESPONTANEA. Ojo: espontanea significa termodinamicamente favorable, NO rapida — una reaccion puede ser espontanea y tardar siglos si su energia de activacion es alta.`,
      );
    } else {
      parts.push(
        `ΔG° = ${dG.toFixed(1)} kJ/mol > 0: en condiciones estandar la reaccion NO es espontanea en el sentido escrito. Puede hacerse posible cambiando la temperatura, las concentraciones, o acoplandola a otro proceso que aporte energia.`,
      );
    }
  }

  if (dS !== null) {
    if (dS > 0) {
      parts.push(
        `ΔS° = +${dS.toFixed(1)} J/(mol K): el desorden aumenta, normalmente porque se generan mas moleculas o aparece un gas. Este termino favorece la reaccion, y su peso crece con la temperatura (−TΔS).`,
      );
    } else if (dS < 0) {
      parts.push(
        `ΔS° = ${dS.toFixed(1)} J/(mol K): el desorden disminuye. Este termino se opone a la reaccion, y su efecto negativo es mayor cuanto mas alta es la temperatura.`,
      );
    }
  }

  if (dH !== null && dS !== null) {
    const crossover = crossoverTemperature(dH, dS);
    if (crossover !== null) {
      parts.push(
        `ΔH y ΔS tiran en direcciones opuestas, luego la espontaneidad DEPENDE DE LA TEMPERATURA. El cambio se produce en torno a T = ΔH/ΔS ≈ ${crossover.toFixed(0)} K (${(crossover - 273.15).toFixed(0)} °C).`,
      );
    }
  }

  return parts.join(' ');
}

/**
 * Temperatura a la que ΔG cambia de signo, cuando ΔH y ΔS se oponen.
 * Devuelve null si ambos empujan en el mismo sentido: entonces la
 * espontaneidad no depende de la temperatura.
 */
export function crossoverTemperature(deltaH: number, deltaS: number): number | null {
  if (deltaS === 0) return null;
  const favourableH = deltaH < 0;
  const favourableS = deltaS > 0;
  if (favourableH === favourableS) return null; // ambos a favor o ambos en contra
  const T = (deltaH * 1000) / deltaS; // kJ -> J
  return T > 0 ? T : null;
}

/**
 * ΔG a una temperatura dada, por la ecuacion de Gibbs-Helmholtz:
 *   ΔG = ΔH − TΔS
 * Se asume que ΔH y ΔS varian poco con la temperatura, aproximacion
 * razonable en rangos moderados. Se devuelve junto con esa advertencia.
 */
export function gibbsAt(
  deltaH: number | null,
  deltaS: number | null,
  temperatureK: number,
): { value: number | null; note: string } {
  if (deltaH === null || deltaS === null) {
    return { value: null, note: 'Faltan ΔH° o ΔS°: no se puede calcular ΔG a esta temperatura.' };
  }
  const value = deltaH - (temperatureK * deltaS) / 1000;
  return {
    value,
    note:
      'Calculado con ΔG = ΔH − TΔS suponiendo que ΔH y ΔS no varian con la temperatura. Es una aproximacion valida en rangos moderados, no un valor experimental.',
  };
}
