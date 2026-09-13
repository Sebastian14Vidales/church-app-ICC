import { useEffect, useState } from "react";
import { Button, Progress } from "@heroui/react";
import {
    Award,
    Briefcase,
    Calendar,
    CheckCircle2,
    Church,
    FileSpreadsheet,
    FileUp,
    Heart,
    HeartPulse,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Plus,
    Trash2,
    XCircle,
} from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useAuth } from "@/hooks/useAuth";
import { showSweetAlert } from "@/components/alert/SweetAlert";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import MemberFilters, { type MemberFiltersValue } from "@/components/dashboard/MemberFilters";
import ModalView from "@/components/dashboard/ModalView";
import MemberForm from "@/components/dashboard/MemberForm";
import {
    bulkImportMembers,
    createMember,
    deleteMember,
    getAllMembers,
    updateMember,
} from "@/api/MemberAPI";
import {
    NO_SPIRITUAL_GROWTH_STAGE,
    spiritualGrowthStageSchema,
    type BulkImportResult,
    type Member,
    type MemberFormData,
    type SpiritualGrowthStage,
    type SpiritualGrowthStageChoice,
} from "@/types/index";
import { roleColors, roleLabels } from "@/utils/constants/roleColors";
import { parseStoredDate } from "@/utils/date";
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
    encounterStage: "",
    roleNames: [],
    profession: "",
    email: "",
};

const initialFilters: MemberFiltersValue = {
    baptized: "",
    bloodType: "",
    searchTerm: "",
    spiritualGrowthStage: "",
    profession: "",
};

const getGrowthProgress = (stage?: SpiritualGrowthStageChoice) => {
    if (!stage) return 0;
    if (stage === NO_SPIRITUAL_GROWTH_STAGE) return 0;

    // Cast seguro: "Ninguna" ya fue filtrada; el resto pertenece a SPIRITUAL_GROWTH_STAGES.
    const stageIndex = SPIRITUAL_GROWTH_STAGES.indexOf(stage as SpiritualGrowthStage);
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
    encounterStage: member.encounterStage ?? "",
    profession: member.profession ?? "",
    roleNames: Array.from(
        new Set<string>(
            [member.role.name, ...(member.user?.roles?.map((role) => role.name) ?? [])].filter(
                (roleName) => roleName !== "Asistente" && roleName !== "Miembro",
            ),
        ),
    ) as MemberFormData["roleNames"],
    email: member.user?.email ?? "",
});

const ELEVATED_ROLES = ["Profesor", "Supervisor", "Pastor"] as const;

const getVisibleRoleNames = (member: Member): string[] => {
    const primaryRoleName = member.role.name;
    const extraRoleNames = Array.from(
        new Set(
            (member.user?.roles?.map((role) => role.name) ?? []).filter(
                (roleName) => roleName !== primaryRoleName,
            ),
        ),
    );
    const totalRoleNames = [primaryRoleName, ...extraRoleNames];
    const hasElevatedRole = totalRoleNames.some((roleName) =>
        ELEVATED_ROLES.some((elevatedRole) => elevatedRole === roleName),
    );
    const hideMiembro = Boolean(member.baptized) && hasElevatedRole;

    return hideMiembro
        ? totalRoleNames.filter((roleName) => roleName !== "Miembro")
        : totalRoleNames;
};

export default function Members() {
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [filters, setFilters] = useState<MemberFiltersValue>(initialFilters);
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canBulkImport = (user?.roles.includes("Admin") || user?.roles.includes("Superadmin")) ?? false;

    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [bulkResult, setBulkResult] = useState<BulkImportResult | null>(null);

    const bulkImportMutation = useMutation({
        mutationFn: bulkImportMembers,
        onSuccess: (result) => {
            toast.success(
                `Importacion completada: ${result.insertedCount} insertados, ${result.failedCount} con error`,
            );
            setBulkResult(result);
            queryClient.invalidateQueries({ queryKey: ["members"] });
        },
        onError: (error: Error) => {
            toast.error(error.message || "No se pudo procesar el archivo");
        },
    });
    const {
        register,
        handleSubmit,
        formState: { errors },
        control,
        reset,
        setValue,
    } = useForm<MemberFormData>({ defaultValues: initialValues });
    const roleNames = useWatch({ control, name: "roleNames" });
    const servesInMinistry = useWatch({ control, name: "servesInMinistry" });
    const baptized = useWatch({ control, name: "baptized" });

    const { data: members = [], isLoading, isError, error } = useQuery({
        queryKey: ["members"],
        queryFn: getAllMembers,
    });

    const filteredMembers = members.filter((member) => {
        const normalizedSearchTerm = normalizeSearchText(filters.searchTerm);
        const matchesSearch =
            !normalizedSearchTerm ||
            normalizeSearchText(`${member.firstName} ${member.lastName}`).includes(normalizedSearchTerm) ||
            member.documentID.includes(filters.searchTerm.trim()) ||
            normalizeSearchText(member.spiritualGrowthStage ?? "").includes(normalizedSearchTerm);
        const matchesBloodType = !filters.bloodType || member.bloodType === filters.bloodType;
        const matchesGrowthStage =
            !filters.spiritualGrowthStage ||
            (filters.spiritualGrowthStage === NO_SPIRITUAL_GROWTH_STAGE
                ? !member.spiritualGrowthStage || member.spiritualGrowthStage === NO_SPIRITUAL_GROWTH_STAGE
                : member.spiritualGrowthStage === filters.spiritualGrowthStage);
        const matchesBaptized =
            !filters.baptized || String(Boolean(member.baptized)) === filters.baptized;
        const matchesProfession =
            !filters.profession ||
            normalizeSearchText(member.profession ?? "").includes(normalizeSearchText(filters.profession));

        return matchesSearch && matchesBloodType && matchesGrowthStage && matchesBaptized && matchesProfession;
    });

    const handleClose = () => {
        setShowMemberModal(false);
        setEditingMember(null);
        reset(initialValues);
    };

    const handleSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        
        setBulkFile(file);
        setBulkResult(null);
    };

    const handleBulkImport = () => {
        if (!bulkFile) {
            toast.error("Selecciona un archivo .xlsx o .csv primero");
            return;
        }
        bulkImportMutation.reset();
        bulkImportMutation.mutate(bulkFile);
    };

    const closeBulkModal = () => {
        setBulkModalOpen(false);
        setBulkFile(null);
        setBulkResult(null);
        bulkImportMutation.reset();
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
        const rolesWithAccess = ["Admin", "Superadmin", "Profesor", "Pastor", "Supervisor", "Lider"];
        const selectedRoles = roleNames || [];

        if (!selectedRoles.some((role) => rolesWithAccess.includes(role))) {
            setValue("email", "");
        }
    }, [roleNames, setValue]);

    useEffect(() => {
        if (servesInMinistry === "true") {
            setValue("ministryInterest", "");
        }

        if (servesInMinistry === "false") {
            setValue("ministry", "");
        }
    }, [servesInMinistry, setValue]);

    useEffect(() => {
        if (baptized === "false" && roleNames.length > 0) {
            setValue("roleNames", []);
            setValue("email", "");
        }
    }, [baptized, roleNames, setValue]);

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
    const hasActiveFilters = Boolean(
        filters.searchTerm || filters.bloodType || filters.baptized || filters.spiritualGrowthStage || filters.profession,
    );

    if (isLoading) return <LoadingSpinner label="Cargando miembros..." className="min-h-[40vh]" />;
    if (isError) return <h1>{error.message}</h1>;

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestion de Miembros</h1>
                    <p className="text-gray-600">Administra los miembros y roles de la iglesia</p>
                </div>
                <div className="flex gap-2">
                    {canBulkImport && (
                        <Button
                            onPress={() => {
                                setBulkFile(null);
                                setBulkResult(null);
                                setBulkModalOpen(true);
                            }}
                            className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-700"
                            startContent={<FileUp className="h-5 w-5" />}
                        >
                            Cargar miembros
                        </Button>
                    )}
                    <Button
                        onPress={handleCreateMember}
                        className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                    >
                        <Plus className="mr-2 h-5 w-5" />
                        Nuevo Miembro
                    </Button>
                </div>
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
                        setValue={setValue}
                    />

                    <Button
                        type="submit"
                        color="primary"
                        isLoading={isSubmitting}
                        className="my-6 w-full text-sm font-bold uppercase"
                    >
                        {editingMember ? "Guardar cambios" : "Crear miembro"}
                    </Button>
                </form>
            </ModalView>

            <ModalView
                isOpen={bulkModalOpen}
                onClose={closeBulkModal}
                title="Cargar miembros desde Excel o CSV"
                size="4xl"
                scrollBehavior="inside"
            >
                {!bulkResult ? (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-3 flex items-center gap-2 text-slate-700">
                                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                                <span className="font-medium">Selecciona un archivo Excel (.xlsx) o CSV (.csv)</span>
                            </div>
                            <input
                                type="file"
                                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/vnd.ms-excel"
                                onChange={handleSelectFile}
                                aria-label="Selecciona archivo .xlsx o .csv"
                                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-semibold hover:file:bg-slate-200"
                            />
                            {bulkFile && (
                                <p className="mt-2 text-sm text-slate-600">
                                    Archivo seleccionado: <span className="font-medium">{bulkFile.name}</span>
                                </p>
                            )}
                        </div>

                        <details className="rounded-lg border border-slate-200 bg-white p-3">
                            <summary className="cursor-pointer text-sm font-medium text-slate-700">
                                Formato esperado del archivo (Excel o CSV)
                            </summary>
                            <p className="mt-2 text-sm text-slate-600">
                                La primera fila debe contener exactamente estas cabeceras:
                            </p>
                            <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
                                <li>Nombre</li>
                                <li>Apellidos</li>
                                <li>Documento</li>
                                <li>Fecha de nacimiento</li>
                                <li>Barrio</li>
                                <li>Telefono</li>
                                <li>Tipo de sangre</li>
                                <li>Sirve en un ministerio</li>
                                <li>Ministerio en el que sirve</li>
                                <li>Ministerio de interes</li>
                                <li>Ruta de crecimiento espiritual</li>
                                <li>Encuentro y Reencuentro</li>
                            </ul>
                        </details>

                        {bulkImportMutation.isError && (
                            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                {bulkImportMutation.error?.message || "No se pudo procesar el archivo"}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                onPress={closeBulkModal}
                                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onPress={handleBulkImport}
                                isLoading={bulkImportMutation.isPending}
                                isDisabled={!bulkFile || bulkImportMutation.isPending}
                                className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <FileUp className="mr-2 h-4 w-4" />
                                Importar
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                                <p className="text-xs text-slate-500">Total</p>
                                <p className="text-2xl font-bold text-slate-800">{bulkResult.total}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                                <p className="text-xs text-emerald-700">Insertados</p>
                                <p className="text-2xl font-bold text-emerald-700">{bulkResult.insertedCount}</p>
                            </div>
                            <div
                                className={`rounded-lg border p-3 text-center ${
                                    bulkResult.failedCount > 0
                                        ? "border-red-200 bg-red-50"
                                        : "border-slate-200 bg-white"
                                }`}
                            >
                                <p className={`text-xs ${bulkResult.failedCount > 0 ? "text-red-700" : "text-slate-500"}`}>
                                    Errores
                                </p>
                                <p
                                    className={`text-2xl font-bold ${
                                        bulkResult.failedCount > 0 ? "text-red-700" : "text-slate-800"
                                    }`}
                                >
                                    {bulkResult.failedCount}
                                </p>
                            </div>
                        </div>

                        {bulkResult.inserted.length > 0 && (
                            <div>
                                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Insertados correctamente
                                </h4>
                                <ul className="max-h-48 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200 bg-white">
                                    {bulkResult.inserted.map((item) => (
                                        <li key={item.row} className="flex items-center justify-between px-3 py-2 text-sm">
                                            <span className="font-medium text-slate-800">
                                                {item.firstName} {item.lastName}
                                            </span>
                                            <span className="text-slate-500">Fila {item.row} · CC {item.documentID}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {bulkResult.errors.length > 0 && (
                            <div>
                                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-700">
                                    <XCircle className="h-4 w-4" />
                                    Errores de importacion
                                </h4>
                                <div className="max-h-64 overflow-auto rounded-lg border border-red-200">
                                    <table className="w-full text-left text-sm">
                                        <thead className="sticky top-0 bg-red-50 text-xs uppercase text-red-800">
                                            <tr>
                                                <th className="px-3 py-2">Fila</th>
                                                <th className="px-3 py-2">Documento</th>
                                                <th className="px-3 py-2">Nombre</th>
                                                <th className="px-3 py-2">Motivo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-red-100 bg-white">
                                            {bulkResult.errors.map((error, index) => (
                                                <tr key={`${error.row}-${index}`}>
                                                    <td className="px-3 py-2 text-slate-600">{error.row}</td>
                                                    <td className="px-3 py-2 text-slate-600">{error.documentID ?? "—"}</td>
                                                    <td className="px-3 py-2 text-slate-600">{error.firstName ?? "—"}</td>
                                                    <td className="px-3 py-2 text-red-700">{error.reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                onPress={() => {
                                    setBulkFile(null);
                                    setBulkResult(null);
                                }}
                                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
                            >
                                Importar otro archivo
                            </Button>
                            <Button
                                onPress={closeBulkModal}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                            >
                                Cerrar
                            </Button>
                        </div>
                    </div>
                )}
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
                                        <div className="flex flex-wrap items-center gap-2">
                                            {getVisibleRoleNames(member).map((roleName) => (
                                                <p
                                                    key={roleName}
                                                    className={`inline-block rounded-full px-2 py-0.5 text-xs ${roleColors[roleName as keyof typeof roleColors] ?? "bg-gray-100 text-gray-800"}`}
                                                >
                                                    {roleLabels[roleName as keyof typeof roleLabels] ?? roleName}
                                                </p>
                                            ))}
                                        </div>
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
                                            {parseStoredDate(member.birthdate).toLocaleDateString("es-ES")}
                                        </span>
                                    </div>
                                )}

                                {member.bloodType && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <HeartPulse className="mr-2 h-4 w-4 text-gray-400" />
                                        <span>Tipo de sangre: {member.bloodType}</span>
                                    </div>
                                )}

                                {member.profession && (
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Briefcase className="mr-2 h-4 w-4 text-gray-400" />
                                        <span>Profesion: {member.profession}</span>
                                    </div>
                                )}

                                <div className="flex items-center text-sm text-gray-600">
                                    <Church className="mr-2 h-4 w-4 text-gray-400" />
                                    <span>Bautizado: {member.baptized ? "Si" : "No"}</span>
                                </div>

                                <div className="flex items-center text-sm text-gray-600">
                                    <Church className="mr-2 h-4 w-4 text-gray-400" />
                                    <span>Encuentro/Reencuentro: {member.encounterStage ?? "Sin definir"}</span>
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
