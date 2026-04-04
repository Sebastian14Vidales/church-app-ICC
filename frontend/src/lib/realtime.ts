import { io, type Socket } from "socket.io-client"

type RealtimeInvalidationPayload = {
    type: string
    queryKeys: string[][]
    timestamp: string
}

let realtimeSocket: Socket | null = null

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

export const disconnectRealtime = () => {
    realtimeSocket?.disconnect()
    realtimeSocket = null
}

export const onRealtimeInvalidation = (
    handler: (payload: RealtimeInvalidationPayload) => void,
) => {
    realtimeSocket?.on("queries:invalidate", handler)

    return () => {
        realtimeSocket?.off("queries:invalidate", handler)
    }
}
