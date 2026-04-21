import { get, post } from "./api";
import type { DashboardData, PaqueteTecnologico } from "@/types/sistema";
import type { ClasificacionCluster } from "@/types/laboratorio";

export const analisisService = {
  dashboard: (params?: { temporada?: string }) =>
    get<DashboardData>("/analisis/dashboard", params),
  paquetes: (params?: { temporada?: string }) =>
    get<PaqueteTecnologico[]>("/analisis/paquetes", params),
  generarPaquetes: (temporada?: string) =>
    post<{ eliminados_previos: number; generados: number; temporada: string }>(
      "/analisis/paquetes/generar" + (temporada ? `?temporada=${encodeURIComponent(temporada)}` : ""),
    ),
  clusters: (params?: { testblock?: number }) =>
    get<ClasificacionCluster[]>("/analisis/clusters", params),
};
