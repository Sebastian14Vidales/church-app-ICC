import { useMemo } from "react";
import { Award, BookOpen, CalendarDays, Clock3, GraduationCap, MapPin, Trophy } from "lucide-react";

import {
    useAllCourses,
    useMyActiveCourseAssignments,
    useMyCourseAssignmentHistory,
} from "@/hooks/courses";
import { COURSE_LEVEL_LABELS } from "@/utils/constants/courses";
import { getLocationNameById } from "@/utils/constants/locations";
import type { CourseCatalog } from "@/types/index";

const formatAssignmentDate = (value: string) =>
    new Date(value).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });

export default function MyCoursesStudent() {
    const activeQuery = useMyActiveCourseAssignments();
    const historyQuery = useMyCourseAssignmentHistory();
    // AC6.4 (E-5): los "cursos faltantes" se calculan en el cliente restando
    // el catalogo menos las asignaciones (activas + historial) del miembro.
    const catalogQuery = useAllCourses({ page: 1, limit: 100 });

    const activeAssignments = useMemo(() => activeQuery.data ?? [], [activeQuery.data]);
    const currentAssignment = activeAssignments[0] ?? null;
    const trophies = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);

    const missingCourses = useMemo<CourseCatalog[]>(() => {
        const catalogItems = catalogQuery.data?.items ?? [];
        const covered = new Set<string>();
        activeAssignments.forEach((assignment) => covered.add(assignment.course._id));
        trophies.forEach((assignment) => covered.add(assignment.course._id));
        return catalogItems.filter((course) => !covered.has(course._id));
    }, [catalogQuery.data, activeAssignments, trophies]);

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
                            Revisa tu proceso de formacion y celebra tus cursos completados.
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                            Aqui encuentras tu curso en progreso, tus trofeos de formacion y los cursos que aun tienes pendientes.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-300">En progreso</p>
                            <p className="mt-3 text-3xl font-bold">{currentAssignment ? 1 : 0}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Completados</p>
                            <p className="mt-3 text-3xl font-bold">{trophies.length}</p>
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
                                {currentAssignment ? currentAssignment.course.name : "Sin curso activo"}
                            </h2>
                        </div>
                        <Award className="h-5 w-5 text-slate-400" />
                    </div>

                    {currentAssignment ? (
                        <div className="mt-5 space-y-3 text-sm text-slate-600">
                            <p className="font-medium text-slate-900">{currentAssignment.course.description}</p>
                            <p className="flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 text-slate-400" />
                                {formatAssignmentDate(currentAssignment.startDate)} a {formatAssignmentDate(currentAssignment.endDate)}
                            </p>
                            <p className="flex items-center gap-2">
                                <Clock3 className="h-4 w-4 text-slate-400" />
                                {currentAssignment.startTime} · {currentAssignment.totalClasses} clases
                            </p>
                            <p className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-slate-400" />
                                {getLocationNameById(currentAssignment.location)}
                            </p>
                            <p className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-slate-400" />
                                Nivel {COURSE_LEVEL_LABELS[currentAssignment.course.level] ?? currentAssignment.course.level}
                            </p>
                        </div>
                    ) : (
                        <p className="mt-5 text-sm text-slate-500">
                            Aun no tienes un curso activo asignado.
                        </p>
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
                        {trophies.length ? (
                            trophies.map((assignment) => (
                                <div key={assignment._id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                    <p className="font-semibold text-slate-900">{assignment.course.name}</p>
                                    <p className="mt-1 text-sm text-slate-600">
                                        Completado · {formatAssignmentDate(assignment.endDate)}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-slate-500">
                                Aun no has completado cursos. Aqui apareceran tus trofeos.
                            </p>
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
                        <p className="text-sm text-slate-500">
                            Ya recorriste todos los cursos del catalogo actual.
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
}