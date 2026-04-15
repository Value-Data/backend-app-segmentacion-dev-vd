import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
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
import { laboresService } from "@/services/labores";
import { inventarioService } from "@/services/inventario";
import { ordenesTrabajoService } from "@/services/ordenesTrabajo";
import { useTestblocks } from "@/hooks/useTestblock";
import { get } from "@/services/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Usuario {
  id_usuario: number;
  nombre_completo: string;
  username: string;
  rol: string;
}

type Alcance = "todas" | "lote" | "personalizado";

interface FormState {
  id_tipo_labor: string;
  id_testblock: string;
  id_lote: string;
  alcance: Alcance;
  hilera_desde: string;
  hilera_hasta: string;
  prioridad: string;
  id_responsable: string;
  equipo: string;
  fecha_plan_inicio: string;
  fecha_plan_fin: string;
  observaciones: string;
}

const INITIAL_FORM: FormState = {
  id_tipo_labor: "",
  id_testblock: "",
  id_lote: "",
  alcance: "todas",
  hilera_desde: "",
  hilera_hasta: "",
  prioridad: "media",
  id_responsable: "",
  equipo: "",
  fecha_plan_inicio: "",
  fecha_plan_fin: "",
  observaciones: "",
};

const STEPS = [
  { num: 1, label: "Que y Donde" },
  { num: 2, label: "Quien y Cuando" },
  { num: 3, label: "Confirmar" },
];

const PRIORIDAD_STYLES: Record<string, string> = {
  alta: "border-red-400 bg-red-50 text-red-700",
  media: "border-amber-400 bg-amber-50 text-amber-700",
  baja: "border-green-400 bg-green-50 text-green-700",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NuevaOrdenTrabajoWizard({ open, onClose, onSuccess }: WizardProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  // --- Queries ---
  const { data: tiposLabor } = useQuery({
    queryKey: ["tipos-labor"],
    queryFn: () => laboresService.tiposLabor(),
    staleTime: 5 * 60_000,
  });

  const { data: testblocks } = useTestblocks();

  const { data: lotesDisponibles } = useQuery({
    queryKey: ["inventario", "disponible"],
    queryFn: () => inventarioService.disponible(),
    staleTime: 2 * 60_000,
  });

  const { data: usuarios } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => get<Usuario[]>("/sistema/usuarios"),
    staleTime: 5 * 60_000,
  });

  // --- Mutation ---
  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => ordenesTrabajoService.create(data),
    onSuccess: () => {
      toast.success("Orden de trabajo creada");
      queryClient.invalidateQueries({ queryKey: ["ordenes-trabajo"] });
      handleClose();
      onSuccess();
    },
  });

  // --- Helpers ---
  const handleClose = () => {
    setStep(1);
    setForm(INITIAL_FORM);
    onClose();
  };

  const set = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Resolve names for summary
  const tipoLaborNombre = useMemo(() => {
    if (!form.id_tipo_labor || !tiposLabor) return "-";
    const t = tiposLabor.find((tl) => String(tl.id_labor) === form.id_tipo_labor);
    return t ? `${t.nombre} (${t.categoria})` : "-";
  }, [form.id_tipo_labor, tiposLabor]);

  const testblockNombre = useMemo(() => {
    if (!form.id_testblock || !testblocks) return "-";
    const tb = testblocks.find((t) => String(t.id_testblock) === form.id_testblock);
    return tb ? `${tb.nombre} (${tb.codigo})` : "-";
  }, [form.id_testblock, testblocks]);

  const responsableNombre = useMemo(() => {
    if (!form.id_responsable || !usuarios) return "-";
    const u = usuarios.find((us) => String(us.id_usuario) === form.id_responsable);
    return u ? u.nombre_completo || u.username : "-";
  }, [form.id_responsable, usuarios]);

  const loteNombre = useMemo(() => {
    if (!form.id_lote || !lotesDisponibles) return "-";
    const l = lotesDisponibles.find((lo: any) => String(lo.id_inventario) === form.id_lote);
    return l ? `${l.codigo_lote || `Lote #${l.id_inventario}`}` : "-";
  }, [form.id_lote, lotesDisponibles]);

  const autoCode = useMemo(() => {
    const year = new Date().getFullYear();
    const rand = String(Math.floor(Math.random() * 900) + 100);
    return `OT-${year}-${rand}`;
  }, [open]); // Regenerate each time dialog opens

  // --- Validation ---
  const canNext1 = form.id_tipo_labor && form.id_testblock && form.prioridad;
  const canNext2 = form.fecha_plan_inicio && form.fecha_plan_fin;

  // --- Submit ---
  const handleSubmit = () => {
    const payload: Record<string, unknown> = {
      codigo: autoCode,
      id_tipo_labor: Number(form.id_tipo_labor) || null,
      id_testblock: Number(form.id_testblock) || null,
      id_lote: form.id_lote ? Number(form.id_lote) : null,
      fecha_plan_inicio: form.fecha_plan_inicio,
      fecha_plan_fin: form.fecha_plan_fin,
      id_responsable: form.id_responsable ? Number(form.id_responsable) : null,
      equipo: form.equipo || null,
      prioridad: form.prioridad,
      estado: "planificada",
      observaciones_plan: form.observaciones || null,
      alcance: form.alcance,
    };
    if (form.alcance === "personalizado") {
      payload.hilera_desde = Number(form.hilera_desde) || null;
      payload.hilera_hasta = Number(form.hilera_hasta) || null;
    }
    createMut.mutate(payload);
  };

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-garces-cherry">Nueva Orden de Trabajo</DialogTitle>
        </DialogHeader>

        {/* Step progress bar */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {STEPS.map((s, idx) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-colors ${
                  step > s.num
                    ? "bg-green-500 border-green-500 text-white"
                    : step === s.num
                      ? "bg-garces-cherry border-garces-cherry text-white"
                      : "bg-gray-100 border-gray-300 text-gray-400"
                }`}
              >
                {step > s.num ? <Check className="h-4 w-4" /> : s.num}
              </div>
              <span
                className={`text-xs hidden sm:inline ${
                  step === s.num ? "font-semibold text-garces-cherry" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
              {idx < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${step > s.num ? "bg-green-500" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Tipo de Labor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo de Labor *</Label>
              <Select value={form.id_tipo_labor} onValueChange={(v) => set("id_tipo_labor", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo de labor" />
                </SelectTrigger>
                <SelectContent>
                  {(tiposLabor || []).map((t) => (
                    <SelectItem key={t.id_labor} value={String(t.id_labor)}>
                      {t.nombre} ({t.categoria})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* TestBlock */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">TestBlock *</Label>
              <Select value={form.id_testblock} onValueChange={(v) => set("id_testblock", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar testblock" />
                </SelectTrigger>
                <SelectContent>
                  {(testblocks || []).map((tb) => (
                    <SelectItem key={tb.id_testblock} value={String(tb.id_testblock)}>
                      {tb.nombre} ({tb.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lote (optional) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Lote (opcional)</Label>
              <Select value={form.id_lote} onValueChange={(v) => set("id_lote", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin lote especifico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin lote especifico</SelectItem>
                  {(lotesDisponibles || []).map((l) => (
                    <SelectItem key={l.id_inventario} value={String(l.id_inventario)}>
                      {l.codigo_lote || `Lote #${l.id_inventario}`} — Stock: {l.cantidad_actual ?? 0}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Alcance */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Alcance</Label>
              <div className="space-y-2">
                {([
                  { value: "todas" as const, label: "Todas las posiciones del TB" },
                  { value: "lote" as const, label: "Solo posiciones del lote" },
                  { value: "personalizado" as const, label: "Personalizado (rango de hileras)" },
                ] as const).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors ${
                      form.alcance === opt.value
                        ? "border-garces-cherry bg-red-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="alcance"
                      checked={form.alcance === opt.value}
                      onChange={() => set("alcance", opt.value)}
                      className="accent-garces-cherry"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              {form.alcance === "personalizado" && (
                <div className="flex gap-3 mt-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Hilera desde</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.hilera_desde}
                      onChange={(e) => set("hilera_desde", e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Hilera hasta</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.hilera_hasta}
                      onChange={(e) => set("hilera_hasta", e.target.value)}
                      placeholder="10"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Prioridad */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Prioridad *</Label>
              <div className="flex gap-2">
                {(["alta", "media", "baja"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set("prioridad", p)}
                    className={`flex-1 rounded-md border-2 px-3 py-2 text-sm font-medium capitalize transition-all ${
                      form.prioridad === p
                        ? PRIORIDAD_STYLES[p]
                        : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setStep(2)}
                disabled={!canNext1}
                className="bg-garces-cherry hover:bg-garces-cherry/90"
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Responsable */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Responsable</Label>
              <Select value={form.id_responsable} onValueChange={(v) => set("id_responsable", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar responsable" />
                </SelectTrigger>
                <SelectContent>
                  {(usuarios || []).filter((u) => u.id_usuario).map((u) => (
                    <SelectItem key={u.id_usuario} value={String(u.id_usuario)}>
                      {u.nombre_completo || u.username} ({u.rol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Equipo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Equipo / Cuadrilla</Label>
              <Input
                value={form.equipo}
                onChange={(e) => set("equipo", e.target.value)}
                placeholder="Ej: Cuadrilla Norte, Equipo 3..."
              />
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Fecha inicio *</Label>
                <Input
                  type="date"
                  value={form.fecha_plan_inicio}
                  onChange={(e) => set("fecha_plan_inicio", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Fecha fin *</Label>
                <Input
                  type="date"
                  value={form.fecha_plan_fin}
                  onChange={(e) => set("fecha_plan_fin", e.target.value)}
                />
              </div>
            </div>

            {/* Observaciones */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Observaciones</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={form.observaciones}
                onChange={(e) => set("observaciones", e.target.value)}
                placeholder="Notas adicionales sobre la orden de trabajo..."
                rows={3}
              />
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Atras
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!canNext2}
                className="bg-garces-cherry hover:bg-garces-cherry/90"
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 — Confirmacion */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Auto-generated code */}
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-muted-foreground">Codigo:</span>
              <span className="font-mono font-bold text-garces-cherry">{autoCode}</span>
            </div>

            {/* Summary card */}
            <div className="rounded-lg border bg-gray-50 p-4 space-y-3 text-sm">
              <h4 className="font-semibold text-garces-cherry text-xs uppercase tracking-wider">Resumen</h4>

              <SummaryRow label="Tipo de Labor" value={tipoLaborNombre} />
              <SummaryRow label="TestBlock" value={testblockNombre} />
              {form.id_lote && <SummaryRow label="Lote" value={loteNombre} />}
              <SummaryRow label="Alcance" value={
                form.alcance === "todas"
                  ? "Todas las posiciones del TB"
                  : form.alcance === "lote"
                    ? "Solo posiciones del lote"
                    : `Hileras ${form.hilera_desde || "?"} a ${form.hilera_hasta || "?"}`
              } />
              <SummaryRow
                label="Prioridad"
                value={
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium border ${PRIORIDAD_STYLES[form.prioridad]}`}>
                    {form.prioridad}
                  </span>
                }
              />

              <hr className="border-gray-200" />

              <SummaryRow label="Responsable" value={responsableNombre} />
              {form.equipo && <SummaryRow label="Equipo" value={form.equipo} />}
              <SummaryRow label="Fecha inicio" value={form.fecha_plan_inicio} />
              <SummaryRow label="Fecha fin" value={form.fecha_plan_fin} />
              {form.observaciones && <SummaryRow label="Observaciones" value={form.observaciones} />}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Atras
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMut.isPending}
                className="bg-garces-cherry hover:bg-garces-cherry/90"
              >
                {createMut.isPending ? "Creando..." : "Crear Orden de Trabajo"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-muted-foreground text-xs shrink-0">{label}</span>
      <span className="text-right text-xs font-medium">{value}</span>
    </div>
  );
}
