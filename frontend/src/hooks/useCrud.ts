import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mantenedorService } from "@/services/mantenedores";

export function useCrud(entidad: string, params?: Record<string, string | number | boolean | undefined | null>) {
  const queryClient = useQueryClient();
  const svc = mantenedorService(entidad);
  const queryKey = [entidad, params];

  const query = useQuery({
    queryKey,
    queryFn: () => svc.list(params),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => svc.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entidad] });
      toast.success("Registro creado");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => svc.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entidad] });
      toast.success("Registro actualizado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => svc.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entidad] });
      toast.success("Registro eliminado");
    },
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
