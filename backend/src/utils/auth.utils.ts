import crypto from "crypto";
import bcrypt from "bcrypt";
import { jwtVerify, SignJWT } from "jose";
import ActionToken from "../models/action-token.model";

export const LOGIN_ENABLED_ROLES = ["Admin", "Superadmin", "Profesor", "Pastor"];
export const ADMIN_ROLES = ["Admin", "Superadmin"];
export const SUPERADMIN_ROLES = ["Superadmin"];
export const MEMBER_MANAGER_ROLES = ["Admin", "Superadmin", "Profesor", "Pastor"];
export const MY_COURSES_ROLES = ["Profesor", "Pastor"];

const SESSION_TOKEN_EXPIRATION = process.env.JWT_EXPIRES_IN ?? "8h";
const ACTION_TOKEN_EXPIRATION_SECONDS = Number(process.env.ACTION_TOKEN_EXPIRES_SECONDS ?? 3600);

const TEMP_PASSWORD_UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const TEMP_PASSWORD_LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const TEMP_PASSWORD_NUMBERS = "23456789";
const TEMP_PASSWORD_SYMBOLS = "!@#$%*";
const TEMP_PASSWORD_ALL =
  TEMP_PASSWORD_UPPERCASE +
  TEMP_PASSWORD_LOWERCASE +
  TEMP_PASSWORD_NUMBERS +
  TEMP_PASSWORD_SYMBOLS;

export type ActionTokenType = "confirmation" | "password-reset";

export type SessionTokenPayload = {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  profileId?: string | null;
};

type SessionJwtPayload = {
  email: string;
  name: string;
  roles: string[];
  profileId?: string | null;
};

type ActionJwtPayload = {
  email: string;
  type: ActionTokenType;
};

const getJwtSecret = () => {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET no esta configurado en el entorno");
  }

  return new TextEncoder().encode(jwtSecret);
};

const pickRandomCharacter = (characters: string) => {
  const index = crypto.randomInt(0, characters.length);
  return characters[index];
};

const shuffleCharacters = (value: string) => {
  const characters = value.split("");

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join("");
};

const validateSessionPayload = (payload: SessionJwtPayload, subject?: string): SessionTokenPayload => {
  if (!subject || typeof payload.email !== "string" || typeof payload.name !== "string") {
    throw new Error("La sesion es invalida");
  }

  if (!Array.isArray(payload.roles) || payload.roles.some((role) => typeof role !== "string")) {
    throw new Error("Los roles de la sesion son invalidos");
  }

  return {
    userId: subject,
    email: payload.email,
    name: payload.name,
    roles: payload.roles,
    profileId: typeof payload.profileId === "string" ? payload.profileId : null,
  };
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const buildUserName = (firstName: string, lastName?: string) =>
  `${firstName} ${lastName ?? ""}`.replace(/\s+/g, " ").trim();

export const isLoginEnabledRole = (roleName: string) => LOGIN_ENABLED_ROLES.includes(roleName);

export const hasSomeRole = (roles: string[], allowedRoles: string[]) =>
  roles.some((role) => allowedRoles.includes(role));

export const generateTemporaryPassword = (length = 12) => {
  const requiredCharacters = [
    pickRandomCharacter(TEMP_PASSWORD_UPPERCASE),
    pickRandomCharacter(TEMP_PASSWORD_LOWERCASE),
    pickRandomCharacter(TEMP_PASSWORD_NUMBERS),
    pickRandomCharacter(TEMP_PASSWORD_SYMBOLS),
  ];

  const remainingCharacters = Array.from({
    length: Math.max(length - requiredCharacters.length, 0),
  }).map(() => pickRandomCharacter(TEMP_PASSWORD_ALL));

  return shuffleCharacters([...requiredCharacters, ...remainingCharacters].join(""));
};

export const hashPassword = async (password: string) => bcrypt.hash(password, 10);

export const createSessionToken = async ({
  userId,
  email,
  name,
  roles,
  profileId,
}: SessionTokenPayload) =>
  new SignJWT({
    email,
    name,
    roles,
    profileId: profileId ?? null,
  } satisfies SessionJwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(SESSION_TOKEN_EXPIRATION)
    .sign(getJwtSecret());

export const verifySessionToken = async (token: string) => {
  const { payload } = await jwtVerify(token, getJwtSecret());

  return validateSessionPayload(payload as SessionJwtPayload, payload.sub);
};

const createActionToken = async (userId: string, email: string, type: ActionTokenType) => {
  await ActionToken.findOneAndDelete({ user: userId, type });

  const tokenId = crypto.randomUUID();

  await ActionToken.create({
    user: userId,
    token: tokenId,
    type,
  });

  return new SignJWT({ email, type } satisfies ActionJwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(tokenId)
    .setIssuedAt()
    .setExpirationTime(`${ACTION_TOKEN_EXPIRATION_SECONDS}s`)
    .sign(getJwtSecret());
};

export const createConfirmationToken = async (userId: string, email: string) =>
  createActionToken(userId, email, "confirmation");

export const createPasswordResetToken = async (userId: string, email: string) =>
  createActionToken(userId, email, "password-reset");

export const verifyActionToken = async (token: string, expectedType: ActionTokenType) => {
  const { payload } = await jwtVerify(token, getJwtSecret());
  const subject = payload.sub;
  const tokenId = payload.jti;

  if (!subject || !tokenId || typeof payload.email !== "string" || payload.type !== expectedType) {
    throw new Error("El token es invalido");
  }

  const storedToken = await ActionToken.findOne({
    user: subject,
    type: expectedType,
    token: tokenId,
  });

  if (!storedToken) {
    throw new Error("El token es invalido o ya expiro");
  }

  return {
    userId: subject,
    email: payload.email,
    tokenId,
    type: expectedType,
  };
};

export const consumeActionToken = async (userId: string, type: ActionTokenType) => {
  await ActionToken.deleteMany({ user: userId, type });
};

export const deleteUserTokens = async (userId: string) => {
  await ActionToken.deleteMany({ user: userId });
};
