export interface MedicionLaboratorio {
  id_medicion: number;
  id_posicion?: number | null;
  id_planta?: number | null;
  temporada?: string | null;
  fecha_medicion: string;
  fecha_cosecha?: string | null;
  brix?: number | null;
  acidez?: number | null;
  firmeza?: number | null;
  calibre?: number | null;
  peso?: number | null;
  color_pct?: number | null;
  cracking_pct?: number | null;
  observaciones?: string | null;
  usuario_registro?: string | null;
  fecha_creacion?: string;
  // Firmeza detallada (5 puntos)
  firmeza_punta?: number | null;
  firmeza_quilla?: number | null;
  firmeza_hombro?: number | null;
  firmeza_mejilla_1?: number | null;
  firmeza_mejilla_2?: number | null;
  // Muestra y postcosecha
  n_muestra?: number | null;
  periodo_almacenaje?: number | null;
  perimetro?: number | null;
  pardeamiento?: number | null;
  traslucidez?: number | null;
  gelificacion?: number | null;
  harinosidad?: number | null;
  color_pulpa?: string | null;
  // Agronomia y contexto de muestra
  raleo_frutos?: number | null;
  rendimiento?: number | null;
  repeticion?: number | null;
  // Color de cubrimiento (% frutos en cada rango)
  color_0_30?: number | null;
  color_30_50?: number | null;
  color_50_75?: number | null;
  color_75_100?: number | null;
  color_total?: number | null;
  // Distribución de color
  color_verde?: number | null;
  color_crema?: number | null;
  color_amarillo?: number | null;
  color_full?: number | null;
  color_dist_total?: number | null;
  // Total frutos evaluados por metrica postcosecha
  total_frutos_pardeamiento?: number | null;
  total_frutos_traslucidez?: number | null;
  total_frutos_gelificacion?: number | null;
  total_frutos_harinosidad?: number | null;
  // FKs directas
  id_campo?: number | null;
  id_variedad?: number | null;
  id_especie?: number | null;
  id_portainjerto?: number | null;
}

export interface PaginatedMediciones {
  data: MedicionLaboratorio[];
  total: number;
  skip: number;
  limit: number;
}

export interface MedicionCreateResponse {
  medicion: MedicionLaboratorio;
  clasificacion: ClasificacionResult | null;
}

export interface ClasificacionResult {
  cluster: number;
  cluster_label: string;
  banda_brix: number;
  banda_firmeza: number;
  banda_acidez: number;
  banda_firmeza_punto: number;
  score_total: number | null;
}

export interface ClasificacionCluster {
  id_clasificacion: number;
  id_medicion: number;
  cluster?: number | null;
  banda_brix?: number | null;
  banda_firmeza?: number | null;
  banda_acidez?: number | null;
  banda_calibre?: number | null;
  score_total?: number | null;
  metodo?: string | null;
  fecha_calculo?: string;
}

export interface BatchRowResult {
  index: number;
  success: boolean;
  medicion?: {
    id_medicion: number;
    id_planta?: number | null;
    id_posicion?: number | null;
    temporada?: string | null;
    fecha_medicion?: string | null;
    brix?: number | null;
    acidez?: number | null;
    firmeza?: number | null;
    peso?: number | null;
  } | null;
  clasificacion?: ClasificacionResult | null;
  error?: string | null;
}

export interface BatchResponse {
  total_enviadas: number;
  total_creadas: number;
  total_errores: number;
  resultados: BatchRowResult[];
}

export interface LabKpis {
  total: number;
  brix_promedio: number | null;
  firmeza_promedio: number | null;
  acidez_promedio: number | null;
  calibre_promedio: number | null;
  brix_min: number | null;
  brix_max: number | null;
}

export interface Planta {
  id_planta: number;
  codigo?: string | null;
  id_posicion?: number | null;
  id_variedad?: number | null;
  id_portainjerto?: number | null;
  id_especie?: number | null;
  id_pmg?: number | null;
  id_lote_origen?: number | null;
  condicion: string;
  activa: boolean;
  ano_plantacion?: number | null;
}

export interface VariedadResumen {
  id_variedad: number;
  id_portainjerto: number | null;
  id_campo: number | null;
  id_pmg: number | null;
  variedad: string;
  especie: string;
  portainjerto: string;
  pmg: string;
  campo: string;
  total_mediciones: number;
  n_temporadas: number;
  brix_avg: number | null;
  brix_min: number | null;
  brix_max: number | null;
  firmeza_avg: number | null;
  acidez_avg: number | null;
  peso_avg: number | null;
  calibre_avg: number | null;
  cluster_dist: { c1: number; c2: number; c3: number; c4: number };
  cluster_predominante: number | null;
}

export interface EvolucionTemporada {
  temporada: string;
  total: number;
  brix_avg: number | null;
  firmeza_avg: number | null;
  acidez_avg: number | null;
  peso_avg: number | null;
  cluster_dist: { c1: number; c2: number; c3: number; c4: number };
}

export interface MedicionIndividual {
  id: number;
  fecha: string | null;
  temporada: string;
  brix: number | null;
  firmeza: number | null;
  acidez: number | null;
  peso: number | null;
  calibre: number | null;
  n_muestra: number | null;
  id_campo: number | null;
  campo: string;
  cluster: number | null;
}

export interface EvolucionResponse {
  contexto: {
    variedad: string;
    especie: string;
    portainjerto: string;
    pmg: string;
    campo: string | null;
  };
  por_temporada: EvolucionTemporada[];
  por_fecha: MedicionIndividual[];
}

export interface EjecucionLabor {
  id_ejecucion: number;
  id_posicion?: number | null;
  id_planta?: number | null;
  id_labor: number;
  temporada?: string | null;
  fecha_programada?: string | null;
  fecha_ejecucion?: string | null;
  estado: string;
  ejecutor?: string | null;
  duracion_min?: number | null;
  observaciones?: string | null;
  usuario_registro?: string | null;
  fecha_creacion?: string;
}
