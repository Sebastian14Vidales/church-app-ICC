import express from "express";
import connectDB from "./config/db";

import courseRoutes from "./routes/course.routes";
import userRoutes from "./routes/user.routes";

const app = express();
app.use(express.json());
connectDB();

//Routes
app.use("/api/courses", courseRoutes);
app.use("/api/users", userRoutes);

export default app;
