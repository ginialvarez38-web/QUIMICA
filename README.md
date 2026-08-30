# CHEMICAL SANDBOX

Entorno interactivo de construccion, interpretacion y simulacion de
transformaciones quimicas, para quimica universitaria y profesional.

No es una animacion de moleculas. Es un motor quimico con una interfaz encima.

```
  npm run build     # compila TypeScript a dist/
  npm test          # compila y ejecuta las pruebas
  npm run dev       # compila y sirve en http://localhost:5173
```

Requiere Node 22 o superior. **No tiene ninguna dependencia**: ni de ejecucion,
ni de desarrollo. Ver [Por que cero dependencias](#por-que-cero-dependencias).

---

## El principio que gobierna el proyecto

> «NO construir primero una interfaz bonita y despues intentar agregar quimica.
> Construir primero una arquitectura quimica solida, y encima de ella construir
> la visualizacion 3D, el laboratorio y la experiencia educativa.»

Eso es literalmente el orden en que esta escrito el codigo. El nucleo quimico
(`src/core`) no importa nada de la interfaz, del renderizador ni siquiera de la
base de datos de sustancias. Se puede ejecutar en Node, en una prueba, en un
servidor que genere examenes, o en una futura aplicacion movil.

El segundo principio, del que se deriva casi todo lo demas:

> **NO INVENTAR QUIMICA.**

Un dato que no existe se escribe `null` y la interfaz muestra
«Dato no disponible». Un balance energetico al que le falta un sumando no se
publica como aproximacion: se declara incompleto y se nombra la sustancia que
falta. Un nombre que el generador no sabe construir con seguridad se deja vacio
en lugar de producir algo plausible pero inexistente.

---

## Arquitectura

Siete capas, cada una dependiendo solo de las anteriores (§31 del brief):

```
 src/ui/          MOTOR DE INTERFAZ      como se maneja
 src/render/      MOTOR VISUAL           como se representa
 src/teach/       MOTOR EDUCATIVO        como se explica
 src/analysis/    MOTOR DE ANALISIS      por que cada cosa es como es
 src/geometry/    GEOMETRIA              donde esta cada atomo
 src/engine/      MOTOR QUIMICO          que reglas se aplican
 src/data/        BASE DE DATOS          que sustancias existen
 src/core/        MODELO                 que es una entidad quimica
```

Una dependencia solo puede apuntar hacia abajo. `core/` no conoce a nadie.

### `src/core` — modelo y algoritmos puros

| Modulo | Que resuelve |
|---|---|
| `types.ts` | Entidades quimicas. Todo valor numerico es un `Measured` con procedencia o `null`. |
| `rational.ts` | Aritmetica racional exacta sobre `BigInt` y nucleo de matrices. |
| `formula/parse.ts` | Analizador de formulas: parentesis anidados, hidratos, subindices Unicode, cinco notaciones de carga, el electron. |
| `formula/composition.ts` | Masa molar con desglose, aridad, orden de Hill, clave canonica. |
| `formula/render.ts` | Salida a Unicode, HTML y LaTeX. |
| `oxidation.ts` | Estados de oxidacion por reglas R1–R9, cada una con su justificacion. |
| `classify.ts` | Familia del compuesto (oxido basico, oxoacido, sal acida…) con su razon. |
| `nomenclature/inorganic.ts` | Stock, sistematica y tradicional, etiquetando cual es cual. |
| `build/ionicFormula.ts` | Generador de formulas con la derivacion completa en seis pasos. |
| `balance.ts` | Balanceo exacto, modo manual con diagnostico y modo guiado con pistas. |

### `src/engine` — reglas quimicas

`predict.ts` (ocho reglas de prediccion), `redox.ts`, `energy.ts` (ley de
Hess), `stoichiometry.ts`, `graph.ts` (red de transformaciones con Dijkstra) y
`rules/` (solubilidad, serie de actividad).

### `src/analysis` — Chemical Analysis Engine

El cerebro quimico: toma una especie y construye su perfil completo,
encadenando cada resultado con los que lo fundamentan.

| Modulo | Que resuelve |
|---|---|
| `findings.ts` | El grafo de hallazgos y los cinco niveles de confianza. Es la columna vertebral. |
| `electronic.ts` | Configuracion electronica, orbitales, numeros cuanticos, ionizacion paso a paso. |
| `lewis.ts` | DERIVA la estructura de Lewis desde la formula: cuenta electrones, elige centro, explora ordenes de enlace y elige por carga formal. |
| `resonance.ts` | Detecta la resonancia comparando las estructuras que empatan, y promedia el orden de enlace. |
| `hybridization.ts` | Numero esterico, hibridacion, geometria electronica y molecular, recuento sigma/pi. |
| `polarity.ts` | Polaridad de enlace y suma VECTORIAL de dipolos sobre la geometria real. |
| `imf.ts` | Fuerzas intermoleculares y el orden relativo de puntos de ebullicion. |
| `analyze.ts` | Orquestador: recorre la cadena y emite los hallazgos con sus dependencias. |

### `src/data` — base de datos curada y versionada

118 elementos, ~60 iones, 100 sustancias y 45 reacciones. La procedencia de
cada dato esta citada en la cabecera de cada archivo.

---

## Cuatro decisiones de diseno que conviene conocer

### 0. «¿Por que?» no es un texto: es una arista del grafo

El requisito mas exigente del segundo brief (§50 y §66) es que cada resultado
se pueda abrir con «¿por que?» y lleve a los resultados que lo fundamentan,
tan abajo como el usuario quiera.

Eso admite dos implementaciones. Una es escribir a mano un arbol de textos
explicativos; se desincroniza del calculo en la primera modificacion y acaba
mintiendo. La otra es que cada paso del analisis emita un HALLAZGO que declare
de que otros hallazgos depende.

El proyecto hace lo segundo. Entonces «¿por que?» no es una funcion aparte:
es recorrer las aristas que el propio calculo construyo, y la explicacion no
puede contradecir al resultado porque **es el mismo objeto**.

La consecuencia se ve mejor con un ejemplo real, que ademas es una prueba:

```
Punto de ebullicion: ANORMALMENTE ALTO para su masa molar
└ Fuerza dominante: puente-hidrogeno
  └ Fuerzas intermoleculares: dispersion · dipolo-dipolo · puente-hidrogeno
    └ Polaridad de la molecula: POLAR
      └ Polaridad de los enlaces: O–H: polar (Δχ 1,24)
      └ Geometria molecular: angular
        └ Estructura de Lewis: H—O—H
        └ Geometria electronica: tetraedrica
          └ Electrones de valencia totales: 8 e⁻
          └ Regiones de densidad electronica: 4 (2 enlaces + 2 pares libres)
            └ Electrones de valencia de O: 6
              └ Configuracion de O: [He] 2s² 2p⁴
                └ Oxigeno (O): Z = 8 · grupo 16 · periodo 2
                  └ Composicion: 2×H + 1×O
                    └ Formula: H₂O
```

Doce niveles, y ninguno es un texto escrito para la ocasion.

### 1. Los coeficientes de las reacciones no se escriben a mano

`data/reactions.ts` declara solo reactivos y productos. El balanceador exacto
calcula los coeficientes **al cargar el modulo**. Si una reaccion curada no
balancea, el modulo lanza y las pruebas fallan: es imposible que una ecuacion
mal balanceada llegue al estudiante, y no hay dos fuentes de verdad que puedan
desincronizarse.

### 2. El balanceo usa racionales exactos, no coma flotante

Balancear es hallar el nucleo de una matriz. Con `double`, una eliminacion
gaussiana sobre una redox exigente acumula error y produce coeficientes tipo
`2.9999999997`. Con `BigInt` y fracciones exactas, los «coeficientes minimos
enteros» que promete el brief estan garantizados. `2 KMnO₄ + 16 HCl → 2 KCl +
2 MnCl₂ + 8 H₂O + 5 Cl₂` sale exacto.

### 3. La aridad cuenta ELEMENTOS, no atomos

`NaHCO₃` tiene 6 atomos y 4 elementos: es **cuaternario**.
`H₂SO₄` tiene 7 atomos y 3 elementos: es **ternario**.

> **Nota sobre el brief.** El apartado §6 lista `NH₄NO₃` entre los compuestos
> cuaternarios, pero contiene solo tres elementos distintos (N, H, O) repartidos
> en nueve atomos: es **ternario**. El motor aplica la regla que el propio brief
> enuncia, no el ejemplo. Queda documentado en `tests/core.test.ts`.

---

## Que hace hoy, en concreto

**Construir.** Elegir dos iones y obtener la formula neutra con su derivacion:
`Al³⁺ + O²⁻ → Al₂O₃`, mostrando `mcm(3,2) = 6`, luego `2(+3) + 3(−2) = 0`.

**Interpretar.** Ficha completa de cualquier sustancia: los tres sistemas de
nomenclatura, masa molar desglosada con porcentajes en masa, propiedades
medidas con su fuente, y los estados de oxidacion con la regla que justifica
cada uno.

**Reaccionar.** Anadir sustancias al banco y predecir. El motor consulta primero
la base curada y despues sus ocho reglas. Devuelve **todas** las alternativas:
`Fe + O₂` ofrece FeO y Fe₂O₃ marcados como dependientes de las condiciones,
igual que `CH₄ + O₂` ofrece combustion completa e incompleta. Cuando no hay
reaccion, dice por que: *«Cu esta por debajo de Zn en la serie de actividad
(E° = 0,34 V frente a −0,76 V). El potencial seria −1,10 V, negativo.»*

**Balancear.** Tabla de recuento por elemento y por carga, modo manual que
senala exactamente que elemento falla, y modo guiado con pistas ordenadas.

**Redox.** Semirreacciones en forma ionica (`Zn → Zn²⁺ + 2e⁻`, no
`Zn → ZnSO₄ + 2e⁻`), electrones transferidos, deteccion de desproporcion, y la
distincion explicita entre «se oxida» y «es el agente reductor».

**Ver.** Visor 3D en WebGL2 con geometrias VSEPR reales: el agua sale a 104,5°
porque los pares libres comprimen el angulo, no a los 109,5° tetraedricos
ideales. El NaCl se genera como red ionica, no como molecula. Representaciones
de bolas y varillas, compacta y de alambre; estructuras de Lewis en SVG con
pares libres, cargas formales y excepciones al octeto.

**Explorar.** Red de 64 nodos y 72 aristas con busqueda de rutas.
`Ca → CaO → CaCO₃` y `S → SO₂ → SO₃ → H₂SO₄` salen del grafo, no de una lista
escrita a mano. Se pueden pedir rutas alternativas y compararlas por pasos,
dificultad, reactivos, condiciones y peligrosidad.

**Aprender.** Modo profesor que responde a las diez preguntas del §34 para
cualquier reaccion, componiendo la narracion a partir de lo que dicen los
motores.

---

## Por que cero dependencias

El registro de npm no es accesible desde el entorno donde se construyo este
proyecto: la politica de salida de la organizacion lo bloquea con 403. En lugar
de entregar un `package.json` que nadie puede instalar, el proyecto se
construyo sin dependencias:

- Sin React ni framework: la interfaz son unas 900 lineas de TypeScript con
  delegacion de eventos.
- Sin three.js: `src/render/webgl/` es un renderizador propio en WebGL2 con
  geometria instanciada. Una malla de esfera y una de cilindro subidas una vez;
  cada atomo y cada enlace son una instancia. Dibujar cientos de atomos cuesta
  dos llamadas de dibujo.
- Sin Vitest ni Jest: el ejecutor de pruebas integrado de Node.
- Sin `@types/node`: `types/node-shims.d.ts` declara la pequena superficie que
  el proyecto usa, para no renunciar a `strict`.

Si en el futuro hay acceso al registro, nada impide anadir dependencias: la
frontera esta limpia. Pero el resultado se ejecuta hoy, con `node` y `tsc`.

---

## Estado

**222 pruebas** cubren el nucleo, la nomenclatura, el motor de reacciones y el
motor de analisis. Incluyen redox exigentes, la cadena completa del calcio, la
ruta del azufre al acido sulfurico, el ejemplo estequiometrico del §26 (2,00 g
de CaCO₃ en 50 mL de HCl 1,0 M: limitante, exceso y volumen de CO₂), y los
casos de analisis que separan a quien entiende un modelo de quien lo aplica de
memoria: CO con su carga formal invertida, BF₃ sin octeto, SF₆ y XeF₄
expandidos, Fe²⁺ perdiendo los 4s antes que los 3d, la fosfina polar sin
enlaces polares, y el orden de puntos de ebullicion H₂O > H₂S sin conocer
ninguna cifra.

### Lo que el motor de analisis se NIEGA a responder

Tres casos, y en los tres explica por que en lugar de dar un resultado
plausible:

- **NaCl y demas ionicos.** No existe «una molecula» de NaCl. Aplicarle la
  cadena molecular daria una respuesta bien formada y falsa.
- **NO, NO₂, O₂⁻.** Numero impar de electrones de valencia: son radicales, y
  un modelo que reparte electrones en PARES no puede describirlos.
- **C₂H₆O, CH₃COOH, glucosa.** Con varios carbonos la conectividad ya no se
  deduce de la formula: C₂H₆O puede ser etanol (C–C–O) o dimetil eter (C–O–C).

El mapa completo de los 45 apartados del brief, con lo que esta implementado,
lo que esta parcialmente y lo que falta, esta en
**[docs/ROADMAP.md](docs/ROADMAP.md)**. No hay nada marcado como hecho que no
lo este.

---

## Estructura

```
src/core/         nucleo quimico puro (sin dependencias, ni siquiera de data/)
src/data/         elementos, iones, sustancias, reacciones, buscador
src/engine/       prediccion, redox, energia, estequiometria, grafo, reglas
src/analysis/     Chemical Analysis Engine: perfil completo y grafo de «¿por que?»
src/geometry/     VSEPR y generacion de estructuras 3D
src/render/       renderizador WebGL2 y estructuras de Lewis
src/teach/        modo profesor
src/ui/           interfaz
tests/            pruebas del nucleo, la nomenclatura, el motor y el analisis
web/              index.html y hoja de estilos
docs/             arquitectura y hoja de ruta
```
