import { Menu, Bell } from "lucide-react"
import { getInitials, useAuth } from "@/lib/auth"

export default function AuthHeader() {
    const { user } = useAuth()
    const initials = getInitials(user?.name ?? "Usuario")
    const primaryRole = user?.roles[0] ?? "Usuario"

    return (
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <button type="button" className="-m-2.5 p-2.5 text-gray-700 lg:hidden">
                <Menu className="h-6 w-6" />
            </button>

            <div className="h-6 w-px bg-gray-200 lg:hidden" />

            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                <div className="relative flex flex-1 items-center">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Bienvenido, {user?.name ?? "Usuario"}
                    </h2>
                    <p className="ml-3 hidden text-sm text-gray-500 md:block">{primaryRole}</p>
                </div>

                <div className="flex items-center gap-x-4 lg:gap-x-6">
                    <button type="button" className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500">
                        <Bell className="h-6 w-6" />
                    </button>

                    <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" />

                    <div className="relative">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
                            <span className="text-sm font-medium text-white">{initials}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
