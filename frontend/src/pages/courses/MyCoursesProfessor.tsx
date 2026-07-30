import { useMemo, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Checkbox, Input } from "@heroui/react";
import { BookOpen, CalendarDays, ClipboardCheck, Clock3, GraduationCap, MapPin, Search, Trophy } from "lucide-react";

import LoadingSpinner from "@/components/common/LoadingSpinner";
import ModalView from "@/components/dashboard/ModalView";
import { showSweetAlert } from "@/components/alert/SweetAlert";
import {
    useCloseCourseAssignment,
    useCourseAssignmentDetail,
    useMyActiveCourseAssignments,
    useMyAttendanceOverview,
    useMyCourseAssignmentHistory,
    useUpdateCourseMembers,
} from "@/hooks/courses";
import { getAllMembers } from "@/api/MemberAPI";
import { useQuery } from "@tanstack/react-query";
import { COURSE_LEVEL_LABELS } from "@/utils/constants/courses";
import PATHS from "@/utils/constants/routes";
import { getLocationNameById } from "@/utils/constants/locations";
import { formatFullName, normalizeSearchText } from "@/utils/text";
import type { CourseAssignedCanonical, Member } from "@/types/index";

const SPIRITUAL_GROWTH_STAGES = [
    "Consolidación",
    "Discipulado básico",
    "Carácter cristiano",
    "Sanidad y propósito",
    "Cosmovisión bíblica",
    "Doctrina cristiana",
] as const;

const getNextSpiritualGrowthStage = (currentStage?: string | null) => {
    if (!currentStage) return SPIRITUAL_GROWTH_STAGES[0];
    const currentIndex = SPIRITUAL_GROWTH_STAGES.indexOf(currentStage as (typeof SPIRITUAL_GROWTH_STAGES)[number]);
    if (currentIndex === -1 || currentIndex === SPIRITUAL_GROWTH_STAGES.length - 1) return null;
    return SPIRITUAL_GROWTH_STAGES[currentIndex + 1];
};

const isMemberEligibleForCourse = (member: Member, courseStage: string) =>
    getNextSpiritualGrowthStage(member.spiritualGrowthStage) === courseStage;

type Tab = "current" | "history";

const TABS: Array<{ id: Tab; label: string }> = [
    { id: "current", label: "Curso actual" },
    { id: "history", label: "Historial" },
];

// Patron tabs ARIA APG (roving tabindex + flechas/Home/End). Misma
// implementacion que en Courses.tsx (navegacion por DOM, sin refs). Mover el
// componente a components/ui/ requeriria ADR del `chief-architect`
// (AGENTS.md §2).
const TAB_FOCUSABLE_KEYS = new Set([
    "ArrowRight", "Right",
    "ArrowLeft", "Left",
    "Home", "End",
]);

const handleTabKeyDown =
    <T extends string>(tabs: Array<{ id: T }>, onChange: (id: T) => void) =>
        (event: KeyboardEvent<HTMLButtonElement>) => {
            if (!TAB_FOCUSABLE_KEYS.has(event.key)) return;
            const parent = event.currentTarget.parentElement;
            if (!parent) return;
            const buttons = Array.from(
                parent.querySelectorAll<HTMLButtonElement>('button[role="tab"]'),
            );
            const count = buttons.length;
            if (count === 0) return;
            const currentIndex = buttons.indexOf(event.currentTarget);
            if (currentIndex < 0) return;
            let nextIndex = currentIndex;
            switch (event.key) {
                case "ArrowRight":
                case "Right":
                    nextIndex = (currentIndex + 1) % count;
                    break;
                case "ArrowLeft":
                case "Left":
                    nextIndex = (currentIndex - 1 + count) % count;
                    break;
                case "Home":
                    nextIndex = 0;
                    break;
                case "End":
                    nextIndex = count - 1;
                    break;
                default:
                    return;
            }
            event.preventDefault();
            const target = buttons[nextIndex];
            if (!target) return;
            const targetId = target.id.replace(/^professor-tab-/, "");
            const matched = tabs.find((tab) => tab.id === targetId);
            if (!matched) return;
            onChange(matched.id);
            target.focus();
        };

const formatAssignmentDate = (value: string) =>
    new Date(value).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });

const computeAttendanceRate = (sessionsCount: number, totalClasses: number) =>
    totalClasses === 0 ? 100 : Math.round((sessionsCount / totalClasses) * 100);

const computeStudentSummary = (assignment: CourseAssignedCanonical, sessions: Array<{ attendance: Array<{ member: { _id: string }; present: boolean }> }>) => {
    const totals = new Map<string, { present: number; count: number }>();
    assignment.members.forEach((member) => totals.set(member._id, { present: 0, count: 0 }));
    sessions.forEach((session) =>
        session.attendance.forEach((entry) => {
            const stats = totals.get(entry.member._id);
            if (stats) {
                stats.count += 1;
                if (entry.present) stats.present += 1;
            }
        }),
    );
    return assignment.members.map((member) => {
        const stats = totals.get(member._id)!;
        return {
            member,
            present: stats.present,
            count: stats.count,
            rate: stats.count === 0 ? 0 : Math.round((stats.present / stats.count) * 100),
        };
    });
};

export default function MyCoursesProfessor() {
    const [tab, setTab] = useState<Tab>("current");
    const [selectedAssignment, setSelectedAssignment] = useState<CourseAssignedCanonical | null>(null);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [memberSearchTerm, setMemberSearchTerm] = useState("");
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

    const activeQuery = useMyActiveCourseAssignments();
    const historyQuery = useMyCourseAssignmentHistory();
    const attendance = useMyAttendanceOverview();
    const registerMembers = useUpdateCourseMembers();
    const closeCourse = useCloseCourseAssignment();
    const historyDetail = useCourseAssignmentDetail(expandedHistoryId, Boolean(expandedHistoryId));
    const membersQuery = useQuery({ queryKey: ["members"], queryFn: getAllMembers, enabled: Boolean(selectedAssignment) });

    const activeAssignment = activeQuery.data?.[0] ?? null;
    // `attendance` se mantiene como fuente canonica de sesiones (contract
    // section 4.1, TEACHING_ROLES). El endpoint `/my-courses` (E-1) solo
    // entrega la asignacion, no las sesiones, por lo que el progreso se lee
    // de `attendance.data.sessions`.
    void attendance;

    const recordedSessions = useMemo(
        () => attendance.data?.sessions?.filter((session) => Boolean(session._id)) ?? [],
        [attendance.data],
    );

    const sessionsProgress = activeAssignment
        ? `${recordedSessions.length}/${activeAssignment.totalClasses}`
        : "0/0";
    const attendanceRate = activeAssignment
        ? computeAttendanceRate(recordedSessions.length, activeAssignment.totalClasses)
        : 0;
    const canClose = activeAssignment ? recordedSessions.length >= activeAssignment.totalClasses : false;

    const courseStage = activeAssignment?.course.spiritualGrowthStage;

    const availableMembers = useMemo(
        () =>
            (membersQuery.data ?? []).filter(
                (member) =>
                    ["Asistente", "Miembro"].includes(member.role.name) &&
                    (!courseStage || isMemberEligibleForCourse(member, courseStage)),
            ),
        [membersQuery.data, courseStage],
    );

    const filteredMembers = useMemo(() => {
        const term = normalizeSearchText(memberSearchTerm);
        if (!term) return availableMembers;
        return availableMembers.filter((member) => {
            const fullName = normalizeSearchText(`${member.firstName} ${member.lastName}`);
            const documentID = normalizeSearchText(member.documentID);
            return fullName.includes(term) || documentID.includes(term);
        });
    }, [availableMembers, memberSearchTerm]);

    const openMembersModal = (assignment: CourseAssignedCanonical) => {
        setSelectedAssignment(assignment);
        setSelectedMemberIds(assignment.members.map((member) => member._id));
        setMemberSearchTerm("");
    };

    const toggleMember = (memberId: string) =>
        setSelectedMemberIds((current) =>
            current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
        );

    const handleSaveMembers = async () => {
        if (!selectedAssignment) return;
        await registerMembers.mutateAsync({
            assignmentId: selectedAssignment._id,
            memberIds: selectedMemberIds,
        });
        setSelectedAssignment(null);
        setSelectedMemberIds([]);
        setMemberSearchTerm("");
    };

    const handleCloseCourse = () => {
        if (!activeAssignment) return;
        showSweetAlert({
            title: "Cerrar curso?",
            text: canClose
                ? "El curso pasara a completado. Ya no podras registrar miembros ni asistencias."
                : "Primero debes registrar todas las clases antes de cerrar el curso.",
            type: canClose ? "warning" : "info",
            confirmButtonText: canClose ? "Si, cerrar curso" : "Entendido",
            showCancelButton: canClose,
            cancelButtonText: "Cancelar",
            onConfirm: () => closeCourse.mutateAsync(activeAssignment._id),
        });
    };

    const historyItems = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);
    const expandedDetail = historyDetail.data;
    const expandedSummary = useMemo(() => {
        if (!expandedDetail) return [];
        return computeStudentSummary(expandedDetail, expandedDetail.sessions);
    }, [expandedDetail]);

    const selectedHistoryItem = useMemo(
        () => historyItems.find((item) => item._id === expandedHistoryId),
        [historyItems, expandedHistoryId],
    );

    const historyDetailBody = useMemo(() => {
        if (historyDetail.isLoading) {
            return <LoadingSpinner label="Cargando sesiones..." className="min-h-[160px]" />;
        }
        if (historyDetail.isError) {
            return <p className="text-sm text-rose-600">No se pudo cargar el detalle.</p>;
        }
        if (!expandedDetail || !expandedSummary.length) {
            return <p className="text-sm text-slate-500">Sin sesiones registradas.</p>;
        }
        return (
            <ul className="space-y-2">
                {expandedSummary.map(({ member, present, count, rate }) => (
                    <li key={member._id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <p className="font-medium text-slate-900">
                            {formatFullName(member.firstName, member.lastName)}
                        </p>
                        <p className="text-slate-600">
                            {present}/{count} clases presentes · {rate}% asistencia
                        </p>
                    </li>
                ))}
            </ul>
        );
    }, [historyDetail.isLoading, historyDetail.isError, expandedDetail, expandedSummary]);

    return (
        <div className="space-y-8">
            <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-300/40 sm:px-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.28),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.22),_transparent_28%)]" />
                <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
                            <GraduationCap className="h-3.5 w-3.5" />
                            Mis cursos
                        </div>
                        <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
                            Consulta tus cursos asignados y registra participantes.
                        </h1>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Sesiones</p>
                            <p className="mt-3 text-3xl font-bold">{sessionsProgress}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Asistencia</p>
                            <p className="mt-3 text-3xl font-bold">{attendanceRate}%</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Inscritos</p>
                            <p className="mt-3 text-3xl font-bold">{activeAssignment?.members.length ?? 0}</p>
                        </div>
                    </div>
                </div>
            </section>

            <div
                role="tablist"
                aria-label="Secciones de mis cursos"
                aria-orientation="horizontal"
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
                            aria-controls={`professor-tabpanel-${id}`}
                            id={`professor-tab-${id}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => setTab(id)}
                            onKeyDown={handleTabKeyDown(TABS, setTab)}
                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${selected ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-slate-100"
                                }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* ===== Curso actual ===== */}
            <section
                id="professor-tabpanel-current"
                role="tabpanel"
                aria-labelledby="professor-tab-current"
                hidden={tab !== "current"}
                className="space-y-6"
            >
                <div className="grid grid-cols-1 gap-6 md:grid md:grid-cols-2  2xl:grid-cols-3">
                    {activeQuery.isLoading ? (
                        <LoadingSpinner label="Cargando tu curso..." className="min-h-[200px]" />
                    ) : activeQuery.isError ? (
                        <p className="text-sm text-rose-600">No se pudo cargar tu curso.</p>
                    ) : activeAssignment ? (
                        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Curso actual</p>
                                    <h2 className="mt-2 text-2xl font-bold text-slate-900">{activeAssignment.course.name}</h2>
                                    <p className="mt-2 text-sm leading-6 text-slate-500">{activeAssignment.course.description}</p>
                                </div>
                                <span
                                    role="img"
                                    aria-label={`Nivel ${COURSE_LEVEL_LABELS[activeAssignment.course.level] ?? activeAssignment.course.level}`}
                                    className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200"
                                >
                                    Nivel {COURSE_LEVEL_LABELS[activeAssignment.course.level] ?? activeAssignment.course.level}
                                </span>
                            </div>

                            <div className="mt-6 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                                <p className="flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4 text-slate-400" />
                                    {formatAssignmentDate(activeAssignment.startDate)} a {formatAssignmentDate(activeAssignment.endDate)}
                                </p>
                                <p className="flex items-center gap-2">
                                    <Clock3 className="h-4 w-4 text-slate-400" />
                                    {activeAssignment.startTime} · {activeAssignment.totalClasses} clases
                                </p>
                                <p className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-slate-400" />
                                    {getLocationNameById(activeAssignment.location)}
                                </p>
                                <p
                                    role="status"
                                    aria-label={`Progreso de sesiones: ${recordedSessions.length} de ${activeAssignment.totalClasses} clases registradas`}
                                    className="flex items-center gap-2"
                                >
                                    <BookOpen className="h-4 w-4 text-slate-400" />
                                    Progreso de sesiones: {sessionsProgress}
                                </p>
                            </div>

                            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Miembros del curso</p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {activeAssignment.members.length
                                                ? `${activeAssignment.members.length} registrados`
                                                : "Aun no has registrado miembros en este curso"}
                                        </p>
                                    </div>
                                    <Button
                                        color="primary"
                                        variant="flat"
                                        onPress={() => openMembersModal(activeAssignment)}
                                    >
                                        Registrar miembros
                                    </Button>
                                </div>

                                {activeAssignment.members.length ? (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {activeAssignment.members.map((member) => (
                                            <span
                                                key={member._id}
                                                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
                                            >
                                                {formatFullName(member.firstName, member.lastName)}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>

                            <div className="mt-5 flex flex-wrap gap-3">
                                <Link to={PATHS.attendance}>
                                    <Button color="primary" variant="solid" className="font-semibold">
                                        <ClipboardCheck className="h-4 w-4" />
                                        Registrar asistencia
                                    </Button>
                                </Link>
                                <Button
                                    color="warning"
                                    variant="flat"
                                    isLoading={closeCourse.isPending}
                                    isDisabled={!canClose}
                                    aria-disabled={!canClose}
                                    title={canClose ? undefined : "Debes registrar todas las clases antes de cerrar el curso"}
                                    onPress={handleCloseCourse}
                                >
                                    Cerrar curso
                                </Button>
                                {!canClose ? (
                                    <p
                                        role="status"
                                        aria-live="polite"
                                        className="self-center text-sm text-amber-700"
                                    >
                                        Para cerrar el curso debes registrar las {activeAssignment.totalClasses} clases programadas.
                                    </p>
                                ) : null}
                            </div>
                        </article>
                    ) : (
                        <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm shadow-slate-200/70">
                            <h2 className="text-2xl font-semibold text-slate-900">No tienes un curso activo</h2>
                            <p className="mt-3 text-sm leading-6 text-slate-500">
                                Cuando se te asigne un curso lo veras aqui con su calendario y ubicacion.
                            </p>
                        </section>
                    )}
                </div>
            </section>

            {/* ===== Historial ===== */}
            <section
                id="professor-tabpanel-history"
                role="tabpanel"
                aria-labelledby="professor-tab-history"
                hidden={tab !== "history"}
                className="space-y-4"
            >
                <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                        <Trophy className="h-5 w-5 text-amber-500" />
                        Cursos completados
                    </h2>
                </div>

                {historyQuery.isLoading ? (
                    <LoadingSpinner label="Cargando historial..." className="min-h-[200px]" />
                ) : historyQuery.isError ? (
                    <p className="text-sm text-rose-600">No se pudo cargar tu historial.</p>
                ) : historyItems.length ? (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr] xl:items-start">
                        {/* Lista de cursos completados */}
                        <div className="space-y-3">
                            {historyItems.map((assignment) => {
                                const isExpanded = expandedHistoryId === assignment._id;
                                return (
                                    <article
                                        key={assignment._id}
                                        className="rounded-3xl border border-amber-200 bg-amber-50 p-5"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setExpandedHistoryId(isExpanded ? null : assignment._id)}
                                            className="flex w-full items-center justify-between gap-3 rounded-2xl px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                                            aria-expanded={isExpanded}
                                            aria-controls={isExpanded ? `professor-history-detail-${assignment._id}` : undefined}
                                            aria-label={isExpanded
                                                ? `Ocultar detalle de ${assignment.course.name}`
                                                : `Ver detalle de ${assignment.course.name}`}
                                        >
                                            <div>
                                                <p className="text-base font-bold text-slate-900">{assignment.course.name}</p>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    Completado · {formatAssignmentDate(assignment.endDate)} ·{" "}
                                                    {getLocationNameById(assignment.location)}
                                                </p>
                                            </div>
                                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm">
                                                {isExpanded ? "Ocultar detalle" : "Ver detalle"}
                                            </span>
                                        </button>

                                        {/* Detalle en móvil/tablet */}
                                        {isExpanded ? (
                                            <div
                                                id={`professor-history-detail-${assignment._id}`}
                                                role="region"
                                                aria-label={`Detalle del curso ${assignment.course.name}`}
                                                className="mt-4 space-y-3 rounded-2xl border border-amber-200 bg-white p-4 xl:hidden"
                                            >
                                                {historyDetailBody}
                                            </div>
                                        ) : null}
                                    </article>
                                );
                            })}
                        </div>

                        {/* Detalle en desktop */}
                        <div className="hidden xl:sticky xl:top-6 xl:block">
                            {selectedHistoryItem ? (
                                <div
                                    id="professor-history-detail-panel"
                                    role="region"
                                    aria-label={`Detalle del curso ${selectedHistoryItem.course.name}`}
                                    aria-live="polite"
                                    className="rounded-3xl border border-amber-200 bg-white p-5"
                                >
                                    <div className="border-b border-amber-200 pb-4">
                                        <h3 className="text-lg font-bold text-slate-900">
                                            {selectedHistoryItem.course.name}
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Completado · {formatAssignmentDate(selectedHistoryItem.endDate)} ·{" "}
                                            {getLocationNameById(selectedHistoryItem.location)}
                                        </p>
                                    </div>
                                    <div className="pt-4">{historyDetailBody}</div>
                                </div>
                            ) : (
                                <div className="rounded-3xl border border-amber-200 bg-white p-5">
                                    <p className="text-sm text-slate-500">Selecciona un curso para ver el detalle.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <p role="status" aria-live="polite" className="text-sm text-slate-500">Aun no has completado cursos.</p>
                )}
            </section>

            {/* ===== Modal Registrar miembros ===== */}
            <ModalView
                isOpen={Boolean(selectedAssignment)}
                onClose={() => {
                    setSelectedAssignment(null);
                    setSelectedMemberIds([]);
                    setMemberSearchTerm("");
                }}
                title="Registrar miembros del curso"
                size="2xl"
            >
                <div className="space-y-4">
                    <p className="text-sm leading-6 text-slate-500">
                        Selecciona los asistentes o miembros vinculados a{" "}
                        <span className="font-semibold text-slate-900">
                            {selectedAssignment?.course.name ?? "este curso"}
                        </span>.
                    </p>

                    <Input
                        isClearable
                        value={memberSearchTerm}
                        onValueChange={setMemberSearchTerm}
                        placeholder="Buscar por nombre o cedula"
                        startContent={<Search className="h-4 w-4 text-slate-400" />}
                        variant="bordered"
                    />

                    <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-2">
                        {availableMembers.length === 0 ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                                <p className="text-sm font-medium text-slate-700">
                                    No hay miembros disponibles para esta etapa de crecimiento espiritual.
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                    Solo se pueden inscribir miembros cuya siguiente etapa sea{" "}
                                    {courseStage ? `"${courseStage}"` : "la del curso activo"}.
                                </p>
                            </div>
                        ) : filteredMembers.length === 0 ? (
                            <p className="text-center text-sm text-slate-500">
                                No se encontraron miembros con ese criterio de busqueda.
                            </p>
                        ) : (
                            filteredMembers.map((member) => {
                                const checked = selectedMemberIds.includes(member._id);
                                return (
                                    <label
                                        key={member._id}
                                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${checked ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
                                            }`}
                                    >
                                        <Checkbox
                                            isSelected={checked}
                                            onValueChange={() => toggleMember(member._id)}
                                            aria-label={`Seleccionar a ${formatFullName(member.firstName, member.lastName)}`}
                                            className="mt-1"
                                        />
                                        <div>
                                            <p className="font-medium text-slate-900">{formatFullName(member.firstName, member.lastName)}</p>
                                            <p className="text-sm text-slate-500">{member.role.name} · {member.documentID}</p>
                                        </div>
                                    </label>
                                );
                            })
                        )}
                    </div>

                    <Button
                        className="w-full"
                        color="primary"
                        isLoading={registerMembers.isPending}
                        onPress={handleSaveMembers}
                    >
                        Guardar miembros del curso
                    </Button>
                </div>
            </ModalView>
        </div>
    );
}