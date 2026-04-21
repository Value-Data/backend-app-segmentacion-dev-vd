import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EjecucionLabor } from "@/types/laboratorio";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LaborCalendarProps {
  labores: EjecucionLabor[];
  laborNames: Map<number, string>;
  onSelectLabor?: (labor: EjecucionLabor) => void;
}

type EstadoFilter = "todas" | "planificada" | "ejecutada" | "atrasada";

interface WeekBucket {
  weekLabel: string;
  start: Date;
  end: Date;
}

interface CellData {
  total: number;
  ejecutadas: number;
  planificadas: number;
  atrasadas: number;
  labores: EjecucionLabor[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

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

/** Parse "YYYY-MM" to year and month */
function parseYearMonth(ym: string): { year: number; month: number } {
  const [y, m] = ym.split("-").map(Number);
  return { year: y, month: m };
}

/** Format date as YYYY-MM */
function toYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Get the weeks that span a given month */
function getWeeksOfMonth(year: number, month: number): WeekBucket[] {
  const weeks: WeekBucket[] = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0); // last day of month
  const daysInMonth = lastDay.getDate();

  let weekStart = 1;
  let weekIdx = 1;

  while (weekStart <= daysInMonth) {
    const weekEnd = Math.min(weekStart + 6, daysInMonth);
    weeks.push({
      weekLabel: `S${weekIdx} (${weekStart}-${weekEnd})`,
      start: new Date(year, month - 1, weekStart),
      end: new Date(year, month - 1, weekEnd, 23, 59, 59),
    });
    weekStart = weekEnd + 1;
    weekIdx++;
  }

  return weeks;
}

/** Dominant status color for a cell */
function cellColor(cell: CellData): {
  bg: string;
  text: string;
  bar: string;
  hoverBg: string;
} {
  if (cell.atrasadas > 0) {
    return {
      bg: "bg-red-50",
      text: "text-red-700",
      bar: "bg-red-500",
      hoverBg: "hover:bg-red-100",
    };
  }
  if (cell.ejecutadas > 0 && cell.planificadas === 0) {
    return {
      bg: "bg-green-50",
      text: "text-green-700",
      bar: "bg-green-500",
      hoverBg: "hover:bg-green-100",
    };
  }
  if (cell.planificadas > 0) {
    return {
      bg: "bg-amber-50",
      text: "text-amber-700",
      bar: "bg-amber-400",
      hoverBg: "hover:bg-amber-100",
    };
  }
  return {
    bg: "bg-green-50",
    text: "text-green-700",
    bar: "bg-green-500",
    hoverBg: "hover:bg-green-100",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LaborCalendar({ labores, laborNames, onSelectLabor }: LaborCalendarProps) {
  // Current month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => toYearMonth(new Date()));
  const [filterEstado, setFilterEstado] = useState<EstadoFilter>("todas");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [expandedCell, setExpandedCell] = useState<string | null>(null);

  const { year, month } = parseYearMonth(selectedMonth);
  const weeks = useMemo(() => getWeeksOfMonth(year, month), [year, month]);

  // Distinct labor types present
  const tiposPresentes = useMemo(() => {
    const tipos = new Map<number, string>();
    labores.forEach((l) => {
      if (!tipos.has(l.id_labor)) {
        tipos.set(l.id_labor, laborNames.get(l.id_labor) || `Labor #${l.id_labor}`);
      }
    });
    return Array.from(tipos.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [labores, laborNames]);

  // Filter labores by month, estado, and tipo
  const filteredLabores = useMemo(() => {
    return labores.filter((l) => {
      const fecha = l.fecha_programada || l.fecha_ejecucion;
      if (!fecha) return false;
      const d = new Date(fecha);
      if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return false;

      const st = displayStatus(l);
      if (filterEstado !== "todas" && st !== filterEstado) return false;
      if (filterTipo !== "all" && l.id_labor !== Number(filterTipo)) return false;

      return true;
    });
  }, [labores, year, month, filterEstado, filterTipo]);

  // Group by tipo -> week -> cell data
  const gridData = useMemo(() => {
    const tipoMap = new Map<number, Map<number, CellData>>();

    filteredLabores.forEach((l) => {
      const fecha = l.fecha_programada || l.fecha_ejecucion;
      if (!fecha) return;
      const d = new Date(fecha);
      const dayOfMonth = d.getDate();

      // Find which week this day belongs to
      const weekIdx = weeks.findIndex((w) => d >= w.start && d <= w.end);
      if (weekIdx < 0) return;

      if (!tipoMap.has(l.id_labor)) {
        tipoMap.set(l.id_labor, new Map());
      }
      const weekMap = tipoMap.get(l.id_labor)!;
      if (!weekMap.has(weekIdx)) {
        weekMap.set(weekIdx, {
          total: 0,
          ejecutadas: 0,
          planificadas: 0,
          atrasadas: 0,
          labores: [],
        });
      }
      const cell = weekMap.get(weekIdx)!;
      const st = displayStatus(l);
      cell.total++;
      cell.labores.push(l);
      if (st === "ejecutada") cell.ejecutadas++;
      else if (st === "atrasada") cell.atrasadas++;
      else cell.planificadas++;
    });

    return tipoMap;
  }, [filteredLabores, weeks]);

  // Totals per week
  const weekTotals = useMemo(() => {
    const totals: CellData[] = weeks.map(() => ({
      total: 0,
      ejecutadas: 0,
      planificadas: 0,
      atrasadas: 0,
      labores: [],
    }));
    gridData.forEach((weekMap) => {
      weekMap.forEach((cell, weekIdx) => {
        totals[weekIdx].total += cell.total;
        totals[weekIdx].ejecutadas += cell.ejecutadas;
        totals[weekIdx].planificadas += cell.planificadas;
        totals[weekIdx].atrasadas += cell.atrasadas;
      });
    });
    return totals;
  }, [gridData, weeks]);

  // Totals per tipo
  const tipoTotals = useMemo(() => {
    const totals = new Map<number, CellData>();
    gridData.forEach((weekMap, tipoId) => {
      const agg: CellData = { total: 0, ejecutadas: 0, planificadas: 0, atrasadas: 0, labores: [] };
      weekMap.forEach((cell) => {
        agg.total += cell.total;
        agg.ejecutadas += cell.ejecutadas;
        agg.planificadas += cell.planificadas;
        agg.atrasadas += cell.atrasadas;
      });
      totals.set(tipoId, agg);
    });
    return totals;
  }, [gridData]);

  // Grand total
  const grandTotal = useMemo(() => {
    const agg: CellData = { total: 0, ejecutadas: 0, planificadas: 0, atrasadas: 0, labores: [] };
    weekTotals.forEach((wt) => {
      agg.total += wt.total;
      agg.ejecutadas += wt.ejecutadas;
      agg.planificadas += wt.planificadas;
      agg.atrasadas += wt.atrasadas;
    });
    return agg;
  }, [weekTotals]);

  // Month navigation
  const goMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(toYearMonth(d));
    setExpandedCell(null);
  };

  // Sorted tipo rows (only tipos that have data)
  const tipoRows = useMemo(() => {
    return Array.from(gridData.keys()).sort((a, b) => {
      const nameA = laborNames.get(a) || "";
      const nameB = laborNames.get(b) || "";
      return nameA.localeCompare(nameB);
    });
  }, [gridData, laborNames]);

  // Toggle expanded cell
  const toggleCell = (key: string) => {
    setExpandedCell((prev) => (prev === key ? null : key));
  };

  // Max total across all cells (for bar width normalization)
  const maxCellTotal = useMemo(() => {
    let max = 1;
    gridData.forEach((weekMap) => {
      weekMap.forEach((cell) => {
        if (cell.total > max) max = cell.total;
      });
    });
    return max;
  }, [gridData]);

  return (
    <div className="space-y-4">
      {/* --- Filters Row --- */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border p-3 shadow-sm">
        {/* Month navigator */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1.5 min-w-[160px] justify-center">
            <Calendar className="h-4 w-4 text-garces-cherry" />
            <span className="font-semibold text-sm text-garces-cherry">
              {MONTH_NAMES[month - 1]} {year}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-gray-200 hidden sm:block" />

        {/* Estado filter pills */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Estado:</span>
          {(["todas", "planificada", "ejecutada", "atrasada"] as EstadoFilter[]).map((est) => {
            const isActive = filterEstado === est;
            const pillColors: Record<EstadoFilter, string> = {
              todas: isActive ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              planificada: isActive ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100",
              ejecutada: isActive ? "bg-green-600 text-white" : "bg-green-50 text-green-700 hover:bg-green-100",
              atrasada: isActive ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100",
            };
            return (
              <button
                key={est}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${pillColors[est]}`}
                onClick={() => setFilterEstado(est)}
              >
                {est === "todas" ? "Todas" : est.charAt(0).toUpperCase() + est.slice(1) + "s"}
              </button>
            );
          })}
        </div>

        <div className="h-6 w-px bg-gray-200 hidden sm:block" />

        {/* Tipo filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Tipo:</span>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Todos los tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {tiposPresentes.map(([id, name]) => (
                <SelectItem key={id} value={String(id)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* --- Legend --- */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
          Ejecutadas
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
          Planificadas
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500 animate-pulse inline-block" />
          Atrasadas
        </div>
      </div>

      {/* --- Timeline Grid --- */}
      {tipoRows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-white rounded-lg border shadow-sm">
          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="font-medium">Sin labores en {MONTH_NAMES[month - 1]} {year}</p>
          <p className="text-sm">Navega a otro mes o ajusta los filtros.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left text-xs font-semibold text-garces-cherry px-4 py-3 w-[200px] min-w-[180px]">
                  Tipo de Labor
                </th>
                {weeks.map((w, i) => (
                  <th
                    key={i}
                    className="text-center text-xs font-semibold text-gray-600 px-2 py-3 min-w-[100px]"
                  >
                    {w.weekLabel}
                  </th>
                ))}
                <th className="text-center text-xs font-semibold text-garces-cherry px-3 py-3 min-w-[80px] bg-gray-100">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {tipoRows.map((tipoId) => {
                const weekMap = gridData.get(tipoId)!;
                const tipoTotal = tipoTotals.get(tipoId);
                const tipoName = laborNames.get(tipoId) || `Labor #${tipoId}`;

                return (
                  <tr key={tipoId} className="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-800 truncate block max-w-[180px]" title={tipoName}>
                        {tipoName}
                      </span>
                    </td>
                    {weeks.map((_, weekIdx) => {
                      const cell = weekMap.get(weekIdx);
                      const cellKey = `${tipoId}-${weekIdx}`;
                      const isExpanded = expandedCell === cellKey;

                      if (!cell) {
                        return (
                          <td key={weekIdx} className="px-2 py-3 text-center">
                            <span className="text-xs text-gray-300">-</span>
                          </td>
                        );
                      }

                      const colors = cellColor(cell);
                      const barWidth = Math.max(20, Math.round((cell.total / maxCellTotal) * 100));

                      return (
                        <td key={weekIdx} className="px-2 py-3 relative">
                          <button
                            className={`w-full rounded-md p-2 transition-all cursor-pointer ${colors.bg} ${colors.hoverBg} border border-transparent hover:border-gray-200`}
                            onClick={() => toggleCell(cellKey)}
                            title={`${tipoName}: ${cell.total} labores`}
                          >
                            {/* Stacked bar */}
                            <div
                              className="h-2 rounded-full overflow-hidden flex mb-1.5 mx-auto"
                              style={{ width: `${barWidth}%` }}
                            >
                              {cell.ejecutadas > 0 && (
                                <div
                                  className="bg-green-500 h-full"
                                  style={{ width: `${(cell.ejecutadas / cell.total) * 100}%` }}
                                />
                              )}
                              {cell.planificadas > 0 && (
                                <div
                                  className="bg-amber-400 h-full"
                                  style={{ width: `${(cell.planificadas / cell.total) * 100}%` }}
                                />
                              )}
                              {cell.atrasadas > 0 && (
                                <div
                                  className="bg-red-500 h-full animate-pulse"
                                  style={{ width: `${(cell.atrasadas / cell.total) * 100}%` }}
                                />
                              )}
                            </div>
                            {/* Count */}
                            <span className={`text-xs font-bold ${colors.text}`}>
                              {cell.total}
                            </span>
                          </button>

                          {/* Expanded detail dropdown */}
                          {isExpanded && (
                            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg p-3 min-w-[220px] max-h-[240px] overflow-y-auto">
                              <div className="text-xs font-semibold text-garces-cherry mb-2">
                                {tipoName} - {weeks[weekIdx].weekLabel}
                              </div>
                              <div className="flex gap-2 text-[10px] mb-2 text-muted-foreground">
                                <span className="flex items-center gap-0.5">
                                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                  {cell.ejecutadas}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                                  {cell.planificadas}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                                  {cell.atrasadas}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {cell.labores.map((l) => {
                                  const st = displayStatus(l);
                                  const stColor = st === "ejecutada"
                                    ? "text-green-600"
                                    : st === "atrasada"
                                      ? "text-red-600 font-semibold"
                                      : "text-amber-600";
                                  return (
                                    <button
                                      key={l.id_ejecucion}
                                      className="w-full text-left p-1.5 rounded hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectLabor?.(l);
                                      }}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span
                                          className="text-[11px] text-gray-700 truncate"
                                          title={`Posición ${l.id_posicion ?? "sin asignar"}`}
                                        >
                                          Pos. {l.id_posicion ?? "-"}
                                        </span>
                                        <span className={`text-[10px] ${stColor}`} title={st}>
                                          {st}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-muted-foreground">
                                        {l.fecha_programada
                                          ? new Date(l.fecha_programada).toLocaleDateString("es-CL")
                                          : "-"}
                                        {l.ejecutor && ` | ${l.ejecutor}`}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {/* Row total */}
                    <td className="px-3 py-3 text-center bg-gray-50">
                      {tipoTotal && (
                        <div>
                          <span className="text-sm font-bold text-gray-800">{tipoTotal.total}</span>
                          <div className="flex justify-center gap-1.5 mt-1 text-[10px]">
                            {tipoTotal.ejecutadas > 0 && (
                              <span className="text-green-600">{tipoTotal.ejecutadas}</span>
                            )}
                            {tipoTotal.planificadas > 0 && (
                              <span className="text-amber-600">{tipoTotal.planificadas}</span>
                            )}
                            {tipoTotal.atrasadas > 0 && (
                              <span className="text-red-600 font-semibold">{tipoTotal.atrasadas}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* --- Summary Row --- */}
              <tr className="border-t-2 border-garces-cherry/20 bg-gray-50 font-semibold">
                <td className="px-4 py-3">
                  <span className="text-sm text-garces-cherry">Total</span>
                </td>
                {weekTotals.map((wt, i) => {
                  if (wt.total === 0) {
                    return (
                      <td key={i} className="px-2 py-3 text-center">
                        <span className="text-xs text-gray-300">-</span>
                      </td>
                    );
                  }
                  return (
                    <td key={i} className="px-2 py-3 text-center">
                      <span className="text-sm font-bold text-gray-800">{wt.total}</span>
                      <div className="flex justify-center gap-1.5 mt-0.5 text-[10px]">
                        {wt.ejecutadas > 0 && (
                          <span className="text-green-600">{wt.ejecutadas}</span>
                        )}
                        {wt.planificadas > 0 && (
                          <span className="text-amber-600">{wt.planificadas}</span>
                        )}
                        {wt.atrasadas > 0 && (
                          <span className="text-red-600 font-semibold">{wt.atrasadas}</span>
                        )}
                      </div>
                    </td>
                  );
                })}
                {/* Grand total */}
                <td className="px-3 py-3 text-center bg-gray-100">
                  <span className="text-sm font-bold text-garces-cherry">{grandTotal.total}</span>
                  <div className="flex justify-center gap-1.5 mt-0.5 text-[10px]">
                    {grandTotal.ejecutadas > 0 && (
                      <span className="text-green-600">{grandTotal.ejecutadas}</span>
                    )}
                    {grandTotal.planificadas > 0 && (
                      <span className="text-amber-600">{grandTotal.planificadas}</span>
                    )}
                    {grandTotal.atrasadas > 0 && (
                      <span className="text-red-600 font-semibold">{grandTotal.atrasadas}</span>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* --- Summary cards below grid --- */}
      {tipoRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="Total Labores"
            value={grandTotal.total}
            bgClass="bg-white"
            textClass="text-gray-800"
          />
          <SummaryCard
            label="Ejecutadas"
            value={grandTotal.ejecutadas}
            bgClass="bg-green-50"
            textClass="text-green-700"
          />
          <SummaryCard
            label="Planificadas"
            value={grandTotal.planificadas}
            bgClass="bg-amber-50"
            textClass="text-amber-700"
          />
          <SummaryCard
            label="Atrasadas"
            value={grandTotal.atrasadas}
            bgClass={grandTotal.atrasadas > 0 ? "bg-red-50" : "bg-white"}
            textClass={grandTotal.atrasadas > 0 ? "text-red-700" : "text-gray-500"}
            pulse={grandTotal.atrasadas > 0}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Summary Card
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  bgClass,
  textClass,
  pulse,
}: {
  label: string;
  value: number;
  bgClass: string;
  textClass: string;
  pulse?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 shadow-sm ${bgClass}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${textClass} ${pulse ? "animate-pulse" : ""}`}>
        {value}
      </p>
    </div>
  );
}
