/**
 * Contrato API del módulo de Eventos (ADR-0008).
 * Tipos compartidos para validar shapes entre backend y frontend.
 * Lógica de negocio y persistencia permanecen en controllers/services/models.
 */

export type EventStatus = "upcoming" | "past";

export type EventListQuery = {
  status?: EventStatus;
  // Reservados para paginación futura; hoy el endpoint devuelve array plano.
  page?: number;
  limit?: number;
};

/** Información que el backend incrusta en el filename del Excel exportado. */
export type EventExportFilename = `inscritos-${string}-${string}.xlsx`;

/** Nombres de hojas del Excel de inscritos. */
export type EventExportSheetName = "Inscritos" | "Resumen";
