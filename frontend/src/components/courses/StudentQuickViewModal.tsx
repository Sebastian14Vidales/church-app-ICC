import ModalView from "@/components/dashboard/ModalView"
import { type StudentAttendanceSummary } from "@/utils/attendanceInsights"
import { formatFullName } from "@/utils/text"

type StudentQuickViewModalProps = {
    summary: StudentAttendanceSummary | null
    onClose: () => void
}

const getStatusBadgeStyles = (present: boolean | null, isRecorded: boolean) => {
    if (!isRecorded) {
        return "bg-slate-100 text-slate-600"
    }

    if (present === true) {
        return "bg-emerald-100 text-emerald-700"
    }

    if (present === false) {
        return "bg-rose-100 text-rose-700"
    }

    return "bg-amber-100 text-amber-700"
}

const getStatusLabel = (present: boolean | null, isRecorded: boolean) => {
    if (!isRecorded) {
        return "Pendiente"
    }

    if (present === true) {
        return "Asistio"
    }

    if (present === false) {
        return "Falto"
    }

    return "Sin marcar"
}

export default function StudentQuickViewModal({
    summary,
    onClose,
}: StudentQuickViewModalProps) {
    return (
        <ModalView
            isOpen={Boolean(summary)}
            onClose={onClose}
            title="Vista rapida del estudiante"
            size="4xl"
            scrollBehavior="inside"
        >
            {summary ? (
                <div className="max-h-[72vh] space-y-6 overflow-y-auto pb-4 pr-2">
                    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    Estudiante del curso
                                </p>
                                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                                    {formatFullName(summary.member.firstName, summary.member.lastName)}
                                </h2>
                                <p className="mt-2 text-sm text-slate-500">
                                    {summary.member.role.name} · {summary.member.documentID}
                                </p>
                            </div>
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                {summary.attendanceRate}% asistencia
                            </span>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="rounded-2xl bg-white p-4 shadow-sm">
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Asistencias</p>
                                <p className="mt-2 text-2xl font-bold text-emerald-700">{summary.presentCount}</p>
                            </div>
                            <div className="rounded-2xl bg-white p-4 shadow-sm">
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Fallas</p>
                                <p className="mt-2 text-2xl font-bold text-rose-700">{summary.absentCount}</p>
                            </div>
                            <div className="rounded-2xl bg-white p-4 shadow-sm">
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Ultimo registro</p>
                                <p className="mt-2 text-lg font-bold text-slate-900">
                                    {summary.lastRecordedStatus === null
                                        ? "Sin historial"
                                        : summary.lastRecordedStatus
                                          ? "Asistio"
                                          : "Falto"}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <article className="rounded-3xl border border-slate-200 bg-white p-5">
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Datos de contacto
                            </p>
                            <div className="mt-4 space-y-3 text-sm text-slate-600">
                                <p>
                                    <span className="font-medium text-slate-900">Telefono:</span>{" "}
                                    {summary.member.phoneNumber || "Sin telefono"}
                                </p>
                                <p>
                                    <span className="font-medium text-slate-900">Correo:</span>{" "}
                                    {summary.member.user?.email ?? "Sin correo"}
                                </p>
                                <p>
                                    <span className="font-medium text-slate-900">Barrio:</span>{" "}
                                    {summary.member.neighborhood || "Sin barrio"}
                                </p>
                                <p>
                                    <span className="font-medium text-slate-900">Bautizado:</span>{" "}
                                    {summary.member.baptized ? "Si" : "No"}
                                </p>
                            </div>
                        </article>

                        <article className="rounded-3xl border border-slate-200 bg-white p-5">
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Seguimiento pastoral
                            </p>
                            <div className="mt-4 space-y-3 text-sm text-slate-600">
                                <p>
                                    <span className="font-medium text-slate-900">Crecimiento:</span>{" "}
                                    {summary.member.spiritualGrowthStage ?? "Sin definir"}
                                </p>
                                <p>
                                    <span className="font-medium text-slate-900">Ministerio:</span>{" "}
                                    {summary.member.ministry ?? "No aplica"}
                                </p>
                                <p>
                                    <span className="font-medium text-slate-900">Interes ministerial:</span>{" "}
                                    {summary.member.ministryInterest ?? "No aplica"}
                                </p>
                            </div>
                        </article>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    Historial por clase
                                </p>
                                <h3 className="mt-2 text-xl font-bold text-slate-900">
                                    Estado del estudiante en cada sesion
                                </h3>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                {summary.statuses.length} clase{summary.statuses.length === 1 ? "" : "s"}
                            </span>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {summary.statuses.map((status) => (
                                <article
                                    key={status.classNumber}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-900">
                                                Clase {status.classNumber}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {new Date(status.date).toLocaleDateString("es-CO")}
                                            </p>
                                        </div>
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeStyles(status.present, status.isRecorded)}`}
                                        >
                                            {getStatusLabel(status.present, status.isRecorded)}
                                        </span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                </div>
            ) : null}
        </ModalView>
    )
}
