# CHEMIA

Plataforma universitaria interactiva de química: teoría, resolución de
problemas, matemática y física aplicadas, simulación química, laboratorio
virtual, instrumentación científica, moléculas en 3D, análisis de datos,
electroquímica, procesos industriales e investigación.

CHEMIA no es una aplicación de cursos con tarjetas de colores. Es una
estación de trabajo científica: la sensación de uso que persigue es la de
un laboratorio digital profesional, no la de un juego educativo.

---

## Puesta en marcha

No hay nada que instalar. El proyecto **no tiene dependencias** —ni de
producción ni de desarrollo— y se compila con el `tsc` global.

```bash
npm run build    # tsc -p tsconfig.json  →  build/
npm run serve    # servidor estático en http://localhost:4173
```

o, en un solo paso:

```bash
npm run dev
```

Otros comandos:

| Comando             | Qué hace                                                        |
| ------------------- | --------------------------------------------------------------- |
| `npm run watch`     | recompila al guardar                                             |
| `npm run typecheck` | comprueba tipos sin emitir                                       |
| `npm test`          | compila a `build-test/` y ejecuta la suite con `node --test`     |

Requiere Node ≥ 22 (por el ejecutor de pruebas integrado) y TypeScript ≥ 5.6
disponible como `tsc`.

### Por qué cero dependencias

El entorno de construcción no tiene acceso al registro de npm (devuelve
HTTP 403), de modo que ningún paquete es instalable. En lugar de dejar el
proyecto a medias, todo lo que normalmente aportaría una biblioteca está
escrito a mano y verificado:

- **Reactividad** (`src/ui/reactive.ts`): señales, efectos y valores
  derivados, en lugar de un framework.
- **Gráficas** (`src/ui/plot.ts`): motor SVG propio con ejes, escalas
  logarítmicas, bandas de incertidumbre y anotaciones.
- **3D molecular** (`src/ui/viewer3d.ts`): rasterizado por algoritmo del
  pintor sobre canvas 2D, en lugar de WebGL.
- **Álgebra, estadística, EDO, señal** (`src/core/math/`): LU, RREF, espacio
  nulo entero, autovalores de Jacobi, Cash–Karp RKF4(5), Rosenbrock
  semi-implícito, Levenberg–Marquardt, PCA, Savitzky–Golay, línea base ALS.
- **Pruebas** (`test/`): `node:test` con declaraciones de tipos propias, ya
  que `@types/node` tampoco es instalable.

El resultado es que `index.html` carga módulos ES nativos directamente: no
hay empaquetador, ni paso de transpilación más allá de `tsc`, ni
`node_modules`.

---

## Qué hay dentro

Ocho secciones, accesibles desde la barra lateral (escritorio) o la barra
inferior (móvil):

| Sección           | Contenido                                                                     |
| ----------------- | ----------------------------------------------------------------------------- |
| **Inicio**        | estado del trabajo, continuación, diagnóstico de competencias                 |
| **Universidad**   | 41 asignaturas, 414 temas, 269 créditos, 10 cuatrimestres, grafo de conceptos |
| **Laboratorio**   | valoración, cinética, calorimetría, electroquímica, medida instrumental       |
| **Mundo químico** | 118 elementos, sustancias, moléculas 3D, equilibrios, balanceo de ecuaciones  |
| **Industria**     | reactores a cuatro escalas, control PID, neutralización, alarmas, RTD         |
| **Datos**         | regresión, calibración, límites de detección, valores atípicos, PCA           |
| **Investigación** | proyectos abiertos, diseño experimental, informes                             |
| **Perfil**        | inventario de reactivos, estado de calibración, muestras, competencias        |

Modo claro y oscuro; el oscuro está calibrado para espectros, gráficas,
control industrial y visualización molecular.

---

## Principios que el código respeta

Estos no son adornos de documentación: están comprobados en la suite de
pruebas y visibles en la interfaz.

1. **Un solo motor científico.** El HCl de Química General I es el mismo HCl
   de Analítica, de Electroquímica y del proceso industrial. No hay
   simulaciones paralelas que puedan contradecirse.
2. **Nada está guionizado.** Ningún resultado está pregrabado. Una curva de
   valoración es una sucesión de resoluciones independientes del equilibrio;
   la temperatura de un reactor sale de la potencia, la masa, la capacidad
   calorífica, las pérdidas y la geometría.
3. **Los datos no son ideales.** Toda medida atraviesa error de calibración,
   deriva, contaminación, sesgo del operador, ruido y resolución
   instrumental. El generador pseudoaleatorio tiene semilla, de modo que el
   error experimental es reproducible.
4. **Las procedencias no se mezclan.** Cada magnitud lleva una etiqueta —
   teórica, simulada, medida o estimada — y esa etiqueta se propaga al menos
   fiable de sus entradas.
5. **La incertidumbre viaja con el número.** Propagación GUM de primer orden
   con coeficientes de sensibilidad numéricos.
6. **Prioridad declarada:** corrección científica → funcionalidad → realismo
   de la simulación → calidad de laboratorio → calidad instrumental → UX →
   calidad visual → escalabilidad.

---

## Verificación

`npm test` ejecuta 92 pruebas en 16 grupos. Contrastan el código con
valores de referencia de la literatura, no consigo mismo:

- las 118 configuraciones electrónicas suman exactamente Z;
- las constantes de Debye–Hückel derivadas de `core/constants` reproducen
  los coeficientes de actividad de Kielland con tres decimales;
- los patrones isotópicos de CHCl₃ y C₂H₅Br coinciden con las intensidades
  relativas medidas;
- 15 sistemas de pH independientes coinciden con los valores de referencia,
  incluidos HCl 10⁻⁷ M (6.79) y agua destilada al aire libre (5.610);
- con precipitado presente, el producto iónico iguala exactamente al Ksp;
- Cu/NH₃ da un 92 % de tetraamina;
- la cinética coincide con la solución analítica hasta 5.7 × 10⁻¹²;
- las constantes críticas del CO₂ obtenidas de van der Waals dan
  304.0 K / 74.0 bar (reales: 304.1 / 73.8);
- la pila Daniell da 1.1037 V.

La interfaz se verifica además con capturas en Chromium a 1500 px, 900 px y
390 px, en claro y oscuro.

---

## Estructura

Ver [`ARCHITECTURE.md`](./ARCHITECTURE.md).
