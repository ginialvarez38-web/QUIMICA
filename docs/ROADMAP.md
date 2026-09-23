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
| 4 | Sandbox 3D | **Parcial** | `render/webgl/`. Rotar, acercar, desplazar, seleccionar, tres representaciones, mostrar/ocultar enlaces y etiquetas. El mismo renderizador dibuja las **cincuenta y ocho escenas didacticas** del temario (`teach/scenes.ts`). **Falta:** separar y unir componentes con el raton, mostrar cargas sobre los atomos, modo de orbitales. |
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
| 22 | Mapa de transformaciones | **Parcial** | El grafo, el vecindario y las rutas estan calculados y listados. El **arbol del conocimiento** del temario si se dibuja como diagrama de nodos por capas (`teach/tree.ts`). **Falta:** el mismo dibujo para la red de sustancias. |
| 23 | Modo descubrimiento | **Hecho** | El guia pregunta «¿que tipo de reaccion crees que ocurre?» con dos reactivos en el banco y ANTES de predecir, nombrando solo las familias de los reactivos. Al responder muestra la explicacion del motor, se acierte o no. |
| 24 | Sistema de advertencias | **Hecho** | Cuatro niveles con su codigo de color, en cada sustancia y cada reaccion. |
| 25 | Laboratorio virtual | **Pendiente** | El material de vidrio y el trasvase. El modelo (`Container`) esta definido en `core/types.ts`. |
| 26 | Cantidades reales | **Parcial** | `engine/stoichiometry.ts` completo y probado: unidades, limitante, exceso, rendimientos, gases, molaridad. **Falta:** la interfaz. |
| 27 | Propiedades | **Hecho** | Ficha completa con procedencia citada. Lo que no se sabe se muestra como no disponible. |
| 28 | Nomenclatura | **Hecho** | Stock, sistematica y tradicional, etiquetando cual es cual. Los oxidos de no metales se nombran como anhidridos desde la tabla curada de oxoacidos; antes se generaban con sufijos y salian palabras inexistentes. |
| 29 | Quimica organica | **Parcial** | El modelo la admite desde el inicio: tipos de reaccion organicos, clasificacion, dos reacciones curadas (esterificacion de Fischer, hidrogenacion) y cadenas 3D. **Falta:** nomenclatura IUPAC organica, grupos funcionales como entidad y mecanismos. |
| 30 | Modelo de datos | **Hecho** | `core/types.ts`. Estan las 16 entidades que pide el brief. |
| 31 | Motor de reglas separado | **Hecho** | Siete capas con dependencias solo hacia abajo. |
| 32 | Exactitud cientifica | **Hecho** | Nivel de evidencia en cada reaccion, procedencia en cada dato, alternativas cuando las hay, y `null` cuando no se sabe. |
| 33 | Cuatro niveles de visualizacion | **Parcial** | El nivel macro (apariencia, observaciones), el molecular y el atomico estan. **Falta:** el nivel electronico animado y el conmutador durante la reaccion. |
| 34 | Modo profesor | **Hecho** | Las diez preguntas, para cualquier reaccion. |
| 35 | Modo examen | **Pendiente** | El generador de ejercicios. Los datos necesarios (dificultad, conceptos por reaccion) ya se almacenan. |
| 36 | Sistema de progresion | **Parcial** | Cada reaccion lleva nivel de dificultad 1–5 y sus conceptos, y el temario tiene **106 tarjetas de repaso** con progreso guardado (`teach/flashcards.ts`). **Falta:** los 15 niveles, el seguimiento del alumno y la repeticion espaciada. |
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
6. **Modo examen (§35).** Los metadatos por reaccion (dificultad, conceptos)
   estan puestos precisamente para esto.
7. **Ampliar la base de datos.** Es el eje que mas mejora la experiencia sin
   tocar una linea de motor: mas sustancias y mas reacciones densifican
   automaticamente la red de rutas.

## Teoria — Unidad 1

`teach/theory.ts` y `ui/theory-view.ts`. Los veinte apartados del temario
(1.1 a 1.12, con 1.6.x y 1.8.x), en el lector de un apartado por pantalla.

Seis apartados no afirman: calculan. La conservacion cuenta atomos sobre una
ecuacion ajustada por el balanceador; las proporciones definidas salen del
desglose de la masa molar; las multiples dividen masas atomicas y devuelven
enteros pequenos; Gay-Lussac lee los coeficientes. Hay pruebas que comprueban
las cuatro leyes contra los datos, no contra numeros escritos a mano.

**Hueco declarado:** no hay modelo de MEZCLAS. El sandbox trabaja con
sustancias puras: no puede simular una disolucion al 30 % ni separar sus
componentes. El apartado 1.6 se explica igual, y dice abiertamente que ahi el
motor no acompana.

## Teoria — Unidad 2

`teach/atom.ts`, `ui/atom-view.ts` y la tabla de nucleidos `data/isotopes.ts`.
Los veintiun apartados de estructura atomica (2.1 a 2.11.1.4).

La demostracion de mas peso es la ABUNDANCIA ISOTOPICA: la masa atomica se
deduce ponderando las masas isotopicas por sus abundancias y se compara con el
valor independiente que publica la IUPAC. Los 16 elementos curados coinciden
con error menor de 0,005 u, y hay una prueba que lo comprueba — si alguien
mete mal una abundancia, se entera.

La TABLA PERIODICA no es una imagen: son los 118 elementos colocados en la
celda que dicen su grupo y su periodo, con los lantanidos y actinidos en las
dos filas de abajo. Cada celda abre su elemento.

**Hueco declarado:** la tabla de nucleidos NO esta completa — hay unos 3400
conocidos y aqui estan los que se estudian. Un elemento sin datos devuelve
lista vacia en lugar de aparentar que no tiene isotopos.

## Los modelos atomicos (2.2.1.2)

Los cinco modelos como CADENA, no como galeria: cada uno con que propone, en
que experimento se apoya, que explica, **que NO puede explicar** — que es la
razon de que exista el siguiente — y que sobrevive hoy.

Leida en vertical, la columna «no puede explicar» es el guion de la historia:
Dalton no explica la electricidad → Thomson no sobrevive a la lamina de oro →
Rutherford es inestable segun su propia fisica → Bohr solo vale para el
hidrogeno → modelo cuantico. Y de todos sobrevive algo: el de Dalton, de 1803,
sigue siendo el que se usa para ajustar una ecuacion.

## Teoria — Unidad 3: el enlace quimico

`teach/bond.ts` y `ui/bond-view.ts`. Los diecisiete apartados de 3.1 a 3.3.1.3.

Es la unidad que MAS se calcula del temario, porque el motor de analisis ya
estaba escrito: estructuras de Lewis derivadas (`lewis.ts`), geometria VSEPR
(`hybridization.ts`), suma VECTORIAL de dipolos (`polarity.ts`) y fuerzas
intermoleculares (`imf.ts`). Aqui casi no se afirma nada: se pregunta.

| Demostracion | Que ensena |
|---|---|
| Octeto | La ruta de cada elemento —ceder, captar o compartir— sale de comparar cuantos electrones habria que ceder con cuantos captar. Las cuatro excepciones se senalan con su motivo. |
| Escala de ΔEN | Una rampa continua de 0,00 a 3,16, con el caracter ionico calculado por la relacion de Pauling. Ensena que la frontera de 1,7 es un CONVENIO: ahi el caracter ionico ronda el 50 %. |
| Lewis | Derivadas de la formula. Y las que el motor REHUSA —los ionicos, la glucosa— aparecen con su negativa: negarse es parte de la respuesta. |
| **Momentos dipolares** | La demostracion central. CO₂: enlaces polares, |μ| = 0. H₂O: enlaces polares, |μ| = 1,52. CCl₄ frente a CHCl₃: cambiar un atomo de cuatro. |
| Fuerzas intermoleculares | Predicciones de punto de ebullicion **contrastadas con medidas** del CRC Handbook. Las cuatro aciertan. |

Once figuras 3D, varias con la geometria real del constructor VSEPR.

**Hueco declarado:** el enlace metalico no tiene motor. No hay modelo de bandas
ni de mar de electrones; el apartado explica el modelo con datos medidos de los
elementos y dice que no calcula nada sobre el enlace.

---

## Teoria — Unidad 4: combinaciones quimicas

`teach/combos.ts` y `ui/combos-theory-view.ts` (que NO es `ui/combos-view.ts`:
aquel es la tabla de cationes x aniones). Los ocho apartados de 4.1 a 4.2.3.

Es la unica unidad que va HACIA ATRAS. Las tres anteriores parten de la formula
y la analizan; esta parte de masas medidas y llega a la formula.

| Demostracion | Que ensena |
|---|---|
| Los tres sistemas | Cada fila se pide a `nomenclature/inorganic.ts`, huecos incluidos. Una casilla vacia dice «en este sistema no hay nombre», que es un dato. |
| Aridad | Atomos y elementos en columnas contiguas. H₂SO₄ tiene 7 atomos y es ternario; NaHCO₃ tiene 6 y es cuaternario: los dos ordenes se invierten. |
| Formula minima | Porcentajes → moles → razon → enteros, paso a paso. Con los casos en que el motor se NIEGA a redondear. |
| **Formula molecular** | El formaldehido, el acido acetico y la glucosa dan porcentajes identicos. Los numeros se calculan, no se escriben. |
| Composicion porcentual | El desglose de la masa molar, con barras. El agua tiene el doble de hidrogenos y un 11 % de hidrogeno en masa. |

Dos figuras 3D, y son las unicas que NO dibujan geometria: una columna por
elemento y una esfera por atomo. Es deliberado por dos razones. La unidad va de
contar, no de formas; y el motor de geometria no construye el bicarbonato ni la
glucosa —devuelve null—, asi que dibujarlos «a ojo» habria sido inventar una
estructura. Contar, en cambio, se puede hacer con exactitud.

**Motor nuevo:** `core/formula/fromPercent.ts`. Es lo unico que faltaba; el
resto de la unidad se apoya en modulos que ya existian. Rechaza tres cosas en
lugar de aproximarlas: porcentajes que no suman 100, razones que no caen en
enteros ni multiplicando hasta por 6, y masas molares que no son multiplo
entero de la minima.

**Fallo corregido al montarla:** `nomenclature/inorganic.ts` generaba nombres
inexistentes para los oxidos de no metales —«oxido carbico», «oxido fosfico»,
«oxido pernitrico»— aplicando la morfologia de los cationes metalicos a
cualquier elemento con raiz latina. Ahora esos oxidos se nombran como
anhidridos, derivados de la tabla curada de oxoacidos, y un metal de un solo
estado de oxidacion no lleva adjetivo. No existia ninguna prueba que lo cazara.

**Hueco declarado:** el motor es de nomenclatura INORGANICA. No cubre organicos,
compuestos de coordinacion ni sales con dos cationes poliatomicos —(NH₄)₂SO₄
sale sin nombre—, y el apartado 4.1 lo muestra en lugar de esconderlo.

## El arbol del conocimiento (§22, §36)

`teach/tree.ts` y `ui/tree-view.ts`. 52 nodos, 72 aristas, 21 capas. Es el
mapa de prerrequisitos del temario, no su indice: dice que hace falta entender
antes de cada apartado, y donde encaja lo que aun no existe.

La arista `requires` es nueva y DIRIGIDA. No se pudo derivar de `connects`,
que es lateral y reciproco (39 de 66 apartados, y con pares en los dos
sentidos que habrian creado ciclos). Una prueba comprueba que el grafo es
aciclico: un ciclo ahi seria un temario sin punto de entrada.

Las capas se calculan por CAMINO MAS LARGO, no por el mas corto: asi cada
nodo cae despues de todo lo que necesita, y la altura dice cuantas cosas hay
encadenadas antes. Dentro de cada capa, los nodos se ordenan por el baricentro
de sus padres — una pasada, que es la que se nota.

**Ocho ramas previstas**, colgadas de apartados reales, con lo que cada una ya
tiene: nomenclatura (`nomenclature/inorganic.ts`), reaccion (`predict.ts`,
`balance.ts`), estequiometria (`stoichiometry.ts`), termoquimica
(`energy.ts`), redox (`redox.ts`)... Eran once: el enlace quimico y las
fuerzas intermoleculares dejaron de ser previstas al entregarse la unidad 3,
y sus casillas grises se retiraron en lugar de quedarse duplicando el temario.
Ocho de las once tienen motor escrito y probado; tres —disoluciones,
equilibrio, organica avanzada— son trabajo nuevo y lo dicen.

**Hueco declarado:** el mapa dibuja dependencias DECLARADAS, no deducidas. Si
alguien anade un apartado y no le escribe su `requires`, aparecera en la capa 0
como si no necesitara nada. Las pruebas cazan las dependencias que apuntan a
sitios inexistentes y los ciclos, pero no pueden cazar una dependencia que
falta.

## Tarjetas de repaso (§36)

`teach/flashcards.ts` y la pestana «Tarjetas» de cada apartado. **106 tarjetas
para 41 apartados**, y ninguna escrita aparte: se DERIVAN de la
autocomprobacion (`check`, 53) y del ejercicio resuelto (`worked`, 12) que el
temario ya tenia. Los 13 apartados que no daban ninguna se resolvieron
escribiendoles la autocomprobacion que les faltaba, no inventando una tarjeta
suelta — asi no puede existir una tarjeta que el temario no diga.

Una prueba exige que todo apartado produzca al menos una, y otras vigilan que
los identificadores sean unicos y estables (con ellos se guarda el progreso),
que barajar conserve el mazo entero y que ninguna pregunta se quede sin su «¿».

Se repasa por apartado o con el mazo de la unidad, que baraja y descuenta lo ya
sabido. El progreso vive en `localStorage` del navegador de quien estudia, con
todos los accesos envueltos en `try`.

**Hueco declarado:** no hay repeticion espaciada. Se guarda si una tarjeta se
sabe o no, no cuando toca volver a verla: no hay intervalos, ni curva de
olvido, ni historial de aciertos. Un mazo que descuenta lo sabido no es un
algoritmo de memoria, y no se presenta como tal.

## Las figuras 3D del temario (§4)

`teach/scenes.ts` y `ui/figure-3d.ts`. Diecinueve juegos, cincuenta y ocho escenas, dibujadas
con el renderizador WebGL2 del visor — no hay ni una imagen.

| Juego | Escenas | Apartado |
|---|---|---|
| La escala del atomo | nucleo · atomo entero · el vacio de en medio | 2.1 |
| Los modelos atomicos | Dalton · Thomson · Rutherford · Bohr · cuantico | 2.2.1.2 |
| Como esta la materia | sustancia pura · mezcla homogenea · mezcla heterogenea | 1.5 |
| Cambio fisico y quimico | hielo · agua · vapor · electrolisis | 1.7 |
| La forma de un orbital | que es · n · l · m_l · d_xy · d_z² | 2.11.1 |
| Pauli y Hund en el espacio | vacios · Hund mal · Hund bien · Pauli | 2.11.1.3 |
| Para / diamagnetismo | oxigeno · neon | 2.11.1.4 |
| Por que ocho | neon · sodio · cloro | 3.1 |
| Las tres maneras de resolverlo | ionico · covalente · metalico | 3.2 |
| El cristal, no la molecula | lo que parece · lo que hay · que significa la formula | 3.2.1 |
| Compartir, no partir | antes · despues | 3.2.2 |
| De la estructura plana a la molecula | CH₄ · NH₃ · H₂O · CO₂ | 3.2.2.4 |
| Enlace polar no es molecula polar | CO₂ · H₂O · CCl₄ · CHCl₃ | 3.2.2.5 |
| El mar de electrones | la red y el mar · por que se dobla | 3.2.3 |
| Lo que pasa ENTRE moleculas | dentro y fuera | 3.3 |
| La red que sostiene al agua | cuatro puentes por molecula | 3.3.1.2 |
| Dipolos que duran un instante | en promedio · en un instante | 3.3.1.3 |
| Se cuentan elementos, no atomos | NaCl · H₂SO₄ · NaHCO₃ | 4.1 |
| La misma proporcion, tres sustancias | CH₂O · C₂H₄O₂ · C₆H₁₂O₆ | 4.2 |

**Toda escena declara en que MIENTE el dibujo**, y el tipo lo exige: sin ese
campo no compila. Es la misma regla de las analogias, porque un dibujo de un
atomo *es* una analogia visual. El modelo de Bohr se dibuja con la advertencia
de que sus orbitas no existen.

Dos restricciones reales dan forma al modulo. Un navegador limita los contextos
WebGL simultaneos — del orden de dieciseis — y al pasarse descarta los antiguos
en silencio, dejando lienzos negros; por eso el contexto se crea al entrar la
figura en pantalla (`IntersectionObserver`) y se libera al salir del modo. Y se
dibuja bajo demanda, no en bucle: son escenas estaticas, y cincuenta y ocho bucles de
animacion solo calentarian el portatil.

Sin WebGL la figura se sustituye por un aviso y el temario se lee igual.

**Hueco declarado:** las cuatro primeras son ILUSTRACIONES, no simulaciones.
Las posiciones de una mezcla salen de un generador pseudoaleatorio con semilla
fija — reproducibles, pero no calculadas por ninguna fisica. Las moleculas
reales del visor 3D si vienen de VSEPR, y las tres ultimas de la tabla, de la
funcion de onda (abajo).

## Estructura electronica — 2.11

`teach/atom.ts` (apartados), `teach/orbitals.ts` (las funciones de onda) y
`teach/scenes.ts` (las figuras). Seis apartados: 2.11, 2.11.1 y 2.11.1.1 a
2.11.1.4.

**Lo que aqui se demuestra en lugar de afirmarse.** Todo sale de
`analysis/electronic.ts`, que ya existia:

| Afirmacion | Como se comprueba |
|---|---|
| Principio de exclusion de Pauli | Se tabulan los cuatro numeros cuanticos de cada electron y se CUENTAN las combinaciones distintas. Que coincidan con el numero de electrones es Pauli. |
| Capacidad de una capa = 2n² | No se aplica la formula: se suman los 2l+1 orbitales de cada subcapa y se multiplica por dos. El 2n² es el resultado. |
| Regla de Hund | El recuento de desapareados del boro al neon sale 1, 2, 3, 2, 1, 0. Sube mientras hay orbitales vacios y baja al empezar a emparejar. |
| Magnetismo | La columna «para/diamagnetico» se deduce de la de desapareados. El Fe³⁺ tiene CINCO frente a los cuatro del Fe²⁺: quitar un electron aumenta el magnetismo. |
| Anomalias de Cr y Cu | Se senalan con su motivo en lugar de corregirse. |
| Tendencias periodicas | Radio covalente y electronegatividad leidos de los 118 elementos, con barras proporcionales al dato. |

**Los orbitales se resuelven, no se dibujan.** `orbitals.ts` escribe las seis
funciones radiales hidrogenoides y los armonicos esfericos reales, y sortea
puntos con probabilidad |ψ|². Las pruebas lo verifican contra valores exactos:
normalizacion ∫|R|²r²dr = 1, nodos radiales n−l−1 con el del 2s en r = 2 a₀,
nodos angulares con ψ = 0 exacto, y ⟨r⟩ = (3n²−l(l+1))/2 al 1 %. El muestreo
factoriza R(r)·Y(θ,φ) —que es exacto, no una aproximacion— y por eso cuesta
66 ms en vez de 722.

**Hueco declarado:** no hay energias de ionizacion en la base de datos, asi que
esa tendencia —la mas directa de todas— no se calcula. Se dice. Y las formulas
de los orbitales son exactas solo para UN electron: en un atomo polielectronico
se conserva la forma angular, que es lo que usa la quimica, pero los tamanos
son orientativos.

## El guia

`teach/guide.ts` decide que decir en cada momento; `ui/guide-view.ts` le pone
cara (un matraz en SVG cuya expresion y color siguen al estado de animo).

La regla que gobierna el modulo: **el guia no sabe quimica**. Ni una sola de
sus frases afirma algo que no venga de un motor — la familia la da `classify`,
el riesgo y el tipo de reaccion los da `predict`, la neutralidad el
constructor — y cada pista muestra de DONDE sale. Un ayudante que suelta
animos genericos es ruido que se aprende a ignorar; uno que se inventa quimica
para parecer util es peor que no tenerlo.

Su pieza mas valiosa es el §23: con dos reactivos en el banco y antes de
predecir, no adelanta el resultado. Nombra las familias —que es un hecho— y
pregunta que crees que va a pasar. La pregunta es sobre el TIPO de reaccion y
no sobre los productos, y eso es deliberado: el vocabulario de tipos es
cerrado, asi que las opciones falsas son tipos reales que no tocan, nunca
formulas inventadas.

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
- **Anadir una pista al guia:** una rama en `teach/guide.ts` que devuelva
  `{ text, from }`. El campo `from` es obligatorio: si no se puede nombrar el
  motor que lo afirma, la pista no deberia existir.
- **Anadir un resultado al analisis:** una llamada a `graph.add()` en
  `analysis/analyze.ts` declarando de que otros hallazgos depende. El boton
  «¿por que?», el mapa de informacion, el filtro por profundidad y el resumen
  de fiabilidad lo recogen solos; no hay que tocar la interfaz. Si la
  dependencia esta mal escrita, las pruebas lo dicen.
