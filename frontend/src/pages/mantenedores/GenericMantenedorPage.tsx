import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, LayoutGrid, List, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrudTable } from "@/components/shared/CrudTable";
import { CrudForm } from "@/components/shared/CrudForm";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useCrud } from "@/hooks/useCrud";
import { withCurrentValue } from "@/lib/utils";
import { get } from "@/services/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type { FieldDef } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";

type ViewMode = "cards" | "table";

interface GenericMantenedorPageProps {
  title: string;
  /** Singular form used for "Nuevo/Nueva" modal title. Falls back to title without trailing "s". */
  singularTitle?: string;
  /** Grammatical gender for the title: "m" → Nuevo, "f" → Nueva. Default "m". */
  titleGender?: "m" | "f";
  entidad: string;
  fields: FieldDef[];
  columns: ColumnDef<Record<string, unknown>, unknown>[];
  idField: string;
  params?: Record<string, string | number | boolean | undefined | null>;
  /** When true, auto-fetch next sequential code for new records. */
  autoCode?: boolean;
}

export function GenericMantenedorPage({
  title,
  singularTitle,
  titleGender = "m",
  entidad,
  fields,
  columns,
  idField,
  params,
  autoCode = false,
}: GenericMantenedorPageProps) {
  // Derive singular form: explicit prop > strip trailing "s" from title
  const singular = singularTitle ?? (title.endsWith("s") ? title.slice(0, -1) : title);
  const formTitlePrefix = titleGender === "f" ? "Nueva" : "Nuevo";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, create, update, remove, isCreating, isUpdating } = useCrud(entidad, params);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);

  const { data: nextCodeData } = useQuery({
    queryKey: ["nextCode", entidad],
    queryFn: () => get<{ codigo: string }>(`/mantenedores/${entidad}/next-code`),
    enabled: autoCode && formOpen && !editRow,
  });

  // Identify key fields for card display
  const nameField = fields.find((f) => f.key === "nombre") || fields[0];
  const codeField = fields.find((f) => f.key === "codigo");
  const colorField = fields.find((f) => f.type === "color");
  const detailFields = fields.filter(
    (f) => !f.hidden && f.key !== nameField?.key && f.key !== codeField?.key && f.key !== colorField?.key
  );

  const rows = data as Record<string, unknown>[];

  // Filter data by search
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some(
        (v) => v != null && String(v).toLowerCase().includes(q)
      )
    );
  }, [rows, search]);

  const handleCreate = () => {
    setEditRow(null);
    if (autoCode) queryClient.invalidateQueries({ queryKey: ["nextCode", entidad] });
    setFormOpen(true);
  };

  const handleEdit = (row: Record<string, unknown>) => {
    setEditRow(row);
    setFormOpen(true);
  };

  const handleDelete = async (row: Record<string, unknown>) => {
    await remove(row[idField] as number);
    setDeleteTarget(null);
  };

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (editRow) {
      await update({ id: editRow[idField] as number, data: formData });
    } else {
      await create(formData);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Volver a catalogos" onClick={() => navigate("/catalogos")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-garces-cherry">{title}</h2>
            <p className="text-xs text-muted-foreground">{rows.length} registros</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-muted rounded-md p-0.5">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("table")}
            >
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
        />
      ) : (
        <>
          {/* Search bar for cards view */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
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
                const name = row[nameField?.key || "nombre"];
                const code = codeField ? row[codeField.key] : null;
                const color = colorField ? (row[colorField.key] as string) : null;
                const isActive = row.activo !== false && row.activo !== 0;

                return (
                  <div
                    key={String(row[idField])}
                    className={`bg-white rounded-lg border hover:shadow-md transition-all group relative ${
                      !isActive ? "opacity-60" : ""
                    }`}
                  >
                    {/* Color accent bar */}
                    {color && (
                      <div
                        className="h-1.5 rounded-t-lg"
                        style={{ backgroundColor: color }}
                      />
                    )}

                    <div className="p-4 space-y-3">
                      {/* Card header: name + code */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">
                            {String(name || "-")}
                          </h3>
                          {code != null && (
                            <span className="inline-block mt-0.5 text-xs bg-garces-cherry/10 text-garces-cherry px-1.5 py-0.5 rounded font-mono">
                              {String(code)}
                            </span>
                          )}
                        </div>
                        {!isActive && <StatusBadge status="inactivo" />}
                      </div>

                      {/* Detail fields */}
                      <div className="space-y-1">
                        {detailFields.slice(0, 4).map((f) => {
                          const val = row[f.key];
                          if (val == null || val === "") return null;
                          return (
                            <div key={f.key} className="flex items-center text-xs gap-1.5">
                              <span className="text-muted-foreground shrink-0">{f.label}:</span>
                              <span className="truncate font-medium">
                                {f.type === "boolean"
                                  ? (val ? "Si" : "No")
                                  : String(val)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 pt-1 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs flex-1"
                          onClick={() => handleEdit(row)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs flex-1 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(row)}
                        >
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

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget != null} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar eliminacion</DialogTitle>
            <DialogDescription>
              Esta seguro de que desea eliminar este registro? Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit form */}
      <CrudForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        fields={editRow
          ? fields.map((f) =>
              f.type === "select" && f.options
                ? { ...f, options: withCurrentValue(f.options as { value: string; label: string }[], editRow[f.key]) }
                : f
            )
          : fields}
        initialData={editRow ?? (autoCode && nextCodeData ? { codigo: nextCodeData.codigo } : null)}
        title={editRow ? `Editar ${singular}` : `${formTitlePrefix} ${singular}`}
        isLoading={isCreating || isUpdating}
      />
    </div>
  );
}

// Helper to quickly create an accessor column
export function col<T = Record<string, unknown>>(key: string, header: string, opts?: Partial<ColumnDef<T, unknown>>): ColumnDef<T, unknown> {
  return {
    accessorKey: key,
    header,
    ...opts,
  } as ColumnDef<T, unknown>;
}

export function statusCol<T = Record<string, unknown>>(key: string, header: string): ColumnDef<T, unknown> {
  return {
    accessorKey: key,
    header,
    cell: ({ getValue }) => {
      const val = getValue() as string;
      return val ? <StatusBadge status={val} /> : "-";
    },
  } as ColumnDef<T, unknown>;
}

export function boolCol<T = Record<string, unknown>>(key: string, header: string): ColumnDef<T, unknown> {
  return {
    accessorKey: key,
    header,
    cell: ({ getValue }) => (getValue() ? "Si" : "No"),
  } as ColumnDef<T, unknown>;
}
