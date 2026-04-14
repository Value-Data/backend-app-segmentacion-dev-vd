import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  Home, Layers, Package, Grid3X3, FlaskConical, Hammer,
  Bell, Settings, FileText, Microscope, Flower2, FolderOpen,
  BarChart3,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const pages = [
  { label: "Inicio", to: "/", icon: Home, group: "Navegacion" },
  { label: "Especies y Variedades", to: "/catalogos", icon: Layers, group: "Mantenedores" },
  { label: "Especies", to: "/catalogos/especies", icon: Layers, group: "Mantenedores" },
  { label: "Variedades", to: "/catalogos/variedades", icon: Layers, group: "Mantenedores" },
  { label: "Portainjertos", to: "/catalogos/portainjertos", icon: Layers, group: "Mantenedores" },
  { label: "PMG", to: "/catalogos/pmg", icon: Layers, group: "Mantenedores" },
  { label: "Campos", to: "/catalogos/campos", icon: Layers, group: "Mantenedores" },
  { label: "Viveros", to: "/catalogos/viveros", icon: Layers, group: "Mantenedores" },
  { label: "Inventario Bodega", to: "/inventario", icon: Package, group: "Inventario" },
  { label: "TestBlocks", to: "/testblocks", icon: Grid3X3, group: "Operaciones" },
  { label: "Labores", to: "/labores", icon: Hammer, group: "Operaciones" },
  { label: "Fenología", to: "/fenologia", icon: Flower2, group: "Operaciones" },
  { label: "Mediciones Laboratorio", to: "/laboratorio", icon: FlaskConical, group: "Calidad" },
  { label: "Análisis de Calidad", to: "/laboratorio/analisis", icon: Microscope, group: "Calidad" },
  { label: "Reportes", to: "/reportes", icon: FileText, group: "Reportes" },
  { label: "Análisis General", to: "/analisis", icon: BarChart3, group: "Reportes" },
  { label: "Alertas", to: "/alertas", icon: Bell, group: "Sistema" },
  { label: "Usuarios", to: "/sistema/usuarios", icon: Settings, group: "Sistema" },
];

const groups = [...new Set(pages.map((p) => p.group))];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Command dialog */}
      <div className="absolute left-1/2 top-[20%] -translate-x-1/2 w-full max-w-lg">
        <Command
          className="bg-card rounded-xl border border-border/50 shadow-warm-lg overflow-hidden"
          onKeyDown={(e) => {
            if (e.key === "Escape") onOpenChange(false);
          }}
        >
          <Command.Input
            placeholder="Buscar paginas, variedades, lotes..."
            className="w-full px-4 py-3.5 text-sm bg-transparent border-b border-border/50 outline-none placeholder:text-muted-foreground/60"
            autoFocus
          />
          <Command.List className="max-h-[320px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron resultados.
            </Command.Empty>

            {groups.map((group) => (
              <Command.Group key={group} heading={group} className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/60 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-semibold">
                {pages
                  .filter((p) => p.group === group)
                  .map((page) => (
                    <Command.Item
                      key={page.to}
                      value={`${page.label} ${page.group}`}
                      onSelect={() => {
                        navigate(page.to);
                        onOpenChange(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary transition-colors"
                    >
                      <page.icon className="h-4 w-4 text-muted-foreground" />
                      <span>{page.label}</span>
                    </Command.Item>
                  ))}
              </Command.Group>
            ))}
          </Command.List>

          <div className="border-t border-border/50 px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground/50">
            <span><kbd className="bg-muted rounded px-1 py-0.5">Enter</kbd> para ir</span>
            <span><kbd className="bg-muted rounded px-1 py-0.5">Esc</kbd> para cerrar</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
