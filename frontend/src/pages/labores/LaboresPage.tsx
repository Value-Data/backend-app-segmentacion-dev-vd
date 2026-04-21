import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Hammer, CheckCircle2, Clock, AlertTriangle, Plus, CalendarDays,
  TrendingUp, QrCode, Camera, FileText, Download, X, Image as ImageIcon,
  Calendar, MoreHorizontal, Leaf, Scissors, ChevronDown, ChevronRight, ListChecks,
  ClipboardList, Play, Pencil, Trash2, MapPin, Building2,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CrudTable } from "@/components/shared/CrudTable";
import { CrudForm } from "@/components/shared/CrudForm";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { laboresService } from "@/services/labores";
import { get } from "@/services/api";
import type { LaborDashboard, EstadoFenologico, DetalleLabor } from "@/services/labores";
import { useTestblocks } from "@/hooks/useTestblock";
import { useAuthStore } from "@/stores/authStore";
import { useTemporadaStore } from "@/stores/temporadaStore";
import { useLookups } from "@/hooks/useLookups";
import { mantenedorService } from "@/services/mantenedores";
import { formatDate } from "@/lib/utils";
import type { FieldDef } from "@/types";
import type { EjecucionLabor } from "@/types/laboratorio";
import { LaborCalendar } from "@/components/labores/LaborCalendar";
import { ordenesTrabajoService } from "@/services/ordenesTrabajo";
import type { OrdenTrabajo } from "@/services/ordenesTrabajo";
import { NuevaOrdenTrabajoWizard } from "@/pages/labores/NuevaOrdenTrabajoWizard";
import { RegistrarEjecucionDialog } from "@/pages/labores/RegistrarEjecucionDialog";
import { TabKanban } from "./TabKanban";
import { TabPlanAgrupado } from "./TabPlanAgrupado";
import { TabPorPersona } from "./TabPorPersona";
import { TabCumplimientoTB } from "./TabCumplimientoTB";
import { TabDesviaciones } from "./TabDesviaciones";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Unified pauta item — composed from API data (estados_fenologicos + tipos_labor) */
interface PautaItem {
  id: string;
  tipo: "Fenologia" | "Labor";
  nombre: string;
  mes: string;
  cat: string;
  orden: number;
  color_hex?: string | null;
}

const CAT_COLORS: Record<string, string> = {
  fenologia: "bg-violet-100 text-violet-700 border-violet-200",
  poda: "bg-green-100 text-green-700 border-green-200",
  fitosanidad: "bg-orange-100 text-orange-700 border-orange-200",
  fertilizacion: "bg-blue-100 text-blue-700 border-blue-200",
  manejo: "bg-amber-100 text-amber-700 border-amber-200",
  cosecha: "bg-red-100 text-red-700 border-red-200",
};

const CAT_DOT_COLORS: Record<string, string> = {
  fenologia: "bg-violet-500",
  poda: "bg-green-500",
  fitosanidad: "bg-orange-500",
  fertilizacion: "bg-blue-500",
  manejo: "bg-amber-500",
  cosecha: "bg-red-500",
};

const CHART_COLORS = {
  planificadas: "#3B82F6",
  ejecutadas: "#22C55E",
  atrasadas: "#EF4444",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine display status -- atrasada if planificada + past date */
function displayStatus(labor: EjecucionLabor): string {
  if (labor.estado === "planificada" && labor.fecha_programada) {
    const programmed = new Date(labor.fecha_programada);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (programmed < today) return "atrasada";
  }
  return labor.estado;
}

/** Today's date formatted in locale style */
function todayFormatted(): string {
  const d = new Date();
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LaboresPage() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const lk = useLookups();
  const { data: testblocks } = useTestblocks();
  const { data: tiposLabor } = useQuery({
    queryKey: ["tipos-labor"],
    queryFn: () => mantenedorService("tipos-labor").list(),
  });

  // Fetch estados fenologicos from API
  const { data: allEstadosFenol } = useQuery({
    queryKey: ["estados-fenologicos"],
    queryFn: () => laboresService.estadosFenologicos(),
    staleTime: 5 * 60_000,
  });

  const especiesRaw = (lk.rawData.especies || []) as { id_especie: number; nombre: string }[];

  // --- state ---
  const [campoFilter, setCampoFilter] = useState<string>("");
  const [tbFilter, setTbFilter] = useState<string>("");
  const [monthFilter, setMonthFilter] = useState<string>(""); // "" = todos, "1".."12" = mes
  const [createOpen, setCreateOpen] = useState(false);
  const [planTbOpen, setPlanTbOpen] = useState(false);
  const [ejecutarOpen, setEjecutarOpen] = useState(false);
  const [selectedLabor, setSelectedLabor] = useState<EjecucionLabor | null>(null);
  const [evidenciaOpen, setEvidenciaOpen] = useState(false);
  const [evidenciaLabor, setEvidenciaLabor] = useState<EjecucionLabor | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLabor, setQrLabor] = useState<EjecucionLabor | null>(null);
  const [addEvidOpen, setAddEvidOpen] = useState(false);
  const [qrBlobUrl, setQrBlobUrl] = useState<string | null>(null);
  const [selectedPautaEspecieId, setSelectedPautaEspecieId] = useState<number | null>(null);
  const [pautaChecked, setPautaChecked] = useState<Set<string>>(new Set());
  const [expandedPautaLabor, setExpandedPautaLabor] = useState<number | null>(null);

  // OT (Ordenes de Trabajo) state
  const [otWizardOpen, setOtWizardOpen] = useState(false);
  const [otEjecOpen, setOtEjecOpen] = useState(false);
  const [selectedOt, setSelectedOt] = useState<OrdenTrabajo | null>(null);

  const tbFilterNum = tbFilter && tbFilter !== "all" ? Number(tbFilter) : undefined;

  // --- queries ---
  const { data: planificacion, isLoading: loadingPlan } = useQuery({
    queryKey: ["labores", "planificacion", tbFilterNum],
    queryFn: () => laboresService.planificacion(tbFilterNum ? { testblock: tbFilterNum } : undefined),
  });

  const { data: dashboard } = useQuery<LaborDashboard>({
    queryKey: ["labores", "dashboard", tbFilterNum],
    queryFn: () => laboresService.dashboard(tbFilterNum ? { testblock: tbFilterNum } : undefined),
  });

  const { data: evidencias, refetch: refetchEvidencias } = useQuery({
    queryKey: ["labores", "evidencias", evidenciaLabor?.id_ejecucion],
    queryFn: () => laboresService.evidencias(evidenciaLabor!.id_ejecucion),
    enabled: !!evidenciaLabor,
  });

  // Ordenes de Trabajo query
  const { data: ordenesTrabajo, isLoading: loadingOts } = useQuery({
    queryKey: ["ordenes-trabajo", tbFilterNum],
    queryFn: () => ordenesTrabajoService.list(tbFilterNum ? { testblock: tbFilterNum } : undefined),
  });

  const deleteOtMut = useMutation({
    mutationFn: (id: number) => ordenesTrabajoService.remove(id),
    onSuccess: () => {
      toast.success("Orden eliminada");
      queryClient.invalidateQueries({ queryKey: ["ordenes-trabajo"] });
    },
  });

  // Detalles for expanded labor in pauta
  const selectedPautaEspecieName2 = selectedPautaEspecieId
    ? (especiesRaw.find((e) => e.id_especie === selectedPautaEspecieId)?.nombre ?? "")
    : "";
  const { data: pautaDetalles } = useQuery({
    queryKey: ["detalles-labor", expandedPautaLabor, selectedPautaEspecieName2],
    queryFn: () => laboresService.detallesLabor(expandedPautaLabor!, selectedPautaEspecieName2 || undefined),
    enabled: expandedPautaLabor != null,
  });

  // --- Compose pauta from API data ---
  const pautaItems: PautaItem[] = useMemo(() => {
    if (!selectedPautaEspecieId) return [];
    const items: PautaItem[] = [];

    // Add fenological states for selected species
    const estados = ((allEstadosFenol || []) as EstadoFenologico[])
      .filter((e) => e.id_especie === selectedPautaEspecieId && e.activo !== false)
      .sort((a, b) => a.orden - b.orden);

    for (const e of estados) {
      items.push({
        id: `fen-${e.id_estado}`,
        tipo: "Fenologia",
        nombre: e.nombre,
        mes: e.mes_orientativo || "-",
        cat: "fenologia",
        orden: e.orden * 2, // even numbers for fenologia to interleave with labores
        color_hex: e.color_hex,
      });
    }

    // Add labor types (non-fenologia)
    const labores = ((tiposLabor || []) as any[])
      .filter((t: any) => t.categoria !== "fenologia" && t.activo !== false);
    for (const t of labores) {
      items.push({
        id: `lab-${t.id_labor}`,
        tipo: "Labor",
        nombre: t.nombre,
        mes: "-",
        cat: t.categoria || "manejo",
        orden: 999 + (t.id_labor || 0),
        color_hex: null,
      });
    }

    // Sort: fenologia by orden first, then labores appended
    items.sort((a, b) => a.orden - b.orden);

    return items;
  }, [selectedPautaEspecieId, allEstadosFenol, tiposLabor]);

  // Initialize checked set when pauta changes
  useMemo(() => {
    if (pautaItems.length > 0) {
      setPautaChecked(new Set(pautaItems.map((p) => p.id)));
    }
  }, [pautaItems]);

  const selectedPautaEspecieName = selectedPautaEspecieId
    ? especiesRaw.find((e) => e.id_especie === selectedPautaEspecieId)?.nombre ?? ""
    : "";

  // --- lookup maps ---
  const laborMap = new Map<number, string>();
  ((tiposLabor || []) as any[]).forEach((t: any) => {
    laborMap.set(t.id_labor, `${t.nombre} (${t.categoria || ""})`);
  });
  const resolvLabor = (id: unknown) => {
    if (id == null) return "-";
    return laborMap.get(id as number) || `#${id}`;
  };

  // Group testblocks by campo for hierarchical navigation
  const campoGroups = useMemo(() => {
    const groups: Record<string, { id: string; nombre: string; testblocks: any[] }> = {};
    for (const tb of testblocks || []) {
      const cid = String(tb.id_campo || "sin-campo");
      const cname = (tb as any).campo_nombre || `Campo #${tb.id_campo || "?"}`;
      if (!groups[cid]) groups[cid] = { id: cid, nombre: cname, testblocks: [] };
      groups[cid].testblocks.push(tb);
    }
    return Object.values(groups).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [testblocks]);

  // Testblocks filtered by selected campo
  const filteredTbs = useMemo(() => {
    if (!campoFilter || campoFilter === "all") return testblocks || [];
    return (testblocks || []).filter((tb) => String(tb.id_campo) === campoFilter);
  }, [testblocks, campoFilter]);

  const selectedCampoName = campoGroups.find((g) => g.id === campoFilter)?.nombre;
  const selectedTbName = (testblocks || []).find((tb) => String(tb.id_testblock) === tbFilter)?.nombre;

  const tbOpts = filteredTbs.map((tb) => ({
    value: tb.id_testblock,
    label: `${tb.nombre} (${tb.codigo})`,
  }));
  const laborOpts = ((tiposLabor || []) as any[]).map((t: any) => ({
    value: t.id_labor,
    label: `${t.nombre} (${t.categoria || ""})`,
  }));

  // --- mutations ---
  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => laboresService.crearPlanificacion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labores"] });
      toast.success("Labor planificada");
    },
  });

  const planTbMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => laboresService.crearPlanificacionTestblock(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["labores"] });
      toast.success(`${res.created} labores planificadas para el testblock`);
    },
  });

  const ejecutarMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      laboresService.ejecutar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labores"] });
      toast.success("Labor ejecutada");
    },
  });

  const addEvidMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      laboresService.addEvidencia(id, data),
    onSuccess: () => {
      refetchEvidencias();
      toast.success("Evidencia agregada");
    },
  });

  // --- derived data ---
  const allLabores = planificacion || [];

  /** Labores filtered by selected month (for Plan and Calendario tabs).
   *  Month-specific tabs (Hoy/Semana/Atrasadas) keep using `allLabores`
   *  because they have their own temporal meaning. */
  const laboresMes = useMemo(() => {
    if (!monthFilter) return allLabores;
    const mNum = Number(monthFilter);
    return allLabores.filter((l) => {
      if (!l.fecha_programada) return false;
      const m = new Date(l.fecha_programada).getMonth() + 1;
      return m === mNum;
    });
  }, [allLabores, monthFilter]);

  const atrasadas = useMemo(
    () => allLabores.filter((l) => displayStatus(l) === "atrasada"),
    [allLabores],
  );

  /** Labores for the "Hoy" tab: today's scheduled + overdue (for the view) */
  const laboresHoy = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return allLabores.filter((l) => {
      const st = displayStatus(l);
      if (st === "atrasada") return true;
      if (l.estado === "planificada" && l.fecha_programada?.slice(0, 10) === todayStr) return true;
      if (l.estado === "ejecutada" && l.fecha_ejecucion?.slice(0, 10) === todayStr) return true;
      return false;
    });
  }, [allLabores]);

  /** Strictly today's scheduled (for the "Hoy" KPI — excludes overdue) */
  const laboresHoyStrict = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return allLabores.filter(
      (l) =>
        l.estado === "planificada" &&
        l.fecha_programada?.slice(0, 10) === todayStr,
    );
  }, [allLabores]);

  /** Labores strictly within current week (Mon–Sun), aligned with backend `esta_semana` */
  const laboresSemana = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay() === 0 ? 6 : today.getDay() - 1; // Mon=0..Sun=6
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dow);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return allLabores.filter((l) => {
      if (l.estado === "ejecutada") return false;
      if (!l.fecha_programada) return false;
      const fp = new Date(l.fecha_programada);
      return fp >= weekStart && fp <= weekEnd;
    });
  }, [allLabores]);

  // Chart data: por mes
  const chartPorMes = useMemo(() => {
    if (!dashboard?.por_mes) return [];
    return Object.entries(dashboard.por_mes).map(([mes, vals]) => ({
      mes,
      planificadas: vals.planificadas,
      ejecutadas: vals.ejecutadas,
    }));
  }, [dashboard?.por_mes]);

  // Chart data: por tipo
  const chartPorTipo = useMemo(() => {
    if (!dashboard?.por_tipo) return [];
    return Object.entries(dashboard.por_tipo).map(([nombre, vals]) => {
      const total = vals.planificadas + vals.ejecutadas;
      return {
        nombre,
        planificadas: vals.planificadas,
        ejecutadas: vals.ejecutadas,
        atrasadas: vals.atrasadas,
        pct: total > 0 ? Math.round((vals.ejecutadas / total) * 100) : 0,
      };
    });
  }, [dashboard?.por_tipo]);

  // Use global temporada selector as default for all "plan" modals
  const currentTemporada = useTemporadaStore((s) => s.current);

  // --- form fields ---
  const createFields: FieldDef[] = [
    {
      key: "id_posicion",
      label: "ID Posición",
      type: "number",
      placeholder: "Copia el ID desde la grilla del TestBlock",
    },
    { key: "id_labor", label: "Tipo de Labor", type: "select", required: true, options: laborOpts },
    { key: "temporada", label: "Temporada", type: "text", placeholder: currentTemporada },
    { key: "fecha_programada", label: "Fecha Programada", type: "date", required: true },
    { key: "observaciones", label: "Observaciones", type: "textarea" },
  ];

  const planTbFields: FieldDef[] = [
    { key: "id_testblock", label: "TestBlock", type: "select", required: true, options: tbOpts },
    { key: "id_labor", label: "Tipo de Labor", type: "select", required: true, options: laborOpts },
    { key: "temporada", label: "Temporada", type: "text", placeholder: currentTemporada },
    { key: "fecha_programada", label: "Fecha Programada", type: "date", required: true },
    { key: "observaciones", label: "Observaciones", type: "textarea" },
  ];

  // Load users for ejecutor selector
  const { data: usuariosSistema } = useQuery({
    queryKey: ["sistema", "usuarios"],
    queryFn: () => get<any[]>("/sistema/usuarios"),
    staleTime: 5 * 60_000,
  });
  const ejecutorOpts = (usuariosSistema || []).map((u: any) => ({
    value: u.username,
    label: u.nombre_completo || u.username,
  }));

  const ejecutarFields: FieldDef[] = [
    { key: "fecha_ejecucion", label: "Fecha Ejecución", type: "date", required: true },
    { key: "ejecutor", label: "Ejecutor", type: "select", required: true, options: ejecutorOpts },
    { key: "duracion_min", label: "Duración (min)", type: "number" },
    { key: "observaciones", label: "Observaciones", type: "textarea" },
  ];

  // --- table columns ---
  const planColumns = [
    { accessorKey: "id_ejecucion", header: "ID", size: 60 },
    {
      accessorKey: "id_labor",
      header: "Labor",
      cell: ({ getValue }: any) => resolvLabor(getValue()),
    },
    { accessorKey: "temporada", header: "Temporada", size: 100 },
    { accessorKey: "id_posicion", header: "Posición", size: 80 },
    {
      accessorKey: "fecha_programada",
      header: "Programada",
      cell: ({ getValue }: any) => formatDate(getValue() as string),
    },
    {
      id: "estado_display",
      header: "Estado",
      cell: ({ row }: any) => {
        const labor = row.original as EjecucionLabor;
        const st = displayStatus(labor);
        return <StatusBadge status={st} />;
      },
    },
    { accessorKey: "ejecutor", header: "Ejecutor" },
    {
      accessorKey: "duracion_min",
      header: "Min.",
      size: 60,
      cell: ({ getValue }: any) => getValue() ?? "-",
    },
    {
      id: "acciones",
      header: "Acciones",
      size: 160,
      cell: ({ row }: any) => {
        const labor = row.original as EjecucionLabor;
        const st = displayStatus(labor);
        return (
          <div className="flex gap-1">
            {(st === "planificada" || st === "atrasada") && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Ejecutar rápido (1 click)"
                  onClick={() => {
                    ejecutarMut.mutate({
                      id: labor.id_ejecucion,
                      data: {
                        fecha_ejecucion: new Date().toISOString().slice(0, 10),
                        ejecutor: useAuthStore.getState().user?.username || "sistema",
                      },
                    });
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Ejecutar con detalle"
                  onClick={() => {
                    setSelectedLabor(labor);
                    setEjecutarOpen(true);
                  }}
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              title="Evidencia"
              onClick={() => {
                setEvidenciaLabor(labor);
                setEvidenciaOpen(true);
              }}
            >
              <Camera className="h-4 w-4 text-blue-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="QR"
              onClick={() => handleOpenQr(labor)}
            >
              <QrCode className="h-4 w-4 text-garces-cherry" />
            </Button>
          </div>
        );
      },
    },
  ];

  // --- Fetch QR image as blob for display + download ---
  const fetchQrBlob = async (id: number): Promise<string | null> => {
    try {
      const url = laboresService.qrUrl(id);
      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  };

  const handleOpenQr = async (labor: EjecucionLabor) => {
    setQrLabor(labor);
    setQrOpen(true);
    const blobUrl = await fetchQrBlob(labor.id_ejecucion);
    setQrBlobUrl(blobUrl);
  };

  const handleDownloadQr = () => {
    if (!qrBlobUrl || !qrLabor) return;
    const link = document.createElement("a");
    link.href = qrBlobUrl;
    link.download = `qr_labor_${qrLabor.id_ejecucion}.png`;
    link.click();
  };

  const handleCloseQr = () => {
    setQrOpen(false);
    setQrLabor(null);
    if (qrBlobUrl) {
      URL.revokeObjectURL(qrBlobUrl);
      setQrBlobUrl(null);
    }
  };

  // --- Quick execute handler ---
  const handleQuickExecute = (labor: EjecucionLabor) => {
    ejecutarMut.mutate({
      id: labor.id_ejecucion,
      data: {
        fecha_ejecucion: new Date().toISOString().slice(0, 10),
        ejecutor: useAuthStore.getState().user?.username || "sistema",
      },
    });
  };

  // --- Pauta checkbox toggle ---
  const togglePautaItem = (id: string) => {
    setPautaChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Count pending/ejecutada for Hoy summary (tab view — includes overdue)
  const hoyPendientes = laboresHoy.filter((l) => displayStatus(l) !== "ejecutada").length;
  const hoyEjecutadas = laboresHoy.filter((l) => displayStatus(l) === "ejecutada").length;
  // Count strictly today's scheduled labores for KPI (excludes overdue)
  const hoyStrictPendientes = laboresHoyStrict.length;

  // Guess labor "tipo" from labor name for badge display
  const guessTipo = (labor: EjecucionLabor): "Labor" | "Fenologia" => {
    const name = resolvLabor(labor.id_labor).toLowerCase();
    if (
      name.includes("fenolog") || name.includes("floraci") ||
      name.includes("caida") || name.includes("yema") ||
      name.includes("cuaja") || name.includes("pinta") ||
      name.includes("envero") || name.includes("verde")
    ) {
      return "Fenologia";
    }
    return "Labor";
  };

  return (
    <div className="space-y-6">
      {/* ==================== HEADER ==================== */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-garces-cherry">Gestión de Labores</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Labores y registro fenológico integrado
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Planificar Posición
          </Button>
          <Button size="sm" onClick={() => setPlanTbOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Planificar TestBlock
          </Button>
        </div>
      </div>

      {/* ==================== KPI CARDS (4 in a row, mockup style) ==================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Hoy"
          value={hoyStrictPendientes}
          icon={CalendarDays}
          className="border-blue-200"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          trend="programadas para hoy"
        />
        <KpiCard
          title="Esta semana"
          value={dashboard?.esta_semana ?? laboresSemana.length}
          icon={Clock}
          trend="pendientes"
        />
        <KpiCard
          title="Atrasadas"
          value={dashboard?.atrasadas ?? atrasadas.length}
          icon={AlertTriangle}
          className={
            (dashboard?.atrasadas ?? atrasadas.length) > 0
              ? "border-red-300 bg-red-50"
              : ""
          }
          iconBg="bg-red-50"
          iconColor="text-red-600"
          trend="vencidas"
        />
        <KpiCard
          title="Cumplimiento"
          value={`${dashboard?.pct_cumplimiento ?? 0}%`}
          icon={TrendingUp}
          className="border-green-300 bg-green-50"
          iconBg="bg-green-50"
          iconColor="text-green-600"
          trend="este mes"
        />
      </div>

      {/* ==================== HIERARCHICAL FILTER: Campo → TestBlock ==================== */}
      <div className="bg-white border rounded-lg p-3 space-y-2">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          <button
            className={`hover:text-garces-cherry transition-colors ${!campoFilter ? "font-semibold text-foreground" : "underline cursor-pointer"}`}
            onClick={() => { setCampoFilter(""); setTbFilter(""); }}
          >
            Todos los campos
          </button>
          {campoFilter && campoFilter !== "all" && (
            <>
              <ChevronRight className="h-3 w-3" />
              <button
                className={`hover:text-garces-cherry transition-colors ${!tbFilter ? "font-semibold text-foreground" : "underline cursor-pointer"}`}
                onClick={() => setTbFilter("")}
              >
                {selectedCampoName}
              </button>
            </>
          )}
          {tbFilter && tbFilter !== "all" && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="font-semibold text-foreground">{selectedTbName}</span>
            </>
          )}
        </div>

        {/* Selectors row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Select value={campoFilter || "all"} onValueChange={(v) => { setCampoFilter(v === "all" ? "" : v); setTbFilter(""); }}>
              <SelectTrigger className="w-56 h-9">
                <SelectValue placeholder="Seleccionar campo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los campos</SelectItem>
                {campoGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nombre} ({g.testblocks.length} TB)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <Hammer className="h-4 w-4 text-muted-foreground" />
            <Select value={tbFilter || "all"} onValueChange={(v) => setTbFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-64 h-9">
                <SelectValue placeholder="Seleccionar testblock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {campoFilter ? `Todos los TB de ${selectedCampoName}` : "Todos los testblocks"}
                </SelectItem>
                {tbOpts.map((o) => (
                  <SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Select value={monthFilter || "all"} onValueChange={(v) => setMonthFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Seleccionar mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {[
                  { v: "1", l: "Enero" }, { v: "2", l: "Febrero" }, { v: "3", l: "Marzo" },
                  { v: "4", l: "Abril" }, { v: "5", l: "Mayo" }, { v: "6", l: "Junio" },
                  { v: "7", l: "Julio" }, { v: "8", l: "Agosto" }, { v: "9", l: "Septiembre" },
                  { v: "10", l: "Octubre" }, { v: "11", l: "Noviembre" }, { v: "12", l: "Diciembre" },
                ].map((m) => (
                  <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(campoFilter || tbFilter || monthFilter) && (
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => { setCampoFilter(""); setTbFilter(""); setMonthFilter(""); }}>
              <X className="h-3 w-3 mr-1" /> Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* ==================== TABS ==================== */}
      <Tabs defaultValue="hoy">
        {/* --- Two-row tab bar for clarity --- */}
        <div className="space-y-1">
          {/* Row 1: Labores del día a día */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-16 shrink-0">Labores</span>
            <TabsList>
              <TabsTrigger value="hoy" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Hoy
              </TabsTrigger>
              <TabsTrigger value="semana" className="gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Semana
              </TabsTrigger>
              <TabsTrigger value="pauta" className="gap-1">
                <Leaf className="h-3.5 w-3.5" /> Pauta
              </TabsTrigger>
              <TabsTrigger value="plan">Plan ({laboresMes.length}{monthFilter ? ` de ${allLabores.length}` : ""})</TabsTrigger>
              <TabsTrigger value="calendario" className="gap-1">
                <Calendar className="h-3.5 w-3.5" /> Calendario
              </TabsTrigger>
              <TabsTrigger
                value="atrasadas"
                className={atrasadas.length > 0 ? "text-red-600 gap-1" : "gap-1"}
              >
                Atrasadas
                {atrasadas.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                    {atrasadas.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
          {/* Row 2: Ordenes de Trabajo & gestión */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-16 shrink-0">OT</span>
            <TabsList>
              <TabsTrigger value="ordenes" className="gap-1">
                <ClipboardList className="h-3.5 w-3.5" /> Ordenes
                {(ordenesTrabajo || []).length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-garces-cherry text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                    {(ordenesTrabajo || []).length}
                  </span>
                )}
              </TabsTrigger>
              {/* Kanban y Por Persona deshabilitados: Kanban no renderiza datos
                 y Por Persona requiere integracion con asignacion a usuarios
                 que aun no esta implementada. Se reactivaran en Fase 4+. */}
              {import.meta.env.DEV && (
                <>
                  <TabsTrigger value="kanban" className="gap-1">Kanban</TabsTrigger>
                  <TabsTrigger value="por-persona" className="gap-1">Por Persona</TabsTrigger>
                </>
              )}
              <TabsTrigger value="cumplimiento" className="gap-1">Cumplimiento</TabsTrigger>
              <TabsTrigger value="desviaciones" className="gap-1">Plan vs Real</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* ==================== TAB: HOY ==================== */}
        <TabsContent value="hoy">
          <div className="space-y-3">
            {/* Date summary line */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">
                {todayFormatted()} -- {hoyPendientes} pendiente{hoyPendientes !== 1 ? "s" : ""}, {hoyEjecutadas} ejecutada{hoyEjecutadas !== 1 ? "s" : ""}
              </p>
              {atrasadas.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!confirm(`Ejecutar las ${atrasadas.length} labores atrasadas? Se procesarán en lotes de 50.`)) return;
                      let total = 0;
                      for (let i = 0; i < atrasadas.length; i += 50) {
                        const batch = atrasadas.slice(i, i + 50).map((l) => l.id_ejecucion);
                        try {
                          await laboresService.ejecutarMasivo(batch);
                          total += batch.length;
                        } catch { break; }
                      }
                      queryClient.invalidateQueries({ queryKey: ["labores"] });
                      toast.success(`${total} labores marcadas como ejecutadas`);
                    }}
                  >
                    Ejecutar todas ({atrasadas.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={async () => {
                      const ids = atrasadas.slice(0, 50).map((l) => l.id_ejecucion);
                      await laboresService.ejecutarMasivo(ids);
                      queryClient.invalidateQueries({ queryKey: ["labores"] });
                      toast.success(`${ids.length} labores ejecutadas (lote de 50)`);
                    }}
                  >
                    Solo 50
                  </Button>
                </div>
              )}
            </div>

            {/* Checklist items */}
            {laboresHoy.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h4 className="font-semibold">Todo al dia</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  No hay labores pendientes para hoy.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {laboresHoy.map((labor) => {
                  const st = displayStatus(labor);
                  const isEjecutada = st === "ejecutada";
                  const tipo = guessTipo(labor);

                  return (
                    <div
                      key={labor.id_ejecucion}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-shadow hover:shadow-sm ${
                        isEjecutada
                          ? "bg-green-50 border-green-200"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      {/* Circular check button */}
                      <button
                        onClick={() => !isEjecutada && handleQuickExecute(labor)}
                        disabled={isEjecutada || ejecutarMut.isPending}
                        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                          isEjecutada
                            ? "bg-green-500 text-white cursor-default"
                            : "border-2 border-gray-300 bg-white hover:border-green-400 hover:bg-green-50 cursor-pointer"
                        }`}
                        title={isEjecutada ? "Ejecutada" : "Marcar como ejecutada"}
                      >
                        {isEjecutada && (
                          <CheckCircle2 className="h-5 w-5" />
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={`font-semibold text-sm ${
                              isEjecutada
                                ? "line-through text-muted-foreground"
                                : "text-gray-900"
                            }`}
                          >
                            {resolvLabor(labor.id_labor)}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              tipo === "Fenologia"
                                ? "bg-violet-100 text-violet-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {tipo}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {labor.temporada ? `${labor.temporada} - ` : ""}
                          Pos. {labor.id_posicion} - {formatDate(labor.fecha_programada)}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {tipo === "Fenologia" && !isEjecutada && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-violet-600 border-violet-200 bg-violet-50/50 hover:bg-violet-100 text-xs font-semibold h-8 px-2.5"
                            onClick={() => {
                              setEvidenciaLabor(labor);
                              setEvidenciaOpen(true);
                            }}
                          >
                            <Camera className="h-3.5 w-3.5 mr-1" /> Foto
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-muted-foreground border-gray-200 text-xs h-8 w-8 p-0"
                          onClick={() => {
                            setSelectedLabor(labor);
                            setEjecutarOpen(true);
                          }}
                          title="Más opciones"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ==================== TAB: SEMANA ==================== */}
        <TabsContent value="semana">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Labores pendientes hasta fin de semana. {laboresSemana.length} labor(es).
            </p>
            {laboresSemana.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center">
                <CalendarDays className="h-12 w-12 text-blue-400 mx-auto mb-3" />
                <h4 className="font-semibold">Sin labores esta semana</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  No hay labores planificadas hasta fin de semana.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {laboresSemana.map((labor) => {
                  const st = displayStatus(labor);
                  const tipo = guessTipo(labor);

                  return (
                    <div
                      key={labor.id_ejecucion}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:shadow-sm transition-shadow"
                    >
                      <button
                        onClick={() => handleQuickExecute(labor)}
                        disabled={ejecutarMut.isPending}
                        className="flex-shrink-0 w-9 h-9 rounded-full border-2 border-gray-300 bg-white hover:border-green-400 hover:bg-green-50 cursor-pointer flex items-center justify-center transition-colors"
                        title="Marcar como ejecutada"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm text-gray-900">
                            {resolvLabor(labor.id_labor)}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              tipo === "Fenologia"
                                ? "bg-violet-100 text-violet-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {tipo}
                          </span>
                          {st === "atrasada" && (
                            <StatusBadge status="atrasada" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          Pos. {labor.id_posicion} - {formatDate(labor.fecha_programada)}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-muted-foreground border-gray-200 text-xs h-8 w-8 p-0"
                        onClick={() => {
                          setSelectedLabor(labor);
                          setEjecutarOpen(true);
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ==================== TAB: PAUTA POR ESPECIE (API-driven) ==================== */}
        <TabsContent value="pauta">
          <div className="space-y-4">
            {/* Species selector pills — from API */}
            <div className="flex gap-2 flex-wrap">
              {especiesRaw.map((especie) => {
                const isSelected = selectedPautaEspecieId === especie.id_especie;
                return (
                  <button
                    key={especie.id_especie}
                    onClick={() => setSelectedPautaEspecieId(isSelected ? null : especie.id_especie)}
                    className={`px-4 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                      isSelected
                        ? "border-garces-cherry bg-garces-cherry/10 text-garces-cherry"
                        : "border-gray-200 bg-white text-muted-foreground hover:border-gray-300"
                    }`}
                  >
                    {especie.nombre}
                  </button>
                );
              })}
            </div>

            {/* Pauta table when species selected and has data */}
            {selectedPautaEspecieId && pautaItems.length > 0 && (
              <div className="bg-white rounded-xl border overflow-hidden">
                {/* Pauta header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50/80">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">
                      Pauta {selectedPautaEspecieName} — Temporada {currentTemporada}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {pautaItems.length} items ({pautaItems.filter((p) => p.tipo === "Fenologia").length} fenologia + {pautaItems.filter((p) => p.tipo === "Labor").length} labores)
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setPlanTbOpen(true)}
                  >
                    Aplicar pauta a TestBlock
                  </Button>
                </div>

                {/* Pauta items */}
                <div className="divide-y divide-gray-100">
                  {pautaItems.map((p) => {
                    const catClass = CAT_COLORS[p.cat] || "bg-gray-100 text-gray-700";
                    const dotClass = CAT_DOT_COLORS[p.cat] || "bg-gray-400";
                    const laborId = p.tipo === "Labor" ? Number(p.id.replace("lab-", "")) : null;
                    const isExpanded = laborId != null && expandedPautaLabor === laborId;

                    return (
                      <div key={p.id}>
                        <div
                          className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50/50 transition-colors cursor-pointer"
                          onClick={() => {
                            if (laborId != null) {
                              setExpandedPautaLabor(isExpanded ? null : laborId);
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={pautaChecked.has(p.id)}
                            onChange={(e) => { e.stopPropagation(); togglePautaItem(p.id); }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-gray-300 text-garces-cherry focus:ring-garces-cherry"
                          />
                          {laborId != null ? (
                            isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            p.color_hex
                              ? <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: p.color_hex }} />
                              : <span className="w-3.5" />
                          )}
                          <span className="flex-1 font-semibold text-sm">
                            {p.nombre}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${catClass}`}
                          >
                            {p.tipo}
                          </span>
                          <span className="text-xs text-muted-foreground w-16 text-right">
                            {p.mes}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${dotClass} opacity-60`}
                          />
                        </div>

                        {/* Expanded detalles for labor items */}
                        {isExpanded && (
                          <div className="bg-gray-50/80 border-t border-gray-100 px-10 py-3">
                            <div className="flex items-center gap-2 mb-2">
                              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Instrucciones / Checklist
                              </span>
                            </div>
                            {!pautaDetalles || pautaDetalles.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">Sin instrucciones configuradas</p>
                            ) : (
                              <div className="space-y-1">
                                {(pautaDetalles as DetalleLabor[]).map((d, idx) => (
                                  <div key={d.id_detalle} className="flex items-start gap-2 text-sm">
                                    <span className="text-xs text-muted-foreground font-mono w-5 shrink-0 mt-0.5">
                                      {idx + 1}.
                                    </span>
                                    <span>{d.descripcion}</span>
                                    {d.aplica_especie && d.aplica_especie !== "General" && (
                                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded shrink-0">
                                        {d.aplica_especie}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state for selected species with no data */}
            {selectedPautaEspecieId && pautaItems.length === 0 && (
              <div className="bg-white rounded-xl border p-12 text-center">
                <Scissors className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">
                  Sin estados fenológicos para {selectedPautaEspecieName}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Un administrador puede poblar los estados desde Mantenedores o ejecutando el seed.
                </p>
              </div>
            )}

            {/* Empty state */}
            {!selectedPautaEspecieId && (
              <div className="bg-white rounded-xl border p-16 text-center">
                <Plus className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">
                  Selecciona una especie para ver su pauta
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ==================== TAB: PLAN (grouped by TB → Month → Type) ==================== */}
        <TabsContent value="plan">
          <TabPlanAgrupado testblockFilter={tbFilterNum} monthFilter={monthFilter} />
        </TabsContent>

        {/* ==================== TAB: CALENDARIO (existing LaborCalendar) ==================== */}
        <TabsContent value="calendario">
          <LaborCalendar
            labores={laboresMes}
            laborNames={laborMap}
            onSelectLabor={(labor) => {
              const st = displayStatus(labor);
              if (st === "planificada" || st === "atrasada") {
                setSelectedLabor(labor);
                setEjecutarOpen(true);
              } else {
                setEvidenciaLabor(labor);
                setEvidenciaOpen(true);
              }
            }}
          />
        </TabsContent>

        {/* ==================== TAB: ATRASADAS ==================== */}
        <TabsContent value="atrasadas">
          {atrasadas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
              <p className="font-medium">Sin labores atrasadas</p>
              <p className="text-sm">Todas las labores estan al dia.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>
                  {atrasadas.length} labor(es) con fecha programada vencida. Requieren atencion inmediata.
                </span>
              </div>

              {/* Checklist-style atrasadas */}
              <div className="flex flex-col gap-2">
                {atrasadas.map((labor) => {
                  const tipo = guessTipo(labor);
                  return (
                    <div
                      key={labor.id_ejecucion}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50/50 hover:shadow-sm transition-shadow"
                    >
                      <button
                        onClick={() => handleQuickExecute(labor)}
                        disabled={ejecutarMut.isPending}
                        className="flex-shrink-0 w-9 h-9 rounded-full border-2 border-red-300 bg-white hover:border-green-400 hover:bg-green-50 cursor-pointer flex items-center justify-center transition-colors"
                        title="Marcar como ejecutada"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm text-gray-900">
                            {resolvLabor(labor.id_labor)}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              tipo === "Fenologia"
                                ? "bg-violet-100 text-violet-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {tipo}
                          </span>
                          <StatusBadge status="atrasada" />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {labor.temporada ? `${labor.temporada} - ` : ""}
                          Pos. {labor.id_posicion} - {formatDate(labor.fecha_programada)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:bg-green-50 h-8"
                          onClick={() => handleQuickExecute(labor)}
                          disabled={ejecutarMut.isPending}
                          title="Ejecutar rápido"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-muted-foreground border-gray-200 text-xs h-8 w-8 p-0"
                          onClick={() => {
                            setSelectedLabor(labor);
                            setEjecutarOpen(true);
                          }}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ==================== TAB: ORDENES DE TRABAJO (grouped) ==================== */}
        <TabsContent value="ordenes">
          <div className="space-y-4">
            {/* Header with actions */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Ordenes de Trabajo</h2>
                <p className="text-sm text-muted-foreground">
                  {(ordenesTrabajo || []).length} OT agrupadas por TestBlock y Mes
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!confirm("Auto-generar ordenes de trabajo para todas las labores pendientes de la temporada 2025-2026?\n\nSe creara una OT por cada combinacion TestBlock + Tipo Labor + Mes.")) return;
                    try {
                      const res = await ordenesTrabajoService.autoGenerar({ temporada: "2025-2026" });
                      toast.success(res.message);
                      queryClient.invalidateQueries({ queryKey: ["ordenes-trabajo"] });
                    } catch (e: any) {
                      toast.error(e.message || "Error al auto-generar");
                    }
                  }}
                >
                  Auto-generar OTs
                </Button>
                <Button
                  size="sm"
                  className="bg-garces-cherry hover:bg-garces-cherry/90 gap-1"
                  onClick={() => setOtWizardOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Nueva OT
                </Button>
              </div>
            </div>

            {/* Summary counters */}
            {(() => {
              const ots = ordenesTrabajo || [];
              const byEstado = {
                planificada: ots.filter((o) => o.estado === "planificada").length,
                en_progreso: ots.filter((o) => o.estado === "en_progreso").length,
                completada: ots.filter((o) => o.estado === "completada").length,
                parcial: ots.filter((o) => o.estado === "parcial").length,
                no_realizada: ots.filter((o) => o.estado === "no_realizada").length,
              };
              return (
                <div className="flex gap-3 flex-wrap">
                  {byEstado.planificada > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-xs font-medium text-blue-700">{byEstado.planificada} Planificadas</span>
                    </div>
                  )}
                  {byEstado.en_progreso > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-xs font-medium text-amber-700">{byEstado.en_progreso} En Progreso</span>
                    </div>
                  )}
                  {byEstado.completada > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs font-medium text-green-700">{byEstado.completada} Completadas</span>
                    </div>
                  )}
                  {byEstado.parcial > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 px-3 py-1">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                      <span className="text-xs font-medium text-orange-700">{byEstado.parcial} Parciales</span>
                    </div>
                  )}
                  {byEstado.no_realizada > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-200 px-3 py-1">
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                      <span className="text-xs font-medium text-gray-600">{byEstado.no_realizada} No Realizadas</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Grouped by Campo → TestBlock → Month */}
            {loadingOts ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Cargando ordenes...</p>
            ) : (ordenesTrabajo || []).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No hay ordenes de trabajo</p>
                <p className="text-xs mt-1">Usa "Auto-generar OTs" para crear ordenes desde labores planificadas</p>
              </div>
            ) : (() => {
              const ots = ordenesTrabajo || [];
              const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
              const allTbs = testblocks || [];

              // Resolve campo name for each OT via testblock lookup
              const tbCampoMap: Record<number, { campo_id: string; campo_nombre: string }> = {};
              for (const tb of allTbs) {
                tbCampoMap[tb.id_testblock] = {
                  campo_id: String(tb.id_campo || "sin-campo"),
                  campo_nombre: (tb as any).campo_nombre || `Campo #${tb.id_campo || "?"}`,
                };
              }

              // Group: Campo → TestBlock → Month
              type CampoGroup = { nombre: string; testblocks: Record<string, OrdenTrabajo[]> };
              const byCampo: Record<string, CampoGroup> = {};
              for (const ot of ots) {
                const info = ot.id_testblock ? tbCampoMap[ot.id_testblock] : null;
                const campoKey = info?.campo_nombre || "Sin Campo";
                const tbKey = ot.testblock_nombre || "Sin TestBlock";
                if (!byCampo[campoKey]) byCampo[campoKey] = { nombre: campoKey, testblocks: {} };
                if (!byCampo[campoKey].testblocks[tbKey]) byCampo[campoKey].testblocks[tbKey] = [];
                byCampo[campoKey].testblocks[tbKey].push(ot);
              }

              return (
                <div className="space-y-6">
                  {Object.entries(byCampo).map(([campoName, campoData]) => {
                    const campoOts = Object.values(campoData.testblocks).flat();
                    const campoCompletadas = campoOts.filter((o) => o.estado === "completada").length;
                    const campoPct = campoOts.length > 0 ? Math.round((campoCompletadas / campoOts.length) * 100) : 0;
                    return (
                      <div key={campoName} className="space-y-3">
                        {/* ── Campo header ── */}
                        <div className="flex items-center gap-3 pb-2 border-b-2 border-garces-cherry/20">
                          <div className="w-9 h-9 rounded-lg bg-garces-cherry/10 flex items-center justify-center">
                            <MapPin className="h-5 w-5 text-garces-cherry" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-base text-garces-cherry">{campoName}</h3>
                            <p className="text-xs text-muted-foreground">
                              {Object.keys(campoData.testblocks).length} testblocks &middot; {campoOts.length} OT &middot; {campoCompletadas} completadas
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-28 bg-gray-100 rounded-full h-2.5">
                              <div
                                className={`h-2.5 rounded-full transition-all ${campoPct >= 80 ? "bg-green-500" : campoPct >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                                style={{ width: `${campoPct}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold w-12 text-right">{campoPct}%</span>
                          </div>
                        </div>

                        {/* ── TestBlocks within campo ── */}
                        <div className="space-y-3 pl-4 border-l-2 border-garces-cherry/10">
                          {Object.entries(campoData.testblocks).map(([tbName, tbOts]) => {
                            const byMonth: Record<string, OrdenTrabajo[]> = {};
                            for (const ot of tbOts) {
                              const d = ot.fecha_plan_inicio ? new Date(ot.fecha_plan_inicio) : null;
                              const monthKey = d ? `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` : "Sin fecha";
                              if (!byMonth[monthKey]) byMonth[monthKey] = [];
                              byMonth[monthKey].push(ot);
                            }
                            const tbCompletadas = tbOts.filter((o) => o.estado === "completada").length;
                            const tbPct = tbOts.length > 0 ? Math.round((tbCompletadas / tbOts.length) * 100) : 0;
                            return (
                              <div key={tbName} className="border rounded-lg bg-white shadow-sm overflow-hidden">
                                {/* TestBlock header */}
                                <div className="bg-gradient-to-r from-blue-50 to-transparent border-b px-4 py-2.5 flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <Hammer className="h-4 w-4 text-blue-600" />
                                    <div>
                                      <h4 className="font-semibold text-sm">{tbName}</h4>
                                      <p className="text-[11px] text-muted-foreground">{tbOts.length} OT &middot; {tbCompletadas} completadas</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 bg-gray-100 rounded-full h-1.5">
                                      <div
                                        className={`h-1.5 rounded-full ${tbPct >= 80 ? "bg-green-500" : tbPct >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                                        style={{ width: `${tbPct}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground w-8 text-right">{tbPct}%</span>
                                  </div>
                                </div>
                                {/* Month groups within testblock */}
                                <div className="divide-y">
                                  {Object.entries(byMonth).map(([monthName, monthOts]) => (
                                    <div key={monthName} className="px-4 py-3">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{monthName}</span>
                                        <span className="text-[10px] bg-gray-100 rounded-full px-1.5 py-0.5 text-muted-foreground">{monthOts.length}</span>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {monthOts.map((ot) => {
                                          const prioClass =
                                            ot.prioridad === "alta" ? "border-l-red-500" :
                                            ot.prioridad === "media" ? "border-l-amber-400" :
                                            "border-l-green-400";
                                          return (
                                            <div
                                              key={ot.id}
                                              className={`border rounded-md p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors border-l-4 ${prioClass}`}
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-bold text-garces-cherry">{ot.codigo}</span>
                                                    <StatusBadge status={ot.estado} />
                                                  </div>
                                                  <p className="text-sm font-medium mt-1 truncate">{ot.tipo_labor_nombre || `Tipo #${ot.id_tipo_labor || "-"}`}</p>
                                                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                                                    <span>{formatDate(ot.fecha_plan_inicio)} - {formatDate(ot.fecha_plan_fin)}</span>
                                                  </div>
                                                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                    {ot.responsable_nombre && <span>Resp: {ot.responsable_nombre}</span>}
                                                    <span>Pos: {ot.posiciones_ejecutadas}/{ot.posiciones_total}</span>
                                                  </div>
                                                </div>
                                                <div className="flex flex-col gap-1 shrink-0">
                                                  {ot.estado !== "completada" && ot.estado !== "no_realizada" && (
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      className="h-7 px-2 text-xs gap-1"
                                                      onClick={() => { setSelectedOt(ot); setOtEjecOpen(true); }}
                                                    >
                                                      <Play className="h-3 w-3" /> Ejecutar
                                                    </Button>
                                                  )}
                                                  <div className="flex gap-0.5 justify-end">
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-6 w-6 p-0 text-muted-foreground"
                                                      onClick={() => toast.info("Edicion de OT pendiente de implementar")}
                                                    >
                                                      <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                      onClick={() => { if (confirm(`Eliminar orden ${ot.codigo}?`)) deleteOtMut.mutate(ot.id); }}
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </TabsContent>

        {/* ==================== TAB: KANBAN ==================== */}
        <TabsContent value="kanban">
          <TabKanban testblockFilter={tbFilterNum} />
        </TabsContent>

        {/* ==================== TAB: POR PERSONA ==================== */}
        <TabsContent value="por-persona">
          <TabPorPersona testblockFilter={tbFilterNum} />
        </TabsContent>

        {/* ==================== TAB: CUMPLIMIENTO ==================== */}
        <TabsContent value="cumplimiento">
          <TabCumplimientoTB />
        </TabsContent>

        {/* ==================== TAB: DESVIACIONES (Plan vs Real) ==================== */}
        <TabsContent value="desviaciones">
          <TabDesviaciones />
        </TabsContent>
      </Tabs>

      {/* Wizard dialog */}
      <NuevaOrdenTrabajoWizard
        open={otWizardOpen}
        onClose={() => setOtWizardOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["ordenes-trabajo"] })}
      />

      {/* Execution dialog */}
      {selectedOt && (
        <RegistrarEjecucionDialog
          open={otEjecOpen}
          onClose={() => { setOtEjecOpen(false); setSelectedOt(null); }}
          ot={selectedOt}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["ordenes-trabajo"] })}
        />
      )}

      {/* ==================== CHARTS (below tabs, collapsible section) ==================== */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-semibold text-garces-cherry flex items-center gap-2 select-none">
          <TrendingUp className="h-4 w-4" />
          Gráficos de cumplimiento
          <span className="text-xs text-muted-foreground font-normal">(click para expandir)</span>
        </summary>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* Bar chart: por mes */}
          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-garces-cherry mb-3">Labores por Mes</h3>
            {chartPorMes.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartPorMes}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="planificadas" name="Planificadas" fill={CHART_COLORS.planificadas} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ejecutadas" name="Ejecutadas" fill={CHART_COLORS.ejecutadas} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Sin datos</p>
            )}
          </div>

          {/* Horizontal bar: por tipo */}
          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-garces-cherry mb-3">Labores por Tipo</h3>
            {chartPorTipo.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartPorTipo} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="nombre" type="category" width={120} tick={{ fontSize: 10 }} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="ejecutadas" name="Ejecutadas" stackId="a" fill={CHART_COLORS.ejecutadas} />
                  <Bar dataKey="atrasadas" name="Atrasadas" stackId="a" fill={CHART_COLORS.atrasadas} />
                  <Bar
                    dataKey="planificadas"
                    name="Planificadas"
                    stackId="a"
                    fill={CHART_COLORS.planificadas}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Sin datos</p>
            )}
          </div>

          {/* Por tipo cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {chartPorTipo.map((t) => {
              const total = t.planificadas + t.ejecutadas;
              return (
                <div key={t.nombre} className="bg-white rounded-lg border p-4 shadow-sm">
                  <h4 className="font-medium text-sm text-garces-cherry">{t.nombre}</h4>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Cumplimiento</span>
                      <span className="font-semibold text-foreground">{t.pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          t.pct >= 80
                            ? "bg-green-500"
                            : t.pct >= 50
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${t.pct}%` }}
                      />
                    </div>
                    <div className="flex gap-3 text-xs mt-2">
                      <span className="text-blue-600">Plan: {t.planificadas}</span>
                      <span className="text-green-600">Ejec: {t.ejecutadas}</span>
                      {t.atrasadas > 0 && (
                        <span className="text-red-600 font-semibold">Atras: {t.atrasadas}</span>
                      )}
                      <span className="text-muted-foreground">Total: {total}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {chartPorTipo.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-10">
                Sin datos de labores por tipo.
              </p>
            )}
          </div>
        </div>
      </details>

      {/* ==================== MODALS ==================== */}

      {/* Create single position labor */}
      <CrudForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (data) => { await createMut.mutateAsync(data); }}
        fields={createFields}
        initialData={{ temporada: currentTemporada }}
        title="Planificar Labor (Posición)"
        isLoading={createMut.isPending}
      />

      {/* Plan testblock-level labor */}
      <CrudForm
        open={planTbOpen}
        onClose={() => setPlanTbOpen(false)}
        onSubmit={async (data) => { await planTbMut.mutateAsync(data); }}
        fields={planTbFields}
        initialData={{ temporada: currentTemporada }}
        title="Planificar Labor para TestBlock Completo"
        isLoading={planTbMut.isPending}
      />

      {/* Execute labor */}
      <CrudForm
        open={ejecutarOpen}
        onClose={() => { setEjecutarOpen(false); setSelectedLabor(null); }}
        onSubmit={async (data) => {
          if (!selectedLabor) return;
          await ejecutarMut.mutateAsync({ id: selectedLabor.id_ejecucion, data });
        }}
        fields={ejecutarFields}
        title={`Ejecutar: ${selectedLabor ? resolvLabor(selectedLabor.id_labor) : ""}`}
        isLoading={ejecutarMut.isPending}
        submitLabel="Registrar ejecución"
      />

      {/* --- Evidence Modal --- */}
      <Dialog open={evidenciaOpen} onOpenChange={(v) => { if (!v) { setEvidenciaOpen(false); setEvidenciaLabor(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Evidencia -- {evidenciaLabor ? resolvLabor(evidenciaLabor.id_labor) : ""}
              <span className="text-xs text-muted-foreground ml-2">
                (ID: {evidenciaLabor?.id_ejecucion})
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Evidence gallery */}
            {(evidencias && evidencias.length > 0) ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {evidencias.map((ev) => (
                  <div key={ev.id_evidencia} className="border rounded-lg p-2 bg-gray-50">
                    {ev.tipo === "foto" && ev.imagen_base64 ? (
                      <img
                        src={`data:image/jpeg;base64,${ev.imagen_base64}`}
                        alt={ev.descripcion || "Evidencia"}
                        className="w-full h-32 object-cover rounded"
                      />
                    ) : ev.tipo === "foto" && ev.url ? (
                      <img
                        src={ev.url}
                        alt={ev.descripcion || "Evidencia"}
                        className="w-full h-32 object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-32 bg-gray-200 rounded flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-xs mt-1 text-muted-foreground truncate">
                      {ev.descripcion || ev.tipo}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {ev.usuario} - {formatDate(ev.fecha_creacion)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Sin evidencia registrada</p>
              </div>
            )}

            {/* Add evidence button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setAddEvidOpen(true)}
            >
              <Camera className="h-4 w-4 mr-1" /> Agregar Evidencia
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Add Evidence Dialog --- */}
      <AddEvidenciaDialog
        open={addEvidOpen}
        onClose={() => setAddEvidOpen(false)}
        laborId={evidenciaLabor?.id_ejecucion ?? null}
        isPending={addEvidMut.isPending}
        onSubmit={async (data) => {
          if (!evidenciaLabor) return;
          await addEvidMut.mutateAsync({ id: evidenciaLabor.id_ejecucion, data });
        }}
      />

      {/* --- QR Modal --- */}
      <Dialog open={qrOpen} onOpenChange={(v) => { if (!v) handleCloseQr(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Código QR -- {qrLabor ? resolvLabor(qrLabor.id_labor) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {qrBlobUrl ? (
              <img
                src={qrBlobUrl}
                alt="QR Code"
                className="w-64 h-64 border rounded"
              />
            ) : (
              <div className="w-64 h-64 border rounded flex items-center justify-center bg-gray-50">
                <span className="text-sm text-muted-foreground">Generando QR...</span>
              </div>
            )}
            <div className="text-xs text-muted-foreground text-center space-y-1">
              <p>ID: {qrLabor?.id_ejecucion} | Posición: {qrLabor?.id_posicion}</p>
              <p>Programada: {formatDate(qrLabor?.fecha_programada)}</p>
              <p>Estado: {qrLabor ? displayStatus(qrLabor) : "-"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseQr}>
              Cerrar
            </Button>
            <Button onClick={handleDownloadQr} disabled={!qrBlobUrl}>
              <Download className="h-4 w-4 mr-1" /> Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Add Evidencia Dialog
// ---------------------------------------------------------------------------

function AddEvidenciaDialog({
  open,
  onClose,
  laborId,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  laborId: number | null;
  isPending: boolean;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<string>("foto");
  const [descripcion, setDescripcion] = useState("");
  const [imagenBase64, setImagenBase64] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:image/...;base64, prefix
      const base64 = result.split(",")[1];
      setImagenBase64(base64);
      setPreviewUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!laborId) return;
    const data: Record<string, unknown> = {
      tipo,
      descripcion: descripcion || null,
    };
    if (tipo === "foto" && imagenBase64) {
      data.imagen_base64 = imagenBase64;
    }
    await onSubmit(data);
    // Reset
    setTipo("foto");
    setDescripcion("");
    setImagenBase64(null);
    setPreviewUrl(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Evidencia</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="foto">Foto</SelectItem>
                <SelectItem value="nota">Nota</SelectItem>
                <SelectItem value="qr_scan">Escaneo QR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descripcion</Label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px]"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción de la evidencia..."
            />
          </div>
          {tipo === "foto" && (
            <div>
              <Label>Imagen</Label>
              <Input
                type="file"
                accept="image/*"
                className="mt-1"
                onChange={handleFileChange}
              />
              {previewUrl && (
                <div className="relative mt-2">
                  <img src={previewUrl} alt="Preview" className="w-full h-40 object-cover rounded border" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 bg-white/80 h-6 w-6"
                    onClick={() => { setImagenBase64(null); setPreviewUrl(null); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
