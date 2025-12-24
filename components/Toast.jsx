import { createSignal, onCleanup, For } from 'solid-js';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-solid';

const Toast = (props) => {
  const { toast, onDismiss } = props;

  const timer = setTimeout(() => {
    onDismiss(toast.id);
  }, 4000);

  onCleanup(() => clearTimeout(timer));

  const getStyles = () => {
    switch (toast.type) {
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
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={18} class="text-green-600 dark:text-green-400" />;
      case 'error':
        return <AlertCircle size={18} class="text-red-600 dark:text-red-400" />;
      case 'info':
      default:
        return <Info size={18} class="text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div
      class={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-slide-in ${getStyles()}`}
      role="alert"
    >
      {getIcon()}
      <span class="flex-grow text-sm font-medium">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        class="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export const ToastContainer = (props) => {
  return (
    <Show when={props.toasts.length > 0}>
      <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        <For each={props.toasts}>{(toast) =>
          <Toast toast={toast} onDismiss={props.onDismiss} />
        }</For>
      </div>
    </Show>
  );
};

export const useToast = () => {
  const [toasts, setToasts] = createSignal([]);

  const addToast = (type, message) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showSuccess = (message) => addToast('success', message);
  const showError = (message) => addToast('error', message);
  const showInfo = (message) => addToast('info', message);

  return {
    toasts,
    dismissToast,
    showSuccess,
    showError,
    showInfo,
  };
};
