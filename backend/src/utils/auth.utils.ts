import crypto from "crypto";
import bcrypt from "bcrypt";
import Token from "../models/token.model";

export const LOGIN_ENABLED_ROLES = ["Admin", "Superadmin", "Profesor", "Pastor"];

const TEMP_PASSWORD_UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const TEMP_PASSWORD_LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const TEMP_PASSWORD_NUMBERS = "23456789";
const TEMP_PASSWORD_SYMBOLS = "!@#$%*";
const TEMP_PASSWORD_ALL =
  TEMP_PASSWORD_UPPERCASE +
  TEMP_PASSWORD_LOWERCASE +
  TEMP_PASSWORD_NUMBERS +
  TEMP_PASSWORD_SYMBOLS;

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

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const buildUserName = (firstName: string, lastName?: string) =>
  `${firstName} ${lastName ?? ""}`.replace(/\s+/g, " ").trim();

export const isLoginEnabledRole = (roleName: string) => LOGIN_ENABLED_ROLES.includes(roleName);

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

export const generateConfirmationToken = () =>
  crypto.randomInt(100000, 1000000).toString();

export const createConfirmationToken = async (userId: string) => {
  await Token.findOneAndDelete({ user: userId, type: "confirmation" });

  return Token.create({
    user: userId,
    token: generateConfirmationToken(),
    type: "confirmation",
  });
};

export const deleteUserTokens = async (userId: string) => {
  await Token.deleteMany({ user: userId });
};
