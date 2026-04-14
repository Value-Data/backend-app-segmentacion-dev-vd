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

/**
 * Converts snake_case, SCREAMING_SNAKE, camelCase to human-readable text.
 * "en_transito" → "En transito", "MUY_TEMPRANA" → "Muy temprana"
 */
export function humanize(s: string | null | undefined): string {
  if (!s) return "-";
  if (s.includes(" ") && s[0] === s[0].toUpperCase() && s[1] === s[1]?.toLowerCase()) return s;
  const words = s
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) return s;
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ");
}
