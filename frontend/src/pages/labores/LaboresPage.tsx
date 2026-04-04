import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Hammer, CheckCircle2, Clock, AlertTriangle, Plus, CalendarDays,
  TrendingUp, QrCode, Camera, FileText, Download, X, Image as ImageIcon,
  Calendar, MoreHorizontal, Leaf, Scissors,
} from "lucide-react";
import toast from "react-hot-toast";
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
import type { LaborDashboard } from "@/services/labores";
import { useTestblocks } from "@/hooks/useTestblock";
import { useAuthStore } from "@/stores/authStore";
import { mantenedorService } from "@/services/mantenedores";
import { formatDate } from "@/lib/utils";
import type { FieldDef } from "@/types";
import type { EjecucionLabor } from "@/types/laboratorio";
import { LaborCalendar } from "@/components/labores/LaborCalendar";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pauta data for Cerezo species (hardcoded from agronomic calendar) */
const PAUTA_CEREZO = [
  { id: 1, tipo: "Fenologia", nombre: "Inicio caida de hoja", icon: "L", mes: "Abr", cat: "fenologia" },
  { id: 2, tipo: "Fenologia", nombre: "50% caida de hoja", icon: "L", mes: "May", cat: "fenologia" },
  { id: 3, tipo: "Fenologia", nombre: "100% caida de hoja", icon: "L", mes: "Jun", cat: "fenologia" },
  { id: 4, tipo: "Labor", nombre: "Poda de formacion", icon: "P", mes: "Jun-Jul", cat: "poda" },
  { id: 5, tipo: "Fenologia", nombre: "Yema dormante", icon: "Y", mes: "Jul", cat: "fenologia" },
  { id: 6, tipo: "Labor", nombre: "Aplicacion Dormex", icon: "D", mes: "Jul", cat: "fitosanidad" },
  { id: 7, tipo: "Labor", nombre: "Fertilizacion base", icon: "F", mes: "Ago", cat: "fertilizacion" },
  { id: 8, tipo: "Fenologia", nombre: "Yema hinchada", icon: "Y", mes: "Ago", cat: "fenologia" },
  { id: 9, tipo: "Fenologia", nombre: "Punta verde", icon: "P", mes: "Sep", cat: "fenologia" },
  { id: 10, tipo: "Fenologia", nombre: "Inicio floracion", icon: "F", mes: "Sep", cat: "fenologia" },
  { id: 11, tipo: "Fenologia", nombre: "Plena floracion", icon: "F", mes: "Oct", cat: "fenologia" },
  { id: 12, tipo: "Labor", nombre: "Aplicacion GA3", icon: "G", mes: "Oct", cat: "fitosanidad" },
  { id: 13, tipo: "Fenologia", nombre: "Cuaja", icon: "C", mes: "Oct-Nov", cat: "fenologia" },
  { id: 14, tipo: "Labor", nombre: "Raleo", icon: "R", mes: "Nov", cat: "manejo" },
  { id: 15, tipo: "Fenologia", nombre: "Pinta / Envero", icon: "E", mes: "Nov", cat: "fenologia" },
  { id: 16, tipo: "Labor", nombre: "Cosecha", icon: "C", mes: "Nov-Dic", cat: "cosecha" },
];

const SPECIES_PILLS = ["Cerezo", "Ciruela", "Nectarin", "Durazno"] as const;

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
  const days = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
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
  const { data: testblocks } = useTestblocks();
  const { data: tiposLabor } = useQuery({
    queryKey: ["tipos-labor"],
    queryFn: () => mantenedorService("tipos-labor").list(),
  });

  // --- state ---
  const [tbFilter, setTbFilter] = useState<string>("");
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
  const [selectedPauta, setSelectedPauta] = useState<string | null>(null);
  const [pautaChecked, setPautaChecked] = useState<Set<number>>(
    () => new Set(PAUTA_CEREZO.map((p) => p.id)),
  );

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

  // --- lookup maps ---
  const laborMap = new Map<number, string>();
  ((tiposLabor || []) as any[]).forEach((t: any) => {
    laborMap.set(t.id_labor, `${t.nombre} (${t.categoria || ""})`);
  });
  const resolvLabor = (id: unknown) => {
    if (id == null) return "-";
    return laborMap.get(id as number) || `#${id}`;
  };

  const tbOpts = (testblocks || []).map((tb) => ({
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

  const atrasadas = useMemo(
    () => allLabores.filter((l) => displayStatus(l) === "atrasada"),
    [allLabores],
  );

  /** Labores for the "Hoy" tab: today's scheduled + overdue */
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

  /** Labores for the "Semana" tab */
  const laboresSemana = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    return allLabores.filter((l) => {
      if (l.estado === "ejecutada") return false;
      if (!l.fecha_programada) return false;
      const fp = new Date(l.fecha_programada);
      return fp <= endOfWeek;
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

  // --- form fields ---
  const createFields: FieldDef[] = [
    { key: "id_posicion", label: "ID Posicion", type: "number" },
    { key: "id_labor", label: "Tipo de Labor", type: "select", required: true, options: laborOpts },
    { key: "temporada", label: "Temporada", type: "text", placeholder: "2024-2025" },
    { key: "fecha_programada", label: "Fecha Programada", type: "date", required: true },
    { key: "observaciones", label: "Observaciones", type: "textarea" },
  ];

  const planTbFields: FieldDef[] = [
    { key: "id_testblock", label: "TestBlock", type: "select", required: true, options: tbOpts },
    { key: "id_labor", label: "Tipo de Labor", type: "select", required: true, options: laborOpts },
    { key: "temporada", label: "Temporada", type: "text", placeholder: "2025-2026" },
    { key: "fecha_programada", label: "Fecha Programada", type: "date", required: true },
    { key: "observaciones", label: "Observaciones", type: "textarea" },
  ];

  const ejecutarFields: FieldDef[] = [
    { key: "fecha_ejecucion", label: "Fecha Ejecucion", type: "date", required: true },
    { key: "ejecutor", label: "Ejecutor", type: "text", required: true },
    { key: "duracion_min", label: "Duracion (min)", type: "number" },
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
    { accessorKey: "id_posicion", header: "Posicion", size: 80 },
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
                  title="Ejecutar rapido (1 click)"
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
  const togglePautaItem = (id: number) => {
    setPautaChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Count pending/ejecutada for Hoy summary
  const hoyPendientes = laboresHoy.filter((l) => displayStatus(l) !== "ejecutada").length;
  const hoyEjecutadas = laboresHoy.filter((l) => displayStatus(l) === "ejecutada").length;

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
          <h2 className="text-xl font-bold text-garces-cherry">Gestion de Labores</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Labores y registro fenologico integrado
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Planificar Posicion
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
          value={hoyPendientes}
          icon={CalendarDays}
          className="border-blue-200"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          trend="labores programadas"
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

      {/* ==================== TB FILTER ==================== */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground">Filtrar por TestBlock:</label>
        <Select value={tbFilter} onValueChange={setTbFilter}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Todos los testblocks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {tbOpts.map((o) => (
              <SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tbFilter && tbFilter !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => setTbFilter("")}>Limpiar</Button>
        )}
      </div>

      {/* ==================== TABS ==================== */}
      <Tabs defaultValue="hoy">
        <TabsList>
          <TabsTrigger value="hoy" className="gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Hoy
          </TabsTrigger>
          <TabsTrigger value="semana" className="gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> Semana
          </TabsTrigger>
          <TabsTrigger value="pauta" className="gap-1">
            <Leaf className="h-3.5 w-3.5" /> Pauta por Especie
          </TabsTrigger>
          <TabsTrigger value="plan">Plan ({allLabores.length})</TabsTrigger>
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

        {/* ==================== TAB: HOY ==================== */}
        <TabsContent value="hoy">
          <div className="space-y-3">
            {/* Date summary line */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">
                {todayFormatted()} -- {hoyPendientes} pendiente{hoyPendientes !== 1 ? "s" : ""}, {hoyEjecutadas} ejecutada{hoyEjecutadas !== 1 ? "s" : ""}
              </p>
              {atrasadas.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const ids = atrasadas.slice(0, 50).map((l) => l.id_ejecucion);
                    laboresService.ejecutarMasivo(ids).then(() => {
                      queryClient.invalidateQueries({ queryKey: ["labores"] });
                      toast.success(`${ids.length} labores marcadas como ejecutadas`);
                    }).catch(() => toast.error("Error al ejecutar masivo"));
                  }}
                >
                  Ejecutar todas ({Math.min(atrasadas.length, 50)})
                </Button>
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
                          title="Mas opciones"
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

        {/* ==================== TAB: PAUTA POR ESPECIE ==================== */}
        <TabsContent value="pauta">
          <div className="space-y-4">
            {/* Species selector pills */}
            <div className="flex gap-2 flex-wrap">
              {SPECIES_PILLS.map((especie) => {
                const key = especie.toLowerCase();
                const isSelected = selectedPauta === key;
                return (
                  <button
                    key={especie}
                    onClick={() => setSelectedPauta(isSelected ? null : key)}
                    className={`px-4 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                      isSelected
                        ? "border-garces-cherry bg-garces-cherry/10 text-garces-cherry"
                        : "border-gray-200 bg-white text-muted-foreground hover:border-gray-300"
                    }`}
                  >
                    {especie}
                  </button>
                );
              })}
            </div>

            {/* Pauta table when species selected */}
            {selectedPauta === "cerezo" && (
              <div className="bg-white rounded-xl border overflow-hidden">
                {/* Pauta header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50/80">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">
                      Pauta Cerezo -- Temporada 2025-2026
                    </span>
                    <span className="text-xs text-muted-foreground">
                      16 items (9 fenologia + 7 labores)
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
                  {PAUTA_CEREZO.map((p) => {
                    const catClass = CAT_COLORS[p.cat] || "bg-gray-100 text-gray-700";
                    const dotClass = CAT_DOT_COLORS[p.cat] || "bg-gray-400";

                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50/50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={pautaChecked.has(p.id)}
                          onChange={() => togglePautaItem(p.id)}
                          className="h-4 w-4 rounded border-gray-300 text-garces-cherry focus:ring-garces-cherry"
                        />
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
                    );
                  })}
                </div>
              </div>
            )}

            {/* Placeholder for other species */}
            {selectedPauta && selectedPauta !== "cerezo" && (
              <div className="bg-white rounded-xl border p-12 text-center">
                <Scissors className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">
                  Pauta para {selectedPauta.charAt(0).toUpperCase() + selectedPauta.slice(1)} en desarrollo
                </p>
              </div>
            )}

            {/* Empty state */}
            {!selectedPauta && (
              <div className="bg-white rounded-xl border p-16 text-center">
                <Plus className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">
                  Selecciona una especie para ver su pauta
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ==================== TAB: PLAN (existing CrudTable) ==================== */}
        <TabsContent value="plan">
          <CrudTable
            data={allLabores}
            columns={planColumns as any}
            isLoading={loadingPlan}
            searchPlaceholder="Buscar labor..."
          />
        </TabsContent>

        {/* ==================== TAB: CALENDARIO (existing LaborCalendar) ==================== */}
        <TabsContent value="calendario">
          <LaborCalendar
            labores={allLabores}
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
                          title="Ejecutar rapido"
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
      </Tabs>

      {/* ==================== CHARTS (below tabs, collapsible section) ==================== */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-semibold text-garces-cherry flex items-center gap-2 select-none">
          <TrendingUp className="h-4 w-4" />
          Graficos de cumplimiento
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
        title="Planificar Labor (Posicion)"
        isLoading={createMut.isPending}
      />

      {/* Plan testblock-level labor */}
      <CrudForm
        open={planTbOpen}
        onClose={() => setPlanTbOpen(false)}
        onSubmit={async (data) => { await planTbMut.mutateAsync(data); }}
        fields={planTbFields}
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
              Codigo QR -- {qrLabor ? resolvLabor(qrLabor.id_labor) : ""}
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
              <p>ID: {qrLabor?.id_ejecucion} | Posicion: {qrLabor?.id_posicion}</p>
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
              placeholder="Descripcion de la evidencia..."
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
