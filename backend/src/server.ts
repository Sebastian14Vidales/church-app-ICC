import express from "express";
import connectDB from "./config/db";
import courseRoutes from "./routes/courseRoutes";

const app = express();
app.use(express.json());
connectDB();

//Routes
app.use('/api/courses', courseRoutes)

export default app;
