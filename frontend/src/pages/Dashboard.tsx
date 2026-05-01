import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  HeartHandshake,
  Mail,
  MapPin,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from "@heroui/react";
import type { Swiper as SwiperType } from "swiper";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { toast } from "react-toastify";
import { getAllCourses, getCourseAssignments } from "@/api/CourseAPI";
import { getAllEvents } from "@/api/EventAPI";
import { getMyLifeGroups } from "@/api/LifeGroupAPI";
import { getAllMembers } from "@/api/MemberAPI";
import {
  createSermon,
  deleteSermon,
  getAllSermons,
  type CreateSermonData,
  type Sermon,
  updateSermon,
} from "@/api/SermonAPI";
import { useAuth } from "@/lib/auth";
import { COURSE_LEVEL_LABELS, COURSE_STATUS_LABELS } from "@/utils/constants/courses";
import { getLocationNameById } from "@/utils/constants/locations";
import { roleLabels } from "@/utils/constants/roleColors";
import PATHS from "@/utils/constants/routes";
import { formatFullName } from "@/utils/text";
import "swiper/css";

const pluralize = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

type SermonFormValues = CreateSermonData;

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSupervisorOnly =
    user?.roles.includes("Supervisor") &&
    !user.roles.some((role) => ["Admin", "Superadmin", "Profesor", "Pastor"].includes(role));
  const hasCompactSidebar = user?.roles.includes("Profesor") ?? false;
  const coursesPath = hasCompactSidebar ? PATHS.myCourses : PATHS.courses;
  const coursesLinkLabel = hasCompactSidebar ? "Ver mis cursos" : "Administrar cursos";
  const isAdmin = user?.roles.includes("Admin") || user?.roles.includes("Superadmin");

  const [isSermonModalOpen, setIsSermonModalOpen] = useState(false);
  const [editingSermon, setEditingSermon] = useState<Sermon | null>(null);
  const [eventSlideIndex, setEventSlideIndex] = useState(0);
  const [coursesSwiper, setCoursesSwiper] = useState<SwiperType | null>(null);
  const [courseSlideIndex, setCourseSlideIndex] = useState(0);

  const sermonForm = useForm<SermonFormValues>({
    defaultValues: {
      title: "",
      date: "",
      time: "",
      pastor: "",
      description: "",
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: getAllMembers,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: getAllCourses,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["courseAssignments"],
    queryFn: getCourseAssignments,
  });

  const { data: sermons = [] } = useQuery({
    queryKey: ["sermons"],
    queryFn: getAllSermons,
    enabled: Boolean(isAdmin),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: getAllEvents,
    enabled: Boolean(isAdmin),
  });

  const { data: lifeGroups = [] } = useQuery({
    queryKey: ["lifeGroups"],
    queryFn: getMyLifeGroups,
    enabled: Boolean(isSupervisorOnly),
  });

  const invalidateSermons = () => {
    queryClient.invalidateQueries({ queryKey: ["sermons"] });
    queryClient.invalidateQueries({ queryKey: ["mySermons"] });
  };

  const createSermonMutation = useMutation({
    mutationFn: createSermon,
    onSuccess: () => {
      toast.success("Predica programada exitosamente");
      sermonForm.reset();
      setIsSermonModalOpen(false);
      invalidateSermons();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al programar la predica");
    },
  });

  const updateSermonMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateSermonData> }) =>
      updateSermon(id, payload),
    onSuccess: () => {
      toast.success("Predica actualizada correctamente");
      sermonForm.reset();
      setEditingSermon(null);
      setIsSermonModalOpen(false);
      invalidateSermons();
    },
    onError: (error: Error) => {
      toast.error(error.message || "No se pudo actualizar la predica");
    },
  });

  const deleteSermonMutation = useMutation({
    mutationFn: deleteSermon,
    onSuccess: () => {
      toast.success("Predica eliminada correctamente");
      invalidateSermons();
    },
    onError: (error: Error) => {
      toast.error(error.message || "No se pudo eliminar la predica");
    },
  });

  const pastors = members.filter((member) => member.role.name === "Pastor" && member.user?._id);
  const activeAssignments = assignments.filter((assignment) => assignment.status === "active");
  const professors = members.filter((member) => member.role.name === "Profesor");
  const professorsAvailable = professors.filter(
    (professor) => !activeAssignments.some((assignment) => assignment.professor._id === professor._id),
  );
  const baptizedMembers = members.filter((member) => member.baptized).length;
  const membersServing = members.filter((member) => member.servesInMinistry).length;
  const membersWithAccess = members.filter((member) => member.user?.email).length;
  const accessCoverage = members.length ? Math.round((membersWithAccess / members.length) * 100) : 0;
  const baptizedCoverage = members.length ? Math.round((baptizedMembers / members.length) * 100) : 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingSermons = useMemo(
    () =>
      sermons
        .filter((sermon) => new Date(sermon.date).getTime() >= today.getTime())
        .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()),
    [sermons, today],
  );
  const scheduledSermons = useMemo(
    () =>
      [...sermons].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()),
    [sermons],
  );

  const activeSchedule = [...activeAssignments]
    .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())
    .slice(0, 4);

  const roleSummary = members.reduce<Record<string, number>>((accumulator, member) => {
    const label = roleLabels[member.role.name as keyof typeof roleLabels] ?? member.role.name;
    accumulator[label] = (accumulator[label] ?? 0) + 1;
    return accumulator;
  }, {});

  const roleDistribution = Object.entries(roleSummary).sort((left, right) => right[1] - left[1]);

  const eventInsights = useMemo(() => {
    const sortedEvents = [...events].sort(
      (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
    );

    return {
      carouselEvents: sortedEvents,
      totalCollected: events.reduce((sum, event) => sum + event.summary.paidTotal, 0),
      totalPending: events.reduce((sum, event) => sum + event.summary.pendingTotal, 0),
      totalRegistrations: events.reduce((sum, event) => sum + event.summary.registeredCount, 0),
    };
  }, [events, today]);

  const courseSlides = useMemo(() => {
    const groupedCourses: typeof courses[] = [];

    for (let index = 0; index < courses.length; index += 2) {
      groupedCourses.push(courses.slice(index, index + 2));
    }

    return groupedCourses;
  }, [courses]);

  const hasMultipleUpcomingEvents = eventInsights.carouselEvents.length > 1;
  const hasMultipleCourses = courseSlides.length > 1;
  const activeDashboardEvent =
    eventInsights.carouselEvents[eventSlideIndex] ?? eventInsights.carouselEvents[0] ?? null;

  const statCards = [
    {
      label: "Miembros activos",
      value: members.length,
      description: pluralize(members.length, "persona registrada", "personas registradas"),
      icon: Users,
      accent: "from-sky-500 to-blue-600",
    },
    {
      label: "Cursos activos",
      value: activeAssignments.length,
      description: pluralize(activeAssignments.length, "curso en marcha", "cursos en marcha"),
      icon: BookOpen,
      accent: "from-emerald-500 to-teal-600",
    },
    {
      label: "Profesores disponibles",
      value: professorsAvailable.length,
      description: `${professors.length} profesores registrados`,
      icon: UserCheck,
      accent: "from-amber-400 to-orange-500",
    },
    {
      label: "Sirviendo en ministerio",
      value: membersServing,
      description: pluralize(membersServing, "miembro activo", "miembros activos"),
      icon: TrendingUp,
      accent: "from-fuchsia-500 to-rose-500",
    },
  ];

  const openCreateSermonModal = () => {
    setEditingSermon(null);
    sermonForm.reset({
      title: "",
      date: "",
      time: "",
      pastor: "",
      description: "",
    });
    setIsSermonModalOpen(true);
  };

  const openEditSermonModal = (sermon: Sermon) => {
    setEditingSermon(sermon);
    sermonForm.reset({
      title: sermon.title,
      date: sermon.date.slice(0, 10),
      time: sermon.time,
      pastor: sermon.pastor._id,
      description: sermon.description ?? "",
    });
    setIsSermonModalOpen(true);
  };

  const submitSermon = sermonForm.handleSubmit((values) => {
    if (editingSermon) {
      updateSermonMutation.mutate({
        id: editingSermon._id,
        payload: values,
      });
      return;
    }

    createSermonMutation.mutate(values);
  });

  if (isSupervisorOnly) {
    const membersInCoverage = members.filter((member) =>
      ["Asistente", "Miembro"].includes(member.role.name),
    );

    return (
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-300/40 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.24),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(249,115,22,0.2),_transparent_28%)]" />
          <div className="relative grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
                <Sparkles className="h-3.5 w-3.5" />
                Cobertura del supervisor
              </div>
              <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
                Gestiona tu comunidad y acompaña cada grupo de vida con claridad.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Desde aquí puedes registrar asistentes y miembros, y seguir tu cobertura.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to={PATHS.members}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                >
                  Registrar personas
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to={PATHS.lifeGroups}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Ir a mi cobertura
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Grupos de vida</p>
                <p className="mt-3 text-3xl font-bold">{lifeGroups.length}</p>
                <p className="mt-2 text-sm text-slate-300">
                  {lifeGroups.length === 1 ? "grupo bajo tu cuidado" : "grupos bajo tu cuidado"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Personas registrables</p>
                <p className="mt-3 text-3xl font-bold">{membersInCoverage.length}</p>
                <p className="mt-2 text-sm text-slate-300">Asistentes y miembros disponibles</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Personas</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Registro permitido</h2>
              </div>
              <Users className="h-5 w-5 text-slate-400" />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Como supervisor, puedes crear y editar únicamente perfiles con rol
              <span className="font-semibold text-slate-900"> Asistente </span>o
              <span className="font-semibold text-slate-900"> Miembro</span>.
            </p>
            <Link
              to={PATHS.members}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Ir a miembros
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Mi cobertura</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Seguimiento rápido</h2>
              </div>
              <HeartHandshake className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-6 space-y-4">
              {lifeGroups.length ? (
                lifeGroups.slice(0, 3).map((lifeGroup) => (
                  <div key={lifeGroup._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-900">{lifeGroup.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{lifeGroup.neighborhood}</p>
                    <p className="mt-2 text-sm text-slate-600">{lifeGroup.address}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Aún no has creado grupos de vida.</p>
              )}
            </div>
            <Link
              to={PATHS.lifeGroups}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Administrar cobertura
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-300/40 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.28),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.22),_transparent_28%)]" />
        <div className="relative grid gap-8 xl:grid-cols-[1.3fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
              <Sparkles className="h-3.5 w-3.5" />
              Visión general
            </div>
            <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
              Un panel más claro para seguir el pulso de la iglesia.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Consulta miembros, cursos activos, accesos creados, agenda ministerial y eventos desde un solo lugar.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={PATHS.members}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
              >
                Ver miembros
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={coursesPath}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {coursesLinkLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Accesos creados</p>
              <p className="mt-3 text-3xl font-bold">{accessCoverage}%</p>
              <p className="mt-2 text-sm text-slate-300">
                {pluralize(membersWithAccess, "miembro con correo", "miembros con correo")}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Bautizados</p>
              <p className="mt-3 text-3xl font-bold">{baptizedCoverage}%</p>
              <p className="mt-2 text-sm text-slate-300">
                {pluralize(baptizedMembers, "persona bautizada", "personas bautizadas")}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Catálogo de cursos</p>
              <p className="mt-3 text-3xl font-bold">{courses.length}</p>
              <p className="mt-2 text-sm text-slate-300">
                {pluralize(courses.length, "curso disponible", "cursos disponibles")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <article
            key={stat.label}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{stat.value}</p>
                <p className="mt-2 text-sm text-slate-500">{stat.description}</p>
              </div>
              <div className={`rounded-2xl bg-gradient-to-br ${stat.accent} p-3 text-white shadow-lg`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </article>
        ))}
      </section>

      {isAdmin ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Ministerio</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Agenda de prédicas</h2>
              <p className="mt-2 text-sm text-slate-500">
                Aquí ves tanto las próximas prédicas como la lista general ya asignada.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white"
              startContent={<BookOpen className="h-4 w-4" />}
              onPress={openCreateSermonModal}
            >
              Agendar prédica
            </Button>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Próximas prédicas</h3>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {pendingSermons.length} pendientes
                </span>
              </div>
              <div className="space-y-4">
                {pendingSermons.length ? (
                  pendingSermons.slice(0, 6).map((sermon) => (
                    <div key={sermon._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">{sermon.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {new Date(sermon.date).toLocaleDateString("es-CO", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}{" "}
                            · {sermon.time}
                          </p>
                        </div>
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          {sermon.pastor?.name ?? "Pastor"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">{sermon.description || "Sin descripción adicional"}</p>
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" variant="flat" startContent={<Edit3 className="h-4 w-4" />} onPress={() => openEditSermonModal(sermon)}>
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          color="danger"
                          variant="light"
                          startContent={<Trash2 className="h-4 w-4" />}
                          onPress={() => deleteSermonMutation.mutate(sermon._id)}
                          isLoading={deleteSermonMutation.isPending}
                        >
                          Borrar
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                    No hay prédicas futuras, pero abajo sigue visible la lista asignada.
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Lista general asignada</h3>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {scheduledSermons.length} registradas
                </span>
              </div>
              <div className="space-y-3">
                {scheduledSermons.length ? (
                  scheduledSermons.slice(0, 8).map((sermon) => (
                    <div key={`${sermon._id}-list`} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{sermon.title}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {new Date(sermon.date).toLocaleDateString("es-CO")} · {sermon.time}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {sermon.pastor?.name ?? "Pastor"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                    Aún no hay prédicas registradas.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Agenda de cursos</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Cursos en desarrollo</h2>
            </div>
            <Link to={coursesPath} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              Ver todo
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {activeSchedule.length ? (
              activeSchedule.map((assignment) => (
                <div key={assignment._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{assignment.course.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatFullName(assignment.professor.firstName, assignment.professor.lastName)}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {COURSE_STATUS_LABELS[assignment.status] ?? assignment.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      {new Date(assignment.startDate).toLocaleDateString("es-CO")} a{" "}
                      {new Date(assignment.endDate).toLocaleDateString("es-CO")}
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
                      Nivel {COURSE_LEVEL_LABELS[assignment.course.level] ?? assignment.course.level}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                Aún no hay cursos activos asignados.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Panorama de la comunidad</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Distribución de roles</h2>

          <div className="mt-6 space-y-4">
            {roleDistribution.length ? (
              roleDistribution.map(([role, total]) => {
                const width = members.length ? Math.max((total / members.length) * 100, 8) : 0;

                return (
                  <div key={role}>
                    <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                      <span>{role}</span>
                      <span className="font-semibold text-slate-900">{total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">No hay miembros registrados.</p>
            )}
          </div>

          <div className="mt-8 rounded-2xl bg-slate-950 p-5 text-white">
            <p className="text-sm font-semibold text-slate-200">Seguimiento rápido</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-300">
                  <Mail className="h-4 w-4" />
                  Miembros con correo
                </span>
                <span className="font-semibold">{membersWithAccess}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Bautizados
                </span>
                <span className="font-semibold">{baptizedMembers}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-300">
                  <UserCheck className="h-4 w-4" />
                  Profesores libres
                </span>
                <span className="font-semibold">{professorsAvailable.length}</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Eventos</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Recaudo y ocupación</h2>
            </div>
            <Link to={PATHS.events} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              Ir a eventos
            </Link>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Inscritos</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {activeDashboardEvent?.summary.registeredCount ?? 0}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Recaudado</p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {CURRENCY_FORMATTER.format(activeDashboardEvent?.summary.paidTotal ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Pendiente</p>
              <p className="mt-2 text-lg font-bold text-rose-600">
                {CURRENCY_FORMATTER.format(activeDashboardEvent?.summary.pendingTotal ?? 0)}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {eventInsights.carouselEvents.length ? (
              <Swiper
                modules={[Autoplay]}
                spaceBetween={16}
                slidesPerView={1}
                loop={hasMultipleUpcomingEvents}
                speed={900}
                onSlideChange={(swiper) => setEventSlideIndex(swiper.realIndex)}
                autoplay={
                  hasMultipleUpcomingEvents
                    ? {
                        delay: 2600,
                        disableOnInteraction: false,
                      }
                    : false
                }
              >
                {eventInsights.carouselEvents.map((event) => (
                  <SwiperSlide key={event._id}>
                    <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{event.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {new Date(event.date).toLocaleDateString("es-CO")} · {event.time}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {event.summary.registeredCount}/{event.capacity}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      {event.place}
                    </span>
                    <span className="flex items-center gap-2">
                      <BadgeDollarSign className="h-4 w-4 text-slate-400" />
                      {CURRENCY_FORMATTER.format(event.summary.paidTotal)} cobrados
                    </span>
                  </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            ) : (
              <p className="text-sm text-slate-500">Aún no hay eventos próximos registrados.</p>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Formación</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Catálogo de cursos</h2>
            </div>
            <div className="flex items-center gap-2">
              {hasMultipleCourses ? (
                <>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    aria-label="Curso anterior"
                    onPress={() => coursesSwiper?.slidePrev()}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    aria-label="Siguiente curso"
                    onPress={() => coursesSwiper?.slideNext()}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
              <Link to={coursesPath} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                {hasCompactSidebar ? "Ir a mis cursos" : "Ir a cursos"}
              </Link>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {courseSlides.length ? (
              <>
                <Swiper
                  spaceBetween={16}
                  slidesPerView={1}
                  onSwiper={setCoursesSwiper}
                  onSlideChange={(swiper) => setCourseSlideIndex(swiper.realIndex)}
                >
                  {courseSlides.map((courseGroup, groupIndex) => (
                    <SwiperSlide key={`course-group-${groupIndex}`}>
                      <div className="space-y-4">
                        {courseGroup.map((course) => (
                          <div key={course._id} className="rounded-2xl border border-slate-200 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">{course.name}</p>
                                <p className="mt-1 text-sm text-slate-500">
                                  {course.description.length > 90 ? `${course.description.slice(0, 90)}...` : course.description}
                                </p>
                              </div>
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                {COURSE_LEVEL_LABELS[course.level] ?? course.level}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </SwiperSlide>
                  ))}
                </Swiper>
                {hasMultipleCourses ? (
                  <p className="text-right text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                    {courseSlideIndex + 1} / {courseSlides.length}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-slate-500">No hay cursos creados.</p>
            )}
          </div>
        </article>
      </section>

      <Modal isOpen={isSermonModalOpen} onOpenChange={setIsSermonModalOpen}>
        <ModalContent>
          <form onSubmit={submitSermon}>
            <ModalHeader>{editingSermon ? "Editar prédica" : "Programar prédica"}</ModalHeader>
            <ModalBody className="space-y-3">
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                placeholder="Título de la prédica"
                {...sermonForm.register("title", { required: true })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  {...sermonForm.register("date", { required: true })}
                />
                <input
                  type="time"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  {...sermonForm.register("time", { required: true })}
                />
              </div>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                {...sermonForm.register("pastor", { required: true })}
              >
                <option value="">Selecciona un pastor</option>
                {pastors.map((pastor) => (
                  <option key={pastor.user!._id} value={pastor.user!._id}>
                    {formatFullName(pastor.firstName, pastor.lastName)}
                  </option>
                ))}
              </select>
              <Textarea placeholder="Descripción opcional" {...sermonForm.register("description")} />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setIsSermonModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white"
                isLoading={createSermonMutation.isPending || updateSermonMutation.isPending}
              >
                {editingSermon ? "Guardar cambios" : "Programar"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
