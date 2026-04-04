import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Plus, Image as ImageIcon, Search, Leaf } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { CrudForm } from "@/components/shared/CrudForm";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BulkActions } from "@/components/shared/BulkActions";
import { useCrud } from "@/hooks/useCrud";
import { useLookups } from "@/hooks/useLookups";
import { mantenedorService, variedadBitacoraService } from "@/services/mantenedores";
import type { BitacoraEntry } from "@/services/mantenedores";
import { formatDate } from "@/lib/utils";
import type { FieldDef } from "@/types";
import type { Especie, Pmg, Origen } from "@/types/maestras";

const bitacoraFields: FieldDef[] = [
  { key: "tipo_entrada", label: "Tipo", type: "select", required: true, options: [
    { value: "Visita terreno test block", label: "Visita terreno" },
    { value: "Comentarios adicionales", label: "Comentarios" },
    { value: "Resultado laboratorio", label: "Lab resultado" },
    { value: "Nota tecnica", label: "Nota tecnica" },
  ]},
  { key: "titulo", label: "Titulo", type: "text", required: true },
  { key: "fecha", label: "Fecha", type: "date", required: true },
  { key: "contenido", label: "Contenido", type: "textarea", required: true },
  { key: "ubicacion", label: "Ubicacion", type: "text" },
  { key: "resultado", label: "Resultado", type: "text" },
];

export function VariedadesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, create, update, remove, isCreating, isUpdating } = useCrud("variedades");
  const lk = useLookups();
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [selectedVar, setSelectedVar] = useState<Record<string, unknown> | null>(null);
  const [bitacoraOpen, setBitacoraOpen] = useState(false);

  const { data: especies } = useQuery({
    queryKey: ["especies"],
    queryFn: () => mantenedorService("especies").list(),
  });
  const { data: pmgs } = useQuery({
    queryKey: ["pmg"],
    queryFn: () => mantenedorService("pmg").list(),
  });
  const { data: origenes } = useQuery({
    queryKey: ["origenes"],
    queryFn: () => mantenedorService("origenes").list(),
  });

  const varId = selectedVar?.id_variedad as number | undefined;
  const { data: bitacoras } = useQuery({
    queryKey: ["bitacora", varId],
    queryFn: () => variedadBitacoraService.list(varId!),
    enabled: !!varId,
  });

  const addBitacoraMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => variedadBitacoraService.add(varId!, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bitacora", varId] });
      toast.success("Bitacora agregada");
    },
  });

  const especieOpts = ((especies || []) as Especie[]).map((e) => ({ value: e.id_especie, label: e.nombre }));
  const pmgOpts = ((pmgs || []) as Pmg[]).map((p) => ({ value: p.id_pmg, label: p.nombre }));
  const origenOpts = ((origenes || []) as Origen[]).map((o) => ({ value: o.id_origen, label: o.nombre }));

  const fields: FieldDef[] = [
    { key: "codigo", label: "Codigo", type: "text", required: true },
    { key: "nombre", label: "Nombre", type: "text", required: true },
    { key: "id_especie", label: "Especie", type: "select", options: especieOpts },
    { key: "id_pmg", label: "PMG", type: "select", options: pmgOpts },
    { key: "id_origen", label: "Origen", type: "select", options: origenOpts },
    { key: "nombre_corto", label: "Nombre Corto", type: "text" },
    { key: "nombre_comercial", label: "Nombre Comercial", type: "text" },
    { key: "tipo", label: "Tipo", type: "select", options: [
      { value: "plantada", label: "Plantada" },
      { value: "prospecto", label: "Prospecto" },
      { value: "descartada", label: "Descartada" },
    ]},
    { key: "estado", label: "Estado", type: "select", options: [
      { value: "prospecto", label: "Prospecto" },
      { value: "en_evaluacion", label: "En evaluacion" },
      { value: "aprobada", label: "Aprobada" },
      { value: "descartada", label: "Descartada" },
    ]},
    { key: "epoca_cosecha", label: "Epoca Cosecha", type: "text" },
    { key: "vigor", label: "Vigor", type: "select", options: [
      { value: "bajo", label: "Bajo" },
      { value: "medio", label: "Medio" },
      { value: "alto", label: "Alto" },
    ]},
    { key: "req_frio_horas", label: "Req. Frio (horas)", type: "number" },
    { key: "calibre_esperado", label: "Calibre Esperado", type: "number" },
    { key: "firmeza_esperada", label: "Firmeza Esperada", type: "number" },
    { key: "auto_fertil", label: "Auto Fertil", type: "boolean" },
    { key: "observaciones", label: "Observaciones", type: "textarea" },
  ];

  const [search, setSearch] = useState("");
  const [activeEspecie, setActiveEspecie] = useState<string>("todas");
  const [activePmg, setActivePmg] = useState<string>("todos");

  // Build especie list for tabs
  const especieList = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    (data as any[]).forEach((v: any) => {
      const esp = lk.especie(v.id_especie);
      counts[esp] = (counts[esp] || 0) + 1;
    });
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  }, [data, lk]);

  // Build PMG list for filter dropdown
  const pmgList = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    const idMap: Record<string, number> = {};
    (data as any[]).forEach((v: any) => {
      const name = lk.pmg(v.id_pmg);
      counts[name] = (counts[name] || 0) + 1;
      if (!idMap[name]) idMap[name] = v.id_pmg;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count, id: idMap[name] }));
  }, [data, lk]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let all = data as any[];
    // Filter by especie tab
    if (activeEspecie !== "todas") {
      all = all.filter((v) => lk.especie(v.id_especie) === activeEspecie);
    }
    // Filter by PMG
    if (activePmg !== "todos") {
      all = all.filter((v) => lk.pmg(v.id_pmg) === activePmg);
    }
    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      all = all.filter((v) => {
        const nombre = (v.nombre as string || "").toLowerCase();
        const codigo = (v.codigo as string || "").toLowerCase();
        const tipo = (v.tipo as string || "").toLowerCase();
        return nombre.includes(q) || codigo.includes(q) || tipo.includes(q);
      });
    }
    return all;
  }, [data, search, lk, activeEspecie, activePmg]);

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (editRow) {
      await update({ id: editRow.id_variedad as number, data: formData });
    } else {
      await create(formData);
    }
  };

  // Detail view
  if (selectedVar) {
    const img = selectedVar.imagen as string | null;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedVar(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-bold text-garces-cherry">{selectedVar.nombre as string}</h2>
          <StatusBadge status={(selectedVar.estado as string) || "prospecto"} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Image + basic info */}
          <div className="bg-white rounded-lg border p-4 space-y-3">
            {img ? (
              <img src={`data:image/jpeg;base64,${img}`} alt={selectedVar.nombre as string} className="w-full rounded-lg object-cover max-h-64" />
            ) : (
              <div className="w-full h-40 bg-muted rounded-lg flex items-center justify-center">
                <ImageIcon className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Codigo:</span> {selectedVar.codigo as string}</div>
              <div><span className="text-muted-foreground">Tipo:</span> {selectedVar.tipo as string || "-"}</div>
              <div><span className="text-muted-foreground">Epoca:</span> {selectedVar.epoca_cosecha as string || "-"}</div>
              <div><span className="text-muted-foreground">Vigor:</span> {selectedVar.vigor as string || "-"}</div>
              <div><span className="text-muted-foreground">Calibre:</span> {selectedVar.calibre_esperado != null ? `${selectedVar.calibre_esperado} mm` : "-"}</div>
              <div><span className="text-muted-foreground">Firmeza:</span> {selectedVar.firmeza_esperada != null ? String(selectedVar.firmeza_esperada) : "-"}</div>
              <div><span className="text-muted-foreground">Frio:</span> {selectedVar.req_frio_horas != null ? `${selectedVar.req_frio_horas} hrs` : "-"}</div>
              <div><span className="text-muted-foreground">Auto-fertil:</span> {selectedVar.auto_fertil ? "Si" : "No"}</div>
            </div>
            {selectedVar.observaciones ? (
              <div className="text-sm"><span className="text-muted-foreground">Obs:</span> {String(selectedVar.observaciones)}</div>
            ) : null}
          </div>

          {/* Bitacora */}
          <div className="lg:col-span-2 bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Bitacora ({bitacoras?.length ?? 0})
              </h3>
              <Button size="sm" onClick={() => setBitacoraOpen(true)}>
                <Plus className="h-4 w-4" /> Nueva Entrada
              </Button>
            </div>

            {!bitacoras || bitacoras.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sin entradas de bitacora</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-auto">
                {bitacoras.map((b: BitacoraEntry) => (
                  <div key={b.id_entrada} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm">{b.titulo}</h4>
                      <span className="text-xs text-muted-foreground">{formatDate(b.fecha)}</span>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">{b.tipo_entrada}</span>
                      {b.ubicacion && <span className="text-xs text-muted-foreground">{b.ubicacion}</span>}
                      {b.usuario && <span className="text-xs text-muted-foreground">por {b.usuario}</span>}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{b.contenido}</p>
                    {b.resultado && (
                      <p className="text-sm mt-1 text-garces-cherry font-medium">Resultado: {b.resultado}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <CrudForm
          open={bitacoraOpen}
          onClose={() => setBitacoraOpen(false)}
          onSubmit={async (d) => { await addBitacoraMut.mutateAsync(d); }}
          fields={bitacoraFields}
          title="Nueva Entrada de Bitacora"
          isLoading={addBitacoraMut.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/catalogos")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-bold text-garces-cherry">Variedades</h2>
          <span className="text-sm text-muted-foreground">({filtered.length})</span>
        </div>
        <div className="flex gap-2 items-center">
          <BulkActions
            entity="variedades"
            onImportComplete={() => queryClient.invalidateQueries({ queryKey: ["variedades"] })}
          />
          <Button size="sm" onClick={() => { setEditRow(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Nueva Variedad
          </Button>
        </div>
      </div>

      {/* Especie Tabs */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveEspecie("todas")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeEspecie === "todas"
              ? "bg-garces-cherry text-white"
              : "bg-white border text-muted-foreground hover:bg-garces-cherry-pale hover:text-garces-cherry"
          }`}
        >
          Todas ({(data as any[])?.length || 0})
        </button>
        {especieList.map(([esp, count]) => (
          <button
            key={esp}
            onClick={() => setActiveEspecie(esp)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeEspecie === esp
                ? "bg-garces-cherry text-white"
                : "bg-white border text-muted-foreground hover:bg-garces-cherry-pale hover:text-garces-cherry"
            }`}
          >
            {esp} ({count})
          </button>
        ))}
      </div>

      {/* Filters row: Search + Especie dropdown + PMG dropdown */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded-md border border-input bg-white pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Buscar variedad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          value={activeEspecie}
          onChange={(e) => setActiveEspecie(e.target.value)}
        >
          <option value="todas">Todas las especies</option>
          {especieList.map(([esp, count]) => (
            <option key={esp} value={esp}>
              {esp} ({count})
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          value={activePmg}
          onChange={(e) => setActivePmg(e.target.value)}
        >
          <option value="todos">Todos los PMG</option>
          {pmgList.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} ({p.count})
            </option>
          ))}
        </select>
        {(activeEspecie !== "todas" || activePmg !== "todos" || search) && (
          <button
            onClick={() => { setActiveEspecie("todas"); setActivePmg("todos"); setSearch(""); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Card Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Leaf className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Sin variedades{activeEspecie !== "todas" ? ` para ${activeEspecie}` : ""}{search ? ` con "${search}"` : ""}</p>
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-3">{filtered.length} variedades</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((v) => {
            const img = v.imagen as string | null;
            return (
              <div
                key={v.id_variedad as number}
                className="bg-white rounded-lg border hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                onClick={() => setSelectedVar(v)}
              >
                {/* Image */}
                {img ? (
                  <img
                    src={`data:image/jpeg;base64,${img}`}
                    alt={v.nombre as string}
                    className="w-full h-36 object-cover"
                  />
                ) : (
                  <div className="w-full h-36 bg-gradient-to-br from-garces-cherry-pale to-muted flex items-center justify-center">
                    <Leaf className="h-10 w-10 text-garces-cherry/30" />
                  </div>
                )}

                {/* Info */}
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-sm leading-tight">{v.nombre as string}</h3>
                      <p className="text-xs text-muted-foreground">{v.codigo as string}</p>
                    </div>
                    <StatusBadge status={(v.estado as string) || "prospecto"} />
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {activeEspecie === "todas" && <span className="font-medium text-garces-cherry">{lk.especie(v.id_especie)}</span>}
                    {v.tipo ? <span className="text-garces-earth">{String(v.tipo)}</span> : null}
                    {v.epoca_cosecha ? <span>{String(v.epoca_cosecha)}</span> : null}
                  </div>

                  <div className="flex gap-2 text-xs">
                    {v.calibre_esperado != null && (
                      <span className="bg-muted px-1.5 py-0.5 rounded">{String(v.calibre_esperado)}mm</span>
                    )}
                    {v.firmeza_esperada != null && (
                      <span className="bg-muted px-1.5 py-0.5 rounded">F:{String(v.firmeza_esperada)}</span>
                    )}
                    {v.vigor ? (
                      <span className="bg-muted px-1.5 py-0.5 rounded">{String(v.vigor)}</span>
                    ) : null}
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    PMG: {lk.pmg(v.id_pmg)}
                  </p>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      <CrudForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        fields={fields}
        initialData={editRow}
        title={editRow ? "Editar Variedad" : "Nueva Variedad"}
        isLoading={isCreating || isUpdating}
      />
    </div>
  );
}
