export type ToastType = 'default' | 'success' | 'warning' | 'danger';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

export type ModalMode = 'create' | 'edit';
