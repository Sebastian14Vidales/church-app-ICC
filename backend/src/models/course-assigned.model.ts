import mongoose, { Schema, Document, Types, PopulatedDoc } from "mongoose";
import { ICourse } from "./course.model";
import { IUserProfile } from "./user-profile.model";

const courseAssignedStatus = {
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
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
  location: string;
  status: CourseAssignedStatus;
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
    location: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(courseAssignedStatus),
      default: courseAssignedStatus.ACTIVE,
    },
  },
  { timestamps: true },
);

CourseAssignedSchema.index(
  { professor: 1 },
  { unique: true, partialFilterExpression: { status: courseAssignedStatus.ACTIVE } },
);

const CourseAssigned = mongoose.model<ICourseAssigned>(
  "CourseAssigned",
  CourseAssignedSchema,
);

export default CourseAssigned;
