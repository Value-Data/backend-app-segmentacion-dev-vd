import { get, post, put } from "./api";
import type { EjecucionLabor } from "@/types/laboratorio";

export interface LaborDashboard {
  total: number;
  planificadas: number;
  ejecutadas: number;
  atrasadas: number;
  esta_semana: number;
  por_tipo: Record<string, { planificadas: number; ejecutadas: number; atrasadas: number }>;
  por_mes: Record<string, { planificadas: number; ejecutadas: number }>;
  pct_cumplimiento: number;
}

export interface Evidencia {
  id_evidencia: number;
  id_ejecucion: number;
  tipo: string;
  descripcion?: string | null;
  imagen_base64?: string | null;
  url?: string | null;
  lat?: number | null;
  lng?: number | null;
  usuario?: string | null;
  fecha_creacion?: string;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export interface TipoLabor {
  id_labor: number;
  codigo: string;
  nombre: string;
  categoria: string;
  descripcion?: string | null;
  aplica_especies?: string | null;
  aplica_a?: string | null;
  frecuencia?: string | null;
  activo?: boolean;
}

export interface EstadoFenologico {
  id_estado: number;
  id_especie: number;
  codigo: string;
  nombre: string;
  orden: number;
  descripcion?: string | null;
  color_hex?: string | null;
  mes_orientativo?: string | null;
  activo?: boolean;
}

export interface RegistroFenologicoHistorial {
  id_registro: number;
  id_posicion: number;
  id_planta?: number | null;
  id_estado_fenol?: number | null;
  temporada?: string | null;
  fecha_registro?: string | null;
  porcentaje?: number | null;
  observaciones?: string | null;
  usuario_registro?: string | null;
  estado?: { nombre: string; color_hex: string; codigo: string; mes_orientativo: string } | null;
}

export const laboresService = {
  tiposLabor: () =>
    get<TipoLabor[]>("/labores/tipos-labor"),
  seedTiposLabor: () =>
    post<{ message: string; created: number }>("/labores/seed-tipos-labor", {}),
  estadosFenologicos: (params?: { especie?: number }) =>
    get<EstadoFenologico[]>("/mantenedores/estados-fenologicos", params),
  seedEstadosFenologicos: () =>
    post<{ message: string; created: number; skipped_species: string[] }>("/labores/seed-estados-fenologicos", {}),
  planificacion: (params?: { testblock?: number }) =>
    get<EjecucionLabor[]>("/labores/planificacion", params),
  crearPlanificacion: (data: Record<string, unknown>) =>
    post<EjecucionLabor>("/labores/planificacion", data),
  crearPlanificacionTestblock: (data: Record<string, unknown>) =>
    post<{ created: number; testblock: number }>("/labores/planificacion-testblock", data),
  ejecutar: (id: number, data: Record<string, unknown>) =>
    put<EjecucionLabor>(`/labores/ejecucion/${id}`, data),
  ordenesTrabajo: (params?: { testblock?: number; fecha?: string }) =>
    get<EjecucionLabor[]>("/labores/ordenes-trabajo", params),
  dashboard: (params?: { testblock?: number }) =>
    get<LaborDashboard>("/labores/dashboard", params),
  evidencias: (id: number) =>
    get<Evidencia[]>(`/labores/ejecucion/${id}/evidencias`),
  addEvidencia: (id: number, data: Record<string, unknown>) =>
    post<Evidencia>(`/labores/ejecucion/${id}/evidencias`, data),
  qrUrl: (id: number) => `${BASE_URL}/labores/ejecucion/${id}/qr`,
  hoy: () =>
    get<EjecucionLabor[]>("/labores/hoy"),
  ejecutarMasivo: (ids: number[], fecha_ejecucion?: string, ejecutor?: string) =>
    post<{ updated: number }>("/labores/ejecutar-masivo", { ids, fecha_ejecucion, ejecutor }),
  registroFenologico: (data: Record<string, unknown>) =>
    post<{ created: number; tipo_labor_id: number }>("/labores/registro-fenologico", data),
  historialFenologico: (testblockId: number) =>
    get<RegistroFenologicoHistorial[]>(`/labores/historial-fenologico/${testblockId}`),
};
