import { useEffect, useState } from "react";
import { Button, Progress } from "@heroui/react";
import { Award, Calendar, Heart, MapPin, Phone, Plus, HeartPulse, Church } from "lucide-react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import ModalView from "@/components/dashboard/ModalView";
import MemberForm from "@/components/dashboard/MemberForm";
import { createMember, getAllMembers } from "@/api/MemberAPI";
import { type MemberFormData, type SpiritualGrowthStage } from "@/types/index";
import {roleColors, roleLabels} from "@/utils/constants/roleColors";


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
                size="2xl"
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

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {members.map((member) => (
                    <div key={member._id} className="rounded-lg border p-4 shadow-sm">
                        <div className="mb-3 flex gap-3">
                            <h3 className="text-lg font-semibold">{member.firstName} {member.lastName}</h3>
                            <p className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs ${roleColors[member.role.name as keyof typeof roleColors] ?? "bg-gray-100 text-gray-800"}`}>
                                {roleLabels[member.role.name as keyof typeof roleLabels] ?? member.role.name}
                            </p>
                        </div>


                        {member.documentID && (
                            <div className="flex items-center text-sm text-gray-600">
                                <span className="text-gray-400 mr-2">CC:</span>
                                <span>{member.documentID}</span>
                            </div>
                        )}

                        {member.phoneNumber && (
                            <div className="flex items-center text-sm text-gray-600">
                                <Phone className="h-4 w-4 mr-2 text-gray-400" />
                                <span>{member.phoneNumber}</span>
                            </div>
                        )}

                        {member.neighborhood && (
                            <div className="flex items-center text-sm text-gray-600">
                                <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                                <span>{member.neighborhood}</span>
                            </div>
                        )}
                        {member.birthdate && (
                            <div className="flex items-center text-sm text-gray-600">
                                <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                                <span>Fecha de nacimiento: {new Date(member.birthdate).toLocaleDateString('es-ES')}</span>
                            </div>
                        )}
                        
                        {member.bloodType && (
                            <div className="flex items-center text-sm text-gray-600">
                                <HeartPulse className="h-4 w-4 mr-2 text-gray-400" />
                                <span>Tipo de sangre: {member.bloodType}</span>
                            </div>
                        )}

                            <div className="flex items-center text-sm text-gray-600">
                                <Church className="h-4 w-4 mr-2 text-gray-400" />
                                <span>Bautizado: {member.baptized ? "Sí" : "No"}</span>
                            </div>
                        
                        

                        <div className="mt-4">
                            <div className="mb-1 flex items-center justify-between text-sm">
                                <span className="font-medium text-gray-700">Crecimiento espiritual</span>
                                <span className="text-gray-500">
                                    {member.spiritualGrowthStage ?? "Sin definir"} - <span className="text-sm font-semibold text-blue-600">
                                        {getGrowthProgress(member.spiritualGrowthStage)}%
                                    </span>
                                </span>
                            </div>

                            <div className="mb-2 flex justify-end">

                            </div>

                            <Progress
                                aria-label="Progreso de crecimiento espiritual"
                                value={getGrowthProgress(member.spiritualGrowthStage)}
                                color="primary"
                                radius="sm"
                                className="w-full"
                            />

                            {member.servesInMinistry && member.ministry && (
                                <div className="mt-2 p-3 bg-green-100 rounded-lg">
                                    <div className="flex items-center">
                                        <Award className="h-4 w-4 text-green-600 mr-2" />
                                        <span className="text-sm font-medium text-green-800">Sirve en:</span>
                                    </div>
                                    <p className="text-sm text-green-700 mt-1">
                                        {member.ministry}
                                    </p>
                                </div>
                            )}

                            {!member.servesInMinistry && member.ministryInterest && (
                                <div className="mt-2 p-3 bg-yellow-100 rounded-lg">
                                    <div className="flex items-center">
                                        <Heart className="h-4 w-4 text-red-600 mr-2" />
                                        <span className="text-sm font-medium text-yellow-800">Interesado en:</span>
                                    </div>
                                    <p className="text-sm text-yellow-700 mt-1">
                                        {member.ministryInterest}
                                    </p>
                                </div>
                            )}

                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
