import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { FieldDef } from "@/types";

interface CrudFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  fields: FieldDef[];
  initialData?: Record<string, unknown> | null;
  title: string;
  isLoading?: boolean;
  /** Optional callback when any field value changes — useful for cascading dropdowns. */
  onFieldChange?: (key: string, value: unknown) => void;
}

export function CrudForm({ open, onClose, onSubmit, fields, initialData, title, isLoading, onFieldChange }: CrudFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    } else {
      const defaults: Record<string, unknown> = {};
      fields.forEach((f) => {
        if (f.type === "boolean") defaults[f.key] = false;
        else defaults[f.key] = "";
      });
      setFormData(defaults);
    }
  }, [initialData, fields, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.readOnly && !initialData) continue;
      const val = formData[f.key];
      if (f.type === "number" && val !== "" && val != null) {
        cleaned[f.key] = Number(val);
      } else if (f.type === "select" && val !== "" && val != null) {
        // Convert select values back to number when the original options use numeric values
        const numericOptions = f.options?.some((o) => typeof o.value === "number");
        if (numericOptions && !isNaN(Number(val))) {
          cleaned[f.key] = Number(val);
        } else {
          cleaned[f.key] = val;
        }
      } else if (f.type === "boolean") {
        cleaned[f.key] = Boolean(val);
      } else if (val === "") {
        cleaned[f.key] = null;
      } else {
        cleaned[f.key] = val;
      }
    }
    try {
      await onSubmit(cleaned);
      onClose();
    } catch {
      // Keep form open on error — toast already shown by api.ts
    }
  };

  const visibleFields = fields.filter((f) => !f.hidden);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleFields.map((field) => (
              <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                <Label htmlFor={field.key}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {field.type === "select" && field.options ? (
                  <Select
                    value={String(formData[field.key] ?? "")}
                    onValueChange={(v) => {
                      setFormData({ ...formData, [field.key]: v });
                      onFieldChange?.(field.key, v);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={field.placeholder || `Seleccionar ${field.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.length === 0 ? (
                        <SelectItem value="__empty__" disabled>Sin opciones disponibles</SelectItem>
                      ) : (
                        field.options.map((opt) => (
                          <SelectItem key={String(opt.value)} value={String(opt.value)}>
                            {opt.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                ) : field.type === "textarea" ? (
                  <textarea
                    id={field.key}
                    className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]"
                    value={String(formData[field.key] ?? "")}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    readOnly={field.readOnly}
                  />
                ) : field.type === "boolean" ? (
                  <div className="mt-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(formData[field.key])}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.checked })}
                        className="rounded"
                      />
                      {field.placeholder || "Si"}
                    </label>
                  </div>
                ) : (
                  <Input
                    id={field.key}
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "password" ? "password" : "text"}
                    className="mt-1"
                    value={String(formData[field.key] ?? "")}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    required={field.required}
                    readOnly={field.readOnly}
                    step={field.type === "number" ? "any" : undefined}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Guardando..." : initialData ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
