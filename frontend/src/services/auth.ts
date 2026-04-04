import { post, get } from "./api";
import type { LoginRequest, TokenResponse, UserInfo } from "@/types/auth";

export const authService = {
  login: (data: LoginRequest) => post<TokenResponse>("/auth/login", data),
  logout: () => post<{ ok: boolean }>("/auth/logout"),
  me: () => get<UserInfo>("/auth/me"),
};
