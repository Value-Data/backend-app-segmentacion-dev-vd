import { create } from "zustand";

interface SidebarState {
  /** Desktop collapsed state (icon-only mode) */
  collapsed: boolean;
  /** Mobile drawer open state */
  mobileOpen: boolean;
  setCollapsed: (v: boolean) => void;
  toggleCollapsed: () => void;
  setMobileOpen: (v: boolean) => void;
  toggleMobileOpen: () => void;
}

export const useSidebarStore = create<SidebarState>()((set) => ({
  collapsed: typeof window !== "undefined" && window.innerWidth < 1024,
  mobileOpen: false,
  setCollapsed: (v) => set({ collapsed: v }),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setMobileOpen: (v) => set({ mobileOpen: v }),
  toggleMobileOpen: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
}));
