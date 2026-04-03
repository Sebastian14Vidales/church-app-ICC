import axios from "axios";
import api from "@/lib/axios";
import { loginResponseSchema, messageResponseSchema, type AuthUser } from "@/types/index";

type ConfirmAccountPayload = {
    email: string
    token: string
    password: string
}

type LoginPayload = {
    email: string
    password: string
}

const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
    if (axios.isAxiosError(error)) {
        const responseData = error.response?.data as
            | { message?: string; error?: string; errors?: Array<{ msg?: string }> }
            | undefined

        if (responseData?.message) {
            return responseData.message
        }

        if (responseData?.error && typeof responseData.error === "string") {
            return responseData.error
        }

        const firstValidationError = responseData?.errors?.[0]?.msg
        if (firstValidationError) {
            return firstValidationError
        }
    }

    return fallbackMessage
}

export const confirmAccount = async (payload: ConfirmAccountPayload): Promise<string> => {
    try {
        const { data } = await api.post("/auth/confirm-account", payload)
        const response = messageResponseSchema.safeParse(data)

        if (response.success) {
            return response.data.message
        }

        throw new Error("Respuesta de confirmacion invalida")
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo confirmar la cuenta"))
    }
}

export const login = async (payload: LoginPayload): Promise<{ message: string; user: AuthUser }> => {
    try {
        const { data } = await api.post("/auth/login", payload)
        const response = loginResponseSchema.safeParse(data)

        if (response.success) {
            return response.data
        }

        throw new Error("Respuesta de inicio de sesion invalida")
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo iniciar sesion"))
    }
}
