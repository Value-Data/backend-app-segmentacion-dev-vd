import { GenericMantenedorPage, col, boolCol } from "./GenericMantenedorPage";
import type { FieldDef } from "@/types";

const fields: FieldDef[] = [
  { key: "codigo", label: "Codigo", type: "text", required: true },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "descripcion", label: "Descripcion", type: "textarea" },
  { key: "color_hex", label: "Color", type: "color" },
  { key: "icono", label: "Icono", type: "text" },
  { key: "requiere_foto", label: "Requiere Foto", type: "boolean" },
  { key: "es_final", label: "Es Final", type: "boolean" },
  { key: "orden", label: "Orden", type: "number" },
];

const columns = [
  col("codigo", "Codigo"),
  col("nombre", "Nombre"),
  boolCol("requiere_foto", "Req. Foto"),
  boolCol("es_final", "Final"),
  col("orden", "Orden"),
];

export function EstadosPlantaPage() {
  return (
    <GenericMantenedorPage
      title="Estados de Planta"
      entidad="estados-planta"
      fields={fields}
      columns={columns}
      idField="id_estado"
    />
  );
}
