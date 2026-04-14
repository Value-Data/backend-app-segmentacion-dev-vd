import { get, post, put, del } from "./api";
import type { InventarioVivero, MovimientoInventario, InventarioStats, GuiaDespacho } from "@/types/inventario";

export interface BodegaStock {
  id_bodega: number;
  nombre: string;
  ubicacion: string;
  total_lotes: number;
  total_stock: number;
  lotes_disponibles: number;
}

export const inventarioService = {
  list: (skip = 0, limit = 1000) =>
    get<InventarioVivero[]>("/inventario", { skip, limit }),
  getById: (id: number) =>
    get<InventarioVivero>(`/inventario/${id}`),
  create: (data: Record<string, unknown>) =>
    post<InventarioVivero>("/inventario", data),
  update: (id: number, data: Record<string, unknown>) =>
    put<InventarioVivero>(`/inventario/${id}`, data),
  disponible: () =>
    get<InventarioVivero[]>("/inventario/disponible"),
  stats: () =>
    get<InventarioStats>("/inventario/stats"),
  porBodega: () =>
    get<BodegaStock[]>("/inventario/por-bodega"),
  kardex: (id: number) =>
    get<MovimientoInventario[]>(`/inventario/${id}/kardex`),
  movimientos: (id: number) =>
    get<MovimientoInventario[]>(`/inventario/${id}/movimientos`),
  crearMovimiento: (id: number, data: Record<string, unknown>) =>
    post<MovimientoInventario>(`/inventario/${id}/movimientos`, data),
  despacho: (data: Record<string, unknown>) =>
    post<GuiaDespacho>("/inventario/despacho", data),
  guias: () =>
    get<GuiaDespacho[]>("/guias-despacho"),
  guia: (id: number) =>
    get<GuiaDespacho>(`/guias-despacho/${id}`),
  destinos: (id: number) =>
    get<any[]>(`/inventario/${id}/destinos`),
  sinTestblock: () =>
    get<InventarioVivero[]>("/inventario/sin-testblock"),
  mediciones: (id: number) =>
    get<any[]>(`/inventario/${id}/mediciones`),
  remove: (id: number) =>
    del<{ detail: string }>(`/inventario/${id}`),
  qrUrl: (id: number) => {
    const base = import.meta.env.VITE_API_BASE_URL || "/api/v1";
    return `${base}/inventario/${id}/qr`;
  },
  qrBatch: (ids: number[]) =>
    post<Blob>("/inventario/qr-batch", ids),
  plantasSinLote: () =>
    get<any[]>("/inventario/plantas-sin-lote"),
  asignarLote: (id_lote: number, planta_ids: number[]) =>
    post<{ updated: number; message: string }>("/inventario/asignar-lote", { id_lote, planta_ids }),
};
