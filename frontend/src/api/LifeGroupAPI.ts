import axios from "axios"
import api from "@/lib/axios"
import {
    createLifeGroupResponseSchema,
    lifeGroupSessionSchema,
    lifeGroupsSchema,
    type LifeGroup,
    type LifeGroupFormData,
    type SessionFormData,
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

export const updateLifeGroup = async (id: string, formData: Partial<LifeGroupFormData>) => {
    try {
        const { data } = await api.patch(`/life-groups/${id}`, formData)
        const response = createLifeGroupResponseSchema.safeParse(data)

        if (response.success) {
            return response.data
        }

        throw new Error("Respuesta de actualizacion de grupo invalida")
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo actualizar el grupo de vida"))
    }
}

export const updateLifeGroupAttendees = async (lifeGroupId: string, attendeeIds: string[]) => {
    try {
        const { data } = await api.patch(`/life-groups/${lifeGroupId}/attendees`, {
            attendees: attendeeIds,
        })
        const response = createLifeGroupResponseSchema.safeParse(data)

        if (response.success) {
            return response.data
        }

        throw new Error("Respuesta de actualizacion de asistentes invalida")
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo actualizar los asistentes del grupo"))
    }
}

const sessionMutationResponseSchema = createLifeGroupResponseSchema.extend({
    session: lifeGroupSessionSchema,
})

export const addSession = async (lifeGroupId: string, data: SessionFormData) => {
    try {
        const { data: responseData } = await api.post(`/life-groups/${lifeGroupId}/sessions`, data)
        const response = sessionMutationResponseSchema.safeParse(responseData)

        if (response.success) {
            return response.data
        }

        throw new Error("Respuesta de registro de sesion invalida")
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo registrar la sesion"))
    }
}

export const updateSession = async (
    lifeGroupId: string,
    sessionId: string,
    data: Partial<SessionFormData>,
) => {
    try {
        const { data: responseData } = await api.patch(`/life-groups/${lifeGroupId}/sessions/${sessionId}`, data)
        const response = sessionMutationResponseSchema.safeParse(responseData)

        if (response.success) {
            return response.data
        }

        throw new Error("Respuesta de actualizacion de sesion invalida")
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo actualizar la sesion"))
    }
}

export const deleteSession = async (lifeGroupId: string, sessionId: string) => {
    try {
        const { data: responseData } = await api.delete(`/life-groups/${lifeGroupId}/sessions/${sessionId}`)
        const response = createLifeGroupResponseSchema.safeParse(responseData)

        if (response.success) {
            return response.data
        }

        throw new Error("Respuesta de eliminacion de sesion invalida")
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo eliminar la sesion"))
    }
}
