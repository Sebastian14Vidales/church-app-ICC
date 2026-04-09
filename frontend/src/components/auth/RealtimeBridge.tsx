import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/lib/auth"
import { connectRealtime, disconnectRealtime, onRealtimeInvalidation } from "@/lib/realtime"

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
        const unsubscribe = onRealtimeInvalidation(({ queryKeys }) => {
            queryKeys.forEach((queryKey) => {
                queryClient.invalidateQueries({ queryKey })
            })
        })

        // Limpieza: escuchar cambios en autenticación
        return () => {
            unsubscribe()
            disconnectRealtime()
        }
    }, [isAuthenticated, queryClient, token])

    // Este componente no renderiza nada, solo maneja la lógica
    return null
}
