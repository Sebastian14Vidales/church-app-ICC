import api from "@/lib/axios";
import {
    createMemberResponseSchema,
    membersSchema,
    rolesSchema,
    type Member,
    type MemberFormData,
    type Role,
} from "@/types/index";

export const createMember = async (formData: MemberFormData) => {
    const baptized = formData.baptized === "true";
    const servesInMinistry = formData.servesInMinistry === "true";
    const payload = {
        ...formData,
        baptized,
        servesInMinistry,
        ministry: servesInMinistry ? formData.ministry || undefined : undefined,
        ministryInterest: servesInMinistry ? undefined : formData.ministryInterest || undefined,
        email: formData.email || undefined,
        password: formData.password || undefined,
    };

    const { data } = await api.post("/members", payload);
    const response = createMemberResponseSchema.safeParse(data);

    if (response.success) {
        return response.data;
    }

    throw new Error("Respuesta de creación de miembro inválida");
};

export const getAllMembers = async (): Promise<Member[]> => {
    const { data } = await api.get("/members");
    const response = membersSchema.safeParse(data);

    if (response.success) {
        return response.data;
    }

    throw new Error("Respuesta de miembros inválida");
};

export const getAllRoles = async (): Promise<Role[]> => {
    const { data } = await api.get("/roles");
    const response = rolesSchema.safeParse(data);

    if (response.success) {
        return response.data;
    }

    throw new Error("Respuesta de roles inválida");
};
