import mongoose, { Document, Schema, Types } from "mongoose";

export interface ILifeGroup extends Document {
  name: string;
  neighborhood: string;
  address: string;
  supervisor: Types.ObjectId;
}

const lifeGroupSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    neighborhood: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    supervisor: {
      type: Types.ObjectId,
      ref: "UserProfile",
      required: true,
    },
  },
  { timestamps: true },
);

const LifeGroup = mongoose.model<ILifeGroup>("LifeGroup", lifeGroupSchema);

export default LifeGroup;
