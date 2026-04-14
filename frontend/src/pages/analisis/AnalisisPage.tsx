import { useQuery } from "@tanstack/react-query";
import { BarChart3, FlaskConical, Leaf, Target } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KpiCard } from "@/components/shared/KpiCard";
import { ChartContainer } from "@/components/shared/ChartContainer";
import { CrudTable } from "@/components/shared/CrudTable";
import { analisisService } from "@/services/analisis";
import { useLookups } from "@/hooks/useLookups";
import { formatNumber } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const CLUSTER_COLORS = ["#4ade80", "#60a5fa", "#f59e0b", "#f87171", "#a78bfa"];

const clusterColumns = [
  { accessorKey: "id_clasificacion", header: "ID" },
  { accessorKey: "id_medicion", header: "Medición" },
  { accessorKey: "cluster", header: "Cluster" },
  { accessorKey: "banda_brix", header: "Banda Brix" },
  { accessorKey: "banda_firmeza", header: "Banda Firmeza" },
  { accessorKey: "banda_calibre", header: "Banda Calibre" },
  { accessorKey: "score_total", header: "Score", cell: ({ getValue }: any) => getValue() != null ? formatNumber(getValue() as number, 2) : "-" },
  { accessorKey: "metodo", header: "Metodo" },
];

export function AnalisisPage() {
  const lk = useLookups();

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
      <h2 className="text-xl font-bold text-garces-cherry">Análisis y Paquetes Tecnológicos</h2>

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
        <ChartContainer title="Distribucion de Clusters">
          {pieData.length > 0 ? (
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CLUSTER_COLORS[i % CLUSTER_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
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
