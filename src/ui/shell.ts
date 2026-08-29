/**
 * The application shell.
 *
 * The eight sections of §4, with the elegant sidebar on desktop, a collapsed
 * icon rail on tablet and an independently-authored bottom navigation on
 * mobile — not a shrunken desktop layout.
 */

import { h, replace, type Child } from './dom.js';
import { icon, type IconName } from './icons.js';
import { effect, signal } from './reactive.js';
import { route, navigate, href, currentSection } from './router.js';
import { button } from './components.js';
import { state, update, cycleTheme, applyTheme } from '../state/store.js';
import { openSearch } from './omnisearch.js';

export interface Section {
  id: string;
  label: string;
  /** Shorter label for the mobile bottom bar, where five items share the width. */
  shortLabel?: string;
  iconName: IconName;
  description: string;
  /** Shown in the mobile bottom bar (only the first five fit). */
  primary: boolean;
}

export const SECTIONS: Section[] = [
  { id: 'inicio', label: 'Inicio', iconName: 'inicio', description: 'Continuar donde lo dejaste', primary: true },
  { id: 'universidad', label: 'Universidad', shortLabel: 'Univ.', iconName: 'universidad', description: 'Plan académico, teoría y problemas', primary: true },
  { id: 'laboratorio', label: 'Laboratorio', shortLabel: 'Lab.', iconName: 'laboratorio', description: 'Experimentos, instrumentos y calibración', primary: true },
  { id: 'mundo', label: 'Mundo químico', shortLabel: 'Mundo', iconName: 'mundo', description: 'Elementos, sustancias y moléculas', primary: true },
  { id: 'industria', label: 'Industria', iconName: 'industria', description: 'Procesos, control y escalado', primary: false },
  { id: 'datos', label: 'Datos', iconName: 'datos', description: 'Análisis, regresión y quimiometría', primary: false },
  { id: 'investigacion', label: 'Investigación', iconName: 'investigacion', description: 'Proyectos abiertos y método científico', primary: false },
  { id: 'perfil', label: 'Perfil', iconName: 'perfil', description: 'Competencias, progreso y ajustes', primary: true },
];

export const sectionById = (id: string): Section | undefined => SECTIONS.find((s) => s.id === id);

/** Breadcrumb trail, set by each screen so the top bar answers "where am I?" (§75). */
export const breadcrumbs = signal<Array<{ label: string; href?: string }>>([]);
/** Actions the current screen contributes to the top bar. */
export const topbarActions = signal<Child[]>([]);

const mobileSheetOpen = signal(false);

export function buildShell(): { root: HTMLElement; screenHost: HTMLElement } {
  const screenHost = h('main', { class: 'screen', id: 'contenido', tabindex: '-1' });

  const nav = h('nav', { class: 'nav', 'aria-label': 'Navegación principal' },
    h('div', { class: 'nav__brand' },
      h('a', { href: '#/inicio', class: 'row', style: { gap: 'var(--sp-3)', textDecoration: 'none' } },
        markLogo(),
        h('span', { class: 'nav__wordmark', text: 'CHEMIA' }),
      ),
    ),
    h('div', { class: 'nav__scroll' },
      navGroup('Aprender', ['inicio', 'universidad']),
      navGroup('Practicar', ['laboratorio', 'mundo', 'industria']),
      navGroup('Investigar', ['datos', 'investigacion']),
      navGroup('Tú', ['perfil']),
    ),
    h('div', { class: 'nav__footer' },
      themeButton(),
      button('Contraer navegación', {
        iconName: 'menu', iconOnly: true, variant: 'ghost', size: 'sm',
        on: { click: () => update((s) => { s.settings.navCollapsed = !s.settings.navCollapsed; }) },
      }),
    ),
  );

  const topbar = h('header', { class: 'topbar' },
    h('div', { class: 'topbar__crumbs' }),
    h('div', { class: 'topbar__spacer' }),
    h('div', { class: 'topbar__actions' }),
  );

  const crumbHost = topbar.querySelector('.topbar__crumbs') as HTMLElement;
  const actionHost = topbar.querySelector('.topbar__actions') as HTMLElement;

  effect(() => {
    const crumbs = breadcrumbs();
    const nodes: Child[] = [];
    crumbs.forEach((c, i) => {
      const last = i === crumbs.length - 1;
      if (i > 0) nodes.push(h('span', { class: 'topbar__sep', text: '/' }));
      nodes.push(
        last
          ? h('b', { text: c.label })
          : h('a', {
            href: c.href ?? '#',
            class: 'topbar__ancestor',
            style: { color: 'inherit' },
            text: c.label,
          }),
      );
    });
    replace(crumbHost, ...nodes);
  });

  effect(() => {
    replace(actionHost,
      searchTrigger(),
      ...topbarActions(),
    );
  });

  const mobilenav = h('nav', { class: 'mobilenav', 'aria-label': 'Navegación' },
    ...SECTIONS.filter((s) => s.primary).map((s) => mobileItem(s)),
    h('button', {
      class: 'mobilenav__item', type: 'button',
      'aria-label': 'Más secciones',
      on: { click: () => mobileSheetOpen.set(true) },
    },
    icon('menu', { size: 20, class: 'mobilenav__icon' }),
    h('span', { text: 'Más' }),
    ),
  );

  const sheet = h('div', {
    class: 'mobilenav__sheet',
    bindAttrs: () => ({ 'data-open': String(mobileSheetOpen()) }),
    on: { click: (ev) => { if (ev.target === ev.currentTarget) mobileSheetOpen.set(false); } },
  },
  h('div', { class: 'mobilenav__sheet-panel' },
    h('h2', { class: 'caps', style: { color: 'var(--fg-muted)', marginBottom: 'var(--sp-3)' }, text: 'Todas las secciones' }),
    ...SECTIONS.map((s) => h('a', {
      class: 'nav__item',
      href: href(s.id),
      on: { click: () => mobileSheetOpen.set(false) },
    },
    icon(s.iconName, { size: 18, class: 'nav__icon' }),
    h('span', {},
      h('span', { class: 'nav__label', text: s.label }),
      h('div', { class: 'dim', style: { fontSize: 'var(--fs-3xs)' }, text: s.description }),
    ),
    )),
  ),
  );

  const root = h('div', {
    class: 'app',
    bindAttrs: () => ({ 'data-nav': state().settings.navCollapsed ? 'collapsed' : 'expanded' }),
  },
  nav,
  h('div', { class: 'main' }, topbar, screenHost),
  mobilenav,
  sheet,
  );

  applyTheme();
  return { root, screenHost };
}

function navGroup(label: string, ids: string[]): HTMLElement {
  return h('div', { class: 'nav__group' },
    h('div', { class: 'nav__group-label', text: label }),
    ...ids.map((id) => {
      const section = sectionById(id)!;
      const link = h('a', {
        class: 'nav__item',
        href: href(section.id),
        title: section.description,
      },
      icon(section.iconName, { size: 18, class: 'nav__icon' }),
      h('span', { class: 'nav__label', text: section.label }),
      );
      effect(() => {
        if (currentSection() === section.id) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      return link;
    }),
  );
}

function mobileItem(section: Section): HTMLElement {
  const link = h('a', { class: 'mobilenav__item', href: href(section.id) },
    icon(section.iconName, { size: 20, class: 'mobilenav__icon' }),
    h('span', { text: section.shortLabel ?? section.label }),
  );
  effect(() => {
    if (currentSection() === section.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  return link;
}

function themeButton(): HTMLElement {
  const btn = h('button', {
    class: 'btn btn--ghost btn--icon btn--sm',
    type: 'button',
    title: 'Cambiar tema',
    'aria-label': 'Cambiar tema',
    on: { click: cycleTheme },
  });
  effect(() => {
    const theme = state().settings.theme;
    replace(btn, icon(theme === 'dark' ? 'tema-oscuro' : 'tema-claro', { size: 15 }));
    btn.title = `Tema: ${theme === 'system' ? 'del sistema' : theme === 'dark' ? 'oscuro' : 'claro'}`;
  });
  return btn;
}

function searchTrigger(): HTMLElement {
  return h('button', {
    class: 'search-trigger', type: 'button',
    'aria-label': 'Buscar en toda la plataforma',
    on: { click: () => openSearch() },
  },
  icon('buscar', { size: 15 }),
  h('span', { text: 'Buscar…' }),
  h('kbd', { text: '/' }),
  );
}

function markLogo(): SVGSVGElement {
  return icon('laboratorio', { size: 24, class: 'nav__mark', title: 'CHEMIA' });
}

/** Set the top-bar context for the current screen. */
export function setContext(crumbs: Array<{ label: string; href?: string }>, actions: Child[] = []): void {
  breadcrumbs.set(crumbs);
  topbarActions.set(actions);
}

/** Standard screen wrapper with a header block. */
export function screen(opts: {
  eyebrow?: string;
  title: string;
  lede?: string;
  actions?: Child[];
  flush?: boolean;
}, ...body: Child[]): HTMLElement {
  return h('div', { class: ['screen__inner', opts.flush && 'screen--flush'] },
    h('header', { class: 'screen__header' },
      h('div', { class: 'row row--between', style: { alignItems: 'flex-start', gap: 'var(--sp-5)' } },
        h('div', {},
          opts.eyebrow && h('div', { class: 'screen__eyebrow', text: opts.eyebrow }),
          h('h1', { class: 'screen__title', text: opts.title }),
          opts.lede && h('p', { class: 'screen__lede', text: opts.lede }),
        ),
        opts.actions && h('div', { class: 'row', style: { gap: 'var(--sp-2)', flexShrink: '0' } }, ...opts.actions),
      ),
    ),
    ...body,
  );
}

/** A full-bleed workbench layout (§6). */
export function workbench(opts: {
  toolbar?: Child[];
  left?: Child;
  stage: Child;
  right?: Child;
  console?: Child;
}): HTMLElement {
  const sheet = signal<'left' | 'right' | 'console' | null>(null);

  /*
   * A rail only has to give way early if another rail is competing for the
   * width. With both, the tools rail goes behind a switch at tablet size; with
   * one, it stays on screen until the mobile sheets take over at 760 px.
   */
  const dual = Boolean(opts.left && opts.right);
  const leftSwitchAt = dual ? 1180 : 760;

  /* A switch reports which rail is showing, so the toggle is never a guess. */
  const switchButton = (
    label: string,
    iconName: IconName,
    target: 'left' | 'right' | 'console',
    below?: number,
  ): HTMLElement =>
    button(label, {
      size: 'sm',
      iconName,
      style: below === undefined ? undefined : { display: 'none' },
      ref: below === undefined ? undefined : showBelow(below),
      bindAttrs: () => ({ 'aria-pressed': String(sheet() === target) }),
      on: { click: () => sheet.update((s) => (s === target ? null : target)) },
    });

  const bench = h('div', {
    class: [
      'bench',
      dual && 'bench--dual',
      !opts.right && 'bench--no-right',
      !opts.left && 'bench--no-left',
    ],
    bindAttrs: () => ({ 'data-sheet': sheet() ?? 'none' }),
  },
  h('div', { class: 'bench__toolbar' },
    /*
     * Panel switches for narrow viewports, placed first.
     *
     * Below 1180 px the tools rail slides off-canvas; below 760 px the data and
     * console rails become pull-up sheets. In both cases these buttons are the
     * only way to reach them, so each one appears exactly where its rail stops
     * being visible on its own. Putting them after the flexible spacer pushed
     * them off the right edge of a scrolling toolbar, which made the whole
     * bench unusable on a phone — the controls existed but could not be found.
     */
    h('div', { class: 'btn-group bench__sheet-switch', style: { display: 'none' }, ref: showBelow(leftSwitchAt) },
      opts.left ? switchButton('Herramientas', 'ajustes', 'left') : null,
      opts.right ? switchButton('Datos', 'datos', 'right', 760) : null,
      opts.console ? switchButton('Consola', 'tabla', 'console', 760) : null,
    ),
    ...(opts.toolbar ?? []),
    h('div', { class: 'spacer' }),
  ),
  opts.left && h('aside', { class: 'bench__left', 'aria-label': 'Herramientas' }, opts.left),
  h('div', { class: 'bench__stage' }, opts.stage),
  opts.right && h('aside', { class: 'bench__right', 'aria-label': 'Datos' }, opts.right),
  opts.console && h('div', { class: 'bench__console' }, opts.console),
  );

  return bench;
}

/**
 * Show an element only below a breakpoint. Returns a `ref` callback so the
 * media query is bound once, when the node is created, and re-evaluated on
 * every viewport change rather than only at first paint.
 */
function showBelow(px: number, display: string = 'inline-flex'): (el: HTMLElement) => void {
  return (el) => {
    const mq = window.matchMedia(`(max-width: ${px}px)`);
    const apply = (): void => { el.style.display = mq.matches ? display : 'none'; };
    apply();
    mq.addEventListener('change', apply);
  };
}

/** Global keyboard shortcuts. */
export function installShortcuts(): void {
  document.addEventListener('keydown', (ev) => {
    const target = ev.target as HTMLElement;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
    if (typing) return;

    if (ev.key === '/' || (ev.key === 'k' && (ev.metaKey || ev.ctrlKey))) {
      ev.preventDefault();
      openSearch();
      return;
    }
    if (ev.key === 'g') {
      // "g then letter" jumps to a section, the way a professional tool does.
      const once = (next: KeyboardEvent): void => {
        document.removeEventListener('keydown', once, true);
        const map: Record<string, string> = {
          i: 'inicio', u: 'universidad', l: 'laboratorio', m: 'mundo',
          n: 'industria', d: 'datos', v: 'investigacion', p: 'perfil',
        };
        const target2 = map[next.key];
        if (target2) { next.preventDefault(); navigate(target2); }
      };
      document.addEventListener('keydown', once, true);
      setTimeout(() => document.removeEventListener('keydown', once, true), 1500);
    }
  });
}

/** Scroll the screen back to the top on navigation. */
export function installScrollReset(host: HTMLElement): void {
  effect(() => {
    route();
    host.scrollTop = 0;
  });
}
