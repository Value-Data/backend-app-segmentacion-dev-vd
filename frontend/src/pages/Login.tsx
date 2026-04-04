import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";
import { useLogin } from "@/hooks/useAuth";

export function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (token) return <Navigate to="/" replace />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ username, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-garces-cherry-dark to-garces-cherry">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-garces-cherry-pale mb-3">
            <Leaf className="h-7 w-7 text-garces-cherry" />
          </div>
          <h1 className="text-xl font-bold text-garces-cherry">Garces Fruit</h1>
          <p className="text-sm text-muted-foreground mt-1">Sistema de Segmentacion de Especies</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              className="mt-1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingrese su usuario"
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="password">Contrasena</Label>
            <Input
              id="password"
              type="password"
              className="mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingrese su contrasena"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
