import mongoose, { Document, Schema, Types } from "mongoose";

export type LifeGroupType = "life-group" | "couple-group";

export interface ILifeGroupSession extends Document {
  date: Date;
  weekNumber: number;
  attendeesPresent: Types.ObjectId[];
  offeringAmount: number;
  notes?: string;
}

export interface ILifeGroup extends Document {
  name: string;
  neighborhood: string;
  address: string;
  supervisor: Types.ObjectId;
  leader?: Types.ObjectId;        // optional in TS (required in schema) — transition pattern
  type?: LifeGroupType;           // optional in TS (required in schema) — transition pattern
  attendees: Types.ObjectId[];
  sessions: Types.DocumentArray<ILifeGroupSession & Document>;
}

const lifeGroupSessionSchema = new Schema<ILifeGroupSession>(
  {
    date: { type: Date, required: true },
    weekNumber: { type: Number, required: true, min: 1 },
    attendeesPresent: [{ type: Types.ObjectId, ref: "UserProfile" }],
    offeringAmount: { type: Number, required: true, default: 0, min: 0 },
    notes: { type: String, trim: true },
  },
  { _id: true, timestamps: true },
);

const lifeGroupSchema = new Schema<ILifeGroup>(
  {
    name: { type: String, required: true, trim: true },
    neighborhood: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    supervisor: { type: Types.ObjectId, ref: "UserProfile", required: true },
    leader: { type: Types.ObjectId, ref: "UserProfile", required: true },
    type: { type: String, enum: ["life-group", "couple-group"], required: true },
    attendees: [{ type: Types.ObjectId, ref: "UserProfile" }],
    sessions: { type: [lifeGroupSessionSchema], default: [] },
  },
  { timestamps: true },
);

// Indexes: supervisor for their coverage list; leader for the leader's "my group" lookup.
lifeGroupSchema.index({ supervisor: 1 });
lifeGroupSchema.index({ leader: 1 });

const LifeGroup = mongoose.model<ILifeGroup>("LifeGroup", lifeGroupSchema);

export default LifeGroup;
