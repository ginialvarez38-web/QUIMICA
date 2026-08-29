/**
 * Tabla periodica — capa 2 (base de datos).
 *
 * PROCEDENCIA DE LOS DATOS
 *   Pesos atomicos ....... IUPAC Commission on Isotopic Abundances and Atomic
 *                          Weights, valores convencionales (2021). Para los
 *                          elementos sin isotopo estable se usa el numero
 *                          masico del isotopo mas estable conocido y se marca
 *                          con `massIsNominal: true`.
 *   Electronegatividad ... escala de Pauling. `null` donde no esta definida
 *                          (gases nobles ligeros, varios transuranidos).
 *   Radios covalentes .... Cordero et al., Dalton Trans., 2008, 2832-2838.
 *   Radios de vdW ........ Bondi (1964) y extensiones posteriores.
 *   Fusion / ebullicion .. CRC Handbook of Chemistry and Physics.
 *   Colores .............. paleta CPK/Jmol (pertenece al motor visual, pero se
 *                          almacena junto al elemento por comodidad).
 *
 * REGLA (§27, §32): donde no hay dato fiable se escribe `null`. El sistema
 * muestra "Datos no disponibles" — nunca rellena el hueco con una estimacion.
 */

import type { Element, ElementCategory, Block, Measured } from '../core/types.js';
import { measured, UNKNOWN } from '../core/types.js';

const CAT: Record<string, ElementCategory> = {
  am: 'alkali-metal',
  ae: 'alkaline-earth-metal',
  tm: 'transition-metal',
  ptm: 'post-transition-metal',
  ml: 'metalloid',
  nm: 'reactive-nonmetal',
  hal: 'halogen',
  ng: 'noble-gas',
  ln: 'lanthanide',
  an: 'actinide',
  unk: 'unknown',
};

/**
 * Fila base: [Z, simbolo, nombre_es, nombre_en, masa, nominal, categoria,
 *             grupo, periodo, bloque, electronegatividad, estados_oxidacion]
 */
type Row = [
  number, string, string, string, number, 0 | 1, string,
  number | null, number, Block, number | null, number[],
];

const ROWS: Row[] = [
  [1, 'H', 'Hidrogeno', 'Hydrogen', 1.008, 0, 'nm', 1, 1, 's', 2.2, [1, -1]],
  [2, 'He', 'Helio', 'Helium', 4.0026, 0, 'ng', 18, 1, 's', null, [0]],
  [3, 'Li', 'Litio', 'Lithium', 6.94, 0, 'am', 1, 2, 's', 0.98, [1]],
  [4, 'Be', 'Berilio', 'Beryllium', 9.0122, 0, 'ae', 2, 2, 's', 1.57, [2]],
  [5, 'B', 'Boro', 'Boron', 10.81, 0, 'ml', 13, 2, 'p', 2.04, [3]],
  [6, 'C', 'Carbono', 'Carbon', 12.011, 0, 'nm', 14, 2, 'p', 2.55, [4, 2, -4]],
  [7, 'N', 'Nitrogeno', 'Nitrogen', 14.007, 0, 'nm', 15, 2, 'p', 3.04, [-3, 5, 4, 3, 2, 1, -2, -1]],
  [8, 'O', 'Oxigeno', 'Oxygen', 15.999, 0, 'nm', 16, 2, 'p', 3.44, [-2, -1]],
  [9, 'F', 'Fluor', 'Fluorine', 18.998, 0, 'hal', 17, 2, 'p', 3.98, [-1]],
  [10, 'Ne', 'Neon', 'Neon', 20.18, 0, 'ng', 18, 2, 'p', null, [0]],
  [11, 'Na', 'Sodio', 'Sodium', 22.99, 0, 'am', 1, 3, 's', 0.93, [1]],
  [12, 'Mg', 'Magnesio', 'Magnesium', 24.305, 0, 'ae', 2, 3, 's', 1.31, [2]],
  [13, 'Al', 'Aluminio', 'Aluminium', 26.982, 0, 'ptm', 13, 3, 'p', 1.61, [3]],
  [14, 'Si', 'Silicio', 'Silicon', 28.085, 0, 'ml', 14, 3, 'p', 1.9, [4, -4]],
  [15, 'P', 'Fosforo', 'Phosphorus', 30.974, 0, 'nm', 15, 3, 'p', 2.19, [5, 3, -3]],
  [16, 'S', 'Azufre', 'Sulfur', 32.06, 0, 'nm', 16, 3, 'p', 2.58, [-2, 6, 4, 2]],
  [17, 'Cl', 'Cloro', 'Chlorine', 35.45, 0, 'hal', 17, 3, 'p', 3.16, [-1, 7, 5, 3, 1]],
  [18, 'Ar', 'Argon', 'Argon', 39.95, 0, 'ng', 18, 3, 'p', null, [0]],
  [19, 'K', 'Potasio', 'Potassium', 39.098, 0, 'am', 1, 4, 's', 0.82, [1]],
  [20, 'Ca', 'Calcio', 'Calcium', 40.078, 0, 'ae', 2, 4, 's', 1.0, [2]],
  [21, 'Sc', 'Escandio', 'Scandium', 44.956, 0, 'tm', 3, 4, 'd', 1.36, [3]],
  [22, 'Ti', 'Titanio', 'Titanium', 47.867, 0, 'tm', 4, 4, 'd', 1.54, [4, 3, 2]],
  [23, 'V', 'Vanadio', 'Vanadium', 50.942, 0, 'tm', 5, 4, 'd', 1.63, [5, 4, 3, 2]],
  [24, 'Cr', 'Cromo', 'Chromium', 51.996, 0, 'tm', 6, 4, 'd', 1.66, [3, 6, 2]],
  [25, 'Mn', 'Manganeso', 'Manganese', 54.938, 0, 'tm', 7, 4, 'd', 1.55, [2, 4, 7, 3, 6]],
  [26, 'Fe', 'Hierro', 'Iron', 55.845, 0, 'tm', 8, 4, 'd', 1.83, [3, 2]],
  [27, 'Co', 'Cobalto', 'Cobalt', 58.933, 0, 'tm', 9, 4, 'd', 1.88, [2, 3]],
  [28, 'Ni', 'Niquel', 'Nickel', 58.693, 0, 'tm', 10, 4, 'd', 1.91, [2, 3]],
  [29, 'Cu', 'Cobre', 'Copper', 63.546, 0, 'tm', 11, 4, 'd', 1.9, [2, 1]],
  [30, 'Zn', 'Zinc', 'Zinc', 65.38, 0, 'tm', 12, 4, 'd', 1.65, [2]],
  [31, 'Ga', 'Galio', 'Gallium', 69.723, 0, 'ptm', 13, 4, 'p', 1.81, [3]],
  [32, 'Ge', 'Germanio', 'Germanium', 72.63, 0, 'ml', 14, 4, 'p', 2.01, [4, 2]],
  [33, 'As', 'Arsenico', 'Arsenic', 74.922, 0, 'ml', 15, 4, 'p', 2.18, [3, 5, -3]],
  [34, 'Se', 'Selenio', 'Selenium', 78.971, 0, 'nm', 16, 4, 'p', 2.55, [-2, 4, 6]],
  [35, 'Br', 'Bromo', 'Bromine', 79.904, 0, 'hal', 17, 4, 'p', 2.96, [-1, 5, 3, 1]],
  [36, 'Kr', 'Kripton', 'Krypton', 83.798, 0, 'ng', 18, 4, 'p', 3.0, [0, 2]],
  [37, 'Rb', 'Rubidio', 'Rubidium', 85.468, 0, 'am', 1, 5, 's', 0.82, [1]],
  [38, 'Sr', 'Estroncio', 'Strontium', 87.62, 0, 'ae', 2, 5, 's', 0.95, [2]],
  [39, 'Y', 'Itrio', 'Yttrium', 88.906, 0, 'tm', 3, 5, 'd', 1.22, [3]],
  [40, 'Zr', 'Circonio', 'Zirconium', 91.224, 0, 'tm', 4, 5, 'd', 1.33, [4]],
  [41, 'Nb', 'Niobio', 'Niobium', 92.906, 0, 'tm', 5, 5, 'd', 1.6, [5, 3]],
  [42, 'Mo', 'Molibdeno', 'Molybdenum', 95.95, 0, 'tm', 6, 5, 'd', 2.16, [6, 4, 3]],
  [43, 'Tc', 'Tecnecio', 'Technetium', 97, 1, 'tm', 7, 5, 'd', 1.9, [7, 4]],
  [44, 'Ru', 'Rutenio', 'Ruthenium', 101.07, 0, 'tm', 8, 5, 'd', 2.2, [4, 3, 8]],
  [45, 'Rh', 'Rodio', 'Rhodium', 102.91, 0, 'tm', 9, 5, 'd', 2.28, [3]],
  [46, 'Pd', 'Paladio', 'Palladium', 106.42, 0, 'tm', 10, 5, 'd', 2.2, [2, 4]],
  [47, 'Ag', 'Plata', 'Silver', 107.87, 0, 'tm', 11, 5, 'd', 1.93, [1]],
  [48, 'Cd', 'Cadmio', 'Cadmium', 112.41, 0, 'tm', 12, 5, 'd', 1.69, [2]],
  [49, 'In', 'Indio', 'Indium', 114.82, 0, 'ptm', 13, 5, 'p', 1.78, [3]],
  [50, 'Sn', 'Estano', 'Tin', 118.71, 0, 'ptm', 14, 5, 'p', 1.96, [4, 2]],
  [51, 'Sb', 'Antimonio', 'Antimony', 121.76, 0, 'ml', 15, 5, 'p', 2.05, [3, 5, -3]],
  [52, 'Te', 'Teluro', 'Tellurium', 127.6, 0, 'ml', 16, 5, 'p', 2.1, [-2, 4, 6]],
  [53, 'I', 'Yodo', 'Iodine', 126.9, 0, 'hal', 17, 5, 'p', 2.66, [-1, 5, 7, 1]],
  [54, 'Xe', 'Xenon', 'Xenon', 131.29, 0, 'ng', 18, 5, 'p', 2.6, [0, 2, 4, 6]],
  [55, 'Cs', 'Cesio', 'Caesium', 132.91, 0, 'am', 1, 6, 's', 0.79, [1]],
  [56, 'Ba', 'Bario', 'Barium', 137.33, 0, 'ae', 2, 6, 's', 0.89, [2]],
  [57, 'La', 'Lantano', 'Lanthanum', 138.91, 0, 'ln', null, 6, 'd', 1.1, [3]],
  [58, 'Ce', 'Cerio', 'Cerium', 140.12, 0, 'ln', null, 6, 'f', 1.12, [3, 4]],
  [59, 'Pr', 'Praseodimio', 'Praseodymium', 140.91, 0, 'ln', null, 6, 'f', 1.13, [3]],
  [60, 'Nd', 'Neodimio', 'Neodymium', 144.24, 0, 'ln', null, 6, 'f', 1.14, [3]],
  [61, 'Pm', 'Prometio', 'Promethium', 145, 1, 'ln', null, 6, 'f', null, [3]],
  [62, 'Sm', 'Samario', 'Samarium', 150.36, 0, 'ln', null, 6, 'f', 1.17, [3, 2]],
  [63, 'Eu', 'Europio', 'Europium', 151.96, 0, 'ln', null, 6, 'f', null, [3, 2]],
  [64, 'Gd', 'Gadolinio', 'Gadolinium', 157.25, 0, 'ln', null, 6, 'f', 1.2, [3]],
  [65, 'Tb', 'Terbio', 'Terbium', 158.93, 0, 'ln', null, 6, 'f', null, [3]],
  [66, 'Dy', 'Disprosio', 'Dysprosium', 162.5, 0, 'ln', null, 6, 'f', 1.22, [3]],
  [67, 'Ho', 'Holmio', 'Holmium', 164.93, 0, 'ln', null, 6, 'f', 1.23, [3]],
  [68, 'Er', 'Erbio', 'Erbium', 167.26, 0, 'ln', null, 6, 'f', 1.24, [3]],
  [69, 'Tm', 'Tulio', 'Thulium', 168.93, 0, 'ln', null, 6, 'f', 1.25, [3]],
  [70, 'Yb', 'Iterbio', 'Ytterbium', 173.05, 0, 'ln', null, 6, 'f', null, [3, 2]],
  [71, 'Lu', 'Lutecio', 'Lutetium', 174.97, 0, 'ln', null, 6, 'd', 1.27, [3]],
  [72, 'Hf', 'Hafnio', 'Hafnium', 178.49, 0, 'tm', 4, 6, 'd', 1.3, [4]],
  [73, 'Ta', 'Tantalo', 'Tantalum', 180.95, 0, 'tm', 5, 6, 'd', 1.5, [5]],
  [74, 'W', 'Wolframio', 'Tungsten', 183.84, 0, 'tm', 6, 6, 'd', 2.36, [6, 4]],
  [75, 'Re', 'Renio', 'Rhenium', 186.21, 0, 'tm', 7, 6, 'd', 1.9, [7, 4]],
  [76, 'Os', 'Osmio', 'Osmium', 190.23, 0, 'tm', 8, 6, 'd', 2.2, [4, 8]],
  [77, 'Ir', 'Iridio', 'Iridium', 192.22, 0, 'tm', 9, 6, 'd', 2.2, [4, 3]],
  [78, 'Pt', 'Platino', 'Platinum', 195.08, 0, 'tm', 10, 6, 'd', 2.28, [4, 2]],
  [79, 'Au', 'Oro', 'Gold', 196.97, 0, 'tm', 11, 6, 'd', 2.54, [3, 1]],
  [80, 'Hg', 'Mercurio', 'Mercury', 200.59, 0, 'tm', 12, 6, 'd', 2.0, [2, 1]],
  [81, 'Tl', 'Talio', 'Thallium', 204.38, 0, 'ptm', 13, 6, 'p', 1.62, [1, 3]],
  [82, 'Pb', 'Plomo', 'Lead', 207.2, 0, 'ptm', 14, 6, 'p', 2.33, [2, 4]],
  [83, 'Bi', 'Bismuto', 'Bismuth', 208.98, 0, 'ptm', 15, 6, 'p', 2.02, [3, 5]],
  [84, 'Po', 'Polonio', 'Polonium', 209, 1, 'ml', 16, 6, 'p', 2.0, [4, 2]],
  [85, 'At', 'Astato', 'Astatine', 210, 1, 'hal', 17, 6, 'p', 2.2, [-1, 1]],
  [86, 'Rn', 'Radon', 'Radon', 222, 1, 'ng', 18, 6, 'p', null, [0, 2]],
  [87, 'Fr', 'Francio', 'Francium', 223, 1, 'am', 1, 7, 's', 0.7, [1]],
  [88, 'Ra', 'Radio', 'Radium', 226, 1, 'ae', 2, 7, 's', 0.9, [2]],
  [89, 'Ac', 'Actinio', 'Actinium', 227, 1, 'an', null, 7, 'd', 1.1, [3]],
  [90, 'Th', 'Torio', 'Thorium', 232.04, 0, 'an', null, 7, 'f', 1.3, [4]],
  [91, 'Pa', 'Protactinio', 'Protactinium', 231.04, 0, 'an', null, 7, 'f', 1.5, [5, 4]],
  [92, 'U', 'Uranio', 'Uranium', 238.03, 0, 'an', null, 7, 'f', 1.38, [6, 4, 3]],
  [93, 'Np', 'Neptunio', 'Neptunium', 237, 1, 'an', null, 7, 'f', 1.36, [5, 4]],
  [94, 'Pu', 'Plutonio', 'Plutonium', 244, 1, 'an', null, 7, 'f', 1.28, [4, 6, 3]],
  [95, 'Am', 'Americio', 'Americium', 243, 1, 'an', null, 7, 'f', 1.3, [3]],
  [96, 'Cm', 'Curio', 'Curium', 247, 1, 'an', null, 7, 'f', 1.3, [3]],
  [97, 'Bk', 'Berkelio', 'Berkelium', 247, 1, 'an', null, 7, 'f', 1.3, [3]],
  [98, 'Cf', 'Californio', 'Californium', 251, 1, 'an', null, 7, 'f', 1.3, [3]],
  [99, 'Es', 'Einstenio', 'Einsteinium', 252, 1, 'an', null, 7, 'f', 1.3, [3]],
  [100, 'Fm', 'Fermio', 'Fermium', 257, 1, 'an', null, 7, 'f', 1.3, [3]],
  [101, 'Md', 'Mendelevio', 'Mendelevium', 258, 1, 'an', null, 7, 'f', 1.3, [3]],
  [102, 'No', 'Nobelio', 'Nobelium', 259, 1, 'an', null, 7, 'f', 1.3, [2, 3]],
  [103, 'Lr', 'Lawrencio', 'Lawrencium', 266, 1, 'an', null, 7, 'd', null, [3]],
  [104, 'Rf', 'Rutherfordio', 'Rutherfordium', 267, 1, 'tm', 4, 7, 'd', null, [4]],
  [105, 'Db', 'Dubnio', 'Dubnium', 268, 1, 'tm', 5, 7, 'd', null, [5]],
  [106, 'Sg', 'Seaborgio', 'Seaborgium', 269, 1, 'tm', 6, 7, 'd', null, [6]],
  [107, 'Bh', 'Bohrio', 'Bohrium', 270, 1, 'tm', 7, 7, 'd', null, [7]],
  [108, 'Hs', 'Hasio', 'Hassium', 269, 1, 'tm', 8, 7, 'd', null, [8]],
  [109, 'Mt', 'Meitnerio', 'Meitnerium', 278, 1, 'unk', 9, 7, 'd', null, []],
  [110, 'Ds', 'Darmstatio', 'Darmstadtium', 281, 1, 'unk', 10, 7, 'd', null, []],
  [111, 'Rg', 'Roentgenio', 'Roentgenium', 282, 1, 'unk', 11, 7, 'd', null, []],
  [112, 'Cn', 'Copernicio', 'Copernicium', 285, 1, 'unk', 12, 7, 'd', null, [2]],
  [113, 'Nh', 'Nihonio', 'Nihonium', 286, 1, 'unk', 13, 7, 'p', null, []],
  [114, 'Fl', 'Flerovio', 'Flerovium', 289, 1, 'unk', 14, 7, 'p', null, []],
  [115, 'Mc', 'Moscovio', 'Moscovium', 290, 1, 'unk', 15, 7, 'p', null, []],
  [116, 'Lv', 'Livermorio', 'Livermorium', 293, 1, 'unk', 16, 7, 'p', null, []],
  [117, 'Ts', 'Teneso', 'Tennessine', 294, 1, 'unk', 17, 7, 'p', null, []],
  [118, 'Og', 'Oganeson', 'Oganesson', 294, 1, 'unk', 18, 7, 'p', null, []],
];

/**
 * Propiedades fisicas, solo donde hay valor fiable.
 * [Z, fusion_K, ebullicion_K, densidad, unidad_densidad, r_covalente_pm, r_vdw_pm]
 * `null` = no disponible.
 */
type PhysRow = [number, number | null, number | null, number | null, 'g/cm3' | 'g/L', number | null, number | null];

const PHYS: PhysRow[] = [
  [1, 13.99, 20.271, 0.08988, 'g/L', 31, 120],
  [2, null, 4.222, 0.1786, 'g/L', 28, 140],
  [3, 453.65, 1603, 0.534, 'g/cm3', 128, 182],
  [4, 1560, 2742, 1.85, 'g/cm3', 96, 153],
  [5, 2349, 4200, 2.34, 'g/cm3', 84, 192],
  [6, null, null, 2.267, 'g/cm3', 76, 170],
  [7, 63.15, 77.355, 1.2506, 'g/L', 71, 155],
  [8, 54.36, 90.188, 1.429, 'g/L', 66, 152],
  [9, 53.48, 85.03, 1.696, 'g/L', 57, 147],
  [10, 24.56, 27.104, 0.9002, 'g/L', 58, 154],
  [11, 370.944, 1156.09, 0.968, 'g/cm3', 166, 227],
  [12, 923, 1363, 1.738, 'g/cm3', 141, 173],
  [13, 933.47, 2743, 2.7, 'g/cm3', 121, 184],
  [14, 1687, 3538, 2.3296, 'g/cm3', 111, 210],
  [15, 317.3, 553.7, 1.823, 'g/cm3', 107, 180],
  [16, 388.36, 717.8, 2.07, 'g/cm3', 105, 180],
  [17, 171.6, 239.11, 3.2, 'g/L', 102, 175],
  [18, 83.81, 87.302, 1.784, 'g/L', 106, 188],
  [19, 336.7, 1032, 0.862, 'g/cm3', 203, 275],
  [20, 1115, 1757, 1.55, 'g/cm3', 176, 231],
  [21, 1814, 3109, 2.985, 'g/cm3', 170, null],
  [22, 1941, 3560, 4.506, 'g/cm3', 160, null],
  [23, 2183, 3680, 6.11, 'g/cm3', 153, null],
  [24, 2180, 2944, 7.15, 'g/cm3', 139, null],
  [25, 1519, 2334, 7.21, 'g/cm3', 139, null],
  [26, 1811, 3134, 7.874, 'g/cm3', 132, null],
  [27, 1768, 3200, 8.9, 'g/cm3', 126, null],
  [28, 1728, 3003, 8.908, 'g/cm3', 124, 163],
  [29, 1357.77, 2835, 8.96, 'g/cm3', 132, 140],
  [30, 692.68, 1180, 7.14, 'g/cm3', 122, 139],
  [31, 302.9146, 2673, 5.91, 'g/cm3', 122, 187],
  [32, 1211.4, 3106, 5.323, 'g/cm3', 120, 211],
  [33, null, 887, 5.727, 'g/cm3', 119, 185],
  [34, 494, 958, 4.81, 'g/cm3', 120, 190],
  [35, 265.8, 332.0, 3.1028, 'g/cm3', 120, 185],
  [36, 115.78, 119.93, 3.749, 'g/L', 116, 202],
  [37, 312.45, 961, 1.532, 'g/cm3', 220, 303],
  [38, 1050, 1650, 2.64, 'g/cm3', 195, 249],
  [39, 1799, 3203, 4.472, 'g/cm3', 190, null],
  [40, 2128, 4650, 6.52, 'g/cm3', 175, null],
  [41, 2750, 5017, 8.57, 'g/cm3', 164, null],
  [42, 2896, 4912, 10.28, 'g/cm3', 154, null],
  [43, 2430, 4538, 11.0, 'g/cm3', 147, null],
  [44, 2607, 4423, 12.45, 'g/cm3', 146, null],
  [45, 2237, 3968, 12.41, 'g/cm3', 142, null],
  [46, 1828.05, 3236, 12.023, 'g/cm3', 139, 163],
  [47, 1234.93, 2435, 10.49, 'g/cm3', 145, 172],
  [48, 594.22, 1040, 8.65, 'g/cm3', 144, 158],
  [49, 429.7485, 2345, 7.31, 'g/cm3', 142, 193],
  [50, 505.08, 2875, 7.265, 'g/cm3', 139, 217],
  [51, 903.78, 1908, 6.697, 'g/cm3', 139, 206],
  [52, 722.66, 1261, 6.24, 'g/cm3', 138, 206],
  [53, 386.85, 457.4, 4.933, 'g/cm3', 139, 198],
  [54, 161.4, 165.051, 5.894, 'g/L', 140, 216],
  [55, 301.7, 944, 1.93, 'g/cm3', 244, 343],
  [56, 1000, 2118, 3.51, 'g/cm3', 215, 268],
  [57, 1193, 3737, 6.162, 'g/cm3', 207, null],
  [58, 1068, 3716, 6.77, 'g/cm3', 204, null],
  [59, 1208, 3403, 6.77, 'g/cm3', 203, null],
  [60, 1297, 3347, 7.01, 'g/cm3', 201, null],
  [62, 1345, 2173, 7.52, 'g/cm3', 198, null],
  [63, 1099, 1802, 5.264, 'g/cm3', 198, null],
  [64, 1585, 3273, 7.9, 'g/cm3', 196, null],
  [65, 1629, 3396, 8.23, 'g/cm3', 194, null],
  [66, 1680, 2840, 8.54, 'g/cm3', 192, null],
  [67, 1734, 2873, 8.79, 'g/cm3', 192, null],
  [68, 1802, 3141, 9.066, 'g/cm3', 189, null],
  [69, 1818, 2223, 9.32, 'g/cm3', 190, null],
  [70, 1097, 1469, 6.9, 'g/cm3', 187, null],
  [71, 1925, 3675, 9.841, 'g/cm3', 187, null],
  [72, 2506, 4876, 13.31, 'g/cm3', 175, null],
  [73, 3290, 5731, 16.69, 'g/cm3', 170, null],
  [74, 3695, 6203, 19.25, 'g/cm3', 162, null],
  [75, 3459, 5903, 21.02, 'g/cm3', 151, null],
  [76, 3306, 5285, 22.59, 'g/cm3', 144, null],
  [77, 2719, 4403, 22.56, 'g/cm3', 141, null],
  [78, 2041.4, 4098, 21.45, 'g/cm3', 136, 175],
  [79, 1337.33, 3243, 19.3, 'g/cm3', 136, 166],
  [80, 234.321, 629.88, 13.534, 'g/cm3', 132, 155],
  [81, 577, 1746, 11.85, 'g/cm3', 145, 196],
  [82, 600.61, 2022, 11.34, 'g/cm3', 146, 202],
  [83, 544.7, 1837, 9.78, 'g/cm3', 148, 207],
  [84, 527, 1235, 9.196, 'g/cm3', 140, 197],
  [86, 202, 211.5, 9.73, 'g/L', 150, 220],
  [88, 973, 2010, 5.5, 'g/cm3', 221, null],
  [90, 2115, 5061, 11.7, 'g/cm3', 206, null],
  [92, 1405.3, 4404, 19.1, 'g/cm3', 196, 186],
];

/** Paleta CPK/Jmol. Los elementos no listados usan el color por defecto. */
const COLORS: Record<string, string> = {
  H: '#FFFFFF', He: '#D9FFFF', Li: '#CC80FF', Be: '#C2FF00', B: '#FFB5B5',
  C: '#909090', N: '#3050F8', O: '#FF0D0D', F: '#90E050', Ne: '#B3E3F5',
  Na: '#AB5CF2', Mg: '#8AFF00', Al: '#BFA6A6', Si: '#F0C8A0', P: '#FF8000',
  S: '#FFFF30', Cl: '#1FF01F', Ar: '#80D1E3', K: '#8F40D4', Ca: '#3DFF00',
  Sc: '#E6E6E6', Ti: '#BFC2C7', V: '#A6A6AB', Cr: '#8A99C7', Mn: '#9C7AC7',
  Fe: '#E06633', Co: '#F090A0', Ni: '#50D050', Cu: '#C88033', Zn: '#7D80B0',
  Ga: '#C28F8F', Ge: '#668F8F', As: '#BD80E3', Se: '#FFA100', Br: '#A62929',
  Kr: '#5CB8D1', Rb: '#702EB0', Sr: '#00FF00', Y: '#94FFFF', Zr: '#94E0E0',
  Nb: '#73C2C9', Mo: '#54B5B5', Tc: '#3B9E9E', Ru: '#248F8F', Rh: '#0A7D8C',
  Pd: '#006985', Ag: '#C0C0C0', Cd: '#FFD98F', In: '#A67573', Sn: '#668080',
  Sb: '#9E63B5', Te: '#D47A00', I: '#940094', Xe: '#429EB0', Cs: '#57178F',
  Ba: '#00C900', La: '#70D4FF', Ce: '#FFFFC7', Pt: '#D0D0E0', Au: '#FFD123',
  Hg: '#B8B8D0', Tl: '#A6544D', Pb: '#575961', Bi: '#9E4FB5', Po: '#AB5C00',
  At: '#754F45', Rn: '#428296', Fr: '#420066', Ra: '#007D00', Ac: '#70ABFA',
  Th: '#00BAFF', Pa: '#00A1FF', U: '#008FFF',
};
const DEFAULT_COLOR = '#B0B7C3';

// ---------------------------------------------------------------------------
// Configuracion electronica
// ---------------------------------------------------------------------------

/** Orden de llenado de Madelung (regla n+l, y a igualdad, menor n). */
const AUFBAU: [number, Block, number][] = [
  [1, 's', 2], [2, 's', 2], [2, 'p', 6], [3, 's', 2], [3, 'p', 6], [4, 's', 2],
  [3, 'd', 10], [4, 'p', 6], [5, 's', 2], [4, 'd', 10], [5, 'p', 6], [6, 's', 2],
  [4, 'f', 14], [5, 'd', 10], [6, 'p', 6], [7, 's', 2], [5, 'f', 14], [6, 'd', 10],
  [7, 'p', 6],
];

const NOBLE_CORES: [number, string][] = [
  [86, '[Rn]'], [54, '[Xe]'], [36, '[Kr]'], [18, '[Ar]'], [10, '[Ne]'], [2, '[He]'],
];

/**
 * Configuraciones anomalas verificadas experimentalmente. La regla de Madelung
 * predice p. ej. Cr = [Ar] 3d4 4s2, pero la configuracion real es
 * [Ar] 3d5 4s1 (subcapa d semillena). No se puede derivar de la regla, asi
 * que se declara explicitamente en vez de mostrar un dato incorrecto.
 */
const ANOMALOUS: Record<number, string> = {
  24: '[Ar] 3d5 4s1',
  29: '[Ar] 3d10 4s1',
  41: '[Kr] 4d4 5s1',
  42: '[Kr] 4d5 5s1',
  44: '[Kr] 4d7 5s1',
  45: '[Kr] 4d8 5s1',
  46: '[Kr] 4d10',
  47: '[Kr] 4d10 5s1',
  57: '[Xe] 5d1 6s2',
  58: '[Xe] 4f1 5d1 6s2',
  64: '[Xe] 4f7 5d1 6s2',
  78: '[Xe] 4f14 5d9 6s1',
  79: '[Xe] 4f14 5d10 6s1',
  89: '[Rn] 6d1 7s2',
  90: '[Rn] 6d2 7s2',
  91: '[Rn] 5f2 6d1 7s2',
  92: '[Rn] 5f3 6d1 7s2',
  93: '[Rn] 5f4 6d1 7s2',
  96: '[Rn] 5f7 6d1 7s2',
  103: '[Rn] 5f14 7s2 7p1',
};

function buildConfiguration(Z: number): string {
  const known = ANOMALOUS[Z];
  if (known) return known;

  const shells: { n: number; block: Block; count: number }[] = [];
  let remaining = Z;
  for (const [n, block, capacity] of AUFBAU) {
    if (remaining <= 0) break;
    const count = Math.min(remaining, capacity);
    shells.push({ n, block, count });
    remaining -= count;
  }

  // Abrevia con el gas noble anterior.
  let core = '';
  let coreZ = 0;
  for (const [nobleZ, label] of NOBLE_CORES) {
    if (Z > nobleZ) {
      core = label;
      coreZ = nobleZ;
      break;
    }
  }

  let consumed = 0;
  const parts: string[] = [];
  for (const sh of shells) {
    consumed += sh.count;
    if (consumed <= coreZ) continue;
    parts.push(`${sh.n}${sh.block}${sh.count}`);
  }

  // Se muestran en orden de numero cuantico principal, que es como se escribe.
  parts.sort((a, b) => {
    const na = Number.parseInt(a[0]!, 10);
    const nb = Number.parseInt(b[0]!, 10);
    if (na !== nb) return na - nb;
    return 'spdf'.indexOf(a[1]!) - 'spdf'.indexOf(b[1]!);
  });

  return core ? `${core} ${parts.join(' ')}` : parts.join(' ');
}

/**
 * Electrones de valencia utilizables para estructuras de Lewis.
 * Para el grupo principal es directo. Para los metales de transicion se
 * cuentan los electrones s + d mas externos, que es la convencion usada en
 * quimica de coordinacion.
 */
function valenceElectronsFor(group: number | null, block: Block, Z: number): number {
  if (block === 'f') return 3; // convencion practica para lantanidos/actinidos
  if (group === null) return 3;
  if (group === 18 && Z === 2) return 2; // He
  if (group <= 2) return group;
  if (group >= 13) return group - 10;
  return group; // 3..12: electrones s+d
}

// ---------------------------------------------------------------------------
// Construccion de la tabla
// ---------------------------------------------------------------------------

const PHYS_BY_Z = new Map<number, PhysRow>(PHYS.map((r) => [r[0], r]));

const CRC: { source: string } = { source: 'CRC Handbook of Chemistry and Physics' };
const CORDERO: { source: string } = { source: 'Cordero et al., Dalton Trans. 2008, 2832' };
const BONDI: { source: string } = { source: 'Bondi, J. Phys. Chem. 1964, 68, 441 (y extensiones)' };

function buildElement(row: Row): Element {
  const [Z, symbol, name, nameEn, atomicMass, nominal, cat, group, period, block, en, ox] = row;
  const p = PHYS_BY_Z.get(Z);

  const meltingPoint: Measured<'K'> = p && p[1] !== null ? measured(p[1], 'K', CRC) : UNKNOWN('K');
  const boilingPoint: Measured<'K'> = p && p[2] !== null ? measured(p[2], 'K', CRC) : UNKNOWN('K');
  const density: Measured<'g/cm3' | 'g/L'> =
    p && p[3] !== null ? measured(p[3], p[4], CRC) : UNKNOWN('g/cm3');
  const covalentRadius: Measured<'pm'> =
    p && p[5] !== null ? measured(p[5], 'pm', CORDERO) : UNKNOWN('pm');
  const vanDerWaalsRadius: Measured<'pm'> =
    p && p[6] !== null ? measured(p[6], 'pm', BONDI) : UNKNOWN('pm');

  return {
    Z,
    symbol,
    name,
    nameEn,
    atomicMass,
    massIsNominal: nominal === 1,
    category: CAT[cat] ?? 'unknown',
    group,
    period,
    block,
    electronegativity: en,
    valenceElectrons: valenceElectronsFor(group, block, Z),
    oxidationStates: ox,
    electronConfiguration: buildConfiguration(Z),
    cpkColor: COLORS[symbol] ?? DEFAULT_COLOR,
    physical: { meltingPoint, boilingPoint, density, covalentRadius, vanDerWaalsRadius },
  };
}

export const ELEMENTS: readonly Element[] = ROWS.map(buildElement);

const BY_SYMBOL = new Map<string, Element>(ELEMENTS.map((e) => [e.symbol, e]));
const BY_Z = new Map<number, Element>(ELEMENTS.map((e) => [e.Z, e]));
const BY_NAME = new Map<string, Element>();
for (const e of ELEMENTS) {
  BY_NAME.set(normalizeName(e.name), e);
  BY_NAME.set(normalizeName(e.nameEn), e);
}

/** Quita acentos y pasa a minusculas, para que "Fluor" encuentre "Flúor". */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Busqueda por simbolo. SENSIBLE A MAYUSCULAS: "Co" != "CO". */
export function getElement(symbol: string): Element | undefined {
  return BY_SYMBOL.get(symbol);
}

export function getElementByZ(Z: number): Element | undefined {
  return BY_Z.get(Z);
}

/** Busqueda tolerante por nombre en espanol o ingles. */
export function getElementByName(name: string): Element | undefined {
  return BY_NAME.get(normalizeName(name));
}

/**
 * Resuelve una entrada del usuario a un elemento, aceptando simbolo con
 * cualquier capitalizacion o nombre. Devuelve todos los candidatos porque
 * "co" es legitimamente ambiguo entre Co (cobalto) y CO (monoxido) — el
 * desambiguador vive en la capa de busqueda de la biblioteca.
 */
export function resolveElement(input: string): Element[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const exact = BY_SYMBOL.get(trimmed);
  if (exact) return [exact];

  const byName = getElementByName(trimmed);
  if (byName) return [byName];

  const lower = trimmed.toLowerCase();
  return ELEMENTS.filter((e) => e.symbol.toLowerCase() === lower);
}

export const ELEMENT_COUNT = ELEMENTS.length;
