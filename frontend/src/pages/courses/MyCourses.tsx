import { useMemo, useState } from "react";
import { Button, Checkbox, Input } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, BookOpen, CalendarDays, Clock3, GraduationCap, MapPin, Search, Trophy } from "lucide-react";
import ModalView from "@/components/dashboard/ModalView";
import { getAllCourses, getMyCourseAssignments, updateCourseMembers } from "@/api/CourseAPI";
import { getAllMembers } from "@/api/MemberAPI";
import { useAuth } from "@/lib/auth";
import { type CourseAssigned } from "@/types/index";
import { COURSE_LEVEL_LABELS, COURSE_STATUS_LABELS } from "@/utils/constants/courses";
import { getLocationNameById } from "@/utils/constants/locations";
import { formatFullName, normalizeSearchText } from "@/utils/text";

const formatAssignmentDate = (value: string) =>
  new Date(value).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function MyCourses() {
  const { user } = useAuth();
  const isProfessor = user?.roles.includes("Profesor") ?? false;
  const queryClient = useQueryClient();
  const [selectedAssignment, setSelectedAssignment] = useState<CourseAssigned | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState("");

  const { data: assignments = [], isLoading, isError: isAssignmentsError, error: assignmentsError } = useQuery({
    queryKey: ["myCourses"],
    queryFn: getMyCourseAssignments,
  });

  const { data: courseCatalog = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: getAllCourses,
    enabled: !isProfessor,
  });

  const { data: members = [], isError: isMembersError, error: membersError } = useQuery({
    queryKey: ["members"],
    queryFn: getAllMembers,
    enabled: isProfessor,
  });

  const registerMembersMutation = useMutation({
    mutationFn: ({ assignmentId, memberIds }: { assignmentId: string; memberIds: string[] }) =>
      updateCourseMembers(assignmentId, memberIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myCourses"] });
      queryClient.invalidateQueries({ queryKey: ["courseAssignments"] });
      setSelectedAssignment(null);
      setSelectedMemberIds([]);
    },
  });

  const availableMembers = useMemo(
    () => members.filter((member) => ["Asistente", "Miembro"].includes(member.role.name)),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const normalizedSearchTerm = normalizeSearchText(memberSearchTerm);

    if (!normalizedSearchTerm) {
      return availableMembers;
    }

    return availableMembers.filter((member) => {
      const fullName = normalizeSearchText(`${member.firstName} ${member.lastName}`);
      const documentID = normalizeSearchText(member.documentID);

      return fullName.includes(normalizedSearchTerm) || documentID.includes(normalizedSearchTerm);
    });
  }, [availableMembers, memberSearchTerm]);

  const openMembersModal = (assignment: CourseAssigned) => {
    setSelectedAssignment(assignment);
    setSelectedMemberIds(assignment.members.map((member) => member._id));
    setMemberSearchTerm("");
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  };

  const activeAssignment = useMemo(
    () => (!isProfessor ? assignments.find((assignment) => assignment.status === "active") ?? null : null),
    [assignments, isProfessor],
  );

  const completedAssignments = useMemo(
    () => (!isProfessor ? assignments.filter((assignment) => assignment.status === "completed") : []),
    [assignments, isProfessor],
  );

  const missingCourses = useMemo(() => {
    if (isProfessor) {
      return [];
    }

    const coveredCourseIds = new Set(assignments.map((assignment) => assignment.course._id));
    return courseCatalog.filter((course) => !coveredCourseIds.has(course._id));
  }, [assignments, courseCatalog, isProfessor]);

  if (isLoading) {
    return <h1>Cargando cursos...</h1>;
  }

  if (isAssignmentsError) {
    return <h1>{assignmentsError.message}</h1>;
  }

  if (isProfessor && isMembersError) {
    return <h1>{membersError.message}</h1>;
  }

  if (!isProfessor) {
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
                Revisa tu proceso de formación y celebra tus cursos completados.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Aquí encuentras tu curso en progreso, tus trofeos de formación y los cursos que aún tienes pendientes.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">En progreso</p>
                <p className="mt-3 text-3xl font-bold">{activeAssignment ? 1 : 0}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Completados</p>
                <p className="mt-3 text-3xl font-bold">{completedAssignments.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Faltantes</p>
                <p className="mt-3 text-3xl font-bold">{missingCourses.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Curso actual</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {activeAssignment ? activeAssignment.course.name : "Sin curso activo"}
                </h2>
              </div>
              <Award className="h-5 w-5 text-slate-400" />
            </div>

            {activeAssignment ? (
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <p className="font-medium text-slate-900">{activeAssignment.course.description}</p>
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
                <p className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-slate-400" />
                  Nivel {COURSE_LEVEL_LABELS[activeAssignment.course.level] ?? activeAssignment.course.level}
                </p>
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500">Aún no tienes un curso activo asignado.</p>
            )}
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Trofeos</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Cursos completados</h2>
              </div>
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>

            <div className="mt-5 space-y-3">
              {completedAssignments.length ? (
                completedAssignments.map((assignment) => (
                  <div key={assignment._id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="font-semibold text-slate-900">{assignment.course.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Completado · {formatAssignmentDate(assignment.endDate)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Aún no has completado cursos. Aquí aparecerán tus trofeos.</p>
              )}
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Ruta pendiente</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Cursos faltantes</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {missingCourses.length ? (
              missingCourses.map((course) => (
                <div key={course._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">{course.name}</p>
                  <p className="mt-2 text-sm text-slate-600">{course.description}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Ya recorriste todos los cursos del catálogo actual.</p>
            )}
          </div>
        </section>
      </div>
    );
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
              Consulta tus cursos asignados y registra participantes.
            </h1>
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
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">{assignment.course.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{assignment.course.description}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {COURSE_LEVEL_LABELS[assignment.course.level] ?? assignment.course.level}
                </span>
              </div>

              <div className="mt-6 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                <p className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  {formatAssignmentDate(assignment.startDate)} a {formatAssignmentDate(assignment.endDate)}
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
                  Profesor: {formatFullName(assignment.professor.firstName, assignment.professor.lastName)}
                </p>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Miembros del curso</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {assignment.members.length
                        ? `${assignment.members.length} registrados`
                        : "Aún no has registrado miembros en este curso"}
                    </p>
                  </div>
                  <Button
                    color="primary"
                    variant="flat"
                    isDisabled={assignment.status !== "active"}
                    onPress={() => openMembersModal(assignment)}
                  >
                    {assignment.status === "active" ? "Registrar miembros" : "Curso cerrado"}
                  </Button>
                </div>

                {assignment.members.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {assignment.members.map((member) => (
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
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm shadow-slate-200/70">
          <h2 className="text-2xl font-semibold text-slate-900">No hay cursos asignados</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Cuando se te asigne un curso lo verás aquí con su calendario y ubicación.
          </p>
        </section>
      )}

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
            Selecciona los asistentes o miembros que estarán vinculados a{" "}
            <span className="font-semibold text-slate-900">
              {selectedAssignment?.course.name ?? "este curso"}
            </span>.
          </p>

          <Input
            isClearable
            value={memberSearchTerm}
            onValueChange={setMemberSearchTerm}
            placeholder="Buscar por nombre o cédula"
            startContent={<Search className="h-4 w-4 text-slate-400" />}
            variant="bordered"
          />

          <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-2">
            {filteredMembers.map((member) => {
              const checked = selectedMemberIds.includes(member._id);

              return (
                <label
                  key={member._id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                    checked
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <Checkbox isSelected={checked} onValueChange={() => toggleMember(member._id)} className="mt-1" />
                  <div>
                    <p className="font-medium text-slate-900">{formatFullName(member.firstName, member.lastName)}</p>
                    <p className="text-sm text-slate-500">
                      {member.role.name} · {member.documentID}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          <Button
            className="w-full"
            color="primary"
            isLoading={registerMembersMutation.isPending}
            onPress={async () => {
              if (!selectedAssignment) {
                return;
              }

              await registerMembersMutation.mutateAsync({
                assignmentId: selectedAssignment._id,
                memberIds: selectedMemberIds,
              });
            }}
          >
            Guardar miembros del curso
          </Button>
        </div>
      </ModalView>
    </div>
  );
}
