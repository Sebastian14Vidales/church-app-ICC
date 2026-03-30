import mongoose, { Schema, Document } from "mongoose";

export interface IRole extends Document {
  name: string;
}

const roleSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: [
        "Asistente",
        "Miembro",
        "Profesor",
        "Pastor",
        "Admin",
        "Superadmin",
      ],
    },
  },
  { timestamps: true },
);

const Role = mongoose.model<IRole>("Role", roleSchema);

export default Role;
