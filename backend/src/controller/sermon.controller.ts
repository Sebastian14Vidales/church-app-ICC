import { Request, Response } from "express";
import Sermon from "../models/sermon.model";
import User from "../models/user.model";
import { AuthenticatedRequest } from "../types/auth";

export const createSermon = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, date, time, pastor, description } = req.body;

    // Check if user is admin or superadmin
    const userRoles = req.auth?.roles || [];
    if (!userRoles.includes("Admin") && !userRoles.includes("Superadmin")) {
      return res.status(403).json({ message: "No tienes permisos para crear prédicas" });
    }

    // Check if pastor exists and has pastor role
    const pastorUser = await User.findById(pastor).populate("roles");
    if (!pastorUser) {
      return res.status(404).json({ message: "Pastor no encontrado" });
    }
    const pastorRoles = pastorUser.roles.map((r: any) => r.name);
    if (!pastorRoles.includes("Pastor")) {
      return res.status(400).json({ message: "El usuario seleccionado no es un pastor" });
    }

    const sermon = new Sermon({
      title,
      date,
      time,
      pastor,
      description,
    });

    await sermon.save();

    res.status(201).json({ message: "Prédica creada exitosamente", sermon });
  } catch (error) {
    console.error("Error creating sermon:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getSermons = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sermons = await Sermon.find().populate("pastor", "name email");
    res.json(sermons);
  } catch (error) {
    console.error("Error fetching sermons:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getSermonsByPastor = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pastorId = req.params.pastorId;
    const sermons = await Sermon.find({ pastor: pastorId }).populate("pastor", "name email");
    res.json(sermons);
  } catch (error) {
    console.error("Error fetching sermons by pastor:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const updateSermon = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check permissions
    const userRoles = req.auth?.roles || [];
    if (!userRoles.includes("Admin") && !userRoles.includes("Superadmin")) {
      return res.status(403).json({ message: "No tienes permisos para actualizar prédicas" });
    }

    const sermon = await Sermon.findByIdAndUpdate(id, updates, { new: true });
    if (!sermon) {
      return res.status(404).json({ message: "Prédica no encontrada" });
    }

    res.json({ message: "Prédica actualizada exitosamente", sermon });
  } catch (error) {
    console.error("Error updating sermon:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const deleteSermon = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check permissions
    const userRoles = req.auth?.roles || [];
    if (!userRoles.includes("Admin") && !userRoles.includes("Superadmin")) {
      return res.status(403).json({ message: "No tienes permisos para eliminar prédicas" });
    }

    const sermon = await Sermon.findByIdAndDelete(id);
    if (!sermon) {
      return res.status(404).json({ message: "Prédica no encontrada" });
    }

    res.json({ message: "Prédica eliminada exitosamente" });
  } catch (error) {
    console.error("Error deleting sermon:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};