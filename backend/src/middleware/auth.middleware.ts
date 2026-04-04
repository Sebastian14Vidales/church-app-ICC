import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types/auth";
import { hasSomeRole, verifySessionToken } from "../utils/auth.utils";

const extractBearerToken = (authorizationHeader?: string) => {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim();
};

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ message: "No autorizado" });
    }

    req.auth = await verifySessionToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({
      message: "La sesión es inválida o expiró",
      error: error instanceof Error ? error.message : error,
    });
  }
};

export const authorizeRoles =
  (allowedRoles: string[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ message: "No autorizado" });
    }

    if (!hasSomeRole(req.auth.roles, allowedRoles)) {
      return res.status(403).json({ message: "No tienes permisos para esta acción" });
    }

    return next();
  };
