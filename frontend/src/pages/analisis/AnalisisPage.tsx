import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, FlaskConical, Leaf, Target, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/KpiCard";
import { ChartContainer } from "@/components/shared/ChartContainer";
import { CrudTable } from "@/components/shared/CrudTable";
import { analisisService } from "@/services/analisis";
import { useLookups } from "@/hooks/useLookups";
import { useTemporadaStore } from "@/stores/temporadaStore";
import { formatNumber } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const CLUSTER_COLORS = ["#4ade80", "#60a5fa", "#f59e0b", "#f87171", "#a78bfa"];

// Header helper: "Banda Brix ⓘ" with tooltip explaining 1=peor, 4=mejor
const bandHeader = (label: string) => () => (
  <span
    title="Banda 1 a 4 — 1 = bajo rango de calidad, 4 = alto rango de calidad. Se calcula por umbrales específicos por especie."
    className="cursor-help border-b border-dotted border-muted-foreground/40"
  >
    {label}
  </span>
);
const clusterColumns = [
  { accessorKey: "id_clasificacion", header: "ID" },
  { accessorKey: "especie", header: "Especie" },
  { accessorKey: "variedad", header: "Variedad" },
  { accessorKey: "temporada", header: "Temporada" },
  { accessorKey: "id_testblock", header: "TestBlock", cell: ({ getValue }: any) => getValue() ?? "-" },
  {
    accessorKey: "cluster",
    header: () => (
      <span
        title="Cluster de calidad · 1 Premium · 2 Buena · 3 Media · 4 Deficiente"
        className="cursor-help border-b border-dotted border-muted-foreground/40"
      >
        Cluster
      </span>
    ),
  },
  { accessorKey: "banda_brix", header: bandHeader("Banda Brix") },
  { accessorKey: "banda_firmeza", header: bandHeader("Banda Firmeza") },
  { accessorKey: "banda_calibre", header: bandHeader("Banda Calibre") },
  {
    accessorKey: "score_total",
    header: () => (
      <span
        title="Score Band-Sum = suma de Banda Brix + Banda Firmeza + Banda Calibre (rango típico 3-12). Mayor es mejor."
        className="cursor-help border-b border-dotted border-muted-foreground/40"
      >
        Score
      </span>
    ),
    cell: ({ getValue }: any) => getValue() != null ? formatNumber(getValue() as number, 2) : "-",
  },
];

export function AnalisisPage() {
  const lk = useLookups();
  const queryClient = useQueryClient();
  const currentTemporada = useTemporadaStore((s) => s.current);

  const generarMut = useMutation({
    mutationFn: (temporada?: string) => analisisService.generarPaquetes(temporada),
    onSuccess: (res) => {
      toast.success(
        `${res.generados} paquete(s) generado(s) · ${res.eliminados_previos} previo(s) reemplazado(s) · temporada ${res.temporada}`,
      );
      queryClient.invalidateQueries({ queryKey: ["analisis"] });
    },
    onError: (err: Error) => toast.error(`No se pudo generar: ${err.message}`),
  });

  const paqueteColumns = [
    { accessorKey: "id_variedad", header: "Variedad", cell: ({ getValue }: any) => lk.variedad(getValue()) },
    { accessorKey: "temporada", header: "Temporada" },
    { accessorKey: "total_posiciones", header: "Posiciones" },
    { accessorKey: "posiciones_evaluadas", header: "Evaluadas" },
    { accessorKey: "cluster_predominante", header: "Cluster" },
    { accessorKey: "brix_promedio", header: "Brix", cell: ({ getValue }: any) => getValue() != null ? formatNumber(getValue() as number, 1) : "-" },
    { accessorKey: "firmeza_promedio", header: "Firmeza", cell: ({ getValue }: any) => getValue() != null ? formatNumber(getValue() as number, 1) : "-" },
    { accessorKey: "score_promedio", header: "Score", cell: ({ getValue }: any) => getValue() != null ? formatNumber(getValue() as number, 2) : "-" },
    { accessorKey: "decision", header: "Decision" },
  ];
  const { data: dashboard } = useQuery({
    queryKey: ["analisis", "dashboard"],
    queryFn: () => analisisService.dashboard(),
  });

  const { data: paquetes, isLoading: loadingPaq } = useQuery({
    queryKey: ["analisis", "paquetes"],
    queryFn: () => analisisService.paquetes(),
  });

  const { data: clusters, isLoading: loadingClusters } = useQuery({
    queryKey: ["analisis", "clusters"],
    queryFn: () => analisisService.clusters(),
  });

  // Cluster distribution pie data
  const clusterDist = dashboard?.cluster_distribution || {};
  const pieData = Object.entries(clusterDist).map(([name, value]) => ({ name: `Cluster ${name}`, value }));

  // Radar data from avg paquetes
  const radarData = paquetes && paquetes.length > 0
    ? paquetes.slice(0, 5).map((p) => ({
        variedad: lk.variedad(p.id_variedad),
        brix: p.brix_promedio ?? 0,
        firmeza: p.firmeza_promedio ?? 0,
        acidez: p.acidez_promedio ?? 0,
        calibre: p.calibre_promedio ?? 0,
      }))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-garces-cherry">Análisis y Paquetes Tecnológicos</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={generarMut.isPending}
            onClick={() => {
              if (confirm(`Generar paquetes tecnológicos para ${currentTemporada}? Reemplaza los existentes de esa temporada.`)) {
                generarMut.mutate(currentTemporada);
              }
            }}
            title="Genera un paquete por variedad + temporada con promedios y decisión agronómica"
          >
            {generarMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Generar paquetes ({currentTemporada})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={generarMut.isPending}
            onClick={() => {
              if (confirm("Generar paquetes para TODAS las temporadas con mediciones? Puede tardar.")) {
                generarMut.mutate(undefined);
              }
            }}
          >
            Todas las temporadas
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          title="TestBlocks"
          value={dashboard?.total_testblocks ?? 0}
          icon={BarChart3}
        />
        <KpiCard
          title="Plantas Activas"
          value={formatNumber(dashboard?.total_plantas_activas ?? 0)}
          icon={Leaf}
        />
        <KpiCard
          title="Posiciones"
          value={formatNumber(dashboard?.total_posiciones ?? 0)}
          icon={Target}
        />
        <KpiCard
          title="Paquetes Generados"
          value={paquetes?.length ?? 0}
          icon={FlaskConical}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartContainer title="Distribución de Clusters">
          {pieData.length > 0 ? (
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                dataKey="value"
                labelLine={false}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CLUSTER_COLORS[i % CLUSTER_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatNumber(v)} />
              <Legend
                verticalAlign="bottom"
                formatter={(name: string, entry: any) => {
                  const v = entry?.payload?.value ?? 0;
                  return `${name}: ${formatNumber(v)}`;
                }}
                wrapperStyle={{ fontSize: "11px" }}
              />
            </PieChart>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Sin datos de clusters
            </div>
          )}
        </ChartContainer>

        <ChartContainer title="Perfil de Variedades (Top 5)">
          {radarData.length > 0 ? (
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="variedad" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fontSize: 10 }} />
              <Radar name="Brix" dataKey="brix" stroke="#4ade80" fill="#4ade80" fillOpacity={0.3} />
              <Radar name="Firmeza" dataKey="firmeza" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.3} />
              <Tooltip />
            </RadarChart>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Sin datos de paquetes
            </div>
          )}
        </ChartContainer>
      </div>

      <Tabs defaultValue="paquetes">
        <TabsList>
          <TabsTrigger value="paquetes">Paquetes Tecnologicos</TabsTrigger>
          <TabsTrigger value="clusters">Clasificaciones Cluster</TabsTrigger>
        </TabsList>

        <TabsContent value="paquetes">
          <CrudTable
            data={paquetes || []}
            columns={paqueteColumns as any}
            isLoading={loadingPaq}
            searchPlaceholder="Buscar paquete..."
          />
        </TabsContent>

        <TabsContent value="clusters">
          <CrudTable
            data={clusters || []}
            columns={clusterColumns as any}
            isLoading={loadingClusters}
            searchPlaceholder="Buscar clasificacion..."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
