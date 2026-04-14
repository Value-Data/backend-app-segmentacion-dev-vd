import { GenericMantenedorPage, col } from "./GenericMantenedorPage";
import type { FieldDef } from "@/types";

const fields: FieldDef[] = [
  { key: "codigo", label: "Código", type: "text" },
  { key: "nombre", label: "Nombre", type: "text" },
  { key: "ubicacion", label: "Ubicación", type: "text" },
  { key: "responsable", label: "Responsable", type: "text" },
];

const columns = [
  col("codigo", "Código"),
  col("nombre", "Nombre"),
  col("ubicacion", "Ubicación"),
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
      autoCode
    />
  );
}
