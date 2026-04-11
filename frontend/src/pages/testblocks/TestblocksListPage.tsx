import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Grid3X3, MapPin, Search, LayoutGrid, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useTestblocks } from "@/hooks/useTestblock";
import { useLookups } from "@/hooks/useLookups";
import { formatNumber, formatDate } from "@/lib/utils";

type SortKey = "nombre" | "fecha" | "completitud";

function relativeDate(d: string | null | undefined): string {
  if (!d) return "-";
  const now = new Date();
  const date = new Date(d);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  // Future dates (negative diff)
  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    if (absDays === 1) return "Manana";
    if (absDays < 7) return `En ${absDays} dias`;
    if (absDays < 30) return `En ${Math.floor(absDays / 7)} sem`;
    return formatDate(d);
  }
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} dias`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem`;
  return formatDate(d);
}

export function TestblocksListPage() {
  const navigate = useNavigate();
  const { data: testblocks, isLoading } = useTestblocks();
  const lk = useLookups();

  const [search, setSearch] = useState("");
  const [campoFilter, setCampoFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("nombre");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Filter
  const filtered = useMemo(() => {
    return (testblocks || []).filter((tb) => {
      if (campoFilter && String(tb.id_campo) !== campoFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          tb.nombre.toLowerCase().includes(q) ||
          tb.codigo.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [testblocks, campoFilter, search]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sortKey === "nombre") return a.nombre.localeCompare(b.nombre);
      if (sortKey === "fecha") {
        const da = a.fecha_modificacion || a.fecha_creacion || "";
        const db = b.fecha_modificacion || b.fecha_creacion || "";
        return db.localeCompare(da); // newest first
      }
      // completitud
      const totalA = (a.pos_alta || 0) + (a.pos_baja || 0) + (a.pos_vacia || 0) + (a.pos_replante || 0);
      const totalB = (b.pos_alta || 0) + (b.pos_baja || 0) + (b.pos_vacia || 0) + (b.pos_replante || 0);
      const pctA = totalA > 0 ? (a.pos_alta || 0) / totalA : 0;
      const pctB = totalB > 0 ? (b.pos_alta || 0) / totalB : 0;
      return pctB - pctA;
    });
    return arr;
  }, [filtered, sortKey]);

  // Group by campo for card view
  const campoEntries = useMemo(() => {
    const grouped: Record<string, typeof sorted> = {};
    sorted.forEach((tb) => {
      const campo = lk.campo(tb.id_campo);
      if (!grouped[campo]) grouped[campo] = [];
      grouped[campo]!.push(tb);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [sorted, lk]);

  // Campo options for filter
  const campoOptions = lk.options.campos;

  const sortLabels: Record<SortKey, string> = {
    nombre: "Nombre",
    fecha: "Fecha",
    completitud: "% Completitud",
  };
  const sortKeys: SortKey[] = ["nombre", "fecha", "completitud"];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-garces-cherry">TestBlocks</h2>
        <Button onClick={() => navigate("/testblocks/nuevo")} size="sm">
          <Plus className="h-4 w-4" /> Nuevo TestBlock
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border rounded-lg p-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nombre o codigo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Campo filter */}
        <select
          value={campoFilter}
          onChange={(e) => setCampoFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Todos los campos</option>
          {campoOptions.map((c) => (
            <option key={c.value} value={String(c.value)}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Sort */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Ordenar:</span>
          {sortKeys.map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`px-2 py-1 rounded ${
                sortKey === k
                  ? "bg-garces-cherry text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              {sortLabels[k]}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setViewMode("cards")}
            className={`p-1.5 rounded ${viewMode === "cards" ? "bg-garces-cherry text-white" : "text-muted-foreground hover:bg-gray-100"}`}
            title="Vista tarjetas"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded ${viewMode === "table" ? "bg-garces-cherry text-white" : "text-muted-foreground hover:bg-gray-100"}`}
            title="Vista tabla"
          >
            <Table2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} testblock{filtered.length !== 1 ? "s" : ""}
        {campoFilter || search ? " (filtrado)" : ""}
      </p>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : viewMode === "cards" ? (
        /* ======================== CARD VIEW ======================== */
        <div className="space-y-6">
          {campoEntries.map(([campo, tbs]) => (
            <div key={campo}>
              <h3 className="text-sm font-semibold text-garces-cherry-light mb-3 flex items-center gap-2 border-b pb-2">
                <MapPin className="h-4 w-4" /> {campo}
                <span className="text-xs font-normal text-muted-foreground">({tbs!.length} testblocks)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(tbs || []).map((tb) => {
                  const total = (tb.pos_alta || 0) + (tb.pos_baja || 0) + (tb.pos_vacia || 0) + (tb.pos_replante || 0);
                  const pctAlta = total > 0 ? ((tb.pos_alta || 0) / total) * 100 : 0;
                  return (
                    <div
                      key={tb.id_testblock}
                      className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/testblocks/${tb.id_testblock}`)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Grid3X3 className="h-5 w-5 text-garces-cherry" />
                          <div>
                            <h3 className="font-semibold text-sm">{tb.nombre}</h3>
                            <p className="text-xs text-muted-foreground">{tb.codigo}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {tb.temporada_inicio && (
                            <span className="text-[10px] bg-garces-cherry-pale text-garces-cherry px-1.5 py-0.5 rounded-full">
                              {tb.temporada_inicio}
                            </span>
                          )}
                          <StatusBadge status={tb.estado || "activo"} />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center text-xs mb-3">
                        <div>
                          <p className="font-bold text-green-600">{tb.pos_alta || 0}</p>
                          <p className="text-muted-foreground">Alta</p>
                        </div>
                        <div>
                          <p className="font-bold text-red-500">{tb.pos_baja || 0}</p>
                          <p className="text-muted-foreground">Baja</p>
                        </div>
                        <div>
                          <p className="font-bold text-blue-500">{tb.pos_replante || 0}</p>
                          <p className="text-muted-foreground">Replante</p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-400">{tb.pos_vacia || 0}</p>
                          <p className="text-muted-foreground">Vacia</p>
                        </div>
                      </div>

                      <div className="h-2 rounded-full bg-gray-200 overflow-hidden flex">
                        {(tb.pos_alta || 0) > 0 && (
                          <div className="bg-green-500 h-full" style={{ width: `${pctAlta}%` }} />
                        )}
                        {(tb.pos_replante || 0) > 0 && (
                          <div className="bg-blue-500 h-full" style={{ width: `${total > 0 ? ((tb.pos_replante || 0) / total) * 100 : 0}%` }} />
                        )}
                        {(tb.pos_baja || 0) > 0 && (
                          <div className="bg-red-400 h-full" style={{ width: `${total > 0 ? ((tb.pos_baja || 0) / total) * 100 : 0}%` }} />
                        )}
                      </div>

                      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                        <span>{tb.num_hileras || "?"} hileras x {tb.posiciones_por_hilera || "?"} pos</span>
                        <span>{formatNumber(total)} total</span>
                      </div>

                      {/* Last activity */}
                      <div className="mt-1 text-[10px] text-muted-foreground text-right">
                        {relativeDate(tb.fecha_modificacion || tb.fecha_creacion)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {campoEntries.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron testblocks con los filtros aplicados.
            </div>
          )}
        </div>
      ) : (
        /* ======================== TABLE VIEW ======================== */
        <div className="bg-white border rounded-lg overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Codigo</th>
                <th className="px-3 py-2 font-medium">Campo</th>
                <th className="px-3 py-2 font-medium">Temporada</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium text-right">Alta</th>
                <th className="px-3 py-2 font-medium text-right">Baja</th>
                <th className="px-3 py-2 font-medium text-right">Repl.</th>
                <th className="px-3 py-2 font-medium text-right">Vacia</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
                <th className="px-3 py-2 font-medium text-right">Actividad</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((tb) => {
                const total = (tb.pos_alta || 0) + (tb.pos_baja || 0) + (tb.pos_vacia || 0) + (tb.pos_replante || 0);
                return (
                  <tr
                    key={tb.id_testblock}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/testblocks/${tb.id_testblock}`)}
                  >
                    <td className="px-3 py-2 font-medium">{tb.nombre}</td>
                    <td className="px-3 py-2 text-muted-foreground">{tb.codigo}</td>
                    <td className="px-3 py-2">{lk.campo(tb.id_campo)}</td>
                    <td className="px-3 py-2">
                      {tb.temporada_inicio ? (
                        <span className="text-[10px] bg-garces-cherry-pale text-garces-cherry px-1.5 py-0.5 rounded-full">
                          {tb.temporada_inicio}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={tb.estado || "activo"} />
                    </td>
                    <td className="px-3 py-2 text-right text-green-600 font-medium">{tb.pos_alta || 0}</td>
                    <td className="px-3 py-2 text-right text-red-500 font-medium">{tb.pos_baja || 0}</td>
                    <td className="px-3 py-2 text-right text-blue-500 font-medium">{tb.pos_replante || 0}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{tb.pos_vacia || 0}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatNumber(total)}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {relativeDate(tb.fecha_modificacion || tb.fecha_creacion)}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                    No se encontraron testblocks con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
