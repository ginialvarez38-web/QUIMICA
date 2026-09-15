/**
 * EL MAPA DEL CONOCIMIENTO, DIBUJADO.
 *
 * COMO SE COLOCAN LOS NODOS
 * Por capas de camino mas largo (las calcula `teach/tree.ts`): cada apartado
 * cae DESPUES de todo lo que necesita. Leido de arriba abajo, el mapa es el
 * orden en que se puede estudiar, y la altura de un nodo dice cuantas cosas
 * hay encadenadas antes de el.
 *
 * DENTRO DE CADA CAPA, EL BARICENTRO
 * Repartir los nodos de una capa en el orden en que vengan produce una marana:
 * las flechas se cruzan sin motivo y el dibujo deja de leerse. Se ordenan por
 * la posicion MEDIA de sus padres, que es la heuristica clasica para dibujar
 * grafos por capas — un nodo tiende a quedar debajo de aquello de lo que
 * depende, y las flechas salen cortas y casi verticales.
 *
 * Una sola pasada. No es el optimo —minimizar cruces es NP-dificil— pero la
 * diferencia entre ninguna pasada y una es la que se ve.
 *
 * LAS FLECHAS SON SVG Y LOS NODOS SON BOTONES
 * Y no todo SVG, que habria sido mas facil. Un nodo del mapa lleva a un
 * apartado: tiene que poder pulsarse, enfocarse con el teclado y leerse con un
 * lector de pantalla. Un <text> dentro de un <svg> no hace nada de eso. Asi
 * que las lineas van en una capa SVG de fondo y los nodos son <button> de
 * verdad colocados encima, en el mismo sistema de coordenadas.
 */

import type { KnowledgeTree, TreeNode } from '../teach/tree.js';
import { unitOf } from '../teach/tree.js';
import { escapeHtml } from './dom.js';

/**
 * Geometria del dibujo, en pixeles.
 *
 * Los nodos se midieron: con 132 x 42 y dos lineas de texto, 19 de los 52
 * titulos se cortaban, y algunos a algo INSERVIBLE — «1.8.2 Ley de las» y
 * «1.8.3 Ley de las» quedaban indistinguibles, que es justo lo contrario de lo
 * que un mapa viene a hacer. Con 154 x 58 y tres lineas caben enteros.
 *
 * La fila mas ancha tiene ocho nodos, asi que el lienzo se va por encima del
 * ancho de lectura y se desplaza en horizontal. Es el precio correcto: antes
 * que estrechar los nodos hasta que dejen de decir cual es cual, mejor mover
 * el dibujo.
 */
const NODE_W = 154;
const NODE_H = 58;
const GAP_X = 14;
const ROW_H = 92;
const PAD = 22;

interface Placed {
  readonly node: TreeNode;
  readonly x: number;
  readonly y: number;
}

/**
 * Ordena cada capa por el baricentro de sus padres y devuelve las posiciones.
 *
 * Las capas se recorren de arriba abajo porque el baricentro de una capa
 * necesita las posiciones ya fijadas de la anterior.
 */
function layout(tree: KnowledgeTree): { placed: Placed[]; width: number; height: number } {
  const parentsOf = new Map<string, string[]>();
  for (const edge of tree.edges) {
    const list = parentsOf.get(edge.to) ?? [];
    list.push(edge.from);
    parentsOf.set(edge.to, list);
  }

  const widest = Math.max(...tree.layers.map((l) => l.length));
  const width = PAD * 2 + widest * NODE_W + (widest - 1) * GAP_X;

  const centre = new Map<string, number>();
  const placed: Placed[] = [];

  tree.layers.forEach((layer, index) => {
    const ordered = [...layer].sort((a, b) => {
      const key = (node: TreeNode): number => {
        const parents = (parentsOf.get(node.id) ?? [])
          .map((id) => centre.get(id))
          .filter((x): x is number => x !== undefined);
        // Un nodo sin padres colocados no tiene preferencia: se manda al
        // centro para que no arrastre la capa hacia un lado.
        return parents.length === 0 ? width / 2 : parents.reduce((s, v) => s + v, 0) / parents.length;
      };
      const diff = key(a) - key(b);
      // A igualdad de baricentro, el orden del temario: dos apartados
      // hermanos deben salir en el orden en que se estudian.
      return diff !== 0 ? diff : a.id.localeCompare(b.id, 'es', { numeric: true });
    });

    const rowWidth = ordered.length * NODE_W + (ordered.length - 1) * GAP_X;
    const left = (width - rowWidth) / 2;

    ordered.forEach((node, i) => {
      const x = left + i * (NODE_W + GAP_X);
      const y = PAD + index * ROW_H;
      centre.set(node.id, x + NODE_W / 2);
      placed.push({ node, x, y });
    });
  });

  return { placed, width, height: PAD * 2 + tree.layers.length * ROW_H };
}

/**
 * Una flecha de un nodo a otro.
 *
 * Curva de Bezier vertical: sale por abajo del origen y entra por arriba del
 * destino, con los tiradores a media altura. Una recta diagonal entre dos
 * nodos de capas lejanas atraviesa todo lo que haya en medio; la curva se
 * separa y se vuelve a juntar, y se sigue con la vista.
 */
function edgePath(from: Placed, to: Placed): string {
  const x1 = from.x + NODE_W / 2;
  const y1 = from.y + NODE_H;
  const x2 = to.x + NODE_W / 2;
  const y2 = to.y;
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
}

export function renderTree(tree: KnowledgeTree, currentId: string | null): string {
  const { placed, width, height } = layout(tree);
  const byId = new Map(placed.map((p) => [p.node.id, p]));

  const paths = tree.edges
    .map((edge) => {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) return '';
      const classes = [
        'tree-edge',
        edge.crossesUnit ? 'is-cross' : '',
        to.node.state === 'previsto' ? 'is-planned' : '',
        edge.from === currentId || edge.to === currentId ? 'is-current' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<path class="${classes}" d="${edgePath(from, to)}" />`;
    })
    .join('');

  const nodes = placed
    .map(({ node, x, y }) => {
      const planned = node.state === 'previsto';
      const classes = [
        'tree-node',
        `unit-${escapeHtml(unitOf(node.id))}`,
        planned ? 'is-planned' : '',
        node.id === currentId ? 'is-current' : '',
        node.depth > 1 ? 'is-sub' : '',
      ]
        .filter(Boolean)
        .join(' ');

      const tip = planned
        ? `${node.title} — rama prevista.${node.engine ? ` Motor ya disponible: ${node.engine}.` : ' Sin motor todavia.'}${node.note ? `\n\n${node.note}` : ''}`
        : `${node.id} ${node.title}`;

      return `
        <button class="${classes}" style="left:${x}px;top:${y}px;width:${NODE_W}px;height:${NODE_H}px"
                data-tree-node="${escapeHtml(node.id)}" data-state="${node.state}"
                title="${escapeHtml(tip)}"${node.id === currentId ? ' aria-current="true"' : ''}>
          <span class="tree-id">${escapeHtml(node.id)}</span>
          <span class="tree-title">${escapeHtml(node.title)}</span>
        </button>`;
    })
    .join('');

  return `
    <div class="tree">
      <div class="tree-legend">
        <span class="legend-item"><span class="legend-dot unit-1"></span>Unidad 1 · la materia</span>
        <span class="legend-item"><span class="legend-dot unit-2"></span>Unidad 2 · el atomo</span>
        <span class="legend-item"><span class="legend-dot is-planned"></span>Rama prevista</span>
        <span class="legend-item"><span class="legend-line is-cross"></span>Cruza de unidad</span>
      </div>

      <p class="tree-lead">
        De arriba abajo, el orden en que se puede estudiar: cada apartado esta por DEBAJO de todo lo
        que hace falta entender antes. Las flechas naranjas saltan de una unidad a otra — son las que
        no se ven leyendo, porque unen cosas separadas por cuarenta pantallas. Pulsa cualquier nodo
        para abrirlo.
      </p>

      <div class="tree-canvas" style="width:${width}px;height:${height}px">
        <svg class="tree-edges" width="${width}" height="${height}" aria-hidden="true">${paths}</svg>
        ${nodes}
      </div>
    </div>`;
}

/**
 * «Antes de esto» y «esto abre», al pie de un apartado.
 *
 * Es el arbol visto desde dentro de un apartado: sin salir a mirar el mapa, se
 * ve de que viene y a donde lleva. Las ramas previstas tambien aparecen, y son
 * la respuesta a «¿y esto para que me sirve?» cuando lo que sirve todavia no
 * esta escrito.
 */
export function renderLineage(
  before: readonly TreeNode[],
  after: readonly TreeNode[],
): string {
  if (before.length === 0 && after.length === 0) return '';

  const chips = (list: readonly TreeNode[]): string =>
    list
      .map(
        (n) =>
          `<button class="lineage-chip${n.state === 'previsto' ? ' is-planned' : ''}"
                   data-tree-node="${escapeHtml(n.id)}" data-state="${n.state}">
             <span class="tree-id">${escapeHtml(n.id)}</span>${escapeHtml(n.title)}
           </button>`,
      )
      .join('');

  return `
    <div class="lineage">
      ${
        before.length > 0
          ? `<div class="lineage-row">
               <span class="lineage-label">Antes de esto</span>
               <div class="lineage-chips">${chips(before)}</div>
             </div>`
          : ''
      }
      ${
        after.length > 0
          ? `<div class="lineage-row">
               <span class="lineage-label">Esto abre</span>
               <div class="lineage-chips">${chips(after)}</div>
             </div>`
          : ''
      }
    </div>`;
}

/** La ficha de una rama prevista, cuando se pulsa en el mapa. */
export function renderPlanned(node: TreeNode): string {
  return `
    <article class="topic planned-topic">
      <p class="topic-crumb">
        <span class="crumb-unit">Rama prevista</span>
        <span class="crumb-pos">sin escribir</span>
      </p>
      <h2 class="topic-title">
        <span class="topic-number">${escapeHtml(node.id)}</span>
        ${escapeHtml(node.title)}
      </h2>
      <p class="topic-body">${escapeHtml(node.note ?? '')}</p>

      ${
        node.engine
          ? `<div class="topic-key">
               <span class="topic-key-label">El motor ya existe</span>
               <code>${escapeHtml(node.engine)}</code> esta escrito y probado. Lo que falta aqui es el
               temario encima, no la quimica de debajo.
             </div>`
          : `<div class="topic-gap">
               <span class="topic-key-label">Lo que aqui no hay</span>
               Esta rama no tiene motor todavia: es trabajo nuevo, no una interfaz pendiente. Se
               dibuja en el mapa para que se vea donde encajaria, no para dar a entender que casi
               esta.
             </div>`
      }
    </article>`;
}
