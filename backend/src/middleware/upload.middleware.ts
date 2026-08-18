import multer from "multer";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const validMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (validMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("El archivo no es un Excel válido"));
    }
  },
});
