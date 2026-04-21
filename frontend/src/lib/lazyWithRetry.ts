import { lazy, type ComponentType } from "react";

/**
 * `lazy()` que reintenta la importación dinámica si falla.
 *
 * Caso típico: tras un deploy, el chunk antiguo ya no existe y el navegador
 * del usuario con la app vieja abierta obtiene un 404/network error al
 * intentar cargarlo. Con un reintento y un reload como último recurso,
 * evitamos la pantalla blanca (TB-2, TB-15).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  retries = 2,
  delayMs = 600,
) {
  return lazy(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await importer();
      } catch (err) {
        lastErr = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        }
      }
    }
    // Final fallback: the ErrorBoundary above will catch and show the UI.
    throw lastErr;
  });
}
