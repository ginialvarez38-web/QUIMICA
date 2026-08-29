/**
 * Datos (§38, §54).
 *
 * The data analysis module: a real calibration workbench with weighted
 * regression, inverse prediction with its uncertainty, detection limits,
 * residual diagnostics and outlier tests; plus the chemometric tools —
 * principal components, classification and experimental design.
 *
 * The data is editable. A student pastes their own numbers and gets the same
 * treatment the platform applies to its own simulated measurements.
 */

import { h, replace, type Child } from '../ui/dom.js';
import { screen, setContext } from '../ui/shell.js';
import {
  panel, button, badge, note, tabs, props, emptyState, readout, toast, download,
} from '../ui/components.js';
import { href, route, setParam } from '../ui/router.js';
import { signal, effect } from '../ui/reactive.js';
import { plot, seriesToCsv } from '../ui/plot.js';
import { fmt, fmtWithU } from '../core/format.js';
import {
  linearRegression, inversePredict, detectionLimits, describe as descriptive,
  grubbs, dixonQ, tTestOneSample, tTestTwoSample, fTest, tCritical, pca,
  polyFit, polyEval, correlation,
} from '../core/math/stats.js';
import { meas } from '../core/uncertainty.js';
import { namedEquation } from '../ui/equation.js';

export function datosScreen(): HTMLElement {
  const view = signal(route().params.get('vista') ?? 'calibracion');
  setContext([{ label: 'Datos' }]);

  const body = h('div');
  effect(() => {
    const v = view();
    replace(body,
      v === 'estadistica' ? statisticsWorkbench()
        : v === 'quimiometria' ? chemometricsWorkbench()
          : calibrationWorkbench(),
    );
  });

  return screen({
    eyebrow: 'Análisis de datos',
    title: 'Datos',
    lede: 'Las herramientas con las que un resultado experimental se convierte en una conclusión: '
      + 'calibración con su incertidumbre, contrastes de hipótesis y análisis multivariante.',
  },
  h('div', { class: 'stack' },
    tabs([
      { id: 'calibracion', label: 'Calibración' },
      { id: 'estadistica', label: 'Estadística' },
      { id: 'quimiometria', label: 'Quimiometría' },
    ], view, { pills: true }),
    h('div', { ref: () => undefined }, body),
  ),
  );
}

// ---------------------------------------------------------------------------
// Editable data grid
// ---------------------------------------------------------------------------

interface DataSet { x: number[]; y: number[] }

function parseData(text: string): DataSet {
  const x: number[] = [];
  const y: number[] = [];
  for (const line of text.trim().split('\n')) {
    const parts = line.trim().split(/[,;\t\s]+/).map(Number);
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      x.push(parts[0]);
      y.push(parts[1]);
    }
  }
  return { x, y };
}

function dataEditor(initial: string, onChange: (d: DataSet) => void, labels: [string, string]): HTMLElement {
  const area = h('textarea', {
    class: 'field__input',
    rows: '9',
    spellcheck: 'false',
    style: { fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' },
    on: { input: (ev) => onChange(parseData((ev.target as HTMLTextAreaElement).value)) },
  });
  area.value = initial;
  return h('div', { class: 'field' },
    h('span', { class: 'field__label' },
      `Datos (${labels[0]}, ${labels[1]})`,
      h('span', { class: 'field__unit', text: 'un par por línea' }),
    ),
    area,
    h('span', { class: 'field__hint', text: 'Separadores admitidos: coma, punto y coma, tabulador o espacio.' }),
  );
}

// ---------------------------------------------------------------------------
// Calibration workbench (§38)
// ---------------------------------------------------------------------------

const DEFAULT_CALIBRATION = `0.00  0.004
2.00  0.198
4.00  0.402
6.00  0.599
8.00  0.801
10.00 0.995`;

function calibrationWorkbench(): HTMLElement {
  const data = signal<DataSet>(parseData(DEFAULT_CALIBRATION));
  const weighted = signal(false);
  const sampleSignal = signal(0.5);
  const replicates = signal(3);
  const confidence = signal(0.95);

  const output = h('div');

  effect(() => {
    const d = data();
    if (d.x.length < 3) {
      replace(output, note('warn', 'Datos insuficientes',
        'Se necesitan al menos tres niveles de calibración para estimar la recta y su incertidumbre.'));
      return;
    }

    // Weighted regression: w = 1/y², the usual choice when the standard
    // deviation is proportional to the signal.
    const weights = weighted() ? d.y.map((v) => 1 / Math.max(v * v, 1e-12)) : undefined;
    const fit = linearRegression(d.x, d.y, weights);
    const limits = detectionLimits(fit);
    const pred = inversePredict(fit, sampleSignal(), replicates(), confidence(),
      [Math.min(...d.x), Math.max(...d.x)]);

    // Confidence band across the calibrated range.
    const xs: number[] = [];
    const span = Math.max(...d.x) - Math.min(...d.x);
    for (let i = 0; i <= 80; i++) xs.push(Math.min(...d.x) - span * 0.05 + (span * 1.1 * i) / 80);
    const fitted = xs.map((x) => fit.predict(x));
    const band = xs.map((x) => fit.confidence(x, confidence()));

    // Residual analysis: the single most informative plot, and the one students
    // most often skip.
    const residuals = d.x.map((x, i) => d.y[i] - fit.predict(x));
    const outlier = grubbs(residuals);
    const dixon = dixonQ(residuals);

    replace(output,
      h('div', { class: 'grid grid--sidebar' },
        h('div', { class: 'stack' },
          panel({ title: 'Recta de calibración' },
            plot({
              series: [
                {
                  id: 'fit', label: 'Ajuste', x: xs, y: fitted, kind: 'line', colour: 1,
                  band: { lower: fitted.map((v, i) => v - band[i]), upper: fitted.map((v, i) => v + band[i]) },
                },
                { id: 'obs', label: 'Patrones', x: d.x, y: d.y, kind: 'points', colour: 2, radius: 4 },
              ],
              x: { label: 'Concentración', unit: 'mg·L⁻¹' },
              y: { label: 'Absorbancia', unit: 'AU' },
              height: 300,
              markers: [
                { axis: 'y', value: sampleSignal(), label: 'muestra', colour: 'var(--select)' },
                { axis: 'x', value: pred.x, label: `${pred.x.toFixed(3)}`, colour: 'var(--select)' },
              ],
              caption: `La banda es el intervalo de confianza al ${(confidence() * 100).toFixed(0)} % de la recta, `
                + 'más estrecha en el centroide de los datos y más ancha en los extremos: por eso conviene '
                + 'que la muestra caiga en el centro del intervalo calibrado.',
            }),
          ),
          panel({ title: 'Residuales' },
            plot({
              series: [{ id: 'res', label: 'Residual', x: d.x, y: residuals, kind: 'points', colour: 4, radius: 4 }],
              x: { label: 'Concentración', unit: 'mg·L⁻¹' },
              y: { label: 'Residual', unit: 'AU', includeZero: true },
              height: 190, legend: false,
              markers: [{ axis: 'y', value: 0 }],
              caption: 'Los residuales deben repartirse al azar en torno a cero. Una curvatura sistemática '
                + 'indica que la relación no es lineal en todo el intervalo; un abanico creciente, que la '
                + 'varianza no es constante y hace falta regresión ponderada.',
            }),
          ),
        ),

        h('div', { class: 'stack' },
          panel({ title: 'Parámetros del ajuste' },
            h('div', { class: 'stack stack--tight' },
              props([
                ['Pendiente', fmtWithU(meas(fit.slope, fit.seSlope, '', 'estimated'), { style: 'plusminus' })],
                ['Ordenada', fmtWithU(meas(fit.intercept, fit.seIntercept, '', 'estimated'), { style: 'plusminus' })],
                ['s(y/x)', fmt(fit.sy, { sig: 4 })],
                ['r', fit.r.toFixed(6)],
                ['r²', fit.r2.toFixed(6)],
                ['Grados de libertad', String(fit.df)],
                [`t(${(confidence() * 100).toFixed(0)}%, ν=${fit.df})`, tCritical(confidence(), fit.df).toFixed(4)],
              ]),
              note('info', null,
                'Un r² alto no demuestra linealidad. Con seis puntos bien elegidos, r² > 0.999 es '
                + 'habitual incluso cuando hay curvatura: la prueba está en los residuales.'),
            ),
          ),

          panel({ title: 'Predicción inversa' },
            h('div', { class: 'stack' },
              sliderRow('Señal de la muestra', sampleSignal, 0, Math.max(...d.y) * 1.1, 0.001, 'AU'),
              sliderRow('Réplicas de la muestra', replicates, 1, 10, 1, ''),
              readout({
                label: 'Concentración hallada',
                value: pred.x.toFixed(4),
                unit: 'mg/L',
                provenance: 'estimated',
                sub: `± ${pred.ci.toFixed(4)} (IC ${(confidence() * 100).toFixed(0)} %)`,
                tone: pred.withinRange ? 'normal' : 'warn',
              }),
              !pred.withinRange && note('warn', null,
                'La muestra cae fuera del intervalo calibrado. Extrapolar una recta de calibración no '
                + 'está justificado: diluye la muestra o amplía la calibración.'),
              h('div', { class: 'divider' }),
              h('div', { class: 'caps dim', text: 'La fórmula que se aplica' }),
              h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.6' } },
                's(x₀) = (s(y/x)/b)·√(1/m + 1/n + (y₀−ȳ)²/(b²·Sxx)). '
                + `Con m = ${replicates()} réplicas y n = ${fit.n} patrones, `
                + `el término 1/m contribuye ${(1 / replicates()).toFixed(3)} y el 1/n, ${(1 / fit.n).toFixed(3)}: `
                + 'replicar la muestra es lo más barato que puedes hacer para mejorar la incertidumbre.'),
            ),
          ),

          panel({ title: 'Límites de detección' },
            h('div', { class: 'stack stack--tight' },
              props([
                ['LOD (3.3 s/b)', `${limits.lod.toFixed(4)} mg·L⁻¹`],
                ['LOQ (10 s/b)', `${limits.loq.toFixed(4)} mg·L⁻¹`],
                ['s del blanco', fmt(limits.sBlank, { sig: 4 })],
              ]),
              h('p', { class: 'dim', style: { fontSize: 'var(--fs-3xs)', lineHeight: '1.5' },
                text: 'Criterio IUPAC. El LOD es la concentración que produce una señal distinguible '
                  + 'del ruido; el LOQ, la mínima que puede cuantificarse con precisión aceptable.' }),
            ),
          ),

          panel({ title: 'Diagnóstico de anómalos' },
            h('div', { class: 'stack stack--tight' },
              props([
                ['G de Grubbs', outlier.G.toFixed(4)],
                ['G crítico (95 %)', outlier.Gcrit.toFixed(4)],
                ['Q de Dixon', Number.isFinite(dixon.Q) ? dixon.Q.toFixed(4) : '—'],
              ]),
              outlier.reject
                ? note('warn', null,
                  `El punto ${outlier.index + 1} (x = ${d.x[outlier.index]}) se rechaza como anómalo al 95 %. `
                  + 'Antes de eliminarlo, busca la causa: un rechazo estadístico sin explicación física es '
                  + 'una forma elegante de falsear datos.')
                : note('ok', null, 'Ningún punto se rechaza como anómalo con el criterio de Grubbs al 95 %.'),
            ),
          ),
        ),
      ),
    );
  });

  return h('div', { class: 'stack' },
    panel({ title: 'Datos de calibración' },
      h('div', { class: 'grid grid--2' },
        dataEditor(DEFAULT_CALIBRATION, (d) => data.set(d), ['concentración', 'señal']),
        h('div', { class: 'stack' },
          h('label', { class: 'switch' },
            (() => {
              const cb = h('input', { type: 'checkbox', on: { change: (ev) => weighted.set((ev.target as HTMLInputElement).checked) } });
              effect(() => { cb.checked = weighted(); });
              return cb;
            })(),
            h('span', { class: 'switch__track' }),
            h('span', { class: 'switch__label', text: 'Regresión ponderada (w = 1/y²)' }),
          ),
          h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.6' },
            text: 'La regresión sin ponderar supone que la desviación típica de la señal es la misma en '
              + 'todo el intervalo. Casi nunca lo es: en espectrofotometría suele crecer con la señal, '
              + 'y entonces los patrones diluidos —los que más importan cerca del LOD— quedan '
              + 'infravalorados. Activa la ponderación y observa cómo cambia la ordenada.' }),
          h('div', { class: 'row' },
            button('Exportar ajuste', {
              size: 'sm', iconName: 'exportar',
              on: {
                click: () => {
                  const d = data();
                  const fit = linearRegression(d.x, d.y);
                  const csv = ['x,y,ajustado,residual',
                    ...d.x.map((x, i) => `${x},${d.y[i]},${fit.predict(x)},${d.y[i] - fit.predict(x)}`)].join('\n');
                  download('calibracion.csv', csv);
                  toast({ tone: 'ok', title: 'Exportado', body: 'calibracion.csv con los residuales incluidos.' });
                },
              },
            }),
          ),
          namedEquation('beer', { display: true }),
        ),
      ),
    ),
    output,
  );
}

function sliderRow(
  label: string, sig: ReturnType<typeof signal<number>>,
  min: number, max: number, step: number, unit: string,
): HTMLElement {
  const input = h('input', {
    class: 'slider__range', type: 'range',
    min: String(min), max: String(max), step: String(step),
    on: { input: (ev) => sig.set(Number((ev.target as HTMLInputElement).value)) },
  });
  effect(() => { if (document.activeElement !== input) input.value = String(sig()); });
  return h('div', { class: 'slider' },
    h('div', { class: 'slider__top' },
      h('span', { class: 'field__label', text: label }),
      h('span', { class: 'slider__value', bindText: () => `${fmt(sig(), { sig: 4 })} ${unit}` }),
    ),
    input,
  );
}

// ---------------------------------------------------------------------------
// Statistics workbench
// ---------------------------------------------------------------------------

const DEFAULT_SET_A = `1 10.12
2 10.08
3 10.19
4 10.11
5 10.15
6 10.09`;

const DEFAULT_SET_B = `1 10.31
2 10.28
3 10.35
4 10.27
5 10.33`;

function statisticsWorkbench(): HTMLElement {
  const setA = signal<number[]>(parseData(DEFAULT_SET_A).y);
  const setB = signal<number[]>(parseData(DEFAULT_SET_B).y);
  const reference = signal(10.00);

  const output = h('div');

  effect(() => {
    const a = setA();
    const b = setB();
    if (a.length < 2) { replace(output, note('warn', null, 'Se necesitan al menos dos medidas.')); return; }

    const da = descriptive(a);
    const db = b.length >= 2 ? descriptive(b) : null;
    const tRef = tTestOneSample(a, reference());
    const tTwo = db ? tTestTwoSample(a, b) : null;
    const f = db ? fTest(a, b) : null;
    const gr = grubbs(a);

    replace(output,
      h('div', { class: 'grid grid--sidebar' },
        h('div', { class: 'stack' },
          panel({ title: 'Dispersión de las réplicas' },
            plot({
              series: [
                { id: 'a', label: 'Conjunto A', x: a.map((_, i) => i + 1), y: a, kind: 'both', colour: 1, radius: 4 },
                ...(b.length >= 2 ? [{ id: 'b', label: 'Conjunto B', x: b.map((_, i) => i + 1), y: b, kind: 'both' as const, colour: 2, radius: 4 }] : []),
              ],
              x: { label: 'Réplica', format: (v) => String(Math.round(v)) },
              y: { label: 'Valor medido' },
              height: 260,
              markers: [
                { axis: 'y', value: reference(), label: 'referencia', colour: 'var(--fg-muted)' },
                { axis: 'y', value: da.mean, label: 'media A', colour: 'var(--series-1)' },
              ],
              caption: 'La media se separa de la referencia por el error sistemático; la dispersión '
                + 'alrededor de la media es el error aleatorio. Son cosas distintas y se corrigen de '
                + 'formas distintas.',
            }),
          ),
        ),
        h('div', { class: 'stack' },
          panel({ title: 'Estadística descriptiva' },
            h('div', { class: 'grid grid--2' },
              props([
                ['n', String(da.n)],
                ['Media', fmt(da.mean, { sig: 6 })],
                ['s', fmt(da.sd, { sig: 4 })],
                ['RSD', `${da.rsd.toFixed(3)} %`],
                ['Error estándar', fmt(da.sem, { sig: 4 })],
              ]),
              props([
                ['Mediana', fmt(da.median, { sig: 6 })],
                ['Mín – Máx', `${fmt(da.min, { sig: 5 })} – ${fmt(da.max, { sig: 5 })}`],
                ['Recorrido', fmt(da.range, { sig: 4 })],
                ['IQR', fmt(da.iqr, { sig: 4 })],
                ['IC 95 % de la media', `± ${(tCritical(0.95, da.n - 1) * da.sem).toFixed(4)}`],
              ]),
            ),
          ),
          panel({ title: 'Contraste con el valor de referencia' },
            h('div', { class: 'stack stack--tight' },
              props([
                ['Valor de referencia', String(reference())],
                ['t calculado', tRef.statistic.toFixed(4)],
                ['t crítico (95 %)', tCritical(0.95, tRef.df).toFixed(4)],
                ['p', tRef.p < 1e-4 ? tRef.p.toExponential(2) : tRef.p.toFixed(4)],
              ]),
              note(tRef.reject ? 'warn' : 'ok', null, tRef.interpretation),
            ),
          ),
          tTwo && f && panel({ title: 'Comparación entre los dos conjuntos' },
            h('div', { class: 'stack stack--tight' },
              props([
                ['t (Welch)', tTwo.statistic.toFixed(4)],
                ['p (medias)', tTwo.p < 1e-4 ? tTwo.p.toExponential(2) : tTwo.p.toFixed(4)],
                ['F', f.statistic.toFixed(4)],
                ['p (varianzas)', f.p < 1e-4 ? f.p.toExponential(2) : f.p.toFixed(4)],
              ]),
              note(tTwo.reject ? 'warn' : 'ok', 'Exactitud', tTwo.interpretation),
              note(f.reject ? 'warn' : 'ok', 'Precisión', f.interpretation),
              h('p', { class: 'dim', style: { fontSize: 'var(--fs-3xs)', lineHeight: '1.5' },
                text: 'El orden importa: se compara primero la precisión con F, porque de su resultado '
                  + 'depende qué versión del contraste t es la correcta.' }),
            ),
          ),
          panel({ title: 'Valores anómalos' },
            h('div', { class: 'stack stack--tight' },
              props([['G de Grubbs', gr.G.toFixed(4)], ['G crítico', gr.Gcrit.toFixed(4)]]),
              note(gr.reject ? 'warn' : 'ok', null,
                gr.reject
                  ? `La réplica ${gr.index + 1} (${a[gr.index]}) se rechazaría al 95 %.`
                  : 'Ninguna réplica se rechaza al 95 %.'),
            ),
          ),
        ),
      ),
    );
  });

  return h('div', { class: 'stack' },
    panel({ title: 'Conjuntos de datos' },
      h('div', { class: 'grid grid--3' },
        dataEditor(DEFAULT_SET_A, (d) => setA.set(d.y), ['réplica', 'valor A']),
        dataEditor(DEFAULT_SET_B, (d) => setB.set(d.y), ['réplica', 'valor B']),
        h('div', { class: 'field' },
          h('span', { class: 'field__label', text: 'Valor de referencia certificado' }),
          (() => {
            const input = h('input', {
              class: 'field__input num', type: 'number', step: 'any', value: '10.00',
              on: { input: (ev) => reference.set(Number((ev.target as HTMLInputElement).value)) },
            });
            return input;
          })(),
          h('span', { class: 'field__hint', text: 'El valor de un material de referencia, contra el que se contrasta la exactitud.' }),
        ),
      ),
    ),
    output,
  );
}

// ---------------------------------------------------------------------------
// Chemometrics (§54)
// ---------------------------------------------------------------------------

/**
 * Synthetic multivariate data with a known structure, so the student can check
 * that PCA recovers what is really there. Three groups of samples measured at
 * six wavelengths, with two underlying factors plus noise.
 */
function makeChemometricData(): { X: number[][]; labels: string[]; variables: string[] } {
  const X: number[][] = [];
  const labels: string[] = [];
  const variables = ['λ 220', 'λ 254', 'λ 280', 'λ 320', 'λ 400', 'λ 500'];
  // Deterministic pseudo-noise so the plot is stable between renders.
  let seed = 12345;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648 - 0.5;
  };

  const groups = [
    { name: 'Muestra tipo A', f1: 1.0, f2: 0.2 },
    { name: 'Muestra tipo B', f1: 0.3, f2: 1.0 },
    { name: 'Muestra tipo C', f1: 0.6, f2: 0.6 },
  ];
  const loadA = [0.9, 0.7, 0.4, 0.1, 0.05, 0.02];
  const loadB = [0.1, 0.3, 0.8, 0.9, 0.5, 0.2];

  for (const g of groups) {
    for (let i = 0; i < 12; i++) {
      const a = g.f1 * (1 + rnd() * 0.25);
      const b = g.f2 * (1 + rnd() * 0.25);
      X.push(loadA.map((la, j) => a * la + b * loadB[j] + rnd() * 0.03));
      labels.push(g.name);
    }
  }
  return { X, labels, variables };
}

function chemometricsWorkbench(): HTMLElement {
  const autoscale = signal(true);
  const { X, labels, variables } = makeChemometricData();
  const output = h('div');

  effect(() => {
    const result = pca(X, { autoscale: autoscale(), components: Math.min(4, variables.length) });
    const groups = Array.from(new Set(labels));

    const scoreSeries = groups.map((g, i) => ({
      id: g, label: g,
      x: result.scores.filter((_, k) => labels[k] === g).map((s) => s[0]),
      y: result.scores.filter((_, k) => labels[k] === g).map((s) => s[1]),
      kind: 'points' as const, colour: i + 1, radius: 4.5,
    }));

    replace(output,
      h('div', { class: 'grid grid--sidebar' },
        h('div', { class: 'stack' },
          panel({ title: 'Gráfico de puntuaciones (PC1 vs PC2)' },
            plot({
              series: scoreSeries,
              x: { label: `PC1 (${(result.explained[0] * 100).toFixed(1)} % de la varianza)` },
              y: { label: `PC2 (${(result.explained[1] * 100).toFixed(1)} %)` },
              height: 320, square: true,
              markers: [{ axis: 'x', value: 0 }, { axis: 'y', value: 0 }],
              caption: 'Los grupos se separan sin que el análisis conozca las etiquetas: eso es lo que '
                + 'hace del PCA una técnica exploratoria, no un clasificador.',
            }),
          ),
          panel({ title: 'Gráfico de cargas' },
            plot({
              series: [{
                id: 'load', label: 'Variables',
                x: variables.map((_, i) => result.loadings[i][0]),
                y: variables.map((_, i) => result.loadings[i][1]),
                kind: 'points', colour: 4, radius: 5,
              }],
              x: { label: 'Carga en PC1' },
              y: { label: 'Carga en PC2' },
              height: 260, square: true, legend: false,
              markers: [{ axis: 'x', value: 0 }, { axis: 'y', value: 0 }],
              annotations: variables.map((v, i) => ({
                x: result.loadings[i][0], y: result.loadings[i][1], text: v, dx: 8, dy: -4,
              })),
              caption: 'Las cargas dicen qué variables construyen cada componente. Variables próximas '
                + 'entre sí están correlacionadas; opuestas al origen, anticorrelacionadas.',
            }),
          ),
        ),
        h('div', { class: 'stack' },
          panel({ title: 'Preprocesado' },
            h('div', { class: 'stack' },
              h('label', { class: 'switch' },
                (() => {
                  const cb = h('input', { type: 'checkbox', on: { change: (ev) => autoscale.set((ev.target as HTMLInputElement).checked) } });
                  effect(() => { cb.checked = autoscale(); });
                  return cb;
                })(),
                h('span', { class: 'switch__track' }),
                h('span', { class: 'switch__label', text: 'Autoescalado (centrar y dividir por s)' }),
              ),
              note('info', null,
                'Sin autoescalar, las variables de mayor magnitud dominan las componentes por el mero '
                + 'hecho de tener números más grandes. Desactívalo y observa cómo cambian las cargas: '
                + 'ese es exactamente el error que el preprocesado evita.'),
            ),
          ),
          panel({ title: 'Varianza explicada' },
            h('div', { class: 'stack stack--tight' },
              plot({
                series: [
                  { id: 'var', label: 'Individual', x: result.explained.map((_, i) => i + 1), y: result.explained.map((v) => v * 100), kind: 'sticks', colour: 1, width: 12 },
                  { id: 'cum', label: 'Acumulada', x: result.cumulative.map((_, i) => i + 1), y: result.cumulative.map((v) => v * 100), kind: 'both', colour: 2 },
                ],
                x: { label: 'Componente', format: (v) => String(Math.round(v)) },
                y: { label: 'Varianza', unit: '%', domain: [0, 105] },
                height: 200,
                caption: 'El gráfico de sedimentación: se retienen las componentes anteriores al codo.',
              }),
              props(result.explained.map((v, i) =>
                [`PC${i + 1}`, `${(v * 100).toFixed(2)} % (acum. ${(result.cumulative[i] * 100).toFixed(2)} %)`] as [string, Child])),
            ),
          ),
          panel({ title: 'Matriz de cargas' },
            h('div', { class: 'table-wrap' },
              h('table', { class: 'table table--compact' },
                h('thead', {}, h('tr', {},
                  h('th', { text: 'Variable' }),
                  ...result.explained.map((_, i) => h('th', { text: `PC${i + 1}` })),
                )),
                h('tbody', {}, ...variables.map((v, i) => h('tr', {},
                  h('td', { class: 'col-key', text: v }),
                  ...result.explained.map((_, k) => h('td', { class: 'col-num', text: result.loadings[i][k].toFixed(4) })),
                ))),
              ),
            ),
          ),
        ),
      ),
    );
  });

  return h('div', { class: 'stack' },
    note('info', 'Conjunto de datos',
      'Treinta y seis muestras de tres tipos, medidas a seis longitudes de onda. Los datos se han '
      + 'generado a partir de dos factores subyacentes conocidos, de modo que puedes comprobar si el '
      + 'PCA recupera la estructura que realmente hay.'),
    output,
  );
}

void polyFit; void polyEval; void correlation; void emptyState; void badge; void seriesToCsv; void href; void setParam;
