import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Layers, Package, Grid3X3, FlaskConical, Hammer,
  Bell, Settings, ChevronLeft, ChevronRight,
  LogOut, Leaf, FileText, Microscope, Flower2, FolderOpen,
  BarChart3, Search,
} from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useLogout } from "@/hooks/useAuth";
import { alertaService } from "@/services/sistema";
import { laboresService } from "@/services/labores";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  badgeKey?: "alertas" | "labores";
}

const navGroups: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: "/", label: "Inicio", icon: Home },
    ],
  },
  {
    label: "Mantenedores",
    items: [
      { to: "/catalogos", label: "Especies y Variedades", icon: Layers },
    ],
  },
  {
    label: "Inventario",
    items: [
      { to: "/inventario", label: "Inventario Bodega", icon: Package },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { to: "/testblocks", label: "TestBlocks", icon: Grid3X3 },
      { to: "/labores", label: "Labores", icon: Hammer, badgeKey: "labores" },
      { to: "/fenologia", label: "Fenolog\u00eda", icon: Flower2 },
    ],
  },
  {
    label: "Calidad",
    items: [
      { to: "/laboratorio", label: "Mediciones Lab", icon: FlaskConical },
      { to: "/laboratorio/analisis", label: "Clasificaci\u00f3n Calidad", icon: Microscope },
    ],
  },
  {
    label: "Reportes",
    items: [
      { to: "/reportes", label: "Reportes", icon: FileText },
    ],
  },
  {
    items: [
      { to: "/alertas", label: "Alertas", icon: Bell, badgeKey: "alertas" },
      { to: "/analisis", label: "Paquetes Tecnol\u00f3gicos", icon: BarChart3 },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/sistema/usuarios", label: "Sistema", icon: Settings },
    ],
  },
];

/** Auto-collapse sidebar based on window width */
function useResponsiveSidebar() {
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);

  useEffect(() => {
    const mediaTablet = window.matchMedia("(max-width: 1024px)");

    const handleChange = () => {
      if (mediaTablet.matches) {
        setCollapsed(true);
      }
    };

    // Set initial state
    handleChange();

    mediaTablet.addEventListener("change", handleChange);
    return () => {
      mediaTablet.removeEventListener("change", handleChange);
    };
  }, [setCollapsed]);
}

/** Close mobile drawer on route change */
function useCloseMobileOnNavigate() {
  const location = useLocation();
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, setMobileOpen]);
}

/** Inner sidebar content — shared between desktop aside and mobile sheet */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useLogout();

  const { data: alertas } = useQuery({
    queryKey: ["alertas", "activa", "sidebar"],
    queryFn: () => alertaService.list({ estado: "activa" }),
    staleTime: 60_000,
    enabled: !!token,
  });
  const { data: laboresCount } = useQuery({
    queryKey: ["labores", "count", "sidebar"],
    queryFn: () => laboresService.count(),
    staleTime: 60_000,
    enabled: !!token,
  });
  const alertCount = alertas?.length ?? 0;
  const laboresAtrasadas = laboresCount?.atrasadas ?? 0;

  const badgeCounts: Record<string, number> = {
    alertas: alertCount,
    labores: laboresAtrasadas,
  };

  const enrichedGroups = navGroups.map((g) => ({
    ...g,
    items: g.items.map((item) => ({
      ...item,
      badge: item.badgeKey ? badgeCounts[item.badgeKey] : undefined,
    })),
  }));

  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/8">
        <img
          src="/logo-garces.png"
          alt="Garces Fruit"
          className={cn(
            "shrink-0 object-contain rounded-lg bg-white p-1",
            collapsed ? "h-9 w-9" : "h-10 w-10"
          )}
        />
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <p className="text-sm font-bold leading-tight tracking-tight">Garces Fruit</p>
              <p className="text-[10px] text-white/50 leading-tight">Segmentacion de Especies</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search via Ctrl+K — single search bar in header */}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {enrichedGroups.map((group, gi) => (
          <div key={gi}>
            <AnimatePresence>
              {group.label && !collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-widest text-white/30 font-semibold"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            {collapsed && group.label && (
              <div className="mx-auto my-2 w-6 h-px bg-white/10" />
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 relative group",
                    collapsed && "justify-center px-0",
                    isActive
                      ? "bg-white/12 text-white font-medium shadow-sm"
                      : "text-white/60 hover:bg-white/8 hover:text-white/90"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-lg bg-white/12"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                    <item.icon className={cn("h-4.5 w-4.5 shrink-0 relative z-10", collapsed && "h-5 w-5")} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          className="flex-1 relative z-10 whitespace-nowrap overflow-hidden"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {item.badge != null && item.badge > 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center justify-center rounded-full bg-red-500 text-white font-bold relative z-10",
                          collapsed
                            ? "absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] text-[9px] px-0.5"
                            : "min-w-[20px] h-[20px] text-[10px] px-1"
                        )}
                      >
                        {item.badge > 999 ? "999+" : item.badge}
                      </span>
                    )}
                    {/* Tooltip when collapsed */}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                        {item.label}
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User + Collapse */}
      <div className="border-t border-white/8 p-3">
        <AnimatePresence>
          {!collapsed && user && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-3 px-2"
            >
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-red-700 to-red-500 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-white">
                    {(user.nombre_completo || user.username || "U")
                      .split(" ")
                      .map((w: string) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate text-white/90">
                    {user.nombre_completo || user.username}
                  </p>
                  <p className="text-[10px] text-white/40 capitalize">{user.rol}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center justify-between px-1">
          <button
            onClick={logout}
            aria-label="Cerrar sesion"
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/80 transition-colors rounded-md px-2 py-1.5 hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                >
                  Salir
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
            className="text-white/30 hover:text-white/70 transition-colors p-1.5 rounded-md hover:bg-white/5"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </>
  );
}

/** Mobile sidebar rendered as a sheet/drawer */
function MobileSidebar() {
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);

  useCloseMobileOnNavigate();

  if (!mobileOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 md:hidden"
        onClick={() => setMobileOpen(false)}
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col bg-gradient-to-b from-[hsl(0,40%,18%)] to-[hsl(0,35%,12%)] text-white md:hidden shadow-2xl">
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </div>
    </>
  );
}

/** Desktop sidebar rendered as fixed aside */
function DesktopSidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);

  useResponsiveSidebar();

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 260 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="hidden md:flex flex-col h-screen bg-gradient-to-b from-[hsl(0,40%,18%)] to-[hsl(0,35%,12%)] text-white shrink-0 relative z-10"
    >
      <SidebarContent />
    </motion.aside>
  );
}

export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileSidebar />
    </>
  );
}
