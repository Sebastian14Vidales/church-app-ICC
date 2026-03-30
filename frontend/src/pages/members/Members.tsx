import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import ModalView from "@/components/dashboard/ModalView";
import MemberForm from "@/components/dashboard/MemberForm";
import { createMember, getAllMembers } from "@/api/MemberAPI";
import { type Member, type MemberFormData, type SpiritualGrowthStage } from "@/types/index";

const SPIRITUAL_GROWTH_STAGES: SpiritualGrowthStage[] = [
    "Consolidación",
    "Discipulado básico",
    "Carácter cristiano",
    "Sanidad y propósito",
    "Cosmovisión bíblica",
    "Doctrina cristiana",
];

const getGrowthProgress = (stage?: SpiritualGrowthStage) => {
    if (!stage) return 0;
    const stageIndex = SPIRITUAL_GROWTH_STAGES.indexOf(stage);
    if (stageIndex === -1) return 0;
    return Math.round(((stageIndex + 1) / SPIRITUAL_GROWTH_STAGES.length) * 100);
};

const getMinistryText = (member: Member) => {
    if (member.ministry) {
        return `Sirve en: ${member.ministry}`;
    }

    if (member.ministryInterest) {
        return `Interesado en servir en: ${member.ministryInterest}`;
    }

    if (member.servesInMinistry) {
        return "Sirve en ministerio";
    }

    return "Aún no registra ministerio de interés";
};

const initialValues: MemberFormData = {
    firstName: "",
    lastName: "",
    documentID: "",
    birthdate: "",
    neighborhood: "",
    phoneNumber: "",
    bloodType: "",
    baptized: "",
    servesInMinistry: "",
    ministry: "",
    ministryInterest: "",
    spiritualGrowthStage: "",
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
    const servesInMinistry = watch("servesInMinistry");

    const { data: members = [], isLoading } = useQuery({
        queryKey: ["members"],
        queryFn: getAllMembers,
    });

    const createMutation = useMutation({
        mutationFn: createMember,
        onSuccess: (data) => {
            toast.success(data.message);
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

    useEffect(() => {
        if (servesInMinistry === "true") {
            setValue("ministryInterest", "");
        }

        if (servesInMinistry === "false") {
            setValue("ministry", "");
        }
    }, [servesInMinistry, setValue]);

    const onSubmit = async (formData: MemberFormData) => {
        await createMutation.mutateAsync(formData);
    };

    if (isLoading) return <h1>Cargando miembros...</h1>;

    return (
        <div>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Miembros</h1>
                    <p className="text-gray-600">Administra los miembros y roles de la iglesia</p>
                </div>
                <Button
                    onPress={() => setShowCreateModal(true)}
                    className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                >
                    <Plus className="mr-2 h-5 w-5" />
                    Nuevo Miembro
                </Button>
            </div>

            <h2 className="mb-4 mt-6 text-2xl font-bold">
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
                        className="my-6 w-full cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 text-center text-sm font-bold uppercase text-white hover:bg-blue-700 disabled:bg-blue-300"
                    />
                </form>
            </ModalView>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {members.map((member) => (
                    <div key={member._id} className="rounded-lg border p-4 shadow-sm">
                        <h3 className="text-lg font-semibold">{member.firstName} {member.lastName}</h3>
                        <p className="text-gray-600">Rol: {member.role.name}</p>
                        <p className="text-gray-600">Documento: {member.documentID}</p>
                        <p className="text-gray-600">Teléfono: {member.phoneNumber}</p>
                        <p className="text-gray-600">Bautizado: {member.baptized ? "Sí" : "No"}</p>
                        <p className="text-gray-600">{getMinistryText(member)}</p>

                        <div className="mt-4">
                            <div className="mb-1 flex items-center justify-between text-sm">
                                <span className="font-medium text-gray-700">Crecimiento espiritual</span>
                                <span className="text-gray-500">
                                    {member.spiritualGrowthStage ?? "Sin definir"}
                                </span>
                            </div>
                            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                                <div
                                    className="h-full rounded-full bg-blue-600 transition-all"
                                    style={{ width: `${getGrowthProgress(member.spiritualGrowthStage)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
