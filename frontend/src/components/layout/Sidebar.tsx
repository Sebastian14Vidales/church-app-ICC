import logo from "@/assets/img/logo.png";
import { NavLink, useNavigate } from "react-router-dom";
import {
    BookOpen,
    Calendar,
    ClipboardCheck,
    DollarSign,
    Heart,
    Home,
    LogOut,
    BarChart3,
    Users,
} from "lucide-react";
import { getInitials, useAuth } from "@/lib/auth";
import PATHS from "@/utils/constants/routes";

export default function Sidebar() {
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const hasCompactSidebar = user?.roles.some((role) => ["Profesor", "Pastor"].includes(role)) ?? false
    const navigation = hasCompactSidebar
        ? [
              { name: "Dashboard", href: PATHS.dashboard, icon: Home },
              { name: "Mis cursos", href: PATHS.myCourses, icon: BookOpen },
              { name: "Asistencias", href: PATHS.attendance, icon: ClipboardCheck },
              { name: "Miembros", href: PATHS.members, icon: Users },
          ]
        : [
              { name: "Dashboard", href: PATHS.dashboard, icon: Home },
              { name: "Cursos", href: PATHS.courses, icon: BookOpen },
              { name: "Miembros", href: PATHS.members, icon: Users },
              { name: "Eventos", href: PATHS.events, icon: Calendar },
              { name: "Ofrendas", href: PATHS.offerings, icon: DollarSign },
              { name: "Grupos de Vida", href: PATHS.lifeGroups, icon: Heart },
              { name: "Reportes", href: PATHS.reports, icon: BarChart3 },
          ]

    const userInitials = getInitials(user?.name ?? "Usuario")
    const userRoleLabel = user?.roles.join(", ") ?? "Sesión activa"

    const handleLogout = () => {
        logout()
        navigate(PATHS.login, { replace: true })
    }

    return (
        <aside className="hidden h-screen w-72 shrink-0 border-r border-slate-800 bg-slate-950 lg:flex lg:flex-col">
            <div className="flex grow flex-col overflow-y-auto px-5 py-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-slate-950/30">
                    <div className="flex items-center gap-3">
                        <img
                            src={logo}
                            alt="Imagen de la iglesia"
                            className="h-10 w-10 rounded-full bg-white/95 p-1"
                        />
                        <div>
                            <h1 className="text-sm font-bold leading-5 text-white">
                                Iglesia Cruzada Cristiana Casa de Dios
                            </h1>
                            <p className="mt-1 text-xs text-slate-300">Panel administrativo</p>
                        </div>
                    </div>
                </div>

                <nav className="mt-8 flex flex-1 flex-col">
                    <ul className="space-y-2">
                        {navigation.map((item) => (
                            <li key={item.name}>
                                <NavLink
                                    to={item.href}
                                    className={({ isActive }) =>
                                        `group flex items-center gap-x-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all ${isActive
                                            ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
                                            : "text-slate-300 hover:bg-white/10 hover:text-white"
                                        }`
                                    }
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.name}
                                </NavLink>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-auto rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-blue-950 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-300 text-sm font-bold text-slate-900">
                                {userInitials}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white">{user?.name ?? "Usuario"}</p>
                                <p className="text-xs text-slate-300">{userRoleLabel}</p>
                            </div>
                        </div>

                        <button
                            className="mt-4 flex w-full items-center justify-center gap-x-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
                            onClick={handleLogout}
                            type="button"
                        >
                            <LogOut className="h-4 w-4" />
                            Cerrar sesión
                        </button>
                    </div>
                </nav>
            </div>
        </aside>
    );
}
