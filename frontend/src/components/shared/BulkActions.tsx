import { useState, useRef } from "react";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bulkService } from "@/services/bulk";
import toast from "react-hot-toast";

interface BulkActionsProps {
  /** Entity name matching the backend (e.g. "variedades", "inventario"). */
  entity: string;
  /** Called after a successful import so the parent can refresh data. */
  onImportComplete?: () => void;
}

export function BulkActions({ entity, onImportComplete }: BulkActionsProps) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTemplate = async () => {
    try {
      await bulkService.downloadTemplate(entity);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al descargar template");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await bulkService.exportData(entity);
      toast.success("Exportacion descargada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al exportar datos");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const result = await bulkService.importData(entity, file);
      if (result.created > 0) {
        toast.success(`${result.created} registros importados correctamente`);
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} filas con errores`);
      }
      if (result.created === 0 && result.errors.length === 0) {
        toast("No se encontraron filas para importar", { icon: "i" });
      }
      onImportComplete?.();
    } catch {
      // Error already handled by the api layer (toast.error)
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex gap-1.5">
      <Button
        variant="outline"
        size="sm"
        onClick={handleTemplate}
        title="Descargar plantilla Excel"
      >
        <Download className="h-3.5 w-3.5 mr-1" />
        Template
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={importing}
        title="Importar desde Excel"
      >
        <Upload className="h-3.5 w-3.5 mr-1" />
        {importing ? "Importando..." : "Importar"}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={exporting}
        title="Exportar datos a Excel"
      >
        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
        {exporting ? "Exportando..." : "Exportar"}
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleImport}
      />
    </div>
  );
}
