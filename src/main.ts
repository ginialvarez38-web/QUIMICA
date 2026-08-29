/**
 * CHEMIA — application entry point.
 *
 * Builds the shell, installs the router, and renders the section for the
 * current route. Everything below this file is either a scientific engine, a
 * data set, or a screen that reads from them; nothing here contains chemistry.
 */

import { h, replace } from './ui/dom.js';
import { effect } from './ui/reactive.js';
import { route, navigate, currentSection } from './ui/router.js';
import { buildShell, installShortcuts, installScrollReset, sectionById } from './ui/shell.js';
import { emptyState, button, toast } from './ui/components.js';
import { applyTheme, state } from './state/store.js';

import { inicioScreen } from './screens/inicio.js';
import { universidadScreen } from './screens/universidad.js';
import { laboratorioScreen } from './screens/laboratorio.js';
import { mundoScreen } from './screens/mundo.js';
import { industriaScreen } from './screens/industria.js';
import { datosScreen } from './screens/datos.js';
import { investigacionScreen } from './screens/investigacion.js';
import { perfilScreen } from './screens/perfil.js';

const SCREENS: Record<string, () => HTMLElement> = {
  inicio: inicioScreen,
  universidad: universidadScreen,
  laboratorio: laboratorioScreen,
  mundo: mundoScreen,
  industria: industriaScreen,
  datos: datosScreen,
  investigacion: investigacionScreen,
  perfil: perfilScreen,
};

function notFound(section: string): HTMLElement {
  return h('div', { class: 'screen__inner' },
    emptyState({
      title: `No existe la sección «${section}»`,
      text: 'Puede que el enlace esté desactualizado.',
      iconName: 'buscar',
      action: button('Ir al inicio', { variant: 'primary', on: { click: () => navigate('inicio') } }),
    }),
  );
}

/**
 * Render a screen, catching anything it throws.
 *
 * A failure inside one screen must not take down the shell: the navigation has
 * to keep working so the user can go somewhere else. The error is shown, not
 * swallowed.
 */
function renderScreen(host: HTMLElement): void {
  const section = currentSection();
  const factory = SCREENS[section];

  try {
    replace(host, factory ? factory() : notFound(section));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error('[CHEMIA] fallo al construir la pantalla', section, error);
    replace(host, h('div', { class: 'screen__inner' },
      emptyState({
        title: 'Esta pantalla no se ha podido construir',
        text: message,
        iconName: 'peligro',
        action: button('Volver al inicio', { variant: 'primary', on: { click: () => navigate('inicio') } }),
      }),
    ));
  }
}

function boot(): void {
  const mount = document.getElementById('app');
  if (!mount) throw new Error('No se encontró el elemento #app');

  const { root, screenHost } = buildShell();
  replace(mount, root);

  // Default route.
  if (!location.hash || location.hash === '#' || location.hash === '#/') {
    history.replaceState(null, '', '#/inicio');
    route.set({ segments: ['inicio'], params: new URLSearchParams(), raw: 'inicio' });
  }

  effect(() => {
    route();
    renderScreen(screenHost);
  });

  installShortcuts();
  installScrollReset(screenHost);
  applyTheme();

  // Keep the document title in step with the section, so browser history and
  // bookmarks are meaningful.
  effect(() => {
    const section = sectionById(currentSection());
    document.title = section ? `${section.label} · CHEMIA` : 'CHEMIA';
  });

  // Respect the reduce-motion preference from the profile as well as the OS.
  effect(() => {
    document.documentElement.classList.toggle('reduce-motion', state().settings.reduceMotion);
  });

  window.addEventListener('error', (ev) => {
    // eslint-disable-next-line no-console
    console.error('[CHEMIA]', ev.error ?? ev.message);
  });

  window.addEventListener('unhandledrejection', (ev) => {
    // eslint-disable-next-line no-console
    console.error('[CHEMIA] promesa rechazada', ev.reason);
    toast({
      tone: 'danger',
      title: 'Ha fallado un cálculo en segundo plano',
      body: String(ev.reason instanceof Error ? ev.reason.message : ev.reason),
    });
  });
}

boot();
