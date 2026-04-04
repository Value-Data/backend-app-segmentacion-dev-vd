import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Grid3X3, Plus, MinusCircle, RefreshCw,
  Package, CheckCircle2, XCircle, ExternalLink, FlaskConical,
  AlertTriangle, Repeat2, MapPin, Settings2, PlusCircle, Rows3,
  Calendar, FileText, Pencil, Trash2,
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
import { formatNumber } from "@/lib/utils";
import type { PosicionTestBlock, ColorMode } from "@/types/testblock";
import { parseQr } from "@/types/testblock";
import type { FieldDef } from "@/types";
import { PlantaMedicionesDialog } from "@/components/shared/PlantaMedicionesDialog";

const ESTADO_COLORS: Record<string, string> = {
  alta: "bg-green-500",
  baja: "bg-red-400",
  replante: "bg-blue-500",
  vacia: "bg-gray-200",
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

type SelectionMode = "none" | "alta" | "baja" | "replante" | "eliminar";

export function TestblockDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tbId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: tb, isLoading: tbLoading, isError: tbError } = useTestblock(tbId);
  const { data: grilla } = useGrilla(tbId);
  const { data: resumenHileras } = useResumenHileras(tbId);
  const { data: resumenVariedades } = useResumenVariedades(tbId);
  const { data: inventarioTb } = useInventarioTestblock(tbId);
  const mutations = useTestblockMutations(tbId);

  const lk = useLookups();
  const [colorMode] = useState<ColorMode>("estado");
  const [selectedPos, setSelectedPos] = useState<PosicionTestBlock | null>(null);

  // --- Selection mode state ---
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("none");
  const [selectedPositions, setSelectedPositions] = useState<Set<number>>(new Set());

  // --- Plant mediciones dialog state ---
  const [medDialogOpen, setMedDialogOpen] = useState(false);
  const [medPlanta, setMedPlanta] = useState<PosicionTestBlock | null>(null);

  // --- Confirmation dialog state ---
  const [altaConfirmOpen, setAltaConfirmOpen] = useState(false);
  const [bajaConfirmOpen, setBajaConfirmOpen] = useState(false);
  const [replanteConfirmOpen, setReplanteConfirmOpen] = useState(false);
  const [addHileraOpen, setAddHileraOpen] = useState(false);
  const [addPosOpen, setAddPosOpen] = useState(false);
  const [delHileraOpen, setDelHileraOpen] = useState(false);
  const [editTbOpen, setEditTbOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // Build lote options from inventarioTb (only lotes with disponible > 0)
  const loteOptions = useMemo(() => {
    if (!inventarioTb) return [];
    return inventarioTb
      .filter((item) => item.disponible > 0)
      .map((item) => ({
        value: item.id_inventario,
        label: `${item.codigo_lote || "Lote " + item.id_inventario} — ${item.variedad || "Sin variedad"} / ${item.portainjerto || "Sin PI"} (${item.disponible} disp.)`,
      }));
  }, [inventarioTb]);

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

  const editTbFields: FieldDef[] = useMemo(() => [
    { key: "nombre", label: "Nombre", type: "text", required: true },
    { key: "codigo", label: "Codigo", type: "text", required: true },
    { key: "id_campo", label: "Campo", type: "select", options: lk.options.campos },
    { key: "temporada_inicio", label: "Temporada Inicio", type: "text", placeholder: "Ej: 2024-2025" },
    { key: "latitud", label: "Latitud", type: "number", placeholder: "Ej: -34.1234567" },
    { key: "longitud", label: "Longitud", type: "number", placeholder: "Ej: -70.1234567" },
    { key: "notas", label: "Notas / Observaciones", type: "textarea" },
  ], [lk.options.campos]);

  // --- Selection mode handlers ---
  const enterSelectionMode = useCallback((mode: SelectionMode) => {
    setSelectionMode(mode);
    setSelectedPositions(new Set());
    setSelectedPos(null); // close detail panel
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode("none");
    setSelectedPositions(new Set());
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
      // Normal behavior: open detail panel
      if (pos) setSelectedPos(pos);
      return;
    }

    if (!pos) return;

    // In selection mode, validate and toggle
    if (selectionMode === "alta" && pos.estado !== "vacia") {
      return; // can only select empty positions for alta
    }
    if (selectionMode === "baja" && pos.estado !== "alta") {
      return; // can only select active positions for baja
    }
    if (selectionMode === "replante" && pos.estado !== "baja" && pos.estado !== "replante") {
      return; // can only select baja/replante positions for replante
    }
    if (selectionMode === "eliminar" && pos.estado !== "vacia" && pos.estado !== "baja") {
      return; // can only delete empty/baja positions
    }

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
    } else if (selectionMode === "eliminar") {
      if (confirm(`Eliminar ${selectedPositions.size} posicion(es)? Esta accion no se puede deshacer.`)) {
        delPosMut.mutate(Array.from(selectedPositions));
      }
    }
  }, [selectionMode, selectedPositions, delPosMut]);

  // --- Alta submission: loop individual alta calls ---
  const handleAltaSubmit = useCallback(async (data: Record<string, unknown>) => {
    const idLote = Number(data.id_lote);
    const ids = Array.from(selectedPositions);
    setIsProcessing(true);

    let success = 0;
    let failed = 0;

    for (const idPosicion of ids) {
      try {
        await testblockService.alta(tbId, { id_posicion: idPosicion, id_lote: idLote });
        success++;
      } catch (err: unknown) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Error en posicion ${idPosicion}: ${msg}`);
      }
    }

    setIsProcessing(false);

    if (success > 0) {
      toast.success(`Alta completada: ${success} plantas dadas de alta${failed > 0 ? `, ${failed} con error` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
    }

    exitSelectionMode();
  }, [selectedPositions, tbId, queryClient, exitSelectionMode]);

  // --- Baja submission: single baja-masiva call ---
  const handleBajaSubmit = useCallback(async (data: Record<string, unknown>) => {
    const motivo = String(data.motivo);
    const ids = Array.from(selectedPositions);
    setIsProcessing(true);

    try {
      await testblockService.bajaMasiva(tbId, { ids_posiciones: ids, motivo });
      toast.success(`Baja masiva completada: ${ids.length} plantas dadas de baja`);
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error en baja masiva: ${msg}`);
    }

    setIsProcessing(false);
    exitSelectionMode();
  }, [selectedPositions, tbId, queryClient, exitSelectionMode]);

  // --- Replante submission: loop individual replante calls ---
  const handleReplanteSubmit = useCallback(async (data: Record<string, unknown>) => {
    const idLote = Number(data.id_lote);
    const motivo = data.motivo ? String(data.motivo) : "Replante";
    const ids = Array.from(selectedPositions);
    setIsProcessing(true);

    let success = 0;
    let failed = 0;

    for (const idPosicion of ids) {
      try {
        await testblockService.replante(tbId, { id_posicion: idPosicion, id_lote: idLote, motivo });
        success++;
      } catch (err: unknown) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Error replante posicion ${idPosicion}: ${msg}`);
      }
    }

    setIsProcessing(false);

    if (success > 0) {
      toast.success(`Replante completado: ${success} plantas replantadas${failed > 0 ? `, ${failed} con error` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["testblocks", tbId] });
    }

    exitSelectionMode();
  }, [selectedPositions, tbId, queryClient, exitSelectionMode]);

  const mapPins: MapPinType[] = useMemo(() => {
    if (!tb?.latitud || !tb?.longitud) return [];
    return [{ id: tbId, lat: Number(tb.latitud), lng: Number(tb.longitud), label: tb.nombre || "", detail: tb.codigo || "" }];
  }, [tb?.latitud, tb?.longitud, tb?.nombre, tb?.codigo, tbId]);

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

  const total = (tb.pos_alta || 0) + (tb.pos_baja || 0) + (tb.pos_vacia || 0) + (tb.pos_replante || 0);

  // Build grid matrix
  const hileras = grilla?.hileras || tb.num_hileras || 0;
  const maxPos = grilla?.max_pos || tb.posiciones_por_hilera || 0;
  const posMap = new Map<string, PosicionTestBlock>();
  (grilla?.posiciones || []).forEach((p) => {
    posMap.set(`${p.hilera}-${p.posicion}`, p);
  });

  // Helper: determine if a cell is selectable in current mode
  const isCellSelectable = (estado: string): boolean => {
    if (selectionMode === "alta") return estado === "vacia";
    if (selectionMode === "baja") return estado === "alta";
    if (selectionMode === "replante") return estado === "baja" || estado === "replante";
    if (selectionMode === "eliminar") return estado === "vacia" || estado === "baja";
    return false;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/testblocks")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-garces-cherry">{tb.nombre}</h2>
            <p className="text-sm text-muted-foreground">{tb.codigo}</p>
          </div>
          <StatusBadge status={tb.estado || "activo"} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="ghost" onClick={() => setEditTbOpen(true)} title="Editar TestBlock">
            <Pencil className="h-4 w-4" />
          </Button>
          {selectionMode === "none" ? (
            <>
              <Button size="sm" onClick={() => enterSelectionMode("alta")}>
                <Plus className="h-4 w-4" /> Alta
              </Button>
              <Button size="sm" variant="destructive" onClick={() => enterSelectionMode("baja")}>
                <MinusCircle className="h-4 w-4" /> Baja
              </Button>
              <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => enterSelectionMode("replante")}>
                <Repeat2 className="h-4 w-4" /> Replante
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={exitSelectionMode}>
              <XCircle className="h-4 w-4" /> Cancelar Seleccion
            </Button>
          )}
        </div>
      </div>

      {/* Testblock Info Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Caracteristicas del TestBlock
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <div><span className="text-muted-foreground">Campo:</span> {lk.campo(tb.id_campo)}</div>
            <div><span className="text-muted-foreground">Cuartel:</span> {tb.id_cuartel ? `#${tb.id_cuartel}` : "-"}</div>
            <div><span className="text-muted-foreground">Temporada:</span> {tb.temporada_inicio || "-"}</div>
            <div><span className="text-muted-foreground">Hileras:</span> {hileras || "-"}</div>
            <div><span className="text-muted-foreground">Pos/Hilera:</span> {maxPos || "-"}</div>
            <div><span className="text-muted-foreground">Total Posiciones:</span> {total || "-"}</div>
            {tb.latitud && tb.longitud && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Coord:</span> {Number(tb.latitud).toFixed(5)}, {Number(tb.longitud).toFixed(5)}
              </div>
            )}
            {tb.fecha_creacion_tb && (
              <div><span className="text-muted-foreground">Creado:</span> {new Date(tb.fecha_creacion_tb).toLocaleDateString("es-CL")}</div>
            )}
            {tb.notas && (
              <div className="col-span-2 sm:col-span-3"><span className="text-muted-foreground">Notas:</span> {tb.notas}</div>
            )}
          </div>
          {/* Grid management buttons */}
          <div className="flex gap-2 mt-4 pt-3 border-t">
            <Button size="sm" variant="outline" onClick={() => genPosMut.mutate()} disabled={genPosMut.isPending}>
              <Grid3X3 className="h-4 w-4" /> Generar Posiciones
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddHileraOpen(true)}>
              <Rows3 className="h-4 w-4" /> Agregar Hilera
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddPosOpen(true)} disabled={hileras === 0}>
              <PlusCircle className="h-4 w-4" /> Agregar Posiciones
            </Button>
            <span className="border-l mx-1" />
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setDelHileraOpen(true)} disabled={hileras === 0}>
              <Trash2 className="h-4 w-4" /> Quitar Hilera
            </Button>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => enterSelectionMode("eliminar")} disabled={hileras === 0}>
              <Trash2 className="h-4 w-4" /> Quitar Posiciones
            </Button>
          </div>
        </div>

        {/* Map */}
        <div className="bg-white rounded-lg border overflow-hidden min-h-[250px]">
          {mapPins.length > 0 ? (
            <div className="flex flex-col items-center justify-center h-[250px] text-sm gap-1 p-4">
              <MapPin className="h-8 w-8 text-garces-cherry opacity-70" />
              <p className="font-medium">{Number(mapPins[0].lat).toFixed(5)}, {Number(mapPins[0].lng).toFixed(5)}</p>
              <p className="text-muted-foreground text-xs">Coordenadas del testblock</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground text-sm gap-2">
              <MapPin className="h-8 w-8 opacity-40" />
              <p>Sin coordenadas</p>
              <Button size="sm" variant="ghost" onClick={() => setEditTbOpen(true)}>
                Agregar ubicacion
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Alert: pending positions */}
      {(tb.pos_vacia || 0) > 0 && selectionMode === "none" && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <span className="font-semibold">{tb.pos_vacia} posicion{(tb.pos_vacia || 0) !== 1 ? "es" : ""} pendiente{(tb.pos_vacia || 0) !== 1 ? "s" : ""} de plantar.</span>
            {" "}Seleccione &quot;Alta&quot; para asignar plantas a las posiciones vacias.
          </div>
          <Button size="sm" variant="outline" className="ml-auto shrink-0 border-amber-400 text-amber-700 hover:bg-amber-100" onClick={() => enterSelectionMode("alta")}>
            <Plus className="h-4 w-4" /> Plantar ahora
          </Button>
        </div>
      )}

      {/* Alert: positions needing replant */}
      {(tb.pos_baja || 0) > 0 && selectionMode === "none" && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Repeat2 className="h-5 w-5 shrink-0 text-blue-500" />
          <div>
            <span className="font-semibold">{tb.pos_baja} posicion{(tb.pos_baja || 0) !== 1 ? "es" : ""} con baja</span> disponible{(tb.pos_baja || 0) !== 1 ? "s" : ""} para replante.
          </div>
          <Button size="sm" variant="outline" className="ml-auto shrink-0 border-blue-400 text-blue-700 hover:bg-blue-100" onClick={() => enterSelectionMode("replante")}>
            <Repeat2 className="h-4 w-4" /> Replantar
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiCard title="Total" value={formatNumber(total)} icon={Grid3X3} />
        <KpiCard title="Alta" value={tb.pos_alta || 0} icon={Plus} />
        <KpiCard title="Pendientes" value={tb.pos_vacia || 0} icon={AlertTriangle} />
        <KpiCard title="Baja" value={tb.pos_baja || 0} icon={MinusCircle} />
        <KpiCard title="Replante" value={tb.pos_replante || 0} icon={RefreshCw} />
      </div>

      <Tabs defaultValue="grilla">
        <TabsList>
          <TabsTrigger value="grilla">Grilla</TabsTrigger>
          <TabsTrigger value="hileras">Resumen Hileras</TabsTrigger>
          <TabsTrigger value="variedades">Variedades</TabsTrigger>
          <TabsTrigger value="inventario-tb">Inventario TB</TabsTrigger>
        </TabsList>

        {/* Grilla */}
        <TabsContent value="grilla">
          <div className="bg-white rounded-lg border p-4 overflow-auto">
            {/* Selection mode banner */}
            {selectionMode !== "none" && (
              <div
                className={`rounded-md px-4 py-2 mb-3 text-sm font-medium flex items-center justify-between ${
                  selectionMode === "alta"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : selectionMode === "replante"
                      ? "bg-blue-50 text-blue-800 border border-blue-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                <span>
                  {selectionMode === "alta"
                    ? "Seleccione posiciones vacias para plantar"
                    : selectionMode === "replante"
                      ? "Seleccione posiciones con baja para replantar"
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
              <div className="space-y-1">
                {/* Header row */}
                <div className="flex gap-1 mb-2">
                  <div className="w-10 text-xs text-muted-foreground font-medium text-right pr-1">H\P</div>
                  {Array.from({ length: maxPos }, (_, i) => (
                    <div key={i} className="w-8 text-center text-[10px] text-muted-foreground">{i + 1}</div>
                  ))}
                </div>
                {/* Grid rows */}
                {Array.from({ length: hileras }, (_, hi) => (
                  <div key={hi} className="flex gap-1 items-center">
                    <div className="w-10 text-xs text-muted-foreground font-medium text-right pr-1">{hi + 1}</div>
                    {Array.from({ length: maxPos }, (_, pi) => {
                      const pos = posMap.get(`${hi + 1}-${pi + 1}`);
                      const estado = pos?.estado || "vacia";
                      const qrInfo = pos ? parseQr(pos) : null;
                      // Prefer plant data for label/tooltip, fallback to QR, then generic letter
                      const varName = pos?.planta_variedad
                        ? lk.variedad(pos.planta_variedad)
                        : qrInfo?.var || null;
                      const piName = pos?.planta_portainjerto
                        ? lk.portainjerto(pos.planta_portainjerto)
                        : qrInfo?.pi || null;
                      const label = varName && varName !== "-"
                        ? varName.substring(0, 3)
                        : (estado === "alta" ? "A" : estado === "baja" ? "B" : estado === "replante" ? "R" : "");
                      const tip = pos
                        ? `${pos.codigo_unico} - ${estado}${varName && varName !== "-" ? ` | ${varName}` : ""}${piName && piName !== "-" ? ` / ${piName}` : ""}`
                        : `H${hi + 1}P${pi + 1} - vacia`;

                      const isInSelectionMode = selectionMode !== "none";
                      const selectable = isInSelectionMode && pos && isCellSelectable(estado);
                      const isSelected = pos ? selectedPositions.has(pos.id_posicion) : false;
                      const dimmed = isInSelectionMode && !selectable;

                      return (
                        <button
                          key={pi}
                          className={`relative w-8 h-8 rounded text-[9px] font-medium transition-all ${
                            ESTADO_COLORS[estado] || "bg-gray-100"
                          } ${estado !== "vacia" ? "text-white" : "text-gray-400"} ${
                            isSelected
                              ? "ring-2 ring-yellow-400 animate-pulse scale-110 z-10"
                              : isInSelectionMode && selectable
                                ? "hover:ring-2 hover:ring-yellow-400 cursor-pointer"
                                : isInSelectionMode
                                  ? "opacity-30 cursor-not-allowed"
                                  : "hover:ring-2 hover:ring-garces-cherry cursor-pointer"
                          }`}
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

            {/* Leyenda */}
            <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> Alta</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> Baja</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> Replante</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200" /> Vacia</span>
              {selectionMode !== "none" && (
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded ring-2 ring-yellow-400 bg-yellow-100" /> Seleccionada</span>
              )}
              <span className="border-l pl-4 ml-2 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-300" /> Cluster 1-2</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300" /> Cluster 3</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-300" /> Cluster 4</span>
            </div>
          </div>
        </TabsContent>

        {/* Resumen Hileras */}
        <TabsContent value="hileras">
          <div className="bg-white rounded-lg border overflow-auto">
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

        {/* Resumen Variedades */}
        <TabsContent value="variedades">
          <div className="bg-white rounded-lg border overflow-auto">
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

        {/* Inventario TestBlock */}
        <TabsContent value="inventario-tb">
          <div className="bg-white rounded-lg border overflow-auto">
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
        </TabsContent>
      </Tabs>

      {/* Selected position detail (only when NOT in selection mode) */}
      {selectionMode === "none" && selectedPos && (() => {
        const qr = parseQr(selectedPos);
        const hasPlantData = !!selectedPos.planta_id;
        return (
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">{selectedPos.codigo_unico}</h3>
              <div className="flex gap-1">
                {hasPlantData && selectedPos.planta_id && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-garces-cherry"
                      onClick={() => {
                        setMedPlanta(selectedPos);
                        setMedDialogOpen(true);
                      }}
                    >
                      <FlaskConical className="h-3.5 w-3.5 mr-1" />
                      Ver Mediciones
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(laboratorioService.reportePlantaPdfUrl(selectedPos.planta_id!), "_blank")}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      PDF Planta
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => setSelectedPos(null)}>Cerrar</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <div><span className="text-muted-foreground">Estado:</span> <StatusBadge status={selectedPos.estado} /></div>
              <div><span className="text-muted-foreground">Hilera:</span> {selectedPos.hilera}</div>
              <div><span className="text-muted-foreground">Posicion:</span> {selectedPos.posicion}</div>
              {hasPlantData && (
                <>
                  <div><span className="text-muted-foreground">Planta ID:</span> {selectedPos.planta_id}</div>
                  <div><span className="text-muted-foreground">Planta Codigo:</span> {selectedPos.planta_codigo || "-"}</div>
                  <div><span className="text-muted-foreground">Condicion:</span> {selectedPos.planta_condicion || "-"}</div>
                </>
              )}
              <div>
                <span className="text-muted-foreground">Variedad:</span>{" "}
                {hasPlantData
                  ? lk.variedad(selectedPos.planta_variedad)
                  : qr?.var || lk.variedad(selectedPos.id_variedad)}
              </div>
              <div>
                <span className="text-muted-foreground">Portainjerto:</span>{" "}
                {hasPlantData
                  ? lk.portainjerto(selectedPos.planta_portainjerto)
                  : qr?.pi || lk.portainjerto(selectedPos.id_portainjerto)}
              </div>
              <div>
                <span className="text-muted-foreground">Especie:</span>{" "}
                {hasPlantData && selectedPos.planta_especie
                  ? lk.especie(selectedPos.planta_especie)
                  : "-"}
              </div>
              {!hasPlantData && (
                <div><span className="text-muted-foreground">Planta:</span> {qr?.plt || "-"}</div>
              )}
              <div><span className="text-muted-foreground">Cluster:</span> {selectedPos.cluster_actual ?? "-"}</div>
              <div><span className="text-muted-foreground">Fecha Alta:</span> {selectedPos.fecha_alta || "-"}</div>
              <div><span className="text-muted-foreground">Lote:</span> {qr?.lote || (selectedPos.id_lote ? `ID ${selectedPos.id_lote}` : "-")}</div>
              {selectedPos.conduccion && (
                <div><span className="text-muted-foreground">Conduccion:</span> {selectedPos.conduccion}</div>
              )}
              {selectedPos.marco_plantacion && (
                <div><span className="text-muted-foreground">Marco:</span> {selectedPos.marco_plantacion}</div>
              )}
              {selectedPos.motivo_baja && (
                <div><span className="text-muted-foreground">Motivo Baja:</span> {selectedPos.motivo_baja}</div>
              )}
              {selectedPos.observaciones && (
                <div className="col-span-2 sm:col-span-3"><span className="text-muted-foreground">Obs:</span> {selectedPos.observaciones}</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Floating action bar for selection mode */}
      {selectionMode !== "none" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 flex items-center justify-between z-50 ml-0 md:ml-60">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedPositions.size} posicion{selectedPositions.size !== 1 ? "es" : ""} seleccionada{selectedPositions.size !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-muted-foreground">
              Modo: {selectionMode === "alta" ? "Alta (click en vacias)" : selectionMode === "replante" ? "Replante (click en bajas)" : selectionMode === "eliminar" ? "Eliminar (click en vacias/bajas)" : "Baja (click en activas)"}
            </span>
          </div>
          <div className="flex gap-2">
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
                    : "bg-red-600 hover:bg-red-700"
              }
            >
              {selectionMode === "eliminar" ? <Trash2 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirmar {selectionMode === "alta" ? "Alta" : selectionMode === "replante" ? "Replante" : selectionMode === "eliminar" ? "Eliminar" : "Baja"} ({selectedPositions.size})
            </Button>
          </div>
        </div>
      )}

      {/* Add bottom padding when floating bar is visible */}
      {selectionMode !== "none" && <div className="h-16" />}

      {/* Alta confirmation dialog */}
      <CrudForm
        open={altaConfirmOpen}
        onClose={() => setAltaConfirmOpen(false)}
        onSubmit={handleAltaSubmit}
        fields={altaConfirmFields}
        title={`Alta de Plantas (${selectedPositions.size} posiciones)`}
        isLoading={isProcessing}
      />

      {/* Baja confirmation dialog */}
      <CrudForm
        open={bajaConfirmOpen}
        onClose={() => setBajaConfirmOpen(false)}
        onSubmit={handleBajaSubmit}
        fields={bajaConfirmFields}
        title={`Baja de Plantas (${selectedPositions.size} posiciones)`}
        isLoading={isProcessing}
      />

      {/* Replante confirmation dialog */}
      <CrudForm
        open={replanteConfirmOpen}
        onClose={() => setReplanteConfirmOpen(false)}
        onSubmit={handleReplanteSubmit}
        fields={replanteConfirmFields}
        title={`Replante de Plantas (${selectedPositions.size} posiciones)`}
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
