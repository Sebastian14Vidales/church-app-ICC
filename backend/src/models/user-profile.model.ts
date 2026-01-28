import mongoose, { Schema, Document, Types, PopulatedDoc } from "mongoose";

export interface IUserProfile extends Document {
    firstName: string;
    lastName: string;
    documentID: string;
    birthdate: Date;
    neighborhood: string;
    phoneNumber: string;
    bloodType: string;
    user: PopulatedDoc<Types.ObjectId>;
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
    user: {
      type: Types.ObjectId,
      ref: "User",
      unique: true,
    },
  },
  { timestamps: true },
);

const UserProfile = mongoose.model<IUserProfile>(
  "UserProfile",
  userProfileSchema,
);

export default UserProfile;
