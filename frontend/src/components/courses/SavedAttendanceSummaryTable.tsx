import { Button } from "@heroui/react"
import { CheckCircle2, Eye, XCircle } from "lucide-react"
import { type ClassSession, type CourseAssigned } from "@/types/index"
import { formatFullName } from "@/utils/text"

type SavedAttendanceSummaryTableProps = {
    assignment: CourseAssigned
    savedSessions: ClassSession[]
    onOpenStudentQuickView?: (studentId: string) => void
}

const buildClassNumbers = (totalClasses: number) =>
    Array.from({ length: totalClasses }, (_, index) => index + 1)

export default function SavedAttendanceSummaryTable({
    assignment,
    savedSessions,
    onOpenStudentQuickView,
}: SavedAttendanceSummaryTableProps) {
    const classNumbers = buildClassNumbers(assignment.totalClasses)
    const savedSessionByClassNumber = new Map(
        savedSessions.map((session) => [session.classNumber, session]),
    )

    if (!savedSessions.length) {
        return (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aún no hay clases con asistencia guardada en este curso.
            </div>
        )
    }

    if (!assignment.members.length) {
        return (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                No hay estudiantes registrados para mostrar en el resumen.
            </div>
        )
    }

    return (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                            <th className="sticky left-0 z-10 min-w-64 border-b border-r border-slate-200 bg-slate-100 px-4 py-3">
                                Estudiante
                            </th>
                            {classNumbers.map((classNumber) => (
                                <th
                                    key={classNumber}
                                    className="min-w-24 border-b border-r border-slate-200 px-3 py-3 text-center last:border-r-0"
                                >
                                    Clase {classNumber}
                                </th>
                            ))}
                            {onOpenStudentQuickView ? (
                                <th className="min-w-36 border-b border-slate-200 px-3 py-3 text-center">
                                    Vista rápida
                                </th>
                            ) : null}
                        </tr>
                    </thead>
                    <tbody>
                        {assignment.members.map((member) => (
                            <tr key={member._id} className="odd:bg-white even:bg-slate-50/70">
                                <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-4 py-3 text-left font-semibold text-slate-900">
                                    <span className="block">
                                        {formatFullName(member.firstName, member.lastName)}
                                    </span>
                                    <span className="mt-1 block text-xs font-normal text-slate-500">
                                        {member.documentID}
                                    </span>
                                </th>
                                {classNumbers.map((classNumber) => {
                                    const session = savedSessionByClassNumber.get(classNumber)
                                    const attendance = session?.attendance.find(
                                        (entry) => entry.student._id === member._id,
                                    )

                                    return (
                                        <td
                                            key={classNumber}
                                            className="border-b border-r border-slate-200 px-3 py-3 text-center last:border-r-0"
                                        >
                                            {attendance ? (
                                                attendance.present ? (
                                                    <span
                                                        className="inline-flex items-center justify-center rounded-full bg-emerald-100 p-1 text-emerald-700"
                                                        title="Asistió"
                                                        aria-label="Asistió"
                                                    >
                                                        <CheckCircle2 className="h-5 w-5" />
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center justify-center rounded-full bg-rose-100 p-1 text-rose-700"
                                                        title="Falló"
                                                        aria-label="Falló"
                                                    >
                                                        <XCircle className="h-5 w-5" />
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-slate-300" title="Sin registrar">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                    )
                                })}
                                {onOpenStudentQuickView ? (
                                    <td className="border-b border-slate-200 px-3 py-3 text-center">
                                        <Button
                                            size="sm"
                                            color="primary"
                                            variant="flat"
                                            onPress={() => onOpenStudentQuickView(member._id)}
                                        >
                                            <Eye className="h-4 w-4" />
                                            Abrir
                                        </Button>
                                    </td>
                                ) : null}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex flex-wrap gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
                <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Asistió
                </span>
                <span className="inline-flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-rose-600" />
                    Falló
                </span>
                <span>— Sin registrar</span>
            </div>
        </div>
    )
}
