/**
 * DOM construction helpers.
 *
 * A small hyperscript over the real DOM: no virtual DOM, no diffing. Panels
 * that need to update bind a signal to a single node's text or attribute,
 * which for an instrument readout is both simpler and faster than re-rendering
 * a tree.
 */

import { effect, type Signal } from './reactive.js';

export type Child = Node | string | number | null | undefined | false | Child[];

/** Typed event handlers keyed by event name, so `ev` is narrowed correctly. */
export type Handlers = { [K in keyof HTMLElementEventMap]?: (ev: HTMLElementEventMap[K]) => void };

export interface Props {
  class?: string | (string | false | undefined | null)[];
  style?: string | Partial<CSSStyleDeclaration>;
  text?: string | number;
  html?: string;
  /** Bound reactively: the node's textContent follows the signal. */
  bindText?: () => string;
  /** Bound reactively: attributes follow the signal. */
  bindAttrs?: () => Record<string, string | number | boolean | null | undefined>;
  /** Bound reactively: the class list follows the signal. */
  bindClass?: () => Record<string, boolean>;
  dataset?: Record<string, string | number | boolean | null | undefined>;
  on?: Handlers;
  ref?: (el: HTMLElement) => void;
  [attr: string]: unknown;
}

const RESERVED = new Set([
  'class', 'style', 'text', 'html', 'bindText', 'bindAttrs', 'bindClass',
  'dataset', 'on', 'ref', 'children',
]);

function applyChildren(el: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) { applyChildren(el, child); continue; }
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

function classString(value: Props['class']): string {
  if (!value) return '';
  return Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
}

/** Create an HTML element. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, props?: Props | Child, ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  let realProps: Props | undefined;

  if (props !== undefined && props !== null
    && typeof props === 'object' && !(props instanceof Node) && !Array.isArray(props)) {
    realProps = props as Props;
  } else if (props !== undefined) {
    children.unshift(props as Child);
  }

  if (realProps) applyProps(el, realProps);
  applyChildren(el, children);
  return el;
}

export function applyProps(el: HTMLElement, props: Props): void {
  if (props.class) el.className = classString(props.class);

  if (props.style) {
    if (typeof props.style === 'string') el.setAttribute('style', props.style);
    else Object.assign(el.style, props.style);
  }

  if (props.text !== undefined) el.textContent = String(props.text);
  if (props.html !== undefined) el.innerHTML = props.html;

  if (props.dataset) {
    for (const [k, v] of Object.entries(props.dataset)) {
      if (v === null || v === undefined) delete el.dataset[k];
      else el.dataset[k] = String(v);
    }
  }

  if (props.on) {
    for (const [event, handler] of Object.entries(props.on)) {
      if (handler) el.addEventListener(event, handler as EventListener);
    }
  }

  for (const [key, value] of Object.entries(props)) {
    if (RESERVED.has(key)) continue;
    if (value === null || value === undefined || value === false) continue;
    if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }

  if (props.bindText) {
    const fn = props.bindText;
    effect(() => { el.textContent = fn(); });
  }
  if (props.bindAttrs) {
    const fn = props.bindAttrs;
    effect(() => {
      for (const [k, v] of Object.entries(fn())) {
        if (v === null || v === undefined || v === false) el.removeAttribute(k);
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    });
  }
  if (props.bindClass) {
    const fn = props.bindClass;
    effect(() => {
      for (const [k, on] of Object.entries(fn())) el.classList.toggle(k, on);
    });
  }

  props.ref?.(el);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element. Used by the plotting engine and the diagrams. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K, attrs: Record<string, string | number | undefined | null | false> = {},
  ...children: Child[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    el.setAttribute(k, String(v));
  }
  applyChildren(el, children);
  return el;
}

/** Replace an element's children. */
export function replace(parent: Node, ...children: Child[]): void {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
  applyChildren(parent, children);
}

/**
 * Render `render()` into `host` and re-render whenever its signals change.
 * Used for whole panels; individual readouts use `bindText` instead, which
 * avoids rebuilding a subtree sixty times a second.
 */
export function render(host: HTMLElement, renderFn: () => Child): () => void {
  return effect(() => {
    replace(host, renderFn());
  });
}

/** Text node bound to a signal — the cheapest possible reactive update. */
export function text(fn: () => string): Text {
  const node = document.createTextNode('');
  effect(() => { node.data = fn(); });
  return node;
}

/** A document fragment, for returning several nodes from one function. */
export function fragment(...children: Child[]): DocumentFragment {
  const f = document.createDocumentFragment();
  applyChildren(f, children);
  return f;
}

/** Conditional rendering. */
export const when = (condition: unknown, then: () => Child, otherwise?: () => Child): Child =>
  condition ? then() : otherwise?.() ?? null;

/** Map a list to nodes. */
export const each = <T>(items: readonly T[], fn: (item: T, index: number) => Child): Child[] =>
  items.map(fn);

/** Bind a signal to an input's value, both ways. */
export function bindValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, sig: Signal<string>): void {
  effect(() => { if (el.value !== sig()) el.value = sig(); });
  el.addEventListener('input', () => sig.set(el.value));
}

/** Bind a numeric signal to a number/range input. */
export function bindNumber(el: HTMLInputElement, sig: Signal<number>): void {
  effect(() => {
    const v = String(sig());
    if (el.value !== v && document.activeElement !== el) el.value = v;
  });
  el.addEventListener('input', () => {
    const v = Number(el.value);
    if (Number.isFinite(v)) sig.set(v);
  });
}

/** Escape text for safe interpolation into an HTML string. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Measure an element without forcing a layout thrash in a loop. */
export function measure(el: HTMLElement): DOMRect {
  return el.getBoundingClientRect();
}

/** Observe size changes; returns a disposer. */
export function onResize(el: HTMLElement, fn: (rect: DOMRect) => void): () => void {
  if (typeof ResizeObserver === 'undefined') {
    const handler = (): void => fn(el.getBoundingClientRect());
    window.addEventListener('resize', handler);
    handler();
    return () => window.removeEventListener('resize', handler);
  }
  const ro = new ResizeObserver(() => fn(el.getBoundingClientRect()));
  ro.observe(el);
  return () => ro.disconnect();
}
