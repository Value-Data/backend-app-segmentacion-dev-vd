import { get, post } from "./api";

export interface VariedadReport {
  variedad: Record<string, unknown>;
  inventario: Record<string, unknown>[];
  plantaciones: Record<string, unknown>[];
  mediciones: Record<string, unknown>[];
  bitacora: Record<string, unknown>[];
  labores_count: number;
}

export interface LoteReport {
  lote: Record<string, unknown>;
  movimientos: Record<string, unknown>[];
  destinos: Record<string, unknown>[];
  plantas: Record<string, unknown>[];
}

export interface TestBlockReport {
  testblock: Record<string, unknown>;
  posiciones_resumen: Record<string, number>;
  variedades: { id_variedad: number; nombre: string; cantidad: number }[];
  mediciones: Record<string, unknown>[];
  labores: Record<string, unknown>[];
  inventario: Record<string, unknown>[];
}

export interface AIAnalysisResponse {
  analisis: string;
}

const BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export const reportesService = {
  variedad: (id: number) => get<VariedadReport>(`/reportes/variedad/${id}`),
  lote: (id: number) => get<LoteReport>(`/reportes/lote/${id}`),
  testblock: (id: number) => get<TestBlockReport>(`/reportes/testblock/${id}`),
  aiAnalisis: (data: { tipo_reporte: string; id_entidad: number; pregunta?: string }) =>
    post<AIAnalysisResponse>("/reportes/ai-analisis", data),
  downloadPdf: async (tipo: string, id: number) => {
    const { useAuthStore } = await import("@/stores/authStore");
    const token = useAuthStore.getState().token;
    const response = await fetch(`${BASE}/reportes/pdf/${tipo}/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_${tipo}_${id}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  },
};
