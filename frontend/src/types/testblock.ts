export interface TestBlock {
  id_testblock: number;
  codigo: string;
  nombre: string;
  id_campo: number;
  id_centro_costo?: number | null;
  id_cuartel?: number | null;
  id_marco?: number | null;
  num_hileras?: number | null;
  posiciones_por_hilera?: number | null;
  total_posiciones?: number | null;
  latitud?: number | null;
  longitud?: number | null;
  estado?: string;
  fecha_creacion_tb?: string | null;
  temporada_inicio?: string | null;
  notas?: string | null;
  activo?: boolean;
  fecha_creacion?: string;
  fecha_modificacion?: string | null;
  // computed stats
  pos_alta?: number;
  pos_baja?: number;
  pos_replante?: number;
  pos_vacia?: number;
}

export interface PosicionTestBlock {
  id_posicion: number;
  codigo_unico: string;
  id_cuartel?: number | null;
  id_testblock?: number | null;
  id_variedad?: number | null;
  id_portainjerto?: number | null;
  id_pmg?: number | null;
  id_lote?: number | null;
  hilera: number;
  posicion: number;
  fecha_plantacion?: string | null;
  fecha_alta?: string | null;
  fecha_baja?: string | null;
  estado: string; // vacia | alta | baja | replante
  cluster_actual?: number | null;
  motivo_baja?: string | null;
  observaciones?: string | null;
  protegida?: boolean;
  codigo_qr?: string | null;
  conduccion?: string | null;
  marco_plantacion?: string | null;
  usuario_alta?: string | null;
  usuario_baja?: string | null;
  // Plant data (enriched by grilla endpoint from active plantas)
  planta_id?: number | null;
  planta_codigo?: string | null;
  planta_variedad?: number | null;
  planta_portainjerto?: number | null;
  planta_especie?: number | null;
  planta_condicion?: string | null;
  ano_plantacion?: number | null;
  tipo_injertacion?: string | null;
}

export interface QrData {
  tb?: string;
  pos?: string;
  var?: string;
  pi?: string;
  plt?: string;
  lote?: string | null;
  est?: string;
  fecha?: string;
}

export function parseQr(pos: PosicionTestBlock): QrData | null {
  if (!pos.codigo_qr) return null;
  try {
    return JSON.parse(pos.codigo_qr) as QrData;
  } catch {
    return null;
  }
}

export interface GrillaResponse {
  hileras: number;
  max_pos: number;
  posiciones: PosicionTestBlock[];
}

export interface ResumenHilera {
  hilera: number;
  total: number;
  alta: number;
  baja: number;
  vacia: number;
  replante: number;
}

export interface ResumenVariedad {
  variedad: string;
  id_variedad: number;
  cantidad: number;
  pct: number;
}

export interface HistorialPosicion {
  id_historial: number;
  id_posicion: number;
  id_planta?: number | null;
  id_planta_anterior?: number | null;
  accion: string;
  estado_anterior?: string | null;
  estado_nuevo?: string | null;
  motivo?: string | null;
  usuario?: string | null;
  fecha: string;
}

export interface MapaPosicion {
  id_posicion: number;
  hilera: number;
  posicion: number;
  estado: string;
  codigo_unico: string;
  id_variedad?: number | null;
}

export interface MapaTestBlockData {
  latitud: number | null;
  longitud: number | null;
  poligono_coords: [number, number][] | null;
  zoom_nivel: number;
  posiciones: MapaPosicion[];
}

export type ColorMode = "estado" | "variedad";
export type DisplayMode = "variedad+id" | "variedad+pi" | "variedad" | "id" | "codigo";
