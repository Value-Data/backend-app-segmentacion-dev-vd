import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getPortainjertoEspecies,
  setPortainjertoEspecies,
  getViveroPmgs,
  setViveroPmgs,
  getPmgEspecies,
  setPmgEspecies,
} from "@/services/relaciones";
import type { RelacionEspecie, RelacionPmg } from "@/services/relaciones";

/**
 * Hook for Portainjerto <-> Especies relationships.
 */
export function usePortainjertoEspecies(portainjertoId: number | null) {
  const qc = useQueryClient();
  const queryKey = ["portainjerto-especies", portainjertoId];

  const query = useQuery({
    queryKey,
    queryFn: () => getPortainjertoEspecies(portainjertoId!),
    enabled: portainjertoId != null,
  });

  const mutation = useMutation({
    mutationFn: (ids: number[]) => setPortainjertoEspecies(portainjertoId!, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Especies actualizadas");
    },
  });

  const currentIds = (query.data ?? []).map((r: RelacionEspecie) => r.id_especie);

  return {
    data: query.data ?? [],
    currentIds,
    isLoading: query.isLoading,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

/**
 * Hook for Vivero <-> PMG relationships.
 */
export function useViveroPmgs(viveroId: number | null) {
  const qc = useQueryClient();
  const queryKey = ["vivero-pmgs", viveroId];

  const query = useQuery({
    queryKey,
    queryFn: () => getViveroPmgs(viveroId!),
    enabled: viveroId != null,
  });

  const mutation = useMutation({
    mutationFn: (ids: number[]) => setViveroPmgs(viveroId!, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("PMGs actualizados");
    },
  });

  const currentIds = (query.data ?? []).map((r: RelacionPmg) => r.id_pmg);

  return {
    data: query.data ?? [],
    currentIds,
    isLoading: query.isLoading,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

/**
 * Hook for PMG <-> Especies relationships.
 */
export function usePmgEspecies(pmgId: number | null) {
  const qc = useQueryClient();
  const queryKey = ["pmg-especies", pmgId];

  const query = useQuery({
    queryKey,
    queryFn: () => getPmgEspecies(pmgId!),
    enabled: pmgId != null,
  });

  const mutation = useMutation({
    mutationFn: (ids: number[]) => setPmgEspecies(pmgId!, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Especies actualizadas");
    },
  });

  const currentIds = (query.data ?? []).map((r: RelacionEspecie) => r.id_especie);

  return {
    data: query.data ?? [],
    currentIds,
    isLoading: query.isLoading,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

/**
 * Hook for PMG <-> Viveros (inverse direction).
 */
export function usePmgViveros(pmgId: number | null) {
  const qc = useQueryClient();
  const queryKey = ["pmg-viveros", pmgId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { get } = await import("@/services/api");
      return get<{ id_vp: number; id_vivero: number; vivero_nombre: string }[]>(
        `/mantenedores/pmg/${pmgId}/viveros`
      );
    },
    enabled: pmgId != null,
  });

  const addMut = useMutation({
    mutationFn: async (id_vivero: number) => {
      const { post } = await import("@/services/api");
      return post<any>(`/mantenedores/pmg/${pmgId}/viveros`, { id_vivero });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success("Vivero agregado"); },
  });

  const removeMut = useMutation({
    mutationFn: async (id_vp: number) => {
      const { del } = await import("@/services/api");
      return del<any>(`/mantenedores/pmg/${pmgId}/viveros/${id_vp}`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success("Vivero eliminado"); },
  });

  return {
    data: query.data ?? [],
    currentIds: (query.data ?? []).map((r) => r.id_vivero),
    isLoading: query.isLoading,
    add: addMut.mutateAsync,
    remove: removeMut.mutateAsync,
    isSaving: addMut.isPending || removeMut.isPending,
  };
}
