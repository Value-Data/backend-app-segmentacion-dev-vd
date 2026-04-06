import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Flower2, Calendar, ArrowRight, Leaf, Snowflake, Sun, Droplets, Cherry,
  Camera, CircleDot, Grape, Apple, Settings2, Plus,
} from "lucide-react";
import toast from "react-hot-toast";
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

  const handleRegister = async () => {
    if (!regEstadoId || !regTbId) return;
    // Fetch positions for the selected testblock
    const { get: apiGet } = await import("@/services/api");
    const positions = await apiGet<{ id_posicion: number }[]>(
      `/testblocks/${regTbId}/posiciones`
    );
    const posIds = (positions || [])
      .filter((p: any) => p.estado === "alta")
      .map((p: any) => p.id_posicion);
    if (posIds.length === 0) {
      toast.error("No hay posiciones activas en este testblock");
      return;
    }
    registerMut.mutate({
      id_estado_fenol: regEstadoId,
      posiciones_ids: posIds,
      porcentaje: regPorcentaje ? Number(regPorcentaje) : null,
      fecha: new Date().toISOString().split("T")[0],
      observaciones: regObs,
      temporada: "2025-2026",
    });
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
        <div className="bg-white rounded-lg border p-8 text-center">
          <Flower2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-semibold">Sin estados fenologicos para {selectedEspecieName}</p>
          <p className="text-xs text-muted-foreground mt-1">
            No hay estados fenologicos registrados para esta especie.
            Un administrador puede poblarlos desde Mantenedores o ejecutando el seed.
          </p>
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
