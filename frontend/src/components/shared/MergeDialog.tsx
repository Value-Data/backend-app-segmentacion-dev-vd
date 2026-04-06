import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Merge } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { post } from "@/services/api";

interface MergeDialogProps {
  open: boolean;
  onClose: () => void;
  entidad: string;
  items: { value: number | string; label: string }[];
  queryKey: string;
  entityLabel?: string;
}

export function MergeDialog({ open, onClose, entidad, items, queryKey, entityLabel }: MergeDialogProps) {
  const queryClient = useQueryClient();
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");

  const mergeMut = useMutation({
    mutationFn: () =>
      post<{ ok: boolean; message: string; moved_references: number }>(
        `/mantenedores/${entidad}/merge`,
        { source_id: Number(sourceId), target_id: Number(targetId) }
      ),
    onSuccess: (res) => {
      toast.success(res.message + ` (${res.moved_references} refs movidas)`);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setSourceId("");
      setTargetId("");
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Error al fusionar");
    },
  });

  const label = entityLabel || entidad;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" /> Fusionar {label}
          </DialogTitle>
          <DialogDescription>
            Mueve todas las referencias del registro origen al destino, luego desactiva el origen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Origen (se desactiva)</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              <option value="">Seleccionar origen...</option>
              {items.filter((i) => String(i.value) !== targetId).map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Destino (se conserva)</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Seleccionar destino...</option>
              {items.filter((i) => String(i.value) !== sourceId).map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
          </div>
          {sourceId && targetId && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>{items.find((i) => String(i.value) === sourceId)?.label}</strong>
              {" se fusionara en "}
              <strong>{items.find((i) => String(i.value) === targetId)?.label}</strong>
              . El origen sera desactivado.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!sourceId || !targetId || mergeMut.isPending}
            onClick={() => mergeMut.mutate()}
          >
            {mergeMut.isPending ? "Fusionando..." : "Fusionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
