/**
 * Industria (§42–§44).
 *
 * A SCADA-style control station over a real reactor model. The mimic diagram,
 * the tag readouts, the trends, the alarms and the PID faceplate are the ones
 * an operator would see, and the numbers behind them are the solution of the
 * mass and energy balances rather than a recording.
 *
 * The scale selector is the teaching centrepiece: the same chemistry, the same
 * kinetics and the same set point, run at four scales, showing why a reaction
 * that is trivially controlled in a flask becomes a runaway hazard in a 20 m³
 * reactor.
 */

import { h, replace, svg, type Child } from '../ui/dom.js';
import { screen, setContext, workbench } from '../ui/shell.js';
import {
  panel, button, badge, note, tabs, props, readout, emptyState, buttonGroup, toast,
} from '../ui/components.js';
import { href, route } from '../ui/router.js';
import { signal, effect, computed } from '../ui/reactive.js';
import { plot, type Series } from '../ui/plot.js';
import { fmt, fmtClock } from '../core/format.js';
import { kelvinToCelsius, celsiusToKelvin } from '../core/units.js';
import {
  SCALES, scaleById, surfaceToVolume, simulateReactor, simulateNeutralisation,
  reactorComparison, residenceTimeDistribution, checkAlarms, tagState,
  type Scale, type ProcessTag, type Alarm, type ReactorState,
} from '../process/plant.js';

export function industriaScreen(): HTMLElement {
  const r = route();
  const [, second] = r.segments;
  if (second === 'ph') return phControlView();
  return reactorView();
}

// ===========================================================================
// Reactor control station
// ===========================================================================

function reactorView(): HTMLElement {
  setContext([{ label: 'Industria' }, { label: 'Reactor de neutralización exotérmica' }]);

  const scale = signal<Scale>('laboratorio');
  const setpoint = signal(320);
  const coolant = signal(291);
  const kp = signal(0.6);
  const ti = signal(120);
  const td = signal(10);
  const controlOn = signal(true);
  const duration = signal(3600);
  const alarms = signal<Alarm[]>([]);

  const run = computed<ReactorState>(() => simulateReactor({
    scale: scaleById(scale()),
    // A strongly exothermic reaction with an adiabatic temperature rise of
    // ~180 K: ΔT_ad = (−ΔH)·C₀/(ρ·cp). That figure, not the kinetics, is what
    // decides whether a reactor is inherently safe, and it is why this one is
    // trivial to control at 500 mL and dangerous at 20 m³.
    C0: 5000,          // mol·m⁻³
    A: 4.2e10,
    Ea: 85000,
    deltaH: -150000,
    order: 1,
    rho: 1000,
    cp: 4180,
    coolantT: coolant(),
    T0: 298.15,
  }, {
    duration: duration(),
    setpoint: controlOn() ? setpoint() : undefined,
    pid: controlOn() ? { Kp: kp(), Ti: ti(), Td: td(), min: 0, max: 1, reverse: true } : undefined,
    points: 500,
    noiseSeed: `reactor:${scale()}`,
  }));

  // --- Tags ---------------------------------------------------------------
  const tags = computed<ProcessTag[]>(() => {
    const s = run();
    const last = s.T.length - 1;
    const spec = scaleById(scale());
    return [
      {
        id: 'TIC101', tag: 'TIC-101', label: 'Temperatura del reactor', unit: '°C',
        value: kelvinToCelsius(s.T[last] ?? 298), setpoint: kelvinToCelsius(setpoint()),
        kind: 'temperatura', hi: kelvinToCelsius(setpoint()) + 8, hiHi: kelvinToCelsius(setpoint()) + 25,
        lo: kelvinToCelsius(setpoint()) - 15,
      },
      {
        id: 'TI102', tag: 'TI-102', label: 'Temperatura de camisa', unit: '°C',
        value: kelvinToCelsius(coolant()), kind: 'temperatura',
      },
      {
        id: 'FCV101', tag: 'FCV-101', label: 'Válvula de refrigerante', unit: '%',
        value: (s.valve[last] ?? 0) * 100, kind: 'valvula', hi: 92, hiHi: 99,
      },
      {
        id: 'QI101', tag: 'QI-101', label: 'Conversión', unit: '%',
        value: (s.conversion[last] ?? 0) * 100, kind: 'composicion', lo: 5,
      },
      {
        id: 'JI101', tag: 'JI-101', label: 'Calor generado', unit: 'kW',
        value: (s.qGen[last] ?? 0) / 1000, kind: 'potencia',
      },
      {
        id: 'JI102', tag: 'JI-102', label: 'Calor evacuado', unit: 'kW',
        value: (s.qRem[last] ?? 0) / 1000, kind: 'potencia',
      },
      {
        id: 'LI101', tag: 'LI-101', label: 'Volumen del reactor', unit: 'm³',
        value: spec.volume, kind: 'nivel',
      },
    ];
  });

  effect(() => {
    const now = Date.now();
    const active = tags().map((t) => checkAlarms(t, now)).filter((a): a is Alarm => Boolean(a));
    if (run().runaway) {
      active.unshift({
        tag: 'TIC-101', priority: 'alta', time: now, acknowledged: false,
        message: 'DESBOCAMIENTO TÉRMICO: la generación de calor supera la capacidad de evacuación.',
      });
    }
    alarms.set(active);
  });

  // --- Mimic diagram ------------------------------------------------------
  const mimic = h('div', { class: 'scada' });
  effect(() => {
    const s = run();
    const t = tags();
    replace(mimic, mimicDiagram(t, s.runaway));
  });

  // --- Trends -------------------------------------------------------------
  const trends = h('div', { class: 'stack', style: { padding: 'var(--sp-4)' } });
  effect(() => {
    const s = run();
    const spec = scaleById(scale());
    const minutes = s.t.map((v) => v / 60);

    const tempSeries: Series[] = [
      { id: 'T', label: 'Temperatura del reactor', x: minutes, y: s.T.map(kelvinToCelsius), kind: 'line', colour: 2, width: 2 },
      { id: 'SP', label: 'Consigna', x: minutes, y: minutes.map(() => kelvinToCelsius(setpoint())), kind: 'line', colour: 5, dashed: true },
    ];

    replace(trends,
      s.runaway && note('danger', 'Pérdida de control térmico',
        h('div', { class: 'stack stack--tight' },
          h('p', { text: s.runawayReason ?? '' }),
          h('p', {},
            `A escala ${spec.label.toLowerCase()} la relación área/volumen vale `
            + `${surfaceToVolume(spec).toFixed(1)} m⁻¹, frente a ${surfaceToVolume(SCALES[0]).toFixed(0)} m⁻¹ `
            + 'en el laboratorio. El calor se genera en el volumen y se evacúa por la superficie, de modo '
            + `que la capacidad de refrigeración por unidad de volumen cae en la misma proporción: `
            + `unas ${(surfaceToVolume(SCALES[0]) / surfaceToVolume(spec)).toFixed(0)} veces peor. `
            + 'La misma receta que era segura en un matraz deja de serlo aquí.'),
          h('p', {},
            `El aumento adiabático de temperatura de esta carga es de ${s.adiabaticRise.toFixed(0)} K: `
            + 'eso es lo que subiría el reactor si se perdiera toda la refrigeración. Es el número que '
            + 'decide si un proceso es intrínsecamente seguro, y no depende de la escala.'),
          h('p', {}, 'Remedios posibles: bajar la temperatura de camisa, diluir la carga para reducir '
            + 'ΔT adiabático, o dosificar el reactivo limitante en semicontinuo en lugar de cargarlo de '
            + 'una vez, que es lo que se hace en la práctica industrial.'),
        )),
      plot({
        series: tempSeries,
        x: { label: 'Tiempo', unit: 'min' },
        y: { label: 'Temperatura', unit: '°C' },
        height: 260,
        caption: 'La temperatura es la solución del balance de energía del reactor, no una curva '
          + 'prefijada: es la diferencia entre el calor que genera la reacción y el que evacúa la camisa.',
      }),
      h('div', { class: 'grid grid--2' },
        plot({
          series: [
            { id: 'gen', label: 'Calor generado', x: minutes, y: s.qGen.map((v) => v / 1000), kind: 'line', colour: 2 },
            { id: 'rem', label: 'Calor evacuado', x: minutes, y: s.qRem.map((v) => v / 1000), kind: 'line', colour: 1 },
          ],
          x: { label: 'Tiempo', unit: 'min' },
          y: { label: 'Potencia térmica', unit: 'kW', includeZero: true },
          height: 200,
          caption: 'Cuando la curva de generación se separa de la de evacuación, el reactor se calienta '
            + 'y la generación aumenta todavía más: ese es el bucle del desbocamiento.',
        }),
        plot({
          series: [
            { id: 'X', label: 'Conversión', x: minutes, y: s.conversion.map((v) => v * 100), kind: 'line', colour: 3 },
            { id: 'V', label: 'Apertura de válvula', x: minutes, y: s.valve.map((v) => v * 100), kind: 'line', colour: 5 },
          ],
          x: { label: 'Tiempo', unit: 'min' },
          y: { label: 'Porcentaje', unit: '%', domain: [0, 105] },
          height: 200,
          caption: 'La válvula saturada al 100 % significa que el lazo ha perdido el control: ya no hay '
            + 'margen de refrigeración.',
        }),
      ),
    );
  });

  // --- Rails --------------------------------------------------------------
  const left = h('div', {},
    section('Escala del proceso',
      h('div', { class: 'stack' },
        h('div', { class: 'stack stack--tight' },
          ...SCALES.map((sc) => {
            const btn = button(sc.label, { size: 'sm', block: true, on: { click: () => scale.set(sc.id) } });
            effect(() => btn.setAttribute('aria-pressed', String(scale() === sc.id)));
            return btn;
          }),
        ),
        h('div', { bindText: () => '' , ref: (el) => {
          effect(() => {
            const spec = scaleById(scale());
            replace(el,
              props([
                ['Volumen', `${spec.volume} m³`],
                ['Área de intercambio', `${spec.area} m²`],
                ['Área / volumen', `${surfaceToVolume(spec).toFixed(1)} m⁻¹`],
                ['U', `${spec.U} W·m⁻²·K⁻¹`],
                ['Tiempo de mezcla', `${spec.mixingTime} s`],
              ]),
              h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)', lineHeight: '1.6', marginTop: 'var(--sp-2)' }, text: spec.note }),
            );
          });
        } }),
      ),
    ),
    section('Lazo de control TIC-101',
      h('div', { class: 'stack' },
        toggleRow('Control automático', controlOn),
        numberRow('Consigna', setpoint, 300, 400, 1, 'K', (v) => `${v.toFixed(0)} K / ${kelvinToCelsius(v).toFixed(0)} °C`),
        numberRow('Temperatura de camisa', coolant, 273, 340, 1, 'K', (v) => `${kelvinToCelsius(v).toFixed(0)} °C`),
        h('div', { class: 'divider' }),
        h('div', { class: 'caps dim', text: 'Sintonía PID' }),
        numberRow('Kp', kp, 0.01, 5, 0.01, '', (v) => v.toFixed(2)),
        numberRow('Ti', ti, 5, 600, 5, 's', (v) => `${v.toFixed(0)} s`),
        numberRow('Td', td, 0, 120, 1, 's', (v) => `${v.toFixed(0)} s`),
        note('info', null,
          'Sube Kp hasta que el lazo oscile: eso es el límite de estabilidad, y la sintonía de '
          + 'Ziegler-Nichols parte precisamente de ahí. La oscilación no está programada; aparece '
          + 'porque el lazo cerrado se vuelve realmente inestable.'),
      ),
    ),
    section('Simulación',
      numberRow('Duración', duration, 300, 14400, 300, 's', (v) => `${(v / 60).toFixed(0)} min`),
    ),
  );

  const right = h('div');
  effect(() => {
    const t = tags();
    const a = alarms();
    replace(right,
      section('Variables de proceso',
        h('div', { class: 'stack stack--tight' },
          ...t.map((tag) => readout({
            label: `${tag.tag} · ${tag.label}`,
            value: fmt(tag.value, { sig: 4 }),
            unit: tag.unit === '°C' ? undefined : undefined,
            sub: tag.setpoint !== undefined ? `SP ${tag.setpoint.toFixed(1)} ${tag.unit}` : tag.unit,
            size: 'sm',
            provenance: 'measured',
            tone: tagState(tag) === 'alarm' ? 'alarm' : tagState(tag) === 'warn' ? 'warn' : 'normal',
          })),
        ),
      ),
      section('Alarmas',
        a.length === 0
          ? h('p', { class: 'dim', style: { fontSize: 'var(--fs-2xs)' }, text: 'Sin alarmas activas.' })
          : h('div', { class: 'alarms' },
            ...a.map((al) => h('div', { class: `alarm alarm--${al.priority === 'alta' ? 'hi' : al.priority === 'media' ? 'med' : 'lo'}${al.acknowledged ? '' : ' alarm--unack'}` },
              h('span', { class: 'alarm__pri', text: al.priority.toUpperCase().slice(0, 3) }),
              h('span', { class: 'alarm__tag', text: al.tag }),
              h('span', { class: 'alarm__msg', text: al.message }),
              h('span', { class: 'alarm__t', text: fmtClock(al.time) }),
            )),
          ),
      ),
      section('Comparación de reactores',
        (() => {
          const k = 0.002;
          const taus = Array.from({ length: 60 }, (_, i) => i * 40 + 10);
          const comp = taus.map((tau) => reactorComparison(k, tau, 1));
          return plot({
            series: [
              { id: 'cstr', label: 'CSTR', x: taus.map((t) => t / 60), y: comp.map((c) => c.cstr * 100), kind: 'line', colour: 1 },
              { id: 'pfr', label: 'Flujo pistón', x: taus.map((t) => t / 60), y: comp.map((c) => c.pfr * 100), kind: 'line', colour: 3 },
            ],
            x: { label: 'Tiempo de residencia', unit: 'min' },
            y: { label: 'Conversión', unit: '%', domain: [0, 105] },
            height: 170,
            caption: 'Para el mismo volumen y la misma cinética de primer orden, el flujo pistón siempre '
              + 'convierte más: en un tanque agitado toda la mezcla está a la concentración de salida, '
              + 'que es la más baja posible.',
          });
        })(),
      ),
      section('Distribución de tiempos de residencia',
        (() => {
          const tau = 600;
          const rtd = residenceTimeDistribution(tau, 2400, 120);
          return plot({
            series: [
              { id: 'E', label: 'E(t)', x: rtd.t.map((t) => t / 60), y: rtd.E.map((v) => v * 60), kind: 'line', colour: 4 },
              { id: 'F', label: 'F(t)', x: rtd.t.map((t) => t / 60), y: rtd.F, kind: 'line', colour: 6 },
            ],
            x: { label: 'Tiempo', unit: 'min' },
            y: { label: 'E(t) / min⁻¹ y F(t)' },
            height: 170,
            caption: 'En un tanque perfectamente agitado hay moléculas que salen inmediatamente y otras '
              + 'que permanecen mucho más que el tiempo medio: eso es lo que penaliza la conversión.',
          });
        })(),
      ),
    );
  });

  return workbench({
    toolbar: [
      h('span', { class: 'caps dim', text: 'Estación de control · Reactor discontinuo encamisado' }),
      h('div', { class: 'divider--v' }),
      h('span', { class: 'dim', style: { fontSize: 'var(--fs-2xs)' }, bindText: () => scaleById(scale()).label }),
      h('div', { class: 'spacer' }),
      h('a', { class: 'btn btn--sm', href: href('industria/ph') }, 'Control de pH →'),
    ],
    left,
    stage: h('div', { class: 'stack', style: { padding: 'var(--sp-4)', minHeight: '0' } },
      panel({ title: 'Sinóptico', flush: true }, mimic),
      trends,
    ),
    right,
  });
}

/** The mimic diagram: a real P&ID-style schematic with live tag values. */
function mimicDiagram(tags: ProcessTag[], runaway: boolean): SVGSVGElement {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const root = svg('svg', {
    class: 'scada__svg', viewBox: '0 0 720 300', width: '100%', height: 300,
    role: 'img', 'aria-label': 'Sinóptico del reactor con sus variables de proceso',
  });

  const valveTag = byId.get('FCV101');
  const tempTag = byId.get('TIC101');
  const valveOpen = (valveTag?.value ?? 0) / 100;

  // Coolant supply line
  root.appendChild(svg('path', { d: 'M40 60 H 200', class: `pipe ${valveOpen > 0.02 ? 'pipe--active pipe--flow' : ''}` }));
  root.appendChild(svg('text', { x: 40, y: 50, class: 'tag' }, 'Refrigerante'));

  // Control valve
  root.appendChild(svg('path', { d: 'M200 46 L 220 60 L 200 74 Z', class: 'unit' }));
  root.appendChild(svg('path', { d: 'M240 46 L 220 60 L 240 74 Z', class: 'unit' }));
  root.appendChild(svg('line', { x1: 220, y1: 46, x2: 220, y2: 28, class: 'pipe' }));
  root.appendChild(svg('circle', { cx: 220, cy: 22, r: 12, class: 'unit' }));
  root.appendChild(svg('text', { x: 220, y: 25, class: 'unit-label' }, 'FCV'));
  root.appendChild(svg('text', { x: 220, y: 92, class: 'tag' }, 'FCV-101'));
  root.appendChild(svg('text', {
    x: 220, y: 104,
    class: `tag tag-value${(valveTag && tagState(valveTag) === 'alarm') ? ' tag-value--alarm' : (valveTag && tagState(valveTag) === 'warn') ? ' tag-value--warn' : ''}`,
  }, `${(valveTag?.value ?? 0).toFixed(0)} %`));

  root.appendChild(svg('path', { d: 'M240 60 H 300 V 110', class: `pipe ${valveOpen > 0.02 ? 'pipe--active pipe--flow' : ''}` }));

  // Reactor vessel with jacket
  root.appendChild(svg('rect', { x: 300, y: 110, width: 140, height: 130, rx: 10, class: `unit${runaway ? ' unit--alarm' : ''}` }));
  root.appendChild(svg('rect', { x: 312, y: 122, width: 116, height: 106, rx: 6, class: 'unit', fill: 'var(--accent-soft)' }));
  root.appendChild(svg('text', { x: 370, y: 232, class: 'unit-label' }, 'R-101'));

  // Agitator
  root.appendChild(svg('line', { x1: 370, y1: 100, x2: 370, y2: 210, class: 'pipe' }));
  root.appendChild(svg('line', { x1: 350, y1: 208, x2: 390, y2: 208, class: 'pipe' }));
  root.appendChild(svg('circle', { cx: 370, cy: 96, r: 10, class: 'unit' }));
  root.appendChild(svg('text', { x: 370, y: 84, class: 'tag' }, 'M'));

  // Temperature transmitter
  root.appendChild(svg('circle', { cx: 480, cy: 150, r: 20, class: 'unit' }));
  root.appendChild(svg('line', { x1: 440, y1: 150, x2: 460, y2: 150, class: 'pipe' }));
  root.appendChild(svg('text', { x: 480, y: 147, class: 'unit-label' }, 'TIC'));
  root.appendChild(svg('text', { x: 480, y: 159, class: 'unit-label' }, '101'));
  root.appendChild(svg('line', { x1: 480, y1: 130, x2: 480, y2: 60, x3: undefined, class: 'pipe', 'stroke-dasharray': '3 3' }));
  root.appendChild(svg('path', { d: 'M480 60 H 232', class: 'pipe', 'stroke-dasharray': '3 3' }));

  root.appendChild(svg('text', { x: 548, y: 132, class: 'tag' }, 'TIC-101'));
  root.appendChild(svg('text', {
    x: 548, y: 152, class: `tag tag-value${runaway ? ' tag-value--alarm' : ''}`,
    'font-size': '17',
  }, `${(tempTag?.value ?? 0).toFixed(1)} °C`));
  root.appendChild(svg('text', { x: 548, y: 168, class: 'tag' },
    `SP ${(tempTag?.setpoint ?? 0).toFixed(0)} °C`));

  // Coolant return
  root.appendChild(svg('path', { d: 'M300 240 H 240 V 270 H 40', class: `pipe pipe--hot ${valveOpen > 0.02 ? 'pipe--flow' : ''}` }));
  root.appendChild(svg('text', { x: 40, y: 286, class: 'tag' }, 'Retorno'));

  // Product outlet
  root.appendChild(svg('path', { d: 'M440 200 H 545', class: 'pipe' }));
  root.appendChild(svg('text', { x: 548, y: 196, class: 'tag' }, 'Producto'));
  const conv = byId.get('QI101');
  root.appendChild(svg('text', { x: 548, y: 212, class: 'tag tag-value' }, `X = ${(conv?.value ?? 0).toFixed(1)} %`));

  // Heat duty annotation
  const gen = byId.get('JI101');
  const rem = byId.get('JI102');
  root.appendChild(svg('text', { x: 40, y: 130, class: 'tag' }, 'Balance térmico'));
  root.appendChild(svg('text', { x: 40, y: 148, class: 'tag tag-value' }, `Q gen = ${fmt(gen?.value ?? 0, { sig: 3 })} kW`));
  root.appendChild(svg('text', { x: 40, y: 164, class: 'tag tag-value' }, `Q evac = ${fmt(rem?.value ?? 0, { sig: 3 })} kW`));

  return root;
}

// ===========================================================================
// pH control station
// ===========================================================================

function phControlView(): HTMLElement {
  setContext([
    { label: 'Industria', href: href('industria') },
    { label: 'Control de pH de un efluente' },
  ]);

  const setpointPH = signal(7.0);
  const acidIn = signal(10);
  const kp = signal(0.4);
  const ti = signal(180);
  const td = signal(0);

  const run = computed(() => simulateNeutralisation({
    flow: 0.002,
    acidIn: acidIn(),
    volume: 4,
    baseConcentration: 1000,
    maxDose: 0.00005,
    setpointPH: setpointPH(),
    pid: { Kp: kp(), Ti: ti(), Td: td(), min: 0, max: 1 },
  }, 7200, 700));

  const stage = h('div', { class: 'stack', style: { padding: 'var(--sp-4)' } });
  effect(() => {
    const r = run();
    replace(stage,
      plot({
        series: [
          { id: 'ph', label: 'pH del efluente', x: r.t, y: r.pH, kind: 'line', colour: 1, width: 2 },
          { id: 'sp', label: 'Consigna', x: r.t, y: r.setpoint, kind: 'line', colour: 5, dashed: true },
        ],
        x: { label: 'Tiempo', unit: 'min' },
        y: { label: 'pH', domain: [0, 14] },
        height: 280,
        regions: [{ axis: 'y', from: 6, to: 9, label: 'límite de vertido', colour: 'var(--ok)' }],
        caption: 'El pH del tanque sale de resolver exactamente [H⁺] − Kw/[H⁺] = exceso, sin dividir en '
          + 'casos: por eso la curva es continua al atravesar la neutralidad.',
      }),
      plot({
        series: [{ id: 'dose', label: 'Bomba dosificadora', x: r.t, y: r.dose, kind: 'line', colour: 3 }],
        x: { label: 'Tiempo', unit: 'min' },
        y: { label: 'Dosificación', unit: '%', domain: [0, 105] },
        height: 180, legend: false,
        caption: 'Una dosificación que oscila entre 0 y 100 % indica que la ganancia del lazo es '
          + 'demasiado alta para la zona de trabajo.',
      }),
    );
  });

  const left = h('div', {},
    section('Proceso',
      h('div', { class: 'stack' },
        numberRow('Acidez del influente', acidIn, 1, 100, 1, 'mol/m³', (v) => `${v.toFixed(0)} mol·m⁻³`),
        numberRow('Consigna de pH', setpointPH, 4, 10, 0.1, '', (v) => v.toFixed(1)),
      ),
    ),
    section('Sintonía del lazo',
      h('div', { class: 'stack' },
        numberRow('Kp', kp, 0.01, 3, 0.01, '', (v) => v.toFixed(2)),
        numberRow('Ti', ti, 10, 900, 10, 's', (v) => `${v.toFixed(0)} s`),
        numberRow('Td', td, 0, 120, 1, 's', (v) => `${v.toFixed(0)} s`),
      ),
    ),
    section('Por qué es difícil',
      h('p', { class: 'prose', style: { fontSize: 'var(--fs-xs)', maxWidth: 'none' } },
        'El control de pH es el ejemplo canónico de proceso no lineal. La ganancia del proceso —cuánto '
        + 'se mueve el pH por unidad de base añadida— cambia varios órdenes de magnitud entre la zona '
        + 'ácida y la neutralidad. Una sintonía que funciona a pH 4 se vuelve inestable al acercarse a '
        + '7, y una que es estable en 7 resulta desesperadamente lenta en 4.'),
    ),
  );

  const right = h('div');
  effect(() => {
    const r = run();
    const last = r.pH.length - 1;
    const settled = r.pH.slice(-100);
    const mean = settled.reduce((s, v) => s + v, 0) / settled.length;
    const sd = Math.sqrt(settled.reduce((s, v) => s + (v - mean) ** 2, 0) / settled.length);

    replace(right,
      section('Estado del lazo',
        h('div', { class: 'stack stack--tight' },
          readout({ label: 'pH actual', value: r.pH[last].toFixed(2), provenance: 'measured',
            tone: Math.abs(r.pH[last] - setpointPH()) > 1 ? 'warn' : 'normal' }),
          readout({ label: 'Dosificación', value: `${r.dose[last].toFixed(1)}`, unit: '', size: 'sm', provenance: 'measured' }),
        ),
      ),
      section('Índices de comportamiento',
        h('div', { class: 'stack stack--tight' },
          props([
            ['IAE', fmt(r.iae, { sig: 5 })],
            ['pH medio (últimos puntos)', mean.toFixed(3)],
            ['Desviación típica', sd.toFixed(4)],
            ['Error final', (r.pH[last] - setpointPH()).toFixed(3)],
          ]),
          note(sd > 0.3 ? 'warn' : 'ok', null,
            sd > 0.3
              ? 'El lazo oscila alrededor de la consigna. Reduce Kp o aumenta Ti.'
              : 'El lazo se ha estabilizado dentro de la banda aceptable.'),
          h('p', { class: 'dim', style: { fontSize: 'var(--fs-3xs)', lineHeight: '1.5' },
            text: 'La integral del error absoluto (IAE) es el índice habitual para comparar sintonías: '
              + 'penaliza tanto la lentitud como la oscilación.' }),
        ),
      ),
    );
  });

  return workbench({
    toolbar: [
      h('span', { class: 'caps dim', text: 'Neutralización de efluente · Control de pH' }),
      h('div', { class: 'spacer' }),
      h('a', { class: 'btn btn--sm', href: href('industria') }, '← Reactor'),
    ],
    left, stage, right,
  });
}

// ---------------------------------------------------------------------------

function section(title: string, ...body: Child[]): HTMLElement {
  return h('div', { class: 'rail__section', dataset: { open: 'true' } },
    h('div', { class: 'rail__head', style: { cursor: 'default' } }, title),
    h('div', { class: 'rail__body' }, ...body),
  );
}

function numberRow(
  label: string, sig: ReturnType<typeof signal<number>>,
  min: number, max: number, step: number, unit: string,
  format: (v: number) => string,
): HTMLElement {
  const input = h('input', {
    class: 'slider__range', type: 'range',
    min: String(min), max: String(max), step: String(step),
    on: { input: (ev) => sig.set(Number((ev.target as HTMLInputElement).value)) },
  });
  effect(() => { if (document.activeElement !== input) input.value = String(sig()); });
  return h('div', { class: 'slider' },
    h('div', { class: 'slider__top' },
      h('span', { class: 'field__label', text: label }),
      h('span', { class: 'slider__value', bindText: () => format(sig()) }),
    ),
    input,
    h('div', { class: 'slider__scale' },
      h('span', { text: format(min) }),
      h('span', { text: format(max) }),
    ),
  );
}

function toggleRow(label: string, sig: ReturnType<typeof signal<boolean>>): HTMLElement {
  const cb = h('input', { type: 'checkbox', on: { change: (ev) => sig.set((ev.target as HTMLInputElement).checked) } });
  effect(() => { cb.checked = sig(); });
  return h('label', { class: 'switch' },
    cb, h('span', { class: 'switch__track' }), h('span', { class: 'switch__label', text: label }),
  );
}

void tabs; void badge; void emptyState; void buttonGroup; void toast; void celsiusToKelvin;
