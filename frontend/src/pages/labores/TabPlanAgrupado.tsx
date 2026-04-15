import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Calendar, MapPin, Hammer, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { laboresService } from "@/services/labores";
import { useTestblocks } from "@/hooks/useTestblock";
import { useLookups } from "@/hooks/useLookups";
import { humanize } from "@/lib/utils";

const MESES = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

interface Props {
  testblockFilter?: number;
}

export function TabPlanAgrupado({ testblockFilter }: Props) {
  const lk = useLookups();
  const { data: testblocks } = useTestblocks();
  const { data: allLabores, isLoading } = useQuery({
    queryKey: ["labores", "planificacion", testblockFilter],
    queryFn: () => laboresService.planificacion(testblockFilter ? { testblock: testblockFilter } : undefined),
  });
  const { data: tiposLabor } = useQuery({
    queryKey: ["tipos-labor"],
    queryFn: () => laboresService.tiposLabor(),
    staleTime: 5 * 60_000,
  });

  const [search, setSearch] = useState("");
  const [expandedTb, setExpandedTb] = useState<Set<string>>(new Set());
  const [expandedMes, setExpandedMes] = useState<Set<string>>(new Set());
  const [filterEstado, setFilterEstado] = useState<string>("todos");

  const laborMap = useMemo(() => {
    const m: Record<number, string> = {};
    if (tiposLabor) for (const t of tiposLabor as any[]) m[t.id_labor] = t.nombre;
    return m;
  }, [tiposLabor]);

  const tbMap = useMemo(() => {
    const m: Record<number, string> = {};
    if (testblocks) for (const t of testblocks as any[]) m[t.id_testblock] = t.nombre || t.codigo;
    return m;
  }, [testblocks]);

  // Filter
  const filtered = useMemo(() => {
    let list = (allLabores || []) as any[];
    if (filterEstado === "planificada") list = list.filter((l) => l.estado === "planificada");
    else if (filterEstado === "ejecutada") list = list.filter((l) => l.estado === "ejecutada");
    else if (filterEstado === "atrasada") list = list.filter((l) => l.estado === "planificada" && l.fecha_programada && l.fecha_programada < new Date().toISOString().slice(0, 10));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        (laborMap[l.id_labor] || "").toLowerCase().includes(q) ||
        (l.observaciones || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [allLabores, filterEstado, search, laborMap]);

  // Group: TB → Mes → TipoLabor → items
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, Map<string, any[]>>>();
    for (const l of filtered) {
      const tbName = l.id_testblock ? (tbMap[l.id_testblock] || `TB #${l.id_testblock}`) : "Sin TestBlock";
      const fecha = l.fecha_programada || "Sin fecha";
      const mesKey = fecha !== "Sin fecha" ? fecha.slice(0, 7) : "9999-99";
      const mesLabel = fecha !== "Sin fecha"
        ? `${MESES[Number(fecha.slice(5, 7))] || "?"} ${fecha.slice(0, 4)}`
        : "Sin fecha";
      const tipoNombre = laborMap[l.id_labor] || `Labor #${l.id_labor}`;

      if (!map.has(tbName)) map.set(tbName, new Map());
      const tbGroup = map.get(tbName)!;
      const mesFullKey = `${mesKey}|${mesLabel}`;
      if (!tbGroup.has(mesFullKey)) tbGroup.set(mesFullKey, new Map());
      const mesGroup = tbGroup.get(mesFullKey)!;
      if (!mesGroup.has(tipoNombre)) mesGroup.set(tipoNombre, []);
      mesGroup.get(tipoNombre)!.push(l);
    }
    return map;
  }, [filtered, tbMap, laborMap]);

  const toggleTb = (key: string) => {
    setExpandedTb((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const toggleMes = (key: string) => {
    setExpandedMes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    const tbKeys = Array.from(grouped.keys());
    const mesKeys: string[] = [];
    for (const [tbK, mesMap] of grouped) {
      for (const mesK of mesMap.keys()) mesKeys.push(`${tbK}|${mesK}`);
    }
    setExpandedTb(new Set(tbKeys));
    setExpandedMes(new Set(mesKeys));
  };
  const collapseAll = () => { setExpandedTb(new Set()); setExpandedMes(new Set()); };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar labor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
        <div className="flex gap-1">
          {[
            { key: "todos", label: "Todos" },
            { key: "planificada", label: "Pendientes" },
            { key: "ejecutada", label: "Ejecutadas" },
            { key: "atrasada", label: "Atrasadas" },
          ].map((f) => (
            <button key={f.key} onClick={() => setFilterEstado(f.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterEstado === f.key ? "bg-garces-cherry text-white border-garces-cherry" : "bg-white text-muted-foreground border-gray-200"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} labores</span>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={expandAll}>Expandir todo</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={collapseAll}>Colapsar</Button>
        </div>
      </div>

      {/* Grouped view */}
      {grouped.size === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Sin labores{search ? ` para "${search}"` : ""}</div>
      ) : (
        <div className="space-y-2">
          {Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([tbName, mesMap]) => {
            const tbExpanded = expandedTb.has(tbName);
            const tbTotal = Array.from(mesMap.values()).reduce((s, tm) => s + Array.from(tm.values()).reduce((s2, items) => s2 + items.length, 0), 0);
            return (
              <div key={tbName} className="bg-white rounded-lg border overflow-hidden">
                {/* TB header */}
                <button className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left" onClick={() => toggleTb(tbName)}>
                  {tbExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <MapPin className="h-4 w-4 text-garces-cherry shrink-0" />
                  <span className="font-semibold text-sm">{tbName}</span>
                  <span className="text-xs bg-muted rounded-full px-2 py-0.5 text-muted-foreground">{tbTotal}</span>
                </button>

                {/* Months */}
                {tbExpanded && (
                  <div className="border-t">
                    {Array.from(mesMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([mesFullKey, tipoMap]) => {
                      const mesLabel = mesFullKey.split("|")[1] || mesFullKey;
                      const mesUniqueKey = `${tbName}|${mesFullKey}`;
                      const mesExpanded = expandedMes.has(mesUniqueKey);
                      const mesTotal = Array.from(tipoMap.values()).reduce((s, items) => s + items.length, 0);

                      return (
                        <div key={mesFullKey}>
                          <button className="w-full flex items-center gap-2 px-6 py-2 hover:bg-muted/20 transition-colors text-left border-b" onClick={() => toggleMes(mesUniqueKey)}>
                            {mesExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                            <Calendar className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span className="text-sm font-medium">{mesLabel}</span>
                            <span className="text-xs text-muted-foreground">{mesTotal} labores</span>
                          </button>

                          {/* Labor types */}
                          {mesExpanded && (
                            <div className="bg-muted/10 px-8 py-2 space-y-2 border-b">
                              {Array.from(tipoMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([tipoNombre, items]) => (
                                <div key={tipoNombre}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Hammer className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs font-semibold">{tipoNombre}</span>
                                    <span className="text-[10px] text-muted-foreground">({items.length})</span>
                                  </div>
                                  <div className="space-y-0.5 ml-5">
                                    {items.slice(0, 20).map((l: any) => (
                                      <div key={l.id_ejecucion} className="flex items-center gap-2 text-xs py-0.5">
                                        <StatusBadge status={l.estado} className="text-[10px] px-1.5 py-0" />
                                        <span className="text-muted-foreground">{l.fecha_programada || "-"}</span>
                                        {l.observaciones && (
                                          <span className="text-muted-foreground truncate max-w-md">{l.observaciones.slice(0, 80)}</span>
                                        )}
                                      </div>
                                    ))}
                                    {items.length > 20 && (
                                      <span className="text-[10px] text-muted-foreground">+{items.length - 20} mas...</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
