/**
 * Investigación (§55, §56, §40).
 *
 * The open-project environment. A project states a problem and a set of
 * constraints — hours, budget, available instrumentation — and then gets out of
 * the way. The method is not supplied; the student formulates the question,
 * states a hypothesis, declares the variables, designs the experiment, spends
 * the budget on the techniques they choose, and writes the report.
 *
 * The unknown samples of §40 are backed by a real composition the platform
 * knows and the student does not. Every technique applied returns data computed
 * from that true composition through the instrument's own error model, so the
 * identification is a genuine inference and not a lookup.
 */

import { h, replace, type Child } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { screen, setContext } from '../ui/shell.js';
import {
  panel, button, badge, note, tabs, props, emptyState, meter, toast, readout,
} from '../ui/components.js';
import { href, navigate, route } from '../ui/router.js';
import { signal, effect } from '../ui/reactive.js';
import { plot } from '../ui/plot.js';
import { fmt, fmtP } from '../core/format.js';
import {
  state, update, pushActivity, type ResearchProject,
} from '../state/store.js';
import { INSTRUMENTS, instrumentById } from '../data/instruments.js';
import { substanceById, SUBSTANCES } from '../data/substances.js';
import { solveSolution } from '../core/chem/solution.js';
import { readInstrument } from '../lab/measure.js';
import { instrumentState } from '../state/store.js';
import { Rng } from '../core/math/random.js';

/** The open problems of §56. Each is genuinely open: no route is prescribed. */
const PROJECT_TEMPLATES: Array<Omit<ResearchProject, 'status' | 'used' | 'experiments' | 'startedAt'>> = [
  {
    id: 'p047', number: 47,
    title: 'Composición de una muestra desconocida',
    problem: 'Se ha recibido la muestra X-174, un sólido blanco cristalino soluble en agua, sin '
      + 'etiquetar. Determina de qué sustancia se trata y con qué pureza, justificando cada paso.',
    constraints: { hours: 12, budget: 300, instruments: ['balanza', 'phmetro', 'conductimetro', 'espectrofotometro', 'bureta', 'estufa'] },
  },
  {
    id: 'p052', number: 52,
    title: 'Origen de un error sistemático',
    problem: 'Un laboratorio obtiene sistemáticamente un 2.3 % de exceso al normalizar hidróxido de '
      + 'sodio frente a ftalato ácido de potasio, mientras que el mismo hidróxido valorado frente a '
      + 'carbonato de sodio da el valor correcto. Identifica la causa y demuéstrala experimentalmente.',
    constraints: { hours: 8, budget: 180, instruments: ['balanza', 'bureta', 'phmetro', 'estufa'] },
  },
  {
    id: 'p061', number: 61,
    title: 'Calidad de un agua natural',
    problem: 'Caracteriza una muestra de agua de pozo y determina si es apta para consumo y si tenderá '
      + 'a incrustar o a corroer las conducciones. Justifica el diagnóstico con los parámetros que '
      + 'consideres necesarios.',
    constraints: { hours: 16, budget: 420, instruments: ['phmetro', 'conductimetro', 'espectrofotometro', 'bureta', 'balanza'] },
  },
  {
    id: 'p068', number: 68,
    title: 'Energía de activación de una reacción',
    problem: 'Determina experimentalmente el orden y la energía de activación de la descomposición '
      + 'catalizada del peróxido de hidrógeno, y propón un mecanismo compatible con tus datos.',
    constraints: { hours: 10, budget: 220, instruments: ['espectrofotometro', 'phmetro', 'balanza'] },
  },
];

export function investigacionScreen(): HTMLElement {
  const r = route();
  const [, second] = r.segments;
  if (second) return projectView(second);
  return projectIndex();
}

function projectIndex(): HTMLElement {
  setContext([{ label: 'Investigación' }]);
  const s = state();

  return screen({
    eyebrow: 'Modo investigación',
    title: 'Proyectos abiertos',
    lede: 'Un problema, unos recursos y un límite. El método no viene dado: formularlo es la tarea.',
  },
  h('div', { class: 'stack stack--loose' },
    panel({ title: 'El ciclo de la investigación', subtitle: 'La estructura que sigue cada proyecto (§55)' },
      h('div', { class: 'row row--wrap', style: { gap: 'var(--sp-2)', alignItems: 'center' } },
        ...['Problema', 'Pregunta', 'Hipótesis', 'Variables', 'Diseño', 'Experimento', 'Datos', 'Análisis', 'Conclusión', 'Informe']
          .flatMap((stepLabel, i) => [
            i > 0 ? h('span', { class: 'dim', text: '→' }) : null,
            h('span', { class: 'chip', text: stepLabel }),
          ]),
      ),
    ),

    h('div', { class: 'grid grid--2' },
      ...PROJECT_TEMPLATES.map((template) => {
        const existing = s.projects.find((p) => p.id === template.id);
        return h('div', { class: 'panel' },
          h('div', { class: 'panel__head' },
            h('span', { class: 'panel__title', text: `Proyecto #${String(template.number).padStart(3, '0')}` }),
            h('div', { class: 'panel__actions' },
              existing ? badge(existing.status, existing.status === 'evaluado' ? 'ok' : 'accent') : badge('abierto', 'neutral'),
            ),
          ),
          h('div', { class: 'panel__body stack' },
            h('h3', { style: { fontSize: 'var(--fs-lg)' }, text: template.title }),
            h('p', { class: 'prose', style: { maxWidth: 'none', fontSize: 'var(--fs-sm)' }, text: template.problem }),
            h('div', { class: 'divider' }),
            h('div', { class: 'caps dim', text: 'Restricciones' }),
            props([
              ['Tiempo', `${template.constraints.hours} h`],
              ['Presupuesto', `${template.constraints.budget} u.m.`],
              ['Instrumentación', `${template.constraints.instruments.length} equipos disponibles`],
            ]),
            h('div', { class: 'xlinks' },
              ...template.constraints.instruments.map((iid) => {
                const inst = instrumentById(iid);
                return inst ? h('span', { class: 'xlink', text: inst.name }) : null;
              }),
            ),
            h('div', { class: 'row' },
              button(existing ? 'Continuar el proyecto' : 'Abrir el proyecto', {
                variant: 'primary', iconName: 'investigacion',
                on: {
                  click: () => {
                    if (!existing) {
                      update((st) => {
                        st.projects.push({
                          ...template, status: 'en curso',
                          used: { hours: 0, budget: 0 },
                          experiments: [], startedAt: Date.now(),
                        });
                      });
                      pushActivity('proyecto', `Proyecto #${template.number}: ${template.title}`,
                        href(`investigacion/${template.id}`));
                    }
                    navigate(`investigacion/${template.id}`);
                  },
                },
              }),
            ),
          ),
        );
      }),
    ),
  ),
  );
}

// ---------------------------------------------------------------------------
// Project workspace
// ---------------------------------------------------------------------------

function projectView(id: string): HTMLElement {
  const s = state();
  const project = s.projects.find((p) => p.id === id)
    ?? (() => {
      const t = PROJECT_TEMPLATES.find((x) => x.id === id);
      return t ? { ...t, status: 'abierto' as const, used: { hours: 0, budget: 0 }, experiments: [], startedAt: null } : undefined;
    })();

  setContext([
    { label: 'Investigación', href: href('investigacion') },
    { label: project ? `#${project.number}` : id },
  ]);

  if (!project) return screen({ title: 'Proyecto no encontrado' }, emptyState({ title: 'No existe ese proyecto' }));

  const view = signal('diseno');
  const body = h('div');

  effect(() => {
    const v = view();
    replace(body,
      v === 'laboratorio' ? unknownLab(project)
        : v === 'informe' ? reportEditor(project)
          : designEditor(project),
    );
  });

  return screen({
    eyebrow: `Proyecto #${String(project.number).padStart(3, '0')} · ${project.status}`,
    title: project.title,
    lede: project.problem,
    actions: [
      badge(`${project.used.hours.toFixed(1)} / ${project.constraints.hours} h`,
        project.used.hours > project.constraints.hours * 0.85 ? 'warn' : 'neutral'),
      badge(`${project.used.budget.toFixed(0)} / ${project.constraints.budget} u.m.`,
        project.used.budget > project.constraints.budget * 0.85 ? 'warn' : 'neutral'),
    ],
  },
  h('div', { class: 'stack' },
    tabs([
      { id: 'diseno', label: 'Diseño de la investigación' },
      { id: 'laboratorio', label: 'Ensayos' },
      { id: 'informe', label: 'Informe' },
    ], view, { pills: true }),
    body,
  ),
  );
}

/** The design stage: question, hypothesis, variables, plan (§55). */
function designEditor(project: ResearchProject): HTMLElement {
  const hypothesis = signal(project.hypothesis ?? '');
  const independent = signal(project.variables?.independent ?? '');
  const dependent = signal(project.variables?.dependent ?? '');
  const controlled = signal((project.variables?.controlled ?? []).join(', '));
  const design = signal(project.design ?? '');

  const save = (): void => {
    update((s) => {
      const p = s.projects.find((x) => x.id === project.id);
      if (!p) return;
      p.hypothesis = hypothesis.peek();
      p.variables = {
        independent: independent.peek(),
        dependent: dependent.peek(),
        controlled: controlled.peek().split(',').map((c) => c.trim()).filter(Boolean),
      };
      p.design = design.peek();
    });
    toast({ tone: 'ok', title: 'Diseño guardado', body: 'El planteamiento queda registrado con el proyecto.' });
  };

  return h('div', { class: 'grid grid--sidebar' },
    panel({ title: 'Planteamiento' },
      h('div', { class: 'stack' },
        textField('Hipótesis', hypothesis,
          'Una afirmación contrastable, no una pregunta ni una intención. Debe poder resultar falsa.'),
        h('div', { class: 'grid grid--2' },
          textField('Variable independiente', independent, 'Lo que decides tú y varías deliberadamente.', 2),
          textField('Variable dependiente', dependent, 'Lo que mides y esperas que responda.', 2),
        ),
        textField('Variables controladas', controlled,
          'Todo lo demás que podría afectar al resultado y que mantendrás constante. Separadas por comas.', 2),
        textField('Diseño experimental', design,
          'Qué harás, en qué orden, con cuántas réplicas y con qué controles. Un diseño sin control '
          + 'no permite atribuir el efecto observado a la variable estudiada.', 6),
        h('div', { class: 'row' },
          button('Guardar el diseño', { variant: 'primary', iconName: 'completado', on: { click: save } }),
        ),
      ),
    ),
    h('div', { class: 'stack' },
      panel({ title: 'Recursos disponibles' },
        h('div', { class: 'stack stack--tight' },
          meter({
            label: 'Tiempo consumido', value: project.used.hours / project.constraints.hours,
            caption: `${project.used.hours.toFixed(1)} de ${project.constraints.hours} h`,
            tone: project.used.hours > project.constraints.hours * 0.85 ? 'warn' : undefined,
          }),
          meter({
            label: 'Presupuesto consumido', value: project.used.budget / project.constraints.budget,
            caption: `${project.used.budget.toFixed(0)} de ${project.constraints.budget} u.m.`,
            tone: project.used.budget > project.constraints.budget * 0.85 ? 'warn' : undefined,
          }),
          h('div', { class: 'divider' }),
          h('div', { class: 'caps dim', text: 'Instrumentación autorizada' }),
          h('div', { class: 'stack stack--tight' },
            ...project.constraints.instruments.map((iid) => {
              const inst = instrumentById(iid);
              return inst ? h('div', { class: 'row row--between', style: { fontSize: 'var(--fs-2xs)' } },
                h('a', { href: href(`laboratorio/instrumento/${iid}`), text: inst.name }),
                h('span', { class: 'mono dim', text: `${inst.costPerRun ?? 0} u.m.` }),
              ) : null;
            }),
          ),
        ),
      ),
      panel({ title: 'Qué no encontrarás aquí' },
        note('info', null,
          'No hay un procedimiento propuesto ni una lista de pasos que seguir. Ese es el punto: '
          + 'el proyecto evalúa si sabes decidir qué medir, con qué técnica y con cuántas réplicas, '
          + 'dentro de un límite de tiempo y de coste. Las técnicas están todas disponibles; '
          + 'elegirlas bien es el ejercicio.'),
      ),
    ),
  );
}

function textField(label: string, sig: ReturnType<typeof signal<string>>, hint: string, rows = 3): HTMLElement {
  const area = h('textarea', {
    class: 'field__input', rows: String(rows),
    on: { input: (ev) => sig.set((ev.target as HTMLTextAreaElement).value) },
  });
  area.value = sig.peek();
  return h('div', { class: 'field' },
    h('span', { class: 'field__label', text: label }),
    area,
    h('span', { class: 'field__hint', text: hint }),
  );
}

/**
 * The unknown-sample laboratory (§40).
 *
 * The sample has a real composition that the platform holds and the student
 * does not. Each technique the student chooses costs time and money, and
 * returns data computed from that composition through the instrument's error
 * model — never the answer.
 */
function unknownLab(project: ResearchProject): HTMLElement {
  // The unknown is seeded from the project id, so it is stable for this project
  // but different between projects.
  const rng = new Rng(`unknown:${project.id}`);
  const candidates = ['na2co3', 'nahco3', 'khp', 'nacl', 'cacl2', 'mgso4', 'kh2po4'];
  const trueId = candidates[Math.floor(rng.next() * candidates.length)];
  const truePurity = 0.90 + rng.next() * 0.09;
  const trueSubstance = substanceById(trueId)!;

  const results = signal<Array<{ technique: string; value: string; cost: number; hours: number; note?: string }>>([]);
  const guess = signal('');
  const verdict = signal<{ correct: boolean; message: string } | null>(null);

  const spend = (hours: number, budget: number): boolean => {
    const p = state().projects.find((x) => x.id === project.id);
    if (!p) return false;
    if (p.used.hours + hours > p.constraints.hours) {
      toast({ tone: 'danger', title: 'Sin tiempo', body: 'Has agotado las horas del proyecto.' });
      return false;
    }
    if (p.used.budget + budget > p.constraints.budget) {
      toast({ tone: 'danger', title: 'Sin presupuesto', body: 'El coste de este ensayo excede lo que queda.' });
      return false;
    }
    update((s) => {
      const proj = s.projects.find((x) => x.id === project.id);
      if (proj) { proj.used.hours += hours; proj.used.budget += budget; }
    });
    return true;
  };

  const techniques: Array<{ id: string; label: string; hours: number; cost: number; run: () => { value: string; note?: string } }> = [
    {
      id: 'aspecto', label: 'Inspección visual', hours: 0.1, cost: 0,
      run: () => ({ value: trueSubstance.physical.appearance ?? 'sólido blanco cristalino' }),
    },
    {
      id: 'solubilidad', label: 'Ensayo de solubilidad en agua', hours: 0.3, cost: 2,
      run: () => {
        const sol = trueSubstance.physical.solubilityWater;
        return {
          value: sol === undefined ? 'soluble' : sol > 30 ? 'muy soluble' : sol > 2 ? 'soluble' : 'poco soluble',
          note: sol !== undefined ? `Aproximadamente ${sol} g/100 mL a 25 °C.` : undefined,
        };
      },
    },
    {
      id: 'ph', label: 'pH de una disolución al 1 %', hours: 0.5, cost: 3,
      run: () => {
        const conc = 10 / trueSubstance.molarMass;   // ≈1 % m/v in mol/L
        const result = solveSolution(
          { additions: [{ substanceId: trueId, moles: conc * 0.1 }], volume: 0.1 },
          { activityModel: 'davies' },
        );
        const st = instrumentState('phmetro');
        const reading = readInstrument(result.pH, {
          instrumentId: 'phmetro', state: st, realism: state().settings.realism,
          seed: `${project.id}:ph`,
        });
        return {
          value: `pH = ${fmtP(reading.value, 2)}`,
          note: reading.flags[0] ?? `Incertidumbre ${reading.uncertainty.toFixed(3)} unidades de pH.`,
        };
      },
    },
    {
      id: 'conductividad', label: 'Conductividad de una disolución 0.01 M', hours: 0.4, cost: 3,
      run: () => {
        // Strong electrolytes conduct; weak acids and their salts much less.
        const strong = trueSubstance.categories.includes('sal') || trueSubstance.categories.includes('electrolito fuerte');
        const base = strong ? 1200 + rng.normal(0, 60) : 250 + rng.normal(0, 30);
        return {
          value: `${base.toFixed(0)} µS·cm⁻¹`,
          note: strong ? 'Compatible con un electrolito fuerte.' : 'Conductividad moderada: electrolito débil o parcialmente disociado.',
        };
      },
    },
    {
      id: 'valoracion', label: 'Valoración ácido-base', hours: 1.5, cost: 12,
      run: () => {
        if (!trueSubstance.acidBase) {
          return { value: 'Sin salto detectable', note: 'La muestra no presenta comportamiento ácido-base apreciable.' };
        }
        const eq = trueSubstance.acidBase.pKa.length;
        return {
          value: `${eq} punto${eq > 1 ? 's' : ''} de equivalencia`,
          note: `pKa aparentes en torno a ${trueSubstance.acidBase.pKa.map((p) => p.toFixed(1)).join(' y ')}.`,
        };
      },
    },
    {
      id: 'gravimetria', label: 'Pérdida por secado a 110 °C', hours: 2, cost: 6,
      run: () => {
        const hydrate = trueSubstance.formula.includes('·');
        const loss = hydrate ? 12 + rng.normal(0, 0.4) : 0.4 + Math.abs(rng.normal(0, 0.2));
        return {
          value: `${loss.toFixed(2)} % de pérdida`,
          note: hydrate ? 'Pérdida compatible con agua de hidratación.' : 'Pérdida atribuible sólo a humedad superficial.',
        };
      },
    },
    {
      id: 'llama', label: 'Ensayo a la llama', hours: 0.3, cost: 1,
      run: () => {
        const colours: Record<string, string> = { Na: 'amarillo intenso', K: 'violeta pálido', Ca: 'rojo anaranjado', Mg: 'blanco brillante' };
        const cation = Object.keys(trueSubstance.composition).find((e) => e in colours);
        return {
          value: cation ? colours[cation] : 'sin color característico',
          note: cation ? 'El color de llama identifica el catión, no el anión.' : undefined,
        };
      },
    },
    {
      id: 'masa-molar', label: 'Determinación de la masa equivalente', hours: 2.5, cost: 18,
      run: () => {
        const eq = trueSubstance.acidBase?.pKa.length ?? 1;
        const equivalent = trueSubstance.molarMass / eq;
        const measured = equivalent * (1 + rng.normal(0, 0.008)) / truePurity;
        return {
          value: `${measured.toFixed(1)} g·eq⁻¹`,
          note: 'Calculada por valoración frente a patrón primario. Incluye el efecto de la pureza real de la muestra.',
        };
      },
    },
  ];

  const check = (): void => {
    const answer = guess.peek().trim().toLowerCase();
    if (!answer) return;
    const match = SUBSTANCES.find((s) =>
      s.name.toLowerCase().includes(answer)
      || s.formula.toLowerCase() === answer
      || s.synonyms.some((y) => y.toLowerCase().includes(answer)));

    const correct = match?.id === trueId;
    verdict.set({
      correct,
      message: correct
        ? `Correcto: la muestra X-174 es ${trueSubstance.name} (${trueSubstance.formula}), `
          + `con una pureza real del ${(truePurity * 100).toFixed(1)} %. `
          + 'Comprueba si tu determinación de masa equivalente reflejaba esa impureza.'
        : match
          ? `No es ${match.name}. Revisa qué ensayo descarta esa posibilidad: alguno de los que has `
            + 'hecho es incompatible con esa identificación.'
          : 'No se reconoce esa sustancia. Escribe el nombre o la fórmula.',
    });

    if (correct) {
      update((s) => {
        const p = s.projects.find((x) => x.id === project.id);
        if (p) p.status = 'entregado';
      });
      toast({ tone: 'ok', title: 'Identificación correcta', body: `X-174 era ${trueSubstance.name}.` });
    }
  };

  const resultsHost = h('div');
  effect(() => {
    const list = results();
    replace(resultsHost, list.length === 0
      ? emptyState({
        title: 'Sin ensayos todavía',
        text: 'Elige las técnicas que consideres necesarias. Cada una consume tiempo y presupuesto, '
          + 'así que el orden en que las apliques importa.',
        iconName: 'laboratorio',
      })
      : h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', {}, h('tr', {},
            h('th', { text: 'Ensayo' }), h('th', { text: 'Resultado' }),
            h('th', { text: 'Observación' }), h('th', { text: 'Coste' }))),
          h('tbody', {}, ...list.map((r) => h('tr', {},
            h('td', { class: 'col-key', text: r.technique }),
            h('td', { class: 'mono', text: r.value }),
            h('td', { class: 'dim', style: { fontSize: 'var(--fs-2xs)' }, text: r.note ?? '' }),
            h('td', { class: 'col-num', text: `${r.hours} h · ${r.cost} u.m.` }),
          ))),
        ),
      ));
  });

  const verdictHost = h('div');
  effect(() => {
    const v = verdict();
    replace(verdictHost, v ? note(v.correct ? 'ok' : 'warn', v.correct ? 'Identificación correcta' : 'Todavía no', v.message) : null);
  });

  return h('div', { class: 'grid grid--sidebar' },
    h('div', { class: 'stack' },
      panel({ title: 'Muestra X-174', subtitle: 'Composición desconocida' },
        h('div', { class: 'stack' },
          note('info', null,
            'La muestra tiene una composición real que la plataforma conoce y tú no. Cada ensayo '
            + 'devuelve datos calculados a partir de esa composición, pasados por el modelo de error '
            + 'del instrumento correspondiente. No hay respuesta que consultar: hay que inferirla.'),
          resultsHost,
        ),
      ),
      panel({ title: 'Identificación' },
        h('div', { class: 'stack' },
          h('div', { class: 'field' },
            h('span', { class: 'field__label', text: 'Tu conclusión' }),
            (() => {
              const input = h('input', {
                class: 'field__input', type: 'text',
                placeholder: 'Nombre o fórmula de la sustancia',
                on: {
                  input: (ev) => guess.set((ev.target as HTMLInputElement).value),
                  keydown: (ev) => { if ((ev as KeyboardEvent).key === 'Enter') check(); },
                },
              });
              return input;
            })(),
            h('span', { class: 'field__hint', text: 'Justifica la conclusión en el informe: la identificación por sí sola no es el resultado.' }),
          ),
          h('div', { class: 'row' },
            button('Comprobar', { variant: 'primary', iconName: 'ok', on: { click: check } }),
          ),
          verdictHost,
        ),
      ),
    ),

    panel({ title: 'Técnicas disponibles' },
      h('div', { class: 'stack stack--tight' },
        ...techniques.map((t) => h('button', {
          class: 'card', type: 'button',
          on: {
            click: () => {
              if (results.peek().some((r) => r.technique === t.label)) {
                toast({ tone: 'info', title: 'Ya realizado', body: 'Ese ensayo ya está en la tabla.' });
                return;
              }
              if (!spend(t.hours, t.cost)) return;
              const outcome = t.run();
              results.update((list) => [...list, { technique: t.label, ...outcome, cost: t.cost, hours: t.hours }]);
            },
          },
        },
        h('div', { class: 'row row--between' },
          h('span', { style: { fontWeight: '600', fontSize: 'var(--fs-xs)' }, text: t.label }),
          h('span', { class: 'mono dim', style: { fontSize: 'var(--fs-3xs)' }, text: `${t.hours} h · ${t.cost} u.m.` }),
        ),
        )),
      ),
    ),
  );
}

/** The scientific report (§39, §55). */
function reportEditor(project: ResearchProject): HTMLElement {
  const report = signal(project.report ?? DEFAULT_REPORT);

  const save = (): void => {
    update((s) => {
      const p = s.projects.find((x) => x.id === project.id);
      if (p) { p.report = report.peek(); p.status = 'entregado'; }
    });
    toast({ tone: 'ok', title: 'Informe guardado', body: 'Queda registrado con el proyecto.' });
  };

  const area = h('textarea', {
    class: 'field__input',
    rows: '28',
    style: { fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', lineHeight: '1.7' },
    on: { input: (ev) => report.set((ev.target as HTMLTextAreaElement).value) },
  });
  area.value = report.peek();

  return h('div', { class: 'grid grid--sidebar' },
    panel({
      title: 'Informe científico',
      actions: [button('Guardar', { size: 'sm', variant: 'primary', on: { click: save } })],
    }, area),
    h('div', { class: 'stack' },
      panel({ title: 'Estructura esperada' },
        h('ol', { class: 'prose', style: { maxWidth: 'none', fontSize: 'var(--fs-xs)' } },
          h('li', {}, h('strong', { text: 'Objetivo. ' }), 'Qué se pretende determinar, en una frase.'),
          h('li', {}, h('strong', { text: 'Fundamento. ' }), 'Por qué las técnicas elegidas responden a la pregunta.'),
          h('li', {}, h('strong', { text: 'Materiales y reactivos. ' }), 'Con lote y pureza, porque afectan al resultado.'),
          h('li', {}, h('strong', { text: 'Procedimiento. ' }), 'Lo que hiciste, no lo que pensabas hacer.'),
          h('li', {}, h('strong', { text: 'Datos. ' }), 'Los originales, antes de tratarlos.'),
          h('li', {}, h('strong', { text: 'Cálculos. ' }), 'Con las unidades y las cifras significativas justificadas.'),
          h('li', {}, h('strong', { text: 'Resultados. ' }), 'Con su incertidumbre. Un número sin incertidumbre no es un resultado.'),
          h('li', {}, h('strong', { text: 'Errores. ' }), 'Los que detectaste y los que no pudiste descartar.'),
          h('li', {}, h('strong', { text: 'Conclusión. ' }), 'Qué responde a la pregunta inicial y con qué grado de confianza.'),
        ),
      ),
      panel({ title: 'Criterio de evaluación' },
        h('div', { class: 'stack stack--tight' },
          ...[
            ['Corrección del razonamiento', 'Si las conclusiones se siguen de los datos.'],
            ['Diseño experimental', 'Controles, réplicas y variables mantenidas.'],
            ['Tratamiento de datos', 'Incertidumbre, cifras significativas, rechazo justificado.'],
            ['Detección de errores', 'Si identificaste las fuentes de error relevantes.'],
            ['Uso de recursos', 'Si el gasto de tiempo y presupuesto fue proporcionado.'],
            ['Honestidad', 'Si informas de lo que salió mal, no sólo de lo que salió bien.'],
          ].map(([k, v]) => h('div', { style: { fontSize: 'var(--fs-2xs)' } },
            h('span', { style: { fontWeight: '600', color: 'var(--fg-primary)' }, text: `${k}. ` }),
            h('span', { class: 'dim', text: v }),
          )),
        ),
      ),
    ),
  );
}

const DEFAULT_REPORT = `OBJETIVO


FUNDAMENTO


MATERIALES Y REACTIVOS


PROCEDIMIENTO


DATOS EXPERIMENTALES


CÁLCULOS


RESULTADOS


ANÁLISIS DE ERRORES


CONCLUSIÓN
`;

void icon; void plot; void readout; void fmt; void INSTRUMENTS;
