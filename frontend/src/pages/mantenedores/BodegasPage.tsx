import { GenericMantenedorPage, col } from "./GenericMantenedorPage";
import type { FieldDef } from "@/types";

const fields: FieldDef[] = [
  { key: "codigo", label: "Codigo", type: "text" },
  { key: "nombre", label: "Nombre", type: "text" },
  { key: "ubicacion", label: "Ubicacion", type: "text" },
  { key: "responsable", label: "Responsable", type: "text" },
];

const columns = [
  col("codigo", "Codigo"),
  col("nombre", "Nombre"),
  col("ubicacion", "Ubicacion"),
  col("responsable", "Responsable"),
];

export function BodegasPage() {
  return (
    <GenericMantenedorPage
      title="Bodegas"
      singularTitle="Bodega"
      titleGender="f"
      entidad="bodegas"
      fields={fields}
      columns={columns}
      idField="id_bodega"
    />
  );
}
