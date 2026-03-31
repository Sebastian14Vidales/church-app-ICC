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

    return {
        ...formData,
        baptized,
        servesInMinistry,
        ministry: servesInMinistry === true ? formData.ministry || undefined : undefined,
        ministryInterest: servesInMinistry === false ? formData.ministryInterest || undefined : undefined,
        spiritualGrowthStage: formData.spiritualGrowthStage || undefined,
        email: formData.email || undefined,
        password: formData.password || undefined,
    };
};

export const createMember = async (formData: MemberFormData) => {
    const { data } = await api.post("/members", buildMemberPayload(formData));
    const response = createMemberResponseSchema.safeParse(data);

    if (response.success) {
        return response.data;
    }

    throw new Error("Respuesta de creacion de miembro invalida");
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
    const { data } = await api.put(`/members/${memberId}`, buildMemberPayload(formData));
    const response = memberSchema.safeParse(data);

    if (response.success) {
        return response.data;
    }

    throw new Error("Respuesta de actualizacion de miembro invalida");
};

export const deleteMember = async (memberId: Member["_id"]): Promise<string> => {
    const { data } = await api.delete(`/members/${memberId}`);
    const response = messageResponseSchema.safeParse(data);

    if (response.success) {
        return response.data.message;
    }

    throw new Error("Respuesta de eliminacion de miembro invalida");
};

export const getAllRoles = async (): Promise<Role[]> => {
    const { data } = await api.get("/roles");
    const response = rolesSchema.safeParse(data);

    if (response.success) {
        return response.data;
    }

    throw new Error("Respuesta de roles invalida");
};