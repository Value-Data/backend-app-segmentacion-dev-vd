import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Grid3X3, Plus, MinusCircle, RefreshCw,
  Package, CheckCircle2, XCircle, ExternalLink, FlaskConical,
  AlertTriangle, Repeat2, MapPin, Settings2, PlusCircle, Rows3,
  Calendar, FileText, Pencil, Trash2, QrCode, X, Clock, Leaf,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { KpiCard } from "@/components/shared/KpiCard";
import { CrudForm } from "@/components/shared/CrudForm";
type MapPinType = { id: number | string; lat: number; lng: number; label: string; detail?: string };
import { useTestblock, useGrilla, useResumenHileras, useResumenVariedades, useTestblockMutations, useInventarioTestblock } from "@/hooks/useTestblock";
import { useLookups } from "@/hooks/useLookups";
import { testblockService } from "@/services/testblock";
import { laboratorioService } from "@/services/laboratorio";
import { laboresService } from "@/services/labores";
import { inventarioService } from "@/services/inventario";
import { formatNumber } from "@/lib/utils";
import type { PosicionTestBlock, ColorMode, HistorialPosicion } from "@/types/testblock";
import { parseQr } from "@/types/testblock";
import type { FieldDef } from "@/types";
import { PlantaMedicionesDialog } from "@/components/shared/PlantaMedicionesDialog";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
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

type SelectionMode = "none" | "alta" | "baja" | "replante" | "eliminar" | "fenologia";

const ESTADOS_FENOLOGICOS = [
  "Inicio caida hoja",
  "50% caida",
  "100% caida",
  "Yema dormante",
  "Yema hinchada",
  "Punta verde",
  "Inicio floracion",
  "Plena floracion",
  "Cuaja",
  "Pinta/Envero",
];

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
  const [selectedPos, setSelectedPos] = useState<PosicionTestBlock | null>(null);

  /* --- Estado toggle (Formacion / Produccion) --- */
  const [estadoTB, setEstadoTB] = useState<"formacion" | "produccion">("formacion");

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
  const [bajaConfirmOpen, setBajaConfirmOpen] = useState(false);
  const [replanteConfirmOpen, setReplanteConfirmOpen] = useState(false);
  const [addHileraOpen, setAddHileraOpen] = useState(false);
  const [addPosOpen, setAddPosOpen] = useState(false);
  const [delHileraOpen, setDelHileraOpen] = useState(false);
  const [fenologiaConfirmOpen, setFenologiaConfirmOpen] = useState(false);
  const [editTbOpen, setEditTbOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  /* --- Historial query for selected position --- */
  const { data: historialPos } = useQuery({
    queryKey: ["posiciones", selectedPos?.id_posicion, "historial"],
    queryFn: () => testblockService.historial(selectedPos!.id_posicion),
    enabled: !!selectedPos?.id_posicion && selectionMode === "none",
  });

  /* --- Detail panel observaciones editing --- */
  const [detailObs, setDetailObs] = useState("");
  const [detailObsDirty, setDetailObsDirty] = useState(false);

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
        toast("Las posiciones ya estan generadas. Use \"Alta\" para plantar.", { icon: "ℹ️" });
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

  const fenologiaConfirmFields: FieldDef[] = useMemo(() => [
    {
      key: "estado_fenologico",
      label: "Estado Fenologico",
      type: "select",
      required: true,
      options: ESTADOS_FENOLOGICOS.map((e) => ({ value: e, label: e })),
      placeholder: "Seleccionar estado",
    },
    { key: "porcentaje", label: "Porcentaje (%)", type: "number", required: false, placeholder: "0 - 100" },
    { key: "fecha", label: "Fecha", type: "date", required: false, placeholder: new Date().toISOString().slice(0, 10) },
    { key: "observaciones", label: "Observaciones", type: "textarea", required: false, placeholder: "Observaciones (opcional)" },
  ], []);

  const editTbFields: FieldDef[] = useMemo(() => [
    { key: "nombre", label: "Nombre", type: "text", required: true },
    { key: "codigo", label: "Codigo", type: "text", required: true },
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
      if (pos) setSelectedPos(pos);
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
        estado_fenologico: data.estado_fenologico,
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

              {/* Formacion / Produccion segmented control */}
              <span className="inline-flex rounded-full border border-border overflow-hidden ml-1">
                <button
                  onClick={() => setEstadoTB("formacion")}
                  className={`px-2.5 py-0.5 text-[11px] font-semibold transition-colors border-none ${
                    estadoTB === "formacion"
                      ? "bg-amber-500 text-white"
                      : "bg-white text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Formacion
                </button>
                <button
                  onClick={() => setEstadoTB("produccion")}
                  className={`px-2.5 py-0.5 text-[11px] font-semibold transition-colors border-none ${
                    estadoTB === "produccion"
                      ? "bg-green-500 text-white"
                      : "bg-white text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Produccion
                </button>
              </span>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => setEditTbOpen(true)} title="Editar TestBlock">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditTbOpen(true)} title="Configuracion">
              <Settings2 className="h-4 w-4" />
            </Button>

            {selectionMode === "none" ? (
              <>
                <Button size="sm" variant="outline" className="text-muted-foreground">
                  <QrCode className="h-4 w-4" /> QR Etiquetas
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => enterSelectionMode("alta")}>
                  <Plus className="h-4 w-4" /> Alta
                </Button>
                <Button size="sm" variant="destructive" onClick={() => enterSelectionMode("baja")}>
                  <MinusCircle className="h-4 w-4" /> Baja
                </Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => enterSelectionMode("replante")}>
                  <Repeat2 className="h-4 w-4" /> Replante
                </Button>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => enterSelectionMode("fenologia")}>
                  <Leaf className="h-4 w-4" /> Fenologia
                </Button>
                <span className="hidden lg:block text-[10px] text-muted-foreground max-w-[160px] leading-tight">
                  Click un boton para seleccionar multiples posiciones
                </span>
              </>
            ) : (
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
        />
        <KpiCard
          title="Baja"
          value={tb.pos_baja || 0}
          icon={MinusCircle}
          className="border-red-200"
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
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
                <TabsTrigger value="historial">Historial</TabsTrigger>
              </TabsList>

              {/* Legend (shown next to tabs) */}
              <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500" /> Alta</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400" /> Baja</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-300" /> Vacia</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm border border-dashed border-gray-400 bg-gray-100" /> Sin crear</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500" /> Polinizante</span>
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
                  <div className="space-y-0.5">
                    {/* Grid header row */}
                    <div
                      className="grid gap-0.5"
                      style={{ gridTemplateColumns: `28px repeat(${maxPos}, 1fr)` }}
                    >
                      <div className="text-[8px] font-bold text-muted-foreground text-center">H\P</div>
                      {Array.from({ length: maxPos }, (_, i) => (
                        <div key={i} className="text-center text-[8px] font-semibold text-muted-foreground">{i + 1}</div>
                      ))}
                    </div>

                    {/* Grid rows */}
                    {Array.from({ length: hileras }, (_, hi) => (
                      <div
                        key={hi}
                        className="grid gap-0.5"
                        style={{ gridTemplateColumns: `28px repeat(${maxPos}, 1fr)` }}
                      >
                        <div className="text-[8px] font-bold text-muted-foreground flex items-center justify-center">
                          {hi + 1}
                        </div>
                        {Array.from({ length: maxPos }, (_, pi) => {
                          const pos = posMap.get(`${hi + 1}-${pi + 1}`);
                          const estado = pos?.estado || "vacia";
                          const qrInfo = pos ? parseQr(pos) : null;
                          const varName = pos?.planta_variedad
                            ? lk.variedad(pos.planta_variedad)
                            : qrInfo?.var || null;
                          const label = varName && varName !== "-"
                            ? varName.substring(0, 3)
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
                          const isDetailSelected = selectionMode === "none" && selectedPos?.id_posicion === pos?.id_posicion;

                          // Determine cell color — distinguish "no record" from "vacia"
                          const bgColor = !pos
                            ? "bg-gray-100 border border-dashed border-gray-300"
                            : estado === "vacia"
                            ? "bg-gray-200/60"
                            : estado === "baja"
                              ? "bg-red-500"
                              : estado === "replante"
                                ? "bg-blue-500"
                                : "bg-green-500";

                          return (
                            <button
                              key={pi}
                              className={`relative rounded-[3px] text-[8px] font-semibold py-[3px] transition-all ${bgColor} ${
                                estado !== "vacia" ? "text-white" : "text-gray-400"
                              } ${
                                isSelected
                                  ? "ring-2 ring-yellow-400 animate-pulse scale-110 z-10"
                                  : isDetailSelected
                                    ? "ring-2 ring-black"
                                    : isInSelectionMode && selectable
                                      ? "hover:ring-2 hover:ring-yellow-400 cursor-pointer"
                                      : isInSelectionMode
                                        ? "opacity-30 cursor-not-allowed"
                                        : "hover:ring-2 hover:ring-garces-cherry cursor-pointer"
                              }`}
                              style={{ opacity: estado === "vacia" && !isInSelectionMode ? 0.4 : undefined }}
                              title={tip}
                              onClick={() => handleGridCellClick(pos)}
                              disabled={isInSelectionMode && !selectable && !pos}
                            >
                              {label}
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
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500" /> Alta</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400" /> Baja</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500" /> Replante</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-200" /> Vacia</span>
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

            {/* --- HISTORIAL TAB (testblock-level) --- */}
            <TabsContent value="historial">
              <div className="bg-white rounded-xl border p-6">
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <h4 className="font-semibold text-sm">Historial del TestBlock</h4>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md">
                    Seleccione una posicion en la grilla para ver su historial detallado en el panel lateral.
                  </p>
                </div>
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
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedPos.estado} />
                <button
                  onClick={() => setSelectedPos(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Fields */}
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
              <div>
                <span className="text-muted-foreground">Estado:</span>{" "}
                <StatusBadge
                  status={estadoTB === "formacion" ? "Formacion" : "Produccion"}
                  className={estadoTB === "formacion" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}
                />
              </div>
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

            {/* Observaciones editable */}
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
                <a
                  href={`${import.meta.env.VITE_API_BASE_URL || "/api/v1"}/posiciones/${selectedPos.id_posicion}/qr`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-1.5 rounded-md border border-border bg-white text-muted-foreground text-[11px] text-center hover:bg-muted/50 transition-colors"
                >
                  QR
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/*  Floating action bar for selection mode                      */}
      {/* ============================================================ */}
      {selectionMode !== "none" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 z-50 ml-0 md:ml-60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedPositions.size} posicion{selectedPositions.size !== 1 ? "es" : ""} seleccionada{selectedPositions.size !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-muted-foreground">
                Modo: {selectionMode === "alta" ? "Alta (click en vacias)" : selectionMode === "replante" ? "Replante (click en bajas)" : selectionMode === "fenologia" ? "Fenologia (click en activas)" : selectionMode === "eliminar" ? "Eliminar (click en vacias/bajas)" : "Baja (click en activas)"}
              </span>
            </div>
            <div className="flex gap-2 items-center">
              {selectionMode !== "eliminar" && (
                <input
                  type="text"
                  className="border rounded-md px-2 py-1 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Observaciones (opcional)"
                  value={batchObservaciones}
                  onChange={(e) => setBatchObservaciones(e.target.value)}
                />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPositions(new Set())}
                disabled={selectedPositions.size === 0}
              >
                Limpiar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exitSelectionMode}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={selectedPositions.size === 0}
                onClick={handleConfirmSelection}
                className={
                  selectionMode === "alta"
                    ? "bg-green-600 hover:bg-green-700"
                    : selectionMode === "replante"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : selectionMode === "fenologia"
                        ? "bg-purple-600 hover:bg-purple-700"
                        : "bg-red-600 hover:bg-red-700"
                }
              >
                {selectionMode === "eliminar" ? <Trash2 className="h-4 w-4" /> : selectionMode === "fenologia" ? <Leaf className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar {selectionMode === "alta" ? "Alta" : selectionMode === "replante" ? "Replante" : selectionMode === "fenologia" ? "Fenologia" : selectionMode === "eliminar" ? "Eliminar" : "Baja"} ({selectedPositions.size})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add bottom padding when floating bar is visible */}
      {selectionMode !== "none" && <div className="h-16" />}

      {/* ============================================================ */}
      {/*  DIALOGS                                                      */}
      {/* ============================================================ */}

      {/* Alta confirmation dialog */}
      <CrudForm
        open={altaConfirmOpen}
        onClose={() => { setAltaConfirmOpen(false); exitSelectionMode(); }}
        onSubmit={handleAltaSubmit}
        fields={altaConfirmFields}
        title={`Alta de Plantas (${selectedPositions.size} posiciones)`}
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
    </div>
  );
}
