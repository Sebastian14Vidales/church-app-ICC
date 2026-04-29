import mongoose, { Document, Schema, Types } from "mongoose";

export interface IEventRegistration {
  profile: Types.ObjectId;
  status: "registered" | "cancelled";
  amountPaid: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEvent extends Document {
  name: string;
  capacity: number;
  date: Date;
  time: string;
  place: string;
  price: number;
  description?: string;
  registrationDeadline?: Date | null;
  registrationClosed: boolean;
  registrations: Types.DocumentArray<IEventRegistration & Document>;
}

const eventRegistrationSchema = new Schema<IEventRegistration>(
  {
    profile: {
      type: Types.ObjectId,
      ref: "UserProfile",
      required: true,
    },
    status: {
      type: String,
      enum: ["registered", "cancelled"],
      default: "registered",
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    _id: true,
    timestamps: true,
  },
);

const eventSchema = new Schema<IEvent>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
      trim: true,
    },
    place: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    registrationDeadline: {
      type: Date,
      default: null,
    },
    registrationClosed: {
      type: Boolean,
      default: false,
    },
    registrations: {
      type: [eventRegistrationSchema],
      default: [],
    },
  },
  { timestamps: true },
);

const Event = mongoose.model<IEvent>("Event", eventSchema);

export default Event;
