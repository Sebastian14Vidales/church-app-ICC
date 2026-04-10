import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISermon extends Document {
  title: string;
  date: Date;
  time: string;
  pastor: Types.ObjectId;
  description?: string;
}

const sermonSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    pastor: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    description: {
      type: String,
    },
  },
  { timestamps: true },
);

const Sermon = mongoose.model<ISermon>("Sermon", sermonSchema);

export default Sermon;