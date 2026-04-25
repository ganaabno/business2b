import { create } from "zustand"

interface SidebarState {
  isOpen: boolean
  isMobileOpen: boolean
  activeItem: string
  setOpen: (open: boolean) => void
  setMobileOpen: (open: boolean) => void
  setActiveItem: (item: string) => void
}

export const useSidebar = create<SidebarState>((set) => ({
  isOpen: true,
  isMobileOpen: false,
  activeItem: "",
  setOpen: (open) => set({ isOpen: open }),
  setMobileOpen: (open) => set({ isMobileOpen: open }),
  setActiveItem: (item) => set({ activeItem: item }),
}))

export const useAppStore = create<{
  loading: boolean
  toast: { type: "success" | "error" | "info"; message: string } | null
  setLoading: (loading: boolean) => void
  showToast: (type: "success" | "error" | "info", message: string) => void
  clearToast: () => void
}>((set) => ({
  loading: false,
  toast: null,
  setLoading: (loading) => set({ loading }),
  showToast: (type, message) => set({ toast: { type, message } }),
  clearToast: () => set({ toast: null }),
}))