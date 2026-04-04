import axios from "axios";
import api from "@/lib/axios";
import {
    currentSessionResponseSchema,
    loginResponseSchema,
    messageResponseSchema,
    type AuthUser,
} from "@/types/index";

type ConfirmAccountPayload = {
    email?: string
    token: string
    password: string
}

type LoginPayload = {
    email: string
    password: string
}

type ForgotPasswordPayload = {
    email: string
}

type ResendConfirmationPayload = {
    email: string
}

type ResetPasswordPayload = {
    token: string
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

export const forgotPassword = async (payload: ForgotPasswordPayload): Promise<string> => {
    try {
        const { data } = await api.post("/auth/forgot-password", payload)
        const response = messageResponseSchema.safeParse(data)

        if (response.success) {
            return response.data.message
        }

        throw new Error("Respuesta de recuperación inválida")
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo procesar la recuperación"))
    }
}

export const resetPassword = async (payload: ResetPasswordPayload): Promise<string> => {
    try {
        const { data } = await api.post("/auth/reset-password", payload)
        const response = messageResponseSchema.safeParse(data)

        if (response.success) {
            return response.data.message
        }

        throw new Error("Respuesta de cambio de contraseña inválida")
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo actualizar la contraseña"))
    }
}

export const resendConfirmation = async (payload: ResendConfirmationPayload): Promise<string> => {
    try {
        const { data } = await api.post("/auth/resend-confirmation", payload)
        const response = messageResponseSchema.safeParse(data)

        if (response.success) {
            return response.data.message
        }

        throw new Error("Respuesta de reenvio invalida")
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo reenviar la confirmacion"))
    }
}

export const getCurrentSession = async (): Promise<AuthUser> => {
    try {
        const { data } = await api.get("/auth/me")
        const response = currentSessionResponseSchema.safeParse(data)

        if (response.success) {
            return response.data.user
        }

        throw new Error("Respuesta de sesion invalida")
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo validar la sesión"))
    }
}

export const login = async (
    payload: LoginPayload,
): Promise<{ message: string; token: string; user: AuthUser }> => {
    try {
        const { data } = await api.post("/auth/login", payload)
        const response = loginResponseSchema.safeParse(data)

        if (response.success) {
            return response.data
        }

        throw new Error("Respuesta de inicio de sesión inválida")
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo iniciar sesión"))
    }
}
