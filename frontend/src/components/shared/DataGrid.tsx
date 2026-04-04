import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { PosicionTestBlock, ColorMode, DisplayMode } from "@/types/testblock";

interface DataGridProps {
  posiciones: PosicionTestBlock[];
  hileras: number;
  maxPos: number;
  colorMode: ColorMode;
  displayMode: DisplayMode;
  selectedPosition: number | null;
  onSelectPosition: (pos: PosicionTestBlock) => void;
  variedadNames?: Record<number, string>;
  portainjertoNames?: Record<number, string>;
}

const ESTADO_COLORS: Record<string, string> = {
  alta: "bg-green-500 hover:bg-green-600 text-white",
  baja: "bg-red-400 hover:bg-red-500 text-white",
  vacia: "bg-gray-200 hover:bg-gray-300 text-gray-500",
  replante: "bg-blue-400 hover:bg-blue-500 text-white",
};

const VARIEDAD_PALETTE = [
  "bg-emerald-500 text-white",
  "bg-amber-500 text-white",
  "bg-sky-500 text-white",
  "bg-violet-500 text-white",
  "bg-rose-500 text-white",
  "bg-teal-500 text-white",
  "bg-orange-500 text-white",
  "bg-indigo-500 text-white",
  "bg-lime-500 text-white",
  "bg-pink-500 text-white",
  "bg-cyan-500 text-white",
  "bg-fuchsia-500 text-white",
];

export function DataGrid({
  posiciones,
  hileras,
  maxPos,
  colorMode,
  displayMode,
  selectedPosition,
  onSelectPosition,
  variedadNames = {},
  portainjertoNames = {},
}: DataGridProps) {
  // Build a lookup grid: grid[hilera][posicion] = PosicionTestBlock
  const grid = useMemo(() => {
    const g: Record<number, Record<number, PosicionTestBlock>> = {};
    for (const pos of posiciones) {
      if (!g[pos.hilera]) g[pos.hilera] = {};
      g[pos.hilera][pos.posicion] = pos;
    }
    return g;
  }, [posiciones]);

  // Assign color index per unique variedad
  const variedadColorMap = useMemo(() => {
    const map: Record<number, number> = {};
    let idx = 0;
    for (const pos of posiciones) {
      if (pos.id_variedad && !(pos.id_variedad in map)) {
        map[pos.id_variedad] = idx % VARIEDAD_PALETTE.length;
        idx++;
      }
    }
    return map;
  }, [posiciones]);

  function getCellColor(pos: PosicionTestBlock | undefined): string {
    if (!pos) return "bg-gray-100 text-gray-300";
    if (colorMode === "variedad" && pos.id_variedad) {
      const idx = variedadColorMap[pos.id_variedad] ?? 0;
      return VARIEDAD_PALETTE[idx];
    }
    return ESTADO_COLORS[pos.estado] || ESTADO_COLORS.vacia;
  }

  function getCellLabel(pos: PosicionTestBlock | undefined): string {
    if (!pos) return "";
    if (pos.estado === "vacia") return "";
    const vName = pos.id_variedad ? (variedadNames[pos.id_variedad] || `V${pos.id_variedad}`) : "";
    const piName = pos.id_portainjerto ? (portainjertoNames[pos.id_portainjerto] || `PI${pos.id_portainjerto}`) : "";
    switch (displayMode) {
      case "variedad+id": return vName ? `${vName.substring(0, 6)}\n${pos.id_posicion}` : String(pos.id_posicion);
      case "variedad+pi": return `${vName.substring(0, 5)}\n${piName.substring(0, 5)}`;
      case "variedad": return vName.substring(0, 8);
      case "id": return String(pos.id_posicion);
      case "codigo": return pos.codigo_unico?.split("-").slice(-1)[0] || "";
      default: return "";
    }
  }

  return (
    <div className="overflow-auto">
      <div className="inline-block min-w-max">
        {/* Column headers */}
        <div className="flex mb-1">
          <div className="w-10 shrink-0" />
          {Array.from({ length: maxPos }, (_, i) => (
            <div key={i} className="w-16 text-center text-[10px] text-muted-foreground font-medium shrink-0">
              P{i + 1}
            </div>
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length: hileras }, (_, hi) => {
          const hNum = hi + 1;
          return (
            <div key={hNum} className="flex items-center mb-0.5">
              <div className="w-10 text-right pr-2 text-[10px] text-muted-foreground font-medium shrink-0">
                H{hNum}
              </div>
              {Array.from({ length: maxPos }, (_, pi) => {
                const pNum = pi + 1;
                const pos = grid[hNum]?.[pNum];
                const isSelected = pos && pos.id_posicion === selectedPosition;
                return (
                  <button
                    key={pNum}
                    className={cn(
                      "w-16 h-10 mx-px rounded text-[9px] leading-tight font-medium transition-all shrink-0 border",
                      getCellColor(pos),
                      isSelected ? "ring-2 ring-garces-earth ring-offset-1 scale-105" : "border-transparent",
                      pos && "cursor-pointer"
                    )}
                    onClick={() => pos && onSelectPosition(pos)}
                    title={pos?.codigo_unico || `H${hNum}-P${pNum}`}
                    disabled={!pos}
                  >
                    <span className="whitespace-pre-line">{getCellLabel(pos)}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
