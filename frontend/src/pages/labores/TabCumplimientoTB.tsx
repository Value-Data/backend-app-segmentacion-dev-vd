import { useQuery } from "@tanstack/react-query";
import { ordenesTrabajoService } from "@/services/ordenesTrabajo";
import { Loader2 } from "lucide-react";

interface TabCumplimientoTBProps {
  temporada?: string;
}

interface LaborStats {
  total: number;
  completadas: number;
  parciales: number;
  no_realizadas: number;
  pct: number;
}

interface CumplimientoRow {
  id_testblock: number;
  testblock: string;
  labores: Record<string, LaborStats>;
}

interface CumplimientoResponse {
  rows: CumplimientoRow[];
  labor_names: string[];
}

function pctColor(pct: number): string {
  if (pct >= 80) return "bg-green-100 text-green-800";
  if (pct >= 40) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function pctBarColor(pct: number): string {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export function TabCumplimientoTB({ temporada = "2025-2026" }: TabCumplimientoTBProps) {
  const { data, isLoading } = useQuery<CumplimientoResponse>({
    queryKey: ["ordenes-trabajo", "cumplimiento-tb", temporada],
    queryFn: () => ordenesTrabajoService.cumplimientoTb({ temporada }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-garces-cherry" />
      </div>
    );
  }

  const rows = data?.rows || [];
  const laborNames = data?.labor_names || [];

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10">
        No hay datos de cumplimiento para la temporada {temporada}.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left p-2 font-semibold text-xs text-muted-foreground min-w-[160px] sticky left-0 bg-gray-50 z-10">
              TestBlock
            </th>
            {laborNames.map((name) => (
              <th key={name} className="text-center p-2 font-semibold text-xs text-muted-foreground min-w-[130px]">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id_testblock} className="border-b hover:bg-gray-50/50">
              <td className="p-2 font-medium text-sm sticky left-0 bg-white z-10">
                {row.testblock}
              </td>
              {laborNames.map((laborName) => {
                const stats = row.labores[laborName];
                if (!stats || stats.total === 0) {
                  return (
                    <td key={laborName} className="p-2 text-center text-xs text-muted-foreground">
                      -
                    </td>
                  );
                }
                return (
                  <td key={laborName} className="p-2">
                    <div className={`rounded-md px-2 py-1.5 text-center ${pctColor(stats.pct)}`}>
                      {/* Progress bar */}
                      <div className="w-full bg-white/50 rounded-full h-1.5 mb-1">
                        <div
                          className={`h-1.5 rounded-full ${pctBarColor(stats.pct)}`}
                          style={{ width: `${Math.min(stats.pct, 100)}%` }}
                        />
                      </div>
                      <div className="text-xs font-bold">{stats.pct}%</div>
                      <div className="text-[10px]">
                        {stats.completadas}/{stats.total}
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
