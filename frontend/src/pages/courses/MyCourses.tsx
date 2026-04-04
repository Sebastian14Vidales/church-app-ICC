import { useMemo, useState } from "react"
import { Button, Input } from "@heroui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BookOpen, CalendarDays, Clock3, GraduationCap, MapPin, Search } from "lucide-react"
import ModalView from "@/components/dashboard/ModalView"
import { getMyCourseAssignments, updateCourseMembers } from "@/api/CourseAPI"
import { getAllMembers } from "@/api/MemberAPI"
import { useAuth } from "@/lib/auth"
import { type CourseAssigned } from "@/types/index"
import { getLocationNameById } from "@/utils/constants/locations"

const COURSE_LEVEL_LABELS = {
    basic: "Basico",
    intermediate: "Intermedio",
    advanced: "Avanzado",
} as const

const COURSE_STATUS_LABELS = {
    active: "Activo",
    completed: "Completado",
    cancelled: "Cancelado",
} as const

const normalizeSearchValue = (value: string) =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()

export default function MyCourses() {
    const { user } = useAuth()
    const isProfessor = user?.roles.includes("Profesor") ?? false
    const queryClient = useQueryClient()
    const [selectedAssignment, setSelectedAssignment] = useState<CourseAssigned | null>(null)
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
    const [memberSearchTerm, setMemberSearchTerm] = useState("")
    const { data: assignments = [], isLoading } = useQuery({
        queryKey: ["myCourses"],
        queryFn: getMyCourseAssignments,
    })
    const { data: members = [] } = useQuery({
        queryKey: ["members"],
        queryFn: getAllMembers,
    })

    const registerMembersMutation = useMutation({
        mutationFn: ({ assignmentId, memberIds }: { assignmentId: string; memberIds: string[] }) =>
            updateCourseMembers(assignmentId, memberIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["myCourses"] })
            queryClient.invalidateQueries({ queryKey: ["courseAssignments"] })
            setSelectedAssignment(null)
            setSelectedMemberIds([])
        },
    })

    const availableMembers = useMemo(
        () =>
            members.filter((member) =>
                ["Asistente", "Miembro"].includes(member.role.name),
            ),
        [members],
    )
    const filteredMembers = useMemo(() => {
        const normalizedSearchTerm = normalizeSearchValue(memberSearchTerm)

        if (!normalizedSearchTerm) {
            return availableMembers
        }

        return availableMembers.filter((member) => {
            const fullName = normalizeSearchValue(`${member.firstName} ${member.lastName}`)
            const documentID = normalizeSearchValue(member.documentID)

            return fullName.includes(normalizedSearchTerm) || documentID.includes(normalizedSearchTerm)
        })
    }, [availableMembers, memberSearchTerm])

    const openMembersModal = (assignment: CourseAssigned) => {
        setSelectedAssignment(assignment)
        setSelectedMemberIds(assignment.members.map((member) => member._id))
        setMemberSearchTerm("")
    }

    const toggleMember = (memberId: string) => {
        setSelectedMemberIds((current) =>
            current.includes(memberId)
                ? current.filter((id) => id !== memberId)
                : [...current, memberId],
        )
    }

    if (isLoading) {
        return <h1>Cargando cursos...</h1>
    }

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
                            {isProfessor
                                ? "Consulta tus cursos asignados y su programación."
                                : "Consulta las asignaciones visibles para tu perfil."}
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                            Aquí puedes revisar el estado, calendario y ubicación de los cursos asociados a tu cuenta.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Total asignados</p>
                            <p className="mt-3 text-3xl font-bold">{assignments.length}</p>
                            <p className="mt-2 text-sm text-slate-300">
                                {assignments.length === 1 ? "curso encontrado" : "cursos encontrados"}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {assignments.length ? (
                <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {assignments.map((assignment) => (
                        <article
                            key={assignment._id}
                            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        {COURSE_STATUS_LABELS[assignment.status] ?? assignment.status}
                                    </p>
                                    <h2 className="mt-2 text-2xl font-bold text-slate-900">
                                        {assignment.course.name}
                                    </h2>
                                    <p className="mt-2 text-sm leading-6 text-slate-500">
                                        {assignment.course.description}
                                    </p>
                                </div>
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                    {COURSE_LEVEL_LABELS[assignment.course.level] ?? assignment.course.level}
                                </span>
                            </div>

                            <div className="mt-6 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                                <p className="flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4 text-slate-400" />
                                    {new Date(assignment.startDate).toLocaleDateString("es-CO")} a {new Date(assignment.endDate).toLocaleDateString("es-CO")}
                                </p>
                                <p className="flex items-center gap-2">
                                    <Clock3 className="h-4 w-4 text-slate-400" />
                                    {assignment.startTime} · {assignment.totalClasses} clases
                                </p>
                                <p className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-slate-400" />
                                    {getLocationNameById(assignment.location)}
                                </p>
                                <p className="flex items-center gap-2">
                                    <BookOpen className="h-4 w-4 text-slate-400" />
                                    Profesor: {assignment.professor.firstName} {assignment.professor.lastName}
                                </p>
                            </div>

                            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Miembros del curso</p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {assignment.members.length
                                                ? `${assignment.members.length} registrados`
                                                : "Aun no has registrado miembros en este curso"}
                                        </p>
                                    </div>
                                    <Button color="primary" variant="flat" onPress={() => openMembersModal(assignment)}>
                                        Registrar miembros
                                    </Button>
                                </div>

                                {assignment.members.length ? (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {assignment.members.map((member) => (
                                            <span
                                                key={member._id}
                                                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
                                            >
                                                {member.firstName} {member.lastName}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </article>
                    ))}
                </section>
            ) : (
                <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm shadow-slate-200/70">
                    <h2 className="text-2xl font-semibold text-slate-900">No hay cursos asignados</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                        {isProfessor
                            ? "Cuando se te asigne un curso lo veras aquí con su calendario y ubicación."
                            : "Este rol no tiene cursos asignados por el momento."}
                    </p>
                </section>
            )}

            <ModalView
                isOpen={Boolean(selectedAssignment)}
                onClose={() => {
                    setSelectedAssignment(null)
                    setSelectedMemberIds([])
                    setMemberSearchTerm("")
                }}
                title="Registrar miembros del curso"
                size="2xl"
            >
                <div className="space-y-4">
                    <p className="text-sm leading-6 text-slate-500">
                        Selecciona los asistentes o miembros que estaran vinculados a{" "}
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

                    {availableMembers.length ? (
                        <p className="text-xs text-slate-500">
                            {filteredMembers.length === availableMembers.length && !memberSearchTerm.trim()
                                ? `${availableMembers.length} personas disponibles`
                                : `${filteredMembers.length} resultado${filteredMembers.length === 1 ? "" : "s"} para "${memberSearchTerm.trim()}"`}
                        </p>
                    ) : null}

                    <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-2">
                        {filteredMembers.map((member) => {
                            const checked = selectedMemberIds.includes(member._id)

                            return (
                                <label
                                    key={member._id}
                                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                                        checked
                                            ? "border-blue-300 bg-blue-50"
                                            : "border-slate-200 bg-white hover:border-slate-300"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        className="mt-1"
                                        checked={checked}
                                        onChange={() => toggleMember(member._id)}
                                    />
                                    <div>
                                        <p className="font-medium text-slate-900">
                                            {member.firstName} {member.lastName}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            {member.role.name} · {member.documentID}
                                        </p>
                                    </div>
                                </label>
                            )
                        })}
                    </div>

                    {!availableMembers.length ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                            No hay asistentes o miembros disponibles para registrar.
                        </div>
                    ) : memberSearchTerm.trim() && !filteredMembers.length ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                            No encontramos personas con ese nombre o cédula.
                        </div>
                    ) : null}

                    {registerMembersMutation.isError ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {registerMembersMutation.error.message}
                        </div>
                    ) : null}

                    <Button
                        className="w-full"
                        color="primary"
                        isLoading={registerMembersMutation.isPending}
                        onPress={async () => {
                            if (!selectedAssignment) {
                                return
                            }

                            await registerMembersMutation.mutateAsync({
                                assignmentId: selectedAssignment._id,
                                memberIds: selectedMemberIds,
                            })
                        }}
                    >
                        Guardar miembros del curso
                    </Button>
                </div>
            </ModalView>
        </div>
    )
}
