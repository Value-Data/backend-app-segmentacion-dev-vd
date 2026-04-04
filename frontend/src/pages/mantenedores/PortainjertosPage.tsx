import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, LayoutGrid, List, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrudTable } from "@/components/shared/CrudTable";
import { CrudForm } from "@/components/shared/CrudForm";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RelationshipChips, type ChipOption } from "@/components/shared/RelationshipChips";
import { useCrud } from "@/hooks/useCrud";
import { usePortainjertoEspecies } from "@/hooks/useRelaciones";
import { useLookups } from "@/hooks/useLookups";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type { FieldDef } from "@/types";
import { col } from "./GenericMantenedorPage";

type ViewMode = "cards" | "table";

const fields: FieldDef[] = [
  { key: "codigo", label: "Codigo", type: "text", required: true },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "vigor", label: "Vigor", type: "select", options: [
    { value: "bajo", label: "Bajo" },
    { value: "medio", label: "Medio" },
    { value: "alto", label: "Alto" },
  ]},
  { key: "origen", label: "Origen", type: "text" },
  { key: "cruce", label: "Cruce", type: "text" },
  { key: "tipo", label: "Tipo", type: "text" },
  { key: "patron", label: "Patron", type: "text" },
  { key: "propagacion", label: "Propagacion", type: "text" },
  { key: "obtentor", label: "Obtentor", type: "text" },
  { key: "ventajas", label: "Ventajas", type: "textarea" },
  { key: "notas", label: "Notas", type: "textarea" },
];

const columns = [
  col("codigo", "Codigo"),
  col("nombre", "Nombre"),
  col("vigor", "Vigor"),
  col("origen", "Origen"),
  col("tipo", "Tipo"),
];

function PortainjertoEspeciesChips({ portainjertoId }: { portainjertoId: number }) {
  const { currentIds, save, isSaving } = usePortainjertoEspecies(portainjertoId);
  const { options } = useLookups();

  const allOptions: ChipOption[] = options.especies.map((e) => ({
    id: e.value,
    label: e.label,
  }));

  // Enrich with color from rawData
  const { rawData } = useLookups();
  const optionsWithColor: ChipOption[] = allOptions.map((opt) => {
    const raw = (rawData.especies ?? []).find(
      (e) => (e as Record<string, unknown>).id_especie === opt.id
    ) as Record<string, unknown> | undefined;
    return {
      ...opt,
      color: (raw?.color_hex as string) ?? null,
    };
  });

  return (
    <RelationshipChips
      label="Especies compatibles"
      currentIds={currentIds}
      allOptions={optionsWithColor}
      onSave={save}
      isSaving={isSaving}
      compact
    />
  );
}

export function PortainjertosPage() {
  const navigate = useNavigate();
  const { data, isLoading, create, update, remove, isCreating, isUpdating } = useCrud("portainjertos");
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);

  const rows = data as Record<string, unknown>[];

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some(
        (v) => v != null && String(v).toLowerCase().includes(q)
      )
    );
  }, [rows, search]);

  const handleCreate = () => { setEditRow(null); setFormOpen(true); };
  const handleEdit = (row: Record<string, unknown>) => { setEditRow(row); setFormOpen(true); };
  const handleDelete = async (row: Record<string, unknown>) => {
    await remove(row.id_portainjerto as number);
    setDeleteTarget(null);
  };
  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (editRow) {
      await update({ id: editRow.id_portainjerto as number, data: formData });
    } else {
      await create(formData);
    }
  };

  const detailFields = fields.filter(
    (f) => !f.hidden && f.key !== "nombre" && f.key !== "codigo"
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/catalogos")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-garces-cherry">Portainjertos</h2>
            <p className="text-xs text-muted-foreground">{rows.length} registros</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-md p-0.5">
            <Button variant={viewMode === "cards" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setViewMode("cards")}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setViewMode("table")}>
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "table" ? (
        <CrudTable
          data={data}
          columns={columns}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={(row) => setDeleteTarget(row)}
          onCreate={handleCreate}
        />
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "Sin resultados para la busqueda" : "Sin registros. Cree el primero."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((row) => {
                const isActive = row.activo !== false && row.activo !== 0;
                return (
                  <div
                    key={String(row.id_portainjerto)}
                    className={`bg-white rounded-lg border hover:shadow-md transition-all group relative ${!isActive ? "opacity-60" : ""}`}
                  >
                    <div className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">{String(row.nombre || "-")}</h3>
                          {row.codigo != null && (
                            <span className="inline-block mt-0.5 text-xs bg-garces-cherry/10 text-garces-cherry px-1.5 py-0.5 rounded font-mono">
                              {String(row.codigo)}
                            </span>
                          )}
                        </div>
                        {!isActive && <StatusBadge status="inactivo" />}
                      </div>

                      {/* Especies chips */}
                      <PortainjertoEspeciesChips portainjertoId={row.id_portainjerto as number} />

                      {/* Detail fields */}
                      <div className="space-y-1">
                        {detailFields.slice(0, 3).map((f) => {
                          const val = row[f.key];
                          if (val == null || val === "") return null;
                          return (
                            <div key={f.key} className="flex items-center text-xs gap-1.5">
                              <span className="text-muted-foreground shrink-0">{f.label}:</span>
                              <span className="truncate font-medium">{String(val)}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 pt-1 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => handleEdit(row)}>
                          <Pencil className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs flex-1 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(row)}>
                          <Trash2 className="h-3 w-3 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteTarget != null} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar eliminacion</DialogTitle>
            <DialogDescription>Esta seguro de que desea eliminar este registro? Esta accion no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit form */}
      <CrudForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        fields={fields}
        initialData={editRow}
        title={editRow ? "Editar Portainjerto" : "Nuevo Portainjerto"}
        isLoading={isCreating || isUpdating}
      />
    </div>
  );
}
