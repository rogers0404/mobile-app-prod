import { create } from 'zustand';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  icon?: string;
}

interface NotificationStore {
  notification: AppNotification | null;
  show: (n: Omit<AppNotification, 'id'>) => void;
  dismiss: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notification: null,
  show: (n) => set({
    notification: { ...n, id: Date.now().toString() },
  }),
  dismiss: () => set({ notification: null }),
}));
