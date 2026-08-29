# Arquitectura de CHEMIA

~24 400 líneas de TypeScript sin dependencias, organizadas en capas que sólo
dependen hacia abajo. `core/` no sabe que existe una interfaz; `ui/` no sabe
química.

```
core/      física, matemática y química puras — sin DOM
  ↑
data/      tablas de referencia declarativas
  ↑
domain/    entidades derivadas de core + data
  ↑
lab/  process/  content/  state/     dominios aplicados
  ↑
ui/        primitivas de interfaz genéricas
  ↑
screens/   las ocho secciones
  ↑
main.ts    router, límites de error, arranque
```

---

## `src/core/` — el motor

Nada aquí importa del DOM, y nada aquí importa de capas superiores.

| Módulo               | Responsabilidad                                                       |
| -------------------- | --------------------------------------------------------------------- |
| `constants.ts`       | constantes SI-2019 exactas; R y F **derivadas**, nunca citadas         |
| `units.ts`           | unidad canónica por dimensión, conversión afín para temperatura        |
| `uncertainty.ts`     | `Measurement {value, u, unit, provenance}`, propagación GUM, E_n       |
| `format.ts`          | formato científico, cifras significativas, fórmulas con subíndices     |

### `core/math/`

- `linalg.ts` — LU, RREF, espacio nulo, autovalores de Jacobi y reducción a
  enteros mínimos por fracciones continuas (para balancear ecuaciones).
- `roots.ts` — Brent, búsqueda en espacio logarítmico y `newtonSystem` con
  jacobiano numérico, búsqueda de línea con retroceso y límites.
- `ode.ts` — Cash–Karp RKF4(5) adaptativo que **aterriza exactamente** en los
  puntos de evaluación pedidos en lugar de interpolar.
- `stats.ts` — descriptivos, t crítica por bisección sobre la beta
  incompleta, regresión ponderada con bandas de confianza y de predicción,
  predicción inversa, límites de detección, Grubbs, Dixon Q,
  Levenberg–Marquardt, PCA.
- `random.ts` — Mulberry32 con semilla, ruido rosa, deriva de
  Ornstein–Uhlenbeck. El error experimental es aleatorio pero reproducible.
- `signal.ts` — perfiles gaussiano/lorentziano/pseudo-Voigt/EMG,
  Savitzky–Golay, línea base ALS con DᵀD pentadiagonal explícito, detección
  de picos, resolución cromatográfica.

### `core/chem/`

- `formula.ts` — analizador que acepta `H2SO4`, `Ca(OH)2`, `K4[Fe(CN)6]`,
  `CuSO4·5H2O`, `SO4^2-`, `SO4 2-`, `NH4+`, `Fe3+`; patrones isotópicos por
  convolución.
- `balance.ts` — separador de miembros que distingue un `+` de unión de un
  `+` de carga, y balanceo por espacio nulo entero. Cuando el sistema es
  genuinamente multidimensional (p. ej. MnO₄⁻ con H₂O₂) lo dice en lugar de
  fingir una solución única.
- `activity.ts` — Debye–Hückel y Davies con A y B **calculadas** a partir de
  `core/constants` y la permitividad del agua.
- `equilibrium.ts` — **el corazón del programa** (ver abajo).
- `solution.ts` — tabla de disociación y especies condicionales. Invariante:
  un ion es *componente* o *espectador*, nunca ambos.
- `titration.ts` — valoración punto a punto, puntos de equivalencia por
  derivada, indicadores y su error, diseño de tampones, especiación vs pH.
- `kinetics.ts` — mecanismos como grafos de pasos elementales; el sistema de
  ecuaciones de velocidad se **construye** a partir del mecanismo.
- `thermo.ts` — Gibbs, van 't Hoff, Le Châtelier deducido de Q frente a K,
  calorimetría, curvas de calentamiento, van der Waals, coligativas.
- `electrochem.ts` — estados de oxidación, 28 semirreacciones, Nernst, pila
  galvánica, Faraday, conductividad, Butler–Volmer, corrosión.

### El solucionador de equilibrio

Formulación de tableau componente/especie (la de MINEQL y PHREEQC). Las
concentraciones de especies se obtienen de las actividades libres de los
componentes mediante constantes de formación acumuladas β; el sistema se
resuelve por Newton–Raphson en log₁₀ con búsqueda de línea con retroceso, y
un bucle exterior autoconsistente para la fuerza iónica.

Tres decisiones lo hacen correcto en todos los casos y no sólo en los
fáciles:

1. **La ecuación del hidrógeno es la electroneutralidad**, no la condición
   protónica. La condición protónica deja de ser válida en cuanto el total
   de un componente queda libre (amoníaco, carbonato sódico), y con ella el
   solucionador no convergía.
2. **Los precipitados son incógnitas del propio Newton**, cada uno con su
   ecuación de Ksp. Calculados a posteriori siempre daban cero, porque el
   balance de materia ya estaba satisfecho.
3. **Un gas de fugacidad fija sustituye el balance de materia** del
   componente que controla, en lugar de ser una especie más. Así el agua
   destilada al aire libre da pH 5.610 a 400 ppm de CO₂ y 3.911 a 1 bar.

Los residuos se normalizan con escalas **fijas**, calculadas una vez por
iteración exterior. Normalizarlos con el término mayor de cada fila satura
el residuo cerca de 1 y aplana el gradiente: convergía el amoníaco y se
rompían todos los sistemas polipróticos.

---

## `src/data/` — tablas de referencia

Datos declarativos, sin lógica: 118 elementos (desde una cadena delimitada
por barras, para que el diff sea legible), isótopos, 37 sustancias, 15
moléculas con `geometrySource` que distingue geometría experimental de
construida, y 12 instrumentos con principio, componentes, controles, rango,
resolución, precisión, ruido, deriva, pasos de calibración, fuentes de
error, mantenimiento y coste por análisis.

## `src/domain/`

`substance.ts` **deriva** composición, carga y masa molar de la fórmula: no
hay masas molares escritas a mano que puedan desincronizarse. `search.ts`
indexa 13 tipos de entidad y construye el vecindario del grafo de
conocimiento.

## `src/lab/measure.ts`

Una lectura instrumental no es un número: es una tubería de
error de calibración → deriva → contaminación → sesgo del operador → ruido →
resolución. La calidad de una calibración degrada numéricamente **todas** las
lecturas posteriores hechas con ese instrumento.

## `src/process/plant.ts`

Controlador PID con anti-windup y reactores a cuatro escalas (laboratorio,
banco, planta piloto, industrial). La relación superficie/volumen cae al
subir de escala, de modo que el mismo lote controlado a escala de
laboratorio (48.4 °C) hierve en las tres escalas mayores. El criterio de
descontrol es físico —el medio hierve, o se superan 50 K sobre la consigna—
y no un umbral arbitrario que un lote nunca podría alcanzar.

## `src/content/`

`curriculum.ts` define 41 asignaturas y 414 temas. Los identificadores de
unidad, capítulo y tema se **cualifican con el de la asignatura** después de
declararlos; sin eso las 41 asignaturas compartían `u1.c1.…` y estudiar un
tema acreditaba temas ajenos. `concepts.ts` es un grafo de dependencias con
cadena de prerrequisitos. `lessons.ts` contiene lecciones escritas a mano;
todo lo demás se compone del grafo de conceptos y **se etiqueta como tal**.

## `src/state/store.ts`

Estado del mundo persistente y versionado en `localStorage`
(`chemia:state:v1`): reactivos con lotes, calibración de instrumentos,
muestras con historial, competencias. El mundo recuerda: un reactivo gastado
sigue gastado, un instrumento descalibrado sigue descalibrado.

## `src/ui/`

`reactive.ts` (señales), `dom.ts` (`h()` con manejadores tipados y
`bindAttrs`), `plot.ts`, `viewer3d.ts`, `equation.ts`, `router.ts`,
`omnisearch.ts`, `components.ts` y `shell.ts` (navegación, banco de trabajo,
atajos de teclado).

El banco de trabajo (`workbench()`) es una rejilla
`toolbar / left · stage · right / console`. Por debajo de 1180 px, un banco
con dos railes muestra uno cada vez y el conmutador de la barra de
herramientas elige; por debajo de 760 px los railes pasan a ser hojas
emergentes. El conmutador se dibuja **al principio** de la barra: colocado
tras el separador flexible quedaba fuera del borde derecho y el banco era
inutilizable en un teléfono.

---

## Estado de implementación

Honestamente, y en los términos del propio encargo:

**Implementado y funcional:** motor de equilibrio, valoración, cinética,
termodinámica, electroquímica, balanceo, tabla periódica, moléculas 3D,
medida instrumental con error, planta industrial con PID, análisis de datos,
plan de estudios completo, grafo de conceptos, estado persistente,
navegación, búsqueda universal, modo claro y oscuro.

**Parcial y declarado como tal:** la base de sustancias (37) y de moléculas
(15) es extensible, no exhaustiva. De los 414 temas del plan, tres tienen
lección redactada a mano; el resto se compone del grafo de conceptos y lo
dice explícitamente en pantalla. Ningún tema muestra relleno.

**Con motor pero sin banco propio:** espectroscopía y cromatografía. Las
primitivas de señal (perfiles de pico, línea base ALS, Savitzky–Golay,
detección de picos, resolución) y las fichas de los instrumentos existen y
están probadas, pero todavía no hay una pantalla instrumental dedicada que
las conduzca.

**No construido:** el laboratorio 3D transitable con manipulación directa de
material de vidrio (§29–§30) y el tutor de IA (§57–§58). No hay andamiaje
para ellos: no aparecen en la interfaz, ni como botón inerte ni como panel
vacío. El banco de laboratorio actual es una estación de instrumentos y
simulaciones, no una sala recorrible.

El panel «Estado de desarrollo» de la sección Perfil repite este inventario
dentro de la propia aplicación, para que no haya que leer este archivo para
saber qué está terminado.
