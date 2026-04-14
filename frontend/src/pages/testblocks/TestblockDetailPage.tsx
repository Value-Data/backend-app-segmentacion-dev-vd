import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Grid3X3, Plus, MinusCircle, RefreshCw,
  Package, CheckCircle2, XCircle, ExternalLink, FlaskConical,
  AlertTriangle, Repeat2, MapPin, Settings2, PlusCircle, Rows3,
  Calendar, FileText, Pencil, Trash2, QrCode, X, Clock, Leaf,
  ChevronDown, Shield, Hammer, Map as MapIcon, Camera, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { KpiCard } from "@/components/shared/KpiCard";
import { CrudForm } from "@/components/shared/CrudForm";
type MapPinType = { id: number | string; lat: number; lng: number; label: string; detail?: string };
import { useTestblock, useGrilla, useResumenHileras, useResumenVariedades, useTestblockMutations, useInventarioTestblock } from "@/hooks/useTestblock";
import { useAuthStore } from "@/stores/authStore";
import { useLookups } from "@/hooks/useLookups";
import { testblockService } from "@/services/testblock";
import { laboratorioService } from "@/services/laboratorio";
import { laboresService } from "@/services/labores";
import { inventarioService } from "@/services/inventario";
import { post } from "@/services/api";
import { formatNumber } from "@/lib/utils";
import type { PosicionTestBlock, ColorMode, HistorialPosicion } from "@/types/testblock";
import { parseQr } from "@/types/testblock";
import type { FieldDef } from "@/types";
import { PlantaMedicionesDialog } from "@/components/shared/PlantaMedicionesDialog";
import { MapaTestBlock } from "./MapaTestBlock";

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const ESTADO_COLORS: Record<string, string> = {
  alta: "bg-green-500",
  baja: "bg-red-400",
  replante: "bg-blue-500",
  vacia: "bg-gray-200",
};

const HISTORIAL_ACTION_COLORS: Record<string, string> = {
  alta: "bg-green-500",
  baja: "bg-red-500",
  replante: "bg-blue-500",
  fenologia: "bg-purple-500",
  medicion: "bg-amber-500",
  etapa: "bg-amber-600",
};

/** Small colored dot indicating cluster quality for a plant. */
function ClusterDot({ cluster }: { cluster?: number | null }) {
  if (cluster == null) return null;
  const color =
    cluster <= 2 ? "bg-emerald-300" : cluster === 3 ? "bg-amber-300" : "bg-red-300";
  return (
    <span
      className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ${color} ring-1 ring-white`}
      title={`Cluster ${cluster}`}
    />
  );
}

type SelectionMode = "none" | "alta" | "baja" | "replante" | "eliminar" | "fenologia" | "etapa";

// Removed static ESTADOS_FENOLOGICOS — now fetched from API (estados_fenologicos table)

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function TestblockDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tbId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /* --- Data queries --- */
  const { data: tb, isLoading: tbLoading, isError: tbError } = useTestblock(tbId);
  const { data: grilla } = useGrilla(tbId);
  const { data: resumenHileras } = useResumenHileras(tbId);
  const { data: resumenVariedades } = useResumenVariedades(tbId);
  const { data: inventarioTb } = useInventarioTestblock(tbId);
  const mutations = useTestblockMutations(tbId);

  const lk = useLookups();
  const [colorMode] = useState<ColorMode>("estado");
  const [gridSize, setGridSize] = useState<"sm" | "md" | "lg">("md");
  const [selectedPos, setSelectedPos] = useState<PosicionTestBlock | null>(null);

  /* --- Etapa mutation (per-plant formacion/produccion) --- */
  const etapaMut = useMutation({
    mutationFn: (params: { etapa: string; posicion_ids?: number[]; id_lote?: number }) =>
      testblockService.cambiarEtapa(tbId, params),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId, "posiciones"] });
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId, "grilla"] });
    },
    onError: () => toast.error("Error al cambiar etapa"),
  });

  /* --- Selection mode state --- */
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("none");
  const [selectedPositions, setSelectedPositions] = useState<Set<number>>(new Set());

  /* --- Observaciones for batch operations --- */
  const [batchObservaciones, setBatchObservaciones] = useState("");

  /* --- Plant mediciones dialog state --- */
  const [medDialogOpen, setMedDialogOpen] = useState(false);
  const [medPlanta, setMedPlanta] = useState<PosicionTestBlock | null>(null);

  /* --- Confirmation dialog state --- */
  const [altaConfirmOpen, setAltaConfirmOpen] = useState(false);
  const [altaDirectaOpen, setAltaDirectaOpen] = useState(false);
  const [bajaConfirmOpen, setBajaConfirmOpen] = useState(false);
  const [replanteConfirmOpen, setReplanteConfirmOpen] = useState(false);
  const [addHileraOpen, setAddHileraOpen] = useState(false);
  const [addPosOpen, setAddPosOpen] = useState(false);
  const [delHileraOpen, setDelHileraOpen] = useState(false);
  const [fenologiaConfirmOpen, setFenologiaConfirmOpen] = useState(false);
  const [etapaConfirmOpen, setEtapaConfirmOpen] = useState(false);
  const [etapaTarget, setEtapaTarget] = useState<"formacion" | "produccion">("produccion");
  const [editTbOpen, setEditTbOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  /* --- Group action dialog states --- */
  const [grupoLaboresOpen, setGrupoLaboresOpen] = useState(false);
  const [grupoPolinizanteConfirm, setGrupoPolinizanteConfirm] = useState(false);

  /* --- Fetch estados fenologicos from API for the fenologia dialog --- */
  const { data: allEstadosFenol } = useQuery({
    queryKey: ["estados-fenologicos"],
    queryFn: () => laboresService.estadosFenologicos(),
    staleTime: 5 * 60_000,
  });

  /* --- Fetch tipos de labor for group labores dialog --- */
  const { data: allTiposLabor } = useQuery({
    queryKey: ["tipos-labor"],
    queryFn: () => laboresService.tiposLabor(),
    staleTime: 5 * 60_000,
  });

  /* --- Historial query for selected position --- */
  const { data: historialPos } = useQuery({
    queryKey: ["posiciones", selectedPos?.id_posicion, "historial"],
    queryFn: () => testblockService.historial(selectedPos!.id_posicion),
    enabled: !!selectedPos?.id_posicion && selectionMode === "none",
  });

  /* --- Historial global del testblock --- */
  const { data: historialTb } = useQuery({
    queryKey: ["testblocks", tbId, "historial"],
    queryFn: () => testblockService.historialTestblock(tbId),
    staleTime: 30_000,
  });

  /* --- Labores pendientes for this testblock --- */
  const { data: laboresTb } = useQuery({
    queryKey: ["labores", "planificacion", tbId],
    queryFn: () => laboresService.planificacion({ testblock: tbId }),
    staleTime: 30_000,
  });
  const laboresPendientes = useMemo(() => {
    if (!laboresTb) return [];
    return (laboresTb as any[]).filter((l) => l.estado === "planificada");
  }, [laboresTb]);
  // Group by tipo labor
  const laboresPorTipo = useMemo(() => {
    const map = new Map<number, { nombre: string; labores: any[] }>();
    for (const l of laboresPendientes) {
      const id = l.id_labor || 0;
      if (!map.has(id)) {
        const tl = (allTiposLabor as any[] || []).find((t: any) => t.id_labor === id);
        map.set(id, { nombre: tl?.nombre || `Labor #${id}`, labores: [] });
      }
      map.get(id)!.labores.push(l);
    }
    return Array.from(map.values()).sort((a, b) => b.labores.length - a.labores.length);
  }, [laboresPendientes, allTiposLabor]);
  // Set of posicion IDs with pending labores (for grid indicator)
  const posConLabores = useMemo(() => {
    return new Set(laboresPendientes.map((l: any) => l.id_posicion));
  }, [laboresPendientes]);

  const ejecutarLaborMut = useMutation({
    mutationFn: (ids: number[]) => laboresService.ejecutarMasivo(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labores"] });
      toast.success("Labores ejecutadas");
    },
  });

  /* --- Detail panel editing --- */
  const [detailObs, setDetailObs] = useState("");
  const [detailObsDirty, setDetailObsDirty] = useState(false);
  const [detailEditing, setDetailEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});

  const editPosMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      testblockService.updatePosicion(selectedPos!.id_posicion, data),
    onSuccess: () => {
      toast.success("Posición actualizada");
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
      setDetailEditing(false);
    },
  });

  const deletePosSingleMut = useMutation({
    mutationFn: () => testblockService.deletePosicion(selectedPos!.id_posicion),
    onSuccess: () => {
      toast.success("Posición eliminada");
      setSelectedPos(null);
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
    },
  });

  // Sync detailObs when selectedPos changes
  const currentPosId = selectedPos?.id_posicion;
  const currentPosObs = selectedPos?.observaciones;
  useEffect(() => {
    setDetailObs(currentPosObs || "");
    setDetailObsDirty(false);
  }, [currentPosId, currentPosObs]);

  const updateObsMut = useMutation({
    mutationFn: (obs: string) => testblockService.updateObservaciones(currentPosId!, obs || null),
    onSuccess: () => {
      toast.success("Observaciones guardadas");
      setDetailObsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
    },
  });

  /* ---------------------------------------------------------------- */
  /*  Mutations                                                        */
  /* ---------------------------------------------------------------- */

  const genPosMut = useMutation({
    mutationFn: () => testblockService.generarPosiciones(tbId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
      if (res.count === 0) {
        toast.info("Las posiciones ya están generadas. Use \"Alta\" para plantar.");
      } else {
        toast.success(`${res.count} posiciones nuevas generadas. Use "Alta" para plantar.`);
      }
    },
  });

  const addHileraMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      testblockService.agregarHilera(tbId, Number(data.num_posiciones)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
      toast.success(`Hilera agregada con ${res.count} posiciones`);
      setAddHileraOpen(false);
    },
  });

  const addPosMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      testblockService.agregarPosiciones(tbId, Number(data.hilera), Number(data.cantidad)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
      toast.success(`${res.count} posiciones agregadas a la hilera`);
      setAddPosOpen(false);
    },
  });

  const delHileraMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      testblockService.eliminarHilera(tbId, Number(data.hilera)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
      toast.success(`Hilera eliminada (${res.deleted} posiciones)`);
      setDelHileraOpen(false);
    },
  });

  const delPosMut = useMutation({
    mutationFn: (ids: number[]) =>
      testblockService.eliminarPosiciones(tbId, ids),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
      toast.success(`${res.deleted} posiciones eliminadas`);
      exitSelectionMode();
    },
  });

  const editTbMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      testblockService.update(tbId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
      toast.success("TestBlock actualizado");
      setEditTbOpen(false);
    },
  });

  /* ---------------------------------------------------------------- */
  /*  Derived / memoised data                                          */
  /* ---------------------------------------------------------------- */

  // Fetch ALL available inventory for alta/replante
  const { data: inventarioGlobal } = useQuery({
    queryKey: ["inventario", "disponible"],
    queryFn: () => inventarioService.disponible(),
    staleTime: 30_000,
  });

  // Build lote options: TB-dispatched lotes + all available global inventory
  const loteOptions = useMemo(() => {
    const opts: { value: number; label: string }[] = [];
    const seen = new Set<number>();

    // Lotes already dispatched to this TB
    if (inventarioTb) {
      for (const item of inventarioTb) {
        if (item.disponible > 0) {
          opts.push({
            value: item.id_inventario,
            label: `${item.codigo_lote || "Lote " + item.id_inventario} — ${item.variedad || "?"} / ${item.portainjerto || "?"} (${item.disponible} en TB)`,
          });
          seen.add(item.id_inventario);
        }
      }
    }

    // All globally available lotes (with resolved names)
    if (inventarioGlobal) {
      for (const lote of inventarioGlobal as any[]) {
        if (!seen.has(lote.id_inventario) && lote.cantidad_actual > 0) {
          const varName = lote.id_variedad ? lk.variedad(lote.id_variedad) : "?";
          const piName = lote.id_portainjerto ? lk.portainjerto(lote.id_portainjerto) : "?";
          const espName = lote.id_especie ? lk.especie(lote.id_especie) : null;
          const speciesTag = espName && espName !== "-" ? `[${espName}] ` : "";
          opts.push({
            value: lote.id_inventario,
            label: `${speciesTag}${lote.codigo_lote} — ${varName} / ${piName} — Stock: ${lote.cantidad_actual} (vivero)`,
          });
        }
      }
    }

    return opts;
  }, [inventarioTb, inventarioGlobal, lk]);

  // Confirmation field definitions
  const altaConfirmFields: FieldDef[] = useMemo(() => [
    {
      key: "id_lote",
      label: "Lote (stock disponible)",
      type: "select",
      required: true,
      options: loteOptions,
      placeholder: "Seleccionar lote",
    },
  ], [loteOptions]);

  const variedadOptions = useMemo(() => {
    return (lk.rawData.variedades || []).map((v: any) => ({
      value: v.id_variedad, label: `${v.nombre} (${v.codigo})`,
    }));
  }, [lk.rawData.variedades]);

  const piOptions = useMemo(() => {
    return (lk.rawData.portainjertos || []).map((p: any) => ({
      value: p.id_portainjerto, label: p.nombre,
    }));
  }, [lk.rawData.portainjertos]);

  const altaDirectaFields: FieldDef[] = useMemo(() => [
    { key: "id_variedad", label: "Variedad", type: "select", required: true, options: variedadOptions },
    { key: "id_portainjerto", label: "Portainjerto", type: "select", required: true, options: piOptions },
    { key: "observaciones", label: "Observaciones", type: "text" },
  ], [variedadOptions, piOptions]);

  const bajaConfirmFields: FieldDef[] = useMemo(() => [
    { key: "motivo", label: "Motivo de Baja", type: "text", required: true, placeholder: "Ingrese el motivo de baja" },
  ], []);

  const replanteConfirmFields: FieldDef[] = useMemo(() => [
    {
      key: "id_lote",
      label: "Lote para Replante",
      type: "select",
      required: true,
      options: loteOptions,
      placeholder: "Seleccionar lote",
    },
    { key: "motivo", label: "Motivo de Replante", type: "text", required: false, placeholder: "Motivo (opcional)" },
  ], [loteOptions]);

  const addHileraFields: FieldDef[] = useMemo(() => [
    { key: "num_posiciones", label: "Posiciones en la nueva hilera", type: "number", required: true, placeholder: "Ej: 20" },
  ], []);

  const addPosFields: FieldDef[] = useMemo(() => {
    const hileraOpts = Array.from({ length: grilla?.hileras || tb?.num_hileras || 0 }, (_, i) => ({
      value: i + 1,
      label: `Hilera ${i + 1}`,
    }));
    return [
      { key: "hilera", label: "Hilera", type: "select", required: true, options: hileraOpts, placeholder: "Seleccionar hilera" },
      { key: "cantidad", label: "Cantidad de posiciones a agregar", type: "number", required: true, placeholder: "Ej: 5" },
    ];
  }, [grilla?.hileras, tb?.num_hileras]);

  const delHileraFields: FieldDef[] = useMemo(() => {
    const hileraOpts = Array.from({ length: grilla?.hileras || 0 }, (_, i) => ({
      value: i + 1,
      label: `Hilera ${i + 1}`,
    }));
    return [
      { key: "hilera", label: "Hilera a eliminar", type: "select", required: true, options: hileraOpts, placeholder: "Seleccionar hilera" },
    ];
  }, [grilla?.hileras]);

  const fenologiaConfirmFields: FieldDef[] = useMemo(() => {
    const estadoOpts = ((allEstadosFenol || []) as { id_estado: number; nombre: string; codigo: string; id_especie: number; activo?: boolean }[])
      .filter((e) => e.activo !== false)
      .sort((a, b) => a.id_especie - b.id_especie || (a as any).orden - (b as any).orden)
      .map((e) => ({ value: e.id_estado, label: e.nombre }));
    return [
      {
        key: "estado_fenologico",
        label: "Estado Fenologico",
        type: "select" as const,
        required: true,
        options: estadoOpts,
        placeholder: "Seleccionar estado",
      },
      { key: "porcentaje", label: "Porcentaje (%)", type: "number" as const, required: false, placeholder: "0 - 100" },
      { key: "fecha", label: "Fecha", type: "date" as const, required: false, placeholder: new Date().toISOString().slice(0, 10) },
      { key: "observaciones", label: "Observaciones", type: "textarea" as const, required: false, placeholder: "Observaciones (opcional)" },
    ];
  }, [allEstadosFenol]);

  /* ---------------------------------------------------------------- */
  /*  Group selection toolbar dropdown options                          */
  /* ---------------------------------------------------------------- */

  /** Unique variedades present in grid */
  const gridVariedadOptions = useMemo(() => {
    if (!grilla?.posiciones) return [];
    const map = new Map<number, string>();
    for (const p of grilla.posiciones) {
      const vid = p.planta_variedad ?? p.id_variedad;
      if (vid && !map.has(vid)) {
        map.set(vid, lk.variedad(vid));
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ value: id, label: name || `Variedad #${id}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [grilla?.posiciones, lk]);

  /** Unique hileras present in grid */
  const gridHileraOptions = useMemo(() => {
    if (!grilla?.posiciones) return [];
    const set = new Set<number>();
    for (const p of grilla.posiciones) set.add(p.hilera);
    return Array.from(set)
      .sort((a, b) => a - b)
      .map((h) => ({ value: h, label: `H${h}` }));
  }, [grilla?.posiciones]);

  /** Unique variedad + portainjerto combos present in grid */
  const gridVarPiOptions = useMemo(() => {
    if (!grilla?.posiciones) return [];
    const map = new Map<string, { vid: number; pid: number; label: string }>();
    for (const p of grilla.posiciones) {
      const vid = p.planta_variedad ?? p.id_variedad;
      const pid = p.planta_portainjerto ?? p.id_portainjerto;
      if (vid && pid) {
        const key = `${vid}-${pid}`;
        if (!map.has(key)) {
          map.set(key, {
            vid,
            pid,
            label: `${lk.variedad(vid)} / ${lk.portainjerto(pid)}`,
          });
        }
      }
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ value: key, label: v.label, vid: v.vid, pid: v.pid }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [grilla?.posiciones, lk]);

  /** Group labores field definitions */
  const grupoLaboresFields: FieldDef[] = useMemo(() => {
    const laborOpts = ((allTiposLabor || []) as { id_labor: number; nombre: string; codigo: string; activo?: boolean }[])
      .filter((t) => t.activo !== false)
      .map((t) => ({ value: t.id_labor, label: t.nombre }));
    return [
      { key: "id_labor", label: "Tipo de Labor", type: "select" as const, required: true, options: laborOpts, placeholder: "Seleccionar labor" },
      { key: "fecha_programada", label: "Fecha Programada", type: "date" as const, required: false, placeholder: new Date().toISOString().slice(0, 10) },
      { key: "observaciones", label: "Observaciones", type: "textarea" as const, required: false, placeholder: "Observaciones (opcional)" },
    ];
  }, [allTiposLabor]);

  const editTbFields: FieldDef[] = useMemo(() => [
    { key: "nombre", label: "Nombre", type: "text", required: true },
    { key: "codigo", label: "Código", type: "text", required: true },
    { key: "id_campo", label: "Campo", type: "select", options: lk.options.campos },
    { key: "temporada_inicio", label: "Temporada Inicio", type: "text", placeholder: "Ej: 2024-2025" },
    { key: "latitud", label: "Latitud", type: "number", placeholder: "Ej: -34.1234567" },
    { key: "longitud", label: "Longitud", type: "number", placeholder: "Ej: -70.1234567" },
    { key: "notas", label: "Notas / Observaciones", type: "textarea" },
  ], [lk.options.campos]);

  /* ---------------------------------------------------------------- */
  /*  Selection mode handlers                                          */
  /* ---------------------------------------------------------------- */

  // Check if there are vacant positions available
  const vacantCount = useMemo(() => {
    if (!grilla?.posiciones) return 0;
    return grilla.posiciones.filter((p) => p.estado === "vacia").length;
  }, [grilla]);

  const enterSelectionMode = useCallback(async (mode: SelectionMode) => {
    // For alta mode: check if there are vacant positions
    if (mode === "alta" && vacantCount === 0) {
      // No vacant positions — offer to add a new hilera
      const addHilera = confirm(
        `No hay posiciones vacias disponibles (todas estan plantadas).\n\n` +
        `¿Desea agregar una hilera nueva con posiciones vacias para plantar?`
      );
      if (addHilera) {
        setAddHileraOpen(true);
        return;
      }
      return;
    }
    setSelectionMode(mode);
    setSelectedPositions(new Set());
    setSelectedPos(null);
  }, [vacantCount]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode("none");
    setSelectedPositions(new Set());
    setBatchObservaciones("");
  }, []);

  const togglePosition = useCallback((posId: number) => {
    setSelectedPositions((prev) => {
      const next = new Set(prev);
      if (next.has(posId)) {
        next.delete(posId);
      } else {
        next.add(posId);
      }
      return next;
    });
  }, []);

  const handleGridCellClick = useCallback((pos: PosicionTestBlock | undefined) => {
    if (selectionMode === "none") {
      if (!pos) return;
      // If already selecting positions (group mode), toggle this one
      if (selectedPositions.size > 0) {
        togglePosition(pos.id_posicion);
        return;
      }
      // Otherwise show detail panel
      setSelectedPos(pos);
      return;
    }

    if (!pos) return;

    if (selectionMode === "alta" && pos.estado !== "vacia") return;
    if (selectionMode === "baja" && pos.estado !== "alta") return;
    if (selectionMode === "replante" && pos.estado !== "baja" && pos.estado !== "replante") return;
    if (selectionMode === "eliminar" && pos.estado !== "vacia" && pos.estado !== "baja") return;
    if (selectionMode === "fenologia" && pos.estado !== "alta") return;

    togglePosition(pos.id_posicion);
  }, [selectionMode, togglePosition]);

  /* --- Group selection helpers (toolbar) --- */
  const selectByVariedad = useCallback((vid: number) => {
    if (!grilla?.posiciones) return;
    const ids = grilla.posiciones
      .filter((p) => (p.planta_variedad ?? p.id_variedad) === vid)
      .map((p) => p.id_posicion);
    setSelectedPositions((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, [grilla?.posiciones]);

  const selectByHilera = useCallback((hilera: number) => {
    if (!grilla?.posiciones) return;
    const ids = grilla.posiciones
      .filter((p) => p.hilera === hilera)
      .map((p) => p.id_posicion);
    setSelectedPositions((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, [grilla?.posiciones]);

  const selectByVarPi = useCallback((vid: number, pid: number) => {
    if (!grilla?.posiciones) return;
    const ids = grilla.posiciones
      .filter((p) =>
        (p.planta_variedad ?? p.id_variedad) === vid &&
        (p.planta_portainjerto ?? p.id_portainjerto) === pid
      )
      .map((p) => p.id_posicion);
    setSelectedPositions((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, [grilla?.posiciones]);

  const selectAllAlta = useCallback(() => {
    if (!grilla?.posiciones) return;
    const ids = grilla.posiciones
      .filter((p) => p.estado === "alta")
      .map((p) => p.id_posicion);
    setSelectedPositions(new Set(ids));
  }, [grilla?.posiciones]);

  const clearSelection = useCallback(() => {
    setSelectedPositions(new Set());
  }, []);

  /* --- Group action handlers --- */
  const handleGrupoAlta = useCallback(() => {
    if (selectedPositions.size === 0) return;
    setSelectionMode("alta");
    setAltaConfirmOpen(true);
  }, [selectedPositions]);

  const handleGrupoAltaDirecta = useCallback(() => {
    if (selectedPositions.size === 0) return;
    setAltaDirectaOpen(true);
  }, [selectedPositions]);

  const handleGrupoBaja = useCallback(() => {
    if (selectedPositions.size === 0) return;
    setSelectionMode("baja");
    setBajaConfirmOpen(true);
  }, [selectedPositions]);

  const handleGrupoReplante = useCallback(() => {
    if (selectedPositions.size === 0) return;
    setSelectionMode("replante");
    setReplanteConfirmOpen(true);
  }, [selectedPositions]);

  const handleGrupoFenologia = useCallback(() => {
    if (selectedPositions.size === 0) return;
    setSelectionMode("fenologia");
    setFenologiaConfirmOpen(true);
  }, [selectedPositions]);

  const handleGrupoLaboresSubmit = useCallback(async (data: Record<string, unknown>) => {
    const ids = Array.from(selectedPositions);
    setIsProcessing(true);
    try {
      const res = await post<{ created: number }>(`/testblocks/${tbId}/grupo/labores`, {
        posicion_ids: ids,
        id_labor: Number(data.id_labor),
        fecha_programada: data.fecha_programada || new Date().toISOString().slice(0, 10),
        observaciones: data.observaciones || "",
        temporada: tb?.temporada_inicio || "2025-2026",
      });
      toast.success(`Labor planificada para ${res.created} posiciones`);
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
      queryClient.invalidateQueries({ queryKey: ["labores"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error al planificar labor grupal: ${msg}`);
    }
    setIsProcessing(false);
    setGrupoLaboresOpen(false);
    setSelectedPositions(new Set());
  }, [selectedPositions, tbId, tb?.temporada_inicio, queryClient]);

  const handleGrupoPolinizante = useCallback(async () => {
    const ids = Array.from(selectedPositions);
    setIsProcessing(true);
    try {
      const res = await post<{ affected: number }>(`/testblocks/${tbId}/grupo/polinizante`, {
        posicion_ids: ids,
        es_polinizante: true,
      });
      toast.success(`${res.affected} posiciones marcadas como polinizante`);
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error al marcar polinizante: ${msg}`);
    }
    setIsProcessing(false);
    setGrupoPolinizanteConfirm(false);
    setSelectedPositions(new Set());
  }, [selectedPositions, tbId, queryClient]);

  const handleGrupoQr = useCallback(async () => {
    const ids = Array.from(selectedPositions);
    try {
      toast.loading("Generando QR PDF...", { id: "grupo-qr" });
      const base = import.meta.env.VITE_API_BASE_URL || "/api/v1";
      const token = useAuthStore.getState().token;
      const res = await fetch(`${base}/testblocks/${tbId}/grupo/qr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ posicion_ids: ids }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      toast.dismiss("grupo-qr");
    } catch (err) {
      toast.dismiss("grupo-qr");
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error al generar QR: ${msg}`);
    }
  }, [selectedPositions, tbId]);

  const handleConfirmSelection = useCallback(() => {
    if (selectedPositions.size === 0) return;

    if (selectionMode === "alta") {
      setAltaConfirmOpen(true);
    } else if (selectionMode === "baja") {
      setBajaConfirmOpen(true);
    } else if (selectionMode === "replante") {
      setReplanteConfirmOpen(true);
    } else if (selectionMode === "fenologia") {
      setFenologiaConfirmOpen(true);
    } else if (selectionMode === "etapa") {
      setEtapaConfirmOpen(true);
    } else if (selectionMode === "eliminar") {
      if (confirm(`Eliminar ${selectedPositions.size} posicion(es)? Esta accion no se puede deshacer.`)) {
        delPosMut.mutate(Array.from(selectedPositions));
      }
    }
  }, [selectionMode, selectedPositions, delPosMut]);

  // --- Alta submission: loop individual alta calls ---
  const handleAltaSubmit = useCallback(async (data: Record<string, unknown>) => {
    const idLote = Number(data.id_lote);
    const obs = batchObservaciones.trim() || undefined;
    const ids = Array.from(selectedPositions);
    setIsProcessing(true);

    let success = 0;
    let failed = 0;

    for (const idPosicion of ids) {
      try {
        await testblockService.alta(tbId, { id_posicion: idPosicion, id_lote: idLote, observaciones: obs });
        success++;
      } catch (err: unknown) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Error en posicion ${idPosicion}: ${msg}`);
      }
    }

    setIsProcessing(false);
    setAltaConfirmOpen(false);

    if (success > 0) {
      toast.success(`Alta completada: ${success} plantas dadas de alta${failed > 0 ? `, ${failed} con error` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
      queryClient.invalidateQueries({ queryKey: ["inventario"] });
    }

    exitSelectionMode();
  }, [selectedPositions, tbId, queryClient, exitSelectionMode, batchObservaciones]);

  // --- Baja submission: single baja-masiva call ---
  const handleBajaSubmit = useCallback(async (data: Record<string, unknown>) => {
    const motivo = String(data.motivo);
    const obs = batchObservaciones.trim() || undefined;
    const ids = Array.from(selectedPositions);
    setIsProcessing(true);

    try {
      await testblockService.bajaMasiva(tbId, { ids_posiciones: ids, motivo, observaciones: obs });
      toast.success(`Baja masiva completada: ${ids.length} plantas dadas de baja`);
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error en baja masiva: ${msg}`);
    }

    setIsProcessing(false);
    setBajaConfirmOpen(false);
    exitSelectionMode();
  }, [selectedPositions, tbId, queryClient, exitSelectionMode, batchObservaciones]);

  // --- Replante submission: loop individual replante calls ---
  const handleReplanteSubmit = useCallback(async (data: Record<string, unknown>) => {
    const idLote = Number(data.id_lote);
    const motivo = data.motivo ? String(data.motivo) : "Replante";
    const obs = batchObservaciones.trim() || undefined;
    const ids = Array.from(selectedPositions);
    setIsProcessing(true);

    let success = 0;
    let failed = 0;

    for (const idPosicion of ids) {
      try {
        await testblockService.replante(tbId, { id_posicion: idPosicion, id_lote: idLote, motivo, observaciones: obs });
        success++;
      } catch (err: unknown) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Error replante posicion ${idPosicion}: ${msg}`);
      }
    }

    setIsProcessing(false);
    setReplanteConfirmOpen(false);

    if (success > 0) {
      toast.success(`Replante completado: ${success} plantas replantadas${failed > 0 ? `, ${failed} con error` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
      queryClient.invalidateQueries({ queryKey: ["inventario"] });
    }

    exitSelectionMode();
  }, [selectedPositions, tbId, queryClient, exitSelectionMode, batchObservaciones]);

  // --- Fenologia submission ---
  const handleFenologiaSubmit = useCallback(async (data: Record<string, unknown>) => {
    const ids = Array.from(selectedPositions);
    setIsProcessing(true);

    try {
      const payload = {
        testblock_id: tbId,
        posiciones_ids: ids,
        id_estado_fenol: Number(data.estado_fenologico),
        porcentaje: data.porcentaje ? Number(data.porcentaje) : null,
        fecha: data.fecha || new Date().toISOString().slice(0, 10),
        observaciones: data.observaciones || "",
        temporada: tb?.temporada_inicio || "2025-2026",
      };
      const res = await laboresService.registroFenologico(payload);
      toast.success(`Fenologia registrada: ${res.created} posicion${res.created !== 1 ? "es" : ""}`);
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error al registrar fenologia: ${msg}`);
    }

    setIsProcessing(false);
    setFenologiaConfirmOpen(false);
    exitSelectionMode();
  }, [selectedPositions, tbId, tb?.temporada_inicio, queryClient, exitSelectionMode]);

  const mapPins: MapPinType[] = useMemo(() => {
    if (!tb?.latitud || !tb?.longitud) return [];
    return [{ id: tbId, lat: Number(tb.latitud), lng: Number(tb.longitud), label: tb.nombre || "", detail: tb.codigo || "" }];
  }, [tb?.latitud, tb?.longitud, tb?.nombre, tb?.codigo, tbId]);

  // Etapa stats — must be above early returns to keep hook order stable
  const etapaStats = useMemo(() => {
    let formacion = 0;
    let produccion = 0;
    for (const p of grilla?.posiciones || []) {
      if (p.estado === "alta" || p.estado === "replante") {
        if (p.etapa === "produccion") produccion++;
        else formacion++;
      }
    }
    return { formacion, produccion };
  }, [grilla?.posiciones]);

  /* ---------------------------------------------------------------- */
  /*  Loading / error states                                           */
  /* ---------------------------------------------------------------- */

  if (tbLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;
  }
  if (tbError || !tb) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">TestBlock no encontrado</p>
        <Button variant="outline" onClick={() => navigate("/testblocks")}>Volver a TestBlocks</Button>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Derived grid data                                                */
  /* ---------------------------------------------------------------- */

  const total = (tb.pos_alta || 0) + (tb.pos_baja || 0) + (tb.pos_vacia || 0) + (tb.pos_replante || 0);
  const hileras = grilla?.hileras || tb.num_hileras || 0;
  const maxPos = grilla?.max_pos || tb.posiciones_por_hilera || 0;
  const posMap = new Map<string, PosicionTestBlock>();
  (grilla?.posiciones || []).forEach((p) => {
    posMap.set(`${p.hilera}-${p.posicion}`, p);
  });

  const isCellSelectable = (estado: string): boolean => {
    if (selectionMode === "alta") return estado === "vacia";
    if (selectionMode === "baja") return estado === "alta";
    if (selectionMode === "replante") return estado === "baja" || estado === "replante";
    if (selectionMode === "eliminar") return estado === "vacia" || estado === "baja";
    if (selectionMode === "fenologia") return estado === "alta";
    if (selectionMode === "etapa") return estado === "alta" || estado === "replante";
    return false;
  };

  // Resolve detail-panel data for selectedPos
  const detailQr = selectedPos ? parseQr(selectedPos) : null;
  const detailHasPlant = !!selectedPos?.planta_id;
  const detailVarName = selectedPos
    ? (detailHasPlant
      ? lk.variedad(selectedPos.planta_variedad)
      : detailQr?.var || lk.variedad(selectedPos.id_variedad))
    : "-";
  const detailPiName = selectedPos
    ? (detailHasPlant
      ? lk.portainjerto(selectedPos.planta_portainjerto)
      : detailQr?.pi || lk.portainjerto(selectedPos.id_portainjerto))
    : "-";
  const detailEspecie = selectedPos && detailHasPlant && selectedPos.planta_especie
    ? lk.especie(selectedPos.planta_especie)
    : null;
  const detailLote = selectedPos
    ? (detailQr?.lote || (selectedPos.id_lote ? `ID ${selectedPos.id_lote}` : "-"))
    : "-";

  const showDetailPanel = selectionMode === "none" && selectedPos != null;

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/*  HEADER                                                       */}
      {/* ============================================================ */}
      <div>
        {/* Back link */}
        <button
          onClick={() => navigate("/testblocks")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-1 flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          TestBlocks
        </button>

        <div className="flex items-start justify-between flex-wrap gap-3">
          {/* Left: name, badges, estado toggle */}
          <div>
            <h2 className="text-xl font-bold leading-tight">{tb.nombre}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <StatusBadge status={tb.estado || "activo"} />
              {detailEspecie && (
                <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 px-2 py-0.5 text-[11px] font-semibold">
                  {detailEspecie}
                </span>
              )}
              {tb.temporada_inicio && (
                <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[11px] font-semibold">
                  {tb.temporada_inicio}
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[11px] font-medium">
                {lk.campo(tb.id_campo)}
              </span>

              {/* Replante badge if any */}
              {(tb.pos_replante || 0) > 0 && (
                <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[11px] font-semibold">
                  Replante {tb.pos_replante}
                </span>
              )}
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => setEditTbOpen(true)} title="Editar TestBlock">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditTbOpen(true)} title="Configuración">
              <Settings2 className="h-4 w-4" />
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="text-muted-foreground"
              onClick={async () => {
                try {
                  toast.loading("Generando PDF de etiquetas QR...", { id: "qr-pdf" });
                  const base = import.meta.env.VITE_API_BASE_URL || "/api/v1";
                  const token = useAuthStore.getState().token;
                  const res = await fetch(`${base}/testblocks/${tbId}/qr-pdf`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                  });
                  if (!res.ok) throw new Error(`Error ${res.status}`);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank");
                  toast.dismiss("qr-pdf");
                } catch (err) {
                  toast.dismiss("qr-pdf");
                  const msg = err instanceof Error ? err.message : String(err);
                  toast.error(`Error al generar QR PDF: ${msg}`);
                }
              }}
            >
              <QrCode className="h-4 w-4" /> QR Etiquetas
            </Button>
            {selectionMode !== "none" && (
              <Button size="sm" variant="outline" onClick={exitSelectionMode}>
                <XCircle className="h-4 w-4" /> Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  KPI CARDS (4)                                                */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard title="Total" value={formatNumber(total)} icon={Grid3X3} />
        <KpiCard
          title="Alta"
          value={tb.pos_alta || 0}
          icon={CheckCircle2}
          className="border-green-200"
          iconBg="bg-green-50"
          iconColor="text-green-600"
          trend={etapaStats.formacion > 0 || etapaStats.produccion > 0
            ? `Form: ${etapaStats.formacion} · Prod: ${etapaStats.produccion}`
            : undefined}
        />
        <KpiCard
          title="Baja"
          value={tb.pos_baja || 0}
          icon={MinusCircle}
          className="border-red-200"
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
        {(tb.pos_replante || 0) > 0 && (
          <KpiCard
            title="Replante"
            value={tb.pos_replante || 0}
            icon={Repeat2}
            className="border-blue-200"
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />
        )}
        <KpiCard
          title="Vacia"
          value={tb.pos_vacia || 0}
          icon={AlertTriangle}
          className="border-gray-200"
          iconBg="bg-gray-100"
          iconColor="text-gray-400"
        />
      </div>

      {/* ============================================================ */}
      {/*  GROUP SELECTION TOOLBAR                                      */}
      {/* ============================================================ */}
      {selectionMode === "none" && grilla?.posiciones && grilla.posiciones.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-white rounded-lg border px-3 py-2">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Seleccionar por:</span>
          <span className="text-[10px] text-muted-foreground/60 mr-1 hidden lg:inline">(o click en celdas)</span>

          {/* By Variedad */}
          <div className="relative">
            <select
              className="appearance-none bg-muted/50 border rounded-md pl-2 pr-6 py-1 text-xs font-medium cursor-pointer hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring"
              value=""
              onChange={(e) => { if (e.target.value) selectByVariedad(Number(e.target.value)); e.target.value = ""; }}
            >
              <option value="">Variedad</option>
              {gridVariedadOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          </div>

          {/* By Hilera */}
          <div className="relative">
            <select
              className="appearance-none bg-muted/50 border rounded-md pl-2 pr-6 py-1 text-xs font-medium cursor-pointer hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring"
              value=""
              onChange={(e) => { if (e.target.value) selectByHilera(Number(e.target.value)); e.target.value = ""; }}
            >
              <option value="">Hilera</option>
              {gridHileraOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          </div>

          {/* By Var+PI */}
          <div className="relative">
            <select
              className="appearance-none bg-muted/50 border rounded-md pl-2 pr-6 py-1 text-xs font-medium cursor-pointer hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  const opt = gridVarPiOptions.find((o) => o.value === e.target.value);
                  if (opt) selectByVarPi(opt.vid, opt.pid);
                }
                e.target.value = "";
              }}
            >
              <option value="">Var+PI</option>
              {gridVarPiOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          </div>

          {/* By specific position */}
          <input
            type="text"
            placeholder="H3P5"
            className="w-16 border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring bg-muted/50"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
                const match = val.match(/^H?(\d+)P(\d+)$/);
                if (match) {
                  const h = Number(match[1]);
                  const p = Number(match[2]);
                  const pos = grilla?.posiciones?.find((pos) => pos.hilera === h && pos.posicion === p);
                  if (pos) {
                    togglePosition(pos.id_posicion);
                    (e.target as HTMLInputElement).value = "";
                  } else {
                    toast.error(`Posicion H${h}P${p} no encontrada`);
                  }
                } else {
                  toast.error("Formato: H3P5 o 3P5");
                }
              }
            }}
          />

          {/* Select all alta */}
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={selectAllAlta}>
            Todo (alta)
          </Button>

          {/* Clear selection */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs px-2"
            onClick={clearSelection}
            disabled={selectedPositions.size === 0}
          >
            Limpiar
          </Button>

          {/* Counter */}
          {selectedPositions.size > 0 && (
            <span className="text-xs font-semibold text-foreground ml-auto">
              {selectedPositions.size} seleccionada{selectedPositions.size !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/*  GROUP ACTIONS BAR (shown when selection > 0, not in mode)    */}
      {/* ============================================================ */}
      {/* GROUP ACTIONS BAR - inline hint */}
      {selectionMode === "none" && selectedPositions.size > 0 && (
        <div className="flex items-center gap-2 bg-garces-cherry-pale rounded-lg border border-garces-cherry/20 px-3 py-1.5 text-xs text-garces-cherry">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="font-semibold">{selectedPositions.size} posicion{selectedPositions.size !== 1 ? "es" : ""} seleccionada{selectedPositions.size !== 1 ? "s" : ""}</span>
          <span className="text-muted-foreground">— usa los botones de abajo para ejecutar acciones</span>
          <button onClick={clearSelection} className="ml-auto text-garces-cherry hover:underline text-xs">Limpiar</button>
        </div>
      )}

      {/* Actions are in the fixed bottom bar below */}

      {/* ============================================================ */}
      {/*  TWO-COLUMN: Grid area + Detail panel                        */}
      {/* ============================================================ */}
      <div className="flex gap-4 items-start">
        {/* ----- LEFT: Tabs area (flex-1) ----- */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="grilla">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <TabsList>
                <TabsTrigger value="grilla">Grilla</TabsTrigger>
                <TabsTrigger value="hileras">Resumen</TabsTrigger>
                <TabsTrigger value="variedades">Variedades</TabsTrigger>
                <TabsTrigger value="mediciones">Mediciones</TabsTrigger>
                <TabsTrigger value="inventario-tb">Inventario</TabsTrigger>
                <TabsTrigger value="labores-tb">
                  Labores {laboresPendientes.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold min-w-[16px] h-[16px] px-1">
                      {laboresPendientes.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="historial">Historial</TabsTrigger>
              </TabsList>

              <div className="hidden sm:flex items-center gap-2 flex-wrap">
                {/* Grid size toggle */}
                <div className="flex items-center border rounded-md overflow-hidden mr-2">
                  {(["sm", "md", "lg"] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setGridSize(sz)}
                      className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        gridSize === sz ? "bg-garces-cherry text-white" : "bg-white text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {sz === "sm" ? "S" : sz === "md" ? "M" : "L"}
                    </button>
                  ))}
                </div>
                {/* Legend */}
                <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400" /> Form.</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-700" /> Prod.</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400" /> Baja</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500" /> Repl.</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-300" /> Vacia</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm ring-2 ring-amber-400 bg-emerald-400" /> Polin.</span>
                  {laboresPendientes.length > 0 && (
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-400" /> Labor</span>
                  )}
                </div>
              </div>
            </div>

            {/* --- GRILLA TAB --- */}
            <TabsContent value="grilla">
              <div className="bg-white rounded-xl border p-4 overflow-auto">
                {/* Selection mode banner */}
                {selectionMode !== "none" && (
                  <div
                    className={`rounded-md px-4 py-2 mb-3 text-sm font-medium flex items-center justify-between ${
                      selectionMode === "alta"
                        ? "bg-green-50 text-green-800 border border-green-200"
                        : selectionMode === "replante"
                          ? "bg-blue-50 text-blue-800 border border-blue-200"
                          : selectionMode === "fenologia"
                            ? "bg-purple-50 text-purple-800 border border-purple-200"
                            : selectionMode === "etapa"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                  >
                    <span>
                      {selectionMode === "alta"
                        ? "Seleccione posiciones vacias para plantar"
                        : selectionMode === "replante"
                          ? "Seleccione posiciones con baja para replantar"
                          : selectionMode === "fenologia"
                            ? "Seleccione posiciones activas para registrar fenologia"
                            : selectionMode === "etapa"
                              ? "Seleccione posiciones activas para cambiar etapa"
                              : selectionMode === "eliminar"
                                ? "Seleccione posiciones vacias/baja para eliminar"
                                : "Seleccione posiciones activas para dar de baja"}
                    </span>
                    {selectedPositions.size > 0 && (
                      <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-full text-xs font-semibold border">
                        <CheckCircle2 className="h-3 w-3" />
                        {selectedPositions.size} seleccionadas
                      </span>
                    )}
                  </div>
                )}

                {hileras === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <Grid3X3 className="h-10 w-10 mx-auto text-muted-foreground/50" />
                    <p className="text-muted-foreground">No hay posiciones generadas.</p>
                    <Button size="sm" onClick={() => genPosMut.mutate()} disabled={genPosMut.isPending}>
                      <Grid3X3 className="h-4 w-4" /> Generar Grilla de Posiciones
                    </Button>
                  </div>
                ) : (
                  <div className={gridSize === "sm" ? "space-y-0.5" : gridSize === "md" ? "space-y-1" : "space-y-1.5"}>
                    {/* Grid header row */}
                    <div
                      className={`grid ${gridSize === "sm" ? "gap-0.5" : "gap-1"}`}
                      style={{ gridTemplateColumns: `${gridSize === "lg" ? 36 : 28}px repeat(${maxPos}, 1fr)` }}
                    >
                      <div className={`${gridSize === "lg" ? "text-[10px]" : "text-[8px]"} font-bold text-muted-foreground text-center`}>H\P</div>
                      {Array.from({ length: maxPos }, (_, i) => (
                        <div key={i} className={`text-center ${gridSize === "lg" ? "text-[10px]" : "text-[8px]"} font-semibold text-muted-foreground`}>{i + 1}</div>
                      ))}
                    </div>

                    {/* Grid rows */}
                    {Array.from({ length: hileras }, (_, hi) => (
                      <div
                        key={hi}
                        className={`grid ${gridSize === "sm" ? "gap-0.5" : "gap-1"}`}
                        style={{ gridTemplateColumns: `${gridSize === "lg" ? 36 : 28}px repeat(${maxPos}, 1fr)` }}
                      >
                        <div className={`${gridSize === "lg" ? "text-[10px]" : "text-[8px]"} font-bold text-muted-foreground flex items-center justify-center`}>
                          {hi + 1}
                        </div>
                        {Array.from({ length: maxPos }, (_, pi) => {
                          const pos = posMap.get(`${hi + 1}-${pi + 1}`);
                          const estado = pos?.estado || "vacia";
                          const qrInfo = pos ? parseQr(pos) : null;
                          const varName = pos?.planta_variedad
                            ? lk.variedad(pos.planta_variedad)
                            : qrInfo?.var || null;
                          const labelLen = gridSize === "sm" ? 3 : gridSize === "md" ? 5 : 8;
                          const label = varName && varName !== "-"
                            ? varName.substring(0, labelLen)
                            : (estado === "alta" ? "A" : estado === "baja" ? "B" : estado === "replante" ? "R" : "");
                          const piName = pos?.planta_portainjerto
                            ? lk.portainjerto(pos.planta_portainjerto)
                            : qrInfo?.pi || null;
                          const tip = pos
                            ? `${pos.codigo_unico} - ${estado}${varName && varName !== "-" ? ` | ${varName}` : ""}${piName && piName !== "-" ? ` / ${piName}` : ""}`
                            : `H${hi + 1}P${pi + 1} - vacia`;

                          const isInSelectionMode = selectionMode !== "none";
                          // For alta mode: cells without pos record (truly empty grid slots) are also selectable
                          const selectable = isInSelectionMode && (
                            (pos && isCellSelectable(estado)) ||
                            (selectionMode === "alta" && !pos)
                          );
                          const isSelected = pos ? selectedPositions.has(pos.id_posicion) : false;
                          const isGroupSelected = !isInSelectionMode && isSelected;
                          const isDetailSelected = selectionMode === "none" && !isGroupSelected && selectedPos?.id_posicion === pos?.id_posicion;

                          // Determine cell color — distinguish "no record" (sin crear) from "vacia" (created, no plant)
                          // For alta: formacion = emerald-400, produccion = green-700
                          // Polinizante: amber ring around the cell
                          const isPolinizante = !!pos?.protegida;
                          const bgColor = !pos
                            ? "bg-gray-50 border border-dashed border-gray-300"
                            : estado === "vacia"
                            ? "bg-white border border-solid border-gray-400"
                            : estado === "baja"
                              ? "bg-red-500"
                              : estado === "replante"
                                ? "bg-blue-500"
                                : pos.etapa === "produccion"
                                  ? "bg-green-700"
                                  : "bg-emerald-400";
                          const polinizanteRing = isPolinizante ? "ring-2 ring-amber-400" : "";

                          const cellSize = gridSize === "sm"
                            ? "text-[8px] py-[3px] rounded-[3px]"
                            : gridSize === "md"
                            ? "text-[10px] py-[6px] rounded"
                            : "text-xs py-2 rounded-md";

                          return (
                            <button
                              key={pi}
                              className={`relative font-semibold transition-all ${cellSize} ${bgColor} ${polinizanteRing} ${
                                estado !== "vacia" ? "text-white" : "text-gray-400"
                              } ${
                                isSelected && isInSelectionMode
                                  ? "ring-2 ring-yellow-400 animate-pulse scale-110 z-10"
                                  : isGroupSelected
                                    ? "ring-2 ring-blue-400 scale-105 z-10"
                                    : isDetailSelected
                                      ? "ring-2 ring-black"
                                      : isInSelectionMode && selectable
                                        ? "hover:ring-2 hover:ring-yellow-400 cursor-pointer"
                                        : isInSelectionMode
                                          ? "opacity-30 cursor-not-allowed"
                                          : polinizanteRing
                                            ? "cursor-pointer"
                                            : "hover:ring-2 hover:ring-garces-cherry cursor-pointer"
                              }`}
                              style={{ opacity: estado === "vacia" && !isInSelectionMode ? 0.4 : undefined }}
                              title={`${tip}${isPolinizante ? " [Polinizante]" : ""}`}
                              onClick={() => handleGridCellClick(pos)}
                              disabled={isInSelectionMode && !selectable && !pos}
                            >
                              {label}
                              {isPolinizante && (
                                <span className="absolute bottom-0 left-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-white" title="Polinizante" />
                              )}
                              {pos && posConLabores.has(pos.id_posicion) && (
                                <span className="absolute top-0 left-0.5 w-1.5 h-1.5 rounded-sm bg-orange-400 ring-1 ring-white" title="Labor pendiente" />
                              )}
                              {(estado === "alta" || estado === "replante") && (
                                <ClusterDot cluster={pos?.cluster_actual} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {/* Grid management bar */}
                <div className="flex gap-2 mt-4 pt-3 border-t flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => genPosMut.mutate()} disabled={genPosMut.isPending}>
                    <Grid3X3 className="h-3.5 w-3.5" /> Generar Pos
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAddHileraOpen(true)}>
                    <Rows3 className="h-3.5 w-3.5" /> +Hilera
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAddPosOpen(true)} disabled={hileras === 0}>
                    <PlusCircle className="h-3.5 w-3.5" /> +Posiciones
                  </Button>
                  <span className="border-l mx-1" />
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setDelHileraOpen(true)} disabled={hileras === 0}>
                    <Trash2 className="h-3.5 w-3.5" /> -Hilera
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => enterSelectionMode("eliminar")} disabled={hileras === 0}>
                    <Trash2 className="h-3.5 w-3.5" /> -Posiciones
                  </Button>
                </div>

                {/* Mobile legend */}
                <div className="flex sm:hidden flex-wrap gap-3 mt-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400" /> Formación</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-700" /> Producción</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400" /> Baja</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500" /> Replante</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-200" /> Vacia</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm ring-2 ring-amber-400 bg-emerald-400" /> Polinizante</span>
                  {selectionMode !== "none" && (
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded ring-2 ring-yellow-400 bg-yellow-100" /> Seleccionada</span>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* --- RESUMEN HILERAS TAB --- */}
            <TabsContent value="hileras">
              <div className="bg-white rounded-xl border overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left">Hilera</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Alta</th>
                      <th className="px-3 py-2 text-right">Baja</th>
                      <th className="px-3 py-2 text-right">Replante</th>
                      <th className="px-3 py-2 text-right">Vacia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(resumenHileras || []).map((h) => (
                      <tr key={h.hilera} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">Hilera {h.hilera}</td>
                        <td className="px-3 py-2 text-right">{h.total}</td>
                        <td className="px-3 py-2 text-right text-green-600">{h.alta}</td>
                        <td className="px-3 py-2 text-right text-red-500">{h.baja}</td>
                        <td className="px-3 py-2 text-right text-blue-500">{h.replante}</td>
                        <td className="px-3 py-2 text-right text-gray-400">{h.vacia}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* --- VARIEDADES TAB --- */}
            <TabsContent value="variedades">
              <div className="bg-white rounded-xl border overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left">Variedad</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                      <th className="px-3 py-2 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(resumenVariedades || []).map((v) => (
                      <tr key={v.id_variedad} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2">{v.variedad}</td>
                        <td className="px-3 py-2 text-right">{v.cantidad}</td>
                        <td className="px-3 py-2 text-right">{v.pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* --- MEDICIONES TAB --- */}
            <TabsContent value="mediciones">
              <div className="bg-white rounded-xl border p-6">
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <FlaskConical className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <h4 className="font-semibold text-sm">Mediciones de Calidad</h4>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md">
                    Aun no hay mediciones registradas para este TestBlock. Las mediciones se registran desde el modulo Laboratorio.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => navigate("/laboratorio")}
                  >
                    <FlaskConical className="h-4 w-4 mr-1" /> Ir a Mediciones Lab
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* --- INVENTARIO TB TAB --- */}
            <TabsContent value="inventario-tb">
              <div className="bg-white rounded-xl border overflow-auto">
                {(!inventarioTb || inventarioTb.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No hay inventario asignado a este testblock.</p>
                    <p className="text-xs mt-1">Realice un despacho desde Inventario para asignar stock.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left">Lote</th>
                        <th className="px-3 py-2 text-left">Variedad</th>
                        <th className="px-3 py-2 text-left">Portainjerto</th>
                        <th className="px-3 py-2 text-right">Asignadas</th>
                        <th className="px-3 py-2 text-right">Plantadas</th>
                        <th className="px-3 py-2 text-right">Disponibles</th>
                        <th className="px-3 py-2 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventarioTb.map((item) => (
                        <tr key={item.id_inventario_tb} className="border-b hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">
                            {item.id_inventario ? (
                              <button
                                onClick={() => navigate(`/inventario/${item.id_inventario}`)}
                                className="text-garces-cherry hover:underline inline-flex items-center gap-1"
                              >
                                {item.codigo_lote || `Lote #${item.id_inventario}`}
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            ) : (
                              item.codigo_lote || "-"
                            )}
                          </td>
                          <td className="px-3 py-2">{item.variedad || "-"}</td>
                          <td className="px-3 py-2">{item.portainjerto || "-"}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(item.cantidad_asignada)}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(item.cantidad_plantada)}</td>
                          <td className="px-3 py-2 text-right font-semibold">
                            <span className={item.disponible > 0 ? "text-green-600" : "text-gray-400"}>
                              {formatNumber(item.disponible)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <StatusBadge status={item.estado} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* --- Inventario Disponible en Vivero --- */}
              <div className="bg-white rounded-xl border overflow-auto mt-4">
                <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Inventario Disponible en Vivero</span>
                  <span className="text-[10px] text-muted-foreground ml-1">
                    (lotes con stock que se pueden plantar directamente)
                  </span>
                </div>
                {(!inventarioGlobal || (inventarioGlobal as any[]).filter((l: any) => l.cantidad_actual > 0).length === 0) ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No hay lotes con stock disponible en vivero.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left">Lote</th>
                        <th className="px-3 py-2 text-left">Especie</th>
                        <th className="px-3 py-2 text-left">Variedad</th>
                        <th className="px-3 py-2 text-left">Portainjerto</th>
                        <th className="px-3 py-2 text-left">Tipo Planta</th>
                        <th className="px-3 py-2 text-right">Stock</th>
                        <th className="px-3 py-2 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(inventarioGlobal as any[])
                        .filter((l: any) => l.cantidad_actual > 0)
                        .map((lote: any) => (
                        <tr key={lote.id_inventario} className="border-b hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">
                            <button
                              onClick={() => navigate(`/inventario/${lote.id_inventario}`)}
                              className="text-garces-cherry hover:underline inline-flex items-center gap-1"
                            >
                              {lote.codigo_lote}
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </td>
                          <td className="px-3 py-2">{lote.id_especie ? lk.especie(lote.id_especie) : "-"}</td>
                          <td className="px-3 py-2">{lote.id_variedad ? lk.variedad(lote.id_variedad) : "-"}</td>
                          <td className="px-3 py-2">{lote.id_portainjerto ? lk.portainjerto(lote.id_portainjerto) : "-"}</td>
                          <td className="px-3 py-2">{lote.tipo_planta || "-"}</td>
                          <td className="px-3 py-2 text-right font-semibold text-green-600">{formatNumber(lote.cantidad_actual)}</td>
                          <td className="px-3 py-2 text-center">
                            <StatusBadge status={lote.estado || "disponible"} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </TabsContent>

            {/* Mapa moved below the two-column layout */}

            {/* --- LABORES TAB --- */}
            <TabsContent value="labores-tb">
              <div className="bg-white rounded-xl border overflow-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h3 className="font-semibold text-sm">
                    Labores Pendientes ({laboresPendientes.length})
                  </h3>
                  {laboresPendientes.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={ejecutarLaborMut.isPending}
                      onClick={() => {
                        if (confirm(`Marcar todas las ${laboresPendientes.length} labores como ejecutadas?`)) {
                          const ids = laboresPendientes.map((l: any) => l.id_ejecucion);
                          // Process in batches of 50
                          (async () => {
                            for (let i = 0; i < ids.length; i += 50) {
                              await laboresService.ejecutarMasivo(ids.slice(i, i + 50));
                            }
                            queryClient.invalidateQueries({ queryKey: ["labores"] });
                            toast.success(`${ids.length} labores ejecutadas`);
                          })();
                        }
                      }}
                    >
                      Ejecutar Todas ({laboresPendientes.length})
                    </Button>
                  )}
                </div>

                {laboresPorTipo.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-8">
                    <CheckCircle2 className="h-10 w-10 text-green-500/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Sin labores pendientes para este TestBlock</p>
                    <p className="text-xs text-muted-foreground mt-1">Planifica labores desde el modulo de Labores</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {laboresPorTipo.map((grupo) => (
                      <div key={grupo.nombre} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Hammer className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm">{grupo.nombre}</span>
                            <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                              {grupo.labores.length} posiciones
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={ejecutarLaborMut.isPending}
                            onClick={() => {
                              const ids = grupo.labores.map((l: any) => l.id_ejecucion);
                              ejecutarLaborMut.mutate(ids);
                            }}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Ejecutar grupo
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
                          {grupo.labores.slice(0, 30).map((l: any) => {
                            const pos = grilla?.posiciones?.find((p) => p.id_posicion === l.id_posicion);
                            return (
                              <div
                                key={l.id_ejecucion}
                                className="flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] bg-amber-50 border-amber-200 hover:bg-amber-100 cursor-pointer transition-colors"
                                onClick={() => {
                                  if (pos) {
                                    setSelectedPos(pos);
                                  }
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                <span className="font-mono font-medium truncate">
                                  {pos ? `H${pos.hilera}P${pos.posicion}` : `POS-${l.id_posicion}`}
                                </span>
                              </div>
                            );
                          })}
                          {grupo.labores.length > 30 && (
                            <div className="flex items-center px-2 py-1 text-[10px] text-muted-foreground">
                              +{grupo.labores.length - 30} mas
                            </div>
                          )}
                        </div>
                        {grupo.labores[0]?.fecha_programada && (
                          <p className="text-[10px] text-muted-foreground mt-1.5">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            Programada: {grupo.labores[0].fecha_programada}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* --- HISTORIAL TAB (testblock-level) --- */}
            <TabsContent value="historial">
              <div className="bg-white rounded-xl border overflow-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h3 className="font-semibold text-sm">Historial del TestBlock ({historialTb?.length ?? 0})</h3>
                </div>
                {!historialTb || historialTb.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-8">
                    <Clock className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Sin historial registrado</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-9 px-3 text-left font-medium text-muted-foreground">Fecha</th>
                        <th className="h-9 px-3 text-left font-medium text-muted-foreground">Posicion</th>
                        <th className="h-9 px-3 text-left font-medium text-muted-foreground">Accion</th>
                        <th className="h-9 px-3 text-left font-medium text-muted-foreground">Estado</th>
                        <th className="h-9 px-3 text-left font-medium text-muted-foreground">Motivo</th>
                        <th className="h-9 px-3 text-left font-medium text-muted-foreground">Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialTb.map((ev) => {
                        const accionColor = HISTORIAL_ACTION_COLORS[ev.accion] || "bg-gray-400";
                        return (
                          <tr key={ev.id_historial} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                              {ev.fecha ? new Date(ev.fecha).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}
                            </td>
                            <td className="px-3 py-2 text-xs font-mono">{(ev as any).codigo_posicion || `POS-${ev.id_posicion}`}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${accionColor}`}>
                                {ev.accion}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {ev.estado_anterior && ev.estado_nuevo
                                ? `${ev.estado_anterior} → ${ev.estado_nuevo}`
                                : ev.estado_nuevo || "-"}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">{ev.motivo || "-"}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{ev.usuario || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ----- RIGHT: Detail panel (w-[280px]) ----- */}
        {showDetailPanel && selectedPos && (
          <div className="w-[280px] shrink-0 bg-white rounded-xl border p-4 self-start sticky top-4">
            {/* Panel header */}
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-sm">
                H{selectedPos.hilera} - P{selectedPos.posicion}
              </span>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={selectedPos.estado} />
                {!detailEditing && (
                  <button
                    onClick={() => {
                      setDetailEditing(true);
                      setEditForm({
                        conduccion: selectedPos.conduccion || "",
                        marco_plantacion: selectedPos.marco_plantacion || "",
                        ano_plantacion: selectedPos.ano_plantacion || "",
                        protegida: !!selectedPos.protegida,
                        observaciones: selectedPos.observaciones || "",
                      });
                    }}
                    className="p-1 rounded hover:bg-muted transition-colors"
                    title="Editar posicion"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
                {selectedPos.estado !== "alta" && (
                  <button
                    onClick={() => {
                      if (confirm("Eliminar esta posicion? Se borrara permanentemente.")) {
                        deletePosSingleMut.mutate();
                      }
                    }}
                    className="p-1 rounded hover:bg-red-50 transition-colors"
                    title="Eliminar posicion"
                    disabled={deletePosSingleMut.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </button>
                )}
                <button
                  onClick={() => { setSelectedPos(null); setDetailEditing(false); }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Edit form */}
            {detailEditing ? (
              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="text-muted-foreground block mb-0.5">Conduccion</label>
                  <input
                    className="w-full border rounded px-2 py-1 text-xs"
                    value={(editForm.conduccion as string) || ""}
                    onChange={(e) => setEditForm({ ...editForm, conduccion: e.target.value })}
                    placeholder="Ej: Eje central, KGB"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-0.5">Marco plantacion</label>
                  <input
                    className="w-full border rounded px-2 py-1 text-xs"
                    value={(editForm.marco_plantacion as string) || ""}
                    onChange={(e) => setEditForm({ ...editForm, marco_plantacion: e.target.value })}
                    placeholder="Ej: 4x2"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-0.5">Ano plantacion</label>
                  <input
                    type="number"
                    className="w-full border rounded px-2 py-1 text-xs"
                    value={(editForm.ano_plantacion as string) || ""}
                    onChange={(e) => setEditForm({ ...editForm, ano_plantacion: e.target.value ? Number(e.target.value) : "" })}
                    placeholder="Ej: 2024"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-protegida"
                    checked={!!editForm.protegida}
                    onChange={(e) => setEditForm({ ...editForm, protegida: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="edit-protegida" className="text-muted-foreground">Polinizante</label>
                </div>
                <div>
                  <label className="text-muted-foreground block mb-0.5">Observaciones</label>
                  <textarea
                    className="w-full border rounded px-2 py-1 text-xs resize-none"
                    rows={2}
                    value={(editForm.observaciones as string) || ""}
                    onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    disabled={editPosMut.isPending}
                    onClick={() => editPosMut.mutate(editForm)}
                  >
                    {editPosMut.isPending ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setDetailEditing(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
            /* Fields (read-only view) */
            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-muted-foreground">Variedad:</span>{" "}
                <span className="font-semibold">{detailVarName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Portainjerto:</span>{" "}
                <span className="font-semibold">{detailPiName}</span>
              </div>
              {selectedPos.planta_condicion && (
                <div>
                  <span className="text-muted-foreground">Tipo planta:</span>{" "}
                  <span className="font-semibold">{selectedPos.planta_condicion}</span>
                </div>
              )}
              {selectedPos.ano_plantacion && (
                <div>
                  <span className="text-muted-foreground">Ano plantacion:</span>{" "}
                  <span className="font-semibold">{selectedPos.ano_plantacion}</span>
                </div>
              )}
              {selectedPos.tipo_injertacion && (
                <div>
                  <span className="text-muted-foreground">Tipo injerto:</span>{" "}
                  <span className="font-semibold">{selectedPos.tipo_injertacion}</span>
                </div>
              )}
              {selectedPos.conduccion && (
                <div>
                  <span className="text-muted-foreground">Conduccion:</span>{" "}
                  <span className="font-semibold">{selectedPos.conduccion}</span>
                </div>
              )}
              {selectedPos.marco_plantacion && (
                <div>
                  <span className="text-muted-foreground">Marco:</span>{" "}
                  <span className="font-semibold">{selectedPos.marco_plantacion}</span>
                </div>
              )}
              {selectedPos.protegida && (
                <div>
                  <span className="text-muted-foreground">Polinizante:</span>{" "}
                  <span className="font-semibold text-amber-600">Si</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Estado:</span>{" "}
                <StatusBadge status={selectedPos.estado === "vacia" ? "Vacia" : selectedPos.estado} />
              </div>
              {(selectedPos.estado === "alta" || selectedPos.estado === "replante") && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Etapa:</span>{" "}
                  <StatusBadge
                    status={selectedPos.etapa === "produccion" ? "Producción" : "Formación"}
                    className={selectedPos.etapa === "produccion" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}
                  />
                  <button
                    className="text-[11px] text-blue-600 hover:underline"
                    onClick={() => {
                      const newEtapa = selectedPos.etapa === "produccion" ? "formacion" : "produccion";
                      etapaMut.mutate(
                        { etapa: newEtapa, posicion_ids: [selectedPos.id_posicion] },
                        {
                          onSuccess: () => {
                            setSelectedPos({ ...selectedPos, etapa: newEtapa });
                          },
                        },
                      );
                    }}
                  >
                    Cambiar a {selectedPos.etapa === "produccion" ? "Formación" : "Producción"}
                  </button>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Lote origen:</span>{" "}
                {selectedPos.id_lote ? (
                  <button
                    onClick={() => navigate(`/inventario/${selectedPos.id_lote}`)}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    {detailLote}
                  </button>
                ) : (
                  <span className="font-semibold">{detailLote}</span>
                )}
              </div>
              {selectedPos.fecha_alta && (
                <div>
                  <span className="text-muted-foreground">Fecha Alta:</span>{" "}
                  <span className="font-semibold">{selectedPos.fecha_alta}</span>
                </div>
              )}
              {selectedPos.cluster_actual != null && (
                <div>
                  <span className="text-muted-foreground">Cluster:</span>{" "}
                  <span className="font-semibold">{selectedPos.cluster_actual}</span>
                </div>
              )}
              {selectedPos.motivo_baja && (
                <div>
                  <span className="text-muted-foreground">Motivo Baja:</span>{" "}
                  <span className="font-semibold">{selectedPos.motivo_baja}</span>
                </div>
              )}
            </div>
            )}

            {/* Labores pendientes for this position */}
            {(() => {
              const posLabores = laboresPendientes.filter((l: any) => l.id_posicion === selectedPos.id_posicion);
              if (posLabores.length === 0) return null;
              return (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Labores Pendientes ({posLabores.length})
                  </div>
                  <div className="space-y-1.5">
                    {posLabores.map((l: any) => {
                      const tl = (allTiposLabor as any[] || []).find((t: any) => t.id_labor === l.id_labor);
                      return (
                        <div key={l.id_ejecucion} className="flex items-center justify-between gap-1 px-2 py-1 rounded border border-amber-200 bg-amber-50 text-[10px]">
                          <div>
                            <span className="font-semibold">{tl?.nombre || `Labor #${l.id_labor}`}</span>
                            <span className="text-muted-foreground ml-1">{l.fecha_programada}</span>
                          </div>
                          <button
                            className="text-green-600 hover:text-green-800 font-bold shrink-0"
                            title="Marcar como ejecutada"
                            onClick={() => ejecutarLaborMut.mutate([l.id_ejecucion])}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Observaciones editable — only in view mode */}
            {!detailEditing && (
              <div className="mt-3 pt-3 border-t space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Observaciones
                </label>
                <textarea
                  className="w-full border rounded-md px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring min-h-[48px]"
                  placeholder="Agregar observaciones..."
                  value={detailObs}
                  onChange={(e) => { setDetailObs(e.target.value); setDetailObsDirty(true); }}
                  rows={2}
                />
                {detailObsDirty && (
                  <Button
                    size="sm"
                    className="text-[10px] h-6 px-2"
                    disabled={updateObsMut.isPending}
                    onClick={() => updateObsMut.mutate(detailObs)}
                  >
                    {updateObsMut.isPending ? "Guardando..." : "Guardar"}
                  </Button>
                )}
              </div>
            )}

            {/* Mediciones button for plants */}
            {detailHasPlant && selectedPos.planta_id && (
              <div className="flex gap-2 mt-3 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs flex-1"
                  onClick={() => {
                    setMedPlanta(selectedPos);
                    setMedDialogOpen(true);
                  }}
                >
                  <FlaskConical className="h-3 w-3" />
                  Mediciones
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs flex-1"
                  onClick={() => window.open(laboratorioService.reportePlantaPdfUrl(selectedPos.planta_id!), "_blank")}
                >
                  <FileText className="h-3 w-3" />
                  PDF
                </Button>
              </div>
            )}

            {/* Upload evidence photo */}
            <div className="border-t mt-3 pt-3">
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-muted-foreground/30 hover:border-garces-cherry/50 hover:bg-garces-cherry-pale/30 cursor-pointer transition-colors text-[11px] text-muted-foreground">
                <Camera className="h-3.5 w-3.5" />
                <span>Subir foto de evidencia</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async () => {
                      const base64 = (reader.result as string).split(",")[1];
                      try {
                        await post<any>(`/posiciones/${selectedPos.id_posicion}/evidencia`, {
                          imagen_base64: base64,
                          descripcion: `Foto ${file.name}`,
                          id_planta: selectedPos.planta_id,
                        });
                        toast.success("Foto de evidencia registrada");
                        queryClient.invalidateQueries({ queryKey: ["posiciones", selectedPos.id_posicion, "historial"] });
                        queryClient.invalidateQueries({ queryKey: ["testblocks", tbId, "historial"] });
                      } catch {
                        toast.error("Error al subir foto");
                      }
                    };
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {/* Historial section */}
            <div className="border-t mt-3 pt-3">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Historial
              </div>
              {(!historialPos || historialPos.length === 0) ? (
                <p className="text-[10px] text-muted-foreground">Sin historial registrado</p>
              ) : (
                <div className="space-y-2">
                  {historialPos.slice(0, 8).map((ev) => (
                    <div key={ev.id_historial} className="flex gap-2">
                      <div
                        className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                          HISTORIAL_ACTION_COLORS[ev.accion?.toLowerCase()] || "bg-gray-400"
                        }`}
                      />
                      <div>
                        <div className="text-[11px] font-semibold leading-tight">{ev.accion}</div>
                        <div className="text-[10px] text-muted-foreground leading-tight">
                          {new Date(ev.fecha).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                          {ev.motivo ? ` - ${ev.motivo}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons — direct action for THIS position */}
            <div className="flex gap-2 mt-3 pt-3 border-t">
              {selectedPos.estado === "vacia" && (
                <button
                  onClick={() => {
                    // Pre-select this position and enter alta mode
                    const id = selectedPos.id_posicion;
                    setSelectedPos(null);
                    setSelectedPositions(new Set([id]));
                    setSelectionMode("alta");
                    setAltaConfirmOpen(true);
                  }}
                  className="flex-1 py-1.5 rounded-md border border-green-200 bg-green-50 text-green-600 text-[11px] font-semibold hover:bg-green-100 transition-colors"
                >
                  + Alta
                </button>
              )}
              {selectedPos.estado === "alta" && (
                <button
                  onClick={() => {
                    const id = selectedPos.id_posicion;
                    setSelectedPos(null);
                    setSelectedPositions(new Set([id]));
                    setSelectionMode("baja");
                    setBajaConfirmOpen(true);
                  }}
                  className="flex-1 py-1.5 rounded-md border border-red-200 bg-red-50 text-red-600 text-[11px] font-semibold hover:bg-red-100 transition-colors"
                >
                  Dar de baja
                </button>
              )}
              {(selectedPos.estado === "baja" || selectedPos.estado === "replante") && (
                <button
                  onClick={() => {
                    const id = selectedPos.id_posicion;
                    setSelectedPos(null);
                    setSelectedPositions(new Set([id]));
                    setSelectionMode("replante");
                    setReplanteConfirmOpen(true);
                  }}
                  className="flex-1 py-1.5 rounded-md border border-blue-200 bg-blue-50 text-blue-600 text-[11px] font-semibold hover:bg-blue-100 transition-colors"
                >
                  Replantar
                </button>
              )}
              {selectedPos.id_posicion && (
                <button
                  onClick={async () => {
                    try {
                      const token = useAuthStore.getState().token;
                      const base = import.meta.env.VITE_API_BASE_URL || "/api/v1";
                      const res = await fetch(`${base}/posiciones/${selectedPos.id_posicion}/qr`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (!res.ok) throw new Error(`Error ${res.status}`);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      window.open(url, "_blank");
                    } catch (e: any) {
                      toast.error("Error generando QR: " + (e?.message || ""));
                    }
                  }}
                  className="flex-1 py-1.5 rounded-md border border-border bg-white text-muted-foreground text-[11px] text-center hover:bg-muted/50 transition-colors"
                >
                  QR
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/*  MAPA — always visible below the grid                        */}
      {/* ============================================================ */}
      {tb.latitud && tb.longitud && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2">
            <MapIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground">Ubicacion del TestBlock</h3>
          </div>
          <div className="h-[300px]">
            <MapaTestBlock
              testblockId={tbId}
              variedadNames={
                Object.fromEntries(
                  (lk.rawData.variedades || []).map((v: any) => [v.id_variedad, v.nombre])
                )
              }
            />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  FIXED BOTTOM ACTION BAR                                     */}
      {/* ============================================================ */}
      {(selectedPositions.size > 0 || selectionMode !== "none") && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-2.5 z-50 ml-0 md:ml-60">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Count */}
            <span className="text-xs font-bold text-foreground flex items-center gap-1 shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              {selectedPositions.size} pos.
            </span>
            <span className="border-l h-5 mx-0.5" />

            {/* If in a selection mode (legacy flow), show confirm + cancel */}
            {selectionMode !== "none" ? (
              <>
                <Button size="sm" className="h-7 text-xs" variant="outline" onClick={exitSelectionMode}>
                  <X className="h-3 w-3" /> Cancelar
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={selectedPositions.size === 0}
                  onClick={handleConfirmSelection}
                >
                  <CheckCircle2 className="h-3 w-3" /> Confirmar ({selectedPositions.size})
                </Button>
              </>
            ) : (
              /* Direct action buttons — select positions then pick action */
              <>
                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={handleGrupoAlta} disabled={isProcessing} title="Plantar desde lote de inventario">
                  <Package className="h-3 w-3" /> Desde Lote
                </Button>
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleGrupoAltaDirecta} disabled={isProcessing} title="Plantar manualmente sin lote">
                  <Plus className="h-3 w-3" /> Manual
                </Button>
                <Button size="sm" className="h-7 text-xs" variant="destructive" onClick={handleGrupoBaja} disabled={isProcessing}>
                  <MinusCircle className="h-3 w-3" /> Baja
                </Button>
                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={handleGrupoReplante} disabled={isProcessing}>
                  <Repeat2 className="h-3 w-3" /> Replante
                </Button>
                <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white" onClick={handleGrupoFenologia} disabled={isProcessing}>
                  <Leaf className="h-3 w-3" /> Fenolog.
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setGrupoLaboresOpen(true)} disabled={isProcessing}>
                  <Hammer className="h-3 w-3" /> Labores
                </Button>
                <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={() => { setEtapaTarget("formacion"); setEtapaConfirmOpen(true); }} disabled={isProcessing}>
                  Form.
                </Button>
                <Button size="sm" className="h-7 text-xs bg-green-700 hover:bg-green-800 text-white" onClick={() => { setEtapaTarget("produccion"); setEtapaConfirmOpen(true); }} disabled={isProcessing}>
                  Prod.
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700" onClick={() => { if (confirm(`Marcar ${selectedPositions.size} pos. como polinizante?`)) handleGrupoPolinizante(); }} disabled={isProcessing}>
                  <Shield className="h-3 w-3" /> Polin.
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleGrupoQr} disabled={isProcessing}>
                  <QrCode className="h-3 w-3" /> QR
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={clearSelection}>
                  <X className="h-3 w-3" /> Limpiar
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom padding when bar is visible */}
      {(selectedPositions.size > 0 || selectionMode !== "none") && <div className="h-14" />}

      {/* ============================================================ */}
      {/*  DIALOGS                                                      */}
      {/* ============================================================ */}

      {/* Alta confirmation dialog */}
      <CrudForm
        open={altaConfirmOpen}
        onClose={() => { setAltaConfirmOpen(false); exitSelectionMode(); }}
        onSubmit={handleAltaSubmit}
        fields={altaConfirmFields}
        title={`Plantar desde Lote de Inventario (${selectedPositions.size} posiciones)`}
        isLoading={isProcessing}
      />

      {/* Alta Directa dialog (sin inventario) */}
      <CrudForm
        open={altaDirectaOpen}
        onClose={() => { setAltaDirectaOpen(false); }}
        onSubmit={async (data) => {
          setIsProcessing(true);
          try {
            const ids = Array.from(selectedPositions);
            const payload = {
              posicion_ids: ids,
              id_variedad: Number(data.id_variedad),
              id_portainjerto: Number(data.id_portainjerto),
              observaciones: data.observaciones || "",
            };
            const res = await post<{ created: number; message: string }>(`/testblocks/${tbId}/grupo/alta`, payload);
            toast.success(res.message || `${res.created} plantas alta directa`);
            queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
            setAltaDirectaOpen(false);
            clearSelection();
          } catch (err: any) {
            toast.error("Error: " + (err?.message || ""));
          }
          setIsProcessing(false);
        }}
        fields={altaDirectaFields}
        title={`Plantar Manual — Sin Lote (${selectedPositions.size} posiciones)`}
        isLoading={isProcessing}
      />

      {/* Baja confirmation dialog */}
      <CrudForm
        open={bajaConfirmOpen}
        onClose={() => { setBajaConfirmOpen(false); exitSelectionMode(); }}
        onSubmit={handleBajaSubmit}
        fields={bajaConfirmFields}
        title={`Baja de Plantas (${selectedPositions.size} posiciones)`}
        isLoading={isProcessing}
      />

      {/* Replante confirmation dialog */}
      <CrudForm
        open={replanteConfirmOpen}
        onClose={() => { setReplanteConfirmOpen(false); exitSelectionMode(); }}
        onSubmit={handleReplanteSubmit}
        fields={replanteConfirmFields}
        title={`Replante de Plantas (${selectedPositions.size} posiciones)`}
        isLoading={isProcessing}
      />

      {/* Fenologia confirmation dialog */}
      <CrudForm
        open={fenologiaConfirmOpen}
        onClose={() => { setFenologiaConfirmOpen(false); exitSelectionMode(); }}
        onSubmit={handleFenologiaSubmit}
        fields={fenologiaConfirmFields}
        title={`Registro Fenologico (${selectedPositions.size} posiciones)`}
        isLoading={isProcessing}
      />

      {/* Etapa confirmation dialog */}
      {etapaConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold">Cambiar Etapa</h3>
            <p className="text-sm text-muted-foreground">
              Cambiar {selectedPositions.size} planta{selectedPositions.size !== 1 ? "s" : ""} a <strong>{etapaTarget === "produccion" ? "Producción" : "Formación"}</strong>?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setEtapaConfirmOpen(false); exitSelectionMode(); }}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className={etapaTarget === "produccion" ? "bg-green-700 hover:bg-green-800" : "bg-amber-600 hover:bg-amber-700"}
                disabled={etapaMut.isPending}
                onClick={() => {
                  etapaMut.mutate(
                    { etapa: etapaTarget, posicion_ids: Array.from(selectedPositions) },
                    {
                      onSuccess: () => {
                        setEtapaConfirmOpen(false);
                        exitSelectionMode();
                      },
                    },
                  );
                }}
              >
                {etapaMut.isPending ? "Cambiando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Plant mediciones / cluster history dialog */}
      <PlantaMedicionesDialog
        open={medDialogOpen}
        onClose={() => { setMedDialogOpen(false); setMedPlanta(null); }}
        plantaId={medPlanta?.planta_id ?? null}
        plantaCodigo={medPlanta?.planta_codigo}
        plantaVariedad={medPlanta?.planta_variedad ? lk.variedad(medPlanta.planta_variedad) : undefined}
        clusterActual={medPlanta?.cluster_actual}
      />

      {/* Agregar Hilera dialog */}
      <CrudForm
        open={addHileraOpen}
        onClose={() => setAddHileraOpen(false)}
        onSubmit={async (data) => { addHileraMut.mutate(data); }}
        fields={addHileraFields}
        title="Agregar Nueva Hilera"
        isLoading={addHileraMut.isPending}
      />

      {/* Agregar Posiciones dialog */}
      <CrudForm
        open={addPosOpen}
        onClose={() => setAddPosOpen(false)}
        onSubmit={async (data) => { addPosMut.mutate(data); }}
        fields={addPosFields}
        title="Agregar Posiciones a Hilera"
        isLoading={addPosMut.isPending}
      />

      {/* Eliminar Hilera dialog */}
      <CrudForm
        open={delHileraOpen}
        onClose={() => setDelHileraOpen(false)}
        onSubmit={async (data) => { delHileraMut.mutate(data); }}
        fields={delHileraFields}
        title="Eliminar Hilera Completa"
        isLoading={delHileraMut.isPending}
      />

      {/* Editar TestBlock dialog */}
      <CrudForm
        open={editTbOpen}
        onClose={() => setEditTbOpen(false)}
        onSubmit={async (data) => { editTbMut.mutate(data); }}
        fields={editTbFields}
        title="Editar TestBlock"
        isLoading={editTbMut.isPending}
        initialData={{
          nombre: tb?.nombre,
          codigo: tb?.codigo,
          id_campo: tb?.id_campo,
          temporada_inicio: tb?.temporada_inicio,
          latitud: tb?.latitud,
          longitud: tb?.longitud,
          notas: tb?.notas,
        }}
      />

      {/* Grupo Labores dialog */}
      <CrudForm
        open={grupoLaboresOpen}
        onClose={() => setGrupoLaboresOpen(false)}
        onSubmit={handleGrupoLaboresSubmit}
        fields={grupoLaboresFields}
        title={`Planificar Labor Grupal (${selectedPositions.size} posiciones)`}
        isLoading={isProcessing}
      />
    </div>
  );
}
