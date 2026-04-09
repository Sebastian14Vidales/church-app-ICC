import { type Express } from "express"
import { createServer, type Server as HttpServer } from "http"
import { Server, type Socket } from "socket.io"
import { verifySessionToken } from "../utils/auth.utils"
import { type AuthSession } from "../types/auth"

/**
 * Payload que se envía a los clientes cuando cache debe invalidarse
 */
type RealtimeInvalidationPayload = {
    type: string
    queryKeys: string[][]
    timestamp: string
}

let io: Server | null = null

/**
 * Extrae el token Bearer del header Authorization
 * Formato esperado: "Bearer <token>"
 */
const extractBearerToken = (authorizationHeader?: string) => {
    if (!authorizationHeader?.startsWith("Bearer ")) {
        return null
    }

    return authorizationHeader.slice("Bearer ".length).trim()
}

/**
 * Extrae el token de autenticación del socket
 * - Intenta primero desde { auth: { token } }
 * - Fallback: Authorization header
 */
const extractSocketToken = (socket: Socket) => {
    const authToken = socket.handshake.auth.token

    if (typeof authToken === "string" && authToken.trim()) {
        return authToken.trim()
    }

    const authorizationHeader = socket.handshake.headers.authorization
    return extractBearerToken(
        Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader,
    )
}

/**
 * Crea un servidor HTTP (base para Socket.IO)
 */
export const createHttpServer = (app: Express) => createServer(app)

/**
 * Inicializa el servidor Socket.IO
 * - Configura CORS
 * - Verifica tokens en middleware
 * - Automatiza suscripción a canales por roles y perfil
 */
export const initializeSocketServer = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
            credentials: true,
        },
    })

    // Middleware: verificar autenticación antes de conectar
    io.use(async (socket, next) => {
        try {
            const token = extractSocketToken(socket)

            if (!token) {
                return next(new Error("No autorizado"))
            }

            // Verificar token y obtener datos de sesión
            const auth = (await verifySessionToken(token)) as AuthSession
            socket.data.auth = auth
            return next()
        } catch (error) {
            return next(error instanceof Error ? error : new Error("Sesion invalida"))
        }
    })

    // Connection: suscribir usuario a sus canales
    io.on("connection", (socket) => {
        // Todos los usuarios autenticados se unen a este canal
        socket.join("authenticated")

        // Canal privado por perfil
        const auth = socket.data.auth as AuthSession | undefined
        
        // Canales privados por rol (ej: "role:admin", "role:teacher")
        auth?.roles.forEach((role) => socket.join(`role:${role}`))

        // Canal privado por usuario
        if (auth?.profileId) {
            socket.join(`profile:${auth.profileId}`)
        }
    })

    return io
}

/**
 * Emite invalidación de cache a todos los clientes autenticados
 *
 * Uso desde control:
 * emitRealtimeInvalidation("users", [["users", "list"], ["users", "profile", "123"]])
 */
export const emitRealtimeInvalidation = (type: string, queryKeys: string[][]) => {
    if (!io) {
        return
    }

    const payload: RealtimeInvalidationPayload = {
        type,
        queryKeys,
        timestamp: new Date().toISOString(),
    }

    io.to("authenticated").emit("queries:invalidate", payload)
}
