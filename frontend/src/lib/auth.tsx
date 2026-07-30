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
import { isAxiosError } from "axios"
import api, { setAuthToken, setUnauthorizedHandler } from "@/lib/axios"
import { authUserSchema, currentSessionResponseSchema, type AuthUser } from "@/types/index"

/**
 * Indica si el error proviene del backend con un status que significa que la
 * sesión es efectivamente inválida (401 no autenticado / 403 prohibido en la
 * validación del propio token). En esos casos SÍ está permitido cerrar la
 * sesión automáticamente.
 */
const isInvalidSessionError = (error: unknown): boolean => {
    if (!isAxiosError(error)) {
        return false
    }
    const status = error.response?.status
    return status === 401 || status === 403
}

/**
 * Indica si el error es transitorio (rate-limit 429, error de servidor 5xx, o
 * fallo de red/timeout sin `response`). Estos errores NO implican sesión
 * inválida: el usuario debe permanecer autenticado y la app reintentará la
 * validación del token en la próxima navegación (React Query mostrará/reintentará
 * el error en la UI activa).
 */
const isTransientError = (error: unknown): boolean => {
    if (!isAxiosError(error)) {
        return false
    }
    if (!error.response) {
        return true
    }
    const status = error.response.status
    return status === 429 || (status >= 500 && status < 600)
}

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

const readStoredToken = () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)

    if (!token || token === "undefined" || token === "null") {
        return null
    }

    return token
}

const readStoredUser = () => {
    const storedUser = localStorage.getItem(AUTH_USER_KEY)

    if (!storedUser) {
        return null
    }

    try {
        return authUserSchema.parse(JSON.parse(storedUser))
    } catch {
        localStorage.removeItem(AUTH_USER_KEY)
        return null
    }
}

const clearStoredSession = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    setAuthToken(null)
}

const persistSession = ({ token, user }: LoginSession) => {
    if (!token || token === "undefined" || token === "null") {
        throw new Error("Token de sesión inválido")
    }

    clearStoredSession()
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    setAuthToken(token)
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
    const bootstrapAbortControllerRef = useRef<AbortController | null>(null)

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
        bootstrapAbortControllerRef.current?.abort()
        startSessionTransition()
        setToken(null)
        setUser(null)
        clearStoredSession()
        queryClient.clear()
        isLoggingOutRef.current = false
    })

    const logout = () => {
        performLogout()
    }

    const login = (session: LoginSession) => {
        // Defensa en profundidad: si ya existe una sesión activa en el
        // almacenamiento compartido (por ejemplo, abierta en otra pestaña),
        // no se permite que la pantalla de login la sobrescriba.
        if (readStoredToken()) {
            return
        }

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

    // Sincronización entre pestañas: cuando el token/usuario cambian en
    // localStorage (login/logout en otra pestaña), este tab adopta o cierra la
    // sesión automáticamente. El evento storage no se dispara en el tab que
    // originó el cambio, por lo que no hay bucles.
    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key !== AUTH_TOKEN_KEY && event.key !== AUTH_USER_KEY && event.key !== null) {
                return
            }

            const newToken = readStoredToken()
            const newUser = readStoredUser()

            if (!newToken) {
                if (token) {
                    performLogout()
                }
                return
            }

            if (newToken !== token) {
                setToken(newToken)
                setAuthToken(newToken)
            }
            if (newUser) {
                setUser(newUser)
            }
        }

        window.addEventListener("storage", handleStorageChange)
        return () => window.removeEventListener("storage", handleStorageChange)
    }, [token, performLogout])

    useEffect(() => {
        const storedToken = readStoredToken()

        if (!storedToken) {
            clearStoredSession()
            setToken(null)
            setUser(null)
            setIsBootstrapping(false)
            return
        }

        setAuthToken(storedToken)
        bootstrapAbortControllerRef.current = new AbortController()
        const { signal } = bootstrapAbortControllerRef.current

        const bootstrapSession = async () => {
            // Validación del token guardado contra /auth/me. Sólo se cierra la
            // sesión cuando el backend declara la sesión inválida (401/403). Ante
            // errores transitorios (429 / 5xx / red) se conserva el token y el
            // usuario en storage y estado, dejando a React Query mostrar/reintentar
            // el error. Se hace un único reintento con backoff para 429/5xx para
            // suavizar caídas momentáneas del backend. Ver AGENTS.md §8 (no logout
            // espurio por errores transitorios).
            const fetchMe = async (attempt: number): Promise<void> => {
                try {
                    const { data } = await api.get("/auth/me", { signal })
                    const response = currentSessionResponseSchema.safeParse(data)

                    if (!response.success) {
                        throw new Error("Sesion invalida")
                    }

                    setToken(storedToken)
                    setUser(response.data.user)
                    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(response.data.user))
                } catch (error) {
                    if (error instanceof Error && error.name === "AbortError") {
                        return
                    }

                    if (isInvalidSessionError(error)) {
                        performLogout()
                        return
                    }

                    if (attempt === 0 && isTransientError(error)) {
                        await new Promise((resolve) => setTimeout(resolve, 800))
                        return fetchMe(attempt + 1)
                    }

                    // Otros errores (incluido un parseo inesperado): no se cierra
                    // sesión para evitar logout espurio; el usuario permanece
                    // autenticado hasta la próxima validación.
                }
            }

            try {
                await fetchMe(0)
            } finally {
                setIsBootstrapping(false)
            }
        }

        bootstrapSession()

        return () => {
            bootstrapAbortControllerRef.current?.abort()
        }
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
