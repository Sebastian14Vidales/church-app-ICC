import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import PATHS from "@/utils/constants/routes"

type RequireAuthProps = {
    allowedRoles?: string[]
}

const FullScreenMessage = ({ message }: { message: string }) => (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="rounded-3xl bg-white px-8 py-10 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-500">{message}</p>
        </div>
    </div>
)

export function RequireAuth({ allowedRoles }: RequireAuthProps) {
    const { isAuthenticated, isBootstrapping, user } = useAuth()
    const location = useLocation()

    if (isBootstrapping) {
        return <FullScreenMessage message="Validando sesion..." />
    }

    if (!isAuthenticated || !user) {
        return <Navigate to={PATHS.login} replace state={{ from: location }} />
    }

    if (allowedRoles && !user.roles.some((role) => allowedRoles.includes(role))) {
        return <Navigate to={PATHS.dashboard} replace />
    }

    return <Outlet />
}

export function GuestOnly() {
    const { isAuthenticated, isBootstrapping } = useAuth()

    if (isBootstrapping) {
        return <FullScreenMessage message="Cargando..." />
    }

    if (isAuthenticated) {
        return <Navigate to={PATHS.dashboard} replace />
    }

    return <Outlet />
}
