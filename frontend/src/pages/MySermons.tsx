import { BookOpen, CalendarDays, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getSermonsByPastor } from "@/api/SermonAPI";

export default function MySermons() {
    const { user } = useAuth();

    const { data: sermons = [], isLoading } = useQuery({
        queryKey: ["mySermons", user?.profileId ?? user?.id],
        queryFn: () => getSermonsByPastor(user?.profileId ?? user!.id),
        enabled: Boolean(user?.profileId ?? user?.id),
    });

    if (!user) {
        return <p>Cargando usuario...</p>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                    <BookOpen className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Mis Prédicas</h1>
                    <p className="text-sm text-slate-600">Aquí verás las prédicas agendadas a tu nombre.</p>
                </div>
            </div>

            {isLoading ? (
                <div>Cargando prédicas...</div>
            ) : sermons.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm shadow-slate-200/70">
                    <p className="text-lg font-semibold">Aún no tienes prédicas agendadas</p>
                    <p className="mt-2 text-sm">Cuando el administrador programe una prédica, aparecerá aquí.</p>
                </div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {sermons.map((sermon) => (
                        <div key={sermon._id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900">{sermon.title}</h2>
                                    <p className="mt-2 text-sm text-slate-500">{sermon.description || "Sin descripción adicional"}</p>
                                </div>
                                <div className="rounded-2xl bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                    {sermon.pastor?.name ?? "Pastor"}
                                </div>
                            </div>
                            <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                                <div className="flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4 text-slate-400" />
                                    {new Date(sermon.date).toLocaleDateString("es-CO", {
                                        day: "2-digit",
                                        month: "long",
                                        year: "numeric",
                                    })}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-slate-400" />
                                    {sermon.time}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
                <p className="text-sm">Si necesitas cambios en una prédica, contacta con el administrador para que actualice la agenda.</p>
            </div>
        </div>
    );
}
