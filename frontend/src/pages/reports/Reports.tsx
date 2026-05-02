import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, BookOpen, CalendarDays, Coins, Users } from "lucide-react";
import { getCourseAssignments } from "@/api/CourseAPI";
import { getAllEvents } from "@/api/EventAPI";
import { COURSE_STATUS_LABELS } from "@/utils/constants/courses";
import { formatFullName } from "@/utils/text";

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function Reports() {
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ["courseAssignments"],
    queryFn: getCourseAssignments,
  });
  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ["events"],
    queryFn: getAllEvents,
  });

  const availableYears = useMemo(() => {
    const years = new Set<number>();

    assignments.forEach((assignment) => {
      years.add(new Date(assignment.endDate || assignment.startDate).getFullYear());
    });

    events.forEach((event) => {
      years.add(new Date(event.date).getFullYear());
    });

    return Array.from(years).filter((year) => !Number.isNaN(year)).sort((a, b) => b - a);
  }, [assignments, events]);

  const [selectedYear, setSelectedYear] = useState<string>("");
  const effectiveYear = selectedYear || String(availableYears[0] ?? new Date().getFullYear());

  const coursesByYear = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          String(new Date(assignment.endDate || assignment.startDate).getFullYear()) === effectiveYear,
      ),
    [assignments, effectiveYear],
  );

  const eventsByYear = useMemo(
    () => events.filter((event) => String(new Date(event.date).getFullYear()) === effectiveYear),
    [events, effectiveYear],
  );

  const courseSummary = useMemo(() => {
    const totalMembers = coursesByYear.reduce((sum, assignment) => sum + assignment.members.length, 0);
    const activeCount = coursesByYear.filter((assignment) => assignment.status === "active").length;
    const completedCount = coursesByYear.filter((assignment) => assignment.status === "completed").length;
    const cancelledCount = coursesByYear.filter((assignment) => assignment.status === "cancelled").length;

    return {
      total: coursesByYear.length,
      totalMembers,
      activeCount,
      completedCount,
      cancelledCount,
    };
  }, [coursesByYear]);

  const eventSummary = useMemo(() => {
    const registrations = eventsByYear.reduce((sum, event) => sum + event.summary.registeredCount, 0);
    const paidTotal = eventsByYear.reduce((sum, event) => sum + event.summary.paidTotal, 0);
    const pendingTotal = eventsByYear.reduce((sum, event) => sum + event.summary.pendingTotal, 0);

    return {
      total: eventsByYear.length,
      registrations,
      paidTotal,
      pendingTotal,
    };
  }, [eventsByYear]);

  if (isLoadingAssignments || isLoadingEvents) {
    return <h1>Cargando reportes...</h1>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reportes e Historial</h1>
          <p className="text-slate-600">
            Ubique la trazabilidad anual en reportes para separar el historial de la operacion diaria.
          </p>
        </div>

        <div className="min-w-44">
          <label htmlFor="report-year" className="mb-1 block text-sm font-medium text-slate-700">
            Año
          </label>
          <select
            id="report-year"
            value={effectiveYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {availableYears.length ? (
              availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))
            ) : (
              <option value={effectiveYear}>{effectiveYear}</option>
            )}
          </select>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Cursos del año</p>
              <p className="text-2xl font-bold text-slate-900">{courseSummary.total}</p>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Miembros en cursos</p>
              <p className="text-2xl font-bold text-slate-900">{courseSummary.totalMembers}</p>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Eventos realizados</p>
              <p className="text-2xl font-bold text-slate-900">{eventSummary.total}</p>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-fuchsia-50 p-3 text-fuchsia-700">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Recaudo eventos</p>
              <p className="text-2xl font-bold text-slate-900">{CURRENCY_FORMATTER.format(eventSummary.paidTotal)}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Historial academico</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Cursos impartidos en {effectiveYear}</h2>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {courseSummary.completedCount} completados
            </div>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Activos</p>
              <p className="mt-1 text-2xl font-bold">{courseSummary.activeCount}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Completados</p>
              <p className="mt-1 text-2xl font-bold">{courseSummary.completedCount}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Cancelados</p>
              <p className="mt-1 text-2xl font-bold">{courseSummary.cancelledCount}</p>
            </div>
          </div>

          <div className="space-y-3">
            {coursesByYear.length ? (
              coursesByYear.map((assignment) => (
                <div key={assignment._id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{assignment.course.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Profesor: {formatFullName(assignment.professor.firstName, assignment.professor.lastName)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {COURSE_STATUS_LABELS[assignment.status]}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                    <p>Inicio: {new Date(assignment.startDate).toLocaleDateString("es-CO")}</p>
                    <p>Cierre: {new Date(assignment.endDate).toLocaleDateString("es-CO")}</p>
                    <p>Miembros: {assignment.members.length}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                No hay cursos registrados para este año.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Historial ministerial</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Eventos realizados en {effectiveYear}</h2>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {eventSummary.registrations} registros
            </div>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Recaudado</p>
              <p className="mt-1 text-2xl font-bold">{CURRENCY_FORMATTER.format(eventSummary.paidTotal)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Pendiente</p>
              <p className="mt-1 text-2xl font-bold">{CURRENCY_FORMATTER.format(eventSummary.pendingTotal)}</p>
            </div>
          </div>

          <div className="space-y-3">
            {eventsByYear.length ? (
              eventsByYear.map((event) => (
                <div key={event._id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{event.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {new Date(event.date).toLocaleDateString("es-CO")} · {event.time}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {event.place}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                    <p>Inscritos: {event.summary.registeredCount}</p>
                    <p>Recaudado: {CURRENCY_FORMATTER.format(event.summary.paidTotal)}</p>
                    <p>Deuda: {CURRENCY_FORMATTER.format(event.summary.pendingTotal)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                No hay eventos registrados para este año.
              </div>
            )}
          </div>
        </article>
      </section>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
        <div className="flex items-start gap-3">
          <BarChart3 className="mt-0.5 h-5 w-5 text-slate-400" />
          <p className="text-sm">
            Este historial quedó en reportes porque sirve más como trazabilidad anual que como operación diaria.
          </p>
        </div>
      </div>
    </div>
  );
}
