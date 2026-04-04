import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  alta: "bg-green-100 text-green-800",
  baja: "bg-red-100 text-red-800",
  vacia: "bg-gray-100 text-gray-600",
  replante: "bg-blue-100 text-blue-800",
  activo: "bg-green-100 text-green-800",
  activa: "bg-green-100 text-green-800",
  disponible: "bg-green-100 text-green-800",
  comprometido: "bg-yellow-100 text-yellow-800",
  agotado: "bg-red-100 text-red-800",
  pendiente: "bg-yellow-100 text-yellow-800",
  plantado: "bg-green-100 text-green-800",
  ejecutada: "bg-green-100 text-green-800",
  planificada: "bg-blue-100 text-blue-800",
  atrasada: "bg-red-100 text-red-800 animate-pulse",
  critica: "bg-red-100 text-red-800",
  media: "bg-yellow-100 text-yellow-800",
  resuelta: "bg-gray-100 text-gray-600",
  prospecto: "bg-purple-100 text-purple-800",
  en_transito: "bg-blue-100 text-blue-800",
  ingreso: "bg-green-100 text-green-800",
  retiro: "bg-red-100 text-red-800",
  despacho: "bg-orange-100 text-orange-800",
  plantacion: "bg-emerald-100 text-emerald-800",
  devolucion: "bg-green-100 text-green-800",
  ajuste: "bg-yellow-100 text-yellow-800",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status?.toLowerCase()] || "bg-gray-100 text-gray-600";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", style, className)}>
      {status}
    </span>
  );
}
