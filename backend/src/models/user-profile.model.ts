import mongoose, { Schema, Document, Types, PopulatedDoc } from "mongoose";
import { IRole } from "./role.model";

export interface IUserProfile extends Document {
  firstName: string;
  lastName: string;
  documentID: string;
  birthdate: Date;
  neighborhood: string;
  phoneNumber: string;
  bloodType: string;
  baptized?: boolean;
  servesInMinistry?: boolean;
  ministry?: string | null;
  ministryInterest?: string | null;
  spiritualGrowthStage?: string;
  encounterStage?: string;
  profession?: string;
  role: PopulatedDoc<IRole & Document>;
  user?: PopulatedDoc<Types.ObjectId>;
}

export const MINISTRIES = [
  "Ministerio de Alabanza",
  "Ministerio de Danza",
  "Ministerio de Audiovisuales",
  "Ministerio de Varones",
  "Ministerio de Jóvenes",
  "Ministerio de Parejas y Familia",
  "Ministerio de Mujeres",
  "Ministerio de Evangelismo y Consolidación",
  "Funda Esperanza",
  "Ministerio de Servidores",
  "Ministerio Infantil",
  "Ministerio de Oración e Intercesión",
  "Ministerio de Liberación",
  "Ministerio de Misericordia",
];

export const SPIRITUAL_GROWTH_STAGES = [
  "Consolidación",
  "Discipulado básico",
  "Carácter cristiano",
  "Sanidad y propósito",
  "Cosmovisión bíblica",
  "Finanzas y Gobierno",
  "Doctrina cristiana",
];

/** Valor explícito "sin ruta iniciada" para el perfil (ADR-0014). No es una etapa de la secuencia. */
export const NO_SPIRITUAL_GROWTH_STAGE = "Ninguna";

/** Valores admisibles en UserProfile.spiritualGrowthStage (ADR-0014). Course usa solo SPIRITUAL_GROWTH_STAGES. */
export const SPIRITUAL_GROWTH_STAGE_CHOICES = [
  NO_SPIRITUAL_GROWTH_STAGE,
  ...SPIRITUAL_GROWTH_STAGES,
];

const ENCOUNTER_STAGES = ["Ninguno", "Encuentro", "Reencuentro"];

const userProfileSchema: Schema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    documentID: {
      type: String,
      required: true,
    },
    birthdate: {
      type: Date,
      required: true,
    },
    neighborhood: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    bloodType: {
      type: String,
      required: true,
    },
    baptized: {
      type: Boolean,
    },
    servesInMinistry: {
      type: Boolean,
    },
    ministry: {
      type: String,
      enum: MINISTRIES,
    },
    ministryInterest: {
      type: String,
      enum: MINISTRIES,
    },
    spiritualGrowthStage: {
      type: String,
      enum: SPIRITUAL_GROWTH_STAGE_CHOICES, // ADR-0014: incluye "Ninguna"
    },
    encounterStage: {
      type: String,
      enum: ENCOUNTER_STAGES,
    },
    profession: {
      type: String,
      trim: true,
    },
    role: {
      type: Types.ObjectId,
      ref: "Role",
      required: true,
    },
    user: {
      type: Types.ObjectId,
      ref: "User",
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true },
);

const UserProfile = mongoose.model<IUserProfile>(
  "UserProfile",
  userProfileSchema,
);

export default UserProfile;
