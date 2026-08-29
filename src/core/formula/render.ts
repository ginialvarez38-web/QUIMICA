/**
 * Renderizado de formulas y ecuaciones a texto Unicode, HTML y LaTeX.
 *
 * Se separa del analizador porque un mismo arbol sintactico debe poder salir
 * como "Ca(OH)₂" en un boton, como "Ca(OH)<sub>2</sub>" en una ficha y como
 * "\ce{Ca(OH)2}" en un examen exportado.
 */

import type { ChemicalEquation, FormulaNode, ParsedFormula } from '../types.js';

const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

export function toSubscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUB[Number(d)] ?? d)
    .join('');
}

export function toSuperscript(n: number): string {
  return String(Math.abs(n))
    .split('')
    .map((d) => SUP[Number(d)] ?? d)
    .join('');
}

/** Carga en notacion de superindice: 2 -> "²⁺", -1 -> "⁻". */
export function chargeSuperscript(charge: number): string {
  if (charge === 0) return '';
  const sign = charge > 0 ? '⁺' : '⁻';
  const magnitude = Math.abs(charge);
  return magnitude === 1 ? sign : toSuperscript(magnitude) + sign;
}

function renderNodes(nodes: readonly FormulaNode[], sub: (n: number) => string): string {
  let out = '';
  for (const node of nodes) {
    if (node.kind === 'atom') {
      out += node.symbol + (node.count > 1 ? sub(node.count) : '');
    } else {
      out += '(' + renderNodes(node.children, sub) + ')' + (node.count > 1 ? sub(node.count) : '');
    }
  }
  return out;
}

/** "Ca(OH)2" -> "Ca(OH)₂"; "SO4^2-" -> "SO₄²⁻". */
export function formatFormulaUnicode(parsed: ParsedFormula): string {
  let out = renderNodes(parsed.nodes, toSubscript);
  for (const h of parsed.hydrate) {
    out += '·' + (h.count > 1 ? String(h.count) : '') + formatPlainUnicode(h.formula);
  }
  return out + chargeSuperscript(parsed.charge);
}

/** Version de conveniencia que acepta una cadena en bruto. */
export function formatPlainUnicode(formula: string): string {
  // Se hace a mano para no crear una dependencia circular con el analizador
  // en el caso trivial de los fragmentos de hidrato.
  return formula.replace(/([A-Za-z\)\]])(\d+)/g, (_m, head: string, digits: string) => head + toSubscript(Number(digits)));
}

export function formatFormulaHtml(parsed: ParsedFormula): string {
  const body = renderNodes(parsed.nodes, (n) => `<sub>${n}</sub>`);
  const hydrate = parsed.hydrate
    .map((h) => `·${h.count > 1 ? h.count : ''}${formatPlainUnicode(h.formula)}`)
    .join('');
  const charge =
    parsed.charge === 0
      ? ''
      : `<sup>${Math.abs(parsed.charge) > 1 ? Math.abs(parsed.charge) : ''}${parsed.charge > 0 ? '+' : '−'}</sup>`;
  return body + hydrate + charge;
}

export function formatFormulaLatex(parsed: ParsedFormula): string {
  const body = renderNodes(parsed.nodes, (n) => `_{${n}}`);
  const charge =
    parsed.charge === 0
      ? ''
      : `^{${Math.abs(parsed.charge) > 1 ? Math.abs(parsed.charge) : ''}${parsed.charge > 0 ? '+' : '-'}}`;
  return `\\ce{${body}${charge}}`;
}

const STATE_LABEL: Record<string, string> = { s: '(s)', l: '(l)', g: '(g)', aq: '(ac)' };

/**
 * Ecuacion completa en texto Unicode:
 *   "2 H₂ + O₂ → 2 H₂O"
 * El coeficiente 1 no se escribe, como manda la convencion.
 */
export function formatEquation(
  equation: ChemicalEquation,
  options: { showStates?: boolean; arrow?: string } = {},
): string {
  const arrow = options.arrow ?? (equation.reversible ? ' ⇌ ' : ' → ');
  const side = (terms: ChemicalEquation['reactants']): string =>
    terms
      .map((t) => {
        const coef = t.coefficient === 1 ? '' : `${t.coefficient} `;
        const state = options.showStates && t.state ? STATE_LABEL[t.state] ?? '' : '';
        return `${coef}${formatPlainUnicode(t.formula)}${state}`;
      })
      .join(' + ');
  return side(equation.reactants) + arrow + side(equation.products);
}

export function formatEquationHtml(
  equation: ChemicalEquation,
  options: { showStates?: boolean } = {},
): string {
  const arrow = equation.reversible
    ? '<span class="rxn-arrow">⇌</span>'
    : '<span class="rxn-arrow">→</span>';
  const side = (terms: ChemicalEquation['reactants']): string =>
    terms
      .map((t) => {
        const coef = t.coefficient === 1 ? '' : `<span class="coef">${t.coefficient}</span>`;
        const state =
          options.showStates && t.state
            ? `<span class="state">${STATE_LABEL[t.state] ?? ''}</span>`
            : '';
        return `${coef}<span class="formula">${formatPlainUnicode(t.formula)}</span>${state}`;
      })
      .join('<span class="plus">+</span>');
  return `${side(equation.reactants)}${arrow}${side(equation.products)}`;
}
