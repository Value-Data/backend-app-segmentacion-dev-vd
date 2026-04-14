/**
 * IngresoRapidoTab — Grid for bulk lab measurement entry.
 *
 * Flow:
 * 1. Select Especie (required) → Testblock → Temporada → Fecha
 * 2. Click "Cargar plantas" → grid auto-populates with all active plants
 * 3. User fills only measurement values (brix, acidez, firmeza, peso, etc.)
 * 4. "Guardar todo" submits the batch
 */

import { useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Download, Save, RotateCcw, Loader2, Leaf, BarChart3, X as XIcon } from "lucide-react";
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
import { useLookups } from "@/hooks/useLookups";
import { testblockService } from "@/services/testblock";
import { getSpeciesConfig } from "@/config/speciesFields";
import type { TestBlock } from "@/types/testblock";
import type { Planta, ClasificacionResult } from "@/types/laboratorio";

/* ─────────────────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────────────────── */

const COLOR_PULPA_OPTIONS = [
  "Amarilla", "Blanca", "Roja", "Morada-Roja", "Anaranjada", "Damasco",
];

const CLUSTER_COLORS: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-800",
  2: "bg-sky-100 text-sky-800",
  3: "bg-amber-100 text-amber-800",
  4: "bg-red-100 text-red-800",
};

/* ─────────────────────────────────────────────────────────────────────────
 * Row type — each row maps to a planta, user only fills measurements
 * ────────────────────────────────────────────────────────────────────── */

interface GridRow {
  // Pre-filled from plant data (read-only)
  id_planta: number;
  id_variedad: number | null;
  id_portainjerto: number | null;
  codigo: string;
  variedad: string;
  portainjerto: string;
  // User fills these
  n_muestra: string;
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
  // Color cubrimiento
  color_0_30: string;
  color_30_50: string;
  color_50_75: string;
  color_75_100: string;
  // Color distribucion
  color_verde: string;
  color_crema: string;
  color_amarillo: string;
  color_full: string;
  // Postcosecha
  pardeamiento: string;
  traslucidez: string;
  gelificacion: string;
  harinosidad: string;
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

function hasData(row: GridRow): boolean {
  return !!(
    row.brix || row.acidez || row.peso || row.perimetro ||
    row.firmeza_punta || row.firmeza_quilla || row.firmeza_hombro ||
    row.firmeza_mejilla_1 || row.firmeza_mejilla_2 ||
    row.pardeamiento || row.traslucidez || row.gelificacion || row.harinosidad
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────────────────────────────── */

export function IngresoRapidoTab() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const lk = useLookups();

  // ── Post-save summary ──
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);

  // ── Header filters ──
  const [especie, setEspecie] = useState("");
  const [campo, setCampo] = useState("");
  const [testblockId, setTestblockId] = useState("");
  const [temporada, setTemporada] = useState("");
  const [fechaMedicion, setFechaMedicion] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // ── Species config ──
  const especieNombre = especie ? lk.especie(Number(especie)) : null;
  const spConfig = useMemo(() => getSpeciesConfig(especieNombre), [especieNombre]);
  const showPeso = spConfig.needsPeso || spConfig.visible.includes("peso") || spConfig.required.includes("peso");
  const showColorPulpa = spConfig.needsColorPulpa;
  const showColorCoverage = spConfig.visible.includes("color_0_30") || spConfig.required.includes("color_0_30");
  const showColorDist = spConfig.visible.includes("color_verde") || spConfig.required.includes("color_verde");
  const showPostcosecha = spConfig.visible.includes("pardeamiento") || spConfig.visible.includes("periodo_almacenaje");

  // ── Grid state ──
  const [rows, setRows] = useState<GridRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [rowResults, setRowResults] = useState<Map<number, RowResult>>(new Map());
  const tableRef = useRef<HTMLTableElement>(null);

  // ── Data fetching ──
  const { data: testblocks } = useQuery({
    queryKey: ["testblocks"],
    queryFn: testblockService.list,
    staleTime: 5 * 60_000,
  });

  const effectiveTb = testblockId && testblockId !== "__all__" ? Number(testblockId) : undefined;

  const { data: plantas, isLoading: plantasLoading } = useQuery({
    queryKey: ["laboratorio", "plantas", effectiveTb, especie],
    queryFn: () =>
      laboratorioService.plantas({
        testblock: effectiveTb,
        especie: especie ? Number(especie) : undefined,
      }),
    enabled: !!especie,
  });

  // Filter testblocks by selected campo
  const effectiveCampo = campo && campo !== "__all__" ? Number(campo) : undefined;
  const filteredTestblocks = useMemo(() => {
    if (!testblocks) return [];
    const all = testblocks as TestBlock[];
    if (!effectiveCampo) return all;
    return all.filter((tb) => tb.id_campo === effectiveCampo);
  }, [testblocks, effectiveCampo]);

  // ── Load plants into grid ──
  const loadPlantas = useCallback(() => {
    if (!plantas || plantas.length === 0) {
      toast.error("No hay plantas activas para los filtros seleccionados");
      return;
    }

    const newRows: GridRow[] = plantas.map((p: Planta) => ({
      id_planta: p.id_planta,
      id_variedad: p.id_variedad ?? null,
      id_portainjerto: p.id_portainjerto ?? null,
      codigo: p.codigo || `#${p.id_planta}`,
      variedad: p.id_variedad ? lk.variedad(p.id_variedad) : "-",
      portainjerto: p.id_portainjerto ? lk.portainjerto(p.id_portainjerto) : "-",
      n_muestra: "",
      repeticion: "",
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
      color_0_30: "",
      color_30_50: "",
      color_50_75: "",
      color_75_100: "",
      color_verde: "",
      color_crema: "",
      color_amarillo: "",
      color_full: "",
      pardeamiento: "",
      traslucidez: "",
      gelificacion: "",
      harinosidad: "",
      observaciones: "",
    }));

    setRows(newRows);
    setRowResults(new Map());
    setLoaded(true);
    toast.success(`${newRows.length} plantas cargadas en la grilla`);
  }, [plantas, lk]);

  // ── Row update ──
  const updateRow = useCallback(
    (index: number, field: keyof GridRow, value: string) => {
      setRows((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const resetGrid = useCallback(() => {
    setRows([]);
    setRowResults(new Map());
    setBatchSummary(null);
    setLoaded(false);
  }, []);

  // ── Keyboard navigation: Enter → next row, same column ──
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

  // ── Submit batch ──
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

    const mediciones = rowsWithData.map(({ row }) => ({
      fecha_medicion: fechaMedicion,
      temporada: temporada || null,
      id_especie: Number(especie),
      id_planta: row.id_planta,
      id_variedad: row.id_variedad,
      id_portainjerto: row.id_portainjerto,
      n_muestra: toNum(row.n_muestra),
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
      color_0_30: toNum(row.color_0_30),
      color_30_50: toNum(row.color_30_50),
      color_50_75: toNum(row.color_50_75),
      color_75_100: toNum(row.color_75_100),
      color_verde: toNum(row.color_verde),
      color_crema: toNum(row.color_crema),
      color_amarillo: toNum(row.color_amarillo),
      color_full: toNum(row.color_full),
      pardeamiento: toNum(row.pardeamiento),
      traslucidez: toNum(row.traslucidez),
      gelificacion: toNum(row.gelificacion),
      harinosidad: toNum(row.harinosidad),
      observaciones: row.observaciones || null,
    }));

    try {
      const resp = await batchMut.mutateAsync(mediciones);

      const newResults = new Map<number, RowResult>();
      for (let i = 0; i < resp.resultados.length; i++) {
        const res = resp.resultados[i];
        const origIdx = rowsWithData[i].i;
        newResults.set(origIdx, {
          saved: res.success,
          clasificacion: res.clasificacion as ClasificacionResult | null | undefined,
          error: res.error,
        });
      }
      setRowResults(newResults);
      queryClient.invalidateQueries({ queryKey: ["laboratorio"] });

      // ── Compute batch summary ──
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
  }, [rows, fechaMedicion, temporada, especie, batchMut, queryClient]);

  // ── Counts and summary ──
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
      brix: avg("brix"),
      acidez: avg("acidez"),
      peso: avg("peso"),
    };
  }, [rows]);

  // ── Styles ──
  const thCls = "sticky top-0 z-10 bg-garces-cherry/90 text-white text-[11px] font-medium px-1.5 py-2 text-left whitespace-nowrap";
  const tdCls = "px-1 py-0.5";
  const inpCls = "h-7 text-xs w-full border border-border rounded px-1.5 bg-background focus:ring-1 focus:ring-garces-cherry/50 focus:border-garces-cherry";

  return (
    <div className="space-y-4">
      {/* ── Step 1: Filters ── */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-garces-cherry">
          <Zap className="h-4 w-4" />
          Paso 1: Seleccionar especie y testblock
          {especieNombre && especieNombre !== "-" && (
            <span className="ml-2 text-xs font-normal bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5">
              {spConfig.ruleHint}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {/* Especie */}
          <div>
            <Label className="text-xs">
              Especie <span className="text-destructive">*</span>
            </Label>
            <Select
              value={especie}
              onValueChange={(v) => {
                setEspecie(v);
                setCampo("");
                setTestblockId("");
                setLoaded(false);
                setRows([]);
                setRowResults(new Map());
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
              value={campo}
              onValueChange={(v) => {
                setCampo(v);
                setTestblockId("");
                setLoaded(false);
                setRows([]);
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

          {/* Testblock */}
          <div>
            <Label className="text-xs">Testblock</Label>
            <Select
              value={testblockId}
              onValueChange={(v) => {
                setTestblockId(v);
                setLoaded(false);
                setRows([]);
              }}
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

          {/* Fecha */}
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

          {/* Load button */}
          <div className="flex items-end">
            <Button
              className="w-full h-9 bg-garces-cherry hover:bg-garces-cherry/90"
              disabled={!especie || plantasLoading}
              onClick={loadPlantas}
            >
              {plantasLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Cargar plantas ({plantas?.length ?? 0})
            </Button>
          </div>
        </div>
      </div>

      {/* ── Step 2: Grid (shown after loading plants) ── */}
      {!loaded ? (
        <div className="rounded-lg border bg-card p-12 text-center space-y-3">
          <Leaf className="h-12 w-12 mx-auto text-garces-cherry/30" />
          <p className="text-muted-foreground">
            Seleccione una especie y haga clic en <strong>"Cargar plantas"</strong> para
            comenzar a registrar mediciones.
          </p>
          {especie && plantas && (
            <p className="text-sm text-garces-cherry font-medium">
              {plantas.length} planta{plantas.length !== 1 ? "s" : ""} disponible{plantas.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No se encontraron plantas activas para los filtros seleccionados.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{rows.length}</strong> plantas cargadas
              {" · "}
              <strong className="text-garces-cherry">{dataCount}</strong> con mediciones
            </p>
            <Button variant="ghost" size="sm" onClick={resetGrid}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Limpiar
            </Button>
          </div>

          <div className="rounded-lg border bg-card overflow-x-auto max-h-[65vh] overflow-y-auto">
            <table ref={tableRef} className="w-full border-collapse min-w-[1200px]">
              <thead>
                <tr>
                  <th className={`${thCls} w-[36px] text-center`}>#</th>
                  <th className={`${thCls} w-[100px]`}>Planta</th>
                  <th className={`${thCls} w-[110px]`}>Variedad</th>
                  <th className={`${thCls} w-[80px]`}>PI</th>
                  <th className={`${thCls} w-[45px]`}>Mtra</th>
                  <th className={`${thCls} w-[40px]`}>Rep</th>
                  <th className={`${thCls} w-[55px]`}>Brix</th>
                  <th className={`${thCls} w-[55px]`}>Acidez</th>
                  {showPeso && <th className={`${thCls} w-[55px]`}>Peso</th>}
                  <th className={`${thCls} w-[60px]`}>Perim.</th>
                  <th className={`${thCls} w-[55px]`}>Punta</th>
                  <th className={`${thCls} w-[55px]`}>Quilla</th>
                  <th className={`${thCls} w-[55px]`}>Hombro</th>
                  <th className={`${thCls} w-[55px]`}>Mej.1</th>
                  <th className={`${thCls} w-[55px]`}>Mej.2</th>
                  {showColorPulpa && <th className={`${thCls} w-[80px]`}>Color P.</th>}
                  {showColorCoverage && <>
                    <th className={`${thCls} w-[45px]`}>0-30</th>
                    <th className={`${thCls} w-[45px]`}>30-50</th>
                    <th className={`${thCls} w-[45px]`}>50-75</th>
                    <th className={`${thCls} w-[50px]`}>75-100</th>
                  </>}
                  {showColorDist && <>
                    <th className={`${thCls} w-[45px]`}>Verd</th>
                    <th className={`${thCls} w-[45px]`}>Crem</th>
                    <th className={`${thCls} w-[45px]`}>Amar</th>
                    <th className={`${thCls} w-[45px]`}>Full</th>
                  </>}
                  {showPostcosecha && <>
                    <th className={`${thCls} w-[50px]`}>Pard.</th>
                    <th className={`${thCls} w-[50px]`}>Trasl.</th>
                    <th className={`${thCls} w-[50px]`}>Gelif.</th>
                    <th className={`${thCls} w-[50px]`}>Harin.</th>
                  </>}
                  <th className={`${thCls} w-[100px]`}>Obs.</th>
                  <th className={`${thCls} w-[60px] text-center`}>Result.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const res = rowResults.get(ri);
                  const bg = res?.error
                    ? "bg-red-50"
                    : res?.saved
                      ? "bg-emerald-50/60"
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

                  return (
                    <tr key={ri} className={`${bg} border-b border-border/40`}>
                      <td className={`${tdCls} text-center text-[11px] text-muted-foreground font-mono`}>
                        {ri + 1}
                      </td>
                      <td className={`${tdCls} text-xs font-mono font-medium`}>
                        {row.codigo}
                      </td>
                      <td className={`${tdCls} text-xs`}>{row.variedad}</td>
                      <td className={`${tdCls} text-[11px] text-muted-foreground`}>{row.portainjerto}</td>
                      <td className={tdCls}>{mkInput("n_muestra", { step: "1", placeholder: "1" })}</td>
                      <td className={tdCls}>{mkInput("repeticion", { step: "1", placeholder: "1" })}</td>
                      <td className={tdCls}>{mkInput("brix", { placeholder: "18.5" })}</td>
                      <td className={tdCls}>{mkInput("acidez", { step: "0.01", placeholder: "0.65" })}</td>
                      {showPeso && <td className={tdCls}>{mkInput("peso", { placeholder: "75" })}</td>}
                      <td className={tdCls}>{mkInput("perimetro", { placeholder: "90" })}</td>
                      <td className={tdCls}>{mkInput("firmeza_punta")}</td>
                      <td className={tdCls}>{mkInput("firmeza_quilla")}</td>
                      <td className={tdCls}>{mkInput("firmeza_hombro")}</td>
                      <td className={tdCls}>{mkInput("firmeza_mejilla_1")}</td>
                      <td className={tdCls}>{mkInput("firmeza_mejilla_2")}</td>
                      {showColorPulpa && <td className={tdCls}>
                        {(() => {
                          const colI = ci++;
                          const opts = spConfig.colorPulpaOptions || COLOR_PULPA_OPTIONS.map(c => ({ value: c, label: c }));
                          return (
                            <select
                              data-row={ri}
                              data-col={colI}
                              className={`${inpCls} w-[75px]`}
                              value={row.color_pulpa}
                              onChange={(e) => updateRow(ri, "color_pulpa", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, ri, colI)}
                            >
                              <option value="">--</option>
                              {opts.map((c) => (
                                <option key={typeof c === "string" ? c : c.value} value={typeof c === "string" ? c : c.value}>
                                  {typeof c === "string" ? c : c.label}
                                </option>
                              ))}
                            </select>
                          );
                        })()}
                      </td>}
                      {showColorCoverage && <>
                        <td className={tdCls}>{mkInput("color_0_30", { step: "1" })}</td>
                        <td className={tdCls}>{mkInput("color_30_50", { step: "1" })}</td>
                        <td className={tdCls}>{mkInput("color_50_75", { step: "1" })}</td>
                        <td className={tdCls}>{mkInput("color_75_100", { step: "1" })}</td>
                      </>}
                      {showColorDist && <>
                        <td className={tdCls}>{mkInput("color_verde", { step: "1" })}</td>
                        <td className={tdCls}>{mkInput("color_crema", { step: "1" })}</td>
                        <td className={tdCls}>{mkInput("color_amarillo", { step: "1" })}</td>
                        <td className={tdCls}>{mkInput("color_full", { step: "1" })}</td>
                      </>}
                      {showPostcosecha && <>
                        <td className={tdCls}>{mkInput("pardeamiento", { step: "0.1" })}</td>
                        <td className={tdCls}>{mkInput("traslucidez", { step: "0.1" })}</td>
                        <td className={tdCls}>{mkInput("gelificacion", { step: "0.1" })}</td>
                        <td className={tdCls}>{mkInput("harinosidad", { step: "0.1" })}</td>
                      </>}
                      <td className={tdCls}>
                        {(() => {
                          const colI = ci++;
                          return (
                            <input
                              data-row={ri}
                              data-col={colI}
                              type="text"
                              className={`${inpCls} w-[95px]`}
                              value={row.observaciones}
                              onChange={(e) => updateRow(ri, "observaciones", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, ri, colI)}
                            />
                          );
                        })()}
                      </td>
                      <td className={`${tdCls} text-center`}>
                        {res?.saved && res.clasificacion ? (
                          <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${CLUSTER_COLORS[res.clasificacion.cluster] || "bg-gray-100"}`}>
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

          {/* Summary + Submit */}
          {summary && (
            <div className="flex items-center gap-6 rounded-lg border bg-muted/40 px-4 py-2 text-xs">
              <span className="font-medium text-muted-foreground">Promedios:</span>
              {summary.brix != null && (
                <span>Brix <strong className="text-garces-cherry">{summary.brix.toFixed(1)}</strong></span>
              )}
              {summary.acidez != null && (
                <span>Acidez <strong className="text-garces-cherry">{summary.acidez.toFixed(2)}</strong></span>
              )}
              {summary.peso != null && (
                <span>Peso <strong className="text-garces-cherry">{summary.peso.toFixed(1)}g</strong></span>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Mejillas promedio, punto debil y calibre se calculan al guardar.
              Usa <kbd className="bg-muted px-1 rounded text-[10px]">Enter</kbd> para bajar de fila.
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
              {batchMut.isPending ? "Guardando..." : `Guardar ${dataCount} mediciones`}
            </Button>
          </div>

          {/* ── Post-save summary card ── */}
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
                    <span className="text-sm font-normal text-muted-foreground">/{batchSummary.totalEnviadas}</span>
                  </p>
                  {batchSummary.totalErrores > 0 && (
                    <p className="text-[10px] text-red-600 font-medium">{batchSummary.totalErrores} error{batchSummary.totalErrores !== 1 ? "es" : ""}</p>
                  )}
                </div>
                <div className="rounded-lg bg-white border border-emerald-200 p-3 text-center">
                  <p className="text-muted-foreground">% Premium (C1+C2)</p>
                  <p className="text-xl font-bold text-emerald-700">{batchSummary.pctPremium.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg bg-white border border-emerald-200 p-3 text-center">
                  <p className="text-muted-foreground">Brix Prom.</p>
                  <p className="text-xl font-bold text-garces-cherry">{batchSummary.avgBrix != null ? batchSummary.avgBrix.toFixed(1) : "-"}</p>
                </div>
                <div className="rounded-lg bg-white border border-emerald-200 p-3 text-center">
                  <p className="text-muted-foreground">
                    Acidez / Peso
                  </p>
                  <p className="text-xl font-bold text-garces-cherry">
                    {batchSummary.avgAcidez != null ? batchSummary.avgAcidez.toFixed(2) : "-"}
                    <span className="text-sm font-normal text-muted-foreground mx-1">/</span>
                    {batchSummary.avgPeso != null ? `${batchSummary.avgPeso.toFixed(1)}g` : "-"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={() => navigate("/laboratorio/analisis")}
                  className="bg-garces-cherry hover:bg-garces-cherry/90"
                >
                  <BarChart3 className="h-4 w-4 mr-1.5" />
                  Ver Análisis de Calidad
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBatchSummary(null)}
                  className="text-muted-foreground"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
