import { GenericMantenedorPage, col } from "./GenericMantenedorPage";
import type { FieldDef } from "@/types";

const fields: FieldDef[] = [
  { key: "codigo", label: "Codigo", type: "text", required: true },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "pais", label: "Pais", type: "text" },
  { key: "tipo", label: "Tipo", type: "select", options: [
    { value: "licenciante", label: "Licenciante" },
    { value: "obtentor", label: "Obtentor" },
    { value: "importador", label: "Importador" },
  ]},
  { key: "contacto", label: "Contacto", type: "text" },
  { key: "notas", label: "Notas", type: "textarea" },
];

const columns = [
  col("codigo", "Codigo"),
  col("nombre", "Nombre"),
  col("pais", "Pais"),
  col("tipo", "Tipo"),
];

export function OrigenesPage() {
  return (
    <GenericMantenedorPage
      title="Origenes"
      entidad="origenes"
      fields={fields}
      columns={columns}
      idField="id_origen"
    />
  );
}
