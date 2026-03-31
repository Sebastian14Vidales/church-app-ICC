import { useEffect, useState } from "react";
import { Button, Progress } from "@heroui/react";
import {
    Award,
    Calendar,
    Church,
    Heart,
    HeartPulse,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Plus,
    Trash2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { showSweetAlert } from "@/components/alert/SweetAlert";
import MemberFilters, { type MemberFiltersValue } from "@/components/dashboard/MemberFilters";
import ModalView from "@/components/dashboard/ModalView";
import MemberForm from "@/components/dashboard/MemberForm";
import {
    createMember,
    deleteMember,
    getAllMembers,
    updateMember,
} from "@/api/MemberAPI";
import {
    spiritualGrowthStageSchema,
    type Member,
    type MemberFormData,
    type SpiritualGrowthStage,
} from "@/types/index";
import { roleColors, roleLabels } from "@/utils/constants/roleColors";
import { formatFullName, normalizeSearchText } from "@/utils/text";

const SPIRITUAL_GROWTH_STAGES = spiritualGrowthStageSchema.options as SpiritualGrowthStage[];

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
};

const initialFilters: MemberFiltersValue = {
    baptized: "",
    bloodType: "",
    searchTerm: "",
};

const getGrowthProgress = (stage?: SpiritualGrowthStage) => {
    if (!stage) return 0;

    const stageIndex = SPIRITUAL_GROWTH_STAGES.indexOf(stage);
    if (stageIndex === -1) return 0;

    return Math.round(((stageIndex + 1) / SPIRITUAL_GROWTH_STAGES.length) * 100);
};

const memberToFormData = (member: Member): MemberFormData => ({
    firstName: member.firstName,
    lastName: member.lastName,
    documentID: member.documentID,
    birthdate: member.birthdate.split("T")[0] ?? member.birthdate,
    neighborhood: member.neighborhood,
    phoneNumber: member.phoneNumber,
    bloodType: member.bloodType,
    baptized:
        typeof member.baptized === "boolean" ? (String(member.baptized) as "true" | "false") : "",
    servesInMinistry:
        typeof member.servesInMinistry === "boolean"
            ? (String(member.servesInMinistry) as "true" | "false")
            : "",
    ministry: member.servesInMinistry ? member.ministry ?? "" : "",
    ministryInterest: member.servesInMinistry === false ? member.ministryInterest ?? "" : "",
    spiritualGrowthStage: member.spiritualGrowthStage ?? "",
    roleName: member.role.name as MemberFormData["roleName"],
    email: member.user?.email ?? "",
});

export default function Members() {
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [filters, setFilters] = useState<MemberFiltersValue>(initialFilters);
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

    const filteredMembers = members.filter((member) => {
        const normalizedSearchTerm = normalizeSearchText(filters.searchTerm);
        const matchesSearch =
            !normalizedSearchTerm ||
            normalizeSearchText(`${member.firstName} ${member.lastName}`).includes(normalizedSearchTerm) ||
            member.documentID.includes(filters.searchTerm.trim());
        const matchesBloodType = !filters.bloodType || member.bloodType === filters.bloodType;
        const matchesBaptized =
            !filters.baptized || String(Boolean(member.baptized)) === filters.baptized;

        return matchesSearch && matchesBloodType && matchesBaptized;
    });

    const handleClose = () => {
        setShowMemberModal(false);
        setEditingMember(null);
        reset(initialValues);
    };

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

    const updateMutation = useMutation({
        mutationFn: ({ memberId, formData }: { memberId: string; formData: MemberFormData }) =>
            updateMember(memberId, formData),
        onSuccess: () => {
            toast.success("Miembro actualizado correctamente");
            queryClient.invalidateQueries({ queryKey: ["members"] });
            handleClose();
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteMember,
        onSuccess: (message) => {
            toast.success(message);
            queryClient.invalidateQueries({ queryKey: ["members"] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    useEffect(() => {
        const rolesWithAccess = ["Admin", "Superadmin", "Profesor", "Pastor"];

        if (!rolesWithAccess.includes(selectedRole)) {
            setValue("email", "");
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

    const handleCreateMember = () => {
        setEditingMember(null);
        reset(initialValues);
        setShowMemberModal(true);
    };

    const handleEditMember = (member: Member) => {
        setEditingMember(member);
        reset(memberToFormData(member));
        setShowMemberModal(true);
    };

    const handleDeleteMember = (member: Member) => {
        showSweetAlert({
            title: "Eliminar miembro?",
            text: `Se eliminara el registro de ${formatFullName(member.firstName, member.lastName)}. Esta accion no se puede deshacer.`,
            type: "warning",
            confirmButtonText: "Si, eliminar",
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            onConfirm: async () => {
                try {
                    await deleteMutation.mutateAsync(member._id);
                } catch {
                    // Los errores ya se manejan en la mutacion
                }
            },
        });
    };

    const onSubmit = async (formData: MemberFormData) => {
        try {
            if (editingMember) {
                await updateMutation.mutateAsync({ memberId: editingMember._id, formData });
                return;
            }

            await createMutation.mutateAsync(formData);
        } catch {
            // Los errores ya se manejan en las mutaciones
        }
    };

    const isSubmitting = createMutation.isPending || updateMutation.isPending;
    const hasActiveFilters = Boolean(filters.searchTerm || filters.bloodType || filters.baptized);

    if (isLoading) return <h1>Cargando miembros...</h1>;

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestion de Miembros</h1>
                    <p className="text-gray-600">Administra los miembros y roles de la iglesia</p>
                </div>
                <Button
                    onPress={handleCreateMember}
                    className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                >
                    <Plus className="mr-2 h-5 w-5" />
                    Nuevo Miembro
                </Button>
            </div>

            <MemberFilters
                filters={filters}
                onChange={setFilters}
                onClear={() => setFilters(initialFilters)}
            />

            <h2 className="mb-4 mt-6 text-2xl font-bold">
                {filteredMembers.length
                    ? `Miembros registrados (${filteredMembers.length}${hasActiveFilters ? ` de ${members.length}` : ""})`
                    : hasActiveFilters
                      ? "No hay miembros que coincidan con el filtro"
                      : "No hay miembros registrados"}
            </h2>

            <ModalView
                isOpen={showMemberModal}
                onClose={handleClose}
                title={editingMember ? "Editar miembro" : "Crear miembro"}
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
                        value={
                            isSubmitting
                                ? editingMember
                                    ? "Guardando..."
                                    : "Creando..."
                                : editingMember
                                  ? "Guardar cambios"
                                  : "Crear miembro"
                        }
                        disabled={isSubmitting}
                        className="my-6 w-full cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 text-center text-sm font-bold uppercase text-white hover:bg-blue-700 disabled:bg-blue-300"
                    />
                </form>
            </ModalView>

            {filteredMembers.length ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                    {filteredMembers.map((member) => (
                        <div
                            key={member._id}
                            className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70"
                        >
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="mb-3 flex flex-wrap items-center gap-2">
                                        <h3 className="text-lg font-semibold">
                                            {formatFullName(member.firstName, member.lastName)}
                                        </h3>
                                        <p
                                            className={`inline-block rounded-full px-2 py-0.5 text-xs ${roleColors[member.role.name as keyof typeof roleColors] ?? "bg-gray-100 text-gray-800"}`}
                                        >
                                            {roleLabels[member.role.name as keyof typeof roleLabels] ?? member.role.name}
                                        </p>
                                    </div>
                                    <div className="flex min-h-5 items-center gap-2 text-sm text-gray-500">
                                        <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                                        {member.user?.email ? (
                                            <span className="truncate">{member.user.email}</span>
                                        ) : (
                                            <span className="truncate italic text-gray-400">Sin correo registrado</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex shrink-0 gap-2">
                                    <Button isIconOnly color="primary" variant="flat" onPress={() => handleEditMember(member)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button isIconOnly color="danger" variant="flat" onPress={() => handleDeleteMember(member)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {member.documentID && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <span className="mr-2 text-gray-400">CC:</span>
                                        <span>{member.documentID}</span>
                                    </div>
                                )}

                                {member.phoneNumber && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Phone className="mr-2 h-4 w-4 text-gray-400" />
                                        <span>{member.phoneNumber}</span>
                                    </div>
                                )}

                                {member.neighborhood && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <MapPin className="mr-2 h-4 w-4 text-gray-400" />
                                        <span>{member.neighborhood}</span>
                                    </div>
                                )}

                                {member.birthdate && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                                        <span>
                                            Fecha de nacimiento:{" "}
                                            {new Date(member.birthdate).toLocaleDateString("es-ES")}
                                        </span>
                                    </div>
                                )}

                                {member.bloodType && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <HeartPulse className="mr-2 h-4 w-4 text-gray-400" />
                                        <span>Tipo de sangre: {member.bloodType}</span>
                                    </div>
                                )}

                                <div className="flex items-center text-sm text-gray-600">
                                    <Church className="mr-2 h-4 w-4 text-gray-400" />
                                    <span>Bautizado: {member.baptized ? "Si" : "No"}</span>
                                </div>
                            </div>

                            <div className="mt-4 flex-1">
                                <div className="mb-1 flex items-center justify-between text-sm">
                                    <span className="font-medium text-gray-700">Crecimiento espiritual</span>
                                    <span className="text-gray-500">
                                        {member.spiritualGrowthStage ?? "Sin definir"} -{" "}
                                        <span className="text-sm font-semibold text-blue-600">
                                            {getGrowthProgress(member.spiritualGrowthStage)}%
                                        </span>
                                    </span>
                                </div>

                                <Progress
                                    aria-label="Progreso de crecimiento espiritual"
                                    value={getGrowthProgress(member.spiritualGrowthStage)}
                                    color="primary"
                                    radius="sm"
                                    className="w-full"
                                />

                                {member.servesInMinistry && member.ministry && (
                                    <div className="mt-2 rounded-lg bg-green-100 p-3">
                                        <div className="flex items-center">
                                            <Award className="mr-2 h-4 w-4 text-green-600" />
                                            <span className="text-sm font-medium text-green-800">Sirve en:</span>
                                        </div>
                                        <p className="mt-1 text-sm text-green-700">{member.ministry}</p>
                                    </div>
                                )}

                                {!member.servesInMinistry && member.ministryInterest && (
                                    <div className="mt-2 rounded-lg bg-yellow-100 p-3">
                                        <div className="flex items-center">
                                            <Heart className="mr-2 h-4 w-4 text-red-600" />
                                            <span className="text-sm font-medium text-yellow-800">Interesado en:</span>
                                        </div>
                                        <p className="mt-1 text-sm text-yellow-700">{member.ministryInterest}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
