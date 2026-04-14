import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ordenesTrabajoService } from "@/services/ordenesTrabajo";
import type { OrdenTrabajo } from "@/services/ordenesTrabajo";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Loader2 } from "lucide-react";

interface TabPorPersonaProps {
  testblockFilter?: number;
}

interface PersonaGroup {
  id_usuario: number | null;
  nombre: string;
  ots: OrdenTrabajo[];
}

const PRIORIDAD_BG: Record<string, string> = {
  alta: "bg-red-50 border-red-200",
  media: "bg-amber-50 border-amber-200",
  baja: "bg-green-50 border-green-200",
};

const DAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

/** Return monday of the current week (ISO: Mon=0) */
function getCurrentWeekDates(): Date[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dateToStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Check if an OT falls on a given day (between plan_inicio and plan_fin inclusive) */
function otOnDay(ot: OrdenTrabajo, dayStr: string): boolean {
  if (!ot.fecha_plan_inicio || !ot.fecha_plan_fin) return false;
  return ot.fecha_plan_inicio.slice(0, 10) <= dayStr && ot.fecha_plan_fin.slice(0, 10) >= dayStr;
}

function MiniCard({ ot }: { ot: OrdenTrabajo }) {
  const bg = PRIORIDAD_BG[ot.prioridad] || "bg-gray-50 border-gray-200";
  // Abbreviate tipo_labor to first 3 words
  const laborShort = (ot.tipo_labor_nombre || "-").split(" ").slice(0, 2).join(" ");
  // Abbreviate testblock name
  const tbShort = (ot.testblock_nombre || "-").length > 12
    ? (ot.testblock_nombre || "-").slice(0, 12) + "..."
    : (ot.testblock_nombre || "-");

  return (
    <div className={`rounded border px-1.5 py-1 text-[10px] leading-tight ${bg}`}>
      <div className="font-semibold truncate">{laborShort}</div>
      <div className="text-muted-foreground truncate">{tbShort}</div>
      <div className="text-muted-foreground">{ot.posiciones_ejecutadas ?? 0}/{ot.posiciones_total} pos</div>
    </div>
  );
}

export function TabPorPersona({ testblockFilter }: TabPorPersonaProps) {
  const { data, isLoading } = useQuery<{ personas: PersonaGroup[] }>({
    queryKey: ["ordenes-trabajo", "por-persona", testblockFilter],
    queryFn: () =>
      ordenesTrabajoService.porPersona(
        testblockFilter ? { testblock: testblockFilter } : undefined,
      ),
  });

  const weekDates = useMemo(() => getCurrentWeekDates(), []);
  const weekStrs = useMemo(() => weekDates.map(dateToStr), [weekDates]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-garces-cherry" />
      </div>
    );
  }

  const personas = data?.personas || [];

  if (personas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10">
        No hay ordenes de trabajo asignadas.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2 font-semibold text-xs text-muted-foreground min-w-[160px]">
              Persona
            </th>
            {DAYS.map((day, i) => (
              <th key={day} className="text-center p-2 font-semibold text-xs text-muted-foreground min-w-[140px]">
                <div>{day}</div>
                <div className="text-[10px] font-normal">
                  {weekDates[i].toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {personas.map((persona) => (
            <tr key={persona.id_usuario ?? "none"} className="border-b hover:bg-gray-50/50">
              <td className="p-2 align-top">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{persona.nombre}</span>
                  {persona.id_usuario == null && (
                    <StatusBadge status="pendiente" className="text-[9px]" />
                  )}
                </div>
              </td>
              {weekStrs.map((dayStr, i) => {
                const dayOts = persona.ots.filter((ot) => otOnDay(ot, dayStr));
                return (
                  <td key={i} className="p-1 align-top">
                    <div className="space-y-1">
                      {dayOts.map((ot) => (
                        <MiniCard key={ot.id} ot={ot} />
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
