import { GenericMantenedorPage, col, boolCol } from "./GenericMantenedorPage";
import type { FieldDef } from "@/types";

const fields: FieldDef[] = [
  { key: "codigo", label: "Codigo", type: "text", required: true },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "nombre_cientifico", label: "Nombre Cientifico", type: "text" },
  { key: "emoji", label: "Emoji", type: "text" },
  { key: "color_hex", label: "Color", type: "color" },
];

const columns = [
  col("codigo", "Codigo"),
  col("nombre", "Nombre"),
  col("nombre_cientifico", "N. Cientifico"),
  col("emoji", "Emoji"),
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
    />
  );
}
