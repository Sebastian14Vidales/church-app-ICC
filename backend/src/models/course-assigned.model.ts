import mongoose, { Schema, Document, Types, PopulatedDoc } from "mongoose";
import { ICourse } from "./course.model";
import { IUserProfile } from "./user-profile.model";

const courseAssignedStatus = {
  ACTIVE: "active",
  COMPLETED: "completed",
} as const;

export type CourseAssignedStatus =
  (typeof courseAssignedStatus)[keyof typeof courseAssignedStatus];

export interface ICourseAssigned extends Document {
  course: PopulatedDoc<ICourse & Document>;
  professor: PopulatedDoc<IUserProfile & Document>;
  members: PopulatedDoc<IUserProfile & Document>[];
  startDate: Date;
  startTime: string;
  totalClasses: number;
  endDate: Date;
  endedAt: Date | null;
  location: string;
  status: CourseAssignedStatus;
  deletedAt: Date | null;
}

const CourseAssignedSchema: Schema = new Schema(
  {
    course: {
      type: Types.ObjectId,
      ref: "Course",
      required: true,
    },
    professor: {
      type: Types.ObjectId,
      ref: "UserProfile",
      required: true,
    },
    members: [
      {
        type: Types.ObjectId,
        ref: "UserProfile",
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    totalClasses: {
      type: Number,
    },
    endDate: {
      type: Date,
      required: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    location: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(courseAssignedStatus),
      default: courseAssignedStatus.ACTIVE,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// AC9.4 / D-18 — Unique partial index by active professor.
// The partialFilterExpression includes `deletedAt: null` so a soft-deleted
// assignment does NOT collide with a new active assignment for the same professor.
CourseAssignedSchema.index(
  { professor: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: courseAssignedStatus.ACTIVE,
      deletedAt: null,
    },
    name: "course_assigned_unique_active_professor",
  },
);

// AC9.1 — Listings by professor + status (active vs history).
CourseAssignedSchema.index(
  { status: 1, professor: 1 },
  { name: "course_assigned_status_professor" },
);

// AC9.2 — History ordered by endDate desc (filter status = completed).
CourseAssignedSchema.index(
  { status: 1, endDate: -1 },
  { name: "course_assigned_status_endDate" },
);

// AC9.3 / D-20 — Soft-delete filter index (sparse).
CourseAssignedSchema.index(
  { deletedAt: 1 },
  {
    sparse: true,
    name: "course_assigned_deletedAt_sparse",
  },
);

const CourseAssigned = mongoose.model<ICourseAssigned>(
  "CourseAssigned",
  CourseAssignedSchema,
);

export default CourseAssigned;