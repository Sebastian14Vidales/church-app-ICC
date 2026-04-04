import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/lib/auth"
import { connectRealtime, disconnectRealtime, onRealtimeInvalidation } from "@/lib/realtime"

export default function RealtimeBridge() {
    const queryClient = useQueryClient()
    const { token, isAuthenticated } = useAuth()

    useEffect(() => {
        if (!isAuthenticated || !token) {
            disconnectRealtime()
            return
        }

        connectRealtime(token)

        const unsubscribe = onRealtimeInvalidation(({ queryKeys }) => {
            queryKeys.forEach((queryKey) => {
                queryClient.invalidateQueries({ queryKey })
            })
        })

        return () => {
            unsubscribe()
            disconnectRealtime()
        }
    }, [isAuthenticated, queryClient, token])

    return null
}
