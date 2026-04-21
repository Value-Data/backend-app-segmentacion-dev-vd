import { useLocation, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Calendar, Wifi, WifiOff, Search, Moon, Sun, Menu } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { get } from "@/services/api";
import { CommandPalette } from "./CommandPalette";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useTemporadaStore } from "@/stores/temporadaStore";
import { mantenedorService } from "@/services/mantenedores";

const titleMap: Record<string, string> = {
  "/": "Dashboard",
  "/catalogos": "Catálogos",
  "/inventario": "Inventario Bodega",
  "/testblocks": "TestBlocks",
  "/laboratorio": "Mediciones Lab",
  "/laboratorio/analisis": "Análisis de Calidad",
  "/labores": "Labores",
  "/fenologia": "Fenología",
  "/analisis": "Análisis",
  "/reportes": "Reportes",
  "/alertas": "Centro de Alertas",
  "/sistema/usuarios": "Usuarios",
  "/sistema/audit-log": "Log de Auditoría",
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
  "estados-fenologicos": "Estados Fenológicos",
  paises: "Países",
  origenes: "Orígenes",
  temporadas: "Temporadas",
  bodegas: "Bodegas",
  regiones: "Regiones",
  comunas: "Comunas",
};

const parentMap: Record<string, { to: string; label: string }> = {
  "/catalogos": { to: "/catalogos", label: "Catálogos" },
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
    crumbs.push({ label: "Catálogos", to: "/catalogos" });
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

  // Temporadas: load from backend and sync to global store
  const currentTemporada = useTemporadaStore((s) => s.current);
  const setCurrentTemporada = useTemporadaStore((s) => s.setCurrent);
  const [tempMenuOpen, setTempMenuOpen] = useState(false);
  const { data: temporadas } = useQuery({
    queryKey: ["temporadas"],
    queryFn: () => mantenedorService("temporadas").list(),
    enabled: !!token,
    staleTime: 5 * 60_000,
  });
  const temporadaOpts = ((temporadas || []) as any[])
    .filter((t) => t.activo !== false)
    .map((t) => String(t.nombre || t.codigo || ""))
    .filter((v) => v && !/test/i.test(v));

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

          {/* Season selector */}
          <div className="hidden md:block relative">
            <button
              onClick={() => setTempMenuOpen((o) => !o)}
              onBlur={() => setTimeout(() => setTempMenuOpen(false), 150)}
              className="flex items-center gap-1.5 text-xs text-foreground bg-muted/40 hover:bg-muted/60 rounded-full px-3 py-1.5 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>{currentTemporada}</span>
              <ChevronRight className={`h-3 w-3 transition-transform ${tempMenuOpen ? "rotate-90" : ""}`} />
            </button>
            {tempMenuOpen && temporadaOpts.length > 0 && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border/50 rounded-lg shadow-lg py-1 z-30 min-w-[140px]">
                {temporadaOpts.map((t) => (
                  <button
                    key={t}
                    onMouseDown={() => {
                      setCurrentTemporada(t);
                      setTempMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 transition-colors ${
                      t === currentTemporada ? "bg-muted/40 font-semibold" : ""
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
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
