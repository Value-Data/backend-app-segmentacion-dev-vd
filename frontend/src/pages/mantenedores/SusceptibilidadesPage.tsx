import { GenericMantenedorPage, col, statusCol } from "./GenericMantenedorPage";
import type { FieldDef } from "@/types";

const fields: FieldDef[] = [
  { key: "codigo", label: "Codigo", type: "text", required: true },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "nombre_en", label: "Nombre (EN)", type: "text" },
  { key: "categoria", label: "Categoria", type: "text" },
  { key: "severidad", label: "Severidad", type: "select", options: [
    { value: "baja", label: "Baja" },
    { value: "media", label: "Media" },
    { value: "alta", label: "Alta" },
  ]},
  { key: "orden", label: "Orden", type: "number" },
  { key: "descripcion", label: "Descripcion", type: "textarea" },
];

const columns = [
  col("codigo", "Codigo"),
  col("nombre", "Nombre"),
  col("categoria", "Categoria"),
  statusCol("severidad", "Severidad"),
];

export function SusceptibilidadesPage() {
  return (
    <GenericMantenedorPage
      title="Susceptibilidades"
      entidad="susceptibilidades"
      fields={fields}
      columns={columns}
      idField="id_suscept"
    />
  );
}
