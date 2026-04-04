import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Home, Layers, Package, Grid3X3, FlaskConical, Hammer,
  Bell, Settings, ChevronLeft, ChevronRight,
  LogOut, Leaf, FileText, Microscope, Flower2,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
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
    label: "Catalogos",
    items: [
      { to: "/catalogos", label: "Especies y Variedades", icon: Layers },
      { to: "/inventario", label: "Inventario Vivero", icon: Package },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { to: "/testblocks", label: "TestBlocks", icon: Grid3X3 },
      { to: "/labores", label: "Labores", icon: Hammer, badgeKey: "labores" },
      { to: "/fenologia", label: "Fenologia", icon: Flower2 },
    ],
  },
  {
    label: "Calidad",
    items: [
      { to: "/laboratorio", label: "Mediciones Lab", icon: FlaskConical },
      { to: "/laboratorio/analisis", label: "Analisis", icon: Microscope },
      { to: "/reportes", label: "Reportes", icon: FileText },
    ],
  },
  {
    items: [
      { to: "/alertas", label: "Alertas", icon: Bell, badgeKey: "alertas" },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/sistema/usuarios", label: "Sistema", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useLogout();

  const { data: alertas } = useQuery({
    queryKey: ["alertas", "activa", "sidebar"],
    queryFn: () => alertaService.list({ estado: "activa" }),
    staleTime: 60_000,
    enabled: !!token,
  });
  const { data: labores } = useQuery({
    queryKey: ["labores", "planificacion", "sidebar"],
    queryFn: () => laboresService.planificacion(),
    staleTime: 60_000,
    enabled: !!token,
  });
  const alertCount = alertas?.length ?? 0;
  const laboresAtrasadas = labores?.filter((l: { estado: string }) => l.estado === "atrasada").length ?? 0;

  const badgeCounts: Record<string, number> = {
    alertas: alertCount,
    labores: laboresAtrasadas,
  };

  // Inject badge counts into nav items
  const enrichedGroups = navGroups.map((g) => ({
    ...g,
    items: g.items.map((item) => ({
      ...item,
      badge: item.badgeKey ? badgeCounts[item.badgeKey] : undefined,
    })),
  }));

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-garces-cherry-dark text-white transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-white/10">
        <Leaf className="h-7 w-7 text-garces-cherry-glow shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold leading-tight">Garces Fruit</p>
            <p className="text-[10px] text-white/60">Segmentacion de Especies</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {enrichedGroups.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.label && !collapsed && (
              <p className="px-4 py-1 text-[10px] uppercase tracking-wider text-white/40">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-2 text-sm transition-colors relative",
                    isActive
                      ? "bg-white/15 text-white font-medium"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {item.badge != null && item.badge > 0 && (
                  <span className={cn(
                    "inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1",
                    collapsed && "absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] text-[9px]"
                  )}>
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User + Collapse */}
      <div className="border-t border-white/10 p-3">
        {!collapsed && user && (
          <div className="mb-2 text-xs text-white/60 truncate">
            {user.nombre_completo || user.username}
            <br />
            <span className="text-white/40">{user.rol}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Salir"}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-white/40 hover:text-white transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
