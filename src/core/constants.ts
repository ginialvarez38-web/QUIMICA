/**
 * Physical and chemical constants.
 *
 * Values follow the SI redefinition of 2019 (exact where the SI fixes them)
 * and CODATA 2018 recommended values otherwise. Every constant in CHEMIA is
 * read from this module — no engine may re-declare one, so a correction here
 * propagates through the whole platform (§2).
 */

/** Avogadro constant, N_A — exact by SI definition. Unit: mol⁻¹ */
export const NA = 6.02214076e23;
/** Elementary charge, e — exact by SI definition. Unit: C */
export const ELEMENTARY_CHARGE = 1.602176634e-19;
/** Boltzmann constant, k_B — exact by SI definition. Unit: J·K⁻¹ */
export const KB = 1.380649e-23;
/** Planck constant, h — exact by SI definition. Unit: J·s */
export const PLANCK = 6.62607015e-34;
/** Speed of light in vacuum, c — exact by SI definition. Unit: m·s⁻¹ */
export const C_LIGHT = 299792458;

/** Molar gas constant, R = N_A·k_B. Unit: J·mol⁻¹·K⁻¹ */
export const R = NA * KB; // 8.31446261815324
/** Molar gas constant in L·atm·mol⁻¹·K⁻¹ */
export const R_L_ATM = 0.082057366080960;
/** Molar gas constant in L·bar·mol⁻¹·K⁻¹ */
export const R_L_BAR = 0.083144626181532;
/** Faraday constant, F = N_A·e. Unit: C·mol⁻¹ */
export const FARADAY = NA * ELEMENTARY_CHARGE; // 96485.33212...

/** Standard acceleration of gravity. Unit: m·s⁻² */
export const G_ACCEL = 9.80665;
/** Standard atmosphere. Unit: Pa */
export const ATM = 101325;
/** Standard state pressure used in thermochemical tables (1 bar). Unit: Pa */
export const P_STANDARD = 1e5;
/** Standard temperature for thermochemical data, 25 °C. Unit: K */
export const T_STANDARD = 298.15;
/** Absolute zero offset. 0 °C in kelvin. */
export const T0_CELSIUS = 273.15;

/** Stefan–Boltzmann constant. Unit: W·m⁻²·K⁻⁴ */
export const STEFAN_BOLTZMANN = 5.670374419e-8;
/** Vacuum permittivity, ε₀. Unit: F·m⁻¹ */
export const EPSILON_0 = 8.8541878128e-12;
/** Vacuum permeability, μ₀. Unit: N·A⁻² */
export const MU_0 = 1.25663706212e-6;
/** Electron rest mass. Unit: kg */
export const M_ELECTRON = 9.1093837015e-31;
/** Proton rest mass. Unit: kg */
export const M_PROTON = 1.67262192369e-27;
/** Neutron rest mass. Unit: kg */
export const M_NEUTRON = 1.67492749804e-27;
/** Unified atomic mass unit. Unit: kg */
export const AMU = 1.66053906660e-27;
/** Rydberg constant for infinite mass, R_∞. Unit: m⁻¹ */
export const RYDBERG = 10973731.568160;
/** Rydberg energy (hcR_∞) expressed in eV — hydrogen ionisation reference. */
export const RYDBERG_EV = 13.605693122994;
/** Bohr radius, a₀. Unit: m */
export const BOHR_RADIUS = 5.29177210903e-11;
/** Hartree energy. Unit: J */
export const HARTREE = 4.3597447222071e-18;
/** Electronvolt in joules. */
export const EV = 1.602176634e-19;
/** Thermochemical calorie. Unit: J */
export const CALORIE = 4.184;

/** Ion product of water at 25 °C — pKw = 13.995. */
export const KW_25 = 1.0e-14;
/** Enthalpy of the water autoprotolysis reaction. Unit: J·mol⁻¹ */
export const DH_WATER_IONISATION = 55840;

/** Density of pure water at 25 °C. Unit: g·mL⁻¹ */
export const RHO_WATER_25 = 0.997047;
/** Specific heat capacity of liquid water at 25 °C. Unit: J·g⁻¹·K⁻¹ */
export const CP_WATER = 4.1796;
/** Relative permittivity of water at 25 °C — used for Debye–Hückel. */
export const EPS_R_WATER_25 = 78.38;

/** RT at 25 °C. Unit: J·mol⁻¹ */
export const RT_25 = R * T_STANDARD;
/** RT/F at 25 °C — the Nernst thermal voltage. Unit: V */
export const NERNST_SLOPE_25 = (R * T_STANDARD) / FARADAY; // 0.025693 V
/** 2.303·RT/F at 25 °C — the decadic Nernst slope. Unit: V per decade */
export const NERNST_DECADE_25 = Math.LN10 * NERNST_SLOPE_25; // 0.05916 V
