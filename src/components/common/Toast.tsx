import { useUIStore } from '@/stores/uiStore';
import styles from './Toast.module.css';

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${toast.type !== 'default' ? styles[toast.type] : ''}`}
          role="alert"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
