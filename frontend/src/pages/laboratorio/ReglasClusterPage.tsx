import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Database, Save, ChevronDown, ChevronRight, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { laboratorioService, type ReglaCluster } from "@/services/laboratorio";

// ── Metric configuration ───────────────────────────────────────────────
const METRICS = [
  { key: "brix", label: "Brix", unit: "\u00b0Bx", step: "0.1", inverted: false },
  { key: "mejillas", label: "Firmeza Mejillas", unit: "lb", step: "0.1", inverted: false },
  { key: "punto", label: "Firmeza Punto D\u00e9bil", unit: "lb", step: "0.1", inverted: false },
  { key: "acidez", label: "Acidez", unit: "%", step: "0.01", inverted: true },
] as const;

const BAND_COLORS = [
  { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", label: "Banda 1", tag: "Excelente" },
  { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", label: "Banda 2", tag: "Bueno" },
  { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", label: "Banda 3", tag: "Regular" },
  { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", label: "Banda 4", tag: "Deficiente" },
];

// ── Types for local editing state ──────────────────────────────────────
type EditableFields = {
  nombre: string;
  brix_b1: number; brix_b2: number; brix_b3: number;
  mejillas_b1: number; mejillas_b2: number; mejillas_b3: number;
  punto_b1: number; punto_b2: number; punto_b3: number;
  acidez_b1: number; acidez_b2: number; acidez_b3: number;
  cluster1_max: number; cluster2_max: number; cluster3_max: number;
  notas: string;
};

function reglaToEditable(r: ReglaCluster): EditableFields {
  return {
    nombre: r.nombre ?? "",
    brix_b1: r.brix_b1 ?? 0, brix_b2: r.brix_b2 ?? 0, brix_b3: r.brix_b3 ?? 0,
    mejillas_b1: r.mejillas_b1 ?? 0, mejillas_b2: r.mejillas_b2 ?? 0, mejillas_b3: r.mejillas_b3 ?? 0,
    punto_b1: r.punto_b1 ?? 0, punto_b2: r.punto_b2 ?? 0, punto_b3: r.punto_b3 ?? 0,
    acidez_b1: r.acidez_b1 ?? 0, acidez_b2: r.acidez_b2 ?? 0, acidez_b3: r.acidez_b3 ?? 0,
    cluster1_max: r.cluster1_max ?? 5, cluster2_max: r.cluster2_max ?? 8, cluster3_max: r.cluster3_max ?? 11,
    notas: r.notas ?? "",
  };
}

// ── Single rule card ───────────────────────────────────────────────────
function ReglaCard({ regla }: { regla: ReglaCluster }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<EditableFields>(() => reglaToEditable(regla));
  const [dirty, setDirty] = useState(false);

  const updateField = useCallback((field: keyof EditableFields, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  }, []);

  const mutation = useMutation({
    mutationFn: (data: Partial<ReglaCluster>) =>
      laboratorioService.updateReglaCluster(regla.id, data),
    onSuccess: () => {
      toast.success(`Regla "${regla.nombre}" actualizada`);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["reglas-cluster"] });
    },
  });

  const handleSave = () => {
    const payload: Record<string, unknown> = {};
    // Only send changed numeric fields
    const numFields = [
      "brix_b1", "brix_b2", "brix_b3",
      "mejillas_b1", "mejillas_b2", "mejillas_b3",
      "punto_b1", "punto_b2", "punto_b3",
      "acidez_b1", "acidez_b2", "acidez_b3",
      "cluster1_max", "cluster2_max", "cluster3_max",
    ] as const;

    for (const f of numFields) {
      const newVal = Number(form[f]);
      const oldVal = Number(regla[f as keyof ReglaCluster] ?? 0);
      if (newVal !== oldVal) {
        payload[f] = newVal;
      }
    }
    if (form.nombre !== regla.nombre) payload.nombre = form.nombre;
    if (form.notas !== (regla.notas ?? "")) payload.notas = form.notas;

    if (Object.keys(payload).length === 0) {
      toast.info("Sin cambios para guardar");
      return;
    }

    mutation.mutate(payload as Partial<ReglaCluster>);
  };

  // Derive especie group from codigo_regla
  const especieGroup = regla.codigo_regla.split("_")[0];
  const especieColors: Record<string, string> = {
    ciruela: "bg-purple-100 text-purple-700",
    nectarina: "bg-amber-100 text-amber-700",
    durazno: "bg-rose-100 text-rose-700",
    paraguayo: "bg-lime-100 text-lime-700",
    platerina: "bg-sky-100 text-sky-700",
    damasco: "bg-orange-100 text-orange-700",
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader
        className="cursor-pointer select-none py-4"
        onClick={() => setExpanded(prev => !prev)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {expanded
              ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <CardTitle className="text-base truncate">{regla.nombre}</CardTitle>
            <Badge variant="secondary" className={`text-[10px] shrink-0 ${especieColors[especieGroup] ?? ""}`}>
              {especieGroup}
            </Badge>
          </div>
          <code className="text-xs text-muted-foreground font-mono shrink-0">{regla.codigo_regla}</code>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-6">
          {/* Nombre editable */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground w-20 shrink-0">Nombre</label>
            <Input
              value={form.nombre}
              onChange={e => updateField("nombre", e.target.value)}
              className="max-w-md"
            />
          </div>

          {/* Threshold grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-48">M\u00e9trica</th>
                  {BAND_COLORS.slice(0, 3).map((band, i) => (
                    <th key={i} className={`px-3 py-2 text-center rounded-t-md ${band.bg} ${band.text} font-medium min-w-[120px]`}>
                      {band.label}
                    </th>
                  ))}
                  <th className={`px-3 py-2 text-center rounded-t-md ${BAND_COLORS[3].bg} ${BAND_COLORS[3].text} font-medium min-w-[100px]`}>
                    {BAND_COLORS[3].label}
                  </th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map(metric => {
                  const b1Key = `${metric.key}_b1` as keyof EditableFields;
                  const b2Key = `${metric.key}_b2` as keyof EditableFields;
                  const b3Key = `${metric.key}_b3` as keyof EditableFields;
                  const op = metric.inverted ? "\u2264" : "\u2265";
                  const opElse = metric.inverted ? ">" : "<";

                  return (
                    <tr key={metric.key} className="border-t">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{metric.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {metric.inverted ? "Menor = mejor" : "Mayor = mejor"} ({metric.unit})
                        </div>
                      </td>
                      {[b1Key, b2Key, b3Key].map((fKey, bi) => (
                        <td key={fKey} className={`px-3 py-3 ${BAND_COLORS[bi].bg}`}>
                          <div className="flex items-center gap-1 justify-center">
                            <span className="text-xs text-muted-foreground">{op}</span>
                            <Input
                              type="number"
                              step={metric.step}
                              value={form[fKey]}
                              onChange={e => updateField(fKey, parseFloat(e.target.value) || 0)}
                              className="w-20 text-center h-8 text-sm"
                            />
                          </div>
                        </td>
                      ))}
                      <td className={`px-3 py-3 text-center ${BAND_COLORS[3].bg}`}>
                        <span className="text-xs text-muted-foreground">
                          {opElse} {form[b3Key]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cluster sum ranges */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Rangos de Cluster (suma de bandas)</h4>
            <div className="grid grid-cols-4 gap-3">
              <div className={`rounded-lg p-3 ${BAND_COLORS[0].bg} ${BAND_COLORS[0].border} border`}>
                <div className={`text-xs font-semibold ${BAND_COLORS[0].text}`}>Cluster 1 - Excelente</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">4 -</span>
                  <Input
                    type="number"
                    min={4}
                    max={16}
                    value={form.cluster1_max}
                    onChange={e => updateField("cluster1_max", parseInt(e.target.value) || 5)}
                    className="w-16 h-7 text-xs text-center"
                  />
                </div>
              </div>
              <div className={`rounded-lg p-3 ${BAND_COLORS[1].bg} ${BAND_COLORS[1].border} border`}>
                <div className={`text-xs font-semibold ${BAND_COLORS[1].text}`}>Cluster 2 - Bueno</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">{(form.cluster1_max ?? 5) + 1} -</span>
                  <Input
                    type="number"
                    min={4}
                    max={16}
                    value={form.cluster2_max}
                    onChange={e => updateField("cluster2_max", parseInt(e.target.value) || 8)}
                    className="w-16 h-7 text-xs text-center"
                  />
                </div>
              </div>
              <div className={`rounded-lg p-3 ${BAND_COLORS[2].bg} ${BAND_COLORS[2].border} border`}>
                <div className={`text-xs font-semibold ${BAND_COLORS[2].text}`}>Cluster 3 - Regular</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">{(form.cluster2_max ?? 8) + 1} -</span>
                  <Input
                    type="number"
                    min={4}
                    max={16}
                    value={form.cluster3_max}
                    onChange={e => updateField("cluster3_max", parseInt(e.target.value) || 11)}
                    className="w-16 h-7 text-xs text-center"
                  />
                </div>
              </div>
              <div className={`rounded-lg p-3 ${BAND_COLORS[3].bg} ${BAND_COLORS[3].border} border`}>
                <div className={`text-xs font-semibold ${BAND_COLORS[3].text}`}>Cluster 4 - Deficiente</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">{(form.cluster3_max ?? 11) + 1} - 16</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="flex items-start gap-3">
            <label className="text-sm font-medium text-muted-foreground w-20 shrink-0 pt-2">Notas</label>
            <textarea
              value={form.notas}
              onChange={e => updateField("notas", e.target.value)}
              rows={2}
              className="flex w-full max-w-lg rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Observaciones o notas sobre esta regla..."
            />
          </div>

          {/* Last modified info */}
          {regla.fecha_modificacion && (
            <p className="text-xs text-muted-foreground">
              Modificada: {new Date(regla.fecha_modificacion).toLocaleString("es-CL")}
              {regla.usuario_modificacion && ` por ${regla.usuario_modificacion}`}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t">
            <Button
              onClick={handleSave}
              disabled={!dirty || mutation.isPending}
              size="sm"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {mutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setForm(reglaToEditable(regla)); setDirty(false); }}
              >
                Descartar
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Main page ──────────────────────────────────────────────────────────
export function ReglasClusterPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");

  const { data: reglas, isLoading, error } = useQuery({
    queryKey: ["reglas-cluster"],
    queryFn: () => laboratorioService.reglasCluster(),
  });

  const seedMutation = useMutation({
    mutationFn: () => laboratorioService.seedReglasCluster(),
    onSuccess: (data) => {
      if (data.created > 0) {
        toast.success(`${data.created} reglas creadas desde valores por defecto`);
      } else {
        toast.info("Todas las reglas ya existian");
      }
      queryClient.invalidateQueries({ queryKey: ["reglas-cluster"] });
    },
  });

  const filteredReglas = (reglas ?? []).filter(r =>
    !filter || r.nombre.toLowerCase().includes(filter.toLowerCase()) ||
    r.codigo_regla.toLowerCase().includes(filter.toLowerCase())
  );

  // Group by especie
  const groups = filteredReglas.reduce<Record<string, ReglaCluster[]>>((acc, r) => {
    const group = r.codigo_regla.split("_")[0];
    const label = group.charAt(0).toUpperCase() + group.slice(1);
    if (!acc[label]) acc[label] = [];
    acc[label].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-muted-foreground" />
            Reglas de Clustering
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configuraci\u00f3n de umbrales para clasificaci\u00f3n de calidad por bandas (algoritmo Band-Sum)
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
        >
          <Database className="h-4 w-4 mr-1.5" />
          {seedMutation.isPending ? "Cargando..." : "Cargar desde valores por defecto"}
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <Info className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Algoritmo Band-Sum</p>
          <p className="mt-1 text-blue-700">
            Cada m\u00e9trica se clasifica en bandas 1-4 seg\u00fan los umbrales configurados.
            La suma de las 4 bandas (rango 4-16) determina el cluster final.
            Para m\u00e9tricas normales (brix, firmeza): mayor valor = mejor banda.
            Para acidez: menor valor = mejor banda (invertida).
          </p>
        </div>
      </div>

      {/* Search filter */}
      <div className="max-w-sm">
        <Input
          placeholder="Buscar regla..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {/* Loading / Error states */}
      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Cargando reglas...</div>
      )}
      {error && (
        <div className="text-center py-12 text-destructive">
          Error al cargar reglas: {(error as Error).message}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredReglas.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium">Sin reglas configuradas</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Use el bot\u00f3n "Cargar desde valores por defecto" para crear las reglas iniciales desde el sistema.
            </p>
            <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              <Database className="h-4 w-4 mr-1.5" />
              Cargar reglas por defecto
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Rules grouped by especie */}
      {Object.entries(groups).map(([groupLabel, rules]) => (
        <div key={groupLabel} className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            {groupLabel}
            <Badge variant="outline" className="text-xs font-normal">
              {rules.length} {rules.length === 1 ? "regla" : "reglas"}
            </Badge>
          </h2>
          {rules.map(regla => (
            <ReglaCard key={regla.id} regla={regla} />
          ))}
        </div>
      ))}
    </div>
  );
}
