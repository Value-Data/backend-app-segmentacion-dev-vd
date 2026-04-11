import { get, del } from "./api";

const BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export interface DocumentoPdfResumen {
  id_documento: number;
  rut: string;
  tipo_reporte: string;
  nombre_archivo: string;
  descripcion: string | null;
  tamano_bytes: number | null;
  id_entidad: number | null;
  usuario_creacion: string | null;
  fecha_creacion: string;
}

export interface RutResumen {
  rut: string;
  total_documentos: number;
  ultimo_pdf: string;
}

export const documentosPdfService = {
  listarRuts: () => get<RutResumen[]>("/documentos-pdf/"),

  listarPorRut: (rut: string, tipoReporte?: string) => {
    const params = tipoReporte ? `?tipo_reporte=${tipoReporte}` : "";
    return get<DocumentoPdfResumen[]>(`/documentos-pdf/por-rut/${rut}${params}`);
  },

  descargar: async (idDocumento: number, nombreArchivo: string) => {
    const { useAuthStore } = await import("@/stores/authStore");
    const token = useAuthStore.getState().token;
    const response = await fetch(`${BASE}/documentos-pdf/${idDocumento}/descargar`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  eliminar: (idDocumento: number) => del(`/documentos-pdf/${idDocumento}`),
};
