import mongoose, { Schema, Document } from "mongoose";

export interface IRole extends Document {
    name: string;
    description: string;
}

const roleSchema: Schema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        enum: ["member", "professor", "pastor", "admin", "superadmin"],
    },
    description: {
        type: String,
        trim: true,
    },
}, { timestamps: true }
);

const Role = mongoose.model<IRole>("Role", roleSchema);

export default Role;