import colors from "colors";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const db = process.env.DATABASE_URL;

const connectDB = async () => {
    try {
        await mongoose.connect(db);
        console.log(colors.green.bold("Connected to MongoDB"));
    } catch (error) {
        console.log(colors.red.bold("Error connecting to MongoDB"));
        process.exit(1);
    }
}

export default connectDB;