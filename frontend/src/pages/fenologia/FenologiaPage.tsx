import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Flower2, Calendar, ArrowRight, Leaf, Snowflake, Sun, Droplets, Cherry,
  Camera, CircleDot, Grape, Apple, Settings2, Plus, GitCompare, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Download, Database, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useLookups } from "@/hooks/useLookups";
import { useTestblocks } from "@/hooks/useTestblock";
import { laboresService } from "@/services/labores";
import type { EstadoFenologico } from "@/services/labores";
import { formatDate } from "@/lib/utils";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Pick an icon based on estado name — extended for new states */
function iconForEstado(nombre: string) {
  const n = nombre.toLowerCase();
  if (n.includes("foto")) return Camera;
  if (n.includes("hoja") || n.includes("verde") || n.includes("crecim")) return Leaf;
  if (n.includes("yema") && (n.includes("dorm") || n.includes("invierno"))) return Snowflake;
  if (n.includes("yema")) return Droplets;
  if (n.includes("flor") || n.includes("petal") || n.includes("boton")) return Flower2;
  if (n.includes("chaqueta")) return CircleDot;
  if (n.includes("cuaja") || n.includes("fruto") || n.includes("arvejado") || n.includes("8mm")) return Grape;
  if (n.includes("cosecha") || n.includes("madur") || n.includes("pre cos")) return Cherry;
  if (n.includes("pinta") || n.includes("envero") || n.includes("viraje") || n.includes("pajizo") || n.includes("color")) return Sun;
  if (n.includes("carozo") || n.includes("endurecim")) return Apple;
  return Leaf;
}

export function FenologiaPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lk = useLookups();
  const { data: testblocks } = useTestblocks();

  const especiesRaw = (lk.rawData.especies || []) as { id_especie: number; nombre: string; color_hex?: string }[];
  const [selectedEspecieId, setSelectedEspecieId] = useState<number | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regEstadoId, setRegEstadoId] = useState<number | null>(null);
  const [regTbId, setRegTbId] = useState<string>("");
  const [regPorcentaje, setRegPorcentaje] = useState("");
  const [regObs, setRegObs] = useState("");
  const [selectedHistTbId, setSelectedHistTbId] = useState<number | null>(null);

  // Comparative view state
  const [compTemporadaActual, setCompTemporadaActual] = useState("2025-2026");
  const [compTemporadaAnterior, setCompTemporadaAnterior] = useState("2024-2025");
  const [compVariedadId, setCompVariedadId] = useState<string>("");
  const [compTbId, setCompTbId] = useState<string>("");

  const { data: comparativa } = useQuery({
    queryKey: ["fenologia-comparativa", compTemporadaActual, compTemporadaAnterior, selectedEspecieId, compVariedadId, compTbId],
    queryFn: () => {
      const params: Record<string, string | number> = {
        temporada_actual: compTemporadaActual,
        temporada_anterior: compTemporadaAnterior,
      };
      if (selectedEspecieId) params.id_especie = selectedEspecieId;
      if (compVariedadId) params.id_variedad = Number(compVariedadId);
      if (compTbId) params.id_testblock = Number(compTbId);
      return laboresService.fenologiaComparativa(params);
    },
    enabled: !!compTemporadaActual && !!compTemporadaAnterior,
  });

  // Fetch all estados fenologicos
  const { data: allEstados } = useQuery({
    queryKey: ["estados-fenologicos"],
    queryFn: () => laboresService.estadosFenologicos(),
    staleTime: 5 * 60_000,
  });

  // Filter estados for selected species
  const estadosEspecie = useMemo(() => {
    if (!allEstados || !selectedEspecieId) return [];
    return (allEstados as EstadoFenologico[])
      .filter((e) => e.id_especie === selectedEspecieId && e.activo !== false)
      .sort((a, b) => a.orden - b.orden);
  }, [allEstados, selectedEspecieId]);

  const selectedEspecieName = selectedEspecieId
    ? especiesRaw.find((e) => e.id_especie === selectedEspecieId)?.nombre ?? ""
    : "";

  // Historial: use selected testblock or first
  const histTbId = selectedHistTbId ?? testblocks?.[0]?.id_testblock ?? null;
  const { data: historial } = useQuery({
    queryKey: ["historial-fenologico", histTbId],
    queryFn: () => laboresService.historialFenologico(histTbId!),
    enabled: !!histTbId,
  });

  // Registration mutation
  const registerMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => laboresService.registroFenologico(data),
    onSuccess: (res) => {
      toast.success(`Registro fenologico creado (${res.created} posiciones)`);
      queryClient.invalidateQueries({ queryKey: ["historial-fenologico"] });
      setRegisterOpen(false);
      setRegEstadoId(null);
      setRegPorcentaje("");
      setRegObs("");
    },
  });

  // Seed demo data mutation
  const seedDemoMut = useMutation({
    mutationFn: () => laboresService.seedFenologiaDemo(),
    onSuccess: (res) => {
      toast.success(res.message || `Se crearon ${res.created} registros demo`);
      queryClient.invalidateQueries({ queryKey: ["fenologia-comparativa"] });
      queryClient.invalidateQueries({ queryKey: ["historial-fenologico"] });
    },
    onError: () => {
      toast.error("Error al crear datos demo (requiere rol admin)");
    },
  });

  // Export handler
  const handleExportExcel = async () => {
    try {
      const params: Record<string, string | number> = {
        temporada_actual: compTemporadaActual,
        temporada_anterior: compTemporadaAnterior,
      };
      if (selectedEspecieId) params.id_especie = selectedEspecieId;
      if (compVariedadId) params.id_variedad = Number(compVariedadId);
      if (compTbId) params.id_testblock = Number(compTbId);
      await laboresService.exportFenologiaComparativa(params);
      toast.success("Excel descargado");
    } catch {
      toast.error("Error al exportar Excel");
    }
  };

  // Compute upcoming estados predictions from comparativa data
  const predicciones = useMemo(() => {
    if (!comparativa || !(comparativa as any).variedades?.length) return [];
    const today = new Date();
    const preds: Array<{
      variedad: string;
      estado: string;
      color_hex: string;
      fecha_anterior: string;
      dias_estimados: number;
    }> = [];

    for (const varData of (comparativa as any).variedades as any[]) {
      for (const est of varData.estados as any[]) {
        // Upcoming = has date in anterior season but NOT in actual season
        if (!est.fecha_actual && est.fecha_anterior) {
          const anteriorDate = new Date(est.fecha_anterior);
          // Estimate: same date but +1 year (approximately)
          const estimatedDate = new Date(anteriorDate);
          estimatedDate.setFullYear(estimatedDate.getFullYear() + 1);
          const diffMs = estimatedDate.getTime() - today.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          // Only show future predictions (within next 180 days)
          if (diffDays > 0 && diffDays <= 180) {
            preds.push({
              variedad: varData.variedad?.nombre || `#${varData.id_variedad}`,
              estado: est.estado?.nombre || "-",
              color_hex: est.estado?.color_hex || "#8B5CF6",
              fecha_anterior: est.fecha_anterior,
              dias_estimados: diffDays,
            });
          }
        }
      }
    }
    // Sort by soonest first
    preds.sort((a, b) => a.dias_estimados - b.dias_estimados);
    return preds;
  }, [comparativa]);

  const handleRegister = async () => {
    if (!regEstadoId || !regTbId) return;
    try {
      // Fetch positions for the selected testblock
      const { get: apiGet } = await import("@/services/api");
      const positions = await apiGet<{ id_posicion: number; estado?: string }[]>(
        `/testblocks/${regTbId}/posiciones`
      );
      const posIds = (positions || [])
        .filter((p: any) => p.estado === "alta")
        .map((p: any) => p.id_posicion);
      if (posIds.length === 0) {
        toast.error("No hay posiciones activas en este testblock");
        return;
      }
      // Compute temporada dynamically based on current date
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-indexed
      const temporada = month >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      registerMut.mutate({
        id_estado_fenol: regEstadoId,
        posiciones_ids: posIds,
        porcentaje: regPorcentaje ? Number(regPorcentaje) : null,
        fecha: now.toISOString().split("T")[0],
        observaciones: regObs,
        temporada,
      });
    } catch (err) {
      toast.error("Error al registrar estado fenologico");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-garces-cherry">Fenologia</h2>
          <p className="text-sm text-muted-foreground">
            Estados fenologicos integrados con el flujo de labores
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/catalogos/estados-fenologicos")}>
            <Settings2 className="h-4 w-4 mr-1" /> Mantenedor
          </Button>
          <Button size="sm" onClick={() => navigate("/labores")}>
            <Calendar className="h-4 w-4 mr-1" /> Ir a Labores
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <p className="text-sm text-purple-800">
          <strong>Los estados fenologicos se registran como parte del flujo de labores.</strong> En la seccion
          Labores → tab "Pauta por Especie" puedes planificar y registrar hitos fenologicos junto con las labores
          agronomicas. Aqui puedes ver la referencia y el historial.
        </p>
      </div>

      {/* Especie selector — driven by API data */}
      <div className="flex gap-2 flex-wrap">
        {especiesRaw.map((esp) => {
          const isSelected = selectedEspecieId === esp.id_especie;
          const count = ((allEstados || []) as EstadoFenologico[]).filter(
            (e) => e.id_especie === esp.id_especie && e.activo !== false
          ).length;
          return (
            <button
              key={esp.id_especie}
              onClick={() => setSelectedEspecieId(isSelected ? null : esp.id_especie)}
              className={`px-4 py-2 rounded-full text-xs font-semibold border-2 transition-colors flex items-center gap-2 ${
                isSelected
                  ? "border-garces-cherry bg-garces-cherry/10 text-garces-cherry"
                  : "border-gray-200 bg-white text-muted-foreground hover:bg-muted"
              }`}
            >
              {esp.color_hex && (
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: esp.color_hex }} />
              )}
              {esp.nombre}
              {count > 0 && <span className="text-[10px] opacity-60">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Pauta visual timeline — from API */}
      {selectedEspecieId && estadosEspecie.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="px-5 py-3 border-b bg-muted/30">
            <h3 className="font-semibold text-sm">Ciclo Fenologico: {selectedEspecieName}</h3>
            <p className="text-xs text-muted-foreground">
              {estadosEspecie.length} estados fenologicos registrados
            </p>
          </div>

          {/* Timeline bar */}
          <div className="px-5 py-4">
            <div className="flex justify-between mb-2">
              {MESES.map((m) => (
                <div key={m} className="text-[10px] text-muted-foreground font-medium w-[calc(100%/12)] text-center">
                  {m}
                </div>
              ))}
            </div>
            <div className="relative h-2 bg-gray-100 rounded-full mb-6" />
          </div>

          {/* Estado items */}
          <div className="divide-y">
            {estadosEspecie.map((estado) => {
              const Icon = iconForEstado(estado.nombre);
              const color = estado.color_hex || "#6B7280";
              return (
                <div key={estado.id_estado} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors group">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: color + "18" }}
                  >
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium">{estado.nombre}</span>
                    {estado.descripcion && (
                      <p className="text-xs text-muted-foreground">{estado.descripcion}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {estado.mes_orientativo || "-"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setRegEstadoId(estado.id_estado);
                      setRegisterOpen(true);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Registrar
                  </Button>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedEspecieId && estadosEspecie.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-amber-800">
            Sin estados fenologicos configurados para {selectedEspecieName}
          </p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            No hay estados fenologicos registrados para esta especie.
            Un administrador puede configurarlos desde el Mantenedor o ejecutando el seed de datos demo.
          </p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" variant="outline" onClick={() => navigate("/catalogos/estados-fenologicos")}>
              <Settings2 className="h-4 w-4 mr-1" /> Ir al Mantenedor
            </Button>
            <Button
              size="sm"
              variant="default"
              disabled={seedDemoMut.isPending}
              onClick={() => seedDemoMut.mutate()}
            >
              <Database className="h-4 w-4 mr-1" />
              {seedDemoMut.isPending ? "Creando..." : "Ejecutar Seed"}
            </Button>
          </div>
        </div>
      )}

      {!selectedEspecieId && (
        <div className="bg-white rounded-lg border p-8 text-center">
          <Flower2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-semibold">Selecciona una especie para ver su ciclo fenologico</p>
        </div>
      )}

      {/* Registros fenologicos recientes */}
      <div className="bg-white rounded-lg border">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">Registros Fenologicos Recientes</h3>
          <div className="flex gap-2 items-center">
            <select
              className="rounded-md border text-xs px-2 py-1.5"
              value={selectedHistTbId ?? ""}
              onChange={(e) => setSelectedHistTbId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">TestBlock...</option>
              {(testblocks || []).map((tb: any) => (
                <option key={tb.id_testblock} value={tb.id_testblock}>{tb.nombre || tb.codigo}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={() => navigate("/labores")}>
              Ir a Labores
            </Button>
          </div>
        </div>
        {!historial || historial.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No hay registros fenologicos aun. Los hitos fenologicos se registran desde el modulo de Labores.
            </p>
            <Button variant="link" size="sm" className="mt-2 text-garces-cherry" onClick={() => navigate("/labores")}>
              Ir a Labores para registrar
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {historial.slice(0, 10).map((r, i) => (
              <div key={r.id_registro ?? i} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: r.estado?.color_hex || "#8B5CF6" }}
                  />
                  <div>
                    <span className="font-medium">{r.estado?.nombre || `Registro #${r.id_registro}`}</span>
                    <span className="text-muted-foreground ml-2">Pos #{r.id_posicion}</span>
                    {r.porcentaje != null && (
                      <span className="text-muted-foreground ml-2">{r.porcentaje}%</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{r.temporada}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(r.fecha_registro)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Comparativa por Temporada */}
      <div className="bg-white border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold">Comparativa por Temporada</h3>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={seedDemoMut.isPending}
              onClick={() => seedDemoMut.mutate()}
            >
              <Database className="h-4 w-4 mr-1" />
              {seedDemoMut.isPending ? "Creando..." : "Seed Demo"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportExcel}
              disabled={!comparativa || !(comparativa as any).variedades?.length}
            >
              <Download className="h-4 w-4 mr-1" /> Exportar Excel
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Compara las fechas reales de cada estado fenologico entre dos temporadas para anticipar labores.
        </p>

        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Temporada actual</label>
            <Select value={compTemporadaActual} onValueChange={setCompTemporadaActual}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["2025-2026", "2024-2025", "2023-2024"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">vs Temporada anterior</label>
            <Select value={compTemporadaAnterior} onValueChange={setCompTemporadaAnterior}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["2024-2025", "2023-2024", "2022-2023"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">TestBlock</label>
            <Select value={compTbId || "__all__"} onValueChange={(v) => setCompTbId(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {(testblocks || []).map((tb: any) => (
                  <SelectItem key={tb.id_testblock} value={String(tb.id_testblock)}>{tb.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Proximos estados esperados — predictions */}
        {predicciones.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-blue-800">Proximos estados esperados</h4>
            </div>
            <div className="space-y-1.5">
              {predicciones.slice(0, 8).map((pred, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: pred.color_hex }}
                  />
                  <span className="font-medium text-blue-900">{pred.estado}</span>
                  <span className="text-blue-600">({pred.variedad})</span>
                  <span className="text-blue-700 ml-auto">
                    esperado en ~{pred.dias_estimados} dias
                  </span>
                  <span className="text-blue-400 text-[10px]">
                    (ant: {formatDate(pred.fecha_anterior)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {comparativa && (comparativa as any).variedades?.length > 0 ? (
          <div className="space-y-4">
            {((comparativa as any).variedades as any[]).map((varData: any) => {
              // Compute timeline date range for this variedad (Jul year_start to Jun year_end)
              const yearStart = parseInt(compTemporadaAnterior.split("-")[0]);
              const seasonStart = new Date(yearStart, 6, 1); // Jul 1
              const seasonEnd = new Date(yearStart + 2, 5, 30); // Jun 30 (+2 years to cover both seasons)
              const totalDays = (seasonEnd.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24);

              const getBarPos = (dateStr: string | null) => {
                if (!dateStr) return null;
                const d = new Date(dateStr);
                const offset = (d.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24);
                return Math.max(0, Math.min(100, (offset / totalDays) * 100));
              };

              return (
                <div key={varData.id_variedad} className="border rounded-lg p-3">
                  <h4 className="text-sm font-semibold mb-2">
                    {varData.variedad?.nombre}{" "}
                    <span className="text-muted-foreground font-mono text-xs">
                      ({varData.variedad?.codigo})
                    </span>
                  </h4>

                  {/* Visual timeline bars */}
                  <div className="mb-3 space-y-1">
                    {/* Month labels */}
                    <div className="flex text-[9px] text-muted-foreground ml-[80px]">
                      {MESES.concat(MESES).map((m, i) => (
                        <div key={`${m}-${i}`} className="flex-1 text-center">
                          {i % 3 === 0 ? m : ""}
                        </div>
                      ))}
                    </div>
                    {/* Actual season bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-[80px] text-right truncate">
                        {compTemporadaActual}
                      </span>
                      <div className="flex-1 h-5 bg-gray-100 rounded relative">
                        {(varData.estados as any[]).map((est: any, i: number) => {
                          const pos = getBarPos(est.fecha_actual);
                          if (pos === null) return null;
                          return (
                            <div
                              key={`act-${i}`}
                              className="absolute top-0 h-full rounded"
                              style={{
                                left: `${pos}%`,
                                width: "8px",
                                backgroundColor: est.estado?.color_hex || "#8B5CF6",
                                opacity: 0.9,
                              }}
                              title={`${est.estado?.nombre}: ${est.fecha_actual}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                    {/* Anterior season bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-[80px] text-right truncate">
                        {compTemporadaAnterior}
                      </span>
                      <div className="flex-1 h-5 bg-gray-100 rounded relative">
                        {(varData.estados as any[]).map((est: any, i: number) => {
                          const pos = getBarPos(est.fecha_anterior);
                          if (pos === null) return null;
                          return (
                            <div
                              key={`ant-${i}`}
                              className="absolute top-0 h-full rounded"
                              style={{
                                left: `${pos}%`,
                                width: "8px",
                                backgroundColor: est.estado?.color_hex || "#8B5CF6",
                                opacity: 0.5,
                              }}
                              title={`${est.estado?.nombre}: ${est.fecha_anterior}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Data table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Estado</th>
                          <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">{compTemporadaActual}</th>
                          <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">{compTemporadaAnterior}</th>
                          <th className="text-left py-1.5 font-medium text-muted-foreground">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(varData.estados as any[]).map((est: any, i: number) => (
                          <tr key={i} className="border-b border-border/30">
                            <td className="py-1.5 pr-3">
                              <div className="flex items-center gap-1.5">
                                {est.estado?.color_hex && (
                                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: est.estado.color_hex }} />
                                )}
                                <span>{est.estado?.nombre || "-"}</span>
                              </div>
                            </td>
                            <td className="py-1.5 pr-3 font-medium">{est.fecha_actual || "-"}</td>
                            <td className="py-1.5 pr-3 text-muted-foreground">{est.fecha_anterior || "-"}</td>
                            <td className="py-1.5">
                              {est.diferencia_dias != null ? (
                                <span className={`inline-flex items-center gap-1 font-medium ${est.diferencia_dias < 0 ? "text-green-600" : est.diferencia_dias > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                                  {est.diferencia_dias < 0 ? <TrendingUp className="h-3 w-3" /> : est.diferencia_dias > 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                  {est.diferencia_dias > 0 ? "+" : ""}{est.diferencia_dias} dias
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
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {selectedEspecieId
              ? "No hay registros fenologicos para comparar en estas temporadas. Registre estados desde los TestBlocks."
              : "Seleccione una especie arriba para ver la comparativa."}
          </div>
        )}
      </div>

      {/* Registration dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Estado Fenologico</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {regEstadoId && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor:
                      ((allEstados || []) as EstadoFenologico[]).find((e) => e.id_estado === regEstadoId)?.color_hex || "#8B5CF6",
                  }}
                />
                <span className="font-semibold text-sm">
                  {((allEstados || []) as EstadoFenologico[]).find((e) => e.id_estado === regEstadoId)?.nombre}
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label>TestBlock</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={regTbId}
                onChange={(e) => setRegTbId(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {(testblocks || []).map((tb: any) => (
                  <option key={tb.id_testblock} value={tb.id_testblock}>
                    {tb.nombre || tb.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Porcentaje (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                placeholder="Ej: 50"
                value={regPorcentaje}
                onChange={(e) => setRegPorcentaje(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Input
                placeholder="Observaciones..."
                value={regObs}
                onChange={(e) => setRegObs(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>Cancelar</Button>
            <Button
              disabled={!regEstadoId || !regTbId || registerMut.isPending}
              onClick={handleRegister}
            >
              {registerMut.isPending ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
