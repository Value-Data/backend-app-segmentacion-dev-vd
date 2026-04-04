import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { mantenedorService } from "@/services/mantenedores";

interface LookupItem {
  [key: string]: unknown;
}

function buildMap(data: LookupItem[] | undefined, idKey: string, labelKey: string): Map<number, string> {
  const map = new Map<number, string>();
  if (!data) return map;
  for (const item of data) {
    const id = item[idKey] as number;
    const label = item[labelKey] as string;
    if (id != null && label) map.set(id, label);
  }
  return map;
}

function toOptions(data: LookupItem[] | undefined, idKey: string, labelKey: string): { value: number; label: string }[] {
  if (!data) return [];
  return data
    .filter((item) => item[idKey] != null && item[labelKey])
    .map((item) => ({ value: item[idKey] as number, label: item[labelKey] as string }));
}

function toStringOptions(
  data: LookupItem[] | undefined,
  labelKey: string,
): { value: string; label: string }[] {
  if (!data) return [];
  return data
    .filter((item) => item[labelKey])
    .map((item) => ({ value: item[labelKey] as string, label: item[labelKey] as string }));
}

export function useLookups() {
  const { data: variedades } = useQuery({
    queryKey: ["lookup", "variedades"],
    queryFn: () => mantenedorService("variedades").list(),
    staleTime: 5 * 60_000,
  });
  const { data: especies } = useQuery({
    queryKey: ["lookup", "especies"],
    queryFn: () => mantenedorService("especies").list(),
    staleTime: 5 * 60_000,
  });
  const { data: portainjertos } = useQuery({
    queryKey: ["lookup", "portainjertos"],
    queryFn: () => mantenedorService("portainjertos").list(),
    staleTime: 5 * 60_000,
  });
  const { data: campos } = useQuery({
    queryKey: ["lookup", "campos"],
    queryFn: () => mantenedorService("campos").list(),
    staleTime: 5 * 60_000,
  });
  const { data: pmgs } = useQuery({
    queryKey: ["lookup", "pmg"],
    queryFn: () => mantenedorService("pmg").list(),
    staleTime: 5 * 60_000,
  });
  const { data: viveros } = useQuery({
    queryKey: ["lookup", "viveros"],
    queryFn: () => mantenedorService("viveros").list(),
    staleTime: 5 * 60_000,
  });
  const { data: temporadas } = useQuery({
    queryKey: ["lookup", "temporadas"],
    queryFn: () => mantenedorService("temporadas").list(),
    staleTime: 5 * 60_000,
  });
  const { data: regiones } = useQuery({
    queryKey: ["lookup", "regiones"],
    queryFn: () => mantenedorService("regiones").list(),
    staleTime: 5 * 60_000,
  });
  const { data: comunas } = useQuery({
    queryKey: ["lookup", "comunas"],
    queryFn: () => mantenedorService("comunas").list(),
    staleTime: 5 * 60_000,
  });

  // Memoize all ID->name maps — only recomputed when underlying data changes
  const maps = useMemo(() => ({
    varMap: buildMap(variedades as LookupItem[], "id_variedad", "nombre"),
    espMap: buildMap(especies as LookupItem[], "id_especie", "nombre"),
    piMap: buildMap(portainjertos as LookupItem[], "id_portainjerto", "nombre"),
    campoMap: buildMap(campos as LookupItem[], "id_campo", "nombre"),
    pmgMap: buildMap(pmgs as LookupItem[], "id_pmg", "nombre"),
    viveroMap: buildMap(viveros as LookupItem[], "id_vivero", "nombre"),
    tempMap: buildMap(temporadas as LookupItem[], "id_temporada", "nombre"),
    regionMap: buildMap(regiones as LookupItem[], "id_region", "nombre"),
    comunaMap: buildMap(comunas as LookupItem[], "id_comuna", "nombre"),
  }), [variedades, especies, portainjertos, campos, pmgs, viveros, temporadas, regiones, comunas]);

  const resolve = useCallback(
    (map: Map<number, string>, id: unknown): string => {
      if (id == null) return "-";
      const name = map.get(id as number);
      return name || `#${id}`;
    },
    [],
  );

  // Memoize numeric-value options for select dropdowns
  const options = useMemo(() => ({
    especies: toOptions(especies as LookupItem[], "id_especie", "nombre"),
    variedades: toOptions(variedades as LookupItem[], "id_variedad", "nombre"),
    portainjertos: toOptions(portainjertos as LookupItem[], "id_portainjerto", "nombre"),
    campos: toOptions(campos as LookupItem[], "id_campo", "nombre"),
    pmgs: toOptions(pmgs as LookupItem[], "id_pmg", "nombre"),
    viveros: toOptions(viveros as LookupItem[], "id_vivero", "nombre"),
    temporadas: toOptions(temporadas as LookupItem[], "id_temporada", "nombre"),
    regiones: toOptions(regiones as LookupItem[], "id_region", "nombre"),
    comunas: toOptions(comunas as LookupItem[], "id_comuna", "nombre"),
  }), [variedades, especies, portainjertos, campos, pmgs, viveros, temporadas, regiones, comunas]);

  // Memoize string-value options for text-based fields
  const stringOptions = useMemo(() => ({
    regiones: toStringOptions(regiones as LookupItem[], "nombre"),
    comunas: toStringOptions(comunas as LookupItem[], "nombre"),
  }), [regiones, comunas]);

  /** Return comunas filtered by region name (string match, since campos/viveros store
   *  region as VARCHAR text, not FK). */
  const comunasPorRegionNombre = useCallback(
    (regionNombre: string | undefined | null): { value: string; label: string }[] => {
      if (!regionNombre || !comunas || !regiones) return toStringOptions(comunas as LookupItem[], "nombre");
      const regionItems = regiones as LookupItem[];
      const regionObj = regionItems.find(
        (r) => (r.nombre as string) === regionNombre,
      );
      if (!regionObj) return toStringOptions(comunas as LookupItem[], "nombre");
      const regionId = regionObj.id_region as number;
      const filtered = (comunas as LookupItem[]).filter((c) => (c.id_region as number) === regionId);
      return toStringOptions(filtered, "nombre");
    },
    [comunas, regiones],
  );

  return {
    // Resolver ID -> nombre
    variedad: (id: unknown) => resolve(maps.varMap, id),
    especie: (id: unknown) => resolve(maps.espMap, id),
    portainjerto: (id: unknown) => resolve(maps.piMap, id),
    campo: (id: unknown) => resolve(maps.campoMap, id),
    pmg: (id: unknown) => resolve(maps.pmgMap, id),
    vivero: (id: unknown) => resolve(maps.viveroMap, id),
    temporada: (id: unknown) => resolve(maps.tempMap, id),
    region: (id: unknown) => resolve(maps.regionMap, id),
    comuna: (id: unknown) => resolve(maps.comunaMap, id),

    // Datos raw para dropdowns en formularios
    rawData: {
      variedades: variedades as LookupItem[] | undefined,
      especies: especies as LookupItem[] | undefined,
      portainjertos: portainjertos as LookupItem[] | undefined,
      campos: campos as LookupItem[] | undefined,
      temporadas: temporadas as LookupItem[] | undefined,
      regiones: regiones as LookupItem[] | undefined,
      comunas: comunas as LookupItem[] | undefined,
    },

    // Opciones para select (value/label) — numeric ID values
    options,

    // String-value options — for fields that store text, not FK ids
    stringOptions,

    // Helper: get comunas filtered by region name (for cascading dropdowns)
    comunasPorRegionNombre,
  };
}
