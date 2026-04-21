import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Sprout, Package, ClipboardCheck, Leaf } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { inventarioService } from "@/services/inventario";
import { mantenedorService } from "@/services/mantenedores";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface PlantWizardProps {
  open: boolean;
  onClose: () => void;
}

interface WizardData {
  // Step 1 — plant type
  id_especie: string;
  id_variedad: string;
  id_portainjerto: string;
  id_pmg: string;
  // Step 2 — batch
  codigo_lote: string;
  cantidad_inicial: string;
  id_vivero: string;
  id_bodega: string;
  tipo_planta: string;
  tipo_injerto: string;
  fecha_ingreso: string;
  observaciones: string;
}

const INITIAL_DATA: WizardData = {
  id_especie: "",
  id_variedad: "",
  id_portainjerto: "",
  id_pmg: "",
  codigo_lote: "",
  cantidad_inicial: "",
  id_vivero: "",
  id_bodega: "",
  tipo_planta: "",
  tipo_injerto: "",
  fecha_ingreso: new Date().toISOString().slice(0, 10),
  observaciones: "",
};

const STEPS = [
  { number: 1, title: "Define Planta", icon: Sprout },
  { number: 2, title: "Definir Lote", icon: Package },
  { number: 3, title: "Confirmar", icon: ClipboardCheck },
] as const;

/* ------------------------------------------------------------------ */
/* Step indicator                                                      */
/* ------------------------------------------------------------------ */

function StepIndicator({
  currentStep,
  completedSteps,
}: {
  currentStep: number;
  completedSteps: Set<number>;
}) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {STEPS.map((step, idx) => {
        const isActive = currentStep === step.number;
        const isCompleted = completedSteps.has(step.number);
        const StepIcon = step.icon;

        return (
          <div key={step.number} className="flex items-center">
            {/* Circle */}
            <div className="flex items-center gap-2">
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all
                  ${isActive ? "bg-garces-cherry text-white shadow-md" : ""}
                  ${isCompleted && !isActive ? "bg-green-500 text-white" : ""}
                  ${!isActive && !isCompleted ? "bg-gray-200 text-gray-500" : ""}
                `}
              >
                {isCompleted && !isActive ? (
                  <Check className="h-4 w-4" />
                ) : (
                  step.number
                )}
              </div>
              <div className="hidden sm:flex flex-col">
                <span
                  className={`text-xs font-medium leading-tight ${
                    isActive ? "text-garces-cherry" : isCompleted ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {step.title}
                </span>
              </div>
            </div>
            {/* Arrow separator */}
            {idx < STEPS.length - 1 && (
              <ChevronRight
                className={`h-4 w-4 mx-2 ${
                  completedSteps.has(step.number) ? "text-green-400" : "text-gray-300"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main wizard                                                         */
/* ------------------------------------------------------------------ */

export function PlantWizard({ open, onClose }: PlantWizardProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({ ...INITIAL_DATA });
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // ---- Lookup queries ----
  const { data: especies } = useQuery({
    queryKey: ["lookup", "especies"],
    queryFn: () => mantenedorService("especies").list(),
    staleTime: 5 * 60_000,
  });
  const { data: variedades } = useQuery({
    queryKey: ["lookup", "variedades"],
    queryFn: () => mantenedorService("variedades").list(),
    staleTime: 5 * 60_000,
  });
  const { data: portainjertos } = useQuery({
    queryKey: ["lookup", "portainjertos"],
    queryFn: () => mantenedorService("portainjertos").list(),
    staleTime: 5 * 60_000,
  });
  const { data: pmgs } = useQuery({
    queryKey: ["lookup", "pmg"],
    queryFn: () => mantenedorService("pmg").list(),
    staleTime: 5 * 60_000,
  });
  const { data: viveros } = useQuery({
    queryKey: ["lookup", "viveros"],
    queryFn: () => mantenedorService("viveros").list(),
    staleTime: 5 * 60_000,
  });
  const { data: bodegas } = useQuery({
    queryKey: ["lookup", "bodegas"],
    queryFn: () => mantenedorService("bodegas").list(),
    staleTime: 5 * 60_000,
  });

  // ---- Derived option lists ----
  const espOpts = useMemo(
    () => ((especies || []) as any[]).map((e) => ({ value: e.id_especie, label: e.nombre })),
    [especies]
  );

  // Variedades filtered by selected especie AND optionally by PMG
  const varOpts = useMemo(() => {
    let all = (variedades || []) as any[];
    if (data.id_especie) {
      all = all.filter((v) => String(v.id_especie) === String(data.id_especie));
    }
    if (data.id_pmg) {
      all = all.filter((v) => String(v.id_pmg) === String(data.id_pmg));
    }
    return all.map((v) => ({ value: v.id_variedad, label: v.nombre, id_pmg: v.id_pmg }));
  }, [variedades, data.id_especie, data.id_pmg]);

  const piOpts = useMemo(
    () => ((portainjertos || []) as any[]).map((p) => ({ value: p.id_portainjerto, label: p.nombre })),
    [portainjertos]
  );

  const pmgOpts = useMemo(
    () => ((pmgs || []) as any[]).map((p) => ({ value: p.id_pmg, label: p.nombre })),
    [pmgs]
  );

  const vivOpts = useMemo(
    () => ((viveros || []) as any[]).map((v) => ({ value: v.id_vivero, label: v.nombre })),
    [viveros]
  );

  const bodegaOpts = useMemo(
    () => ((bodegas || []) as any[]).map((b) => ({ value: b.id_bodega, label: b.nombre })),
    [bodegas]
  );

  // ---- Name resolution helpers ----
  const resolveName = (opts: { value: number; label: string }[], id: string) => {
    if (!id) return "-";
    const found = opts.find((o) => String(o.value) === String(id));
    return found ? found.label : "-";
  };

  const especieName = resolveName(espOpts, data.id_especie);
  const variedadName = resolveName(varOpts, data.id_variedad);
  const portainjertoName = resolveName(piOpts, data.id_portainjerto);
  const pmgName = resolveName(pmgOpts, data.id_pmg);
  const viveroName = resolveName(vivOpts, data.id_vivero);
  const bodegaName = resolveName(bodegaOpts, data.id_bodega);

  // ---- Auto-generate lote code suggestion ----
  const suggestLoteCode = () => {
    const varCode = variedadName !== "-" ? variedadName.slice(0, 6).toUpperCase().replace(/\s/g, "") : "VAR";
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    return `LOT-${varCode}-${dateStr}`;
  };

  // ---- Mutation ----
  const createMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => inventarioService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventario"] });
      queryClient.invalidateQueries({ queryKey: ["inventario", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["inventario", "por-bodega"] });
      queryClient.invalidateQueries({ queryKey: ["inventario", "disponible"] });
      toast.success("Lote creado exitosamente");
      handleClose();
    },
    onError: () => {
      toast.error("Error al crear el lote");
    },
  });

  // ---- Field update helper ----
  const set = (key: keyof WizardData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  // ---- Auto-fill PMG when variedad changes ----
  const handleVariedadChange = (value: string) => {
    set("id_variedad", value);
    // Try to auto-fill PMG from the selected variedad
    const selected = varOpts.find((v) => String(v.value) === value);
    if (selected?.id_pmg && !data.id_pmg) {
      set("id_pmg", String(selected.id_pmg));
    }
  };

  // ---- When PMG changes, clear variedad if it doesn't match ----
  const handlePmgChange = (value: string) => {
    set("id_pmg", value);
    // Check if current variedad belongs to this PMG
    if (data.id_variedad) {
      const allVars = (variedades || []) as any[];
      const currentVar = allVars.find((v) => String(v.id_variedad) === data.id_variedad);
      if (currentVar && String(currentVar.id_pmg) !== value) {
        set("id_variedad", "");
      }
    }
  };

  // ---- When especie changes, clear variedad if it doesn't match ----
  const handleEspecieChange = (value: string) => {
    set("id_especie", value);
    // Check if current variedad still belongs to new especie
    const validVariedades = ((variedades || []) as any[]).filter(
      (v) => String(v.id_especie) === value
    );
    const currentStillValid = validVariedades.some(
      (v) => String(v.id_variedad) === data.id_variedad
    );
    if (!currentStillValid) {
      set("id_variedad", "");
      set("id_pmg", "");
    }
  };

  // ---- Validation ----
  const step1Valid = !!data.id_especie && (!!data.id_variedad || !!data.id_portainjerto);
  const step2Valid = !!data.codigo_lote && !!data.cantidad_inicial && Number(data.cantidad_inicial) > 0;

  // ---- Navigation ----
  const goNext = () => {
    setCompletedSteps((prev) => new Set(prev).add(step));
    setStep((s) => Math.min(s + 1, 3));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleClose = () => {
    setStep(1);
    setData({ ...INITIAL_DATA });
    setCompletedSteps(new Set());
    onClose();
  };

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {
      codigo_lote: data.codigo_lote,
      id_especie: Number(data.id_especie) || null,
      id_variedad: Number(data.id_variedad) || null,
      id_portainjerto: Number(data.id_portainjerto) || null,
      id_pmg: data.id_pmg ? Number(data.id_pmg) : null,
      id_vivero: data.id_vivero ? Number(data.id_vivero) : null,
      id_bodega: data.id_bodega ? Number(data.id_bodega) : null,
      tipo_planta: data.tipo_planta || null,
      tipo_injertacion: data.tipo_injerto || null,
      cantidad_inicial: Number(data.cantidad_inicial),
      cantidad_actual: Number(data.cantidad_inicial),
      fecha_ingreso: data.fecha_ingreso,
      observaciones: data.observaciones || null,
    };
    createMut.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-garces-cherry">
            <Leaf className="h-5 w-5" />
            Nueva Planta / Lote
          </DialogTitle>
          <DialogDescription>
            Asistente para crear un nuevo lote de plantas en inventario.
          </DialogDescription>
        </DialogHeader>

        <StepIndicator currentStep={step} completedSteps={completedSteps} />

        {/* ============================================================ */}
        {/* STEP 1 — Define the plant type                               */}
        {/* ============================================================ */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="bg-garces-cherry-pale/50 rounded-lg p-3 border border-garces-cherry-pale">
              <p className="text-sm text-garces-cherry-dark font-medium">
                Paso 1: Define la planta. Al menos Variedad o Portainjerto es requerido.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Especie */}
              <div>
                <Label htmlFor="wiz-especie">
                  Especie <span className="text-destructive">*</span>
                </Label>
                <Select value={data.id_especie} onValueChange={handleEspecieChange}>
                  <SelectTrigger className="mt-1" id="wiz-especie">
                    <SelectValue placeholder="Seleccionar especie" />
                  </SelectTrigger>
                  <SelectContent>
                    {espOpts.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Variedad — filtered by especie */}
              <div>
                <Label htmlFor="wiz-variedad">
                  Variedad
                </Label>
                <Select
                  value={data.id_variedad}
                  onValueChange={handleVariedadChange}
                  disabled={!data.id_especie}
                >
                  <SelectTrigger className="mt-1" id="wiz-variedad">
                    <SelectValue
                      placeholder={
                        data.id_especie
                          ? `Seleccionar variedad (${varOpts.length})`
                          : "Selecciona especie primero"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {varOpts.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Portainjerto */}
              <div>
                <Label htmlFor="wiz-pi">
                  Portainjerto
                </Label>
                <Select value={data.id_portainjerto} onValueChange={(v) => set("id_portainjerto", v)}>
                  <SelectTrigger className="mt-1" id="wiz-pi">
                    <SelectValue placeholder="Seleccionar portainjerto" />
                  </SelectTrigger>
                  <SelectContent>
                    {piOpts.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* PMG (optional) */}
              <div>
                <Label htmlFor="wiz-pmg">PMG (opcional)</Label>
                <Select value={data.id_pmg} onValueChange={handlePmgChange}>
                  <SelectTrigger className="mt-1" id="wiz-pmg">
                    <SelectValue placeholder="Filtrar variedades por PMG" />
                  </SelectTrigger>
                  <SelectContent>
                    {pmgOpts.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview card */}
            {(data.id_variedad || data.id_portainjerto) && (
              <div className="bg-white border-2 border-garces-cherry/20 rounded-lg p-4 mt-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Planta definida
                </p>
                <p className="text-base font-semibold text-garces-cherry">
                  {variedadName !== "-" ? variedadName : "Sin variedad"}
                  {portainjertoName !== "-" && (
                    <><span className="text-gray-400 font-normal mx-1">&times;</span>{portainjertoName}</>
                  )}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {especieName}
                  {pmgName !== "-" && (
                    <span className="ml-2 text-xs bg-garces-cherry-pale text-garces-cherry px-2 py-0.5 rounded-full">
                      PMG: {pmgName}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={goNext} disabled={!step1Valid}>
                Siguiente <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2 — Define the batch (lote)                             */}
        {/* ============================================================ */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="bg-garces-cherry-pale/50 rounded-lg p-3 border border-garces-cherry-pale">
              <p className="text-sm text-garces-cherry-dark font-medium">
                Paso 2: Configura el lote. Cada unidad en el lote es una planta de tipo{" "}
                <span className="font-bold">
                  {variedadName !== "-" ? variedadName : ""}
                  {variedadName !== "-" && portainjertoName !== "-" ? " × " : ""}
                  {portainjertoName !== "-" ? portainjertoName : ""}
                </span>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Código Lote */}
              <div className="sm:col-span-2">
                <Label htmlFor="wiz-codigo">
                  Código Lote <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="wiz-codigo"
                    value={data.codigo_lote}
                    onChange={(e) => set("codigo_lote", e.target.value)}
                    placeholder="Ej: LOT-CHERRY-240301"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => set("codigo_lote", suggestLoteCode())}
                  >
                    Auto
                  </Button>
                </div>
              </div>

              {/* Cantidad */}
              <div>
                <Label htmlFor="wiz-cantidad">
                  Cantidad de plantas <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="wiz-cantidad"
                  type="number"
                  min={1}
                  className="mt-1"
                  value={data.cantidad_inicial}
                  onChange={(e) => set("cantidad_inicial", e.target.value)}
                  placeholder="Ej: 500"
                />
              </div>

              {/* Tipo planta */}
              <div>
                <Label htmlFor="wiz-tipo">Tipo Planta</Label>
                <Select value={data.tipo_planta} onValueChange={(v) => set("tipo_planta", v)}>
                  <SelectTrigger className="mt-1" id="wiz-tipo">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TERMINADA_RAIZ_DESNUDA">Terminada raíz desnuda</SelectItem>
                    <SelectItem value="TERMINADA_MACETA_BOLSA">Terminada maceta/bolsa</SelectItem>
                    <SelectItem value="INJERTACION_TERRENO">Injertación en terreno</SelectItem>
                    <SelectItem value="PLANTA_TERMINADA">Planta terminada</SelectItem>
                    <SelectItem value="RAMILLAS">Ramillas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo injerto */}
              <div>
                <Label htmlFor="wiz-injerto">Tipo Injerto</Label>
                <Select value={data.tipo_injerto || ""} onValueChange={(v) => set("tipo_injerto", v)}>
                  <SelectTrigger className="mt-1" id="wiz-injerto">
                    <SelectValue placeholder="Seleccionar tipo injerto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OJO_VIVO">Ojo vivo</SelectItem>
                    <SelectItem value="OJO_DORMIDO">Ojo dormido</SelectItem>
                    <SelectItem value="INVIERNO_PUA">Invierno (pua)</SelectItem>
                    <SelectItem value="VERANO_YEMA">Verano (yema)</SelectItem>
                    <SelectItem value="EN_TERRENO">En terreno</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Vivero origen */}
              <div>
                <Label htmlFor="wiz-vivero">Vivero Origen</Label>
                <Select value={data.id_vivero} onValueChange={(v) => set("id_vivero", v)}>
                  <SelectTrigger className="mt-1" id="wiz-vivero">
                    <SelectValue placeholder="Seleccionar vivero" />
                  </SelectTrigger>
                  <SelectContent>
                    {vivOpts.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bodega destino */}
              <div>
                <Label htmlFor="wiz-bodega">Bodega Destino</Label>
                <Select value={data.id_bodega} onValueChange={(v) => set("id_bodega", v)}>
                  <SelectTrigger className="mt-1" id="wiz-bodega">
                    <SelectValue placeholder="Seleccionar bodega" />
                  </SelectTrigger>
                  <SelectContent>
                    {bodegaOpts.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                        Sin bodegas disponibles. Cree una bodega primero.
                      </div>
                    ) : (
                      bodegaOpts.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>
                          {o.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha ingreso */}
              <div>
                <Label htmlFor="wiz-fecha">Fecha Ingreso</Label>
                <Input
                  id="wiz-fecha"
                  type="date"
                  className="mt-1"
                  value={data.fecha_ingreso}
                  onChange={(e) => set("fecha_ingreso", e.target.value)}
                />
              </div>

              {/* Observaciones */}
              <div className="sm:col-span-2">
                <Label htmlFor="wiz-obs">Observaciones</Label>
                <textarea
                  id="wiz-obs"
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[70px]"
                  value={data.observaciones}
                  onChange={(e) => set("observaciones", e.target.value)}
                  placeholder="Notas adicionales sobre el lote..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={goBack}>
                Atras
              </Button>
              <Button onClick={goNext} disabled={!step2Valid}>
                Siguiente <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3 — Review & confirm                                    */}
        {/* ============================================================ */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="bg-garces-cherry-pale/50 rounded-lg p-3 border border-garces-cherry-pale">
              <p className="text-sm text-garces-cherry-dark font-medium">
                Paso 3: Revisa los datos antes de crear el lote.
              </p>
            </div>

            {/* Plant type card */}
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="bg-garces-cherry-pale/30 px-4 py-2 border-b">
                <p className="text-xs font-semibold text-garces-cherry uppercase tracking-wide flex items-center gap-1.5">
                  <Sprout className="h-3.5 w-3.5" /> Planta
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-lg font-bold text-foreground">
                  {variedadName} <span className="text-gray-400 font-normal mx-1">&times;</span> {portainjertoName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Especie: {especieName}
                  {pmgName !== "-" && <span className="ml-3">PMG: {pmgName}</span>}
                </p>
              </div>
            </div>

            {/* Batch details card */}
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="bg-garces-cherry-pale/30 px-4 py-2 border-b">
                <p className="text-xs font-semibold text-garces-cherry uppercase tracking-wide flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Lote
                </p>
              </div>
              <div className="px-4 py-3 space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <div>
                    <span className="text-muted-foreground">Codigo:</span>{" "}
                    <span className="font-medium">{data.codigo_lote}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cantidad:</span>{" "}
                    <span className="font-bold text-garces-cherry">{data.cantidad_inicial} plantas</span>
                  </div>
                  {data.tipo_planta && (
                    <div>
                      <span className="text-muted-foreground">Tipo planta:</span>{" "}
                      <span className="font-medium">{data.tipo_planta}</span>
                    </div>
                  )}
                  {data.tipo_injerto && (
                    <div>
                      <span className="text-muted-foreground">Tipo injerto:</span>{" "}
                      <span className="font-medium">{data.tipo_injerto}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Fecha ingreso:</span>{" "}
                    <span className="font-medium">{data.fecha_ingreso}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Origin / Destination card */}
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="bg-garces-cherry-pale/30 px-4 py-2 border-b">
                <p className="text-xs font-semibold text-garces-cherry uppercase tracking-wide flex items-center gap-1.5">
                  <Leaf className="h-3.5 w-3.5" /> Origen y Destino
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm">
                  <span className="text-muted-foreground">Vivero:</span>{" "}
                  <span className="font-medium">{viveroName !== "-" ? viveroName : "No especificado"}</span>
                  <span className="mx-2 text-gray-300">&rarr;</span>
                  <span className="text-muted-foreground">Bodega:</span>{" "}
                  <span className="font-medium">{bodegaName !== "-" ? bodegaName : "No especificada"}</span>
                </p>
              </div>
            </div>

            {data.observaciones && (
              <div className="bg-gray-50 border rounded-lg px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Observaciones</p>
                <p className="text-sm">{data.observaciones}</p>
              </div>
            )}

            {/* Green confirmation panel */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full shrink-0">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Listo para crear</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    Se creara un lote con{" "}
                    <span className="font-bold">{data.cantidad_inicial}</span> plantas de tipo{" "}
                    <span className="font-bold">{variedadName} &times; {portainjertoName}</span>.
                    Las plantas individuales se registraran cuando se planten en un testblock (alta).
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={goBack}>
                Atras
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMut.isPending}
                className="bg-garces-cherry hover:bg-garces-cherry-light"
              >
                {createMut.isPending ? "Creando..." : "Crear Lote"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
