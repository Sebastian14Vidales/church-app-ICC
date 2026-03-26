import express from "express";
import cors from "cors";
import connectDB from "./config/db";
import { seedDatabase } from "./config/seed";
import authRoutes from "./routes/auth.routes";
import courseRoutes from "./routes/course.routes";
import roleRoutes from "./routes/role.routes";
import userRoutes from "./routes/user.routes";
import userProfileRoutes from "./routes/user-profile.routes";

const app = express();
app.use(express.json());

connectDB()
  .then(async () => {
    console.log("Conectado a la base de datos");
    await seedDatabase();
  })
  .catch((error) => {
    console.error("Error al conectar a la base de datos:", error);
  });

app.use(
  cors({
    origin: `${process.env.FRONTEND_URL}`,
  }),
);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/members", userProfileRoutes);
app.use("/api/courses", courseRoutes);

export default app;
