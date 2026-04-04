import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Package, TrendingUp, Truck, AlertTriangle, Sprout, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CrudTable } from "@/components/shared/CrudTable";
import { CrudForm } from "@/components/shared/CrudForm";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BulkActions } from "@/components/shared/BulkActions";
import { PlantWizard } from "@/components/inventario/PlantWizard";
import { inventarioService } from "@/services/inventario";
import type { BodegaStock } from "@/services/inventario";
import { mantenedorService } from "@/services/mantenedores";
import { useLookups } from "@/hooks/useLookups";
import { useTestblocks } from "@/hooks/useTestblock";
import { formatNumber, formatDate } from "@/lib/utils";
import type { FieldDef } from "@/types";
import type { InventarioVivero, GuiaDespacho } from "@/types/inventario";

const TIPO_PLANTA_LABELS: Record<string, string> = {
  "Raíz desnuda": "Raiz desnuda",
  "Bolsa primavera": "Bolsa primavera",
  planta_terminada_raiz_desnuda: "Raiz desnuda",
  planta_en_bolsa: "Bolsa",
  planta_en_maceta: "Maceta",
};

type KpiFilter = "todos" | "activos" | "stock_bajo" | "agotados";

/** Improved progress bar for stock level */
function StockBar({ actual, inicial }: { actual: number; inicial: number }) {
  const pct = inicial > 0 ? Math.round((actual / inicial) * 100) : 0;
  const color =
    pct > 50 ? "bg-estado-success" : pct > 20 ? "bg-estado-warning" : "bg-estado-danger";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative h-4 bg-gray-100 rounded-full min-w-[80px] max-w-[100px]">
        <div
          className={`h-4 rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">
          {formatNumber(actual)}/{formatNumber(inicial)}
        </span>
      </div>
    </div>
  );
}

export function InventarioPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [despachoOpen, setDespachoOpen] = useState(false);
  const [selectedBodega, setSelectedBodega] = useState<number | "todas">("todas");
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>("todos");
  const lk = useLookups();

  // Lookup data for despacho form selects
  const { data: cuarteles } = useQuery({ queryKey: ["lookup", "cuarteles"], queryFn: () => mantenedorService("cuarteles").list(), staleTime: 5 * 60_000 });
  const { data: testblocks } = useTestblocks();

  // Options for despacho form
  const { data: inventarioDisponible } = useQuery({
    queryKey: ["inventario", "disponible"],
    queryFn: inventarioService.disponible,
  });
  const loteOpts = ((inventarioDisponible || []) as any[]).map((l: any) => ({
    value: l.id_inventario,
    label: `${l.codigo_lote} (stock: ${l.cantidad_actual})`,
  }));
  const tbOpts = ((testblocks || []) as any[]).map((tb: any) => ({
    value: tb.id_testblock,
    label: `${tb.nombre} (${tb.codigo})`,
  }));
  const cuartelOpts = ((cuarteles || []) as any[]).map((c: any) => ({
    value: c.id_cuartel,
    label: c.nombre || c.codigo,
  }));

  const despachoFields: FieldDef[] = [
    { key: "id_inventario", label: "Lote", type: "select", options: loteOpts, required: true },
    { key: "id_testblock_destino", label: "TestBlock Destino", type: "select", options: tbOpts, required: true },
    { key: "id_cuartel", label: "Cuartel Destino", type: "select", options: cuartelOpts, required: true },
    { key: "cantidad", label: "Cantidad", type: "number", required: true },
    { key: "responsable", label: "Responsable", type: "text", required: true },
    { key: "motivo", label: "Motivo", type: "text" },
  ];

  const columns = [
    { accessorKey: "codigo_lote", header: "Lote" },
    { accessorKey: "id_variedad", header: "Variedad", cell: ({ getValue }: any) => lk.variedad(getValue()) || "-" },
    {
      accessorKey: "id_portainjerto",
      header: "Portainjerto",
      cell: ({ getValue }: any) => lk.portainjerto(getValue()) || "-",
    },
    { accessorKey: "id_especie", header: "Especie", cell: ({ getValue }: any) => lk.especie(getValue()) },
    {
      accessorKey: "tipo_planta",
      header: "Tipo Planta",
      cell: ({ getValue }: any) => {
        const v = getValue() as string | null;
        return v ? (
          <span className="text-xs bg-garces-green-pale text-garces-green px-1.5 py-0.5 rounded">
            {TIPO_PLANTA_LABELS[v] || v}
          </span>
        ) : "-";
      },
    },
    {
      accessorKey: "tipo_injertacion",
      header: "Injertacion",
      cell: ({ getValue }: any) => {
        const v = getValue() as string | null;
        return v ? <span className="text-xs">{v}</span> : "-";
      },
    },
    {
      accessorKey: "cantidad_actual",
      header: "Stock",
      cell: ({ row }: any) => (
        <StockBar
          actual={row.original.cantidad_actual}
          inicial={row.original.cantidad_inicial}
        />
      ),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ getValue }: any) => <StatusBadge status={getValue() as string} />,
    },
    { accessorKey: "fecha_ingreso", header: "Ingreso", cell: ({ getValue }: any) => formatDate(getValue() as string) },
  ];

  const { data: inventario, isLoading } = useQuery({
    queryKey: ["inventario"],
    queryFn: () => inventarioService.list(),
  });
  const { data: stats } = useQuery({
    queryKey: ["inventario", "stats"],
    queryFn: inventarioService.stats,
  });
  const { data: bodegaStock } = useQuery({
    queryKey: ["inventario", "por-bodega"],
    queryFn: inventarioService.porBodega,
  });
  const { data: guias } = useQuery({
    queryKey: ["guias-despacho"],
    queryFn: inventarioService.guias,
  });

  // Compute stock bajo count (stock < 20% of initial)
  const stockBajoCount = useMemo(() => {
    if (!inventario) return 0;
    return (inventario as InventarioVivero[]).filter(
      (l) => l.cantidad_actual > 0 && l.cantidad_inicial > 0 && l.cantidad_actual / l.cantidad_inicial < 0.2
    ).length;
  }, [inventario]);

  // Filter lotes by selected bodega + KPI filter
  const filteredInventario = useMemo(() => {
    if (!inventario) return [];
    let all = inventario as InventarioVivero[];

    // Bodega filter
    if (selectedBodega !== "todas") {
      if (selectedBodega === 0) {
        all = all.filter((l) => !l.id_bodega || l.id_bodega === 0);
      } else {
        all = all.filter((l) => l.id_bodega === selectedBodega);
      }
    }

    // KPI filter
    switch (kpiFilter) {
      case "activos":
        return all.filter((l) => l.estado === "disponible");
      case "stock_bajo":
        return all.filter(
          (l) => l.cantidad_actual > 0 && l.cantidad_inicial > 0 && l.cantidad_actual / l.cantidad_inicial < 0.2
        );
      case "agotados":
        return all.filter((l) => l.estado === "agotado" || l.cantidad_actual <= 0);
      default:
        return all;
    }
  }, [inventario, selectedBodega, kpiFilter]);

  const despachoMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      const payload = {
        id_inventario: data.id_inventario,
        id_testblock_destino: data.id_testblock_destino,
        destinos: [
          {
            id_cuartel: data.id_cuartel,
            cantidad: Number(data.cantidad),
          },
        ],
        responsable: data.responsable,
        motivo: data.motivo,
      };
      return inventarioService.despacho(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventario"] });
      queryClient.invalidateQueries({ queryKey: ["guias-despacho"] });
      queryClient.invalidateQueries({ queryKey: ["inventario", "por-bodega"] });
      toast.success("Despacho creado correctamente");
      setDespachoOpen(false);
    },
  });

  const guiaColumns = [
    { accessorKey: "numero_guia", header: "N. Guia" },
    { accessorKey: "id_testblock_destino", header: "TB Destino" },
    { accessorKey: "total_plantas", header: "Total" },
    { accessorKey: "estado", header: "Estado", cell: ({ getValue }: any) => <StatusBadge status={getValue() as string} /> },
    { accessorKey: "responsable", header: "Responsable" },
    { accessorKey: "fecha_creacion", header: "Fecha", cell: ({ getValue }: any) => formatDate(getValue() as string) },
  ];

  function handleKpiClick(filter: KpiFilter) {
    setKpiFilter((prev) => (prev === filter ? "todos" : filter));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-garces-cherry">Inventario de Vivero</h2>
        <div className="flex gap-2 items-center">
          <BulkActions
            entity="inventario"
            onImportComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["inventario"] });
              queryClient.invalidateQueries({ queryKey: ["inventario", "stats"] });
              queryClient.invalidateQueries({ queryKey: ["inventario", "por-bodega"] });
            }}
          />
          <Button size="sm" variant="outline" onClick={() => setDespachoOpen(true)}>
            <Truck className="h-4 w-4 mr-1" /> Despacho
          </Button>
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Sprout className="h-4 w-4 mr-1" /> Nueva Planta / Lote
          </Button>
        </div>
      </div>

      {/* KPIs — clickeable para filtrar */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Stock Total"
            value={formatNumber(stats.total_stock)}
            icon={TrendingUp}
            className="cursor-default"
          />
          <div onClick={() => handleKpiClick("activos")} className="cursor-pointer">
            <KpiCard
              title="Lotes Activos"
              value={stats.lotes_disponibles}
              icon={Package}
              iconBg="bg-green-100"
              iconColor="text-estado-success"
              className={kpiFilter === "activos" ? "ring-2 ring-estado-success" : ""}
            />
          </div>
          <div onClick={() => handleKpiClick("stock_bajo")} className="cursor-pointer">
            <KpiCard
              title="Stock Bajo"
              value={stockBajoCount}
              icon={AlertCircle}
              iconBg="bg-yellow-100"
              iconColor="text-estado-warning"
              className={kpiFilter === "stock_bajo" ? "ring-2 ring-estado-warning" : ""}
            />
          </div>
          <div onClick={() => handleKpiClick("agotados")} className="cursor-pointer">
            <KpiCard
              title="Agotados"
              value={stats.lotes_agotados}
              icon={AlertTriangle}
              iconBg="bg-red-100"
              iconColor="text-estado-danger"
              className={kpiFilter === "agotados" ? "ring-2 ring-estado-danger" : ""}
            />
          </div>
        </div>
      )}

      {/* Active filter indicator */}
      {kpiFilter !== "todos" && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtro activo:</span>
          <span className="bg-garces-cherry-pale text-garces-cherry px-2 py-0.5 rounded-full text-xs font-medium">
            {kpiFilter === "activos" ? "Lotes activos" : kpiFilter === "stock_bajo" ? "Stock bajo (<20%)" : "Agotados"}
          </span>
          <button onClick={() => setKpiFilter("todos")} className="text-xs text-muted-foreground hover:text-garces-cherry">
            Limpiar
          </button>
        </div>
      )}

      {/* Bodega selector pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedBodega("todas")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            selectedBodega === "todas"
              ? "bg-garces-cherry text-white"
              : "bg-white border text-muted-foreground hover:bg-garces-cherry-pale hover:text-garces-cherry"
          }`}
        >
          Todas ({filteredInventario.length})
        </button>
        {(bodegaStock || []).map((bod: BodegaStock) => (
          <button
            key={bod.id_bodega}
            onClick={() => setSelectedBodega(bod.id_bodega)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedBodega === bod.id_bodega
                ? "bg-garces-cherry text-white"
                : "bg-white border text-muted-foreground hover:bg-garces-cherry-pale hover:text-garces-cherry"
            }`}
          >
            {bod.nombre} ({bod.total_lotes})
          </button>
        ))}
      </div>

      {/* Main content tabs */}
      <Tabs defaultValue="lotes">
        <TabsList>
          <TabsTrigger value="lotes">Lotes</TabsTrigger>
          <TabsTrigger value="guias">Guias Despacho</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos Recientes</TabsTrigger>
        </TabsList>

        <TabsContent value="lotes">
          <CrudTable
            data={filteredInventario}
            columns={columns as any}
            isLoading={isLoading}
            onEdit={(row) => navigate(`/inventario/${(row as any).id_inventario}`)}
            searchPlaceholder="Buscar lote, variedad, especie..."
          />
        </TabsContent>

        <TabsContent value="guias">
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setDespachoOpen(true)}>
                <Truck className="h-4 w-4 mr-1" /> Nuevo Despacho
              </Button>
            </div>
            <CrudTable
              data={guias || []}
              columns={guiaColumns as any}
            />
          </div>
        </TabsContent>

        <TabsContent value="movimientos">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-muted-foreground text-center py-6">
              Seleccione un lote para ver su Kardex de movimientos detallado.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <PlantWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />

      <CrudForm
        open={despachoOpen}
        onClose={() => setDespachoOpen(false)}
        onSubmit={async (data) => { await despachoMut.mutateAsync(data); }}
        fields={despachoFields}
        title="Nuevo Despacho a TestBlock"
        isLoading={despachoMut.isPending}
      />
    </div>
  );
}
