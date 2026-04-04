import { useAuth } from "@/lib/auth"

export default function SessionOverlay() {
    const { isBootstrapping, isSessionTransitioning } = useAuth()
    const isVisible = isBootstrapping || isSessionTransitioning

    if (!isVisible) {
        return null
    }

    return (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/22 backdrop-blur-[2px]">
            <div className="flex min-w-56 flex-col items-center gap-4 rounded-[28px] border border-white/70 bg-white/90 px-8 py-7 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                <div className="relative h-12 w-12">
                    <div className="absolute inset-0 rounded-full border-4 border-amber-100" />
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-orange-600 border-r-amber-500" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-semibold text-slate-900">
                        {isBootstrapping ? "Validando sesión" : "Actualizando acceso"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        Espera un momento por favor.
                    </p>
                </div>
            </div>
        </div>
    )
}
