import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TemporadaState {
  /** Current selected temporada (e.g. "2024-2025"). Empty = use server default. */
  current: string;
  setCurrent: (t: string) => void;
}

export const useTemporadaStore = create<TemporadaState>()(
  persist(
    (set) => ({
      current: "2024-2025",
      setCurrent: (t) => set({ current: t }),
    }),
    { name: "garces-temporada" },
  ),
);
