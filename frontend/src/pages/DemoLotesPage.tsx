/**
 * DemoLotesPage - Creacion visual de lotes desde grilla de TestBlock.
 *
 * Secciones:
 * 1. Seed Lotes Demo (auto-crear lotes desde TBs existentes)
 * 2. Grilla visual del TestBlock con posiciones coloreadas por variedad
 * 3. Acciones sobre la seleccion (crear lote / seed a lote existente)
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package, Database, Loader2, CheckSquare, PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { testblockService } from "@/services/testblock";
import { useLookups } from "@/hooks/useLookups";
import { useTestblocks } from "@/hooks/useTestblock";
import type { PosicionTestBlock } from "@/types/testblock";

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------
const VARIEDAD_COLORS = [
  "#22C55E", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#06B6D4", "#84CC16",
  "#A855F7", "#6366F1", "#D946EF", "#0EA5E9", "#10B981",
];

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
interface SeedResult {
  lotes_creados: number;
  plantas_vinculadas: number;
  detalles: {
    testblock: string;
    codigo_lote: string;
    variedad_id: number;
    portainjerto_id: number;
    posiciones: number;
    plantas_vinculadas: number;
  }[];
  message: string;
}

interface VariedadInfo {
  id: number;
  name: string;
  color: string;
  count: number;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------
export function DemoLotesPage() {
  const queryClient = useQueryClient();
  const lookups = useLookups();
  const { data: testblocks, isLoading: tbLoading } = useTestblocks();

  // ---- State ----
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [selectedTbId, setSelectedTbId] = useState<number | null>(null);
  const [selectedPosIds, setSelectedPosIds] = useState<Set<number>>(new Set());

  // ---- Queries ----
  const { data: posiciones, isLoading: posLoading } = useQuery({
    queryKey: ["testblocks", selectedTbId, "posiciones"],
    queryFn: () => testblockService.posiciones(selectedTbId!),
    enabled: !!selectedTbId,
  });

  // ---- Mutations ----
  const seedMutation = useMutation({
    mutationFn: () => testblockService.seedLotesDemo(),
    onSuccess: (data) => {
      setSeedResult(data as SeedResult);
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["testblocks"] });
    },
    onError: () => {
      toast.error("Error al ejecutar seed de lotes");
    },
  });

  const crearLoteMutation = useMutation({
    mutationFn: (params: { tbId: number; body: Record<string, unknown> }) =>
      testblockService.crearLote(params.tbId, params.body),
    onSuccess: (data) => {
      toast.success(data.message || `Lote ${data.codigo_lote} creado con ${data.plantas_creadas} plantas`);
      setSelectedPosIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["testblocks", selectedTbId, "posiciones"] });
      queryClient.invalidateQueries({ queryKey: ["testblocks"] });
    },
    onError: () => {
      toast.error("Error al crear lote");
    },
  });

  // ---- Derived: grid data ----
  const { posMap, hileras, maxPos } = useMemo(() => {
    const map = new Map<string, PosicionTestBlock>();
    let maxH = 0;
    let maxP = 0;
    for (const p of posiciones || []) {
      map.set(`${p.hilera}-${p.posicion}`, p);
      if (p.hilera > maxH) maxH = p.hilera;
      if (p.posicion > maxP) maxP = p.posicion;
    }
    return { posMap: map, hileras: maxH, maxPos: maxP };
  }, [posiciones]);

  // ---- Derived: variedad color mapping ----
  const variedadMap = useMemo(() => {
    const map = new Map<number, VariedadInfo>();
    if (!posiciones) return map;

    // Collect unique variedades
    const uniqueIds: number[] = [];
    for (const p of posiciones) {
      const vid = p.planta_variedad ?? p.id_variedad;
      if (vid != null && !map.has(vid)) {
        const idx = uniqueIds.length;
        uniqueIds.push(vid);
        map.set(vid, {
          id: vid,
          name: lookups.variedad(vid),
          color: VARIEDAD_COLORS[idx % VARIEDAD_COLORS.length],
          count: 0,
        });
      }
      if (vid != null) {
        const info = map.get(vid)!;
        info.count++;
      }
    }
    return map;
  }, [posiciones, lookups]);

  const variedadList = useMemo(
    () => Array.from(variedadMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    [variedadMap],
  );

  // ---- Derived: selection summary ----
  const selectionSummary = useMemo(() => {
    if (selectedPosIds.size === 0 || !posiciones) return null;

    const selected = posiciones.filter((p) => selectedPosIds.has(p.id_posicion));
    const variedades = new Set<number>();
    const portainjertos = new Set<number>();

    for (const p of selected) {
      const vid = p.planta_variedad ?? p.id_variedad;
      const pid = p.planta_portainjerto ?? p.id_portainjerto;
      if (vid != null) variedades.add(vid);
      if (pid != null) portainjertos.add(pid);
    }

    return {
      count: selected.length,
      variedadIds: Array.from(variedades),
      portainjertoIds: Array.from(portainjertos),
      variedadNames: Array.from(variedades).map((v) => lookups.variedad(v)),
      portainjertoNames: Array.from(portainjertos).map((p) => lookups.portainjerto(p)),
    };
  }, [selectedPosIds, posiciones, lookups]);

  // ---- Handlers ----
  const togglePosition = useCallback((id: number) => {
    setSelectedPosIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectByVariedad = useCallback((variedadId: number) => {
    if (!posiciones) return;
    const ids = posiciones
      .filter((p) => (p.planta_variedad ?? p.id_variedad) === variedadId)
      .map((p) => p.id_posicion);

    setSelectedPosIds((prev) => {
      // Check if all of this variedad are already selected
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all of this variedad
        for (const id of ids) next.delete(id);
      } else {
        // Select all of this variedad
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }, [posiciones]);

  const selectAll = useCallback(() => {
    if (!posiciones) return;
    setSelectedPosIds((prev) => {
      if (prev.size === posiciones.length) {
        return new Set();
      }
      return new Set(posiciones.map((p) => p.id_posicion));
    });
  }, [posiciones]);

  const handleCrearLote = useCallback(() => {
    if (!selectedTbId || !selectionSummary) return;

    if (selectionSummary.variedadIds.length !== 1) {
      toast.error("Seleccione posiciones de una sola variedad para crear un lote");
      return;
    }
    if (selectionSummary.portainjertoIds.length !== 1) {
      toast.error("Seleccione posiciones con un solo portainjerto para crear un lote");
      return;
    }

    crearLoteMutation.mutate({
      tbId: selectedTbId,
      body: {
        id_variedad: selectionSummary.variedadIds[0],
        id_portainjerto: selectionSummary.portainjertoIds[0],
        posicion_ids: Array.from(selectedPosIds),
      },
    });
  }, [selectedTbId, selectionSummary, selectedPosIds, crearLoteMutation]);

  // ---- Render helpers ----
  const tbOptions = (testblocks || []).map((tb: any) => ({
    value: tb.id_testblock,
    label: `${tb.codigo} - ${tb.nombre}`,
  }));

  /** Get the background color for a grid cell */
  const getCellStyle = (pos: PosicionTestBlock | undefined): React.CSSProperties => {
    if (!pos) return {};

    const estado = pos.estado || "vacia";

    if (estado === "vacia") {
      return { backgroundColor: "#ffffff", border: "1px solid #d1d5db" };
    }

    if (estado === "baja") {
      // Red-striped for baja
      return {
        background: "repeating-linear-gradient(45deg, #fca5a5, #fca5a5 3px, #ef4444 3px, #ef4444 6px)",
        border: "1px solid #dc2626",
      };
    }

    // alta / replante — color by variedad
    const vid = pos.planta_variedad ?? pos.id_variedad;
    if (vid != null && variedadMap.has(vid)) {
      return {
        backgroundColor: variedadMap.get(vid)!.color,
        border: "1px solid rgba(0,0,0,0.15)",
      };
    }

    // Fallback for alta/replante with no variedad
    return { backgroundColor: "#22C55E", border: "1px solid rgba(0,0,0,0.15)" };
  };

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6 text-amber-700" />
          Lotes desde TestBlocks
        </h1>
        <p className="text-muted-foreground mt-1">
          Seleccione posiciones visualmente en la grilla del TestBlock para crear lotes de plantas.
        </p>
      </div>

      {/* ================================================================ */}
      {/*  TOP: TestBlock Selector + Seed Button                           */}
      {/* ================================================================ */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="space-y-1 flex-1 max-w-sm">
              <label className="text-sm font-medium">TestBlock</label>
              <Select
                value={selectedTbId ? String(selectedTbId) : ""}
                onValueChange={(v) => {
                  setSelectedTbId(Number(v));
                  setSelectedPosIds(new Set());
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tbLoading ? "Cargando..." : "Seleccionar TestBlock"} />
                </SelectTrigger>
                <SelectContent>
                  {tbOptions.map((opt: { value: number; label: string }) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                {seedMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Database className="mr-2 h-4 w-4" />
                Seed Lotes Demo
              </Button>
            </div>
          </div>

          {/* Seed result */}
          {seedResult && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 space-y-3">
              <div className="flex gap-6 text-sm font-medium">
                <span className="text-blue-800">
                  Lotes creados: <strong>{seedResult.lotes_creados}</strong>
                </span>
                <span className="text-green-800">
                  Plantas vinculadas: <strong>{seedResult.plantas_vinculadas}</strong>
                </span>
              </div>
              {seedResult.detalles.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-blue-100 text-left">
                        <th className="p-2">TestBlock</th>
                        <th className="p-2">Codigo Lote</th>
                        <th className="p-2">Variedad</th>
                        <th className="p-2">Portainjerto</th>
                        <th className="p-2">Posiciones</th>
                        <th className="p-2">Plantas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seedResult.detalles.map((d, i) => (
                        <tr key={i} className="border-b border-blue-100">
                          <td className="p-2">{d.testblock}</td>
                          <td className="p-2 font-mono text-blue-700">{d.codigo_lote}</td>
                          <td className="p-2">{lookups.variedad(d.variedad_id)}</td>
                          <td className="p-2">{lookups.portainjerto(d.portainjerto_id)}</td>
                          <td className="p-2 text-center">{d.posiciones}</td>
                          <td className="p-2 text-center">{d.plantas_vinculadas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/*  MIDDLE: Visual Grid                                              */}
      {/* ================================================================ */}
      {selectedTbId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Grilla del TestBlock</CardTitle>
            <CardDescription>
              Click en una celda para seleccionar/deseleccionar. Click en una variedad de la leyenda para seleccionar todas sus posiciones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {posLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando posiciones...
              </div>
            ) : !posiciones || posiciones.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-8 text-center">
                Este TestBlock no tiene posiciones generadas.
              </p>
            ) : (
              <>
                {/* Toolbar */}
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="text-muted-foreground">
                    {hileras} hileras x {maxPos} posiciones ({posiciones.length} total)
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAll}
                    className="h-7 text-xs"
                  >
                    <CheckSquare className="mr-1 h-3.5 w-3.5" />
                    {selectedPosIds.size === posiciones.length ? "Deseleccionar Todo" : "Seleccionar Todo"}
                  </Button>
                  {selectedPosIds.size > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedPosIds(new Set())}
                      className="h-7 text-xs text-muted-foreground"
                    >
                      Limpiar seleccion
                    </Button>
                  )}
                </div>

                {/* Grid */}
                <div className="overflow-x-auto pb-2">
                  <div className="inline-block min-w-fit">
                    {/* Column headers */}
                    <div
                      className="grid gap-0.5 mb-0.5"
                      style={{ gridTemplateColumns: `32px repeat(${maxPos}, 1fr)` }}
                    >
                      <div />
                      {Array.from({ length: maxPos }, (_, pi) => (
                        <div
                          key={pi}
                          className="text-[8px] font-bold text-muted-foreground text-center"
                        >
                          {pi + 1}
                        </div>
                      ))}
                    </div>

                    {/* Grid rows */}
                    {Array.from({ length: hileras }, (_, hi) => (
                      <div
                        key={hi}
                        className="grid gap-0.5"
                        style={{ gridTemplateColumns: `32px repeat(${maxPos}, 1fr)` }}
                      >
                        {/* Row label */}
                        <div className="text-[9px] font-bold text-muted-foreground flex items-center justify-center">
                          H{hi + 1}
                        </div>

                        {/* Cells */}
                        {Array.from({ length: maxPos }, (_, pi) => {
                          const pos = posMap.get(`${hi + 1}-${pi + 1}`);
                          const estado = pos?.estado || "vacia";
                          const isSelected = pos ? selectedPosIds.has(pos.id_posicion) : false;

                          // Determine cell label
                          const vid = pos ? (pos.planta_variedad ?? pos.id_variedad) : null;
                          const varName = vid != null ? lookups.variedad(vid) : null;
                          const label = varName && varName !== "-"
                            ? varName.substring(0, 3)
                            : estado === "alta"
                              ? "A"
                              : estado === "baja"
                                ? "B"
                                : estado === "replante"
                                  ? "R"
                                  : "";

                          // Tooltip
                          const tip = pos
                            ? `${pos.codigo_unico} | ${estado}${varName && varName !== "-" ? ` | ${varName}` : ""}`
                            : `H${hi + 1}P${pi + 1} - sin crear`;

                          if (!pos) {
                            // No position record — empty grid slot
                            return (
                              <div
                                key={pi}
                                className="w-[24px] h-[24px] rounded-[3px] bg-gray-50 border border-dashed border-gray-200"
                                title={tip}
                              />
                            );
                          }

                          return (
                            <button
                              key={pi}
                              className={`w-[24px] h-[24px] rounded-[3px] text-[7px] font-bold transition-all leading-none flex items-center justify-center ${
                                isSelected
                                  ? "ring-[2.5px] ring-blue-500 ring-offset-1 scale-110 z-10"
                                  : "hover:ring-2 hover:ring-blue-300"
                              } ${
                                estado === "vacia"
                                  ? "text-gray-400"
                                  : "text-white drop-shadow-sm"
                              }`}
                              style={{
                                ...getCellStyle(pos),
                                opacity: estado === "vacia" ? 0.45 : 1,
                              }}
                              title={tip}
                              onClick={() => togglePosition(pos.id_posicion)}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Leyenda de Variedades (click para seleccionar)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {variedadList.map((v) => {
                      // Check if all positions of this variedad are selected
                      const posOfVar = (posiciones || []).filter(
                        (p) => (p.planta_variedad ?? p.id_variedad) === v.id,
                      );
                      const allSelected = posOfVar.length > 0 && posOfVar.every((p) => selectedPosIds.has(p.id_posicion));

                      return (
                        <button
                          key={v.id}
                          onClick={() => selectByVariedad(v.id)}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all border ${
                            allSelected
                              ? "border-blue-500 bg-blue-50 shadow-sm"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: v.color }}
                          />
                          <span>{v.name}</span>
                          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                            {v.count}
                          </Badge>
                        </button>
                      );
                    })}

                    {/* Estado indicators */}
                    <div className="flex items-center gap-3 ml-4 pl-4 border-l text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm bg-white border border-gray-400" />
                        Vacia
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className="w-3 h-3 rounded-sm"
                          style={{
                            background: "repeating-linear-gradient(45deg, #fca5a5, #fca5a5 2px, #ef4444 2px, #ef4444 4px)",
                          }}
                        />
                        Baja
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ================================================================ */}
      {/*  BOTTOM: Actions on selection                                     */}
      {/* ================================================================ */}
      {selectedTbId && selectionSummary && selectionSummary.count > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Selection info */}
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  {selectionSummary.count} posicion{selectionSummary.count !== 1 ? "es" : ""} seleccionada{selectionSummary.count !== 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Variedad{selectionSummary.variedadNames.length !== 1 ? "es" : ""}:{" "}
                    <strong className="text-foreground">{selectionSummary.variedadNames.join(", ")}</strong>
                  </span>
                  <span>
                    Portainjerto{selectionSummary.portainjertoNames.length !== 1 ? "s" : ""}:{" "}
                    <strong className="text-foreground">{selectionSummary.portainjertoNames.join(", ")}</strong>
                  </span>
                </div>
                {selectionSummary.variedadIds.length > 1 && (
                  <p className="text-xs text-amber-700 font-medium">
                    Nota: Para crear un lote, seleccione posiciones de una sola variedad y portainjerto.
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handleCrearLote}
                  disabled={
                    crearLoteMutation.isPending ||
                    selectionSummary.variedadIds.length !== 1 ||
                    selectionSummary.portainjertoIds.length !== 1
                  }
                  className="bg-green-600 hover:bg-green-700"
                >
                  {crearLoteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Crear Lote
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default DemoLotesPage;
