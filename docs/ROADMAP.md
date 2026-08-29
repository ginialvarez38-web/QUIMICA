# Hoja de ruta — los 45 apartados del brief

Mapa honesto de lo que hay. Tres estados:

- **Hecho** — implementado y cubierto por pruebas.
- **Parcial** — el motor funciona; falta interfaz, alcance o datos.
- **Pendiente** — no implementado. La arquitectura lo admite sin rediseno.

No hay nada marcado como hecho que no lo este.

---

| § | Apartado | Estado | Donde / que falta |
|---|---|---|---|
| 1 | Concepto central: cadena de transformaciones | **Hecho** | `engine/graph.ts`. La cadena Ca → CaO → Ca(OH)₂ → CaCO₃ → CaCl₂ sale del grafo. |
| 2 | Objetivo educativo: interpretar, no listar | **Hecho** | `teach/explain.ts` y las explicaciones de `data/reactions.ts`. |
| 3 | Interfaz: biblioteca con buscador | **Hecho** | `data/search.ts`, 320 entradas. Las 14 categorias del brief estan. |
| 4 | Sandbox 3D | **Parcial** | `render/webgl/`. Rotar, acercar, desplazar, seleccionar, tres representaciones, mostrar/ocultar enlaces y etiquetas. **Falta:** separar y unir componentes con el raton, mostrar cargas sobre los atomos, modo de orbitales. |
| 5 | Constructor de compuestos | **Parcial** | `core/build/ionicFormula.ts` genera la formula con su derivacion y la ficha completa. **Falta:** el arrastrar y soltar sobre el lienzo 3D. |
| 6 | Binarios, ternarios y cuaternarios | **Hecho** | `core/formula/composition.ts`. Cuenta elementos, no atomos. Ver la nota sobre NH₄NO₃ en el README. |
| 7 | Generador de formulas | **Hecho** | Seis pasos de derivacion, incluida la comprobacion `2(+3) + 3(−2) = 0`. |
| 8 | Motor de reacciones | **Parcial** | `engine/predict.ts`: ocho reglas (neutralizacion, acido+carbonato, doble sustitucion con precipitacion, sustitucion simple, oxido+agua, oxido+oxido, combustion, sintesis directa) mas 45 reacciones curadas. **Falta:** hidrolisis y las organicas mas alla de las dos curadas. |
| 9 | Interpretacion automatica | **Hecho** | El ejemplo HCl + NaOH del brief funciona completo. |
| 10 | Balanceo: automatico, manual y guiado | **Hecho** | `core/balance.ts`. Conserva atomos y carga; el modo manual senala el elemento que falla. |
| 11 | Visualizacion del balance | **Parcial** | La tabla de recuento esta. **Falta:** la animacion de particulas contando atomos antes y despues. |
| 12 | Seguir atomo | **Parcial** | Los atomos tienen identidad estable, se seleccionan por rayo-esfera y se resaltan con halo. **Falta:** conservar el marcado a traves de la reaccion y decir donde acabo. |
| 13 | Animacion de reaccion con linea temporal | **Parcial** | Controles de reproduccion, velocidad y fases operativos; la vista transita de reactivos a productos. **Falta:** la interpolacion atomo a atomo. |
| 14 | Visualizacion de enlaces | **Parcial** | Tipo de enlace por electronegatividad, ordenes simple/doble/triple dibujados en paralelo. **Falta:** la animacion de ruptura y formacion. |
| 15 | Modo Lewis | **Hecho** | `render/lewis.ts`. Pares libres, cargas formales, octeto y sus excepciones (dueto del H, deficiencia del B, expansion del periodo 3). |
| 16 | Modo ionico | **Parcial** | `engine/redox.ts` genera los tres pasos de la transferencia. **Falta:** la animacion de los electrones saltando. |
| 17 | Modo redox | **Hecho** | Semirreacciones en forma ionica, agentes, electrones transferidos, desproporcion. |
| 18 | Modo energia | **Parcial** | ΔH, ΔG y ΔS por ley de Hess, caracter exo/endotermico y temperatura de cruce. **Falta:** el diagrama del perfil energetico. La energia de activacion **nunca** se estima: no se deriva de las entalpias de formacion. |
| 19 | Condiciones de reaccion | **Parcial** | Las condiciones se almacenan, se muestran y distinguen lo termodinamicamente posible de lo cineticamente favorable. **Falta:** que el usuario las modifique y el motor recalcule. |
| 20 | «¿Que puedo hacer con este compuesto?» | **Hecho** | `engine/predict.ts::reactionsAvailableFor`. Es la vista por defecto al elegir una sustancia. |
| 21 | «¿Como llego a este compuesto?» | **Hecho** | `engine/graph.ts`. Dijkstra mas busqueda de rutas alternativas. |
| 22 | Mapa de transformaciones | **Parcial** | El grafo, el vecindario y las rutas estan calculados y listados. **Falta:** el dibujo de la red como diagrama de nodos. |
| 23 | Modo descubrimiento | **Parcial** | El motor ya devuelve todas las alternativas y avisa de que dependen de las condiciones. **Falta:** la pregunta «¿que crees que ocurrira?» antes de simular. |
| 24 | Sistema de advertencias | **Hecho** | Cuatro niveles con su codigo de color, en cada sustancia y cada reaccion. |
| 25 | Laboratorio virtual | **Pendiente** | El material de vidrio y el trasvase. El modelo (`Container`) esta definido en `core/types.ts`. |
| 26 | Cantidades reales | **Parcial** | `engine/stoichiometry.ts` completo y probado: unidades, limitante, exceso, rendimientos, gases, molaridad. **Falta:** la interfaz. |
| 27 | Propiedades | **Hecho** | Ficha completa con procedencia citada. Lo que no se sabe se muestra como no disponible. |
| 28 | Nomenclatura | **Hecho** | Stock, sistematica y tradicional, etiquetando cual es cual. |
| 29 | Quimica organica | **Parcial** | El modelo la admite desde el inicio: tipos de reaccion organicos, clasificacion, dos reacciones curadas (esterificacion de Fischer, hidrogenacion) y cadenas 3D. **Falta:** nomenclatura IUPAC organica, grupos funcionales como entidad y mecanismos. |
| 30 | Modelo de datos | **Hecho** | `core/types.ts`. Estan las 16 entidades que pide el brief. |
| 31 | Motor de reglas separado | **Hecho** | Siete capas con dependencias solo hacia abajo. |
| 32 | Exactitud cientifica | **Hecho** | Nivel de evidencia en cada reaccion, procedencia en cada dato, alternativas cuando las hay, y `null` cuando no se sabe. |
| 33 | Cuatro niveles de visualizacion | **Parcial** | El nivel macro (apariencia, observaciones), el molecular y el atomico estan. **Falta:** el nivel electronico animado y el conmutador durante la reaccion. |
| 34 | Modo profesor | **Hecho** | Las diez preguntas, para cualquier reaccion. |
| 35 | Modo examen | **Pendiente** | El generador de ejercicios. Los datos necesarios (dificultad, conceptos por reaccion) ya se almacenan. |
| 36 | Sistema de progresion | **Parcial** | Cada reaccion lleva nivel de dificultad 1–5 y sus conceptos. **Falta:** los 15 niveles y el seguimiento del alumno. |
| 37 | Simulacion industrial | **Pendiente** | Hay reacciones industriales curadas con sus condiciones reales (contacto, Haber-Bosch, alto horno, calcinacion); falta el modelo de operaciones unitarias. |
| 38 | Rendimiento y realismo | **Parcial** | El calculo ideal esta; el rendimiento porcentual tambien. **Falta:** el modo de simulacion realista con perdidas y equilibrio. |
| 39 | Arquitectura tecnica | **Hecho** | Modular, con el motor utilizable sin interfaz. |
| 40 | Rendimiento | **Hecho** | Geometria instanciada: dos llamadas de dibujo para toda la escena. |
| 41 | Historial de experimentos | **Pendiente** | `Experiment` esta definido en el modelo. |
| 42 | Comparacion de rutas | **Hecho** | `engine/graph.ts::compareRoutes`, seis criterios. |
| 43 | Experiencia de usuario | **Parcial** | Tomar, colocar, combinar, reaccionar, analizar y aprender funcionan. **Falta:** la manipulacion directa en 3D. |
| 44 | Principio del producto | **Hecho** | Construccion, transformacion, interpretacion, visualizacion y conexion estan cubiertas. Experimentacion, parcialmente. |
| 45 | Resultado final esperado | **Parcial** | «Quiero obtener H₂SO₄ a partir de azufre» funciona hoy y devuelve S → SO₂ → SO₃ → H₂SO₄ con la explicacion de cada etapa. «¿Que ocurre si mezclo HCl y NaOH?» tambien, con los nueve pasos. **Falta:** la entrada en lenguaje natural. |

---

## Lo siguiente, por orden de valor

1. **Interfaz de cantidades (§26).** El motor esta hecho y probado; solo falta
   el formulario. Es el mayor retorno por esfuerzo del proyecto.
2. **Dibujo de la red de transformaciones (§22).** El grafo ya esta calculado;
   falta la disposicion visual de nodos y aristas.
3. **Modo descubrimiento (§23).** Interponer «¿que crees que ocurrira?» antes
   de mostrar el resultado. El motor ya devuelve las alternativas necesarias.
4. **Modo examen (§35).** Los metadatos por reaccion (dificultad, conceptos)
   estan puestos precisamente para esto.
5. **Ampliar la base de datos.** Es el eje que mas mejora la experiencia sin
   tocar una linea de motor: mas sustancias y mas reacciones densifican
   automaticamente la red de rutas.

## Como crecer sin romper nada

- **Anadir una sustancia:** una entrada en `data/species.ts`. La composicion,
  la masa molar, la aridad, la clasificacion y la nomenclatura se derivan
  solas. Solo se escribe lo experimental.
- **Anadir una reaccion:** reactivos y productos en `data/reactions.ts`. Los
  coeficientes los pone el balanceador; si no balancea, el modulo lanza.
  Aparece automaticamente en la red de rutas y en «¿que puedo hacer con esto?».
- **Anadir una regla de prediccion:** una funcion en `engine/predict.ts` y una
  entrada en `PAIR_RULES`. Toda prediccion se balancea antes de devolverse.
- **Anadir una geometria:** una entrada en `SPECS` de `geometry/vsepr.ts`.
