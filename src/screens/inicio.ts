/**
 * Home (§7).
 *
 * Answers the six questions of §75 immediately: where you are, what you were
 * doing, what needs attention, and what to do next. Deliberately sparse — the
 * specification says not to overload it, so it shows the single thing worth
 * resuming, the state of the laboratory, and a compact set of entry points.
 */

import { h, type Child } from './../ui/dom.js';
import { icon } from '../ui/icons.js';
import { screen, setContext, SECTIONS } from '../ui/shell.js';
import { panel, button, meter, badge, note, competencyRow, emptyState } from '../ui/components.js';
import { href, navigate } from '../ui/router.js';
import {
  state, diagnoseWeakness, COMPETENCY_LABEL, courseProgress,
  type Competency, REALISM_LABEL,
} from '../state/store.js';
import { COURSES, courseById, allTopics, coursesByTerm } from '../content/curriculum.js';
import { instrumentById, INSTRUMENTS } from '../data/instruments.js';
import { instrumentStatus } from '../lab/measure.js';
import { substanceById } from '../data/substances.js';
import { fmtDuration, fmtClock } from '../core/format.js';

export function inicioScreen(): HTMLElement {
  setContext([{ label: 'Inicio' }]);
  const s = state();

  return screen(
    {
      eyebrow: greeting(),
      title: 'CHEMIA',
      lede: 'Laboratorio científico digital. Todo lo que ves aquí procede de un mismo motor científico: '
        + 'la misma sustancia, el mismo equilibrio y el mismo instrumento en cada asignatura.',
      actions: [
        badge(`Modo ${REALISM_LABEL[s.settings.realism].toLowerCase()}`, 'accent'),
      ],
    },
    h('div', { class: 'stack stack--loose' },
      continueBlock(),
      h('div', { class: 'grid grid--sidebar' },
        h('div', { class: 'stack' },
          quickAccess(),
          currentCourses(),
        ),
        h('div', { class: 'stack' },
          labStatus(),
          competencySummary(),
          recentActivity(),
        ),
      ),
    ),
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Buenas noches';
  if (hour < 13) return 'Buenos días';
  if (hour < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * The "continue" card. When nothing has been started, it proposes the correct
 * first step rather than showing an empty slot — a first-run state that is
 * still useful (§80).
 */
function continueBlock(): HTMLElement {
  const s = state();
  const cont = s.continueAt;
  const active = s.experiments.find((e) => e.status === 'en curso');

  if (!cont && !active) {
    const first = courseById('qg1')!;
    return panel({ title: 'Empezar' },
      h('div', { class: 'stack' },
        h('p', { class: 'prose', style: { maxWidth: '62ch' } },
          'Todavía no has empezado ninguna asignatura. El plan comienza por ',
          h('strong', { text: 'Química General I' }),
          ', que establece el vocabulario —mol, estequiometría, disolución, gas— del que dependen '
          + 'todas las demás.'),
        h('div', { class: 'row row--wrap' },
          button('Comenzar Química General I', {
            variant: 'primary', size: 'lg', iconName: 'flecha-derecha',
            on: { click: () => navigate(`universidad/${first.id}`) },
          }),
          button('Ver el plan completo', { on: { click: () => navigate('universidad') } }),
          button('Explorar la tabla periódica', { on: { click: () => navigate('mundo/tabla') } }),
        ),
      ),
    );
  }

  const course = cont ? courseById(cont.courseId) : undefined;
  const progress = course ? courseProgress(allTopics(course).map((t) => t.id)) : 0;

  return panel({
    title: 'Continuar',
    actions: course ? [badge(course.code, 'neutral')] : [],
  },
  h('div', { class: 'stack' },
    active && note('info', 'Experimento en curso',
      h('div', {},
        h('div', { text: active.title }),
        h('div', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', marginTop: '4px' },
          text: `Iniciado ${fmtClock(active.startedAt)} · ${active.data.length} medidas registradas` }),
      ),
    ),
    course && h('div', { class: 'stack stack--tight' },
      h('h3', { style: { fontSize: 'var(--fs-lg)' }, text: course.name }),
      cont && h('p', { class: 'muted', style: { fontSize: 'var(--fs-sm)' }, text: cont.label }),
      meter({
        label: 'Progreso de la asignatura',
        value: progress,
        format: (v) => `${(v * 100).toFixed(0)} %`,
        tone: progress > 0.7 ? 'ok' : undefined,
      }),
    ),
    h('div', { class: 'row row--wrap' },
      cont && button('Continuar', {
        variant: 'primary', iconName: 'flecha-derecha',
        on: { click: () => navigate(`universidad/${cont.courseId}/${encodeURIComponent(cont.topicId)}`) },
      }),
      active && button('Volver al experimento', {
        iconName: 'laboratorio',
        on: { click: () => navigate('laboratorio') },
      }),
    ),
  ),
  );
}

function quickAccess(): HTMLElement {
  const targets: Array<{ id: string; label: string; sub: string; href: string }> = [
    { id: 'universidad', label: 'Universidad', sub: '41 asignaturas · 414 temas', href: href('universidad') },
    { id: 'laboratorio', label: 'Laboratorio', sub: 'Experimentos e instrumentos', href: href('laboratorio') },
    { id: 'mundo', label: 'Moléculas', sub: 'Modelos 3D y geometría', href: href('mundo/moleculas') },
    { id: 'mundo', label: 'Tabla periódica', sub: '118 elementos', href: href('mundo/tabla') },
    { id: 'datos', label: 'Datos', sub: 'Regresión y quimiometría', href: href('datos') },
    { id: 'investigacion', label: 'Investigación', sub: 'Proyectos abiertos', href: href('investigacion') },
  ];

  return panel({ title: 'Acceso rápido' },
    h('div', { class: 'grid grid--3', style: { gap: 'var(--sp-3)' } },
      ...targets.map((t) => {
        const section = SECTIONS.find((x) => x.id === t.id)!;
        return h('a', { class: 'card', href: t.href, style: { textDecoration: 'none' } },
          h('div', { class: 'row', style: { gap: 'var(--sp-3)', alignItems: 'flex-start' } },
            icon(section.iconName, { size: 18, class: 'nav__icon' }),
            h('div', { style: { minWidth: '0' } },
              h('div', { class: 'card__title', style: { marginTop: '0' }, text: t.label }),
              h('div', { class: 'card__meta', style: { marginTop: '2px' }, text: t.sub }),
            ),
          ),
        );
      }),
    ),
  );
}

function currentCourses(): HTMLElement {
  const s = state();
  const withProgress = COURSES
    .map((c) => ({ course: c, progress: courseProgress(allTopics(c).map((t) => t.id)) }))
    .filter((e) => e.progress > 0.001)
    .sort((a, b) => b.progress - a.progress);

  if (withProgress.length === 0) {
    const firstTerm = coursesByTerm().get(1) ?? [];
    return panel({ title: 'Primer cuatrimestre', subtitle: 'Las asignaturas sin prerrequisitos' },
      h('div', { class: 'stack stack--tight' },
        ...firstTerm.map((c) => h('a', {
          class: 'course', href: href(`universidad/${c.id}`),
          style: { textDecoration: 'none' },
          dataset: { status: 'available' },
        },
        h('div', { class: 'course__code', text: c.code }),
        h('div', { class: 'course__name', text: c.name }),
        h('div', { class: 'course__meta' },
          h('span', { text: `${c.credits} créditos` }),
          h('span', { text: '·' }),
          h('span', { text: `${allTopics(c).length} temas` }),
        ),
        )),
      ),
    );
  }

  return panel({ title: 'Materias en curso', subtitle: `${withProgress.length} iniciadas` },
    h('div', { class: 'stack stack--tight' },
      ...withProgress.slice(0, 6).map(({ course, progress }) =>
        h('a', {
          class: 'course', href: href(`universidad/${course.id}`),
          style: { textDecoration: 'none' },
          dataset: { status: progress >= 0.85 ? 'done' : 'active' },
        },
        h('div', { class: 'row row--between' },
          h('div', { class: 'course__code', text: course.code }),
          h('div', { class: 'mono dim', style: { fontSize: 'var(--fs-3xs)' }, text: `${(progress * 100).toFixed(0)} %` }),
        ),
        h('div', { class: 'course__name', text: course.name }),
        h('div', { class: 'meter__track', style: { marginTop: '6px' } },
          h('div', { class: 'meter__fill', style: { width: `${progress * 100}%` } }),
        ),
        )),
      void s,
    ),
  );
}

/**
 * Laboratory status. Surfaces exactly the things that would invalidate a
 * measurement — an uncalibrated instrument, an exhausted reagent — because
 * that is what a scientist checks before starting (§67).
 */
function labStatus(): HTMLElement {
  const s = state();
  const problems: Child[] = [];

  for (const instrument of INSTRUMENTS) {
    if (!instrument.requiresCalibration) continue;
    const st = s.lab.instruments[instrument.id];
    if (!st) continue;
    const status = instrumentStatus(instrument, st);
    if (status.tone === 'ok') continue;
    problems.push(h('div', { class: 'row row--between', style: { fontSize: 'var(--fs-2xs)' } },
      h('a', { href: href(`laboratorio/instrumento/${instrument.id}`), text: instrument.name }),
      badge(status.label, status.tone === 'danger' ? 'danger' : 'warn'),
    ));
  }

  const low = s.lab.reagents.filter((r) => {
    const initial = r.unit === 'g' ? 250 : 1;
    return r.amount < initial * 0.12;
  });
  for (const r of low) {
    const sub = substanceById(r.substanceId);
    problems.push(h('div', { class: 'row row--between', style: { fontSize: 'var(--fs-2xs)' } },
      h('span', { text: sub?.name ?? r.substanceId }),
      badge(`Quedan ${r.amount.toFixed(r.unit === 'g' ? 1 : 3)} ${r.unit}`, 'warn'),
    ));
  }

  return panel({
    title: 'Estado del laboratorio',
    actions: [button('Abrir', { size: 'sm', variant: 'ghost', on: { click: () => navigate('laboratorio') } })],
  },
  problems.length === 0
    ? h('div', { class: 'row', style: { gap: 'var(--sp-2)', fontSize: 'var(--fs-xs)', color: 'var(--fg-secondary)' } },
      icon('ok', { size: 15, style: 'color:var(--ok)' }),
      'Todo en orden: instrumentos calibrados y reactivos disponibles.',
    )
    : h('div', { class: 'stack stack--tight' }, ...problems.slice(0, 6)),
  );
}

function competencySummary(): HTMLElement {
  const s = state();
  const weakness = diagnoseWeakness();
  const keys = Object.keys(s.profile.competencies) as Competency[];

  return panel({
    title: 'Competencias',
    actions: [button('Perfil', { size: 'sm', variant: 'ghost', on: { click: () => navigate('perfil') } })],
  },
  h('div', { class: 'stack' },
    h('div', { class: 'competency' },
      ...keys.map((k) => competencyRow(COMPETENCY_LABEL[k], s.profile.competencies[k])),
    ),
    weakness
      ? note('warn', 'Diagnóstico', weakness.message)
      : h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.5' },
        text: 'Las competencias se calculan a partir de lo que resuelves, no del tiempo que pasas: '
          + 'necesitan algo de actividad antes de significar algo.' }),
  ),
  );
}

function recentActivity(): HTMLElement {
  const s = state();
  if (s.activity.length === 0) {
    return panel({ title: 'Actividad reciente' },
      emptyState({
        title: 'Sin actividad todavía',
        text: 'Aquí aparecerán los temas estudiados, los experimentos realizados y los proyectos abiertos.',
        iconName: 'progreso',
      }),
    );
  }
  return panel({ title: 'Actividad reciente' },
    h('div', { class: 'stack stack--tight' },
      ...s.activity.slice(0, 8).map((a) => h('a', {
        href: a.href,
        class: 'row row--between',
        style: { fontSize: 'var(--fs-2xs)', textDecoration: 'none', color: 'var(--fg-secondary)' },
      },
      h('span', { class: 'truncate', text: a.label }),
      h('span', { class: 'dim mono', style: { flexShrink: '0' }, text: relative(a.t) }),
      )),
    ),
  );
}

function relative(t: number): string {
  const delta = (Date.now() - t) / 1000;
  if (delta < 60) return 'ahora';
  return `hace ${fmtDuration(delta)}`;
}

void instrumentById;
