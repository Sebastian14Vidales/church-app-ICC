import express from "express";
import connectDB from "./config/db";

import courseRoutes from "./routes/courseRoutes";
import userRoutes from "./routes/userRoutes";

const app = express();
app.use(express.json());
connectDB();

//Routes

app.use('/api/courses', courseRoutes);
app.use('/api/users', userRoutes);

export default app;
