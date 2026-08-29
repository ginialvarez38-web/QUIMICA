/**
 * Base de datos de reacciones curadas — capa 2.
 *
 * DECISION DE DISENO: los coeficientes NO se escriben aqui.
 * Cada entrada declara solo reactivos y productos; el balanceador exacto del
 * nucleo calcula los coeficientes al cargar el modulo. Dos consecuencias:
 *
 *   1. Es imposible que la base de datos contenga una ecuacion mal balanceada:
 *      si no balancea, el modulo lanza al cargarse y la prueba falla.
 *   2. No hay dos fuentes de verdad que puedan desincronizarse.
 *
 * El perfil energetico tampoco se escribe: se calcula con la ley de Hess a
 * partir de las entalpias de formacion de la base de especies (engine/energy).
 * Donde falten datos, el resultado es "desconocido" y la interfaz lo dice.
 *
 * NIVEL DE EVIDENCIA (§32)
 *   established  — reaccion de libro de texto, reproducible.
 *   conditional  — correcta SOLO bajo las condiciones declaradas.
 */

import type {
  EvidenceLevel,
  HazardLevel,
  ReactionCondition,
  ReactionType,
  Reaction,
  ChemicalEquation,
} from '../core/types.js';
import { balanceFormulas } from '../core/balance.js';
import { getSpecies } from './species.js';

interface ReactionDef {
  readonly id: string;
  readonly reactants: readonly string[];
  readonly products: readonly string[];
  readonly types: readonly ReactionType[];
  readonly conditions?: ReactionCondition;
  readonly evidence?: EvidenceLevel;
  readonly hazard?: HazardLevel;
  /** Por que ocurre. Es el campo mas importante de toda la base de datos. */
  readonly explanation: string;
  readonly observations?: readonly string[];
  readonly difficulty?: 1 | 2 | 3 | 4 | 5;
  readonly concepts?: readonly string[];
  readonly reversible?: boolean;
}

const T = (celsius: number, description?: string): ReactionCondition => ({
  temperature: { value: celsius + 273.15, unit: 'K' },
  ...(description ? { description } : {}),
});

const AMBIENT: ReactionCondition = {
  temperature: { value: 298.15, unit: 'K' },
  description: 'temperatura ambiente',
};

const AQUEOUS: ReactionCondition = {
  temperature: { value: 298.15, unit: 'K' },
  solvent: 'agua',
  description: 'en disolucion acuosa, temperatura ambiente',
};

const DEFS: ReactionDef[] = [
  // =========================================================================
  // CADENA DEL CALCIO — el ejemplo vertebral del brief (§1)
  // =========================================================================
  {
    id: 'ca-o2-cao',
    reactants: ['Ca', 'O2'],
    products: ['CaO'],
    types: ['synthesis', 'redox', 'oxidation'],
    conditions: { description: 'combustion al aire; el calcio arde con llama rojo anaranjada' },
    hazard: 'hazardous',
    explanation:
      'El calcio es un metal alcalinoterreo con dos electrones de valencia que cede con facilidad. El oxigeno, muy electronegativo, los capta. Se forman Ca²⁺ y O²⁻, que al tener cargas iguales y opuestas se combinan 1:1 dando CaO. Es una reaccion redox: el calcio se oxida (0 -> +2) y el oxigeno se reduce (0 -> -2).',
    observations: ['Llama rojo anaranjada brillante', 'Queda un solido blanco'],
    difficulty: 1,
    concepts: ['sintesis', 'redox', 'enlace ionico', 'estados de oxidacion'],
  },
  {
    id: 'cao-h2o-caoh2',
    reactants: ['CaO', 'H2O'],
    products: ['Ca(OH)2'],
    types: ['synthesis', 'hydration'],
    conditions: AMBIENT,
    hazard: 'hazardous',
    explanation:
      'El oxido de calcio es un OXIDO BASICO: el ion O²⁻ es una base muy fuerte y arranca un proton del agua. El resultado son dos iones OH⁻ que quedan junto al Ca²⁺. La regla general es "oxido de metal + agua -> hidroxido". La reaccion libera mucho calor, por eso se llama apagado de la cal.',
    observations: ['El solido se hincha y se desmenuza', 'Fuerte desprendimiento de calor', 'Puede llegar a hervir el agua'],
    difficulty: 1,
    concepts: ['oxido basico', 'hidratacion', 'reaccion exotermica'],
  },
  {
    id: 'caoh2-co2-caco3',
    reactants: ['Ca(OH)2', 'CO2'],
    products: ['CaCO3', 'H2O'],
    types: ['acid-base', 'precipitation'],
    conditions: AQUEOUS,
    hazard: 'safe',
    explanation:
      'El CO2 es un OXIDO ACIDO: en agua forma acido carbonico. El hidroxido de calcio es una base. Reaccionan neutralizandose y, como el carbonato de calcio es insoluble, precipita. Esta es la prueba clasica del dioxido de carbono: el agua de cal se enturbia.',
    observations: ['La disolucion transparente se vuelve lechosa', 'Precipitado blanco fino'],
    difficulty: 2,
    concepts: ['oxido acido', 'neutralizacion', 'precipitacion', 'ensayo del CO2'],
  },
  {
    id: 'caco3-hcl',
    reactants: ['CaCO3', 'HCl'],
    products: ['CaCl2', 'H2O', 'CO2'],
    types: ['acid-base', 'double-displacement'],
    conditions: AQUEOUS,
    hazard: 'special-conditions',
    explanation:
      'Un acido fuerte desplaza al acido carbonico, que es mucho mas debil, de su sal. El H2CO3 formado es inestable y se descompone inmediatamente en agua y CO2 gaseoso. El escape del gas retira producto del medio y empuja la reaccion hasta el final.',
    observations: ['Efervescencia vigorosa', 'El solido se disuelve', 'El gas apaga una cerilla'],
    difficulty: 2,
    concepts: ['acido-base', 'desplazamiento de acido debil', 'principio de Le Chatelier'],
  },
  {
    id: 'caco3-calcinacion',
    reactants: ['CaCO3'],
    products: ['CaO', 'CO2'],
    types: ['decomposition', 'calcination'],
    conditions: T(900, 'calcinacion en horno, por encima de 825 °C'),
    evidence: 'conditional',
    hazard: 'special-conditions',
    explanation:
      'A temperatura ambiente el carbonato de calcio es perfectamente estable: esta reaccion es endotermica y su ΔG solo se hace negativo por encima de unos 825 °C, cuando el termino -TΔS (favorable, porque se genera un gas) supera al ΔH desfavorable. Es un ejemplo directo de como la temperatura decide la espontaneidad.',
    observations: ['Desprendimiento de CO2', 'Queda cal viva solida'],
    difficulty: 3,
    concepts: ['descomposicion termica', 'termodinamica', 'entropia', 'espontaneidad'],
  },
  {
    id: 'cao-co2-caco3',
    reactants: ['CaO', 'CO2'],
    products: ['CaCO3'],
    types: ['synthesis', 'acid-base'],
    conditions: AMBIENT,
    hazard: 'safe',
    explanation:
      'Oxido basico mas oxido acido dan la sal correspondiente, sin necesidad de agua. Es la reaccion inversa de la calcinacion y la que hace que la cal viva se degrade al aire con el tiempo.',
    observations: ['El solido gana masa lentamente'],
    difficulty: 2,
    concepts: ['oxido basico', 'oxido acido', 'sintesis'],
  },
  {
    id: 'ca-h2o',
    reactants: ['Ca', 'H2O'],
    products: ['Ca(OH)2', 'H2'],
    types: ['single-displacement', 'redox'],
    conditions: AMBIENT,
    hazard: 'hazardous',
    explanation:
      'El calcio esta muy arriba en la serie de actividad: es capaz de reducir el hidrogeno del agua. El calcio se oxida a Ca²⁺ y el H⁺ del agua se reduce a H2 gaseoso. Reacciona mas lentamente que el sodio porque el Ca(OH)2 poco soluble recubre el metal.',
    observations: ['Burbujeo de hidrogeno', 'El agua se enturbia'],
    difficulty: 2,
    concepts: ['serie de actividad', 'redox', 'desplazamiento simple'],
  },
  {
    id: 'caco3-co2-h2o',
    reactants: ['CaCO3', 'CO2', 'H2O'],
    products: ['Ca(HCO3)2'],
    types: ['dissolution', 'acid-base'],
    conditions: { ...AQUEOUS, description: 'agua con CO2 disuelto' },
    evidence: 'conditional',
    reversible: true,
    hazard: 'safe',
    explanation:
      'El carbonato de calcio es insoluble, pero en presencia de CO2 disuelto se convierte en bicarbonato, que si es soluble. Este equilibrio explica dos fenomenos a la vez: como el agua de lluvia excava las cuevas calizas, y como al hervir el agua dura se deposita la cal en las tuberias, porque el equilibrio se desplaza hacia la izquierda al escapar el CO2.',
    observations: ['El solido se disuelve lentamente'],
    difficulty: 3,
    concepts: ['equilibrio', 'dureza del agua', 'karst', 'Le Chatelier'],
  },

  // =========================================================================
  // RUTA DEL AZUFRE AL ACIDO SULFURICO (§45)
  // =========================================================================
  {
    id: 's-o2-so2',
    reactants: ['S', 'O2'],
    products: ['SO2'],
    types: ['synthesis', 'combustion', 'redox'],
    conditions: { description: 'combustion del azufre al aire' },
    hazard: 'hazardous',
    explanation:
      'El azufre arde con llama azul dando dioxido de azufre. El azufre pasa de 0 a +4 y el oxigeno de 0 a -2. Es la primera etapa industrial para fabricar acido sulfurico.',
    observations: ['Llama azul palida', 'Gas de olor picante e irritante'],
    difficulty: 1,
    concepts: ['combustion', 'redox', 'oxido acido'],
  },
  {
    id: 'so2-o2-so3',
    reactants: ['SO2', 'O2'],
    products: ['SO3'],
    types: ['synthesis', 'redox', 'oxidation'],
    conditions: {
      temperature: { value: 723.15, unit: 'K' },
      pressure: { value: 1, unit: 'atm' },
      catalyst: 'V2O5 (pentaoxido de divanadio)',
      description: 'proceso de contacto: 400-450 °C con catalizador de V2O5',
    },
    evidence: 'conditional',
    reversible: true,
    hazard: 'hazardous',
    explanation:
      'Sin catalizador esta reaccion es demasiado lenta para ser util, aunque sea termodinamicamente favorable. Es el ejemplo canonico de la diferencia entre POSIBLE y RAPIDA. El V2O5 baja la energia de activacion. Ademas es exotermica, asi que subir la temperatura acelera pero reduce el rendimiento de equilibrio: la industria elige 400-450 °C como compromiso.',
    observations: ['Sin cambio visible: ambos gases son practicamente incoloros'],
    difficulty: 4,
    concepts: ['catalisis', 'equilibrio', 'cinetica frente a termodinamica', 'proceso de contacto'],
  },
  {
    id: 'so3-h2o-h2so4',
    reactants: ['SO3', 'H2O'],
    products: ['H2SO4'],
    types: ['synthesis', 'hydration'],
    conditions: { description: 'en la industria se absorbe primero en H2SO4 concentrado, no en agua' },
    evidence: 'conditional',
    hazard: 'do-not-attempt',
    explanation:
      'El trioxido de azufre es el anhidrido del acido sulfurico: con agua da el acido directamente. La reaccion es tan exotermica y violenta que en la industria NO se hace con agua, sino absorbiendo el SO3 en acido sulfurico concentrado para formar oleum, que despues se diluye de forma controlada.',
    observations: ['Nieblas densas', 'Fuerte desprendimiento de calor'],
    difficulty: 3,
    concepts: ['anhidrido', 'oxoacido', 'proceso industrial'],
  },
  {
    id: 'so2-h2o-h2so3',
    reactants: ['SO2', 'H2O'],
    products: ['H2SO3'],
    types: ['synthesis', 'hydration'],
    conditions: AQUEOUS,
    reversible: true,
    evidence: 'conditional',
    hazard: 'hazardous',
    explanation:
      'Todo oxido acido reacciona con agua dando su oxoacido. El acido sulfuroso solo existe en disolucion: no se puede aislar puro. Junto con los oxidos de nitrogeno, esta reaccion es la responsable de la lluvia acida.',
    difficulty: 2,
    concepts: ['oxido acido', 'lluvia acida'],
  },

  // =========================================================================
  // NEUTRALIZACIONES (§9)
  // =========================================================================
  {
    id: 'hcl-naoh',
    reactants: ['HCl', 'NaOH'],
    products: ['NaCl', 'H2O'],
    types: ['neutralization', 'acid-base', 'double-displacement'],
    conditions: AQUEOUS,
    hazard: 'special-conditions',
    explanation:
      'El ejemplo canonico de neutralizacion. En realidad, en disolucion los cuatro iones estan separados y lo unico que ocurre es H⁺ + OH⁻ -> H2O. El Na⁺ y el Cl⁻ son iones espectadores: no cambian. La sal solo aparece si se evapora el agua. La fuerza motriz es la formacion de agua, un electrolito muy debil.',
    observations: ['Sin cambio visible', 'La mezcla se calienta', 'El pH se acerca a 7'],
    difficulty: 1,
    concepts: ['neutralizacion', 'iones espectadores', 'ecuacion ionica neta', 'pH'],
  },
  {
    id: 'h2so4-naoh',
    reactants: ['H2SO4', 'NaOH'],
    products: ['Na2SO4', 'H2O'],
    types: ['neutralization', 'acid-base', 'double-displacement'],
    conditions: AQUEOUS,
    hazard: 'hazardous',
    explanation:
      'El acido sulfurico es diprotico: cede dos protones, luego hace falta el doble de hidroxido de sodio. Es el caso donde el estudiante descubre que la estequiometria 1:1 no es universal.',
    observations: ['Calentamiento apreciable'],
    difficulty: 2,
    concepts: ['neutralizacion', 'acido poliprotico', 'estequiometria'],
  },
  {
    id: 'hcl-caoh2',
    reactants: ['HCl', 'Ca(OH)2'],
    products: ['CaCl2', 'H2O'],
    types: ['neutralization', 'acid-base', 'double-displacement'],
    conditions: AQUEOUS,
    hazard: 'special-conditions',
    explanation:
      'La base aporta dos grupos OH⁻ por formula, luego se necesitan dos HCl. Simetrico al caso del acido diprotico.',
    difficulty: 2,
    concepts: ['neutralizacion', 'estequiometria'],
  },
  {
    id: 'cao-hcl',
    reactants: ['CaO', 'HCl'],
    products: ['CaCl2', 'H2O'],
    types: ['acid-base'],
    conditions: AQUEOUS,
    hazard: 'special-conditions',
    explanation:
      'Un oxido basico reacciona directamente con un acido dando sal y agua, sin pasar por el hidroxido. La regla general es "oxido basico + acido -> sal + agua".',
    difficulty: 2,
    concepts: ['oxido basico', 'acido-base'],
  },
  {
    id: 'nh3-hcl',
    reactants: ['NH3', 'HCl'],
    products: ['NH4Cl'],
    types: ['acid-base', 'synthesis'],
    conditions: { description: 'los gases reaccionan directamente' },
    hazard: 'hazardous',
    explanation:
      'Neutralizacion sin agua y sin iones OH⁻: el amoniaco actua como base de Bronsted-Lowry captando el proton del HCl. Demuestra que la teoria de Arrhenius se queda corta y hace falta la de Bronsted-Lowry.',
    observations: ['Humo blanco denso al juntar los vapores de ambos frascos'],
    difficulty: 3,
    concepts: ['Bronsted-Lowry', 'base sin OH', 'acido-base'],
  },
  {
    id: 'nahco3-ch3cooh',
    reactants: ['NaHCO3', 'CH3COOH'],
    products: ['CH3COONa', 'H2O', 'CO2'],
    types: ['acid-base', 'double-displacement'],
    conditions: AQUEOUS,
    hazard: 'safe',
    explanation:
      'El bicarbonato es la base conjugada del acido carbonico y capta el proton del acido acetico. Se forma acido carbonico, que se descompone en agua y CO2. Es el "volcan" de bicarbonato y vinagre.',
    observations: ['Efervescencia abundante', 'La mezcla se enfria ligeramente'],
    difficulty: 1,
    concepts: ['acido-base', 'acido debil', 'reaccion endotermica'],
  },

  // =========================================================================
  // PRECIPITACIONES (§8)
  // =========================================================================
  {
    id: 'agno3-nacl',
    reactants: ['AgNO3', 'NaCl'],
    products: ['AgCl', 'NaNO3'],
    types: ['precipitation', 'double-displacement'],
    conditions: AQUEOUS,
    hazard: 'special-conditions',
    explanation:
      'Todas las sales de nitrato son solubles y casi todos los cloruros tambien, pero el cloruro de plata es una excepcion notoria. Al mezclar las disoluciones, Ag⁺ y Cl⁻ se encuentran y forman un solido que abandona la disolucion. La ecuacion ionica neta es simplemente Ag⁺ + Cl⁻ -> AgCl.',
    observations: ['Precipitado blanco cuajado', 'Oscurece a violeta con la luz'],
    difficulty: 2,
    concepts: ['precipitacion', 'reglas de solubilidad', 'ecuacion ionica neta', 'Kps'],
  },
  {
    id: 'bacl2-na2so4',
    reactants: ['BaCl2', 'Na2SO4'],
    products: ['BaSO4', 'NaCl'],
    types: ['precipitation', 'double-displacement'],
    conditions: AQUEOUS,
    hazard: 'hazardous',
    explanation:
      'El sulfato de bario es una de las sales mas insolubles que se conocen. Por eso esta reaccion sirve como ensayo cuantitativo de sulfatos y por eso el BaSO4 puede ingerirse como contraste radiologico sin ser toxico, pese a que los iones Ba²⁺ libres si lo son.',
    observations: ['Precipitado blanco fino y denso'],
    difficulty: 2,
    concepts: ['precipitacion', 'reglas de solubilidad', 'analisis gravimetrico'],
  },
  {
    id: 'pbno32-ki',
    reactants: ['Pb(NO3)2', 'KI'],
    products: ['PbI2', 'KNO3'],
    types: ['precipitation', 'double-displacement'],
    conditions: AQUEOUS,
    hazard: 'hazardous',
    explanation:
      'Los yoduros son solubles salvo los de plata, mercurio y plomo. Al juntar las disoluciones incoloras aparece un precipitado amarillo intenso. Si se calienta hasta disolverlo y se deja enfriar despacio, cristaliza en laminas doradas: la "lluvia de oro".',
    observations: ['Precipitado amarillo brillante inmediato'],
    difficulty: 2,
    concepts: ['precipitacion', 'reglas de solubilidad', 'cristalizacion'],
  },

  // =========================================================================
  // DESPLAZAMIENTO SIMPLE Y REDOX (§17)
  // =========================================================================
  {
    id: 'zn-cuso4',
    reactants: ['Zn', 'CuSO4'],
    products: ['ZnSO4', 'Cu'],
    types: ['single-displacement', 'redox'],
    conditions: AQUEOUS,
    hazard: 'special-conditions',
    explanation:
      'El zinc esta por encima del cobre en la serie de actividad, luego cede electrones con mas facilidad. El zinc se oxida (Zn -> Zn²⁺ + 2e⁻) y el ion cobre se reduce (Cu²⁺ + 2e⁻ -> Cu). Los dos electrones pasan directamente de un atomo a otro. Si se separan las semirreacciones en dos vasos unidos por un puente salino, esos mismos electrones circulan por un cable: es la pila Daniell.',
    observations: ['La lamina de zinc se recubre de cobre rojizo', 'El azul de la disolucion se desvanece', 'La disolucion se calienta'],
    difficulty: 3,
    concepts: ['redox', 'serie de actividad', 'semirreacciones', 'pila galvanica'],
  },
  {
    id: 'fe-cuso4',
    reactants: ['Fe', 'CuSO4'],
    products: ['FeSO4', 'Cu'],
    types: ['single-displacement', 'redox'],
    conditions: AQUEOUS,
    hazard: 'safe',
    explanation:
      'El hierro tambien esta por encima del cobre en la serie de actividad y lo desplaza de su sal. Un clavo sumergido en sulfato de cobre se cubre de cobre metalico.',
    observations: ['El clavo se recubre de cobre rojizo', 'El azul palidece hacia verde'],
    difficulty: 2,
    concepts: ['redox', 'serie de actividad'],
  },
  {
    id: 'zn-hcl',
    reactants: ['Zn', 'HCl'],
    products: ['ZnCl2', 'H2'],
    types: ['single-displacement', 'redox'],
    conditions: AQUEOUS,
    hazard: 'special-conditions',
    explanation:
      'Cualquier metal situado por encima del hidrogeno en la serie de actividad desplaza al H⁺ de un acido. El zinc se oxida a Zn²⁺ y el hidrogeno del acido se reduce a H2 gaseoso.',
    observations: ['Burbujeo constante', 'El metal se consume', 'El gas arde con un pequeno estallido'],
    difficulty: 2,
    concepts: ['redox', 'serie de actividad', 'obtencion de hidrogeno'],
  },
  {
    id: 'cu-agno3',
    reactants: ['Cu', 'AgNO3'],
    products: ['Cu(NO3)2', 'Ag'],
    types: ['single-displacement', 'redox'],
    conditions: AQUEOUS,
    hazard: 'special-conditions',
    explanation:
      'El cobre esta por encima de la plata en la serie de actividad. Se forman cristales de plata metalica sobre el cobre mientras la disolucion se vuelve azul por el Cu²⁺ que entra en ella. Es la contrapartida de la reaccion Zn/Cu, un escalon mas abajo en la serie.',
    observations: ['Cristales grises brillantes de plata', 'La disolucion incolora se vuelve azul'],
    difficulty: 3,
    concepts: ['redox', 'serie de actividad'],
  },
  {
    id: 'na-h2o',
    reactants: ['Na', 'H2O'],
    products: ['NaOH', 'H2'],
    types: ['single-displacement', 'redox'],
    conditions: AMBIENT,
    hazard: 'do-not-attempt',
    explanation:
      'Los metales alcalinos ceden su unico electron de valencia con enorme facilidad y reducen el agua. Se libera tanto calor que el hidrogeno producido suele inflamarse.',
    observations: ['El metal se funde en una bola que corre por la superficie', 'Llama amarilla caracteristica del sodio', 'La disolucion se vuelve basica'],
    difficulty: 2,
    concepts: ['metales alcalinos', 'redox', 'serie de actividad'],
  },
  {
    id: 'kmno4-hcl',
    reactants: ['KMnO4', 'HCl'],
    products: ['KCl', 'MnCl2', 'H2O', 'Cl2'],
    types: ['redox'],
    conditions: { ...AQUEOUS, description: 'HCl concentrado' },
    evidence: 'conditional',
    hazard: 'do-not-attempt',
    explanation:
      'Redox exigente y ejemplo clasico de balanceo. El manganeso baja de +7 a +2, ganando 5 electrones por atomo; el cloro sube de -1 a 0, cediendo 1 electron por atomo. Para que los electrones cuadren hacen falta 5 cloros oxidados por cada manganeso reducido, lo que explica el coeficiente 5 del Cl2 y el 16 del HCl. Genera cloro gaseoso toxico.',
    observations: ['El violeta intenso desaparece', 'Se desprende gas amarillo verdoso'],
    difficulty: 5,
    concepts: ['redox', 'balanceo por ion-electron', 'agente oxidante', 'agente reductor'],
  },
  {
    id: 'fe2o3-al-termita',
    reactants: ['Fe2O3', 'Al'],
    products: ['Al2O3', 'Fe'],
    types: ['single-displacement', 'redox'],
    conditions: T(1000, 'requiere ignicion con cinta de magnesio; alcanza mas de 2500 °C'),
    evidence: 'conditional',
    hazard: 'do-not-attempt',
    explanation:
      'El aluminio tiene mucha mas afinidad por el oxigeno que el hierro: la formacion de Al2O3 libera 1675,7 kJ/mol frente a los 824,2 del Fe2O3. Esa diferencia se desprende como calor, suficiente para fundir el hierro producido. Es la reaccion de la termita, usada para soldar railes.',
    observations: ['Luz cegadora', 'Hierro fundido incandescente', 'Temperaturas superiores a 2500 °C'],
    difficulty: 4,
    concepts: ['redox', 'aluminotermia', 'entalpia de formacion', 'ley de Hess'],
  },
  {
    id: 'fe2o3-co-altohorno',
    reactants: ['Fe2O3', 'CO'],
    products: ['Fe', 'CO2'],
    types: ['redox', 'reduction'],
    conditions: T(1200, 'alto horno, corriente de monoxido de carbono'),
    evidence: 'conditional',
    hazard: 'do-not-attempt',
    explanation:
      'Reduccion industrial del mineral de hierro. El monoxido de carbono actua como agente reductor: se oxida a CO2 arrancandole el oxigeno al oxido de hierro. Es la reaccion central de la siderurgia y una de las de mayor tonelaje del planeta.',
    difficulty: 4,
    concepts: ['redox', 'metalurgia', 'agente reductor', 'alto horno'],
  },

  // =========================================================================
  // COMBUSTIONES
  // =========================================================================
  {
    id: 'ch4-combustion',
    reactants: ['CH4', 'O2'],
    products: ['CO2', 'H2O'],
    types: ['combustion', 'redox'],
    conditions: { description: 'combustion completa, con exceso de oxigeno' },
    evidence: 'conditional',
    hazard: 'hazardous',
    explanation:
      'Combustion completa de un hidrocarburo: todo el carbono acaba como CO2 y todo el hidrogeno como H2O. La condicion "exceso de oxigeno" no es decorativa: si falta oxigeno se forma CO, que es letal, o incluso hollin.',
    observations: ['Llama azul', 'Fuerte desprendimiento de calor'],
    difficulty: 2,
    concepts: ['combustion', 'hidrocarburos', 'balanceo', 'reactivo limitante'],
  },
  {
    id: 'ch4-combustion-incompleta',
    reactants: ['CH4', 'O2'],
    products: ['CO', 'H2O'],
    types: ['combustion', 'redox'],
    conditions: { description: 'combustion incompleta, con oxigeno insuficiente' },
    evidence: 'conditional',
    hazard: 'do-not-attempt',
    explanation:
      'Con oxigeno insuficiente, el carbono solo se oxida hasta +2 en lugar de +4. El producto es monoxido de carbono, inodoro y letal. Los mismos reactivos dan productos distintos segun las condiciones: es el ejemplo mas claro de por que el sandbox nunca debe presentar una reaccion como universal.',
    observations: ['Llama amarilla en lugar de azul', 'Puede aparecer hollin'],
    difficulty: 3,
    concepts: ['combustion incompleta', 'efecto de las condiciones', 'seguridad'],
  },
  {
    id: 'c3h8-combustion',
    reactants: ['C3H8', 'O2'],
    products: ['CO2', 'H2O'],
    types: ['combustion', 'redox'],
    conditions: { description: 'combustion completa' },
    evidence: 'conditional',
    hazard: 'hazardous',
    explanation:
      'Combustion del propano, el gas de las bombonas. El coeficiente 5 del oxigeno sale de balancear primero el carbono, despues el hidrogeno y dejar el oxigeno para el final.',
    difficulty: 2,
    concepts: ['combustion', 'balanceo'],
  },
  {
    id: 'c2h5oh-combustion',
    reactants: ['C2H5OH', 'O2'],
    products: ['CO2', 'H2O'],
    types: ['combustion', 'redox'],
    conditions: { description: 'combustion completa' },
    evidence: 'conditional',
    hazard: 'hazardous',
    explanation:
      'El etanol ya contiene oxigeno en su molecula, asi que necesita menos O2 externo que un hidrocarburo de tamano parecido. Es un detalle que suele fallarse al balancear.',
    observations: ['Llama azul palida, casi invisible a plena luz'],
    difficulty: 3,
    concepts: ['combustion', 'balanceo', 'biocombustibles'],
  },
  {
    id: 'mg-o2',
    reactants: ['Mg', 'O2'],
    products: ['MgO'],
    types: ['synthesis', 'combustion', 'redox'],
    conditions: { description: 'ignicion; arde incluso en atmosfera de CO2' },
    hazard: 'hazardous',
    explanation:
      'El magnesio arde con una llama blanca deslumbrante. Su avidez por el oxigeno es tal que puede arrancarselo al propio CO2, por lo que un extintor de dioxido de carbono no apaga un fuego de magnesio: lo alimenta.',
    observations: ['Luz blanca intensisima', 'Queda un polvo blanco'],
    difficulty: 1,
    concepts: ['combustion', 'redox', 'seguridad contra incendios'],
  },
  {
    id: 'glucosa-respiracion',
    reactants: ['C6H12O6', 'O2'],
    products: ['CO2', 'H2O'],
    types: ['combustion', 'redox'],
    conditions: { description: 'en el organismo ocurre en muchas etapas enzimaticas, no de golpe' },
    evidence: 'conditional',
    hazard: 'safe',
    explanation:
      'La respiracion celular. Globalmente es la misma ecuacion que quemar azucar, pero el organismo la desarrolla en decenas de pasos enzimaticos para capturar la energia en forma de ATP en lugar de perderla como calor. La ecuacion global es correcta; el mecanismo real es muchisimo mas complejo.',
    difficulty: 3,
    concepts: ['respiracion celular', 'combustion', 'bioquimica', 'mecanismo'],
  },
  {
    id: 'fotosintesis',
    reactants: ['CO2', 'H2O'],
    products: ['C6H12O6', 'O2'],
    types: ['redox', 'reduction'],
    conditions: { catalyst: 'clorofila', description: 'requiere energia luminosa' },
    evidence: 'conditional',
    hazard: 'safe',
    explanation:
      'La inversa global de la respiracion. Es fuertemente endergonica: no ocurre sola, necesita el aporte continuo de energia luminosa. Es el ejemplo perfecto de una reaccion termodinamicamente desfavorable que se hace posible acoplandola a una fuente externa de energia.',
    difficulty: 4,
    concepts: ['fotosintesis', 'reaccion endergonica', 'acoplamiento energetico'],
  },

  // =========================================================================
  // DESCOMPOSICIONES
  // =========================================================================
  {
    id: 'nahco3-descomposicion',
    reactants: ['NaHCO3'],
    products: ['Na2CO3', 'H2O', 'CO2'],
    types: ['decomposition'],
    conditions: T(100, 'por encima de unos 80-100 °C'),
    evidence: 'conditional',
    hazard: 'safe',
    explanation:
      'Al calentarse, el bicarbonato libera CO2. Esto es lo que hace subir los bizcochos: las burbujas de gas quedan atrapadas en la masa. Tambien es la base de los extintores de polvo.',
    observations: ['Desprendimiento de gas', 'El solido pierde masa'],
    difficulty: 2,
    concepts: ['descomposicion termica', 'aplicaciones domesticas'],
  },
  {
    id: 'h2o2-descomposicion',
    reactants: ['H2O2'],
    products: ['H2O', 'O2'],
    types: ['decomposition', 'redox'],
    conditions: { catalyst: 'MnO2, KI o la enzima catalasa', description: 'lenta sin catalizador, muy rapida con el' },
    evidence: 'conditional',
    hazard: 'special-conditions',
    explanation:
      'Desproporcion: el mismo elemento se oxida y se reduce a la vez. El oxigeno del peroxido esta en -1, y pasa a -2 en el agua (reduccion) y a 0 en el O2 (oxidacion). Sin catalizador es lenta pese a ser muy favorable: otro caso de barrera cinetica.',
    observations: ['Burbujeo de oxigeno', 'Con catalasa, espuma inmediata y abundante'],
    difficulty: 4,
    concepts: ['descomposicion', 'desproporcion', 'catalisis', 'cinetica'],
  },
  {
    id: 'kclo3-descomposicion',
    reactants: ['KClO3'],
    products: ['KCl', 'O2'],
    types: ['decomposition', 'redox'],
    conditions: { temperature: { value: 673.15, unit: 'K' }, catalyst: 'MnO2', description: 'calentamiento, acelerado por MnO2' },
    evidence: 'conditional',
    hazard: 'hazardous',
    explanation:
      'Metodo clasico de laboratorio para obtener oxigeno. El cloro se reduce de +5 a -1 mientras el oxigeno se oxida de -2 a 0.',
    observations: ['Desprendimiento de oxigeno', 'Una astilla en ascua se reaviva'],
    difficulty: 3,
    concepts: ['descomposicion', 'redox', 'obtencion de oxigeno'],
  },

  // =========================================================================
  // SINTESIS INDUSTRIALES
  // =========================================================================
  {
    id: 'haber-bosch',
    reactants: ['N2', 'H2'],
    products: ['NH3'],
    types: ['synthesis', 'redox'],
    conditions: {
      temperature: { value: 723.15, unit: 'K' },
      pressure: { value: 200, unit: 'atm' },
      catalyst: 'hierro con promotores de K2O y Al2O3',
      description: 'proceso Haber-Bosch: 400-500 °C y 150-300 atm',
    },
    evidence: 'conditional',
    reversible: true,
    hazard: 'special-conditions',
    explanation:
      'Romper el triple enlace N≡N cuesta 945 kJ/mol, lo que hace la reaccion lentisima sin catalizador. Es exotermica y disminuye el numero de moles de gas, asi que el equilibrio se favorece con presion alta y temperatura baja; pero a baja temperatura la velocidad es inutilizable. El compromiso industrial (400-500 °C, presion muy alta, catalizador de hierro) es el ejemplo mas didactico que existe de equilibrio y cinetica tirando en direcciones opuestas.',
    difficulty: 5,
    concepts: ['equilibrio', 'Le Chatelier', 'catalisis', 'compromiso industrial', 'fijacion de nitrogeno'],
  },
  {
    id: 'h2-o2-agua',
    reactants: ['H2', 'O2'],
    products: ['H2O'],
    types: ['synthesis', 'combustion', 'redox'],
    conditions: { description: 'necesita chispa o llama para iniciarse' },
    hazard: 'do-not-attempt',
    explanation:
      'La mezcla de hidrogeno y oxigeno puede permanecer indefinidamente sin reaccionar a temperatura ambiente pese a ser enormemente exotermica: hace falta vencer la energia de activacion. Una vez iniciada, el calor liberado mantiene la reaccion y resulta explosiva.',
    observations: ['Detonacion', 'Se condensan gotas de agua'],
    difficulty: 2,
    concepts: ['sintesis', 'energia de activacion', 'combustion', 'pila de combustible'],
  },
  {
    id: 'na-cl2',
    reactants: ['Na', 'Cl2'],
    products: ['NaCl'],
    types: ['synthesis', 'redox'],
    conditions: { description: 'el sodio arde en atmosfera de cloro' },
    hazard: 'do-not-attempt',
    explanation:
      'El ejemplo canonico de enlace ionico. El sodio cede su unico electron de valencia y queda con la configuracion del neon; el cloro lo capta y alcanza la del argon. Ambos iones se atraen electrostaticamente formando una red cubica. Dos sustancias peligrosisimas dan como producto la sal de mesa.',
    observations: ['Llama amarilla intensa', 'Humo blanco de NaCl'],
    difficulty: 1,
    concepts: ['enlace ionico', 'transferencia de electrones', 'regla del octeto', 'red cristalina'],
  },
  {
    id: 'fe-s',
    reactants: ['Fe', 'S'],
    products: ['FeS'],
    types: ['synthesis', 'redox'],
    conditions: T(500, 'calentamiento de la mezcla'),
    evidence: 'conditional',
    hazard: 'special-conditions',
    explanation:
      'Experimento clasico para distinguir mezcla de compuesto: antes de calentar, un iman separa el hierro; despues de reaccionar, el sulfuro de hierro ya no es magnetico y no puede separarse por medios fisicos.',
    observations: ['La mezcla se pone al rojo y sigue reaccionando sola', 'El producto ya no es magnetico'],
    difficulty: 2,
    concepts: ['sintesis', 'mezcla frente a compuesto', 'propiedades'],
  },

  // =========================================================================
  // ORGANICA (§29) — el motor esta preparado desde el inicio
  // =========================================================================
  {
    id: 'esterificacion-fischer',
    reactants: ['CH3COOH', 'C2H5OH'],
    products: ['CH3COOC2H5', 'H2O'],
    types: ['esterification', 'substitution'],
    conditions: { catalyst: 'H2SO4 concentrado', description: 'calentamiento a reflujo con acido sulfurico como catalizador' },
    evidence: 'conditional',
    reversible: true,
    hazard: 'hazardous',
    explanation:
      'Esterificacion de Fischer. El acido sulfurico protona el carbonilo del acido y lo hace mas electrofilo, de modo que el alcohol puede atacarlo. La reaccion es reversible y no llega al 100 %: para desplazarla se elimina el agua o se usa exceso de alcohol. El OH que sale al agua proviene del ACIDO, no del alcohol, algo que se demostro con oxigeno-18.',
    observations: ['Olor afrutado caracteristico'],
    difficulty: 4,
    concepts: ['esterificacion', 'catalisis acida', 'equilibrio', 'mecanismo', 'marcaje isotopico'],
  },
  {
    id: 'etileno-hidrogenacion',
    reactants: ['C2H4', 'H2'],
    products: ['C2H6'],
    types: ['addition', 'reduction'],
    conditions: { catalyst: 'Pt, Pd o Ni finamente divididos', description: 'hidrogenacion catalitica' },
    evidence: 'conditional',
    hazard: 'hazardous',
    explanation:
      'Adicion al doble enlace: los dos carbonos del alqueno pasan de compartir dos pares a uno solo, y cada uno gana un hidrogeno. Sin catalizador metalico no ocurre a velocidad util. Es la misma quimica que hidrogena aceites vegetales para hacerlos solidos.',
    difficulty: 3,
    concepts: ['adicion', 'alquenos', 'hidrogenacion catalitica', 'insaturacion'],
  },
];

// ---------------------------------------------------------------------------
// Construccion: los coeficientes los pone el balanceador, no la mano
// ---------------------------------------------------------------------------

function buildEquation(def: ReactionDef): ChemicalEquation {
  const result = balanceFormulas(def.reactants, def.products);
  if (!result.ok) {
    throw new Error(
      `La reaccion curada "${def.id}" no se puede balancear: ${result.error} ${result.detail ?? ''}`,
    );
  }

  const stateOf = (formula: string) => getSpecies(formula)?.properties.state ?? undefined;

  return {
    reactants: def.reactants.map((formula, i) => ({
      speciesId: formula,
      formula,
      coefficient: result.value.reactantCoefficients[i]!,
      state: stateOf(formula),
    })),
    products: def.products.map((formula, i) => ({
      speciesId: formula,
      formula,
      coefficient: result.value.productCoefficients[i]!,
      state: stateOf(formula),
    })),
    balanced: true,
    ...(def.reversible ? { reversible: true } : {}),
  };
}

function buildReaction(def: ReactionDef): Reaction {
  return {
    id: def.id,
    equation: buildEquation(def),
    types: def.types,
    conditions: def.conditions ?? AMBIENT,
    // El perfil energetico se calcula bajo demanda desde engine/energy.ts.
    energy: {
      deltaH: { value: null, unit: 'kJ/mol' },
      activationEnergy: { value: null, unit: 'kJ/mol' },
      deltaG: { value: null, unit: 'kJ/mol' },
      deltaS: { value: null, unit: 'J/(mol K)' },
      character: 'unknown',
    },
    evidence: def.evidence ?? 'established',
    hazard: def.hazard ?? 'special-conditions',
    explanation: def.explanation,
    observations: def.observations ?? [],
    difficulty: def.difficulty ?? 2,
    concepts: def.concepts ?? [],
  };
}

export const REACTIONS: readonly Reaction[] = DEFS.map(buildReaction);

const BY_ID = new Map<string, Reaction>(REACTIONS.map((r) => [r.id, r]));

export function getReaction(id: string): Reaction | undefined {
  return BY_ID.get(id);
}

/** Todas las reacciones en las que la especie aparece como reactivo (§20). */
export function reactionsConsuming(formula: string): readonly Reaction[] {
  return REACTIONS.filter((r) => r.equation.reactants.some((t) => t.formula === formula));
}

/** Todas las reacciones que producen la especie (§21). */
export function reactionsProducing(formula: string): readonly Reaction[] {
  return REACTIONS.filter((r) => r.equation.products.some((t) => t.formula === formula));
}

/** Reacciones que involucran la especie en cualquier lado. */
export function reactionsInvolving(formula: string): readonly Reaction[] {
  return REACTIONS.filter(
    (r) =>
      r.equation.reactants.some((t) => t.formula === formula) ||
      r.equation.products.some((t) => t.formula === formula),
  );
}

/** Todas las formulas mencionadas por la base de reacciones. */
export function formulasInReactions(): Set<string> {
  const out = new Set<string>();
  for (const r of REACTIONS) {
    for (const t of r.equation.reactants) out.add(t.formula);
    for (const t of r.equation.products) out.add(t.formula);
  }
  return out;
}
