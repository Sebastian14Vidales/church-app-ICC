import { useEffect } from "react"
import { Outlet } from "react-router-dom"
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/AuthHeader";
import { ToastContainer } from "react-toastify";

export default function AppLayout() {
    useEffect(() => {
        document.documentElement.classList.add("app-layout-active")
        document.body.classList.add("app-layout-active")

        return () => {
            document.documentElement.classList.remove("app-layout-active")
            document.body.classList.remove("app-layout-active")
        }
    }, [])

    return (
        <div className="flex h-dvh overflow-hidden bg-slate-100">
            <Sidebar />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <Header />
                <main className="min-h-0 flex-1 overflow-y-auto bg-slate-100">
                    <div className="px-4 py-8 sm:px-6 lg:px-8">
                        <Outlet />
                    </div>
                </main>

                <ToastContainer
                    pauseOnHover={false}
                    pauseOnFocusLoss={false}
                    autoClose={2000}
                    theme="dark"
                />
            </div>
        </div>
    );
}
