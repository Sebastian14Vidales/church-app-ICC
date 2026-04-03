import mongoose, { Document, Types } from "mongoose";

export interface IToken extends Document {
    token: string;
    user: Types.ObjectId;
    createdAt: Date;
    type: "confirmation" | "password-reset";
}

const tokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        match: [/^\d{6}$/, "El token debe tener exactamente 6 dígitos"],
    },
    user: {
        type: Types.ObjectId,
        required: true,
        ref: "User"
    },
    type: {
        type: String,
        required: true,
        enum: ["confirmation", "password-reset"]
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3600 // El token expirará después de 1 hora
    }
});

tokenSchema.index({ user: 1, type: 1 }, { unique: true });

const Token = mongoose.model<IToken>("Token", tokenSchema);

export default Token; 
