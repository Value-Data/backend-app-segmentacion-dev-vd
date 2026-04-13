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

/**
 * Ensure `currentValue` appears in a string-options list.
 * If the value already exists as an option, returns options unchanged.
 * If it doesn't exist (legacy data), prepends it so the select shows it.
 */
export function withCurrentValue(
  options: { value: string; label: string }[],
  currentValue: unknown,
): { value: string; label: string }[] {
  if (currentValue == null || currentValue === "") return options;
  const str = String(currentValue);
  if (options.some((o) => o.value === str)) return options;
  return [{ value: str, label: str }, ...options];
}
