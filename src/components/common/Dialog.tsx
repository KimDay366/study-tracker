import { Button } from './Button';
import styles from './Dialog.module.css';

interface Props {
  icon?: string;
  title: string;
  description?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'secondary' | 'danger';
  /** true면 취소 버튼을 숨기고 확인 버튼만 노출 (안내성 모달용) */
  hideCancel?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function Dialog({
  icon,
  title,
  description,
  cancelLabel = '취소',
  confirmLabel = '확인',
  confirmVariant = 'primary',
  hideCancel = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className={styles.overlay} role="alertdialog" aria-modal="true">
      <div className={styles.dialog}>
        {icon && <div className={styles.icon}>{icon}</div>}
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
        <div className={styles.actions}>
          {!hideCancel && (
            <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          )}
          <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
