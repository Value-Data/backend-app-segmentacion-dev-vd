import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { testblockService } from "@/services/testblock";

export function useTestblocks() {
  return useQuery({
    queryKey: ["testblocks"],
    queryFn: testblockService.list,
  });
}

export function useTestblock(id: number) {
  return useQuery({
    queryKey: ["testblocks", id],
    queryFn: () => testblockService.getById(id),
    enabled: !!id,
  });
}

export function useGrilla(id: number) {
  return useQuery({
    queryKey: ["testblocks", id, "grilla"],
    queryFn: () => testblockService.grilla(id),
    enabled: !!id,
  });
}

export function useResumenHileras(id: number) {
  return useQuery({
    queryKey: ["testblocks", id, "resumen-hileras"],
    queryFn: () => testblockService.resumenHileras(id),
    enabled: !!id,
  });
}

export function useResumenVariedades(id: number) {
  return useQuery({
    queryKey: ["testblocks", id, "resumen-variedades"],
    queryFn: () => testblockService.resumenVariedades(id),
    enabled: !!id,
  });
}

export function useInventarioTestblock(id: number) {
  return useQuery({
    queryKey: ["testblocks", id, "inventario"],
    queryFn: () => testblockService.inventarioTestblock(id),
    enabled: !!id,
  });
}

export function useTestblockMutations(id: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["testblocks", id] });
  };

  const alta = useMutation({
    mutationFn: (data: Record<string, unknown>) => testblockService.alta(id, data),
    onSuccess: () => { invalidate(); toast.success("Planta dada de alta"); },
  });

  const altaMasiva = useMutation({
    mutationFn: (data: Record<string, unknown>) => testblockService.altaMasiva(id, data),
    onSuccess: () => { invalidate(); toast.success("Alta masiva completada"); },
  });

  const baja = useMutation({
    mutationFn: (data: Record<string, unknown>) => testblockService.baja(id, data),
    onSuccess: () => { invalidate(); toast.success("Planta dada de baja"); },
  });

  const bajaMasiva = useMutation({
    mutationFn: (data: Record<string, unknown>) => testblockService.bajaMasiva(id, data),
    onSuccess: () => { invalidate(); toast.success("Baja masiva completada"); },
  });

  const replante = useMutation({
    mutationFn: (data: Record<string, unknown>) => testblockService.replante(id, data),
    onSuccess: () => { invalidate(); toast.success("Replante completado"); },
  });

  return { alta, altaMasiva, baja, bajaMasiva, replante };
}
