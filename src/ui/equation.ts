/**
 * Mathematical typesetting.
 *
 * §73: equations must be rendered properly, and the reader must be able to
 * select a variable to get an explanation of it. No typesetting library is
 * available offline, so CHEMIA renders a deliberately small TeX-like subset —
 * enough for every equation the curriculum uses — into semantic HTML that
 * inherits the theme, scales with the text, and reads correctly to a screen
 * reader.
 *
 * Supported:  ^{…} _{…} \frac{}{} \sqrt{} \sum \int \Delta \alpha…\omega
 *             \times \cdot \pm \approx \neq \leq \geq \to \rightleftharpoons
 *             \log \ln \exp \sin \cos \tan \left( \right)
 */

import { h, type Child } from './dom.js';
import { escapeHtml } from './dom.js';

const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ',
  eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'µ',
  nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ',
  upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
  Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  times: '×', cdot: '·', pm: '±', mp: '∓', approx: '≈', neq: '≠',
  leq: '≤', geq: '≥', ll: '≪', gg: '≫', propto: '∝', infty: '∞',
  to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒',
  rightleftharpoons: '⇌', equiv: '≡', partial: '∂', nabla: '∇',
  sum: '∑', prod: '∏', int: '∫', oint: '∮', sqrt: '√',
  degree: '°', circ: '°', angstrom: 'Å', hbar: 'ℏ', ell: 'ℓ',
  in: '∈', forall: '∀', exists: '∃', therefore: '∴',
};

const FUNCTIONS = new Set(['log', 'ln', 'exp', 'sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'max', 'min', 'lim', 'det']);

interface Token { type: 'sym' | 'num' | 'op' | 'cmd' | 'group' | 'space'; value: string; children?: Token[][] }

/** Variable annotations — what the reader sees when they select a symbol. */
export interface VariableGloss {
  symbol: string;
  name: string;
  unit?: string;
  description?: string;
  /** Live value from the current simulation, when there is one. */
  value?: () => string;
}

export interface EquationOptions {
  display?: boolean;
  /** Glossary; symbols listed here become interrogable (§73). */
  variables?: VariableGloss[];
  /** Accessible reading of the equation. */
  label?: string;
  /** A caption printed under a display equation. */
  caption?: string;
}

/** Render a TeX-subset string into an element. */
export function equation(source: string, opts: EquationOptions = {}): HTMLElement {
  const glossary = new Map((opts.variables ?? []).map((v) => [v.symbol, v]));
  const html = renderTokens(tokenise(source), glossary);

  const el = h('span', {
    class: ['eq', opts.display && 'eq--display'],
    html,
    role: 'math',
    'aria-label': opts.label ?? speakEquation(source),
  });

  // Attach the variable explanations after the HTML is in place.
  if (glossary.size > 0) {
    el.querySelectorAll<HTMLElement>('.var--live').forEach((node) => {
      const gloss = glossary.get(node.dataset.symbol ?? '');
      if (!gloss) return;
      node.tabIndex = 0;
      node.setAttribute('role', 'button');
      node.title = describeVariable(gloss);
      const show = (): void => showGloss(node, gloss);
      node.addEventListener('click', show);
      node.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); show(); }
      });
    });
  }

  if (opts.display && opts.caption) {
    return h('figure', { style: { margin: '0' } },
      el,
      h('figcaption', { class: 'reader__figcaption', text: opts.caption }),
    );
  }
  return el;
}

function describeVariable(g: VariableGloss): string {
  const parts = [g.name];
  if (g.unit) parts.push(`(${g.unit})`);
  if (g.description) parts.push(`— ${g.description}`);
  return parts.join(' ');
}

let activeGloss: HTMLElement | null = null;

function showGloss(anchor: HTMLElement, gloss: VariableGloss): void {
  activeGloss?.remove();
  const rect = anchor.getBoundingClientRect();
  const tip = h('div', { class: 'tip', style: { pointerEvents: 'auto' } },
    h('div', { class: 'tip__title', text: `${gloss.symbol} — ${gloss.name}` }),
    gloss.unit && h('div', { class: 'tip__row' },
      h('span', { text: 'Unidad' }), h('span', { text: gloss.unit })),
    gloss.value && h('div', { class: 'tip__row' },
      h('span', { text: 'Valor actual' }), h('span', { text: gloss.value() })),
    gloss.description && h('div', { style: { marginTop: '4px' }, text: gloss.description }),
  );
  document.body.appendChild(tip);
  const tipRect = tip.getBoundingClientRect();
  tip.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - tipRect.width - 8))}px`;
  tip.style.top = `${rect.bottom + 6 + tipRect.height > window.innerHeight ? rect.top - tipRect.height - 6 : rect.bottom + 6}px`;
  activeGloss = tip;

  const dismiss = (ev: MouseEvent): void => {
    if (!tip.contains(ev.target as Node) && ev.target !== anchor) {
      tip.remove();
      activeGloss = null;
      document.removeEventListener('click', dismiss, true);
    }
  };
  setTimeout(() => document.addEventListener('click', dismiss, true), 0);
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function tokenise(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const readGroup = (): Token[] => {
    // Assumes src[i] === '{'
    i++;
    const start = i;
    let depth = 1;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      if (depth > 0) i++;
    }
    const inner = src.slice(start, i);
    i++; // consume '}'
    return tokenise(inner);
  };

  while (i < src.length) {
    const c = src[i];

    if (c === '\\') {
      i++;
      let cmd = '';
      while (i < src.length && /[a-zA-Z]/.test(src[i])) { cmd += src[i]; i++; }
      if (cmd === 'frac' || cmd === 'sqrt' || cmd === 'text' || cmd === 'mathrm') {
        const groups: Token[][] = [];
        const count = cmd === 'frac' ? 2 : 1;
        for (let g = 0; g < count; g++) {
          while (i < src.length && src[i] === ' ') i++;
          groups.push(src[i] === '{' ? readGroup() : [{ type: 'sym', value: src[i++] ?? '' }]);
        }
        tokens.push({ type: 'cmd', value: cmd, children: groups });
      } else if (cmd === 'left' || cmd === 'right') {
        tokens.push({ type: 'op', value: src[i] ?? '' });
        i++;
      } else if (cmd === '') {
        tokens.push({ type: 'op', value: src[i] ?? '' });
        i++;
      } else {
        tokens.push({ type: 'cmd', value: cmd });
      }
      continue;
    }

    if (c === '^' || c === '_') {
      i++;
      const children = src[i] === '{' ? readGroup() : [{ type: 'sym' as const, value: src[i++] ?? '' }];
      tokens.push({ type: 'cmd', value: c === '^' ? 'sup' : 'sub', children: [children] });
      continue;
    }

    if (c === '{') { tokens.push({ type: 'group', value: '', children: [readGroup()] }); continue; }
    if (c === ' ') { tokens.push({ type: 'space', value: ' ' }); i++; continue; }

    if (/[0-9.]/.test(c)) {
      let n = '';
      while (i < src.length && /[0-9.]/.test(src[i])) { n += src[i]; i++; }
      tokens.push({ type: 'num', value: n });
      continue;
    }

    if (/[a-zA-Z]/.test(c)) {
      // Multi-letter runs that name a function are kept upright.
      let word = '';
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) { word += src[j]; j++; }
      if (FUNCTIONS.has(word)) {
        tokens.push({ type: 'cmd', value: word });
        i = j;
      } else {
        tokens.push({ type: 'sym', value: c });
        i++;
      }
      continue;
    }

    tokens.push({ type: 'op', value: c });
    i++;
  }
  return tokens;
}

function renderTokens(tokens: Token[], glossary: Map<string, VariableGloss>): string {
  let out = '';
  for (const t of tokens) {
    switch (t.type) {
      case 'num':
        out += `<span class="num">${escapeHtml(t.value)}</span>`;
        break;
      case 'sym': {
        const g = glossary.get(t.value);
        out += g
          ? `<i class="var var--live" data-symbol="${escapeHtml(t.value)}">${escapeHtml(t.value)}</i>`
          : `<i class="var">${escapeHtml(t.value)}</i>`;
        break;
      }
      case 'op':
        out += `<span class="op">${escapeHtml(t.value)}</span>`;
        break;
      case 'space':
        out += ' ';
        break;
      case 'group':
        out += renderTokens(t.children?.[0] ?? [], glossary);
        break;
      case 'cmd':
        out += renderCommand(t, glossary);
        break;
    }
  }
  return out;
}

function renderCommand(t: Token, glossary: Map<string, VariableGloss>): string {
  const kids = (n: number): string => renderTokens(t.children?.[n] ?? [], glossary);

  switch (t.value) {
    case 'sup': return `<sup>${kids(0)}</sup>`;
    case 'sub': return `<sub>${kids(0)}</sub>`;
    case 'frac':
      return `<span class="frac"><span>${kids(0)}</span><span>${kids(1)}</span></span>`;
    case 'sqrt':
      return `<span class="op">√</span><span class="sqrt">${kids(0)}</span>`;
    case 'text':
    case 'mathrm':
      return `<span style="font-style:normal">${kids(0)}</span>`;
    default: {
      if (FUNCTIONS.has(t.value)) return `<span style="font-style:normal;margin-right:0.15em">${t.value}</span>`;
      const sym = SYMBOLS[t.value];
      if (sym) {
        const g = glossary.get(sym) ?? glossary.get(`\\${t.value}`);
        return g
          ? `<i class="var var--live" data-symbol="${escapeHtml(g.symbol)}">${sym}</i>`
          : `<span class="op" style="margin:0">${sym}</span>`;
      }
      return escapeHtml(t.value);
    }
  }
}

/** A spoken reading of an equation, for screen readers (§68). */
function speakEquation(src: string): string {
  return src
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1 dividido por $2')
    .replace(/\\sqrt\{([^}]*)\}/g, 'raíz cuadrada de $1')
    .replace(/\^\{?([^}\s]*)\}?/g, ' elevado a $1')
    .replace(/_\{?([^}\s]*)\}?/g, ' sub $1')
    .replace(/\\Delta/g, 'delta')
    .replace(/\\rightleftharpoons/g, 'en equilibrio con')
    .replace(/\\to/g, 'da')
    .replace(/\\times/g, 'por')
    .replace(/\\cdot/g, 'por')
    .replace(/\\([a-zA-Z]+)/g, (_, w: string) => SYMBOLS[w] ?? w)
    .replace(/=/g, ' igual a ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// The equations the curriculum uses, with their glossaries
// ---------------------------------------------------------------------------

export interface NamedEquation {
  id: string;
  name: string;
  tex: string;
  variables: VariableGloss[];
  context: string;
  courses: string[];
}

export const EQUATIONS: NamedEquation[] = [
  {
    id: 'ideal-gas', name: 'Ecuación de los gases ideales', tex: 'PV = nRT',
    context: 'Relaciona las cuatro variables de estado de un gas ideal. Es exacta en el límite de presión nula y una aproximación tanto peor cuanto mayor sea la presión o menor la temperatura.',
    courses: ['qg1'],
    variables: [
      { symbol: 'P', name: 'presión', unit: 'Pa', description: 'Presión absoluta, no manométrica.' },
      { symbol: 'V', name: 'volumen', unit: 'm³' },
      { symbol: 'n', name: 'cantidad de sustancia', unit: 'mol' },
      { symbol: 'R', name: 'constante de los gases', unit: 'J·mol⁻¹·K⁻¹', description: 'R = N_A·k_B = 8.314462618 J·mol⁻¹·K⁻¹.' },
      { symbol: 'T', name: 'temperatura', unit: 'K', description: 'Temperatura absoluta: usar kelvin, nunca grados Celsius.' },
    ],
  },
  {
    id: 'gibbs', name: 'Energía libre de Gibbs', tex: '\\Delta G = \\Delta H - T\\Delta S',
    context: 'El criterio de espontaneidad a presión y temperatura constantes. El signo de ΔG, no el de ΔH, decide si un proceso ocurre.',
    courses: ['termo', 'fq1'],
    variables: [
      { symbol: 'G', name: 'energía de Gibbs', unit: 'kJ·mol⁻¹' },
      { symbol: 'H', name: 'entalpía', unit: 'kJ·mol⁻¹' },
      { symbol: 'S', name: 'entropía', unit: 'J·mol⁻¹·K⁻¹', description: 'Ojo a las unidades: ΔH en kJ y ΔS en J. Hay que dividir ΔS entre 1000.' },
      { symbol: 'T', name: 'temperatura', unit: 'K' },
    ],
  },
  {
    id: 'arrhenius', name: 'Ecuación de Arrhenius', tex: 'k = Ae^{-E_a/RT}',
    context: 'La dependencia de la constante de velocidad con la temperatura. Linealizada como ln k frente a 1/T da una recta de pendiente −Ea/R.',
    courses: ['fq2'],
    variables: [
      { symbol: 'k', name: 'constante de velocidad', description: 'Sus unidades dependen del orden global de la reacción.' },
      { symbol: 'A', name: 'factor preexponencial', description: 'Frecuencia de colisiones con la orientación adecuada.' },
      { symbol: 'E', name: 'energía de activación', unit: 'J·mol⁻¹' },
      { symbol: 'R', name: 'constante de los gases', unit: 'J·mol⁻¹·K⁻¹' },
      { symbol: 'T', name: 'temperatura', unit: 'K' },
    ],
  },
  {
    id: 'nernst', name: 'Ecuación de Nernst', tex: 'E = E^{\\circ} - \\frac{RT}{nF}\\ln Q',
    context: 'El potencial de un electrodo fuera de las condiciones estándar. A 25 °C el factor 2.303·RT/F vale 0.05916 V por década.',
    courses: ['electro1'],
    variables: [
      { symbol: 'E', name: 'potencial del electrodo', unit: 'V' },
      { symbol: 'n', name: 'electrones intercambiados', description: 'Por unidad de reacción tal como está escrita.' },
      { symbol: 'F', name: 'constante de Faraday', unit: 'C·mol⁻¹', description: 'F = N_A·e = 96485.33 C·mol⁻¹.' },
      { symbol: 'Q', name: 'cociente de reacción', description: 'Escrito en actividades, en el sentido de reducción.' },
    ],
  },
  {
    id: 'henderson', name: 'Ecuación de Henderson–Hasselbalch',
    tex: 'pH = pK_a + \\log\\frac{[A^-]}{[HA]}',
    context: 'Una aproximación, no una identidad: supone que la disociación del ácido y la autoprotólisis del agua no alteran apreciablemente las concentraciones. Falla cuando el tampón está muy diluido o el pH se aleja del pKa.',
    courses: ['qan1', 'qan2'],
    variables: [
      { symbol: 'p', name: 'operador p', description: 'p(x) = −log₁₀(x).' },
      { symbol: 'K', name: 'constante de acidez', description: 'Ka = [H⁺][A⁻]/[HA] en el equilibrio.' },
    ],
  },
  {
    id: 'beer', name: 'Ley de Beer–Lambert', tex: 'A = \\varepsilon b c',
    context: 'La base de toda la espectrofotometría cuantitativa. Se desvía de la linealidad por encima de A ≈ 1.5, por asociación química y por luz parásita.',
    courses: ['qan3'],
    variables: [
      { symbol: 'A', name: 'absorbancia', description: 'A = −log(T) = −log(I/I₀). Adimensional.' },
      { symbol: 'b', name: 'paso óptico', unit: 'cm', description: 'Normalmente 1.000 cm en una cubeta estándar.' },
      { symbol: 'c', name: 'concentración', unit: 'mol·L⁻¹' },
      { symbol: 'ε', name: 'absortividad molar', unit: 'L·mol⁻¹·cm⁻¹', description: 'Propiedad de la especie a esa longitud de onda.' },
    ],
  },
  {
    id: 'vant-hoff', name: 'Ecuación de van \'t Hoff',
    tex: '\\ln\\frac{K_2}{K_1} = -\\frac{\\Delta H^{\\circ}}{R}\\left(\\frac{1}{T_2} - \\frac{1}{T_1}\\right)',
    context: 'Cómo responde la constante de equilibrio a la temperatura. Es el principio de Le Châtelier expresado cuantitativamente.',
    courses: ['termo', 'fq1'],
    variables: [
      { symbol: 'K', name: 'constante de equilibrio' },
      { symbol: 'H', name: 'entalpía de reacción', unit: 'J·mol⁻¹' },
    ],
  },
  {
    id: 'debye-huckel', name: 'Ley límite de Debye–Hückel',
    tex: '\\log\\gamma = -Az^2\\sqrt{I}',
    context: 'La corrección de actividad para disoluciones diluidas. A = 0.509 en agua a 25 °C, y la ley es fiable sólo hasta I ≈ 0.01 M.',
    courses: ['qan2', 'fq1'],
    variables: [
      { symbol: 'γ', name: 'coeficiente de actividad', description: 'a = γ·c. Tiende a 1 en dilución infinita.' },
      { symbol: 'z', name: 'carga del ion', description: 'Entra al cuadrado: un ion 2+ se desvía cuatro veces más que uno 1+.' },
      { symbol: 'I', name: 'fuerza iónica', unit: 'mol·L⁻¹', description: 'I = ½·Σ c_i·z_i².' },
    ],
  },
  {
    id: 'ksp', name: 'Producto de solubilidad', tex: 'K_{sp} = [M^{n+}]^a[X^{m-}]^b',
    context: 'Sólo vale cuando el sólido está presente y en equilibrio. Si Q < Ksp no hay precipitado y la expresión no describe nada.',
    courses: ['qan2'],
    variables: [{ symbol: 'K', name: 'producto de solubilidad', description: 'Constante termodinámica: se escribe en actividades.' }],
  },
  {
    id: 'rate-law', name: 'Ley de velocidad', tex: 'v = k[A]^m[B]^n',
    context: 'Los órdenes m y n son experimentales. Sólo coinciden con los coeficientes estequiométricos si el paso es elemental.',
    courses: ['fq2'],
    variables: [
      { symbol: 'v', name: 'velocidad de reacción', unit: 'mol·L⁻¹·s⁻¹' },
      { symbol: 'm', name: 'orden parcial respecto de A', description: 'Determinado experimentalmente, puede ser fraccionario o negativo.' },
    ],
  },
];

export const equationById = (id: string): NamedEquation | undefined =>
  EQUATIONS.find((e) => e.id === id);

/** Render a named equation with its glossary already attached. */
export function namedEquation(id: string, opts: { display?: boolean; values?: Record<string, () => string> } = {}): Child {
  const e = equationById(id);
  if (!e) return null;
  const variables = e.variables.map((v) =>
    (opts.values?.[v.symbol] ? { ...v, value: opts.values[v.symbol] } : v));
  return equation(e.tex, { display: opts.display ?? true, variables, label: e.name });
}
