/**
 * FIGURAS 3D DEL TEMARIO.
 *
 * EL PROBLEMA QUE HAY QUE RESOLVER
 * Un navegador limita el numero de contextos WebGL simultaneos — del orden de
 * dieciseis — y al pasarse empieza a descartar los mas antiguos en silencio,
 * dejando lienzos en negro. La unidad 2 sola lleva cinco figuras, asi que se
 * puede estar cerca del limite sin darse cuenta.
 *
 * De ahi las dos decisiones de este modulo:
 *
 *   1. El contexto se crea PEREZOSAMENTE, cuando la figura entra en pantalla.
 *      Un temario que se lee de arriba abajo activa las figuras segun se
 *      llega a ellas, y las de una unidad que nunca se abre no gastan nada.
 *
 *   2. Se dibuja BAJO DEMANDA, no en un bucle continuo. Estas escenas son
 *      estaticas: solo hay que repintar al cambiar de vista o al mover la
 *      camara. Mantener un bucle por figura calentaria el portatil
 *      de un estudiante para no ensenar nada nuevo.
 *
 * Y una tercera que no es tecnica: cada figura muestra SU LIMITE debajo, igual
 * que las analogias del temario. Un dibujo de un atomo es una analogia visual,
 * y las mismas razones se aplican — el modelo de Bohr con sus orbitas es
 * probablemente la imagen que mas ideas falsas ha dejado en la quimica.
 */

import type { SceneSet } from '../teach/scenes.js';
import { sceneSet } from '../teach/scenes.js';
import { MoleculeRenderer } from '../render/webgl/renderer.js';
import { escapeHtml } from './dom.js';

/** El HTML de una figura. El lienzo nace vacio; el contexto llega despues. */
export function renderFigure(setId: string): string {
  const set = sceneSet(setId);
  if (!set) return '';
  const first = set.scenes[0]!;

  return `
    <figure class="figure3d" data-figure="${escapeHtml(set.id)}">
      <figcaption class="figure3d-head">
        <span class="figure3d-title">${escapeHtml(set.title)}</span>
        <span class="figure3d-intro">${escapeHtml(set.intro)}</span>
      </figcaption>

      <div class="figure3d-tabs" role="tablist">
        ${set.scenes
          .map(
            (s, i) =>
              `<button class="figure3d-tab" role="tab" data-scene="${escapeHtml(s.id)}"
                       aria-selected="${i === 0}">${escapeHtml(s.title)}</button>`,
          )
          .join('')}
      </div>

      <div class="figure3d-stage">
        <canvas class="figure3d-canvas"></canvas>
        <div class="figure3d-placeholder">Cargando la figura…</div>
        <!-- Dos redacciones del mismo aviso, y el CSS elige.
             «Rueda para acercar» en un movil manda a un mando que no existe;
             el renderizador entiende el pellizco desde el primer dia, asi que
             lo que faltaba era decirlo. -->
        <div class="figure3d-hint">
          <span class="figure3d-hint-mouse">Arrastra para girar · rueda para acercar</span>
          <span class="figure3d-hint-touch">Arrastra para girar · pellizca para acercar</span>
        </div>
      </div>

      <!-- El pie y el limite se escriben ya, con la primera escena. Dejarlos
           vacios hasta que monte el contexto haria que una figura aun sin
           cargar — o en un navegador sin WebGL — apareciera sin explicacion
           ninguna, que es cuando mas falta hace. -->
      <p class="figure3d-caption">${escapeHtml(first.caption)}</p>
      <p class="figure3d-limit"><strong>El dibujo miente en esto:</strong> ${escapeHtml(first.limit)}</p>
    </figure>`;
}

interface Mounted {
  readonly set: SceneSet;
  readonly renderer: MoleculeRenderer;
  readonly element: HTMLElement;
  current: string;
}

/**
 * Gestiona todas las figuras de un panel.
 *
 * Se instancia una por panel de temario, y se ocupa de crear los contextos
 * cuando hace falta y de liberarlos cuando el panel deja de usarse.
 */
export class FigureManager {
  private readonly mounted = new Map<HTMLElement, Mounted>();
  private observer: IntersectionObserver | null = null;
  private background: [number, number, number];

  constructor(
    private readonly root: HTMLElement,
    background: [number, number, number],
  ) {
    this.background = background;
  }

  /**
   * El fondo del lienzo sigue al tema.
   *
   * Un lienzo negro sobre una pagina clara se lee como un agujero, no como una
   * figura. Se propaga a las que ya estan montadas y se guarda para las que
   * se monten despues.
   */
  setBackground(background: [number, number, number]): void {
    this.background = background;
    for (const m of this.mounted.values()) {
      m.renderer.setOptions({ background });
      m.renderer.render();
    }
  }

  /**
   * Empieza a vigilar las figuras del panel.
   *
   * Se usa IntersectionObserver y no un calculo de posiciones porque el
   * contenedor tiene su propio desplazamiento: el observador entiende eso solo
   * y no hace falta escuchar cada evento de scroll.
   */
  start(): void {
    this.stop();
    const figures = [...this.root.querySelectorAll<HTMLElement>('.figure3d')];
    if (figures.length === 0) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          if (entry.isIntersecting) this.mount(element);
        }
      },
      // Un margen generoso: la figura se prepara justo antes de que se vea,
      // para que no aparezca en blanco al llegar a ella.
      { root: this.root.querySelector('.theory-content'), rootMargin: '260px' },
    );

    for (const figure of figures) this.observer.observe(figure);
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  /** Libera todos los contextos. Se llama al abandonar el modo. */
  dispose(): void {
    this.stop();
    for (const m of this.mounted.values()) m.renderer.dispose();
    this.mounted.clear();
  }

  private mount(element: HTMLElement): void {
    if (this.mounted.has(element)) return;

    const set = sceneSet(element.dataset['figure'] ?? '');
    const canvas = element.querySelector<HTMLCanvasElement>('.figure3d-canvas');
    if (!set || !canvas) return;

    let renderer: MoleculeRenderer;
    try {
      renderer = new MoleculeRenderer(canvas);
    } catch {
      /*
       * Sin WebGL la figura no se puede dibujar, y eso NO es motivo para
       * romper la pagina: el temario se lee igual. Se sustituye por un aviso
       * y se sigue.
       */
      const placeholder = element.querySelector<HTMLElement>('.figure3d-placeholder');
      if (placeholder) {
        placeholder.textContent =
          'Este navegador no puede dibujar la figura en 3D. El texto de arriba explica lo mismo.';
        placeholder.classList.add('is-error');
      }
      element.classList.add('is-unavailable');
      return;
    }

    renderer.setOptions({ showLabels: false, showBonds: true, background: this.background });

    const mountedFigure: Mounted = { set, renderer, element, current: set.scenes[0]!.id };
    this.mounted.set(element, mountedFigure);
    element.classList.add('is-ready');

    // La camara se mueve con el raton o el dedo: hay que repintar entonces.
    renderer.start();

    this.show(mountedFigure, set.scenes[0]!.id);
  }

  /**
   * Cambia de escena dentro de una figura.
   *
   * Si la figura aun no tiene contexto, se monta aqui. Sin esto, pulsar una
   * pestana de una figura que todavia no habia entrado en pantalla no hacia
   * NADA — ni cambiaba ni avisaba — y eso ensena al usuario a desconfiar del
   * control.
   */
  select(element: HTMLElement, sceneId: string): void {
    if (!this.mounted.has(element)) this.mount(element);
    const figure = this.mounted.get(element);
    if (figure) this.show(figure, sceneId);
  }

  private show(figure: Mounted, sceneId: string): void {
    const scene = figure.set.scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    figure.current = sceneId;
    figure.renderer.setStructure(scene.structure);

    const caption = figure.element.querySelector<HTMLElement>('.figure3d-caption');
    const limit = figure.element.querySelector<HTMLElement>('.figure3d-limit');
    if (caption) caption.textContent = scene.caption;
    if (limit) {
      // El limite se marca como tal: es un dibujo, no una fotografia.
      limit.innerHTML = `<strong>El dibujo miente en esto:</strong> ${escapeHtml(scene.limit)}`;
    }

    for (const tab of figure.element.querySelectorAll<HTMLElement>('.figure3d-tab')) {
      tab.setAttribute('aria-selected', String(tab.dataset['scene'] === sceneId));
    }
  }
}
