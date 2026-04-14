import { GenericMantenedorPage, col, boolCol } from "./GenericMantenedorPage";
import type { FieldDef } from "@/types";

const fields: FieldDef[] = [
  { key: "codigo", label: "Código", type: "text", required: true },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "nombre_cientifico", label: "Nombre Científico", type: "text" },
  { key: "emoji", label: "Emoji", type: "text" },
  { key: "color_hex", label: "Color", type: "color" },
];

const columns = [
  col("codigo", "Código"),
  col("nombre", "Nombre"),
  col("nombre_cientifico", "N. Científico"),
  col("emoji", "Emoji"),
  {
    id: "completitud",
    header: "",
    size: 40,
    cell: ({ row }: any) => {
      const r = row.original;
      const missing = [
        !r.nombre_cientifico && "N. Científico",
        !r.emoji && "Emoji",
      ].filter(Boolean);
      if (missing.length === 0) return null;
      return (
        <span
          className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-medium"
          title={`Falta: ${missing.join(", ")}`}
        >
          Incompleto
        </span>
      );
    },
  },
  boolCol("activo", "Activo"),
];

export function EspeciesPage() {
  return (
    <GenericMantenedorPage
      title="Especies"
      singularTitle="Especie"
      titleGender="f"
      entidad="especies"
      fields={fields}
      columns={columns}
      idField="id_especie"
      autoCode
    />
  );
}
