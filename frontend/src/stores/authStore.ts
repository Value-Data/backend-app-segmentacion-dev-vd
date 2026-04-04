import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserInfo } from "@/types/auth";

interface AuthState {
  user: UserInfo | null;
  token: string | null;
  setAuth: (token: string, user: UserInfo) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: "garces-auth" }
  )
);
