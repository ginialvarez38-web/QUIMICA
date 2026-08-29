/**
 * Utilidades minimas de DOM.
 *
 * No hay framework: el registro de npm no es accesible en este entorno. Con
 * cuatro funciones bien elegidas (crear elemento, escapar texto, delegar
 * eventos) se cubre todo lo que la interfaz necesita, y a cambio no hay
 * nada que instalar ni que actualizar.
 */

/** Escapa texto para insertarlo en HTML sin riesgo de inyeccion. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Atajo de querySelector con tipo. Lanza si no existe: es un error de programacion. */
export function $<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`No se encontro el elemento "${selector}"`);
  return el;
}

export function $$<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return [...root.querySelectorAll<T>(selector)];
}

/** Crea un elemento con clase, texto o HTML y atributos. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    html?: string;
    attrs?: Record<string, string>;
    children?: (Node | null)[];
  } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.html !== undefined) node.innerHTML = options.html;
  if (options.attrs) for (const [k, v] of Object.entries(options.attrs)) node.setAttribute(k, v);
  if (options.children) for (const c of options.children) if (c) node.appendChild(c);
  return node;
}

/**
 * Delegacion de eventos: un solo escuchador en el contenedor en lugar de uno
 * por fila. Importa porque las listas se reconstruyen constantemente.
 */
export function delegate<E extends Event>(
  root: HTMLElement,
  eventName: string,
  selector: string,
  handler: (event: E, target: HTMLElement) => void,
): void {
  root.addEventListener(eventName, (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(selector);
    if (target && root.contains(target)) handler(event as E, target);
  });
}

/** Formatea un numero con separador decimal espanol y cifras significativas. */
export function num(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const fixed = Math.abs(value) >= 1000 || Math.abs(value) < 0.001
    ? value.toPrecision(digits)
    : value.toFixed(digits);
  return fixed.replace(/\.?0+$/, '').replace('.', ',');
}

/** Marca el estado seleccionado en un grupo de botones. */
export function setPressed(buttons: HTMLElement[], predicate: (b: HTMLElement) => boolean, attr = 'aria-pressed'): void {
  for (const b of buttons) b.setAttribute(attr, String(predicate(b)));
}
