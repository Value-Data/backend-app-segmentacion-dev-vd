export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserInfo {
  id_usuario: number;
  username: string;
  nombre_completo: string | null;
  email: string | null;
  rol: string | null;
  campos_asignados: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserInfo;
}

export interface PasswordChange {
  new_password: string;
}
