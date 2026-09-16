import { Router } from "express";
import { param, query } from "express-validator";
import { NotificationController } from "../controller/notification.controller";
import { authenticate } from "../middleware/auth.middleware";
import { handleInputErrors } from "../middleware/validation";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Parámetros de consulta inválidos"),
  handleInputErrors,
  NotificationController.list,
);

router.patch(
  "/read-all",
  NotificationController.markAllRead,
);

router.patch(
  "/:id/read",
  param("id").isMongoId().withMessage("ID de notificación inválido"),
  handleInputErrors,
  NotificationController.markRead,
);

export default router;
