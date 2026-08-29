/**
 * Balanceo de ecuaciones quimicas (§10, §11).
 *
 * METODO
 * Cada especie es una columna; cada elemento (mas una fila extra para la
 * carga) es una fila. Balancear equivale a encontrar el nucleo de la matriz:
 *
 *   H2 + O2 -> H2O
 *
 *        H2   O2   H2O
 *   H  [  2    0   -2  ]  = 0
 *   O  [  0    2   -1  ]  = 0
 *
 * Los productos entran con signo negativo, de modo que "reactivos menos
 * productos = 0" ES la conservacion de atomos. La solucion (2, 1, 2) da
 * 2H₂ + O₂ -> 2H₂O.
 *
 * Se resuelve con aritmetica racional exacta (ver rational.ts) para garantizar
 * los "coeficientes minimos enteros" que pide el brief.
 *
 * DIAGNOSTICO
 * La dimension del nucleo dice cosas quimicamente utiles:
 *   0 -> imposible: falta un elemento en un lado, o la reaccion es incorrecta.
 *   1 -> caso normal: solucion unica salvo escala.
 *  >1 -> ambigua: se han mezclado dos transformaciones independientes. El
 *        motor lo dice en vez de elegir una arbitrariamente.
 */

import type { ChemicalEquation, Composition, EquationTerm, Result } from './types.js';
import { err, ok } from './types.js';
import { parseFormula } from './formula/parse.js';
import { nullSpace, rat, toSmallestIntegers, type Rational, type RationalMatrix } from './rational.js';

export interface BalanceInputSpecies {
  readonly formula: string;
  readonly composition: Composition;
  readonly charge: number;
  readonly speciesId?: string;
}

export interface AtomTally {
  readonly symbol: string;
  readonly reactants: number;
  readonly products: number;
  readonly balanced: boolean;
}

export interface BalanceResult {
  readonly coefficients: readonly number[];
  readonly reactantCoefficients: readonly number[];
  readonly productCoefficients: readonly number[];
  /** Tabla "Reactivos | Productos" por elemento (§10). */
  readonly tally: readonly AtomTally[];
  /** Balance de carga, para ecuaciones ionicas. */
  readonly chargeTally: { readonly reactants: number; readonly products: number; readonly balanced: boolean };
  /** Dimension del nucleo: 1 = solucion unica. */
  readonly solutionSpaceDimension: number;
  readonly warnings: readonly string[];
}

/** Convierte una lista de formulas en especies analizadas. */
export function parseSpeciesList(formulas: readonly string[]): Result<BalanceInputSpecies[]> {
  const out: BalanceInputSpecies[] = [];
  for (const f of formulas) {
    const parsed = parseFormula(f);
    if (!parsed.ok) return err(`No se pudo leer la formula "${f}".`, parsed.error);
    out.push({ formula: f, composition: parsed.value.composition, charge: parsed.value.charge });
  }
  return ok(out);
}

/**
 * Balancea reactivos -> productos.
 *
 * Siempre se incluye la fila de carga: para ecuaciones moleculares todas las
 * cargas son 0 y la fila es trivial, pero para semirreacciones y ecuaciones
 * ionicas netas es imprescindible (§10: "conservacion de carga").
 */
export function balance(
  reactants: readonly BalanceInputSpecies[],
  products: readonly BalanceInputSpecies[],
): Result<BalanceResult> {
  if (reactants.length === 0) return err('No hay reactivos.');
  if (products.length === 0) return err('No hay productos.');

  const all = [...reactants, ...products];
  const nR = reactants.length;

  // Elementos presentes, en orden estable.
  const symbols: string[] = [];
  const seen = new Set<string>();
  for (const s of all) {
    for (const sym of s.composition.keys()) {
      if (!seen.has(sym)) {
        seen.add(sym);
        symbols.push(sym);
      }
    }
  }

  // Comprobacion previa que da un error mucho mejor que "sin solucion":
  // un elemento que aparece en un solo lado no puede conservarse.
  const inReactants = new Set<string>();
  const inProducts = new Set<string>();
  for (const s of reactants) for (const sym of s.composition.keys()) inReactants.add(sym);
  for (const s of products) for (const sym of s.composition.keys()) inProducts.add(sym);

  const onlyLeft = [...inReactants].filter((s) => !inProducts.has(s));
  const onlyRight = [...inProducts].filter((s) => !inReactants.has(s));
  if (onlyLeft.length || onlyRight.length) {
    const parts: string[] = [];
    if (onlyLeft.length) parts.push(`${onlyLeft.join(', ')} solo aparece(n) entre los reactivos`);
    if (onlyRight.length) parts.push(`${onlyRight.join(', ')} solo aparece(n) entre los productos`);
    return err(
      'La ecuacion no puede balancearse: no se conservan los atomos.',
      `${parts.join('; ')}. La materia no se crea ni se destruye, luego falta alguna especie en la ecuacion.`,
    );
  }

  // Matriz: una fila por elemento + una fila de carga.
  const matrix: RationalMatrix = [];
  for (const sym of symbols) {
    const row: Rational[] = all.map((s, i) => {
      const n = s.composition.get(sym) ?? 0;
      return rat(i < nR ? n : -n);
    });
    matrix.push(row);
  }
  const chargeRow: Rational[] = all.map((s, i) => rat(i < nR ? s.charge : -s.charge));
  matrix.push(chargeRow);

  const kernel = nullSpace(matrix);

  if (kernel.length === 0) {
    return err(
      'No existe ningun conjunto de coeficientes que balancee esta ecuacion.',
      'Los reactivos y los productos indicados son incompatibles: no hay forma de conservar simultaneamente todos los atomos y la carga. Revisa si falta un producto (agua, un gas) o si alguna formula esta mal escrita.',
    );
  }

  const warnings: string[] = [];
  let solution = kernel[0]!;

  if (kernel.length > 1) {
    warnings.push(
      `La ecuacion es ambigua: admite ${kernel.length} familias independientes de soluciones. ` +
        'Normalmente significa que se han escrito dos reacciones distintas en una sola linea, o que sobra una especie. Se muestra una de las soluciones posibles.',
    );
    // Se intenta una combinacion con todos los coeficientes del mismo signo.
    const combined = kernel.reduce<Rational[]>(
      (acc, vec) => acc.map((v, i) => rat(v.n * vec[i]!.d + vec[i]!.n * v.d, v.d * vec[i]!.d)),
      kernel[0]!.map(() => rat(0)),
    );
    if (toSmallestIntegers(combined)) solution = combined;
  }

  const ints = toSmallestIntegers(solution);
  if (!ints) {
    return err(
      'No se ha encontrado una solucion con todos los coeficientes positivos.',
      'La unica solucion matematica exigiria un coeficiente negativo, lo que significaria mover una especie al otro lado de la flecha. Revisa el planteamiento de la reaccion.',
    );
  }

  const coefficients = ints.map((b) => Number(b));

  if (coefficients.some((c) => c === 0)) {
    warnings.push(
      'Alguna especie ha recibido coeficiente 0: no participa realmente en la reaccion tal como esta planteada.',
    );
  }
  if (coefficients.some((c) => c > 1000)) {
    warnings.push('Los coeficientes son inusualmente grandes. Conviene revisar las formulas.');
  }

  const reactantCoefficients = coefficients.slice(0, nR);
  const productCoefficients = coefficients.slice(nR);

  const tally: AtomTally[] = symbols.map((sym) => {
    let left = 0;
    let right = 0;
    reactants.forEach((s, i) => {
      left += (s.composition.get(sym) ?? 0) * reactantCoefficients[i]!;
    });
    products.forEach((s, i) => {
      right += (s.composition.get(sym) ?? 0) * productCoefficients[i]!;
    });
    return { symbol: sym, reactants: left, products: right, balanced: left === right };
  });

  let chargeLeft = 0;
  let chargeRight = 0;
  reactants.forEach((s, i) => {
    chargeLeft += s.charge * reactantCoefficients[i]!;
  });
  products.forEach((s, i) => {
    chargeRight += s.charge * productCoefficients[i]!;
  });

  return ok({
    coefficients,
    reactantCoefficients,
    productCoefficients,
    tally,
    chargeTally: { reactants: chargeLeft, products: chargeRight, balanced: chargeLeft === chargeRight },
    solutionSpaceDimension: kernel.length,
    warnings,
  });
}

/** Balancea a partir de cadenas de formula. */
export function balanceFormulas(
  reactantFormulas: readonly string[],
  productFormulas: readonly string[],
): Result<BalanceResult> {
  const r = parseSpeciesList(reactantFormulas);
  if (!r.ok) return r;
  const p = parseSpeciesList(productFormulas);
  if (!p.ok) return p;
  return balance(r.value, p.value);
}

/**
 * Analiza una ecuacion escrita en texto: "HCl + NaOH -> NaCl + H2O".
 * Acepta ->, =>, →, = como flecha.
 */
export function parseEquationText(text: string): Result<{ reactants: string[]; products: string[] }> {
  const parts = text.split(/-+>|=+>|→|⟶|⇌|<=>|=/).map((s) => s.trim());
  if (parts.length !== 2) {
    return err(
      'La ecuacion debe tener exactamente una flecha.',
      'Escribe algo como: HCl + NaOH -> NaCl + H2O',
    );
  }
  const split = (side: string): string[] =>
    side
      .split('+')
      .map((s) => s.trim().replace(/^\d+\s*/, '')) // se ignoran coeficientes previos
      .filter(Boolean);

  const reactants = split(parts[0]!);
  const products = split(parts[1]!);
  if (!reactants.length) return err('No hay reactivos a la izquierda de la flecha.');
  if (!products.length) return err('No hay productos a la derecha de la flecha.');
  return ok({ reactants, products });
}

/** Balancea una ecuacion escrita en texto. */
export function balanceEquationText(text: string): Result<BalanceResult & { reactants: string[]; products: string[] }> {
  const parsed = parseEquationText(text);
  if (!parsed.ok) return parsed;
  const result = balanceFormulas(parsed.value.reactants, parsed.value.products);
  if (!result.ok) return result;
  return ok({ ...result.value, ...parsed.value }, result.warnings);
}

// ---------------------------------------------------------------------------
// Modo manual y modo guiado (§10)
// ---------------------------------------------------------------------------

export interface ManualCheck {
  readonly correct: boolean;
  readonly tally: readonly AtomTally[];
  readonly chargeTally: { readonly reactants: number; readonly products: number; readonly balanced: boolean };
  /** Elementos aun descompensados. */
  readonly unbalanced: readonly string[];
  /** true si es correcta salvo por un factor comun (2,4,6 en vez de 1,2,3). */
  readonly correctButNotMinimal: boolean;
  readonly feedback: string;
}

/**
 * MODO MANUAL: comprueba los coeficientes que ha propuesto el estudiante y
 * devuelve el recuento por elemento, no un simple "mal".
 */
export function checkManualBalance(
  reactants: readonly BalanceInputSpecies[],
  products: readonly BalanceInputSpecies[],
  reactantCoefficients: readonly number[],
  productCoefficients: readonly number[],
): Result<ManualCheck> {
  if (reactantCoefficients.length !== reactants.length || productCoefficients.length !== products.length) {
    return err('El numero de coeficientes no coincide con el numero de especies.');
  }
  if ([...reactantCoefficients, ...productCoefficients].some((c) => !Number.isInteger(c) || c < 1)) {
    return err('Los coeficientes deben ser numeros enteros positivos.');
  }

  const symbols = new Set<string>();
  for (const s of [...reactants, ...products]) for (const sym of s.composition.keys()) symbols.add(sym);

  const tally: AtomTally[] = [...symbols].map((sym) => {
    let left = 0;
    let right = 0;
    reactants.forEach((s, i) => {
      left += (s.composition.get(sym) ?? 0) * reactantCoefficients[i]!;
    });
    products.forEach((s, i) => {
      right += (s.composition.get(sym) ?? 0) * productCoefficients[i]!;
    });
    return { symbol: sym, reactants: left, products: right, balanced: left === right };
  });

  let chargeLeft = 0;
  let chargeRight = 0;
  reactants.forEach((s, i) => {
    chargeLeft += s.charge * reactantCoefficients[i]!;
  });
  products.forEach((s, i) => {
    chargeRight += s.charge * productCoefficients[i]!;
  });

  const unbalanced = tally.filter((t) => !t.balanced).map((t) => t.symbol);
  const chargeBalanced = chargeLeft === chargeRight;
  const atomsBalanced = unbalanced.length === 0;

  // ¿Es correcta pero con un factor comun de mas?
  const allCoefs = [...reactantCoefficients, ...productCoefficients];
  let common = allCoefs[0]!;
  for (const c of allCoefs) common = gcdNum(common, c);
  const correctButNotMinimal = atomsBalanced && chargeBalanced && common > 1;

  let feedback: string;
  if (!atomsBalanced) {
    const worst = tally.filter((t) => !t.balanced);
    feedback =
      'Todavia no se conservan los atomos de: ' +
      worst
        .map((t) => `${t.symbol} (${t.reactants} a la izquierda, ${t.products} a la derecha)`)
        .join('; ') +
      '.';
  } else if (!chargeBalanced) {
    feedback = `Los atomos ya cuadran, pero la carga no: ${chargeLeft} a la izquierda frente a ${chargeRight} a la derecha.`;
  } else if (correctButNotMinimal) {
    feedback = `La ecuacion esta balanceada, pero los coeficientes no son minimos: todos son divisibles por ${common}. Divide entre ${common}.`;
  } else {
    feedback = 'Correcto: se conservan todos los atomos y la carga, y los coeficientes son minimos.';
  }

  return ok({
    correct: atomsBalanced && chargeBalanced && !correctButNotMinimal,
    tally,
    chargeTally: { reactants: chargeLeft, products: chargeRight, balanced: chargeBalanced },
    unbalanced,
    correctButNotMinimal,
    feedback,
  });
}

function gcdNum(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

/**
 * MODO GUIADO: pistas ordenadas segun la heuristica que se ensena en clase
 * (dejar para el final el elemento que aparece en mas especies, normalmente
 * el oxigeno y el hidrogeno).
 */
export function balanceHints(
  reactants: readonly BalanceInputSpecies[],
  products: readonly BalanceInputSpecies[],
): Result<string[]> {
  const solved = balance(reactants, products);
  if (!solved.ok) return solved;

  const all = [...reactants, ...products];
  const appearances = new Map<string, number>();
  for (const s of all) {
    for (const sym of s.composition.keys()) {
      appearances.set(sym, (appearances.get(sym) ?? 0) + 1);
    }
  }

  // Menos apariciones primero: son los mas faciles de fijar.
  const order = [...appearances.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([sym]) => sym);

  const hints: string[] = [];
  hints.push(
    'Empieza por los elementos que aparecen en menos sustancias: cada uno te fija un coeficiente sin afectar a los demas.',
  );

  for (const sym of order) {
    const inR = reactants.filter((s) => s.composition.has(sym)).map((s) => s.formula);
    const inP = products.filter((s) => s.composition.has(sym)).map((s) => s.formula);
    if (sym === 'H' || sym === 'O') {
      hints.push(
        `Deja ${sym} para el final: aparece en ${appearances.get(sym)} sustancias (${[...inR, ...inP].join(', ')}) y se ajusta solo cuando los demas ya estan.`,
      );
    } else {
      hints.push(
        `Ajusta ${sym}: esta en ${inR.join(', ')} (reactivos) y en ${inP.join(', ')} (productos). Iguala su numero de atomos en los dos lados.`,
      );
    }
  }

  const coefs = solved.value.coefficients;
  hints.push(
    `Si todos los coeficientes te salen con un factor comun, divide entre el. La solucion minima es: ${coefs.join(', ')}.`,
  );

  return ok(hints);
}

/** Construye la ecuacion final ya balanceada. */
export function toEquation(
  reactants: readonly BalanceInputSpecies[],
  products: readonly BalanceInputSpecies[],
  result: BalanceResult,
): ChemicalEquation {
  const term = (s: BalanceInputSpecies, coefficient: number): EquationTerm => ({
    speciesId: s.speciesId ?? s.formula,
    formula: s.formula,
    coefficient,
  });
  return {
    reactants: reactants.map((s, i) => term(s, result.reactantCoefficients[i]!)),
    products: products.map((s, i) => term(s, result.productCoefficients[i]!)),
    balanced: result.tally.every((t) => t.balanced) && result.chargeTally.balanced,
  };
}
