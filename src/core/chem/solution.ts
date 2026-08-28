/**
 * From reagent bottles to an equilibrium system.
 *
 * The equilibrium solver works on *components* and *totals*. A student works
 * on bottles: "0.05 mol of sodium acetate and 0.03 mol of acetic acid in
 * 250 mL". This module is the translation between the two, and it is the only
 * place in CHEMIA that knows how a reagent dissociates when it dissolves.
 *
 * The proton total T_H is the subtle part. It is a *proton condition*, counted
 * relative to a chosen reference level — here, the fully deprotonated form of
 * every acid–base core plus water. Sodium acetate therefore contributes 0 to
 * T_H, acetic acid contributes +1, and sodium hydroxide contributes −1. Getting
 * this bookkeeping right once, in one place, is what lets every downstream
 * module (titration, buffers, hydrochemistry, soil chemistry) be correct
 * without repeating the reasoning.
 */

import { substanceById } from '../../data/substances.js';
import type { Substance } from '../../domain/substance.js';
import {
  H_COMPONENT, solveEquilibrium, waterSpecies,
  type AqueousSpecies, type Component, type EquilibriumModel,
  type GasPhase, type SolidPhase, type SolveOptions, type Speciation,
} from './equilibrium.js';

/**
 * How one mole of a reagent enters the solution.
 *
 * `protons` counts protons carried *on the acid–base core*, relative to the
 * fully deprotonated reference. `hydroxide` counts strong base equivalents.
 * Spectator charges enter the ionic strength but no mass balance.
 */
export interface Dissociation {
  /** Substance id of the acid–base system this reagent feeds, if any. */
  core?: string;
  /** Moles of core released per mole of reagent. */
  coreStoich?: number;
  /** Protons carried on the core, per mole of reagent. */
  protons?: number;
  /** Strong-acid protons released directly to the solvent, per mole. */
  strongAcid?: number;
  /** Strong-base hydroxides released directly to the solvent, per mole. */
  strongBase?: number;
  /** Metal or ligand components released, id → moles per mole of reagent. */
  extra?: Record<string, number>;
  /** Net charge of the spectator cations, per mole (Na⁺ → +1, Ca²⁺ → +2). */
  spectatorCation?: number;
  /** Net charge of the spectator anions, per mole (Cl⁻ → 1, SO₄²⁻ → 2). */
  spectatorAnion?: number;
}

/**
 * Dissociation table. Explicit rather than inferred from the formula: how a
 * bottle behaves in water is chemical knowledge, not string manipulation, and
 * silently guessing it would be exactly the kind of invented result §81 rules
 * out.
 *
 * Invariant: an ion is either a *component* (listed in `extra`, and therefore
 * carrying its own mass balance and appearing in complexation and precipitation
 * reactions) or a *spectator* (counted only in the charge balance and the ionic
 * strength). Never both — double counting it would corrupt electroneutrality.
 * Chloride and iodide are components because silver chemistry needs them;
 * sulfate, nitrate, sodium and potassium are spectators because nothing in the
 * modelled chemistry binds them.
 */
export const DISSOCIATION: Record<string, Dissociation> = {
  h2o: {},

  // Strong acids and bases — no weak core, a proton or hydroxide straight out.
  hcl: { strongAcid: 1, extra: { Cl: 1 } },
  hno3: { strongAcid: 1, spectatorAnion: 1 },
  naoh: { strongBase: 1, spectatorCation: 1 },

  // Sulfuric acid: first ionisation strong, second weak — modelled as a strong
  // proton plus a hydrogensulfate core, which is the physically honest picture.
  h2so4: { strongAcid: 1, core: 'h2so4', coreStoich: 1, protons: 1 },

  // Weak acids, added as the acid form.
  ch3cooh: { core: 'ch3cooh', coreStoich: 1, protons: 1 },
  h3po4: { core: 'h3po4', coreStoich: 1, protons: 3 },
  h2co3: { core: 'h2co3', coreStoich: 1, protons: 2 },
  h2o2: { core: 'h2o2', coreStoich: 1, protons: 1 },
  khp: { core: 'khp', coreStoich: 1, protons: 1, spectatorCation: 1 },
  'acido-salicilico': { core: 'acido-salicilico', coreStoich: 1, protons: 2 },
  edta: { core: 'edta', coreStoich: 1, protons: 4 },

  // Weak bases, added as the base form.
  nh3: { core: 'nh3', coreStoich: 1, protons: 0 },

  // Salts of weak acids: the core arrives partly or fully deprotonated.
  na2co3: { core: 'h2co3', coreStoich: 1, protons: 0, spectatorCation: 2 },
  nahco3: { core: 'h2co3', coreStoich: 1, protons: 1, spectatorCation: 1 },
  kh2po4: { core: 'h3po4', coreStoich: 1, protons: 2, spectatorCation: 1 },
  na2hpo4: { core: 'h3po4', coreStoich: 1, protons: 1, spectatorCation: 2 },
  na2c2o4: { core: 'na2c2o4', coreStoich: 1, protons: 0, spectatorCation: 2 },
  khc4h4o6: { core: 'khc4h4o6', coreStoich: 1, protons: 1, spectatorCation: 1 },
  na2b4o7: { core: 'na2b4o7', coreStoich: 4, protons: 2, spectatorCation: 2 },

  // Strong electrolytes.
  nacl: { spectatorCation: 1, extra: { Cl: 1 } },
  ki: { spectatorCation: 1, extra: { I: 1 } },

  // Metal salts. The metal is a component; hydrolysis and complexation species
  // are added by the model builder when the relevant ligand is present.
  cuso4: { extra: { Cu: 1 }, spectatorAnion: 2 },
  fecl3: { extra: { Fe: 1, Cl: 3 } },
  cacl2: { extra: { Ca: 1, Cl: 2 } },
  mgso4: { extra: { Mg: 1 }, spectatorAnion: 2 },
  agno3: { extra: { Ag: 1 }, spectatorAnion: 1 },
  caco3: { extra: { Ca: 1 }, core: 'h2co3', coreStoich: 1, protons: 0 },
  zn: { extra: { Zn: 1 } },
};

/** One reagent added to a solution. */
export interface Addition {
  substanceId: string;
  /** Amount added, in moles. */
  moles: number;
}

export interface SolutionSpec {
  additions: Addition[];
  /** Total volume, litres. */
  volume: number;
  temperature?: number;
  /** Gases in equilibrium with the solution, partial pressure in bar. */
  atmosphere?: Record<string, number>;
}

export interface BuiltSolution {
  model: EquilibriumModel;
  totals: Record<string, number>;
  volume: number;
  /** Analytical concentration of each reagent as added, mol·L⁻¹. */
  analytical: Record<string, number>;
  /** Reagents whose dissociation is not described — reported, not guessed. */
  unknownReagents: string[];
}

/** Metal components CHEMIA models, with the charge of the free aquo ion. */
const METAL_COMPONENTS: Record<string, { name: string; charge: number; formula: string }> = {
  Cu: { name: 'cobre(II)', charge: 2, formula: 'Cu2+' },
  Fe: { name: 'hierro(III)', charge: 3, formula: 'Fe3+' },
  Ca: { name: 'calcio', charge: 2, formula: 'Ca2+' },
  Mg: { name: 'magnesio', charge: 2, formula: 'Mg2+' },
  Ag: { name: 'plata', charge: 1, formula: 'Ag+' },
  Zn: { name: 'zinc(II)', charge: 2, formula: 'Zn2+' },
  Cl: { name: 'cloruro', charge: -1, formula: 'Cl-' },
  I: { name: 'yoduro', charge: -1, formula: 'I-' },
};

/**
 * Complexation and precipitation reactions that switch on when the relevant
 * components are both present. log β values from the IUPAC stability-constant
 * compilations (25 °C, I = 0.1 M unless noted).
 */
const CONDITIONAL_SPECIES: Array<{
  requires: string[];
  species?: AqueousSpecies[];
  solids?: SolidPhase[];
}> = [
  {
    requires: ['Cu'],
    species: [
      { id: 'CuOH+', formula: 'CuOH+', stoich: { Cu: 1, H: -1 }, logBeta: -7.5, charge: 1 },
      { id: 'Cu(OH)2', formula: 'Cu(OH)2', stoich: { Cu: 1, H: -2 }, logBeta: -16.2, charge: 0 },
    ],
    solids: [{
      // Ksp = [Cu²⁺][OH⁻]² = 10⁻¹⁴·⁷. The tableau writes hydroxide as H⁻¹, so
      // the constant is restated against the proton: log K = −14.7 + 2·pKw.
      id: 'Cu(OH)2(s)', formula: 'Cu(OH)2', stoich: { Cu: 1, H: -2 }, logKsp: -14.7 + 28.0,
      molarMass: 97.561, name: 'hidróxido de cobre(II)',
    }],
  },
  {
    requires: ['Cu', 'nh3'],
    species: [
      { id: 'Cu(NH3)^2+', formula: 'Cu(NH3)^2+', stoich: { Cu: 1, nh3: 1 }, logBeta: 4.31, charge: 2 },
      { id: 'Cu(NH3)2^2+', formula: 'Cu(NH3)2^2+', stoich: { Cu: 1, nh3: 2 }, logBeta: 7.98, charge: 2 },
      { id: 'Cu(NH3)3^2+', formula: 'Cu(NH3)3^2+', stoich: { Cu: 1, nh3: 3 }, logBeta: 11.02, charge: 2 },
      { id: 'Cu(NH3)4^2+', formula: 'Cu(NH3)4^2+', stoich: { Cu: 1, nh3: 4 }, logBeta: 13.32, charge: 2 },
    ],
  },
  {
    requires: ['Fe'],
    species: [
      { id: 'FeOH^2+', formula: 'FeOH^2+', stoich: { Fe: 1, H: -1 }, logBeta: -2.19, charge: 2 },
      { id: 'Fe(OH)2+', formula: 'Fe(OH)2+', stoich: { Fe: 1, H: -2 }, logBeta: -5.67, charge: 1 },
      { id: 'Fe(OH)3', formula: 'Fe(OH)3', stoich: { Fe: 1, H: -3 }, logBeta: -12.56, charge: 0 },
      { id: 'Fe(OH)4-', formula: 'Fe(OH)4-', stoich: { Fe: 1, H: -4 }, logBeta: -21.6, charge: -1 },
    ],
    solids: [{
      // Ksp = [Fe³⁺][OH⁻]³ = 10⁻³⁸·⁸  →  log K = −38.8 + 3·pKw.
      id: 'Fe(OH)3(s)', formula: 'Fe(OH)3', stoich: { Fe: 1, H: -3 }, logKsp: -38.8 + 42.0,
      molarMass: 106.867, name: 'hidróxido de hierro(III)',
    }],
  },
  {
    requires: ['Ag', 'Cl'],
    solids: [{
      id: 'AgCl(s)', formula: 'AgCl', stoich: { Ag: 1, Cl: 1 }, logKsp: -9.75,
      molarMass: 143.32, name: 'cloruro de plata',
    }],
    species: [
      { id: 'AgCl(ac)', formula: 'AgCl(ac)', stoich: { Ag: 1, Cl: 1 }, logBeta: 3.31, charge: 0 },
      { id: 'AgCl2-', formula: 'AgCl2-', stoich: { Ag: 1, Cl: 2 }, logBeta: 5.25, charge: -1 },
    ],
  },
  {
    requires: ['Ag', 'I'],
    solids: [{
      id: 'AgI(s)', formula: 'AgI', stoich: { Ag: 1, I: 1 }, logKsp: -16.08,
      molarMass: 234.77, name: 'yoduro de plata',
    }],
  },
  {
    requires: ['Ag', 'nh3'],
    species: [
      { id: 'Ag(NH3)+', formula: 'Ag(NH3)+', stoich: { Ag: 1, nh3: 1 }, logBeta: 3.31, charge: 1 },
      { id: 'Ag(NH3)2+', formula: 'Ag(NH3)2+', stoich: { Ag: 1, nh3: 2 }, logBeta: 7.23, charge: 1 },
    ],
  },
  {
    requires: ['Ca', 'h2co3'],
    solids: [{
      // The carbonate component is already CO₃²⁻, so the calcite solubility
      // product is used as tabulated: Ksp = [Ca²⁺][CO₃²⁻] = 10⁻⁸·⁴⁸.
      id: 'CaCO3(s)', formula: 'CaCO3', stoich: { Ca: 1, h2co3: 1 }, logKsp: -8.48,
      molarMass: 100.087, name: 'calcita',
    }],
  },
  {
    requires: ['Ca', 'edta'],
    species: [{ id: 'CaY^2-', formula: 'CaY^2-', stoich: { Ca: 1, edta: 1 }, logBeta: 10.69, charge: -2 }],
  },
  {
    requires: ['Mg', 'edta'],
    species: [{ id: 'MgY^2-', formula: 'MgY^2-', stoich: { Mg: 1, edta: 1 }, logBeta: 8.79, charge: -2 }],
  },
  {
    requires: ['Cu', 'edta'],
    species: [{ id: 'CuY^2-', formula: 'CuY^2-', stoich: { Cu: 1, edta: 1 }, logBeta: 18.80, charge: -2 }],
  },
  {
    requires: ['Fe', 'edta'],
    species: [{ id: 'FeY-', formula: 'FeY-', stoich: { Fe: 1, edta: 1 }, logBeta: 25.1, charge: -1 }],
  },
  {
    requires: ['Ca'],
    species: [{ id: 'CaOH+', formula: 'CaOH+', stoich: { Ca: 1, H: -1 }, logBeta: -12.6, charge: 1 }],
  },
  {
    requires: ['Mg'],
    species: [{ id: 'MgOH+', formula: 'MgOH+', stoich: { Mg: 1, H: -1 }, logBeta: -11.44, charge: 1 }],
    solids: [{
      // Ksp = [Mg²⁺][OH⁻]² = 10⁻¹¹·¹⁶  →  log K = −11.16 + 2·pKw.
      id: 'Mg(OH)2(s)', formula: 'Mg(OH)2', stoich: { Mg: 1, H: -2 }, logKsp: -11.16 + 28.0,
      molarMass: 58.320, name: 'brucita',
    }],
  },
];

/**
 * Atmospheric CO₂ exchange — the reason an open beaker of distilled water sits
 * at pH ≈ 5.6 and not 7.0, and the reason a NaOH solution left uncapped drifts.
 *
 * The dissolution reaction is written down to the carbonate component:
 *
 *   CO₂(g) + H₂O ⇌ H₂CO₃*          K_H = 10^−1.47 mol·L⁻¹·bar⁻¹
 *   H₂CO₃*        ⇌ CO₃²⁻ + 2 H⁺    K_a1·K_a2 = 10^−(6.352+10.329)
 *   ─────────────────────────────
 *   CO₂(g) + H₂O ⇌ CO₃²⁻ + 2 H⁺     log K = −1.47 − 16.681
 */
export const CO2_GAS: GasPhase = {
  id: 'CO2(g)', formula: 'CO2(g)',
  stoich: { h2co3: 1, H: 2 },
  logK: -1.47 - (6.352 + 10.329),
  deltaH: -19400,
  controls: 'h2co3',
};

/**
 * Build the equilibrium model and the analytical totals for a solution.
 *
 * Every acid–base core present contributes one component and its full ladder
 * of protonation species, derived from the pKa values on the substance record —
 * so adding a pKa to the database is all it takes to make a new acid work
 * everywhere in CHEMIA.
 */
export function buildSolution(spec: SolutionSpec): BuiltSolution {
  const V = spec.volume;
  const components: Component[] = [H_COMPONENT];
  const species: AqueousSpecies[] = waterSpecies();
  const solids: SolidPhase[] = [];
  const totals: Record<string, number> = { H: 0 };
  const analytical: Record<string, number> = {};
  const unknownReagents: string[] = [];

  let inertCations = 0;
  let inertAnions = 0;

  const coresPresent = new Set<string>();
  const extrasPresent = new Set<string>();

  for (const add of spec.additions) {
    if (add.moles === 0) continue;
    const d = DISSOCIATION[add.substanceId];
    const substance = substanceById(add.substanceId);
    if (!d || !substance) {
      unknownReagents.push(add.substanceId);
      continue;
    }
    analytical[add.substanceId] = (analytical[add.substanceId] ?? 0) + add.moles / V;

    totals.H += ((d.strongAcid ?? 0) - (d.strongBase ?? 0)) * add.moles / V;

    if (d.core) {
      coresPresent.add(d.core);
      const n = (d.coreStoich ?? 1) * add.moles / V;
      totals[d.core] = (totals[d.core] ?? 0) + n;
      totals.H += (d.protons ?? 0) * add.moles / V;
    }
    for (const [id, stoich] of Object.entries(d.extra ?? {})) {
      extrasPresent.add(id);
      totals[id] = (totals[id] ?? 0) + stoich * add.moles / V;
    }
    inertCations += (d.spectatorCation ?? 0) * add.moles / V;
    inertAnions += (d.spectatorAnion ?? 0) * add.moles / V;
  }

  // Acid–base cores → one component plus its protonation ladder.
  for (const coreId of coresPresent) {
    const s = substanceById(coreId);
    const ab = s?.acidBase;
    if (!s || !ab) continue;
    const n = ab.pKa.length;
    const baseCharge = ab.chargeProtonated - n;

    components.push({
      id: coreId, name: s.name, charge: baseCharge,
      formula: ab.conjugates[n - 1] ?? s.formula,
    });
    species.push({
      id: `${coreId}:0`, formula: ab.conjugates[n - 1] ?? s.formula,
      name: `${s.name} (forma desprotonada)`,
      stoich: { [coreId]: 1 }, logBeta: 0, charge: baseCharge, isComponent: true,
    });

    // Cumulative formation constants: β_k = Π K_a of the last k steps, inverted.
    let logBeta = 0;
    for (let k = 1; k <= n; k++) {
      logBeta += ab.pKa[n - k];
      const formula = k === n ? ab.fullyProtonated : ab.conjugates[n - k - 1];
      const dH = ab.deltaH ? -ab.deltaH.slice(n - k, n).reduce((a, b) => a + b, 0) : undefined;
      species.push({
        id: `${coreId}:${k}`, formula,
        name: `${s.name} (${k} H⁺)`,
        stoich: { [coreId]: 1, H: k },
        logBeta,
        charge: baseCharge + k,
        deltaH: dH,
      });
    }
  }

  // Metal / halide components.
  for (const id of extrasPresent) {
    const meta = METAL_COMPONENTS[id];
    if (!meta) continue;
    components.push({ id, name: meta.name, charge: meta.charge, formula: meta.formula });
    species.push({
      id, formula: meta.formula, name: meta.name,
      stoich: { [id]: 1 }, logBeta: 0, charge: meta.charge, isComponent: true,
    });
  }

  // Conditional chemistry: switch on the reactions whose components are present.
  const present = new Set([...coresPresent, ...extrasPresent]);
  for (const rule of CONDITIONAL_SPECIES) {
    if (!rule.requires.every((r) => present.has(r))) continue;
    species.push(...(rule.species ?? []));
    solids.push(...(rule.solids ?? []));
  }

  const gases: GasPhase[] = [];
  if (spec.atmosphere?.['CO2(g)']) {
    if (!present.has('h2co3')) {
      // CO2 exchange needs the carbonate ladder even if no carbonate was weighed.
      const carbonic = substanceById('h2co3');
      if (carbonic?.acidBase) {
        components.push({ id: 'h2co3', name: 'carbonato', charge: -2, formula: 'CO3^2-' });
        species.push(
          { id: 'h2co3:0', formula: 'CO3^2-', name: 'carbonato', stoich: { h2co3: 1 }, logBeta: 0, charge: -2, isComponent: true },
          { id: 'h2co3:1', formula: 'HCO3-', name: 'bicarbonato', stoich: { h2co3: 1, H: 1 }, logBeta: 10.329, charge: -1, deltaH: -14900 },
          { id: 'h2co3:2', formula: 'H2CO3*', name: 'CO₂ disuelto', stoich: { h2co3: 1, H: 2 }, logBeta: 16.681, charge: 0, deltaH: -24050 },
        );
        totals.h2co3 = totals.h2co3 ?? 0;
      }
    }
    gases.push(CO2_GAS);
  }

  return {
    model: {
      components, species,
      solids: solids.length ? solids : undefined,
      gases: gases.length ? gases : undefined,
      inertCations, inertAnions,
    },
    totals,
    volume: V,
    analytical,
    unknownReagents,
  };
}

/** Build and solve in one step. */
export function solveSolution(spec: SolutionSpec, options: SolveOptions = {}): Speciation & { built: BuiltSolution } {
  const built = buildSolution(spec);
  const result = solveEquilibrium(built.model, built.totals, {
    temperature: spec.temperature,
    partialPressures: spec.atmosphere,
    ...options,
  });
  if (built.unknownReagents.length > 0) {
    result.warnings.push(
      `Sin datos de disociación para: ${built.unknownReagents.join(', ')}. `
      + 'Estos reactivos no se han incluido en el equilibrio.',
    );
  }
  return { ...result, built };
}

/** Convenience: concentration of a reagent needed for a target amount. */
export const molesFromConcentration = (c: number, volumeL: number): number => c * volumeL;

/** Grams of a reagent for a target number of moles. */
export function gramsFor(substance: Substance, moles: number): number {
  return moles * substance.molarMass;
}
