/**
 * Renderizador molecular en WebGL2 (§4, §40).
 *
 * SIN DEPENDENCIAS. No hay three.js: el registro de npm no es accesible en
 * este entorno, asi que el renderizador se escribe a mano. Tampoco hace falta
 * mucho mas: una escena molecular son esferas y cilindros, y ambos se
 * resuelven con geometria instanciada.
 *
 * TECNICA (§40: "instancing, caching y optimizacion GPU")
 *   - Una unica malla de esfera (icosaedro subdividido) y una unica malla de
 *     cilindro, subidas a la GPU una sola vez.
 *   - Cada atomo y cada enlace son una INSTANCIA: centro, radio y color van en
 *     buffers de instancia. Dibujar 500 atomos cuesta una sola llamada de
 *     dibujo, no 500.
 *   - Los enlaces se dibujan en dos mitades con el color de cada atomo, que es
 *     la convencion de los visores moleculares.
 *
 * La seleccion de atomos se resuelve en CPU con interseccion rayo-esfera: es
 * exacta, no necesita un segundo pase de render y permite implementar
 * "SEGUIR ATOMO" (§12) sin complicar el pipeline.
 */

import type { Structure, Vec3 } from '../../core/types.js';
import { getElement } from '../../data/elements.js';
import { atomRadius } from '../../geometry/vsepr.js';

export type Representation = 'ball-and-stick' | 'space-filling' | 'wireframe';

export interface RenderOptions {
  readonly representation: Representation;
  readonly showBonds: boolean;
  readonly showLabels: boolean;
  /** Atomos resaltados por el modo "seguir atomo" (§12). */
  readonly highlighted: ReadonlySet<string>;
  readonly background: [number, number, number];
}

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  representation: 'ball-and-stick',
  showBonds: true,
  showLabels: true,
  highlighted: new Set(),
  background: [0.043, 0.055, 0.078],
};

// ---------------------------------------------------------------------------
// Matematicas minimas (mat4 / vec3)
// ---------------------------------------------------------------------------

type Mat4 = Float32Array;

function identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

function lookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4 {
  const z = normalize(subtract(eye, center));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  const m = new Float32Array(16);
  m[0] = x.x; m[1] = y.x; m[2] = z.x; m[3] = 0;
  m[4] = x.y; m[5] = y.y; m[6] = z.y; m[7] = 0;
  m[8] = x.z; m[9] = y.z; m[10] = z.z; m[11] = 0;
  m[12] = -dot(x, eye); m[13] = -dot(y, eye); m[14] = -dot(z, eye); m[15] = 1;
  return m;
}

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + j]! * b[i * 4 + k]!;
      out[i * 4 + j] = sum;
    }
  }
  return out;
}

const subtract = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
function normalize(a: Vec3): Vec3 {
  const n = length(a) || 1;
  return { x: a.x / n, y: a.y / n, z: a.z / n };
}

// ---------------------------------------------------------------------------
// Mallas base
// ---------------------------------------------------------------------------

interface Mesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint16Array;
}

/** Icosaedro subdividido: esfera regular sin polos ni costuras. */
function icosphere(subdivisions: number): Mesh {
  const t = (1 + Math.sqrt(5)) / 2;
  let vertices: Vec3[] = [
    { x: -1, y: t, z: 0 }, { x: 1, y: t, z: 0 }, { x: -1, y: -t, z: 0 }, { x: 1, y: -t, z: 0 },
    { x: 0, y: -1, z: t }, { x: 0, y: 1, z: t }, { x: 0, y: -1, z: -t }, { x: 0, y: 1, z: -t },
    { x: t, y: 0, z: -1 }, { x: t, y: 0, z: 1 }, { x: -t, y: 0, z: -1 }, { x: -t, y: 0, z: 1 },
  ].map(normalize);

  let faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  for (let s = 0; s < subdivisions; s++) {
    const midpoints = new Map<string, number>();
    const nextFaces: [number, number, number][] = [];

    const midpoint = (a: number, b: number): number => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const existing = midpoints.get(key);
      if (existing !== undefined) return existing;
      const va = vertices[a]!;
      const vb = vertices[b]!;
      const mid = normalize({ x: (va.x + vb.x) / 2, y: (va.y + vb.y) / 2, z: (va.z + vb.z) / 2 });
      vertices.push(mid);
      const index = vertices.length - 1;
      midpoints.set(key, index);
      return index;
    };

    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      nextFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = nextFaces;
  }

  const positions = new Float32Array(vertices.length * 3);
  const normals = new Float32Array(vertices.length * 3);
  vertices.forEach((v, i) => {
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
    normals[i * 3] = v.x;
    normals[i * 3 + 1] = v.y;
    normals[i * 3 + 2] = v.z;
  });

  const indices = new Uint16Array(faces.length * 3);
  faces.forEach((f, i) => {
    indices[i * 3] = f[0];
    indices[i * 3 + 1] = f[1];
    indices[i * 3 + 2] = f[2];
  });

  return { positions, normals, indices };
}

/** Cilindro unitario a lo largo de +Y, de altura 1 y radio 1, sin tapas. */
function cylinder(segments: number): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    positions.push(c, 0, s, c, 1, s);
    normals.push(c, 0, s, c, 0, s);
  }
  for (let i = 0; i < segments; i++) {
    const base = i * 2;
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const SPHERE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 iCenter;
layout(location=3) in float iRadius;
layout(location=4) in vec3 iColor;
layout(location=5) in float iHighlight;

uniform mat4 uView;
uniform mat4 uProjection;

out vec3 vNormal;
out vec3 vColor;
out vec3 vViewPos;
out float vHighlight;

void main() {
  vec3 world = iCenter + aPosition * iRadius;
  vec4 viewPos = uView * vec4(world, 1.0);
  vViewPos = viewPos.xyz;
  vNormal = mat3(uView) * aNormal;
  vColor = iColor;
  vHighlight = iHighlight;
  gl_Position = uProjection * viewPos;
}`;

const CYLINDER_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 iStart;
layout(location=3) in vec3 iEnd;
layout(location=4) in float iRadius;
layout(location=5) in vec3 iColor;

uniform mat4 uView;
uniform mat4 uProjection;

out vec3 vNormal;
out vec3 vColor;
out vec3 vViewPos;
out float vHighlight;

void main() {
  vec3 axis = iEnd - iStart;
  float h = length(axis);
  vec3 up = axis / max(h, 1e-6);
  // Base ortonormal alrededor del eje del enlace.
  vec3 ref = abs(up.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 right = normalize(cross(ref, up));
  vec3 fwd = cross(up, right);
  mat3 basis = mat3(right, up, fwd);

  vec3 local = vec3(aPosition.x * iRadius, aPosition.y * h, aPosition.z * iRadius);
  vec3 world = iStart + basis * local;

  vec4 viewPos = uView * vec4(world, 1.0);
  vViewPos = viewPos.xyz;
  vNormal = mat3(uView) * (basis * aNormal);
  vColor = iColor;
  vHighlight = 0.0;
  gl_Position = uProjection * viewPos;
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vColor;
in vec3 vViewPos;
in float vHighlight;
out vec4 fragColor;

void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(-vViewPos);

  // Luz principal desde arriba-derecha y relleno frio desde abajo-izquierda:
  // da volumen sin que ninguna cara quede completamente negra.
  vec3 keyDir = normalize(vec3(0.5, 0.8, 0.9));
  vec3 fillDir = normalize(vec3(-0.6, -0.4, 0.4));

  float key = max(dot(n, keyDir), 0.0);
  float fill = max(dot(n, fillDir), 0.0) * 0.28;
  float ambient = 0.22;

  vec3 halfway = normalize(keyDir + viewDir);
  float specular = pow(max(dot(n, halfway), 0.0), 48.0) * 0.5;

  // Realce en el borde: separa las esferas del fondo oscuro.
  float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0) * 0.35;

  vec3 color = vColor * (ambient + key * 0.85 + fill) + vec3(specular) + vColor * rim;

  if (vHighlight > 0.5) {
    // Atomo seguido (§12): halo calido pulsante en el borde.
    float ring = pow(1.0 - max(dot(n, viewDir), 0.0), 1.6);
    color = mix(color, vec3(1.0, 0.78, 0.25), ring * 0.85);
  }

  fragColor = vec4(color, 1.0);
}`;

// ---------------------------------------------------------------------------
// Renderizador
// ---------------------------------------------------------------------------

interface InstancedMesh {
  readonly vao: WebGLVertexArrayObject;
  readonly indexCount: number;
  readonly buffers: WebGLBuffer[];
  instanceCount: number;
}

export interface PickResult {
  readonly atomIndex: number;
  readonly atomId: string;
  readonly symbol: string;
}

export class MoleculeRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly sphereProgram: WebGLProgram;
  private readonly cylinderProgram: WebGLProgram;
  private readonly sphere: InstancedMesh;
  private readonly cylinder: InstancedMesh;

  private structure: Structure | null = null;
  private options: RenderOptions = DEFAULT_RENDER_OPTIONS;

  /** Camara orbital. */
  private target: Vec3 = { x: 0, y: 0, z: 0 };
  private distance = 8;
  private yaw = 0.6;
  private pitch = 0.35;

  private atomWorld: { position: Vec3; radius: number; index: number }[] = [];
  private disposed = false;
  private frameHandle = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 no esta disponible en este navegador.');
    this.gl = gl;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    this.sphereProgram = this.createProgram(SPHERE_VS, FS);
    this.cylinderProgram = this.createProgram(CYLINDER_VS, FS);

    this.sphere = this.createInstancedMesh(icosphere(2), [
      { location: 2, size: 3 }, // centro
      { location: 3, size: 1 }, // radio
      { location: 4, size: 3 }, // color
      { location: 5, size: 1 }, // resaltado
    ]);

    this.cylinder = this.createInstancedMesh(cylinder(14), [
      { location: 2, size: 3 }, // inicio
      { location: 3, size: 3 }, // fin
      { location: 4, size: 1 }, // radio
      { location: 5, size: 3 }, // color
    ]);

    this.attachControls();
  }

  // --- Configuracion de WebGL -------------------------------------------

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Error al compilar el shader: ${log}`);
    }
    return shader;
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram()!;
    gl.attachShader(program, this.createShader(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, this.createShader(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Error al enlazar el programa: ${gl.getProgramInfoLog(program)}`);
    }
    return program;
  }

  private createInstancedMesh(
    mesh: Mesh,
    instanceAttributes: { location: number; size: number }[],
  ): InstancedMesh {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);

    const positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    const normalBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    const indexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    const buffers: WebGLBuffer[] = [positionBuffer, normalBuffer, indexBuffer];

    for (const attr of instanceAttributes) {
      const buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(attr.location);
      gl.vertexAttribPointer(attr.location, attr.size, gl.FLOAT, false, 0, 0);
      // Este es el nucleo del instancing: el atributo avanza una vez por
      // INSTANCIA, no una vez por vertice.
      gl.vertexAttribDivisor(attr.location, 1);
      buffers.push(buffer);
    }

    gl.bindVertexArray(null);
    return { vao, indexCount: mesh.indices.length, buffers, instanceCount: 0 };
  }

  private uploadInstanceData(mesh: InstancedMesh, arrays: Float32Array[], count: number): void {
    const gl = this.gl;
    gl.bindVertexArray(mesh.vao);
    // Los tres primeros buffers son posicion, normal e indices.
    arrays.forEach((data, i) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers[i + 3]!);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    });
    mesh.instanceCount = count;
    gl.bindVertexArray(null);
  }

  // --- API publica --------------------------------------------------------

  setStructure(structure: Structure | null): void {
    this.structure = structure;
    if (structure) this.frameCamera(structure);
    this.rebuild();
  }

  setOptions(options: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...options };
    this.rebuild();
  }

  getOptions(): RenderOptions {
    return this.options;
  }

  /** Encuadra la molecula: la camara se aleja lo justo para verla entera. */
  private frameCamera(structure: Structure): void {
    if (structure.atoms.length === 0) return;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const a of structure.atoms) {
      cx += a.position.x;
      cy += a.position.y;
      cz += a.position.z;
    }
    const n = structure.atoms.length;
    this.target = { x: cx / n, y: cy / n, z: cz / n };

    let radius = 1;
    for (const a of structure.atoms) {
      radius = Math.max(radius, length(subtract(a.position, this.target)) + 1.2);
    }
    this.distance = Math.max(4, radius * 2.6);
  }

  /** Reconstruye los buffers de instancia a partir de la estructura. */
  private rebuild(): void {
    const structure = this.structure;
    if (!structure) {
      this.sphere.instanceCount = 0;
      this.cylinder.instanceCount = 0;
      this.atomWorld = [];
      return;
    }

    const { representation, showBonds, highlighted } = this.options;

    // --- Esferas ---------------------------------------------------------
    const n = structure.atoms.length;
    const centers = new Float32Array(n * 3);
    const radii = new Float32Array(n);
    const colors = new Float32Array(n * 3);
    const highlights = new Float32Array(n);

    this.atomWorld = [];

    structure.atoms.forEach((atom, i) => {
      const element = getElement(atom.symbol);
      const color = hexToRgb(element?.cpkColor ?? '#B0B7C3');
      const base =
        representation === 'space-filling'
          ? atomRadius(atom.symbol, 'vdw')
          : representation === 'wireframe'
            ? atomRadius(atom.symbol, 'covalent') * 0.16
            : atomRadius(atom.symbol, 'covalent') * 0.42;

      centers[i * 3] = atom.position.x;
      centers[i * 3 + 1] = atom.position.y;
      centers[i * 3 + 2] = atom.position.z;
      radii[i] = base;
      colors[i * 3] = color[0];
      colors[i * 3 + 1] = color[1];
      colors[i * 3 + 2] = color[2];
      highlights[i] = highlighted.has(atom.id) ? 1 : 0;

      // Para la seleccion se usa un radio generoso: es mas facil acertar.
      this.atomWorld.push({ position: atom.position, radius: Math.max(base, 0.35), index: i });
    });

    this.uploadInstanceData(this.sphere, [centers, radii, colors, highlights], n);

    // --- Cilindros (enlaces) ---------------------------------------------
    if (!showBonds || structure.bonds.length === 0) {
      this.cylinder.instanceCount = 0;
      return;
    }

    // Cada enlace se parte en dos mitades, cada una con el color de su atomo.
    // Los enlaces multiples se dibujan como varios cilindros paralelos.
    const starts: number[] = [];
    const ends: number[] = [];
    const bondRadii: number[] = [];
    const bondColors: number[] = [];

    const bondRadius = representation === 'wireframe' ? 0.045 : 0.1;

    for (const bond of structure.bonds) {
      const a = structure.atoms[bond.a];
      const b = structure.atoms[bond.b];
      if (!a || !b) continue;

      const colorA = hexToRgb(getElement(a.symbol)?.cpkColor ?? '#B0B7C3');
      const colorB = hexToRgb(getElement(b.symbol)?.cpkColor ?? '#B0B7C3');
      const mid = {
        x: (a.position.x + b.position.x) / 2,
        y: (a.position.y + b.position.y) / 2,
        z: (a.position.z + b.position.z) / 2,
      };

      // Desplazamiento lateral para los enlaces multiples.
      const axis = normalize(subtract(b.position, a.position));
      const side = normalize(
        cross(axis, Math.abs(axis.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }),
      );
      const count = representation === 'space-filling' ? 1 : bond.order;
      const spacing = 0.16;

      for (let k = 0; k < count; k++) {
        const offsetAmount = count === 1 ? 0 : (k - (count - 1) / 2) * spacing;
        const offset = { x: side.x * offsetAmount, y: side.y * offsetAmount, z: side.z * offsetAmount };

        const pa = { x: a.position.x + offset.x, y: a.position.y + offset.y, z: a.position.z + offset.z };
        const pm = { x: mid.x + offset.x, y: mid.y + offset.y, z: mid.z + offset.z };
        const pb = { x: b.position.x + offset.x, y: b.position.y + offset.y, z: b.position.z + offset.z };

        starts.push(pa.x, pa.y, pa.z);
        ends.push(pm.x, pm.y, pm.z);
        bondRadii.push(bondRadius);
        bondColors.push(colorA[0], colorA[1], colorA[2]);

        starts.push(pm.x, pm.y, pm.z);
        ends.push(pb.x, pb.y, pb.z);
        bondRadii.push(bondRadius);
        bondColors.push(colorB[0], colorB[1], colorB[2]);
      }
    }

    this.uploadInstanceData(
      this.cylinder,
      [new Float32Array(starts), new Float32Array(ends), new Float32Array(bondRadii), new Float32Array(bondColors)],
      bondRadii.length,
    );
  }

  // --- Camara y control ---------------------------------------------------

  /**
   * Correccion por relacion de aspecto.
   *
   * La proyeccion en perspectiva fija el campo de vision VERTICAL, asi que en
   * un viewport mas alto que ancho (un movil en vertical) la molecula se sale
   * por los lados aunque quepa de sobra en altura. Se aleja la camara en la
   * misma proporcion para que siga entrando entera.
   */
  private aspectCompensation(): number {
    const width = this.canvas.clientWidth || this.canvas.width;
    const height = this.canvas.clientHeight || this.canvas.height;
    const aspect = width / Math.max(1, height);
    return aspect < 1 ? 1 / Math.max(aspect, 0.25) : 1;
  }

  private eyePosition(): Vec3 {
    const distance = this.distance * this.aspectCompensation();
    const cosPitch = Math.cos(this.pitch);
    return {
      x: this.target.x + distance * cosPitch * Math.sin(this.yaw),
      y: this.target.y + distance * Math.sin(this.pitch),
      z: this.target.z + distance * cosPitch * Math.cos(this.yaw),
    };
  }

  /** Desplaza el punto de mira en el plano de la camara. */
  private panBy(dx: number, dy: number): void {
    const eye = this.eyePosition();
    const forward = normalize(subtract(this.target, eye));
    const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
    const up = cross(right, forward);
    const scale = this.distance * 0.0016;
    this.target = {
      x: this.target.x - right.x * dx * scale + up.x * dy * scale,
      y: this.target.y - right.y * dx * scale + up.y * dy * scale,
      z: this.target.z - right.z * dx * scale + up.z * dy * scale,
    };
  }

  private zoomBy(factor: number): void {
    this.distance = Math.max(1.5, Math.min(80, this.distance * factor));
  }

  /**
   * Control de camara con raton Y con dedos.
   *
   * En un movil no hay rueda de raton: sin gestos tactiles el visor 3D era
   * literalmente inmanejable, porque no habia forma de acercarse. Se lleva un
   * registro de los punteros activos:
   *
   *   1 dedo   rotar
   *   2 dedos  pellizcar para acercar y arrastrar para desplazar, a la vez
   *
   * Es el mismo gesto que usa cualquier mapa, asi que no hay que explicarlo.
   */
  private attachControls(): void {
    const canvas = this.canvas;
    const pointers = new Map<number, { x: number; y: number }>();
    let mode: 'rotate' | 'pan' | null = null;
    let lastX = 0;
    let lastY = 0;
    /** Distancia y centro entre los dos dedos en el fotograma anterior. */
    let lastPinch: { distance: number; cx: number; cy: number } | null = null;

    const pinchState = (): { distance: number; cx: number; cy: number } | null => {
      if (pointers.size < 2) return null;
      const [a, b] = [...pointers.values()];
      if (!a || !b) return null;
      return {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
    };

    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // La captura es una comodidad, no un requisito: permite seguir
      // arrastrando fuera del lienzo. Puede lanzar si el puntero ya no esta
      // activo, y sin proteger la llamada esa excepcion abortaba el resto del
      // manejador y dejaba el control de camara muerto.
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // sin captura, el arrastre solo funciona dentro del lienzo
      }

      if (pointers.size === 1) {
        mode = e.button === 2 || e.shiftKey ? 'pan' : 'rotate';
        lastX = e.clientX;
        lastY = e.clientY;
      } else {
        // Al aparecer el segundo dedo se abandona la rotacion y se pasa a
        // pellizcar; si no, el primer dedo seguiria girando la escena.
        mode = null;
        lastPinch = pinchState();
      }
    });

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // --- Dos dedos: pellizco y desplazamiento simultaneos ----------------
      if (pointers.size >= 2) {
        const now = pinchState();
        if (now && lastPinch) {
          if (lastPinch.distance > 0 && now.distance > 0) {
            this.zoomBy(lastPinch.distance / now.distance);
          }
          this.panBy(now.cx - lastPinch.cx, now.cy - lastPinch.cy);
        }
        lastPinch = now;
        return;
      }

      // --- Un dedo o el raton ---------------------------------------------
      if (!mode) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      if (mode === 'rotate') {
        this.yaw -= dx * 0.008;
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + dy * 0.008));
      } else {
        this.panBy(dx, dy);
      }
    });

    const endPointer = (e: PointerEvent): void => {
      pointers.delete(e.pointerId);
      try {
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      } catch {
        // el puntero ya se habia liberado
      }

      if (pointers.size < 2) lastPinch = null;
      if (pointers.size === 0) {
        mode = null;
      } else if (pointers.size === 1) {
        // Queda un dedo tras soltar el otro: se retoma la rotacion desde su
        // posicion actual, sin el salto que daria conservar la anterior.
        const remaining = [...pointers.values()][0]!;
        lastX = remaining.x;
        lastY = remaining.y;
        mode = 'rotate';
      }
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('contextmenu', (e: Event) => e.preventDefault());

    canvas.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        this.zoomBy(1 + Math.sign(e.deltaY) * 0.12);
      },
      { passive: false },
    );
  }

  /** Acerca o aleja un paso; lo usan los botones de zoom de la interfaz. */
  zoom(direction: 'in' | 'out'): void {
    this.zoomBy(direction === 'in' ? 0.82 : 1.22);
  }

  /**
   * Seleccion por interseccion rayo-esfera en CPU.
   * Devuelve el atomo mas cercano bajo el cursor, o null.
   */
  pick(clientX: number, clientY: number): PickResult | null {
    const structure = this.structure;
    if (!structure) return null;

    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;

    const eye = this.eyePosition();
    const forward = normalize(subtract(this.target, eye));
    const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
    const up = cross(right, forward);

    const aspect = rect.width / rect.height;
    const tanHalfFov = Math.tan((45 * Math.PI) / 180 / 2);

    const dir = normalize({
      x: forward.x + right.x * ndcX * tanHalfFov * aspect + up.x * ndcY * tanHalfFov,
      y: forward.y + right.y * ndcX * tanHalfFov * aspect + up.y * ndcY * tanHalfFov,
      z: forward.z + right.z * ndcX * tanHalfFov * aspect + up.z * ndcY * tanHalfFov,
    });

    let bestT = Infinity;
    let bestIndex = -1;

    for (const atom of this.atomWorld) {
      const oc = subtract(eye, atom.position);
      const b = dot(oc, dir);
      const c = dot(oc, oc) - atom.radius * atom.radius;
      const discriminant = b * b - c;
      if (discriminant < 0) continue;
      const t = -b - Math.sqrt(discriminant);
      if (t > 0 && t < bestT) {
        bestT = t;
        bestIndex = atom.index;
      }
    }

    if (bestIndex < 0) return null;
    const atom = structure.atoms[bestIndex]!;
    return { atomIndex: bestIndex, atomId: atom.id, symbol: atom.symbol };
  }

  /** Proyecta una posicion 3D a coordenadas de pantalla, para las etiquetas. */
  project(position: Vec3): { x: number; y: number; visible: boolean } {
    const rect = this.canvas.getBoundingClientRect();
    const view = lookAt(this.eyePosition(), this.target, { x: 0, y: 1, z: 0 });
    const projection = perspective((45 * Math.PI) / 180, rect.width / rect.height, 0.1, 200);
    const mvp = multiply(projection, view);

    const x = mvp[0]! * position.x + mvp[4]! * position.y + mvp[8]! * position.z + mvp[12]!;
    const y = mvp[1]! * position.x + mvp[5]! * position.y + mvp[9]! * position.z + mvp[13]!;
    const w = mvp[3]! * position.x + mvp[7]! * position.y + mvp[11]! * position.z + mvp[15]!;

    if (w <= 0) return { x: 0, y: 0, visible: false };
    return {
      x: ((x / w) * 0.5 + 0.5) * rect.width,
      y: (1 - ((y / w) * 0.5 + 0.5)) * rect.height,
      visible: true,
    };
  }

  /** Posiciones de los atomos, para las etiquetas del HUD. */
  atomPositions(): readonly { id: string; symbol: string; position: Vec3 }[] {
    return this.structure?.atoms.map((a) => ({ id: a.id, symbol: a.symbol, position: a.position })) ?? [];
  }

  // --- Bucle de dibujo ----------------------------------------------------

  private resize(): void {
    const canvas = this.canvas;
    const dpr = Math.min(globalThis.devicePixelRatio ?? 1, 2);
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    this.gl.viewport(0, 0, canvas.width, canvas.height);
  }

  render(): void {
    if (this.disposed) return;
    const gl = this.gl;
    this.resize();

    const [r, g, b] = this.options.background;
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (!this.structure) return;

    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const view = lookAt(this.eyePosition(), this.target, { x: 0, y: 1, z: 0 });
    const projection = perspective((45 * Math.PI) / 180, aspect, 0.1, 200);

    if (this.cylinder.instanceCount > 0) {
      gl.useProgram(this.cylinderProgram);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.cylinderProgram, 'uView'), false, view);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.cylinderProgram, 'uProjection'), false, projection);
      gl.bindVertexArray(this.cylinder.vao);
      gl.disable(gl.CULL_FACE); // el cilindro no tiene tapas
      gl.drawElementsInstanced(
        gl.TRIANGLES,
        this.cylinder.indexCount,
        gl.UNSIGNED_SHORT,
        0,
        this.cylinder.instanceCount,
      );
      gl.enable(gl.CULL_FACE);
    }

    if (this.sphere.instanceCount > 0) {
      gl.useProgram(this.sphereProgram);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.sphereProgram, 'uView'), false, view);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.sphereProgram, 'uProjection'), false, projection);
      gl.bindVertexArray(this.sphere.vao);
      gl.drawElementsInstanced(
        gl.TRIANGLES,
        this.sphere.indexCount,
        gl.UNSIGNED_SHORT,
        0,
        this.sphere.instanceCount,
      );
    }

    gl.bindVertexArray(null);
  }

  /** Arranca el bucle continuo. `onFrame` sirve para actualizar el HUD. */
  start(onFrame?: () => void): void {
    const loop = (): void => {
      if (this.disposed) return;
      this.render();
      onFrame?.();
      this.frameHandle = requestAnimationFrame(loop);
    };
    loop();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameHandle);
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16) / 255,
    Number.parseInt(clean.slice(2, 4), 16) / 255,
    Number.parseInt(clean.slice(4, 6), 16) / 255,
  ];
}
