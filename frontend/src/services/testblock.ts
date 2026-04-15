import { get, post, put, del, patch } from "./api";
import type { MapaTestBlockData } from "@/types/testblock";
import type {
  TestBlock,
  PosicionTestBlock,
  GrillaResponse,
  ResumenHilera,
  ResumenVariedad,
  HistorialPosicion,
} from "@/types/testblock";
import type { InventarioVivero, InventarioTestBlock } from "@/types/inventario";

export const testblockService = {
  list: () => get<TestBlock[]>("/testblocks"),
  getById: (id: number) => get<TestBlock>(`/testblocks/${id}`),
  create: (data: Record<string, unknown>) => post<TestBlock>("/testblocks", data),
  update: (id: number, data: Record<string, unknown>) => put<TestBlock>(`/testblocks/${id}`, data),
  remove: (id: number) => del<unknown>(`/testblocks/${id}`),

  generarPosiciones: (id: number, data?: Record<string, unknown>) =>
    post<{ count: number }>(`/testblocks/${id}/generar-posiciones`, data),
  posiciones: (id: number) =>
    get<PosicionTestBlock[]>(`/testblocks/${id}/posiciones`),
  grilla: (id: number) =>
    get<GrillaResponse>(`/testblocks/${id}/grilla`),
  resumenHileras: (id: number) =>
    get<ResumenHilera[]>(`/testblocks/${id}/resumen-hileras`),
  resumenVariedades: (id: number) =>
    get<ResumenVariedad[]>(`/testblocks/${id}/resumen-variedades`),

  alta: (id: number, data: Record<string, unknown>) =>
    post<unknown>(`/testblocks/${id}/alta`, data),
  altaMasiva: (id: number, data: Record<string, unknown>) =>
    post<unknown>(`/testblocks/${id}/alta-masiva`, data),
  baja: (id: number, data: Record<string, unknown>) =>
    post<unknown>(`/testblocks/${id}/baja`, data),
  bajaMasiva: (id: number, data: Record<string, unknown>) =>
    post<unknown>(`/testblocks/${id}/baja-masiva`, data),
  replante: (id: number, data: Record<string, unknown>) =>
    post<unknown>(`/testblocks/${id}/replante`, data),

  agregarHilera: (id: number, num_posiciones: number) =>
    post<{ count: number }>(`/testblocks/${id}/agregar-hilera`, { num_posiciones }),
  agregarPosiciones: (id: number, hilera: number, cantidad: number) =>
    post<{ count: number }>(`/testblocks/${id}/agregar-posiciones`, { hilera, cantidad }),

  reestructurar: (id: number, num_hileras: number, posiciones_por_hilera: number) =>
    post<{ posiciones_redistribuidas: number; posiciones_nuevas: number; total: number }>(
      `/testblocks/${id}/reestructurar`, { num_hileras, posiciones_por_hilera }
    ),

  eliminarHilera: (id: number, hilera: number) =>
    del<{ deleted: number; hilera: number }>(`/testblocks/${id}/eliminar-hilera/${hilera}`),
  eliminarPosiciones: (id: number, ids_posiciones: number[]) =>
    post<{ deleted: number }>(`/testblocks/${id}/eliminar-posiciones`, { ids_posiciones }),

  inventarioDisponible: (id: number) =>
    get<InventarioVivero[]>(`/testblocks/${id}/inventario-disponible`),
  inventarioTestblock: (id: number) =>
    get<InventarioTestBlock[]>(`/testblocks/${id}/inventario`),

  historial: (posicionId: number) =>
    get<HistorialPosicion[]>(`/posiciones/${posicionId}/historial`),
  historialTestblock: (tbId: number) =>
    get<(HistorialPosicion & { codigo_posicion?: string })[]>(`/testblocks/${tbId}/historial`),

  updateObservaciones: (posicionId: number, observaciones: string | null) =>
    patch<{ ok: boolean; observaciones: string | null }>(`/posiciones/${posicionId}/observaciones`, { observaciones }),
  updatePosicion: (posicionId: number, data: Record<string, unknown>) =>
    put<PosicionTestBlock>(`/posiciones/${posicionId}`, data),
  deletePosicion: (posicionId: number) =>
    del<{ detail: string }>(`/posiciones/${posicionId}`),

  getMapa: (id: number) =>
    get<MapaTestBlockData>(`/testblocks/${id}/mapa`),
  updateMapa: (id: number, data: Record<string, unknown>) =>
    put<{ ok: boolean }>(`/testblocks/${id}/mapa`, data),

  // -- Lotes desde TestBlock --
  crearLote: (id: number, data: Record<string, unknown>) =>
    post<{ lote_id: number; codigo_lote: string; plantas_creadas: number; message: string }>(
      `/testblocks/${id}/crear-lote`, data,
    ),
  seedLotesDemo: () =>
    post<{ lotes_creados: number; plantas_vinculadas: number; detalles: unknown[]; message: string }>(
      `/testblocks/demo/seed-lotes`,
    ),
  cambiarEtapa: (id: number, data: { etapa: string; posicion_ids?: number[]; id_lote?: number }) =>
    put<{ updated: number; etapa: string; message: string }>(`/testblocks/${id}/etapa`, data),

  lotesTestblock: (id: number) =>
    get<{
      id_inventario: number; codigo_lote: string; id_variedad: number | null;
      id_portainjerto: number | null; tipo_planta: string | null;
      cantidad_inicial: number; cantidad_actual: number; estado: string | null;
      posiciones_en_tb: number; fecha_ingreso: string | null; observaciones: string | null;
    }[]>(`/testblocks/${id}/lotes`),
};
