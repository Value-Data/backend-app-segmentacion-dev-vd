import { useState } from "react";
import { Pencil, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ChipOption {
  id: number;
  label: string;
  color?: string | null;
}

interface RelationshipChipsProps {
  /** Label shown before the chips (e.g. "Especies compatibles") */
  label: string;
  /** Currently linked option IDs */
  currentIds: number[];
  /** All available options to choose from */
  allOptions: ChipOption[];
  /** Called with the new set of IDs after the user confirms */
  onSave: (ids: number[]) => Promise<unknown>;
  /** Whether a save is in progress */
  isSaving?: boolean;
  /** Compact mode: smaller text, no label */
  compact?: boolean;
}

export function RelationshipChips({
  label,
  currentIds,
  allOptions,
  onSave,
  isSaving = false,
  compact = false,
}: RelationshipChipsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const currentOptions = allOptions.filter((o) => currentIds.includes(o.id));

  const handleOpenDialog = () => {
    setSelected(new Set(currentIds));
    setDialogOpen(true);
  };

  const toggleOption = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    await onSave(Array.from(selected));
    setDialogOpen(false);
  };

  return (
    <>
      <div className={cn("flex items-center gap-2 flex-wrap", compact ? "gap-1" : "gap-2")}>
        {!compact && (
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            {label}:
          </span>
        )}

        {currentOptions.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">Sin asignar</span>
        ) : (
          currentOptions.map((opt) => (
            <span
              key={opt.id}
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
                compact ? "px-2 py-0.5" : "px-2.5 py-0.5"
              )}
              style={
                opt.color
                  ? {
                      backgroundColor: `${opt.color}18`,
                      borderColor: `${opt.color}40`,
                      color: opt.color,
                    }
                  : undefined
              }
            >
              {opt.label}
            </span>
          ))
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          onClick={handleOpenDialog}
          title={`Editar ${label.toLowerCase()}`}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>

      {/* Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar {label}</DialogTitle>
            <DialogDescription>
              Seleccione los elementos que desea asociar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-64 overflow-y-auto py-2">
            {allOptions.map((opt) => {
              const isChecked = selected.has(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleOption(opt.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md border text-sm transition-colors text-left",
                    isChecked
                      ? "border-garces-green bg-garces-green/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-5 h-5 rounded border-2 transition-colors shrink-0",
                      isChecked
                        ? "bg-garces-green border-garces-green text-white"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {isChecked && <Check className="h-3 w-3" />}
                  </div>

                  {opt.color && (
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}

                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}

            {allOptions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay opciones disponibles.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
