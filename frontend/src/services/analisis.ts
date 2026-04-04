import { get } from "./api";
import type { DashboardData, PaqueteTecnologico } from "@/types/sistema";
import type { ClasificacionCluster } from "@/types/laboratorio";

export const analisisService = {
  dashboard: (params?: { temporada?: string }) =>
    get<DashboardData>("/analisis/dashboard", params),
  paquetes: (params?: { temporada?: string }) =>
    get<PaqueteTecnologico[]>("/analisis/paquetes", params),
  clusters: (params?: { testblock?: number }) =>
    get<ClasificacionCluster[]>("/analisis/clusters", params),
};
