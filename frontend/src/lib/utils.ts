import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-CL");
}

export function formatNumber(n: number | null | undefined, decimals = 0): string {
  if (n == null) return "-";
  return n.toLocaleString("es-CL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
