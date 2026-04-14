import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Download, Trash2, FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { documentosPdfService, type DocumentoPdfResumen, type RutResumen } from "@/services/documentosPdf";
import { toast } from "sonner";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const TIPO_LABELS: Record<string, string> = {
  reporte_variedad: "Reporte Variedad",
  reporte_lote: "Reporte Lote",
  reporte_testblock: "Reporte TestBlock",
  variedad_analisis: "Análisis Variedad",
  planta: "Reporte Planta",
  lote: "Reporte Lote",
  evaluacion_cosecha: "Evaluación Cosecha",
  resumen_cosechas: "Resumen Cosechas",
  qr_testblock: "QR TestBlock",
  qr_hilera: "QR Hilera",
  qr_inventario: "QR Inventario",
};

export default function DocumentosPdfPage() {
  const [rutBusqueda, setRutBusqueda] = useState("");
  const [rutSeleccionado, setRutSeleccionado] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: ruts = [], isLoading: loadingRuts } = useQuery({
    queryKey: ["documentos-pdf", "ruts"],
    queryFn: () => documentosPdfService.listarRuts(),
  });

  const { data: documentos = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["documentos-pdf", "por-rut", rutSeleccionado],
    queryFn: () => documentosPdfService.listarPorRut(rutSeleccionado!),
    enabled: !!rutSeleccionado,
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => documentosPdfService.eliminar(id),
    onSuccess: () => {
      toast.success("Documento eliminado");
      queryClient.invalidateQueries({ queryKey: ["documentos-pdf"] });
    },
    onError: () => toast.error("Error al eliminar"),
  });

  const rutsFiltrados = ruts.filter((r) =>
    r.rut.toLowerCase().includes(rutBusqueda.toLowerCase())
  );

  const handleBuscarRut = () => {
    if (rutBusqueda.trim()) {
      setRutSeleccionado(rutBusqueda.trim());
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Documentos PDF por RUT</h1>
        <p className="text-sm text-gray-500 mt-1">
          Consulta y descarga los PDFs generados, organizados por RUT
        </p>
      </div>

      {!rutSeleccionado ? (
        <>
          {/* Search bar */}
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por RUT (ej: 12.345.678-9)..."
              value={rutBusqueda}
              onChange={(e) => setRutBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBuscarRut()}
              className="max-w-md"
            />
            <Button onClick={handleBuscarRut} variant="default">
              <Search className="h-4 w-4 mr-2" /> Buscar
            </Button>
          </div>

          {/* RUTs list */}
          {loadingRuts ? (
            <p className="text-sm text-gray-400">Cargando...</p>
          ) : rutsFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No hay documentos guardados</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rutsFiltrados.map((r) => (
                <button
                  key={r.rut}
                  onClick={() => setRutSeleccionado(r.rut)}
                  className="flex items-center justify-between p-4 bg-white border rounded-lg hover:border-green-500 hover:shadow-sm transition-all text-left"
                >
                  <div>
                    <p className="font-semibold text-gray-800">{r.rut}</p>
                    <p className="text-xs text-gray-400">
                      {r.total_documentos} documento{r.total_documentos !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">
                      {formatDate(r.ultimo_pdf)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Back + header */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setRutSeleccionado(null); setRutBusqueda(""); }}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver
            </Button>
            <h2 className="text-lg font-semibold text-gray-700">
              PDFs de RUT: <span className="text-green-700">{rutSeleccionado}</span>
            </h2>
          </div>

          {/* Docs table */}
          {loadingDocs ? (
            <p className="text-sm text-gray-400">Cargando documentos...</p>
          ) : documentos.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No hay documentos para este RUT</p>
            </div>
          ) : (
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600">Archivo</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Descripcion</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Tamano</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Usuario</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {documentos.map((doc) => (
                    <tr key={doc.id_documento} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">{doc.nombre_archivo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full">
                          {TIPO_LABELS[doc.tipo_reporte] || doc.tipo_reporte}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 truncate max-w-[200px]">
                        {doc.descripcion || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatBytes(doc.tamano_bytes)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(doc.fecha_creacion)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {doc.usuario_creacion || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => documentosPdfService.descargar(doc.id_documento, doc.nombre_archivo)}
                            title="Descargar"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm("Eliminar este documento?")) {
                                eliminarMutation.mutate(doc.id_documento);
                              }
                            }}
                            title="Eliminar"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
