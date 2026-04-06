import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Pencil, Trash2, Search, ChevronDown, ChevronRight,
  ListChecks, GripVertical, Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrudForm } from "@/components/shared/CrudForm";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useCrud } from "@/hooks/useCrud";
import { get, post, put, del } from "@/services/api";
import type { FieldDef } from "@/types";

/* ─── Types ──────────────────────────────────────────────────────────── */

interface TipoLabor {
  id_labor: number;
  codigo: string;
  nombre: string;
  categoria?: string;
  descripcion?: string;
  aplica_especies?: string;
  aplica_a?: string;
  frecuencia?: string;
  activo?: boolean;
}

interface DetalleLabor {
  id_detalle: number;
  id_labor: number;
  descripcion: string;
  aplica_especie?: string;
  orden?: number;
  es_checklist?: boolean;
  activo?: boolean;
}

/* ─── Fields for tipos_labor form ─────────────────────────────────── */

const laborFields: FieldDef[] = [
  { key: "codigo", label: "Codigo", type: "text", required: true },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "categoria", label: "Categoria", type: "select", options: [
    { value: "manejo", label: "Manejo" },
    { value: "fitosanidad", label: "Fitosanidad" },
    { value: "riego", label: "Riego" },
    { value: "cosecha", label: "Cosecha" },
    { value: "fenologia", label: "Fenologia" },
    { value: "poda", label: "Poda" },
    { value: "fertilizacion", label: "Fertilizacion" },
  ]},
  { key: "aplica_a", label: "Aplica a", type: "select", options: [
    { value: "planta", label: "Planta" },
    { value: "hilera", label: "Hilera" },
    { value: "testblock", label: "TestBlock" },
  ]},
  { key: "aplica_especies", label: "Aplica Especies", type: "text" },
  { key: "frecuencia", label: "Frecuencia", type: "text" },
  { key: "descripcion", label: "Descripcion", type: "textarea" },
];

const detalleFields: FieldDef[] = [
  { key: "descripcion", label: "Descripcion / Instruccion", type: "textarea", required: true },
  { key: "aplica_especie", label: "Aplica a especie", type: "text" },
  { key: "orden", label: "Orden", type: "number" },
  { key: "es_checklist", label: "Es checklist", type: "boolean" },
];

/* ─── Categoria color badge ──────────────────────────────────────── */

const CAT_COLORS: Record<string, string> = {
  manejo: "bg-blue-100 text-blue-800",
  fitosanidad: "bg-green-100 text-green-800",
  riego: "bg-cyan-100 text-cyan-800",
  cosecha: "bg-amber-100 text-amber-800",
  fenologia: "bg-purple-100 text-purple-800",
  poda: "bg-orange-100 text-orange-800",
  fertilizacion: "bg-lime-100 text-lime-800",
};

/* ─── Component ──────────────────────────────────────────────────── */

export function TiposLaborPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, create, update, remove, isCreating, isUpdating } = useCrud("tipos-labor");
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [detalleFormOpen, setDetalleFormOpen] = useState(false);
  const [editDetalle, setEditDetalle] = useState<DetalleLabor | null>(null);

  const rows = (data || []) as TipoLabor[];
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      r.nombre.toLowerCase().includes(q) ||
      r.codigo.toLowerCase().includes(q) ||
      (r.categoria || "").toLowerCase().includes(q) ||
      (r.aplica_especies || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  // Detalles query for expanded labor
  const { data: detalles, isLoading: detallesLoading } = useQuery({
    queryKey: ["detalles-labor", expandedId],
    queryFn: () => get<DetalleLabor[]>(`/labores/tipos-labor/${expandedId}/detalles`),
    enabled: expandedId != null,
  });

  const addDetalleMut = useMutation({
    mutationFn: (d: Record<string, unknown>) =>
      post<DetalleLabor>(`/labores/tipos-labor/${expandedId}/detalles`, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["detalles-labor", expandedId] });
      toast.success("Detalle agregado");
    },
  });

  const updateDetalleMut = useMutation({
    mutationFn: ({ id, data: d }: { id: number; data: Record<string, unknown> }) =>
      put<DetalleLabor>(`/labores/detalles-labor/${id}`, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["detalles-labor", expandedId] });
      toast.success("Detalle actualizado");
    },
  });

  const deleteDetalleMut = useMutation({
    mutationFn: (id: number) => del<unknown>(`/labores/detalles-labor/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["detalles-labor", expandedId] });
      toast.success("Detalle eliminado");
    },
  });

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (editRow) {
      await update({ id: editRow.id_labor as number, data: formData });
    } else {
      await create(formData);
    }
  };

  const handleDetalleSubmit = async (formData: Record<string, unknown>) => {
    if (editDetalle) {
      await updateDetalleMut.mutateAsync({ id: editDetalle.id_detalle, data: formData });
    } else {
      await addDetalleMut.mutateAsync(formData);
    }
  };

  // Group detalles by especie
  const detallesByEspecie = useMemo(() => {
    if (!detalles) return {};
    const grouped: Record<string, DetalleLabor[]> = {};
    for (const d of detalles) {
      const key = d.aplica_especie || "General";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(d);
    }
    return grouped;
  }, [detalles]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/catalogos")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-garces-cherry">Tipos de Labor</h2>
            <p className="text-xs text-muted-foreground">{rows.length} registros</p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setEditRow(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nueva Labor
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar labor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Sin tipos de labor{search ? ` para "${search}"` : ""}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((labor) => {
            const isExpanded = expandedId === labor.id_labor;
            return (
              <div key={labor.id_labor} className="bg-white rounded-lg border overflow-hidden">
                {/* Labor row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : labor.id_labor)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{labor.nombre}</span>
                      <span className="text-xs font-mono bg-garces-cherry/10 text-garces-cherry px-1.5 py-0.5 rounded">
                        {labor.codigo}
                      </span>
                      {labor.categoria && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[labor.categoria] || "bg-gray-100 text-gray-800"}`}>
                          {labor.categoria}
                        </span>
                      )}
                      {labor.aplica_a && (
                        <span className="text-xs text-muted-foreground">
                          {labor.aplica_a}
                        </span>
                      )}
                    </div>
                    {labor.descripcion && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{labor.descripcion}</p>
                    )}
                    {labor.aplica_especies && (
                      <div className="flex gap-1 mt-1">
                        {labor.aplica_especies.split(",").map((e) => (
                          <span key={e} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                            {e.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditRow(labor as unknown as Record<string, unknown>); setFormOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={async () => { if (confirm("Eliminar este tipo de labor?")) await remove(labor.id_labor); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded: detalles */}
                {isExpanded && (
                  <div className="border-t bg-muted/20 px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <ListChecks className="h-4 w-4" />
                        Instrucciones / Detalles ({detalles?.length ?? 0})
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditDetalle(null); setDetalleFormOpen(true); }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                      </Button>
                    </div>

                    {detallesLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando detalles...
                      </div>
                    ) : !detalles || detalles.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Sin instrucciones. Agregue la primera.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {Object.entries(detallesByEspecie).map(([especie, items]) => (
                          <div key={especie}>
                            <h5 className="text-xs font-semibold text-garces-cherry mb-1.5 uppercase tracking-wide">
                              {especie}
                            </h5>
                            <div className="space-y-1">
                              {items.map((d, idx) => (
                                <div
                                  key={d.id_detalle}
                                  className="flex items-start gap-2 bg-white rounded-md border px-3 py-2 group"
                                >
                                  <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                                  <span className="text-xs text-muted-foreground font-mono w-5 shrink-0 mt-0.5">
                                    {idx + 1}.
                                  </span>
                                  <p className="text-sm flex-1">{d.descripcion}</p>
                                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <Button
                                      variant="ghost" size="icon" className="h-6 w-6"
                                      onClick={() => { setEditDetalle(d); setDetalleFormOpen(true); }}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                      onClick={async () => {
                                        if (confirm("Eliminar este detalle?")) {
                                          await deleteDetalleMut.mutateAsync(d.id_detalle);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Labor form */}
      <CrudForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        fields={laborFields}
        initialData={editRow}
        title={editRow ? "Editar Tipo de Labor" : "Nuevo Tipo de Labor"}
        isLoading={isCreating || isUpdating}
      />

      {/* Detalle form */}
      <CrudForm
        open={detalleFormOpen}
        onClose={() => setDetalleFormOpen(false)}
        onSubmit={handleDetalleSubmit}
        fields={detalleFields}
        initialData={editDetalle as unknown as Record<string, unknown> | null}
        title={editDetalle ? "Editar Instruccion" : "Nueva Instruccion"}
        isLoading={addDetalleMut.isPending || updateDetalleMut.isPending}
      />
    </div>
  );
}
