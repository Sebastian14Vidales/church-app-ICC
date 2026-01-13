import mongoose, { Schema, Document, Types, PopulatedDoc } from "mongoose";
import { IRole } from './Role';

export interface IUser extends Document {
    email: string;
    password: string;
    name: string;
    confirmed: boolean;
    active: boolean;
    roles: PopulatedDoc<IRole & Document>[];
}

const userSchema: Schema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
    },
    name: {
        type: String,
        required: true
    },
    confirmed: {
        type: Boolean,
        default: false
    },
    roles: [
        {
            type: Types.ObjectId,
            ref: "Role"
        },
    ],
},
    { timestamps: true }
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;