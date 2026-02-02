import express from "express";
import connectDB from "./config/db";
import { seedDatabase } from "./config/seed";

import courseRoutes from "./routes/course.routes";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/auth.routes";

import cors from "cors";


const app = express();
app.use(express.json());

connectDB().then( async () => {
  console.log("✅ Conectado a la base de datos");
  await seedDatabase();
}).catch((error) => {
  console.error("❌ Error al conectar a la base de datos:", error);
});

//Middlewares
app.use(cors({
  origin: `${process.env.FRONTEND_URL}`,
}));

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);

export default app;
