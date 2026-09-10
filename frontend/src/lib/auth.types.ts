import type { AuthUser } from "@/types/index"

export type LoginSession = {
    token: string
    user: AuthUser
}

export type AuthContextValue = {
    token: string | null
    user: AuthUser | null
    isAuthenticated: boolean
    isBootstrapping: boolean
    isSessionTransitioning: boolean
    login: (session: LoginSession) => void
    logout: () => void
}
