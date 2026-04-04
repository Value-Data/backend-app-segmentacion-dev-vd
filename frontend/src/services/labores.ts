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

export const laboresService = {
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
};
