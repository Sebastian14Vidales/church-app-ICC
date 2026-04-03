import mongoose, { Schema, Document, Types, PopulatedDoc } from "mongoose";
import { IRole } from "./role.model";

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  confirmed: boolean;
  active: boolean;
  roles: PopulatedDoc<IRole & Document>[];
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const userSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      set: normalizeEmail,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
    },
    confirmed: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    roles: [
      {
        type: Types.ObjectId,
        ref: "Role",
      },
    ],
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
