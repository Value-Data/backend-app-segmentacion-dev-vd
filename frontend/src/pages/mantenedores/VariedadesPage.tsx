import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Plus, Image as ImageIcon, Search, Leaf, Pencil, Trash2, Upload, Camera, History, X, Link2, Star, ShieldAlert } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CrudForm } from "@/components/shared/CrudForm";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BulkActions } from "@/components/shared/BulkActions";
import { useCrud } from "@/hooks/useCrud";
import { useLookups } from "@/hooks/useLookups";
import { mantenedorService, variedadBitacoraService } from "@/services/mantenedores";
import type { BitacoraEntry } from "@/services/mantenedores";
import { uploadFile, get, del, put, post } from "@/services/api";
import { formatDate, withCurrentValue, humanize } from "@/lib/utils";
import type { FieldDef } from "@/types";
import type { Especie, Pmg } from "@/types/maestras";
import { useAuthStore } from "@/stores/authStore";

interface VariedadFoto {
  id: number;
  id_variedad: number;
  filename: string;
  descripcion?: string | null;
  es_principal?: boolean;
  content_type?: string;
  fecha_creacion?: string;
}

interface VariedadLogEntry {
  id_log: number;
  id_variedad: number;
  accion: string;
  campo_modificado?: string | null;
  valor_anterior?: string | null;
  valor_nuevo?: string | null;
  usuario?: string | null;
  fecha?: string | null;
  notas?: string | null;
}

interface VariedadPolinizanteEntry {
  id: number;
  id_variedad: number;
  polinizante_variedad_id?: number | null;
  polinizante_nombre?: string | null;
  activo?: boolean;
  fecha_creacion?: string;
}

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
  { key: "ubicacion", label: "Ubicación", type: "text" },
  { key: "resultado", label: "Resultado", type: "text" },
];

export function VariedadesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data, isLoading, create, update, remove, isCreating, isUpdating } = useCrud("variedades");
  const lk = useLookups();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.rol === "admin";
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [selectedVar, setSelectedVar] = useState<Record<string, unknown> | null>(null);

  // Auto-select variedad from URL ?id=
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam && data && data.length > 0 && !selectedVar) {
      const found = (data as Record<string, unknown>[]).find((v) => String(v.id_variedad) === idParam);
      if (found) {
        setSelectedVar(found);
        searchParams.delete("id");
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, data, selectedVar, setSearchParams]);
  const [bitacoraOpen, setBitacoraOpen] = useState(false);
  const [editingBitacora, setEditingBitacora] = useState<BitacoraEntry | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "fotos" | "polinizantes" | "suscept" | "bitacora" | "log">("info");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [polSearch, setPolSearch] = useState("");
  const [polDropdownOpen, setPolDropdownOpen] = useState(false);

  // Map {id_variedad: foto_id} for grid thumbnails
  const { data: fotosPrincipalesMap } = useQuery({
    queryKey: ["fotosPrincipales"],
    queryFn: () => get<Record<number, number>>("/fotos-principales"),
    staleTime: 2 * 60_000,
  });

  const { data: especies } = useQuery({
    queryKey: ["especies"],
    queryFn: () => mantenedorService("especies").list(),
  });
  const { data: pmgs } = useQuery({
    queryKey: ["pmg"],
    queryFn: () => mantenedorService("pmg").list(),
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

  const updateBitacoraMut = useMutation({
    mutationFn: (d: Record<string, unknown>) =>
      put<BitacoraEntry>(`/mantenedores/variedades/${varId}/bitacora/${d.id_entrada}`, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bitacora", varId] });
      toast.success("Bitacora actualizada");
      setEditingBitacora(null);
    },
  });

  // Photos query
  const { data: fotos } = useQuery({
    queryKey: ["variedadFotos", varId],
    queryFn: () => get<VariedadFoto[]>(`/variedades/${varId}/fotos`),
    enabled: !!varId,
  });

  const uploadFotoMut = useMutation({
    mutationFn: (file: File) => uploadFile<VariedadFoto>(`/variedades/${varId}/fotos`, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variedadFotos", varId] });
      queryClient.invalidateQueries({ queryKey: ["fotosPrincipales"] });
      toast.success("Foto subida");
    },
  });

  const deleteFotoMut = useMutation({
    mutationFn: (fotoId: number) => del<unknown>(`/variedades/${varId}/fotos/${fotoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variedadFotos", varId] });
      queryClient.invalidateQueries({ queryKey: ["fotosPrincipales"] });
      toast.success("Foto eliminada");
    },
  });

  const setPrincipalMut = useMutation({
    mutationFn: (fotoId: number) => put<VariedadFoto>(`/variedades/${varId}/fotos/${fotoId}/principal`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variedadFotos", varId] });
      queryClient.invalidateQueries({ queryKey: ["fotosPrincipales"] });
      toast.success("Foto principal actualizada");
    },
  });

  const deleteBitacoraMut = useMutation({
    mutationFn: (entryId: number) => variedadBitacoraService.remove(varId!, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bitacora", varId] });
      toast.success("Entrada eliminada");
    },
  });

  // Susceptibilidades assigned to this variedad
  const { data: varSuscepts } = useQuery({
    queryKey: ["variedadSuscept", varId],
    queryFn: () => get<any[]>(`/mantenedores/variedades/${varId}/susceptibilidades`),
    enabled: !!varId,
  });
  // All susceptibilidades filtered by the variedad's especie
  const varEspecieId = selectedVar?.id_especie as number | undefined;
  const { data: allSuscepts } = useQuery({
    queryKey: ["susceptibilidades", varEspecieId],
    queryFn: () => get<any[]>("/mantenedores/susceptibilidades", { especie: varEspecieId }),
    enabled: !!varEspecieId,
  });
  // Available susceptibilidades (not yet assigned)
  const availableSuscepts = useMemo(() => {
    if (!allSuscepts) return [];
    const assignedIds = new Set((varSuscepts || []).map((vs: any) => vs.id_suscept));
    return (allSuscepts as any[]).filter((s) => s.activo !== false && s.id_especie === varEspecieId && !assignedIds.has(s.id_suscept));
  }, [allSuscepts, varSuscepts, varEspecieId]);

  const addSusceptMut = useMutation({
    mutationFn: (id_suscept: number) => post<any>(`/mantenedores/variedades/${varId}/susceptibilidades`, { id_variedad: varId, id_suscept }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variedadSuscept", varId] });
      toast.success("Susceptibilidad agregada");
    },
  });
  const removeSusceptMut = useMutation({
    mutationFn: (id_vs: number) => del<any>(`/mantenedores/variedades/${varId}/susceptibilidades/${id_vs}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variedadSuscept", varId] });
      toast.success("Susceptibilidad eliminada");
    },
  });

  // Change log query
  const { data: changeLog } = useQuery({
    queryKey: ["variedadLog", varId],
    queryFn: () => get<VariedadLogEntry[]>(`/mantenedores/variedades/${varId}/log`),
    enabled: !!varId,
  });

  // Polinizantes
  const { data: polinizantes } = useQuery({
    queryKey: ["variedadPolinizantes", varId],
    queryFn: () => get<VariedadPolinizanteEntry[]>(`/variedades/${varId}/polinizantes`),
    enabled: !!varId,
  });

  const addPolinizanteMut = useMutation({
    mutationFn: (polVariedadId: number) =>
      post<VariedadPolinizanteEntry>(`/variedades/${varId}/polinizantes`, { polinizante_variedad_id: polVariedadId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variedadPolinizantes", varId] });
      toast.success("Polinizante agregado");
      setPolSearch("");
      setPolDropdownOpen(false);
    },
  });

  const removePolinizanteMut = useMutation({
    mutationFn: (pid: number) => del<unknown>(`/variedades/${varId}/polinizantes/${pid}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variedadPolinizantes", varId] });
      toast.success("Polinizante eliminado");
    },
  });

  const especieOpts = ((especies || []) as Especie[]).map((e) => ({ value: e.id_especie, label: e.nombre }));
  const pmgOpts = ((pmgs || []) as Pmg[]).map((p) => ({ value: p.id_pmg, label: p.nombre }));
  const { stringOptions } = useLookups();
  const origenOpts = stringOptions.paises;

  const fields: FieldDef[] = [
    { key: "codigo", label: "Código", type: "text", required: true },
    { key: "nombre", label: "Nombre", type: "text", required: true },
    { key: "id_especie", label: "Especie", type: "select", options: especieOpts },
    { key: "id_pmg", label: "PMG", type: "select", options: pmgOpts },
    { key: "origen", label: "Pais de Origen", type: "select", options: origenOpts },
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
    { key: "color", label: "Color", type: "select", options: [
      { value: "Roja", label: "Roja" },
      { value: "Bicolor", label: "Bicolor" },
    ]},
    { key: "epoca_cosecha", label: "Epoca Cosecha", type: "select", options: [
      { value: "MUY_TEMPRANA", label: "Muy temprana" },
      { value: "TEMPRANA", label: "Temprana" },
      { value: "MEDIA_ESTACION", label: "Media estación" },
      { value: "TARDIA", label: "Tardía" },
      { value: "MUY_TARDIA", label: "Muy tardía" },
    ]},
    { key: "requerimiento_frio", label: "Requerimiento de Frio", type: "select", options: [
      { value: "MUY_BAJO", label: "Muy bajo (<150 horas frío)" },
      { value: "BAJO", label: "Bajo (150-400 horas frío)" },
      { value: "MEDIO", label: "Medio (>400 horas frío)" },
      { value: "ALTO", label: "Alto (>600 horas frío)" },
    ]},
    { key: "calibre_esperado", label: "Calibre Esperado", type: "text" },
    { key: "auto_fertil", label: "Auto Fertil", type: "boolean" },
    { key: "alelos", label: "Alelos", type: "textarea" },
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
      // Refresh detail view if editing from it
      if (selectedVar && (selectedVar.id_variedad === editRow.id_variedad)) {
        setSelectedVar({ ...selectedVar, ...formData });
      }
    } else {
      await create(formData);
    }
  };

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";
  const token = useAuthStore((s) => s.token);
  const fotoUrl = (fotoId: number) => `${API_BASE}/files/fotos/${fotoId}?token=${encodeURIComponent(token || "")}`;
  const principalFoto = fotos?.find((f) => f.es_principal);

  // Detail view
  if (selectedVar) {
    const img = selectedVar.imagen as string | null;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedVar(null); setDetailTab("info"); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-bold text-garces-cherry">{selectedVar.nombre as string}</h2>
          <StatusBadge status={(selectedVar.estado as string) || "prospecto"} />
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditRow(selectedVar); setFormOpen(true); }}>
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          {([
            { key: "info" as const, label: "Info", icon: Leaf },
            ...(!selectedVar.auto_fertil ? [{ key: "polinizantes" as const, label: `Polinizantes (${polinizantes?.length ?? 0})`, icon: Link2 }] : []),
            { key: "fotos" as const, label: `Fotos (${fotos?.length ?? 0})`, icon: Camera },
            { key: "suscept" as const, label: `Suscept. (${varSuscepts?.length ?? 0})`, icon: ShieldAlert },
            { key: "bitacora" as const, label: `Bitacora (${bitacoras?.length ?? 0})`, icon: BookOpen },
            { key: "log" as const, label: `Historial (${changeLog?.length ?? 0})`, icon: History },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setDetailTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                detailTab === tab.key
                  ? "border-garces-cherry text-garces-cherry"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Info */}
        {detailTab === "info" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border p-4 space-y-3">
              {principalFoto ? (
                <img src={fotoUrl(principalFoto.id)} alt={selectedVar.nombre as string} className="w-full rounded-lg object-cover max-h-64" />
              ) : img ? (
                <img src={`data:image/jpeg;base64,${img}`} alt={selectedVar.nombre as string} className="w-full rounded-lg object-cover max-h-64" />
              ) : (
                <div className="w-full h-40 bg-muted rounded-lg flex items-center justify-center">
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Codigo:</span> {selectedVar.codigo as string}</div>
                <div><span className="text-muted-foreground">Tipo:</span> {humanize(selectedVar.tipo as string)}</div>
                <div><span className="text-muted-foreground">Color:</span> {selectedVar.color as string || "-"}</div>
                <div><span className="text-muted-foreground">Epoca:</span> {humanize(selectedVar.epoca_cosecha as string)}</div>
                <div><span className="text-muted-foreground">Calibre:</span> {selectedVar.calibre_esperado != null ? `${selectedVar.calibre_esperado}` : "-"}</div>
                <div><span className="text-muted-foreground">Req. Frio:</span> {humanize(selectedVar.requerimiento_frio as string)}</div>
                <div>
                  <span className="text-muted-foreground">Auto-fertil:</span>{" "}
                  {selectedVar.auto_fertil
                    ? <span className="text-green-600 font-medium">Si</span>
                    : <span className="text-orange-600 font-medium">No — requiere polinizantes</span>}
                </div>
                <div><span className="text-muted-foreground">Origen:</span> {selectedVar.origen as string || "-"}</div>
              </div>
              {selectedVar.alelos ? (
                <div className="text-sm"><span className="text-muted-foreground">Alelos:</span> {String(selectedVar.alelos)}</div>
              ) : null}
              {selectedVar.observaciones ? (
                <div className="text-sm"><span className="text-muted-foreground">Obs:</span> {String(selectedVar.observaciones)}</div>
              ) : null}
            </div>

            <div className="lg:col-span-2 bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3">Resumen</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Especie:</span> {lk.especie(selectedVar.id_especie)}</div>
                <div><span className="text-muted-foreground">PMG:</span> {lk.pmg(selectedVar.id_pmg)}</div>
                <div><span className="text-muted-foreground">Estado:</span> {humanize(selectedVar.estado as string)}</div>
                <div><span className="text-muted-foreground">Polinizantes:</span> {polinizantes?.length ?? 0}</div>
                <div><span className="text-muted-foreground">Fotos:</span> {fotos?.length ?? 0}</div>
                <div><span className="text-muted-foreground">Entradas bitacora:</span> {bitacoras?.length ?? 0}</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Polinizantes — solo visible si auto_fertil = false */}
        {detailTab === "polinizantes" && !selectedVar.auto_fertil && (
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Link2 className="h-4 w-4" /> Polinizantes ({polinizantes?.length ?? 0})
              </h3>
            </div>

            {/* Searchable variedad selector */}
            <div className="relative mb-4 max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="w-full rounded-md border border-input bg-white pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Buscar variedad para agregar como polinizante..."
                  value={polSearch}
                  onChange={(e) => { setPolSearch(e.target.value); setPolDropdownOpen(true); }}
                  onFocus={() => { if (polSearch) setPolDropdownOpen(true); }}
                  onBlur={() => { setTimeout(() => setPolDropdownOpen(false), 200); }}
                />
              </div>
              {polDropdownOpen && polSearch.length >= 1 && (
                <div className="absolute z-20 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                  {((data || []) as Record<string, unknown>[])
                    .filter((v) => {
                      const q = polSearch.toLowerCase();
                      const nombre = (v.nombre as string || "").toLowerCase();
                      const codigo = (v.codigo as string || "").toLowerCase();
                      const isCurrentVar = (v.id_variedad as number) === varId;
                      const alreadyAdded = polinizantes?.some((p) => p.polinizante_variedad_id === (v.id_variedad as number));
                      return !isCurrentVar && !alreadyAdded && (nombre.includes(q) || codigo.includes(q));
                    })
                    .slice(0, 15)
                    .map((v) => (
                      <button
                        key={v.id_variedad as number}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => addPolinizanteMut.mutate(v.id_variedad as number)}
                      >
                        <span className="font-medium">{v.nombre as string}</span>
                        <span className="text-muted-foreground ml-2">({v.codigo as string})</span>
                      </button>
                    ))}
                  {((data || []) as Record<string, unknown>[]).filter((v) => {
                    const q = polSearch.toLowerCase();
                    const nombre = (v.nombre as string || "").toLowerCase();
                    const codigo = (v.codigo as string || "").toLowerCase();
                    const isCurrentVar = (v.id_variedad as number) === varId;
                    const alreadyAdded = polinizantes?.some((p) => p.polinizante_variedad_id === (v.id_variedad as number));
                    return !isCurrentVar && !alreadyAdded && (nombre.includes(q) || codigo.includes(q));
                  }).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
                  )}
                </div>
              )}
            </div>

            {!polinizantes || polinizantes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sin polinizantes registrados. Busca una variedad arriba para agregarla.</p>
            ) : (
              <div className="space-y-2">
                {polinizantes.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="text-sm">
                      <span className="font-medium">{p.polinizante_nombre || `Variedad #${p.polinizante_variedad_id}`}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      title="Eliminar polinizante"
                      onClick={() => {
                        if (confirm("Eliminar este polinizante?")) removePolinizanteMut.mutate(p.id);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Susceptibilidades */}
        {detailTab === "suscept" && (
          <div className="bg-white rounded-lg border p-4 space-y-4">
            {/* Assigned susceptibilidades */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Susceptibilidades asignadas</h4>
              {(!varSuscepts || varSuscepts.length === 0) ? (
                <p className="text-sm text-muted-foreground">Sin susceptibilidades asignadas. Agregue desde la lista de abajo.</p>
              ) : (
                <div className="space-y-1">
                  {(varSuscepts as any[]).map((vs) => (
                    <div key={vs.id_vs} className="flex items-center justify-between px-3 py-2 rounded-lg border bg-red-50 border-red-200">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                        <div>
                          <span className="text-sm font-medium">{vs.nombre || `#${vs.id_suscept}`}</span>
                          {vs.grupo && <span className="text-xs text-muted-foreground ml-2">({vs.grupo})</span>}
                          {vs.nombre_en && <span className="text-xs text-muted-foreground ml-1">— {vs.nombre_en}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => removeSusceptMut.mutate(vs.id_vs)}
                        className="text-red-400 hover:text-red-600 p-1"
                        title="Quitar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available to add */}
            <div>
              <h4 className="text-sm font-semibold mb-2">
                Agregar susceptibilidad
                {varEspecieId && <span className="text-xs text-muted-foreground font-normal ml-1">(filtradas por especie)</span>}
              </h4>
              {availableSuscepts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay mas susceptibilidades disponibles para esta especie.</p>
              ) : (
                <div>
                  {/* Group by grupo */}
                  {Array.from(
                    availableSuscepts.reduce((map: Map<string, any[]>, s: any) => {
                      const g = s.grupo || "Otros";
                      if (!map.has(g)) map.set(g, []);
                      map.get(g)!.push(s);
                      return map;
                    }, new Map<string, any[]>())
                  ).map(([grupo, items]) => (
                    <div key={grupo} className="mb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{grupo}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(items as any[]).sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0)).map((s: any) => (
                          <button
                            key={s.id_suscept}
                            onClick={() => addSusceptMut.mutate(s.id_suscept)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-xs hover:border-red-400 hover:bg-red-50 transition-colors"
                            title={s.nombre_en ? `${s.nombre_en} — Click para agregar` : "Click para agregar"}
                          >
                            <Plus className="h-3 w-3" />
                            {s.nombre}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Fotos */}
        {detailTab === "fotos" && (
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Camera className="h-4 w-4" /> Fotos
              </h3>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadFotoMut.mutate(file);
                      e.target.value = "";
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadFotoMut.isPending}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {uploadFotoMut.isPending ? "Subiendo..." : "Subir Foto"}
                </Button>
              </div>
            </div>

            {!fotos || fotos.length === 0 ? (
              <div className="text-center py-8">
                <Camera className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sin fotos. Sube la primera foto de esta variedad.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {fotos.map((f) => (
                  <div key={f.id} className={`relative group border rounded-lg overflow-hidden ${f.es_principal ? "ring-2 ring-yellow-400" : ""}`}>
                    <div className="aspect-square bg-muted">
                      <img
                        src={fotoUrl(f.id)}
                        alt={f.filename}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                    <div className="p-2">
                      <div className="flex items-center gap-1">
                        {f.es_principal && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                        <p className="text-xs font-medium truncate">{f.filename}</p>
                      </div>
                      {f.descripcion && <p className="text-xs text-muted-foreground truncate">{f.descripcion}</p>}
                      <p className="text-[10px] text-muted-foreground">{formatDate(f.fecha_creacion)}</p>
                    </div>
                    {/* Botones flotantes */}
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className={`rounded-full p-1 ${f.es_principal ? "bg-yellow-400 text-white" : "bg-white/80 text-gray-600 hover:bg-yellow-400 hover:text-white"}`}
                        title={f.es_principal ? "Foto principal" : "Marcar como principal"}
                        onClick={() => setPrincipalMut.mutate(f.id)}
                      >
                        <Star className={`h-3 w-3 ${f.es_principal ? "fill-white" : ""}`} />
                      </button>
                      <button
                        className="bg-red-500 text-white rounded-full p-1"
                        title="Eliminar foto"
                        onClick={() => {
                          if (confirm("Eliminar esta foto?")) deleteFotoMut.mutate(f.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Bitacora */}
        {detailTab === "bitacora" && (
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Bitacora ({bitacoras?.length ?? 0})
              </h3>
              <Button size="sm" onClick={() => setBitacoraOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nueva Entrada
              </Button>
            </div>

            {!bitacoras || bitacoras.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sin entradas de bitacora</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-auto">
                {bitacoras.map((b: BitacoraEntry) => (
                  <div key={b.id_entrada} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm">{b.titulo}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatDate(b.fecha)}</span>
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title="Editar entrada"
                              onClick={() => {
                                setEditingBitacora(b);
                                setBitacoraOpen(true);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Eliminar entrada"
                              onClick={() => {
                                if (confirm("Eliminar esta entrada de bitacora?")) {
                                  deleteBitacoraMut.mutate(b.id_entrada);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
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
        )}

        {/* Tab: Change Log */}
        {detailTab === "log" && (
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="h-4 w-4" /> Historial de Cambios
              </h3>
            </div>

            {!changeLog || changeLog.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sin cambios registrados para esta variedad.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-auto">
                {changeLog.map((entry) => (
                  <div key={entry.id_log} className="border rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          entry.accion === "CREATE" ? "bg-green-100 text-green-700" :
                          entry.accion === "UPDATE" ? "bg-blue-100 text-blue-700" :
                          entry.accion === "DELETE" ? "bg-red-100 text-red-700" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {entry.accion}
                        </span>
                        {entry.campo_modificado && (
                          <span className="text-muted-foreground font-mono text-xs">{entry.campo_modificado}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(entry.fecha)}</span>
                    </div>
                    {(entry.valor_anterior || entry.valor_nuevo) && (
                      <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                        {entry.valor_anterior && (
                          <div>
                            <span className="text-muted-foreground">Anterior: </span>
                            <span className="line-through text-red-600">{entry.valor_anterior}</span>
                          </div>
                        )}
                        {entry.valor_nuevo && (
                          <div>
                            <span className="text-muted-foreground">Nuevo: </span>
                            <span className="text-green-600">{entry.valor_nuevo}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      {entry.usuario && <span>por {entry.usuario}</span>}
                      {entry.notas && <span>{entry.notas}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Danger zone — separated from edit to prevent accidental deletion */}
        <div className="mt-6 pt-4 border-t border-dashed border-red-200">
          <Button
            size="sm"
            variant="ghost"
            className="text-red-400 hover:text-red-600 hover:bg-red-50 text-xs"
            onClick={async () => {
              if (confirm(`Eliminar la variedad "${selectedVar.nombre}"? Esta accion no se puede deshacer.`)) {
                await remove(selectedVar.id_variedad as number);
                setSelectedVar(null);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar variedad
          </Button>
        </div>

        <CrudForm
          open={bitacoraOpen}
          onClose={() => { setBitacoraOpen(false); setEditingBitacora(null); }}
          onSubmit={async (d) => {
            if (editingBitacora) {
              await updateBitacoraMut.mutateAsync({ ...d, id_entrada: editingBitacora.id_entrada });
            } else {
              await addBitacoraMut.mutateAsync(d);
            }
          }}
          fields={bitacoraFields}
          initialData={editingBitacora as Record<string, unknown> | null}
          title={editingBitacora ? "Editar Entrada de Bitacora" : "Nueva Entrada de Bitacora"}
          isLoading={addBitacoraMut.isPending || updateBitacoraMut.isPending}
        />

        {/* Edit form — must be inside the detail view return block */}
        <CrudForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
          fields={fields}
          initialData={editRow}
          title="Editar Variedad"
          isLoading={isCreating || isUpdating}
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
          <p>Sin variedades{activeEspecie !== "todas" ? ` para ${activeEspecie}` : ""}{activePmg !== "todos" ? ` en ${activePmg}` : ""}{search ? ` con "${search}"` : ""}</p>
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-3">{filtered.length} variedades</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((v) => {
            const principalFotoId = fotosPrincipalesMap?.[v.id_variedad as number];
            const img = v.imagen as string | null;
            return (
              <div
                key={v.id_variedad as number}
                className="bg-white rounded-lg border hover:shadow-md transition-shadow cursor-pointer overflow-hidden relative group"
                onClick={() => { setSelectedVar(v); if (v.auto_fertil && detailTab === "polinizantes") setDetailTab("info"); }}
              >
                {/* Edit button on hover */}
                <button
                  className="absolute top-2 right-2 z-10 bg-white/90 rounded-full p-1.5 shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-garces-cherry hover:text-white"
                  title="Editar"
                  onClick={(e) => { e.stopPropagation(); setEditRow(v); setFormOpen(true); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {/* Image — prefer uploaded foto principal, fallback to legacy base64 */}
                {principalFotoId ? (
                  <img
                    src={fotoUrl(principalFotoId)}
                    alt={v.nombre as string}
                    className="w-full h-36 object-cover"
                    loading="lazy"
                  />
                ) : img ? (
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
                    {v.epoca_cosecha ? <span>{humanize(String(v.epoca_cosecha))}</span> : null}
                  </div>

                  <div className="flex gap-2 text-xs">
                    {v.calibre_esperado != null && (
                      <span className="bg-muted px-1.5 py-0.5 rounded">{String(v.calibre_esperado)}mm</span>
                    )}
                    {v.color ? (
                      <span className="bg-muted px-1.5 py-0.5 rounded">{String(v.color)}</span>
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
