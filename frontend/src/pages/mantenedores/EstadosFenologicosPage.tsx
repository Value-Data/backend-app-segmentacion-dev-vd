import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Flower2, Loader2, Search, LayoutGrid, List } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrudForm } from "@/components/shared/CrudForm";
import { CrudTable } from "@/components/shared/CrudTable";
import { useCrud } from "@/hooks/useCrud";
import { mantenedorService } from "@/services/mantenedores";
import { useAuthStore } from "@/stores/authStore";
import type { FieldDef } from "@/types";
import type { Especie } from "@/types/maestras";
import type { EstadoFenologico } from "@/services/labores";

type ViewMode = "cards" | "table";

export function EstadosFenologicosPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.rol === "admin";

  const { data, isLoading, create, update, remove, isCreating, isUpdating } =
    useCrud("estados-fenologicos");

  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState("");
  const [activeEspecie, setActiveEspecie] = useState<number | "todas">("todas");
  const viewStorageKey = "catalog-view:estados-fenologicos";
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "cards";
    const s = window.localStorage.getItem(viewStorageKey);
    return s === "table" || s === "cards" ? s : "cards";
  });
  useEffect(() => {
    try { window.localStorage.setItem(viewStorageKey, viewMode); } catch {}
  }, [viewMode]);

  // Fetch species for tabs and form select
  const { data: especies } = useQuery({
    queryKey: ["especies"],
    queryFn: () => mantenedorService("especies").list(),
  });

  // Build species options for form
  const especieOpts = useMemo(
    () =>
      ((especies || []) as Especie[]).map((e) => ({
        value: e.id_especie,
        label: e.nombre,
      })),
    [especies],
  );

  // Map species id -> species data for display
  const especieMap = useMemo(() => {
    const map: Record<number, Especie> = {};
    ((especies || []) as Especie[]).forEach((e) => {
      map[e.id_especie] = e;
    });
    return map;
  }, [especies]);

  // Count estados per species for tab badges
  const especieCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    ((data || []) as EstadoFenologico[]).forEach((ef) => {
      counts[ef.id_especie] = (counts[ef.id_especie] || 0) + 1;
    });
    return counts;
  }, [data]);

  // Species that have at least one estado, sorted by name
  const especiesWithEstados = useMemo(() => {
    const ids = Object.keys(especieCounts).map(Number);
    return ids
      .map((id) => especieMap[id])
      .filter(Boolean)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [especieCounts, especieMap]);

  // Filter and sort
  const filtered = useMemo(() => {
    let items = (data || []) as EstadoFenologico[];

    // Filter by species tab
    if (activeEspecie !== "todas") {
      items = items.filter((ef) => ef.id_especie === activeEspecie);
    }

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (ef) =>
          ef.nombre.toLowerCase().includes(q) ||
          ef.codigo.toLowerCase().includes(q) ||
          (ef.descripcion || "").toLowerCase().includes(q) ||
          (ef.mes_orientativo || "").toLowerCase().includes(q),
      );
    }

    // Sort by orden within each species group
    return [...items].sort((a, b) => {
      if (a.id_especie !== b.id_especie) {
        const nameA = especieMap[a.id_especie]?.nombre || "";
        const nameB = especieMap[b.id_especie]?.nombre || "";
        return nameA.localeCompare(nameB);
      }
      return (a.orden ?? 0) - (b.orden ?? 0);
    });
  }, [data, activeEspecie, search, especieMap]);

  // Group filtered items by species for the timeline display
  const grouped = useMemo(() => {
    const groups: Record<number, EstadoFenologico[]> = {};
    filtered.forEach((ef) => {
      if (!groups[ef.id_especie]) groups[ef.id_especie] = [];
      groups[ef.id_especie].push(ef);
    });
    return groups;
  }, [filtered]);

  // Sorted species ids for rendering groups
  const sortedSpeciesIds = useMemo(
    () =>
      Object.keys(grouped)
        .map(Number)
        .sort((a, b) => {
          const nameA = especieMap[a]?.nombre || "";
          const nameB = especieMap[b]?.nombre || "";
          return nameA.localeCompare(nameB);
        }),
    [grouped, especieMap],
  );

  const fields: FieldDef[] = [
    {
      key: "id_especie",
      label: "Especie",
      type: "select",
      required: true,
      options: especieOpts,
    },
    { key: "codigo", label: "Código", type: "text", required: true },
    { key: "nombre", label: "Nombre", type: "text", required: true },
    { key: "orden", label: "Orden", type: "number", required: true },
    { key: "descripcion", label: "Descripción", type: "textarea" },
    {
      key: "color_hex",
      label: "Color (hex)",
      type: "text",
      placeholder: "#4CAF50",
    },
    {
      key: "mes_orientativo",
      label: "Mes Orientativo",
      type: "text",
      placeholder: "Ej: Sep-Oct",
    },
  ];

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (editRow) {
      await update({ id: editRow.id_estado as number, data: formData });
    } else {
      await create(formData);
    }
  };

  const handleDelete = async (ef: EstadoFenologico) => {
    if (confirm(`Eliminar estado fenológico "${ef.nombre}"?`)) {
      await remove(ef.id_estado);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/catalogos")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Flower2 className="h-5 w-5 text-garces-cherry" />
          <h2 className="text-xl font-bold text-garces-cherry">
            Estados Fenológicos
          </h2>
          <span className="text-sm text-muted-foreground">
            ({filtered.length})
          </span>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex bg-muted rounded-md p-0.5" role="group" aria-label="Cambiar vista">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("cards")}
              title="Vista cuadricula"
              aria-label="Vista cuadricula"
              aria-pressed={viewMode === "cards"}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("table")}
              title="Vista lista"
              aria-label="Vista lista"
              aria-pressed={viewMode === "table"}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditRow(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nuevo Estado
          </Button>
        </div>
      </div>

      {/* Species Tabs */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveEspecie("todas")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeEspecie === "todas"
              ? "bg-garces-cherry text-white"
              : "bg-white border text-muted-foreground hover:bg-garces-cherry-pale hover:text-garces-cherry"
          }`}
        >
          Todas ({((data || []) as EstadoFenologico[]).length})
        </button>
        {especiesWithEstados.map((esp) => (
          <button
            key={esp.id_especie}
            onClick={() => setActiveEspecie(esp.id_especie)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeEspecie === esp.id_especie
                ? "bg-garces-cherry text-white"
                : "bg-white border text-muted-foreground hover:bg-garces-cherry-pale hover:text-garces-cherry"
            }`}
          >
            {esp.color_hex && (
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: esp.color_hex }}
              />
            )}
            {esp.nombre} ({especieCounts[esp.id_especie] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded-md border border-input bg-white pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Buscar estado fenológico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {(activeEspecie !== "todas" || search) && (
          <button
            onClick={() => {
              setActiveEspecie("todas");
              setSearch("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Content */}
      {viewMode === "table" ? (
        <CrudTable
          data={filtered as unknown as Record<string, unknown>[]}
          columns={[
            { accessorKey: "codigo", header: "Código" },
            { accessorKey: "nombre", header: "Nombre" },
            {
              accessorKey: "id_especie",
              header: "Especie",
              cell: ({ getValue }: any) => especieMap[getValue() as number]?.nombre ?? "-",
            },
            { accessorKey: "orden", header: "Orden" },
            { accessorKey: "mes_orientativo", header: "Mes" },
          ] as any}
          isLoading={isLoading}
          onEdit={(row) => {
            setEditRow(row);
            setFormOpen(true);
          }}
          onDelete={(row) => handleDelete(row as unknown as EstadoFenologico)}
        />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Cargando estados fenológicos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Flower2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>
            Sin estados fenológicos
            {activeEspecie !== "todas"
              ? ` para ${especieMap[activeEspecie as number]?.nombre || "esta especie"}`
              : ""}
            {search ? ` con "${search}"` : ""}
          </p>
          {isAdmin && (
            <p className="text-xs mt-2">
              Usa el botón <span className="font-medium">Nuevo Estado</span> para crear el primer estado fenológico.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {sortedSpeciesIds.map((speciesId) => {
            const esp = especieMap[speciesId];
            const items = grouped[speciesId];
            if (!items || items.length === 0) return null;

            return (
              <div key={speciesId}>
                {/* Species group header (only show when viewing "todas") */}
                {activeEspecie === "todas" && (
                  <div className="flex items-center gap-2 mb-3">
                    {esp?.color_hex && (
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: esp.color_hex }}
                      />
                    )}
                    <h3 className="text-sm font-semibold text-garces-cherry">
                      {esp?.nombre || `Especie #${speciesId}`}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      ({items.length} estados)
                    </span>
                  </div>
                )}

                {/* Timeline list */}
                <div className="relative">
                  {/* Vertical connector line */}
                  {items.length > 1 && (
                    <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-border" />
                  )}

                  <div className="space-y-2">
                    {items.map((ef, idx) => {
                      const color = ef.color_hex || "#94a3b8";
                      return (
                        <div
                          key={ef.id_estado}
                          className="relative flex items-start gap-4 bg-white rounded-lg border p-3 pl-4 hover:shadow-md transition-shadow group"
                        >
                          {/* Timeline dot */}
                          <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                            <div
                              className="w-[10px] h-[10px] rounded-full ring-2 ring-white z-10"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-[10px] text-muted-foreground mt-1 font-mono">
                              {ef.orden}
                            </span>
                          </div>

                          {/* Main content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Color circle + name */}
                              <span
                                className="inline-block w-4 h-4 rounded-full flex-shrink-0 ring-1 ring-black/10"
                                style={{ backgroundColor: color }}
                              />
                              <span className="font-medium text-sm">
                                {ef.nombre}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                {ef.codigo}
                              </span>
                              {ef.mes_orientativo && (
                                <span className="text-xs bg-garces-cherry/10 text-garces-cherry px-2 py-0.5 rounded-full font-medium">
                                  {ef.mes_orientativo}
                                </span>
                              )}
                            </div>
                            {ef.descripcion && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {ef.descripcion}
                              </p>
                            )}
                          </div>

                          {/* Hover actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              className="p-1.5 rounded-md hover:bg-muted transition-colors"
                              title="Editar"
                              onClick={() => {
                                setEditRow(
                                  ef as unknown as Record<string, unknown>,
                                );
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            </button>
                            <button
                              className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                              title="Eliminar"
                              onClick={() => handleDelete(ef)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Form */}
      <CrudForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        fields={fields}
        initialData={editRow}
        title={editRow ? "Editar Estado Fenológico" : "Nuevo Estado Fenológico"}
        isLoading={isCreating || isUpdating}
      />
    </div>
  );
}
