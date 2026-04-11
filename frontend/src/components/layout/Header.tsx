import { useLocation, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Calendar, Wifi, WifiOff, Search, Moon, Sun, Menu } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { get } from "@/services/api";
import { CommandPalette } from "./CommandPalette";
import { useSidebarStore } from "@/stores/sidebarStore";

const titleMap: Record<string, string> = {
  "/": "Dashboard",
  "/catalogos": "Catalogos",
  "/inventario": "Inventario Bodega",
  "/testblocks": "TestBlocks",
  "/laboratorio": "Mediciones Lab",
  "/laboratorio/analisis": "Analisis de Calidad",
  "/labores": "Labores",
  "/fenologia": "Fenologia",
  "/analisis": "Analisis",
  "/reportes": "Reportes",
  "/alertas": "Centro de Alertas",
  "/sistema/usuarios": "Usuarios",
  "/sistema/audit-log": "Log de Auditoria",
};

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
  "estados-fenologicos": "Estados Fenologicos",
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
  const crumbs: { label: string; to?: string }[] = [
    { label: "Inicio", to: "/" },
  ];

  if (path === "/") return [{ label: "Dashboard" }];

  const catalogoMatch = path.match(/^\/catalogos\/(.+)/);
  if (catalogoMatch) {
    crumbs.push({ label: "Catalogos", to: "/catalogos" });
    crumbs.push({ label: catalogoTitles[catalogoMatch[1]] || catalogoMatch[1] });
    return crumbs;
  }

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
  crumbs.push({ label: title || path.split("/").pop() || "" });
  return crumbs;
}

export function Header() {
  const location = useLocation();
  const path = location.pathname;
  const crumbs = getBreadcrumbs(path);
  const title = crumbs[crumbs.length - 1]?.label || "Garces Fruit";
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const toggleMobileOpen = useSidebarStore((s) => s.toggleMobileOpen);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [dark, setDark] = useState(false);

  // Ctrl+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const { data: health, isError: dbDown } = useQuery({
    queryKey: ["health"],
    queryFn: () => get<{ status: string }>("/health"),
    staleTime: 30_000,
    refetchInterval: 120_000,
    retry: 0,
    enabled: !!token,
  });
  const isConnected = !!health && !dbDown;

  return (
    <>
      <header className="h-14 border-b border-border/50 bg-card/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-20">
        {/* Mobile hamburger */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={toggleMobileOpen}
            aria-label="Abrir menu"
            className="md:hidden p-1.5 -ml-1.5 mr-1 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-sm">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
                {c.to && i < crumbs.length - 1 ? (
                  <Link
                    to={c.to}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-foreground">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Search button */}
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground text-xs"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Buscar...</span>
            <kbd className="hidden sm:inline text-[10px] bg-background rounded px-1.5 py-0.5 border border-border/50">
              Ctrl+K
            </kbd>
          </button>

          {/* Connection indicator */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md"
            title={isConnected ? "Servidor conectado" : "Servidor desconectado"}
          >
            {isConnected ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-red-500 animate-pulse" />
            )}
          </div>

          {/* Season */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-full px-3 py-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>2024-2025</span>
          </div>

          {/* Dark mode */}
          <button
            onClick={() => setDark(!dark)}
            aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className="p-2 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* User */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-border/50">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-red-700 to-red-500 flex items-center justify-center">
                <span className="text-[11px] font-bold text-white">
                  {(user.nombre_completo || user.username || "U")
                    .split(" ")
                    .map((w: string) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
              </div>
              <div className="hidden lg:block text-right">
                <p className="text-xs font-medium leading-tight">{user.nombre_completo || user.username}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{user.rol}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </>
  );
}
