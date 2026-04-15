import { GenericMantenedorPage, col, statusCol, boolCol } from "./GenericMantenedorPage";
import { useLookups } from "@/hooks/useLookups";
import type { FieldDef } from "@/types";

const GRUPO_OPTIONS = [
  { value: "Partiduras y Suturas", label: "Partiduras y Suturas" },
  { value: "Daños y Heridas", label: "Daños y Heridas" },
  { value: "Pudriciones", label: "Pudriciones" },
  { value: "Pudriciones y Blando", label: "Pudriciones y Blando" },
  { value: "Deshidrataciones", label: "Deshidrataciones" },
  { value: "Defectos de Calidad", label: "Defectos de Calidad" },
  { value: "Calidad", label: "Calidad" },
  { value: "Condición", label: "Condición" },
  { value: "Cerezas Amarillas", label: "Cerezas Amarillas" },
];

export function SusceptibilidadesPage() {
  const lk = useLookups();

  const fields: FieldDef[] = [
    { key: "codigo", label: "Código", type: "text", required: true },
    { key: "nombre", label: "Nombre", type: "text", required: true },
    { key: "nombre_en", label: "Nombre (EN)", type: "text" },
    { key: "id_especie", label: "Especie", type: "select", options: lk.options.especies, required: true },
    { key: "grupo", label: "Grupo", type: "select", options: GRUPO_OPTIONS, required: true },
    { key: "severidad", label: "Severidad", type: "select", options: [
      { value: "baja", label: "Baja" },
      { value: "media", label: "Media" },
      { value: "alta", label: "Alta" },
    ]},
    { key: "orden", label: "Orden", type: "number" },
    { key: "descripcion", label: "Descripción", type: "textarea" },
  ];

  const columns = [
    col("codigo", "Código"),
    col("nombre", "Nombre"),
    {
      accessorKey: "id_especie",
      header: "Especie",
      cell: ({ getValue }: any) => lk.especie(getValue()) || "-",
    },
    col("grupo", "Grupo"),
    statusCol("severidad", "Severidad"),
    boolCol("activo", "Activo"),
  ];

  return (
    <GenericMantenedorPage
      title="Susceptibilidades"
      singularTitle="Susceptibilidad"
      titleGender="f"
      entidad="susceptibilidades"
      fields={fields}
      columns={columns}
      idField="id_suscept"
    />
  );
}
