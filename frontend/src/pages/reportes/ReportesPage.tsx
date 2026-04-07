import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileText, Sparkles, Package, TreePine, Grid3X3,
  FlaskConical, ClipboardList, Loader2, Sprout, BookOpen,
  Hammer, TrendingUp, ArrowRight, Download, Filter, X,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

/* ─── Shared filter types ─────────────────────────────────────────────── */

interface ReportFilters {
  temporada: string;
  especie: string;
  campo: string;
  pmg: string;
  variedad: string;
  testblock: string;
}

const EMPTY_FILTERS: ReportFilters = {
  temporada: "",
  especie: "",
  campo: "",
  pmg: "",
  variedad: "",
  testblock: "",
};

/* ─── Inline filter select (same style as LaboratorioPage) ────────────── */

function InlineFilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Todos",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: number | string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <Select value={value} onValueChange={(v) => onChange(v === "__all__" ? "" : v)}>
        <SelectTrigger className="h-8 min-w-[120px] text-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{placeholder}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={String(o.value)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ─── FilterBar component ─────────────────────────────────────────────── */

function FilterBar({
  filters,
  onChange,
}: {
  filters: ReportFilters;
  onChange: (f: ReportFilters) => void;
}) {
  const lk = useLookups();

  // Cascading: variedades filtered by especie & pmg
  const filteredVariedadOptions = useMemo(() => {
    if (!lk.rawData.variedades) return lk.options.variedades;
    let list = lk.rawData.variedades as any[];
    if (filters.especie) {
      const espId = Number(filters.especie);
      list = list.filter((v: any) => v.id_especie === espId);
    }
    if (filters.pmg) {
      const pmgId = Number(filters.pmg);
      list = list.filter((v: any) => v.id_pmg === pmgId);
    }
    return list.map((v: any) => ({
      value: v.id_variedad as number,
      label: v.nombre as string,
    }));
  }, [filters.especie, filters.pmg, lk.rawData.variedades, lk.options.variedades]);

  // Cascading: testblocks filtered by campo
  const { data: allTestblocks } = useQuery({
    queryKey: ["testblocks", "list"],
    queryFn: () => testblockService.list(),
    staleTime: 5 * 60_000,
  });

  const filteredTestblockOptions = useMemo(() => {
    const tbList = (allTestblocks as any[] | undefined) || [];
    let list = tbList;
    if (filters.campo) {
      const campoId = Number(filters.campo);
      list = list.filter((tb: any) => tb.id_campo === campoId);
    }
    return list.map((tb: any) => ({
      value: tb.id_testblock as number,
      label: `${tb.nombre} (${tb.codigo})`,
    }));
  }, [filters.campo, allTestblocks]);

  const update = useCallback(
    (key: keyof ReportFilters, value: string) => {
      const next = { ...filters, [key]: value };
      // Cascade resets
      if (key === "especie") {
        next.variedad = "";
      }
      if (key === "campo") {
        next.testblock = "";
      }
      if (key === "pmg") {
        next.variedad = "";
      }
      onChange(next);
    },
    [filters, onChange],
  );

  const hasAnyFilter = Object.values(filters).some((v) => v !== "");

  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 mr-1 self-end pb-1">
          <Filter className="h-3.5 w-3.5 text-garces-cherry" />
          <span className="text-[9px] font-semibold text-garces-cherry uppercase tracking-wider">
            Filtros
          </span>
        </div>

        <InlineFilterSelect
          label="Temporada"
          value={filters.temporada}
          onChange={(v) => update("temporada", v)}
          options={lk.options.temporadas.map((o) => ({ value: o.label, label: o.label }))}
          placeholder="Todas"
        />
        <InlineFilterSelect
          label="Especie"
          value={filters.especie}
          onChange={(v) => update("especie", v)}
          options={lk.options.especies}
          placeholder="Todas"
        />
        <InlineFilterSelect
          label="Campo"
          value={filters.campo}
          onChange={(v) => update("campo", v)}
          options={lk.options.campos}
          placeholder="Todos"
        />
        <InlineFilterSelect
          label="PMG"
          value={filters.pmg}
          onChange={(v) => update("pmg", v)}
          options={lk.options.pmgs}
          placeholder="Todos"
        />
        <InlineFilterSelect
          label="Variedad"
          value={filters.variedad}
          onChange={(v) => update("variedad", v)}
          options={filteredVariedadOptions}
          placeholder="Todas"
        />
        <InlineFilterSelect
          label="TestBlock"
          value={filters.testblock}
          onChange={(v) => update("testblock", v)}
          options={filteredTestblockOptions}
          placeholder="Todos"
        />

        {hasAnyFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...EMPTY_FILTERS })}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-garces-cherry gap-1 self-end"
          >
            <X className="h-3 w-3" />
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── AI Analysis Card ─────────────────────────────────────────────────── */

const DETAIL_LEVELS = [
  { value: "ejecutivo", label: "Resumen Ejecutivo", desc: "3-5 lineas con conclusion y recomendacion clave" },
  { value: "estandar", label: "Informe Estandar", desc: "Evaluacion completa con datos y recomendaciones" },
  { value: "detallado", label: "Informe Detallado", desc: "Analisis profundo con comparaciones y tendencias" },
] as const;

const DETAIL_PROMPTS: Record<string, string> = {
  ejecutivo: "Genera SOLO un resumen ejecutivo de 3-5 lineas con la conclusion principal y la recomendacion clave. Se muy conciso y directo.",
  estandar: "Genera un informe estandar con todas las secciones: resumen ejecutivo, evaluacion de cosecha, susceptibilidad, y recomendaciones concretas.",
  detallado: "Genera un informe detallado y exhaustivo. Incluye comparaciones entre campos, tendencias temporales, analisis de cada metrica, susceptibilidad a defectos con porcentajes, evaluacion poscosecha completa, y recomendaciones especificas para plantacion, manejo, comercializacion y proxima temporada.",
};

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
  const [detailLevel, setDetailLevel] = useState<string>("estandar");

  const mutation = useMutation({
    mutationFn: () =>
      reportesService.aiAnalisis({
        tipo_reporte: tipo,
        id_entidad: idEntidad!,
        pregunta: DETAIL_PROMPTS[detailLevel],
      }),
  });

  const handleClick = () => {
    if (!idEntidad) return;
    setTriggered(true);
    mutation.mutate();
  };

  return (
    <div className="mt-6 space-y-3">
      {/* Detail level selector + buttons */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Nivel de detalle
          </label>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {DETAIL_LEVELS.map((lvl) => (
              <button
                key={lvl.value}
                onClick={() => setDetailLevel(lvl.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  detailLevel === lvl.value
                    ? "bg-garces-cherry text-white"
                    : "bg-white text-muted-foreground hover:bg-muted/50"
                }`}
                title={lvl.desc}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

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
          Generar Analisis
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
      </div>

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

function TabVariedad({ filters }: { filters: ReportFilters }) {
  const lk = useLookups();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Derive selected variedad from filters or local selection
  const activeVariedadId = filters.variedad
    ? Number(filters.variedad)
    : selectedId;

  const { data: variedades } = useQuery({
    queryKey: ["lookup", "variedades"],
    queryFn: () => mantenedorService("variedades").list(),
    staleTime: 5 * 60_000,
  });

  const { data: report, isLoading, isFetching } = useQuery({
    queryKey: ["reporte", "variedad", activeVariedadId],
    queryFn: () => reportesService.variedad(activeVariedadId!),
    enabled: activeVariedadId !== null,
  });

  // Filtered list of variedades matching the global filters (especie, pmg)
  const filteredVarList = useMemo(() => {
    const list = (variedades as any[] | undefined) || [];
    return list.filter((v: any) => {
      if (filters.especie && String(v.id_especie) !== filters.especie) return false;
      if (filters.pmg && String(v.id_pmg) !== filters.pmg) return false;
      return true;
    });
  }, [variedades, filters.especie, filters.pmg]);

  // Columns for the summary list table
  const variedadListColumns = [
    { accessorKey: "codigo", header: "Codigo" },
    { accessorKey: "nombre", header: "Nombre" },
    {
      accessorKey: "id_especie",
      header: "Especie",
      cell: ({ getValue }: any) => lk.especie(getValue()),
    },
    {
      accessorKey: "id_pmg",
      header: "PMG",
      cell: ({ getValue }: any) => lk.pmg(getValue()),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ getValue }: any) => (
        <StatusBadge status={(getValue() as string) || "prospecto"} />
      ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }: any) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-garces-cherry hover:bg-garces-cherry-pale gap-1"
          onClick={() => setSelectedId(row.original.id_variedad)}
        >
          <ArrowRight className="h-3 w-3" />
          Ver Reporte
        </Button>
      ),
    },
  ];

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

  // If no variedad is selected, show the filtered list
  if (!activeVariedadId) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Sprout className="h-4 w-4 text-garces-cherry" />
            <h4 className="font-semibold text-sm text-garces-cherry">
              Variedades
              {(filters.especie || filters.pmg) && (
                <span className="font-normal text-muted-foreground ml-2">
                  ({filteredVarList.length} resultados con filtros aplicados)
                </span>
              )}
            </h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Seleccione una variedad de los filtros superiores o haga clic en "Ver Reporte" para generar el informe completo.
          </p>
          <CrudTable
            data={filteredVarList}
            columns={variedadListColumns as any}
            pageSize={15}
            searchPlaceholder="Buscar variedad..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back to list button when viewing detail via local selection */}
      {!filters.variedad && selectedId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedId(null)}
          className="text-xs text-muted-foreground hover:text-garces-cherry gap-1"
        >
          <ArrowRight className="h-3 w-3 rotate-180" />
          Volver al listado
        </Button>
      )}

      {/* Loading */}
      {(isLoading || isFetching) && activeVariedadId && (
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
          <AIAnalysisCard tipo="variedad" idEntidad={activeVariedadId} enabled={!!report} />
        </>
      )}
    </div>
  );
}

/* ─── Tab: Lote ────────────────────────────────────────────────────────── */

function TabLote({ filters }: { filters: ReportFilters }) {
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

  // Filtered list of lotes matching the global filters
  const filteredLoteList = useMemo(() => {
    const list = (lotes as any[] | undefined) || [];
    return list.filter((l: any) => {
      if (filters.especie && String(l.id_especie) !== filters.especie) return false;
      if (filters.pmg && String(l.id_pmg) !== filters.pmg) return false;
      if (filters.variedad && String(l.id_variedad) !== filters.variedad) return false;
      return true;
    });
  }, [lotes, filters.especie, filters.pmg, filters.variedad]);

  // Columns for the summary list table
  const loteListColumns = [
    { accessorKey: "codigo_lote", header: "Codigo Lote" },
    {
      accessorKey: "id_variedad",
      header: "Variedad",
      cell: ({ getValue }: any) => lk.variedad(getValue()),
    },
    {
      accessorKey: "id_especie",
      header: "Especie",
      cell: ({ getValue }: any) => lk.especie(getValue()),
    },
    {
      accessorKey: "cantidad_actual",
      header: "Stock Actual",
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
    {
      id: "acciones",
      header: "",
      cell: ({ row }: any) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-garces-cherry hover:bg-garces-cherry-pale gap-1"
          onClick={() => setSelectedId(row.original.id_inventario)}
        >
          <ArrowRight className="h-3 w-3" />
          Ver Reporte
        </Button>
      ),
    },
  ];

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

  // If no lote is selected, show the filtered list
  if (!selectedId) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-garces-cherry" />
            <h4 className="font-semibold text-sm text-garces-cherry">
              Lotes de Inventario
              {(filters.especie || filters.variedad || filters.pmg) && (
                <span className="font-normal text-muted-foreground ml-2">
                  ({filteredLoteList.length} resultados con filtros aplicados)
                </span>
              )}
            </h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Use los filtros superiores para acotar los lotes, luego haga clic en "Ver Reporte" para el detalle completo.
          </p>
          <CrudTable
            data={filteredLoteList}
            columns={loteListColumns as any}
            pageSize={15}
            searchPlaceholder="Buscar lote..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back to list */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setSelectedId(null)}
        className="text-xs text-muted-foreground hover:text-garces-cherry gap-1"
      >
        <ArrowRight className="h-3 w-3 rotate-180" />
        Volver al listado
      </Button>

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

function TabTestBlock({ filters }: { filters: ReportFilters }) {
  const lk = useLookups();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Derive selected testblock from filters or local selection
  const activeTestblockId = filters.testblock
    ? Number(filters.testblock)
    : selectedId;

  const { data: testblocks } = useQuery({
    queryKey: ["testblocks", "list"],
    queryFn: () => testblockService.list(),
    staleTime: 5 * 60_000,
  });

  const { data: report, isLoading, isFetching } = useQuery({
    queryKey: ["reporte", "testblock", activeTestblockId],
    queryFn: () => reportesService.testblock(activeTestblockId!),
    enabled: activeTestblockId !== null,
  });

  // Filtered testblock list matching global filters
  const filteredTbList = useMemo(() => {
    const list = (testblocks as any[] | undefined) || [];
    return list.filter((tb: any) => {
      if (filters.campo && String(tb.id_campo) !== filters.campo) return false;
      return true;
    });
  }, [testblocks, filters.campo]);

  // Columns for the summary list table
  const tbListColumns = [
    { accessorKey: "codigo", header: "Codigo" },
    { accessorKey: "nombre", header: "Nombre" },
    {
      accessorKey: "id_campo",
      header: "Campo",
      cell: ({ getValue }: any) => lk.campo(getValue()),
    },
    {
      accessorKey: "total_posiciones",
      header: "Posiciones",
      cell: ({ getValue }: any) =>
        getValue() != null ? formatNumber(getValue() as number) : "-",
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ getValue }: any) => (
        <StatusBadge status={(getValue() as string) || "activo"} />
      ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }: any) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-garces-cherry hover:bg-garces-cherry-pale gap-1"
          onClick={() => setSelectedId(row.original.id_testblock)}
        >
          <ArrowRight className="h-3 w-3" />
          Ver Reporte
        </Button>
      ),
    },
  ];

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

  const totalPosiciones = report
    ? Object.values(report.posiciones_resumen).reduce((a, b) => a + b, 0)
    : 0;

  // If no testblock is selected, show filtered list
  if (!activeTestblockId) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Grid3X3 className="h-4 w-4 text-garces-cherry" />
            <h4 className="font-semibold text-sm text-garces-cherry">
              TestBlocks
              {filters.campo && (
                <span className="font-normal text-muted-foreground ml-2">
                  ({filteredTbList.length} resultados con filtros aplicados)
                </span>
              )}
            </h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Use los filtros superiores (Campo, TestBlock) para acotar, luego haga clic en "Ver Reporte" para el detalle completo.
          </p>
          <CrudTable
            data={filteredTbList}
            columns={tbListColumns as any}
            pageSize={15}
            searchPlaceholder="Buscar testblock..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back to list when viewing detail via local selection */}
      {!filters.testblock && selectedId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedId(null)}
          className="text-xs text-muted-foreground hover:text-garces-cherry gap-1"
        >
          <ArrowRight className="h-3 w-3 rotate-180" />
          Volver al listado
        </Button>
      )}

      {/* Loading */}
      {(isLoading || isFetching) && activeTestblockId && (
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
          <AIAnalysisCard tipo="testblock" idEntidad={activeTestblockId} enabled={!!report} />
        </>
      )}
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────────── */

/* ─── Tab Evaluacion Cosecha (interactive report builder with AI) ─────── */

function TabEvaluacionCosecha({ filters }: { filters: ReportFilters }) {
  const lk = useLookups();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [nivel, setNivel] = useState<"alto" | "bajo">("alto");

  const { data: variedades } = useQuery({
    queryKey: ["variedades"],
    queryFn: () => mantenedorService("variedades").list(),
  });

  const filtered = useMemo(() => {
    let items = (variedades || []) as any[];
    if (filters.especie) items = items.filter((v: any) => String(v.id_especie) === filters.especie);
    if (filters.pmg) items = items.filter((v: any) => String(v.id_pmg) === filters.pmg);
    return items.filter((v: any) => v.activo !== false);
  }, [variedades, filters.especie, filters.pmg]);

  const selectedNames = useMemo(() => {
    return filtered
      .filter((v: any) => selectedIds.has(v.id_variedad))
      .map((v: any) => v.nombre)
      .join(", ");
  }, [filtered, selectedIds]);

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAI = async () => {
    if (selectedIds.size === 0) return;
    setAiLoading(true);
    setAiResponse("");
    try {
      const pregunta = aiPrompt
        || (nivel === "alto"
          ? `Genera un resumen ejecutivo de alto nivel de las variedades: ${selectedNames}. Incluye conclusiones y recomendaciones clave para la toma de decisiones.`
          : `Genera un analisis detallado de bajo nivel con todos los parametros de cosecha de las variedades: ${selectedNames}. Incluye firmeza por punto, distribucion de calibre, color de cubrimiento, SS%, acidez, y comparacion entre portainjertos.`);
      const ids = Array.from(selectedIds);
      // Use first selected variedad for the AI context
      const res = await reportesService.aiAnalisis({
        tipo_reporte: "variedad",
        id_entidad: ids[0],
        pregunta,
      });
      setAiResponse(res.analisis);
    } catch (e: any) {
      setAiResponse("Error: " + (e?.message || "No se pudo generar el analisis"));
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerate = async (tipo: "evaluacion" | "resumen") => {
    if (selectedIds.size === 0) return;
    setGenerating(true);
    try {
      const params = {
        variedad_ids: Array.from(selectedIds),
        temporada: filters.temporada || undefined,
        campo: filters.campo ? Number(filters.campo) : undefined,
        incluir_ia: true,
      };
      if (tipo === "evaluacion") {
        await reportesService.downloadEvaluacionCosecha(params);
      } else {
        await reportesService.downloadResumenCosechas(params);
      }
    } catch (e: any) {
      const { default: toast } = await import("react-hot-toast");
      toast.error("Error generando reporte: " + (e?.message || "desconocido"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Step 1: Select varieties */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <span className="bg-garces-cherry text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
          Seleccionar variedades
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {filtered.map((v: any) => {
            const isSelected = selectedIds.has(v.id_variedad);
            return (
              <div
                key={v.id_variedad}
                className={`rounded-lg border-2 p-2 cursor-pointer transition-all text-xs ${
                  isSelected ? "border-garces-cherry bg-garces-cherry/5" : "border-gray-100 hover:border-gray-300"
                }`}
                onClick={() => toggle(v.id_variedad)}
              >
                <div className="flex items-center gap-1.5">
                  <input type="checkbox" checked={isSelected} readOnly className="rounded text-garces-cherry h-3.5 w-3.5" />
                  <span className="font-semibold truncate">{v.nombre}</span>
                </div>
                <p className="text-[10px] text-muted-foreground ml-5">{lk.especie(v.id_especie)}</p>
              </div>
            );
          })}
        </div>
        {selectedIds.size > 0 && (
          <p className="text-xs text-garces-cherry font-medium">{selectedIds.size} seleccionadas: {selectedNames}</p>
        )}
      </div>

      {/* Step 2: AI Analysis (interactive) */}
      {selectedIds.size > 0 && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <span className="bg-garces-cherry text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
            Analisis con IA
          </h3>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex bg-muted rounded-md p-0.5">
              <button
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${nivel === "alto" ? "bg-white shadow text-garces-cherry" : "text-muted-foreground"}`}
                onClick={() => setNivel("alto")}
              >
                Alto nivel (ejecutivo)
              </button>
              <button
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${nivel === "bajo" ? "bg-white shadow text-garces-cherry" : "text-muted-foreground"}`}
                onClick={() => setNivel("bajo")}
              >
                Bajo nivel (detallado)
              </button>
            </div>
            <Button size="sm" onClick={handleAI} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              {aiLoading ? "Analizando..." : "Generar analisis"}
            </Button>
          </div>

          <div className="space-y-2">
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px]"
              placeholder="Personaliza tu consulta... (opcional). Ej: 'Compara firmeza entre portainjertos Gisela 6 y Maxma 14 para las variedades seleccionadas'"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
          </div>

          {aiResponse && (
            <div className="bg-gray-50 border rounded-lg p-4 prose prose-sm max-w-none">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span className="font-semibold text-xs text-purple-600">Analisis IA</span>
              </div>
              <div className="whitespace-pre-wrap text-sm">{aiResponse}</div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Download PDF */}
      {selectedIds.size > 0 && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <span className="bg-garces-cherry text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">3</span>
            Descargar reporte PDF
          </h3>
          <div className="flex gap-3">
            <Button disabled={generating} onClick={() => handleGenerate("evaluacion")}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
              Evaluacion de Cosecha (por variedad)
            </Button>
            <Button variant="outline" disabled={generating} onClick={() => handleGenerate("resumen")}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ClipboardList className="h-4 w-4 mr-1" />}
              Resumen Cosechas (tabla comparativa)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            El PDF incluye tablas de parametros, graficos de calibre y color, fotos (si disponibles), y analisis IA.
          </p>
        </div>
      )}
    </div>
  );
}


export function ReportesPage() {
  const [filters, setFilters] = useState<ReportFilters>({ ...EMPTY_FILTERS });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-garces-cherry-pale flex items-center justify-center">
          <FileText className="h-5 w-5 text-garces-cherry" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-garces-cherry">Reportes y Gestion</h2>
          <p className="text-sm text-muted-foreground">
            Reportes cruzados con analisis AI integrado — combine filtros para acotar resultados
          </p>
        </div>
      </div>

      {/* Universal filter bar */}
      <FilterBar filters={filters} onChange={setFilters} />

      <Tabs defaultValue="evaluacion">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="evaluacion" className="gap-1">
            <FlaskConical className="h-3.5 w-3.5" />
            Evaluacion Cosecha
          </TabsTrigger>
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

        <TabsContent value="evaluacion">
          <TabEvaluacionCosecha filters={filters} />
        </TabsContent>
        <TabsContent value="variedad">
          <TabVariedad filters={filters} />
        </TabsContent>
        <TabsContent value="lote">
          <TabLote filters={filters} />
        </TabsContent>
        <TabsContent value="testblock">
          <TabTestBlock filters={filters} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
