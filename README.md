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

### `src/engine/combinations.ts` — tabla de combinaciones

Cruza los 47 cationes con los 54 aniones (2538 casillas, ~150 ms) y etiqueta
cada una por lo que se sabe de ella, no por si la aritmetica cuadra:

| Estado | Que significa |
|---|---|
| **Verificada** (70) | La sustancia esta en la base de datos. Nombre, solubilidad y propiedades son datos medidos. |
| **Derivada** (2413) | La formula se deduce de las cargas — es la respuesta correcta al ejercicio de formulacion — pero el motor NO afirma que el compuesto exista o sea estable. |
| **No procede** (55) | El modelo ionico no se aplica, y se explica por que. |

### `src/teach` — modo profesor, el guia y el temario

`explain.ts` desarrolla una reaccion como una leccion. `theory.ts` es la
unidad 1 (la materia), `atom.ts` la unidad 2 (estructura atomica) y `bond.ts`
la unidad 3 (el enlace quimico). `scenes.ts` son las figuras 3D que ilustran
las tres. `guide.ts` es el cerebro del
avatar: mira en que punto esta el usuario y decide que decirle.

**El temario no se escribe: se calcula.** Donde una ley admite demostracion,
se demuestra con los mismos motores que usa el resto de la aplicacion:

| Ley | Como se demuestra |
|---|---|
| Conservacion de la materia | Se **cuentan** los atomos de los dos lados de una ecuacion que ajusto el balanceador. |
| Proporciones definidas | El % en masa sale del desglose de la masa molar, y se aplica a dos muestras de tamano distinto. |
| Proporciones multiples | Se fija 1 g de un elemento y se divide. CO/CO₂ da 1:2, SO₂/SO₃ da 2:3, N₂O/NO/NO₂ da 1:2:4 — enteros pequenos, sin forzarlo. |
| Gay-Lussac | Los volumenes son los coeficientes, que calculo el balanceador sin saber nada de volumenes. |
| **Abundancia isotopica** | La masa atomica se deduce ponderando masas isotopicas por sus abundancias, y se compara con el valor IUPAC. Los 16 elementos con datos curados coinciden con error < 0,005 u. |
| **Isobaras e isotonos** | Se BUSCAN agrupando los nucleidos por A y por N. El trio ⁴⁰Ar / ⁴⁰K / ⁴⁰Ca aparece porque esta en los datos. |
| **Tabla periodica** | Los 118 elementos colocados en la celda (periodo, grupo) que dicen sus datos. No hay ninguna imagen. |

Escribir «la masa se conserva» es una afirmacion que hay que creerse. Ensenar
la tabla de atomos cuadrando es la ley ocurriendo delante. Y si manana cambiara
una masa atomica, cambiarian los numeros de la pagina.

### La navegacion: tres grupos y un lector

Habia **siete pestanas** en fila y el temario se pintaba entero de una vez.
Medido: la unidad 2 ocupaba 28.085 px —treinta y una pantallas— y un solo
apartado llegaba a 12.703. Eso no es «leer seguido», es no encontrar nada.

| Antes | Ahora |
|---|---|
| 7 pestanas sueltas | 3 grupos (**Practicar · Teoria · Explorar**) y, dentro, los modos que de verdad se alternan |
| Materia y Atomo, dos modos | una pestana **Teoria** con conmutador de unidad |
| la unidad entera en una columna | **un apartado por pantalla**, con «18 de 21» y anterior/siguiente |
| el indice solo desplazaba | el indice **navega** y marca donde estas |
| 9 cajas apiladas por apartado | dos capas: arriba «¿que es esto?», detras de pestanas «¿lo he entendido?» |
| biblioteca e inspector siempre puestos | en lectura se retiran: el temario se queda la pantalla |

El apartado mas alto paso de **31,3 pantallas a 1,5**.

Dos anchos de lectura, no uno: la prosa se queda en 70 caracteres porque una
linea larga cansa, y la figura 3D y las tablas de diez columnas se ensanchan a
104 — con un solo ancho, la tabla de numeros cuanticos se desplazaba en
horizontal teniendo media pantalla vacia al lado.

En movil el indice de veintiun apartados no es una barra: se pliega detras de
un boton, y la lectura normal se lleva con anterior y siguiente.

### El contrato didactico

Cada apartado se construye con las mismas piezas, y hay pruebas que las
vigilan:

| Pieza | Regla que se comprueba |
|---|---|
| **La idea** | La frase que hay que llevarse. |
| **Ojo** | El error que casi todo el mundo comete ahi. |
| **Imaginalo asi** | Toda analogia declara **donde deja de valer**. Sin el limite, no se admite. |
| **Ejercicio resuelto** | Al menos tres pasos, y alguno ensena la operacion, no solo la describe. |
| **Tarjetas de repaso** | Toda pregunta y toda respuesta valen como tarjeta: al menos 25 y 60 caracteres, y la pregunta con su «¿». |
| **Se conecta con** | Los enlaces apuntan a apartados que existen. |
| **Figura 3D** | Cada escena declara **en que miente el dibujo**. Sin ese campo, no compila. |

La regla de las analogias es la que mas importa. Son la herramienta mas
potente y mas peligrosa de la ensenanza: explican rapido y dejan una idea
falsa pegada. «El atomo es como un sistema solar» hace entender la idea de
nucleo y corteza, y a cambio deja creyendo que los electrones giran en
orbitas, que es justo lo que la mecanica cuantica niega. Por eso el tipo
`Analogy` tiene dos campos obligatorios.

Y las respuestas de autocomprobacion llegan ocultas por un motivo: leer la
pregunta y la respuesta a la vez da sensacion de haber entendido sin haber
recuperado nada de memoria.

### La unidad 3 es la que mas se calcula

Las dos primeras unidades tenian que apoyarse en datos tabulados. Esta no: el
Chemical Analysis Engine llevaba escrito y probado todo lo que la unidad
explica, y lo DERIVA de la formula.

| Apartado | Quien lo calcula |
|---|---|
| 3.1 Regla del octeto | `electronic.ts` — la valencia y la configuracion del ion; la ruta (ceder / captar / compartir) sale de una resta |
| 3.2 El continuo de ΔEN | `polarity.ts::classifyBond`, el mismo clasificador que usa el analizador |
| 3.2.1.2 y 3.2.2.4 Lewis | `lewis.ts` — cuenta electrones, elige centro, prueba ordenes y se queda con el de menor carga formal |
| 3.2.2.5 Momentos dipolares | `polarity.ts` — **suma vectorial** sobre la geometria real |
| 3.3 Fuerzas intermoleculares | `imf.ts` + puntos de ebullicion medidos del CRC Handbook |

**La demostracion que no se puede hacer con texto** es la del apartado 3.2.2.5.
El CO₂ tiene dos enlaces polares (ΔEN = 0,89) y momento dipolar **cero**; el
agua tiene dos enlaces igual de polares y momento **1,52**. Dicho, suena a
contradiccion; calculado sumando vectores sobre la geometria real, deja de
haber nada que memorizar. La tabla marca en naranja las filas donde «¿enlaces
polares?» y «¿MOLECULA polar?» no coinciden — son tres de ocho.

**Y el motor se contrasta.** Predice cual de dos sustancias hierve mas alto y
por que; despues se compara con el punto de ebullicion medido. Las cuatro
comparaciones aciertan, incluida la del agua (100 °C) frente al sulfuro de
hidrogeno (−60 °C) pese a que el agua pesa la mitad. Una prueba exige que
ninguna prediccion falle: si fallara, se veria en la tabla.

**Hueco declarado:** el enlace metalico NO tiene motor. No hay modelo de bandas
ni de mar de electrones en ninguna capa, y el apartado 3.2.3 lo dice: explica
el modelo con datos medidos de los elementos, pero no calcula nada sobre el
enlace.

Once figuras 3D sostienen la unidad, y varias usan la geometria de verdad del
constructor VSEPR — el agua a 104,5°, no a ojo. Cuando la figura es el
argumento, el angulo no se puede aproximar.

### El arbol del conocimiento

El indice numerado dice DONDE ESTA un tema: el 2.7 va despues del 2.6 porque
asi se numero. El arbol dice otra cosa y mas util: **que hace falta entender
antes**. Son dos estructuras sobre el mismo material, y confundirlas es el
motivo de que un temario se pueda leer entero sin ver nunca por que una cosa
lleva a la otra.

`teach/tree.ts` — **52 nodos, 72 aristas, 21 capas**. Se dibuja en la pestana
**Mapa**, dentro de Teoria.

| | |
|---|---|
| **De arriba abajo** | El orden en que se puede estudiar. Cada apartado cae por DEBAJO de todo lo que necesita, porque las capas se calculan por camino mas largo. |
| **26 flechas naranjas** | Cruzan de una unidad a otra. Son las que no se ven leyendo: la ley de las proporciones multiples (1.8.3) es lo que empuja a los modelos atomicos (2.2.1.2), y estan a cuarenta pantallas. |
| **9 nodos en gris** | Las ramas que aun no existen, colgando de lo que ya las sostiene. |

**`requires` no es `connects`.** Se intento derivar el arbol de los enlaces que
ya habia y no valia: `connects` es lateral y va en los dos sentidos —el
2.11.1.1 enlaza al 2.11.1.3 y el 2.11.1.3 enlaza de vuelta— y un arbol con esa
arista tendria un ciclo, es decir, tres apartados que no se pueden estudiar en
ningun orden. Ademas solo cubria 33 de los 58. Asi que `requires` es una arista
DIRIGIDA y nueva, y **hay una prueba que impide los ciclos**.

**Las ramas previstas dicen que motor las sostiene ya.** Seis de las nueve
apuntan a codigo escrito y probado: `stoichiometry.ts` para la estequiometria,
`nomenclature/inorganic.ts` para la nomenclatura, `energy.ts`
para la termoquimica, `redox.ts` para la electroquimica. Lo que les falta es el
temario encima, no la quimica de debajo — y decirlo cambia lo que significa la
casilla gris. Las que no tienen motor tambien lo dicen.

Dentro de cada apartado, el arbol se ve sin salir a mirarlo: al pie hay una
linea de **«antes de esto»** y **«esto abre»**, con las ramas previstas
incluidas — que es la respuesta a «¿y esto para que me sirve?» cuando lo que
sirve todavia no esta escrito.

### Las tarjetas de repaso

**65 tarjetas, y ninguna esta escrita aparte.** Lo evidente habria sido anadir
un campo `flash` a cada apartado y redactar cien preguntas nuevas; habria sido
crear una SEGUNDA version de una quimica que ya existe, libre de contradecir a
la primera a partir del dia siguiente.

Asi que se derivan de lo que el temario ya tenia en forma de pregunta y
respuesta:

| Origen | Tarjetas |
|---|---|
| `check` — la autocomprobacion de cada apartado | 53 |
| `worked` — el enunciado y la respuesta del ejercicio resuelto | 12 |

Las 13 que faltaban no se resolvieron inventando tarjetas sueltas, sino
**escribiendo la autocomprobacion que le faltaba a esos 13 apartados**. Asi la
tarjeta y el apartado no pueden separarse nunca: son la misma frase leida en
dos sitios. Una prueba exige que **todo apartado produzca al menos una**.

Y por eso **no hay pestana de «Compruebalo»**: seria la misma pregunta dos
veces en la misma caja. Se queda la tarjeta, que hace lo mismo y ademas
recuerda si ya te la sabias.

Se repasan por apartado o en el mazo de la unidad entera, que baraja y deja
fuera las ya sabidas — repasar lo que uno se sabe es la forma mas comun de
sentir que se estudia sin estudiar. El progreso vive en `localStorage`, con
todos los accesos envueltos: en una ventana privada `localStorage` no devuelve
vacio, LANZA, y sin el envoltorio el temario reventaria por no poder guardar
una marca de repaso.

### Las figuras 3D del temario

`scenes.ts` define **diecisiete juegos con cincuenta y dos escenas**, que se dibujan con el
mismo renderizador WebGL2 del visor de moleculas — no con imagenes:

| Juego | Escenas | Donde |
|---|---|---|
| **La escala del atomo** | El nucleo, el atomo entero, lo que hay en medio | 2.1 Composicion del atomo |
| **Los modelos atomicos** | Dalton, Thomson, Rutherford, Bohr, cuantico | 2.2.1.2 Modelos atomicos |
| **Como esta la materia** | Sustancia pura, mezcla homogenea, mezcla heterogenea | 1.5 Sustancias puras |
| **Cambio fisico y cambio quimico** | Hielo, agua, vapor, y la electrolisis | 1.7 Transformaciones quimicas |
| **La forma de un orbital** | Que es · n · l · m_l · los cinco d | 2.11.1 Electrones del atomo |
| **Pauli y Hund en el espacio** | Vacios, Hund mal, Hund bien, Pauli | 2.11.1.3 Las tres reglas |
| **Para / diamagnetismo** | Oxigeno, neon | 2.11.1.4 Propiedades magneticas |
| **Por que ocho** | Neon la tiene llena, al sodio le sobra uno, al cloro le falta uno | 3.1 Regla del octeto |
| **Las tres maneras de resolverlo** | Ionico, covalente, metalico | 3.2 Uniones interatomicas |
| **El cristal, no la molecula** | Lo que la formula parece decir, lo que de verdad hay, que significa entonces | 3.2.1 Enlace ionico |
| **Compartir, no partir** | Antes: cada uno con lo suyo; despues: la nube del medio | 3.2.2 Enlace covalente |
| **De la estructura plana a la molecula** | Metano, amoniaco, agua, dioxido de carbono | 3.2.2.4 Formulas de Lewis |
| **Enlace polar no es molecula polar** | CO₂, H₂O, CCl₄, CHCl₃ | 3.2.2.5 Polaridad y momentos dipolares |
| **El mar de electrones** | La red y el mar; por que se dobla en vez de romperse | 3.2.3 Enlace metalico |
| **Lo que pasa ENTRE moleculas** | Dentro y fuera de la molecula | 3.3 Uniones intermoleculares |
| **La red que sostiene al agua** | Cuatro puentes por molecula | 3.3.1.2 Puentes de hidrogeno |
| **Dipolos que duran un instante** | En promedio simetrica; en un instante, no | 3.3.1.3 Fuerzas de dispersion |

Las escenas de orbitales, llenado y magnetismo no estan dibujadas: estan
**calculadas**. Ver mas abajo.

Los cinco modelos atomicos, uno por pestana, son el argumento entero de la
unidad 2 en una sola figura: cada uno explica algo que el anterior no podia, y
cada uno se rompe contra un experimento que el siguiente resuelve.

**Toda escena declara su limite**, igual que las analogias y por la misma
razon: un dibujo de un atomo *es* una analogia visual. Debajo de cada figura
aparece en naranja *«El dibujo miente en esto: …»*. El modelo de Bohr con sus
orbitas es probablemente la imagen que mas ideas falsas ha dejado en la
quimica, y aqui se dibuja **con** la advertencia de que las orbitas no existen.

Dos decisiones tecnicas las sostienen. Un navegador limita los contextos WebGL
simultaneos — del orden de dieciseis — y al pasarse descarta los antiguos en
silencio, dejando lienzos en negro; asi que el contexto **se crea cuando la
figura entra en pantalla** (`IntersectionObserver`) y **se libera al abandonar
el modo**. Y se dibuja **bajo demanda**, no en un bucle: las escenas son
estaticas, y mantener cincuenta y dos bucles de animacion calentaria el portatil de un
estudiante para no ensenar nada nuevo.

Sin WebGL la figura se sustituye por un aviso y el temario se lee igual.

### Los orbitales no se dibujan: se resuelven

Las figuras del apartado 2.11 son de otra clase. Las demas colocan esferas
donde hace falta para ilustrar una idea; estas sortean cada punto de la
**funcion de onda hidrogenoide** —la solucion exacta de la ecuacion de
Schrodinger— con probabilidad proporcional a |ψ|². Nadie ha dibujado dos
lobulos en ningun sitio: los lobulos SALEN porque cos θ se anula en el plano
ecuatorial.

Y eso hay que comprobarlo, porque una nube mal calculada seguiria pareciendo un
orbital. `tests/` verifica contra valores exactos conocidos:

| Lo que se comprueba | Contra que |
|---|---|
| Normalizacion de las seis radiales | ∫\|R\|²r²dr = 1 |
| Numero de nodos radiales | n − l − 1, y el del 2s cae en r = 2 a₀ exactos |
| Nodos angulares | ψ = 0 **exacto** en el plano ecuatorial del p y en los dos planos del d_xy |
| Tamano de la nube muestreada | ⟨r⟩ = (3n² − l(l+1))/2 a₀, al 1 % |
| Que un p no sea una bola | ⟨z²⟩ > 2,5·⟨x²⟩ |
| Que las dos fases sean mitad y mitad | y que cada una quede de su lado del plano nodal |
| Que el recorte del 90 % encierre el 90 % | integrando la distribucion radial |

El muestreo aprovecha que ψ = R(r)·Y(θ,φ) **factoriza**, asi que el radio y la
direccion se sortean por separado. No es un atajo: esa separacion es la razon
de que se pueda hablar del «tamano» y de la «forma» de un orbital como de dos
cosas distintas, que es de lo que trata el apartado entero. La primera version
lo hacia todo por rechazo en 3D, daba la misma nube y tardaba **722 ms**; asi
tarda **66**.

Dos recursos de dibujante, los dos declarados en el limite de su escena: el
**recorte al radio del 90 %** —la misma convencion de los libros, con el radio
calculado, no elegido— y el **corte en lamina** para ver los nodos, que son
huecos interiores y a traves de una nube opaca no se ven.

### La ocupacion la calcula el motor de llenado

Las figuras de Pauli, Hund y magnetismo no llevan escrito «el nitrogeno tiene
tres flechas arriba»: preguntan a `analysis/electronic.ts`, el mismo codigo que
escribe la configuracion en la ficha de cualquier elemento. La densidad de
puntos es proporcional al numero de electrones del orbital, que es lo que la
densidad electronica hace de verdad. Si manana se corrigiera una anomalia del
cromo, el dibujo cambiaria solo.

El guia **no sabe quimica**. Ninguna de sus frases afirma nada que no venga de
un motor, y cada pista muestra su procedencia. Cuando el motor no sabe algo, el
guia lo dice.

Con dos reactivos en el banco y antes de predecir, pregunta que crees que va a
pasar (§23) — nombrando solo las familias de los reactivos, nunca el resultado.
Al responder muestra la explicacion del motor, se acierte o no, con la opcion
correcta senalada.

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

**350 pruebas** cubren el nucleo, la nomenclatura, el motor de reacciones y el
motor de analisis. Incluyen redox exigentes, la cadena completa del calcio, la
ruta del azufre al acido sulfurico, el ejemplo estequiometrico del §26 (2,00 g
de CaCO₃ en 50 mL de HCl 1,0 M: limitante, exceso y volumen de CO₂), y los
casos de analisis que separan a quien entiende un modelo de quien lo aplica de
memoria: CO con su carga formal invertida, BF₃ sin octeto, SF₆ y XeF₄
expandidos, Fe²⁺ perdiendo los 4s antes que los 3d, la fosfina polar sin
enlaces polares, y el orden de puntos de ebullicion H₂O > H₂S sin conocer
ninguna cifra.

### Lo que el motor de analisis se NIEGA a responder

El motor de Lewis construye esqueletos de **un solo centro** con terminales
alrededor. Cuando la especie no tiene esa forma, el algoritmo no falla: cuelga
igualmente todos los atomos del centro y devuelve una estructura **bien
formada y equivocada**. Por eso cada caso se comprueba ANTES de construir
nada, y se explica en lugar de dibujarse:

- **Oxoacidos** (HNO₃, H₂SO₄, HClO₄…). El hidrogeno va sobre un OXIGENO, no
  sobre el centro: el nitrico es HO–NO₂ y el sulfurico (HO)₂SO₂. Es un
  esqueleto de dos niveles.
- **Metales** (NaOH, NaCl, FeCl₃…). Un metal no comparte pares: los cede. Con
  una excepcion declarada, el **berilio**, cuyos compuestos son covalentes por
  las reglas de Fajans — y por eso el BeCl₂ si se analiza.
- **Varios hidrogenos sobre varios centros** (H₂O₂, N₂H₄). El agua oxigenada
  es H–O–O–H, con un hidrogeno en cada oxigeno. Con UN solo hidrogeno no hay
  nada que repartir, y por eso el HCN (H–C≡N) si sale.
- **Sustancias simples de cuatro atomos o mas** (P₄, S₈). Son anillos y
  jaulas, no estrellas. El corte esta en cuatro: el ozono O₃ es angular y si
  se construye.
- **Radicales** (NO, NO₂, O₂⁻). Numero impar de electrones de valencia, y el
  modelo reparte en PARES.
- **Cadenas de carbono** (C₂H₆O, CH₃COOH, glucosa). C₂H₆O puede ser etanol
  (C–C–O) o dimetil eter (C–O–C), y la formula no lo decide.
- **Compuestos ionicos** (NaCl y demas). No existe «una molecula» de NaCl.

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
