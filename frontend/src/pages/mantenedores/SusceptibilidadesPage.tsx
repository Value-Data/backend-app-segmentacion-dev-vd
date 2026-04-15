import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, LayoutGrid, List, Search, Pencil, Trash2, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrudTable } from "@/components/shared/CrudTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCrud } from "@/hooks/useCrud";
import { useLookups } from "@/hooks/useLookups";

const GRUPO_OPTIONS = [
  "Partiduras y Suturas", "Daños y Heridas", "Pudriciones", "Pudriciones y Blando",
  "Deshidrataciones", "Defectos de Calidad", "Calidad", "Condición", "Cerezas Amarillas",
];

const GRUPO_COLORS: Record<string, string> = {
  "Partiduras y Suturas": "border-red-300 bg-red-50",
  "Daños y Heridas": "border-orange-300 bg-orange-50",
  "Pudriciones": "border-rose-300 bg-rose-50",
  "Pudriciones y Blando": "border-rose-300 bg-rose-50",
  "Deshidrataciones": "border-amber-300 bg-amber-50",
  "Defectos de Calidad": "border-yellow-300 bg-yellow-50",
  "Calidad": "border-yellow-300 bg-yellow-50",
  "Condición": "border-blue-300 bg-blue-50",
  "Cerezas Amarillas": "border-amber-400 bg-amber-100",
};

const SEV_COLORS: Record<string, string> = {
  alta: "bg-red-500", media: "bg-amber-500", baja: "bg-green-500",
};

type ViewMode = "cards" | "table";

export function SusceptibilidadesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, create, update, remove } = useCrud("susceptibilidades");
  const lk = useLookups();
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [selectedEspecies, setSelectedEspecies] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [filterEspecie, setFilterEspecie] = useState<string>("todas");

  const rows = data as Record<string, unknown>[];

  // Filter
  const filtered = useMemo(() => {
    let list = rows.filter((r) => r.activo !== false);
    if (filterEspecie !== "todas") {
      list = list.filter((r) => String(r.id_especie) === filterEspecie);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        String(r.nombre || "").toLowerCase().includes(q) ||
        String(r.codigo || "").toLowerCase().includes(q) ||
        String(r.grupo || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, filterEspecie, search]);

  // Group by especie then grupo
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, Record<string, unknown>[]>>();
    for (const r of filtered) {
      const espName = lk.especie(r.id_especie as number) || "Sin especie";
      const grupo = (r.grupo as string) || "Sin grupo";
      if (!map.has(espName)) map.set(espName, new Map());
      const gmap = map.get(espName)!;
      if (!gmap.has(grupo)) gmap.set(grupo, []);
      gmap.get(grupo)!.push(r);
    }
    // Sort groups by orden within each
    for (const [, gmap] of map) {
      for (const [, items] of gmap) {
        items.sort((a, b) => ((a.orden as number) || 0) - ((b.orden as number) || 0));
      }
    }
    return map;
  }, [filtered, lk]);

  // Unique species for filter
  const especieOptions = useMemo(() => {
    const ids = new Set(rows.map((r) => r.id_especie as number).filter(Boolean));
    return Array.from(ids).map((id) => ({ value: String(id), label: lk.especie(id) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, lk]);

  const columns = [
    { accessorKey: "codigo", header: "Código" },
    { accessorKey: "nombre", header: "Nombre" },
    { accessorKey: "id_especie", header: "Especie", cell: ({ getValue }: any) => {
      const name = lk.especie(getValue());
      return name !== "-" ? <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium">{name}</span> : "-";
    }},
    { accessorKey: "grupo", header: "Grupo" },
    { accessorKey: "severidad", header: "Severidad", cell: ({ getValue }: any) => getValue() ? <StatusBadge status={getValue()} /> : "-" },
  ];

  const openCreate = () => {
    setEditRow(null);
    setForm({ codigo: "", nombre: "", nombre_en: "", grupo: "", severidad: "", orden: "", descripcion: "" });
    setSelectedEspecies([]);
    setFormOpen(true);
  };
  const openEdit = (row: Record<string, unknown>) => {
    setEditRow(row);
    setForm({ ...row });
    setSelectedEspecies(row.id_especie ? [row.id_especie as number] : []);
    setFormOpen(true);
  };
  const handleSubmit = async () => {
    if (!form.nombre) { toast.error("Nombre requerido"); return; }
    if (selectedEspecies.length === 0) { toast.error("Seleccione al menos una especie"); return; }
    if (editRow) {
      await update({ id: editRow.id_suscept as number, data: { ...form, id_especie: selectedEspecies[0] } });
    } else {
      let created = 0;
      for (const espId of selectedEspecies) {
        const espObj = (lk.rawData.especies as any[] || []).find((e: any) => e.id_especie === espId);
        const espCode = espObj?.codigo || "XX";
        const code = selectedEspecies.length > 1 ? `${espCode}-${form.codigo}` : form.codigo;
        try { await create({ ...form, codigo: code, id_especie: espId }); created++; } catch {}
      }
      if (created) toast.success(`${created} susceptibilidad${created > 1 ? "es creadas" : " creada"}`);
    }
    setFormOpen(false);
    queryClient.invalidateQueries({ queryKey: ["susceptibilidades"] });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/catalogos")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="text-xl font-bold text-garces-cherry">Susceptibilidades</h2>
            <p className="text-xs text-muted-foreground">{filtered.length} de {rows.length} registros</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-md p-0.5">
            <Button variant={viewMode === "cards" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setViewMode("cards")}><LayoutGrid className="h-3.5 w-3.5" /></Button>
            <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setViewMode("table")}><List className="h-3.5 w-3.5" /></Button>
          </div>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nueva</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilterEspecie("todas")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filterEspecie === "todas" ? "bg-garces-cherry text-white border-garces-cherry" : "bg-white text-muted-foreground border-gray-200 hover:border-garces-cherry"}`}>
            Todas
          </button>
          {especieOptions.map((e) => (
            <button key={e.value} onClick={() => setFilterEspecie(e.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filterEspecie === e.value ? "bg-blue-100 text-blue-800 border-blue-300" : "bg-white text-muted-foreground border-gray-200 hover:border-blue-300"}`}>
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table view */}
      {viewMode === "table" ? (
        <CrudTable data={filtered} columns={columns as any} isLoading={isLoading} onEdit={openEdit}
          onDelete={(row) => { if (confirm("Eliminar?")) remove((row as any).id_suscept); }}
          searchPlaceholder="Buscar..." />
      ) : (
        /* Cards view — grouped by especie then grupo */
        isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShieldAlert className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Sin susceptibilidades{search ? ` para "${search}"` : ""}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([espName, grupoMap]) => (
              <div key={espName}>
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-semibold">{espName}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {Array.from(grupoMap.values()).reduce((sum, items) => sum + items.length, 0)} susceptibilidades
                  </span>
                </h3>
                <div className="space-y-3">
                  {Array.from(grupoMap.entries()).map(([grupo, items]) => (
                    <div key={grupo} className={`rounded-lg border p-3 ${GRUPO_COLORS[grupo] || "border-gray-200 bg-gray-50"}`}>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{grupo} ({items.length})</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {items.map((s) => (
                          <div key={s.id_suscept as number}
                            className="bg-white rounded-md border border-white/80 px-3 py-2 flex items-center gap-2 hover:shadow-sm transition-shadow cursor-pointer group"
                            onClick={() => openEdit(s)}>
                            {s.severidad && (
                              <span className={`w-2 h-2 rounded-full shrink-0 ${SEV_COLORS[(s.severidad as string)] || "bg-gray-300"}`} title={`Severidad: ${s.severidad}`} />
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium truncate block">{s.nombre as string}</span>
                              {s.nombre_en && <span className="text-[10px] text-muted-foreground">{s.nombre_en as string}</span>}
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">{s.codigo as string}</span>
                            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editRow ? "Editar Susceptibilidad" : "Nueva Susceptibilidad"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">
                Especies {!editRow && <span className="text-xs text-muted-foreground font-normal">(se crea una por cada especie)</span>}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(lk.options.especies || []).map((esp) => {
                  const sel = selectedEspecies.includes(esp.value as number);
                  return (
                    <button key={esp.value} type="button" onClick={() => setSelectedEspecies(sel ? selectedEspecies.filter((x) => x !== esp.value) : [...selectedEspecies, esp.value as number])}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${sel ? "bg-blue-100 text-blue-800 border-blue-300" : "bg-white text-muted-foreground border-gray-200 hover:border-blue-300"}`}>
                      {sel && "✓ "}{esp.label}
                    </button>
                  );
                })}
              </div>
              {selectedEspecies.length === 0 && <p className="text-xs text-red-500 mt-1">Seleccione al menos una</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Código *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.codigo || ""} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Nombre *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Nombre (EN)</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.nombre_en || ""} onChange={(e) => setForm({ ...form, nombre_en: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Grupo *</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.grupo || ""} onChange={(e) => setForm({ ...form, grupo: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {GRUPO_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground">Severidad</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.severidad || ""} onChange={(e) => setForm({ ...form, severidad: e.target.value })}>
                  <option value="">-</option><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option>
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground">Orden</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.orden || ""} onChange={(e) => setForm({ ...form, orden: e.target.value ? Number(e.target.value) : null })} /></div>
            </div>
            <div><label className="text-xs text-muted-foreground">Descripción</label><textarea className="w-full border rounded px-2 py-1.5 text-sm resize-none" rows={2} value={form.descripcion || ""} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSubmit}>{editRow ? "Guardar" : `Crear${selectedEspecies.length > 1 ? ` (${selectedEspecies.length} especies)` : ""}`}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
