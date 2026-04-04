import { Flower2 } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export function FenologiaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-garces-cherry">Fenologia</h2>
        <p className="text-sm text-muted-foreground">Registro de estados fenologicos por planta y temporada</p>
      </div>
      <EmptyState
        icon={Flower2}
        title="Modulo en desarrollo"
        description="El registro fenologico estara disponible proximamente. Aqui podras registrar y visualizar los estados fenologicos de cada planta por temporada."
      />
    </div>
  );
}
