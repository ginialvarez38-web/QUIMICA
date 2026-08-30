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

---

# CHEMICAL ANALYSIS ENGINE (segundo brief, 66 apartados)

El motor que responde «por que». Toma una especie y encadena
ATOMOS → ELECTRONES → ORBITALES → LEWIS → ENLACES → RESONANCIA →
HIBRIDACION → GEOMETRIA → POLARIDAD → FUERZAS INTERMOLECULARES →
PROPIEDADES, y deja cada resultado abierto a la pregunta «¿por que?».

## Implementado

| § | Apartado | Donde |
|---|---|---|
| 6–9 | Configuracion electronica, orbitales, numeros cuanticos, ionizacion | `analysis/electronic.ts` |
| 11–13 | Estructura de Lewis derivada, validacion con diagnostico, carga formal | `analysis/lewis.ts` |
| 14, 15, 26 | Resonancia, hibrido, orden de enlace promedio y sus consecuencias | `analysis/resonance.ts` |
| 16–20 | Hibridacion, numero esterico, geometria electronica y molecular, sigma/pi | `analysis/hybridization.ts` |
| 21–24 | Polaridad de enlace y de molecula por suma vectorial | `analysis/polarity.ts` |
| 29–31 | Fuerzas intermoleculares y orden relativo de puntos de ebullicion | `analysis/imf.ts` |
| 47, 48, 50, 66 | Grafo de informacion, niveles de profundidad, «¿POR QUE?» | `analysis/findings.ts`, `ui/analysis-view.ts` |
| 55 | Identidad de atomo estable, para el futuro Reaction Engine | `analysis/lewis.ts` |
| 57 | Motor de confianza: experimental / calculado / teorico / educativo / desconocido | `analysis/findings.ts` |
| 58, 59, 32 | Limites declarados; ningun modelo educativo se presenta como realidad cuantica | todos los modulos |
| 62 | Separacion estricta de motores: ninguno conoce a los demas | `analysis/analyze.ts` |
| 64 | Perfil completo de la especie | `analysis/analyze.ts` |

## Tabla de combinaciones

Cuadricula de 47 cationes × 54 aniones (`engine/combinations.ts`,
`ui/combos-view.ts`), con las cabeceras fijas en los dos ejes, filtro de texto
sobre las dos listas y dos conmutadores («solo verificadas», «solo
precipitados»). Cada casilla lleva la derivacion en seis pasos y salta al
analisis completo.

Lo que la hace util es que distingue lo verificado de lo derivado: presentar
las 2538 combinaciones como compuestos existentes seria justo lo que el §32
prohibe.

## Parcial

- **Esqueleto de dos niveles (oxoacidos).** Hoy el motor rehusa el HNO₃ y el
  H₂SO₄ porque el hidrogeno va sobre un oxigeno y no sobre el centro. Poder
  construir H–O–X seria la mejora de mas valor del motor de Lewis: son de las
  especies mas frecuentes del temario. Exige que el esqueleto pase de estrella
  a arbol, y arrastra a geometria y polaridad.
- **§10, §25 (orbitales moleculares).** Se declara explicitamente donde Lewis
  falla — O₂ paramagnetico, los radicales — pero no se calcula el diagrama de
  OM. Es lo que haria falta para responder esos casos en vez de solo senalarlos.
- **§28 (longitud y energia de enlace).** Se da la tendencia (orden mayor,
  enlace mas corto y fuerte) pero no los picometros: exigen datos
  experimentales por pareja de elementos que la base de datos aun no tiene.
- **§61 (interfaz).** Existe como pestana «Analizar» del inspector, con
  descenso y migas de pan. No hay todavia el mapa visual del §47 ni la
  comparacion de dos especies lado a lado.

## No implementado

- **§32, §33 (acido-base).** El motor clasifica y asigna estados de oxidacion,
  pero no calcula fuerza acida ni predice el comportamiento en agua.
- **§37, §38 (reactividad).** Sitios electrofilos y nucleofilos.
- **§39–§46 (Reaction Engine).** El segundo brief lo deja fuera de alcance
  explicitamente; §55 prepara el terreno conservando la identidad de cada atomo.
- **Cadenas y ciclos.** El motor de Lewis construye esqueletos de un centro con
  terminales. Cualquier especie con mas de un carbono queda declarada fuera de
  alcance, con su razon.

## Lo siguiente, por orden de valor

1. **Esqueleto de dos niveles para los oxoacidos.** Ver «Parcial». Es lo que
   mas especies desbloquea de una vez.
2. **Motor acido-base (§32, §33).** Es lo que mas se echa en falta del segundo
   brief: el perfil llega hasta las propiedades fisicas y se detiene antes del
   comportamiento en disolucion, que es lo que mas se pregunta.
3. **Interfaz de cantidades (§26).** El motor esta hecho y probado; solo falta
   el formulario. Es el mayor retorno por esfuerzo del primer brief.
4. **Dibujo de la red de transformaciones (§22).** El grafo ya esta calculado;
   falta la disposicion visual de nodos y aristas.
5. **Modo descubrimiento (§23).** Interponer «¿que crees que ocurrira?» antes
   de mostrar el resultado. El motor ya devuelve las alternativas necesarias.
6. **Modo examen (§35).** Los metadatos por reaccion (dificultad, conceptos)
   estan puestos precisamente para esto.
7. **Ampliar la base de datos.** Es el eje que mas mejora la experiencia sin
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
- **Anadir un resultado al analisis:** una llamada a `graph.add()` en
  `analysis/analyze.ts` declarando de que otros hallazgos depende. El boton
  «¿por que?», el mapa de informacion, el filtro por profundidad y el resumen
  de fiabilidad lo recogen solos; no hay que tocar la interfaz. Si la
  dependencia esta mal escrita, las pruebas lo dicen.
