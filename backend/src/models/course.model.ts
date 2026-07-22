import mongoose, { Schema, Document } from "mongoose";

export interface ICourse extends Document {
  name: string;
  description: string;
  level: string;
  isActive: boolean;
  deletedAt: Date | null;
}

const CourseSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: String,
      enum: ["basic", "intermediate", "advanced"],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// AC9.3 — Soft-delete filter index (sparse: sólo documentos con deletedAt seteado).
CourseSchema.index(
  { deletedAt: 1 },
  {
    sparse: true,
    name: "course_deletedAt_sparse",
  },
);

const Course = mongoose.model<ICourse>("Course", CourseSchema);

export default Course;
