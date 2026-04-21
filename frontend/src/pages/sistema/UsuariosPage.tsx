import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, ShieldCheck, Key } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CrudTable } from "@/components/shared/CrudTable";
import { CrudForm } from "@/components/shared/CrudForm";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { sistemaService } from "@/services/sistema";
import { formatDate } from "@/lib/utils";
import type { FieldDef } from "@/types";
import type { Usuario } from "@/types/sistema";
import { useAuthStore } from "@/stores/authStore";
import { useNavigate } from "react-router-dom";

const userColumns = [
  { accessorKey: "id_usuario", header: "ID" },
  { accessorKey: "username", header: "Usuario" },
  { accessorKey: "nombre_completo", header: "Nombre" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "rol", header: "Rol" },
  {
    accessorKey: "activo",
    header: "Estado",
    cell: ({ row, getValue }: any) => {
      const activo = getValue();
      const ultimoAcceso = row.original?.ultimo_acceso;
      // Usuario activo pero nunca se logueó → pendiente (no terminó onboarding)
      if (activo && !ultimoAcceso) return <StatusBadge status="pendiente" />;
      return <StatusBadge status={activo ? "activo" : "inactivo"} />;
    },
  },
  { accessorKey: "ultimo_acceso", header: "Último Acceso", cell: ({ getValue }: any) => formatDate(getValue() as string) },
];

const createFields: FieldDef[] = [
  { key: "username", label: "Usuario", type: "text", required: true, placeholder: "ej: juan.perez" },
  { key: "nombre_completo", label: "Nombre Completo", type: "text", required: true },
  { key: "email", label: "Email", type: "text", required: true, placeholder: "usuario@garcesfruit.cl" },
  { key: "password", label: "Contraseña", type: "password", required: true, placeholder: "Mínimo 8 caracteres" },
  {
    key: "rol",
    label: "Rol",
    type: "select",
    required: true,
    options: [
      { value: "admin", label: "Admin (todo el sistema)" },
      { value: "agronomo", label: "Agrónomo (labores + fenología)" },
      { value: "laboratorio", label: "Laboratorio (mediciones + clasif.)" },
      { value: "operador", label: "Operador (bitácora + ejecución labores)" },
      { value: "visualizador", label: "Visualizador (solo lectura)" },
    ],
  },
  { key: "campos_asignados", label: "Campos Asignados (IDs separados por coma)", type: "text", placeholder: "Ej: 1,3,5 — en blanco = todos los campos" },
];

// Edit: sin password, con toggle activo (S-11)
const editFields: FieldDef[] = [
  ...createFields.filter((f) => f.key !== "password").map((f) =>
    f.key === "username" ? { ...f, disabled: true } : f,
  ),
  { key: "activo", label: "Activo", type: "boolean" },
];

const passwordFields: FieldDef[] = [
  { key: "new_password", label: "Nueva Contraseña", type: "password", required: true, placeholder: "Mínimo 8 caracteres" },
];

export function UsuariosPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.rol === "admin";

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["sistema", "usuarios"],
    queryFn: () => sistemaService.usuarios(),
  });

  const { data: roles } = useQuery({
    queryKey: ["sistema", "roles"],
    queryFn: () => sistemaService.roles(),
  });

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => sistemaService.crearUsuario(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sistema", "usuarios"] });
      toast.success("Usuario creado");
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      sistemaService.updateUsuario(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sistema", "usuarios"] });
      toast.success("Usuario actualizado");
    },
  });

  const pwdMut = useMutation({
    mutationFn: ({ id, pwd }: { id: number; pwd: string }) =>
      sistemaService.changePassword(id, { new_password: pwd }),
    onSuccess: () => {
      toast.success("Contraseña cambiada");
    },
  });

  const activos = usuarios?.filter((u) => u.activo !== false).length ?? 0;
  const admins = usuarios?.filter((u) => u.rol === "admin").length ?? 0;
  // S-21: KPIs más útiles. Pendientes = activos sin último acceso (onboarding incompleto).
  // Inactivos30 = sin login en 30 días (estimado).
  const pendientes = usuarios?.filter((u) => u.activo !== false && !u.ultimo_acceso).length ?? 0;
  const inactivos30 = usuarios?.filter((u) => {
    if (u.activo === false || !u.ultimo_acceso) return false;
    try {
      const d = new Date(u.ultimo_acceso);
      return (Date.now() - d.getTime()) > 30 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-garces-cherry">Sistema</h2>
        <Button variant="outline" size="sm" onClick={() => navigate("/sistema/audit-log")}>
          Ver Audit Log
        </Button>
      </div>

      {/* KPIs (S-21) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard title="Total" value={usuarios?.length ?? 0} icon={Users} />
        <KpiCard title="Administradores" value={admins} icon={Key} />
        <KpiCard
          title="Pendientes"
          value={pendientes}
          icon={ShieldCheck}
          trend="nunca iniciaron sesión"
        />
        <KpiCard
          title="Inactivos 30 días"
          value={inactivos30}
          icon={ShieldCheck}
          trend="sin login reciente"
        />
      </div>

      <CrudTable
        data={usuarios || []}
        columns={userColumns as any}
        isLoading={isLoading}
        onCreate={isAdmin ? () => setCreateOpen(true) : undefined}
        createLabel="Nuevo Usuario"
        onEdit={isAdmin ? (row) => {
          setSelectedUser(row as unknown as Usuario);
          setEditOpen(true);
        } : undefined}
        searchPlaceholder="Buscar usuario..."
      />

      {/* Create */}
      <CrudForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (data) => { await createMut.mutateAsync(data); }}
        fields={createFields}
        title="Nuevo Usuario"
        isLoading={createMut.isPending}
      />

      {/* Edit */}
      <CrudForm
        open={editOpen}
        onClose={() => { setEditOpen(false); setSelectedUser(null); }}
        onSubmit={async (data) => {
          if (!selectedUser) return;
          await updateMut.mutateAsync({ id: selectedUser.id_usuario, data });
        }}
        fields={editFields}
        title={`Editar: ${selectedUser?.nombre_completo ?? selectedUser?.username ?? ""}`}
        isLoading={updateMut.isPending}
        initialData={selectedUser as unknown as Record<string, unknown>}
      />

      {/* Password change */}
      <CrudForm
        open={pwdOpen}
        onClose={() => { setPwdOpen(false); setSelectedUser(null); }}
        onSubmit={async (data) => {
          if (!selectedUser) return;
          await pwdMut.mutateAsync({ id: selectedUser.id_usuario, pwd: String(data.new_password) });
        }}
        fields={passwordFields}
        title={`Cambiar Contraseña: ${selectedUser?.username ?? ""}`}
        isLoading={pwdMut.isPending}
      />
    </div>
  );
}
