/**
 * TomaDeMuestraTab -- Excel-like grid for recording lab measurements
 * on individual fruits from a selected plant or lot.
 *
 * Flow:
 * 1. Cascading filters: Especie -> Campo -> TestBlock -> [Lote | Planta]
 * 2. Editable grid: each row = 1 fruit measurement
 * 3. Fields adapt per species via getSpeciesConfig
 * 4. Enter key moves to next row (same column)
 * 5. "Guardar Todo" saves as batch via crearMedicionesBatch
 * 6. Shows cluster result per row after save
 */

import { useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Beaker,
  Save,
  RotateCcw,
  Loader2,
  Plus,
  BarChart3,
  X as XIcon,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { laboratorioService } from "@/services/laboratorio";
import { testblockService } from "@/services/testblock";
import { inventarioService } from "@/services/inventario";
import { useLookups } from "@/hooks/useLookups";
import { getSpeciesConfig } from "@/config/speciesFields";
import type { TestBlock } from "@/types/testblock";
import type { Planta, ClasificacionResult } from "@/types/laboratorio";

/* ---------------------------------------------------------------------------
 * Constants
 * -------------------------------------------------------------------------- */

const COLOR_PULPA_OPTIONS = [
  "Amarilla", "Blanca", "Roja", "Morada-Roja", "Anaranjada", "Damasco",
];

const CLUSTER_COLORS: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-800",
  2: "bg-sky-100 text-sky-800",
  3: "bg-amber-100 text-amber-800",
  4: "bg-red-100 text-red-800",
};

const CLUSTER_LABELS: Record<number, string> = {
  1: "Premium",
  2: "Alta",
  3: "Media",
  4: "Baja",
};

const INITIAL_ROW_COUNT = 10;

/* ---------------------------------------------------------------------------
 * Types
 * -------------------------------------------------------------------------- */

type SourceMode = "planta" | "lote";

interface GridRow {
  n_muestra: number;
  repeticion: string;
  brix: string;
  acidez: string;
  peso: string;
  perimetro: string;
  firmeza_punta: string;
  firmeza_quilla: string;
  firmeza_hombro: string;
  firmeza_mejilla_1: string;
  firmeza_mejilla_2: string;
  color_pulpa: string;
  observaciones: string;
}

interface RowResult {
  clasificacion?: ClasificacionResult | null;
  error?: string | null;
  saved?: boolean;
}

interface BatchSummary {
  totalEnviadas: number;
  totalCreadas: number;
  totalErrores: number;
  pctPremium: number;
  avgBrix: number | null;
  avgAcidez: number | null;
  avgPeso: number | null;
}

function createEmptyRow(nMuestra: number): GridRow {
  return {
    n_muestra: nMuestra,
    repeticion: "1",
    brix: "",
    acidez: "",
    peso: "",
    perimetro: "",
    firmeza_punta: "",
    firmeza_quilla: "",
    firmeza_hombro: "",
    firmeza_mejilla_1: "",
    firmeza_mejilla_2: "",
    color_pulpa: "",
    observaciones: "",
  };
}

function hasData(row: GridRow): boolean {
  return !!(
    row.brix || row.acidez || row.peso || row.perimetro ||
    row.firmeza_punta || row.firmeza_quilla || row.firmeza_hombro ||
    row.firmeza_mejilla_1 || row.firmeza_mejilla_2
  );
}

/** Average of mejilla_1 and mejilla_2. */
function mejillasAvg(row: GridRow): number | null {
  const m1 = parseFloat(row.firmeza_mejilla_1);
  const m2 = parseFloat(row.firmeza_mejilla_2);
  if (isNaN(m1) && isNaN(m2)) return null;
  if (isNaN(m1)) return m2;
  if (isNaN(m2)) return m1;
  return (m1 + m2) / 2;
}

/** Punto debil = min of all 5 firmeza points. */
function puntoDebil(row: GridRow): number | null {
  const vals = [
    row.firmeza_punta, row.firmeza_quilla, row.firmeza_hombro,
    row.firmeza_mejilla_1, row.firmeza_mejilla_2,
  ].map(Number).filter((v) => !isNaN(v) && v > 0);
  if (vals.length === 0) return null;
  return Math.min(...vals);
}

/* ---------------------------------------------------------------------------
 * Component
 * -------------------------------------------------------------------------- */

export function TomaDeMuestraTab() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const lk = useLookups();

  // -- Post-save summary --
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);

  // -- Filters --
  const [especie, setEspecie] = useState("");
  const [campoId, setCampoId] = useState("");
  const [testblockId, setTestblockId] = useState("");
  const [sourceMode, setSourceMode] = useState<SourceMode>("planta");
  const [loteId, setLoteId] = useState("");
  const [plantaId, setPlantaId] = useState("");
  const [temporada, setTemporada] = useState("");
  const [fechaMedicion, setFechaMedicion] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // -- Species config --
  const especieNombre = especie ? lk.especie(Number(especie)) : null;
  const spConfig = useMemo(() => getSpeciesConfig(especieNombre), [especieNombre]);
  const showPeso = spConfig.needsPeso || spConfig.visible.includes("peso") || spConfig.required.includes("peso");
  const showColorPulpa = spConfig.needsColorPulpa;

  // -- Grid state --
  const [rows, setRows] = useState<GridRow[]>(
    () => Array.from({ length: INITIAL_ROW_COUNT }, (_, i) => createEmptyRow(i + 1))
  );
  const [rowResults, setRowResults] = useState<Map<number, RowResult>>(new Map());
  const tableRef = useRef<HTMLTableElement>(null);

  // -- Data fetching --
  const { data: testblocks } = useQuery({
    queryKey: ["testblocks"],
    queryFn: testblockService.list,
    staleTime: 5 * 60_000,
  });

  // Filter testblocks by campo
  const filteredTestblocks = useMemo(() => {
    if (!testblocks) return [];
    const all = testblocks as TestBlock[];
    if (!campoId) return all;
    return all.filter((tb) => tb.id_campo === Number(campoId));
  }, [testblocks, campoId]);

  // Fetch lotes (inventario), filtered by especie
  const { data: lotes } = useQuery({
    queryKey: ["inventario", "all"],
    queryFn: () => inventarioService.list(),
    staleTime: 5 * 60_000,
  });

  const filteredLotes = useMemo(() => {
    if (!lotes) return [];
    if (!especie) return lotes;
    return lotes.filter((l) => l.id_especie === Number(especie));
  }, [lotes, especie]);

  // Fetch plantas, filtered by especie + testblock + campo
  const effectiveTb = testblockId && testblockId !== "__all__" ? Number(testblockId) : undefined;
  const { data: plantas } = useQuery({
    queryKey: ["laboratorio", "plantas", effectiveTb, especie],
    queryFn: () =>
      laboratorioService.plantas({
        testblock: effectiveTb,
        especie: especie ? Number(especie) : undefined,
      }),
    enabled: !!especie,
    staleTime: 3 * 60_000,
  });

  // Derive context from selected planta or lote
  const selectedPlanta = useMemo(() => {
    if (sourceMode !== "planta" || !plantaId || !plantas) return null;
    return plantas.find((p: Planta) => p.id_planta === Number(plantaId)) ?? null;
  }, [sourceMode, plantaId, plantas]);

  const selectedLote = useMemo(() => {
    if (sourceMode !== "lote" || !loteId || !lotes) return null;
    return lotes.find((l) => l.id_inventario === Number(loteId)) ?? null;
  }, [sourceMode, loteId, lotes]);

  // -- Row management --
  const updateRow = useCallback(
    (index: number, field: keyof GridRow, value: string | number) => {
      setRows((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const addRows = useCallback((count: number = 5) => {
    setRows((prev) => {
      const startNum = prev.length + 1;
      const newRows = Array.from({ length: count }, (_, i) =>
        createEmptyRow(startNum + i)
      );
      return [...prev, ...newRows];
    });
  }, []);

  const resetGrid = useCallback(() => {
    setRows(Array.from({ length: INITIAL_ROW_COUNT }, (_, i) => createEmptyRow(i + 1)));
    setRowResults(new Map());
    setBatchSummary(null);
  }, []);

  // -- Keyboard navigation: Enter -> next row same column --
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const table = tableRef.current;
        if (!table) return;
        const selector = `[data-row="${rowIndex + 1}"][data-col="${colIndex}"]`;
        const next = table.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
        if (next) next.focus();
      }
    },
    []
  );

  // -- Submit batch --
  const batchMut = useMutation({
    mutationFn: (mediciones: Record<string, unknown>[]) =>
      laboratorioService.crearMedicionesBatch(mediciones),
  });

  const handleSubmit = useCallback(async () => {
    if (!fechaMedicion) {
      toast.error("Debe seleccionar una fecha de evaluacion");
      return;
    }
    if (!especie) {
      toast.error("Debe seleccionar una especie");
      return;
    }
    if (sourceMode === "planta" && !plantaId) {
      toast.error("Debe seleccionar una planta");
      return;
    }
    if (sourceMode === "lote" && !loteId) {
      toast.error("Debe seleccionar un lote");
      return;
    }

    const rowsWithData = rows
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => hasData(row));

    if (rowsWithData.length === 0) {
      toast.error("No hay filas con mediciones para guardar");
      return;
    }

    const toNum = (v: string): number | null => {
      if (!v) return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    // Build context fields from selected source
    const contextFields: Record<string, unknown> = {
      fecha_medicion: fechaMedicion,
      temporada: temporada || null,
      id_especie: Number(especie),
    };

    if (sourceMode === "planta" && selectedPlanta) {
      contextFields.id_planta = selectedPlanta.id_planta;
      contextFields.id_variedad = selectedPlanta.id_variedad ?? null;
      contextFields.id_portainjerto = selectedPlanta.id_portainjerto ?? null;
    } else if (sourceMode === "lote" && selectedLote) {
      contextFields.id_variedad = selectedLote.id_variedad ?? null;
      contextFields.id_portainjerto = selectedLote.id_portainjerto ?? null;
    }

    if (campoId) {
      contextFields.id_campo = Number(campoId);
    }

    const mediciones = rowsWithData.map(({ row }) => ({
      ...contextFields,
      n_muestra: row.n_muestra,
      repeticion: toNum(row.repeticion),
      brix: toNum(row.brix),
      acidez: toNum(row.acidez),
      peso: toNum(row.peso),
      perimetro: toNum(row.perimetro),
      firmeza_punta: toNum(row.firmeza_punta),
      firmeza_quilla: toNum(row.firmeza_quilla),
      firmeza_hombro: toNum(row.firmeza_hombro),
      firmeza_mejilla_1: toNum(row.firmeza_mejilla_1),
      firmeza_mejilla_2: toNum(row.firmeza_mejilla_2),
      color_pulpa: row.color_pulpa || null,
      observaciones: row.observaciones || null,
    }));

    try {
      const resp = await batchMut.mutateAsync(mediciones);

      const newResults = new Map<number, RowResult>();
      for (let idx = 0; idx < resp.resultados.length; idx++) {
        const res = resp.resultados[idx];
        const origIdx = rowsWithData[idx].i;
        newResults.set(origIdx, {
          saved: res.success,
          clasificacion: res.clasificacion as ClasificacionResult | null | undefined,
          error: res.error,
        });
      }
      setRowResults(newResults);
      queryClient.invalidateQueries({ queryKey: ["laboratorio"] });

      // -- Compute batch summary --
      const savedResults = resp.resultados.filter((r: { success?: boolean }) => r.success);
      const savedIndices = rowsWithData
        .filter((_, i) => resp.resultados[i]?.success)
        .map(({ i }) => i);
      const savedRows = savedIndices.map((i) => rows[i]);

      const avgOf = (vals: number[]) =>
        vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

      const brixVals = savedRows.map((r) => parseFloat(r.brix)).filter((v) => !isNaN(v) && v > 0);
      const acidezVals = savedRows.map((r) => parseFloat(r.acidez)).filter((v) => !isNaN(v) && v > 0);
      const pesoVals = savedRows.map((r) => parseFloat(r.peso)).filter((v) => !isNaN(v) && v > 0);

      const classified = savedResults.filter(
        (r: { clasificacion?: { cluster?: number } | null }) => r.clasificacion?.cluster
      );
      const premiumCount = classified.filter(
        (r: { clasificacion?: { cluster?: number } | null }) =>
          r.clasificacion!.cluster === 1 || r.clasificacion!.cluster === 2
      ).length;
      const pctPremium = classified.length > 0
        ? (premiumCount / classified.length) * 100
        : 0;

      setBatchSummary({
        totalEnviadas: resp.total_enviadas,
        totalCreadas: resp.total_creadas,
        totalErrores: resp.total_errores,
        pctPremium,
        avgBrix: avgOf(brixVals),
        avgAcidez: avgOf(acidezVals),
        avgPeso: avgOf(pesoVals),
      });

      if (resp.total_errores === 0) {
        toast.success(`${resp.total_creadas} mediciones guardadas`);
      } else {
        toast.warning(`${resp.total_creadas} guardadas, ${resp.total_errores} con error`);
      }
    } catch {
      // toast shown by api.ts
    }
  }, [
    rows, fechaMedicion, temporada, especie, sourceMode, plantaId,
    loteId, campoId, selectedPlanta, selectedLote, batchMut, queryClient,
  ]);

  // -- Counts and summary --
  const dataCount = useMemo(() => rows.filter(hasData).length, [rows]);

  const summary = useMemo(() => {
    const filled = rows.filter(hasData);
    if (filled.length === 0) return null;
    const avg = (field: keyof GridRow) => {
      const vals = filled.map((r) => parseFloat(r[field] as string)).filter((v) => !isNaN(v) && v > 0);
      if (vals.length === 0) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    return {
      count: filled.length,
      brix: avg("brix"),
      acidez: avg("acidez"),
      peso: avg("peso"),
    };
  }, [rows]);

  // -- Check if source is ready for grid to be meaningful --
  const sourceReady = sourceMode === "planta" ? !!plantaId : !!loteId;

  // -- Styles (consistent with IngresoRapidoTab) --
  const thCls = "sticky top-0 z-10 bg-garces-cherry/90 text-white text-[11px] font-medium px-1.5 py-2 text-left whitespace-nowrap";
  const tdCls = "px-1 py-0.5";
  const inpCls = "h-7 text-xs w-full border border-border rounded px-1.5 bg-background focus:ring-1 focus:ring-garces-cherry/50 focus:border-garces-cherry";

  return (
    <div className="space-y-4">
      {/* -- Step 1: Cascading Filters -- */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-garces-cherry">
          <Beaker className="h-4 w-4" />
          Paso 1: Seleccionar contexto de muestreo
          {especieNombre && especieNombre !== "-" && (
            <span className="ml-2 text-xs font-normal bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5">
              {spConfig.ruleHint}
            </span>
          )}
        </div>

        {/* Row 1: Especie, Campo, TestBlock */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Especie */}
          <div>
            <Label className="text-xs">
              Especie <span className="text-destructive">*</span>
            </Label>
            <Select
              value={especie}
              onValueChange={(v) => {
                setEspecie(v);
                setLoteId("");
                setPlantaId("");
                setRowResults(new Map());
                setBatchSummary(null);
              }}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue placeholder="Seleccionar" />
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

          {/* Campo */}
          <div>
            <Label className="text-xs">Campo</Label>
            <Select
              value={campoId}
              onValueChange={(v) => {
                setCampoId(v);
                setTestblockId("");
              }}
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

          {/* TestBlock */}
          <div>
            <Label className="text-xs">TestBlock</Label>
            <Select
              value={testblockId}
              onValueChange={setTestblockId}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {filteredTestblocks.map((tb) => (
                  <SelectItem key={tb.id_testblock} value={String(tb.id_testblock)}>
                    {tb.nombre || tb.codigo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source mode toggle */}
          <div>
            <Label className="text-xs">Origen</Label>
            <div className="flex mt-1 rounded-md border overflow-hidden h-9">
              <button
                type="button"
                className={`flex-1 text-xs font-medium transition-colors ${
                  sourceMode === "planta"
                    ? "bg-garces-cherry text-white"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => {
                  setSourceMode("planta");
                  setLoteId("");
                }}
              >
                Planta
              </button>
              <button
                type="button"
                className={`flex-1 text-xs font-medium transition-colors ${
                  sourceMode === "lote"
                    ? "bg-garces-cherry text-white"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => {
                  setSourceMode("lote");
                  setPlantaId("");
                }}
              >
                Lote
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Lote/Planta selector + Temporada + Fecha */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Lote or Planta selector */}
          {sourceMode === "lote" ? (
            <div>
              <Label className="text-xs">
                Lote <span className="text-destructive">*</span>
              </Label>
              <Select value={loteId} onValueChange={setLoteId}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="Seleccionar lote" />
                </SelectTrigger>
                <SelectContent>
                  {filteredLotes.map((l) => (
                    <SelectItem key={l.id_inventario} value={String(l.id_inventario)}>
                      {l.codigo_lote} ({l.cantidad_actual} uds)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label className="text-xs">
                Planta <span className="text-destructive">*</span>
              </Label>
              <Select value={plantaId} onValueChange={setPlantaId}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="Seleccionar planta" />
                </SelectTrigger>
                <SelectContent>
                  {(plantas || []).map((p: Planta) => (
                    <SelectItem key={p.id_planta} value={String(p.id_planta)}>
                      {p.codigo || `#${p.id_planta}`}
                      {p.id_variedad ? ` - ${lk.variedad(p.id_variedad)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Temporada */}
          <div>
            <Label className="text-xs">Temporada</Label>
            <Select value={temporada} onValueChange={setTemporada}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue placeholder="Seleccionar" />
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
            <Label className="text-xs">
              Fecha evaluacion <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              className="mt-1 h-9"
              value={fechaMedicion}
              onChange={(e) => setFechaMedicion(e.target.value)}
            />
          </div>

          {/* Context summary */}
          <div className="flex items-end">
            <div className="h-9 flex items-center text-xs text-muted-foreground">
              {sourceMode === "planta" && selectedPlanta && (
                <span>
                  Variedad: <strong className="text-foreground">{lk.variedad(selectedPlanta.id_variedad)}</strong>
                  {" | PI: "}
                  <strong className="text-foreground">{lk.portainjerto(selectedPlanta.id_portainjerto)}</strong>
                </span>
              )}
              {sourceMode === "lote" && selectedLote && (
                <span>
                  Variedad: <strong className="text-foreground">{lk.variedad(selectedLote.id_variedad)}</strong>
                  {" | PI: "}
                  <strong className="text-foreground">{lk.portainjerto(selectedLote.id_portainjerto)}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* -- Step 2: Grid -- */}
      {!sourceReady ? (
        <div className="rounded-lg border bg-card p-12 text-center space-y-3">
          <ClipboardList className="h-12 w-12 mx-auto text-garces-cherry/30" />
          <p className="text-muted-foreground">
            Seleccione una especie y una <strong>{sourceMode === "planta" ? "planta" : "lote"}</strong> para
            comenzar a registrar mediciones de frutos individuales.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{rows.length}</strong> filas
              {" | "}
              <strong className="text-garces-cherry">{dataCount}</strong> con mediciones
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => addRows(5)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Agregar filas
              </Button>
              <Button variant="ghost" size="sm" onClick={resetGrid}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Limpiar
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-card overflow-x-auto max-h-[65vh] overflow-y-auto">
            <table ref={tableRef} className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr>
                  <th className={`${thCls} w-[36px] text-center`}>#</th>
                  <th className={`${thCls} w-[50px]`}>Mtra</th>
                  <th className={`${thCls} w-[45px]`}>Rep</th>
                  <th className={`${thCls} w-[60px]`}>Brix</th>
                  <th className={`${thCls} w-[60px]`}>Acidez</th>
                  {showPeso && <th className={`${thCls} w-[60px]`}>Peso (g)</th>}
                  {showColorPulpa && <th className={`${thCls} w-[85px]`}>Color P.</th>}
                  <th className={`${thCls} w-[55px]`}>Punta</th>
                  <th className={`${thCls} w-[55px]`}>Quilla</th>
                  <th className={`${thCls} w-[55px]`}>Hombro</th>
                  <th className={`${thCls} w-[55px]`}>Mej.1</th>
                  <th className={`${thCls} w-[55px]`}>Mej.2</th>
                  <th className={`${thCls} w-[55px] bg-garces-cherry/70`}>Mej.Avg</th>
                  <th className={`${thCls} w-[55px] bg-garces-cherry/70`}>P.Debil</th>
                  <th className={`${thCls} w-[60px]`}>Perim.</th>
                  <th className={`${thCls} w-[110px]`}>Obs.</th>
                  <th className={`${thCls} w-[60px] text-center`}>Result.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const res = rowResults.get(ri);
                  const rowHasData = hasData(row);
                  const bg = res?.error
                    ? "bg-red-50"
                    : res?.saved
                      ? "bg-emerald-50/60"
                      : rowHasData
                        ? "bg-amber-50/40"
                        : ri % 2 === 0
                          ? "bg-background"
                          : "bg-muted/20";

                  let ci = 0;
                  const mkInput = (
                    field: keyof GridRow,
                    opts?: { step?: string; placeholder?: string; type?: string; wide?: boolean }
                  ) => {
                    const colI = ci++;
                    return (
                      <input
                        data-row={ri}
                        data-col={colI}
                        type={opts?.type || "number"}
                        step={opts?.step || "0.1"}
                        className={`${inpCls} ${opts?.wide ? "w-[110px]" : "w-[60px]"}`}
                        value={row[field] as string}
                        onChange={(e) => updateRow(ri, field, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, ri, colI)}
                        placeholder={opts?.placeholder}
                      />
                    );
                  };

                  const mAvg = mejillasAvg(row);
                  const pDebil = puntoDebil(row);

                  return (
                    <tr key={ri} className={`${bg} border-b border-border/40`}>
                      <td className={`${tdCls} text-center text-[11px] text-muted-foreground font-mono`}>
                        {ri + 1}
                      </td>
                      <td className={`${tdCls} text-xs font-mono font-medium text-center`}>
                        {row.n_muestra}
                      </td>
                      <td className={tdCls}>{mkInput("repeticion", { step: "1", placeholder: "1" })}</td>
                      <td className={tdCls}>{mkInput("brix", { placeholder: "18.5" })}</td>
                      <td className={tdCls}>{mkInput("acidez", { step: "0.01", placeholder: "0.65" })}</td>
                      {showPeso && <td className={tdCls}>{mkInput("peso", { placeholder: "75" })}</td>}
                      {showColorPulpa && (
                        <td className={tdCls}>
                          {(() => {
                            const colI = ci++;
                            const opts = spConfig.colorPulpaOptions || COLOR_PULPA_OPTIONS.map((c) => ({ value: c, label: c }));
                            return (
                              <select
                                data-row={ri}
                                data-col={colI}
                                className={`${inpCls} w-[80px]`}
                                value={row.color_pulpa}
                                onChange={(e) => updateRow(ri, "color_pulpa", e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, ri, colI)}
                              >
                                <option value="">--</option>
                                {opts.map((c) => (
                                  <option
                                    key={typeof c === "string" ? c : c.value}
                                    value={typeof c === "string" ? c : c.value}
                                  >
                                    {typeof c === "string" ? c : c.label}
                                  </option>
                                ))}
                              </select>
                            );
                          })()}
                        </td>
                      )}
                      <td className={tdCls}>{mkInput("firmeza_punta")}</td>
                      <td className={tdCls}>{mkInput("firmeza_quilla")}</td>
                      <td className={tdCls}>{mkInput("firmeza_hombro")}</td>
                      <td className={tdCls}>{mkInput("firmeza_mejilla_1")}</td>
                      <td className={tdCls}>{mkInput("firmeza_mejilla_2")}</td>
                      {/* Calculated: Mejillas Avg */}
                      <td className={`${tdCls} text-center text-[11px] font-mono ${mAvg != null ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {mAvg != null ? mAvg.toFixed(1) : "-"}
                      </td>
                      {/* Calculated: Punto Debil */}
                      <td className={`${tdCls} text-center text-[11px] font-mono ${pDebil != null ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {pDebil != null ? pDebil.toFixed(1) : "-"}
                      </td>
                      <td className={tdCls}>{mkInput("perimetro", { placeholder: "90" })}</td>
                      <td className={tdCls}>
                        {(() => {
                          const colI = ci++;
                          return (
                            <input
                              data-row={ri}
                              data-col={colI}
                              type="text"
                              className={`${inpCls} w-[100px]`}
                              value={row.observaciones}
                              onChange={(e) => updateRow(ri, "observaciones", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, ri, colI)}
                              placeholder="..."
                            />
                          );
                        })()}
                      </td>
                      <td className={`${tdCls} text-center`}>
                        {res?.saved && res.clasificacion ? (
                          <span
                            className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${CLUSTER_COLORS[res.clasificacion.cluster] || "bg-gray-100"}`}
                            title={`${res.clasificacion.cluster_label} (score: ${res.clasificacion.score_total})`}
                          >
                            C{res.clasificacion.cluster}
                          </span>
                        ) : res?.error ? (
                          <span className="text-[10px] text-destructive" title={res.error}>Error</span>
                        ) : res?.saved ? (
                          <span className="text-[10px] text-emerald-600 font-medium">OK</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Real-time summary */}
          {summary && (
            <div className="flex items-center gap-6 rounded-lg border bg-muted/40 px-4 py-2 text-xs">
              <span className="font-medium text-muted-foreground">
                {summary.count} fruto{summary.count !== 1 ? "s" : ""} con datos:
              </span>
              {summary.brix != null && (
                <span>
                  Brix <strong className="text-garces-cherry">{summary.brix.toFixed(1)}</strong>
                </span>
              )}
              {summary.acidez != null && (
                <span>
                  Acidez <strong className="text-garces-cherry">{summary.acidez.toFixed(2)}</strong>
                </span>
              )}
              {summary.peso != null && (
                <span>
                  Peso <strong className="text-garces-cherry">{summary.peso.toFixed(1)}g</strong>
                </span>
              )}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Mejillas promedio y punto debil se calculan en tiempo real.
              Usa <kbd className="bg-muted px-1 rounded text-[10px]">Enter</kbd> para bajar de fila,{" "}
              <kbd className="bg-muted px-1 rounded text-[10px]">Tab</kbd> para avanzar columna.
            </p>
            <Button
              onClick={handleSubmit}
              disabled={batchMut.isPending || dataCount === 0}
              className="bg-garces-cherry hover:bg-garces-cherry/90"
            >
              {batchMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {batchMut.isPending
                ? "Guardando..."
                : `Guardar Todo (${dataCount} mediciones)`}
            </Button>
          </div>

          {/* -- Post-save summary card -- */}
          {batchSummary && (
            <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Resumen del guardado
                </h3>
                <button
                  onClick={() => setBatchSummary(null)}
                  className="text-emerald-600 hover:text-emerald-800 p-1 rounded hover:bg-emerald-100"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg bg-white border border-emerald-200 p-3 text-center">
                  <p className="text-muted-foreground">Guardadas</p>
                  <p className="text-xl font-bold text-emerald-700">
                    {batchSummary.totalCreadas}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{batchSummary.totalEnviadas}
                    </span>
                  </p>
                  {batchSummary.totalErrores > 0 && (
                    <p className="text-[10px] text-red-600 font-medium">
                      {batchSummary.totalErrores} error{batchSummary.totalErrores !== 1 ? "es" : ""}
                    </p>
                  )}
                </div>
                <div className="rounded-lg bg-white border border-emerald-200 p-3 text-center">
                  <p className="text-muted-foreground">% Premium (C1+C2)</p>
                  <p className="text-xl font-bold text-emerald-700">
                    {batchSummary.pctPremium.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-lg bg-white border border-emerald-200 p-3 text-center">
                  <p className="text-muted-foreground">Brix Prom.</p>
                  <p className="text-xl font-bold text-garces-cherry">
                    {batchSummary.avgBrix != null ? batchSummary.avgBrix.toFixed(1) : "-"}
                  </p>
                </div>
                <div className="rounded-lg bg-white border border-emerald-200 p-3 text-center">
                  <p className="text-muted-foreground">Acidez / Peso</p>
                  <p className="text-lg font-bold text-garces-cherry">
                    {batchSummary.avgAcidez != null ? batchSummary.avgAcidez.toFixed(2) : "-"}
                    {batchSummary.avgPeso != null && (
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}/ {batchSummary.avgPeso.toFixed(1)}g
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
