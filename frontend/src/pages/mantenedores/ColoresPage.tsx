import { GenericMantenedorPage, col } from "./GenericMantenedorPage";
import type { FieldDef } from "@/types";

const fields: FieldDef[] = [
  { key: "codigo", label: "Código", type: "text" },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "tipo", label: "Tipo", type: "select", required: true, options: [
    { value: "fruto", label: "Fruto" },
    { value: "pulpa", label: "Pulpa" },
    { value: "cubrimiento", label: "Cubrimiento" },
  ]},
  { key: "aplica_especie", label: "Aplica Especie", type: "text", placeholder: "Cerezo,Ciruela" },
  { key: "color_hex", label: "Color Hex", type: "color" },
];

const columns = [
  col("codigo", "Código"),
  col("nombre", "Nombre"),
  col("tipo", "Tipo"),
  col("aplica_especie", "Especie"),
  {
    accessorKey: "color_hex",
    header: "Color",
    cell: ({ getValue }: { getValue: () => unknown }) => {
      const hex = getValue() as string;
      return hex ? (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border" style={{ backgroundColor: hex }} />
          <span className="text-xs">{hex}</span>
        </div>
      ) : "-";
    },
  },
];

export function ColoresPage() {
  return (
    <GenericMantenedorPage
      title="Colores"
      entidad="colores"
      fields={fields}
      columns={columns as any}
      idField="id_color"
    />
  );
}
