import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FlaskConical,
  Upload,
  Plus,
  Beaker,
  Zap,
  Camera,
  X,
  Hash,
  Grape,
  Palette,
  Snowflake,
  Eye,
  Ruler,
  Info,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Microscope,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { CrudTable } from "@/components/shared/CrudTable";
import { KpiCard } from "@/components/shared/KpiCard";
import { BulkImport } from "@/components/shared/BulkImport";
import { laboratorioService } from "@/services/laboratorio";
import { useLookups } from "@/hooks/useLookups";
import { formatNumber, formatDate } from "@/lib/utils";
import type { MedicionCreateResponse, ClasificacionResult } from "@/types/laboratorio";
import { IngresoRapidoTab } from "./IngresoRapidoTab";
import { TomaDeMuestraTab } from "./TomaDeMuestraTab";
import {
  getSpeciesConfig,
  isFieldRequired,
  isFieldVisible,
  FIRMEZA_FIELDS,
} from "@/config/speciesFields";

/* ─────────────────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────────────────── */

const COLOR_PULPA_OPTIONS = [
  "Amarilla",
  "Blanca",
  "Roja",
  "Morada-Roja",
  "Anaranjada",
  "Damasco",
];

const CLUSTER_COLORS: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-800 border-emerald-300",
  2: "bg-sky-100 text-sky-800 border-sky-300",
  3: "bg-amber-100 text-amber-800 border-amber-300",
  4: "bg-red-100 text-red-800 border-red-300",
};

const BANDA_LABEL: Record<number, string> = {
  1: "B1",
  2: "B2",
  3: "B3",
  4: "B4",
};

/* ─────────────────────────────────────────────────────────────────────────
 * Table columns for mediciones list
 * ────────────────────────────────────────────────────────────────────── */

/* Column defs are built inside the component to access lookups — see useMedicionColumns below */

/* ─────────────────────────────────────────────────────────────────────────
 * Form state type
 * ────────────────────────────────────────────────────────────────────── */

interface MedicionFormState {
  // Contexto
  id_especie: string;
  id_variedad: string;
  id_portainjerto: string;
  id_campo: string;
  temporada: string;
  fecha_medicion: string;
  fecha_cosecha: string;
  n_muestra: string;
  repeticion: string;
  // Fruto
  peso: string;
  perimetro: string;
  raleo_frutos: string;
  rendimiento: string;
  // Firmeza 5 puntos
  firmeza_punta: string;
  firmeza_quilla: string;
  firmeza_hombro: string;
  firmeza_mejilla_1: string;
  firmeza_mejilla_2: string;
  // Calidad
  brix: string;
  acidez: string;
  // Color
  color_pulpa: string;
  color_0_30: string;
  color_30_50: string;
  color_50_75: string;
  color_75_100: string;
  color_verde: string;
  color_crema: string;
  color_amarillo: string;
  color_full: string;
  // Postcosecha
  periodo_almacenaje: string;
  pardeamiento: string;
  total_frutos_pardeamiento: string;
  traslucidez: string;
  total_frutos_traslucidez: string;
  gelificacion: string;
  total_frutos_gelificacion: string;
  harinosidad: string;
  total_frutos_harinosidad: string;
  cracking_pct: string;
  // Otros
  observaciones: string;
  id_posicion: string;
  id_planta: string;
  color_pct: string;
}

const INITIAL_FORM: MedicionFormState = {
  id_especie: "",
  id_variedad: "",
  id_portainjerto: "",
  id_campo: "",
  temporada: "",
  fecha_medicion: new Date().toISOString().slice(0, 10),
  fecha_cosecha: "",
  n_muestra: "",
  repeticion: "",
  peso: "",
  perimetro: "",
  raleo_frutos: "",
  rendimiento: "",
  firmeza_punta: "",
  firmeza_quilla: "",
  firmeza_hombro: "",
  firmeza_mejilla_1: "",
  firmeza_mejilla_2: "",
  brix: "",
  acidez: "",
  color_pulpa: "",
  color_0_30: "",
  color_30_50: "",
  color_50_75: "",
  color_75_100: "",
  color_verde: "",
  color_crema: "",
  color_amarillo: "",
  color_full: "",
  periodo_almacenaje: "",
  pardeamiento: "",
  total_frutos_pardeamiento: "",
  traslucidez: "",
  total_frutos_traslucidez: "",
  gelificacion: "",
  total_frutos_gelificacion: "",
  harinosidad: "",
  total_frutos_harinosidad: "",
  cracking_pct: "",
  observaciones: "",
  id_posicion: "",
  id_planta: "",
  color_pct: "",
};

/* ─────────────────────────────────────────────────────────────────────────
 * Main page component
 * ────────────────────────────────────────────────────────────────────── */

function useMedicionColumns(lk: ReturnType<typeof useLookups>) {
  return useMemo(() => [
    { accessorKey: "id_medicion", header: "ID" },
    {
      accessorKey: "id_especie",
      header: "Especie",
      cell: ({ getValue }: any) => lk.especie(getValue()),
    },
    {
      accessorKey: "id_variedad",
      header: "Variedad",
      cell: ({ getValue }: any) => lk.variedad(getValue()),
    },
    { accessorKey: "temporada", header: "Temporada" },
    {
      accessorKey: "fecha_medicion",
      header: "Fecha",
      cell: ({ getValue }: any) => formatDate(getValue() as string),
    },
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
        getValue() != null ? formatNumber(getValue() as number, 1) + " mm" : "-",
    },
    {
      accessorKey: "acidez",
      header: "Acidez",
      cell: ({ getValue }: any) =>
        getValue() != null ? formatNumber(getValue() as number, 2) : "-",
    },
    {
      accessorKey: "peso",
      header: "Peso (g)",
      cell: ({ getValue }: any) =>
        getValue() != null ? formatNumber(getValue() as number, 1) : "-",
    },
    {
      accessorKey: "n_muestra",
      header: "Muestra",
      cell: ({ getValue }: any) =>
        getValue() != null ? `#${getValue()}` : "-",
    },
  ], [lk]);
}

export function LaboratorioPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [lastClasificacion, setLastClasificacion] =
    useState<ClasificacionResult | null>(null);
  const lk = useLookups();
  const medicionColumns = useMedicionColumns(lk);

  // ── Mediciones list filters ──
  const [filterEspecie, setFilterEspecie] = useState("");
  const [filterCampo, setFilterCampo] = useState("");
  const [filterTemporada, setFilterTemporada] = useState("");

  const medicionesParams = useMemo(() => {
    const p: { especie?: number; campo?: number; temporada?: string } = {};
    if (filterEspecie) p.especie = Number(filterEspecie);
    if (filterCampo) p.campo = Number(filterCampo);
    if (filterTemporada) p.temporada = filterTemporada;
    return p;
  }, [filterEspecie, filterCampo, filterTemporada]);

  const { data: mediciones, isLoading } = useQuery({
    queryKey: ["laboratorio", "mediciones", medicionesParams],
    queryFn: () => laboratorioService.mediciones(medicionesParams),
  });

  const { data: kpis } = useQuery({
    queryKey: ["laboratorio", "kpis"],
    queryFn: () => laboratorioService.kpis(),
  });

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      laboratorioService.crearMedicion(data),
    onSuccess: (response: MedicionCreateResponse) => {
      queryClient.invalidateQueries({ queryKey: ["laboratorio"] });
      if (response.clasificacion) {
        setLastClasificacion(response.clasificacion);
        const c = response.clasificacion;
        toast.success(
          `Medicion registrada - Cluster ${c.cluster} (${c.cluster_label})`,
          { duration: 5000 }
        );
      } else {
        toast.success("Medicion registrada");
      }
    },
  });

  const handleFormSubmit = useCallback(
    async (data: Record<string, unknown>) => {
      await createMut.mutateAsync(data);
    },
    [createMut]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-garces-cherry flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Laboratorio
        </h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkOpen(true)}
          >
            <Upload className="h-4 w-4 mr-1" /> Importar Excel
          </Button>
          <Button
            size="sm"
            onClick={() => setFormOpen(true)}
            className="bg-garces-cherry hover:bg-garces-cherry/90"
          >
            <Plus className="h-4 w-4 mr-1" /> Nueva Medicion
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <KpiCard
            title="Total Mediciones"
            value={kpis.total}
            icon={FlaskConical}
          />
          <KpiCard
            title="Brix Prom."
            value={
              kpis.brix_promedio != null
                ? formatNumber(kpis.brix_promedio, 1)
                : "-"
            }
            icon={FlaskConical}
          />
          <KpiCard
            title="Firmeza Prom."
            value={
              kpis.firmeza_promedio != null
                ? formatNumber(kpis.firmeza_promedio, 1)
                : "-"
            }
            icon={FlaskConical}
          />
          <KpiCard
            title="Acidez Prom."
            value={
              kpis.acidez_promedio != null
                ? formatNumber(kpis.acidez_promedio, 2)
                : "-"
            }
            icon={FlaskConical}
          />
          <KpiCard
            title="Calibre Prom."
            value={
              kpis.calibre_promedio != null
                ? formatNumber(kpis.calibre_promedio, 1) + " mm"
                : "-"
            }
            icon={FlaskConical}
          />
        </div>
      )}

      {/* ── Cross-navigation links ── */}
      <div className="flex items-center gap-4 text-sm">
        <Link
          to="/laboratorio/analisis"
          className="inline-flex items-center gap-1.5 text-garces-cherry hover:text-garces-cherry/80 font-medium hover:underline"
        >
          <Microscope className="h-3.5 w-3.5" />
          Ver Analisis de Calidad
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        <span className="text-border">|</span>
        <Link
          to="/reportes"
          className="inline-flex items-center gap-1.5 text-garces-cherry hover:text-garces-cherry/80 font-medium hover:underline"
        >
          <FileText className="h-3.5 w-3.5" />
          Ver Reportes
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <Tabs defaultValue="mediciones">
        <TabsList>
          <TabsTrigger value="mediciones">Mediciones</TabsTrigger>
          <TabsTrigger value="ingreso-rapido" className="gap-1">
            <Zap className="h-3.5 w-3.5" />
            Ingreso Rapido
          </TabsTrigger>
          <TabsTrigger value="toma-muestra" className="gap-1">
            <Beaker className="h-3.5 w-3.5" />
            Toma de Muestra
          </TabsTrigger>
          <TabsTrigger value="plantas">Plantas Disponibles</TabsTrigger>
        </TabsList>

        <TabsContent value="mediciones">
          {/* Filter bar */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="w-44">
              <Label className="text-xs">Especie</Label>
              <Select
                value={filterEspecie}
                onValueChange={(v) => {
                  setFilterEspecie(v === "__all__" ? "" : v);
                  setFilterCampo("");
                }}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {lk.options.especies.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Label className="text-xs">Campo</Label>
              <Select
                value={filterCampo}
                onValueChange={(v) => setFilterCampo(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {lk.options.campos.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Label className="text-xs">Temporada</Label>
              <Select
                value={filterTemporada}
                onValueChange={(v) => setFilterTemporada(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {lk.options.temporadas.map((o) => (
                    <SelectItem key={o.value} value={o.label}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(filterEspecie || filterCampo || filterTemporada) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-xs"
                onClick={() => {
                  setFilterEspecie("");
                  setFilterCampo("");
                  setFilterTemporada("");
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
          <CrudTable
            data={mediciones || []}
            columns={medicionColumns as any}
            isLoading={isLoading}
            searchPlaceholder="Buscar medicion..."
            exportFilename="mediciones_laboratorio"
          />
        </TabsContent>

        <TabsContent value="ingreso-rapido">
          <IngresoRapidoTab />
        </TabsContent>

        <TabsContent value="toma-muestra">
          <TomaDeMuestraTab />
        </TabsContent>

        <TabsContent value="plantas">
          <PlantasTab />
        </TabsContent>
      </Tabs>

      {/* Cluster result toast banner */}
      {lastClasificacion && (
        <ClusterResultBanner
          clasificacion={lastClasificacion}
          onDismiss={() => setLastClasificacion(null)}
        />
      )}

      {/* New measurement dialog */}
      <NuevaMedicionDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        isLoading={createMut.isPending}
      />

      {bulkOpen && (
        <BulkImport
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          onUpload={async (file) => {
            const result = await laboratorioService.bulkImport(file);
            queryClient.invalidateQueries({ queryKey: ["laboratorio"] });
            return result;
          }}
          title="Importar Mediciones"
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Cluster result inline banner
 * ────────────────────────────────────────────────────────────────────── */

function ClusterResultBanner({
  clasificacion,
  onDismiss,
}: {
  clasificacion: ClasificacionResult;
  onDismiss: () => void;
}) {
  const c = clasificacion;
  const colorCls = CLUSTER_COLORS[c.cluster] || "bg-gray-100 text-gray-800";

  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 ${colorCls}`}
    >
      <div className="flex items-center gap-3">
        <Beaker className="h-5 w-5" />
        <div>
          <span className="font-semibold">
            Cluster {c.cluster} ({c.cluster_label})
          </span>
          <span className="ml-3 text-sm">
            Brix {BANDA_LABEL[c.banda_brix]}, Mejillas{" "}
            {BANDA_LABEL[c.banda_firmeza]}, Punto{" "}
            {BANDA_LABEL[c.banda_firmeza_punto]}, Acidez{" "}
            {BANDA_LABEL[c.banda_acidez]}
          </span>
          {c.score_total != null && (
            <span className="ml-2 text-xs opacity-70">
              (suma={c.score_total})
            </span>
          )}
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Cerrar
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Plantas tab (unchanged)
 * ────────────────────────────────────────────────────────────────────── */

function PlantasTab() {
  const { data: plantas, isLoading } = useQuery({
    queryKey: ["laboratorio", "plantas"],
    queryFn: () => laboratorioService.plantas(),
  });
  const lk = useLookups();

  const plantaCols = [
    { accessorKey: "id_planta", header: "ID" },
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
    {
      accessorKey: "id_especie",
      header: "Especie",
      cell: ({ getValue }: any) => lk.especie(getValue()),
    },
    { accessorKey: "condicion", header: "Condicion" },
    { accessorKey: "ano_plantacion", header: "Ano" },
  ];

  return (
    <CrudTable
      data={plantas || []}
      columns={plantaCols as any}
      isLoading={isLoading}
      searchPlaceholder="Buscar planta..."
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Section heading helper — icon + colored title + bottom border
 * ────────────────────────────────────────────────────────────────────── */

function SectionHeading({
  number,
  title,
  icon: Icon,
  subtitle,
}: {
  number: number;
  title: string;
  icon: React.ElementType;
  subtitle?: string;
}) {
  return (
    <legend className="flex items-center gap-2 text-sm font-semibold text-garces-cherry uppercase tracking-wide border-b border-garces-cherry/20 pb-1.5 w-full">
      <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-garces-cherry/10 text-garces-cherry">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {number}. {title}
      {subtitle && (
        <span className="ml-2 text-xs font-normal text-muted-foreground normal-case">
          {subtitle}
        </span>
      )}
    </legend>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * ClusterFieldLabel — label with optional "Requerido para cluster" badge
 * ────────────────────────────────────────────────────────────────────── */

function ClusterFieldLabel({
  htmlFor,
  children,
  isRequired,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  isRequired?: boolean;
  className?: string;
}) {
  return (
    <Label htmlFor={htmlFor} className={className}>
      {children}
      {isRequired && (
        <Fragment>
          {" "}
          <span className="text-destructive">*</span>
          <span className="ml-1 text-[10px] font-normal text-amber-600 bg-amber-50 px-1 rounded">
            cluster
          </span>
        </Fragment>
      )}
    </Label>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * RulePreviewBox — shows which clustering rule will apply
 * ────────────────────────────────────────────────────────────────────── */

function RulePreviewBox({
  especieNombre,
  peso,
  colorPulpa,
  fecha,
}: {
  especieNombre: string;
  peso: string;
  colorPulpa: string;
  fecha: string;
}) {
  const pesoNum = peso ? parseFloat(peso) : undefined;

  const { data: preview, isFetching } = useQuery({
    queryKey: [
      "laboratorio",
      "rule-preview",
      especieNombre,
      pesoNum ?? "",
      colorPulpa,
      fecha,
    ],
    queryFn: () =>
      laboratorioService.rulePreview({
        especie: especieNombre,
        peso: pesoNum != null && !isNaN(pesoNum) ? pesoNum : null,
        color_pulpa: colorPulpa || null,
        fecha: fecha || null,
      }),
    enabled: !!especieNombre,
    staleTime: 30_000,
  });

  if (!especieNombre) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
      <Info className="h-4 w-4 text-sky-600 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        {isFetching ? (
          <span className="text-sky-600">Calculando regla...</span>
        ) : preview ? (
          <div>
            <span className="font-semibold text-sky-800">
              Regla: {preview.regla_label}
            </span>
            {preview.bandas && (
              <span className="ml-2 text-xs text-sky-600">
                {Object.entries(preview.bandas)
                  .map(([m, bands]) => `${m}: B1 ${bands.B1}`)
                  .join(" | ")}
              </span>
            )}
          </div>
        ) : (
          <span className="text-sky-600">Sin preview disponible</span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * NuevaMedicionDialog — species-adaptive form
 * ────────────────────────────────────────────────────────────────────── */

function NuevaMedicionDialog({
  open,
  onClose,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isLoading: boolean;
}) {
  const lk = useLookups();
  const [form, setForm] = useState<MedicionFormState>({ ...INITIAL_FORM });
  const [images, setImages] = useState<{ name: string; data: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm({ ...INITIAL_FORM });
      setImages([]);
      setShowAdvancedFields(false);
    }
  }, [open]);

  // Update a single field
  const setField = useCallback(
    (key: keyof MedicionFormState, value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // ── Species-adaptive config ──
  const especieNombre = useMemo(() => {
    if (!form.id_especie) return null;
    const name = lk.especie(Number(form.id_especie));
    return name && name !== "-" ? name : null;
  }, [form.id_especie, lk]);

  const speciesConfig = useMemo(
    () => getSpeciesConfig(especieNombre),
    [especieNombre]
  );

  const fRequired = useCallback(
    (field: string) => isFieldRequired(especieNombre, field),
    [especieNombre]
  );

  const fVisible = useCallback(
    (field: string) => isFieldVisible(especieNombre, field),
    [especieNombre]
  );

  // Determine which color_pulpa options to show
  const activeColorPulpaOptions = useMemo(() => {
    if (speciesConfig.needsColorPulpa && speciesConfig.colorPulpaOptions) {
      return speciesConfig.colorPulpaOptions;
    }
    // Full list for species without restriction
    return COLOR_PULPA_OPTIONS.map((c) => ({ value: c, label: c }));
  }, [speciesConfig]);

  // Determine if color section should show
  const showColorSection = useMemo(() => {
    return (
      speciesConfig.needsColorPulpa ||
      fVisible("color_0_30") ||
      fVisible("color_verde") ||
      fVisible("color_pulpa")
    );
  }, [speciesConfig, fVisible]);

  // Filter variedades by selected especie
  const filteredVariedades = useMemo(() => {
    const espId = form.id_especie ? Number(form.id_especie) : null;
    if (!espId || !lk.rawData.variedades) return lk.options.variedades;
    return lk.rawData.variedades
      .filter((v) => (v as any).id_especie === espId)
      .map((v) => ({
        value: (v as any).id_variedad as number,
        label: (v as any).nombre as string,
      }));
  }, [form.id_especie, lk.rawData.variedades, lk.options.variedades]);

  // ── Auto-calculated values ──
  const mejillasAvg = useMemo(() => {
    const m1 = form.firmeza_mejilla_1 ? parseFloat(form.firmeza_mejilla_1) : null;
    const m2 = form.firmeza_mejilla_2 ? parseFloat(form.firmeza_mejilla_2) : null;
    const vals = [m1, m2].filter((v) => v != null && v > 0) as number[];
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [form.firmeza_mejilla_1, form.firmeza_mejilla_2]);

  const puntoDebil = useMemo(() => {
    const vals = [form.firmeza_punta, form.firmeza_quilla, form.firmeza_hombro]
      .map((v) => (v ? parseFloat(v) : null))
      .filter((v) => v != null && v > 0) as number[];
    if (vals.length === 0) return null;
    return Math.min(...vals);
  }, [form.firmeza_punta, form.firmeza_quilla, form.firmeza_hombro]);

  const calibreFromPerimetro = useMemo(() => {
    if (!form.perimetro) return null;
    const p = parseFloat(form.perimetro);
    if (isNaN(p) || p <= 0) return null;
    return p / Math.PI;
  }, [form.perimetro]);

  // ── Image handling ──
  const processFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [
          ...prev,
          { name: file.name, data: reader.result as string },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Submit handler ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build payload, converting empty strings to null and strings to numbers
    const toNum = (v: string): number | null => {
      if (!v || v === "") return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    const payload: Record<string, unknown> = {
      fecha_medicion: form.fecha_medicion,
      fecha_cosecha: form.fecha_cosecha || null,
      temporada: form.temporada || null,
      id_especie: toNum(form.id_especie),
      id_variedad: toNum(form.id_variedad),
      id_portainjerto: toNum(form.id_portainjerto),
      id_campo: toNum(form.id_campo),
      n_muestra: toNum(form.n_muestra),
      repeticion: toNum(form.repeticion),
      // Fruto
      peso: toNum(form.peso),
      perimetro: toNum(form.perimetro),
      raleo_frutos: toNum(form.raleo_frutos),
      rendimiento: toNum(form.rendimiento),
      // Firmeza 5 puntos
      firmeza_punta: toNum(form.firmeza_punta),
      firmeza_quilla: toNum(form.firmeza_quilla),
      firmeza_hombro: toNum(form.firmeza_hombro),
      firmeza_mejilla_1: toNum(form.firmeza_mejilla_1),
      firmeza_mejilla_2: toNum(form.firmeza_mejilla_2),
      // Calidad
      brix: toNum(form.brix),
      acidez: toNum(form.acidez),
      // Color
      color_pulpa: form.color_pulpa || null,
      color_0_30: toNum(form.color_0_30),
      color_30_50: toNum(form.color_30_50),
      color_50_75: toNum(form.color_50_75),
      color_75_100: toNum(form.color_75_100),
      color_verde: toNum(form.color_verde),
      color_crema: toNum(form.color_crema),
      color_amarillo: toNum(form.color_amarillo),
      color_full: toNum(form.color_full),
      // Postcosecha
      periodo_almacenaje: toNum(form.periodo_almacenaje),
      pardeamiento: toNum(form.pardeamiento),
      total_frutos_pardeamiento: toNum(form.total_frutos_pardeamiento),
      traslucidez: toNum(form.traslucidez),
      total_frutos_traslucidez: toNum(form.total_frutos_traslucidez),
      gelificacion: toNum(form.gelificacion),
      total_frutos_gelificacion: toNum(form.total_frutos_gelificacion),
      harinosidad: toNum(form.harinosidad),
      total_frutos_harinosidad: toNum(form.total_frutos_harinosidad),
      cracking_pct: toNum(form.cracking_pct),
      // Otros
      observaciones: form.observaciones || null,
      id_posicion: toNum(form.id_posicion) || null,
      id_planta: toNum(form.id_planta) || null,
      color_pct: toNum(form.color_pct),
      // Images stored as base64 array (for future persistence)
      imagenes: images.length > 0 ? images.map((img) => img.data) : null,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch {
      // Keep form open on error — toast already shown by api.ts
    }
  };

  const fruitNumber = form.n_muestra ? parseInt(form.n_muestra, 10) : null;

  // Track which section number we're on (dynamically incremented)
  let sectionNum = 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-garces-cherry flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Nueva Medicion de Laboratorio
          </DialogTitle>
          <DialogDescription>
            {especieNombre
              ? `Formulario adaptado para ${especieNombre}. Los campos varian segun la especie.`
              : "Seleccione la especie primero para adaptar el formulario."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ════════════════════════════════════════════════════════════════
           *  Section 1: Contexto de la muestra (especie FIRST)
           * ════════════════════════════════════════════════════════════════ */}
          <fieldset className="space-y-3">
            <SectionHeading number={++sectionNum} title="Contexto de la muestra" icon={FlaskConical} />

            {/* ── Especie selector — PROMINENT, first field ── */}
            <div className="rounded-lg border-2 border-garces-cherry/20 bg-garces-cherry/5 p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="id_especie" className="font-semibold text-garces-cherry">
                    Especie <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.id_especie}
                    onValueChange={(v) => {
                      setField("id_especie", v);
                      setField("id_variedad", ""); // reset variedad on especie change
                      setField("color_pulpa", ""); // reset color_pulpa on especie change
                    }}
                  >
                    <SelectTrigger className="mt-1 border-garces-cherry/30">
                      <SelectValue placeholder="-- Seleccionar especie --" />
                    </SelectTrigger>
                    <SelectContent>
                      {lk.options.especies.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Rule hint badge */}
                {especieNombre && (
                  <div className="flex flex-col justify-end gap-1.5">
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-800">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{speciesConfig.ruleHint}</span>
                    </div>
                    {speciesConfig.needsPeso && (
                      <div className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 border border-violet-200 px-2.5 py-1.5 text-xs text-violet-800">
                        <Info className="h-3.5 w-3.5 flex-shrink-0" />
                        Peso &gt; 60g = Candy | &le; 60g = Cherry
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Remaining context fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Variedad (filtered by especie) */}
              <div>
                <Label htmlFor="id_variedad">Variedad</Label>
                <Select
                  value={form.id_variedad}
                  onValueChange={(v) => setField("id_variedad", v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccionar variedad" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredVariedades.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Portainjerto */}
              <div>
                <Label htmlFor="id_portainjerto">Portainjerto</Label>
                <Select
                  value={form.id_portainjerto}
                  onValueChange={(v) => setField("id_portainjerto", v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {lk.options.portainjertos.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Campo / Localidad */}
              <div>
                <Label htmlFor="id_campo">Campo / Localidad</Label>
                <Select
                  value={form.id_campo}
                  onValueChange={(v) => setField("id_campo", v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccionar campo" />
                  </SelectTrigger>
                  <SelectContent>
                    {lk.options.campos.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Temporada */}
              <div>
                <Label htmlFor="temporada">Temporada</Label>
                <Select
                  value={form.temporada}
                  onValueChange={(v) => setField("temporada", v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccionar temporada" />
                  </SelectTrigger>
                  <SelectContent>
                    {lk.options.temporadas.map((o) => (
                      <SelectItem key={o.value} value={o.label}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha evaluacion */}
              <div>
                <ClusterFieldLabel
                  htmlFor="fecha_medicion"
                  isRequired={fRequired("fecha_medicion")}
                >
                  Fecha evaluacion
                </ClusterFieldLabel>
                <Input
                  id="fecha_medicion"
                  type="date"
                  className="mt-1"
                  value={form.fecha_medicion}
                  onChange={(e) => setField("fecha_medicion", e.target.value)}
                  required
                />
              </div>

              {/* Fecha cosecha */}
              <div>
                <Label htmlFor="fecha_cosecha">Fecha cosecha</Label>
                <Input
                  id="fecha_cosecha"
                  type="date"
                  className="mt-1"
                  value={form.fecha_cosecha}
                  onChange={(e) => setField("fecha_cosecha", e.target.value)}
                />
              </div>

              {/* Repeticion */}
              <div>
                <Label htmlFor="repeticion">Repeticion</Label>
                <Input
                  id="repeticion"
                  type="number"
                  className="mt-1"
                  value={form.repeticion}
                  onChange={(e) => setField("repeticion", e.target.value)}
                  placeholder="1"
                  min={1}
                />
              </div>
            </div>

            {/* Rule preview — shown when especie is selected */}
            {especieNombre && (
              <RulePreviewBox
                especieNombre={especieNombre}
                peso={form.peso}
                colorPulpa={form.color_pulpa}
                fecha={form.fecha_medicion}
              />
            )}

            {/* Optional: id_posicion / id_planta for advanced users */}
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">
                Avanzado: ID Posicion / Planta
              </summary>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label htmlFor="id_posicion" className="text-xs">
                    ID Posicion
                  </Label>
                  <Input
                    id="id_posicion"
                    type="number"
                    className="mt-1"
                    value={form.id_posicion}
                    onChange={(e) => setField("id_posicion", e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <Label htmlFor="id_planta" className="text-xs">
                    ID Planta
                  </Label>
                  <Input
                    id="id_planta"
                    type="number"
                    className="mt-1"
                    value={form.id_planta}
                    onChange={(e) => setField("id_planta", e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            </details>
          </fieldset>

          {/* ════════════════════════════════════════════════════════════════
           *  Section 2: Metricas Principales (brix, acidez, peso, perimetro)
           * ════════════════════════════════════════════════════════════════ */}
          <fieldset className="space-y-3">
            <SectionHeading number={++sectionNum} title="Metricas Principales" icon={Grape} />

            {/* Prominent fruit counter badge */}
            <div className="flex items-center gap-4">
              <div>
                <Label htmlFor="n_muestra">N. Muestra</Label>
                <Input
                  id="n_muestra"
                  type="number"
                  className="mt-1 w-24"
                  value={form.n_muestra}
                  onChange={(e) => setField("n_muestra", e.target.value)}
                  placeholder="1"
                  min={1}
                />
              </div>
              {fruitNumber != null && !isNaN(fruitNumber) && fruitNumber > 0 && (
                <div className="flex items-center gap-2 mt-5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-garces-cherry px-4 py-2 text-white text-lg font-bold shadow-sm">
                    <Hash className="h-5 w-5" />
                    Fruto #{fruitNumber}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <ClusterFieldLabel htmlFor="brix" isRequired={fRequired("brix")}>
                  Brix / Solidos solubles (%)
                </ClusterFieldLabel>
                <Input
                  id="brix"
                  type="number"
                  step="0.1"
                  className="mt-1"
                  value={form.brix}
                  onChange={(e) => setField("brix", e.target.value)}
                  placeholder="18.5"
                />
              </div>
              <div>
                <ClusterFieldLabel htmlFor="acidez" isRequired={fRequired("acidez")}>
                  Acidez (%)
                </ClusterFieldLabel>
                <Input
                  id="acidez"
                  type="number"
                  step="0.01"
                  className="mt-1"
                  value={form.acidez}
                  onChange={(e) => setField("acidez", e.target.value)}
                  placeholder="0.65"
                />
              </div>
              {(fVisible("peso") || speciesConfig.needsPeso) && (
                <div>
                  <ClusterFieldLabel htmlFor="peso" isRequired={fRequired("peso")}>
                    Peso (g)
                  </ClusterFieldLabel>
                  <Input
                    id="peso"
                    type="number"
                    step="0.1"
                    className="mt-1"
                    value={form.peso}
                    onChange={(e) => setField("peso", e.target.value)}
                    placeholder="75.0"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="perimetro">
                  Perimetro (mm)
                  {calibreFromPerimetro != null && (
                    <span className="ml-1 text-xs font-normal text-emerald-600">
                      = calibre {calibreFromPerimetro.toFixed(1)} mm
                    </span>
                  )}
                </Label>
                <Input
                  id="perimetro"
                  type="number"
                  step="0.1"
                  className="mt-1"
                  value={form.perimetro}
                  onChange={(e) => setField("perimetro", e.target.value)}
                  placeholder="90.0"
                />
              </div>
            </div>
          </fieldset>

          {/* ════════════════════════════════════════════════════════════════
           *  Section 3: Firmeza (5 puntos) — always for stone fruits
           * ════════════════════════════════════════════════════════════════ */}
          {FIRMEZA_FIELDS.some((f) => fVisible(f) || fRequired(f)) && (
            <fieldset className="space-y-3">
              <SectionHeading number={++sectionNum} title="Firmeza (5 puntos de medicion)" icon={Ruler} />
              <p className="text-xs text-muted-foreground">
                Ingrese las lecturas de firmeza en Newtons. El sistema calcula
                automaticamente el promedio de mejillas y el punto mas debil.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <ClusterFieldLabel htmlFor="firmeza_punta" isRequired={fRequired("firmeza_punta")}>
                    Punta (N)
                  </ClusterFieldLabel>
                  <Input
                    id="firmeza_punta"
                    type="number"
                    step="0.1"
                    className="mt-1"
                    value={form.firmeza_punta}
                    onChange={(e) => setField("firmeza_punta", e.target.value)}
                    placeholder="8.0"
                  />
                </div>
                <div>
                  <ClusterFieldLabel htmlFor="firmeza_quilla" isRequired={fRequired("firmeza_quilla")}>
                    Quilla (N)
                  </ClusterFieldLabel>
                  <Input
                    id="firmeza_quilla"
                    type="number"
                    step="0.1"
                    className="mt-1"
                    value={form.firmeza_quilla}
                    onChange={(e) => setField("firmeza_quilla", e.target.value)}
                    placeholder="7.5"
                  />
                </div>
                <div>
                  <ClusterFieldLabel htmlFor="firmeza_hombro" isRequired={fRequired("firmeza_hombro")}>
                    Hombro (N)
                  </ClusterFieldLabel>
                  <Input
                    id="firmeza_hombro"
                    type="number"
                    step="0.1"
                    className="mt-1"
                    value={form.firmeza_hombro}
                    onChange={(e) => setField("firmeza_hombro", e.target.value)}
                    placeholder="9.0"
                  />
                </div>
                <div>
                  <ClusterFieldLabel htmlFor="firmeza_mejilla_1" isRequired={fRequired("firmeza_mejilla_1")}>
                    Mejilla 1 (N)
                  </ClusterFieldLabel>
                  <Input
                    id="firmeza_mejilla_1"
                    type="number"
                    step="0.1"
                    className="mt-1"
                    value={form.firmeza_mejilla_1}
                    onChange={(e) =>
                      setField("firmeza_mejilla_1", e.target.value)
                    }
                    placeholder="10.0"
                  />
                </div>
                <div>
                  <ClusterFieldLabel htmlFor="firmeza_mejilla_2" isRequired={fRequired("firmeza_mejilla_2")}>
                    Mejilla 2 (N)
                  </ClusterFieldLabel>
                  <Input
                    id="firmeza_mejilla_2"
                    type="number"
                    step="0.1"
                    className="mt-1"
                    value={form.firmeza_mejilla_2}
                    onChange={(e) =>
                      setField("firmeza_mejilla_2", e.target.value)
                    }
                    placeholder="11.0"
                  />
                </div>
              </div>

              {/* Auto-calculated indicators */}
              <div className="flex gap-4 text-sm bg-muted/50 rounded-md px-3 py-2">
                <span>
                  <span className="font-medium">Promedio mejillas:</span>{" "}
                  {mejillasAvg != null ? (
                    <span className="text-garces-cherry font-semibold">
                      {mejillasAvg.toFixed(1)} N
                    </span>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </span>
                <span className="border-l border-border" />
                <span>
                  <span className="font-medium">Punto debil:</span>{" "}
                  {puntoDebil != null ? (
                    <span className="text-garces-cherry font-semibold">
                      {puntoDebil.toFixed(1)} N
                    </span>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </span>
              </div>
            </fieldset>
          )}

          {/* ════════════════════════════════════════════════════════════════
           *  Section 4: Color — CONDITIONAL by species
           * ════════════════════════════════════════════════════════════════ */}
          {showColorSection && (
            <fieldset className="space-y-4">
              <SectionHeading
                number={++sectionNum}
                title="Color"
                icon={Palette}
                subtitle={speciesConfig.needsColorPulpa ? "(requerido)" : "(opcional)"}
              />

              {/* Sub-section A: Color de pulpa */}
              {(speciesConfig.needsColorPulpa || fVisible("color_pulpa")) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                    A. Color de pulpa
                  </p>
                  <div className="max-w-xs">
                    <ClusterFieldLabel htmlFor="color_pulpa" isRequired={fRequired("color_pulpa")}>
                      Color
                    </ClusterFieldLabel>
                    <Select
                      value={form.color_pulpa}
                      onValueChange={(v) => setField("color_pulpa", v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Seleccionar color" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeColorPulpaOptions.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Sub-section B: Color de cubrimiento (% de frutos por rango) */}
              {fVisible("color_0_30") && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                    B. Color de cubrimiento (% de frutos por rango)
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <Label htmlFor="color_0_30" className="text-xs">0-30%</Label>
                      <Input
                        id="color_0_30"
                        type="number"
                        className="mt-1"
                        value={form.color_0_30}
                        onChange={(e) => setField("color_0_30", e.target.value)}
                        placeholder="0"
                        min={0}
                      />
                    </div>
                    <div>
                      <Label htmlFor="color_30_50" className="text-xs">30-50%</Label>
                      <Input
                        id="color_30_50"
                        type="number"
                        className="mt-1"
                        value={form.color_30_50}
                        onChange={(e) => setField("color_30_50", e.target.value)}
                        placeholder="0"
                        min={0}
                      />
                    </div>
                    <div>
                      <Label htmlFor="color_50_75" className="text-xs">50-75%</Label>
                      <Input
                        id="color_50_75"
                        type="number"
                        className="mt-1"
                        value={form.color_50_75}
                        onChange={(e) => setField("color_50_75", e.target.value)}
                        placeholder="0"
                        min={0}
                      />
                    </div>
                    <div>
                      <Label htmlFor="color_75_100" className="text-xs">75-100%</Label>
                      <Input
                        id="color_75_100"
                        type="number"
                        className="mt-1"
                        value={form.color_75_100}
                        onChange={(e) => setField("color_75_100", e.target.value)}
                        placeholder="0"
                        min={0}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-section C: Distribucion de color */}
              {fVisible("color_verde") && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                    C. Distribucion de color
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <Label htmlFor="color_verde" className="text-xs">Verde</Label>
                      <Input
                        id="color_verde"
                        type="number"
                        className="mt-1"
                        value={form.color_verde}
                        onChange={(e) => setField("color_verde", e.target.value)}
                        placeholder="0"
                        min={0}
                      />
                    </div>
                    <div>
                      <Label htmlFor="color_crema" className="text-xs">Crema</Label>
                      <Input
                        id="color_crema"
                        type="number"
                        className="mt-1"
                        value={form.color_crema}
                        onChange={(e) => setField("color_crema", e.target.value)}
                        placeholder="0"
                        min={0}
                      />
                    </div>
                    <div>
                      <Label htmlFor="color_amarillo" className="text-xs">Amarillo</Label>
                      <Input
                        id="color_amarillo"
                        type="number"
                        className="mt-1"
                        value={form.color_amarillo}
                        onChange={(e) => setField("color_amarillo", e.target.value)}
                        placeholder="0"
                        min={0}
                      />
                    </div>
                    <div>
                      <Label htmlFor="color_full" className="text-xs">Full</Label>
                      <Input
                        id="color_full"
                        type="number"
                        className="mt-1"
                        value={form.color_full}
                        onChange={(e) => setField("color_full", e.target.value)}
                        placeholder="0"
                        min={0}
                      />
                    </div>
                  </div>
                </div>
              )}
            </fieldset>
          )}

          {/* ════════════════════════════════════════════════════════════════
           *  Section 5: Postcosecha — collapsible by default
           * ════════════════════════════════════════════════════════════════ */}
          <fieldset className="space-y-3">
            <button
              type="button"
              className="flex items-center gap-2 w-full text-left"
              onClick={() => setShowAdvancedFields((prev) => !prev)}
            >
              <SectionHeading
                number={++sectionNum}
                title="Postcosecha"
                icon={Snowflake}
                subtitle="(opcional — clic para expandir)"
              />
              {showAdvancedFields ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 -mt-1" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 -mt-1" />
              )}
            </button>

            {showAdvancedFields && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Periodo almacenaje — full width */}
                <div className="sm:col-span-2">
                  <Label htmlFor="periodo_almacenaje">
                    Periodo almacenaje (dias)
                  </Label>
                  <Input
                    id="periodo_almacenaje"
                    type="number"
                    className="mt-1 max-w-xs"
                    value={form.periodo_almacenaje}
                    onChange={(e) =>
                      setField("periodo_almacenaje", e.target.value)
                    }
                    placeholder="0"
                    min={0}
                  />
                </div>
                {/* Pardeamiento: % | n frutos */}
                <div>
                  <Label htmlFor="pardeamiento">Pardeamiento (%)</Label>
                  <Input
                    id="pardeamiento"
                    type="number"
                    step="0.1"
                    className="mt-1"
                    value={form.pardeamiento}
                    onChange={(e) => setField("pardeamiento", e.target.value)}
                    placeholder="0.0"
                    min={0}
                    max={100}
                  />
                </div>
                <div>
                  <Label htmlFor="total_frutos_pardeamiento">N frutos pardeamiento</Label>
                  <Input
                    id="total_frutos_pardeamiento"
                    type="number"
                    className="mt-1"
                    value={form.total_frutos_pardeamiento}
                    onChange={(e) => setField("total_frutos_pardeamiento", e.target.value)}
                    placeholder="0"
                    min={0}
                  />
                </div>

                {/* Traslucidez: % | n frutos */}
                <div>
                  <Label htmlFor="traslucidez">Traslucidez (%)</Label>
                  <Input
                    id="traslucidez"
                    type="number"
                    step="0.1"
                    className="mt-1"
                    value={form.traslucidez}
                    onChange={(e) => setField("traslucidez", e.target.value)}
                    placeholder="0.0"
                    min={0}
                    max={100}
                  />
                </div>
                <div>
                  <Label htmlFor="total_frutos_traslucidez">N frutos traslucidez</Label>
                  <Input
                    id="total_frutos_traslucidez"
                    type="number"
                    className="mt-1"
                    value={form.total_frutos_traslucidez}
                    onChange={(e) => setField("total_frutos_traslucidez", e.target.value)}
                    placeholder="0"
                    min={0}
                  />
                </div>

                {/* Gelificacion: % | n frutos */}
                <div>
                  <Label htmlFor="gelificacion">Gelificacion (%)</Label>
                  <Input
                    id="gelificacion"
                    type="number"
                    step="0.1"
                    className="mt-1"
                    value={form.gelificacion}
                    onChange={(e) => setField("gelificacion", e.target.value)}
                    placeholder="0.0"
                    min={0}
                    max={100}
                  />
                </div>
                <div>
                  <Label htmlFor="total_frutos_gelificacion">N frutos gelificacion</Label>
                  <Input
                    id="total_frutos_gelificacion"
                    type="number"
                    className="mt-1"
                    value={form.total_frutos_gelificacion}
                    onChange={(e) => setField("total_frutos_gelificacion", e.target.value)}
                    placeholder="0"
                    min={0}
                  />
                </div>

                {/* Harinosidad: % | n frutos */}
                <div>
                  <Label htmlFor="harinosidad">Harinosidad (%)</Label>
                  <Input
                    id="harinosidad"
                    type="number"
                    step="0.1"
                    className="mt-1"
                    value={form.harinosidad}
                    onChange={(e) => setField("harinosidad", e.target.value)}
                    placeholder="0.0"
                    min={0}
                    max={100}
                  />
                </div>
                <div>
                  <Label htmlFor="total_frutos_harinosidad">N frutos harinosidad</Label>
                  <Input
                    id="total_frutos_harinosidad"
                    type="number"
                    className="mt-1"
                    value={form.total_frutos_harinosidad}
                    onChange={(e) => setField("total_frutos_harinosidad", e.target.value)}
                    placeholder="0"
                    min={0}
                  />
                </div>

                {/* Cracking — left column */}
                <div>
                  <Label htmlFor="cracking_pct">Cracking (%)</Label>
                  <Input
                    id="cracking_pct"
                    type="number"
                    className="mt-1"
                    value={form.cracking_pct}
                    onChange={(e) => setField("cracking_pct", e.target.value)}
                    placeholder="0"
                    min={0}
                    max={100}
                  />
                </div>

                {/* Hidden fields not shown by species — raleo, rendimiento, peso */}
                {!fVisible("peso") && !speciesConfig.needsPeso && (
                  <div>
                    <Label htmlFor="peso">Peso (g)</Label>
                    <Input
                      id="peso"
                      type="number"
                      step="0.1"
                      className="mt-1"
                      value={form.peso}
                      onChange={(e) => setField("peso", e.target.value)}
                      placeholder="75.0"
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="raleo_frutos">Raleo frutos</Label>
                  <Input
                    id="raleo_frutos"
                    type="number"
                    className="mt-1"
                    value={form.raleo_frutos}
                    onChange={(e) => setField("raleo_frutos", e.target.value)}
                    placeholder="0"
                    min={0}
                  />
                </div>
                <div>
                  <Label htmlFor="rendimiento">Rendimiento</Label>
                  <Input
                    id="rendimiento"
                    type="number"
                    step="0.01"
                    className="mt-1"
                    value={form.rendimiento}
                    onChange={(e) => setField("rendimiento", e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </fieldset>

          {/* ════════════════════════════════════════════════════════════════
           *  Section 6: Imagenes
           * ════════════════════════════════════════════════════════════════ */}
          <fieldset className="space-y-3">
            <SectionHeading number={++sectionNum} title="Imagenes" icon={Camera} />

            {/* Image drop zone */}
            <div>
              <div
                className="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-garces-cherry/30 bg-garces-cherry/5 px-4 py-8 cursor-pointer transition-colors hover:border-garces-cherry/50 hover:bg-garces-cherry/10"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-8 w-8 text-garces-cherry/50" />
                <p className="text-sm text-muted-foreground">
                  Arrastra imagenes aqui o haz clic
                </p>
                <p className="text-xs text-muted-foreground/60">
                  JPG, PNG (multiples archivos)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    processFiles(e.target.files);
                    // Reset so re-selecting the same file triggers onChange
                    e.target.value = "";
                  }}
                />
              </div>

              {/* Image thumbnails */}
              {images.length > 0 && (
                <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative flex-shrink-0 group"
                    >
                      <img
                        src={img.data}
                        alt={img.name}
                        className="h-20 w-20 rounded-md object-cover border border-border shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(idx);
                        }}
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        aria-label={`Eliminar ${img.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="text-[10px] text-muted-foreground truncate w-20 mt-0.5 text-center">
                        {img.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </fieldset>

          {/* ════════════════════════════════════════════════════════════════
           *  Section 7: Observaciones
           * ════════════════════════════════════════════════════════════════ */}
          <fieldset className="space-y-3">
            <SectionHeading number={++sectionNum} title="Observaciones" icon={Eye} />
            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <textarea
                id="observaciones"
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]"
                value={form.observaciones}
                onChange={(e) => setField("observaciones", e.target.value)}
                placeholder="Notas adicionales sobre la muestra..."
              />
            </div>
          </fieldset>

          {/* ── Footer ── */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-garces-cherry hover:bg-garces-cherry/90"
            >
              <Plus className="h-4 w-4 mr-1" />
              {isLoading ? "Guardando..." : "Registrar Medicion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
