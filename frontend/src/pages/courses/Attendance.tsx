import { useEffect, useMemo, useState } from "react"
import { Button, Input } from "@heroui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, CheckCircle2, ClipboardCheck, Download, Search, XCircle } from "lucide-react"
import { getMyAttendanceOverview, saveMyClassAttendance } from "@/api/CourseAPI"
import { type CourseAssigned, type ClassSession } from "@/types/index"
import { downloadAttendancePdfReport } from "@/utils/attendanceReport"
import { COURSE_LEVEL_LABELS } from "@/utils/constants/courses"
import { getLocationNameById } from "@/utils/constants/locations"
import { formatFullName, normalizeSearchText } from "@/utils/text"

type AttendanceState = Record<string, boolean | null>

const buildAttendanceState = (
    assignment: CourseAssigned | null,
    session: ClassSession | null,
): AttendanceState => {
    if (!assignment || !session) {
        return {}
    }

    return Object.fromEntries(
        assignment.members.map((member) => {
            const savedAttendance = session.attendance.find(
                (attendance) => attendance.student._id === member._id,
            )

            return [member._id, savedAttendance?.present ?? null]
        }),
    )
}

export default function Attendance() {
    const queryClient = useQueryClient()
    const [selectedClassNumber, setSelectedClassNumber] = useState<number | null>(null)
    const [attendanceState, setAttendanceState] = useState<AttendanceState>({})
    const [searchTerm, setSearchTerm] = useState("")
    const { data, isLoading } = useQuery({
        queryKey: ["myAttendance"],
        queryFn: getMyAttendanceOverview,
    })

    const assignment = data?.assignment ?? null
    const sessions = data?.sessions ?? []

    useEffect(() => {
        if (!sessions.length) {
            setSelectedClassNumber(null)
            return
        }

        const hasCurrentSelection = selectedClassNumber
            ? sessions.some((session) => session.classNumber === selectedClassNumber)
            : false

        if (hasCurrentSelection) {
            return
        }

        const firstPendingSession = sessions.find((session) => !session._id)
        setSelectedClassNumber(firstPendingSession?.classNumber ?? sessions[0]?.classNumber ?? null)
    }, [selectedClassNumber, sessions])

    const selectedSession = useMemo(
        () => sessions.find((session) => session.classNumber === selectedClassNumber) ?? null,
        [selectedClassNumber, sessions],
    )

    useEffect(() => {
        setAttendanceState(buildAttendanceState(assignment, selectedSession))
    }, [assignment, selectedSession])

    const filteredMembers = useMemo(() => {
        if (!assignment) {
            return []
        }

        const normalizedSearch = normalizeSearchText(searchTerm)

        if (!normalizedSearch) {
            return assignment.members
        }

        return assignment.members.filter((member) => {
            const fullName = normalizeSearchText(`${member.firstName} ${member.lastName}`)
            const documentID = normalizeSearchText(member.documentID)

            return fullName.includes(normalizedSearch) || documentID.includes(normalizedSearch)
        })
    }, [assignment, searchTerm])
    const savedSessions = useMemo(
        () => sessions.filter((session) => Boolean(session._id)),
        [sessions],
    )

    const pendingMembersCount = useMemo(() => {
        if (!assignment) {
            return 0
        }

        return assignment.members.filter((member) => attendanceState[member._id] === null).length
    }, [assignment, attendanceState])

    const attendanceMutation = useMutation({
        mutationFn: ({
            classNumber,
            attendance,
        }: {
            classNumber: number
            attendance: Array<{ studentId: string; present: boolean }>
        }) => saveMyClassAttendance(classNumber, attendance),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["myAttendance"] })
        },
    })

    const setMemberAttendance = (memberId: string, present: boolean) => {
        setAttendanceState((current) => ({
            ...current,
            [memberId]: present,
        }))
    }

    if (isLoading) {
        return <h1>Cargando asistencias...</h1>
    }

    if (!assignment) {
        return (
            <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm shadow-slate-200/70">
                <h1 className="text-2xl font-semibold text-slate-900">No tienes un curso activo</h1>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                    Cuando tengas un curso activo asignado, aquí podrás registrar la asistencia por clase.
                </p>
            </section>
        )
    }

    return (
        <div className="space-y-8">
            <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-300/40 sm:px-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,197,94,0.24),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.2),_transparent_28%)]" />
                <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            Registro de asistencias
                        </div>
                        <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
                            {assignment.course.name}
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                            Lleva el control de cada clase del curso activo y marca si cada estudiante asistió o faltó.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-200">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                Nivel {COURSE_LEVEL_LABELS[assignment.course.level]}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                {assignment.totalClasses} clases
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                {getLocationNameById(assignment.location)}
                            </span>
                        </div>
                        <div className="mt-5">
                            <Button
                                color="success"
                                variant="solid"
                                isDisabled={!savedSessions.length}
                                onPress={() =>
                                    downloadAttendancePdfReport({
                                        assignment,
                                        sessions: savedSessions,
                                    })
                                }
                            >
                                <Download className="h-4 w-4" />
                                Descargar reporte PDF
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Inscritos</p>
                            <p className="mt-3 text-3xl font-bold">{assignment.members.length}</p>
                            <p className="mt-2 text-sm text-slate-300">miembros en este curso</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Pendientes</p>
                            <p className="mt-3 text-3xl font-bold">{pendingMembersCount}</p>
                            <p className="mt-2 text-sm text-slate-300">por marcar en la clase seleccionada</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Clases del curso
                            </p>
                            <h2 className="mt-2 text-2xl font-bold text-slate-900">Selecciona una clase</h2>
                        </div>
                    </div>

                    <div className="mt-6 space-y-3">
                        {sessions.map((session) => {
                            const isSelected = session.classNumber === selectedClassNumber
                            const presentCount = session.attendance.filter((entry) => entry.present).length

                            return (
                                <button
                                    key={session.classNumber}
                                    type="button"
                                    onClick={() => setSelectedClassNumber(session.classNumber)}
                                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                                        isSelected
                                            ? "border-blue-300 bg-blue-50 shadow-sm"
                                            : "border-slate-200 bg-white hover:border-slate-300"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">
                                                Clase {session.classNumber}
                                            </p>
                                            <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                                                <CalendarDays className="h-4 w-4 text-slate-400" />
                                                {new Date(session.date).toLocaleDateString("es-CO")}
                                            </p>
                                        </div>
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                session._id
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-amber-100 text-amber-700"
                                            }`}
                                        >
                                            {session._id ? "Guardada" : "Pendiente"}
                                        </span>
                                    </div>
                                    <p className="mt-3 text-xs text-slate-500">
                                        {session._id
                                            ? `${presentCount} asistencia${presentCount === 1 ? "" : "s"} registrada${presentCount === 1 ? "" : "s"}`
                                            : "Aún no se ha registrado la asistencia de esta clase"}
                                    </p>
                                </button>
                            )
                        })}
                    </div>
                </article>

                <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Lista de asistencia
                            </p>
                            <h2 className="mt-2 text-2xl font-bold text-slate-900">
                                {selectedSession ? `Clase ${selectedSession.classNumber}` : "Selecciona una clase"}
                            </h2>
                        </div>
                        {selectedSession ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                {new Date(selectedSession.date).toLocaleDateString("es-CO")}
                            </span>
                        ) : null}
                    </div>

                    <div className="mt-6 space-y-4">
                        <Input
                            isClearable
                            value={searchTerm}
                            onValueChange={setSearchTerm}
                            placeholder="Buscar por nombre o cédula"
                            startContent={<Search className="h-4 w-4 text-slate-400" />}
                            variant="bordered"
                        />

                        {assignment.members.length ? (
                            <p className="text-xs text-slate-500">
                                {filteredMembers.length} persona{filteredMembers.length === 1 ? "" : "s"} visible{filteredMembers.length === 1 ? "" : "s"}
                            </p>
                        ) : null}

                        {!assignment.members.length ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                Primero necesitas registrar miembros en el curso para tomar asistencia.
                            </div>
                        ) : filteredMembers.length ? (
                            <div className="space-y-3">
                                {filteredMembers.map((member) => {
                                    const currentStatus = attendanceState[member._id]

                                    return (
                                        <div
                                            key={member._id}
                                            className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
                                        >
                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-900">
                                                    {formatFullName(member.firstName, member.lastName)}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    {member.role.name} · {member.documentID}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    color="success"
                                                    variant={currentStatus === true ? "solid" : "bordered"}
                                                    onPress={() => setMemberAttendance(member._id, true)}
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Asiste
                                                </Button>
                                                <Button
                                                    color="danger"
                                                    variant={currentStatus === false ? "solid" : "bordered"}
                                                    onPress={() => setMemberAttendance(member._id, false)}
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                    Falla
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                No encontramos estudiantes con ese nombre o cédula.
                            </div>
                        )}

                        {pendingMembersCount ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                Te faltan {pendingMembersCount} estudiante{pendingMembersCount === 1 ? "" : "s"} por marcar en esta clase.
                            </div>
                        ) : null}

                        {attendanceMutation.isError ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {attendanceMutation.error.message}
                            </div>
                        ) : null}

                        <Button
                            className="w-full"
                            color="primary"
                            isDisabled={!selectedSession || pendingMembersCount > 0 || !assignment.members.length}
                            isLoading={attendanceMutation.isPending}
                            onPress={async () => {
                                if (!selectedSession) {
                                    return
                                }

                                await attendanceMutation.mutateAsync({
                                    classNumber: selectedSession.classNumber,
                                    attendance: assignment.members.map((member) => ({
                                        studentId: member._id,
                                        present: attendanceState[member._id] === true,
                                    })),
                                })
                            }}
                        >
                            Guardar asistencia de la clase
                        </Button>
                    </div>
                </article>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Historial del curso
                        </p>
                        <h2 className="mt-2 text-2xl font-bold text-slate-900">
                            Resumen de asistencias guardadas
                        </h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {savedSessions.length} clase{savedSessions.length === 1 ? "" : "s"} registrada{savedSessions.length === 1 ? "" : "s"}
                    </span>
                </div>

                {savedSessions.length ? (
                    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {savedSessions.map((session) => {
                            const presentCount = session.attendance.filter((entry) => entry.present).length
                            const absentCount = session.attendance.length - presentCount
                            const attendanceRate = session.attendance.length
                                ? Math.round((presentCount / session.attendance.length) * 100)
                                : 0

                            return (
                                <article
                                    key={session.classNumber}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">
                                                Clase {session.classNumber}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {new Date(session.date).toLocaleDateString("es-CO")}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                            {attendanceRate}%
                                        </span>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                        <div className="rounded-2xl bg-white px-3 py-3">
                                            <p className="text-slate-500">Asistieron</p>
                                            <p className="mt-1 text-xl font-bold text-emerald-700">
                                                {presentCount}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-white px-3 py-3">
                                            <p className="text-slate-500">Fallaron</p>
                                            <p className="mt-1 text-xl font-bold text-rose-700">
                                                {absentCount}
                                            </p>
                                        </div>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                ) : (
                    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                        Aún no hay clases con asistencia guardada en este curso.
                    </div>
                )}
            </section>
        </div>
    )
}
