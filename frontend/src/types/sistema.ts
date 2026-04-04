export interface Usuario {
  id_usuario: number;
  username: string;
  nombre_completo?: string | null;
  email?: string | null;
  rol?: string | null;
  campos_asignados?: string | null;
  activo?: boolean;
  ultimo_acceso?: string | null;
  fecha_creacion?: string;
}

export interface Rol {
  id_rol: number;
  nombre: string;
  descripcion?: string | null;
  permisos?: string | null;
  activo?: boolean;
}

export interface AuditLog {
  id_log: number;
  tabla?: string | null;
  registro_id?: number | null;
  accion?: string | null;
  datos_anteriores?: string | null;
  datos_nuevos?: string | null;
  usuario?: string | null;
  ip_address?: string | null;
  fecha: string;
}

export interface Alerta {
  id_alerta: number;
  id_posicion?: number | null;
  tipo_alerta?: string | null;
  prioridad: string;
  titulo: string;
  descripcion?: string | null;
  valor_detectado?: string | null;
  umbral_violado?: string | null;
  estado: string;
  usuario_resolucion?: string | null;
  fecha_resolucion?: string | null;
  notas_resolucion?: string | null;
  fecha_creacion: string;
}

export interface ReglaAlerta {
  id_regla: number;
  codigo: string;
  nombre?: string | null;
  descripcion?: string | null;
  tipo?: string | null;
  condicion?: string | null;
  prioridad_resultado?: string | null;
  activo?: boolean;
  fecha_creacion?: string;
}

export interface PaqueteTecnologico {
  id_paquete: number;
  id_variedad: number;
  temporada: string;
  total_posiciones?: number | null;
  posiciones_evaluadas?: number | null;
  cluster_predominante?: number | null;
  brix_promedio?: number | null;
  firmeza_promedio?: number | null;
  acidez_promedio?: number | null;
  calibre_promedio?: number | null;
  score_promedio?: number | null;
  recomendacion?: string | null;
  decision?: string | null;
  fecha_creacion?: string;
}

export interface DashboardData {
  kpis: Record<string, number | null>;
  total_plantas_activas: number;
  total_testblocks: number;
  total_posiciones: number;
  cluster_distribution: Record<string, number>;
}
