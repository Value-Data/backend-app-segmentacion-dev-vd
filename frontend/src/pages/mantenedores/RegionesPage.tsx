import { GenericMantenedorPage, col } from "./GenericMantenedorPage";
import type { FieldDef } from "@/types";

const fields: FieldDef[] = [
  { key: "codigo", label: "Codigo", type: "text", required: true },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "numero", label: "Numero", type: "number" },
  { key: "orden", label: "Orden", type: "number" },
];

const columns = [
  col("codigo", "Codigo"),
  col("nombre", "Nombre"),
  col("numero", "Numero"),
  col("orden", "Orden"),
];

export function RegionesPage() {
  return (
    <GenericMantenedorPage
      title="Regiones"
      entidad="regiones"
      fields={fields}
      columns={columns}
      idField="id_region"
    />
  );
}
