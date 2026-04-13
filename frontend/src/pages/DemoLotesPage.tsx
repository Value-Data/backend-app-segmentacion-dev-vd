/**
 * DemoLotesPage - Pagina de validacion del flujo de creacion de lotes desde TestBlocks.
 *
 * Tres secciones:
 * 1. Seed Lotes Demo: auto-crear lotes desde TBs existentes
 * 2. Crear Lote Manual: formulario para crear lote desde un TB
 * 3. Seleccionar por Lote: explorar lotes de un TB y acciones demo
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package, Sprout, Database, Leaf, ChevronRight,
  FlaskConical, Hammer, QrCode, XCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { testblockService } from "@/services/testblock";
import { useLookups } from "@/hooks/useLookups";
import { useTestblocks } from "@/hooks/useTestblock";

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

interface CrearLoteResult {
  lote_id: number;
  codigo_lote: string;
  plantas_creadas: number;
  message: string;
}

interface LoteInfo {
  id_inventario: number;
  codigo_lote: string;
  id_variedad: number | null;
  id_portainjerto: number | null;
  tipo_planta: string | null;
  cantidad_inicial: number;
  cantidad_actual: number;
  estado: string | null;
  posiciones_en_tb: number;
  fecha_ingreso: string | null;
  observaciones: string | null;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------
export function DemoLotesPage() {
  const queryClient = useQueryClient();
  const lookups = useLookups();
  const { data: testblocks, isLoading: tbLoading } = useTestblocks();

  // ---- Section 1 state ----
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);

  // ---- Section 2 state ----
  const [selectedTbId, setSelectedTbId] = useState<number | null>(null);
  const [variedadId, setVariedadId] = useState<number | null>(null);
  const [portainjertoId, setPortainjertoId] = useState<number | null>(null);
  const [cantidadPos, setCantidadPos] = useState<number>(5);
  const [crearResult, setCrearResult] = useState<CrearLoteResult | null>(null);

  // ---- Section 3 state ----
  const [exploreTbId, setExploreTbId] = useState<number | null>(null);
  const [selectedLote, setSelectedLote] = useState<LoteInfo | null>(null);

  // ---- Queries ----
  const { data: posiciones } = useQuery({
    queryKey: ["testblocks", selectedTbId, "posiciones"],
    queryFn: () => testblockService.posiciones(selectedTbId!),
    enabled: !!selectedTbId,
  });

  const { data: lotes, isLoading: lotesLoading, refetch: refetchLotes } = useQuery({
    queryKey: ["testblocks", exploreTbId, "lotes"],
    queryFn: () => testblockService.lotesTestblock(exploreTbId!),
    enabled: !!exploreTbId,
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
      setCrearResult(data as CrearLoteResult);
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["testblocks"] });
    },
    onError: () => {
      toast.error("Error al crear lote");
    },
  });

  // ---- Handlers ----
  const handleCrearLote = () => {
    if (!selectedTbId || !variedadId || !portainjertoId) {
      toast.error("Seleccione TestBlock, Variedad y Portainjerto");
      return;
    }

    // Pick empty/baja positions from the loaded positions
    const disponibles = (posiciones || [])
      .filter((p: any) => p.estado === "vacia" || p.estado === "baja" || !p.estado)
      .slice(0, cantidadPos);

    if (disponibles.length === 0) {
      toast.error("No hay posiciones disponibles (vacias o baja) en este TestBlock");
      return;
    }

    crearLoteMutation.mutate({
      tbId: selectedTbId,
      body: {
        id_variedad: variedadId,
        id_portainjerto: portainjertoId,
        posicion_ids: disponibles.map((p: any) => p.id_posicion),
      },
    });
  };

  const handleDemoAction = (action: string, lote: LoteInfo) => {
    toast.info(`Accion "${action}" para lote ${lote.codigo_lote}`, {
      description: `ID: ${lote.id_inventario} | Plantas: ${lote.posiciones_en_tb}`,
    });
  };

  // ---- Render helpers ----
  const tbOptions = (testblocks || []).map((tb: any) => ({
    value: tb.id_testblock,
    label: `${tb.codigo} - ${tb.nombre}`,
  }));

  return (
    <div className="space-y-8 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6 text-amber-700" />
          Demo: Lotes desde TestBlocks
        </h1>
        <p className="text-muted-foreground mt-1">
          Pagina de validacion para el flujo de creacion de lotes de plantas directamente desde TestBlocks.
        </p>
      </div>

      {/* ================================================================ */}
      {/* SECTION 1: Seed Lotes Demo */}
      {/* ================================================================ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            1. Seed Lotes Demo
          </CardTitle>
          <CardDescription>
            Auto-crear lotes desde TestBlocks existentes. Agrupa posiciones por (variedad, portainjerto)
            y crea registros en inventario_vivero vinculando plantas ya existentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {seedMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Auto-crear lotes desde TestBlocks existentes
          </Button>

          {seedResult && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
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
      {/* SECTION 2: Crear Lote Manual */}
      {/* ================================================================ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-green-600" />
            2. Crear Lote Manual
          </CardTitle>
          <CardDescription>
            Seleccione un TestBlock, variedad, portainjerto y cantidad de posiciones.
            Se creara un lote y se asignaran plantas a posiciones vacias.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* TestBlock */}
            <div className="space-y-1">
              <label className="text-sm font-medium">TestBlock</label>
              <Select
                value={selectedTbId ? String(selectedTbId) : ""}
                onValueChange={(v) => {
                  setSelectedTbId(Number(v));
                  setCrearResult(null);
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

            {/* Variedad */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Variedad</label>
              <Select
                value={variedadId ? String(variedadId) : ""}
                onValueChange={(v) => setVariedadId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar variedad" />
                </SelectTrigger>
                <SelectContent>
                  {(lookups.options.variedades || []).map((opt: { value: number; label: string }) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Portainjerto */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Portainjerto</label>
              <Select
                value={portainjertoId ? String(portainjertoId) : ""}
                onValueChange={(v) => setPortainjertoId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar portainjerto" />
                </SelectTrigger>
                <SelectContent>
                  {(lookups.options.portainjertos || []).map((opt: { value: number; label: string }) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cantidad */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Cantidad de posiciones</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={cantidadPos}
                onChange={(e) => setCantidadPos(Number(e.target.value) || 1)}
              />
            </div>
          </div>

          {selectedTbId && posiciones && (
            <p className="text-xs text-muted-foreground">
              Posiciones disponibles (vacias/baja):{" "}
              <strong>
                {posiciones.filter((p: any) => p.estado === "vacia" || p.estado === "baja" || !p.estado).length}
              </strong>{" "}
              / {posiciones.length} total
            </p>
          )}

          <Button
            onClick={handleCrearLote}
            disabled={crearLoteMutation.isPending || !selectedTbId || !variedadId || !portainjertoId}
            className="bg-green-600 hover:bg-green-700"
          >
            {crearLoteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Lote
          </Button>

          {crearResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1">
              <p className="font-medium text-green-800">{crearResult.message}</p>
              <p className="text-sm text-green-700">
                Codigo: <span className="font-mono font-bold">{crearResult.codigo_lote}</span>
                {" | "}ID: {crearResult.lote_id}
                {" | "}Plantas: {crearResult.plantas_creadas}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* SECTION 3: Seleccionar por Lote */}
      {/* ================================================================ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-amber-600" />
            3. Seleccionar por Lote
          </CardTitle>
          <CardDescription>
            Explorar lotes vinculados a un TestBlock. Click en un lote para ver detalle y acciones demo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="space-y-1 flex-1 max-w-xs">
              <label className="text-sm font-medium">TestBlock</label>
              <Select
                value={exploreTbId ? String(exploreTbId) : ""}
                onValueChange={(v) => {
                  setExploreTbId(Number(v));
                  setSelectedLote(null);
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
            {exploreTbId && (
              <Button variant="outline" size="sm" onClick={() => refetchLotes()}>
                Refrescar
              </Button>
            )}
          </div>

          {lotesLoading && exploreTbId && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando lotes...
            </div>
          )}

          {exploreTbId && !lotesLoading && lotes && lotes.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              No hay lotes vinculados a este TestBlock. Use la seccion 1 o 2 para crear lotes.
            </p>
          )}

          {lotes && lotes.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {lotes.map((lote) => (
                <button
                  key={lote.id_inventario}
                  onClick={() => setSelectedLote(lote)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    selectedLote?.id_inventario === lote.id_inventario
                      ? "border-amber-500 bg-amber-50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-bold text-amber-800">
                      {lote.codigo_lote}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>Variedad: {lookups.variedad(lote.id_variedad)}</div>
                    <div>Portainjerto: {lookups.portainjerto(lote.id_portainjerto)}</div>
                    <div>Posiciones: {lote.posiciones_en_tb} | Estado: {lote.estado || "-"}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected lote detail */}
          {selectedLote && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <h4 className="font-bold text-amber-900">
                Lote: {selectedLote.codigo_lote}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">Variedad</span>
                  <span className="font-medium">
                    {lookups.variedad(selectedLote.id_variedad)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Portainjerto</span>
                  <span className="font-medium">
                    {lookups.portainjerto(selectedLote.id_portainjerto)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Plantas (posiciones)</span>
                  <span className="font-medium">{selectedLote.posiciones_en_tb}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Estado</span>
                  <span className="font-medium capitalize">{selectedLote.estado || "-"}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDemoAction("Fenologia", selectedLote)}
                >
                  <FlaskConical className="mr-1 h-3.5 w-3.5" />
                  Fenologia
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDemoAction("Labores", selectedLote)}
                >
                  <Hammer className="mr-1 h-3.5 w-3.5" />
                  Labores
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDemoAction("QR", selectedLote)}
                >
                  <QrCode className="mr-1 h-3.5 w-3.5" />
                  QR
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDemoAction("Baja", selectedLote)}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  Baja
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default DemoLotesPage;
