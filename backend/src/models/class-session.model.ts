import mongoose, { Schema, Document, Types, PopulatedDoc } from "mongoose";
import { ICourseAssigned } from "./course-assigned.model";
import { IUserProfile } from "./user-profile.model";

export interface IAttendance {
  student: PopulatedDoc<IUserProfile & Document>;
  present: boolean;
  notes?: string;
}

export interface IClassSession extends Document {
  courseAssigned: PopulatedDoc<ICourseAssigned & Document>;
  classNumber: number;
  date: Date;
  topic?: string;
  observations?: string;
  attendance: IAttendance[];
  deletedAt: Date | null;
}

const attendanceSchema: Schema = new Schema(
  {
    student: {
      type: Types.ObjectId,
      ref: "UserProfile",
      required: true,
    },
    present: {
      type: Boolean,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const classSessionSchema: Schema = new Schema(
  {
    courseAssigned: {
      type: Types.ObjectId,
      ref: "CourseAssigned",
      required: true,
    },
    classNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    date: {
      type: Date,
      required: true,
    },
    topic: {
      type: String,
      trim: true,
    },
    observations: {
      type: String,
      trim: true,
    },
    attendance: {
      type: [attendanceSchema],
      default: [],
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// ADR-0001 §D5 / AC7.6 — Unique per (assignment, classNumber) restricted to
// non-soft-deleted sessions. When a course is reopened with a reduced
// `totalClasses`, surplus ClassSessions are soft-deleted (deletedAt set) and
// MUST NOT block later creation of sessions for new classNumbers, nor the
// re-creation of a session with the same classNumber in subsequent reopen
// cycles. The partialFilterExpression on `deletedAt: null` keeps the
// constraint effective only for live sessions.
classSessionSchema.index(
  { courseAssigned: 1, classNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
    name: "class_session_unique_active_class",
  },
);

// Soft-delete filter index (sparse).
classSessionSchema.index(
  { deletedAt: 1 },
  {
    sparse: true,
    name: "class_session_deletedAt_sparse",
  },
);

const ClassSession = mongoose.model<IClassSession>(
  "ClassSession",
  classSessionSchema,
);

export default ClassSession;