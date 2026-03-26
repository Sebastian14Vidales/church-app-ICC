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
  role: PopulatedDoc<IRole & Document>;
  user?: PopulatedDoc<Types.ObjectId>;
}

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
