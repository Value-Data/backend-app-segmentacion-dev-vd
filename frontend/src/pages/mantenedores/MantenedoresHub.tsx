import { Link } from "react-router-dom";
import {
  Cherry, TreeDeciduous, Grape, FlaskConical, Trees, MapPin,
  Palette, Bug, Hammer, Leaf, Globe, Navigation, Calendar, Warehouse,
  Map, Building2, Flower2,
} from "lucide-react";

const cards = [
  { to: "/catalogos/especies", label: "Especies", desc: "Cerezo, Ciruela, Durazno...", icon: Cherry },
  { to: "/catalogos/variedades", label: "Variedades", desc: "Catálogo de variedades frutales", icon: Grape },
  { to: "/catalogos/portainjertos", label: "Portainjertos", desc: "Maxma, Gisela, Garnem...", icon: TreeDeciduous },
  { to: "/catalogos/pmg", label: "PMG", desc: "Programas genéticos", icon: FlaskConical },
  { to: "/catalogos/viveros", label: "Viveros", desc: "Proveedores de plantas", icon: Trees },
  { to: "/catalogos/campos", label: "Campos", desc: "Ubicaciones de test", icon: MapPin },
  { to: "/catalogos/colores", label: "Colores", desc: "Fruto, pulpa, cubrimiento", icon: Palette },
  { to: "/catalogos/susceptibilidades", label: "Susceptibilidades", desc: "Enfermedades y plagas", icon: Bug },
  { to: "/catalogos/tipos-labor", label: "Tipos de Labor", desc: "Labores agrícolas", icon: Hammer },
  { to: "/catalogos/estados-fenologicos", label: "Estados Fenológicos", desc: "Ciclo fenológico por especie", icon: Flower2 },
  { to: "/catalogos/estados-planta", label: "Estados Planta", desc: "Alta, baja, replante...", icon: Leaf },
  { to: "/catalogos/paises", label: "Países", desc: "Chile, EEUU, etc.", icon: Globe },
  { to: "/catalogos/origenes", label: "Orígenes", desc: "Licenciantes y obtentores", icon: Navigation },
  { to: "/catalogos/temporadas", label: "Temporadas", desc: "Períodos de evaluación", icon: Calendar },
  { to: "/catalogos/bodegas", label: "Bodegas", desc: "Almacenamiento de plantas", icon: Warehouse },
  { to: "/catalogos/regiones", label: "Regiones", desc: "16 regiones de Chile", icon: Map },
  { to: "/catalogos/comunas", label: "Comunas", desc: "Comunas por región", icon: Building2 },
];

export function MantenedoresHub() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-garces-cherry">Catálogos</h2>
        <p className="text-sm text-muted-foreground">Tablas maestras del sistema</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map((c) => (
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
                <p className="text-xs text-muted-foreground">{c.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
