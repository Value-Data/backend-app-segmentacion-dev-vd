import { GenericMantenedorPage, col } from "./GenericMantenedorPage";
import type { FieldDef } from "@/types";

const fields: FieldDef[] = [
  { key: "codigo", label: "Codigo", type: "text", required: true },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "categoria", label: "Categoria", type: "text" },
  { key: "aplica_especies", label: "Aplica Especies", type: "text" },
  { key: "aplica_a", label: "Aplica a", type: "select", options: [
    { value: "planta", label: "Planta" },
    { value: "hilera", label: "Hilera" },
    { value: "testblock", label: "TestBlock" },
  ]},
  { key: "frecuencia", label: "Frecuencia", type: "text" },
  { key: "descripcion", label: "Descripcion", type: "textarea" },
];

const columns = [
  col("codigo", "Codigo"),
  col("nombre", "Nombre"),
  col("categoria", "Categoria"),
  col("aplica_a", "Aplica a"),
  col("frecuencia", "Frecuencia"),
];

export function TiposLaborPage() {
  return (
    <GenericMantenedorPage
      title="Tipos de Labor"
      entidad="tipos-labor"
      fields={fields}
      columns={columns}
      idField="id_labor"
    />
  );
}
