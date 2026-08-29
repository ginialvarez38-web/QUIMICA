/**
 * Perfil (§59, §68).
 *
 * Competencies rather than experience points, with the diagnostic sentence
 * that names the actual difficulty. Also the settings that change how the whole
 * platform behaves: realism mode, activity model, experimental error, theme and
 * examination mode.
 */

import { h, replace, type Child } from '../ui/dom.js';
import { screen, setContext } from '../ui/shell.js';
import {
  panel, button, badge, note, props, competencyRow, meter, toast, download, emptyState,
} from '../ui/components.js';
import { href, navigate } from '../ui/router.js';
import { signal, effect } from '../ui/reactive.js';
import { plot } from '../ui/plot.js';
import { fmtDuration } from '../core/format.js';
import {
  state, update, diagnoseWeakness, exportState, importState, resetState,
  setTheme, COMPETENCY_LABEL, REALISM_LABEL, REALISM_DESCRIPTION,
  courseProgress, topicMastery,
  type Competency, type RealismMode, type Theme,
} from '../state/store.js';
import { ACTIVITY_MODEL_LABEL, ACTIVITY_MODEL_LIMIT, type ActivityModel } from '../core/chem/activity.js';
import { COURSES, allTopics, TOTAL_TOPICS } from '../content/curriculum.js';
import { CONCEPTS } from '../content/concepts.js';
import { SUBSTANCES } from '../data/substances.js';
import { MOLECULES } from '../data/molecules.js';
import { INSTRUMENTS } from '../data/instruments.js';
import { authoredTopicCount } from '../content/lessons.js';

export function perfilScreen(): HTMLElement {
  setContext([{ label: 'Perfil' }]);
  const s = state();
  const weakness = diagnoseWeakness();
  const keys = Object.keys(s.profile.competencies) as Competency[];

  const studied = Object.values(s.topics).filter((t) => t.mastery >= 0.6).length;
  const startedCourses = COURSES.filter((c) => courseProgress(allTopics(c).map((t) => t.id)) > 0.001);
  const hintsUsed = Object.values(s.topics).reduce((sum, t) => sum + t.hintsUsed.length, 0);
  const attempted = Object.values(s.topics).reduce((sum, t) => sum + t.attempted, 0);
  const solved = Object.values(s.topics).reduce((sum, t) => sum + t.solved, 0);

  return screen({
    eyebrow: 'Perfil científico',
    title: s.profile.name,
    lede: 'El progreso se mide por lo que sabes hacer, no por el tiempo acumulado.',
  },
  h('div', { class: 'stack stack--loose' },
    h('div', { class: 'grid grid--sidebar' },
      h('div', { class: 'stack' },
        panel({ title: 'Competencias' },
          h('div', { class: 'stack' },
            h('div', { class: 'competency' },
              ...keys.map((k) => competencyRow(COMPETENCY_LABEL[k], s.profile.competencies[k])),
            ),
            weakness
              ? note('warn', 'Diagnóstico', weakness.message)
              : note('info', null,
                'Todavía no hay evidencia suficiente para un diagnóstico. Resuelve problemas y '
                + 'completa prácticas: el perfil se construye con lo que haces, no con lo que abres.'),
          ),
        ),

        panel({ title: 'Evolución del dominio por área' },
          (() => {
            const areas = Array.from(new Set(COURSES.map((c) => c.area)));
            const values = areas.map((a) => {
              const courses = COURSES.filter((c) => c.area === a);
              const topics = courses.flatMap((c) => allTopics(c));
              return topics.length === 0 ? 0
                : topics.reduce((sum, t) => sum + topicMastery(t.id), 0) / topics.length;
            });
            return plot({
              series: [{
                id: 'area', label: 'Dominio medio',
                x: areas.map((_, i) => i),
                y: values.map((v) => v * 100),
                kind: 'sticks', colour: 1, width: 20,
              }],
              x: {
                label: 'Área', ticks: areas.map((_, i) => i),
                format: (v) => (areas[Math.round(v)] ?? '').slice(0, 12),
              },
              y: { label: 'Dominio medio', unit: '%', domain: [0, 100] },
              height: 240, legend: false,
              caption: 'Media del dominio de todos los temas de cada área. Las áreas vacías son las que '
                + 'todavía no has empezado, no las que dominas mal.',
            });
          })(),
        ),

        panel({ title: 'Uso de pistas', subtitle: 'Registrado para análisis pedagógico (§58)' },
          hintsUsed === 0
            ? h('p', { class: 'dim', style: { fontSize: 'var(--fs-xs)' },
              text: 'Todavía no has usado ninguna pista.' })
            : h('div', { class: 'stack stack--tight' },
              props([
                ['Pistas usadas', String(hintsUsed)],
                ['Problemas intentados', String(attempted)],
                ['Resueltos', String(solved)],
                ['Tasa de acierto', attempted > 0 ? `${((solved / attempted) * 100).toFixed(0)} %` : '—'],
              ]),
              h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.6' },
                text: 'El uso de pistas no se penaliza en la calificación, pero sí reduce lo que el '
                  + 'problema aporta a tu dominio del tema: un ejercicio resuelto con la tercera pista '
                  + 'enseña menos que uno resuelto sin ninguna, y el perfil lo refleja.' }),
            ),
        ),
      ),

      h('div', { class: 'stack' },
        panel({ title: 'Resumen' },
          props([
            ['Temas dominados', `${studied} de ${TOTAL_TOPICS}`],
            ['Asignaturas iniciadas', String(startedCourses.length)],
            ['Tiempo de estudio', fmtDuration(s.profile.studyMinutes * 60)],
            ['Racha', `${s.profile.streak} día${s.profile.streak === 1 ? '' : 's'}`],
            ['Experimentos', String(s.experiments.length)],
            ['Proyectos', String(s.projects.length)],
          ]),
        ),
        settingsPanel(),
        dataPanel(),
        aboutPanel(),
      ),
    ),
  ),
  );
}

// ---------------------------------------------------------------------------

function settingsPanel(): HTMLElement {
  const host = h('div', { class: 'stack' });

  effect(() => {
    const s = state();
    const realismModes: RealismMode[] = ['educativo', 'universitario', 'profesional'];
    const themes: Array<{ id: Theme; label: string }> = [
      { id: 'system', label: 'Del sistema' },
      { id: 'light', label: 'Claro' },
      { id: 'dark', label: 'Oscuro' },
    ];
    const activityModels: ActivityModel[] = ['ideal', 'debye-huckel', 'extended-dh', 'davies'];

    replace(host,
      h('div', { class: 'stack stack--tight' },
        h('div', { class: 'caps dim', text: 'Modo de realismo (§65)' }),
        h('div', { class: 'stack stack--tight' },
          ...realismModes.map((m) => {
            const btn = button(REALISM_LABEL[m], {
              size: 'sm', block: true,
              on: { click: () => update((st) => { st.settings.realism = m; }) },
            });
            btn.setAttribute('aria-pressed', String(s.settings.realism === m));
            return btn;
          }),
        ),
        h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.6' },
          text: REALISM_DESCRIPTION[s.settings.realism] }),
      ),

      h('div', { class: 'divider' }),

      h('div', { class: 'stack stack--tight' },
        h('div', { class: 'caps dim', text: 'Modelo de actividad' }),
        (() => {
          const sel = h('select', {
            class: 'select',
            on: {
              change: (ev) => update((st) => {
                st.settings.activityModel = (ev.target as HTMLSelectElement).value as ActivityModel;
              }),
            },
          }, ...activityModels.map((m) => h('option', {
            value: m, text: ACTIVITY_MODEL_LABEL[m],
            selected: m === s.settings.activityModel ? '' : undefined,
          })));
          return sel;
        })(),
        h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.6' },
          text: s.settings.activityModel === 'ideal'
            ? 'Sin corrección de actividad: el pH calculado coincidirá con el pcH, y ambos diferirán '
              + 'de lo que mediría un electrodo real en cuanto la fuerza iónica sea apreciable.'
            : `Válido hasta I ≈ ${ACTIVITY_MODEL_LIMIT[s.settings.activityModel]} mol·L⁻¹. `
              + 'Por encima de ese valor la plataforma avisará de que el modelo está fuera de rango.' }),
      ),

      h('div', { class: 'divider' }),

      h('div', { class: 'stack stack--tight' },
        h('div', { class: 'caps dim', text: 'Tema' }),
        h('div', { class: 'btn-group' },
          ...themes.map((t) => {
            const btn = button(t.label, { size: 'sm', on: { click: () => setTheme(t.id) } });
            btn.setAttribute('aria-pressed', String(s.settings.theme === t.id));
            return btn;
          }),
        ),
      ),

      h('div', { class: 'divider' }),

      toggle('Error experimental', s.settings.experimentalError,
        'Cuando está activo, los instrumentos nunca devuelven datos ideales (§33). Desactivarlo '
        + 'equivale al modo educativo para todas las medidas.',
        (v) => update((st) => { st.settings.experimentalError = v; })),

      toggle('Modo examen', s.settings.examMode,
        'El tutor deja de resolver problemas y se limita a preguntar. Las pistas quedan bloqueadas (§57).',
        (v) => update((st) => { st.settings.examMode = v; })),

      toggle('Reducir movimiento', s.settings.reduceMotion,
        'Suprime las animaciones no informativas.',
        (v) => update((st) => { st.settings.reduceMotion = v; })),
    );
  });

  return panel({ title: 'Ajustes' }, host);
}

function toggle(label: string, value: boolean, hint: string, onChange: (v: boolean) => void): HTMLElement {
  const cb = h('input', { type: 'checkbox', on: { change: (ev) => onChange((ev.target as HTMLInputElement).checked) } });
  cb.checked = value;
  return h('div', { class: 'stack stack--tight' },
    h('label', { class: 'switch' },
      cb, h('span', { class: 'switch__track' }), h('span', { class: 'switch__label', text: label }),
    ),
    h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.6' }, text: hint }),
  );
}

function dataPanel(): HTMLElement {
  const fileInput = h('input', {
    type: 'file', accept: 'application/json', style: { display: 'none' },
    on: {
      change: (ev) => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (!file) return;
        file.text().then((text) => {
          const result = importState(text);
          toast(result.ok
            ? { tone: 'ok', title: 'Estado importado', body: 'El mundo se ha restaurado desde el archivo.' }
            : { tone: 'danger', title: 'No se pudo importar', body: result.error ?? '' });
          if (result.ok) navigate('inicio');
        });
      },
    },
  });

  return panel({ title: 'Tus datos' },
    h('div', { class: 'stack' },
      h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.6' },
        text: 'Todo el estado —progreso, calibraciones, reactivos consumidos, experimentos y '
          + 'proyectos— se guarda en este navegador. No sale de tu equipo.' }),
      h('div', { class: 'row row--wrap' },
        button('Exportar', {
          size: 'sm', iconName: 'exportar',
          on: {
            click: () => {
              download('chemia-estado.json', exportState(), 'application/json');
              toast({ tone: 'ok', title: 'Estado exportado', body: 'chemia-estado.json' });
            },
          },
        }),
        button('Importar', {
          size: 'sm', iconName: 'copiar',
          on: { click: () => fileInput.click() },
        }),
        button('Reiniciar todo', {
          size: 'sm', variant: 'danger', iconName: 'residuo',
          on: {
            click: () => {
              if (confirm('Se borrará todo el progreso, el laboratorio y los proyectos. ¿Continuar?')) {
                resetState();
                toast({ tone: 'warn', title: 'Estado reiniciado', body: 'Se ha vuelto al estado inicial.' });
                navigate('inicio');
              }
            },
          },
        }),
      ),
      fileInput,
    ),
  );
}

/**
 * An honest account of what is built and what is not.
 *
 * §81 forbids passing a demonstration off as a finished product. The inverse
 * obligation is to say plainly which parts are complete, which are scaffolded
 * and which are pending — so nobody mistakes structure for content.
 */
function aboutPanel(): HTMLElement {
  const authored = authoredTopicCount();
  return panel({ title: 'Estado de desarrollo' },
    h('div', { class: 'stack stack--tight' },
      h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.6' },
        text: 'CHEMIA declara lo que tiene implementado y lo que no, en lugar de simularlo.' }),
      props([
        ['Elementos', '118'],
        ['Sustancias', String(SUBSTANCES.length)],
        ['Moléculas en 3D', String(MOLECULES.length)],
        ['Instrumentos', String(INSTRUMENTS.length)],
        ['Conceptos en el grafo', String(CONCEPTS.length)],
        ['Temas del plan', String(TOTAL_TOPICS)],
        ['Temas con lección redactada', String(authored)],
      ]),
      h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.6' },
        text: 'Los motores científicos están completos y contrastados contra valores de la '
          + 'literatura. Las bases de sustancias y moléculas son extensibles: cubren lo que las '
          + 'simulaciones usan, no el catálogo entero de la química.' }),
      note('info', null,
        'La estructura del plan está completa: las 41 asignaturas con sus unidades, capítulos y temas. '
        + `El desarrollo redactado cubre ${authored} temas; el resto se compone a partir del grafo de `
        + 'conceptos, con definiciones y relaciones reales, y lo indica explícitamente. Ningún tema '
        + 'muestra texto de relleno haciéndose pasar por contenido.'),

      h('div', { class: 'stack stack--tight', style: { marginTop: 'var(--sp-4)' } },
        h('div', { class: 'caps dim', text: 'Con motor, sin banco propio todavía' }),
        h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.6' },
          text: 'Espectroscopía y cromatografía. Los perfiles de pico, la corrección de línea base, '
            + 'el suavizado, la detección de picos y la resolución están implementados y probados, y '
            + 'las fichas de los instrumentos son reales, pero aún no existe la pantalla instrumental '
            + 'que los conduzca de principio a fin.' }),

        h('div', { class: 'caps dim', style: { marginTop: 'var(--sp-3)' }, text: 'No construido' }),
        h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.6' },
          text: 'El laboratorio 3D transitable con manipulación directa de material de vidrio, y el '
            + 'tutor conversacional. No hay andamiaje de ninguno de los dos: no aparecen en la '
            + 'interfaz como botón inerte ni como panel vacío. El banco actual es una estación de '
            + 'instrumentos y simulaciones, no una sala recorrible.' }),
      ),
    ),
  );
}

void badge; void meter; void emptyState; void href;
