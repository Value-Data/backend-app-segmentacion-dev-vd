import { useMemo } from "react";
import { GenericMantenedorPage, col } from "./GenericMantenedorPage";
import { useLookups } from "@/hooks/useLookups";
import type { FieldDef } from "@/types";

const columns = [
  col("codigo", "Codigo"),
  col("nombre", "Nombre"),
  col("pais", "Pais"),
  col("tipo", "Tipo"),
];

export function OrigenesPage() {
  const { stringOptions } = useLookups();

  const fields: FieldDef[] = useMemo(() => [
    { key: "codigo", label: "Codigo", type: "text", required: true },
    { key: "nombre", label: "Nombre", type: "text", required: true },
    { key: "pais", label: "Pais", type: "select", options: stringOptions.paises },
    { key: "tipo", label: "Tipo", type: "select", options: [
      { value: "licenciante", label: "Licenciante" },
      { value: "obtentor", label: "Obtentor" },
      { value: "importador", label: "Importador" },
    ]},
    { key: "contacto", label: "Contacto", type: "text" },
    { key: "notas", label: "Notas", type: "textarea" },
  ], [stringOptions.paises]);

  return (
    <GenericMantenedorPage
      title="Origenes"
      singularTitle="Origen"
      entidad="origenes"
      fields={fields}
      columns={columns}
      idField="id_origen"
      autoCode
    />
  );
}
