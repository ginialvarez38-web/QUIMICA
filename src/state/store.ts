/**
 * Persistent world state.
 *
 * §67: the laboratory must feel like a place that stays as you left it.
 * Reagents consumed stay consumed, an instrument left uncalibrated stays
 * uncalibrated, samples keep their history, and an experiment interrupted
 * resumes. All of it is versioned (§84) so a later change to the science
 * engines does not silently invalidate a stored experiment.
 *
 * Storage is `localStorage` — the only durable store available to a page with
 * no backend. Every read is defensive: a corrupted or absent record produces a
 * fresh default rather than a broken application.
 */

import { signal, effect, type Signal } from '../ui/reactive.js';

/** Bumped whenever the persisted shape changes; older saves are migrated. */
export const STATE_VERSION = 3;

/** Version of the scientific models, recorded with every stored result (§84). */
export const MODEL_VERSION = '1.0.0';

const STORAGE_KEY = 'chemia:state:v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Theme = 'light' | 'dark' | 'system';
export type RealismMode = 'educativo' | 'universitario' | 'profesional';

export const REALISM_LABEL: Record<RealismMode, string> = {
  educativo: 'Educativo',
  universitario: 'Universitario',
  profesional: 'Profesional',
};

export const REALISM_DESCRIPTION: Record<RealismMode, string> = {
  educativo: 'Modelos simplificados, sin ruido instrumental. Para comprender el fenómeno antes que la medida.',
  universitario: 'Modelo cuantitativo completo con incertidumbre y error experimental realistas.',
  profesional: 'Máxima complejidad: deriva, contaminación, restricciones de tiempo y coste, y consecuencias de una calibración incorrecta.',
};

/** The seven competencies of §59. */
export type Competency =
  | 'quimica' | 'matematica' | 'fisica' | 'laboratorio'
  | 'instrumentos' | 'analisis' | 'investigacion';

export const COMPETENCY_LABEL: Record<Competency, string> = {
  quimica: 'Química',
  matematica: 'Matemática',
  fisica: 'Física',
  laboratorio: 'Laboratorio',
  instrumentos: 'Instrumentos',
  analisis: 'Análisis',
  investigacion: 'Investigación',
};

export interface TopicProgress {
  /** 0–1. */
  mastery: number;
  /** Times the topic has been studied. */
  visits: number;
  lastVisited: number;
  /** Hints used, by level — recorded for pedagogical analysis (§58). */
  hintsUsed: number[];
  /** Problems attempted and solved. */
  attempted: number;
  solved: number;
}

export interface CourseProgress {
  started: number | null;
  completed: number | null;
  /** Fraction of the course's topics with mastery ≥ 0.6. */
  progress: number;
  examScores: Array<{ date: number; score: number; kind: string }>;
}

export interface ReagentStock {
  substanceId: string;
  /** Amount remaining. Solids in grams, liquids and solutions in litres. */
  amount: number;
  unit: 'g' | 'L';
  /** Concentration for a prepared solution, mol·L⁻¹. */
  concentration?: number;
  /** Lot number — the traceability chain the notebook records (§39). */
  lot: string;
  openedAt: number;
  /** Purity as certified, mass fraction. */
  purity: number;
  /** Free-text notes, e.g. "carbonatado, renormalizar". */
  notes?: string;
}

export interface InstrumentState {
  instrumentId: string;
  /** When the instrument was last calibrated; null if never. */
  calibratedAt: number | null;
  /** Calibration parameters actually obtained — slope, offset, response factors. */
  calibration: Record<string, number> | null;
  /** Quality of the calibration, 0–1; a bad calibration degrades every result. */
  calibrationQuality: number;
  /** Cumulative running hours, which drives drift and maintenance. */
  hoursUsed: number;
  /** Persistent contamination carried over from a previous sample. */
  contamination: Array<{ substanceId: string; amount: number; from: string }>;
  faults: string[];
}

export interface SampleRecord {
  id: string;
  label: string;
  /** True composition — hidden from the student for an unknown (§40). */
  composition: Record<string, number>;
  volume: number;
  createdAt: number;
  /** Where it came from: a preparation, a dilution, an aliquot, a field sample. */
  origin: string;
  /** Every action applied to it, in order — the contamination trail of §34. */
  history: Array<{ t: number; action: string; detail: string; flag?: 'warn' | 'danger' }>;
  /** True when the student is not meant to see the composition. */
  unknown: boolean;
  /** Set once the student has correctly identified an unknown. */
  identified?: boolean;
}

export interface ExperimentRecord {
  id: string;
  title: string;
  courseId?: string;
  protocolId?: string;
  startedAt: number;
  completedAt: number | null;
  /** Model version used, so an old experiment is never silently re-interpreted. */
  modelVersion: string;
  realism: RealismMode;
  /** The notebook entry (§39). */
  notebook: NotebookEntry;
  /** Raw measurements, exactly as the instruments produced them. */
  data: Array<{ t: number; instrument: string; quantity: string; value: number; unit: string; uncertainty: number }>;
  status: 'en curso' | 'completado' | 'abandonado';
}

export interface NotebookEntry {
  objective: string;
  hypothesis: string;
  materials: string[];
  reagents: Array<{ substanceId: string; lot: string; amount: string }>;
  instruments: Array<{ instrumentId: string; calibratedAt: number | null }>;
  procedure: string[];
  observations: string[];
  calculations: string[];
  results: string;
  errors: string;
  conclusion: string;
}

export interface ResearchProject {
  id: string;
  number: number;
  title: string;
  problem: string;
  status: 'abierto' | 'en curso' | 'entregado' | 'evaluado';
  hypothesis?: string;
  variables?: { independent: string; dependent: string; controlled: string[] };
  design?: string;
  /** Constraints: time in hours, budget in currency units, available instruments. */
  constraints: { hours: number; budget: number; instruments: string[] };
  /** Resources consumed so far. */
  used: { hours: number; budget: number };
  experiments: string[];
  report?: string;
  startedAt: number | null;
  score?: number;
}

export interface ChemiaState {
  version: number;
  createdAt: number;
  lastActive: number;

  settings: {
    theme: Theme;
    realism: RealismMode;
    activityModel: 'ideal' | 'debye-huckel' | 'extended-dh' | 'davies';
    /** Show experimental error; §33 says on by default. */
    experimentalError: boolean;
    navCollapsed: boolean;
    reduceMotion: boolean;
    /** Examination mode: the tutor will not solve problems (§57). */
    examMode: boolean;
  };

  profile: {
    name: string;
    competencies: Record<Competency, number>;
    /** Total study minutes. */
    studyMinutes: number;
    streak: number;
    lastStudyDay: string;
  };

  /** Progress keyed by topic id. */
  topics: Record<string, TopicProgress>;
  courses: Record<string, CourseProgress>;

  /** Where the student left off. */
  continueAt: { courseId: string; topicId: string; label: string } | null;

  lab: {
    reagents: ReagentStock[];
    instruments: Record<string, InstrumentState>;
    samples: SampleRecord[];
    /** Glassware currently on the bench, with what it holds. */
    bench: Array<{ glasswareId: string; instanceId: string; contents: string | null; clean: boolean; x: number; y: number }>;
    wasteLog: Array<{ t: number; stream: string; substanceId: string; amount: number }>;
  };

  experiments: ExperimentRecord[];
  projects: ResearchProject[];

  /** Recent activity for the home screen. */
  activity: Array<{ t: number; kind: string; label: string; href: string }>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** The reagent shelf a teaching laboratory starts with. */
function defaultReagents(): ReagentStock[] {
  const now = Date.now();
  const mk = (substanceId: string, amount: number, unit: 'g' | 'L', purity: number, concentration?: number): ReagentStock => ({
    substanceId, amount, unit, purity, concentration,
    lot: `L${String(Math.floor(now / 86400000) % 9000 + 1000)}-${substanceId.slice(0, 3).toUpperCase()}`,
    openedAt: now,
  });
  return [
    mk('naoh', 500, 'g', 0.98),
    mk('hcl', 2.5, 'L', 1, 1.0),
    mk('h2so4', 1, 'L', 0.98),
    mk('ch3cooh', 1, 'L', 0.998),
    mk('nh3', 1, 'L', 1, 2.0),
    mk('khp', 250, 'g', 0.9995),
    mk('na2co3', 500, 'g', 0.999),
    mk('nahco3', 500, 'g', 0.995),
    mk('nacl', 1000, 'g', 0.999),
    mk('agno3', 100, 'g', 0.999),
    mk('kmno4', 250, 'g', 0.99),
    mk('na2c2o4', 250, 'g', 0.9995),
    mk('ki', 250, 'g', 0.99),
    mk('na2s2o3', 500, 'g', 0.99),
    mk('h2o2', 0.5, 'L', 1, 8.8),
    mk('edta', 250, 'g', 0.99),
    mk('cuso4', 500, 'g', 0.99),
    mk('fecl3', 250, 'g', 0.97),
    mk('cacl2', 500, 'g', 0.96),
    mk('mgso4', 500, 'g', 0.99),
    mk('kh2po4', 500, 'g', 0.999),
    mk('na2hpo4', 500, 'g', 0.999),
    mk('etanol', 2.5, 'L', 0.96),
    mk('acetona', 2.5, 'L', 0.995),
    mk('h2o', 20, 'L', 1),
  ];
}

export function defaultState(): ChemiaState {
  const now = Date.now();
  return {
    version: STATE_VERSION,
    createdAt: now,
    lastActive: now,
    settings: {
      theme: 'system',
      realism: 'universitario',
      activityModel: 'davies',
      experimentalError: true,
      navCollapsed: false,
      reduceMotion: false,
      examMode: false,
    },
    profile: {
      name: 'Estudiante',
      competencies: {
        quimica: 0, matematica: 0, fisica: 0, laboratorio: 0,
        instrumentos: 0, analisis: 0, investigacion: 0,
      },
      studyMinutes: 0,
      streak: 0,
      lastStudyDay: '',
    },
    topics: {},
    courses: {},
    continueAt: null,
    lab: {
      reagents: defaultReagents(),
      instruments: {},
      samples: [],
      bench: [],
      wasteLog: [],
    },
    experiments: [],
    projects: [],
    activity: [],
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function migrate(raw: unknown): ChemiaState {
  const fresh = defaultState();
  if (typeof raw !== 'object' || raw === null) return fresh;
  const s = raw as Partial<ChemiaState>;

  // Deep-merge onto the defaults so a save written by an older version gains
  // the new fields rather than crashing the screens that read them.
  return {
    ...fresh,
    ...s,
    version: STATE_VERSION,
    settings: { ...fresh.settings, ...(s.settings ?? {}) },
    profile: {
      ...fresh.profile,
      ...(s.profile ?? {}),
      competencies: { ...fresh.profile.competencies, ...(s.profile?.competencies ?? {}) },
    },
    topics: s.topics ?? {},
    courses: s.courses ?? {},
    lab: {
      ...fresh.lab,
      ...(s.lab ?? {}),
      reagents: s.lab?.reagents?.length ? s.lab.reagents : fresh.lab.reagents,
      instruments: s.lab?.instruments ?? {},
      samples: s.lab?.samples ?? [],
      bench: s.lab?.bench ?? [],
      wasteLog: s.lab?.wasteLog ?? [],
    },
    experiments: s.experiments ?? [],
    projects: s.projects ?? [],
    activity: s.activity ?? [],
  };
}

function load(): ChemiaState {
  if (typeof localStorage === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch {
    // A corrupted save must not brick the application.
    return defaultState();
  }
}

export const state: Signal<ChemiaState> = signal(load(), () => false);

let saveTimer: ReturnType<typeof setTimeout> | undefined;
effect(() => {
  const current = state();
  if (typeof localStorage === 'undefined') return;
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Quota exceeded: trim the oldest experiments rather than losing everything.
      try {
        const trimmed = { ...current, experiments: current.experiments.slice(-20) };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch { /* give up silently; the session still works in memory */ }
    }
  }, 400);
});

/** Apply a change to the state. All mutations go through here. */
export function update(fn: (draft: ChemiaState) => void): void {
  const next = structuredClone(state.peek());
  fn(next);
  next.lastActive = Date.now();
  state.set(next);
}

export function resetState(): void {
  state.set(defaultState());
}

export function exportState(): string {
  return JSON.stringify(state.peek(), null, 2);
}

export function importState(json: string): { ok: boolean; error?: string } {
  try {
    state.set(migrate(JSON.parse(json)));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'JSON no válido' };
  }
}

// ---------------------------------------------------------------------------
// Domain operations
// ---------------------------------------------------------------------------

/**
 * Record study of a topic and let it raise the relevant competencies.
 *
 * Mastery rises with diminishing returns and is *reduced* by hint use, which is
 * what makes the hint ladder of §58 carry a real cost and the competency
 * profile of §59 mean something.
 */
export function recordTopicStudy(
  topicId: string,
  opts: { minutes: number; competencies?: Partial<Record<Competency, number>>; correct?: boolean; hintLevel?: number },
): void {
  update((s) => {
    const t = s.topics[topicId] ?? {
      mastery: 0, visits: 0, lastVisited: 0, hintsUsed: [], attempted: 0, solved: 0,
    };
    t.visits++;
    t.lastVisited = Date.now();
    if (opts.hintLevel !== undefined) t.hintsUsed.push(opts.hintLevel);
    if (opts.correct !== undefined) {
      t.attempted++;
      if (opts.correct) t.solved++;
    }

    // Diminishing returns: the first pass teaches most.
    const hintPenalty = opts.hintLevel !== undefined ? 1 - Math.min(opts.hintLevel, 3) * 0.22 : 1;
    const gain = (1 - t.mastery) * 0.34 * hintPenalty * (opts.correct === false ? 0.35 : 1);
    t.mastery = Math.min(1, t.mastery + gain);
    s.topics[topicId] = t;

    s.profile.studyMinutes += opts.minutes;
    for (const [k, v] of Object.entries(opts.competencies ?? {})) {
      const key = k as Competency;
      s.profile.competencies[key] = Math.min(1, s.profile.competencies[key] + (v ?? 0) * (1 - s.profile.competencies[key]));
    }

    const today = new Date().toISOString().slice(0, 10);
    if (s.profile.lastStudyDay !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      s.profile.streak = s.profile.lastStudyDay === yesterday ? s.profile.streak + 1 : 1;
      s.profile.lastStudyDay = today;
    }
  });
}

export function setContinuePoint(courseId: string, topicId: string, label: string): void {
  update((s) => { s.continueAt = { courseId, topicId, label }; });
}

export function pushActivity(kind: string, label: string, href: string): void {
  update((s) => {
    s.activity.unshift({ t: Date.now(), kind, label, href });
    s.activity = s.activity.slice(0, 40);
  });
}

/** Consume reagent from the shelf. Returns false when there is not enough. */
export function consumeReagent(substanceId: string, amount: number): { ok: boolean; lot?: string; remaining?: number } {
  const current = state.peek();
  const stock = current.lab.reagents.find((r) => r.substanceId === substanceId);
  if (!stock) return { ok: false };
  if (stock.amount < amount) return { ok: false, lot: stock.lot, remaining: stock.amount };
  update((s) => {
    const r = s.lab.reagents.find((x) => x.substanceId === substanceId);
    if (r) r.amount -= amount;
  });
  return { ok: true, lot: stock.lot, remaining: stock.amount - amount };
}

export function stockOf(substanceId: string): ReagentStock | undefined {
  return state().lab.reagents.find((r) => r.substanceId === substanceId);
}

export function instrumentState(instrumentId: string): InstrumentState {
  return state().lab.instruments[instrumentId] ?? {
    instrumentId,
    calibratedAt: null,
    calibration: null,
    calibrationQuality: 0,
    hoursUsed: 0,
    contamination: [],
    faults: [],
  };
}

export function saveInstrumentState(next: InstrumentState): void {
  update((s) => { s.lab.instruments[next.instrumentId] = next; });
}

export function addSample(sample: SampleRecord): void {
  update((s) => { s.lab.samples.unshift(sample); });
}

/**
 * Append an event to a sample's history.
 *
 * This is the mechanism behind §34: the pipette used on sample A and then on
 * the blank leaves a trace in both records, so the student can reconstruct
 * where the contamination came from instead of being told.
 */
export function logSampleEvent(sampleId: string, action: string, detail: string, flag?: 'warn' | 'danger'): void {
  update((s) => {
    const sample = s.lab.samples.find((x) => x.id === sampleId);
    sample?.history.push({ t: Date.now(), action, detail, flag });
  });
}

export function startExperiment(record: Omit<ExperimentRecord, 'modelVersion' | 'realism'>): void {
  update((s) => {
    s.experiments.unshift({
      ...record,
      modelVersion: MODEL_VERSION,
      realism: s.settings.realism,
    });
  });
}

export function updateExperiment(id: string, fn: (e: ExperimentRecord) => void): void {
  update((s) => {
    const e = s.experiments.find((x) => x.id === id);
    if (e) fn(e);
  });
}

export const activeExperiment = (): ExperimentRecord | undefined =>
  state().experiments.find((e) => e.status === 'en curso');

export function logWaste(stream: string, substanceId: string, amount: number): void {
  update((s) => {
    s.lab.wasteLog.unshift({ t: Date.now(), stream, substanceId, amount });
    s.lab.wasteLog = s.lab.wasteLog.slice(0, 200);
  });
}

// ---------------------------------------------------------------------------
// Derived views
// ---------------------------------------------------------------------------

export function topicMastery(topicId: string): number {
  return state().topics[topicId]?.mastery ?? 0;
}

/** Progress of a course as the mean mastery of its topics. */
export function courseProgress(topicIds: string[]): number {
  if (topicIds.length === 0) return 0;
  const s = state();
  const total = topicIds.reduce((sum, id) => sum + (s.topics[id]?.mastery ?? 0), 0);
  return total / topicIds.length;
}

/** Is a course unlocked, given the prerequisites the student has completed? */
export function courseUnlocked(prerequisites: string[], progressOf: (id: string) => number): boolean {
  return prerequisites.every((p) => progressOf(p) >= 0.6);
}

/**
 * The weakest competency, phrased as the diagnostic sentence §59 asks for.
 * Returns null until there is enough evidence to say anything honest.
 */
export function diagnoseWeakness(): { competency: Competency; value: number; message: string } | null {
  const c = state().profile.competencies;
  const entries = Object.entries(c) as Array<[Competency, number]>;
  const evidence = entries.reduce((s, [, v]) => s + v, 0);
  if (evidence < 0.15) return null;

  const [competency, value] = entries.reduce((min, e) => (e[1] < min[1] ? e : min));
  const messages: Record<Competency, string> = {
    quimica: 'Tu principal dificultad está en los fundamentos químicos: conviene reforzar equilibrio y estructura antes de avanzar.',
    matematica: 'Tu principal dificultad es el aparato matemático: las derivaciones y el manejo algebraico te están frenando más que la química.',
    fisica: 'Tu principal dificultad está en los fundamentos físicos, que sostienen la termodinámica y la instrumentación.',
    laboratorio: 'Tu principal dificultad es la técnica de laboratorio: la teoría te sale, pero el procedimiento experimental todavía no.',
    instrumentos: 'Tu principal dificultad es la instrumentación: conviene practicar calibraciones y comprender el origen del error instrumental.',
    analisis: 'Tu principal dificultad actual es el tratamiento estadístico de datos experimentales.',
    investigacion: 'Tu principal dificultad es el diseño de investigación: sabes ejecutar, pero todavía no plantear el problema.',
  };
  return { competency, value, message: messages[competency] };
}

/** Apply the stored theme to the document. */
export function applyTheme(): void {
  const theme = state().settings.theme;
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function setTheme(theme: Theme): void {
  update((s) => { s.settings.theme = theme; });
  applyTheme();
}

export function cycleTheme(): void {
  const order: Theme[] = ['system', 'light', 'dark'];
  const current = state().settings.theme;
  setTheme(order[(order.indexOf(current) + 1) % order.length]);
}
