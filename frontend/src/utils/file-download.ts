/**
 * Descarga un Blob como archivo en el navegador.
 *
 * Utilidad compartida para centralizar la logica de descarga de archivos
 * desde el frontend.
 */
export const triggerFileDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
};
