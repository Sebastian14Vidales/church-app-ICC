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
