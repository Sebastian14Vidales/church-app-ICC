import { BookOpen, Calendar, DollarSign, Heart, TrendingUp, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAllCourses, getCourseAssignments } from "@/api/CourseAPI";
import { getAllMembers } from "@/api/MemberAPI";
import { formatFullName } from "@/utils/text";
import { roleLabels } from "@/utils/constants/roleColors";

export default function Dashboard() {
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

    const activeAssignments = assignments.filter((assignment) => assignment.status === "active");

    const stats = [
        { name: "Miembros activos", value: members.length, icon: Users, color: "bg-blue-500" },
        { name: "Cursos activos", value: activeAssignments.length, icon: BookOpen, color: "bg-green-500" },
        { name: "Eventos proximos", value: 0, icon: Calendar, color: "bg-purple-500" },
        { name: "Grupos de vida", value: 0, icon: Heart, color: "bg-red-500" },
        { name: "Ofrendas del mes", value: 0, icon: DollarSign, color: "bg-yellow-500" },
    ];

    return (
        <div className="space-y-8">
            <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                <h1 className="mb-2 text-3xl font-bold">Panel Pastoral</h1>
                <p className="text-blue-100">
                    Iglesia Cruzada Cristiana Casa de Dios -{" "}
                    {new Date().toLocaleDateString("es-ES", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    })}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {stats.map((stat) => (
                    <div key={stat.name} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="p-6">
                            <div className="flex items-center">
                                <div className={`shrink-0 rounded-lg p-3 ${stat.color}`}>
                                    <stat.icon className="h-6 w-6 text-white" />
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-200 px-6 py-4">
                        <h3 className="text-lg font-semibold text-gray-900">Acciones rapidas</h3>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-2 gap-4">
                            <button className="flex cursor-pointer flex-col items-center rounded-lg bg-blue-50 p-4 transition-colors hover:bg-blue-100">
                                <Users className="mb-2 h-8 w-8 text-blue-600" />
                                <span className="text-sm font-medium text-blue-700">Nuevo miembro</span>
                            </button>
                            <button className="flex cursor-pointer flex-col items-center rounded-lg bg-green-50 p-4 transition-colors hover:bg-green-100">
                                <BookOpen className="mb-2 h-8 w-8 text-green-600" />
                                <span className="text-sm font-medium text-green-700">Crear curso</span>
                            </button>
                            <button className="flex cursor-pointer flex-col items-center rounded-lg bg-purple-50 p-4 transition-colors hover:bg-purple-100">
                                <Calendar className="mb-2 h-8 w-8 text-purple-600" />
                                <span className="text-sm font-medium text-purple-700">Nuevo evento</span>
                            </button>
                            <button className="flex cursor-pointer flex-col items-center rounded-lg bg-yellow-50 p-4 transition-colors hover:bg-yellow-100">
                                <TrendingUp className="mb-2 h-8 w-8 text-yellow-600" />
                                <span className="text-sm font-medium text-yellow-700">Ver reportes</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-200 px-6 py-4">
                        <h3 className="text-lg font-semibold text-gray-900">Proximos eventos</h3>
                    </div>
                    <div className="p-6">
                        <p className="py-4 text-center text-gray-500">No hay eventos proximos</p>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-200 px-6 py-4">
                        <h3 className="text-lg font-semibold text-gray-900">Miembros recientes</h3>
                    </div>
                    <div className="p-6">
                        {members.length ? (
                            members.slice(0, 5).map((member) => (
                                <div
                                    key={member._id}
                                    className="flex items-center justify-between border-b border-gray-100 py-3 last:border-b-0"
                                >
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {formatFullName(member.firstName, member.lastName)}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {roleLabels[member.role.name as keyof typeof roleLabels] ?? member.role.name}
                                        </p>
                                    </div>
                                    <p className="text-sm text-gray-500">{member.documentID}</p>
                                </div>
                            ))
                        ) : (
                            <p className="py-4 text-center text-gray-500">No hay miembros registrados</p>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-200 px-6 py-4">
                        <h3 className="text-lg font-semibold text-gray-900">Cursos creados</h3>
                    </div>
                    <div className="p-6">
                        {courses.length ? (
                            courses.slice(0, 5).map((course) => (
                                <div
                                    key={course._id}
                                    className="flex items-center justify-between border-b border-gray-100 py-3 last:border-b-0"
                                >
                                    <div>
                                        <p className="font-medium text-gray-900">{course.name}</p>
                                        <p className="text-sm text-gray-500">
                                            {course.description.length > 90
                                                ? `${course.description.slice(0, 90)}...`
                                                : course.description}
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-700">
                                        {course.level}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="py-4 text-center text-gray-500">No hay cursos creados</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
