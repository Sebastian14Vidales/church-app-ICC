import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db";
import { seedDatabase } from "./config/seed";
import authRoutes from "./routes/session-auth.routes";
import courseAssignmentRoutes from "./routes/course-assignment.routes";
import attendanceRoutes from "./routes/attendance.routes";
import courseRoutes from "./routes/course.routes";
import roleRoutes from "./routes/role.routes";
import userRoutes from "./routes/user.routes";
import userProfileRoutes from "./routes/user-profile.routes";
import sermonRoutes from "./routes/sermon.routes";
import lifeGroupRoutes from "./routes/life-group.routes";
import eventRoutes from "./routes/event.routes";

const app = express();
app.use(express.json());

// Hardening HTTP ( ADR-0003 §D2 ). Se monta antes que cualquier router y antes
// de CORS. Helmet se mantiene activo en todos los entornos (incluido test):
// las respuestas son JSON, su CSP por defecto no afecta llamadas XHR/fetch y
// los smoke tests de Supertest no asertan headers.
app.use(helmet());

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

// Rate-limit general para /api/* ( ADR-0003 §D3 ). 100 req/min por IP como
// defensa en profundidad. Se SKIP en entorno de test para no romper futuros
// tests end-to-end que monten `server.ts` real ( ADR-0003 §D5 ). Los smoke
// tests actuales usan una app Express aparte y no se ven afectados en ningún
// caso. Se monta DESPUÉS de helmet/cors y ANTES de los routers.
//
// EXENCIÓN DE /api/auth/* ( fix BUG-NAVEGACION, ADR-0003 §D3bis ):
// Las rutas de autenticación quedan FUERA del bucket del `generalLimiter`.
// Motivo: el frontend emite ráfagas legítimas sobre /api/auth/* al bootear
// (login + bootstrap del AuthContext + reintentos de refreshToken), y al
// compartir bucket con el tráfico de datos (listados, paginación, dashboards)
// un operador legítimo agota los 100/min y el frontend cierra sesión por 429.
// La auth se protege con expiración de JWT + AuthorizeRoles + validación; añadir
// un limiter específico de login/brute-force queda como backlog del
// auth-security-engineer (ver ADR-0003 §D3bis).
//
// Implementación: `skip` con `req.originalUrl` (NO `req.path`, que Express
// "strips" al mount path `/api` por lo que "/auth/login" ya no haría match
// con "/api/auth"). `originalUrl` preserva la URL completa y es estable.
const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas solicitudes. Intenta más tarde." },
  skip: (req) => req.originalUrl.startsWith("/api/auth"),
});
if (process.env.NODE_ENV !== "test") app.use("/api", generalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/members", userProfileRoutes);
// Order matters: /api/courses prefix is shared by three routers ( ADR-0001 §D1 ).
// 1) course-assignment.routes.ts — concrete subresources (/assignments, /my-courses, ...)
// 2) attendance.routes.ts       — /my-attendance
// 3) course.routes.ts (catalog) — must go LAST so its `GET /:id` does NOT shadow
//    the subresources above. Express matches in the order of `app.use`.
app.use("/api/courses", courseAssignmentRoutes);
app.use("/api/courses", attendanceRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/sermons", sermonRoutes);
app.use("/api/life-groups", lifeGroupRoutes);
app.use("/api/events", eventRoutes);

export default app;
