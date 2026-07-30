import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import PATHS from "@/utils/constants/routes"

type RequireAuthProps = {
    allowedRoles?: string[]
}

export function RequireAuth({ allowedRoles }: RequireAuthProps) {
    const { isAuthenticated, isBootstrapping, user } = useAuth()
    const location = useLocation()

    if (isBootstrapping) {
        return <LoadingSpinner label="Validando sesion..." className="min-h-screen" />
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
        return <LoadingSpinner label="Cargando..." className="min-h-screen" />
    }

    if (isAuthenticated) {
        return <Navigate to={PATHS.dashboard} replace />
    }

    return <Outlet />
}
