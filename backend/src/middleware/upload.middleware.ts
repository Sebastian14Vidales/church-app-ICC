import path from "path";
import multer from "multer";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Multer upload middleware configured to accept spreadsheets.
 * Supports both `.xlsx` and `.csv` files (the latter is parsed natively by `xlsx`).
 * The export name `uploadExcel` is kept for backwards compatibility with existing routes.
 */
export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const validMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
    ];
    const validExtensions = [".xlsx", ".csv"];

    const ext = path.extname(file.originalname).toLowerCase();
    const isValidMimeType = validMimeTypes.includes(file.mimetype);
    const isValidExtension = validExtensions.includes(ext);

    if (isValidMimeType || isValidExtension) {
      cb(null, true);
    } else {
      (cb as (error: Error | null, acceptFile?: boolean) => void)(
        new Error("El archivo no es un archivo válido"),
        false,
      );
    }
  },
});
