import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Pencil, Trash2, Search, Plus, Loader2, Download, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CrudTableProps {
  data: any[];
  columns: ColumnDef<any, any>[];
  isLoading?: boolean;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onCreate?: () => void;
  createLabel?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  exportable?: boolean;
  exportFilename?: string;
}

function exportToCsv(data: any[], columns: ColumnDef<any, any>[], filename: string) {
  const headers = columns
    .filter((c: any) => c.accessorKey)
    .map((c: any) => String(c.header || c.accessorKey));
  const keys = columns
    .filter((c: any) => c.accessorKey)
    .map((c: any) => c.accessorKey as string);
  const rows = data.map((row) =>
    keys.map((k) => {
      const val = row[k];
      if (val == null) return "";
      const str = String(val);
      return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CrudTable({
  data,
  columns: userColumns,
  isLoading,
  onEdit,
  onDelete,
  onCreate,
  createLabel = "Nuevo",
  searchPlaceholder = "Buscar...",
  pageSize = 15,
  exportable = true,
  exportFilename = "export",
}: CrudTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const columns = useMemo<ColumnDef<any, any>[]>(() => {
    const cols = [...userColumns];
    if (onEdit || onDelete) {
      cols.push({
        id: "actions",
        header: "",
        size: 80,
        cell: ({ row }) => (
          <div className="flex gap-1 justify-end">
            {onEdit && (
              <Button variant="ghost" size="icon" aria-label="Editar registro" onClick={() => onEdit(row.original)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="icon" aria-label="Eliminar registro" onClick={() => setDeleteTarget(row.original)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        ),
      });
    }
    return cols;
  }, [userColumns, onEdit, onDelete]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {table.getFilteredRowModel().rows.length}
            {globalFilter ? ` de ${data.length}` : ""} registros
          </span>
        </div>
        <div className="flex items-center gap-2">
          {exportable && data.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(data, userColumns, exportFilename)}
              title="Exportar a CSV"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {onCreate && (
            <Button onClick={onCreate} size="sm">
              <Plus className="h-4 w-4" />
              {createLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white overflow-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/50">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      "h-10 px-3 text-left font-medium text-muted-foreground",
                      header.column.getCanSort() && "cursor-pointer select-none"
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && <ArrowUpDown className="h-3 w-3" />}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Cargando...
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Inbox className="h-8 w-8 opacity-40" />
                    <span className="text-sm">{globalFilter ? "Sin resultados para la busqueda" : "Sin registros"}</span>
                    {globalFilter && (
                      <button
                        onClick={() => setGlobalFilter("")}
                        className="text-xs text-garces-cherry hover:underline"
                      >
                        Limpiar busqueda
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {table.getState().pagination.pageIndex * pageSize + 1}
            {" - "}
            {Math.min((table.getState().pagination.pageIndex + 1) * pageSize, table.getFilteredRowModel().rows.length)}
            {" de "}
            {table.getFilteredRowModel().rows.length} registros
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
              {"<<"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              Anterior
            </Button>
            <span className="px-2 text-xs font-medium">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Siguiente
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
              {">>"}
            </Button>
          </div>
        </div>
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
              onClick={() => {
                if (deleteTarget && onDelete) {
                  onDelete(deleteTarget);
                }
                setDeleteTarget(null);
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
