/**
 * Molecular 3D viewer.
 *
 * §17: ball-and-stick, space-filling, skeleton, surface, electrostatic
 * potential, orbitals and vibrations; rotate, zoom, select atoms, measure
 * distances and angles.
 *
 * Implemented on a 2D canvas with a painter's-algorithm depth sort rather than
 * WebGL. That is a deliberate trade: no shader compilation, no context loss, it
 * works on every device including software rendering, and at the molecule sizes
 * a chemistry course uses (tens to a few hundred atoms) it is comfortably fast.
 * Shading is a two-light Lambert model with a specular highlight, drawn with
 * radial gradients, which reads as three-dimensional without any GPU.
 */

import { h } from './dom.js';
import { rafThrottle } from './reactive.js';
import {
  atomColour, displayRadius, vdwRadius, distance, angle, dihedral,
  type Atom, type Molecule,
} from '../core/mol/molecule.js';

export type RenderMode =
  | 'bolas-varillas' | 'espacio-lleno' | 'esqueleto' | 'superficie'
  | 'potencial' | 'orbitales' | 'vibraciones';

export const RENDER_MODE_LABEL: Record<RenderMode, string> = {
  'bolas-varillas': 'Bolas y varillas',
  'espacio-lleno': 'Espacio lleno',
  esqueleto: 'Esqueleto',
  superficie: 'Superficie',
  potencial: 'Potencial electrostático',
  orbitales: 'Orbitales',
  vibraciones: 'Vibraciones',
};

export interface ViewerOptions {
  mode?: RenderMode;
  /** Show the element symbol on each atom. */
  labels?: boolean;
  /** Show hydrogens (a skeleton view usually hides them). */
  hydrogens?: boolean;
  background?: string;
  /** Called when the selection changes. */
  onSelect?: (selection: number[]) => void;
  /** Called with the current measurement, when 2–4 atoms are selected. */
  onMeasure?: (m: Measurement | null) => void;
  /** Spin slowly when idle. */
  autoRotate?: boolean;
}

export interface Measurement {
  kind: 'distancia' | 'ángulo' | 'diedro';
  atoms: number[];
  value: number;
  unit: string;
  label: string;
}

interface Projected {
  atom: Atom;
  sx: number;
  sy: number;
  depth: number;
  radius: number;
}

export class MoleculeViewer {
  readonly element: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private molecule: Molecule;
  private opts: Required<Pick<ViewerOptions, 'mode' | 'labels' | 'hydrogens' | 'autoRotate'>> & ViewerOptions;

  /** Rotation state, in radians. */
  private rotX = -0.35;
  private rotY = 0.6;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private selection: number[] = [];
  private hovered: number | null = null;
  private projected: Projected[] = [];
  private animationFrame: number | null = null;
  private vibrationPhase = 0;
  private disposed = false;

  constructor(molecule: Molecule, options: ViewerOptions = {}) {
    this.molecule = molecule;
    this.opts = {
      mode: options.mode ?? 'bolas-varillas',
      labels: options.labels ?? false,
      hydrogens: options.hydrogens ?? true,
      autoRotate: options.autoRotate ?? false,
      ...options,
    };

    this.canvas = h('canvas', { 'aria-label': `Modelo tridimensional de ${molecule.name}` });
    this.element = h('div', { class: 'viewport' }, this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo obtener el contexto 2D del lienzo');
    this.ctx = ctx;

    this.attachInteraction();
    this.observeSize();
    this.loop();
  }

  setMolecule(molecule: Molecule): void {
    this.molecule = molecule;
    this.selection = [];
    this.opts.onSelect?.([]);
    this.opts.onMeasure?.(null);
    this.draw();
  }

  setMode(mode: RenderMode): void {
    this.opts.mode = mode;
    this.draw();
  }

  setLabels(on: boolean): void { this.opts.labels = on; this.draw(); }
  setHydrogens(on: boolean): void { this.opts.hydrogens = on; this.draw(); }
  setAutoRotate(on: boolean): void { this.opts.autoRotate = on; }

  resetView(): void {
    this.rotX = -0.35;
    this.rotY = 0.6;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.draw();
  }

  clearSelection(): void {
    this.selection = [];
    this.opts.onSelect?.([]);
    this.opts.onMeasure?.(null);
    this.draw();
  }

  dispose(): void {
    this.disposed = true;
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
  }

  // -------------------------------------------------------------------------

  private observeSize(): void {
    const resize = (): void => {
      const rect = this.element.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.draw();
    };
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(resize).observe(this.element);
    } else {
      window.addEventListener('resize', resize);
    }
    setTimeout(resize, 0);
  }

  private attachInteraction(): void {
    let dragging = false;
    let panning = false;
    let lastX = 0;
    let lastY = 0;
    let moved = false;

    const onMove = rafThrottle((dx: number, dy: number) => {
      if (panning) {
        this.panX += dx;
        this.panY += dy;
      } else {
        this.rotY += dx * 0.01;
        this.rotX += dy * 0.01;
        this.rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotX));
      }
      this.draw();
    });

    this.canvas.addEventListener('pointerdown', (ev) => {
      dragging = true;
      panning = ev.shiftKey || ev.button === 1;
      moved = false;
      lastX = ev.clientX;
      lastY = ev.clientY;
      this.canvas.setPointerCapture(ev.pointerId);
    });

    this.canvas.addEventListener('pointermove', (ev) => {
      const rect = this.canvas.getBoundingClientRect();
      if (!dragging) {
        const hit = this.pick(ev.clientX - rect.left, ev.clientY - rect.top);
        if (hit !== this.hovered) {
          this.hovered = hit;
          this.canvas.style.cursor = hit === null ? 'grab' : 'pointer';
          this.draw();
        }
        return;
      }
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      lastX = ev.clientX;
      lastY = ev.clientY;
      onMove(dx, dy);
    });

    const endDrag = (ev: PointerEvent): void => {
      if (dragging && !moved) {
        const rect = this.canvas.getBoundingClientRect();
        const hit = this.pick(ev.clientX - rect.left, ev.clientY - rect.top);
        this.toggleSelection(hit);
      }
      dragging = false;
      panning = false;
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', () => { dragging = false; panning = false; });

    this.canvas.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      this.zoom = Math.max(0.25, Math.min(6, this.zoom * (ev.deltaY < 0 ? 1.12 : 0.89)));
      this.draw();
    }, { passive: false });

    // Keyboard control, so the viewer is usable without a pointer (§68).
    this.canvas.tabIndex = 0;
    this.canvas.addEventListener('keydown', (ev) => {
      const step = ev.shiftKey ? 0.3 : 0.1;
      switch (ev.key) {
        case 'ArrowLeft': this.rotY -= step; break;
        case 'ArrowRight': this.rotY += step; break;
        case 'ArrowUp': this.rotX -= step; break;
        case 'ArrowDown': this.rotX += step; break;
        case '+': case '=': this.zoom *= 1.15; break;
        case '-': this.zoom /= 1.15; break;
        case 'Escape': this.clearSelection(); return;
        case 'r': this.resetView(); return;
        default: return;
      }
      ev.preventDefault();
      this.draw();
    });
  }

  private toggleSelection(atomId: number | null): void {
    if (atomId === null) {
      this.clearSelection();
      return;
    }
    const i = this.selection.indexOf(atomId);
    if (i >= 0) this.selection.splice(i, 1);
    else {
      this.selection.push(atomId);
      if (this.selection.length > 4) this.selection.shift();
    }
    this.opts.onSelect?.([...this.selection]);
    this.opts.onMeasure?.(this.measure());
    this.draw();
  }

  /** Distance, angle or dihedral, depending on how many atoms are selected. */
  measure(): Measurement | null {
    const atoms = this.selection
      .map((id) => this.molecule.atoms.find((a) => a.id === id))
      .filter((a): a is Atom => Boolean(a));

    const name = (a: Atom): string => `${a.element}${a.id}`;
    if (atoms.length === 2) {
      const value = distance(atoms[0], atoms[1]);
      return {
        kind: 'distancia', atoms: this.selection, value, unit: 'Å',
        label: `d(${name(atoms[0])}–${name(atoms[1])}) = ${value.toFixed(3)} Å`,
      };
    }
    if (atoms.length === 3) {
      const value = angle(atoms[0], atoms[1], atoms[2]);
      return {
        kind: 'ángulo', atoms: this.selection, value, unit: '°',
        label: `∠(${name(atoms[0])}–${name(atoms[1])}–${name(atoms[2])}) = ${value.toFixed(2)}°`,
      };
    }
    if (atoms.length === 4) {
      const value = dihedral(atoms[0], atoms[1], atoms[2], atoms[3]);
      return {
        kind: 'diedro', atoms: this.selection, value, unit: '°',
        label: `τ(${atoms.map(name).join('–')}) = ${value.toFixed(2)}°`,
      };
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  private loop(): void {
    const tick = (): void => {
      if (this.disposed) return;
      let needsDraw = false;
      if (this.opts.autoRotate) { this.rotY += 0.004; needsDraw = true; }
      if (this.opts.mode === 'vibraciones') { this.vibrationPhase += 0.06; needsDraw = true; }
      if (needsDraw) this.draw();
      this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  /** Rotate a point by the current view rotation. */
  private rotate(x: number, y: number, z: number): [number, number, number] {
    const cy = Math.cos(this.rotY), sy = Math.sin(this.rotY);
    const cx = Math.cos(this.rotX), sx = Math.sin(this.rotX);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y1 = y * cx - z1 * sx;
    const z2 = y * sx + z1 * cx;
    return [x1, y1, z2];
  }

  private visibleAtoms(): Atom[] {
    if (this.opts.hydrogens) return this.molecule.atoms;
    return this.molecule.atoms.filter((a) => a.element !== 'H');
  }

  private project(): { width: number; height: number; scale: number } {
    const rect = this.element.getBoundingClientRect();
    const width = rect.width || 400;
    const height = rect.height || 320;

    const atoms = this.visibleAtoms();
    if (atoms.length === 0) return { width, height, scale: 1 };

    // Fit the molecule to the viewport, then apply the user's zoom.
    let maxR = 0;
    for (const a of atoms) {
      const r = Math.hypot(a.x, a.y, a.z) + displayRadius(a.element);
      if (r > maxR) maxR = r;
    }
    const scale = ((Math.min(width, height) * 0.42) / Math.max(maxR, 0.9)) * this.zoom;

    // Vibration: displace atoms along a simple normal-mode-like breathing.
    const amp = this.opts.mode === 'vibraciones' ? 0.13 * Math.sin(this.vibrationPhase) : 0;

    this.projected = atoms.map((atom) => {
      const scaleFactor = 1 + amp * (atom.element === 'H' ? 1.6 : 0.5);
      const [rx, ry, rz] = this.rotate(atom.x * scaleFactor, atom.y * scaleFactor, atom.z * scaleFactor);
      return {
        atom,
        sx: width / 2 + rx * scale + this.panX,
        sy: height / 2 - ry * scale + this.panY,
        depth: rz,
        radius: this.atomRadius(atom) * scale,
      };
    });
    this.projected.sort((a, b) => a.depth - b.depth);
    return { width, height, scale };
  }

  private atomRadius(atom: Atom): number {
    switch (this.opts.mode) {
      case 'espacio-lleno':
      case 'superficie':
      case 'potencial':
        return vdwRadius(atom.element) / 100;
      case 'esqueleto':
        return 0.09;
      case 'orbitales':
        return displayRadius(atom.element) * 0.6;
      default:
        return displayRadius(atom.element);
    }
  }

  private pick(px: number, py: number): number | null {
    // Front-most atom wins, so iterate the depth-sorted list backwards.
    for (let i = this.projected.length - 1; i >= 0; i--) {
      const p = this.projected[i];
      if (Math.hypot(px - p.sx, py - p.sy) <= Math.max(p.radius, 7)) return p.atom.id;
    }
    return null;
  }

  draw(): void {
    const { width, height } = this.project();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    if (this.opts.background) {
      ctx.fillStyle = this.opts.background;
      ctx.fillRect(0, 0, width, height);
    }

    const positions = new Map(this.projected.map((p) => [p.atom.id, p]));

    if (this.opts.mode !== 'espacio-lleno' && this.opts.mode !== 'superficie' && this.opts.mode !== 'potencial') {
      this.drawBonds(positions);
    }

    for (const p of this.projected) this.drawAtom(p);

    if (this.opts.mode === 'orbitales') this.drawOrbitalLobes(positions);
    this.drawMeasurementOverlay(positions);
  }

  private drawBonds(positions: Map<number, Projected>): void {
    const ctx = this.ctx;
    const skeleton = this.opts.mode === 'esqueleto';

    // Depth-sort the bonds too, so a bond behind an atom is drawn behind it.
    const bonds = this.molecule.bonds
      .map((bond) => ({ bond, a: positions.get(bond.a), b: positions.get(bond.b) }))
      .filter((e): e is { bond: typeof e.bond; a: Projected; b: Projected } => Boolean(e.a && e.b))
      .sort((p, q) => (p.a.depth + p.b.depth) / 2 - (q.a.depth + q.b.depth) / 2);

    for (const { bond, a, b } of bonds) {
      const dx = b.sx - a.sx;
      const dy = b.sy - a.sy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      // Depth cue: bonds further away are thinner and dimmer.
      const depth = (a.depth + b.depth) / 2;
      const cue = Math.max(0.35, Math.min(1, 0.72 + depth * 0.12));
      const baseWidth = skeleton ? 3.6 : 5.4;
      const width = baseWidth * cue;

      // A bond of order 1.5 (aromatic) is drawn as one solid line plus a
      // dashed inner one — the convention that says "delocalised", not
      // "alternating single and double".
      const orders = bond.order === 3 ? [-1, 0, 1]
        : bond.order >= 1.5 ? [-0.62, 0.62]
          : [0];
      const gap = width * 0.85;

      orders.forEach((offset, index) => {
        // Half the bond takes each atom's colour — the standard convention that
        // lets you read the composition without labels.
        const ox = nx * offset * gap;
        const oy = ny * offset * gap;
        const midX = (a.sx + b.sx) / 2 + ox;
        const midY = (a.sy + b.sy) / 2 + oy;

        const dashed = bond.order === 1.5 && index === 1;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = width * (bond.order === 3 ? 0.7 : 1);
        if (dashed) ctx.setLineDash([width * 1.1, width * 1.1]);

        ctx.globalAlpha = cue;
        ctx.strokeStyle = skeleton ? this.chromeColour() : atomColour(a.atom.element);
        ctx.beginPath();
        ctx.moveTo(a.sx + ox, a.sy + oy);
        ctx.lineTo(midX, midY);
        ctx.stroke();

        ctx.strokeStyle = skeleton ? this.chromeColour() : atomColour(b.atom.element);
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(b.sx + ox, b.sy + oy);
        ctx.stroke();
        ctx.restore();
      });
    }
  }

  private chromeColour(): string {
    return getComputedStyle(this.element).getPropertyValue('--fg-secondary').trim() || '#888';
  }

  private drawAtom(p: Projected): void {
    const ctx = this.ctx;
    const { atom, sx, sy, radius, depth } = p;
    if (radius <= 0.2) return;

    const base = this.modeColour(atom);
    const selected = this.selection.includes(atom.id);
    const hovered = this.hovered === atom.id;

    // Depth shading: further atoms are darker and slightly desaturated.
    const cue = Math.max(0.45, Math.min(1, 0.75 + depth * 0.14));

    const grad = ctx.createRadialGradient(
      sx - radius * 0.36, sy - radius * 0.4, radius * 0.08,
      sx, sy, radius,
    );
    grad.addColorStop(0, mix('#ffffff', base, 0.62 * cue));
    grad.addColorStop(0.45, mix(base, '#ffffff', 0.12 * cue));
    grad.addColorStop(1, mix(base, '#000000', 0.42));

    ctx.save();
    ctx.globalAlpha = this.opts.mode === 'superficie' ? 0.55
      : this.opts.mode === 'potencial' ? 0.72 : 1;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Outline keeps light atoms readable on a light ground.
    ctx.lineWidth = 1;
    ctx.strokeStyle = mix(base, '#000000', 0.55);
    ctx.globalAlpha *= 0.7;
    ctx.stroke();
    ctx.restore();

    // Specular highlight.
    if (this.opts.mode !== 'esqueleto' && radius > 5) {
      ctx.save();
      ctx.globalAlpha = 0.5 * cue;
      ctx.beginPath();
      ctx.ellipse(sx - radius * 0.34, sy - radius * 0.38, radius * 0.2, radius * 0.14, -0.6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }

    if (selected || hovered) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy, radius + (selected ? 4 : 2.5), 0, Math.PI * 2);
      ctx.strokeStyle = selected ? this.accentColour() : this.chromeColour();
      ctx.lineWidth = selected ? 2.2 : 1.4;
      ctx.setLineDash(selected ? [] : [3, 3]);
      ctx.stroke();
      ctx.restore();
    }

    if (this.opts.labels && radius > 5) {
      ctx.save();
      ctx.font = `600 ${Math.min(radius * 0.95, 15).toFixed(0)}px var(--font-sans, sans-serif)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const luminance = relativeLuminance(base);
      ctx.fillStyle = luminance > 0.55 ? '#111' : '#fff';
      ctx.fillText(atom.label ?? atom.element, sx, sy);
      ctx.restore();
    }

    if (atom.charge) {
      ctx.save();
      ctx.font = '600 11px var(--font-sans, sans-serif)';
      ctx.fillStyle = atom.charge > 0 ? '#e05252' : '#4b8ef0';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${Math.abs(atom.charge) > 1 ? Math.abs(atom.charge) : ''}${atom.charge > 0 ? '+' : '−'}`,
        sx + radius * 0.78, sy - radius * 0.72,
      );
      ctx.restore();
    }
  }

  /**
   * Colour for the current mode.
   *
   * The electrostatic-potential mode maps the Pauling electronegativity onto
   * the conventional red-to-blue scale. It is a *qualitative* map derived from
   * atomic electronegativity, not a computed molecular surface, and the panel
   * says so — presenting it as a real ESP map would be exactly the kind of
   * approximation-passed-off-as-data that §53 rules out.
   */
  private modeColour(atom: Atom): string {
    if (this.opts.mode !== 'potencial') return atomColour(atom.element);
    const en = electronegativityOf(atom.element);
    const t = Math.max(0, Math.min(1, (en - 2.0) / 1.8));
    return t < 0.5
      ? mix('#2b5fd9', '#f0f0f0', t * 2)
      : mix('#f0f0f0', '#d92b2b', (t - 0.5) * 2);
  }

  /** Simple p-orbital lobes on atoms involved in π bonds. */
  private drawOrbitalLobes(positions: Map<number, Projected>): void {
    const ctx = this.ctx;
    const piAtoms = new Set<number>();
    for (const bond of this.molecule.bonds) {
      if (bond.order >= 1.5) { piAtoms.add(bond.a); piAtoms.add(bond.b); }
    }
    for (const id of piAtoms) {
      const p = positions.get(id);
      if (!p) continue;
      const up = this.rotate(0, 0, 1);
      const scale = p.radius * 3.2;
      for (const sign of [1, -1]) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.ellipse(
          p.sx + up[0] * scale * sign * 0.5,
          p.sy - up[1] * scale * sign * 0.5,
          p.radius * 1.1, scale * 0.55,
          Math.atan2(-up[1], up[0]) + Math.PI / 2,
          0, Math.PI * 2,
        );
        ctx.fillStyle = sign > 0 ? '#4b8ef0' : '#f0625c';
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private drawMeasurementOverlay(positions: Map<number, Projected>): void {
    if (this.selection.length < 2) return;
    const ctx = this.ctx;
    const pts = this.selection.map((id) => positions.get(id)).filter((p): p is Projected => Boolean(p));
    if (pts.length < 2) return;

    ctx.save();
    ctx.strokeStyle = this.accentColour();
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
    ctx.stroke();

    const m = this.measure();
    if (m) {
      const cx = pts.reduce((s, p) => s + p.sx, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.sy, 0) / pts.length;
      ctx.setLineDash([]);
      ctx.font = '600 12px var(--font-mono, monospace)';
      const text = `${m.value.toFixed(m.kind === 'distancia' ? 3 : 2)} ${m.unit}`;
      const w = ctx.measureText(text).width + 12;
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, cy - 22, w, 19, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(text, cx, cy - 8.5);
    }
    ctx.restore();
  }

  private accentColour(): string {
    return getComputedStyle(this.element).getPropertyValue('--accent').trim() || '#1f5fbf';
  }
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function mix(a: string, bColour: string, t: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(bColour);
  const clamp = Math.max(0, Math.min(1, t));
  const r = Math.round(r1 + (r2 - r1) * clamp);
  const g = Math.round(g1 + (g2 - g1) * clamp);
  const bb = Math.round(b1 + (b2 - b1) * clamp);
  return `rgb(${r}, ${g}, ${bb})`;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function electronegativityOf(symbol: string): number {
  const table: Record<string, number> = {
    H: 2.20, C: 2.55, N: 3.04, O: 3.44, F: 3.98, P: 2.19, S: 2.58,
    Cl: 3.16, Br: 2.96, I: 2.66, Na: 0.93, K: 0.82, Mg: 1.31, Ca: 1.00,
    Fe: 1.83, Cu: 1.90, Zn: 1.65, Al: 1.61, Si: 1.90, B: 2.04,
  };
  return table[symbol] ?? 2.2;
}
