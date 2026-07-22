import axios from "axios"

const api = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL,
});

let authToken: string | null = null
let unauthorizedHandler: (() => void) | null = null

export const setAuthToken = (token: string | null) => {
    authToken = token
}

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
    unauthorizedHandler = handler
}

api.interceptors.request.use((config) => {
    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`
    }

    return config
})

// Política de cierre de sesión automático:
//   - 401 (no autenticado): el handler dispara logout, la sesión expiró.
//   - 403 (prohibido): NO dispara logout aquí; se interpreta como falta de
//     permisos y se gestiona en la UI (React Query muestra el error). El
//     bootstrap de auth (/auth/me) sí trata 401/403 como sesión inválida y
//     cierra sesión.
//   - 429 / 5xx / error de red (sin `response`): transitorios, NO cierran
//     sesión; se propagan para que la capa de queries reintente/muestre.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && unauthorizedHandler) {
            unauthorizedHandler()
        }

        return Promise.reject(error)
    },
)

export default api;
