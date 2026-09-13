import { Button } from "@heroui/react";
import { BookOpen, CalendarDays, Download, FileSpreadsheet, MapPin } from "lucide-react";

import LoadingSpinner from "@/components/common/LoadingSpinner";
import { type CourseAssignedCanonical, type CourseAssignedHistoryItem } from "@/types/index";
import { COURSE_LEVEL_LABELS } from "@/utils/constants/courses";
import { getLocationNameById } from "@/utils/constants/locations";
import { parseStoredDate } from "@/utils/date";
import { formatFullName } from "@/utils/text";

type CourseMember = CourseAssignedCanonical["members"][number];

type StudentSummary = {
    member: CourseMember;
    present: number;
    count: number;
    rate: number;
};

type HistoryCourseDetailProps = {
    assignment: CourseAssignedCanonical;
    detail: CourseAssignedHistoryItem | undefined | null;
    isLoading: boolean;
    isError: boolean;
    summary: StudentSummary[];
    isExporting: boolean;
    onDownloadPdf: () => void;
    onExportExcel: () => void;
};

const formatAssignmentDate = (value: string) =>
    parseStoredDate(value).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });

export default function HistoryCourseDetail({
    assignment,
    detail,
    isLoading,
    isError,
    summary,
    isExporting,
    onDownloadPdf,
    onExportExcel,
}: HistoryCourseDetailProps) {
    const registeredSessions = detail?.sessions.length ?? 0;
    const hasSessions = registeredSessions > 0;
    const courseName = assignment.course.name;

    return (
        <div className="space-y-5">
            <div className="border-b border-amber-200 pb-4">
                <h3 className="text-lg font-bold text-slate-900">{courseName}</h3>
                <p className="mt-1 text-sm text-slate-600">
                    Completado · {formatAssignmentDate(assignment.endDate)} ·{" "}
                    {getLocationNameById(assignment.location)}
                </p>
            </div>

            <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                <p className="flex items-center gap-2">
                    <span
                        className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200"
                    >
                        Nivel {COURSE_LEVEL_LABELS[assignment.course.level] ?? assignment.course.level}
                    </span>
                </p>
                <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    {formatAssignmentDate(assignment.startDate)} a {formatAssignmentDate(assignment.endDate)}
                </p>
                <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    {getLocationNameById(assignment.location)}
                </p>
                <p className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    {registeredSessions} de {assignment.totalClasses} clases registradas
                </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Miembros inscritos</p>
                {assignment.members.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {assignment.members.map((member) => (
                            <span
                                key={member._id}
                                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
                            >
                                {formatFullName(member.firstName, member.lastName)}
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="mt-1 text-xs text-slate-500">
                        No hay miembros registrados en este curso.
                    </p>
                )}
            </div>

            <div className="flex flex-wrap gap-3">
                <Button
                    color="success"
                    variant="solid"
                    startContent={<Download className="h-4 w-4" aria-hidden="true" />}
                    isDisabled={isLoading || !hasSessions}
                    onPress={onDownloadPdf}
                    aria-label={`Descargar reporte PDF de asistencia de ${courseName}`}
                >
                    Descargar reporte PDF
                </Button>
                <Button
                    color="success"
                    variant="flat"
                    startContent={<FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
                    isLoading={isExporting}
                    isDisabled={isLoading || !hasSessions}
                    onPress={onExportExcel}
                    aria-label={`Exportar Excel de asistencia de ${courseName}`}
                >
                    Exportar Excel
                </Button>
            </div>

            {!hasSessions && !isLoading && !isError ? (
                <p role="status" className="text-sm text-amber-700">
                    Este curso no tiene sesiones registradas, por lo que no hay reportes para descargar.
                </p>
            ) : null}

            <div className="pt-2">
                {isLoading ? (
                    <LoadingSpinner label="Cargando sesiones..." className="min-h-[160px]" />
                ) : isError ? (
                    <p className="text-sm text-rose-600">No se pudo cargar el detalle.</p>
                ) : !summary.length ? (
                    <p className="text-sm text-slate-500">Sin sesiones registradas.</p>
                ) : (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-900">Resumen por estudiante</p>
                        <ul className="space-y-2">
                            {summary.map(({ member, present, count, rate }) => (
                                <li
                                    key={member._id}
                                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                                >
                                    <p className="font-medium text-slate-900">
                                        {formatFullName(member.firstName, member.lastName)}
                                    </p>
                                    <p className="text-slate-600">
                                        {present}/{count} clases presentes · {rate}% asistencia
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
