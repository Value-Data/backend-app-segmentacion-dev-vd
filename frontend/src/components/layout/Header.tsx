import { useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Calendar, Wifi, WifiOff, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { get } from "@/services/api";

const titleMap: Record<string, string> = {
  "/": "Dashboard",
  "/catalogos": "Catalogos",
  "/inventario": "Inventario",
  "/testblocks": "TestBlocks",
  "/laboratorio": "Mediciones Lab",
  "/laboratorio/analisis": "Analisis de Calidad",
  "/labores": "Labores",
  "/fenologia": "Fenologia",
  "/analisis": "Analisis",
  "/reportes": "Reportes",
  "/alertas": "Centro de Alertas",
  "/sistema/usuarios": "Usuarios",
  "/sistema/roles": "Roles",
  "/sistema/audit-log": "Log de Auditoria",
};

// Sub-routes within catalogos
const catalogoTitles: Record<string, string> = {
  especies: "Especies",
  variedades: "Variedades",
  portainjertos: "Portainjertos",
  pmg: "PMG",
  viveros: "Viveros",
  campos: "Campos",
  colores: "Colores",
  susceptibilidades: "Susceptibilidades",
  "tipos-labor": "Tipos de Labor",
  "estados-planta": "Estados Planta",
  paises: "Paises",
  origenes: "Origenes",
  temporadas: "Temporadas",
  bodegas: "Bodegas",
  regiones: "Regiones",
  comunas: "Comunas",
};

const parentMap: Record<string, { to: string; label: string }> = {
  "/catalogos": { to: "/catalogos", label: "Catalogos" },
  "/inventario": { to: "/inventario", label: "Inventario" },
  "/testblocks": { to: "/testblocks", label: "TestBlocks" },
  "/laboratorio": { to: "/laboratorio", label: "Laboratorio" },
  "/labores": { to: "/labores", label: "Labores" },
  "/sistema": { to: "/sistema/usuarios", label: "Sistema" },
};

function getBreadcrumbs(path: string): { label: string; to?: string }[] {
  const crumbs: { label: string; to?: string }[] = [];

  // Check catalogos sub-routes first
  const catalogoMatch = path.match(/^\/catalogos\/(.+)/);
  if (catalogoMatch) {
    crumbs.push({ label: "Catalogos", to: "/catalogos" });
    crumbs.push({ label: catalogoTitles[catalogoMatch[1]] || catalogoMatch[1] });
    return crumbs;
  }

  // Detail pages with IDs (e.g., /inventario/123, /testblocks/5)
  const detailMatch = path.match(/^(\/[^/]+)\/(\d+)/);
  if (detailMatch) {
    const parentPath = detailMatch[1];
    const parent = parentMap[parentPath];
    if (parent) {
      crumbs.push({ label: parent.label, to: parent.to });
      crumbs.push({ label: `Detalle #${detailMatch[2]}` });
      return crumbs;
    }
  }

  for (const [prefix, parent] of Object.entries(parentMap)) {
    if (path.startsWith(prefix) && path !== prefix) {
      crumbs.push({ label: parent.label, to: parent.to });
      break;
    }
  }

  let title = titleMap[path];
  if (!title) {
    for (const [key, val] of Object.entries(titleMap)) {
      if (path.startsWith(key) && key !== "/") {
        title = val;
        break;
      }
    }
  }
  crumbs.push({ label: title || "Garces Fruit" });

  return crumbs;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Header() {
  const location = useLocation();
  const path = location.pathname;
  const crumbs = getBreadcrumbs(path);
  const title = crumbs[crumbs.length - 1]?.label || "Garces Fruit";
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  // Health check — detects if backend/DB is reachable
  const { data: health, isError: dbDown } = useQuery({
    queryKey: ["health"],
    queryFn: () => get<{ status: string }>("/health"),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 0,
    enabled: !!token,
  });
  const isConnected = !!health && !dbDown;

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2">
        {crumbs.length > 1 ? (
          <nav className="flex items-center gap-1 text-sm">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                {c.to && i < crumbs.length - 1 ? (
                  <Link to={c.to} className="text-muted-foreground hover:text-garces-cherry transition-colors">
                    {c.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-garces-cherry">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : (
          <h1 className="text-lg font-semibold text-garces-cherry">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Connection indicator */}
        <div className="flex items-center gap-1.5" title={isConnected ? "Servidor conectado" : "Servidor desconectado"}>
          {isConnected ? (
            <Wifi className="h-3.5 w-3.5 text-estado-success" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-estado-danger animate-pulse" />
          )}
        </div>

        {/* Season selector */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>Temporada 2024-2025</span>
        </div>

        {/* User avatar */}
        {user && (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-garces-cherry flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">
                {getInitials(user.nombre_completo || user.username)}
              </span>
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-xs font-medium leading-tight">{user.nombre_completo || user.username}</p>
              <p className="text-[10px] text-muted-foreground">{user.rol}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
