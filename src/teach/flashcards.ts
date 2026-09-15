/**
 * TARJETAS DE REPASO.
 *
 * LAS TARJETAS NO SE ESCRIBEN APARTE: SE DERIVAN.
 *
 * Lo evidente habria sido anadir un campo `flash` a cada apartado y escribir
 * ahi cien preguntas nuevas. Habria sido un error, y ademas el mismo error que
 * se acaba de corregir en la interfaz: crear una SEGUNDA version de algo que
 * ya existe, que a partir de ese dia puede contradecir a la primera sin que
 * nadie se entere.
 *
 * Porque el temario ya tiene material en forma de pregunta y respuesta:
 *
 *   - `check`   la autocomprobacion de cada apartado. Estaba escrita para que
 *               el lector recuperara la idea de memoria antes de destaparla.
 *               Eso ES una tarjeta; lo unico que cambiaba era el envoltorio.
 *   - `worked`  el ejercicio resuelto. Su enunciado y su respuesta tambien
 *               forman un par, y encima uno que se contesta calculando.
 *
 * De ahi salen las 65 tarjetas. Trece apartados no tenian ni
 * autocomprobacion ni ejercicio — y esos no se han resuelto
 * inventando una tarjeta suelta, sino escribiendoles la autocomprobacion que
 * les faltaba. Asi la tarjeta y el apartado no pueden separarse nunca: son la
 * misma frase leida en dos sitios.
 *
 * CADA TARJETA DICE DE DONDE SALE
 * Igual que las pistas del guia. Si manana una respuesta resulta estar mal, se
 * sabe que apartado hay que corregir — y corrigiendolo se corrige la tarjeta.
 */

import type { TheoryTopic } from './theory.js';

/** De donde sale una tarjeta. No hay una tercera opcion a proposito. */
export type CardSource = 'comprobacion' | 'ejercicio';

export interface FlashCard {
  /**
   * Identificador estable: apartado + procedencia + orden.
   *
   * Tiene que sobrevivir a que se anada una tarjeta en medio, porque con el se
   * guarda lo que el lector ya se sabe. Un indice global («tarjeta 31») se
   * desplazaria entero al insertar una y el progreso quedaria movido de sitio.
   */
  readonly id: string;
  readonly topicId: string;
  readonly topicTitle: string;
  readonly front: string;
  readonly back: string;
  readonly from: CardSource;
}

/** Las tarjetas de UN apartado, en el orden en que conviene repasarlas. */
export function cardsOf<D>(topic: TheoryTopic<D>): FlashCard[] {
  const cards: FlashCard[] = [];

  // El ejercicio resuelto va primero: pregunta por algo concreto y se contesta
  // calculando, que es el tipo de tarjeta que mas cuesta y mas ensena.
  if (topic.worked) {
    cards.push({
      id: `${topic.id}#e0`,
      topicId: topic.id,
      topicTitle: topic.title,
      front: topic.worked.question,
      back: topic.worked.answer,
      from: 'ejercicio',
    });
  }

  for (const [index, check] of (topic.check ?? []).entries()) {
    cards.push({
      id: `${topic.id}#c${index}`,
      topicId: topic.id,
      topicTitle: topic.title,
      front: check.question,
      back: check.answer,
      from: 'comprobacion',
    });
  }

  return cards;
}

/** Todas las tarjetas de una unidad, en orden de temario. */
export function deckOf<D>(unit: TheoryTopic<D>): FlashCard[] {
  const out: FlashCard[] = [];
  const walk = (topic: TheoryTopic<D>) => {
    out.push(...cardsOf(topic));
    for (const child of topic.children ?? []) walk(child);
  };
  for (const child of unit.children ?? []) walk(child);
  return out;
}

/**
 * Baraja con semilla.
 *
 * Repasar siempre en el orden del temario ensena el ORDEN, no el contenido: se
 * acaba recordando que despues de la de isotopos viene la de isobaras, y eso
 * no es saber quimica. Pero tampoco vale un azar distinto en cada repintado,
 * porque entonces la tarjeta cambiaria al pulsar «la sabia» y el lector veria
 * saltar la baraja.
 *
 * Con semilla, la sesion entera mantiene un orden fijo y la siguiente trae
 * otro.
 */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = seed >>> 0 || 1;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  // Fisher-Yates, de atras hacia delante.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lo que el lector ya se sabe
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'quimica.tarjetas.v1';

/**
 * El progreso vive en el navegador de quien estudia, y en ningun otro sitio.
 *
 * Todos los accesos van envueltos: en una ventana privada, con las cookies
 * bloqueadas o dentro de una captura de miniatura, `localStorage` no solo
 * devuelve vacio — LANZA al tocarlo. Sin el envoltorio, abrir el temario en
 * modo incognito reventaria la pagina entera por no poder guardar una marca de
 * repaso, que es lo menos importante que hay aqui.
 */
export function loadProgress(): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveProgress(known: ReadonlySet<string>): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify([...known]));
  } catch {
    // Sin almacenamiento se repasa igual; lo unico que se pierde es recordar
    // entre visitas cuales ya se sabian.
  }
}

/** Cuantas del mazo estan marcadas como sabidas. */
export function progressOf(deck: readonly FlashCard[], known: ReadonlySet<string>): number {
  return deck.filter((card) => known.has(card.id)).length;
}
