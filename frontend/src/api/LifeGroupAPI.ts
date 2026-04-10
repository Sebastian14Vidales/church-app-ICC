import axios from "axios"
import api from "@/lib/axios"
import {
    createLifeGroupResponseSchema,
    lifeGroupsSchema,
    type LifeGroup,
    type LifeGroupFormData,
} from "@/types/index"

const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
    if (axios.isAxiosError(error)) {
        const responseData = error.response?.data as
            | { message?: string; errors?: Array<{ msg?: string }> }
            | undefined

        if (responseData?.message) {
            return responseData.message
        }

        const firstValidationError = responseData?.errors?.[0]?.msg
        if (firstValidationError) {
            return firstValidationError
        }
    }

    return fallbackMessage
}

export const getMyLifeGroups = async (): Promise<LifeGroup[]> => {
    const { data } = await api.get("/life-groups")
    const response = lifeGroupsSchema.safeParse(data)

    if (response.success) {
        return response.data
    }

    throw new Error("Respuesta de cobertura invalida")
}

export const createLifeGroup = async (formData: LifeGroupFormData) => {
    try {
        const { data } = await api.post("/life-groups", formData)
        const response = createLifeGroupResponseSchema.safeParse(data)

        if (response.success) {
            return response.data
        }

        throw new Error("Respuesta de creacion de grupo invalida")
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo crear el grupo de vida"))
    }
}
