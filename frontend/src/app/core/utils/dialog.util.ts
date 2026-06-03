/** Cierra el dialog al pulsar el backdrop; opcionalmente ejecuta limpieza adicional. */
export function closeDialogOnBackdropClick(event: MouseEvent, onClose?: () => void): void {
  if (event.target instanceof HTMLDialogElement) {
    if (onClose) {
      onClose();
    } else {
      event.target.close();
    }
  }
}
