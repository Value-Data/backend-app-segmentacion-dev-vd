import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Flower2, Calendar, ArrowRight, Leaf, Snowflake, Sun, Droplets, Cherry } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLookups } from "@/hooks/useLookups";
import { useTestblocks } from "@/hooks/useTestblock";
import { laboresService } from "@/services/labores";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";

/* ── Pauta fenologica por especie (referencia visual) ── */

const PAUTA_CEREZO = [
  { nombre: "Inicio caida de hoja", mes: "Abr", icon: Leaf, color: "#D97706" },
  { nombre: "50% caida de hoja", mes: "May", icon: Leaf, color: "#D97706" },
  { nombre: "100% caida de hoja", mes: "Jun", icon: Leaf, color: "#92400E" },
  { nombre: "Yema dormante", mes: "Jul", icon: Snowflake, color: "#6B7280" },
  { nombre: "Yema hinchada", mes: "Ago", icon: Droplets, color: "#2563EB" },
  { nombre: "Punta verde", mes: "Sep", icon: Leaf, color: "#16A34A" },
  { nombre: "Inicio floracion", mes: "Sep", icon: Flower2, color: "#EC4899" },
  { nombre: "Plena floracion", mes: "Oct", icon: Flower2, color: "#DB2777" },
  { nombre: "Cuaja", mes: "Oct-Nov", icon: Cherry, color: "#7C3AED" },
  { nombre: "Pinta / Envero", mes: "Nov", icon: Sun, color: "#DC2626" },
];

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function FenologiaPage() {
  const navigate = useNavigate();
  const lk = useLookups();
  const { data: testblocks } = useTestblocks();
  const [selectedEspecie, setSelectedEspecie] = useState<string>("cerezo");

  const { data: labores } = useQuery({
    queryKey: ["labores", "planificacion"],
    queryFn: () => laboresService.planificacion(),
  });

  // Filter fenologia-type labores
  // EjecucionLabor has id_labor (FK) but not nombre_labor.
  // We show all labores and let the user browse — the backend can enrich with labor names.
  const fenologiaLabores = useMemo(() => {
    if (!labores) return [];
    // Show recent labores (last 20) as proxy for fenologia activity
    return (labores as any[]).slice(0, 20);
  }, [labores]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-garces-cherry">Fenologia</h2>
          <p className="text-sm text-muted-foreground">
            Estados fenologicos integrados con el flujo de labores
          </p>
        </div>
        <Button size="sm" onClick={() => navigate("/labores")}>
          <Calendar className="h-4 w-4 mr-1" /> Ir a Labores
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      {/* Info banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <p className="text-sm text-purple-800">
          <strong>Los estados fenologicos se registran como parte del flujo de labores.</strong> En la seccion
          Labores → tab "Pauta por Especie" puedes planificar y registrar hitos fenologicos junto con las labores
          agronomicas. Aqui puedes ver la referencia y el historial.
        </p>
      </div>

      {/* Especie selector */}
      <div className="flex gap-2">
        {[
          { key: "cerezo", label: "Cerezo", color: "border-red-500 bg-red-50 text-red-700" },
          { key: "ciruela", label: "Ciruela", color: "border-purple-500 bg-purple-50 text-purple-700" },
          { key: "nectarin", label: "Nectarin", color: "border-amber-500 bg-amber-50 text-amber-700" },
          { key: "durazno", label: "Durazno", color: "border-orange-500 bg-orange-50 text-orange-700" },
        ].map((esp) => (
          <button
            key={esp.key}
            onClick={() => setSelectedEspecie(esp.key)}
            className={`px-4 py-2 rounded-full text-xs font-semibold border-2 transition-colors ${
              selectedEspecie === esp.key ? esp.color : "border-gray-200 bg-white text-muted-foreground hover:bg-muted"
            }`}
          >
            {esp.label}
          </button>
        ))}
      </div>

      {/* Pauta visual timeline */}
      {selectedEspecie === "cerezo" && (
        <div className="bg-white rounded-lg border">
          <div className="px-5 py-3 border-b bg-muted/30">
            <h3 className="font-semibold text-sm">Ciclo Fenologico del Cerezo</h3>
            <p className="text-xs text-muted-foreground">Referencia de estados a lo largo de la temporada</p>
          </div>

          {/* Timeline visual */}
          <div className="px-5 py-4">
            <div className="flex justify-between mb-2">
              {MESES.map((m) => (
                <div key={m} className="text-[10px] text-muted-foreground font-medium w-[calc(100%/12)] text-center">
                  {m}
                </div>
              ))}
            </div>
            <div className="relative h-2 bg-gray-100 rounded-full mb-6">
              {/* Colored segments for active fenologia months */}
              <div className="absolute h-full bg-amber-300 rounded-l-full" style={{ left: "25%", width: "17%" }} title="Caida de hoja (Abr-Jun)" />
              <div className="absolute h-full bg-blue-300" style={{ left: "50%", width: "8%" }} title="Yema (Jul-Ago)" />
              <div className="absolute h-full bg-pink-400" style={{ left: "58%", width: "17%" }} title="Floracion (Sep-Oct)" />
              <div className="absolute h-full bg-red-400 rounded-r-full" style={{ left: "75%", width: "17%" }} title="Cuaja-Cosecha (Oct-Dic)" />
            </div>
          </div>

          {/* Pauta items */}
          <div className="divide-y">
            {PAUTA_CEREZO.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: item.color + "18" }}
                  >
                    <Icon className="h-4 w-4" style={{ color: item.color }} />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium">{item.nombre}</span>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {item.mes}
                  </span>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedEspecie !== "cerezo" && (
        <div className="bg-white rounded-lg border p-8 text-center">
          <Flower2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-semibold">Pauta de {selectedEspecie} en desarrollo</p>
          <p className="text-xs text-muted-foreground mt-1">
            La pauta fenologica para {selectedEspecie} se configurara proximamente.
          </p>
        </div>
      )}

      {/* Registros fenologicos recientes */}
      <div className="bg-white rounded-lg border">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">Registros Fenologicos Recientes</h3>
          <Button variant="outline" size="sm" onClick={() => navigate("/labores")}>
            Registrar nuevo
          </Button>
        </div>
        {fenologiaLabores.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No hay registros fenologicos aun. Los hitos fenologicos se registran desde el modulo de Labores.
            </p>
            <Button variant="link" size="sm" className="mt-2 text-garces-cherry" onClick={() => navigate("/labores")}>
              Ir a Labores para registrar
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {fenologiaLabores.slice(0, 10).map((l: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                  <div>
                    <span className="font-medium">{l.nombre_labor || `Labor #${l.id_ejecucion}`}</span>
                    <span className="text-muted-foreground ml-2">TB #{l.id_posicion}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={l.estado} />
                  <span className="text-xs text-muted-foreground">{formatDate(l.fecha_programada)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
