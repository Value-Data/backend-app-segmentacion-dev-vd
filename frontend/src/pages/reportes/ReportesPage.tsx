import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileText, Sparkles, Package, TreePine, Grid3X3,
  FlaskConical, ClipboardList, Loader2, Sprout, BookOpen,
  Hammer, TrendingUp, ArrowRight, Download,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CrudTable } from "@/components/shared/CrudTable";
import { useLookups } from "@/hooks/useLookups";
import { mantenedorService } from "@/services/mantenedores";
import { inventarioService } from "@/services/inventario";
import { testblockService } from "@/services/testblock";
import { reportesService } from "@/services/reportes";
import type { VariedadReport, LoteReport, TestBlockReport } from "@/services/reportes";
import { formatDate, formatNumber } from "@/lib/utils";

/* ─── AI Analysis Card ─────────────────────────────────────────────────── */

function AIAnalysisCard({
  tipo,
  idEntidad,
  enabled,
}: {
  tipo: string;
  idEntidad: number | null;
  enabled: boolean;
}) {
  const [triggered, setTriggered] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      reportesService.aiAnalisis({
        tipo_reporte: tipo,
        id_entidad: idEntidad!,
      }),
  });

  const handleClick = () => {
    if (!idEntidad) return;
    setTriggered(true);
    mutation.mutate();
  };

  return (
    <div className="mt-6 flex gap-2">
      <Button
        onClick={handleClick}
        disabled={!enabled || mutation.isPending}
        className="bg-garces-cherry hover:bg-garces-cherry-dark text-white gap-2"
      >
        {mutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Analisis AI
      </Button>
      <Button
        variant="outline"
        onClick={() => idEntidad && reportesService.downloadPdf(tipo, idEntidad)}
        disabled={!enabled}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        Descargar PDF
      </Button>

      {triggered && mutation.isPending && (
        <div className="mt-4 rounded-lg border border-garces-cherry-pale bg-garces-cherry-pale/20 p-5">
          <div className="flex items-center gap-3 text-garces-cherry">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Generando analisis con IA...</span>
          </div>
        </div>
      )}

      {mutation.isError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">
            Error al generar analisis. Verifique que Azure OpenAI este configurado en .env
          </p>
        </div>
      )}

      {mutation.isSuccess && mutation.data && (
        <div className="mt-4 rounded-lg border border-garces-cherry/20 bg-gradient-to-br from-garces-cherry-pale/30 to-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3 text-garces-cherry">
            <Sparkles className="h-5 w-5" />
            <span className="font-semibold text-sm">Analisis Agronomico IA</span>
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {mutation.data.analisis}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tab: Variedad ────────────────────────────────────────────────────── */

function TabVariedad() {
  const lk = useLookups();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: variedades } = useQuery({
    queryKey: ["lookup", "variedades"],
    queryFn: () => mantenedorService("variedades").list(),
    staleTime: 5 * 60_000,
  });

  const { data: report, isLoading, isFetching } = useQuery({
    queryKey: ["reporte", "variedad", selectedId],
    queryFn: () => reportesService.variedad(selectedId!),
    enabled: selectedId !== null,
  });

  const inventarioColumns = [
    { accessorKey: "codigo_lote", header: "Codigo Lote" },
    {
      accessorKey: "cantidad_actual",
      header: "Stock Actual",
      cell: ({ getValue }: any) => formatNumber(getValue() as number),
    },
    {
      accessorKey: "cantidad_inicial",
      header: "Stock Inicial",
      cell: ({ getValue }: any) => formatNumber(getValue() as number),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ getValue }: any) => <StatusBadge status={getValue() as string} />,
    },
    {
      accessorKey: "fecha_ingreso",
      header: "Fecha Ingreso",
      cell: ({ getValue }: any) => formatDate(getValue() as string),
    },
  ];

  const plantacionesColumns = [
    { accessorKey: "codigo_unico", header: "Posicion" },
    { accessorKey: "testblock_nombre", header: "TestBlock" },
    { accessorKey: "hilera", header: "Hilera" },
    { accessorKey: "posicion", header: "Pos" },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ getValue }: any) => <StatusBadge status={getValue() as string} />,
    },
    {
      accessorKey: "fecha_plantacion",
      header: "Fecha Plantacion",
      cell: ({ getValue }: any) => formatDate(getValue() as string),
    },
  ];

  const medicionesColumns = [
    {
      accessorKey: "fecha_medicion",
      header: "Fecha",
      cell: ({ getValue }: any) => formatDate(getValue() as string),
    },
    { accessorKey: "temporada", header: "Temporada" },
    {
      accessorKey: "brix",
      header: "Brix",
      cell: ({ getValue }: any) =>
        getValue() != null ? formatNumber(getValue() as number, 1) : "-",
    },
    {
      accessorKey: "firmeza",
      header: "Firmeza",
      cell: ({ getValue }: any) =>
        getValue() != null ? formatNumber(getValue() as number, 1) : "-",
    },
    {
      accessorKey: "calibre",
      header: "Calibre",
      cell: ({ getValue }: any) =>
        getValue() != null ? formatNumber(getValue() as number, 1) : "-",
    },
    {
      accessorKey: "acidez",
      header: "Acidez",
      cell: ({ getValue }: any) =>
        getValue() != null ? formatNumber(getValue() as number, 2) : "-",
    },
    {
      accessorKey: "peso",
      header: "Peso",
      cell: ({ getValue }: any) =>
        getValue() != null ? formatNumber(getValue() as number, 1) : "-",
    },
  ];

  const varList = (variedades as any[] | undefined) || [];

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-md">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Seleccionar Variedad
          </label>
          <select
            className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:ring-1 focus:ring-garces-cherry outline-none"
            value={selectedId ?? ""}
            onChange={(e) =>
              setSelectedId(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">-- Seleccione --</option>
            {varList.map((v: any) => (
              <option key={v.id_variedad} value={v.id_variedad}>
                {v.nombre} ({v.codigo})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {(isLoading || isFetching) && selectedId && (
        <div className="flex items-center gap-2 text-garces-cherry py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Generando reporte...</span>
        </div>
      )}

      {/* Report */}
      {report && !isFetching && (
        <>
          {/* Header */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-garces-cherry-pale flex items-center justify-center">
                <Sprout className="h-5 w-5 text-garces-cherry" />
              </div>
              <div>
                <h3 className="font-bold text-lg">
                  {report.variedad.nombre as string}
                  <span className="text-muted-foreground font-normal text-sm ml-2">
                    ({report.variedad.codigo as string})
                  </span>
                </h3>
                <p className="text-sm text-muted-foreground">
                  {report.variedad.especie_nombre as string || "-"} ·{" "}
                  PMG: {report.variedad.pmg_nombre as string || "-"}
                </p>
              </div>
              <div className="ml-auto">
                <StatusBadge status={(report.variedad.estado as string) || "prospecto"} />
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              title="Plantas"
              value={report.plantaciones.length}
              icon={TreePine}
            />
            <KpiCard
              title="Lotes Activos"
              value={report.inventario.filter((l) => l.estado === "disponible").length}
              icon={Package}
            />
            <KpiCard
              title="Mediciones"
              value={report.mediciones.length}
              icon={FlaskConical}
            />
            <KpiCard
              title="Bitacoras"
              value={report.bitacora.length}
              icon={BookOpen}
            />
          </div>

          {/* Inventario */}
          <section>
            <h4 className="font-semibold text-sm text-garces-cherry mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Inventario ({report.inventario.length} lotes)
            </h4>
            <CrudTable
              data={report.inventario as any[]}
              columns={inventarioColumns}
              pageSize={10}
              searchPlaceholder="Buscar lotes..."
            />
          </section>

          {/* Plantaciones */}
          <section>
            <h4 className="font-semibold text-sm text-garces-cherry mb-2 flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" />
              Plantaciones ({report.plantaciones.length} posiciones)
            </h4>
            <CrudTable
              data={report.plantaciones as any[]}
              columns={plantacionesColumns}
              pageSize={10}
              searchPlaceholder="Buscar posiciones..."
            />
          </section>

          {/* Laboratorio */}
          <section>
            <h4 className="font-semibold text-sm text-garces-cherry mb-2 flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Mediciones de Laboratorio ({report.mediciones.length})
            </h4>
            <CrudTable
              data={report.mediciones as any[]}
              columns={medicionesColumns}
              pageSize={10}
              searchPlaceholder="Buscar mediciones..."
            />
          </section>

          {/* Bitacora */}
          <section>
            <h4 className="font-semibold text-sm text-garces-cherry mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Bitacora ({report.bitacora.length} entradas)
            </h4>
            {report.bitacora.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin entradas de bitacora
              </p>
            ) : (
              <div className="space-y-2">
                {report.bitacora.map((b: any) => (
                  <div
                    key={b.id_entrada}
                    className="flex gap-3 rounded-lg border bg-white p-3 shadow-sm"
                  >
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-garces-cherry mt-2" />
                      <div className="w-px flex-1 bg-border" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{b.titulo || "Sin titulo"}</span>
                        {b.tipo_entrada && <StatusBadge status={b.tipo_entrada} />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(b.fecha)} · {b.usuario || "Sistema"}
                      </p>
                      {b.contenido && (
                        <p className="text-xs mt-1 text-gray-600">{b.contenido}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Labores count */}
          <div className="rounded-lg border bg-white p-4 shadow-sm flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-garces-cherry-pale flex items-center justify-center">
              <Hammer className="h-5 w-5 text-garces-cherry" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Labores Registradas</p>
              <p className="text-lg font-bold">{report.labores_count}</p>
            </div>
          </div>

          {/* AI Analysis */}
          <AIAnalysisCard tipo="variedad" idEntidad={selectedId} enabled={!!report} />
        </>
      )}
    </div>
  );
}

/* ─── Tab: Lote ────────────────────────────────────────────────────────── */

function TabLote() {
  const lk = useLookups();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: lotes } = useQuery({
    queryKey: ["inventario", "list"],
    queryFn: () => inventarioService.list(),
    staleTime: 5 * 60_000,
  });

  const { data: report, isLoading, isFetching } = useQuery({
    queryKey: ["reporte", "lote", selectedId],
    queryFn: () => reportesService.lote(selectedId!),
    enabled: selectedId !== null,
  });

  const movimientosColumns = [
    {
      accessorKey: "fecha_movimiento",
      header: "Fecha",
      cell: ({ getValue }: any) => formatDate(getValue() as string),
    },
    {
      accessorKey: "tipo",
      header: "Tipo",
      cell: ({ getValue }: any) => <StatusBadge status={getValue() as string} />,
    },
    {
      accessorKey: "cantidad",
      header: "Cantidad",
      cell: ({ getValue }: any) => formatNumber(getValue() as number),
    },
    {
      accessorKey: "saldo_anterior",
      header: "Saldo Ant.",
      cell: ({ getValue }: any) =>
        getValue() != null ? formatNumber(getValue() as number) : "-",
    },
    {
      accessorKey: "saldo_nuevo",
      header: "Saldo Nuevo",
      cell: ({ getValue }: any) =>
        getValue() != null ? formatNumber(getValue() as number) : "-",
    },
    { accessorKey: "motivo", header: "Motivo" },
    { accessorKey: "usuario", header: "Usuario" },
  ];

  const plantasColumns = [
    { accessorKey: "codigo", header: "Codigo" },
    {
      accessorKey: "id_variedad",
      header: "Variedad",
      cell: ({ getValue }: any) => lk.variedad(getValue()),
    },
    {
      accessorKey: "id_portainjerto",
      header: "Portainjerto",
      cell: ({ getValue }: any) => lk.portainjerto(getValue()),
    },
    { accessorKey: "condicion", header: "Condicion" },
    {
      accessorKey: "activa",
      header: "Activa",
      cell: ({ getValue }: any) =>
        getValue() ? (
          <StatusBadge status="activa" />
        ) : (
          <StatusBadge status="baja" />
        ),
    },
    { accessorKey: "ano_plantacion", header: "Anio Plant." },
  ];

  const loteList = (lotes as any[] | undefined) || [];

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-md">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Seleccionar Lote
          </label>
          <select
            className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:ring-1 focus:ring-garces-cherry outline-none"
            value={selectedId ?? ""}
            onChange={(e) =>
              setSelectedId(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">-- Seleccione --</option>
            {loteList.map((l: any) => (
              <option key={l.id_inventario} value={l.id_inventario}>
                {l.codigo_lote} - {lk.variedad(l.id_variedad)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {(isLoading || isFetching) && selectedId && (
        <div className="flex items-center gap-2 text-garces-cherry py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Generando reporte...</span>
        </div>
      )}

      {/* Report */}
      {report && !isFetching && (
        <>
          {/* Header */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-garces-cherry-pale flex items-center justify-center">
                <Package className="h-5 w-5 text-garces-cherry" />
              </div>
              <div>
                <h3 className="font-bold text-lg">
                  Lote {report.lote.codigo_lote as string}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Variedad: {report.lote.variedad_nombre as string || "-"} ·{" "}
                  Portainjerto: {report.lote.portainjerto_nombre as string || "-"}
                </p>
              </div>
              <div className="ml-auto">
                <StatusBadge status={(report.lote.estado as string) || "disponible"} />
              </div>
            </div>
          </div>

          {/* Stock lifecycle bar */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h4 className="text-xs font-medium text-muted-foreground mb-3">
              Ciclo de Stock
            </h4>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-garces-cherry">
                  {formatNumber(report.lote.cantidad_inicial as number)}
                </p>
                <p className="text-xs text-muted-foreground">Inicial</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {formatNumber(report.lote.cantidad_actual as number)}
                </p>
                <p className="text-xs text-muted-foreground">Actual</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {report.plantas.length}
                </p>
                <p className="text-xs text-muted-foreground">Plantas Creadas</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-garces-cherry rounded-full transition-all"
                style={{
                  width: `${
                    (report.lote.cantidad_inicial as number) > 0
                      ? ((report.lote.cantidad_actual as number) /
                          (report.lote.cantidad_inicial as number)) *
                        100
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(report.lote.cantidad_inicial as number) > 0
                ? `${(
                    ((report.lote.cantidad_actual as number) /
                      (report.lote.cantidad_inicial as number)) *
                    100
                  ).toFixed(1)}% stock restante`
                : "Sin stock inicial"}
            </p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              title="Movimientos"
              value={report.movimientos.length}
              icon={TrendingUp}
            />
            <KpiCard
              title="Destinos"
              value={report.destinos.length}
              icon={Grid3X3}
            />
            <KpiCard
              title="Plantas Creadas"
              value={report.plantas.length}
              icon={TreePine}
            />
            <KpiCard
              title="Fecha Ingreso"
              value={formatDate(report.lote.fecha_ingreso as string)}
              icon={ClipboardList}
            />
          </div>

          {/* Kardex */}
          <section>
            <h4 className="font-semibold text-sm text-garces-cherry mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Kardex - Movimientos ({report.movimientos.length})
            </h4>
            <CrudTable
              data={report.movimientos as any[]}
              columns={movimientosColumns}
              pageSize={10}
              searchPlaceholder="Buscar movimientos..."
            />
          </section>

          {/* Plantas individuales */}
          <section>
            <h4 className="font-semibold text-sm text-garces-cherry mb-2 flex items-center gap-2">
              <TreePine className="h-4 w-4" />
              Plantas Individuales ({report.plantas.length})
            </h4>
            <CrudTable
              data={report.plantas as any[]}
              columns={plantasColumns}
              pageSize={10}
              searchPlaceholder="Buscar plantas..."
            />
          </section>

          {/* AI Analysis */}
          <AIAnalysisCard tipo="lote" idEntidad={selectedId} enabled={!!report} />
        </>
      )}
    </div>
  );
}

/* ─── Tab: TestBlock ───────────────────────────────────────────────────── */

function TabTestBlock() {
  const lk = useLookups();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: testblocks } = useQuery({
    queryKey: ["testblocks", "list"],
    queryFn: () => testblockService.list(),
    staleTime: 5 * 60_000,
  });

  const { data: report, isLoading, isFetching } = useQuery({
    queryKey: ["reporte", "testblock", selectedId],
    queryFn: () => reportesService.testblock(selectedId!),
    enabled: selectedId !== null,
  });

  const variedadesColumns = [
    { accessorKey: "nombre", header: "Variedad" },
    {
      accessorKey: "cantidad",
      header: "Cantidad",
      cell: ({ getValue }: any) => formatNumber(getValue() as number),
    },
  ];

  const medicionesColumns = [
    {
      accessorKey: "fecha_medicion",
      header: "Fecha",
      cell: ({ getValue }: any) => formatDate(getValue() as string),
    },
    { accessorKey: "temporada", header: "Temporada" },
    {
      accessorKey: "brix",
      header: "Brix",
      cell: ({ getValue }: any) =>
        getValue() != null ? formatNumber(getValue() as number, 1) : "-",
    },
    {
      accessorKey: "firmeza",
      header: "Firmeza",
      cell: ({ getValue }: any) =>
        getValue() != null ? formatNumber(getValue() as number, 1) : "-",
    },
    {
      accessorKey: "calibre",
      header: "Calibre",
      cell: ({ getValue }: any) =>
        getValue() != null ? formatNumber(getValue() as number, 1) : "-",
    },
    {
      accessorKey: "acidez",
      header: "Acidez",
      cell: ({ getValue }: any) =>
        getValue() != null ? formatNumber(getValue() as number, 2) : "-",
    },
  ];

  const laboresColumns = [
    {
      accessorKey: "fecha_ejecucion",
      header: "Fecha",
      cell: ({ getValue }: any) => formatDate(getValue() as string),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ getValue }: any) => <StatusBadge status={getValue() as string} />,
    },
    { accessorKey: "ejecutor", header: "Ejecutor" },
    { accessorKey: "temporada", header: "Temporada" },
    { accessorKey: "observaciones", header: "Observaciones" },
  ];

  const tbList = (testblocks as any[] | undefined) || [];

  const totalPosiciones = report
    ? Object.values(report.posiciones_resumen).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-md">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Seleccionar TestBlock
          </label>
          <select
            className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:ring-1 focus:ring-garces-cherry outline-none"
            value={selectedId ?? ""}
            onChange={(e) =>
              setSelectedId(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">-- Seleccione --</option>
            {tbList.map((tb: any) => (
              <option key={tb.id_testblock} value={tb.id_testblock}>
                {tb.nombre} ({tb.codigo})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {(isLoading || isFetching) && selectedId && (
        <div className="flex items-center gap-2 text-garces-cherry py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Generando reporte...</span>
        </div>
      )}

      {/* Report */}
      {report && !isFetching && (
        <>
          {/* Header */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-garces-cherry-pale flex items-center justify-center">
                <Grid3X3 className="h-5 w-5 text-garces-cherry" />
              </div>
              <div>
                <h3 className="font-bold text-lg">
                  {report.testblock.nombre as string}
                  <span className="text-muted-foreground font-normal text-sm ml-2">
                    ({report.testblock.codigo as string})
                  </span>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Campo: {report.testblock.campo_nombre as string || "-"}
                </p>
              </div>
              <div className="ml-auto">
                <StatusBadge status={(report.testblock.estado as string) || "activo"} />
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              title="Total Posiciones"
              value={totalPosiciones}
              icon={Grid3X3}
            />
            <KpiCard
              title="Alta"
              value={report.posiciones_resumen["alta"] || 0}
              icon={Sprout}
            />
            <KpiCard
              title="Baja"
              value={report.posiciones_resumen["baja"] || 0}
              icon={TreePine}
            />
            <KpiCard
              title="Vacia"
              value={report.posiciones_resumen["vacia"] || 0}
              icon={Grid3X3}
            />
          </div>

          {/* Position summary visual */}
          {totalPosiciones > 0 && (
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <h4 className="text-xs font-medium text-muted-foreground mb-3">
                Distribucion de Posiciones
              </h4>
              <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
                {Object.entries(report.posiciones_resumen).map(([estado, count]) => {
                  const pct = (count / totalPosiciones) * 100;
                  const colorMap: Record<string, string> = {
                    alta: "bg-green-500",
                    baja: "bg-red-400",
                    vacia: "bg-gray-300",
                    replante: "bg-blue-400",
                  };
                  return (
                    <div
                      key={estado}
                      className={`${colorMap[estado] || "bg-gray-400"} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${estado}: ${count} (${pct.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>
              <div className="flex gap-4 mt-2">
                {Object.entries(report.posiciones_resumen).map(([estado, count]) => {
                  const dotColor: Record<string, string> = {
                    alta: "bg-green-500",
                    baja: "bg-red-400",
                    vacia: "bg-gray-300",
                    replante: "bg-blue-400",
                  };
                  return (
                    <div key={estado} className="flex items-center gap-1 text-xs text-muted-foreground">
                      <div className={`h-2 w-2 rounded-full ${dotColor[estado] || "bg-gray-400"}`} />
                      {estado}: {count}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Variedades */}
          <section>
            <h4 className="font-semibold text-sm text-garces-cherry mb-2 flex items-center gap-2">
              <Sprout className="h-4 w-4" />
              Variedades Presentes ({report.variedades.length})
            </h4>
            <CrudTable
              data={report.variedades}
              columns={variedadesColumns}
              pageSize={10}
              searchPlaceholder="Buscar variedades..."
            />
          </section>

          {/* Lab results */}
          <section>
            <h4 className="font-semibold text-sm text-garces-cherry mb-2 flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Mediciones de Laboratorio ({report.mediciones.length})
            </h4>
            <CrudTable
              data={report.mediciones as any[]}
              columns={medicionesColumns}
              pageSize={10}
              searchPlaceholder="Buscar mediciones..."
            />
          </section>

          {/* Labores */}
          <section>
            <h4 className="font-semibold text-sm text-garces-cherry mb-2 flex items-center gap-2">
              <Hammer className="h-4 w-4" />
              Labores ({report.labores.length})
            </h4>
            <CrudTable
              data={report.labores as any[]}
              columns={laboresColumns}
              pageSize={10}
              searchPlaceholder="Buscar labores..."
            />
          </section>

          {/* AI Analysis */}
          <AIAnalysisCard tipo="testblock" idEntidad={selectedId} enabled={!!report} />
        </>
      )}
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────────── */

export function ReportesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-garces-cherry-pale flex items-center justify-center">
          <FileText className="h-5 w-5 text-garces-cherry" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-garces-cherry">Reportes y Gestion</h2>
          <p className="text-sm text-muted-foreground">
            Reportes cruzados con analisis AI integrado
          </p>
        </div>
      </div>

      <Tabs defaultValue="variedad">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="variedad" className="gap-1">
            <Sprout className="h-3.5 w-3.5" />
            Por Variedad
          </TabsTrigger>
          <TabsTrigger value="lote" className="gap-1">
            <Package className="h-3.5 w-3.5" />
            Por Lote
          </TabsTrigger>
          <TabsTrigger value="testblock" className="gap-1">
            <Grid3X3 className="h-3.5 w-3.5" />
            Por TestBlock
          </TabsTrigger>
        </TabsList>

        <TabsContent value="variedad">
          <TabVariedad />
        </TabsContent>
        <TabsContent value="lote">
          <TabLote />
        </TabsContent>
        <TabsContent value="testblock">
          <TabTestBlock />
        </TabsContent>
      </Tabs>
    </div>
  );
}
