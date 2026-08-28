/**
 * The periodic table — all 118 elements.
 *
 * One authoritative record per element (§2, §76): the periodic table view, the
 * formula parser, the molecular builder, the mass-spectrometry engine and every
 * stoichiometric calculation in CHEMIA read from this table. Nothing duplicates
 * an atomic mass.
 *
 * Sources: IUPAC 2021 standard atomic weights (abridged to the conventional
 * value for elements with an interval); CRC Handbook 102nd ed. for physical
 * properties; Pauling electronegativities; NIST for first ionisation energies.
 * Values are given in the units named on each field; `null` means the property
 * is not defined or not reliably known (mostly the superheavy elements), and
 * the interface never invents a number to fill a column.
 */

export type ElementCategory =
  | 'alcalino'
  | 'alcalinoterreo'
  | 'transicion'
  | 'postransicion'
  | 'metaloide'
  | 'nometal'
  | 'halogeno'
  | 'noble'
  | 'lantanido'
  | 'actinido'
  | 'desconocido';

export type Block = 's' | 'p' | 'd' | 'f';
export type StandardState = 'solido' | 'liquido' | 'gas' | 'desconocido';

export interface Element {
  Z: number;
  symbol: string;
  name: string;
  /** Standard atomic weight, g·mol⁻¹. For unstable elements: mass number of the most stable isotope. */
  mass: number;
  /** True when `mass` is the mass number of the longest-lived isotope, not a standard atomic weight. */
  massIsNominal: boolean;
  group: number | null;
  period: number;
  block: Block;
  category: ElementCategory;
  /** Noble-gas shorthand electron configuration. */
  config: string;
  /** Full configuration, expanded from `config`. */
  configFull: string;
  /** Electrons per shell, K L M N… */
  shells: number[];
  /** Pauling electronegativity. */
  electronegativity: number | null;
  /** First ionisation energy, kJ·mol⁻¹. */
  ionisation1: number | null;
  /** Electron affinity, kJ·mol⁻¹ (positive = energy released). */
  electronAffinity: number | null;
  /** Covalent radius, pm. */
  radiusCovalent: number | null;
  /** Van der Waals radius, pm. */
  radiusVdW: number | null;
  /** Density at 298 K, g·cm⁻³ (gases: g·L⁻¹ at STP, stored as g·cm⁻³). */
  density: number | null;
  /** Melting point, K. */
  meltingPoint: number | null;
  /** Boiling point, K. */
  boilingPoint: number | null;
  /** Common oxidation states; the most stable ones are marked in `mainOxidation`. */
  oxidationStates: number[];
  mainOxidation: number[];
  /** Crustal abundance, mg·kg⁻¹ (ppm). */
  abundanceCrust: number | null;
  /** Year of discovery/isolation; null for the elements known since antiquity. */
  discovered: number | null;
  standardState: StandardState;
  /** Number of valence electrons available for bonding (used by the builder). */
  valenceElectrons: number;
}

/*
 * Compact source table. Columns, pipe-separated:
 *  Z | sym | name | mass | nominal? | group | period | block | category |
 *  config | EN | IE1 | EA | rCov | rVdW | density | mp | bp | oxStates |
 *  mainOx | abundance | discovered | state
 * "-" marks an unknown/undefined value.
 */
const TABLE = `
1|H|Hidrógeno|1.008|0|1|1|s|nometal|1s1|2.20|1312.0|72.8|31|120|0.00008988|13.99|20.271|-1,1|1|1400|1766|gas
2|He|Helio|4.0026|0|18|1|s|noble|1s2|-|2372.3|-50|28|140|0.0001785|0.95|4.222|0|0|0.008|1868|gas
3|Li|Litio|6.94|0|1|2|s|alcalino|[He] 2s1|0.98|520.2|59.6|128|182|0.534|453.65|1603|1|1|20|1817|solido
4|Be|Berilio|9.0122|0|2|2|s|alcalinoterreo|[He] 2s2|1.57|899.5|-48|96|153|1.85|1560|2742|2|2|2.8|1798|solido
5|B|Boro|10.81|0|13|2|p|metaloide|[He] 2s2 2p1|2.04|800.6|26.7|84|192|2.34|2349|4200|3|3|10|1808|solido
6|C|Carbono|12.011|0|14|2|p|nometal|[He] 2s2 2p2|2.55|1086.5|121.8|76|170|2.267|3823|4300|-4,-3,-2,-1,0,1,2,3,4|4,-4|200|-|solido
7|N|Nitrógeno|14.007|0|15|2|p|nometal|[He] 2s2 2p3|3.04|1402.3|-6.8|71|155|0.0012506|63.15|77.355|-3,-2,-1,1,2,3,4,5|-3,5|19|1772|gas
8|O|Oxígeno|15.999|0|16|2|p|nometal|[He] 2s2 2p4|3.44|1313.9|141.0|66|152|0.001429|54.36|90.188|-2,-1,1,2|-2|461000|1771|gas
9|F|Flúor|18.998|0|17|2|p|halogeno|[He] 2s2 2p5|3.98|1681.0|328.0|57|147|0.001696|53.48|85.03|-1|-1|585|1886|gas
10|Ne|Neón|20.180|0|18|2|p|noble|[He] 2s2 2p6|-|2080.7|-120|58|154|0.0008999|24.56|27.104|0|0|0.005|1898|gas
11|Na|Sodio|22.990|0|1|3|s|alcalino|[Ne] 3s1|0.93|495.8|52.8|166|227|0.971|370.94|1156|1|1|23600|1807|solido
12|Mg|Magnesio|24.305|0|2|3|s|alcalinoterreo|[Ne] 3s2|1.31|737.7|-40|141|173|1.738|923|1363|2|2|23300|1755|solido
13|Al|Aluminio|26.982|0|13|3|p|postransicion|[Ne] 3s2 3p1|1.61|577.5|41.8|121|184|2.698|933.47|2743|3|3|82300|1825|solido
14|Si|Silicio|28.085|0|14|3|p|metaloide|[Ne] 3s2 3p2|1.90|786.5|134.1|111|210|2.3296|1687|3538|-4,2,4|4|282000|1824|solido
15|P|Fósforo|30.974|0|15|3|p|nometal|[Ne] 3s2 3p3|2.19|1011.8|72.0|107|180|1.823|317.3|553.7|-3,3,5|5,-3|1050|1669|solido
16|S|Azufre|32.06|0|16|3|p|nometal|[Ne] 3s2 3p4|2.58|999.6|200.4|105|180|2.067|388.36|717.8|-2,2,4,6|-2,6|350|-|solido
17|Cl|Cloro|35.45|0|17|3|p|halogeno|[Ne] 3s2 3p5|3.16|1251.2|349.0|102|175|0.003214|171.6|239.11|-1,1,3,5,7|-1|145|1774|gas
18|Ar|Argón|39.95|0|18|3|p|noble|[Ne] 3s2 3p6|-|1520.6|-96|106|188|0.0017837|83.81|87.302|0|0|3.5|1894|gas
19|K|Potasio|39.098|0|1|4|s|alcalino|[Ar] 4s1|0.82|418.8|48.4|203|275|0.862|336.7|1032|1|1|20900|1807|solido
20|Ca|Calcio|40.078|0|2|4|s|alcalinoterreo|[Ar] 4s2|1.00|589.8|2.37|176|231|1.55|1115|1757|2|2|41500|1808|solido
21|Sc|Escandio|44.956|0|3|4|d|transicion|[Ar] 3d1 4s2|1.36|633.1|18.1|170|211|2.985|1814|3109|3|3|22|1879|solido
22|Ti|Titanio|47.867|0|4|4|d|transicion|[Ar] 3d2 4s2|1.54|658.8|7.6|160|187|4.506|1941|3560|2,3,4|4|5650|1791|solido
23|V|Vanadio|50.942|0|5|4|d|transicion|[Ar] 3d3 4s2|1.63|650.9|50.6|153|179|6.11|2183|3680|2,3,4,5|5|120|1801|solido
24|Cr|Cromo|51.996|0|6|4|d|transicion|[Ar] 3d5 4s1|1.66|652.9|64.3|139|189|7.15|2180|2944|2,3,6|3,6|102|1797|solido
25|Mn|Manganeso|54.938|0|7|4|d|transicion|[Ar] 3d5 4s2|1.55|717.3|-50|139|197|7.21|1519|2334|2,3,4,6,7|2,7|950|1774|solido
26|Fe|Hierro|55.845|0|8|4|d|transicion|[Ar] 3d6 4s2|1.83|762.5|15.7|132|194|7.874|1811|3134|2,3,6|2,3|56300|-|solido
27|Co|Cobalto|58.933|0|9|4|d|transicion|[Ar] 3d7 4s2|1.88|760.4|63.7|126|192|8.90|1768|3200|2,3|2,3|25|1735|solido
28|Ni|Níquel|58.693|0|10|4|d|transicion|[Ar] 3d8 4s2|1.91|737.1|112.0|124|163|8.908|1728|3186|2,3|2|84|1751|solido
29|Cu|Cobre|63.546|0|11|4|d|transicion|[Ar] 3d10 4s1|1.90|745.5|118.4|132|140|8.96|1357.77|2835|1,2|2|60|-|solido
30|Zn|Zinc|65.38|0|12|4|d|transicion|[Ar] 3d10 4s2|1.65|906.4|-58|122|139|7.14|692.68|1180|2|2|70|1746|solido
31|Ga|Galio|69.723|0|13|4|p|postransicion|[Ar] 3d10 4s2 4p1|1.81|578.8|28.9|122|187|5.91|302.9146|2673|1,3|3|19|1875|solido
32|Ge|Germanio|72.630|0|14|4|p|metaloide|[Ar] 3d10 4s2 4p2|2.01|762.0|119.0|120|211|5.323|1211.4|3106|-4,2,4|4|1.5|1886|solido
33|As|Arsénico|74.922|0|15|4|p|metaloide|[Ar] 3d10 4s2 4p3|2.18|947.0|78.0|119|185|5.727|1090|887|-3,3,5|3,5|1.8|-|solido
34|Se|Selenio|78.971|0|16|4|p|nometal|[Ar] 3d10 4s2 4p4|2.55|941.0|195.0|120|190|4.81|494|958|-2,2,4,6|-2,4|0.05|1817|solido
35|Br|Bromo|79.904|0|17|4|p|halogeno|[Ar] 3d10 4s2 4p5|2.96|1139.9|324.6|120|185|3.1028|265.8|332.0|-1,1,3,5|-1|2.4|1825|liquido
36|Kr|Kriptón|83.798|0|18|4|p|noble|[Ar] 3d10 4s2 4p6|3.00|1350.8|-96|116|202|0.003733|115.78|119.93|0,2|0|0.0001|1898|gas
37|Rb|Rubidio|85.468|0|1|5|s|alcalino|[Kr] 5s1|0.82|403.0|46.9|220|303|1.532|312.45|961|1|1|90|1861|solido
38|Sr|Estroncio|87.62|0|2|5|s|alcalinoterreo|[Kr] 5s2|0.95|549.5|5.03|195|249|2.64|1050|1650|2|2|370|1790|solido
39|Y|Itrio|88.906|0|3|5|d|transicion|[Kr] 4d1 5s2|1.22|600.0|29.6|190|-|4.472|1799|3203|3|3|33|1794|solido
40|Zr|Circonio|91.224|0|4|5|d|transicion|[Kr] 4d2 5s2|1.33|640.1|41.1|175|-|6.52|2128|4650|4|4|165|1789|solido
41|Nb|Niobio|92.906|0|5|5|d|transicion|[Kr] 4d4 5s1|1.6|652.1|86.1|164|-|8.57|2750|5017|3,5|5|20|1801|solido
42|Mo|Molibdeno|95.95|0|6|5|d|transicion|[Kr] 4d5 5s1|2.16|684.3|71.9|154|-|10.28|2896|4912|2,3,4,5,6|6|1.2|1781|solido
43|Tc|Tecnecio|98|1|7|5|d|transicion|[Kr] 4d5 5s2|1.9|702.0|53.0|147|-|11.0|2430|4538|4,6,7|7|0.0000001|1937|solido
44|Ru|Rutenio|101.07|0|8|5|d|transicion|[Kr] 4d7 5s1|2.2|710.2|101.3|146|-|12.45|2607|4423|2,3,4,6,8|3,4|0.001|1844|solido
45|Rh|Rodio|102.91|0|9|5|d|transicion|[Kr] 4d8 5s1|2.28|719.7|109.7|142|-|12.41|2237|3968|1,3|3|0.001|1803|solido
46|Pd|Paladio|106.42|0|10|5|d|transicion|[Kr] 4d10|2.20|804.4|53.7|139|163|12.023|1828.05|3236|2,4|2|0.015|1803|solido
47|Ag|Plata|107.87|0|11|5|d|transicion|[Kr] 4d10 5s1|1.93|731.0|125.6|145|172|10.49|1234.93|2435|1|1|0.075|-|solido
48|Cd|Cadmio|112.41|0|12|5|d|transicion|[Kr] 4d10 5s2|1.69|867.8|-68|144|158|8.65|594.22|1040|2|2|0.15|1817|solido
49|In|Indio|114.82|0|13|5|p|postransicion|[Kr] 4d10 5s2 5p1|1.78|558.3|28.9|142|193|7.31|429.7485|2345|1,3|3|0.25|1863|solido
50|Sn|Estaño|118.71|0|14|5|p|postransicion|[Kr] 4d10 5s2 5p2|1.96|708.6|107.3|139|217|7.287|505.08|2875|-4,2,4|2,4|2.3|-|solido
51|Sb|Antimonio|121.76|0|15|5|p|metaloide|[Kr] 4d10 5s2 5p3|2.05|834.0|101.0|139|206|6.685|903.78|1908|-3,3,5|3,5|0.2|-|solido
52|Te|Telurio|127.60|0|16|5|p|metaloide|[Kr] 4d10 5s2 5p4|2.1|869.3|190.2|138|206|6.232|722.66|1261|-2,2,4,6|4|0.001|1782|solido
53|I|Yodo|126.90|0|17|5|p|halogeno|[Kr] 4d10 5s2 5p5|2.66|1008.4|295.2|139|198|4.933|386.85|457.4|-1,1,3,5,7|-1|0.45|1811|solido
54|Xe|Xenón|131.29|0|18|5|p|noble|[Kr] 4d10 5s2 5p6|2.60|1170.4|-77|140|216|0.005887|161.4|165.051|0,2,4,6,8|0|0.00003|1898|gas
55|Cs|Cesio|132.91|0|1|6|s|alcalino|[Xe] 6s1|0.79|375.7|45.5|244|343|1.93|301.7|944|1|1|3|1860|solido
56|Ba|Bario|137.33|0|2|6|s|alcalinoterreo|[Xe] 6s2|0.89|502.9|13.95|215|268|3.51|1000|2118|2|2|425|1808|solido
57|La|Lantano|138.91|0|3|6|f|lantanido|[Xe] 5d1 6s2|1.10|538.1|48.0|207|-|6.162|1193|3737|3|3|39|1839|solido
58|Ce|Cerio|140.12|0|-|6|f|lantanido|[Xe] 4f1 5d1 6s2|1.12|534.4|50.0|204|-|6.770|1068|3716|3,4|3|66.5|1803|solido
59|Pr|Praseodimio|140.91|0|-|6|f|lantanido|[Xe] 4f3 6s2|1.13|527.0|50.0|203|-|6.77|1208|3403|3,4|3|9.2|1885|solido
60|Nd|Neodimio|144.24|0|-|6|f|lantanido|[Xe] 4f4 6s2|1.14|533.1|50.0|201|-|7.01|1297|3347|3|3|41.5|1885|solido
61|Pm|Prometio|145|1|-|6|f|lantanido|[Xe] 4f5 6s2|1.13|540.0|50.0|199|-|7.26|1315|3273|3|3|0|1945|solido
62|Sm|Samario|150.36|0|-|6|f|lantanido|[Xe] 4f6 6s2|1.17|544.5|50.0|198|-|7.52|1345|2173|2,3|3|7.05|1879|solido
63|Eu|Europio|151.96|0|-|6|f|lantanido|[Xe] 4f7 6s2|1.2|547.1|50.0|198|-|5.244|1099|1802|2,3|3|2|1901|solido
64|Gd|Gadolinio|157.25|0|-|6|f|lantanido|[Xe] 4f7 5d1 6s2|1.20|593.4|50.0|196|-|7.90|1585|3546|3|3|6.2|1880|solido
65|Tb|Terbio|158.93|0|-|6|f|lantanido|[Xe] 4f9 6s2|1.2|565.8|50.0|194|-|8.23|1629|3503|3,4|3|1.2|1843|solido
66|Dy|Disprosio|162.50|0|-|6|f|lantanido|[Xe] 4f10 6s2|1.22|573.0|50.0|192|-|8.540|1680|2840|3|3|5.2|1886|solido
67|Ho|Holmio|164.93|0|-|6|f|lantanido|[Xe] 4f11 6s2|1.23|581.0|50.0|192|-|8.79|1734|2993|3|3|1.3|1878|solido
68|Er|Erbio|167.26|0|-|6|f|lantanido|[Xe] 4f12 6s2|1.24|589.3|50.0|189|-|9.066|1802|3141|3|3|3.5|1843|solido
69|Tm|Tulio|168.93|0|-|6|f|lantanido|[Xe] 4f13 6s2|1.25|596.7|50.0|190|-|9.32|1818|2223|3|3|0.52|1879|solido
70|Yb|Iterbio|173.05|0|-|6|f|lantanido|[Xe] 4f14 6s2|1.1|603.4|50.0|187|-|6.90|1097|1469|2,3|3|3.2|1878|solido
71|Lu|Lutecio|174.97|0|3|6|d|lantanido|[Xe] 4f14 5d1 6s2|1.27|523.5|50.0|187|-|9.841|1925|3675|3|3|0.8|1907|solido
72|Hf|Hafnio|178.49|0|4|6|d|transicion|[Xe] 4f14 5d2 6s2|1.3|658.5|17.2|175|-|13.31|2506|4876|4|4|3|1923|solido
73|Ta|Tántalo|180.95|0|5|6|d|transicion|[Xe] 4f14 5d3 6s2|1.5|761.0|31.0|170|-|16.69|3290|5731|5|5|2|1802|solido
74|W|Wolframio|183.84|0|6|6|d|transicion|[Xe] 4f14 5d4 6s2|2.36|770.0|78.6|162|-|19.25|3695|6203|2,3,4,5,6|6|1.3|1783|solido
75|Re|Renio|186.21|0|7|6|d|transicion|[Xe] 4f14 5d5 6s2|1.9|760.0|14.5|151|-|21.02|3459|5869|4,6,7|7|0.0007|1925|solido
76|Os|Osmio|190.23|0|8|6|d|transicion|[Xe] 4f14 5d6 6s2|2.2|840.0|106.1|144|-|22.59|3306|5285|2,3,4,6,8|4|0.0015|1803|solido
77|Ir|Iridio|192.22|0|9|6|d|transicion|[Xe] 4f14 5d7 6s2|2.20|880.0|151.0|141|-|22.56|2719|4403|1,3,4,6|3,4|0.001|1803|solido
78|Pt|Platino|195.08|0|10|6|d|transicion|[Xe] 4f14 5d9 6s1|2.28|870.0|205.3|136|175|21.45|2041.4|4098|2,4|2,4|0.005|1735|solido
79|Au|Oro|196.97|0|11|6|d|transicion|[Xe] 4f14 5d10 6s1|2.54|890.1|222.8|136|166|19.3|1337.33|3243|1,3|3|0.004|-|solido
80|Hg|Mercurio|200.59|0|12|6|d|transicion|[Xe] 4f14 5d10 6s2|2.00|1007.1|-48|132|155|13.534|234.3210|629.88|1,2|2|0.085|-|liquido
81|Tl|Talio|204.38|0|13|6|p|postransicion|[Xe] 4f14 5d10 6s2 6p1|1.62|589.4|19.2|145|196|11.85|577|1746|1,3|1|0.85|1861|solido
82|Pb|Plomo|207.2|0|14|6|p|postransicion|[Xe] 4f14 5d10 6s2 6p2|2.33|715.6|35.1|146|202|11.34|600.61|2022|2,4|2|14|-|solido
83|Bi|Bismuto|208.98|0|15|6|p|postransicion|[Xe] 4f14 5d10 6s2 6p3|2.02|703.0|91.2|148|207|9.78|544.7|1837|3,5|3|0.009|-|solido
84|Po|Polonio|209|1|16|6|p|metaloide|[Xe] 4f14 5d10 6s2 6p4|2.0|812.1|183.3|140|197|9.196|527|1235|-2,2,4,6|4|0.000000002|1898|solido
85|At|Astato|210|1|17|6|p|halogeno|[Xe] 4f14 5d10 6s2 6p5|2.2|899.0|270.1|150|202|-|575|-|-1,1,3,5,7|-1|0|1940|solido
86|Rn|Radón|222|1|18|6|p|noble|[Xe] 4f14 5d10 6s2 6p6|2.2|1037.0|-68|150|220|0.00973|202|211.5|0,2|0|0|1900|gas
87|Fr|Francio|223|1|1|7|s|alcalino|[Rn] 7s1|0.7|380.0|46.9|260|348|-|300|950|1|1|0|1939|solido
88|Ra|Radio|226|1|2|7|s|alcalinoterreo|[Rn] 7s2|0.9|509.3|9.6|221|283|5.5|973|2010|2|2|0.0000009|1898|solido
89|Ac|Actinio|227|1|3|7|f|actinido|[Rn] 6d1 7s2|1.1|499.0|33.8|215|-|10.07|1323|3471|3|3|0|1899|solido
90|Th|Torio|232.04|0|-|7|f|actinido|[Rn] 6d2 7s2|1.3|587.0|112.7|206|-|11.72|2115|5061|4|4|9.6|1829|solido
91|Pa|Protactinio|231.04|0|-|7|f|actinido|[Rn] 5f2 6d1 7s2|1.5|568.0|53.7|200|-|15.37|1841|4300|4,5|5|0.0000014|1913|solido
92|U|Uranio|238.03|0|-|7|f|actinido|[Rn] 5f3 6d1 7s2|1.38|597.6|50.9|196|186|18.95|1405.3|4404|3,4,5,6|6|2.7|1789|solido
93|Np|Neptunio|237|1|-|7|f|actinido|[Rn] 5f4 6d1 7s2|1.36|604.5|45.9|190|-|20.45|917|4273|3,4,5,6,7|5|0|1940|solido
94|Pu|Plutonio|244|1|-|7|f|actinido|[Rn] 5f6 7s2|1.28|584.7|-48.3|187|-|19.84|912.5|3501|3,4,5,6|4|0|1940|solido
95|Am|Americio|243|1|-|7|f|actinido|[Rn] 5f7 7s2|1.13|578.0|9.9|180|-|13.69|1449|2880|3,4,5,6|3|0|1944|solido
96|Cm|Curio|247|1|-|7|f|actinido|[Rn] 5f7 6d1 7s2|1.28|581.0|27.2|169|-|13.51|1613|3383|3,4|3|0|1944|solido
97|Bk|Berkelio|247|1|-|7|f|actinido|[Rn] 5f9 7s2|1.3|601.0|-165|-|-|14.79|1259|2900|3,4|3|0|1949|solido
98|Cf|Californio|251|1|-|7|f|actinido|[Rn] 5f10 7s2|1.3|608.0|-97|-|-|15.1|1173|1743|2,3,4|3|0|1950|solido
99|Es|Einstenio|252|1|-|7|f|actinido|[Rn] 5f11 7s2|1.3|619.0|-29|-|-|8.84|1133|1269|2,3|3|0|1952|solido
100|Fm|Fermio|257|1|-|7|f|actinido|[Rn] 5f12 7s2|1.3|627.0|34|-|-|-|1800|-|2,3|3|0|1952|solido
101|Md|Mendelevio|258|1|-|7|f|actinido|[Rn] 5f13 7s2|1.3|635.0|94|-|-|-|1100|-|2,3|3|0|1955|solido
102|No|Nobelio|259|1|-|7|f|actinido|[Rn] 5f14 7s2|1.3|642.0|-223|-|-|-|1100|-|2,3|2|0|1958|solido
103|Lr|Lawrencio|266|1|3|7|d|actinido|[Rn] 5f14 7s2 7p1|1.3|470.0|-30|-|-|-|1900|-|3|3|0|1961|solido
104|Rf|Rutherfordio|267|1|4|7|d|transicion|[Rn] 5f14 6d2 7s2|-|580.0|-|-|-|-|2400|5800|4|4|0|1964|desconocido
105|Db|Dubnio|268|1|5|7|d|transicion|[Rn] 5f14 6d3 7s2|-|665.0|-|-|-|-|-|-|5|5|0|1967|desconocido
106|Sg|Seaborgio|269|1|6|7|d|transicion|[Rn] 5f14 6d4 7s2|-|757.0|-|-|-|-|-|-|6|6|0|1974|desconocido
107|Bh|Bohrio|270|1|7|7|d|transicion|[Rn] 5f14 6d5 7s2|-|740.0|-|-|-|-|-|-|7|7|0|1981|desconocido
108|Hs|Hasio|269|1|8|7|d|transicion|[Rn] 5f14 6d6 7s2|-|730.0|-|-|-|-|-|-|8|8|0|1984|desconocido
109|Mt|Meitnerio|278|1|9|7|d|desconocido|[Rn] 5f14 6d7 7s2|-|800.0|-|-|-|-|-|-|3|3|0|1982|desconocido
110|Ds|Darmstadtio|281|1|10|7|d|desconocido|[Rn] 5f14 6d9 7s1|-|960.0|-|-|-|-|-|-|4|4|0|1994|desconocido
111|Rg|Roentgenio|282|1|11|7|d|desconocido|[Rn] 5f14 6d10 7s1|-|1020.0|-|-|-|-|-|-|3|3|0|1994|desconocido
112|Cn|Copernicio|285|1|12|7|d|desconocido|[Rn] 5f14 6d10 7s2|-|1155.0|-|-|-|-|-|357|2|2|0|1996|desconocido
113|Nh|Nihonio|286|1|13|7|p|desconocido|[Rn] 5f14 6d10 7s2 7p1|-|707.0|-|-|-|-|700|1430|1|1|0|2004|desconocido
114|Fl|Flerovio|289|1|14|7|p|desconocido|[Rn] 5f14 6d10 7s2 7p2|-|832.0|-|-|-|-|340|420|2|2|0|1999|desconocido
115|Mc|Moscovio|290|1|15|7|p|desconocido|[Rn] 5f14 6d10 7s2 7p3|-|538.0|-|-|-|-|700|1400|1,3|1|0|2003|desconocido
116|Lv|Livermorio|293|1|16|7|p|desconocido|[Rn] 5f14 6d10 7s2 7p4|-|663.0|-|-|-|-|709|1085|2,4|2|0|2000|desconocido
117|Ts|Teneso|294|1|17|7|p|desconocido|[Rn] 5f14 6d10 7s2 7p5|-|737.0|-|-|-|-|723|883|-1,1,3,5|1|0|2010|desconocido
118|Og|Oganesón|294|1|18|7|p|desconocido|[Rn] 5f14 6d10 7s2 7p6|-|861.0|-|-|-|-|-|350|0,2,4|0|0|2002|desconocido
`.trim();

const num = (s: string): number | null => (s === '-' ? null : Number(s));
const ints = (s: string): number[] =>
  s === '-' ? [] : s.split(',').map(Number).filter(Number.isFinite);

const NOBLE_CORE: Record<string, string> = {
  He: '1s2',
  Ne: '1s2 2s2 2p6',
  Ar: '1s2 2s2 2p6 3s2 3p6',
  Kr: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6',
  Xe: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6',
  Rn: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6 4f14 5d10 6s2 6p6',
};

function expandConfig(config: string): string {
  const m = config.match(/^\[([A-Z][a-z]?)\]\s*(.*)$/);
  if (!m) return config;
  const core = NOBLE_CORE[m[1]];
  return core ? `${core} ${m[2]}`.trim() : config;
}

/** Electrons per shell, derived from the expanded configuration. */
function shellsFrom(configFull: string): number[] {
  const shells: number[] = [];
  for (const term of configFull.split(/\s+/)) {
    const m = term.match(/^(\d)([spdf])(\d+)$/);
    if (!m) continue;
    const n = Number(m[1]);
    const e = Number(m[3]);
    while (shells.length < n) shells.push(0);
    shells[n - 1] += e;
  }
  return shells;
}

/**
 * Valence electrons available for bonding — used by the molecular builder to
 * check octets. For main-group elements this is the group number reduced to
 * 1–8; for d-block elements the s + d count is reported instead.
 */
function valenceFrom(group: number | null, block: Block, shells: number[]): number {
  if (block === 's' || block === 'p') {
    if (group === null) return shells[shells.length - 1] ?? 0;
    return group <= 2 ? group : group - 10;
  }
  return shells[shells.length - 1] ?? 2;
}

function parseRow(line: string): Element {
  const c = line.split('|');
  const group = num(c[5]);
  const block = c[7] as Block;
  const config = c[9];
  const configFull = expandConfig(config);
  const shells = shellsFrom(configFull);

  return {
    Z: Number(c[0]),
    symbol: c[1],
    name: c[2],
    mass: Number(c[3]),
    massIsNominal: c[4] === '1',
    group,
    period: Number(c[6]),
    block,
    category: c[8] as ElementCategory,
    config,
    configFull,
    shells,
    electronegativity: num(c[10]),
    ionisation1: num(c[11]),
    electronAffinity: num(c[12]),
    radiusCovalent: num(c[13]),
    radiusVdW: num(c[14]),
    density: num(c[15]),
    meltingPoint: num(c[16]),
    boilingPoint: num(c[17]),
    oxidationStates: ints(c[18]),
    mainOxidation: ints(c[19]),
    abundanceCrust: num(c[20]),
    discovered: num(c[21]),
    standardState: c[22] as StandardState,
    valenceElectrons: valenceFrom(group, block, shells),
  };
}

export const ELEMENTS: readonly Element[] = TABLE.split('\n').map(parseRow);

const BY_SYMBOL = new Map<string, Element>(ELEMENTS.map((e) => [e.symbol, e]));
const BY_Z = new Map<number, Element>(ELEMENTS.map((e) => [e.Z, e]));
const BY_NAME = new Map<string, Element>(
  ELEMENTS.map((e) => [e.name.toLowerCase(), e]),
);

export const elementBySymbol = (symbol: string): Element | undefined => BY_SYMBOL.get(symbol);
export const elementByZ = (Z: number): Element | undefined => BY_Z.get(Z);
export const elementByName = (name: string): Element | undefined =>
  BY_NAME.get(name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')) ??
  ELEMENTS.find((e) => normalise(e.name) === normalise(name));

const normalise = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Atomic mass, g·mol⁻¹. Throws for an unknown symbol — a silent 0 would
 *  corrupt every downstream stoichiometric result. */
export function atomicMass(symbol: string): number {
  const e = BY_SYMBOL.get(symbol);
  if (!e) throw new Error(`Elemento desconocido: "${symbol}"`);
  return e.mass;
}

/**
 * Layout coordinates for the periodic table grid.
 * The f-block is placed on rows 9 and 10 (the conventional two detached rows),
 * so La/Ac stay in group 3 of the main body.
 */
export function tablePosition(e: Element): { row: number; col: number } {
  if (e.block === 'f' && e.Z !== 71 && e.Z !== 103) {
    const isLanthanide = e.Z >= 57 && e.Z <= 70;
    const start = isLanthanide ? 57 : 89;
    return { row: isLanthanide ? 9 : 10, col: 3 + (e.Z - start) };
  }
  return { row: e.period, col: e.group ?? 3 };
}

export const CATEGORY_LABEL: Record<ElementCategory, string> = {
  alcalino: 'Metal alcalino',
  alcalinoterreo: 'Metal alcalinotérreo',
  transicion: 'Metal de transición',
  postransicion: 'Metal post-transición',
  metaloide: 'Metaloide',
  nometal: 'No metal',
  halogeno: 'Halógeno',
  noble: 'Gas noble',
  lantanido: 'Lantánido',
  actinido: 'Actínido',
  desconocido: 'Propiedades no confirmadas',
};

/** Is the element a metal, for the metal/non-metal filter (§16)? */
export function isMetal(e: Element): boolean {
  return ['alcalino', 'alcalinoterreo', 'transicion', 'postransicion', 'lantanido', 'actinido']
    .includes(e.category);
}

/** Standard state at 298.15 K and 1 bar, derived from the phase-change points. */
export function stateAt(e: Element, T: number): StandardState {
  if (e.meltingPoint === null) return 'desconocido';
  if (T < e.meltingPoint) return 'solido';
  if (e.boilingPoint === null || T < e.boilingPoint) return 'liquido';
  return 'gas';
}
