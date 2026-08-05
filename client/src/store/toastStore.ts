import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (t) => set((state) => ({ toasts: [...state.toasts.filter((item) => item.message !== t.message), t].slice(-3) })),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

function push(message: string, type: Toast['type']): void {
  const id = `${type}-${message}-${Math.random().toString(36).slice(2)}`;
  useToastStore.getState().addToast({ id, message, type });
  setTimeout(() => useToastStore.getState().removeToast(id), 4000);
}

export const toast = {
  success: (message: string) => push(message, 'success'),
  error: (message: string) => push(message, 'error'),
};
