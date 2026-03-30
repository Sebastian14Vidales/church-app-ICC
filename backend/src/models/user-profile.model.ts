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
  baptized: boolean;
  servesInMinistry: boolean;
  ministry?: string | null;
  ministryInterest?: string | null;
  spiritualGrowthStage: string;
  role: PopulatedDoc<IRole & Document>;
  user?: PopulatedDoc<Types.ObjectId>;
}

const MINISTRIES = [
  "Ministerio de Alabanza",
  "Ministerio de Danza (Niñas entre 7 y 14 años)",
  "Ministerio de Jóvenes",
  "Ministerio de Servidores",
  "Ministerio de Oración e Intercesión",
  "Ministerio de Hombres",
  "Ministerio de Mujeres",
  "Ministerio de Parejas y Familias",
  "Ministerio Iglesia Infantil",
  "Ministerio de Evangelismo y Consolidación G.V.E",
];

const SPIRITUAL_GROWTH_STAGES = [
  "Consolidación",
  "Discipulado básico",
  "Carácter cristiano",
  "Sanidad y propósito",
  "Cosmovisión bíblica",
  "Doctrina cristiana",
];

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
      default: false,
    },
    servesInMinistry: {
      type: Boolean,
      default: false,
    },
    ministry: {
      type: String,
      enum: MINISTRIES,
      default: null,
    },
    ministryInterest: {
      type: String,
      enum: MINISTRIES,
      default: null,
    },
    spiritualGrowthStage: {
      type: String,
      enum: SPIRITUAL_GROWTH_STAGES,
      default: "Consolidación",
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
