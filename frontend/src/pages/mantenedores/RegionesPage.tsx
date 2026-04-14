import { GenericMantenedorPage, col } from "./GenericMantenedorPage";
import type { FieldDef } from "@/types";

const fields: FieldDef[] = [
  { key: "codigo", label: "Código", type: "text", required: true },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "numero", label: "Número", type: "number" },
  { key: "orden", label: "Orden", type: "number" },
];

const columns = [
  col("codigo", "Código"),
  col("nombre", "Nombre"),
  col("numero", "Número"),
  col("orden", "Orden"),
];

export function RegionesPage() {
  return (
    <GenericMantenedorPage
      title="Regiones"
      singularTitle="Región"
      titleGender="f"
      entidad="regiones"
      fields={fields}
      columns={columns}
      idField="id_region"
    />
  );
}
