/**
 * AnalisisLabPage — Analisis de calidad por especie con ranking, Dialog evolution view,
 * and full individual measurement context (campo, fecha, cluster).
 */

import React, { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Microscope, TrendingUp, TrendingDown, Loader2, Inbox,
  Filter, Award, ThumbsDown, ChevronRight, ChevronDown, ChevronUp,
  FileDown, FileText, ArrowUpDown,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KpiCard } from "@/components/shared/KpiCard";
import { laboratorioService } from "@/services/laboratorio";
import { useLookups } from "@/hooks/useLookups";
import { getSpeciesConfig } from "@/config/speciesFields";
import { formatNumber, cn } from "@/lib/utils";
import type { VariedadResumen, MedicionIndividual } from "@/types/laboratorio";

/* -- Constants ----------------------------------------------------------- */

const CL_HEX: Record<string, string> = { c1: "#10b981", c2: "#0ea5e9", c3: "#f59e0b", c4: "#ef4444" };
const CL_BG: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-800", 2: "bg-sky-100 text-sky-800",
  3: "bg-amber-100 text-amber-800", 4: "bg-red-100 text-red-800",
};
const CL_DOT: Record<number, string> = { 1: "#10b981", 2: "#0ea5e9", 3: "#f59e0b", 4: "#ef4444" };
const ALL = "__all__";

/* -- Shared PDF download helper ------------------------------------------ */

function downloadVariedadPdf(idVariedad: number, variedadName?: string) {
  const url = laboratorioService.reportePdfUrl(idVariedad);
  const token = localStorage.getItem("auth-storage");
  let bearerToken = "";
  try {
    const parsed = JSON.parse(token || "{}");
    bearerToken = parsed?.state?.token || "";
  } catch { /* ignore */ }
  fetch(url, {
    headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {},
  })
    .then((res) => {
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `variedad_${idVariedad}_${variedadName?.replace(/\s+/g, "_") || ""}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    })
    .catch(() => {
      window.open(url, "_blank");
    });
}

/* -- Helpers -------------------------------------------------------------- */

function ClusterBar({ dist }: { dist: VariedadResumen["cluster_dist"] }) {
  const total = dist.c1 + dist.c2 + dist.c3 + dist.c4;
  if (total === 0) return <span className="text-xs text-muted-foreground">-</span>;
  const pct = (v: number) => `${((v / total) * 100).toFixed(0)}%`;
  return (
    <div className="flex h-3.5 w-full rounded-full overflow-hidden bg-muted/30" title={`C1:${dist.c1} C2:${dist.c2} C3:${dist.c3} C4:${dist.c4}`}>
      {dist.c1 > 0 && <div style={{ width: pct(dist.c1), background: CL_HEX.c1 }} />}
      {dist.c2 > 0 && <div style={{ width: pct(dist.c2), background: CL_HEX.c2 }} />}
      {dist.c3 > 0 && <div style={{ width: pct(dist.c3), background: CL_HEX.c3 }} />}
      {dist.c4 > 0 && <div style={{ width: pct(dist.c4), background: CL_HEX.c4 }} />}
    </div>
  );
}

function V({ v, d = 1, s = "" }: { v: number | null; d?: number; s?: string }) {
  if (v == null) return <span className="text-muted-foreground">-</span>;
  return <>{formatNumber(v, d)}{s}</>;
}

/** Score: % of C1+C2 out of total classified */
function qualityScore(r: VariedadResumen): number {
  const total = r.cluster_dist.c1 + r.cluster_dist.c2 + r.cluster_dist.c3 + r.cluster_dist.c4;
  if (total === 0) return 0;
  return ((r.cluster_dist.c1 + r.cluster_dist.c2) / total) * 100;
}

/** Unique key for a resumen row (variedad + portainjerto + campo) */
function rowKey(r: VariedadResumen): string {
  return `${r.id_variedad}-${r.id_portainjerto ?? "x"}-${r.id_campo ?? "x"}`;
}

/* -- Main Component ------------------------------------------------------- */

export function AnalisisLabPage() {
  const lk = useLookups();
  const [temporada, setTemporada] = useState("");
  const [portainjerto, setPortainjerto] = useState("");
  const [pmg, setPmg] = useState("");
  const [campo, setCampo] = useState("");
  const [selectedRow, setSelectedRow] = useState<VariedadResumen | null>(null);

  // Fetch ALL data (no especie filter - we split by tabs)
  const params = useMemo(() => ({
    ...(temporada && temporada !== ALL ? { temporada } : {}),
    ...(portainjerto && portainjerto !== ALL ? { portainjerto: Number(portainjerto) } : {}),
    ...(pmg && pmg !== ALL ? { pmg: Number(pmg) } : {}),
    ...(campo && campo !== ALL ? { campo: Number(campo) } : {}),
  }), [temporada, portainjerto, pmg, campo]);

  const { data: allRows, isLoading } = useQuery({
    queryKey: ["lab-analisis", params],
    queryFn: () => laboratorioService.analisisResumen(params),
  });

  // Group by especie
  const byEspecie = useMemo(() => {
    if (!allRows) return {};
    const map: Record<string, VariedadResumen[]> = {};
    for (const r of allRows) {
      const key = r.especie || "(Sin especie)";
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [allRows]);

  const especieNames = useMemo(() => Object.keys(byEspecie).sort(), [byEspecie]);

  // Global KPIs
  const kpis = useMemo(() => {
    if (!allRows || allRows.length === 0) return null;
    const totalMed = allRows.reduce((s, r) => s + r.total_mediciones, 0);
    const c12 = allRows.reduce((s, r) => s + r.cluster_dist.c1 + r.cluster_dist.c2, 0);
    const c34 = allRows.reduce((s, r) => s + r.cluster_dist.c3 + r.cluster_dist.c4, 0);
    const t = c12 + c34;
    return {
      combinaciones: allRows.length,
      mediciones: totalMed,
      pctBuenas: t > 0 ? ((c12 / t) * 100).toFixed(1) : "0",
      pctMalas: t > 0 ? ((c34 / t) * 100).toFixed(1) : "0",
    };
  }, [allRows]);

  const clearFilters = () => { setTemporada(""); setPortainjerto(""); setPmg(""); setCampo(""); };

  return (
    <div className="space-y-4">
      {/* Header */}
      <h2 className="text-xl font-bold text-garces-cherry flex items-center gap-2">
        <Microscope className="h-5 w-5" />
        Análisis de Laboratorio
      </h2>

      {/* Filters */}
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filtros globales
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Select value={temporada} onValueChange={setTemporada}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Temporada" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {lk.options.temporadas.map((o) => (
                <SelectItem key={o.value} value={o.label}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={portainjerto} onValueChange={setPortainjerto}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Portainjerto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {lk.options.portainjertos.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={pmg} onValueChange={setPmg}>
            <SelectTrigger className="h-9"><SelectValue placeholder="PMG" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {lk.options.pmgs?.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={campo} onValueChange={setCampo}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Campo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {lk.options.campos?.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">Limpiar</Button>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Combinaciones" value={kpis.combinaciones} icon={Microscope} />
          <KpiCard title="Mediciones" value={kpis.mediciones} icon={Microscope} />
          <KpiCard title="% C1+C2" value={`${kpis.pctBuenas}%`} icon={TrendingUp} />
          <KpiCard title="% C3+C4" value={`${kpis.pctMalas}%`} icon={TrendingDown} />
        </div>
      )}

      {/* Loading / Empty */}
      {isLoading && (
        <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-garces-cherry" /></div>
      )}

      {!isLoading && especieNames.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground rounded-lg border bg-card">
          <Inbox className="h-10 w-10 mb-2" /><p>Sin datos</p>
        </div>
      )}

      {/* Tabs by Especie */}
      {!isLoading && especieNames.length > 0 && (
        <Tabs defaultValue={especieNames[0]}>
          <TabsList className="flex-wrap">
            {especieNames.map((esp) => (
              <TabsTrigger key={esp} value={esp} className="gap-1">
                {esp}
                <span className="text-[10px] bg-muted rounded-full px-1.5">{byEspecie[esp].length}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {especieNames.map((esp) => (
            <TabsContent key={esp} value={esp} className="space-y-4 mt-3">
              <EspeciePanel
                especie={esp}
                rows={byEspecie[esp]}
                onSelect={setSelectedRow}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Cluster legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        {(["c1", "c2", "c3", "c4"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CL_HEX[k] }} />
            {k === "c1" ? "C1 Premium" : k === "c2" ? "C2 Buena" : k === "c3" ? "C3 Regular" : "C4 Deficiente"}
          </span>
        ))}
      </div>

      {/* Evolution Dialog */}
      {selectedRow && (
        <EvolucionDialog row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </div>
  );
}

/* -- Especie Panel: ranking + table --------------------------------------- */

function EspeciePanel({
  especie,
  rows,
  onSelect,
}: {
  especie: string;
  rows: VariedadResumen[];
  onSelect: (r: VariedadResumen) => void;
}) {
  // Sort by quality score
  const sorted = useMemo(() => [...rows].sort((a, b) => qualityScore(b) - qualityScore(a)), [rows]);
  const top5 = sorted.slice(0, 5);
  const bottom5 = [...sorted].reverse().slice(0, 5);

  // Especie-level KPIs
  const totalMed = rows.reduce((s, r) => s + r.total_mediciones, 0);
  const c12 = rows.reduce((s, r) => s + r.cluster_dist.c1 + r.cluster_dist.c2, 0);
  const c34 = rows.reduce((s, r) => s + r.cluster_dist.c3 + r.cluster_dist.c4, 0);
  const t = c12 + c34;
  const avgBrix = rows.filter(r => r.brix_avg != null).reduce((s, r) => s + (r.brix_avg ?? 0) * r.total_mediciones, 0) / (totalMed || 1);

  const spConfig = getSpeciesConfig(especie);

  return (
    <div className="space-y-4">
      {/* Species clustering hint */}
      <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800">
        <Microscope className="h-4 w-4 shrink-0 text-sky-500" />
        <span className="font-medium">{especie}:</span>
        <span>{spConfig.ruleHint}</span>
      </div>

      {/* Especie stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-muted-foreground">Variedades</p>
          <p className="text-lg font-bold">{rows.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-muted-foreground">Mediciones</p>
          <p className="text-lg font-bold">{totalMed.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-muted-foreground">Brix promedio</p>
          <p className="text-lg font-bold text-garces-cherry">{avgBrix.toFixed(1)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-muted-foreground">% Premium (C1+C2)</p>
          <p className="text-lg font-bold text-emerald-600">{t > 0 ? ((c12 / t) * 100).toFixed(1) : 0}%</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-muted-foreground">% Deficiente (C3+C4)</p>
          <p className="text-lg font-bold text-red-600">{t > 0 ? ((c34 / t) * 100).toFixed(1) : 0}%</p>
        </div>
      </div>

      {/* Rankings side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RankingCard title="Top 5 Mejores" icon={Award} items={top5} colorClass="text-emerald-600" onSelect={onSelect} />
        <RankingCard title="Top 5 Peores" icon={ThumbsDown} items={bottom5} colorClass="text-red-600" onSelect={onSelect} reverse />
      </div>

      {/* Full table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[1050px]">
          <thead>
            <tr className="bg-garces-cherry/90 text-white text-[11px]">
              <th className="px-3 py-2 text-left">Variedad</th>
              <th className="px-2 py-2 text-left">PI</th>
              <th className="px-2 py-2 text-left">PMG</th>
              <th className="px-2 py-2 text-left">Campo</th>
              <th className="px-2 py-2 text-right">Meds</th>
              <th className="px-2 py-2 text-right">Temp.</th>
              <th className="px-2 py-2 text-right">Brix</th>
              <th className="px-2 py-2 text-right">Firmeza</th>
              <th className="px-2 py-2 text-right">Acidez</th>
              <th className="px-2 py-2 text-right">Peso</th>
              <th className="px-2 py-2 text-right">%C1+C2</th>
              <th className="px-3 py-2 text-center w-[140px]">Clusters</th>
              <th className="px-2 py-2 text-center">C</th>
              <th className="px-1 py-2 text-center w-[32px]">PDF</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const score = qualityScore(r);
              return (
                <tr
                  key={rowKey(r)}
                  className={cn(
                    "border-b border-border/40 cursor-pointer transition-colors hover:bg-garces-cherry/5",
                    i % 2 === 0 ? "bg-background" : "bg-muted/20",
                  )}
                  onClick={() => onSelect(r)}
                >
                  <td className="px-3 py-1.5 font-medium">{r.variedad}</td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">{r.portainjerto}</td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">{r.pmg}</td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">{r.campo}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs">{r.total_mediciones}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs">{r.n_temporadas}</td>
                  <td className="px-2 py-1.5 text-right">
                    <V v={r.brix_avg} />
                    {r.brix_min != null && <span className="text-[9px] text-muted-foreground ml-0.5">({r.brix_min}-{r.brix_max})</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right"><V v={r.firmeza_avg} /></td>
                  <td className="px-2 py-1.5 text-right"><V v={r.acidez_avg} d={2} /></td>
                  <td className="px-2 py-1.5 text-right"><V v={r.peso_avg} s="g" /></td>
                  <td className="px-2 py-1.5 text-right">
                    <span className={cn("font-semibold text-xs", score >= 50 ? "text-emerald-600" : "text-red-600")}>
                      {score.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-1.5"><ClusterBar dist={r.cluster_dist} /></td>
                  <td className="px-2 py-1.5 text-center">
                    {r.cluster_predominante && (
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", CL_BG[r.cluster_predominante])}>
                        C{r.cluster_predominante}
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadVariedadPdf(r.id_variedad, r.variedad);
                      }}
                      className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-garces-cherry/10 text-muted-foreground hover:text-garces-cherry transition-colors"
                      title="Descargar PDF"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Link to full reports */}
      <div className="flex justify-end">
        <Link
          to="/reportes"
          className="inline-flex items-center gap-1.5 text-sm text-garces-cherry hover:text-garces-cherry/80 font-medium hover:underline"
        >
          <FileText className="h-3.5 w-3.5" />
          Ver Reporte Completo
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

/* -- Ranking Card --------------------------------------------------------- */

function RankingCard({
  title,
  icon: Icon,
  items,
  colorClass,
  onSelect,
  reverse,
}: {
  title: string;
  icon: React.ElementType;
  items: VariedadResumen[];
  colorClass: string;
  onSelect: (r: VariedadResumen) => void;
  reverse?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className={cn("flex items-center gap-2 px-4 py-2.5 border-b text-sm font-semibold", colorClass)}>
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="divide-y divide-border/40">
        {items.map((r, i) => {
          const score = qualityScore(r);
          return (
            <div
              key={rowKey(r)}
              className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => onSelect(r)}
            >
              <span className={cn("flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold",
                reverse
                  ? "bg-red-100 text-red-700"
                  : i === 0 ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"
              )}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.variedad}</p>
                <p className="text-[10px] text-muted-foreground truncate">{r.portainjerto} | {r.pmg}{r.campo !== "-" ? ` | ${r.campo}` : ""}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={cn("text-sm font-bold", score >= 50 ? "text-emerald-600" : "text-red-600")}>
                  {score.toFixed(0)}%
                </p>
                <p className="text-[10px] text-muted-foreground">{r.total_mediciones} meds</p>
              </div>
              <div className="w-16 shrink-0">
                <ClusterBar dist={r.cluster_dist} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -- Evolution Dialog ------------------------------------------------------ */

function EvolucionDialog({
  row,
  onClose,
}: {
  row: VariedadResumen;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["lab-evolucion", row.id_variedad, row.id_portainjerto, row.id_campo],
    queryFn: () => laboratorioService.analisisEvolucion(
      row.id_variedad,
      row.id_portainjerto ?? undefined,
      row.id_campo ?? undefined,
    ),
  });

  const [sortField, setSortField] = useState<keyof MedicionIndividual>("fecha");
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = useCallback((field: keyof MedicionIndividual) => {
    setSortAsc((prev) => (sortField === field ? !prev : true));
    setSortField(field);
  }, [sortField]);

  const sortedMediciones = useMemo(() => {
    if (!data?.por_fecha) return [];
    return [...data.por_fecha].sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      if (va == null && vb == null) return 0;
      if (va == null) return sortAsc ? 1 : -1;
      if (vb == null) return sortAsc ? -1 : 1;
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [data?.por_fecha, sortField, sortAsc]);

  const handleDownloadPdf = () => downloadVariedadPdf(row.id_variedad, row.variedad);

  const score = qualityScore(row);

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-garces-cherry">
            <Microscope className="h-5 w-5" />
            Evolucion — {row.variedad}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">

          {/* Section A: Context badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-garces-cherry/10 text-garces-cherry px-3 py-1 text-xs font-semibold">
              {row.variedad}
            </span>
            <span className="rounded-full bg-garces-cherry/5 text-garces-cherry/80 px-3 py-1 text-xs">
              {row.especie}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs">PI: {row.portainjerto}</span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs">PMG: {row.pmg}</span>
            {row.campo !== "-" && (
              <span className="rounded-full bg-muted px-3 py-1 text-xs">Campo: {row.campo}</span>
            )}
            <span className="rounded-full bg-muted px-3 py-1 text-xs">{row.total_mediciones} mediciones</span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs">{row.n_temporadas} temporadas</span>
            {row.cluster_predominante && (
              <span className={cn("rounded-full px-3 py-1 text-xs font-bold", CL_BG[row.cluster_predominante])}>
                Cluster predominante: C{row.cluster_predominante}
              </span>
            )}
          </div>

          {/* Section B: Metrics summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Brix</p>
              <p className="text-xl font-bold text-garces-cherry">
                {row.brix_avg != null ? formatNumber(row.brix_avg, 1) : "-"}
              </p>
              {row.brix_min != null && (
                <p className="text-[10px] text-muted-foreground">Rango: {row.brix_min} - {row.brix_max}</p>
              )}
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Firmeza</p>
              <p className="text-xl font-bold text-garces-cherry">
                {row.firmeza_avg != null ? formatNumber(row.firmeza_avg, 1) : "-"}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Acidez</p>
              <p className="text-xl font-bold text-garces-cherry">
                {row.acidez_avg != null ? formatNumber(row.acidez_avg, 2) : "-"}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">% Premium (C1+C2)</p>
              <p className={cn("text-xl font-bold", score >= 50 ? "text-emerald-600" : "text-red-600")}>
                {score.toFixed(0)}%
              </p>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin text-garces-cherry mr-2" /> Cargando evolucion...
            </div>
          )}

          {/* Section C: Evolution by season (charts) */}
          {data && data.por_temporada.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-garces-cherry">Evolucion por temporada</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Line chart: metrics by temporada */}
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Metricas por temporada</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={data.por_temporada}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="temporada" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="brix_avg" name="Brix" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="firmeza_avg" name="Firmeza" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="acidez_avg" name="Acidez" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Stacked bar: clusters by temporada */}
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Clusters por temporada</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.por_temporada}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="temporada" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="cluster_dist.c1" name="C1" stackId="cl" fill={CL_HEX.c1} />
                      <Bar dataKey="cluster_dist.c2" name="C2" stackId="cl" fill={CL_HEX.c2} />
                      <Bar dataKey="cluster_dist.c3" name="C3" stackId="cl" fill={CL_HEX.c3} />
                      <Bar dataKey="cluster_dist.c4" name="C4" stackId="cl" fill={CL_HEX.c4} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Scatter: brix by date colored by cluster */}
          {data && data.por_fecha.length > 0 && (
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Brix por fecha (color = cluster)</p>
              <ResponsiveContainer width="100%" height={200}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 9 }} />
                  <YAxis dataKey="brix" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const d = payload[0].payload as MedicionIndividual;
                      return (
                        <div className="bg-white border rounded shadow-md p-2 text-xs space-y-0.5">
                          <p className="font-semibold">{d.fecha} ({d.temporada})</p>
                          <p>Brix: <strong>{d.brix}</strong> | Firmeza: {d.firmeza} | Acidez: {d.acidez}</p>
                          <p>Peso: {d.peso}g | Muestra #{d.n_muestra}</p>
                          {d.campo && d.campo !== "-" && <p>Campo: {d.campo}</p>}
                          {d.cluster && <p className="font-bold">Cluster C{d.cluster}</p>}
                        </div>
                      );
                    }}
                  />
                  <Scatter data={data.por_fecha.filter((d) => d.brix != null)} name="Brix">
                    {data.por_fecha.filter((d) => d.brix != null).map((d, i) => (
                      <Cell key={i} fill={CL_DOT[d.cluster ?? 3] || "#999"} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}

          {data && data.por_temporada.length === 0 && !isLoading && (
            <p className="text-center text-muted-foreground py-4">Sin datos de evolucion</p>
          )}

          {/* Section D: Individual measurements table */}
          {data && data.por_fecha.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-garces-cherry">
                Mediciones individuales ({data.por_fecha.length})
              </h4>
              <div className="rounded-lg border bg-card overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs border-collapse min-w-[900px]">
                  <thead className="bg-muted/60 sticky top-0 z-10">
                    <tr>
                      <SortTh field="fecha" current={sortField} asc={sortAsc} onSort={handleSort}>Fecha Eval</SortTh>
                      <SortTh field="temporada" current={sortField} asc={sortAsc} onSort={handleSort}>Temporada</SortTh>
                      <SortTh field="campo" current={sortField} asc={sortAsc} onSort={handleSort}>Campo</SortTh>
                      <SortTh field="n_muestra" current={sortField} asc={sortAsc} onSort={handleSort} align="right">Muestra</SortTh>
                      <SortTh field="brix" current={sortField} asc={sortAsc} onSort={handleSort} align="right">Brix</SortTh>
                      <SortTh field="firmeza" current={sortField} asc={sortAsc} onSort={handleSort} align="right">Firmeza</SortTh>
                      <SortTh field="acidez" current={sortField} asc={sortAsc} onSort={handleSort} align="right">Acidez</SortTh>
                      <SortTh field="peso" current={sortField} asc={sortAsc} onSort={handleSort} align="right">Peso</SortTh>
                      <SortTh field="calibre" current={sortField} asc={sortAsc} onSort={handleSort} align="right">Calibre</SortTh>
                      <SortTh field="cluster" current={sortField} asc={sortAsc} onSort={handleSort} align="center">Cluster</SortTh>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMediciones.map((d, i) => (
                      <tr key={d.id} className={cn(
                        "border-b border-border/30 hover:bg-muted/20",
                        i % 2 === 0 ? "bg-background" : "bg-muted/10",
                      )}>
                        <td className="px-2.5 py-1.5 font-mono whitespace-nowrap">{d.fecha || "-"}</td>
                        <td className="px-2.5 py-1.5">{d.temporada}</td>
                        <td className="px-2.5 py-1.5 text-muted-foreground">{d.campo || "-"}</td>
                        <td className="px-2.5 py-1.5 text-right">{d.n_muestra ?? "-"}</td>
                        <td className="px-2.5 py-1.5 text-right font-medium">{d.brix ?? "-"}</td>
                        <td className="px-2.5 py-1.5 text-right">{d.firmeza ?? "-"}</td>
                        <td className="px-2.5 py-1.5 text-right">{d.acidez ?? "-"}</td>
                        <td className="px-2.5 py-1.5 text-right">{d.peso != null ? `${d.peso}g` : "-"}</td>
                        <td className="px-2.5 py-1.5 text-right">{d.calibre ?? "-"}</td>
                        <td className="px-2.5 py-1.5 text-center">
                          {d.cluster ? (
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", CL_BG[d.cluster])}>
                              C{d.cluster}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section E: Actions */}
          <div className="flex items-center justify-end pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              className="gap-1.5"
            >
              <FileDown className="h-4 w-4" />
              Descargar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -- Sortable table header cell ------------------------------------------- */

function SortTh({
  field,
  current,
  asc,
  onSort,
  align = "left",
  children,
}: {
  field: keyof MedicionIndividual;
  current: keyof MedicionIndividual;
  asc: boolean;
  onSort: (f: keyof MedicionIndividual) => void;
  align?: "left" | "right" | "center";
  children: React.ReactNode;
}) {
  const active = current === field;
  return (
    <th
      className={cn(
        "px-2.5 py-2 cursor-pointer select-none hover:bg-muted/80 transition-colors whitespace-nowrap",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
      )}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        {active ? (
          asc
            ? <ChevronUp className="h-3 w-3 text-garces-cherry" />
            : <ChevronDown className="h-3 w-3 text-garces-cherry" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
        )}
      </span>
    </th>
  );
}
