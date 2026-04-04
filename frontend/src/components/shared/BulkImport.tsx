import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface BulkImportProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<{ created: number; errors: unknown[] }>;
  title: string;
}

export function BulkImport({ open, onClose, onUpload, title }: BulkImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ created: number; errors: unknown[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await onUpload(file);
      setResult(res);
    } catch {
      // error handled by api layer
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-garces-cherry" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Seleccione un archivo Excel (.xlsx)</p>
                </>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleUpload} disabled={!file || loading}>
                {loading ? "Importando..." : "Importar"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              <span className="font-medium">{result.created} registros creados</span>
            </div>
            {result.errors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">{result.errors.length} errores</span>
                </div>
                <div className="max-h-40 overflow-auto text-xs bg-muted rounded p-2">
                  {result.errors.map((e, i) => (
                    <p key={i}>{JSON.stringify(e)}</p>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleClose}>Cerrar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
