import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, ArrowDownRight, ArrowUpRight, ExternalLink, FileDown, QrCode } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CrudForm } from "@/components/shared/CrudForm";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { inventarioService } from "@/services/inventario";
import { laboratorioService } from "@/services/laboratorio";
import { useAuthStore } from "@/stores/authStore";
import { useLookups } from "@/hooks/useLookups";
import { formatNumber, formatDate } from "@/lib/utils";
import type { FieldDef } from "@/types";
import type { MovimientoInventario } from "@/types/inventario";

const TIPO_ENTRADA = new Set(["INGRESO", "DEVOLUCION"]);
const TIPO_SALIDA = new Set(["RETIRO", "DESPACHO", "PLANTACION", "AJUSTE"]);

const MOV_TIPOS = [
  { value: "INGRESO", label: "Ingreso" },
  { value: "RETIRO", label: "Retiro" },
  { value: "AJUSTE", label: "Ajuste" },
  { value: "PLANTACION", label: "Plantación" },
  { value: "DEVOLUCION", label: "Devolución" },
  { value: "DESPACHO", label: "Despacho" },
];

/** Color badge for movimiento tipo */
function TipoBadge({ tipo }: { tipo: string }) {
  const upper = tipo?.toUpperCase() || "";
  if (TIPO_ENTRADA.has(upper)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
        <ArrowUpRight className="h-3 w-3" />
        {tipo}
      </span>
    );
  }
  if (TIPO_SALIDA.has(upper)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800">
        <ArrowDownRight className="h-3 w-3" />
        {tipo}
      </span>
    );
  }
  return <StatusBadge status={tipo} />;
}

/** Stock lifecycle progress bar with 3 segments: Plantado, En TB Standby, En Vivero */
function StockLifecycleBar({ lote, destinos }: { lote: any; destinos: any[] }) {
  const inicial = lote.cantidad_inicial || 0;
  const enVivero = lote.cantidad_actual || 0;

  // Calculate standby from destinos (asignada - plantada for each TB)
  const totalAsignada = (destinos || []).reduce((acc: number, d: any) => acc + (d.cantidad_asignada || 0), 0);
  const totalPlantada = (destinos || []).reduce((acc: number, d: any) => acc + (d.cantidad_plantada || 0), 0);
  const enStandby = Math.max(0, totalAsignada - totalPlantada);
  const plantado = Math.max(0, inicial - enVivero - enStandby);

  const pctPlantado = inicial > 0 ? Math.round((plantado / inicial) * 100) : 0;
  const pctStandby = inicial > 0 ? Math.round((enStandby / inicial) * 100) : 0;
  const pctVivero = inicial > 0 ? Math.round((enVivero / inicial) * 100) : 0;

  return (
    <div className="bg-white rounded-lg border p-4">
      <h4 className="text-sm font-semibold text-muted-foreground mb-3">Ciclo de Vida del Stock</h4>
      <div className="flex gap-4 mb-3">
        <div className="text-center">
          <p className="text-2xl font-bold">{formatNumber(inicial)}</p>
          <p className="text-xs text-muted-foreground">Inicial</p>
        </div>
        <div className="flex items-center text-muted-foreground">
          <ArrowDownRight className="h-5 w-5" />
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-garces-cherry">{formatNumber(plantado)}</p>
          <p className="text-xs text-muted-foreground">Plantado</p>
        </div>
        <div className="flex items-center text-muted-foreground">
          <ArrowDownRight className="h-5 w-5" />
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-500">{formatNumber(enStandby)}</p>
          <p className="text-xs text-muted-foreground">En TB Standby</p>
        </div>
        <div className="flex items-center text-muted-foreground">
          <ArrowDownRight className="h-5 w-5" />
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{formatNumber(enVivero)}</p>
          <p className="text-xs text-muted-foreground">En Vivero</p>
        </div>
      </div>
      <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-garces-cherry transition-all"
          style={{ width: `${pctPlantado}%` }}
          title={`Plantado: ${pctPlantado}%`}
        />
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${pctStandby}%` }}
          title={`En TB Standby: ${pctStandby}%`}
        />
        <div
          className="h-full bg-green-500 transition-all"
          style={{ width: `${pctVivero}%` }}
          title={`En Vivero: ${pctVivero}%`}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-garces-cherry inline-block" />
          Plantado {pctPlantado}%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
          En TB Standby {pctStandby}%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />
          En Vivero {pctVivero}%
        </span>
      </div>
    </div>
  );
}

export function LoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [movOpen, setMovOpen] = useState(false);
  const loteId = Number(id);
  const lk = useLookups();

  // Campos and testblocks for cascade selects in movimiento form
  const camposOpts = (lk.rawData.campos || []).map((c: any) => ({
    value: String(c.id_campo), label: c.nombre || c.codigo,
  }));
  const { data: testblocksList } = useQuery({
    queryKey: ["testblocks"],
    queryFn: () => import("@/services/api").then(m => m.get<any[]>("/testblocks")),
    staleTime: 5 * 60_000,
  });
  const tbOpts = (testblocksList || []).map((tb: any) => ({
    value: String(tb.id_testblock), label: tb.nombre || tb.codigo,
  }));

  const movFields: FieldDef[] = [
    { key: "tipo", label: "Tipo", type: "select", required: true, options: MOV_TIPOS },
    { key: "cantidad", label: "Cantidad", type: "number", required: true },
    { key: "id_campo_destino", label: "Campo Destino", type: "select", options: camposOpts },
    { key: "id_testblock_destino", label: "TestBlock Destino", type: "select", options: tbOpts },
  ];

  const { data: lote, isLoading: loteLoading, isError: loteError } = useQuery({
    queryKey: ["inventario", loteId],
    queryFn: () => inventarioService.getById(loteId),
    enabled: !!loteId,
  });

  const { data: movimientos } = useQuery({
    queryKey: ["inventario", loteId, "movimientos"],
    queryFn: () => inventarioService.movimientos(loteId),
    enabled: !!loteId,
  });

  const { data: kardex } = useQuery({
    queryKey: ["inventario", loteId, "kardex"],
    queryFn: () => inventarioService.kardex(loteId),
    enabled: !!loteId,
  });

  const { data: destinos } = useQuery({
    queryKey: ["inventario", loteId, "destinos"],
    queryFn: () => inventarioService.destinos(loteId),
    enabled: !!loteId,
  });

  const movMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      // Build referencia_destino from cascade selects
      const parts: string[] = [];
      if (data.id_campo_destino) {
        const campo = camposOpts.find((c: any) => c.value === String(data.id_campo_destino));
        if (campo) parts.push(campo.label);
      }
      if (data.id_testblock_destino) {
        const tb = tbOpts.find((t: any) => t.value === String(data.id_testblock_destino));
        if (tb) parts.push(tb.label);
      }
      const payload = {
        tipo: data.tipo,
        cantidad: Number(data.cantidad),
        referencia_destino: parts.join(" → ") || undefined,
      };
      return inventarioService.crearMovimiento(loteId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventario"] });
      toast.success("Movimiento registrado");
    },
  });

  if (loteLoading) return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;
  if (loteError || !lote) return (
    <div className="text-center py-12 space-y-3">
      <p className="text-muted-foreground">Lote no encontrado</p>
      <Button variant="outline" onClick={() => navigate("/inventario")}>Volver a Inventario</Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/inventario")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-garces-cherry">Lote: {lote.codigo_lote}</h2>
            <StatusBadge status={lote.estado} />
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={inventarioService.qrUrl(loteId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <QrCode className="h-4 w-4" />
            QR
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = laboratorioService.reporteLotePdfUrl(loteId);
              const token = useAuthStore.getState().token;
              fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                .then((r) => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.blob(); })
                .then((blob) => {
                  const blobUrl = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = blobUrl;
                  a.download = `reporte-lote-${lote.codigo_lote}.pdf`;
                  a.click();
                  URL.revokeObjectURL(blobUrl);
                })
                .catch(() => toast.error("Error al generar PDF"));
            }}
            className="gap-1.5"
          >
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Lote info */}
      <div className="bg-white rounded-lg border p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Cantidad Actual</span>
          <p className="text-xl font-bold">{formatNumber(lote.cantidad_actual)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Cantidad Inicial</span>
          <p className="font-medium">{formatNumber(lote.cantidad_inicial)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Fecha Ingreso</span>
          <p className="font-medium">{formatDate(lote.fecha_ingreso)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Variedad</span>
          <p className="font-medium">{lk.variedad(lote.id_variedad)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Especie</span>
          <p className="font-medium">{lk.especie(lote.id_especie)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Portainjerto</span>
          <p className="font-medium">{lk.portainjerto(lote.id_portainjerto)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Vivero</span>
          <p className="font-medium">{lk.vivero(lote.id_vivero)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">PMG</span>
          <p className="font-medium">{lk.pmg ? lk.pmg(lote.id_pmg) : "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Bodega</span>
          <p className="font-medium">{lk.bodega ? lk.bodega(lote.id_bodega) : "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Tipo Planta</span>
          <p className="font-medium">{lote.tipo_planta || "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Injertación</span>
          <p className="font-medium">{lote.tipo_injertacion || "-"}</p>
        </div>
      </div>

      {/* Stock lifecycle bar */}
      <StockLifecycleBar lote={lote} destinos={destinos || []} />

      {/* Destinos: testblocks que recibieron plantas de este lote */}
      {(destinos || []).length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">Destinos (TestBlocks)</h3>
            <span className="text-xs text-muted-foreground">{destinos!.length} destino(s)</span>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-3 text-left font-medium text-muted-foreground">TestBlock</th>
                  <th className="h-10 px-3 text-right font-medium text-muted-foreground">Asignadas</th>
                  <th className="h-10 px-3 text-right font-medium text-muted-foreground">Plantadas</th>
                  <th className="h-10 px-3 text-right font-medium text-muted-foreground">Pendientes</th>
                  <th className="h-10 px-3 text-center font-medium text-muted-foreground">Estado</th>
                  <th className="h-10 px-3 text-center font-medium text-muted-foreground">Progreso</th>
                </tr>
              </thead>
              <tbody>
                {destinos!.map((d: any) => {
                  const pendientes = Math.max(0, (d.cantidad_asignada || 0) - (d.cantidad_plantada || 0));
                  const pct = d.cantidad_asignada > 0 ? Math.round((d.cantidad_plantada / d.cantidad_asignada) * 100) : 0;
                  return (
                    <tr key={d.id_inventario_tb} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 font-medium">
                        {d.testblock_id ? (
                          <button
                            onClick={() => navigate(`/testblocks/${d.testblock_id}`)}
                            className="text-garces-cherry hover:underline inline-flex items-center gap-1"
                          >
                            {d.testblock_nombre || `TB #${d.testblock_id}`}
                            {d.testblock_codigo && (
                              <span className="text-xs text-muted-foreground font-normal">({d.testblock_codigo})</span>
                            )}
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="text-muted-foreground">Sin testblock</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(d.cantidad_asignada)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-600">{formatNumber(d.cantidad_plantada)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600">{formatNumber(pendientes)}</td>
                      <td className="px-3 py-2 text-center">
                        <StatusBadge status={d.estado} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-garces-cherry rounded-full transition-all"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabs: Movimientos + Kardex */}
      <Tabs defaultValue="kardex">
        <TabsList>
          <TabsTrigger value="kardex">Kardex</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        {/* Kardex tab */}
        <TabsContent value="kardex">
          <div className="bg-white rounded-lg border">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Kardex del Lote</h3>
              <Button size="sm" onClick={() => setMovOpen(true)}>
                <Plus className="h-4 w-4" /> Registrar Movimiento
              </Button>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">Fecha</th>
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">Tipo</th>
                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">Cantidad</th>
                    <th className="h-10 px-3 text-center font-medium text-muted-foreground">Saldo Anterior</th>
                    <th className="h-10 px-3 text-center font-medium text-muted-foreground"></th>
                    <th className="h-10 px-3 text-center font-medium text-muted-foreground">Saldo Nuevo</th>
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">Destino</th>
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {(kardex || []).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="h-24 text-center text-muted-foreground">
                        Sin movimientos registrados
                      </td>
                    </tr>
                  ) : (
                    (kardex || []).map((m: MovimientoInventario) => {
                      const isEntrada = TIPO_ENTRADA.has(m.tipo?.toUpperCase());
                      return (
                        <tr key={m.id_movimiento} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2 text-muted-foreground">
                            {formatDate(m.fecha_movimiento)}
                          </td>
                          <td className="px-3 py-2">
                            <TipoBadge tipo={m.tipo} />
                          </td>
                          <td className={`px-3 py-2 text-right font-medium tabular-nums ${isEntrada ? "text-green-700" : "text-red-700"}`}>
                            {isEntrada ? "+" : "-"}{formatNumber(m.cantidad)}
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                            {m.saldo_anterior != null ? formatNumber(m.saldo_anterior) : "-"}
                          </td>
                          <td className="px-3 py-2 text-center text-muted-foreground">
                            →
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums font-medium">
                            {m.saldo_nuevo != null ? formatNumber(m.saldo_nuevo) : "-"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {m.referencia_destino || "-"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">
                            {m.usuario || "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Movimientos tab — timeline view */}
        <TabsContent value="movimientos">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Timeline de Movimientos</h3>
              <Button size="sm" onClick={() => setMovOpen(true)}>
                <Plus className="h-4 w-4" /> Registrar Movimiento
              </Button>
            </div>
            {(!movimientos || movimientos.length === 0) ? (
              <p className="py-8 text-center text-muted-foreground text-sm">Sin movimientos registrados</p>
            ) : (
              <div className="relative pl-6">
                {/* Timeline line */}
                <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-4">
                  {(movimientos || []).map((m: MovimientoInventario) => {
                    const isEntrada = TIPO_ENTRADA.has(m.tipo?.toUpperCase());
                    return (
                      <div key={m.id_movimiento} className="relative flex gap-3">
                        {/* Timeline dot */}
                        <div className={`absolute -left-3.5 top-1 w-3 h-3 rounded-full border-2 border-white ${
                          isEntrada ? "bg-estado-success" : "bg-estado-danger"
                        }`} />
                        {/* Content */}
                        <div className="flex-1 bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <TipoBadge tipo={m.tipo} />
                              {m.motivo && <span className="text-sm text-muted-foreground">{m.motivo}</span>}
                            </div>
                            <span className={`font-bold tabular-nums ${isEntrada ? "text-green-700" : "text-red-700"}`}>
                              {isEntrada ? "+" : "-"}{formatNumber(m.cantidad)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                            <span>
                              {formatDate(m.fecha_movimiento)}
                              {m.usuario && <span className="ml-2">por {m.usuario}</span>}
                            </span>
                            <span className="tabular-nums">
                              Saldo: {m.saldo_anterior != null ? formatNumber(m.saldo_anterior) : "?"} → {m.saldo_nuevo != null ? formatNumber(m.saldo_nuevo) : "?"}
                            </span>
                          </div>
                          {m.referencia_destino && (
                            <p className="text-xs text-muted-foreground mt-1">Destino: {m.referencia_destino}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <CrudForm
        open={movOpen}
        onClose={() => setMovOpen(false)}
        onSubmit={async (data) => { await movMut.mutateAsync(data); }}
        fields={movFields}
        title="Registrar Movimiento"
        isLoading={movMut.isPending}
      />
    </div>
  );
}
