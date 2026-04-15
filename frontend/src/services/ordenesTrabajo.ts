import { get, post, put, del } from "./api";

export interface OrdenTrabajo {
  id: number;
  codigo: string;
  id_tipo_labor?: number;
  id_testblock?: number;
  id_lote?: number;
  temporada?: string;
  fecha_plan_inicio: string;
  fecha_plan_fin: string;
  id_responsable?: number;
  equipo?: string;
  prioridad: string;
  estado: string;
  posiciones_total: number;
  observaciones_plan?: string;
  cumplimiento?: string;
  motivo_desviacion?: string;
  motivo_desviacion_detalle?: string;
  posiciones_ejecutadas: number;
  fecha_ejecucion_real?: string;
  ejecutor_real?: string;
  duracion_real_min?: number;
  observaciones_ejecucion?: string;
  fecha_cierre?: string;
  fecha_creacion?: string;
  // Enriched fields
  tipo_labor_nombre?: string;
  testblock_nombre?: string;
  responsable_nombre?: string;
  lote_codigo?: string;
}

export interface KanbanData {
  planificadas: OrdenTrabajo[];
  en_progreso: OrdenTrabajo[];
  completadas: OrdenTrabajo[];
  parciales: OrdenTrabajo[];
  atrasadas: OrdenTrabajo[];
  no_realizadas: OrdenTrabajo[];
}

export const ordenesTrabajoService = {
  list: (params?: Record<string, any>) =>
    get<OrdenTrabajo[]>("/ordenes-trabajo/", params),
  getById: (id: number) =>
    get<OrdenTrabajo>(`/ordenes-trabajo/${id}`),
  create: (data: Record<string, unknown>) =>
    post<OrdenTrabajo>("/ordenes-trabajo/", data),
  update: (id: number, data: Record<string, unknown>) =>
    put<OrdenTrabajo>(`/ordenes-trabajo/${id}`, data),
  ejecutar: (id: number, data: Record<string, unknown>) =>
    post<OrdenTrabajo>(`/ordenes-trabajo/${id}/ejecutar`, data),
  reprogramar: (id: number, data: Record<string, unknown>) =>
    post<OrdenTrabajo>(`/ordenes-trabajo/${id}/reprogramar`, data),
  remove: (id: number) =>
    del<void>(`/ordenes-trabajo/${id}`),
  autoGenerar: (data: Record<string, unknown>) =>
    post<{ created: number; labores_vinculadas: number; message: string }>("/ordenes-trabajo/auto-generar", data),
  kanban: (params?: Record<string, any>) =>
    get<KanbanData>("/ordenes-trabajo/kanban", params),
  porPersona: (params?: Record<string, any>) =>
    get<any>("/ordenes-trabajo/por-persona", params),
  ejecutarMasivo: (data: Record<string, unknown>) =>
    post<any>("/ordenes-trabajo/masivo/ejecutar", data),
  cumplimientoTb: (params?: Record<string, any>) =>
    get<any>("/ordenes-trabajo/cumplimiento-tb", params),
  desviaciones: (params?: Record<string, any>) =>
    get<any>("/ordenes-trabajo/desviaciones", params),
};
