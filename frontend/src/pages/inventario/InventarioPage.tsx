import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Package, TrendingUp, Truck, Warehouse, AlertTriangle, Sprout } from "lucide-react";
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

/** Mini progress bar for stock level */
function StockBar({ actual, inicial }: { actual: number; inicial: number }) {
  const pct = inicial > 0 ? Math.round((actual / inicial) * 100) : 0;
  const color =
    pct > 50 ? "bg-green-500" : pct > 20 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <span className="font-medium tabular-nums w-12 text-right">
        {formatNumber(actual)}
      </span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full min-w-[60px] max-w-[80px]">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8">{pct}%</span>
    </div>
  );
}

export function InventarioPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [despachoOpen, setDespachoOpen] = useState(false);
  const [selectedBodega, setSelectedBodega] = useState<number | "todas">("todas");
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
    { accessorKey: "id_variedad", header: "Variedad", cell: ({ getValue }: any) => lk.variedad(getValue()) },
    {
      accessorKey: "id_portainjerto",
      header: "Portainjerto",
      cell: ({ getValue }: any) => lk.portainjerto(getValue()),
    },
    { accessorKey: "id_especie", header: "Especie", cell: ({ getValue }: any) => lk.especie(getValue()) },
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

  // Filter lotes by selected bodega
  const filteredInventario = useMemo(() => {
    if (!inventario) return [];
    const all = inventario as InventarioVivero[];
    if (selectedBodega === "todas") return all;
    if (selectedBodega === 0) {
      return all.filter((l) => !l.id_bodega || l.id_bodega === 0);
    }
    return all.filter((l) => l.id_bodega === selectedBodega);
  }, [inventario, selectedBodega]);

  // Count bodegas with stock
  const bodegasConStock = useMemo(() => {
    return (bodegaStock || []).filter((b: BodegaStock) => b.total_stock > 0).length;
  }, [bodegaStock]);

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

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Stock Total" value={formatNumber(stats.total_stock)} icon={TrendingUp} />
          <KpiCard title="Total Lotes" value={stats.total_lotes} icon={Package} />
          <KpiCard title="Bodegas con Stock" value={bodegasConStock} icon={Warehouse} />
          <KpiCard title="Agotados" value={stats.lotes_agotados} icon={AlertTriangle} />
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
          Todas ({(inventario as InventarioVivero[])?.length || 0})
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
            {bod.nombre} ({bod.total_stock})
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
            searchPlaceholder="Buscar lote, variedad..."
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
