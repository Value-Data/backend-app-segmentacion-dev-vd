import { get, post, put, del } from "./api";

export function mantenedorService(entidad: string) {
  return {
    list: (params?: Record<string, string | number | boolean | undefined | null>) =>
      get<unknown[]>(`/mantenedores/${entidad}`, params),
    getById: (id: number) => get<unknown>(`/mantenedores/${entidad}/${id}`),
    create: (data: Record<string, unknown>) => post<unknown>(`/mantenedores/${entidad}`, data),
    update: (id: number, data: Record<string, unknown>) => put<unknown>(`/mantenedores/${entidad}/${id}`, data),
    remove: (id: number) => del<unknown>(`/mantenedores/${entidad}/${id}`),
  };
}

export const variedadSusceptService = {
  list: (variedadId: number) =>
    get<unknown[]>(`/mantenedores/variedades/${variedadId}/susceptibilidades`),
  add: (variedadId: number, data: Record<string, unknown>) =>
    post<unknown>(`/mantenedores/variedades/${variedadId}/susceptibilidades`, data),
};

export interface BitacoraEntry {
  id_entrada: number;
  id_variedad: number;
  tipo_entrada?: string | null;
  fecha?: string | null;
  titulo?: string | null;
  contenido?: string | null;
  resultado?: string | null;
  id_testblock?: number | null;
  ubicacion?: string | null;
  usuario?: string | null;
  fecha_creacion?: string;
}

export const variedadBitacoraService = {
  list: (variedadId: number) =>
    get<BitacoraEntry[]>(`/mantenedores/variedades/${variedadId}/bitacora`),
  add: (variedadId: number, data: Record<string, unknown>) =>
    post<BitacoraEntry>(`/mantenedores/variedades/${variedadId}/bitacora`, data),
  update: (variedadId: number, entryId: number, data: Record<string, unknown>) =>
    put<BitacoraEntry>(`/mantenedores/variedades/${variedadId}/bitacora/${entryId}`, data),
};
