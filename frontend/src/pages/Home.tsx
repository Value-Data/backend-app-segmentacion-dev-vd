import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Warehouse, Sprout, Truck, Grid3X3, Hammer,
  FlaskConical, BarChart3, ChevronRight, ArrowRight,
  Package, Leaf, Bell, TrendingUp,
} from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { ChartContainer } from "@/components/shared/ChartContainer";
import { analisisService } from "@/services/analisis";
import { testblockService } from "@/services/testblock";
import { inventarioService } from "@/services/inventario";
import { alertaService } from "@/services/sistema";
import { laboresService } from "@/services/labores";
import { formatNumber } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip } from "recharts";

const PIE_COLORS = ["#4ade80", "#f87171", "#60a5fa", "#d1d5db"];

interface PipelineStepProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
  subtitle: string;
  color: string;
  bgColor: string;
  to: string;
  isLast?: boolean;
}

function PipelineStep({ icon: Icon, title, value, subtitle, color, bgColor, to, isLast }: PipelineStepProps) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center">
      <div
        className="bg-white rounded-xl border p-4 hover:shadow-lg transition-all cursor-pointer group flex-1 min-w-[160px]"
        onClick={() => navigate(to)}
      >
        <div className={`h-10 w-10 rounded-lg ${bgColor} flex items-center justify-center mb-3`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm font-medium mt-0.5">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        <div className={`mt-2 flex items-center gap-1 text-xs ${color} opacity-0 group-hover:opacity-100 transition-opacity`}>
          Ver detalle <ChevronRight className="h-3 w-3" />
        </div>
      </div>
      {!isLast && (
        <ArrowRight className="h-5 w-5 text-muted-foreground/40 mx-1 shrink-0" />
      )}
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();

  const { data: dashboard } = useQuery({
    queryKey: ["analisis", "dashboard"],
    queryFn: () => analisisService.dashboard(),
  });
  const { data: testblocks } = useQuery({
    queryKey: ["testblocks"],
    queryFn: testblockService.list,
  });
  const { data: stats } = useQuery({
    queryKey: ["inventario", "stats"],
    queryFn: inventarioService.stats,
  });
  const { data: bodegas } = useQuery({
    queryKey: ["inventario", "por-bodega"],
    queryFn: inventarioService.porBodega,
  });
  const { data: alertas } = useQuery({
    queryKey: ["alertas", "activa"],
    queryFn: () => alertaService.list({ estado: "activa" }),
  });
  const { data: labores } = useQuery({
    queryKey: ["labores", "planificacion"],
    queryFn: () => laboresService.planificacion(),
  });

  const totalAltas = testblocks?.reduce((s, t) => s + (t.pos_alta || 0), 0) || 0;
  const totalBajas = testblocks?.reduce((s, t) => s + (t.pos_baja || 0), 0) || 0;
  const totalVacias = testblocks?.reduce((s, t) => s + (t.pos_vacia || 0), 0) || 0;
  const totalReplante = testblocks?.reduce((s, t) => s + (t.pos_replante || 0), 0) || 0;
  const totalBodegas = bodegas?.filter(b => b.total_stock > 0).length || 0;
  const laboresPendientes = labores?.filter(l => l.estado === "planificada").length || 0;
  const laboresEjecutadas = labores?.filter(l => l.estado === "ejecutada").length || 0;

  const pieData = [
    { name: "Alta", value: totalAltas },
    { name: "Baja", value: totalBajas },
    { name: "Replante", value: totalReplante },
    { name: "Vacia", value: totalVacias },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-garces-cherry">Garces Fruit</h2>
        <p className="text-sm text-muted-foreground">Sistema de Segmentacion de Nuevas Especies — Flujo de Proceso</p>
      </div>

      {/* Process Pipeline */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Flujo de Proceso
        </h3>
        <div className="flex items-start overflow-x-auto pb-2 gap-0">
          <PipelineStep
            icon={Warehouse}
            title="Bodega / Vivero"
            value={formatNumber(stats?.total_stock ?? 0)}
            subtitle={`${stats?.total_lotes ?? 0} lotes en ${totalBodegas} bodegas`}
            color="text-amber-700"
            bgColor="bg-amber-50"
            to="/inventario"
          />
          <PipelineStep
            icon={Sprout}
            title="Plantas / Lotes"
            value={formatNumber(stats?.lotes_disponibles ?? 0)}
            subtitle="lotes disponibles para despacho"
            color="text-green-700"
            bgColor="bg-green-50"
            to="/inventario"
          />
          <PipelineStep
            icon={Truck}
            title="Despacho"
            value={formatNumber(stats?.lotes_agotados ?? 0)}
            subtitle="lotes despachados/agotados"
            color="text-blue-700"
            bgColor="bg-blue-50"
            to="/inventario"
          />
          <PipelineStep
            icon={Grid3X3}
            title="TestBlocks"
            value={dashboard?.total_testblocks ?? testblocks?.length ?? 0}
            subtitle={`${formatNumber(totalAltas)} plantas activas`}
            color="text-garces-cherry"
            bgColor="bg-garces-cherry-pale"
            to="/testblocks"
          />
          <PipelineStep
            icon={Hammer}
            title="Labores"
            value={laboresPendientes}
            subtitle={`pendientes | ${laboresEjecutadas} ejecutadas`}
            color="text-orange-700"
            bgColor="bg-orange-50"
            to="/labores"
          />
          <PipelineStep
            icon={FlaskConical}
            title="Laboratorio"
            value={dashboard?.kpis?.total ?? 0}
            subtitle="mediciones de calidad"
            color="text-purple-700"
            bgColor="bg-purple-50"
            to="/laboratorio"
          />
          <PipelineStep
            icon={BarChart3}
            title="Analisis"
            value={Object.keys(dashboard?.cluster_distribution || {}).length}
            subtitle="clusters identificados"
            color="text-garces-cherry"
            bgColor="bg-garces-cherry-pale"
            to="/analisis"
            isLast
          />
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          title="Plantas Activas"
          value={formatNumber(dashboard?.total_plantas_activas ?? totalAltas)}
          icon={Leaf}
        />
        <KpiCard
          title="Stock Vivero"
          value={formatNumber(stats?.total_stock ?? 0)}
          icon={Package}
        />
        <KpiCard
          title="TestBlocks"
          value={dashboard?.total_testblocks ?? testblocks?.length ?? 0}
          icon={Grid3X3}
        />
        <KpiCard
          title="Alertas"
          value={alertas?.length ?? 0}
          icon={Bell}
        />
      </div>

      {/* Charts + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie chart */}
        <ChartContainer title="Estado de Posiciones">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              dataKey="value"
              label={({ name, value }) => `${name}: ${formatNumber(value)}`}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ChartContainer>

        {/* Lab KPIs */}
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-purple-600" /> Calidad Promedio
          </h3>
          <div className="space-y-2">
            {[
              { label: "Brix", value: dashboard?.kpis?.brix_promedio, unit: "", color: "bg-green-500" },
              { label: "Firmeza", value: dashboard?.kpis?.firmeza_promedio, unit: "", color: "bg-blue-500" },
              { label: "Calibre", value: dashboard?.kpis?.calibre_promedio, unit: " mm", color: "bg-purple-500" },
              { label: "Acidez", value: dashboard?.kpis?.acidez_promedio, unit: "", color: "bg-amber-500" },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full`}
                      style={{ width: `${Math.min(((value as number) || 0) / 30 * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-16 text-right">
                    {value != null ? `${formatNumber(value as number, 1)}${unit}` : "-"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-garces-cherry" /> Acciones Rapidas
          </h3>
          <div className="space-y-2">
            {[
              { label: "Nuevo Lote / Planta", to: "/inventario", icon: Sprout, desc: "Crear plantas en vivero" },
              { label: "Despachar a TestBlock", to: "/inventario", icon: Truck, desc: "Enviar stock a campo" },
              { label: "Planificar Labores", to: "/labores", icon: Hammer, desc: "Programar trabajo" },
              { label: "Registrar Medicion", to: "/laboratorio", icon: FlaskConical, desc: "Datos de calidad" },
              { label: "Ver Reportes", to: "/reportes", icon: BarChart3, desc: "Informes y AI" },
            ].map(({ label, to, icon: Icon, desc }) => (
              <button
                key={label}
                onClick={() => navigate(to)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-garces-cherry-pale transition-colors text-left group"
              >
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-garces-cherry group-hover:text-white transition-colors">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
