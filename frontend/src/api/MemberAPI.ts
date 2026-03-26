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
    const payload = {
        ...formData,
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
