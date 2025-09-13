import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface UIState {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark' | 'system'
  activeService: string | null
  notifications: Notification[]
}

interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string
  timestamp: number
  read: boolean
}

interface UIActions {
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setTheme: (theme: UIState['theme']) => void
  setActiveService: (service: string | null) => void
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markNotificationRead: (id: string) => void
  removeNotification: (id: string) => void
  clearAllNotifications: () => void
}

type UIStore = UIState & UIActions

export const useUIStore = create<UIStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      sidebarCollapsed: false,
      theme: 'system',
      activeService: null,
      notifications: [],

      // Actions
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }), false, 'toggleSidebar'),

      setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed }, false, 'setSidebarCollapsed'),

      setTheme: (theme) => set({ theme }, false, 'setTheme'),

      setActiveService: (service) => set({ activeService: service }, false, 'setActiveService'),

      addNotification: (notification) =>
        set(
          (state) => ({
            notifications: [
              {
                ...notification,
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                read: false,
              },
              ...state.notifications,
            ],
          }),
          false,
          'addNotification'
        ),

      markNotificationRead: (id) =>
        set(
          (state) => ({
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
          }),
          false,
          'markNotificationRead'
        ),

      removeNotification: (id) =>
        set(
          (state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }),
          false,
          'removeNotification'
        ),

      clearAllNotifications: () => set({ notifications: [] }, false, 'clearAllNotifications'),
    }),
    { name: 'ui-store' }
  )
)