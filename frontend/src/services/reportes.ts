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

  /** Generate "Evaluación de cosecha" PDF (Javiera-style) */
  downloadEvaluacionCosecha: async (params: {
    variedad_ids: number[];
    temporada?: string;
    campo?: number;
    incluir_ia?: boolean;
  }) => {
    const { useAuthStore } = await import("@/stores/authStore");
    const token = useAuthStore.getState().token;
    const qs = new URLSearchParams();
    qs.set("variedad_ids", params.variedad_ids.join(","));
    if (params.temporada) qs.set("temporada", params.temporada);
    if (params.campo) qs.set("campo", String(params.campo));
    if (params.incluir_ia !== undefined) qs.set("incluir_ia", String(params.incluir_ia));
    const response = await fetch(`${BASE}/reportes/evaluacion-cosecha/pdf?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaluacion_cosecha_${params.variedad_ids.join("-")}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  /** Generate "Resumen de cosechas" PDF (summary table) */
  downloadResumenCosechas: async (params: {
    variedad_ids: number[];
    temporada?: string;
    campo?: number;
    incluir_ia?: boolean;
  }) => {
    const { useAuthStore } = await import("@/stores/authStore");
    const token = useAuthStore.getState().token;
    const qs = new URLSearchParams();
    qs.set("variedad_ids", params.variedad_ids.join(","));
    if (params.temporada) qs.set("temporada", params.temporada);
    if (params.campo) qs.set("campo", String(params.campo));
    if (params.incluir_ia !== undefined) qs.set("incluir_ia", String(params.incluir_ia));
    const response = await fetch(`${BASE}/reportes/resumen-cosechas/pdf?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumen_cosechas_${params.variedad_ids.join("-")}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  },
};
