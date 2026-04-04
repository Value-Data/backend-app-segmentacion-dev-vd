import { create } from "zustand";
import type { ColorMode, DisplayMode } from "@/types/testblock";

interface TestBlockState {
  selectedTestblock: number | null;
  selectedPosition: number | null;
  colorMode: ColorMode;
  displayMode: DisplayMode;
  setSelectedTestblock: (id: number | null) => void;
  setSelectedPosition: (id: number | null) => void;
  setColorMode: (mode: ColorMode) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  clearSelection: () => void;
}

export const useTestBlockStore = create<TestBlockState>()((set) => ({
  selectedTestblock: null,
  selectedPosition: null,
  colorMode: "estado",
  displayMode: "variedad+id",
  setSelectedTestblock: (id) => set({ selectedTestblock: id }),
  setSelectedPosition: (id) => set({ selectedPosition: id }),
  setColorMode: (mode) => set({ colorMode: mode }),
  setDisplayMode: (mode) => set({ displayMode: mode }),
  clearSelection: () => set({ selectedPosition: null }),
}));
