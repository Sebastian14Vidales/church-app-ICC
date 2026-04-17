import axios from "axios";
import api from "@/lib/axios";
import {
    createMemberResponseSchema,
    memberSchema,
    membersSchema,
    messageResponseSchema,
    rolesSchema,
    type Member,
    type MemberFormData,
    type Role,
} from "@/types/index";

const parseOptionalBoolean = (value: MemberFormData["baptized"]) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return undefined;
};

const buildMemberPayload = (formData: MemberFormData) => {
    const baptized = parseOptionalBoolean(formData.baptized);
    const servesInMinistry = parseOptionalBoolean(formData.servesInMinistry);
    const selectedRoles = Array.from(
        new Set<string>([
            ...(formData.roleNames || []),
        ]),
    );

    return {
        ...formData,
        roleNames: selectedRoles,
        baptized,
        servesInMinistry,
        ministry: servesInMinistry === true ? formData.ministry || undefined : undefined,
        ministryInterest: servesInMinistry === false ? formData.ministryInterest || undefined : undefined,
        spiritualGrowthStage: formData.spiritualGrowthStage || undefined,
        email: formData.email || undefined,
    };
};

const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
    if (axios.isAxiosError(error)) {
        const responseData = error.response?.data as
            | { message?: string; errors?: Array<{ msg?: string }> }
            | undefined;

        if (responseData?.message) {
            return responseData.message;
        }

        const firstValidationError = responseData?.errors?.[0]?.msg;
        if (firstValidationError) {
            return firstValidationError;
        }
    }

    return fallbackMessage;
};

export const createMember = async (formData: MemberFormData) => {
    try {
        const { data } = await api.post("/members", buildMemberPayload(formData));
        const response = createMemberResponseSchema.safeParse(data);

        if (response.success) {
            return response.data;
        }

        throw new Error("Respuesta de creacion de miembro invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo crear el miembro"));
    }
};

export const getAllMembers = async (): Promise<Member[]> => {
    const { data } = await api.get("/members");
    const response = membersSchema.safeParse(data);

    if (response.success) {
        return response.data;
    }

    throw new Error("Respuesta de miembros invalida");
};

export const updateMember = async (
    memberId: Member["_id"],
    formData: MemberFormData,
): Promise<Member> => {
    try {
        const { data } = await api.put(`/members/${memberId}`, buildMemberPayload(formData));
        const response = memberSchema.safeParse(data);

        if (response.success) {
            return response.data;
        }

        throw new Error("Respuesta de actualizacion de miembro invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo actualizar el miembro"));
    }
};

export const deleteMember = async (memberId: Member["_id"]): Promise<string> => {
    try {
        const { data } = await api.delete(`/members/${memberId}`);
        const response = messageResponseSchema.safeParse(data);

        if (response.success) {
            return response.data.message;
        }

        throw new Error("Respuesta de eliminacion de miembro invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo eliminar el miembro"));
    }
};

export const getAllRoles = async (): Promise<Role[]> => {
    const { data } = await api.get("/roles");
    const response = rolesSchema.safeParse(data);

    if (response.success) {
        return response.data;
    }

    throw new Error("Respuesta de roles invalida");
};
