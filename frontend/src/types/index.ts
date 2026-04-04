export type * from "./auth";
export type * from "./maestras";
export type * from "./testblock";
export type * from "./inventario";
export type * from "./laboratorio";
export type * from "./sistema";

// Generic types for CRUD operations
export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "textarea" | "boolean" | "color" | "password";
  required?: boolean;
  options?: { value: string | number; label: string }[];
  placeholder?: string;
  hidden?: boolean;
  readOnly?: boolean;
}

export interface ColumnDef<T> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  className?: string;
}
