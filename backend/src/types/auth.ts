import { Request } from "express";

export type AuthSession = {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  profileId?: string | null;
};

export interface AuthenticatedRequest extends Request {
  auth?: AuthSession;
}
