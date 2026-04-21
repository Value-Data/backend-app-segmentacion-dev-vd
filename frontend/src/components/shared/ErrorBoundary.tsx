import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Captura errores durante el render o la carga de chunks lazy.
 *
 * Sin esto, un `ChunkLoadError` del código-split o un throw inesperado
 * deja la UI en blanco sin feedback. Con esto mostramos un fallback
 * con botón para recargar el chunk (o el módulo entero).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      const isChunkError =
        /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(
          this.state.error.message || "",
        );
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
          <div className="h-14 w-14 rounded-full bg-amber-50 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <div className="space-y-1 max-w-md">
            <h2 className="text-lg font-semibold">
              {isChunkError ? "No se pudo cargar la página" : "Algo salió mal"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isChunkError
                ? "El recurso puede haber cambiado tras un despliegue reciente. Recarga la aplicación para continuar."
                : "Un error inesperado interrumpió la página. Puedes reintentar sin perder tu sesión."}
            </p>
            <p className="text-[11px] text-muted-foreground/60 font-mono mt-2 truncate">
              {this.state.error.message}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.reset}>
              <RotateCcw className="h-4 w-4 mr-1" /> Reintentar
            </Button>
            <Button onClick={() => window.location.reload()}>
              Recargar aplicación
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
