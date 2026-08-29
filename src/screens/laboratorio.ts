/**
 * Laboratorio (§29–§35).
 *
 * The workbench layout of §6: tools on the left, the simulation in the centre,
 * data on the right, and a console underneath carrying the event log, the
 * causal explanation and the notebook.
 *
 * The titration bench is the fullest expression of §63 in the platform: the
 * burette does not "make the pH rise". Opening the tap delivers a volume, the
 * volume changes the analytical totals, the equilibrium solver recomputes the
 * whole speciation, the pH follows from the free proton activity, the indicator
 * responds to that pH, and the curve is the record of it. Every one of those
 * steps is a real computation and the console shows the chain.
 */

import { h, replace, svg, type Child } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { screen, setContext, workbench } from '../ui/shell.js';
import {
  panel, button, badge, note, tabs, emptyState, props, readout, slider,
  speciationBars, causalChain, buttonGroup, toast, download, meter,
  formula as formulaEl, solutionSwatch, table,
} from '../ui/components.js';
import { href, navigate, route, setParam } from '../ui/router.js';
import { signal, effect, computed, chunked } from '../ui/reactive.js';
import { plot, seriesToCsv, type Series } from '../ui/plot.js';
import { fmt, fmtP, fmtClock, formulaHtml } from '../core/format.js';
import { SUBSTANCES, substanceById } from '../data/substances.js';
import { INSTRUMENTS, instrumentById, CATEGORY_LABEL, type Instrument } from '../data/instruments.js';
import {
  state, update, instrumentState, saveInstrumentState, consumeReagent,
  pushActivity, REALISM_LABEL, type RealismMode,
} from '../state/store.js';
import { instrumentStatus, evaluateCalibration, readInstrument, replicate } from '../lab/measure.js';
import { solveSolution, type Addition } from '../core/chem/solution.js';
import {
  titrate, recommendIndicators, INDICATORS, indicatorById, indicatorColour,
  indicatorFraction, speciationVsPH, type TitrationCurve,
} from '../core/chem/titration.js';
import { MECHANISMS, mechanismById, runKinetics, determineOrder, fitArrhenius, arrhenius } from '../core/chem/kinetics.js';
import { linearRegression } from '../core/math/stats.js';

export function laboratorioScreen(): HTMLElement {
  const r = route();
  const [, second, third] = r.segments;

  if (second === 'instrumento' && third) return instrumentView(third);
  if (second === 'titulacion') return titrationBench();
  if (second === 'cinetica') return kineticsBench(third);
  return labHome();
}

// ===========================================================================
// Laboratory home
// ===========================================================================

function labHome(): HTMLElement {
  setContext([{ label: 'Laboratorio' }]);
  const s = state();

  return screen({
    eyebrow: 'Laboratorio',
    title: 'Banco de trabajo',
    lede: 'Instrumentos con su calibración real, reactivos con su lote y su existencia, y '
      + 'simulaciones que se calculan en lugar de reproducirse.',
    actions: [realismSelector()],
  },
  h('div', { class: 'stack stack--loose' },
    panel({ title: 'Bancos de simulación' },
      h('div', { class: 'grid grid--3' },
        benchCard('Valoración ácido-base', 'bureta',
          'Cada punto de la curva es una resolución completa del equilibrio con la dilución corregida.',
          'laboratorio/titulacion'),
        benchCard('Cinética química', 'equilibrio',
          'Los mecanismos se integran como sistemas de ecuaciones diferenciales reales.',
          'laboratorio/cinetica'),
        benchCard('Especiación frente al pH', 'espectro',
          'Diagramas de distribución calculados punto a punto con el solver.',
          'laboratorio/titulacion?vista=especiacion'),
      ),
    ),

    h('div', { class: 'grid grid--sidebar' },
      panel({ title: 'Instrumentos', subtitle: `${INSTRUMENTS.length} disponibles` },
        h('div', { class: 'stack stack--tight' },
          ...INSTRUMENTS.map((i) => {
            const st = instrumentState(i.id);
            const status = instrumentStatus(i, st);
            return h('a', {
              class: 'row row--between',
              href: href(`laboratorio/instrumento/${i.id}`),
              style: {
                textDecoration: 'none', padding: 'var(--sp-3)',
                border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-sm)',
              },
            },
            h('span', { class: 'row', style: { gap: 'var(--sp-3)', minWidth: '0' } },
              h('span', {
                class: 'instrument__led',
                dataset: { state: status.tone === 'ok' ? 'on' : status.tone === 'warn' ? 'busy' : 'fault' },
              }),
              h('span', { style: { minWidth: '0' } },
                h('span', { style: { fontWeight: '600', fontSize: 'var(--fs-sm)', color: 'var(--fg-primary)' }, text: i.name }),
                h('div', { class: 'dim', style: { fontSize: 'var(--fs-3xs)' }, text: CATEGORY_LABEL[i.category] }),
              ),
            ),
            badge(status.label, status.tone === 'danger' ? 'danger' : status.tone === 'warn' ? 'warn' : 'ok'),
            );
          }),
        ),
      ),

      h('div', { class: 'stack' },
        panel({ title: 'Inventario de reactivos', subtitle: 'Con lote y existencia real (§67)' },
          h('div', { class: 'table-wrap', style: { maxHeight: '340px', overflowY: 'auto' } },
            h('table', { class: 'table table--compact' },
              h('thead', {}, h('tr', {},
                h('th', { text: 'Reactivo' }), h('th', { text: 'Lote' }),
                h('th', { text: 'Cantidad' }), h('th', { text: 'Pureza' }))),
              h('tbody', {}, ...s.lab.reagents.map((rg) => {
                const sub = substanceById(rg.substanceId);
                return h('tr', {},
                  h('td', {}, sub
                    ? h('a', { href: href(`mundo/sustancia/${rg.substanceId}`), text: sub.name })
                    : rg.substanceId),
                  h('td', { class: 'mono dim', style: { fontSize: 'var(--fs-3xs)' }, text: rg.lot }),
                  h('td', { class: 'col-num', text: `${fmt(rg.amount, { sig: 4 })} ${rg.unit}` }),
                  h('td', { class: 'col-num', text: `${(rg.purity * 100).toFixed(2)} %` }),
                );
              })),
            ),
          ),
        ),
        s.lab.samples.length > 0 && panel({ title: 'Muestras', subtitle: 'Con su historial de manipulación (§34)' },
          h('div', { class: 'stack stack--tight' },
            ...s.lab.samples.slice(0, 6).map((sm) => h('div', {
              style: { padding: 'var(--sp-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-sm)' },
            },
            h('div', { class: 'row row--between' },
              h('span', { style: { fontWeight: '600', fontSize: 'var(--fs-xs)' }, text: sm.label }),
              sm.unknown ? badge('Desconocida', 'accent') : null,
            ),
            h('div', { class: 'dim', style: { fontSize: 'var(--fs-3xs)', marginTop: '3px' },
              text: `${sm.history.length} eventos registrados · ${sm.origin}` }),
            )),
          ),
        ),
      ),
    ),
  ),
  );
}

function benchCard(title: string, iconName: Parameters<typeof icon>[0], text: string, target: string): HTMLElement {
  return h('a', { class: 'card', href: `#/${target}`, style: { textDecoration: 'none' } },
    h('div', { class: 'row', style: { gap: 'var(--sp-3)', alignItems: 'flex-start' } },
      icon(iconName, { size: 20, style: 'color:var(--accent);flex:0 0 auto' }),
      h('div', {},
        h('div', { class: 'card__title', style: { marginTop: '0' }, text: title }),
        h('div', { class: 'card__meta', style: { lineHeight: '1.5' }, text }),
      ),
    ),
  );
}

function realismSelector(): HTMLElement {
  const modes: RealismMode[] = ['educativo', 'universitario', 'profesional'];
  return buttonGroup(...modes.map((m) => {
    const btn = button(REALISM_LABEL[m], {
      size: 'sm',
      title: m,
      on: { click: () => update((s) => { s.settings.realism = m; }) },
    });
    effect(() => btn.setAttribute('aria-pressed', String(state().settings.realism === m)));
    return btn;
  }));
}

// ===========================================================================
// Instrument view (§31, §32)
// ===========================================================================

function instrumentView(id: string): HTMLElement {
  const inst = instrumentById(id);
  setContext([
    { label: 'Laboratorio', href: href('laboratorio') },
    { label: 'Instrumentos', href: href('laboratorio') },
    { label: inst?.name ?? id },
  ]);
  if (!inst) return screen({ title: 'Instrumento no encontrado' }, emptyState({ title: 'No existe ese instrumento' }));

  const view = signal(route().params.get('vista') ?? 'ficha');
  const body = h('div');

  effect(() => {
    const v = view();
    replace(body,
      v === 'calibracion' ? calibrationProcedure(inst)
        : v === 'errores' ? errorPanel(inst)
          : instrumentSpec(inst),
    );
  });

  const st = instrumentState(inst.id);
  const status = instrumentStatus(inst, st);

  return screen({
    eyebrow: CATEGORY_LABEL[inst.category],
    title: inst.name,
    lede: inst.principle,
    actions: [badge(status.label, status.tone === 'danger' ? 'danger' : status.tone === 'warn' ? 'warn' : 'ok', { dot: true })],
  },
  h('div', { class: 'stack' },
    tabs([
      { id: 'ficha', label: 'Ficha técnica' },
      { id: 'calibracion', label: 'Calibración' },
      { id: 'errores', label: 'Fuentes de error' },
    ], view, { pills: true }),
    body,
  ),
  );
}

function instrumentSpec(inst: Instrument): HTMLElement {
  return h('div', { class: 'grid grid--sidebar' },
    h('div', { class: 'stack' },
      panel({ title: 'Principio de funcionamiento' },
        h('p', { class: 'prose', style: { maxWidth: 'none' }, text: inst.howItWorks }),
      ),
      panel({ title: 'Componentes' },
        h('div', { class: 'table-wrap' },
          h('table', { class: 'table' },
            h('thead', {}, h('tr', {}, h('th', { text: 'Componente' }), h('th', { text: 'Función' }))),
            h('tbody', {}, ...inst.components.map((c) => h('tr', {},
              h('td', { class: 'col-key', text: c.name }),
              h('td', { text: c.role }),
            ))),
          ),
        ),
      ),
      panel({ title: 'Controles' },
        h('div', { class: 'stack stack--tight' },
          ...inst.controls.map((c) => h('div', { class: 'row row--between', style: { fontSize: 'var(--fs-xs)', gap: 'var(--sp-4)' } },
            h('span', {},
              h('span', { style: { fontWeight: '600' }, text: c.label }),
              h('div', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', marginTop: '2px' }, text: c.description }),
            ),
            h('span', { class: 'mono dim', style: { flexShrink: '0', fontSize: 'var(--fs-3xs)' },
              text: c.min !== undefined ? `${c.min}–${c.max}${c.unit ? ' ' + c.unit : ''}` : c.kind }),
          )),
        ),
      ),
      panel({ title: 'Mantenimiento' },
        h('ul', { class: 'prose', style: { maxWidth: 'none' } }, ...inst.maintenance.map((m) => h('li', { text: m }))),
      ),
    ),
    h('div', { class: 'stack' },
      panel({ title: 'Especificaciones' },
        props([
          ['Intervalo', `${inst.range[0]} – ${inst.range[1]} ${inst.unit}`],
          ['Resolución', `${inst.resolution} ${inst.unit}`],
          ['Precisión (1σ)', `${inst.precision} ${inst.unit}`],
          ['Ruido (1σ)', `${inst.noise} ${inst.unit}`],
          ['Deriva', `${inst.driftPerHour} ${inst.unit}/h`],
          ['Estabilización', `${inst.settlingTime} s`],
          ['Salida', inst.output],
          ['Coste por análisis', inst.costPerRun ? `${inst.costPerRun} u.m.` : 'sin consumibles'],
        ]),
      ),
      inst.requiresCalibration && panel({ title: 'Calibración' },
        h('div', { class: 'stack stack--tight' },
          props([
            ['Validez', `${inst.calibrationValidHours} h`],
            ['Pasos', String(inst.calibrationSteps.length)],
          ]),
          button('Calibrar ahora', {
            variant: 'primary', block: true, iconName: 'calibrar',
            on: { click: () => setParam('vista', 'calibracion') },
          }),
        ),
      ),
      inst.courses && inst.courses.length > 0 && panel({ title: 'Se usa en' },
        h('div', { class: 'xlinks' },
          ...inst.courses.map((cid) => h('a', { class: 'xlink', href: href(`universidad/${cid}`), text: cid })),
        ),
      ),
    ),
  );
}

function errorPanel(inst: Instrument): HTMLElement {
  const kinds = ['sistematico', 'aleatorio', 'deriva', 'humano'] as const;
  const label: Record<typeof kinds[number], string> = {
    sistematico: 'Sistemático', aleatorio: 'Aleatorio', deriva: 'Deriva', humano: 'Humano',
  };
  return h('div', { class: 'stack' },
    note('info', 'Por qué importa',
      'Estas fuentes de error no son informativas: están implementadas. Una calibración deficiente, '
      + 'una contaminación arrastrada o una deriva sin corregir modifican numéricamente cada lectura '
      + 'posterior de este instrumento.'),
    ...kinds.map((k) => {
      const list = inst.errorSources.filter((e) => e.kind === k);
      if (list.length === 0) return null;
      return panel({ title: `Error ${label[k].toLowerCase()}` },
        h('div', { class: 'stack' },
          ...list.map((e) => h('div', { class: 'stack stack--tight' },
            h('div', { class: 'row', style: { gap: 'var(--sp-2)' } },
              h('span', { style: { fontWeight: '650', fontSize: 'var(--fs-sm)' }, text: e.name }),
              badge(label[e.kind], e.kind === 'sistematico' ? 'danger' : e.kind === 'aleatorio' ? 'info' : 'warn'),
            ),
            h('div', { class: 'grid grid--3', style: { gap: 'var(--sp-4)', fontSize: 'var(--fs-xs)' } },
              h('div', {}, h('div', { class: 'caps dim', text: 'Efecto' }), h('p', { text: e.effect })),
              h('div', {}, h('div', { class: 'caps dim', text: 'Cómo se reconoce' }), h('p', { text: e.symptom })),
              h('div', {}, h('div', { class: 'caps dim', text: 'Remedio' }), h('p', { text: e.remedy })),
            ),
          )),
        ),
      );
    }),
  );
}

/**
 * The interactive calibration procedure (§32).
 *
 * Completing it produces a calibration quality that is stored and that
 * subsequently degrades every measurement in proportion. Skipping the
 * stabilisation waits, or calibrating a pH meter with a single buffer, has a
 * numerical consequence the student will meet later.
 */
function calibrationProcedure(inst: Instrument): HTMLElement {
  const currentStep = signal(0);
  const completed = signal<string[]>([]);
  const waited = signal<Record<string, boolean>>({});
  const standards = signal<Record<string, number>>({});
  const outcome = signal<ReturnType<typeof evaluateCalibration> | null>(null);
  const waiting = signal<{ id: string; remaining: number } | null>(null);

  const advance = (stepId: string, didWait: boolean): void => {
    completed.update((c) => (c.includes(stepId) ? c : [...c, stepId]));
    waited.update((w) => ({ ...w, [stepId]: didWait }));
    currentStep.update((i) => i + 1);
  };

  const startWait = (stepId: string, seconds: number): void => {
    waiting.set({ id: stepId, remaining: seconds });
    const timer = setInterval(() => {
      const w = waiting.peek();
      if (!w || w.id !== stepId) { clearInterval(timer); return; }
      if (w.remaining <= 1) {
        clearInterval(timer);
        waiting.set(null);
        advance(stepId, true);
      } else {
        waiting.set({ id: stepId, remaining: w.remaining - 1 });
      }
    }, 1000);
  };

  const finish = (): void => {
    const result = evaluateCalibration({
      instrumentId: inst.id,
      completedSteps: completed.peek(),
      standards: standards.peek(),
      waited: waited.peek(),
      seed: `${Date.now()}`,
    });
    outcome.set(result);

    if (result.accepted) {
      saveInstrumentState({
        ...instrumentState(inst.id),
        calibratedAt: Date.now(),
        calibration: result.parameters,
        calibrationQuality: result.quality,
      });
      toast({
        tone: result.quality > 0.85 ? 'ok' : 'warn',
        title: 'Calibración registrada',
        body: `Calidad ${(result.quality * 100).toFixed(0)} %. `
          + (result.quality > 0.85 ? 'El instrumento queda listo.' : 'Los resultados llevarán un error asociado.'),
      });
      pushActivity('calibracion', `Calibración de ${inst.name}`, href(`laboratorio/instrumento/${inst.id}`));
    } else {
      toast({
        tone: 'danger',
        title: 'Calibración rechazada',
        body: 'No se ha registrado. Repite el procedimiento completo.',
      });
    }
  };

  const stepper = h('div', { class: 'stepper' });

  effect(() => {
    const index = currentStep();
    const done = completed();
    const w = waiting();

    replace(stepper, ...inst.calibrationSteps.map((step, i) => {
      const stepState = done.includes(step.id) ? 'done' : i === index ? 'active' : 'pending';
      const isWaiting = w?.id === step.id;

      return h('div', { class: 'stepper__step', dataset: { state: stepState } },
        h('div', { class: 'stepper__dot' },
          stepState === 'done' ? icon('ok', { size: 12 }) : String(i + 1)),
        h('div', {},
          h('div', { class: 'stepper__title', text: step.title }),
          h('div', { class: 'stepper__detail', text: step.detail }),
          stepState === 'active' && h('div', { class: 'stepper__slot' },
            step.requires?.kind === 'patron' && step.requires.value !== undefined
              ? h('div', { class: 'row', style: { gap: 'var(--sp-2)', alignItems: 'flex-end' } },
                h('label', { class: 'field', style: { maxWidth: '160px' } },
                  h('span', { class: 'field__label', text: `Patrón (${inst.unit || 'valor'})` }),
                  h('input', {
                    class: 'field__input num', type: 'number', step: 'any',
                    value: String(step.requires.value),
                    on: {
                      input: (ev) => standards.update((s) => ({
                        ...s, [step.id]: Number((ev.target as HTMLInputElement).value),
                      })),
                    },
                  }),
                ),
                button('Aceptar patrón', {
                  variant: 'primary',
                  on: {
                    click: () => {
                      if (standards.peek()[step.id] === undefined) {
                        standards.update((s) => ({ ...s, [step.id]: step.requires!.value as number }));
                      }
                      advance(step.id, true);
                    },
                  },
                }),
              )
              : step.requires?.kind === 'espera'
                ? h('div', { class: 'row', style: { gap: 'var(--sp-2)' } },
                  isWaiting
                    ? h('span', { class: 'row', style: { gap: 'var(--sp-2)', fontSize: 'var(--fs-xs)' } },
                      h('span', { class: 'spinner' }),
                      h('span', { class: 'mono', text: `${w.remaining} s` }),
                    )
                    : button('Esperar la estabilización', {
                      variant: 'primary', iconName: 'temporizador',
                      on: { click: () => startWait(step.id, Math.min(step.seconds ?? 10, 15)) },
                    }),
                  !isWaiting && button('Continuar sin esperar', {
                    variant: 'ghost',
                    title: 'Tiene consecuencias sobre la calidad de la calibración',
                    on: { click: () => advance(step.id, false) },
                  }),
                )
                : h('div', { class: 'row', style: { gap: 'var(--sp-2)' } },
                  button('Hecho', { variant: 'primary', on: { click: () => advance(step.id, true) } }),
                  button('Omitir este paso', {
                    variant: 'ghost',
                    on: { click: () => currentStep.update((k) => k + 1) },
                  }),
                ),
          ),
        ),
      );
    }));
  });

  const result = h('div');
  effect(() => {
    const o = outcome();
    replace(result, o
      ? panel({ title: 'Resultado de la calibración' },
        h('div', { class: 'stack' },
          meter({
            label: 'Calidad de la calibración', value: o.quality,
            tone: o.quality > 0.85 ? 'ok' : o.quality > 0.6 ? 'warn' : 'danger',
            format: (v) => `${(v * 100).toFixed(0)} %`,
          }),
          o.slope !== undefined && props([
            ['Pendiente del electrodo', `${o.slope.toFixed(2)} mV/pH`],
            ['Respecto al ideal', `${o.slopePercent!.toFixed(1)} %`],
          ]),
          ...o.messages.map((m) => note(m.tone === 'ok' ? 'ok' : m.tone === 'warn' ? 'warn' : 'danger', null, m.text)),
          note('info', 'Qué implica esto',
            'La calidad obtenida se guarda con el instrumento y se aplica a cada medida posterior: '
            + 'una calibración del 60 % introduce un error sistemático proporcional en todos los '
            + 'resultados hasta que se repita.'),
        ),
      )
      : null);
  });

  return h('div', { class: 'grid grid--sidebar' },
    panel({ title: 'Procedimiento de calibración', subtitle: `${inst.calibrationSteps.length} pasos` },
      h('div', { class: 'stack' },
        stepper,
        h('div', { class: 'row', style: { gap: 'var(--sp-2)' } },
          button('Finalizar y evaluar', {
            variant: 'primary', iconName: 'completado',
            on: { click: finish },
          }),
          button('Reiniciar', {
            iconName: 'reiniciar',
            on: {
              click: () => {
                currentStep.set(0); completed.set([]); waited.set({});
                standards.set({}); outcome.set(null); waiting.set(null);
              },
            },
          }),
        ),
      ),
    ),
    h('div', { class: 'stack' },
      result,
      panel({ title: 'Estado actual del instrumento' },
        (() => {
          const st = instrumentState(inst.id);
          const status = instrumentStatus(inst, st);
          return h('div', { class: 'stack stack--tight' },
            note(status.tone === 'ok' ? 'ok' : status.tone === 'warn' ? 'warn' : 'danger', status.label, status.detail),
            st.calibration && props(
              Object.entries(st.calibration).map(([k, v]) => [k, fmt(v, { sig: 5 })] as [string, Child]),
            ),
          );
        })(),
      ),
    ),
  );
}

// ===========================================================================
// Titration bench (§35, §63, §64)
// ===========================================================================

function titrationBench(): HTMLElement {
  setContext([
    { label: 'Laboratorio', href: href('laboratorio') },
    { label: 'Valoración ácido-base' },
  ]);

  const params = route().params;
  const analyteId = signal(params.get('analito') ?? 'ch3cooh');
  const analyteConc = signal(0.1);
  const analyteVolume = signal(25);
  const titrantId = signal('naoh');
  const titrantConc = signal(0.1);
  const indicatorId = signal(params.get('indicador') ?? 'fenolftaleina');
  const burette = signal(0);
  const running = signal(false);
  const curve = signal<TitrationCurve | null>(null);
  const computing = signal(false);
  const progress = signal(0);

  const analytes = SUBSTANCES.filter((s) => s.acidBase && !s.acidBase.strong)
    .concat(SUBSTANCES.filter((s) => s.acidBase?.strong ?? false));
  const titrants = SUBSTANCES.filter((s) => s.categories.includes('titrante') && s.acidBase);

  /** Recompute the whole curve. Chunked so the interface keeps painting (§69). */
  const recompute = async (): Promise<void> => {
    computing.set(true);
    progress.set(0);
    const analyte = substanceById(analyteId.peek());
    const isTitrantBase = (substanceById(titrantId.peek())?.categories ?? []).includes('base');
    void isTitrantBase;

    const setup = {
      analyte: [{ substanceId: analyteId.peek(), moles: (analyteConc.peek() * analyteVolume.peek()) / 1000 }] as Addition[],
      initialVolume: analyteVolume.peek() / 1000,
      titrantId: titrantId.peek(),
      titrantConcentration: titrantConc.peek(),
      finalVolume: (analyteVolume.peek() * 2.2) / 1000,
      points: 260,
      activityModel: state().settings.activityModel,
    };

    // Give the browser a frame before the heavy loop starts.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const result = titrate(setup);
    progress.set(1);
    curve.set(result);
    computing.set(false);
    void analyte;
  };

  effect(() => {
    // Recompute whenever any setup parameter changes.
    analyteId(); analyteConc(); analyteVolume(); titrantId(); titrantConc();
    void recompute();
  });

  // --- Live state at the current burette reading ---------------------------
  const currentPoint = computed(() => {
    const c = curve();
    if (!c) return null;
    const target = burette() / 1000;
    return c.points.reduce((best, p) =>
      Math.abs(p.volume - target) < Math.abs(best.volume - target) ? p : best);
  });

  const stage = h('div', { class: 'stack', style: { padding: 'var(--sp-4)', minHeight: '0' } });
  effect(() => {
    const c = curve();
    if (computing()) { replace(stage, loadingStage(progress())); return; }
    if (!c) { replace(stage, emptyState({ title: 'Configura la valoración' })); return; }

    const eqMarkers = c.equivalencePoints.map((e) => ({
      axis: 'x' as const,
      value: e.volumeML,
      label: `PE${c.equivalencePoints.length > 1 ? e.index : ''} ${e.volumeML.toFixed(2)} mL`,
      colour: e.detectable ? 'var(--ok)' : 'var(--warn)',
    }));

    const ind = indicatorById(indicatorId());
    const series: Series[] = [{
      id: 'ph', label: 'pH', kind: 'line',
      x: c.points.map((p) => p.volumeML), y: c.points.map((p) => p.pH),
      colour: 1, width: 2,
    }];

    replace(stage,
      plot({
        series,
        x: { label: 'Volumen de titrante', unit: 'mL' },
        y: { label: 'pH', domain: [0, 14], ticks: [0, 2, 4, 6, 8, 10, 12, 14] },
        height: 320,
        markers: [
          ...eqMarkers,
          { axis: 'x', value: burette(), label: 'bureta', colour: 'var(--accent)', dashed: false },
        ],
        regions: ind ? [{
          axis: 'y', from: ind.range[0], to: ind.range[1],
          label: `viraje de ${ind.name}`, colour: ind.baseHex,
        }] : [],
        caption: 'Cada punto es una resolución independiente del equilibrio con los totales corregidos '
          + 'por dilución. La forma de la curva no está dibujada: se calcula.',
      }),
      h('div', { class: 'grid grid--2' },
        plot({
          series: [{
            id: 'd1', label: 'dpH/dV', kind: 'line',
            x: c.points.map((p) => p.volumeML), y: c.firstDerivative.map((d) => d / 1000),
            colour: 2,
          }],
          x: { label: 'Volumen', unit: 'mL' },
          y: { label: 'dpH/dV', unit: 'mL⁻¹' },
          height: 190, legend: false,
          markers: eqMarkers,
          caption: 'La primera derivada localiza el punto final sin depender del criterio del operador.',
        }),
        plot({
          series: [{
            id: 'beta', label: 'Capacidad tamponante', kind: 'line',
            x: c.points.slice(1, -1).map((p) => p.volumeML),
            y: c.points.slice(1, -1).map((p) => p.bufferCapacity ?? NaN),
            colour: 3,
          }],
          x: { label: 'Volumen', unit: 'mL' },
          y: { label: 'β', unit: 'mol·L⁻¹·pH⁻¹' },
          height: 190, legend: false,
          caption: 'β pasa por un máximo en la semiequivalencia, donde pH = pKa: es allí donde el '
            + 'tampón resiste mejor.',
        }),
      ),
    );
  });

  // --- Left rail: the setup ------------------------------------------------
  const left = h('div', {},
    railSectionEl('Matraz (analito)',
      h('div', { class: 'stack' },
        selectField('Sustancia', analytes.map((s) => ({ value: s.id, label: `${s.name} (${s.formula})` })), analyteId),
        slider({ label: 'Concentración', value: analyteConc, min: 0.001, max: 0.5, unit: 'mol/L', log: true,
          format: (v) => fmt(v, { sig: 3 }) }),
        slider({ label: 'Volumen', value: analyteVolume, min: 5, max: 100, step: 1, unit: 'mL',
          format: (v) => v.toFixed(0) }),
      ),
    ),
    railSectionEl('Bureta (titrante)',
      h('div', { class: 'stack' },
        selectField('Sustancia', titrants.map((s) => ({ value: s.id, label: `${s.name} (${s.formula})` })), titrantId),
        slider({ label: 'Concentración', value: titrantConc, min: 0.001, max: 1, unit: 'mol/L', log: true,
          format: (v) => fmt(v, { sig: 3 }) }),
      ),
    ),
    railSectionEl('Indicador',
      h('div', { class: 'stack stack--tight' },
        selectField('Indicador', INDICATORS.map((i) => ({ value: i.id, label: `${i.name} (${i.range[0]}–${i.range[1]})` })), indicatorId),
        indicatorPreview(indicatorId, currentPoint),
      ),
    ),
    railSectionEl('Entrega',
      h('div', { class: 'stack' },
        buretteWidget(burette, running, curve),
        slider({ label: 'Volumen añadido', value: burette, min: 0, max: 100, step: 0.01, unit: 'mL',
          format: (v) => v.toFixed(2) }),
        h('div', { class: 'row', style: { gap: 'var(--sp-2)' } },
          button('Gota a gota', { size: 'sm', on: { click: () => burette.update((v) => Math.min(v + 0.05, 200)) } }),
          button('0.5 mL', { size: 'sm', on: { click: () => burette.update((v) => Math.min(v + 0.5, 200)) } }),
          button('Cerrar', { size: 'sm', iconName: 'reiniciar', on: { click: () => burette.set(0) } }),
        ),
      ),
    ),
  );

  // --- Right rail: live readouts ------------------------------------------
  const right = h('div', {});
  effect(() => {
    const p = currentPoint();
    const c = curve();
    const ind = indicatorById(indicatorId());
    const analyte = substanceById(analyteId());

    replace(right,
      railSectionEl('Lectura',
        h('div', { class: 'stack stack--tight' },
          readout({
            label: 'pH', value: p ? fmtP(p.pH, 3) : '—',
            provenance: 'simulated',
            sub: p ? `pcH = ${fmtP(p.pcH, 3)}` : undefined,
          }),
          readout({
            label: 'Volumen entregado', value: `${burette().toFixed(2)}`, unit: 'mL',
            size: 'sm', provenance: 'theoretical',
          }),
          readout({
            label: 'Fuerza iónica', value: p ? fmt(p.ionicStrength, { sig: 3 }) : '—', unit: 'mol/L',
            size: 'sm', provenance: 'simulated',
          }),
        ),
      ),
      railSectionEl('Aspecto del matraz',
        h('div', { class: 'row', style: { gap: 'var(--sp-3)' } },
          ind && p ? solutionSwatch(indicatorColour(ind, p.pH).hex, {
            label: indicatorColour(ind, p.pH).description, size: 34,
          }) : null,
        ),
      ),
      analyte?.acidBase && p ? railSectionEl('Especiación',
        speciationBars(
          Object.entries(p.fractions).map(([formula, fraction]) => ({ formula, fraction })),
        ),
      ) : null,
      c ? railSectionEl('Puntos de equivalencia',
        h('div', { class: 'stack stack--tight' },
          ...(c.equivalencePoints.length === 0
            ? [note('warn', null, 'No se detecta ningún salto: la valoración no es practicable en estas condiciones.')]
            : c.equivalencePoints.map((e) => h('div', { class: 'stack stack--tight' },
              h('div', { class: 'row row--between' },
                h('span', { class: 'caps dim', text: `PE ${e.index}` }),
                badge(e.detectable ? 'detectable' : 'salto insuficiente', e.detectable ? 'ok' : 'warn'),
              ),
              props([
                ['Volumen', `${e.volumeML.toFixed(3)} mL`],
                ['pH', fmtP(e.pH, 2)],
                ['Salto', `${e.steepness.toFixed(2)} pH / 0.1 mL`],
              ]),
            ))),
          c.theoreticalEquivalence.length > 0 && h('p', { class: 'dim', style: { fontSize: 'var(--fs-3xs)', lineHeight: '1.5' },
            text: `Predicción estequiométrica: ${c.theoreticalEquivalence.map((v) => (v * 1000).toFixed(2)).join(', ')} mL. `
              + 'La diferencia con el valor hallado por derivada es el error de método.' }),
        ),
      ) : null,
      c ? railSectionEl('Indicadores',
        h('div', { class: 'stack stack--tight' },
          ...recommendIndicators(c).slice(0, 4).map((a) => h('div', {
            class: 'row row--between',
            style: { fontSize: 'var(--fs-2xs)', cursor: 'pointer' },
            on: { click: () => indicatorId.set(a.indicator.id) },
          },
          h('span', { text: a.indicator.name }),
          h('span', {
            class: 'mono',
            style: { color: a.suitable ? 'var(--ok)' : Math.abs(a.errorPercent) < 1 ? 'var(--warn)' : 'var(--danger)' },
            text: Number.isFinite(a.errorPercent) ? `${a.errorPercent > 0 ? '+' : ''}${a.errorPercent.toFixed(2)} %` : 'no vira',
          }),
          )),
          h('p', { class: 'dim', style: { fontSize: 'var(--fs-3xs)', lineHeight: '1.5' },
            text: 'Error de valoración calculado sobre esta curva concreta: dónde viraría el indicador '
              + 'frente a dónde está realmente la equivalencia.' }),
        ),
      ) : null,
    );
  });

  // --- Console: causality, log, data --------------------------------------
  const consoleTab = signal('causa');
  const consoleBody = h('div', { class: 'console__body' });

  effect(() => {
    const tab = consoleTab();
    const p = currentPoint();
    const c = curve();

    if (tab === 'causa') {
      const ind = indicatorById(indicatorId());
      replace(consoleBody, p
        ? h('div', { class: 'grid grid--2', style: { gap: 'var(--sp-6)' } },
          causalChain([
            { quantity: 'V titrante', direction: burette() > 0 ? 'up' : 'flat',
              value: `${burette().toFixed(2)} mL`, why: 'lo que has abierto en la bureta' },
            { quantity: 'n(OH⁻) añadido', direction: burette() > 0 ? 'up' : 'flat',
              value: `${(burette() * titrantConc() / 1000).toExponential(3)} mol`,
              why: 'volumen × concentración' },
            { quantity: 'totales analíticos', direction: 'up',
              why: 'se recalculan corrigiendo por el volumen total' },
            { quantity: '[H⁺] libre', direction: 'down',
              value: `${p.free.H?.toExponential(3) ?? '—'} M`,
              why: 'el solver resuelve el equilibrio completo con electroneutralidad' },
            { quantity: 'pH', direction: 'up', value: fmtP(p.pH, 3),
              why: 'pH = −log a(H⁺), con el coeficiente de actividad aplicado' },
            { quantity: 'forma del indicador', direction: 'up',
              value: ind ? `${(indicatorFraction(ind, p.pH) * 100).toFixed(0)} % básica` : '—',
              why: 'la razón base/ácido del indicador sigue su propio pKa' },
          ]),
          h('div', { class: 'prose', style: { fontSize: 'var(--fs-xs)' } },
            h('h4', { text: 'Nada de esto está guionizado' }),
            h('p', {}, 'La bureta no “sube el pH”. Entrega un volumen; ese volumen cambia las '
              + 'cantidades de sustancia; el solver de equilibrio recalcula la especiación completa '
              + 'del sistema; el pH sale de la actividad del protón resultante, y el color del '
              + 'indicador de su propio equilibrio ácido-base a ese pH.'),
            h('p', {}, 'Es la misma cadena que ocurre en el matraz, y por eso la curva responde '
              + 'correctamente a cambios que un dibujo no podría anticipar: diluye el titrante diez '
              + 'veces y verás encogerse el salto; usa un ácido con pKa 10 y verás desaparecer el '
              + 'punto final.'),
          ),
        )
        : emptyState({ title: 'Sin datos' }));
      return;
    }

    if (tab === 'datos' && c) {
      replace(consoleBody, h('div', { class: 'table-wrap' },
        h('table', { class: 'table table--compact' },
          h('thead', {}, h('tr', {},
            h('th', { text: 'V / mL' }), h('th', { text: 'pH' }), h('th', { text: 'pcH' }),
            h('th', { text: 'I / M' }), h('th', { text: 'β' }))),
          h('tbody', {}, ...c.points.filter((_, i) => i % 5 === 0).map((pt) => h('tr', {},
            h('td', { class: 'col-num', text: pt.volumeML.toFixed(2) }),
            h('td', { class: 'col-num', text: fmtP(pt.pH, 3) }),
            h('td', { class: 'col-num', text: fmtP(pt.pcH, 3) }),
            h('td', { class: 'col-num', text: fmt(pt.ionicStrength, { sig: 3 }) }),
            h('td', { class: 'col-num', text: pt.bufferCapacity ? fmt(pt.bufferCapacity, { sig: 3 }) : '—' }),
          ))),
        ),
      ));
      return;
    }

    if (tab === 'registro') {
      replace(consoleBody, h('div', { class: 'console__body--log' },
        logLine('sistema', 'Banco de valoración iniciado'),
        logLine('matraz', `${analyteConc().toFixed(3)} M de ${substanceById(analyteId())?.name} en ${analyteVolume()} mL`),
        logLine('bureta', `${titrantConc().toFixed(3)} M de ${substanceById(titrantId())?.name}`),
        logLine('modelo', `Actividades: ${state().settings.activityModel}`),
        burette() > 0 ? logLine('entrega', `${burette().toFixed(2)} mL añadidos`) : null,
        c && c.warnings.length > 0 ? logLine('aviso', c.warnings[0], 'warn') : null,
      ));
      return;
    }

    replace(consoleBody, emptyState({ title: 'Sin contenido' }));
  });

  return workbench({
    toolbar: [
      h('span', { class: 'caps dim', text: 'Valoración ácido-base' }),
      h('div', { class: 'divider--v' }),
      realismSelector(),
      h('div', { class: 'divider--v' }),
      button('Exportar CSV', {
        size: 'sm', iconName: 'exportar',
        on: {
          click: () => {
            const c = curve();
            if (!c) return;
            download('valoracion.csv', seriesToCsv({
              series: [{ id: 'ph', label: 'pH', x: c.points.map((p) => p.volumeML), y: c.points.map((p) => p.pH) }],
              x: { label: 'Volumen', unit: 'mL' }, y: { label: 'pH' },
            }));
            toast({ tone: 'ok', title: 'Curva exportada', body: 'valoracion.csv' });
          },
        },
      }),
    ],
    left,
    stage,
    right,
    console: h('div', { class: 'stack', style: { height: '100%', minHeight: '0' } },
      h('div', { class: 'console__tabs' },
        tabs([
          { id: 'causa', label: '¿Qué está ocurriendo?' },
          { id: 'datos', label: 'Datos' },
          { id: 'registro', label: 'Registro' },
        ], consoleTab, { pills: true }),
      ),
      consoleBody,
    ),
  });
}

function loadingStage(progress: number): HTMLElement {
  return h('div', { class: 'empty' },
    h('div', { class: 'spinner' }),
    h('p', { class: 'empty__title', text: 'Resolviendo el equilibrio en cada punto' }),
    h('p', { class: 'empty__text', text: 'Doscientas sesenta resoluciones completas del sistema, con la dilución corregida.' }),
    h('div', { class: 'meter__track', style: { width: '220px' } },
      h('div', { class: 'meter__fill', style: { width: `${progress * 100}%` } }),
    ),
  );
}

function railSectionEl(title: string, ...body: Child[]): HTMLElement {
  return h('div', { class: 'rail__section', dataset: { open: 'true' } },
    h('div', { class: 'rail__head', style: { cursor: 'default' } }, title),
    h('div', { class: 'rail__body' }, ...body),
  );
}

function selectField(label: string, options: Array<{ value: string; label: string }>, sig: ReturnType<typeof signal<string>>): HTMLElement {
  const el = h('select', {
    class: 'select',
    on: { change: (ev) => sig.set((ev.target as HTMLSelectElement).value) },
  }, ...options.map((o) => h('option', { value: o.value, text: o.label })));
  effect(() => { el.value = sig(); });
  return h('label', { class: 'field' },
    h('span', { class: 'field__label', text: label }),
    el,
  );
}

/** The burette, with a meniscus that descends as liquid is delivered (§71). */
function buretteWidget(
  volume: ReturnType<typeof signal<number>>,
  running: ReturnType<typeof signal<boolean>>,
  curve: ReturnType<typeof signal<TitrationCurve | null>>,
): HTMLElement {
  const liquid = h('div', { class: 'burette__liquid' });
  const meniscus = h('div', { class: 'burette__meniscus' });

  effect(() => {
    const fraction = Math.min(volume() / 50, 1);
    liquid.style.top = `${fraction * 100}%`;
    meniscus.style.top = `${fraction * 100}%`;
  });

  const ticks = h('div', { class: 'burette__ticks' },
    ...Array.from({ length: 11 }, (_, i) => h('div', {
      class: `burette__tick${i % 5 === 0 ? ' burette__tick--major' : ''}`,
      style: { top: `${(i / 10) * 100}%` },
    })),
  );

  void running; void curve;

  return h('div', { class: 'burette' },
    h('div', { class: 'burette__tube', style: { height: '150px' } }, liquid, meniscus, ticks),
    h('div', { class: 'stack stack--tight', style: { justifyContent: 'space-between', fontSize: 'var(--fs-3xs)' } },
      h('span', { class: 'mono dim', text: '0.00' }),
      h('span', { class: 'mono', bindText: () => `${volume().toFixed(2)} mL` }),
      h('span', { class: 'mono dim', text: '50.00' }),
    ),
  );
}


/**
 * Live indicator preview: the colour of the flask, computed from the
 * indicator's own acid-base equilibrium at the current pH (§71).
 */
function indicatorPreview(
  indicatorId: ReturnType<typeof signal<string>>,
  currentPoint: { (): { pH: number } | null },
): HTMLElement {
  const host = h('div', { class: 'stack stack--tight' });
  effect(() => {
    const ind = indicatorById(indicatorId());
    const p = currentPoint();
    if (!ind) { replace(host); return; }
    const colour = p ? indicatorColour(ind, p.pH) : null;
    replace(host,
      h('div', { class: 'row', style: { gap: 'var(--sp-3)' } },
        colour ? solutionSwatch(colour.hex, { size: 30 }) : null,
        h('div', { style: { minWidth: '0' } },
          h('div', { style: { fontSize: 'var(--fs-2xs)', color: 'var(--fg-primary)' },
            text: colour ? colour.description : ind.acidColour }),
          h('div', { class: 'dim mono', style: { fontSize: 'var(--fs-3xs)' },
            text: `pKa ${ind.pKa.toFixed(2)} · viraje ${ind.range[0]}–${ind.range[1]}` }),
        ),
      ),
      p ? h('div', { class: 'meter__track' },
        h('div', {
          class: 'meter__fill',
          style: {
            width: `${indicatorFraction(ind, p.pH) * 100}%`,
            background: ind.baseHex,
          },
        }),
      ) : null,
      ind.notes ? h('p', { class: 'dim', style: { fontSize: 'var(--fs-3xs)', lineHeight: '1.5' }, text: ind.notes }) : null,
    );
  });
  return host;
}

function logLine(source: string, message: string, tone?: 'warn' | 'danger' | 'ok'): HTMLElement {
  return h('div', { class: ['logline', tone && `logline--${tone}`] },
    h('span', { class: 'logline__t', text: fmtClock(Date.now()) }),
    h('span', { class: 'logline__src', text: source }),
    h('span', { class: 'logline__msg', text: message }),
  );
}

// ===========================================================================
// Kinetics bench (§21)
// ===========================================================================

function kineticsBench(mechanismId?: string): HTMLElement {
  setContext([
    { label: 'Laboratorio', href: href('laboratorio') },
    { label: 'Cinética química' },
  ]);

  const selected = signal(mechanismId ?? 'first-order-decay');
  const temperature = signal(298.15);
  const duration = signal(60);
  const initialA = signal(0.1);
  const result = signal<ReturnType<typeof runKinetics> | null>(null);

  effect(() => {
    const m = mechanismById(selected());
    if (!m) return;
    const initial: Record<string, number> = {};
    m.species.forEach((sp, i) => { initial[sp] = i === 0 ? initialA() : (sp === 'E' ? 1e-5 : 0); });
    if (m.id === 'autocatalytic') initial.P = initialA() * 0.01;
    if (m.id === 'michaelis-menten') { initial.S = initialA(); initial.E = 1e-6; }
    result.set(runKinetics(m, initial, { temperature: temperature(), duration: duration(), points: 220 }));
  });

  const stage = h('div', { class: 'stack', style: { padding: 'var(--sp-4)' } });
  effect(() => {
    const run = result();
    const m = mechanismById(selected());
    if (!run || !m) { replace(stage, emptyState({ title: 'Selecciona un mecanismo' })); return; }

    const series: Series[] = m.species.map((sp, i) => ({
      id: sp, label: `[${sp}]`, x: run.t, y: run.c[sp], kind: 'line', colour: i + 1,
    }));

    // Rate versus concentration, the other diagnostic plot §21 asks for.
    const primary = m.species[0];
    const rateSeries: Series[] = [{
      id: 'rate', label: `−d[${primary}]/dt`,
      x: run.c[primary].slice(0, -1),
      y: run.c[primary].slice(0, -1).map((_, i) =>
        -(run.c[primary][i + 1] - run.c[primary][i]) / (run.t[i + 1] - run.t[i])),
      kind: 'line', colour: 2,
    }];

    replace(stage,
      plot({
        series,
        x: { label: 'Tiempo', unit: 's' },
        y: { label: 'Concentración', unit: 'mol·L⁻¹', includeZero: true },
        height: 300,
        caption: `Integración del sistema de ecuaciones diferenciales del mecanismo a ${temperature().toFixed(1)} K`
          + `${run.stiff ? ' (con el integrador para sistemas rígidos)' : ''}. `
          + 'Las curvas no están dibujadas: son la solución numérica.',
      }),
      h('div', { class: 'grid grid--2' },
        plot({
          series: rateSeries,
          x: { label: `[${primary}]`, unit: 'mol·L⁻¹' },
          y: { label: 'Velocidad', unit: 'mol·L⁻¹·s⁻¹' },
          height: 200, legend: false,
          caption: 'Velocidad frente a concentración: una recta que pasa por el origen indica primer orden.',
        }),
        plot({
          series: ([0, 1, 2] as const).map((order, i) => {
            const y = run.c[primary].map((c) => (order === 0 ? c : order === 1 ? Math.log(Math.max(c, 1e-30)) : 1 / Math.max(c, 1e-30)));
            return { id: `lin${order}`, label: ['[A]', 'ln[A]', '1/[A]'][order], x: run.t, y, kind: 'line' as const, colour: i + 4, hidden: order !== 1 };
          }),
          x: { label: 'Tiempo', unit: 's' },
          y: { label: 'Función linealizada' },
          height: 200,
          caption: 'Las tres linealizaciones. Sólo una da una recta: ésa es el orden de reacción.',
        }),
      ),
    );
  });

  const right = h('div');
  effect(() => {
    const run = result();
    const m = mechanismById(selected());
    if (!run || !m) return;

    const primary = m.species[0];
    const order = determineOrder(run.t, run.c[primary]);

    // Arrhenius from five simulated temperatures — a real experiment.
    const temps = [283.15, 293.15, 303.15, 313.15, 323.15];
    const step = m.steps[0];
    const ks = temps.map((T) => arrhenius(step.A, step.Ea, T));
    const arr = fitArrhenius(temps, ks);

    replace(right,
      railSectionEl('Constantes de velocidad',
        h('div', { class: 'stack stack--tight' },
          ...Object.entries(run.constants).map(([id, k]) => h('div', {},
            h('div', { class: 'caps dim', text: id }),
            h('div', { class: 'mono', style: { fontSize: 'var(--fs-xs)' },
              text: `k = ${fmt(k.kf, { sig: 4 })}${k.kr !== undefined ? `   k' = ${fmt(k.kr, { sig: 4 })}` : ''}` }),
          )),
        ),
      ),
      railSectionEl('Orden de reacción determinado',
        h('div', { class: 'stack stack--tight' },
          readout({ label: 'Orden', value: String(order.best.order), provenance: 'estimated', size: 'sm' }),
          props([
            ['r² del ajuste', order.best.r2.toFixed(6)],
            ['k ajustada', fmt(order.best.k, { sig: 4 })],
            ['Concluyente', order.conclusive ? 'sí' : 'no'],
          ]),
          !order.conclusive && note('warn', null,
            'Dos linealizaciones ajustan casi igual de bien: no se ha seguido la reacción lo bastante '
            + 'lejos para distinguir el orden. Aumenta la duración.'),
        ),
      ),
      railSectionEl('Ajuste de Arrhenius',
        h('div', { class: 'stack stack--tight' },
          props([
            ['Ea ajustada', `${(arr.Ea / 1000).toFixed(2)} kJ·mol⁻¹`],
            ['Ea real del modelo', `${(step.Ea / 1000).toFixed(2)} kJ·mol⁻¹`],
            ['A ajustado', fmt(arr.A, { sig: 4 })],
            ['r²', arr.r2.toFixed(6)],
          ]),
          plot({
            series: [{ id: 'arr', label: 'ln k', x: arr.invT, y: arr.lnK, kind: 'both', colour: 5 }],
            x: { label: '1/T', unit: 'K⁻¹', format: (v) => v.toExponential(3) },
            y: { label: 'ln k' },
            height: 150, legend: false, crosshair: false,
          }),
        ),
      ),
      m.notes ? railSectionEl('Notas del mecanismo',
        h('ul', { class: 'prose', style: { fontSize: 'var(--fs-2xs)', maxWidth: 'none' } },
          ...m.notes.map((n) => h('li', { text: n })),
        ),
      ) : null,
    );
  });

  const left = h('div', {},
    railSectionEl('Mecanismo',
      h('div', { class: 'stack stack--tight' },
        ...MECHANISMS.map((m) => {
          const btn = button(m.name, { size: 'sm', block: true, on: { click: () => selected.set(m.id) } });
          effect(() => btn.setAttribute('aria-pressed', String(selected() === m.id)));
          return btn;
        }),
      ),
    ),
    railSectionEl('Condiciones',
      h('div', { class: 'stack' },
        slider({ label: 'Temperatura', value: temperature, min: 273.15, max: 373.15, step: 0.5, unit: 'K',
          format: (v) => v.toFixed(1),
          hint: 'La constante de velocidad sigue Arrhenius: pequeños cambios producen efectos grandes.' }),
        slider({ label: 'Concentración inicial', value: initialA, min: 0.001, max: 1, unit: 'mol/L', log: true,
          format: (v) => fmt(v, { sig: 3 }) }),
        slider({ label: 'Duración', value: duration, min: 5, max: 600, step: 5, unit: 's',
          format: (v) => v.toFixed(0) }),
      ),
    ),
    railSectionEl('Ecuaciones del mecanismo',
      h('div', { class: 'stack stack--tight' },
        ...(mechanismById(selected())?.steps ?? []).map((st) => h('div', { style: { fontSize: 'var(--fs-2xs)' } },
          h('div', { class: 'mono', style: { color: 'var(--fg-primary)' },
            text: `${Object.entries(st.reactants).map(([k, v]) => (v > 1 ? `${v} ${k}` : k)).join(' + ')}`
              + `${st.reverse ? ' ⇌ ' : ' → '}`
              + `${Object.entries(st.products).map(([k, v]) => (v > 1 ? `${v} ${k}` : k)).join(' + ')}` }),
          h('div', { class: 'dim', style: { marginTop: '2px' },
            text: `A = ${fmt(st.A, { sig: 3 })}   Ea = ${(st.Ea / 1000).toFixed(1)} kJ·mol⁻¹` }),
          st.description ? h('div', { class: 'dim', style: { marginTop: '3px', lineHeight: '1.5' }, text: st.description }) : null,
        )),
      ),
    ),
  );

  return workbench({
    toolbar: [
      h('span', { class: 'caps dim', text: 'Cinética química' }),
      h('div', { class: 'divider--v' }),
      h('span', { class: 'dim', style: { fontSize: 'var(--fs-2xs)' },
        bindText: () => `${mechanismById(selected())?.overall ?? ''}` }),
    ],
    left,
    stage,
    right,
  });
}

void speciationVsPH; void linearRegression; void readInstrument; void replicate;
void consumeReagent; void formulaEl; void formulaHtml; void table; void svg; void chunked;
