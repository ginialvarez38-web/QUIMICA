/**
 * Universidad (§8–§11).
 *
 * Three views of the same plan: the curricular progression, the knowledge map
 * and the competency view. A course opens onto its unit structure; a topic
 * opens the reader, with the four depths of §11 and the cross-links of §10.
 */

import { h, replace, svg, type Child } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { screen, setContext } from '../ui/shell.js';
import {
  panel, button, badge, note, meter, tabs, emptyState, competencyRow, buttonGroup,
} from '../ui/components.js';
import { href, navigate, route, setParam } from '../ui/router.js';
import { signal, effect } from '../ui/reactive.js';
import { equation, namedEquation, equationById, EQUATIONS } from '../ui/equation.js';
import {
  COURSES, courseById, coursesByTerm, allTopics, courseMinutes, AREA_LABEL,
  AREA_SERIES, dependents, TOTAL_CREDITS, TOTAL_TOPICS,
  type Course, type CourseArea, type Topic,
} from '../content/curriculum.js';
import { CONCEPTS, conceptById, conceptDependents, prerequisiteChain, TIER_LABEL, TIER_ORDER } from '../content/concepts.js';
import {
  state, courseProgress, topicMastery, recordTopicStudy, setContinuePoint,
  pushActivity, COMPETENCY_LABEL, type Competency,
} from '../state/store.js';
import { substanceById } from '../data/substances.js';
import { instrumentById } from '../data/instruments.js';
import { neighbourhood, edgesAmong } from '../domain/search.js';
import { lessonFor, DEPTHS, type Depth } from '../content/lessons.js';

export function universidadScreen(): HTMLElement {
  const r = route();
  const [, second, third] = r.segments;

  if (second === 'concepto' && third) return conceptView(third);
  if (second === 'ecuacion' && third) return equationView(third);
  if (second) {
    const course = courseById(second);
    if (course) return third ? topicView(course, decodeURIComponent(third)) : courseView(course);
  }
  return planView();
}

// ---------------------------------------------------------------------------
// Plan view
// ---------------------------------------------------------------------------

function planView(): HTMLElement {
  setContext([{ label: 'Universidad' }]);
  const view = signal(route().params.get('vista') ?? 'curricular');

  const host = h('div');
  effect(() => {
    const v = view();
    replace(host,
      v === 'conocimiento' ? knowledgeView()
        : v === 'competencias' ? competenciesView()
          : curricularView(),
    );
  });

  const completed = COURSES.filter((c) => courseProgress(allTopics(c).map((t) => t.id)) >= 0.85).length;

  return screen({
    eyebrow: 'Plan académico',
    title: 'Universidad',
    lede: `${COURSES.length} asignaturas, ${TOTAL_CREDITS} créditos y ${TOTAL_TOPICS} temas, `
      + 'organizados por prelación real: ninguna asignatura exige algo que no se haya visto antes.',
  },
  h('div', { class: 'stack' },
    h('div', { class: 'row row--between row--wrap' },
      tabs([
        { id: 'curricular', label: 'Vista curricular' },
        { id: 'conocimiento', label: 'Mapa de conocimiento' },
        { id: 'competencias', label: 'Competencias' },
      ], view, { pills: true }),
      h('div', { class: 'row', style: { gap: 'var(--sp-3)' } },
        badge(`${completed} completadas`, completed > 0 ? 'ok' : 'neutral'),
        badge(`${COURSES.filter((c) => c.elective).length} electivas`, 'neutral'),
      ),
    ),
    host,
  ),
  );
}

function curricularView(): HTMLElement {
  const areaFilter = signal<CourseArea | 'todas'>('todas');
  const host = h('div', { class: 'track' });

  effect(() => {
    const filter = areaFilter();
    const terms = coursesByTerm();
    const blocks: Child[] = [];

    for (const [term, courses] of terms) {
      const visible = filter === 'todas' ? courses : courses.filter((c) => c.area === filter);
      if (visible.length === 0) continue;
      blocks.push(h('div', { class: 'track__term' },
        h('div', { class: 'track__term-label' },
          `Cuatrimestre ${term}`,
          h('div', { class: 'dim', style: { fontWeight: '400', marginTop: '4px' },
            text: `${courses.reduce((s, c) => s + c.credits, 0)} cr` }),
        ),
        h('div', { class: 'track__courses' }, ...visible.map(courseCard)),
      ));
    }
    replace(host, ...blocks);
  });

  const areas = Array.from(new Set(COURSES.map((c) => c.area)));

  return h('div', { class: 'stack stack--loose' },
    h('div', { class: 'row row--wrap', style: { gap: 'var(--sp-2)' } },
      h('button', {
        class: 'chip', type: 'button',
        bindAttrs: () => ({ style: areaFilter() === 'todas' ? 'border-color:var(--accent);color:var(--accent-fg)' : '' }),
        on: { click: () => areaFilter.set('todas') },
      }, 'Todas'),
      ...areas.map((a) => h('button', {
        class: 'chip', type: 'button',
        bindAttrs: () => ({ style: areaFilter() === a ? 'border-color:var(--accent);color:var(--accent-fg)' : '' }),
        on: { click: () => areaFilter.set(a) },
      },
      h('span', { class: 'swatch', style: { background: `var(--series-${AREA_SERIES[a]})` } }),
      AREA_LABEL[a],
      )),
    ),
    host,
  );
}

function courseCard(course: Course): HTMLElement {
  const progress = courseProgress(allTopics(course).map((t) => t.id));
  const unmet = course.prerequisites.filter((p) => {
    const pre = courseById(p);
    return pre ? courseProgress(allTopics(pre).map((t) => t.id)) < 0.6 : false;
  });
  const status = progress >= 0.85 ? 'done' : unmet.length > 0 ? 'locked' : progress > 0 ? 'active' : 'available';

  return h('a', {
    class: 'course',
    href: href(`universidad/${course.id}`),
    dataset: { status },
    style: { textDecoration: 'none', borderLeftColor: `var(--series-${AREA_SERIES[course.area]})` },
    title: unmet.length > 0
      ? `Requiere: ${unmet.map((p) => courseById(p)?.name).join(', ')}`
      : course.description,
  },
  h('div', { class: 'row row--between' },
    h('span', { class: 'course__code', text: course.code }),
    course.elective ? badge('Electiva', 'neutral') : null,
  ),
  h('div', { class: 'course__name', text: course.name }),
  progress > 0 && h('div', { class: 'meter__track' },
    h('div', { class: 'meter__fill', style: { width: `${progress * 100}%` } }),
  ),
  h('div', { class: 'course__meta' },
    status === 'locked' ? icon('bloqueado', { size: 12 }) : null,
    status === 'done' ? icon('completado', { size: 12 }) : null,
    h('span', { text: `${course.credits} cr` }),
    h('span', { text: '·' }),
    h('span', { text: `${allTopics(course).length} temas` }),
    progress > 0 ? h('span', { class: 'spacer' }) : null,
    progress > 0 ? h('span', { class: 'mono', text: `${(progress * 100).toFixed(0)} %` }) : null,
  ),
  );
}

/** The concept graph (§60), drawn from the real dependency data. */
function knowledgeView(): HTMLElement {
  const selected = signal<string>(route().params.get('concepto') ?? 'equilibrio-quimico');
  const graphHost = h('div', { class: 'kgraph' });
  const detailHost = h('div');

  effect(() => {
    const id = selected();
    replace(graphHost, renderGraph(`concepto:${id}`, (nodeId) => {
      const conceptId = nodeId.replace(/^concepto:/, '');
      if (conceptById(conceptId)) { selected.set(conceptId); setParam('concepto', conceptId); }
      else navigate(nodeId.split(':')[0] === 'sustancia' ? `mundo/sustancia/${nodeId.split(':')[1]}` : 'universidad');
    }));
    replace(detailHost, conceptPanel(id));
  });

  return h('div', { class: 'grid grid--sidebar' },
    panel({ title: 'Mapa de conocimiento', subtitle: 'Cada arista es una dependencia real', flush: true },
      graphHost,
      h('div', { class: 'plot__caption' },
        'Las relaciones proceden del grafo de conceptos: un concepto apunta a aquellos que hay que '
        + 'entender antes. Pulsa un nodo para centrarlo.'),
    ),
    h('div', { class: 'stack' },
      panel({ title: 'Conceptos', flush: true },
        h('div', { style: { maxHeight: '320px', overflowY: 'auto', padding: 'var(--sp-2)' } },
          ...TIER_ORDER.flatMap((tier) => [
            h('div', { class: 'omni__group-label', text: TIER_LABEL[tier] }),
            ...CONCEPTS.filter((c) => c.tier === tier).map((c) => h('button', {
              class: 'omni__item', type: 'button',
              bindAttrs: () => ({ 'data-active': String(selected() === c.id) }),
              on: { click: () => { selected.set(c.id); setParam('concepto', c.id); } },
            }, c.name)),
          ]),
        ),
      ),
      detailHost,
    ),
  );
}

function conceptPanel(id: string): HTMLElement {
  const concept = conceptById(id);
  if (!concept) return emptyState({ title: 'Concepto no encontrado' });

  const chain = prerequisiteChain(id);
  const after = conceptDependents(id);
  const teaching = COURSES.filter((c) => allTopics(c).some((t) => t.concepts.includes(id)));

  return panel({ title: concept.name, subtitle: TIER_LABEL[concept.tier] },
    h('div', { class: 'stack' },
      h('p', { class: 'prose', style: { maxWidth: 'none' }, text: concept.short }),
      chain.length > 0 && h('div', {},
        h('div', { class: 'caps dim', style: { marginBottom: 'var(--sp-2)' }, text: 'Requiere antes' }),
        h('div', { class: 'xlinks' },
          ...chain.slice(-6).map((c) => h('a', {
            class: 'xlink', href: href('universidad', { vista: 'conocimiento', concepto: c.id }),
            text: c.name,
          })),
        ),
      ),
      after.length > 0 && h('div', {},
        h('div', { class: 'caps dim', style: { marginBottom: 'var(--sp-2)' }, text: 'Abre el paso a' }),
        h('div', { class: 'xlinks' },
          ...after.slice(0, 8).map((c) => h('a', {
            class: 'xlink', href: href('universidad', { vista: 'conocimiento', concepto: c.id }),
            text: c.name,
          })),
        ),
      ),
      teaching.length > 0 && h('div', {},
        h('div', { class: 'caps dim', style: { marginBottom: 'var(--sp-2)' }, text: 'Se enseña en' }),
        h('div', { class: 'xlinks' },
          ...teaching.map((c) => h('a', { class: 'xlink', href: href(`universidad/${c.id}`), text: c.name })),
        ),
      ),
      concept.equations && concept.equations.length > 0 && h('div', {},
        h('div', { class: 'caps dim', style: { marginBottom: 'var(--sp-2)' }, text: 'Ecuación' }),
        namedEquation(concept.equations[0], { display: true }),
      ),
      concept.substances && concept.substances.length > 0 && h('div', {},
        h('div', { class: 'caps dim', style: { marginBottom: 'var(--sp-2)' }, text: 'Sustancias implicadas' }),
        h('div', { class: 'xlinks' },
          ...concept.substances.map((sid) => {
            const sub = substanceById(sid);
            return sub ? h('a', { class: 'xlink', href: href(`mundo/sustancia/${sid}`), text: sub.name }) : null;
          }),
        ),
      ),
    ),
  );
}

/** Force-free radial graph layout — deterministic, so the map is stable. */
function renderGraph(originId: string, onSelect: (id: string) => void): SVGSVGElement {
  const nodes = neighbourhood(originId, 2, 26);
  const edges = edgesAmong(nodes);
  const width = 560;
  const height = 380;

  const positions = new Map<string, { x: number; y: number }>();
  const byDepth = new Map<number, typeof nodes>();
  for (const n of nodes) {
    const list = byDepth.get(n.depth) ?? [];
    list.push(n);
    byDepth.set(n.depth, list);
  }
  for (const [depth, list] of byDepth) {
    const radius = depth * (Math.min(width, height) * 0.29);
    list.forEach((n, i) => {
      if (depth === 0) { positions.set(n.entity.id, { x: width / 2, y: height / 2 }); return; }
      const angle = (i / list.length) * Math.PI * 2 - Math.PI / 2 + depth * 0.4;
      positions.set(n.entity.id, {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius * 0.82,
      });
    });
  }

  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height,
    role: 'img', 'aria-label': `Mapa de ${nodes[0]?.entity.title ?? ''} con ${nodes.length} conceptos relacionados` });

  for (const [a, b] of edges) {
    const pa = positions.get(a);
    const pb = positions.get(b);
    if (!pa || !pb) continue;
    root.appendChild(svg('line', {
      x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y,
      class: a === originId || b === originId ? 'kg-edge kg-edge--hi' : 'kg-edge',
    }));
  }

  for (const n of nodes) {
    const p = positions.get(n.entity.id)!;
    const r = n.depth === 0 ? 15 : n.depth === 1 ? 10 : 7;
    const g = svg('g', { class: 'kg-node', tabindex: '0', role: 'button',
      'aria-label': n.entity.title });
    g.appendChild(svg('circle', {
      cx: p.x, cy: p.y, r,
      fill: n.depth === 0 ? 'var(--accent)' : `var(--series-${((n.depth + n.entity.title.length) % 8) + 1})`,
      opacity: n.depth === 0 ? 1 : 0.85,
    }));
    const label = n.entity.title.length > 22 ? `${n.entity.title.slice(0, 20)}…` : n.entity.title;
    g.appendChild(svg('text', { x: p.x, y: p.y + r + 12 }, label));
    g.addEventListener('click', () => onSelect(n.entity.id));
    g.addEventListener('keydown', (ev) => {
      if ((ev as KeyboardEvent).key === 'Enter') onSelect(n.entity.id);
    });
    root.appendChild(g);
  }
  return root;
}

function competenciesView(): HTMLElement {
  const s = state();
  const keys = Object.keys(s.profile.competencies) as Competency[];

  // Which concepts feed each competency, and how far the student has come.
  const byCompetency = new Map<Competency, { total: number; mastered: number }>();
  for (const concept of CONCEPTS) {
    const key = (concept.competency ?? 'quimica') as Competency;
    const entry = byCompetency.get(key) ?? { total: 0, mastered: 0 };
    entry.total++;
    const topics = COURSES.flatMap((c) => allTopics(c)).filter((t) => t.concepts.includes(concept.id));
    if (topics.length > 0 && topics.some((t) => topicMastery(t.id) >= 0.6)) entry.mastered++;
    byCompetency.set(key, entry);
  }

  return h('div', { class: 'grid grid--sidebar' },
    panel({ title: 'Competencias por concepto', subtitle: 'Qué dominas, medido sobre el grafo' },
      h('div', { class: 'stack' },
        ...keys.map((k) => {
          const e = byCompetency.get(k) ?? { total: 0, mastered: 0 };
          return h('div', { class: 'stack stack--tight' },
            competencyRow(COMPETENCY_LABEL[k], s.profile.competencies[k]),
            h('div', { class: 'dim', style: { fontSize: 'var(--fs-3xs)', paddingLeft: '128px' },
              text: `${e.mastered} de ${e.total} conceptos con dominio suficiente` }),
          );
        }),
      ),
    ),
    panel({ title: 'Cómo se mide' },
      h('div', { class: 'prose', style: { fontSize: 'var(--fs-xs)' } },
        h('p', {}, 'El dominio de un tema sube cuando resuelves, no cuando lees, y sube menos si has '
          + 'usado pistas. Un tema resuelto con la tercera pista aporta cerca de un tercio de lo que '
          + 'aporta resuelto sin ninguna.'),
        h('p', {}, 'Cada concepto se adscribe a la competencia que principalmente construye, de modo '
          + 'que el perfil refleja qué sabes hacer y no cuánto tiempo has pasado.'),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Course view
// ---------------------------------------------------------------------------

function courseView(course: Course): HTMLElement {
  setContext([
    { label: 'Universidad', href: href('universidad') },
    { label: course.name },
  ]);

  const topics = allTopics(course);
  const progress = courseProgress(topics.map((t) => t.id));
  const unmet = course.prerequisites
    .map((p) => courseById(p))
    .filter((c): c is Course => Boolean(c))
    .filter((c) => courseProgress(allTopics(c).map((t) => t.id)) < 0.6);

  return screen({
    eyebrow: `${course.code} · ${AREA_LABEL[course.area]} · Cuatrimestre ${course.term}`,
    title: course.name,
    lede: course.description,
    actions: [
      badge(`${course.credits} créditos`, 'neutral'),
      course.elective ? badge('Electiva', 'accent') : null,
    ].filter(Boolean) as Child[],
  },
  h('div', { class: 'stack stack--loose' },
    unmet.length > 0 && note('warn', 'Prerrequisitos pendientes',
      h('div', {},
        'Esta asignatura da por sabido el contenido de: ',
        ...unmet.flatMap((c, i) => [
          i > 0 ? ', ' : '',
          h('a', { href: href(`universidad/${c.id}`), text: c.name }),
        ]),
        '. Puedes seguir adelante, pero encontrarás huecos.',
      ),
    ),

    h('div', { class: 'grid grid--sidebar' },
      h('div', { class: 'stack' },
        panel({ title: 'Objetivos' },
          h('ol', { class: 'prose', style: { maxWidth: 'none' } },
            ...course.objectives.map((o) => h('li', { text: o })),
          ),
        ),
        ...course.units.map((unit) => panel({
          title: unit.title,
          subtitle: unit.summary,
        },
        h('div', { class: 'stack' },
          ...unit.chapters.map((chapter) => h('div', { class: 'stack stack--tight' },
            h('div', { class: 'caps dim', text: chapter.title }),
            h('div', { class: 'stack stack--tight' },
              ...chapter.topics.map((topic) => topicRow(course, topic)),
            ),
          )),
        ),
        )),
      ),
      h('div', { class: 'stack' },
        panel({ title: 'Progreso' },
          h('div', { class: 'stack' },
            meter({
              label: 'Temas dominados', value: progress,
              caption: `${topics.filter((t) => topicMastery(t.id) >= 0.6).length} de ${topics.length}`,
              tone: progress >= 0.85 ? 'ok' : undefined,
            }),
            h('dl', { class: 'props' },
              h('dt', { text: 'Temas' }), h('dd', { text: String(topics.length) }),
              h('dt', { text: 'Estudio' }), h('dd', { text: `${Math.round(courseMinutes(course) / 60)} h` }),
              h('dt', { text: 'Créditos' }), h('dd', { text: String(course.credits) }),
            ),
          ),
        ),
        course.prerequisites.length > 0 && panel({ title: 'Requiere' },
          h('div', { class: 'xlinks' },
            ...course.prerequisites.map((p) => {
              const pre = courseById(p);
              return pre ? h('a', { class: 'xlink', href: href(`universidad/${p}`), text: pre.name }) : null;
            }),
          ),
        ),
        dependents(course.id).length > 0 && panel({ title: 'Habilita' },
          h('div', { class: 'xlinks' },
            ...dependents(course.id).map((c) =>
              h('a', { class: 'xlink', href: href(`universidad/${c.id}`), text: c.name })),
          ),
        ),
        course.substances && course.substances.length > 0 && panel({ title: 'Sustancias' },
          h('div', { class: 'xlinks' },
            ...course.substances.map((sid) => {
              const sub = substanceById(sid);
              return sub ? h('a', { class: 'xlink', href: href(`mundo/sustancia/${sid}`), text: sub.name }) : null;
            }),
          ),
        ),
        course.instruments && course.instruments.length > 0 && panel({ title: 'Instrumentos' },
          h('div', { class: 'xlinks' },
            ...course.instruments.map((iid) => {
              const inst = instrumentById(iid);
              return inst ? h('a', { class: 'xlink', href: href(`laboratorio/instrumento/${iid}`), text: inst.name }) : null;
            }),
          ),
        ),
        course.project && panel({ title: 'Proyecto de la asignatura' },
          h('p', { class: 'prose', style: { fontSize: 'var(--fs-xs)', maxWidth: 'none' }, text: course.project }),
        ),
      ),
    ),
  ),
  );
}

function topicRow(course: Course, topic: Topic): HTMLElement {
  const mastery = topicMastery(topic.id);
  return h('a', {
    class: 'row row--between',
    href: href(`universidad/${course.id}/${encodeURIComponent(topic.id)}`),
    style: {
      textDecoration: 'none', padding: 'var(--sp-2) var(--sp-3)',
      border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-sm)',
      fontSize: 'var(--fs-xs)', color: 'var(--fg-secondary)',
    },
  },
  h('span', { class: 'row', style: { gap: 'var(--sp-2)', minWidth: '0' } },
    mastery >= 0.6 ? icon('completado', { size: 13, style: 'color:var(--ok);flex:0 0 auto' }) : null,
    h('span', { class: 'truncate', text: topic.title }),
    topic.simulation ? badge('Simulación', 'accent') : null,
    topic.lab ? badge('Práctica', 'info') : null,
  ),
  h('span', { class: 'row', style: { gap: 'var(--sp-3)', flexShrink: '0' } },
    mastery > 0 ? h('span', { class: 'mono dim', style: { fontSize: 'var(--fs-3xs)' }, text: `${(mastery * 100).toFixed(0)}%` }) : null,
    h('span', { class: 'dim mono', style: { fontSize: 'var(--fs-3xs)' }, text: `${topic.minutes} min` }),
  ),
  );
}

// ---------------------------------------------------------------------------
// Topic reader (§11)
// ---------------------------------------------------------------------------

function topicView(course: Course, topicId: string): HTMLElement {
  const located = course.units.flatMap((u) =>
    u.chapters.flatMap((c) => c.topics.map((t) => ({ unit: u, chapter: c, topic: t }))))
    .find((e) => e.topic.id === topicId);

  if (!located) {
    setContext([
      { label: 'Universidad', href: href('universidad') },
      { label: course.name, href: href(`universidad/${course.id}`) },
      { label: 'Tema no encontrado' },
    ]);
    return screen({ title: 'Tema no encontrado' },
      emptyState({
        title: 'Ese tema no existe en esta asignatura',
        text: 'Es posible que el enlace esté desactualizado.',
        action: button('Volver a la asignatura', { on: { click: () => navigate(`universidad/${course.id}`) } }),
      }),
    );
  }

  const { unit, topic } = located;
  setContext([
    { label: 'Universidad', href: href('universidad') },
    { label: course.name, href: href(`universidad/${course.id}`) },
    { label: topic.title },
  ]);

  setContinuePoint(course.id, topic.id, `${unit.title} · ${topic.title}`);

  const depth = signal<Depth>((route().params.get('nivel') as Depth) ?? 'universitario');
  const body = h('div', { class: 'stack stack--loose' });

  effect(() => {
    const d = depth();
    const lesson = lessonFor(topic, course, d);
    replace(body,
      h('div', { class: 'prose' }, ...lesson.blocks),
      lesson.equations.length > 0 && panel({ title: 'Ecuaciones del tema' },
        h('div', { class: 'stack' },
          ...lesson.equations.map((id) => {
            const e = equationById(id);
            return e ? h('div', {},
              h('div', { class: 'caps dim', style: { marginBottom: 'var(--sp-2)' }, text: e.name }),
              namedEquation(id, { display: true }),
              h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.5' }, text: e.context }),
            ) : null;
          }),
        ),
      ),
      topic.concepts.length > 0 && panel({ title: 'Conexiones', subtitle: 'Con qué otras materias se relaciona este tema' },
        h('div', { class: 'stack stack--tight' },
          ...topic.concepts.map((cid) => {
            const concept = conceptById(cid);
            if (!concept) return null;
            const elsewhere = COURSES.filter((c) =>
              c.id !== course.id && allTopics(c).some((t) => t.concepts.includes(cid)));
            return h('div', { class: 'stack stack--tight' },
              h('div', { class: 'row', style: { gap: 'var(--sp-2)' } },
                h('a', { href: href('universidad', { vista: 'conocimiento', concepto: cid }),
                  style: { fontWeight: '600', fontSize: 'var(--fs-xs)' }, text: concept.name }),
                badge(TIER_LABEL[concept.tier], 'neutral'),
              ),
              h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)' }, text: concept.short }),
              elsewhere.length > 0 && h('div', { class: 'xlinks' },
                ...elsewhere.slice(0, 5).map((c) =>
                  h('a', { class: 'xlink', href: href(`universidad/${c.id}`), text: c.name })),
              ),
            );
          }),
        ),
      ),
    );
  });

  const markStudied = (): void => {
    const competencies: Partial<Record<Competency, number>> = {};
    for (const cid of topic.concepts) {
      const concept = conceptById(cid);
      if (concept?.competency) {
        competencies[concept.competency] = (competencies[concept.competency] ?? 0) + 0.08;
      }
    }
    recordTopicStudy(topic.id, { minutes: topic.minutes, competencies });
    pushActivity('tema', `${topic.title} — ${course.name}`,
      href(`universidad/${course.id}/${encodeURIComponent(topic.id)}`));
  };

  return screen({
    eyebrow: `${course.code} · ${unit.title}`,
    title: topic.title,
    actions: [
      button('Marcar como estudiado', {
        variant: 'primary', iconName: 'completado',
        on: { click: markStudied },
      }),
    ],
  },
  h('div', { class: 'reader' },
    h('nav', { class: 'reader__toc', 'aria-label': 'Profundidad' },
      h('div', { class: 'caps dim', style: { padding: '0 var(--sp-3) var(--sp-2)' }, text: 'Profundidad' }),
      ...DEPTHS.map((d) => {
        const btn = h('button', { class: 'reader__toc-item', type: 'button',
          on: { click: () => { depth.set(d.id); setParam('nivel', d.id); } } },
        h('div', { text: d.label }),
        h('div', { class: 'dim', style: { fontSize: 'var(--fs-3xs)', marginTop: '2px' }, text: d.description }),
        );
        effect(() => btn.setAttribute('aria-current', String(depth() === d.id)));
        return btn;
      }),
      h('div', { class: 'divider' }),
      h('div', { class: 'caps dim', style: { padding: '0 var(--sp-3) var(--sp-2)' }, text: 'Dominio' }),
      h('div', { style: { padding: '0 var(--sp-3)' } },
        meter({ label: 'Este tema', value: topicMastery(topic.id) }),
      ),
      topic.simulation && h('div', { style: { padding: 'var(--sp-3)' } },
        button('Abrir simulación', { block: true, size: 'sm', iconName: 'reproducir',
          on: { click: () => navigate('laboratorio', { params: { sim: topic.simulation } }) } }),
      ),
      topic.lab && h('div', { style: { padding: '0 var(--sp-3) var(--sp-3)' } },
        button('Ir a la práctica', { block: true, size: 'sm', iconName: 'laboratorio',
          on: { click: () => navigate('laboratorio') } }),
      ),
    ),
    h('article', {}, body),
  ),
  );
}

// ---------------------------------------------------------------------------
// Equation view
// ---------------------------------------------------------------------------

function equationView(id: string): HTMLElement {
  const e = equationById(id);
  if (!e) {
    setContext([{ label: 'Universidad', href: href('universidad') }, { label: 'Ecuación' }]);
    return screen({ title: 'Ecuación no encontrada' }, emptyState({ title: 'No existe esa ecuación' }));
  }

  setContext([
    { label: 'Universidad', href: href('universidad') },
    { label: 'Ecuaciones', href: href('universidad') },
    { label: e.name },
  ]);

  return screen({ eyebrow: 'Ecuación', title: e.name, lede: e.context },
    h('div', { class: 'grid grid--sidebar' },
      h('div', { class: 'stack' },
        panel({ title: 'Expresión' },
          h('div', {},
            equation(e.tex, { display: true, variables: e.variables, label: e.name }),
            h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', marginTop: 'var(--sp-3)' },
              text: 'Pulsa cualquier símbolo para ver qué representa, en qué unidades y qué valor toma.' }),
          ),
        ),
        panel({ title: 'Variables' },
          h('div', { class: 'table-wrap' },
            h('table', { class: 'table' },
              h('thead', {}, h('tr', {},
                h('th', { text: 'Símbolo' }), h('th', { text: 'Magnitud' }),
                h('th', { text: 'Unidad' }), h('th', { text: 'Nota' }),
              )),
              h('tbody', {}, ...e.variables.map((v) => h('tr', {},
                h('td', {}, h('i', { class: 'eq', text: v.symbol })),
                h('td', { text: v.name }),
                h('td', { class: 'mono', text: v.unit ?? '—' }),
                h('td', { class: 'dim', style: { fontSize: 'var(--fs-2xs)' }, text: v.description ?? '' }),
              ))),
            ),
          ),
        ),
      ),
      h('div', { class: 'stack' },
        panel({ title: 'Se usa en' },
          h('div', { class: 'xlinks' },
            ...e.courses.map((cid) => {
              const c = courseById(cid);
              return c ? h('a', { class: 'xlink', href: href(`universidad/${cid}`), text: c.name }) : null;
            }),
          ),
        ),
        panel({ title: 'Otras ecuaciones' },
          h('div', { class: 'stack stack--tight' },
            ...EQUATIONS.filter((x) => x.id !== id).map((x) =>
              h('a', { href: href(`universidad/ecuacion/${x.id}`),
                style: { fontSize: 'var(--fs-xs)' }, text: x.name })),
          ),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------

function conceptView(id: string): HTMLElement {
  const concept = conceptById(id);
  setContext([
    { label: 'Universidad', href: href('universidad') },
    { label: 'Conceptos', href: href('universidad', { vista: 'conocimiento' }) },
    { label: concept?.name ?? 'Concepto' },
  ]);
  if (!concept) return screen({ title: 'Concepto no encontrado' }, emptyState({ title: 'No existe ese concepto' }));

  return screen({ eyebrow: TIER_LABEL[concept.tier], title: concept.name, lede: concept.short },
    h('div', { class: 'grid grid--sidebar' },
      panel({ title: 'Mapa', flush: true },
        h('div', { class: 'kgraph' },
          renderGraph(`concepto:${id}`, (nid) => {
            const cid = nid.replace(/^concepto:/, '');
            if (conceptById(cid)) navigate(`universidad/concepto/${cid}`);
          }),
        ),
      ),
      conceptPanel(id),
    ),
  );
}

void buttonGroup;
