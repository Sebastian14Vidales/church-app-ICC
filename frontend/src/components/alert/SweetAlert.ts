import Swal from 'sweetalert2';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'question';

interface SweetAlertOptions {
  title: string;
  text?: string;
  type?: AlertType;
  confirmButtonText?: string;
  timer?: number;
  showCancelButton?: boolean;
  cancelButtonText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function showSweetAlert({
  title,
  text = '',
  type = 'info',
  confirmButtonText = 'OK',
  timer,
  showCancelButton = false,
  cancelButtonText = 'Cancel',
  onConfirm,
  onCancel,
}: SweetAlertOptions) {
  Swal.fire({
    title,
    text,
    icon: type,
    confirmButtonText,
    timer,
    showCancelButton,
    cancelButtonText,
  }).then((result) => {
    if (result.isConfirmed && onConfirm) {
      onConfirm();
    } else if (result.isDismissed && onCancel) {
      onCancel();
    }
  });
}
