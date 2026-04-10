import { useQuery, useMutation } from "@tanstack/react-query";
import {
    ArrowRight,
    BookOpen,
    CalendarDays,
    CheckCircle2,
    Clock3,
    HeartHandshake,
    Mail,
    MapPin,
    Sparkles,
    TrendingUp,
    UserCheck,
    Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, Textarea, Select, SelectItem } from "@heroui/react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { getAllCourses, getCourseAssignments } from "@/api/CourseAPI";
import { getMyLifeGroups } from "@/api/LifeGroupAPI";
import { getAllMembers } from "@/api/MemberAPI";
import { createSermon, getAllSermons } from "@/api/SermonAPI";
import { useAuth } from "@/lib/auth";
import { COURSE_LEVEL_LABELS, COURSE_STATUS_LABELS } from "@/utils/constants/courses";
import { getLocationNameById } from "@/utils/constants/locations";
import { roleLabels } from "@/utils/constants/roleColors";
import PATHS from "@/utils/constants/routes";
import { formatFullName } from "@/utils/text";

const pluralize = (count: number, singular: string, plural: string) =>
    `${count} ${count === 1 ? singular : plural}`;

export default function Dashboard() {
    const { user } = useAuth()
    const isSupervisorOnly =
        user?.roles.includes("Supervisor") &&
        !user.roles.some((role) => ["Admin", "Superadmin", "Profesor", "Pastor"].includes(role))
    const hasCompactSidebar = user?.roles.includes("Profesor") ?? false
    const coursesPath = hasCompactSidebar ? PATHS.myCourses : PATHS.courses
    const coursesLinkLabel = hasCompactSidebar ? "Ver mis cursos" : "Administrar cursos"
    const isAdmin = user?.roles.includes("Admin") || user?.roles.includes("Superadmin");

    const [isSermonModalOpen, setIsSermonModalOpen] = useState(false);

    

    const { register: registerSermon, handleSubmit: handleSubmitSermon, reset: resetSermon, formState: { errors: errorsSermon } } = useForm({
        defaultValues: {
            title: "",
            date: "",
            time: "",
            pastor: "",
            description: "",
        },
    });

    const createSermonMutation = useMutation({
        mutationFn: createSermon,
        onSuccess: () => {
            toast.success("Prédica programada exitosamente");
            setIsSermonModalOpen(false);
            resetSermon();
        },
        onError: (error: any) => {
            toast.error(error.message || "Error al programar la prédica");
        },
    });

    const onSubmitSermon = (data: any) => {
        createSermonMutation.mutate(data);
    };
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
        enabled: isAdmin,
    });

    const { data: lifeGroups = [] } = useQuery({
        queryKey: ["lifeGroups"],
        queryFn: getMyLifeGroups,
        enabled: Boolean(isSupervisorOnly),
    })

    const pastors = members.filter((member) => member.role.name === "Pastor");
    const activeAssignments = assignments.filter((assignment) => assignment.status === "active");
    const professors = members.filter((member) => member.role.name === "Profesor");
    const professorsAvailable = professors.filter(
        (professor) => !activeAssignments.some((assignment) => assignment.professor._id === professor._id),
    );
    const baptizedMembers = members.filter((member) => member.baptized).length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pendingSermons = sermons
        .filter((sermon) => new Date(sermon.date).getTime() >= today.getTime())
        .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
    const membersServing = members.filter((member) => member.servesInMinistry).length;
    const membersWithAccess = members.filter((member) => member.user?.email).length;
    const accessCoverage = members.length ? Math.round((membersWithAccess / members.length) * 100) : 0;
    const baptizedCoverage = members.length ? Math.round((baptizedMembers / members.length) * 100) : 0;

    const roleSummary = members.reduce<Record<string, number>>((accumulator, member) => {
        const label = roleLabels[member.role.name as keyof typeof roleLabels] ?? member.role.name;
        accumulator[label] = (accumulator[label] ?? 0) + 1;
        return accumulator;
    }, {});

    const roleDistribution = Object.entries(roleSummary).sort((left, right) => right[1] - left[1]);
    const latestMembers = [...members].slice(-5).reverse();
    const activeSchedule = [...activeAssignments]
        .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())
        .slice(0, 4);

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

    if (isSupervisorOnly) {
        const membersInCoverage = members.filter((member) =>
            ["Asistente", "Miembro"].includes(member.role.name),
        )

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
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    Personas
                                </p>
                                <h2 className="mt-2 text-2xl font-bold text-slate-900">Registro permitido</h2>
                            </div>
                            <Users className="h-5 w-5 text-slate-400" />
                        </div>
                        <p className="mt-4 text-sm leading-6 text-slate-500">
                            Como supervisor, puedes crear y editar únicamente perfiles con rol
                            <span className="font-semibold text-slate-900"> Asistente </span>
                            o
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
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    Mi cobertura
                                </p>
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
        )
    }

    return (
        <div className="space-y-8">
            <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-300/40 sm:px-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.28),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.22),_transparent_28%)]" />
                <div className="relative grid gap-8 xl:grid-cols-[1.3fr_0.9fr]">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
                            <Sparkles className="h-3.5 w-3.5" />
                            Vision general
                        </div>
                        <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
                            Un panel mas claro para seguir el pulso de la iglesia.
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                            Consulta miembros, cursos activos, accesos creados y acompanamiento espiritual desde un solo lugar.
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
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Catalogo de cursos</p>
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

            {/* Programar Predicas - Solo para admins */}
            {isAdmin && (
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Ministerio
                            </p>
                            <h2 className="mt-2 text-2xl font-bold text-slate-900">Programar Predicas</h2>
                        </div>
                        <Button
                            size="sm"
                            className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white"
                            startContent={<BookOpen className="h-4 w-4" />}
                            onPress={() => setIsSermonModalOpen(true)}
                        >
                            Agendar Predica
                        </Button>
                    </div>

                    <div className="mt-6">
                        <p className="text-sm text-slate-500">
                            Aqui puedes programar las prédicas para los pastores de la iglesia.
                        </p>
                    </div>

                    <div className="mt-8">
                        <h3 className="text-lg font-semibold text-slate-900">Prédicas pendientes</h3>
                        {pendingSermons.length === 0 ? (
                            <p className="mt-3 text-sm text-slate-500">No hay prédicas pendientes en la agenda.</p>
                        ) : (
                            <div className="mt-4 space-y-3">
                                {pendingSermons.slice(0, 5).map((sermon) => (
                                    <div key={sermon._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <h4 className="font-semibold text-slate-900">{sermon.title}</h4>
                                                <p className="text-sm text-slate-500">
                                                    {new Date(sermon.date).toLocaleDateString("es-CO", {
                                                        day: "2-digit",
                                                        month: "long",
                                                        year: "numeric",
                                                    })} · {sermon.time}
                                                </p>
                                            </div>
                                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                                {sermon.pastor?.name ?? "Pastor"}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Agenda de cursos
                            </p>
                            <h2 className="mt-2 text-2xl font-bold text-slate-900">Cursos en desarrollo</h2>
                        </div>
                        <Link to={coursesPath} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                            Ver todo
                        </Link>
                    </div>

                    <div className="mt-6 space-y-4">
                        {activeSchedule.length ? (
                            activeSchedule.map((assignment) => (
                                <div
                                    key={assignment._id}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900">{assignment.course.name}</h3>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {formatFullName(
                                                    assignment.professor.firstName,
                                                    assignment.professor.lastName,
                                                )}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                            {COURSE_STATUS_LABELS[assignment.status] ?? assignment.status}
                                        </span>
                                    </div>

                                    <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
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
                                            Nivel {COURSE_LEVEL_LABELS[assignment.course.level] ?? assignment.course.level}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                                Aun no hay cursos activos asignados.
                            </div>
                        )}
                    </div>
                </article>

                <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Panorama de la comunidad
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">Distribucion de roles</h2>

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
                        <p className="text-sm font-semibold text-slate-200">Seguimiento rapido</p>
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
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Miembros
                            </p>
                            <h2 className="mt-2 text-2xl font-bold text-slate-900">Resumen de personas</h2>
                        </div>
                        <Link to={PATHS.members} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                            Ir a miembros
                        </Link>
                    </div>

                    <div className="mt-6 space-y-4">
                        {latestMembers.length ? (
                            latestMembers.map((member) => (
                                <div
                                    key={member._id}
                                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-slate-900">
                                            {formatFullName(member.firstName, member.lastName)}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {roleLabels[member.role.name as keyof typeof roleLabels] ?? member.role.name}
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                        {member.documentID}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-slate-500">No hay miembros registrados.</p>
                        )}
                    </div>
                </article>

                <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Formacion
                            </p>
                            <h2 className="mt-2 text-2xl font-bold text-slate-900">Catalogo de cursos</h2>
                        </div>
                        <Link to={coursesPath} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                            {hasCompactSidebar ? "Ir a mis cursos" : "Ir a cursos"}
                        </Link>
                    </div>

                    <div className="mt-6 space-y-4">
                        {courses.length ? (
                            courses.slice(0, 5).map((course) => (
                                <div key={course._id} className="rounded-2xl border border-slate-200 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-900">{course.name}</p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {course.description.length > 90
                                                    ? `${course.description.slice(0, 90)}...`
                                                    : course.description}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                            {COURSE_LEVEL_LABELS[course.level] ?? course.level}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-slate-500">No hay cursos creados.</p>
                        )}
                    </div>
                </article>
            </section>

            {/* Modal para programar prédica */}
            <Modal isOpen={isSermonModalOpen} onOpenChange={setIsSermonModalOpen}>
                <ModalContent>
                    <ModalHeader>Programar Predica</ModalHeader>
                    <form onSubmit={handleSubmitSermon(onSubmitSermon)}>
                        <ModalBody className="space-y-4">
                            <Input
                                label="Título de la prédica"
                                {...registerSermon("title", { required: "El título es obligatorio" })}
                                errorMessage={errorsSermon.title?.message}
                            />
                            <Input
                                label="Fecha"
                                type="date"
                                {...registerSermon("date", { required: "La fecha es obligatoria" })}
                                errorMessage={errorsSermon.date?.message}
                            />
                            <Input
                                label="Hora"
                                type="time"
                                {...registerSermon("time", { required: "La hora es obligatoria" })}
                                errorMessage={errorsSermon.time?.message}
                            />
                            <Select
                                label="Pastor"
                                {...registerSermon("pastor", { required: "Selecciona un pastor" })}
                                errorMessage={errorsSermon.pastor?.message}
                            >
                                {pastors.map((pastor) => (
                                    <SelectItem key={pastor.user?._id || pastor._id} >
                                        {formatFullName(pastor.firstName, pastor.lastName)}
                                    </SelectItem>
                                ))}
                            </Select>
                            <Textarea
                                label="Descripción (opcional)"
                                {...registerSermon("description")}
                            />
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={() => setIsSermonModalOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white"
                                isLoading={createSermonMutation.isPending}
                            >
                                Programar
                            </Button>
                        </ModalFooter>
                    </form>
                </ModalContent>
            </Modal>
        </div>
    );
}
