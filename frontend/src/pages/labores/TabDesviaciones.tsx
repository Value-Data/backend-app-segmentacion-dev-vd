import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { ordenesTrabajoService } from "@/services/ordenesTrabajo";
import { humanize } from "@/lib/utils";
import { Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface TabDesviacionesProps {
  temporada?: string;
}

interface DesviacionesData {
  total: number;
  segun_plan: number;
  parciales: number;
  no_realizadas: number;
  reprogramadas: number;
  pct_segun_plan: number;
  pct_parciales: number;
  pct_no_realizadas: number;
  motivos: { motivo: string; count: number }[];
}

export function TabDesviaciones({ temporada = "2025-2026" }: TabDesviacionesProps) {
  const { data, isLoading } = useQuery<DesviacionesData>({
    queryKey: ["ordenes-trabajo", "desviaciones", temporada],
    queryFn: () => ordenesTrabajoService.desviaciones({ temporada }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-garces-cherry" />
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">
          No hay datos de ejecucion. Cree y ejecute ordenes de trabajo para ver analisis.
        </p>
      </div>
    );
  }

  const motivosChart = (data.motivos || []).map((m) => ({
    motivo: humanize(m.motivo),
    count: m.count,
  }));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Segun Plan */}
        <div className="bg-white rounded-lg border border-green-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Segun Plan</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{data.segun_plan}</p>
              <p className="text-sm text-green-600 mt-0.5">{data.pct_segun_plan}% del total</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>

        {/* Parciales */}
        <div className="bg-white rounded-lg border border-amber-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Parciales</p>
              <p className="text-3xl font-bold text-amber-700 mt-1">{data.parciales}</p>
              <p className="text-sm text-amber-600 mt-0.5">{data.pct_parciales}% del total</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </div>

        {/* No Realizadas */}
        <div className="bg-white rounded-lg border border-red-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">No Realizadas</p>
              <p className="text-3xl font-bold text-red-700 mt-1">{data.no_realizadas}</p>
              <p className="text-sm text-red-600 mt-0.5">{data.pct_no_realizadas}% del total</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Summary line */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Total evaluadas: <strong className="text-foreground">{data.total}</strong></span>
        {data.reprogramadas > 0 && (
          <span>Reprogramadas: <strong className="text-foreground">{data.reprogramadas}</strong></span>
        )}
      </div>

      {/* Motivos bar chart */}
      {motivosChart.length > 0 && (
        <div className="bg-white rounded-lg border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-garces-cherry mb-3">
            Motivos de Desviacion
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(200, motivosChart.length * 40 + 40)}>
            <BarChart data={motivosChart} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="motivo"
                tick={{ fontSize: 11 }}
                width={160}
              />
              <RechartsTooltip />
              <Bar dataKey="count" name="Cantidad" fill="#8B1A1A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
