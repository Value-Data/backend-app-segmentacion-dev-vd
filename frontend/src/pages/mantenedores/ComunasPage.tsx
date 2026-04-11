import { useMemo } from "react";
import { GenericMantenedorPage, col } from "./GenericMantenedorPage";
import { useLookups } from "@/hooks/useLookups";
import type { FieldDef } from "@/types";

export function ComunasPage() {
  const { options, region } = useLookups();

  const fields: FieldDef[] = useMemo(() => [
    { key: "nombre", label: "Nombre", type: "text", required: true },
    {
      key: "id_region",
      label: "Region",
      type: "select",
      required: true,
      options: options.regiones,
    },
    { key: "codigo_postal", label: "Codigo Postal", type: "text" },
  ], [options.regiones]);

  const columns = useMemo(() => [
    col("nombre", "Nombre"),
    col("id_region", "Region", {
      cell: ({ getValue }) => {
        const val = getValue() as number;
        return region(val);
      },
    }),
    col("codigo_postal", "Codigo Postal"),
  ], [region]);

  return (
    <GenericMantenedorPage
      title="Comunas"
      singularTitle="Comuna"
      titleGender="f"
      entidad="comunas"
      fields={fields}
      columns={columns}
      idField="id_comuna"
    />
  );
}
