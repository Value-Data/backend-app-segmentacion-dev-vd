import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CrudTable } from "@/components/shared/CrudTable";
import { CrudForm } from "@/components/shared/CrudForm";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { alertaService } from "@/services/sistema";
import { formatDate } from "@/lib/utils";
import type { FieldDef } from "@/types";
import type { Alerta } from "@/types/sistema";

const PRIORIDAD_ICON: Record<string, string> = {
  alta: "text-red-500",
  media: "text-yellow-500",
  baja: "text-blue-500",
};

const alertaColumns = [
  { accessorKey: "id_alerta", header: "ID" },
  {
    accessorKey: "prioridad",
    header: "Prioridad",
    cell: ({ getValue }: any) => {
      const p = getValue() as string;
      return <span className={`font-medium ${PRIORIDAD_ICON[p] || ""}`}>{p}</span>;
    },
  },
  { accessorKey: "titulo", header: "Titulo" },
  { accessorKey: "tipo_alerta", header: "Tipo" },
  {
    accessorKey: "id_posicion",
    header: "Posicion",
    cell: ({ getValue }: any) => {
      const v = getValue();
      return v != null ? `Pos #${v}` : "-";
    },
  },
  {
    accessorKey: "estado",
    header: "Estado",
    cell: ({ getValue }: any) => <StatusBadge status={getValue() as string} />,
  },
  { accessorKey: "valor_detectado", header: "Valor" },
  { accessorKey: "umbral_violado", header: "Umbral" },
  { accessorKey: "fecha_creacion", header: "Fecha", cell: ({ getValue }: any) => formatDate(getValue() as string) },
];

const reglaColumns = [
  { accessorKey: "id_regla", header: "ID" },
  { accessorKey: "codigo", header: "Codigo" },
  { accessorKey: "nombre", header: "Nombre" },
  { accessorKey: "tipo", header: "Tipo" },
  { accessorKey: "prioridad_resultado", header: "Prioridad" },
  {
    accessorKey: "activo",
    header: "Activo",
    cell: ({ getValue }: any) => (getValue() ? "Si" : "No"),
  },
];

const resolverFields: FieldDef[] = [
  { key: "notas_resolucion", label: "Notas de Resolucion", type: "textarea", required: true },
];

const reglaFields: FieldDef[] = [
  { key: "codigo", label: "Codigo", type: "text", required: true },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "descripcion", label: "Descripcion", type: "textarea" },
  { key: "tipo", label: "Tipo", type: "text" },
  { key: "condicion", label: "Condicion (SQL/expresion)", type: "textarea" },
  {
    key: "prioridad_resultado",
    label: "Prioridad",
    type: "select",
    options: [
      { value: "alta", label: "Alta" },
      { value: "media", label: "Media" },
      { value: "baja", label: "Baja" },
    ],
  },
];

export function AlertasPage() {
  const queryClient = useQueryClient();
  const [resolverOpen, setResolverOpen] = useState(false);
  const [reglaOpen, setReglaOpen] = useState(false);
  const [selectedAlerta, setSelectedAlerta] = useState<Alerta | null>(null);

  const { data: activas, isLoading: loadingActivas } = useQuery({
    queryKey: ["alertas", "activa"],
    queryFn: () => alertaService.list({ estado: "activa" }),
  });

  const { data: resueltas, isLoading: loadingResueltas } = useQuery({
    queryKey: ["alertas", "resuelta"],
    queryFn: () => alertaService.list({ estado: "resuelta" }),
  });

  const { data: reglas, isLoading: loadingReglas } = useQuery({
    queryKey: ["alertas", "reglas"],
    queryFn: () => alertaService.reglas(),
  });

  const resolverMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      alertaService.resolver(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas"] });
      toast.success("Alerta resuelta");
    },
  });

  const crearReglaMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => alertaService.crearRegla(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas", "reglas"] });
      toast.success("Regla creada");
    },
  });

  const totalActivas = activas?.length ?? 0;
  const altas = activas?.filter((a) => a.prioridad === "alta").length ?? 0;
  const medias = activas?.filter((a) => a.prioridad === "media").length ?? 0;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-garces-cherry">Alertas</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard title="Alertas Activas" value={totalActivas} icon={Bell} />
        <KpiCard title="Prioridad Alta" value={altas} icon={ShieldAlert} />
        <KpiCard title="Prioridad Media" value={medias} icon={AlertTriangle} />
        <KpiCard title="Resueltas" value={resueltas?.length ?? 0} icon={CheckCircle2} />
      </div>

      <Tabs defaultValue="activas">
        <TabsList>
          <TabsTrigger value="activas">Activas ({totalActivas})</TabsTrigger>
          <TabsTrigger value="resueltas">Resueltas</TabsTrigger>
          <TabsTrigger value="reglas">Reglas</TabsTrigger>
        </TabsList>

        <TabsContent value="activas">
          <CrudTable
            data={activas || []}
            columns={alertaColumns as any}
            isLoading={loadingActivas}
            onEdit={(row) => {
              setSelectedAlerta(row as unknown as Alerta);
              setResolverOpen(true);
            }}
            searchPlaceholder="Buscar alerta..."
          />
        </TabsContent>

        <TabsContent value="resueltas">
          <CrudTable
            data={resueltas || []}
            columns={[
              ...alertaColumns,
              { accessorKey: "usuario_resolucion", header: "Resuelto por" },
              { accessorKey: "fecha_resolucion", header: "Fecha Resol.", cell: ({ getValue }: any) => formatDate(getValue() as string) },
            ] as any}
            isLoading={loadingResueltas}
          />
        </TabsContent>

        <TabsContent value="reglas">
          <CrudTable
            data={reglas || []}
            columns={reglaColumns as any}
            isLoading={loadingReglas}
            onCreate={() => setReglaOpen(true)}
            createLabel="Nueva Regla"
          />
        </TabsContent>
      </Tabs>

      <CrudForm
        open={resolverOpen}
        onClose={() => { setResolverOpen(false); setSelectedAlerta(null); }}
        onSubmit={async (data) => {
          if (!selectedAlerta) return;
          await resolverMut.mutateAsync({ id: selectedAlerta.id_alerta, data });
        }}
        fields={resolverFields}
        title={`Resolver Alerta: ${selectedAlerta?.titulo ?? ""}`}
        isLoading={resolverMut.isPending}
      />

      <CrudForm
        open={reglaOpen}
        onClose={() => setReglaOpen(false)}
        onSubmit={async (data) => { await crearReglaMut.mutateAsync(data); }}
        fields={reglaFields}
        title="Nueva Regla de Alerta"
        isLoading={crearReglaMut.isPending}
      />
    </div>
  );
}
