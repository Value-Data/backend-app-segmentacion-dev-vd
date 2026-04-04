import { get, post, put } from "./api";
import type { Usuario, Rol, AuditLog, Alerta, ReglaAlerta } from "@/types/sistema";
import type { PasswordChange } from "@/types/auth";

export const sistemaService = {
  usuarios: () => get<Usuario[]>("/sistema/usuarios"),
  crearUsuario: (data: Record<string, unknown>) =>
    post<Usuario>("/sistema/usuarios", data),
  updateUsuario: (id: number, data: Record<string, unknown>) =>
    put<Usuario>(`/sistema/usuarios/${id}`, data),
  changePassword: (id: number, data: PasswordChange) =>
    put<{ ok: boolean }>(`/sistema/usuarios/${id}/password`, data),
  roles: () => get<Rol[]>("/sistema/roles"),
  auditLog: (params?: { tabla?: string; fecha_desde?: string; skip?: number; limit?: number }) =>
    get<AuditLog[]>("/sistema/audit-log", params),
};

export const alertaService = {
  list: (params?: { estado?: string }) =>
    get<Alerta[]>("/alertas", params),
  resolver: (id: number, data: Record<string, unknown>) =>
    put<Alerta>(`/alertas/${id}/resolver`, data),
  reglas: () => get<ReglaAlerta[]>("/alertas/reglas"),
  crearRegla: (data: Record<string, unknown>) =>
    post<ReglaAlerta>("/alertas/reglas", data),
};
