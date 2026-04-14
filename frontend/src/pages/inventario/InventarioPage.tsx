import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Package, TrendingUp, Truck, AlertTriangle, Sprout, AlertCircle, Eye, QrCode, Filter, X, CheckSquare, FileDown, ArrowUpRight, ArrowDownRight, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { useAuthStore } from "@/stores/authStore";
import { formatNumber, formatDate } from "@/lib/utils";
import type { FieldDef } from "@/types";
import type { InventarioVivero, GuiaDespacho, MovimientoInventario } from "@/types/inventario";

const TIPO_ENTRADA = new Set(["INGRESO", "DEVOLUCION"]);

function KardexTipoBadge({ tipo }: { tipo: string }) {
  const upper = tipo?.toUpperCase() || "";
  if (TIPO_ENTRADA.has(upper)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
        <ArrowUpRight className="h-3 w-3" />
        {tipo}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800">
      <ArrowDownRight className="h-3 w-3" />
      {tipo}
    </span>
  );
}

const TIPO_PLANTA_LABELS: Record<string, string> = {
  TERMINADA_RAIZ_DESNUDA: "Terminada raíz desnuda",
  TERMINADA_MACETA_BOLSA: "Terminada maceta/bolsa",
  INJERTACION_TERRENO: "Injertación en terreno",
  PLANTA_TERMINADA: "Planta terminada",
  RAMILLAS: "Ramillas",
  // Legacy values (backwards compat for display)
  "Raíz desnuda": "Raíz desnuda",
  "Bolsa primavera": "Bolsa primavera",
  "Planta en bolsa o maceta": "Terminada maceta/bolsa",
  "Planta terminada raiz desnuda": "Terminada raíz desnuda",
};

const TIPO_INJERTACION_LABELS: Record<string, string> = {
  INVIERNO_PUA: "Invierno (púa)",
  VERANO_YEMA: "Verano (yema)",
  OJO_VIVO: "Ojo vivo",
  OJO_DORMIDO: "Ojo dormido",
  EN_TERRENO: "En terreno",
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedLoteId, setSelectedLoteId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("lotes");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    especie: string;
    tipo_planta: string;
    tipo_injertacion: string;
  }>({ especie: "", tipo_planta: "", tipo_injertacion: "" });
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
  ];

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInventario.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInventario.map((l) => l.id_inventario)));
    }
  };

  const columns = [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={filteredInventario.length > 0 && selectedIds.size === filteredInventario.length}
          onChange={toggleSelectAll}
          className="rounded border-gray-300"
        />
      ),
      size: 40,
      cell: ({ row }: any) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.original.id_inventario)}
          onChange={() => toggleSelect(row.original.id_inventario)}
          className="rounded border-gray-300"
        />
      ),
    },
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
      header: "Injertación",
      cell: ({ getValue }: any) => {
        const v = getValue() as string | null;
        return v ? <span className="text-xs">{TIPO_INJERTACION_LABELS[v] || v}</span> : "-";
      },
    },
    {
      accessorKey: "ano_plantacion",
      header: "Ano",
      cell: ({ getValue }: any) => getValue() ?? "-",
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
    {
      id: "actions",
      header: "",
      size: 90,
      cell: ({ row }: any) => {
        const lote = row.original as InventarioVivero;
        return (
          <div className="flex gap-1 justify-end">
            <button
              onClick={() => { setSelectedLoteId(lote.id_inventario); setActiveTab("movimientos"); }}
              className="p-1 rounded hover:bg-muted transition-colors"
              title="Ver Kardex"
            >
              <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate(`/inventario/${lote.id_inventario}`)}
              className="p-1 rounded hover:bg-muted transition-colors"
              title="Ver detalle"
            >
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <a
              href={inventarioService.qrUrl(lote.id_inventario)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-muted transition-colors"
              title="Ver QR"
            >
              <QrCode className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </div>
        );
      },
    },
  ];

  const { data: inventario, isLoading } = useQuery({
    queryKey: ["inventario"],
    queryFn: () => inventarioService.list(),
  });
  const { data: plantasSinLote } = useQuery({
    queryKey: ["inventario", "plantas-sin-lote"],
    queryFn: () => inventarioService.plantasSinLote(),
    staleTime: 60_000,
  });
  const [selectedPlantaIds, setSelectedPlantaIds] = useState<Set<number>>(new Set());
  const [asignarLoteOpen, setAsignarLoteOpen] = useState(false);
  // Mediciones for selected lote
  const { data: loteMediciones, isLoading: medLoading } = useQuery({
    queryKey: ["inventario", selectedLoteId, "mediciones"],
    queryFn: () => inventarioService.mediciones(selectedLoteId!),
    enabled: !!selectedLoteId,
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

  // Kardex for selected lote
  const { data: kardexData, isLoading: kardexLoading } = useQuery({
    queryKey: ["inventario", selectedLoteId, "kardex"],
    queryFn: () => inventarioService.kardex(selectedLoteId!),
    enabled: !!selectedLoteId,
  });

  const selectedLote = useMemo(() => {
    if (!selectedLoteId || !inventario) return null;
    return (inventario as InventarioVivero[]).find((l) => l.id_inventario === selectedLoteId) || null;
  }, [selectedLoteId, inventario]);

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
        all = all.filter((l) => l.estado === "disponible");
        break;
      case "stock_bajo":
        all = all.filter(
          (l) => l.cantidad_actual > 0 && l.cantidad_inicial > 0 && l.cantidad_actual / l.cantidad_inicial < 0.2
        );
        break;
      case "agotados":
        all = all.filter((l) => l.estado === "agotado" || l.cantidad_actual <= 0);
        break;
    }

    // Advanced filters
    if (filters.especie) {
      all = all.filter((l) => String(l.id_especie) === filters.especie);
    }
    if (filters.tipo_planta) {
      all = all.filter((l) => l.tipo_planta === filters.tipo_planta);
    }
    if (filters.tipo_injertacion) {
      all = all.filter((l) => l.tipo_injertacion === filters.tipo_injertacion);
    }

    return all;
  }, [inventario, selectedBodega, kpiFilter, filters]);

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

  const asignarLoteMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      inventarioService.asignarLote(Number(data.id_lote), Array.from(selectedPlantaIds)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["inventario"] });
      toast.success(res.message);
      setSelectedPlantaIds(new Set());
      setAsignarLoteOpen(false);
    },
  });

  const deleteLoteMut = useMutation({
    mutationFn: (id: number) => inventarioService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventario"] });
      toast.success("Lote eliminado");
    },
  });

  const guiaColumns = [
    { accessorKey: "numero_guia", header: "N. Guia", cell: ({ getValue }: any) => (
      <span className="font-mono font-medium text-garces-cherry">{getValue()}</span>
    )},
    { accessorKey: "id_bodega_origen", header: "Bodega Origen", cell: ({ getValue }: any) => lk.bodega(getValue()) },
    { accessorKey: "id_testblock_destino", header: "TB Destino" },
    { accessorKey: "total_plantas", header: "Total Plantas", cell: ({ getValue }: any) => (
      <span className="font-medium tabular-nums">{formatNumber(getValue() as number)}</span>
    )},
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
        <h2 className="text-xl font-bold text-garces-cherry">Inventario Bodega</h2>
        <div className="flex gap-2 items-center">
          <BulkActions
            entity="inventario"
            onImportComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["inventario"] });
              queryClient.invalidateQueries({ queryKey: ["inventario", "stats"] });
              queryClient.invalidateQueries({ queryKey: ["inventario", "por-bodega"] });
            }}
          />
          <Button
            size="sm"
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" /> Filtros
          </Button>
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

      {/* Advanced filters panel */}
      {showFilters && (
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Filtros Avanzados</h4>
            <button onClick={() => setShowFilters(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Especie</label>
              <select
                value={filters.especie}
                onChange={(e) => setFilters((p) => ({ ...p, especie: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm"
              >
                <option value="">Todas</option>
                {lk.options.especies.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo Planta</label>
              <select
                value={filters.tipo_planta}
                onChange={(e) => setFilters((p) => ({ ...p, tipo_planta: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm"
              >
                <option value="">Todos</option>
                {[...new Set((inventario as InventarioVivero[] || []).map((l) => l.tipo_planta).filter(Boolean))].map((v) => (
                  <option key={v} value={v!}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Injertación</label>
              <select
                value={filters.tipo_injertacion}
                onChange={(e) => setFilters((p) => ({ ...p, tipo_injertacion: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5 text-sm"
              >
                <option value="">Todos</option>
                {[...new Set((inventario as InventarioVivero[] || []).map((l) => l.tipo_injertacion).filter(Boolean))].map((v) => (
                  <option key={v} value={v!}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          {(filters.especie || filters.tipo_planta || filters.tipo_injertacion) && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">Filtros activos:</span>
              {filters.especie && (
                <span className="inline-flex items-center gap-1 bg-garces-cherry-pale text-garces-cherry rounded-full px-2 py-0.5 text-xs">
                  {lk.especie(Number(filters.especie))}
                  <button onClick={() => setFilters((p) => ({ ...p, especie: "" }))}><X className="h-3 w-3" /></button>
                </span>
              )}
              {filters.tipo_planta && (
                <span className="inline-flex items-center gap-1 bg-garces-green-pale text-garces-green rounded-full px-2 py-0.5 text-xs">
                  {filters.tipo_planta}
                  <button onClick={() => setFilters((p) => ({ ...p, tipo_planta: "" }))}><X className="h-3 w-3" /></button>
                </span>
              )}
              {filters.tipo_injertacion && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs">
                  {filters.tipo_injertacion}
                  <button onClick={() => setFilters((p) => ({ ...p, tipo_injertacion: "" }))}><X className="h-3 w-3" /></button>
                </span>
              )}
              <button
                onClick={() => setFilters({ especie: "", tipo_planta: "", tipo_injertacion: "" })}
                className="text-xs text-muted-foreground hover:text-garces-cherry ml-1"
              >
                Limpiar todos
              </button>
            </div>
          )}
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="lotes">Lotes ({filteredInventario.length})</TabsTrigger>
          <TabsTrigger value="sin-asignar">Plantas Sin Lote {plantasSinLote ? `(${plantasSinLote.length})` : ""}</TabsTrigger>
          <TabsTrigger value="guias">Gu\u00edas Despacho</TabsTrigger>
          <TabsTrigger value="movimientos">
            Kardex {selectedLote ? `— ${selectedLote.codigo_lote}` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lotes">
          <CrudTable
            data={filteredInventario}
            columns={columns as any}
            isLoading={isLoading}
            onEdit={(row) => navigate(`/inventario/${(row as any).id_inventario}`)}
            onRowClick={(row) => { setSelectedLoteId((row as InventarioVivero).id_inventario); setActiveTab("movimientos"); }}
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

        <TabsContent value="sin-asignar">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Plantas activas en testblocks que fueron creadas sin lote de inventario (Alta Directa). Selecciona plantas para asignarles un lote.
              </p>
              {selectedPlantaIds.size > 0 && (
                <Button size="sm" onClick={() => setAsignarLoteOpen(true)}>
                  <Package className="h-4 w-4 mr-1" /> Asignar Lote ({selectedPlantaIds.size})
                </Button>
              )}
            </div>
            <div className="bg-white rounded-lg border overflow-auto" style={{ maxHeight: "65vh" }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-muted/50">
                    <th className="h-9 px-2 w-8">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={plantasSinLote && plantasSinLote.length > 0 && selectedPlantaIds.size === plantasSinLote.length}
                        onChange={() => {
                          if (selectedPlantaIds.size === (plantasSinLote?.length || 0)) {
                            setSelectedPlantaIds(new Set());
                          } else {
                            setSelectedPlantaIds(new Set((plantasSinLote || []).map((p: any) => p.id_planta)));
                          }
                        }}
                      />
                    </th>
                    <th className="h-9 px-3 text-left font-medium text-muted-foreground">Planta</th>
                    <th className="h-9 px-3 text-left font-medium text-muted-foreground">Variedad</th>
                    <th className="h-9 px-3 text-left font-medium text-muted-foreground">Portainjerto</th>
                    <th className="h-9 px-3 text-left font-medium text-muted-foreground">TestBlock</th>
                    <th className="h-9 px-3 text-left font-medium text-muted-foreground">Posición</th>
                    <th className="h-9 px-3 text-left font-medium text-muted-foreground">Etapa</th>
                    <th className="h-9 px-3 text-left font-medium text-muted-foreground">Fecha Alta</th>
                  </tr>
                </thead>
                <tbody>
                  {(!plantasSinLote || plantasSinLote.length === 0) ? (
                    <tr><td colSpan={8} className="h-24 text-center text-muted-foreground">Todas las plantas tienen lote asignado</td></tr>
                  ) : (
                    (plantasSinLote as any[]).map((pl) => (
                      <tr key={pl.id_planta} className={`border-b hover:bg-muted/30 transition-colors cursor-pointer ${selectedPlantaIds.has(pl.id_planta) ? "bg-blue-50" : ""}`}
                          onClick={() => {
                            setSelectedPlantaIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(pl.id_planta)) next.delete(pl.id_planta); else next.add(pl.id_planta);
                              return next;
                            });
                          }}>
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={selectedPlantaIds.has(pl.id_planta)}
                            onChange={() => {
                              setSelectedPlantaIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(pl.id_planta)) next.delete(pl.id_planta); else next.add(pl.id_planta);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{pl.codigo || `PLT-${pl.id_planta}`}</td>
                        <td className="px-3 py-2 text-xs font-medium">{pl.variedad}</td>
                        <td className="px-3 py-2 text-xs">{pl.portainjerto}</td>
                        <td className="px-3 py-2 text-xs">
                          {pl.id_testblock ? (
                            <button className="text-blue-600 hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/testblocks/${pl.id_testblock}`); }}>
                              {pl.testblock}
                            </button>
                          ) : "-"}
                        </td>
                        <td className="px-3 py-2 text-xs font-mono">{pl.posicion}</td>
                        <td className="px-3 py-2"><StatusBadge status={pl.etapa || "formacion"} /></td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{pl.fecha_alta ? formatDate(pl.fecha_alta) : "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {plantasSinLote?.length ?? 0} plantas sin lote asignado
            </p>
          </div>
        </TabsContent>

        <TabsContent value="movimientos">
          {!selectedLote ? (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex flex-col items-center justify-center text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <h4 className="font-semibold text-sm">Movimientos por Lote</h4>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Haga click en el icono <FileDown className="h-3.5 w-3.5 inline text-muted-foreground" /> de un lote en la tabla para ver su Kardex.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                  <button onClick={() => { setSelectedLoteId(null); setActiveTab("lotes"); }} className="p-1 rounded hover:bg-muted">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h3 className="font-semibold text-sm">Kardex — {selectedLote.codigo_lote}</h3>
                    <p className="text-xs text-muted-foreground">
                      {lk.variedad(selectedLote.id_variedad)} / {lk.portainjerto(selectedLote.id_portainjerto)} — Stock: {formatNumber(selectedLote.cantidad_actual)}/{formatNumber(selectedLote.cantidad_inicial)}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate(`/inventario/${selectedLote.id_inventario}`)}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Ver Detalle Completo
                </Button>
              </div>
              <div className="overflow-auto">
                {kardexLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Cargando movimientos...</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-10 px-3 text-left font-medium text-muted-foreground">Fecha</th>
                        <th className="h-10 px-3 text-left font-medium text-muted-foreground">Tipo</th>
                        <th className="h-10 px-3 text-right font-medium text-muted-foreground">Cantidad</th>
                        <th className="h-10 px-3 text-center font-medium text-muted-foreground">Saldo Ant.</th>
                        <th className="h-10 px-3 text-center font-medium text-muted-foreground"></th>
                        <th className="h-10 px-3 text-center font-medium text-muted-foreground">Saldo Nuevo</th>
                        <th className="h-10 px-3 text-left font-medium text-muted-foreground">Destino</th>
                        <th className="h-10 px-3 text-left font-medium text-muted-foreground">Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(kardexData || []).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="h-24 text-center text-muted-foreground">
                            Sin movimientos registrados
                          </td>
                        </tr>
                      ) : (
                        (kardexData || []).map((m: MovimientoInventario) => {
                          const isEntrada = TIPO_ENTRADA.has(m.tipo?.toUpperCase());
                          return (
                            <tr key={m.id_movimiento} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2 text-muted-foreground">{formatDate(m.fecha_movimiento)}</td>
                              <td className="px-3 py-2"><KardexTipoBadge tipo={m.tipo} /></td>
                              <td className={`px-3 py-2 text-right font-medium tabular-nums ${isEntrada ? "text-green-700" : "text-red-700"}`}>
                                {isEntrada ? "+" : "-"}{formatNumber(m.cantidad)}
                              </td>
                              <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                                {m.saldo_anterior != null ? formatNumber(m.saldo_anterior) : "-"}
                              </td>
                              <td className="px-3 py-2 text-center text-muted-foreground">→</td>
                              <td className="px-3 py-2 text-center tabular-nums font-medium">
                                {m.saldo_nuevo != null ? formatNumber(m.saldo_nuevo) : "-"}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{m.referencia_destino || "-"}</td>
                              <td className="px-3 py-2 text-muted-foreground text-xs">{m.usuario || "-"}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Mediciones section */}
              <div className="border-t">
                <div className="flex items-center justify-between p-3 bg-muted/30">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                    Mediciones de plantas de este lote ({loteMediciones?.length ?? 0})
                  </h4>
                </div>
                {medLoading ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Cargando mediciones...</div>
                ) : !loteMediciones || loteMediciones.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Sin mediciones registradas para plantas de este lote</div>
                ) : (
                  <div className="overflow-auto max-h-64">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 sticky top-0">
                          <th className="h-8 px-3 text-left text-xs font-medium text-muted-foreground">Planta</th>
                          <th className="h-8 px-3 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                          <th className="h-8 px-3 text-right text-xs font-medium text-muted-foreground">Brix</th>
                          <th className="h-8 px-3 text-right text-xs font-medium text-muted-foreground">Firmeza</th>
                          <th className="h-8 px-3 text-right text-xs font-medium text-muted-foreground">Calibre</th>
                          <th className="h-8 px-3 text-right text-xs font-medium text-muted-foreground">Peso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loteMediciones.slice(0, 100).map((m: any, i: number) => (
                          <tr key={m.id_medicion || i} className="border-b hover:bg-muted/30">
                            <td className="px-3 py-1.5 text-xs font-mono">{m.planta_codigo || `PLT-${m.id_planta}`}</td>
                            <td className="px-3 py-1.5 text-xs text-muted-foreground">{m.fecha_medicion ? formatDate(m.fecha_medicion) : "-"}</td>
                            <td className="px-3 py-1.5 text-xs text-right tabular-nums">{m.brix != null ? formatNumber(m.brix, 1) : "-"}</td>
                            <td className="px-3 py-1.5 text-xs text-right tabular-nums">{m.firmeza != null ? formatNumber(m.firmeza, 1) : "-"}</td>
                            <td className="px-3 py-1.5 text-xs text-right tabular-nums">{m.calibre != null ? formatNumber(m.calibre, 1) : "-"}</td>
                            <td className="px-3 py-1.5 text-xs text-right tabular-nums">{m.peso != null ? formatNumber(m.peso, 1) : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Bulk actions floating bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-garces-cherry text-white rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-medium">
            <CheckSquare className="h-4 w-4 inline mr-1" />
            {selectedIds.size} seleccionado{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="h-5 w-px bg-white/30" />
          <button
            onClick={async () => {
              const ids = Array.from(selectedIds);
              const base = import.meta.env.VITE_API_BASE_URL || "/api/v1";
              try {
                const token = useAuthStore.getState().token;
              const resp = await fetch(`${base}/inventario/qr-batch`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify(ids),
                });
                if (resp.ok) {
                  const blob = await resp.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "qr-labels.pdf";
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success(`PDF con ${ids.length} etiquetas QR generado`);
                } else {
                  toast.error("Error al generar PDF de QR");
                }
              } catch {
                toast.error("Error de conexion al generar QR");
              }
            }}
            className="flex items-center gap-1.5 text-sm hover:bg-white/20 rounded-lg px-3 py-1.5 transition-colors"
          >
            <QrCode className="h-4 w-4" />
            Generar QR ({selectedIds.size})
          </button>
          <button
            onClick={() => {
              // Export selected as CSV
              const selected = filteredInventario.filter((l) => selectedIds.has(l.id_inventario));
              const headers = ["codigo_lote", "variedad", "portainjerto", "especie", "stock", "estado"];
              const rows = selected.map((l) => [
                l.codigo_lote,
                lk.variedad(l.id_variedad),
                lk.portainjerto(l.id_portainjerto),
                lk.especie(l.id_especie),
                l.cantidad_actual,
                l.estado,
              ].join(","));
              const csv = [headers.join(","), ...rows].join("\n");
              const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "inventario-seleccion.csv";
              a.click();
              URL.revokeObjectURL(url);
              toast.success(`${selected.length} lotes exportados`);
            }}
            className="flex items-center gap-1.5 text-sm hover:bg-white/20 rounded-lg px-3 py-1.5 transition-colors"
          >
            <FileDown className="h-4 w-4" />
            Exportar
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm hover:bg-white/20 rounded-lg px-2 py-1.5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <PlantWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />

      <CrudForm
        open={despachoOpen}
        onClose={() => setDespachoOpen(false)}
        onSubmit={async (data) => { await despachoMut.mutateAsync(data); }}
        fields={despachoFields}
        title="Nuevo Despacho a TestBlock"
        isLoading={despachoMut.isPending}
      />

      <CrudForm
        open={asignarLoteOpen}
        onClose={() => setAsignarLoteOpen(false)}
        onSubmit={async (data) => { await asignarLoteMut.mutateAsync(data); }}
        fields={[
          {
            key: "id_lote",
            label: "Lote de Inventario",
            type: "select",
            required: true,
            options: loteOpts,
            placeholder: "Seleccionar lote",
          },
        ]}
        title={`Asignar Lote a ${selectedPlantaIds.size} planta${selectedPlantaIds.size !== 1 ? "s" : ""}`}
        isLoading={asignarLoteMut.isPending}
      />
    </div>
  );
}
