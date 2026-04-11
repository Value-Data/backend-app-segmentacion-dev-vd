import { GenericMantenedorPage, col, statusCol } from "./GenericMantenedorPage";
import type { FieldDef } from "@/types";

const fields: FieldDef[] = [
  { key: "codigo", label: "Codigo", type: "text", required: true },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "fecha_inicio", label: "Fecha Inicio", type: "date" },
  { key: "fecha_fin", label: "Fecha Fin", type: "date" },
  { key: "estado", label: "Estado", type: "select", options: [
    { value: "activa", label: "Activa" },
    { value: "cerrada", label: "Cerrada" },
    { value: "planificada", label: "Planificada" },
  ]},
  { key: "notas", label: "Notas", type: "textarea" },
];

const columns = [
  col("codigo", "Codigo"),
  col("nombre", "Nombre"),
  col("fecha_inicio", "Inicio"),
  col("fecha_fin", "Fin"),
  statusCol("estado", "Estado"),
];

export function TemporadasPage() {
  return (
    <GenericMantenedorPage
      title="Temporadas"
      singularTitle="Temporada"
      titleGender="f"
      entidad="temporadas"
      fields={fields}
      columns={columns}
      idField="id_temporada"
    />
  );
}
