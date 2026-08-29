/**
 * Analizador de formulas quimicas.
 *
 * Acepta lo que un estudiante escribe realmente, no solo la forma canonica:
 *
 *   H2O        H₂O          (subindices Unicode)
 *   Ca(OH)2    Ca(OH)₂
 *   CuSO4·5H2O CuSO4.5H2O   CuSO4*5H2O    (hidratos, varios separadores)
 *   SO4^2-     SO4(2-)      SO4 2-        (cargas en varias notaciones)
 *   NH4+       Fe3+         PO4^3-
 *   [Cu(NH3)4]2+                          (corchetes de coordinacion)
 *
 * Devuelve un arbol sintactico que CONSERVA la agrupacion, ademas de la
 * composicion aplanada. Conservar el arbol importa: `Ca(OH)2` y `CaO2H2`
 * tienen la misma composicion pero solo la primera comunica que hay dos
 * grupos hidroxido, y la nomenclatura y el renderizador lo necesitan.
 */

import type { Composition, FormulaNode, ParsedFormula, Result } from '../types.js';
import { err, ok } from '../types.js';

/** Formas aceptadas para el electron en semirreacciones. */
export const ELECTRON_TOKENS: ReadonlySet<string> = new Set(['e-', 'e−', 'e⁻', 'E-']);

/** ¿Es esta cadena el electron y no una formula? */
export function isElectron(formula: string): boolean {
  return ELECTRON_TOKENS.has(formula.trim());
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
const SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-',
};

/** Normaliza subindices y superindices Unicode a ASCII para el analizador. */
export function normalizeFormulaInput(raw: string): string {
  let out = '';
  let pendingSuper = '';
  for (const ch of raw.trim()) {
    const subIndex = SUBSCRIPT_DIGITS.indexOf(ch);
    if (subIndex >= 0) {
      out += String(subIndex);
      continue;
    }
    const sup = SUPERSCRIPT_MAP[ch];
    if (sup !== undefined) {
      // Los superindices siempre son carga y siempre van al final de la
      // especie, asi que los acumulamos y los volcamos al terminar.
      pendingSuper += sup;
      continue;
    }
    out += ch;
  }
  if (pendingSuper) out += '^' + pendingSuper;
  return out
    .replace(/·|•|∙/g, '·') // variantes del punto medio
    .replace(/\s+/g, ' ')
    .trim();
}

interface Cursor {
  readonly s: string;
  i: number;
}

function peek(c: Cursor): string {
  return c.i < c.s.length ? c.s[c.i]! : '';
}

function readInteger(c: Cursor): number | null {
  const start = c.i;
  while (c.i < c.s.length && c.s[c.i]! >= '0' && c.s[c.i]! <= '9') c.i++;
  if (c.i === start) return null;
  return Number.parseInt(c.s.slice(start, c.i), 10);
}

/** Lee un simbolo de elemento: una mayuscula seguida de hasta dos minusculas. */
function readSymbol(c: Cursor): string | null {
  const ch = peek(c);
  if (ch < 'A' || ch > 'Z') return null;
  let sym = ch;
  c.i++;
  while (c.i < c.s.length) {
    const n = c.s[c.i]!;
    if (n >= 'a' && n <= 'z' && sym.length < 3) {
      sym += n;
      c.i++;
    } else break;
  }
  return sym;
}

const OPENERS = '([{';
const CLOSERS = ')]}';

function parseSequence(c: Cursor, depth: number): Result<FormulaNode[]> {
  const nodes: FormulaNode[] = [];

  while (c.i < c.s.length) {
    const ch = peek(c);

    if (CLOSERS.includes(ch)) {
      if (depth === 0) return err(`Parentesis de cierre sin apertura en la posicion ${c.i + 1}.`);
      return ok(nodes);
    }

    if (OPENERS.includes(ch)) {
      const opener = ch;
      c.i++;
      const inner = parseSequence(c, depth + 1);
      if (!inner.ok) return inner;
      const closer = peek(c);
      if (!CLOSERS.includes(closer)) {
        return err(`Falta cerrar el grupo abierto con "${opener}".`);
      }
      c.i++;
      const count = readInteger(c) ?? 1;
      if (inner.value.length === 0) return err('Grupo vacio en la formula.');
      nodes.push({ kind: 'group', children: inner.value, count });
      continue;
    }

    const sym = readSymbol(c);
    if (sym !== null) {
      const count = readInteger(c) ?? 1;
      nodes.push({ kind: 'atom', symbol: sym, count });
      continue;
    }

    return err(`Caracter inesperado "${ch}" en la posicion ${c.i + 1}.`);
  }

  if (depth > 0) return err('Falta un parentesis de cierre.');
  return ok(nodes);
}

/** Cuenta simbolos de elemento por sus mayusculas iniciales. */
function countElementSymbols(body: string): number {
  let n = 0;
  for (const ch of body) if (ch >= 'A' && ch <= 'Z') n++;
  return n;
}

/**
 * Separa la carga del cuerpo de la formula.
 * Reconoce: `SO4^2-`, `SO4 2-`, `SO4(2-)`, `NH4+`, `Fe3+`, `Ca2+`.
 *
 * AMBIGUEDAD REAL, y como se resuelve:
 *
 *   Fe3+  ->  Fe³⁺  (el 3 es la CARGA)
 *   NH4+  ->  NH₄⁺  (el 4 es un SUBINDICE, la carga es +1)
 *
 * Las dos cadenas tienen la misma forma "letras + digito + signo". El criterio
 * que las separa es cuantos elementos distintos hay en el cuerpo: con un solo
 * simbolo de elemento (Fe, Ca, Cl) el digito final solo puede ser la carga,
 * porque `Fe3` como especie neutra ya se habria escrito sin signo. Con dos o
 * mas simbolos (NH4, ClO4) el digito pertenece al ultimo elemento y la carga
 * la da la longitud de la racha de signos.
 *
 * Consecuencia documentada: `O2-` se lee como el ion oxido O²⁻, no como el
 * superoxido O₂⁻. Para el superoxido hay que escribir `O2^-`, que es
 * inequivoco. Lo mismo con `N3-` (nitruro) frente a `N3^-` (azida).
 */
function extractCharge(input: string): { body: string; charge: number } {
  const s = input.trim();

  // Notacion separada por espacio: "Cr2O7 2-", "Hg2 2+". El espacio marca
  // explicitamente donde acaba la formula y empieza la carga.
  const spaced = /^(.*\S)\s+(\d*)\s*([+-])$/.exec(s);
  if (spaced) {
    const magnitude = spaced[2] ? Number.parseInt(spaced[2], 10) : 1;
    return { body: spaced[1]!, charge: spaced[3] === '+' ? magnitude : -magnitude };
  }

  // Forma explicita con acento circunflejo: SO4^2-, Na^+
  const caret = /\^\s*(\d*)\s*([+-])\s*$/.exec(s);
  if (caret) {
    const magnitude = caret[1] ? Number.parseInt(caret[1], 10) : 1;
    return { body: s.slice(0, caret.index).trim(), charge: caret[2] === '+' ? magnitude : -magnitude };
  }

  // Forma entre parentesis al final: SO4(2-)
  const paren = /\(\s*(\d*)\s*([+-])\s*\)\s*$/.exec(s);
  if (paren && paren.index > 0) {
    const magnitude = paren[1] ? Number.parseInt(paren[1], 10) : 1;
    return { body: s.slice(0, paren.index).trim(), charge: paren[2] === '+' ? magnitude : -magnitude };
  }

  // Racha de signos al final: Ca++, S--, Fe3+, NH4+
  const repeated = /(\++|-+)\s*$/.exec(s);
  if (repeated) {
    const run = repeated[1]!;
    const runLength = run.length;
    const body = s.slice(0, repeated.index).trim();
    const positive = run[0] === '+';

    // Un digito final es la carga SOLO si el cuerpo tiene un unico elemento.
    const withNumber = /(\d+)$/.exec(body);
    if (withNumber && runLength === 1) {
      const stripped = body.slice(0, withNumber.index);
      if (countElementSymbols(stripped) === 1 && !/[)\]]$/.test(stripped)) {
        const magnitude = Number.parseInt(withNumber[1]!, 10);
        return { body: stripped, charge: positive ? magnitude : -magnitude };
      }
    }

    return { body, charge: positive ? runLength : -runLength };
  }

  return { body: s, charge: 0 };
}

/** Separa los fragmentos de hidrato: `CuSO4·5H2O` -> base + [{5, H2O}]. */
function extractHydrate(input: string): {
  base: string;
  hydrate: { count: number; formula: string }[];
} {
  const parts = input.split(/·|(?<=[a-zA-Z0-9)\]])\s*[.*]\s*(?=\d*[A-Z])/);
  const base = parts[0]!.trim();
  const hydrate: { count: number; formula: string }[] = [];
  for (const raw of parts.slice(1)) {
    const piece = raw.trim();
    if (!piece) continue;
    const m = /^(\d*)(.+)$/.exec(piece);
    if (!m) continue;
    hydrate.push({
      count: m[1] ? Number.parseInt(m[1], 10) : 1,
      formula: m[2]!.trim(),
    });
  }
  return { base, hydrate };
}

function flatten(nodes: readonly FormulaNode[], multiplier: number, into: Map<string, number>): void {
  for (const node of nodes) {
    if (node.kind === 'atom') {
      into.set(node.symbol, (into.get(node.symbol) ?? 0) + node.count * multiplier);
    } else {
      flatten(node.children, node.count * multiplier, into);
    }
  }
}

/**
 * Analiza una formula quimica completa.
 *
 * No valida que los simbolos existan en la tabla periodica: eso es
 * responsabilidad de la capa de datos, que puede dar un mensaje mucho mejor
 * ("¿Quisiste decir Co (cobalto) o CO (monoxido de carbono)?").
 */
export function parseFormula(raw: string): Result<ParsedFormula> {
  const input = raw.trim();
  if (!input) return err('Formula vacia.');

  // El electron es una especie legitima en las semirreacciones (§16, §17):
  //   Na -> Na⁺ + e⁻
  // No tiene composicion atomica, pero si carga -1, y el balanceador debe
  // poder contarlo. Se reconoce antes que nada porque "e" no es un simbolo
  // de elemento valido.
  if (ELECTRON_TOKENS.has(input)) {
    return ok({
      input,
      nodes: [],
      composition: new Map<string, number>(),
      charge: -1,
      hydrate: [],
    });
  }

  const normalized = normalizeFormulaInput(input);
  const { base, hydrate } = extractHydrate(normalized);
  const { body, charge } = extractCharge(base);

  if (!body) return err('La formula no contiene ningun elemento.');

  const cursor: Cursor = { s: body.replace(/\s+/g, ''), i: 0 };
  const parsed = parseSequence(cursor, 0);
  if (!parsed.ok) return parsed;
  if (parsed.value.length === 0) return err('La formula no contiene ningun elemento.');

  const composition = new Map<string, number>();
  flatten(parsed.value, 1, composition);

  // El agua de hidratacion cuenta para la masa molar y para el balanceo.
  for (const h of hydrate) {
    const sub = parseFormula(h.formula);
    if (!sub.ok) return err(`Fragmento de hidrato invalido: "${h.formula}".`, sub.error);
    for (const [sym, n] of sub.value.composition) {
      composition.set(sym, (composition.get(sym) ?? 0) + n * h.count);
    }
  }

  return ok({
    input,
    nodes: parsed.value,
    composition,
    charge,
    hydrate,
  });
}

/** Igualdad de composiciones, independiente del orden de escritura. */
export function compositionsEqual(a: Composition, b: Composition): boolean {
  if (a.size !== b.size) return false;
  for (const [sym, n] of a) if (b.get(sym) !== n) return false;
  return true;
}

/** Suma de composiciones escaladas, util para el balanceo y la mezcla. */
export function addComposition(
  target: Map<string, number>,
  source: Composition,
  multiplier = 1,
): Map<string, number> {
  for (const [sym, n] of source) {
    target.set(sym, (target.get(sym) ?? 0) + n * multiplier);
  }
  return target;
}
