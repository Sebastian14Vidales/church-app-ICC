import mongoose, { Document, Types } from "mongoose";

export interface IActionToken extends Document {
  token: string;
  user: Types.ObjectId;
  createdAt: Date;
  type: "confirmation" | "password-reset";
}

const actionTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    trim: true,
  },
  user: {
    type: Types.ObjectId,
    required: true,
    ref: "User",
  },
  type: {
    type: String,
    required: true,
    enum: ["confirmation", "password-reset"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600,
  },
});

actionTokenSchema.index({ user: 1, type: 1 }, { unique: true });

const ActionToken = mongoose.model<IActionToken>("ActionToken", actionTokenSchema);

export default ActionToken;
