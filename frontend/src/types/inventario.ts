export interface InventarioVivero {
  id_inventario: number;
  codigo_lote: string;
  id_variedad?: number | null;
  id_portainjerto?: number | null;
  id_vivero?: number | null;
  id_especie?: number | null;
  id_pmg?: number | null;
  id_bodega?: number | null;
  tipo_planta?: string | null;
  tipo_injertacion?: string | null;
  tipo_patron?: string | null;
  ubicacion?: string | null;
  cantidad_inicial: number;
  cantidad_actual: number;
  cantidad_minima: number;
  cantidad_comprometida?: number;
  fecha_ingreso: string;
  ano_plantacion?: number | null;
  origen?: string | null;
  estado: string;
  observaciones?: string | null;
  fecha_creacion?: string;
  fecha_modificacion?: string | null;
}

export interface MovimientoInventario {
  id_movimiento: number;
  id_inventario: number;
  id_planta?: number | null;
  tipo: string;
  cantidad: number;
  saldo_anterior?: number | null;
  saldo_nuevo?: number | null;
  motivo?: string | null;
  referencia_destino?: string | null;
  usuario?: string | null;
  fecha_movimiento: string;
}

export interface InventarioStats {
  total_lotes: number;
  total_stock: number;
  lotes_disponibles: number;
  lotes_agotados: number;
}

export interface GuiaDespacho {
  id_guia: number;
  numero_guia?: string | null;
  id_bodega_origen?: number | null;
  id_testblock_destino?: number | null;
  estado: string;
  total_plantas?: number | null;
  responsable?: string | null;
  motivo?: string | null;
  usuario?: string | null;
  fecha_creacion: string;
}

export interface InventarioTestBlock {
  id_inventario_tb: number;
  id_inventario: number;
  id_cuartel: number;
  codigo_lote: string | null;
  variedad: string | null;
  portainjerto: string | null;
  cantidad_asignada: number;
  cantidad_plantada: number;
  disponible: number;
  estado: string;
  fecha_despacho: string | null;
  fecha_completado: string | null;
  observaciones: string | null;
}
