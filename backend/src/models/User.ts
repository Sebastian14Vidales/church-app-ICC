import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUser extends Document {
    email: string;
    password: string;
    name: string;
    confirmed: boolean;
    active: boolean;
    roles: Types.ObjectId[];
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
        required: true,
    },
    name: {
        type: String,
        required: true
    },
    confirmed: {
        type: Boolean,
        default: false
    },
    active: {
        type: Boolean,
        default: true
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