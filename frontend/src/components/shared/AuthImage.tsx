import { ImageOff, Leaf } from "lucide-react";
import { useAuthenticatedImage } from "@/hooks/useAuthenticatedImage";

interface AuthImageProps {
  /** API path (e.g. "/files/fotos/42"), without base URL */
  path: string | null | undefined;
  alt: string;
  className?: string;
  /** Rendered when path is null/undefined (no photo assigned) */
  fallback?: React.ReactNode;
  /** Rendered when fetch returned an error (broken/missing blob) */
  errorFallback?: React.ReactNode;
  loading?: "lazy" | "eager";
}

/**
 * Image loader that authenticates via Authorization: Bearer header
 * instead of leaking the JWT via `?token=` in the URL.
 * Distinguishes "no photo assigned" (fallback) from "photo failed to load" (errorFallback).
 */
export function AuthImage({ path, alt, className, fallback, errorFallback, loading = "lazy" }: AuthImageProps) {
  const { src, status } = useAuthenticatedImage(path);

  if (!path) {
    return (
      <>
        {fallback ?? (
          <div className={`${className ?? ""} bg-gradient-to-br from-garces-cherry-pale to-muted flex items-center justify-center`}>
            <Leaf className="h-10 w-10 text-garces-cherry/30" />
          </div>
        )}
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        {errorFallback ?? (
          <div className={`${className ?? ""} bg-red-50 border border-red-200 flex flex-col items-center justify-center text-red-400`}>
            <ImageOff className="h-8 w-8" />
            <span className="text-[10px] mt-1">Foto no disponible</span>
          </div>
        )}
      </>
    );
  }

  if (status === "loading" || !src) {
    return (
      <div className={`${className ?? ""} bg-muted animate-pulse`} aria-label="Cargando imagen" />
    );
  }

  return <img src={src} alt={alt} className={className} loading={loading} />;
}
