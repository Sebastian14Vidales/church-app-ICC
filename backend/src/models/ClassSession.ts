import mongoose, { Schema, Document, Types, PopulatedDoc } from "mongoose";
import { ICourseAssigned } from "./CourseAssigned";
import { IUser } from "./User";

export interface IAttendance {
    student: PopulatedDoc<IUser & Document>;
    present: boolean;
    notes?: string;
}

export interface IClassSession extends Document {
    courseAssigned: PopulatedDoc<ICourseAssigned & Document>;
    classNumber: number;
    data: Date;
    topic?: string;
    observations?: string;
    attendance: IAttendance[];
}

const attendanceSchema: Schema = new Schema({
    student: {
        type: Types.ObjectId,
        ref: "User",
        required: true
    },
    present: {
        type: Boolean,
        required: true
    },
},
    { _id: false }
);

const classSessionSchema: Schema = new Schema({
    courseAssigned: {
        type: Types.ObjectId,
        ref: "CourseAssigned",
        required: true
    },
    classNumber: {
        type: Number,
        required: true,
        min: 1
    },
    date: {
        type: Date,
        required: true
    },
    topic: {
        type: String,
        trim: true
    },
    observations: {
        type: String,
        trim: true
    },
    attendance: {
        type: [attendanceSchema],
        default: []
    }
},
    { timestamps: true }
);

const ClassSession = mongoose.model<IClassSession>("ClassSession", classSessionSchema);

export default ClassSession;