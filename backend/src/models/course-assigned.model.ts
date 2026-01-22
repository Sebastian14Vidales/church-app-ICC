import mongoose, { Schema, Document, Types, PopulatedDoc } from "mongoose";
import { IUser } from "./user.model";
import { ICourse } from "./course.model";

const courseAssignedStatus = {
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type CourseAssignedStatus =
  (typeof courseAssignedStatus)[keyof typeof courseAssignedStatus];

export interface ICourseAssigned extends Document {
  course: PopulatedDoc<ICourse & Document>;
  professor: PopulatedDoc<IUser & Document>;
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
      ref: "User",
      required: true,
    },
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
      required: true,
    },
    endDate: {
      type: Date,
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

const CourseAssigned = mongoose.model<ICourseAssigned>(
  "CourseAssigned",
  CourseAssignedSchema,
);

export default CourseAssigned;
