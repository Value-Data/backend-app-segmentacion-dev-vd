import { get, post, uploadFile } from "./api";
import type {
  MedicionLaboratorio,
  MedicionCreateResponse,
  LabKpis,
  Planta,
  BatchResponse,
  VariedadResumen,
  EvolucionResponse,
} from "@/types/laboratorio";

export const laboratorioService = {
  plantas: (params?: { testblock?: number; especie?: number }) =>
    get<Planta[]>("/laboratorio/plantas", params),
  crearMedicion: (data: Record<string, unknown>) =>
    post<MedicionCreateResponse>("/laboratorio/mediciones", data),
  mediciones: (params?: { testblock?: number; temporada?: string; especie?: number; campo?: number }) =>
    get<MedicionLaboratorio[]>("/laboratorio/mediciones", params),
  medicionesByPlanta: (idPlanta: number) =>
    get<(MedicionLaboratorio & { cluster?: number | null; cluster_label?: string | null })[]>(
      `/laboratorio/planta/${idPlanta}/mediciones`
    ),
  kpis: (params?: { testblock?: number; temporada?: string }) =>
    get<LabKpis>("/laboratorio/kpis", params),
  crearMedicionesBatch: (mediciones: Record<string, unknown>[]) =>
    post<BatchResponse>("/laboratorio/mediciones/batch", { mediciones }),
  bulkImport: (file: File) =>
    uploadFile<{ created: number; errors: unknown[] }>("/laboratorio/bulk-import", file),
  analisisResumen: (params?: { especie?: number; temporada?: string; portainjerto?: number; pmg?: number; campo?: number }) =>
    get<VariedadResumen[]>("/laboratorio/analisis/resumen-variedades", params),
  analisisEvolucion: (idVariedad: number, idPortainjerto?: number, campo?: number) =>
    get<EvolucionResponse>("/laboratorio/analisis/evolucion", {
      id_variedad: idVariedad,
      ...(idPortainjerto ? { id_portainjerto: idPortainjerto } : {}),
      ...(campo ? { campo } : {}),
    }),
  /** Preview which clustering rule would apply given context params. */
  rulePreview: (params: {
    especie: string;
    peso?: number | null;
    color_pulpa?: string | null;
    fecha?: string | null;
  }) =>
    get<{
      regla: string;
      regla_label: string;
      umbrales: Record<string, number[]>;
      bandas: Record<string, Record<string, string>>;
      cluster_ranges: Record<string, number[]>;
    }>("/laboratorio/clustering-rule-preview", {
      especie: params.especie,
      ...(params.peso != null ? { peso: params.peso } : {}),
      ...(params.color_pulpa ? { color_pulpa: params.color_pulpa } : {}),
      ...(params.fecha ? { fecha: params.fecha } : {}),
    }),
  /** Build the full URL for the variedad analysis PDF download. */
  reportePdfUrl: (idVariedad: number) => {
    const base = import.meta.env.VITE_API_BASE_URL || "/api/v1";
    return `${base}/reportes/variedad/${idVariedad}/pdf`;
  },
  /** Build the full URL for the plant-level PDF report. */
  reportePlantaPdfUrl: (idPlanta: number) => {
    const base = import.meta.env.VITE_API_BASE_URL || "/api/v1";
    return `${base}/reportes/planta/${idPlanta}/pdf`;
  },
  /** Build the full URL for the lot-level PDF report. */
  reporteLotePdfUrl: (idInventario: number) => {
    const base = import.meta.env.VITE_API_BASE_URL || "/api/v1";
    return `${base}/reportes/lote/${idInventario}/pdf`;
  },
};
