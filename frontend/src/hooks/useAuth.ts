import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { authService } from "@/services/auth";
import type { LoginRequest } from "@/types/auth";

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: LoginRequest) => authService.login(data),
    onSuccess: (res) => {
      setAuth(res.access_token, res.user);
      toast.success(`Bienvenido, ${res.user.nombre_completo || res.user.username}`);
      navigate("/");
    },
    onError: () => {
      toast.error("Credenciales invalidas");
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return () => {
    authService.logout().catch(() => {});
    logout();
    navigate("/login");
  };
}
