import { StatusBadge } from "./StatusBadge";
import type { PosicionTestBlock } from "@/types/testblock";

interface PlantCardProps {
  posicion: PosicionTestBlock;
  variedadName?: string;
  portainjertoName?: string;
}

export function PlantCard({ posicion, variedadName, portainjertoName }: PlantCardProps) {
  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">{posicion.codigo_unico}</h4>
        <StatusBadge status={posicion.estado} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Variedad:</span>
          <p className="font-medium">{variedadName || "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Portainjerto:</span>
          <p className="font-medium">{portainjertoName || "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Hilera:</span>
          <p className="font-medium">H{posicion.hilera}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Posicion:</span>
          <p className="font-medium">P{posicion.posicion}</p>
        </div>
        {posicion.fecha_alta && (
          <div>
            <span className="text-muted-foreground">Fecha alta:</span>
            <p className="font-medium">{new Date(posicion.fecha_alta).toLocaleDateString("es-CL")}</p>
          </div>
        )}
        {posicion.cluster_actual != null && (
          <div>
            <span className="text-muted-foreground">Cluster:</span>
            <p className="font-medium">{posicion.cluster_actual}</p>
          </div>
        )}
      </div>
      {posicion.observaciones && (
        <p className="text-xs text-muted-foreground italic">{posicion.observaciones}</p>
      )}
    </div>
  );
}
