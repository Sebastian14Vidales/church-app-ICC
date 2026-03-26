import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import ModalView from "@/components/dashboard/ModalView";
import MemberForm from "@/components/dashboard/MemberForm";
import { createMember, getAllMembers } from "@/api/MemberAPI";
import { type MemberFormData } from "@/types/index";

const initialValues: MemberFormData = {
    firstName: "",
    lastName: "",
    documentID: "",
    birthdate: "",
    neighborhood: "",
    phoneNumber: "",
    bloodType: "",
    roleName: "",
    email: "",
    password: "",
};

export default function Members() {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const queryClient = useQueryClient();
    const {
        register,
        handleSubmit,
        formState: { errors },
        control,
        reset,
        watch,
        setValue,
    } = useForm<MemberFormData>({ defaultValues: initialValues });
    const selectedRole = watch("roleName");

    const { data: members = [], isLoading } = useQuery({
        queryKey: ["members"],
        queryFn: getAllMembers,
    });

    const createMutation = useMutation({
        mutationFn: createMember,
        onSuccess: (data) => {
            toast.success(data.message);
            // if (data.accessUserCreated && data.temporaryPassword) {
            //     toast.info(`Contraseña temporal: ${data.temporaryPassword}`);
            // }
            queryClient.invalidateQueries({ queryKey: ["members"] });
            handleClose();
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    const handleClose = () => {
        setShowCreateModal(false);
        reset(initialValues);
    };

    useEffect(() => {
        const rolesWithAccess = ["Admin", "Superadmin", "Profesor", "Pastor"];

        if (!rolesWithAccess.includes(selectedRole)) {
            setValue("email", "");
            setValue("password", "");
        }
    }, [selectedRole, setValue]);

    const onSubmit = async (formData: MemberFormData) => {
        await createMutation.mutateAsync(formData);
    };

    if (isLoading) return <h1>Cargando miembros...</h1>;

    return (
        <div>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Miembros</h1>
                    <p className="text-gray-600">Administra los miembros y roles de la iglesia</p>
                </div>
                <Button
                    onPress={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="h-5 w-5 mr-2" />
                    Nuevo Miembro
                </Button>
            </div>

            <h2 className="mt-6 mb-4 text-2xl font-bold">
                {members.length ? `Miembros registrados (${members.length})` : "No hay miembros registrados"}
            </h2>

            <ModalView
                isOpen={showCreateModal}
                onClose={handleClose}
                title="Crear miembro"
            >
                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                    <MemberForm
                        register={register}
                        errors={errors}
                        control={control}
                        selectedRole={selectedRole}
                    />

                    <input
                        type="submit"
                        value={createMutation.isPending ? "Creando..." : "Crear Miembro"}
                        disabled={createMutation.isPending}
                        className="text-white my-6 w-full uppercase font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 cursor-pointer rounded-lg text-sm px-5 py-2.5 text-center"
                    />
                </form>
            </ModalView>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {members.map((member) => (
                    <div key={member._id} className="border rounded-lg p-4 shadow-sm">
                        <h3 className="text-lg font-semibold">{member.firstName} {member.lastName}</h3>
                        <p className="text-gray-600">Rol: {member.role.name}</p>
                        <p className="text-gray-600">Documento: {member.documentID}</p>
                        <p className="text-gray-600">Teléfono: {member.phoneNumber}</p>

                    </div>
                ))}
            </div>
        </div>
    )
}
