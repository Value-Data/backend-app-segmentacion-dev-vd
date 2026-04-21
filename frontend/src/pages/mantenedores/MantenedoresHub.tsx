import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import {
  Cherry, TreeDeciduous, Grape, FlaskConical, Trees, MapPin,
  Palette, Bug, Hammer, Leaf, Globe, Navigation, Calendar, Warehouse,
  Map, Building2, Flower2,
} from "lucide-react";
import { mantenedorService } from "@/services/mantenedores";

interface HubCard {
  to: string;
  label: string;
  desc: string;
  icon: typeof Cherry;
  /** Entidad backend para contar registros. Si se setea, reemplaza `desc` con "{count} registros". */
  entity?: string;
}

const cards: HubCard[] = [
  { to: "/catalogos/especies", label: "Especies", desc: "Familias frutales", icon: Cherry, entity: "especies" },
  { to: "/catalogos/variedades", label: "Variedades", desc: "Catalogo de variedades", icon: Grape, entity: "variedades" },
  { to: "/catalogos/portainjertos", label: "Portainjertos", desc: "Patrones de injerto", icon: TreeDeciduous, entity: "portainjertos" },
  { to: "/catalogos/pmg", label: "PMG", desc: "Programas geneticos", icon: FlaskConical, entity: "pmg" },
  { to: "/catalogos/viveros", label: "Viveros", desc: "Proveedores de plantas", icon: Trees, entity: "viveros" },
  { to: "/catalogos/campos", label: "Campos", desc: "Ubicaciones de test", icon: MapPin, entity: "campos" },
  { to: "/catalogos/colores", label: "Colores", desc: "Fruto, pulpa, cubrimiento", icon: Palette, entity: "colores" },
  { to: "/catalogos/susceptibilidades", label: "Susceptibilidades", desc: "Enfermedades y plagas", icon: Bug, entity: "susceptibilidades" },
  { to: "/catalogos/tipos-labor", label: "Tipos de Labor", desc: "Labores agricolas", icon: Hammer },
  { to: "/catalogos/estados-fenologicos", label: "Estados Fenologicos", desc: "Ciclo fenologico por especie", icon: Flower2, entity: "estados-fenologicos" },
  { to: "/catalogos/estados-planta", label: "Estados Planta", desc: "Alta, baja, replante...", icon: Leaf, entity: "estados-planta" },
  { to: "/catalogos/paises", label: "Paises", desc: "Paises", icon: Globe, entity: "paises" },
  { to: "/catalogos/origenes", label: "Origenes", desc: "Licenciantes y obtentores", icon: Navigation, entity: "origenes" },
  { to: "/catalogos/temporadas", label: "Temporadas", desc: "Periodos de evaluacion", icon: Calendar, entity: "temporadas" },
  { to: "/catalogos/bodegas", label: "Bodegas", desc: "Almacenamiento de plantas", icon: Warehouse, entity: "bodegas" },
  { to: "/catalogos/regiones", label: "Regiones", desc: "16 regiones de Chile", icon: Map, entity: "regiones" },
  { to: "/catalogos/comunas", label: "Comunas", desc: "Comunas por region", icon: Building2, entity: "comunas" },
];

export function MantenedoresHub() {
  const countQueries = useQueries({
    queries: cards
      .filter((c) => c.entity)
      .map((c) => ({
        queryKey: ["hub-count", c.entity],
        queryFn: async () => {
          const data = await mantenedorService(c.entity!).list();
          return Array.isArray(data) ? data.length : 0;
        },
        staleTime: 5 * 60_000,
      })),
  });
  const countByEntity: Record<string, number | undefined> = {};
  let idx = 0;
  for (const c of cards) {
    if (!c.entity) continue;
    countByEntity[c.entity] = countQueries[idx]?.data as number | undefined;
    idx += 1;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-garces-cherry">Catalogos</h2>
        <p className="text-sm text-muted-foreground">Tablas maestras del sistema</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map((c) => {
          const count = c.entity ? countByEntity[c.entity] : undefined;
          const subtitle = count != null
            ? `${count} ${count === 1 ? "registro" : "registros"}`
            : c.desc;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-garces-cherry-pale flex items-center justify-center group-hover:bg-garces-cherry transition-colors">
                  <c.icon className="h-5 w-5 text-garces-cherry group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
