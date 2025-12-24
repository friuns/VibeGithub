import { createEffect, onCleanup } from 'solid-js';
import { createMutable } from 'solid-js/store';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const Toast = (props: ToastProps) => {
  createEffect(() => {
    const timer = setTimeout(() => {
      props.onDismiss(props.toast.id);
    }, 4000);
    onCleanup(() => clearTimeout(timer));
  });

  const getStyles = () => {
    switch (props.toast.type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
      case 'info':
      default:
        return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
    }
  };

  const getIcon = () => {
    switch (props.toast.type) {
      case 'success':
        return <CheckCircle2 size={18} className="text-green-600 dark:text-green-400" />;
      case 'error':
        return <AlertCircle size={18} className="text-red-600 dark:text-red-400" />;
      case 'info':
      default:
        return <Info size={18} className="text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-slide-in ${getStyles()}`}
      role="alert"
    >
      {getIcon()}
      <span className="flex-grow text-sm font-medium">{props.toast.message}</span>
      <button
        onClick={() => props.onDismiss(props.toast.id)}
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer = (props: ToastContainerProps) => {
  if (props.toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {props.toasts.map((toast) => (
        <Toast toast={toast} onDismiss={props.onDismiss} />
      ))}
    </div>
  );
};

// Function for managing toasts
export const useToast = () => {
  const toasts = createMutable<ToastMessage[]>([]);

  const addToast = (type: ToastType, message: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    toasts.push({ id, type, message });
  };

  const dismissToast = (id: string) => {
    const index = toasts.findIndex((t) => t.id === id);
    if (index !== -1) toasts.splice(index, 1);
  };

  const showSuccess = (message: string) => addToast('success', message);
  const showError = (message: string) => addToast('error', message);
  const showInfo = (message: string) => addToast('info', message);

  return {
    toasts,
    dismissToast,
    showSuccess,
    showError,
    showInfo,
  };
};
