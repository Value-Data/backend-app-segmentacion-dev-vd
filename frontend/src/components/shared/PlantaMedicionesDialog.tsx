import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Loader2, FlaskConical, TrendingUp } from "lucide-react";
import { laboratorioService } from "@/services/laboratorio";
import type { MedicionLaboratorio } from "@/types/laboratorio";

interface Props {
  open: boolean;
  onClose: () => void;
  plantaId: number | null;
  plantaCodigo?: string | null;
  plantaVariedad?: string;
  clusterActual?: number | null;
}

const CLUSTER_COLORS: Record<number, string> = {
  1: "#10b981", // emerald
  2: "#3b82f6", // blue
  3: "#f59e0b", // amber
  4: "#ef4444", // red
};

const CLUSTER_LABELS: Record<number, string> = {
  1: "Premium",
  2: "Bueno",
  3: "Regular",
  4: "Bajo",
};

export function PlantaMedicionesDialog({
  open,
  onClose,
  plantaId,
  plantaCodigo,
  plantaVariedad,
  clusterActual,
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["planta-mediciones", plantaId],
    queryFn: () => laboratorioService.medicionesByPlanta(plantaId!),
    enabled: open && plantaId != null,
  });

  const mediciones = data ?? [];

  // Sort by date ascending for charts
  const sorted = [...mediciones].sort(
    (a, b) => (a.fecha_medicion || "").localeCompare(b.fecha_medicion || ""),
  );

  const chartData = sorted.map((m: MedicionLaboratorio & { cluster?: number | null }) => ({
    fecha: m.fecha_medicion?.slice(0, 10) ?? "?",
    brix: m.brix,
    firmeza: m.firmeza,
    acidez: m.acidez,
    calibre: m.calibre,
    cluster: (m as MedicionLaboratorio & { cluster?: number | null }).cluster,
  }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-garces-cherry" />
            Historial de Mediciones
          </DialogTitle>
          <DialogDescription>
            {plantaCodigo ? `Planta ${plantaCodigo}` : `Planta ID ${plantaId}`}
            {plantaVariedad ? ` — ${plantaVariedad}` : ""}
            {clusterActual != null && (
              <span
                className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: CLUSTER_COLORS[clusterActual] || "#6b7280" }}
              >
                Cluster {clusterActual} ({CLUSTER_LABELS[clusterActual] || "?"})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando mediciones...
          </div>
        ) : mediciones.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Esta planta no tiene mediciones de laboratorio registradas.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Chart */}
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
                <TrendingUp className="h-4 w-4" /> Evolucion de Metricas
              </h4>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="brix" stroke="#8b1a1a" name="Brix" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="firmeza" stroke="#2563eb" name="Firmeza" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="acidez" stroke="#d97706" name="Acidez" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="calibre" stroke="#059669" name="Calibre" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-2 py-1.5 text-left">Fecha</th>
                    <th className="px-2 py-1.5 text-left">Temporada</th>
                    <th className="px-2 py-1.5 text-right">Brix</th>
                    <th className="px-2 py-1.5 text-right">Firmeza</th>
                    <th className="px-2 py-1.5 text-right">Acidez</th>
                    <th className="px-2 py-1.5 text-right">Calibre</th>
                    <th className="px-2 py-1.5 text-right">Peso</th>
                    <th className="px-2 py-1.5 text-center">Cluster</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((m: MedicionLaboratorio & { cluster?: number | null; cluster_label?: string | null }) => (
                    <tr key={m.id_medicion} className="border-b hover:bg-muted/30">
                      <td className="px-2 py-1.5">{m.fecha_medicion?.slice(0, 10) ?? "-"}</td>
                      <td className="px-2 py-1.5">{m.temporada ?? "-"}</td>
                      <td className="px-2 py-1.5 text-right">{m.brix?.toFixed(1) ?? "-"}</td>
                      <td className="px-2 py-1.5 text-right">{m.firmeza?.toFixed(1) ?? "-"}</td>
                      <td className="px-2 py-1.5 text-right">{m.acidez?.toFixed(2) ?? "-"}</td>
                      <td className="px-2 py-1.5 text-right">{m.calibre?.toFixed(1) ?? "-"}</td>
                      <td className="px-2 py-1.5 text-right">{m.peso?.toFixed(1) ?? "-"}</td>
                      <td className="px-2 py-1.5 text-center">
                        {m.cluster != null ? (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: CLUSTER_COLORS[m.cluster] || "#6b7280" }}
                          >
                            C{m.cluster}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
