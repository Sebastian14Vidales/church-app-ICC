import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import { getHomePathForRoles } from "@/lib/role-home"
import PATHS from "@/utils/constants/routes"

type RequireAuthProps = {
    allowedRoles?: string[]
}

export function RequireAuth({ allowedRoles }: RequireAuthProps) {
    const { isAuthenticated, isBootstrapping, user } = useAuth()
    const location = useLocation()

    if (isBootstrapping) {
        return <LoadingSpinner label="Validando sesion..." className="min-h-[40vh]" />
    }

    if (!isAuthenticated || !user) {
        return <Navigate to={PATHS.login} replace state={{ from: location }} />
    }

    if (allowedRoles && !user.roles.some((role) => allowedRoles.includes(role))) {
        return <Navigate to={getHomePathForRoles(user.roles)} replace />
    }

    return <Outlet />
}

export function GuestOnly() {
    const { isAuthenticated, isBootstrapping, user } = useAuth()

    if (isBootstrapping) {
        return <LoadingSpinner label="Cargando..." className="min-h-[40vh]" />
    }

    if (isAuthenticated) {
        return <Navigate to={getHomePathForRoles(user?.roles ?? [])} replace />
    }

    return <Outlet />
}
