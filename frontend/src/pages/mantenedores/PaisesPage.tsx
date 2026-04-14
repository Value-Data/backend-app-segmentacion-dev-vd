import { GenericMantenedorPage, col } from "./GenericMantenedorPage";
import type { FieldDef } from "@/types";

const fields: FieldDef[] = [
  { key: "codigo", label: "Codigo ISO", type: "text", required: true },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "nombre_en", label: "Nombre (EN)", type: "text" },
  { key: "orden", label: "Orden", type: "number" },
];

const columns = [
  col("codigo", "Código"),
  col("nombre", "Nombre"),
  col("nombre_en", "Nombre (EN)"),
  col("orden", "Orden"),
];

export function PaisesPage() {
  return (
    <GenericMantenedorPage
      title="Paises"
      entidad="paises"
      fields={fields}
      columns={columns}
      idField="id_pais"
    />
  );
}
