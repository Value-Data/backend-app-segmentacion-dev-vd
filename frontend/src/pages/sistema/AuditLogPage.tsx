import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrudTable } from "@/components/shared/CrudTable";
import { sistemaService } from "@/services/sistema";
import { formatDate } from "@/lib/utils";

const columns = [
  { accessorKey: "id_log", header: "ID" },
  { accessorKey: "tabla", header: "Tabla" },
  { accessorKey: "registro_id", header: "Registro" },
  { accessorKey: "accion", header: "Accion" },
  { accessorKey: "usuario", header: "Usuario" },
  { accessorKey: "ip_address", header: "IP" },
  { accessorKey: "fecha", header: "Fecha", cell: ({ getValue }: any) => formatDate(getValue() as string) },
];

export function AuditLogPage() {
  const navigate = useNavigate();
  const [tabla, setTabla] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["sistema", "audit-log", tabla, fechaDesde],
    queryFn: () =>
      sistemaService.auditLog({
        tabla: tabla || undefined,
        fecha_desde: fechaDesde || undefined,
        limit: 200,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sistema/usuarios")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-bold text-garces-cherry">Audit Log</h2>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground">Tabla</label>
          <Input
            className="mt-1 w-48"
            placeholder="Ej: plantas"
            value={tabla}
            onChange={(e) => setTabla(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Desde</label>
          <Input
            type="date"
            className="mt-1 w-48"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
        </div>
      </div>

      <CrudTable
        data={logs || []}
        columns={columns as any}
        isLoading={isLoading}
        searchPlaceholder="Buscar en logs..."
        pageSize={25}
      />
    </div>
  );
}
