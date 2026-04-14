import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ordenesTrabajoService } from "@/services/ordenesTrabajo";
import type { OrdenTrabajo } from "@/services/ordenesTrabajo";
import { get } from "@/services/api";
import { formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  onClose: () => void;
  ot: OrdenTrabajo;
  onSuccess: () => void;
}

interface Usuario {
  id_usuario: number;
  nombre: string;
  apellido?: string;
}

type Resultado = "segun_plan" | "parcial" | "no_realizada" | "reprogramar";

const MOTIVOS = [
  { value: "clima", label: "Clima" },
  { value: "insumos", label: "Falta de insumos" },
  { value: "personal", label: "Falta de personal" },
  { value: "prioridad", label: "Cambio de prioridad" },
  { value: "fitosanitario", label: "Problema fitosanitario" },
  { value: "otro", label: "Otro" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegistrarEjecucionDialog({ open, onClose, ot, onSuccess }: Props) {
  const queryClient = useQueryClient();

  // Form state
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [posicionesEjecutadas, setPosicionesEjecutadas] = useState<string>("");
  const [continuarManana, setContinuarManana] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [motivoDetalle, setMotivoDetalle] = useState("");
  const [nuevaFechaInicio, setNuevaFechaInicio] = useState("");
  const [nuevaFechaFin, setNuevaFechaFin] = useState("");
  const [motivoReprogramar, setMotivoReprogramar] = useState("");
  const [fechaEjecucion, setFechaEjecucion] = useState(new Date().toISOString().split("T")[0]);
  const [ejecutor, setEjecutor] = useState("");
  const [duracion, setDuracion] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // --- Queries ---
  const { data: usuarios } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => get<Usuario[]>("/sistema/usuarios"),
    staleTime: 5 * 60_000,
  });

  // --- Mutations ---
  const ejecutarMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => ordenesTrabajoService.ejecutar(ot.id, data),
    onSuccess: () => {
      toast.success("Ejecucion registrada");
      queryClient.invalidateQueries({ queryKey: ["ordenes-trabajo"] });
      handleClose();
      onSuccess();
    },
  });

  const reprogramarMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => ordenesTrabajoService.reprogramar(ot.id, data),
    onSuccess: () => {
      toast.success("Orden reprogramada");
      queryClient.invalidateQueries({ queryKey: ["ordenes-trabajo"] });
      handleClose();
      onSuccess();
    },
  });

  // --- Helpers ---
  const handleClose = () => {
    setResultado(null);
    setPosicionesEjecutadas("");
    setContinuarManana(false);
    setMotivo("");
    setMotivoDetalle("");
    setNuevaFechaInicio("");
    setNuevaFechaFin("");
    setMotivoReprogramar("");
    setFechaEjecucion(new Date().toISOString().split("T")[0]);
    setEjecutor("");
    setDuracion("");
    setObservaciones("");
    onClose();
  };

  const handleSubmit = () => {
    if (!resultado) {
      toast.error("Selecciona un resultado");
      return;
    }

    if (resultado === "reprogramar") {
      if (!nuevaFechaInicio || !nuevaFechaFin) {
        toast.error("Ingresa las nuevas fechas");
        return;
      }
      reprogramarMut.mutate({
        fecha_plan_inicio: nuevaFechaInicio,
        fecha_plan_fin: nuevaFechaFin,
        motivo: motivoReprogramar || null,
      });
      return;
    }

    const payload: Record<string, unknown> = {
      cumplimiento: resultado,
      fecha_ejecucion_real: fechaEjecucion || null,
      ejecutor_real: ejecutor || null,
      duracion_real_min: duracion ? Number(duracion) : null,
      observaciones_ejecucion: observaciones || null,
    };

    if (resultado === "parcial") {
      payload.posiciones_ejecutadas = posicionesEjecutadas ? Number(posicionesEjecutadas) : 0;
      payload.continuar_manana = continuarManana;
      payload.motivo_desviacion = motivo || null;
      payload.motivo_desviacion_detalle = motivoDetalle || null;
    }

    if (resultado === "no_realizada") {
      payload.posiciones_ejecutadas = 0;
      payload.motivo_desviacion = motivo || null;
      payload.motivo_desviacion_detalle = motivoDetalle || null;
    }

    if (resultado === "segun_plan") {
      payload.posiciones_ejecutadas = ot.posiciones_total;
    }

    ejecutarMut.mutate(payload);
  };

  const isPending = ejecutarMut.isPending || reprogramarMut.isPending;
  const showExecutionFields = resultado === "segun_plan" || resultado === "parcial";

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-garces-cherry flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Registrar Ejecucion
          </DialogTitle>
        </DialogHeader>

        {/* Section 1 — Header info */}
        <div className="rounded-lg border bg-gray-50 p-3 space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-garces-cherry">{ot.codigo}</span>
            <span className="text-xs text-muted-foreground">
              {ot.posiciones_total} posiciones
            </span>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Tipo: {ot.tipo_labor_nombre || `Labor #${ot.id_tipo_labor || "-"}`}</p>
            <p>TestBlock: {ot.testblock_nombre || `TB #${ot.id_testblock || "-"}`}</p>
            <p>Planificado: {formatDate(ot.fecha_plan_inicio)} - {formatDate(ot.fecha_plan_fin)}</p>
          </div>
        </div>

        {/* Section 2 — Resultado (4 exclusive buttons) */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Resultado</Label>
          <div className="grid grid-cols-2 gap-2">
            <ResultButton
              active={resultado === "segun_plan"}
              onClick={() => setResultado("segun_plan")}
              label="Segun plan"
              activeClass="bg-green-100 border-green-500 text-green-800"
            />
            <ResultButton
              active={resultado === "parcial"}
              onClick={() => setResultado("parcial")}
              label="Parcial"
              activeClass="bg-amber-100 border-amber-500 text-amber-800"
            />
            <ResultButton
              active={resultado === "no_realizada"}
              onClick={() => setResultado("no_realizada")}
              label="No realizada"
              activeClass="bg-red-100 border-red-500 text-red-800"
            />
            <ResultButton
              active={resultado === "reprogramar"}
              onClick={() => setResultado("reprogramar")}
              label="Reprogramar"
              activeClass="bg-blue-100 border-blue-500 text-blue-800"
            />
          </div>
        </div>

        {/* Section 3 — Conditional fields */}
        {resultado === "parcial" && (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Posiciones ejecutadas: de {ot.posiciones_total}
              </Label>
              <Input
                type="number"
                min={0}
                max={ot.posiciones_total}
                value={posicionesEjecutadas}
                onChange={(e) => setPosicionesEjecutadas(e.target.value)}
                placeholder={`0 - ${ot.posiciones_total}`}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={continuarManana}
                onChange={(e) => setContinuarManana(e.target.checked)}
                className="accent-amber-600 h-4 w-4"
              />
              Continuar manana
            </label>
          </div>
        )}

        {(resultado === "parcial" || resultado === "no_realizada") && (
          <div className="space-y-3 rounded-lg border border-gray-200 p-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Motivo de desviacion</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar motivo" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Detalle</Label>
              <Input
                value={motivoDetalle}
                onChange={(e) => setMotivoDetalle(e.target.value)}
                placeholder="Detalle del motivo..."
              />
            </div>
          </div>
        )}

        {resultado === "reprogramar" && (
          <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nueva fecha inicio *</Label>
                <Input
                  type="date"
                  value={nuevaFechaInicio}
                  onChange={(e) => setNuevaFechaInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nueva fecha fin *</Label>
                <Input
                  type="date"
                  value={nuevaFechaFin}
                  onChange={(e) => setNuevaFechaFin(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Motivo de reprogramacion</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={motivoReprogramar}
                onChange={(e) => setMotivoReprogramar(e.target.value)}
                placeholder="Razon de la reprogramacion..."
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Section 4 — Execution details (visible for segun_plan & parcial) */}
        {showExecutionFields && (
          <div className="space-y-3 rounded-lg border border-gray-200 p-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Datos de ejecucion
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Fecha ejecucion</Label>
                <Input
                  type="date"
                  value={fechaEjecucion}
                  onChange={(e) => setFechaEjecucion(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Duracion (min)</Label>
                <Input
                  type="number"
                  min={0}
                  value={duracion}
                  onChange={(e) => setDuracion(e.target.value)}
                  placeholder="Ej: 120"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ejecutor</Label>
              <Select value={ejecutor} onValueChange={setEjecutor}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ejecutor" />
                </SelectTrigger>
                <SelectContent>
                  {(usuarios || []).map((u) => (
                    <SelectItem key={u.id_usuario} value={String(u.id_usuario)}>
                      {u.nombre}{u.apellido ? ` ${u.apellido}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Observaciones</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Observaciones de la ejecucion..."
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!resultado || isPending}
            className="bg-garces-cherry hover:bg-garces-cherry/90"
          >
            {isPending ? "Registrando..." : "Registrar Ejecucion"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function ResultButton({
  active,
  onClick,
  label,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border-2 px-3 py-2.5 text-sm font-medium transition-all ${
        active
          ? activeClass
          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
      }`}
    >
      {label}
    </button>
  );
}
