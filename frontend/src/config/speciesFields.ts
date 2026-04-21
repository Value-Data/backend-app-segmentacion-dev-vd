/**
 * Configuracion de campos del formulario de medicion por especie.
 *
 * Cada especie define:
 * - required: campos obligatorios para clustering
 * - visible: campos visibles por defecto (ademas de los required)
 * - hidden: campos que se ocultan (el resto se muestra en "avanzado")
 * - ruleHint: texto corto explicando como se selecciona la regla
 * - needsPeso: si el peso es critico para determinar la regla (ciruela)
 * - needsColorPulpa: si color_pulpa es critico (nectarina, durazno)
 * - needsFechaEval: si la fecha de evaluacion afecta la regla
 */

export interface SpeciesFieldConfig {
  /** Campos siempre visibles y obligatorios para esta especie */
  required: string[];
  /** Campos visibles por defecto (no obligatorios) */
  visible: string[];
  /** Hint sobre como se determina la regla de clustering */
  ruleHint: string;
  /** El peso determina la regla (ciruela: candy >60g vs cherry <=60g) */
  needsPeso: boolean;
  /** El color de pulpa determina la regla (nectarina/durazno: amarilla vs blanca) */
  needsColorPulpa: boolean;
  /** La fecha de evaluacion afecta el periodo (muy_temprana/temprana/tardia) */
  needsFechaEval: boolean;
  /** Opciones de color_pulpa relevantes */
  colorPulpaOptions?: { value: string; label: string }[];
}

const FIRMEZA_5PT = [
  "firmeza_mejilla_1", "firmeza_mejilla_2",
  "firmeza_punta", "firmeza_quilla", "firmeza_hombro",
];

const COLOR_COVERAGE = ["color_0_30", "color_30_50", "color_50_75", "color_75_100"];
const COLOR_DIST = ["color_verde", "color_crema", "color_amarillo", "color_full"];
const POSTCOSECHA = ["periodo_almacenaje", "pardeamiento", "traslucidez", "gelificacion", "harinosidad"];

const BASE_REQUIRED = ["fecha_medicion", "brix", "acidez"];
const BASE_VISIBLE = ["n_muestra", "repeticion", "peso", "perimetro", "observaciones"];

export const SPECIES_FIELD_CONFIG: Record<string, SpeciesFieldConfig> = {
  cerezo: {
    required: [...BASE_REQUIRED, "firmeza", "calibre"],
    visible: [...BASE_VISIBLE, "color_piel"],
    ruleHint: "Cerezo: brix, firmeza unificada y calibre son críticos. Los 5 puntos de firmeza (tipo ciruela) no aplican.",
    needsPeso: false,
    needsColorPulpa: false,
    needsFechaEval: false,
  },
  cereza: {
    required: [...BASE_REQUIRED, "firmeza", "calibre"],
    visible: [...BASE_VISIBLE, "color_piel"],
    ruleHint: "Cereza: brix, firmeza unificada y calibre son críticos. Los 5 puntos de firmeza (tipo ciruela) no aplican.",
    needsPeso: false,
    needsColorPulpa: false,
    needsFechaEval: false,
  },
  ciruela: {
    required: [...BASE_REQUIRED, "peso", ...FIRMEZA_5PT],
    visible: [...BASE_VISIBLE, ...COLOR_COVERAGE, ...COLOR_DIST],
    ruleHint: "Peso > 60g = Candy | Peso <= 60g = Cherry. Umbrales distintos.",
    needsPeso: true,
    needsColorPulpa: false,
    needsFechaEval: false,
  },
  nectarina: {
    required: [...BASE_REQUIRED, "color_pulpa", ...FIRMEZA_5PT],
    visible: [...BASE_VISIBLE, ...COLOR_COVERAGE, ...COLOR_DIST],
    ruleHint: "Color pulpa (Amarilla/Blanca) + Fecha evaluacion → periodo (muy temprana / temprana / tardia).",
    needsPeso: false,
    needsColorPulpa: true,
    needsFechaEval: true,
    colorPulpaOptions: [
      { value: "amarilla", label: "Amarilla" },
      { value: "blanca", label: "Blanca" },
    ],
  },
  durazno: {
    required: [...BASE_REQUIRED, "color_pulpa", ...FIRMEZA_5PT],
    visible: [...BASE_VISIBLE, ...COLOR_COVERAGE, ...COLOR_DIST],
    ruleHint: "Color pulpa (Amarillo/Blanco) + Fecha evaluacion → periodo.",
    needsPeso: false,
    needsColorPulpa: true,
    needsFechaEval: true,
    colorPulpaOptions: [
      { value: "amarillo", label: "Amarillo" },
      { value: "blanco", label: "Blanco" },
    ],
  },
  paraguayo: {
    required: [...BASE_REQUIRED, ...FIRMEZA_5PT],
    visible: [...BASE_VISIBLE],
    ruleHint: "Regla unica para Paraguayo. Fruto plano, alto brix.",
    needsPeso: false,
    needsColorPulpa: false,
    needsFechaEval: false,
  },
  platerina: {
    required: [...BASE_REQUIRED, ...FIRMEZA_5PT],
    visible: [...BASE_VISIBLE],
    ruleHint: "Regla unica para Platerina. Nectarina plana, mas firme.",
    needsPeso: false,
    needsColorPulpa: false,
    needsFechaEval: false,
  },
  damasco: {
    required: [...BASE_REQUIRED, ...FIRMEZA_5PT],
    visible: [...BASE_VISIBLE],
    ruleHint: "Regla unica para Damasco. Acidez mas tolerante.",
    needsPeso: false,
    needsColorPulpa: false,
    needsFechaEval: false,
  },
};

/** Default config for unknown species */
export const DEFAULT_SPECIES_CONFIG: SpeciesFieldConfig = {
  required: [...BASE_REQUIRED, ...FIRMEZA_5PT],
  visible: [...BASE_VISIBLE, "peso", "color_pulpa"],
  ruleHint: "Especie sin regla especifica. Se aplica regla generica (Ciruela Candy).",
  needsPeso: false,
  needsColorPulpa: false,
  needsFechaEval: false,
};

/** Get config for a species name (case-insensitive partial match) */
export function getSpeciesConfig(especieNombre: string | null | undefined): SpeciesFieldConfig {
  if (!especieNombre) return DEFAULT_SPECIES_CONFIG;
  const lower = especieNombre.toLowerCase().trim();
  for (const [key, config] of Object.entries(SPECIES_FIELD_CONFIG)) {
    if (lower.includes(key)) return config;
  }
  return DEFAULT_SPECIES_CONFIG;
}

/** Check if a field should be visible for a given species */
export function isFieldVisible(especieNombre: string | null | undefined, fieldKey: string): boolean {
  const config = getSpeciesConfig(especieNombre);
  return config.required.includes(fieldKey) || config.visible.includes(fieldKey);
}

/** Check if a field is required for clustering for a given species */
export function isFieldRequired(especieNombre: string | null | undefined, fieldKey: string): boolean {
  const config = getSpeciesConfig(especieNombre);
  return config.required.includes(fieldKey);
}

/** All possible fields for postcosecha section */
export const POSTCOSECHA_FIELDS = POSTCOSECHA;

/** Fields that are always shown regardless of species */
export const ALWAYS_VISIBLE = [
  "fecha_medicion", "n_muestra", "repeticion", "observaciones",
];

/** Firmeza 5-point fields */
export const FIRMEZA_FIELDS = FIRMEZA_5PT;

/** Color coverage fields */
export const COLOR_FIELDS = [...COLOR_COVERAGE, ...COLOR_DIST, "color_pulpa"];
