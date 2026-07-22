import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Input, Select, SelectItem } from "@heroui/react";
import { BadgePlus, BookOpenCheck, CalendarDays, History, MapPin, NotebookPen, Pencil, Timer, Trash2, UserRound } from "lucide-react";

import ModalView from "@/components/dashboard/ModalView";
import CourseForm from "@/components/dashboard/CourseForm";
import AssignCourseForm from "@/components/dashboard/AssignCourseForm";
import { showSweetAlert } from "@/components/alert/SweetAlert";
import { useAuth } from "@/lib/auth";
import {
    useActiveCourseAssignments,
    useAllCourses,
    useCourseAssignmentDetail,
    useCourseAssignmentHistory,
    useAssignCourse,
    useCreateCourse,
    useReopenCourseAssignment,
    useSoftDeleteCourse,
    useSoftDeleteCourseAssignment,
    useUpdateCourse,
    useUpdateCourseAssignment,
} from "@/hooks/courses";
import {
    COURSE_LEVEL_BADGE_STYLES,
    COURSE_LEVEL_LABELS,
    COURSE_LEVEL_OPTIONS,
    COURSE_STATUS_BADGE_STYLES,
    COURSE_STATUS_LABELS,
} from "@/utils/constants/courses";
import { LOCATIONS, getLocationNameById } from "@/utils/constants/locations";
import { formatFullName } from "@/utils/text";
import type {
    CourseAssignmentCreateBody,
    CourseAssignedCanonical,
    CourseFormData,
    CourseLevel,
} from "@/types/index";

type Tab = "catalog" | "active" | "history";

const TABS: Array<{ id: Tab; label: string }> = [
    { id: "catalog", label: "Catalogo" },
    { id: "active", label: "Asignaciones vigentes" },
    { id: "history", label: "Historial" },
];

const emptyCourseForm: CourseFormData = { name: "", description: "", level: "basic" };

const emptyAssignmentForm: CourseAssignmentCreateBody = {
    course: "",
    professor: "",
    startDate: "",
    startTime: "",
    totalClasses: 1,
    location: "",
    status: "active",
};

const formatDate = (value: string) => new Date(value).toLocaleDateString("es-CO");

export default function Courses() {
    const { user } = useAuth();
    const isSuperadmin = user?.roles.includes("Superadmin") ?? false;

    const [tab, setTab] = useState<Tab>("catalog");
    const [courseModal, setCourseModal] = useState(false);
    const [editingCourse, setEditingCourse] = useState<CourseFormData & { _id?: string } | null>(null);
    const [assignmentModal, setAssignmentModal] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState<CourseAssignedCanonical | null>(null);

    // Catalogo filtros
    const [nameFilter, setNameFilter] = useState("");
    const [levelFilter, setLevelFilter] = useState<CourseLevel | "">("");
    const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
    const [catalogPage, setCatalogPage] = useState(1);
    const catalogQuery = useMemo(
        () => ({
            name: nameFilter.trim() || undefined,
            level: levelFilter || undefined,
            isActive: activeFilter === "active" ? true : activeFilter === "inactive" ? false : undefined,
            page: catalogPage,
            limit: 20,
        }),
        [nameFilter, levelFilter, activeFilter, catalogPage],
    );

    // Historial filtros
    const [historyProfessor, setHistoryProfessor] = useState("");
    const [historyLocation, setHistoryLocation] = useState("");
    const [historyPage, setHistoryPage] = useState(1);
    const historyQuery = useMemo(
        () => ({
            professor: historyProfessor || undefined,
            location: historyLocation || undefined,
            page: historyPage,
            limit: 20,
        }),
        [historyProfessor, historyLocation, historyPage],
    );

    // Detalle expandido para mostrar progreso de sesiones en el tab vigentes
    const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);

    const createMutation = useCreateCourse();
    const updateMutation = useUpdateCourse();
    const deleteCourseMutation = useSoftDeleteCourse();
    const assignMutation = useAssignCourse();
    const updateAssignmentMutation = useUpdateCourseAssignment();
    const deleteAssignmentMutation = useSoftDeleteCourseAssignment();
    const reopenMutation = useReopenCourseAssignment();

    const courseForm = useForm<CourseFormData>({ defaultValues: emptyCourseForm });
    const assignmentForm = useForm<CourseAssignmentCreateBody>({ defaultValues: emptyAssignmentForm });

    const { data: catalogData, isLoading: isLoadingCatalog, isError: isErrorCatalog } =
        useAllCourses(catalogQuery);
    const { data: activeData, isLoading: isLoadingActive, isError: isErrorActive } =
        useActiveCourseAssignments();
    const { data: historyData, isLoading: isLoadingHistory, isError: isErrorHistory } =
        useCourseAssignmentHistory(historyQuery);

    const assignmentDetail = useCourseAssignmentDetail(
        expandedAssignmentId,
        Boolean(expandedAssignmentId),
    );

    const closeAllModals = () => {
        setCourseModal(false);
        setEditingCourse(null);
        courseForm.reset(emptyCourseForm);
        setAssignmentModal(false);
        setEditingAssignment(null);
        assignmentForm.reset(emptyAssignmentForm);
    };

    const openCreateCourse = () => {
        setEditingCourse(null);
        courseForm.reset(emptyCourseForm);
        setCourseModal(true);
    };

    const openEditCourse = (course: { _id: string; name: string; description: string; level: CourseLevel }) => {
        setEditingCourse(course);
        courseForm.reset({ name: course.name, description: course.description, level: course.level });
        setCourseModal(true);
    };

    const handleCourseSubmit = (formData: CourseFormData) => {
        if (editingCourse?._id) {
            updateMutation.mutateAsync(
                { courseId: editingCourse._id, formData },
                { onSuccess: closeAllModals },
            );
        } else {
            createMutation.mutateAsync(formData, { onSuccess: closeAllModals });
        }
    };

    const handleDeleteCourse = (course: { _id: string; name: string }) => {
        showSweetAlert({
            title: "Eliminar curso?",
            text: `Eliminaras "${course.name}". Si tiene asignaciones activas se bloqueara el borrado.`,
            type: "warning",
            confirmButtonText: "Si, eliminar",
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            onConfirm: () => deleteCourseMutation.mutateAsync(course._id),
        });
    };

    const openAssignCourse = () => {
        setEditingAssignment(null);
        assignmentForm.reset(emptyAssignmentForm);
        setAssignmentModal(true);
    };

    const openEditAssignment = (assignment: CourseAssignedCanonical) => {
        setEditingAssignment(assignment);
        assignmentForm.reset({
            course: assignment.course._id,
            professor: assignment.professor._id,
            startDate: assignment.startDate.split("T")[0] ?? assignment.startDate,
            startTime: assignment.startTime,
            totalClasses: assignment.totalClasses,
            location: assignment.location,
            status: assignment.status,
        });
        setAssignmentModal(true);
    };

    const handleAssignmentSubmit = (formData: CourseAssignmentCreateBody) => {
        if (editingAssignment) {
            updateAssignmentMutation.mutateAsync(
                { assignmentId: editingAssignment._id, body: formData },
                { onSuccess: closeAllModals },
            );
        } else {
            assignMutation.mutateAsync(formData, { onSuccess: closeAllModals });
        }
    };

    const handleDeleteAssignment = (assignment: CourseAssignedCanonical) => {
        showSweetAlert({
            title: "Eliminar asignacion?",
            text: `Se eliminara la asignacion de "${assignment.course.name}". Se conservan las sesiones registradas.`,
            type: "warning",
            confirmButtonText: "Si, eliminar",
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            onConfirm: () => deleteAssignmentMutation.mutateAsync(assignment._id),
        });
    };

    const handleReopen = (assignment: CourseAssignedCanonical) => {
        if (!isSuperadmin) return;
        showSweetAlert({
            title: "Reabrir curso?",
            text: `El curso "${assignment.course.name}" volvera a estado activo.`,
            type: "warning",
            confirmButtonText: "Si, reabrir",
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            onConfirm: () => reopenMutation.mutateAsync({ assignmentId: assignment._id }),
        });
    };

    const catalogItems = catalogData?.items ?? [];
    const activeItems = activeData?.items ?? [];
    const historyItems = historyData?.items ?? [];
    const expandedDetail = assignmentDetail.data;
    const completedSessions =
        expandedDetail?.sessions?.filter((session) => Boolean(session.completedAt)).length ?? 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Administracion de cursos</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Catalogo, asignaciones vigentes e historial de cursos completados.
                </p>
            </div>

            {/* Tablist accesible */}
            <div
                role="tablist"
                aria-label="Secciones de cursos"
                className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
            >
                {TABS.map(({ id, label }) => {
                    const selected = tab === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            aria-controls={`tabpanel-${id}`}
                            id={`tab-${id}`}
                            onClick={() => setTab(id)}
                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                selected
                                    ? "bg-blue-600 text-white shadow"
                                    : "text-slate-600 hover:bg-slate-100"
                            }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* ===== Tab Catálogo ===== */}
            <section
                id="tabpanel-catalog"
                role="tabpanel"
                aria-labelledby="tab-catalog"
                hidden={tab !== "catalog"}
                className="space-y-4"
            >
                <div className="flex flex-wrap items-end gap-3">
                    <Input
                        isClearable
                        aria-label="Buscar curso por nombre"
                        placeholder="Buscar por nombre"
                        value={nameFilter}
                        onValueChange={setNameFilter}
                        className="max-w-xs"
                        variant="bordered"
                        onClear={() => setNameFilter("")}
                    />
                    <Select
                        aria-label="Filtrar por nivel"
                        placeholder="Nivel"
                        selectedKeys={levelFilter ? [levelFilter] : []}
                        onSelectionChange={(keys) => setLevelFilter((Array.from(keys)[0] as CourseLevel | "") ?? "")}
                        className="max-w-48"
                        variant="bordered"
                    >
                        {COURSE_LEVEL_OPTIONS.map((option) => (
                            <SelectItem key={option.value}>{option.label}</SelectItem>
                        ))}
                    </Select>
                    <Select
                        aria-label="Filtrar por estado"
                        placeholder="Estado"
                        selectedKeys={[activeFilter]}
                        onSelectionChange={(keys) => setActiveFilter((Array.from(keys)[0] as typeof activeFilter) ?? "all")}
                        className="max-w-48"
                        variant="bordered"
                    >
                        <SelectItem key="all">Todos</SelectItem>
                        <SelectItem key="active">Activos</SelectItem>
                        <SelectItem key="inactive">Inactivos</SelectItem>
                    </Select>
                    <div className="ml-auto">
                        <Button
                            color="primary"
                            className="font-semibold"
                            onPress={openCreateCourse}
                        >
                            <BadgePlus className="size-5" />
                            Crear curso
                        </Button>
                    </div>
                </div>

                {isLoadingCatalog ? (
                    <p className="text-sm text-slate-500">Cargando catalogo...</p>
                ) : isErrorCatalog ? (
                    <p className="text-sm text-rose-600">No se pudo cargar el catalogo.</p>
                ) : catalogItems.length ? (
                    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {catalogItems.map((course) => (
                            <li
                                key={course._id}
                                className="flex h-44 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="text-lg font-bold text-slate-900">{course.name}</h3>
                                        <span
                                            className={`rounded px-2.5 py-0.5 text-xs font-medium ${COURSE_LEVEL_BADGE_STYLES[course.level]}`}
                                        >
                                            {COURSE_LEVEL_LABELS[course.level]}
                                        </span>
                                    </div>
                                    <p className="line-clamp-2 text-sm text-slate-600">{course.description}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                            course.isActive
                                                ? "bg-emerald-100 text-emerald-700"
                                                : "bg-slate-200 text-slate-600"
                                        }`}
                                    >
                                        {course.isActive ? "Activo" : "Inactivo"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        color="primary"
                                        variant="flat"
                                        className="flex-1"
                                        onPress={() => openEditCourse(course)}
                                    >
                                        <Pencil className="size-4" />
                                        Editar
                                    </Button>
                                    <Button
                                        color="danger"
                                        variant="flat"
                                        className="flex-1"
                                        onPress={() => handleDeleteCourse(course)}
                                    >
                                        <Trash2 className="size-4" />
                                        Eliminar
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-slate-500">No hay cursos que coincidan con los filtros.</p>
                )}

                {catalogData && catalogData.total > catalogData.limit ? (
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                            Pagina {catalogData.page} de {Math.max(1, Math.ceil(catalogData.total / catalogData.limit))}
                            ({catalogData.total} cursos)
                        </p>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="flat"
                                isDisabled={catalogData.page <= 1}
                                onPress={() => setCatalogPage((page) => Math.max(1, page - 1))}
                            >
                                Anterior
                            </Button>
                            <Button
                                size="sm"
                                variant="flat"
                                isDisabled={catalogData.page * catalogData.limit >= catalogData.total}
                                onPress={() => setCatalogPage((page) => page + 1)}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                ) : null}
            </section>

            {/* ===== Tab Asignaciones vigentes ===== */}
            <section
                id="tabpanel-active"
                role="tabpanel"
                aria-labelledby="tab-active"
                hidden={tab !== "active"}
                className="space-y-4"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Cursos en marcha</h2>
                    <Button color="primary" className="font-semibold" onPress={openAssignCourse}>
                        <NotebookPen className="size-5" />
                        Asignar curso
                    </Button>
                </div>

                {isLoadingActive ? (
                    <p className="text-sm text-slate-500">Cargando asignaciones...</p>
                ) : isErrorActive ? (
                    <p className="text-sm text-rose-600">No se pudo cargar las asignaciones vigentes.</p>
                ) : activeItems.length ? (
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {activeItems.map((assignment) => {
                            const isExpanded = expandedAssignmentId === assignment._id;
                            return (
                                <article
                                    key={assignment._id}
                                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900">
                                                {assignment.course.name}
                                            </h3>
                                            <p className="text-sm text-slate-500">{assignment.course.description}</p>
                                        </div>
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${COURSE_STATUS_BADGE_STYLES[assignment.status] ?? ""}`}
                                        >
                                            {COURSE_STATUS_LABELS[assignment.status] ?? assignment.status}
                                        </span>
                                    </div>

                                    <div className="mt-4 space-y-2 text-sm text-slate-700">
                                        <p className="flex items-center gap-2">
                                            <UserRound className="h-4 w-4 text-slate-400" />
                                            {formatFullName(assignment.professor.firstName, assignment.professor.lastName)}
                                        </p>
                                        <p className="flex items-center gap-2">
                                            <CalendarDays className="h-4 w-4 text-slate-400" />
                                            {formatDate(assignment.startDate)} a {formatDate(assignment.endDate)}
                                        </p>
                                        <p className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-slate-400" />
                                            {getLocationNameById(assignment.location)}
                                        </p>
                                        <p className="flex items-center gap-2">
                                            <Timer className="h-4 w-4 text-slate-400" />
                                            Hora: {assignment.startTime}
                                        </p>
                                        <p className="flex items-center gap-2">
                                            <BookOpenCheck className="h-4 w-4 text-slate-400" />
                                            Total de clases: {assignment.totalClasses}
                                        </p>
                                        <p className="text-sm text-slate-600">
                                            Miembros registrados: {assignment.members.length}
                                        </p>
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <Button
                                            color="primary"
                                            variant="flat"
                                            onPress={() =>
                                                setExpandedAssignmentId(isExpanded ? null : assignment._id)
                                            }
                                        >
                                            {isExpanded ? "Ocultar sesiones" : "Ver progreso de sesiones"}
                                        </Button>
                                        {isSuperadmin ? (
                                            <>
                                                <Button
                                                    color="primary"
                                                    variant="flat"
                                                    isIconOnly
                                                    aria-label={`Editar asignacion de ${assignment.course.name}`}
                                                    onPress={() => openEditAssignment(assignment)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    color="danger"
                                                    variant="flat"
                                                    isIconOnly
                                                    aria-label={`Eliminar asignacion de ${assignment.course.name}`}
                                                    onPress={() => handleDeleteAssignment(assignment)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        ) : null}
                                    </div>

                                    {isExpanded ? (
                                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            {assignmentDetail.isLoading ? (
                                                <p className="text-sm text-slate-500">Cargando sesiones...</p>
                                            ) : assignmentDetail.isError ? (
                                                <p className="text-sm text-rose-600">
                                                    No se pudo cargar el progreso de sesiones.
                                                </p>
                                            ) : expandedDetail ? (
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        Progreso de sesiones: {completedSessions}/{assignment.totalClasses}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {completedSessions >= assignment.totalClasses
                                                            ? "Listo para cerrar."
                                                            : "Faltan sesiones por registrar."}
                                                    </p>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">No hay cursos vigentes asignados.</p>
                )}
            </section>

            {/* ===== Tab Historial ===== */}
            <section
                id="tabpanel-history"
                role="tabpanel"
                aria-labelledby="tab-history"
                hidden={tab !== "history"}
                className="space-y-4"
            >
                <div className="flex flex-wrap items-end gap-3">
                    <Input
                        isClearable
                        aria-label="Filtrar historial por profesor"
                        placeholder="Id del profesor"
                        value={historyProfessor}
                        onValueChange={(value) => {
                            setHistoryProfessor(value);
                            setHistoryPage(1);
                        }}
                        className="max-w-xs"
                        variant="bordered"
                        onClear={() => setHistoryProfessor("")}
                    />
                    <Select
                        aria-label="Filtrar historial por sede"
                        placeholder="Sede"
                        selectedKeys={historyLocation ? [historyLocation] : []}
                        onSelectionChange={(keys) => {
                            setHistoryLocation((Array.from(keys)[0] as string) ?? "");
                            setHistoryPage(1);
                        }}
                        className="max-w-48"
                        variant="bordered"
                    >
                        {LOCATIONS.map((loc) => (
                            <SelectItem key={loc.id}>{loc.name}</SelectItem>
                        ))}
                    </Select>
                </div>

                <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                        <History className="h-5 w-5" />
                        Cursos completados
                    </h2>
                </div>

                {isLoadingHistory ? (
                    <p className="text-sm text-slate-500">Cargando historial...</p>
                ) : isErrorHistory ? (
                    <p className="text-sm text-rose-600">No se pudo cargar el historial.</p>
                ) : historyItems.length ? (
                    <ul className="space-y-3">
                        {historyItems.map((assignment) => (
                            <li
                                key={assignment._id}
                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900">
                                            {assignment.course.name}
                                        </h3>
                                        <p className="text-sm text-slate-500">
                                            {formatFullName(assignment.professor.firstName, assignment.professor.lastName)} ·{" "}
                                            {formatDate(assignment.startDate)} a {formatDate(assignment.endDate)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${COURSE_STATUS_BADGE_STYLES[assignment.status] ?? ""}`}
                                        >
                                            {COURSE_STATUS_LABELS[assignment.status] ?? assignment.status}
                                        </span>
                                        {isSuperadmin ? (
                                            <Button
                                                color="warning"
                                                variant="flat"
                                                onPress={() => handleReopen(assignment)}
                                            >
                                                Reabrir
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-slate-500">No hay cursos completados registrados.</p>
                )}
            </section>

            {/* ===== Modales ===== */}
            <ModalView
                isOpen={courseModal}
                onClose={closeAllModals}
                title={editingCourse ? "Editar curso" : "Crear curso"}
            >
                <form onSubmit={courseForm.handleSubmit(handleCourseSubmit)} noValidate>
                    <CourseForm
                        register={courseForm.register}
                        errors={courseForm.formState.errors}
                        control={courseForm.control}
                    />
                    <Button
                        type="submit"
                        color="primary"
                        className="my-6 w-full text-sm font-bold uppercase"
                        isLoading={createMutation.isPending || updateMutation.isPending}
                    >
                        {editingCourse ? "Guardar cambios" : "Crear curso"}
                    </Button>
                </form>
            </ModalView>

            <ModalView
                isOpen={assignmentModal}
                onClose={closeAllModals}
                title={editingAssignment ? "Editar asignacion" : "Asignar curso"}
                size="2xl"
            >
                <form
                    onSubmit={assignmentForm.handleSubmit(handleAssignmentSubmit)}
                    noValidate
                >
                    <AssignCourseForm
                        control={assignmentForm.control}
                        errors={assignmentForm.formState.errors}
                        setValue={assignmentForm.setValue}
                        currentAssignmentId={editingAssignment?._id ?? null}
                    />
                    <Button
                        type="submit"
                        color="primary"
                        className="my-6 w-full text-sm font-bold uppercase"
                        isLoading={assignMutation.isPending || updateAssignmentMutation.isPending}
                    >
                        {editingAssignment ? "Guardar cambios" : "Asignar curso"}
                    </Button>
                </form>
            </ModalView>
        </div>
    );
}

// Helper local para reapertura definido dentro del componente (handleReopen);
// nada fuera del componente default export.