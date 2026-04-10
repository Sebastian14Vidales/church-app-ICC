import { Router } from "express";
import {
  createSermon,
  getSermons,
  getSermonsByPastor,
  updateSermon,
  deleteSermon,
} from "../controller/sermon.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/", authenticate, createSermon);
router.get("/", authenticate, getSermons);
router.get("/pastor/:pastorId", authenticate, getSermonsByPastor);
router.put("/:id", authenticate, updateSermon);
router.delete("/:id", authenticate, deleteSermon);

export default router;