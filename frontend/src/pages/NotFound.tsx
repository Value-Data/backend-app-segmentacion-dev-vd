import { Link } from "react-router-dom";
import { Home, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <AlertTriangle className="h-16 w-16 text-garces-cherry/50" />
      <h2 className="text-2xl font-bold text-garces-cherry">
        Página no encontrada
      </h2>
      <p className="text-muted-foreground max-w-md">
        La pagina que buscas no existe o fue movida. Verifica la URL o vuelve al inicio.
      </p>
      <Button asChild>
        <Link to="/">
          <Home className="h-4 w-4 mr-2" />
          Volver al Dashboard
        </Link>
      </Button>
    </div>
  );
}
