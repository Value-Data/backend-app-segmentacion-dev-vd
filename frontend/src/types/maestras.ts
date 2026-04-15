// Base interface for all master entities
export interface BaseEntity {
  activo?: boolean;
  fecha_creacion?: string;
  fecha_modificacion?: string | null;
  usuario_creacion?: string | null;
  usuario_modificacion?: string | null;
}

export interface Pais extends BaseEntity {
  id_pais: number;
  codigo: string;
  nombre: string;
  nombre_en?: string | null;
  orden: number;
}

export interface Campo extends BaseEntity {
  id_campo: number;
  codigo: string;
  nombre: string;
  ubicacion?: string | null;
  comuna?: string | null;
  region?: string | null;
  direccion?: string | null;
  hectareas?: number | null;
  latitud?: number | null;
  longitud?: number | null;
}

export interface Cuartel extends BaseEntity {
  id_cuartel: number;
  id_campo?: number | null;
  codigo?: string | null;
  nombre?: string | null;
}

export interface Especie extends BaseEntity {
  id_especie: number;
  codigo: string;
  nombre: string;
  nombre_cientifico?: string | null;
  emoji?: string | null;
  color_hex?: string | null;
}

export interface Portainjerto extends BaseEntity {
  id_portainjerto: number;
  codigo: string;
  nombre: string;
  vigor?: string | null;
  compatibilidad?: string | null;
  origen?: string | null;
  cruce?: string | null;
  especie?: string | null;
  tipo?: string | null;
  patron?: string | null;
  propagacion?: string | null;
  obtentor?: string | null;
  sensibilidad?: string | null;
  susceptibilidades?: string | null;
  ventajas?: string | null;
  notas?: string | null;
}

export interface Pmg extends BaseEntity {
  id_pmg: number;
  codigo: string;
  nombre: string;
  licenciante?: string | null;
  pais_origen?: string | null;
  pais?: string | null;
  ciudad?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  contacto?: string | null;
  notas?: string | null;
  viveros_chile?: string | null;
}

export interface Origen extends BaseEntity {
  id_origen: number;
  codigo: string;
  nombre: string;
  pais?: string | null;
  tipo?: string | null;
  contacto?: string | null;
  notas?: string | null;
}

export interface Vivero extends BaseEntity {
  id_vivero: number;
  codigo: string;
  nombre: string;
  id_pmg?: number | null;
  representante?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  comuna?: string | null;
  region?: string | null;
}

export interface Color extends BaseEntity {
  id_color: number;
  codigo?: string | null;
  nombre: string;
  tipo: string;
  aplica_especie?: string | null;
  color_hex?: string | null;
}

export interface Susceptibilidad extends BaseEntity {
  id_suscept: number;
  codigo: string;
  nombre: string;
  nombre_en?: string | null;
  descripcion?: string | null;
  categoria?: string | null;
  severidad?: string | null;
  orden: number;
}

export interface TipoLabor extends BaseEntity {
  id_labor: number;
  codigo: string;
  nombre: string;
  categoria?: string | null;
  descripcion?: string | null;
  aplica_especies?: string | null;
  aplica_a?: string | null;
  frecuencia?: string | null;
}

export interface EstadoPlanta extends BaseEntity {
  id_estado: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  color_hex?: string | null;
  icono?: string | null;
  requiere_foto: boolean;
  es_final: boolean;
  orden: number;
}

export interface Temporada extends BaseEntity {
  id_temporada: number;
  codigo: string;
  nombre: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  estado?: string | null;
  notas?: string | null;
}

export interface Bodega extends BaseEntity {
  id_bodega: number;
  codigo?: string | null;
  nombre?: string | null;
  ubicacion?: string | null;
  responsable?: string | null;
}

export interface Variedad extends BaseEntity {
  id_variedad: number;
  id_especie?: number | null;
  id_pmg?: number | null;
  id_origen?: number | null;
  codigo: string;
  nombre: string;
  nombre_corto?: string | null;
  nombre_comercial?: string | null;
  tipo?: string | null;
  origen?: string | null;
  anio_introduccion?: number | null;
  epoca_cosecha?: string | null;
  epoca?: string | null;
  vigor?: string | null;
  req_frio_horas?: number | null;
  req_frio?: string | null;
  color_fruto?: string | null;
  color_pulpa?: string | null;
  id_color_fruto?: number | null;
  id_color_pulpa?: number | null;
  id_color_cubrimiento?: number | null;
  calibre_esperado?: number | null;
  firmeza_esperada?: number | null;
  susceptibilidad?: string | null;
  estado?: string | null;
  fecha_ultima_visita?: string | null;
  proxima_accion?: string | null;
  observaciones?: string | null;
  alelos?: string | null;
  auto_fertil?: boolean | null;
}

