/**
 * Error de aplicación con código HTTP explícito.
 *
 * Los services lanzan `AppError` para señalar condiciones de negocio
 * (recurso no encontrado, conflicto de estado, validación de dominio...).
 * Los controllers lo capturan y mapean a una respuesta JSON
 * `{ message }`. Cualquier otro error se trata como 500.
 *
 * Esta clase vive en `services/` ( dominio del `backend-engineer` ) y es
 * deliberadamente minimalista: no expone stack traces al cliente
 * ( AGENTS.md §8 ).
 */
export class AppError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

/**
 * Mapea un error capturado por un controller a una respuesta HTTP.
 * Si el error es `AppError`, usa su `status` y `message`.
 * Si es un duplicate-key error de Mongo (code 11000), se interpreta como
 * 409 de conflicto de negocio con el mensaje proporcionado por defecto.
 * En cualquier otro caso, responde 500 con el mensaje por defecto.
 *
 * No expone el error original al cliente ( AGENTS.md §8 ).
 */
export const handleControllerError = (
  res: import("express").Response,
  error: unknown,
  defaultMessage: string,
  duplicateKeyMessage?: string,
) => {
  if (error instanceof AppError) {
    return res.status(error.status).json({ message: error.message });
  }

  if (
    duplicateKeyMessage &&
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  ) {
    return res.status(409).json({ message: duplicateKeyMessage });
  }

  return res.status(500).json({ message: defaultMessage });
};