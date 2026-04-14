import { useQuery } from "@tanstack/react-query";
import { ordenesTrabajoService } from "@/services/ordenesTrabajo";
import type { KanbanData, OrdenTrabajo } from "@/services/ordenesTrabajo";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface TabKanbanProps {
  testblockFilter?: number;
}

const COLUMN_CONFIG: {
  key: keyof KanbanData;
  label: string;
  bg: string;
  border: string;
}[] = [
  { key: "planificadas", label: "Planificadas", bg: "bg-gray-50", border: "border-gray-200" },
  { key: "en_progreso", label: "En Progreso", bg: "bg-blue-50", border: "border-blue-200" },
  { key: "completadas", label: "Completadas", bg: "bg-green-50", border: "border-green-200" },
  { key: "parciales", label: "Parciales", bg: "bg-amber-50", border: "border-amber-200" },
  { key: "atrasadas", label: "Atrasadas", bg: "bg-red-50", border: "border-red-200" },
  { key: "no_realizadas", label: "No Realizadas", bg: "bg-gray-100", border: "border-gray-300" },
];

const PRIORIDAD_BORDER: Record<string, string> = {
  alta: "border-l-red-500",
  media: "border-l-amber-500",
  baja: "border-l-green-500",
};

function OtCard({ ot }: { ot: OrdenTrabajo }) {
  const borderColor = PRIORIDAD_BORDER[ot.prioridad] || "border-l-gray-300";

  return (
    <div
      className={`bg-white rounded-md border border-l-4 ${borderColor} p-3 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-garces-cherry">{ot.codigo}</span>
        <StatusBadge status={ot.prioridad} />
      </div>
      <p className="text-sm font-medium truncate">{ot.tipo_labor_nombre || "-"}</p>
      <p className="text-xs text-muted-foreground truncate">{ot.testblock_nombre || "-"}</p>
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>
          {ot.posiciones_ejecutadas ?? 0}/{ot.posiciones_total} pos
        </span>
        <span>
          {formatDate(ot.fecha_plan_inicio)} - {formatDate(ot.fecha_plan_fin)}
        </span>
      </div>
      {ot.responsable_nombre && (
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {ot.responsable_nombre}
        </p>
      )}
    </div>
  );
}

export function TabKanban({ testblockFilter }: TabKanbanProps) {
  const { data, isLoading } = useQuery<KanbanData>({
    queryKey: ["ordenes-trabajo", "kanban", testblockFilter],
    queryFn: () =>
      ordenesTrabajoService.kanban(
        testblockFilter ? { testblock: testblockFilter } : undefined,
      ),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-garces-cherry" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10">
        No hay datos disponibles.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-[1200px]">
        {COLUMN_CONFIG.map((col) => {
          const items = data[col.key] || [];
          return (
            <div
              key={col.key}
              className={`flex-1 min-w-[190px] rounded-lg border ${col.border} ${col.bg} p-3`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <span className="inline-flex items-center justify-center rounded-full bg-white border text-xs font-bold min-w-[22px] h-[22px] px-1.5">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Sin ordenes
                  </p>
                ) : (
                  items.map((ot) => <OtCard key={ot.id} ot={ot} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
