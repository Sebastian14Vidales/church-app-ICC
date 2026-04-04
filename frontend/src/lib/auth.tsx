import {
    createContext,
    useContext,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
    type PropsWithChildren,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import api, { setAuthToken, setUnauthorizedHandler } from "@/lib/axios"
import { authUserSchema, currentSessionResponseSchema, type AuthUser } from "@/types/index"

const AUTH_TOKEN_KEY = "authToken"
const AUTH_USER_KEY = "authUser"

type LoginSession = {
    token: string
    user: AuthUser
}

type AuthContextValue = {
    token: string | null
    user: AuthUser | null
    isAuthenticated: boolean
    isBootstrapping: boolean
    isSessionTransitioning: boolean
    login: (session: LoginSession) => void
    logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const readStoredToken = () => sessionStorage.getItem(AUTH_TOKEN_KEY)

const readStoredUser = () => {
    const storedUser = sessionStorage.getItem(AUTH_USER_KEY)

    if (!storedUser) {
        return null
    }

    try {
        return authUserSchema.parse(JSON.parse(storedUser))
    } catch {
        sessionStorage.removeItem(AUTH_USER_KEY)
        return null
    }
}

const persistSession = ({ token, user }: LoginSession) => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token)
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    setAuthToken(token)
}

const clearSessionStorage = () => {
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    sessionStorage.removeItem(AUTH_USER_KEY)
    setAuthToken(null)
}

export const getInitials = (name: string) =>
    name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")

export function AuthProvider({ children }: PropsWithChildren) {
    const queryClient = useQueryClient()
    const [token, setToken] = useState<string | null>(() => readStoredToken())
    const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())
    const [isBootstrapping, setIsBootstrapping] = useState(true)
    const [isSessionTransitioning, setIsSessionTransitioning] = useState(false)
    const isLoggingOutRef = useRef(false)
    const transitionTimeoutRef = useRef<number | null>(null)

    const startSessionTransition = () => {
        if (transitionTimeoutRef.current) {
            window.clearTimeout(transitionTimeoutRef.current)
        }

        setIsSessionTransitioning(true)
        transitionTimeoutRef.current = window.setTimeout(() => {
            setIsSessionTransitioning(false)
            transitionTimeoutRef.current = null
        }, 450)
    }

    const performLogout = useEffectEvent(() => {
        if (isLoggingOutRef.current) {
            return
        }

        isLoggingOutRef.current = true
        startSessionTransition()
        setToken(null)
        setUser(null)
        clearSessionStorage()
        queryClient.clear()
        isLoggingOutRef.current = false
    })

    const logout = () => {
        performLogout()
    }

    const login = (session: LoginSession) => {
        startSessionTransition()
        persistSession(session)
        setToken(session.token)
        setUser(session.user)
    }

    useEffect(() => {
        return () => {
            if (transitionTimeoutRef.current) {
                window.clearTimeout(transitionTimeoutRef.current)
            }
        }
    }, [])

    useEffect(() => {
        setUnauthorizedHandler(() => {
            performLogout()
        })

        return () => {
            setUnauthorizedHandler(null)
        }
    }, [performLogout])

    useEffect(() => {
        const storedToken = readStoredToken()

        if (!storedToken) {
            clearSessionStorage()
            setToken(null)
            setUser(null)
            setIsBootstrapping(false)
            return
        }

        setAuthToken(storedToken)

        const bootstrapSession = async () => {
            try {
                const { data } = await api.get("/auth/me")
                const response = currentSessionResponseSchema.safeParse(data)

                if (!response.success) {
                    throw new Error("Sesion invalida")
                }

                setToken(storedToken)
                setUser(response.data.user)
                sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(response.data.user))
            } catch {
                performLogout()
            } finally {
                setIsBootstrapping(false)
            }
        }

        bootstrapSession()
    }, [performLogout])

    const value: AuthContextValue = {
        token,
        user,
        isAuthenticated: Boolean(token && user),
        isBootstrapping,
        isSessionTransitioning,
        login,
        logout,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
    const context = useContext(AuthContext)

    if (!context) {
        throw new Error("useAuth debe usarse dentro de AuthProvider")
    }

    return context
}
