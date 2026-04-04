import { useNavigate } from "react-router-dom";
import { Plus, Grid3X3, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useTestblocks } from "@/hooks/useTestblock";
import { useLookups } from "@/hooks/useLookups";
import { formatNumber } from "@/lib/utils";

export function TestblocksListPage() {
  const navigate = useNavigate();
  const { data: testblocks, isLoading } = useTestblocks();
  const lk = useLookups();

  // Group by campo
  const grouped: Record<string, typeof testblocks> = {};
  (testblocks || []).forEach((tb) => {
    const campo = lk.campo(tb.id_campo);
    if (!grouped[campo]) grouped[campo] = [];
    grouped[campo]!.push(tb);
  });
  const campoEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-garces-cherry">TestBlocks</h2>
        <Button onClick={() => navigate("/testblocks/nuevo")} size="sm">
          <Plus className="h-4 w-4" /> Nuevo TestBlock
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : (
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
                        <StatusBadge status={tb.estado || "activo"} />
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
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
