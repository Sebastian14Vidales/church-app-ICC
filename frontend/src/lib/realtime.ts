import { io, type Socket } from "socket.io-client"
import type { Notification } from "@/types/index"

/**
 * Payload que el servidor envía cuando invalida cache
 * - type: categoría de datos invalidados (ej: "users", "courses")
 * - queryKeys: array de llaves de React Query para invalidar
 * - timestamp: cuándo el servidor emitió la invalidación
 */
type RealtimeInvalidationPayload = {
    type: string
    queryKeys: string[][]
    timestamp: string
}

/**
 * Payload que el servidor envía cuando crea una notificación para el usuario
 * - notification: notificación serializada recién creada
 */
type RealtimeNotificationPayload = {
    notification: Notification
}

let realtimeSocket: Socket | null = null

/**
 * Obtiene la URL base del servidor desde variables de entorno
 * Fallback: origin actual del navegador
 */
const getRealtimeBaseUrl = () => {
    const apiBaseUrl = import.meta.env.VITE_BASE_URL

    if (!apiBaseUrl) {
        return window.location.origin
    }

    try {
        return new URL(apiBaseUrl).origin
    } catch {
        return window.location.origin
    }
}

/**
 * Conecta el cliente Socket.IO al servidor realtime
 * - Desconecta cualquier conexión anterior
 * - Autentica usando el token del usuario
 * - Usa fallback a polling si WebSocket no está disponible
 */
export const connectRealtime = (token: string) => {
    if (realtimeSocket) {
        realtimeSocket.disconnect()
    }

    realtimeSocket = io(getRealtimeBaseUrl(), {
        auth: { token },
        transports: ["websocket", "polling"],
    })

    return realtimeSocket
}

/**
 * Desconecta el cliente Socket.IO limpiamente
 */
export const disconnectRealtime = () => {
    realtimeSocket?.disconnect()
    realtimeSocket = null
}

/**
 * Registra un listener para eventos de invalidación de cache
 * Retorna función para desuscribirse
 *
 * Uso:
 * const unsubscribe = onRealtimeInvalidation((payload) => {
 *   console.log("Cache invalidado:", payload)
 * })
 * unsubscribe() // cuando no necesites escuchar
 */
export const onRealtimeInvalidation = (
    handler: (payload: RealtimeInvalidationPayload) => void,
) => {
    realtimeSocket?.on("queries:invalidate", handler)

    return () => {
        realtimeSocket?.off("queries:invalidate", handler)
    }
}

/**
 * Registra un listener para nuevas notificaciones en tiempo real
 * Retorna función para desuscribirse
 *
 * Uso:
 * const unsubscribe = onRealtimeNotification(({ notification }) => {
 *   // mostrar toast / invalidar cache
 * })
 * unsubscribe() // cuando no necesites escuchar
 */
export const onRealtimeNotification = (
    handler: (payload: RealtimeNotificationPayload) => void,
) => {
    realtimeSocket?.on("notifications:new", handler)

    return () => {
        realtimeSocket?.off("notifications:new", handler)
    }
}
