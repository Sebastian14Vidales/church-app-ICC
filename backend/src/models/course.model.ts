import mongoose, { Schema, Document } from 'mongoose';

export interface ICourse extends Document {
    name: string;
    description: string;
    isActive: boolean;
}

const CourseSchema: Schema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
},
    { timestamps: true }
);

const Course = mongoose.model<ICourse>('Course', CourseSchema);

export default Course;