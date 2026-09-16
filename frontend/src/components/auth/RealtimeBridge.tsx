import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "react-toastify"
import { useAuth } from "@/hooks/useAuth"
import {
    connectRealtime,
    disconnectRealtime,
    onRealtimeInvalidation,
    onRealtimeNotification,
} from "@/lib/realtime"

/**
 * RealtimeBridge - Componente invisible que sincroniza Socket.IO con React Query
 *
 * Propósito:
 * - Conecta/desconecta el cliente de Socket.IO cuando el usuario se autentica
 * - Escucha eventos del servidor que invalidan cache de React Query
 * - Asegura que los datos mostrados siempre estén actualizados en tiempo real
 *
 * Funciona sin renderizar UI (retorna null)
 */
export default function RealtimeBridge() {
    const queryClient = useQueryClient()
    const { token, isAuthenticated } = useAuth()

    useEffect(() => {
        // Si no hay autenticación, asegurar desconexión
        if (!isAuthenticated || !token) {
            disconnectRealtime()
            return
        }

        // Conectar cliente Socket.IO
        connectRealtime(token)

        // Escuchar invalidaciones del servidor e invalidar cache localmente
        const unsubscribeInvalidation = onRealtimeInvalidation(({ queryKeys }) => {
            queryKeys.forEach((queryKey) => {
                queryClient.invalidateQueries({ queryKey })
            })
        })

        // Escuchar nuevas notificaciones: invalidar query y mostrar toast
        const unsubscribeNotification = onRealtimeNotification(({ notification }) => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] })
            toast.info(
                <div className="text-sm">
                    <p className="font-semibold">{notification.title}</p>
                    <p className="text-slate-200">{notification.message}</p>
                </div>,
            )
        })

        // Limpieza: escuchar cambios en autenticación
        return () => {
            unsubscribeInvalidation()
            unsubscribeNotification()
            disconnectRealtime()
        }
    }, [isAuthenticated, queryClient, token])

    // Este componente no renderiza nada, solo maneja la lógica
    return null
}
