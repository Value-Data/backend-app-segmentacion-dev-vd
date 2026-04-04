import { useAuthStore } from "@/stores/authStore";
import { uploadFile } from "./api";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

/**
 * Download a file from a protected endpoint using the auth token.
 * Creates a temporary anchor element to trigger the browser download.
 */
async function downloadFile(path: string, filename: string): Promise<void> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    let detail = `Error ${response.status}`;
    try {
      const err = await response.json();
      detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
    } catch {
      // ignore json parse error
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export interface BulkImportResult {
  created: number;
  errors: Array<{ row: number; error: string }>;
  total_rows: number;
}

export const bulkService = {
  /** Download an Excel template with example rows for the given entity. */
  downloadTemplate: (entity: string) =>
    downloadFile(`/bulk/template/${entity}`, `template_${entity}.xlsx`),

  /** Export all active records for the given entity as an Excel file. */
  exportData: (entity: string) =>
    downloadFile(`/bulk/export/${entity}`, `export_${entity}.xlsx`),

  /** Import records from an Excel file for the given entity. */
  importData: (entity: string, file: File) =>
    uploadFile<BulkImportResult>(`/bulk/import/${entity}`, file),
};
