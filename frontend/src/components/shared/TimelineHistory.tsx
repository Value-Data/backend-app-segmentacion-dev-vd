import { formatDate } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import type { HistorialPosicion } from "@/types/testblock";

interface TimelineHistoryProps {
  items: HistorialPosicion[];
}

export function TimelineHistory({ items }: TimelineHistoryProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">Sin historial</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((h) => (
        <div key={h.id_historial} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="h-2 w-2 rounded-full bg-garces-cherry mt-2" />
            <div className="w-px flex-1 bg-border" />
          </div>
          <div className="pb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium capitalize">{h.accion}</span>
              {h.estado_nuevo && <StatusBadge status={h.estado_nuevo} />}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(h.fecha)} - {h.usuario || "Sistema"}
            </p>
            {h.motivo && <p className="text-xs mt-1">{h.motivo}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
