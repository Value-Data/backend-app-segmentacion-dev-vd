import { get, post } from "./api";

export interface RelacionEspecie {
  id_especie: number;
  especie_nombre: string | null;
  especie_color_hex: string | null;
}

export interface RelacionPmg {
  id_pmg: number;
  pmg_nombre: string | null;
  pmg_codigo: string | null;
}

// Portainjerto <-> Especies
export function getPortainjertoEspecies(id: number) {
  return get<RelacionEspecie[]>(`/relaciones/portainjerto/${id}/especies`);
}

export function setPortainjertoEspecies(id: number, ids: number[]) {
  return post<RelacionEspecie[]>(`/relaciones/portainjerto/${id}/especies`, { ids });
}

// Vivero <-> PMGs
export function getViveroPmgs(id: number) {
  return get<RelacionPmg[]>(`/relaciones/vivero/${id}/pmgs`);
}

export function setViveroPmgs(id: number, ids: number[]) {
  return post<RelacionPmg[]>(`/relaciones/vivero/${id}/pmgs`, { ids });
}

// PMG <-> Especies
export function getPmgEspecies(id: number) {
  return get<RelacionEspecie[]>(`/relaciones/pmg/${id}/especies`);
}

export function setPmgEspecies(id: number, ids: number[]) {
  return post<RelacionEspecie[]>(`/relaciones/pmg/${id}/especies`, { ids });
}
