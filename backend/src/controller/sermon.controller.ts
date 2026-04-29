import { Response } from "express";
import Sermon from "../models/sermon.model";
import User from "../models/user.model";
import UserProfile from "../models/user-profile.model";
import { AuthenticatedRequest } from "../types/auth";

const ADMIN_OR_SUPERADMIN = ["Admin", "Superadmin"];

const ensureAdminRole = (req: AuthenticatedRequest) => {
  const userRoles = req.auth?.roles || [];
  return ADMIN_OR_SUPERADMIN.some((role) => userRoles.includes(role));
};

const resolvePastorUser = async (pastorId: string) => {
  const pastorUser = await User.findById(pastorId).populate("roles");

  if (pastorUser) {
    return pastorUser;
  }

  const pastorProfile = await UserProfile.findById(pastorId)
    .populate("role")
    .populate({ path: "user", populate: { path: "roles" } });

  if (!pastorProfile?.user || typeof pastorProfile.user !== "object" || !("_id" in pastorProfile.user)) {
    return null;
  }

  return pastorProfile.user as any;
};

const buildPastorCandidates = async (pastorId: string) => {
  const candidates = new Set<string>([pastorId]);

  const profileByUser = await UserProfile.findOne({ user: pastorId }).select("_id user");
  if (profileByUser?._id) {
    candidates.add(String(profileByUser._id));
  }

  const profileById = await UserProfile.findById(pastorId).select("_id user");
  if (profileById?._id) {
    candidates.add(String(profileById._id));
  }
  if (profileById?.user) {
    candidates.add(String(profileById.user));
  }

  return Array.from(candidates);
};

const normalizeSermons = async (sermons: any[]) => {
  const pastorIds = [...new Set(sermons.map((sermon) => String(sermon.pastor)).filter(Boolean))];

  const [users, profilesById, profilesByUser] = await Promise.all([
    User.find({ _id: { $in: pastorIds } }).select("name email").lean(),
    UserProfile.find({ _id: { $in: pastorIds } })
      .select("firstName lastName user")
      .populate({ path: "user", select: "name email" })
      .lean(),
    UserProfile.find({ user: { $in: pastorIds } })
      .select("firstName lastName user")
      .populate({ path: "user", select: "name email" })
      .lean(),
  ]);

  const pastorMap = new Map<string, { _id: string; name: string; email: string }>();

  users.forEach((user) => {
    pastorMap.set(String(user._id), {
      _id: String(user._id),
      name: user.name,
      email: user.email,
    });
  });

  [...profilesById, ...profilesByUser].forEach((profile: any) => {
    const user = profile.user && typeof profile.user === "object" ? profile.user : null;
    const fallbackName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || "Pastor";
    const normalized = {
      _id: user?._id ? String(user._id) : String(profile._id),
      name: user?.name ?? fallbackName,
      email: user?.email ?? "",
    };

    pastorMap.set(String(profile._id), normalized);

    if (user?._id) {
      pastorMap.set(String(user._id), normalized);
    }
  });

  return sermons.map((sermon) => ({
    _id: String(sermon._id),
    title: sermon.title,
    date: sermon.date,
    time: sermon.time,
    description: sermon.description ?? "",
    pastor: pastorMap.get(String(sermon.pastor)) ?? {
      _id: String(sermon.pastor),
      name: "Pastor",
      email: "",
    },
  }));
};

export const createSermon = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, date, time, pastor, description } = req.body;

    if (!ensureAdminRole(req)) {
      return res.status(403).json({ message: "No tienes permisos para crear predicas" });
    }

    const pastorUser = await resolvePastorUser(pastor);
    if (!pastorUser) {
      return res.status(404).json({ message: "Pastor no encontrado" });
    }

    const pastorRoles = pastorUser.roles.map((role: any) => role.name);
    if (!pastorRoles.includes("Pastor")) {
      return res.status(400).json({ message: "El usuario seleccionado no es un pastor" });
    }

    const sermon = new Sermon({
      title,
      date,
      time,
      pastor: pastorUser._id,
      description,
    });

    await sermon.save();
    const [normalizedSermon] = await normalizeSermons([sermon.toObject()]);

    return res.status(201).json({ message: "Predica creada exitosamente", sermon: normalizedSermon });
  } catch (error) {
    console.error("Error creating sermon:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getSermons = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const sermons = await Sermon.find().sort({ date: 1, time: 1 }).lean();
    return res.json(await normalizeSermons(sermons));
  } catch (error) {
    console.error("Error fetching sermons:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getSermonsByPastor = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const candidateIds = await buildPastorCandidates(req.params.pastorId);
    const sermons = await Sermon.find({ pastor: { $in: candidateIds } })
      .sort({ date: 1, time: 1 })
      .lean();

    return res.json(await normalizeSermons(sermons));
  } catch (error) {
    console.error("Error fetching sermons by pastor:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const updateSermon = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!ensureAdminRole(req)) {
      return res.status(403).json({ message: "No tienes permisos para actualizar predicas" });
    }

    if (updates.pastor) {
      const pastorUser = await resolvePastorUser(String(updates.pastor));

      if (!pastorUser) {
        return res.status(404).json({ message: "Pastor no encontrado" });
      }

      const pastorRoles = pastorUser.roles.map((role: any) => role.name);
      if (!pastorRoles.includes("Pastor")) {
        return res.status(400).json({ message: "El usuario seleccionado no es un pastor" });
      }

      updates.pastor = pastorUser._id;
    }

    const sermon = await Sermon.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!sermon) {
      return res.status(404).json({ message: "Predica no encontrada" });
    }

    const [normalizedSermon] = await normalizeSermons([sermon]);
    return res.json({ message: "Predica actualizada exitosamente", sermon: normalizedSermon });
  } catch (error) {
    console.error("Error updating sermon:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const deleteSermon = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!ensureAdminRole(req)) {
      return res.status(403).json({ message: "No tienes permisos para eliminar predicas" });
    }

    const sermon = await Sermon.findByIdAndDelete(id);
    if (!sermon) {
      return res.status(404).json({ message: "Predica no encontrada" });
    }

    return res.json({ message: "Predica eliminada exitosamente" });
  } catch (error) {
    console.error("Error deleting sermon:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};
