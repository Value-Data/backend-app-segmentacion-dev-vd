import { create } from "zustand";

interface InventarioState {
  selectedLote: number | null;
  setSelectedLote: (id: number | null) => void;
}

export const useInventarioStore = create<InventarioState>()((set) => ({
  selectedLote: null,
  setSelectedLote: (id) => set({ selectedLote: id }),
}));
