import { type Express } from "express";
import { createServer, type Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { verifySessionToken } from "../utils/auth.utils";
import { type AuthSession } from "../types/auth";

type RealtimeInvalidationPayload = {
  type: string;
  queryKeys: string[][];
  timestamp: string;
};

let io: Server | null = null;

const extractBearerToken = (authorizationHeader?: string) => {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim();
};

const extractSocketToken = (socket: Socket) => {
  const authToken = socket.handshake.auth.token;

  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.trim();
  }

  const authorizationHeader = socket.handshake.headers.authorization;
  return extractBearerToken(
    Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader,
  );
};

export const createHttpServer = (app: Express) => createServer(app);

export const initializeSocketServer = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = extractSocketToken(socket);

      if (!token) {
        return next(new Error("No autorizado"));
      }

      const auth = (await verifySessionToken(token)) as AuthSession;
      socket.data.auth = auth;
      return next();
    } catch (error) {
      return next(error instanceof Error ? error : new Error("Sesion invalida"));
    }
  });

  io.on("connection", (socket) => {
    socket.join("authenticated");

    const auth = socket.data.auth as AuthSession | undefined;
    auth?.roles.forEach((role) => socket.join(`role:${role}`));

    if (auth?.profileId) {
      socket.join(`profile:${auth.profileId}`);
    }
  });

  return io;
};

export const emitRealtimeInvalidation = (type: string, queryKeys: string[][]) => {
  if (!io) {
    return;
  }

  const payload: RealtimeInvalidationPayload = {
    type,
    queryKeys,
    timestamp: new Date().toISOString(),
  };

  io.to("authenticated").emit("queries:invalidate", payload);
};
