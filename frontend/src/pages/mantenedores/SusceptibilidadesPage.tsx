import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CrudTable } from "@/components/shared/CrudTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCrud } from "@/hooks/useCrud";
import { useLookups } from "@/hooks/useLookups";

const GRUPO_OPTIONS = [
  "Partiduras y Suturas", "Daños y Heridas", "Pudriciones", "Pudriciones y Blando",
  "Deshidrataciones", "Defectos de Calidad", "Calidad", "Condición", "Cerezas Amarillas",
];

export function SusceptibilidadesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, create, update, remove } = useCrud("susceptibilidades");
  const lk = useLookups();
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [selectedEspecies, setSelectedEspecies] = useState<number[]>([]);

  const rows = data as Record<string, unknown>[];

  const columns = [
    { accessorKey: "codigo", header: "Código" },
    { accessorKey: "nombre", header: "Nombre" },
    {
      accessorKey: "id_especie", header: "Especie",
      cell: ({ getValue }: any) => {
        const name = lk.especie(getValue());
        return name && name !== "-" ? (
          <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium">{name}</span>
        ) : "-";
      },
    },
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
      setFormOpen(false);
    } else {
      let created = 0;
      for (const espId of selectedEspecies) {
        const espObj = (lk.rawData.especies as any[] || []).find((e: any) => e.id_especie === espId);
        const espCode = espObj?.codigo || "XX";
        const code = selectedEspecies.length > 1 ? `${espCode}-${form.codigo}` : form.codigo;
        try {
          await create({ ...form, codigo: code, id_especie: espId });
          created++;
        } catch { /* skip duplicates */ }
      }
      toast.success(`${created} susceptibilidad${created > 1 ? "es creadas" : " creada"}`);
      setFormOpen(false);
    }
    queryClient.invalidateQueries({ queryKey: ["susceptibilidades"] });
  };

  const toggleEspecie = (id: number) => {
    setSelectedEspecies((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/catalogos")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="text-xl font-bold text-garces-cherry">Susceptibilidades</h2>
            <p className="text-xs text-muted-foreground">{rows.length} registros</p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nueva</Button>
      </div>

      <CrudTable
        data={rows}
        columns={columns as any}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={(row) => { if (confirm("Eliminar?")) remove((row as any).id_suscept); }}
        searchPlaceholder="Buscar susceptibilidad..."
      />

      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRow ? "Editar Susceptibilidad" : "Nueva Susceptibilidad"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Especies multi-select */}
            <div>
              <label className="text-sm font-medium block mb-1.5">
                Especies {!editRow && <span className="text-xs text-muted-foreground font-normal">(se crea una por cada especie)</span>}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(lk.options.especies || []).map((esp) => {
                  const sel = selectedEspecies.includes(esp.value as number);
                  return (
                    <button key={esp.value} type="button" onClick={() => toggleEspecie(esp.value as number)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        sel ? "bg-blue-100 text-blue-800 border-blue-300" : "bg-white text-muted-foreground border-gray-200 hover:border-blue-300"
                      }`}>
                      {sel && "✓ "}{esp.label}
                    </button>
                  );
                })}
              </div>
              {selectedEspecies.length === 0 && <p className="text-xs text-red-500 mt-1">Seleccione al menos una</p>}
            </div>

            {/* Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Código *</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.codigo || ""} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nombre *</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nombre (EN)</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.nombre_en || ""} onChange={(e) => setForm({ ...form, nombre_en: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Grupo *</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.grupo || ""} onChange={(e) => setForm({ ...form, grupo: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {GRUPO_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Severidad</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.severidad || ""} onChange={(e) => setForm({ ...form, severidad: e.target.value })}>
                  <option value="">-</option>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Orden</label>
                <input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.orden || ""} onChange={(e) => setForm({ ...form, orden: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Descripción</label>
              <textarea className="w-full border rounded px-2 py-1.5 text-sm resize-none" rows={2} value={form.descripcion || ""} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSubmit}>
                {editRow ? "Guardar" : `Crear${selectedEspecies.length > 1 ? ` (${selectedEspecies.length} especies)` : ""}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
